export type RandomSource = () => number;

export const createSeededRandom = (seed: number): RandomSource => {
    let state = Math.trunc(seed) >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

export const deriveSeed = (rootSeed: number, ...domains: Array<string | number>) => {
    let hash = Math.trunc(rootSeed) >>> 0;
    for (const domain of domains) {
        const text = String(domain);
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        hash ^= 0xff;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
};

export const createDomainRandom = (
    rootSeed: number,
    ...domains: Array<string | number>
) => createSeededRandom(deriveSeed(rootSeed, ...domains));
