import { EVENT_CHAINS, normalizeDeferredEventChainSteps } from '../../data/eventChains';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { formatEventText } from '../../utils/eventPresentation';
import type { DeferChainEventPayload, ResolveChainGoldChoicePayload } from '../actionTypes';
import type { GameState, HandlerMap } from '../gameReducer';
import { GS } from '../gameStates';
import { RELICS } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';

const PAYLOAD_KEYS = ['chainId', 'choiceIndex', 'step'];

const isPayload = (value: unknown): value is ResolveChainGoldChoicePayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    const keys = Reflect.ownKeys(payload);
    return keys.length === PAYLOAD_KEYS.length
        && keys.every((key) => typeof key === 'string' && PAYLOAD_KEYS.includes(key))
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

const appendRequirementError = (state: GameState, id: string, text: string) => {
    if (state.logs.some((log) => log?.id === id)) return state;
    return {
        ...state,
        logs: [...state.logs, { id, type: 'error', text }].slice(-BALANCE.LOG_MAX_SIZE),
    };
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
        // 병합(2026-09): EVENT_CHAINS는 `: any` 애노테이션을 걷어내 리터럴에서 추론된다.
        //   step/outcome은 체인마다 모양이 달라 40여 개 유니온이 되므로, 이 범용 접근자
        //   경로에서만 로컬 `any`로 받는다(런타임 검증은 아래 구조 비교가 담당).
        const stepData: any = chain?.steps.find((candidate) => candidate.step === step);
        const outcome: any = stepData?.event?.outcomes?.[choiceIndex];
        if (!stepData) return state;
        if (outcome?.type !== 'nothing' || outcome.reward) return state;
        if (!structurallyEqual(event, { ...stepData.event, _chainId: chainId, _chainStep: step })) return state;

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
        // 병합(2026-09): EVENT_CHAINS는 `: any` 애노테이션을 걷어내 리터럴에서 추론된다.
        //   step/outcome은 체인마다 모양이 달라 40여 개 유니온이 되므로, 이 범용 접근자
        //   경로에서만 로컬 `any`로 받는다(런타임 검증은 아래 구조 비교가 담당).
        const stepData: any = chain?.steps.find((candidate) => candidate.step === step);
        const outcome: any = stepData?.event?.outcomes?.[choiceIndex];
        const amount = outcome?.reward?.amount;
        if (!stepData
            || !Number.isSafeInteger(amount)
            || amount >= 0
            || outcome.reward?.type !== 'gold'
            || outcome.type !== 'chain_advance') return state;

        const canonicalEvent = {
            ...stepData.event,
            _chainId: chainId,
            _chainStep: step,
        };
        if (!structurallyEqual(event, canonicalEvent)) return state;

        const gold = state.player.gold ?? Number.NaN;
        const cost = -amount;
        if (!Number.isFinite(gold) || gold < cost) {
            const id = `chain-gold-insufficient:${chainId}:${step}:${choiceIndex}`;
            return appendRequirementError(state, id, MSG.GOLD_INSUFFICIENT);
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
                return appendRequirementError(
                    state,
                    `chain-relic-owned:${chainId}:${step}:${choiceIndex}`,
                    MSG.CHAIN_RELIC_ALREADY_OWNED(String(rewardRelic.name || rewardRelic.id || relicId)),
                );
            }
            const maxRelics = getPrestigeUnlocks(state.player.meta?.prestigeRank).maxRelics;
            if (relics.length >= maxRelics) {
                return appendRequirementError(
                    state,
                    `chain-relic-full:${chainId}:${step}:${choiceIndex}`,
                    MSG.CHAIN_RELIC_SLOTS_FULL,
                );
            }
        }

        return {
            ...state,
            player: {
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
            },
            currentEvent: null,
            gameState: GS.IDLE,
            logs: [
                ...state.logs,
                {
                    id: `chain-gold:${chainId}:${step}:${choiceIndex}`,
                    type: 'event',
                    text: formatEventText(outcome.log),
                },
            ].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
} satisfies HandlerMap;
