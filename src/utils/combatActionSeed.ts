const UINT32_MAX = 0xffffffff;
const UINT32_RANGE = 0x100000000;

export const resolveCombatActionSeed = (
    rng: () => number,
    testHarnessSeed?: unknown,
): number => {
    if (Number.isSafeInteger(testHarnessSeed)
        && Number(testHarnessSeed) >= 0
        && Number(testHarnessSeed) <= UINT32_MAX) {
        return Number(testHarnessSeed);
    }
    return Math.floor(rng() * UINT32_RANGE);
};
