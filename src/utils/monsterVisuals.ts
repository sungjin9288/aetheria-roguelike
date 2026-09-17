import monsterArtManifest from '../data/monsterArtManifest.json' with { type: 'json' };

export type RegionVisualKey = string;

export interface MonsterVisual {
    key: string;
    regionKey: RegionVisualKey;
    src: string;
}

type MonsterArtEntry = {
    key: string;
    runtimePath: string;
    regionKey: string;
};

const MONSTER_ART_ENTRIES = monsterArtManifest.entries as Record<string, MonsterArtEntry>;
const MONSTER_VISUALS: Record<string, MonsterVisual> = Object.fromEntries(
    Object.entries(MONSTER_ART_ENTRIES).map(([name, entry]) => [name, {
        key: entry.key,
        regionKey: entry.regionKey,
        src: entry.runtimePath,
    }]),
);

const MONSTER_ALIASES = Object.keys(MONSTER_VISUALS).sort((left, right) => right.length - left.length);

export const getMonsterVisual = (name: string): MonsterVisual | null => {
    const exact = MONSTER_VISUALS[name];
    if (exact) return exact;

    const alias = MONSTER_ALIASES.find((candidate) => name.includes(candidate));
    return alias ? MONSTER_VISUALS[alias] : null;
};
