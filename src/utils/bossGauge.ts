import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { DB } from '../data/db.js';
import type { GameMap, Player } from '../types/index.js';
import { getOpenKillQuests } from './questProgress.js';
import type { EnemyThreat } from './enemyThreat.js';

/**
 * bossGauge.ts — 원정 보스 접근 게이지 (2026-07 감사 축4 — 모바일 세션 정합).
 *
 * "지역 진입 → 구역 보스 격파"를 10~15분 원정(Expedition) 단위로 프레이밍하기 위해,
 * 기존 구역 보스의 15% 순수 랜덤 강제 조우(exploreUtils.spawnEnemy)를 제거하고
 * 게이지 누적형으로 대체한다. 미격파 구역 보스가 있는 던전에서 탐험할 때마다
 * BALANCE.BOSS_GAUGE_PER_EXPLORE만큼 누적, 만충 시 다음 탐험에서 "도전 vs 회피"
 * 선택 카드를 제시한다(StS식 "위험을 선택한다"). scoutEvents.ts/campfireEvent.ts와
 * 동일한 순수 함수 빌더 패턴 — 입력 → 새 객체, 부수효과 없음.
 *
 * 저장 위치: player.stats.bossGauge — Record<지역명, number>(0~1). 2026-09 B3에서
 * PlayerStats의 인덱스 시그니처를 제거했으므로 types/player.ts에 명시 선언되어 있다
 * (areaBossDefeated와 동일 패턴). 구세이브에는 필드 자체가 없으므로 모든
 * accessor가 `?.bossGauge?.[loc] ?? 0` 형태로 optional chaining + 기본값 0 처리 —
 * migrateData() 갱신 불필요(areaBossDefeated와 동일 completion 근거, dataMigration.ts:203-204 참조).
 */

/** 구역 보스 이름(문자열)만 유효 대상 — boolean(true)은 이름을 알 수 없어 게이지 대상에서 제외. */
export const getAreaBossName = (mapData: GameMap | null | undefined): string | null => (
    typeof mapData?.boss === 'string' ? mapData.boss : null
);

/** 해당 지역에 구역 보스(이름 확정)가 있고 아직 미격파 상태인지 (player.stats.areaBossDefeated 기준). */
export const isAreaBossUndefeated = (mapData: GameMap | null | undefined, player: Player | null | undefined): boolean => {
    const bossName = getAreaBossName(mapData);
    if (!bossName) return false;
    return !player?.stats?.areaBossDefeated?.[bossName];
};

/**
 * 지금 이 지역의 구역 보스에 도전할 수 있는가 — 게이지 · 도전 카드 · 출현 · 지도 배지 · 원정 HUD · 이동 안내 ·
 * 전투 후 선택이 모두 이 판정을 읽는다(2026-10 Wave 74).
 *
 * 미격파이거나, 격파했어도 수락했고 아직 끝나지 않은 처치 임무가 그 보스를 노리면 참이다. 구역 보스는 여정마다
 * 한 번만 나오는데(`stats.areaBossDefeated`), 임무를 받기 **전에** 잡았으면 그 여정 안에서는 임무를 끝낼 수 없었다
 * (부가 임무 134 · 142 · 151, 그리고 구역 보스로 끝나는 이야기 장 — 본편 사슬이 통째로 막힌다). 임무의 지역이
 * 있으면 그 지역의 구역 보스여야 한다.
 */
export const isAreaBossChallengeable = (mapData: GameMap | null | undefined, player: Player | null | undefined): boolean => {
    const bossName = getAreaBossName(mapData);
    if (!bossName) return false;
    if (!player?.stats?.areaBossDefeated?.[bossName]) return true;
    return getOpenKillQuests(player).some((quest) => quest.target === bossName
        && (!quest.location || getAreaBossName(DB.MAPS[quest.location]) === bossName));
};

/** 특정 지역의 현재 게이지 값 (0~1, 구세이브/미기록 시 0). */
export const getBossGaugeValue = (player: Player | null | undefined, loc: string): number => {
    const raw = player?.stats?.bossGauge?.[loc];
    return typeof raw === 'number' && raw >= 0 ? Math.min(1, raw) : 0;
};

/** 게이지 만충 여부. */
export const isBossGaugeFull = (player: Player | null | undefined, loc: string): boolean => (
    getBossGaugeValue(player, loc) >= 1
);

/**
 * 탐험 1회에 대한 다음 게이지 값을 계산한다 (순수 함수, 새 stats 객체 반환).
 * 도전할 수 있는 구역 보스가 없는 지역이면 기존 stats를 그대로 반환(변화 없음 — `isAreaBossChallengeable`).
 */
export const advanceBossGauge = (player: Player, mapData: GameMap | null | undefined): Player['stats'] => {
    const prevStats = player?.stats || {};
    if (!isAreaBossChallengeable(mapData, player)) return prevStats;

    const loc = player?.loc || '';
    const current = getBossGaugeValue(player, loc);
    const next = Math.min(1, current + BALANCE.BOSS_GAUGE_PER_EXPLORE);
    return {
        ...prevStats,
        bossGauge: { ...(prevStats.bossGauge || {}), [loc]: next },
    };
};

/** 도전 이후 게이지 리셋 — 0으로 되돌리고 그 지역의 회피 기록도 지운다(회피는 게이지를 그대로 둔다 — `markBossGaugeEvaded`). */
export const resetBossGaugeAfterChallenge = (player: Player, loc: string): Player['stats'] => {
    const prevStats = player?.stats || {};
    const { [loc]: _cleared, ...restEvaded } = prevStats.bossGaugeEvadedAt || {};
    return {
        ...prevStats,
        bossGauge: { ...(prevStats.bossGauge || {}), [loc]: 0 },
        ...(prevStats.bossGaugeEvadedAt ? { bossGaugeEvadedAt: restEvaded } : {}),
    };
};

/** 그 지역의 탐험 수(`commitExploreOutcome`가 탐험마다 1 올린다 — 계승 · 사망을 넘어 이어지는 단조 증가 카운터). */
const exploresAt = (player: Player | null | undefined, loc: string): number => {
    const raw = player?.stats?.exploresByLocation?.[loc];
    return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
};

/**
 * Wave 62 C5: "회피 — 흔적을 피해 계속 나아간다"를 고른 지역에서 카드가 다시 뜨기까지 남은 탐험 수.
 * 회피 시점의 그 지역 탐험 수를 적어 두고(`bossGaugeEvadedAt`), 그 뒤 `BALANCE.BOSS_GAUGE_EVADE_EXPLORES`번 탐험할 때까지
 * 억제한다 — 감소시키는 상태가 없어 저장 · 복원 · 탐험 경로와 무관하게 같은 값이 나온다. 기록이 없거나(구세이브)
 * 비정상이면(기록보다 탐험 수가 작다) 억제하지 않는다.
 */
export const getBossGaugeEvadeRemaining = (player: Player | null | undefined, loc: string): number => {
    const evadedAt = player?.stats?.bossGaugeEvadedAt?.[loc];
    if (typeof evadedAt !== 'number' || !Number.isFinite(evadedAt)) return 0;
    const elapsed = exploresAt(player, loc) - evadedAt;
    if (elapsed < 0) return 0;
    return Math.max(0, BALANCE.BOSS_GAUGE_EVADE_EXPLORES - elapsed);
};

/** 회피한 지역에서 보스 카드를 띄우지 않는 중인지. */
export const isBossGaugeCardSuppressed = (player: Player | null | undefined, loc: string): boolean => (
    getBossGaugeEvadeRemaining(player, loc) > 0
);

/** 회피 기록 — 게이지는 그대로(만충) 두고 지금 그 지역의 탐험 수를 적는다. 순수 함수, 새 stats 반환. */
export const markBossGaugeEvaded = (player: Player, loc: string): Player['stats'] => {
    const prevStats = player?.stats || {};
    return {
        ...prevStats,
        bossGaugeEvadedAt: { ...(prevStats.bossGaugeEvadedAt || {}), [loc]: exploresAt(player, loc) },
    };
};

export interface BossGaugeChoiceOutcome {
    choiceIndex: number;
    gaugeEffect: 'challenge' | 'avoid';
    log: string;
}

export interface BossGaugeEvent {
    isBossGaugeChallenge: true;
    bossName: string;
    desc: string;
    choices: string[];
    outcomes: BossGaugeChoiceOutcome[];
}

/**
 * 게이지 만충 시 제시할 "도전 / 회피" 선택 카드. campfireEvent.ts/scoutEvents.ts와
 * 동일하게 순수 함수 — 입력 → 새 이벤트 객체.
 */
export const buildBossChallengeEvent = (bossName: string, threat?: EnemyThreat | null): BossGaugeEvent => ({
    isBossGaugeChallenge: true,
    bossName,
    // Wave 88: 도전 · 회피를 고르는 카드라 위협을 카드 문구에 싣는다(이벤트 화면에는 기록 창이 없다).
    desc: threat
        ? `${MSG.BOSS_GAUGE_FULL_DESC(bossName)} ${MSG.BOSS_THREAT(threat.hit, threat.maxHp, threat.pct, threat.hits)}`
        : MSG.BOSS_GAUGE_FULL_DESC(bossName),
    choices: [MSG.BOSS_GAUGE_CHALLENGE_CHOICE, MSG.BOSS_GAUGE_AVOID_CHOICE],
    outcomes: [
        { choiceIndex: 0, gaugeEffect: 'challenge', log: MSG.BOSS_GAUGE_CHALLENGE_LOG(bossName) },
        { choiceIndex: 1, gaugeEffect: 'avoid', log: MSG.BOSS_GAUGE_AVOID_LOG },
    ],
});
