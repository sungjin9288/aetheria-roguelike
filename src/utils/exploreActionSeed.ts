import { createSeededRandom, type RandomSource } from './seededRandom.js';

const UINT32_MAX = 0xffffffff;

export const resolveExploreActionRandom = (
    productionRng: RandomSource,
    testHarnessSeed?: unknown,
): RandomSource => (
    Number.isSafeInteger(testHarnessSeed)
    && Number(testHarnessSeed) >= 0
    && Number(testHarnessSeed) <= UINT32_MAX
        ? createSeededRandom(Number(testHarnessSeed))
        : productionRng
);
