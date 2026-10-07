/**
 * bossPresence.ts — "이 플레이어에게 이 지역에서 보스가 나올 수 있는가" (2026-10 Wave 61).
 *
 * 지도(출구 배지 · 위험 · 예상 교전 · 경로 노드)와 모험 가이드(이동 추천 · 경로 계획 · 탐험 전망)의 보스 표시가 읽는
 * 단일 판정이다. 지역의 `boss` 필드(이름 문자열 또는 `true`)는 출현을 보장하지 않는다 — 실제 출현 경로는 넷뿐이다.
 *  1. 조우 풀(`monsters`)의 보스 — 보스 여부는 `spawnEnemy`와 같은 `isEncounterBoss`.
 *  2. 아직 쓰러뜨리지 않은 구역 보스(`boss` 이름) — 게이지 도전(`spawnEnemy`의 `forceAreaBoss`).
 *  3. 해금된 숨은 보스 — 해금 규칙은 `HIDDEN_BOSS_UNLOCKS` 하나이고 `spawnEnemy`도 이 표를 읽는다.
 *  4. 혼돈의 심연(`level: 'infinite'`)의 남은 층 보스 — `exploreFlow`가 보스 층(`BALANCE.ABYSS_BOSS_FLOORS`)에서 세운다.
 * `boss: true`만 보던 동안 지하 미궁 · 공중 신전 · 금지된 도서관은 해금 전에도 보스 지역으로 표시됐고, 구역 보스를 쓰러뜨린
 * 지역은 배지만 숨고 위험 '보스' · 예상 '보스 교전'이 남았다. `tests/map-badge-title-text-contract.test.js`가 `spawnEnemy`를
 * 오라클로 이 판정을 지역 전수 × 플레이어 상태로 대조한다.
 */
import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import { BOSS_MONSTERS } from '../data/monsters.js';
import type { GameMap, Player } from '../types/index.js';
import { getAreaBossName, isAreaBossChallengeable } from './bossGauge.js';

interface HiddenBossUnlock {
    boss: string;
    loc: string;
    isUnlocked: (player: Player) => boolean;
}

/** Sprint 18: 숨겨진 보스 해금 조건 — 해금되면 그 지역 조우의 `BALANCE.HIDDEN_BOSS_ENCOUNTER_CHANCE`로 나온다(`spawnEnemy`, Wave 76). */
export const HIDDEN_BOSS_UNLOCKS: readonly HiddenBossUnlock[] = Object.freeze([
    // 시간의 파수꾼: 시간술사 직업 + Lv 40+ (공중 신전)
    { boss: '시간의 파수꾼', loc: '공중 신전', isUnlocked: (player: Player) => player.job === '시간술사' && (player.level || 1) >= 40 },
    // 원한의 용사: "최후의 영웅" 체인 3단계 완료 (지하 미궁)
    {
        boss: '원한의 용사',
        loc: '지하 미궁',
        isUnlocked: (player: Player) => {
            const lastHeroStep = player.eventChainProgress?.last_hero;
            return (typeof lastHeroStep === 'number' ? lastHeroStep : 0) >= 3;
        },
    },
    // 공허의 군주: 무한 심연 100층 클리어 (금지된 도서관)
    { boss: '공허의 군주', loc: '금지된 도서관', isUnlocked: (player: Player) => (player.stats?.abyssFloor || 0) >= 100 },
    // PR #11: 에테르 군주 — 프레스티지 rank≥10 "에테르 초월" 해금 (에테르 관문)
    { boss: '에테르 군주', loc: '에테르 관문', isUnlocked: (player: Player) => (player.meta?.prestigeRank || 0) >= 10 },
]);

/** `loc`에서 이 플레이어에게 해금된 숨은 보스 — 표 순서 그대로(`spawnEnemy`가 이 순서로 숨은 보스 구간을 나눈다). */
export const getUnlockedHiddenBosses = (loc: string | null | undefined, player: Player): string[] => (
    HIDDEN_BOSS_UNLOCKS
        .filter((entry) => entry.loc === loc && entry.isUnlocked(player))
        .map((entry) => entry.boss)
);

/**
 * 조우한 몬스터가 보스로 정산되는가 — 몬스터 자신의 프로필 · 지역 `bossMonsters` 목록 · `BOSS_MONSTERS`(2026-09 Wave 29).
 * 지역의 `boss` 필드는 보지 않는다(구역 보스의 이름일 뿐이다). `spawnEnemy`의 `isBoss`가 이 함수다.
 */
export const isEncounterBoss = (baseName: string, mapData: GameMap): boolean => {
    const mapBossMonsters = Array.isArray(mapData.bossMonsters) ? mapData.bossMonsters : [];
    return Boolean(
        DB.MONSTERS?.[baseName]?.isBoss
        || mapBossMonsters.includes(baseName)
        || BOSS_MONSTERS.includes(baseName)
    );
};

/** 혼돈의 심연에서 아직 남은 층 보스가 있는가 — 지금 싸우는 층은 돌파한 층 + 1이다(Wave 35). */
const hasRemainingAbyssFloorBoss = (mapData: GameMap, player: Player | null | undefined): boolean => {
    if (mapData.level !== 'infinite') return false;
    const currentFloor = (player?.stats?.abyssFloor || 0) + 1;
    return BALANCE.ABYSS_BOSS_FLOORS.some((floor) => floor >= currentFloor);
};

/**
 * 이 플레이어가 `mapName` 지역을 탐험해 보스를 만날 수 있는가. 지역 이름은 숨은 보스 해금(지역별)에 쓴다 —
 * `DB.MAPS`의 지역 데이터에는 `name`이 없으므로(cycle 71) 호출처가 이름을 넘긴다.
 */
export const canBossAppearInMap = (
    mapName: string | null | undefined,
    mapData: GameMap | null | undefined,
    player: Player | null | undefined,
): boolean => {
    if (!mapData) return false;
    const encounterNames = [
        ...(Array.isArray(mapData.monsters) ? mapData.monsters : []),
        ...(player ? getUnlockedHiddenBosses(mapName, player) : []),
    ];
    if (encounterNames.some((name) => isEncounterBoss(name, mapData))) return true;

    const areaBossName = getAreaBossName(mapData);
    if (areaBossName !== null && isAreaBossChallengeable(mapData, player) && isEncounterBoss(areaBossName, mapData)) return true;

    return hasRemainingAbyssFloorBoss(mapData, player);
};
