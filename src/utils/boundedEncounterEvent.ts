import type { BoundedEncounter, BoundedEncounterEvent } from '../types/encounter.js';

const presentationTone = (choice: BoundedEncounter['choices'][number]) => {
    if (Number(choice.cost?.hp) > 0) return 'danger' as const;
    if (Number(choice.cost?.mp) > 0 || choice.outcome.buff) return 'story' as const;
    return 'reward' as const;
};

export const buildBoundedEncounterEvent = (
    encounter: BoundedEncounter,
    occurrenceSequence: number,
): BoundedEncounterEvent => ({
    isBoundedEncounter: true,
    boundedEncounterId: encounter.id,
    boundedOccurrenceSequence: occurrenceSequence,
    title: encounter.family,
    desc: encounter.situation,
    choices: encounter.choices.map((choice) => choice.label),
    outcomes: encounter.choices.map((choice, choiceIndex) => ({
        choiceIndex,
        choiceId: choice.id,
        tradeoff: choice.tradeoff,
        tone: presentationTone(choice),
    })),
});
