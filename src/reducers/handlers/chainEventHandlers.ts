import { EVENT_CHAINS, normalizeDeferredEventChainSteps } from '../../data/eventChains';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { formatEventText } from '../../utils/eventPresentation';
import type { DeferChainEventPayload, ResolveChainGoldChoicePayload } from '../actionTypes';
import type { GameState, HandlerMap } from '../gameReducer';
import { GS } from '../gameStates';
import { RELICS } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { rejectEventChoice } from './eventChoiceFeedback';
import { advanceDailyProtocol, getDailyProtocolRewardLogs } from './helpers';
import { clampVitalsToEffectiveMax } from '../../utils/effectiveVitals';
import type { GameEvent } from '../../types/session.js';

const PAYLOAD_KEYS = ['chainId', 'choiceIndex', 'step'];

/**
 * `EVENT_CHAINS`(eventChains.ts)는 any 애노테이션 없이 리터럴에서 추론되지만, 13개 체인 ×
 * 3스텝의 `outcome.reward`가 체인마다 다른 모양(gold/relic/item/null)이라 실제 추론
 * 타입은 거대한 유니온이다. 이 파일은 gold/relic 분기만 실제로 읽으므로, 그 필드만
 * 선언한 최소 형태로 결과를 받는다(구조 자체는 real EVENT_CHAINS의 부분집합이라
 * 캐스팅 없이도 대입 가능 — 필드 값 검증은 아래 구조 비교/타입 가드가 담당한다).
 */
interface ChainRewardData {
    type?: string;
    amount?: unknown;
    relicId?: unknown;
    name?: unknown;
    [key: string]: unknown;
}

interface ChainOutcomeData {
    type?: string;
    log?: string;
    reward?: ChainRewardData | null;
}

interface ChainStepData {
    step?: number;
    event?: {
        outcomes?: ChainOutcomeData[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

const isPayload = (value: unknown): value is ResolveChainGoldChoicePayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    const keys = Reflect.ownKeys(payload);
    // Wave 61: `relicRoll`만 선택 키로 받는다(일일 '골드 소비' 보상 판정) — 나머지 키 집합은 그대로 엄격하다.
    const hasRelicRoll = Object.prototype.hasOwnProperty.call(payload, 'relicRoll');
    if (hasRelicRoll && !(typeof payload.relicRoll === 'number' && payload.relicRoll >= 0 && payload.relicRoll < 1)) return false;
    return keys.length === PAYLOAD_KEYS.length + (hasRelicRoll ? 1 : 0)
        && keys.every((key) => typeof key === 'string' && (PAYLOAD_KEYS.includes(key) || key === 'relicRoll'))
        && typeof payload.chainId === 'string'
        && payload.chainId.trim().length > 0
        && Number.isSafeInteger(payload.step)
        && Number(payload.step) >= 0
        && Number.isSafeInteger(payload.choiceIndex)
        && Number(payload.choiceIndex) >= 0;
};

const structurallyEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((value, index) => structurallyEqual(value, right[index]));
    }
    if (!left || typeof left !== 'object' || !right || typeof right !== 'object') return false;

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => (
            Object.hasOwn(rightRecord, key)
            && structurallyEqual(leftRecord[key], rightRecord[key])
        ));
};

const isDeferralPayload = (value: unknown): value is DeferChainEventPayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const { expectedExploreCount, ...choice } = value as Record<string, unknown>;
    return isPayload(choice) && Number.isSafeInteger(expectedExploreCount) && Number(expectedExploreCount) >= 0;
};

/**
 * 정본 판정은 이벤트의 **이야기 모양**만 본다 — `choiceFeedback`은 거부 뒤 리듀서가 붙이는 표시용
 * 필드라, 전체 비교에 넣으면 한 번 거부된 이벤트의 모든 선택지가 무반응이 된다(2026-09 Wave 27).
 */
const storyShape = (event: GameEvent | null) => {
    if (!event) return event;
    const { choiceFeedback: _feedback, ...story } = event;
    return story;
};

export const chainEventActionMap = {
    DEFER_CHAIN_EVENT: (state, action) => {
        if (state.gameState !== GS.EVENT || !isDeferralPayload(action.payload)) return state;
        const { chainId, step, choiceIndex, expectedExploreCount } = action.payload;
        if ((state.player.stats?.explores ?? 0) !== expectedExploreCount) return state;
        const event = state.currentEvent;
        if (event?._chainId !== chainId || event?._chainStep !== step) return state;
        if ((state.player.eventChainProgress?.[chainId] ?? 0) !== step) return state;
        if (state.player.deferredEventChainSteps?.[chainId] === step) return state;
        const chain = EVENT_CHAINS.find((candidate) => candidate.id === chainId);
        // W8-Z4: 위 ChainStepData/ChainOutcomeData(최소 형태)로 받는다 — 실제 EVENT_CHAINS는
        //   체인마다 다른 거대한 유니온이지만 그 구조의 부분집합이라 캐스팅 없이 대입된다.
        const stepData: ChainStepData | undefined = chain?.steps.find((candidate) => candidate.step === step);
        const outcome: ChainOutcomeData | undefined = stepData?.event?.outcomes?.[choiceIndex];
        if (!stepData) return state;
        if (outcome?.type !== 'nothing' || outcome.reward) return state;
        if (!structurallyEqual(storyShape(event), { ...stepData.event, _chainId: chainId, _chainStep: step })) return state;

        return {
            ...state,
            player: { ...state.player, deferredEventChainSteps: {
                ...normalizeDeferredEventChainSteps(state.player.deferredEventChainSteps, state.player.eventChainProgress),
                [chainId]: step,
            } },
            currentEvent: null,
            gameState: GS.IDLE,
            logs: [...state.logs, {
                id: `chain-deferred:${chainId}:${step}:${state.player.stats?.explores || 0}`,
                type: 'event', text: `${formatEventText(outcome.log)} 이 이야기는 이번 원정에서 미룹니다.`,
            }].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
    RESOLVE_CHAIN_GOLD_CHOICE: (state, action) => {
        if (state.gameState !== GS.EVENT || !isPayload(action.payload)) return state;

        const { chainId, step, choiceIndex } = action.payload;
        const event = state.currentEvent;
        if (event?._chainId !== chainId || event?._chainStep !== step) return state;
        if ((state.player.eventChainProgress?.[chainId] ?? 0) !== step) return state;

        const chain = EVENT_CHAINS.find((candidate) => candidate.id === chainId);
        // W8-Z4: 위 ChainStepData/ChainOutcomeData(최소 형태)로 받는다 — 실제 EVENT_CHAINS는
        //   체인마다 다른 거대한 유니온이지만 그 구조의 부분집합이라 캐스팅 없이 대입된다.
        const stepData: ChainStepData | undefined = chain?.steps.find((candidate) => candidate.step === step);
        const outcome: ChainOutcomeData | undefined = stepData?.event?.outcomes?.[choiceIndex];
        const amount = outcome?.reward?.amount;
        // amount(unknown)는 isSafeInteger 통과 후에만 산술 비교가 실행되므로(||의 단락
        // 평가) 이 지점에선 실제로 유한 정수임이 보장된다 — Number(...)는 그 사실을
        // 타입에 반영하는 항등 변환.
        if (!stepData
            || !outcome
            || !Number.isSafeInteger(amount)
            || Number(amount) >= 0
            || outcome.reward?.type !== 'gold'
            || outcome.type !== 'chain_advance') return state;

        const canonicalEvent = {
            ...stepData.event,
            _chainId: chainId,
            _chainStep: step,
        };
        if (!structurallyEqual(storyShape(event), canonicalEvent)) return state;

        const gold = state.player.gold ?? Number.NaN;
        const cost = -Number(amount);
        // 거부 3종(골드 부족 · 유물 중복 · 슬롯 가득)은 이벤트를 열어 둔 채 그 선택지에 이유를 붙인다 —
        //   이벤트 화면에는 TerminalView가 없어 오류 로그만으로는 무반응과 구별되지 않았다(2026-09 Wave 27).
        if (!Number.isFinite(gold) || gold < cost) {
            return rejectEventChoice(state, {
                logId: `chain-gold-insufficient:${chainId}:${step}:${choiceIndex}`,
                choiceIndex,
                text: MSG.GOLD_INSUFFICIENT,
            });
        }

        const relicId = outcome.reward?.relicId;
        const rewardRelic = typeof relicId === 'string'
            ? RELICS.find((relic) => relic.id === relicId) || null
            : null;
        if (relicId && !rewardRelic) return state;

        const relics = Array.isArray(state.player.relics) ? state.player.relics : null;
        const relicCount = state.player.stats?.relicCount ?? 0;
        if (rewardRelic) {
            if (!Array.isArray(relics) || !Number.isSafeInteger(relicCount) || relicCount < 0) return state;
            if (relics.some((relic) => relic?.id === rewardRelic.id)) {
                return rejectEventChoice(state, {
                    logId: `chain-relic-owned:${chainId}:${step}:${choiceIndex}`,
                    choiceIndex,
                    text: MSG.CHAIN_RELIC_ALREADY_OWNED(String(rewardRelic.name || rewardRelic.id || relicId)),
                });
            }
            const maxRelics = getPrestigeUnlocks(state.player.meta?.prestigeRank).maxRelics;
            if (relics.length >= maxRelics) {
                return rejectEventChoice(state, {
                    logId: `chain-relic-full:${chainId}:${step}:${choiceIndex}`,
                    choiceIndex,
                    text: MSG.CHAIN_RELIC_SLOTS_FULL,
                });
            }
        }

        // 2026-10 Wave 65 (원장 §61.5 · §66): 유물 지급은 빌드 성향을 바꿀 수 있다 — 성향 보너스만큼 유효 최대 기력이 줄면 현재치도
        //   내린다(선택 · 교체 지급과 같은 규칙, Wave 27 N2 D8). 상인의 인장(골드 수급)이 탐험 성향을 3점으로 올려 비전 성향을 밀어내면
        //   최대 기력 355 → 345인데 현재 355가 남았다.
        const paidPlayer = clampVitalsToEffectiveMax({
            ...state.player,
            gold: gold - cost,
            ...(rewardRelic ? {
                relics: [...(relics || []), rewardRelic],
                stats: {
                    ...(state.player.stats || {}),
                    relicCount: relicCount + 1,
                },
            } : {}),
            eventChainProgress: {
                ...(state.player.eventChainProgress || {}),
                [chainId]: step + 1,
            },
        });
        // Wave 61: 이야기 골드 지불도 골드 소비다 — 일일 '골드 소비'에 더한다(휴식 · 기술 교체 · 정찰과 같은 경로, 원장 §61 A17).
        //   지불 · 유물을 먼저 반영한 뒤 진행하므로 일일 보상의 유물 변환도 지금 유물 칸을 본다.
        const daily = advanceDailyProtocol(paidPlayer, 'goldSpend', cost, action.payload.relicRoll);
        const dailyLogs = getDailyProtocolRewardLogs(daily.reward);
        return {
            ...state,
            player: daily.player,
            currentEvent: null,
            gameState: GS.IDLE,
            logs: [
                ...state.logs,
                {
                    id: `chain-gold:${chainId}:${step}:${choiceIndex}`,
                    type: 'event',
                    text: formatEventText(outcome.log),
                },
                ...dailyLogs.map((entry, index) => ({ id: `chain-gold-daily:${chainId}:${step}:${choiceIndex}:${index}`, ...entry })),
            ].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
} satisfies HandlerMap;
