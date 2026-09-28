import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getStructuredFallbackTransaction } from '../../data/structuredFallbackEvents';
import { CombatEngine } from '../../systems/CombatEngine';
import { formatEventText } from '../../utils/eventPresentation';
import type { ResolveFallbackEventTransactionPayload } from '../actionTypes';
import type { GameState, HandlerMap } from '../gameReducer';
import { GS } from '../gameStates';
import { addNewTitles } from './helpers';
import { rejectEventChoice } from './eventChoiceFeedback';
import type { Item } from '../../types';
import type { LogEntry } from '../../types/session.js';

const PAYLOAD_KEYS = ['choiceIndex', 'transactionId'];

const isPayload = (value: unknown): value is ResolveFallbackEventTransactionPayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    const keys = Reflect.ownKeys(payload);
    return keys.length === PAYLOAD_KEYS.length
        && keys.every((key) => typeof key === 'string' && PAYLOAD_KEYS.includes(key))
        && typeof payload.transactionId === 'string'
        && payload.transactionId.trim().length > 0
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

const findCheapestHpRecovery = (inventory: Item[]) => {
    const canonicalByName = new Map(
        (DB.ITEMS.consumables || [])
            .filter((item) => item?.type === 'hp')
            .map((item) => [item.name, item] as const),
    );
    return inventory
        .map((item, index) => ({ item, index, canonical: canonicalByName.get(item?.name) }))
        .filter((entry) => entry.canonical)
        .sort((left, right) => (
            (Number(left.canonical?.price) - Number(right.canonical?.price))
            || (Number(left.canonical?.val) - Number(right.canonical?.val))
            || (left.index - right.index)
        ))[0] || null;
};

export const fallbackEventActionMap = {
    RESOLVE_FALLBACK_EVENT_TRANSACTION: (state, action) => {
        if (state.gameState !== GS.EVENT || !isPayload(action.payload)) return state;

        const { transactionId, choiceIndex } = action.payload;
        const transaction = getStructuredFallbackTransaction(transactionId);
        const event = state.currentEvent;
        // 신원 판정: 출처·선택 인덱스가 틀린 payload는 훅이 만들 수 없는 조합이다(훅은 열린
        //   이벤트의 출처와 원장 거래의 비용 인덱스로 보낸다) — 도달 불가 경로라 동일 참조가 정답이다.
        if (!event
            || !transaction
            || transaction.choiceIndex !== choiceIndex
            || event?.source !== 'fallback') return state;
        // 정본 판정(위조 방지): 원장(structuredFallbackEvents)이 모양의 유일한 소유자다 — 생산자
        //   (pickFallbackEvent)는 원장 값과 거래 id를 그대로 내보내므로 정상 경로에서는 항상 통과한다.
        //   통과하지 못하는 이벤트(변조된 지급액·문구, Wave 27 이전 세이브의 패딩 3선택지, 거래 id가
        //   없거나 다른 거래를 가리키는 세이브)는 지급하지 않되, 무반응 대신 "무효 제안"을 이벤트
        //   화면에 보인다(2026-09 Wave 27 N1 · 통합 후속).
        if (event.fallbackTransactionId !== transactionId
            || event.desc !== transaction.event.desc
            || !structurallyEqual(event.choices, transaction.event.choices)
            || !structurallyEqual(event.outcomes, transaction.event.outcomes)) {
            return rejectEventChoice(state, {
                logId: `fallback-offer-invalid:${transactionId}:${choiceIndex}`,
                choiceIndex,
                text: MSG.EVENT_CHOICE_OFFER_INVALID,
            });
        }

        const inventory = Array.isArray(state.player.inv) ? state.player.inv : [];
        let nextInventory = inventory;
        let nextQuickSlots = state.quickSlots;
        let currentGold = state.player.gold;
        const trackedTotalGold = state.player.stats?.total_gold ?? 0;
        if (!Number.isFinite(currentGold) || !Number.isFinite(trackedTotalGold)) return state;

        if (transaction.cost.type === 'hp-recovery-consumable') {
            const selected = findCheapestHpRecovery(inventory);
            if (!selected) {
                return rejectEventChoice(state, {
                    logId: `fallback-cost-insufficient:${transactionId}:${choiceIndex}`,
                    choiceIndex,
                    text: MSG.FALLBACK_HP_POTION_REQUIRED,
                });
            }
            nextInventory = inventory.filter((_item, index) => index !== selected.index);
            nextQuickSlots = (state.quickSlots || []).map((slot) => {
                if (slot === selected.item) return null;
                if (!selected.item?.id || slot?.id !== selected.item.id) return slot;
                return nextInventory.some((item) => item?.id === selected.item.id) ? slot : null;
            });
        } else {
            if (!Number.isFinite(currentGold) || Number(currentGold) < transaction.cost.amount) {
                return rejectEventChoice(state, {
                    logId: `fallback-cost-insufficient:${transactionId}:${choiceIndex}`,
                    choiceIndex,
                    text: MSG.GOLD_INSUFFICIENT,
                });
            }
            currentGold = Number(currentGold) - transaction.cost.amount;
        }

        const outcome = transaction.event.outcomes[choiceIndex];
        const resultText = formatEventText(outcome.log);
        const logs: LogEntry[] = [{
            id: `fallback-transaction:${transactionId}:${choiceIndex}`,
            type: 'event',
            text: resultText,
        }];
        let player: GameState['player'] = {
            ...state.player,
            gold: Number(currentGold) + transaction.grossGold,
            inv: nextInventory,
            stats: {
                ...(state.player.stats || {}),
                total_gold: Number(trackedTotalGold) + transaction.netGold,
            },
            history: [
                ...(state.player.history || []),
                {
                    event: event.desc,
                    choice: event.choices[choiceIndex],
                    outcome: resultText,
                },
            ].slice(-50),
        };
        const questProgress = CombatEngine.updateQuestProgress(player, '');
        player = { ...player, quests: questProgress.updatedQuests };
        player = addNewTitles(player, logs);

        return {
            ...state,
            player,
            quickSlots: nextQuickSlots,
            currentEvent: null,
            gameState: GS.IDLE,
            logs: [...state.logs, ...logs].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
} satisfies HandlerMap;
