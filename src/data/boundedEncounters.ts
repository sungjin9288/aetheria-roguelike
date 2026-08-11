import type { BoundedEncounter } from '../types/encounter.js';

/**
 * Production activation remains empty until the final candidate has five fresh,
 * human-observed sessions and `boundedEncounterSelection.json` binds exactly two regions.
 * Test fixtures exercise the schema without guessing live content priorities.
 */
export const BOUNDED_ENCOUNTER_PACK_ENABLED = false as const;
export const BOUNDED_ENCOUNTERS: readonly BoundedEncounter[] = Object.freeze([]);
