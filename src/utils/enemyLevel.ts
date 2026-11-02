/**
 * 적 레벨 규칙 (2026-11, 소유자 결정 "지역 레벨 ±4 · 강한 종은 폭 위쪽 · 접두어는 레벨 비례 +레벨" · "지역 레벨÷5, 최대 ±4").
 *
 * - 일반 조우의 레벨은 지역 레벨을 가운데로 한 폭 안에서 정해진다. 폭은 ⌊지역 레벨 ÷ 5⌋, 최대 ±4다(Lv1 ~ 4 지역은 고정,
 *   Lv5 ~ 9는 ±1, Lv20부터 ±4). 레벨 차이가 주는 강함은 낮은 레벨일수록 커서(Lv3 지역의 Lv5 개체는 생명 · 공격력 1.3 ~ 1.4배)
 *   고정 ±4는 첫 1시간의 사망을 6배로 만들었다 — 이 폭은 어디서나 약 ±15 ~ 18%다(원장 §157).
 * - 같은 지역 조우 풀 안에서 강한 종(생명 × 공격력 배율)은 폭의 위쪽, 약한 종은 아래쪽이다. 풀의 평균은 지역 레벨이다.
 * - 레벨은 탐험 난수를 쓰지 않는다 — 탐험 수 · 지역 · 종의 해시다(행상인과 같은 원칙). 추첨을 하나 더 쓰면
 *   오프라인 게임 전체의 난수열이 밀린다. 같은 탐험 · 지역 · 종이면 같은 레벨이라 리로드로 다시 굴릴 수 없다.
 * - 보스 · 이야기 전투 · 구역 보스 · 토벌 우두머리 · 심연은 지역 레벨 그대로다 — 생명이 그 레벨에서 대결로 맞춘 값이다.
 * - 접두어의 강함은 지금 배율 그대로이고(소유자 결정 "지금 강함 유지"), 화면은 그 배율과 같은 강함의 레벨 보너스를
 *   `enemy.levelBonus`로 보인다(`getPrefixLevelBonus`). 배율을 정수 레벨로 바꿔 스탯을 다시 계산하면 낮은 레벨에서 반올림이
 *   거칠다(Lv1 정예 ×1.4가 생명 ×1.6, 날렵한 ×1.1은 0레벨). 접두어 레벨은 화면 표시뿐이다.
 * - 전리품 장비 등급 · 후반 강화 재료 · 초반 정예 구간은 지역 규칙이라 지역 레벨(`regionLevel`)을 읽는다
 *   (`getEnemyRewardLevel`). 굴린 레벨로 정하면 승인된 장비 등급 곡선이 같은 지역 안에서 흔들린다.
 *   경험 · 골드 · 골드 레벨 차이 감액은 굴린 레벨(`enemy.level`)을 따른다 — 높은 개체가 더 준다.
 */
import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import { deriveSeed } from './seededRandom.js';
import { isEncounterBoss } from './bossPresence.js';
import { getPrestigeEnemyLevelBonus } from '../systems/metaBonusRamp.js';
import type { GameMap, Player } from '../types/index.js';
import type { SpawnedMonster } from './exploreUtils.js';

const UINT32 = 0x1_0000_0000;

/** 지역 레벨에서 위아래로 벌어질 수 있는 폭 — ⌊지역 레벨 ÷ 5⌋, 최대 ±4(그래서 Lv1 아래로 내려가지 않는다). */
export const getEnemyLevelSpread = (regionLevel: number): number => (
    Math.max(0, Math.min(BALANCE.ENEMY_LEVEL_SPREAD, Math.floor(regionLevel / BALANCE.ENEMY_LEVEL_SPREAD_STEP)))
);

const speciesPower = (name: string): number => {
    const profile = DB.MONSTERS?.[name];
    return (profile?.hpMult || 1) * (profile?.atkMult || 1);
};

/**
 * 지역 조우 풀 안에서 이 종의 레벨 치우침(−폭/2 ~ +폭/2, 소수). 풀의 보스는 세지 않는다.
 * 종을 강함 순으로 세운 자리이고 같은 강함은 같은 자리(평균)를 나눠 가진다 — 그래서 풀의 평균 치우침은 정확히 0이다.
 * 풀에 없는 종 · 강함이 모두 같은 풀은 0이다.
 */
export const getSpeciesLevelBias = (baseName: string, mapData: GameMap, spread: number): number => {
    const biasMax = Math.floor(spread / 2);
    if (biasMax <= 0) return 0;
    const pool = (mapData.monsters || []).filter((name) => !isEncounterBoss(name, mapData));
    if (pool.length < 2 || !pool.includes(baseName)) return 0;
    const power = speciesPower(baseName);
    const below = pool.filter((name) => speciesPower(name) < power).length;
    const tied = pool.filter((name) => speciesPower(name) === power).length;
    const position = below + (tied - 1) / 2;
    return (position / (pool.length - 1) * 2 - 1) * biasMax;
};

const exploreCount = (player: Player | null | undefined): number => (
    Math.max(0, Math.floor(Number(player?.stats?.explores) || 0))
);

/**
 * 이 조우의 레벨 — 지역 레벨 + 종 치우침 + 탐험 해시(난수 미사용). 해시는 폭 + 1 너비의 연속값이라 반올림해도
 * 기댓값이 치우침 그대로다(지역 평균 = 지역 레벨).
 */
export const rollEnemyLevel = (regionLevel: number, baseName: string, mapData: GameMap, player: Player): number => {
    const spread = getEnemyLevelSpread(regionLevel);
    if (spread <= 0) return regionLevel;
    const bias = getSpeciesLevelBias(baseName, mapData, spread);
    const rollMax = spread - Math.floor(spread / 2);
    const unit = deriveSeed(0, 'enemy-level', exploreCount(player), String(player.loc || ''), baseName) / UINT32;
    const roll = (unit - 0.5) * (rollMax * 2 + 1);
    const offset = Math.max(-spread, Math.min(spread, Math.round(bias + roll)));
    return Math.max(1, regionLevel + offset);
};

/**
 * 접두어 배율을 같은 강함의 레벨로 바꾼 값 — 생명(70 + 32L) · 공격력(15 + 4L)이 레벨에 비례하므로
 * 배율 m은 (m − 1) × (L + `PREFIX_LEVEL_EQUIV_OFFSET`)레벨과 거의 같다. 레벨 1 아래로는 내리지 않는다.
 */
export const getPrefixLevelBonus = (level: number, mod: number): number => {
    const bonus = Math.round((mod - 1) * (level + BALANCE.PREFIX_LEVEL_EQUIV_OFFSET));
    return Math.max(1 - level, bonus);
};

const curveHp = (combatLevel: number) => BALANCE.MONSTER_HP_BASE + combatLevel * BALANCE.MONSTER_HP_PER_LEVEL;
const curveAtk = (combatLevel: number) => 15 + combatLevel * 4;
const curveDef = (combatLevel: number) => BALANCE.MONSTER_DEF_BASE + combatLevel * BALANCE.MONSTER_DEF_PER_LEVEL;
const curveExp = (level: number) => 10 + level * 10;
const curveGold = (level: number) => BALANCE.MONSTER_GOLD_BASE + level * 2;

/**
 * 스폰된 적을 다른 레벨로 옮긴다 — 레벨 곡선의 비율만큼 생명 · 공격력 · 방어력 · 경험 · 골드를 바꾸고 종 · 계승 · 체감 난이도
 * 배율은 그대로 둔다. 토벌 우두머리처럼 지역 레벨에서 맞춘 개체가 일반 조우의 레벨 폭을 물려받지 않게 쓴다.
 */
export const rescaleEnemyToLevel = <T extends SpawnedMonster>(enemy: T, toLevel: number, prestigeRank: number | undefined): T => {
    const fromLevel = enemy.level ?? toLevel;
    if (fromLevel === toLevel) return enemy;
    const combat = (level: number) => level + getPrestigeEnemyLevelBonus(prestigeRank, level);
    const ratio = (curve: (level: number) => number, from: number, to: number) => curve(to) / curve(from);
    const hpRatio = ratio(curveHp, combat(fromLevel), combat(toLevel));
    return {
        ...enemy,
        level: toLevel,
        hp: Math.floor(enemy.hp * hpRatio),
        maxHp: Math.floor(enemy.maxHp * hpRatio),
        atk: Math.floor(enemy.atk * ratio(curveAtk, combat(fromLevel), combat(toLevel))),
        def: Math.floor(enemy.def * ratio(curveDef, combat(fromLevel), combat(toLevel))),
        exp: Math.floor(enemy.exp * ratio(curveExp, fromLevel, toLevel)),
        gold: Math.floor(enemy.gold * ratio(curveGold, fromLevel, toLevel)),
    };
};

/**
 * 전리품 장비 등급 · 후반 강화 재료를 정하는 레벨 — 지역 레벨(`regionLevel`), 없으면(심연 · 지역 밖) 적 레벨이다.
 * 굴린 레벨로 정하면 같은 지역에서 등급 곡선(장비 경제 증빙의 승인 곡선)이 ±4레벨 흔들린다.
 */
export const getEnemyRewardLevel = (enemy: { level?: number; regionLevel?: number }): number | undefined => (
    enemy.regionLevel ?? enemy.level
);
