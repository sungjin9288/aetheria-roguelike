import type { GameMap, MonsterBase, Relic } from '../types/index.js';
import type { Player } from '../types/index.js';

/**
 * spawnEnemy()가 실제로 만드는 몬스터 인스턴스 — Monster(전 필드 optional)보다
 * 좁혀 스폰 시 항상 채우는 7개 필드를 필수로 선언한다. DifficultyManager.ts의
 * applyDynamicDifficulty가 이 타입을 그대로 받아 산술한다(hp/maxHp/atk/exp/gold
 * optional 처리 없이 바로 곱셈).
 */
export type SpawnedMonster = MonsterBase & {
    name: string;
    baseName: string;
    hp: number;
    maxHp: number;
    atk: number;
    def: number;
    exp: number;
    gold: number;
};
/**
 * exploreUtils.ts — 탐험 파이프의 순수 구간 (Phase 1-B → Wave 4 N1).
 *
 * dispatch/addLog를 주입받던 부수효과 함수 6개는 hooks/gameActions/exploreFlow.ts로
 * 옮겼다. 이 모듈은 reducer 계층(actionTypes/gameStates)을 import하지 않는다 —
 * 입력 → 값만 돌려주는 순수 함수(selectEncounterMonster / spawnEnemy /
 * getFirstVisitReward)만 남는다. tests/explore-flow-equivalence.test.js가 계층 가드.
 */
import { DB } from '../data/db.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';
import { BOSS_MONSTERS } from '../data/monsters.js';
// Track J1: FIRST_VISIT_REWARDS 테이블은 data/firstVisitRewards.ts로 분리됨.
import { FIRST_VISIT_REWARDS } from '../data/firstVisitRewards.js';
import { getFocusedExpeditionQuestEntries } from './expeditionMissionFocus';

const getActiveHuntTargets = (mapData: GameMap, player: Player) => {
    const mapMonsters = Array.isArray(mapData.monsters) ? mapData.monsters : [];
    if (mapMonsters.length === 0) return [];

    const targets = getFocusedExpeditionQuestEntries(player).flatMap((entry) => {
        const quest = entry.quest;
        if (entry.isComplete) return [];
        if (quest.location && quest.location !== player.loc) return [];
        return quest.target && mapMonsters.includes(quest.target) ? [quest.target] : [];
    });

    return [...new Set(targets)];
};

export const selectEncounterMonster = (encounterPool: string[], mapData: GameMap, player: Player, random: () => number) => {
    const huntTargets = getActiveHuntTargets(mapData, player);
    if (huntTargets.length > 0 && random() < BALANCE.HUNT_TARGET_FOCUS_CHANCE) {
        return huntTargets[Math.floor(random() * huntTargets.length)];
    }
    return encounterPool[Math.floor(random() * encounterPool.length)];
};

// ─────────────────────────────────────────────────────────────────────────
// 3. 몬스터 스탯 생성 + 접두어 부여 (Phase 1-B)
// 2026-07 — 원정 보스 접근 게이지: 구역 보스의 15% 순수 랜덤 강제 조우를 제거하고
//   (bossGauge.ts) 게이지 만충 후 "도전" 선택 시에만 forceAreaBoss:true로 결정론적
//   스폰한다. options 미전달 시 기존 동작(구역 보스는 encounterPool에서 제외, 일반
//   풀에서만 스폰)과 동일 — 하위 호환.
// ─────────────────────────────────────────────────────────────────────────
export const spawnEnemy = (mapData: GameMap, player: Player, playerRelics: Relic[], { addLog }: { addLog: (type: string, text: string) => void }, options: { forceAreaBoss?: boolean; rng?: () => number } = {}) => {
    const rng = options.rng || Math.random;
    const mapBossMonsters = Array.isArray(mapData.bossMonsters) ? mapData.bossMonsters : [];
    let encounterPool = [...(mapData.monsters || [])];

    // Sprint 18: 숨겨진 보스 해금 조건 체크
    const hiddenBossChecks = [
        // 시간의 파수꾼: 시간술사 직업 + Lv 40+ (공중 신전)
        { boss: '시간의 파수꾼', loc: '공중 신전', check: () => player.job === '시간술사' && (player.level || 1) >= 40 },
        // 원한의 용사: "최후의 영웅" 체인 3단계 완료 (지하 미궁)
        {
            boss: '원한의 용사',
            loc: '지하 미궁',
            check: () => {
                const lastHeroStep = player.eventChainProgress?.last_hero;
                return (typeof lastHeroStep === 'number' ? lastHeroStep : 0) >= 3;
            },
        },
        // 공허의 군주: 무한 심연 100층 클리어 (금지된 도서관)
        { boss: '공허의 군주', loc: '금지된 도서관', check: () => (player.stats?.abyssFloor || 0) >= 100 },
        // PR #11: 에테르 군주 — 프레스티지 rank≥10 "에테르 초월" 해금 (에테르 관문)
        { boss: '에테르 군주', loc: '에테르 관문', check: () => (player.meta?.prestigeRank || 0) >= 10 },
    ];
    // cycle 71: mapData.name은 MAPS dict에 저장될 때 설정되지 않으므로 항상 undefined.
    // hidden boss spawn이 영원히 트리거되지 않던 버그 수정 — player.loc로 비교.
    const currentLoc = player.loc;
    hiddenBossChecks.forEach(({ boss, loc, check }) => {
        if (currentLoc === loc && check() && !encounterPool.includes(boss)) {
            encounterPool.push(boss);
        }
    });

    const bossHunterRelic = playerRelics.find((r) => r.effect === 'boss_hunter');
    if (bossHunterRelic && mapBossMonsters.length > 0) {
        for (let i = 1; i < Math.max(1, Math.floor(bossHunterRelic.val.spawn || 1)); i += 1) {
            encounterPool = [...encounterPool, ...mapBossMonsters];
        }
    }

    // 구역 보스 — 2026-07: 15% 순수 랜덤 강제 조우 제거, 원정 보스 접근 게이지
    //   (bossGauge.ts) 만충 후 "도전" 선택 시에만 options.forceAreaBoss:true로
    //   결정론적 스폰 (exploreActions.ts/eventActions.ts가 이 함수를 재호출).
    const areaBossName: string | null = typeof mapData.boss === 'string' ? mapData.boss : null;
    const spawnAreaBoss = areaBossName !== null
        && !(player.stats?.areaBossDefeated?.[areaBossName])
        && Boolean(options.forceAreaBoss);
    const baseName: string = (spawnAreaBoss && areaBossName !== null)
        ? areaBossName
        : selectEncounterMonster(encounterPool, mapData, player, rng);
    // 2026-07 타입화: GameMap.level은 number | number[] | 'infinite'. 이 함수의 스폰
    // 스탯 계산은 항상 단일 숫자 레벨을 가정했던 기존 동작 그대로 유지 — 시즌 전용
    // 범위형([min, max]) 맵은 도달 시 최솟값으로 취급 (array 케이스가 원래도 산술에
    // 쓰이지 않던 latent 케이스라 동작 변경 없음).
    const rawLevel = mapData.level;
    let level: number | 'infinite' = typeof rawLevel === 'number'
        ? rawLevel
        : Array.isArray(rawLevel) ? (rawLevel[0] ?? 1) : (rawLevel ?? 1);
    let isInfinite = false;
    let depth = 0;

    if (level === 'infinite') {
        isInfinite = true;
        depth = player.stats?.abyssFloor || 1;
        level = 50 + Math.floor(depth / 2);
    }

    // slice 19: HP 곡선 120+30L → BALANCE.MONSTER_HP_BASE(70)+L×32 — 초반 전투
    //   템포 가속 (Lv1 -32%, Lv50 +3%). 골드 base 10 → 16 (초반 휴식 경제).
    //   ATK/EXP 곡선은 불변 (quest pacing 가드 보존).
    const mStats: SpawnedMonster = {
        name: isInfinite ? `[${depth}층] ${baseName}` : baseName,
        baseName,
        level,
        hp: BALANCE.MONSTER_HP_BASE + level * BALANCE.MONSTER_HP_PER_LEVEL + (depth * 25),
        maxHp: BALANCE.MONSTER_HP_BASE + level * BALANCE.MONSTER_HP_PER_LEVEL + (depth * 25),
        atk: 15 + level * 4 + (depth * 3),
        // PR #3: 적 DEF 곡선 — 이전엔 def 필드 자체가 없어 enemy.def는 항상 undefined였고
        //   calculateDamage도 무시 → 적 방어력 완전 dead. 이제 레벨 비례 def + 비율 경감(K=100)
        //   으로 중후반 firmer. profile.defMult로 탱키 아키타입 가중(아래 적용).
        def: Math.floor(BALANCE.MONSTER_DEF_BASE + level * BALANCE.MONSTER_DEF_PER_LEVEL + depth * BALANCE.MONSTER_DEF_PER_DEPTH),
        exp: 10 + level * 10 + (depth * 4),
        gold: BALANCE.MONSTER_GOLD_BASE + level * 2 + (depth * 3),
        pattern: {
            guardChance: Math.min(0.4, 0.12 + level * 0.01 + (depth * 0.005)),
            heavyChance: Math.min(0.45, 0.15 + level * 0.01 + (depth * 0.005))
        }
    };

    const profile = DB.MONSTERS?.[baseName];
    if (profile) {
        if (profile.hpMult)   { mStats.hp = Math.floor(mStats.hp * profile.hpMult); mStats.maxHp = Math.floor(mStats.maxHp * profile.hpMult); }
        if (profile.atkMult)  { mStats.atk = Math.floor(mStats.atk * profile.atkMult); }
        if (profile.defMult)  { mStats.def = Math.floor(mStats.def * profile.defMult); }
        if (profile.expMult)  { mStats.exp = Math.floor(mStats.exp * profile.expMult); }
        if (profile.goldMult) { mStats.gold = Math.floor(mStats.gold * profile.goldMult); }
        if (profile.dropMod)  mStats.dropMod = profile.dropMod;
        if (profile.weakness) mStats.weakness = profile.weakness;
        if (profile.resistance) mStats.resistance = profile.resistance;
        if (profile.pattern)  mStats.pattern = { ...mStats.pattern, ...profile.pattern };
        if (profile.phase2)   mStats.phase2 = profile.phase2;
        // A1 (2026-09 감사 G1): statusOnHit / phase3 전파 누락 복구.
        //   리더는 이미 존재했으나(enemyAI.ts:66 phase3, :239 statusOnHit) spawnEnemy가
        //   프로파일에서 복사하지 않아 27몬스터의 상태이상 정체성과 보스 3페이즈가
        //   영구 미발동 상태였다.
        if (profile.statusOnHit) mStats.statusOnHit = profile.statusOnHit;
        if (profile.phase3)   mStats.phase3 = profile.phase3;
    }

    mStats.isBoss = Boolean(
        profile?.isBoss
        || mapBossMonsters.includes(baseName)
        || (mapData.boss && mapBossMonsters.length === 0)
        || BOSS_MONSTERS.includes(baseName)
    );

    // eliteOnly 챌린지: 모든 적에게 엘리트 접두어 강제 부여
    const forceElite = player.challengeModifiers?.includes('eliteOnly') && !mStats.isBoss;
    // A-4 (B+ 2026-06): 초반 정예 — Lv ≤ cap에서 낮은 확률로 "정예" 개체 스폰.
    //   완전 엘리트(1.8~2.5x)는 Lv1에 불공정하므로 전용 완화 배율(EARLY_ELITE_MULT)로
    //   첫 위협은 남기되 시작 물약 2개를 모두 잃는 운 나쁜 전투는 제한한다.
    const earlyElite = !mStats.isBoss && !forceElite
        && typeof level === 'number' && level <= BALANCE.EARLY_ELITE_LEVEL_CAP
        && rng() < BALANCE.EARLY_ELITE_CHANCE;
    // PR #8: 프레스티지 rank≥3 해금 — 엘리트 출현 확률 +25%. forceElite처럼 엘리트
    //   접두어를 강제한다(고승천 플레이어에게 더 잦은 정예 위협 = 광고된 "심연의 메아리").
    const prestigeElite = !mStats.isBoss && !forceElite && !earlyElite
        && rng() < getPrestigeUnlocks(player.meta?.prestigeRank).eliteChanceBonus;
    // 접두어 부여
    if (forceElite || earlyElite || prestigeElite || (rng() < BALANCE.PREFIX_CHANCE && CONSTANTS.MONSTER_PREFIXES)) {
        const prefix = earlyElite
            ? { name: '정예', mod: BALANCE.EARLY_ELITE_MULT, expMod: BALANCE.EARLY_ELITE_MULT, dropMod: 2.0, isElite: true }
            : (() => {
                const elitePrefixes = (forceElite || prestigeElite)
                    ? CONSTANTS.MONSTER_PREFIXES.filter((p) => p.isElite)
                    : CONSTANTS.MONSTER_PREFIXES;
                const pool = elitePrefixes.length > 0 ? elitePrefixes : CONSTANTS.MONSTER_PREFIXES;
                return pool[Math.floor(rng() * pool.length)];
            })();
        mStats.name = `${prefix.name} ${baseName}`;
        mStats.hp = Math.floor(mStats.hp * prefix.mod);
        mStats.maxHp = Math.floor(mStats.maxHp * prefix.mod);
        mStats.atk = Math.floor(mStats.atk * prefix.mod);
        mStats.exp = Math.floor(mStats.exp * prefix.expMod);
        mStats.gold = Math.floor(mStats.gold * prefix.expMod);
        mStats.dropMod = (mStats.dropMod || 1.0) * (prefix.dropMod || 1.0);
        mStats.isElite = forceElite || prestigeElite || !!prefix.isElite;

        // 엘리트 몬스터 페이즈: HP 50% 이하 시 패턴 강화 (보스 제외)
        if (mStats.isElite && !mStats.isBoss && !mStats.phase2) {
            const phaseAtkBonus = earlyElite
                ? BALANCE.EARLY_ELITE_PHASE_ATK_BONUS
                : BALANCE.ELITE_PHASE_ATK_BONUS;
            const phaseHeavyBonus = earlyElite
                ? BALANCE.EARLY_ELITE_PHASE_HEAVY_BONUS
                : BALANCE.ELITE_PHASE_HEAVY_BONUS;
            mStats.phase2 = {
                name: `격노한 ${baseName}`,
                atkBonus: phaseAtkBonus,
                pattern: {
                    guardChance: Math.max(0, (mStats.pattern?.guardChance || 0.12) - 0.05),
                    heavyChance: Math.min(0.6, (mStats.pattern?.heavyChance || 0.15) + phaseHeavyBonus),
                },
                log: `${baseName}이(가) 광폭화합니다! 공격이 거세집니다!`,
            };
        }

        if (mStats.isElite) addLog('critical', `⚠️ 엘리트 몬스터 [${prefix.name}] 개체가 등장했습니다!`);
        else if (prefix.name !== '일반적인') addLog('warning', `[${prefix.name}] 개체가 나타났습니다.`);
    }

    // PR #5: 프레스티지(환생) 적 난이도 스케일링 — 최종 1회(profile/prefix 적용 후).
    //   기존 프레스티지는 플레이어 스탯만 올려 매 승천이 쉬워졌다(anti-로그라이크).
    //   rank당 적 스탯/보상을 곱연산 상향해 "깊을수록 어려움"을 회복. rank0은 무변경.
    const prestigeRank = player.meta?.prestigeRank || 0;
    if (prestigeRank > 0) {
        const statMult = 1 + prestigeRank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK;
        const rewardMult = 1 + prestigeRank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK;
        mStats.hp = Math.floor(mStats.hp * statMult);
        mStats.maxHp = Math.floor(mStats.maxHp * statMult);
        mStats.atk = Math.floor(mStats.atk * statMult);
        mStats.def = Math.floor(mStats.def * statMult);
        mStats.exp = Math.floor(mStats.exp * rewardMult);
        mStats.gold = Math.floor(mStats.gold * rewardMult);
    }

    return { mStats, baseName };
};

// ─────────────────────────────────────────────────────────────────────────
// 5. 지역 최초 방문 보상 (Phase 2-C)
// 처음 방문하는 지역에 고정 보상을 지급합니다.
// Track J1 (2026-09): 테이블 본체는 data/firstVisitRewards.ts로 분리됨.
// ─────────────────────────────────────────────────────────────────────────

/**
 * 지역 첫 방문 여부를 확인하고, 해당되면 보상 객체를 반환합니다.
 * @returns {{ gold: number, exp: number, msg: string } | null}
 */
export const getFirstVisitReward = (loc: string, player: Player) => {
    const visited = player.stats?.visitedMaps || [];
    if (visited.includes(loc)) return null;
    return FIRST_VISIT_REWARDS[loc] || null;
};
