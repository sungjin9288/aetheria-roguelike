import type {
    ProgressionAxis,
    ProgressionProfile,
    ProgressionProfileRef,
} from '../types/progression.js';

const PROFILE_KEYS = ['eventMultiplier', 'expMultiplier', 'id', 'lootMultiplier', 'version'];
const AXIS_FIELDS: Record<ProgressionAxis, keyof ProgressionProfile> = {
    exp: 'expMultiplier',
    loot: 'lootMultiplier',
    event: 'eventMultiplier',
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => (
    Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
);

const validMultiplier = (value: unknown) => Number.isFinite(value) && Number(value) > 0;

export const normalizeProgressionProfile = (value: unknown): ProgressionProfile | null => {
    if (!isPlainObject(value) || !hasExactKeys(value, PROFILE_KEYS)) return null;
    if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(value.id)) return null;
    if (!Number.isSafeInteger(value.version) || Number(value.version) < 1) return null;
    if (!validMultiplier(value.expMultiplier)
        || !validMultiplier(value.lootMultiplier)
        || !validMultiplier(value.eventMultiplier)) return null;
    return {
        id: value.id,
        version: Number(value.version),
        expMultiplier: Number(value.expMultiplier),
        lootMultiplier: Number(value.lootMultiplier),
        eventMultiplier: Number(value.eventMultiplier),
    };
};

export const BASELINE_PROGRESSION_PROFILE: Readonly<ProgressionProfile> = Object.freeze({
    id: 'baseline',
    version: 1,
    expMultiplier: 1,
    lootMultiplier: 1,
    eventMultiplier: 1,
});

const PROFILE_REGISTRY: Readonly<Record<string, Readonly<ProgressionProfile>>> = Object.freeze({
    'baseline@1': BASELINE_PROGRESSION_PROFILE,
});

export const resolveProgressionProfile = (reference: unknown): Readonly<ProgressionProfile> => {
    if (!isPlainObject(reference)
        || typeof reference.id !== 'string'
        || !Number.isSafeInteger(reference.version)) return BASELINE_PROGRESSION_PROFILE;
    const key = `${reference.id}@${reference.version}`;
    return Object.hasOwn(PROFILE_REGISTRY, key)
        ? PROFILE_REGISTRY[key]
        : BASELINE_PROGRESSION_PROFILE;
};

export const getActiveProgressionProfile = (player: unknown): Readonly<ProgressionProfile> => {
    if (!isPlainObject(player)) return BASELINE_PROGRESSION_PROFILE;
    const activeExpedition = isPlainObject(player.activeExpedition) ? player.activeExpedition : null;
    return normalizeProgressionProfile(activeExpedition?.progressionProfile)
        || BASELINE_PROGRESSION_PROFILE;
};

export const scaleProgressionExpReward = (player: unknown, rawReward: unknown) => {
    const reward = Number(rawReward);
    if (!Number.isFinite(reward) || reward <= 0) return 0;
    return Math.floor(reward * getActiveProgressionProfile(player).expMultiplier);
};

export const getProgressionLootMultiplier = (player: unknown) => (
    getActiveProgressionProfile(player).lootMultiplier
);

export const getProgressionEventMultiplier = (player: unknown) => (
    getActiveProgressionProfile(player).eventMultiplier
);

export const validateProgressionProfileTransition = (
    previousValue: unknown,
    candidateValue: unknown,
    declaredAxis: ProgressionAxis,
) => {
    const previous = normalizeProgressionProfile(previousValue);
    const candidate = normalizeProgressionProfile(candidateValue);
    if (!previous || !candidate || !Object.hasOwn(AXIS_FIELDS, declaredAxis)) {
        return { ok: false, changedAxis: null } as const;
    }
    const changedAxes = (Object.entries(AXIS_FIELDS) as Array<[ProgressionAxis, keyof ProgressionProfile]>)
        .filter(([, field]) => candidate[field] !== previous[field])
        .map(([axis]) => axis);
    const ratio = Number(candidate[AXIS_FIELDS[declaredAxis]]) / Number(previous[AXIS_FIELDS[declaredAxis]]);
    const ok = candidate.version === previous.version + 1
        && changedAxes.length === 1
        && changedAxes[0] === declaredAxis
        && ratio >= 0.8
        && ratio <= 1.2;
    return { ok, changedAxis: ok ? declaredAxis : null } as const;
};

export const progressionProfileRef = (profile: ProgressionProfile): ProgressionProfileRef => ({
    id: profile.id,
    version: profile.version,
});
