import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { getMapPacingProfile } from './explorationPacing.js';
import { getMirrorEffects } from '../systems/mirrorUpgrades.js';
import type { GameMap, Player } from '../types/index.js';

/**
 * scoutEvents.ts — 탐험 스카우팅 (2026-07 감사 (b) "정보 없는 단일 버튼 탐험" 대응).
 *
 * 던전(비안전지대) 탐험 시 낮은 확률로 발동하는 사전 정찰 선택 카드. campfireEvent.ts와
 * 동일한 순수 함수 빌더 패턴 — 입력 → 새 이벤트 객체, 부수효과 없음. exploreActions.ts에서
 * 체인 > 캠프파이어 다음 우선순위로 dispatch되며, 카드 선택은 eventActions.ts의
 * handleEventChoice가 같은 탐험 턴 안에서 즉시 해소한다.
 *
 * 2026-09 D1: player/mapData 인자가 정예 카드 확률 편향에 실제로 사용되며(getScoutEliteCardChance),
 * 플레이어가 직접 호출하는 유료 정찰(getScoutAvailability/getScoutGoldCost)도 이 파일에서 함께 정의한다.
 *
 * 카드 4종 (기본 3장 제시, "정예의 흔적"은 저확률로 3번째 슬롯을 대체):
 *  - combat  : 전투 확정 스폰 + 처치 보상(EXP/골드) +SCOUT_COMBAT_REWARD_BONUS
 *  - anomaly : quiet 롤(이변/유물/이벤트)만 굴림 — 전투 제외, 유물 쪽 편향
 *  - unknown : 기존 explore() 롤 그대로 위임 (미지)
 *  - elite   : 정예 확정 스폰(고위험) + 승리 시 유물 발견 보장
 */

export type ScoutRng = () => number;

export interface ScoutOutcome {
    choiceIndex: number;
    scoutEffect: 'combat' | 'anomaly' | 'unknown' | 'elite';
    log: string;
    rewardBonus?: number;
}

export interface ScoutEvent {
    isScout: true;
    desc: string;
    choices: string[];
    outcomes: ScoutOutcome[];
}

/**
 * 스카우팅 발동 여부. 안전지대(mapData.type === 'safe' 또는 mapData 부재)는 항상 미발동 —
 * 캠프파이어와 동일하게 던전류(dungeon/field/boss)에서만 확률 롤.
 */
export const shouldTriggerScout = (mapData: GameMap | null | undefined, rng: ScoutRng): boolean => {
    if (!mapData || mapData.type === 'safe') return false;
    return rng() < BALANCE.SCOUT_CHANCE;
};

/**
 * 정예 카드 등장 확률 — 기본값(BALANCE.SCOUT_ELITE_CARD_CHANCE)에 상황 가감을 얹는다.
 *  - 유물 pity(exploreState.sinceRelic)가 임계를 넘길수록 위로 편향 (지역 pacing profile의
 *    relicMult를 그대로 재사용 — explorationPacing의 유물 보정과 같은 방향으로 움직인다).
 *  - 생명이 SCOUT_LOW_HP_RATIO 이하이면 아래로 편향 (죽기 직전에 고위험 카드를 들이밀지 않는다).
 * 순수 함수 — 입력 → 숫자. rng를 소비하지 않으므로 호출 순서에 영향이 없다.
 */
export const getScoutEliteCardChance = (
    player: Player | null | undefined,
    mapData: GameMap | null | undefined,
): number => {
    const sinceRelic = Math.max(0, Number(player?.stats?.exploreState?.sinceRelic) || 0);
    const pitySteps = Math.max(0, sinceRelic - BALANCE.SCOUT_ELITE_PITY_THRESHOLD);
    const relicMult = getMapPacingProfile(mapData).relicMult;
    let chance = BALANCE.SCOUT_ELITE_CARD_CHANCE
        + pitySteps * BALANCE.SCOUT_ELITE_PITY_PER_STEP * relicMult;

    const maxHp = Math.max(1, Number(player?.maxHp) || 1);
    const hpRatio = Math.max(0, Number(player?.hp) || 0) / maxHp;
    if (hpRatio <= BALANCE.SCOUT_LOW_HP_RATIO) chance *= BALANCE.SCOUT_LOW_HP_ELITE_MULT;

    return Math.min(BALANCE.SCOUT_ELITE_MAX_CARD_CHANCE, Math.max(0, chance));
};

/**
 * 스카우팅 카드 이벤트 생성. player/mapData는 정예 카드 등장 확률 편향에 실제로 사용된다
 * (getScoutEliteCardChance — 유물 pity ↑ / 저생명 ↓). rng 소비는 1회로 이전과 동일해
 * 같은 seed에서의 호출 순서가 보존된다.
 */
export const buildScoutEvent = (
    player: Player,
    mapData: GameMap | null | undefined,
    rng: ScoutRng
): ScoutEvent => {
    const baseOutcomes: ScoutOutcome[] = [
        { choiceIndex: 0, scoutEffect: 'combat', log: MSG.SCOUT_COMBAT_LOG, rewardBonus: BALANCE.SCOUT_COMBAT_REWARD_BONUS },
        { choiceIndex: 1, scoutEffect: 'anomaly', log: MSG.SCOUT_ANOMALY_LOG },
        { choiceIndex: 2, scoutEffect: 'unknown', log: MSG.SCOUT_UNKNOWN_LOG },
    ];
    const baseChoices = [MSG.SCOUT_COMBAT_CHOICE, MSG.SCOUT_ANOMALY_CHOICE, MSG.SCOUT_UNKNOWN_CHOICE];

    const eliteCardWins = rng() < getScoutEliteCardChance(player, mapData);
    const outcomes = eliteCardWins
        ? [baseOutcomes[0], baseOutcomes[1], { choiceIndex: 2, scoutEffect: 'elite' as const, log: MSG.SCOUT_ELITE_LOG }]
        : baseOutcomes;
    const choices = eliteCardWins
        ? [baseChoices[0], baseChoices[1], MSG.SCOUT_ELITE_CHOICE]
        : baseChoices;

    return {
        isScout: true,
        desc: MSG.SCOUT_DESC,
        choices,
        outcomes,
    };
};

/* ------------------------------------------------------------------ *
 * 플레이어 호출 정찰 (2026-09 D1)
 *  - 탐험 화면의 보조 행동. 골드를 내고(또는 에테르 거울 scout_charges 무료 횟수를 써서)
 *    위 카드를 즉시 불러온다. 랜덤 25% 발동(shouldTriggerScout)은 그대로 유지된다.
 *  - 아래 3개는 전부 순수 함수 — ControlPanel(표시)과 exploreActions(실행)가 같은 함수를
 *    참조해 버튼 라벨과 실제 실행 조건이 어긋나지 않게 한다 (lessons R33).
 * ------------------------------------------------------------------ */

/** 원정 단위 무료 정찰 사용 기록의 키 — 활성 원정이 없으면 고정 키를 쓴다. */
export const getScoutChargeKey = (player: Player | null | undefined): string => (
    player?.activeExpedition?.id || 'no-expedition'
);

/** 이번 원정에서 남은 무료 정찰 횟수 (거울 scout_charges 노드 · 원정이 바뀌면 자동 초기화). */
export const getRemainingScoutCharges = (player: Player | null | undefined): number => {
    const granted = getMirrorEffects(player?.meta).freeScoutCharges;
    if (granted <= 0) return 0;
    const ledger = player?.stats?.scoutCharges;
    const used = ledger && ledger.expeditionId === getScoutChargeKey(player)
        ? Math.max(0, Math.floor(Number(ledger.used) || 0))
        : 0;
    return Math.max(0, granted - used);
};

/** 정찰 비용 — 기본값 + 지역 레벨당 가산 (무한 심연 등 비숫자 레벨은 기본값). */
export const getScoutGoldCost = (mapData: GameMap | null | undefined): number => {
    const level = typeof mapData?.level === 'number' && mapData.level > 0 ? mapData.level : 0;
    return Math.max(
        0,
        Math.floor(BALANCE.SCOUT_GOLD_COST + level * BALANCE.SCOUT_GOLD_COST_PER_MAP_LEVEL),
    );
};

export interface ScoutAvailability {
    /** 실제로 실행 가능한지 — 버튼 disabled와 exploreActions 가드가 같은 값을 쓴다. */
    available: boolean;
    /** 이번 정찰이 무료 횟수로 처리되는지. */
    isFree: boolean;
    /** 무료가 아닐 때 실제로 차감되는 골드. */
    cost: number;
    remainingFree: number;
    /** 불가능할 때 플레이어에게 그대로 보여 줄 이유 (MSG). available이면 null. */
    reason: string | null;
}

/**
 * 정찰 가능 여부 판정. 안전지대/마을과 전투·이벤트 중에는 제공하지 않는다.
 * isIdle은 호출부가 gameState === GS.IDLE을 판정해 넘긴다 (순수 함수 유지를 위해 GS를 import하지 않는다).
 */
export const getScoutAvailability = (
    player: Player | null | undefined,
    mapData: GameMap | null | undefined,
    isIdle: boolean,
): ScoutAvailability => {
    const remainingFree = getRemainingScoutCharges(player);
    const cost = getScoutGoldCost(mapData);
    const isFree = remainingFree > 0;
    const base = { isFree, cost: isFree ? 0 : cost, remainingFree };

    if (!mapData || mapData.type === 'safe') {
        return { ...base, available: false, reason: MSG.SCOUT_SAFE_ONLY };
    }
    if (!isIdle) {
        return { ...base, available: false, reason: MSG.SCOUT_BUSY };
    }
    if (!isFree && (Number(player?.gold) || 0) < cost) {
        return { ...base, available: false, reason: MSG.SCOUT_GOLD_INSUFFICIENT(cost) };
    }
    return { ...base, available: true, reason: null };
};

/**
 * 무료 정찰 1회 사용을 기록한 새 stats 객체 (immutable). 원정이 바뀌면 카운터를 새로 시작한다.
 */
export const consumeScoutCharge = (player: Player): Player['stats'] => {
    const prevStats = player?.stats || {};
    const key = getScoutChargeKey(player);
    const used = prevStats.scoutCharges?.expeditionId === key
        ? Math.max(0, Math.floor(Number(prevStats.scoutCharges.used) || 0))
        : 0;
    return { ...prevStats, scoutCharges: { expeditionId: key, used: used + 1 } };
};
