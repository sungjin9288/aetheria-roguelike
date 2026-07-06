import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { GameMap, Player } from '../types/index.js';

/**
 * scoutEvents.ts — 탐험 스카우팅 (2026-07 감사 (b) "정보 없는 단일 버튼 탐험" 대응).
 *
 * 던전(비안전지대) 탐험 시 낮은 확률로 발동하는 사전 정찰 선택 카드. campfireEvent.ts와
 * 동일한 순수 함수 빌더 패턴 — 입력 → 새 이벤트 객체, 부수효과 없음. exploreActions.ts에서
 * 체인 > 캠프파이어 다음 우선순위로 dispatch되며, 카드 선택은 eventActions.ts의
 * handleEventChoice가 같은 탐험 턴 안에서 즉시 해소한다.
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
 * 스카우팅 카드 이벤트 생성. player/mapData는 향후 상황별 카드 커스터마이즈용으로
 * 시그니처에 유지(현재는 정예 카드 등장 여부만 rng로 결정 — pity/난이도 연동은 후속 확장 지점).
 */
export const buildScoutEvent = (
    _player: Player | { stats?: any },
    _mapData: GameMap | { type?: string },
    rng: ScoutRng
): ScoutEvent => {
    const baseOutcomes: ScoutOutcome[] = [
        { choiceIndex: 0, scoutEffect: 'combat', log: MSG.SCOUT_COMBAT_LOG, rewardBonus: BALANCE.SCOUT_COMBAT_REWARD_BONUS },
        { choiceIndex: 1, scoutEffect: 'anomaly', log: MSG.SCOUT_ANOMALY_LOG },
        { choiceIndex: 2, scoutEffect: 'unknown', log: MSG.SCOUT_UNKNOWN_LOG },
    ];
    const baseChoices = [MSG.SCOUT_COMBAT_CHOICE, MSG.SCOUT_ANOMALY_CHOICE, MSG.SCOUT_UNKNOWN_CHOICE];

    const eliteCardWins = rng() < BALANCE.SCOUT_ELITE_CARD_CHANCE;
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
