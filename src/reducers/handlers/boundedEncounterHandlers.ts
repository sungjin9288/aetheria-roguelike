import { BALANCE } from '../../data/constants.js';
import { BOUNDED_ENCOUNTERS } from '../../data/boundedEncounters.js';
import { MSG } from '../../data/messages.js';
import {
    applyBoundedEncounterChoice,
    type BoundedResourceShortfall,
} from '../../utils/boundedEncounterSelector.js';
import { buildBoundedEncounterEvent } from '../../utils/boundedEncounterEvent.js';
import { GS } from '../gameStates.js';
import type { ResolveBoundedEncounterChoicePayload } from '../actionTypes.js';
import type { HandlerMap } from '../gameReducer.js';
import { rejectEventChoice } from './eventChoiceFeedback.js';

const isPayload = (value: unknown): value is ResolveBoundedEncounterChoicePayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    return typeof payload.encounterId === 'string'
        && typeof payload.choiceId === 'string'
        && typeof payload.expeditionId === 'string'
        && Number.isSafeInteger(payload.occurrenceSequence)
        && Number(payload.occurrenceSequence) >= 1;
};

const sameStringArray = (left: unknown, right: unknown) => (
    Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index])
);

const sameOutcome = (left: unknown, right: unknown) => {
    if (!left || typeof left !== 'object' || Array.isArray(left)
        || !right || typeof right !== 'object' || Array.isArray(right)) return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const expectedKeys = ['choiceId', 'choiceIndex', 'tone', 'tradeoff'];
    const leftKeys = Object.keys(leftRecord).sort();
    if (!sameStringArray(leftKeys, [...expectedKeys].sort())) return false;
    return expectedKeys.every((key) => leftRecord[key] === rightRecord[key]);
};

const matchesCanonicalEvent = (
    event: { boundedOccurrenceSequence?: number; title?: string; desc?: string; choices?: string[]; outcomes?: unknown[] },
    encounter: (typeof BOUNDED_ENCOUNTERS)[number],
) => {
    const canonical = buildBoundedEncounterEvent(encounter, event.boundedOccurrenceSequence ?? -1);
    return event.title === canonical.title
        && event.desc === canonical.desc
        && sameStringArray(event.choices, canonical.choices)
        && Array.isArray(event.outcomes)
        && event.outcomes.length === canonical.outcomes.length
        && event.outcomes.every((outcome: unknown, index: number) => (
            sameOutcome(outcome, canonical.outcomes[index])
        ));
};

/**
 * 플레이어가 고칠 수 있는 정산 거부(자원 부족·가방 가득)의 안내 문장 (2026-09 Wave 27 N1).
 * 이벤트는 열린 채 남는 것이 의도다(2026-08-11 계획) — 그러니 이유가 보여야 한다.
 * 나머지 사유(영수증 중복·무효 데이터)는 훅이 만들 수 없는 조합이라 동일 참조로 둔다.
 */
const rejectionText = (reason: string, shortfall: BoundedResourceShortfall[]) => {
    if (reason === 'inventory_full') return MSG.EVENT_CHOICE_INVENTORY_FULL;
    if (reason !== 'insufficient_resources') return null;
    return MSG.EVENT_CHOICE_COST_UNPAYABLE(shortfall
        .map((entry) => MSG.EVENT_CHOICE_RESOURCE_SHORT(
            MSG.EVENT_CHOICE_RESOURCE_LABELS[entry.resource],
            entry.required,
            entry.current,
        ))
        .join(', '));
};

export const boundedEncounterActionMap = {
    RESOLVE_BOUNDED_ENCOUNTER_CHOICE: (state, action) => {
        if (state.gameState !== GS.EVENT || !state.currentEvent?.isBoundedEncounter) return state;
        if (!isPayload(action.payload)) return state;

        const payload = action.payload;
        const event = state.currentEvent;
        if (!event) return state;
        if (event.boundedEncounterId !== payload.encounterId
            || event.boundedOccurrenceSequence !== payload.occurrenceSequence) return state;

        const activeExpeditionId = state.player.activeExpedition?.id;
        if (activeExpeditionId !== payload.expeditionId
            || state.player.stats?.explores !== payload.occurrenceSequence) return state;

        const encounter = BOUNDED_ENCOUNTERS.find((entry) => entry.id === payload.encounterId);
        if (!encounter || !matchesCanonicalEvent(event, encounter)) return state;
        const result = applyBoundedEncounterChoice(state.player, encounter, payload.choiceId, {
            expeditionId: payload.expeditionId,
            occurrenceSequence: payload.occurrenceSequence,
        });
        if (!result.applied) {
            const text = rejectionText(result.reason, result.shortfall);
            const choiceIndex = encounter.choices.findIndex((choice) => choice.id === payload.choiceId);
            if (!text || choiceIndex < 0) return state;
            const detail = result.shortfall.map((entry) => `${entry.resource}${entry.current}`).join('-');
            return rejectEventChoice(state, {
                logId: `bounded-encounter-blocked:${result.receiptKey}:${payload.choiceId}:${result.reason}:${detail}`,
                choiceIndex,
                text,
            });
        }

        const log = {
            id: `bounded-encounter:${result.receiptKey}`,
            type: 'success',
            text: result.result,
        };
        return {
            ...state,
            player: result.player,
            currentEvent: null,
            gameState: GS.IDLE,
            logs: [...state.logs, log].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
} satisfies HandlerMap;
