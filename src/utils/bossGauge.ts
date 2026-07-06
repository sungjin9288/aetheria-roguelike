import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { GameMap, Player } from '../types/index.js';

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
 * 저장 위치: player.stats.bossGauge — Record<지역명, number>(0~1). PlayerStats가
 * 이미 `[key: string]: any` 인덱스 시그니처를 갖고 있어(areaBossDefeated와 동일 패턴)
 * 타입 정의 변경 없이 안전하게 추가 가능. 구세이브에는 필드 자체가 없으므로 모든
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
 * 미격파 구역 보스가 없는 지역이면 기존 stats를 그대로 반환(변화 없음).
 */
export const advanceBossGauge = (player: Player, mapData: GameMap | null | undefined): Player['stats'] => {
    const prevStats = player?.stats || {};
    if (!isAreaBossUndefeated(mapData, player)) return prevStats;

    const loc = player?.loc || '';
    const current = getBossGaugeValue(player, loc);
    const next = Math.min(1, current + BALANCE.BOSS_GAUGE_PER_EXPLORE);
    return {
        ...prevStats,
        bossGauge: { ...(prevStats.bossGauge || {}), [loc]: next },
    };
};

/** 도전/회피 이후 게이지 리셋 — 회피 시 만충 유지(다음 탐험 재선택), 도전 시 0으로 리셋. */
export const resetBossGaugeAfterChallenge = (player: Player, loc: string): Player['stats'] => {
    const prevStats = player?.stats || {};
    return {
        ...prevStats,
        bossGauge: { ...(prevStats.bossGauge || {}), [loc]: 0 },
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
export const buildBossChallengeEvent = (bossName: string): BossGaugeEvent => ({
    isBossGaugeChallenge: true,
    bossName,
    desc: MSG.BOSS_GAUGE_FULL_DESC(bossName),
    choices: [MSG.BOSS_GAUGE_CHALLENGE_CHOICE, MSG.BOSS_GAUGE_AVOID_CHOICE],
    outcomes: [
        { choiceIndex: 0, gaugeEffect: 'challenge', log: MSG.BOSS_GAUGE_CHALLENGE_LOG(bossName) },
        { choiceIndex: 1, gaugeEffect: 'avoid', log: MSG.BOSS_GAUGE_AVOID_LOG },
    ],
});
