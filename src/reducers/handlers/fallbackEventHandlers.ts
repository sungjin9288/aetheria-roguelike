import { DB } from '../../data/db';
import { BALANCE } from '../../data/constants';
import { MSG } from '../../data/messages';
import { getStructuredFallbackTransaction } from '../../data/structuredFallbackEvents';
import { CombatEngine } from '../../systems/CombatEngine';
import { formatEventText } from '../../utils/eventPresentation';
import type { ResolveFallbackEventTransactionPayload } from '../actionTypes';
import type { GameAction, GameState } from '../gameReducer';
import { GS } from '../gameStates';
import { addNewTitles } from './helpers';

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

const findCheapestHpRecovery = (inventory: any[]) => {
    const canonicalByName = new Map(
        (DB.ITEMS.consumables || [])
            .filter((item: any) => item?.type === 'hp')
            .map((item: any) => [item.name, item]),
    );
    return inventory
        .map((item, index) => ({ item, index, canonical: canonicalByName.get(item?.name) }))
        .filter((entry) => entry.canonical)
        .sort((left: any, right: any) => (
            (Number(left.canonical.price) - Number(right.canonical.price))
            || (Number(left.canonical.val) - Number(right.canonical.val))
            || (left.index - right.index)
        ))[0] || null;
};

const appendRequirementError = (state: GameState, id: string, text: string) => {
    if (state.logs.some((log: any) => log?.id === id)) return state;
    return {
        ...state,
        logs: [...state.logs, { id, type: 'error', text }].slice(-BALANCE.LOG_MAX_SIZE),
    };
};

export const fallbackEventActionMap = {
    RESOLVE_FALLBACK_EVENT_TRANSACTION: (state: GameState, action: GameAction) => {
        if (state.gameState !== GS.EVENT || !isPayload(action.payload)) return state;

        const { transactionId, choiceIndex } = action.payload;
        const transaction = getStructuredFallbackTransaction(transactionId);
        const event = state.currentEvent;
        if (!transaction
            || transaction.choiceIndex !== choiceIndex
            || event?.source !== 'fallback'
            || event?.fallbackTransactionId !== transactionId
            || event.desc !== transaction.event.desc
            || !structurallyEqual(event.choices, transaction.event.choices)
            || !structurallyEqual(event.outcomes, transaction.event.outcomes)) return state;

        const inventory = Array.isArray(state.player.inv) ? state.player.inv : [];
        let nextInventory = inventory;
        let nextQuickSlots = state.quickSlots;
        let currentGold = state.player.gold;
        const trackedTotalGold = state.player.stats?.total_gold ?? 0;
        if (!Number.isFinite(currentGold) || !Number.isFinite(trackedTotalGold)) return state;

        if (transaction.cost.type === 'hp-recovery-consumable') {
            const selected = findCheapestHpRecovery(inventory);
            if (!selected) {
                return appendRequirementError(
                    state,
                    `fallback-cost-insufficient:${transactionId}:${choiceIndex}`,
                    '체력 회복 물약이 필요합니다.',
                );
            }
            nextInventory = inventory.filter((_item: any, index: number) => index !== selected.index);
            nextQuickSlots = (state.quickSlots || []).map((slot: any) => {
                if (slot === selected.item) return null;
                if (!selected.item?.id || slot?.id !== selected.item.id) return slot;
                return nextInventory.some((item: any) => item?.id === selected.item.id) ? slot : null;
            });
        } else {
            if (!Number.isFinite(currentGold) || Number(currentGold) < transaction.cost.amount) {
                return appendRequirementError(
                    state,
                    `fallback-cost-insufficient:${transactionId}:${choiceIndex}`,
                    MSG.GOLD_INSUFFICIENT,
                );
            }
            currentGold = Number(currentGold) - transaction.cost.amount;
        }

        const outcome = transaction.event.outcomes[choiceIndex] as Record<string, any>;
        const resultText = formatEventText(outcome.log);
        const logs: Array<{ id?: string; type: string; text: string }> = [{
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
};
