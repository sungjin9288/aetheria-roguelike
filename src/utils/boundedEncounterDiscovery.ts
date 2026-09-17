import { BOUNDED_ENCOUNTERS } from '../data/boundedEncounters.js';
import type { BoundedEncounter } from '../types/encounter.js';
import type { ClassJourneyEncounterDiscovery } from '../types/player.js';
import { buildBoundedEncounterReceiptKey } from './boundedEncounterSelector.js';

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
);

const compareCodePoints = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const discoveryIdentity = ({
    encounterId,
    encounterVersion,
    choiceId,
}: ClassJourneyEncounterDiscovery) => `${encounterId}\u0000${encounterVersion}\u0000${choiceId}`;

export const projectBoundedEncounterDiscoveries = (
    eventChainProgress: unknown,
    expeditionId: string,
    encounters: readonly BoundedEncounter[] = BOUNDED_ENCOUNTERS,
): ClassJourneyEncounterDiscovery[] => {
    if (!SAFE_ID.test(expeditionId) || !isPlainObject(eventChainProgress)) return [];
    const receiptLedger = eventChainProgress.boundedEncounterReceipts;
    if (!isPlainObject(receiptLedger)) return [];

    const candidates = Object.entries(receiptLedger).flatMap(([receiptKey, receipt]) => {
        if (!isPlainObject(receipt)
            || typeof receipt.encounterId !== 'string'
            || typeof receipt.choiceId !== 'string') return [];

        const lastSeparator = receiptKey.lastIndexOf(':');
        const occurrenceSequence = Number(receiptKey.slice(lastSeparator + 1));
        if (lastSeparator < 0
            || !Number.isSafeInteger(occurrenceSequence)
            || occurrenceSequence < 1) return [];

        try {
            const expectedKey = buildBoundedEncounterReceiptKey(
                expeditionId,
                receipt.encounterId,
                occurrenceSequence,
            );
            if (receiptKey !== expectedKey) return [];
        } catch {
            return [];
        }

        const encounter = encounters.find((entry) => entry?.id === receipt.encounterId);
        const choice = Array.isArray(encounter?.choices)
            ? encounter.choices.find((entry) => entry?.id === receipt.choiceId)
            : undefined;
        const family = typeof encounter?.family === 'string' ? encounter.family.trim() : '';
        const choiceLabel = typeof choice?.label === 'string' ? choice.label.trim() : '';
        if (!encounter
            || !choice
            || !SAFE_ID.test(encounter.id)
            || !SAFE_ID.test(choice.id)
            || !Number.isSafeInteger(encounter.version)
            || encounter.version < 1
            || !family
            || !choiceLabel) return [];

        return [{
            occurrenceSequence,
            discovery: {
                encounterId: encounter.id,
                encounterVersion: encounter.version,
                choiceId: choice.id,
                family,
                choiceLabel,
            },
        }];
    });

    candidates.sort((left, right) => (
        left.occurrenceSequence - right.occurrenceSequence
        || compareCodePoints(left.discovery.encounterId, right.discovery.encounterId)
        || compareCodePoints(left.discovery.choiceId, right.discovery.choiceId)
    ));

    const seen = new Set<string>();
    return candidates.flatMap(({ discovery }) => {
        const identity = discoveryIdentity(discovery);
        if (seen.has(identity)) return [];
        seen.add(identity);
        return [discovery];
    });
};
