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

/**
 * 탐험 계열 단일 reducer 전이(AT.RESOLVE_SCOUT 등)에 실어 보낼 seed.
 * 리듀서는 순수해야 하므로 rng 자체가 아니라 숫자 seed를 건네고,
 * 리듀서가 createSeededRandom으로 같은 스트림을 복원한다 (combatActionSeed와 동일 패턴).
 */
export const resolveExploreActionSeed = (rng: RandomSource): number => (
    Math.floor(rng() * (UINT32_MAX + 1))
);
