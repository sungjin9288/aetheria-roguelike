import { BALANCE } from '../../data/constants.js';
import { BOUNDED_ENCOUNTERS } from '../../data/boundedEncounters.js';
import { applyBoundedEncounterChoice } from '../../utils/boundedEncounterSelector.js';
import { buildBoundedEncounterEvent } from '../../utils/boundedEncounterEvent.js';
import { GS } from '../gameStates.js';
import type { ResolveBoundedEncounterChoicePayload } from '../actionTypes.js';
import type { GameAction, GameState } from '../gameReducer.js';

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

const matchesCanonicalEvent = (event: any, encounter: (typeof BOUNDED_ENCOUNTERS)[number]) => {
    const canonical = buildBoundedEncounterEvent(encounter, event.boundedOccurrenceSequence);
    return event.title === canonical.title
        && event.desc === canonical.desc
        && sameStringArray(event.choices, canonical.choices)
        && Array.isArray(event.outcomes)
        && event.outcomes.length === canonical.outcomes.length
        && event.outcomes.every((outcome: unknown, index: number) => (
            sameOutcome(outcome, canonical.outcomes[index])
        ));
};

export const boundedEncounterActionMap = {
    RESOLVE_BOUNDED_ENCOUNTER_CHOICE: (state: GameState, action: GameAction) => {
        if (state.gameState !== GS.EVENT || !state.currentEvent?.isBoundedEncounter) return state;
        if (!isPayload(action.payload)) return state;

        const payload = action.payload;
        const event = state.currentEvent;
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
        if (!result.applied) return state;

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
};
