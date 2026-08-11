export const LOCAL_GAME_SNAPSHOT_KEY = 'aetheria.game.snapshot.v1';
const DEVICE_QA_NAMESPACE = ['aetheria', 'device-qa'].join('.');
const deviceQaSnapshotKey = (scenario: string) => `${DEVICE_QA_NAMESPACE}.${scenario}.snapshot.v1`;
export const DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('item-investment');
export const GRAVE_RECOVERY_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('grave-recovery');
export const ASCENSION_JOURNEY_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('ascension-journey');
export const MIRROR_JOURNEY_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('mirror-journey');
export const CRYSTAL_EXCHANGE_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('crystal-exchange');
export const SYSTEM_SETTINGS_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('system-settings');
export const PROGRESSION_ACCEPTANCE_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('progression-acceptance');
export const TRUE_ENDING_JOURNEY_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey('true-ending-journey');
export const TOSS_FIRST_FIVE_DEVICE_QA_SNAPSHOT_KEY = deviceQaSnapshotKey(['toss', 'first-five'].join('-'));

type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getBrowserStorage = (): SnapshotStorage | null => {
    try {
        return globalThis.localStorage;
    } catch {
        return null;
    }
};

const readSnapshot = (
    key: string,
    storage: SnapshotStorage | null = getBrowserStorage(),
): Record<string, any> | null => {
    if (!storage) return null;

    try {
        const raw = storage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.player) return null;
        return parsed;
    } catch {
        return null;
    }
};

const writeSnapshot = (
    key: string,
    snapshot: Record<string, any>,
    storage: SnapshotStorage | null = getBrowserStorage(),
) => {
    if (!storage || !snapshot?.player) return false;

    try {
        storage.setItem(key, JSON.stringify(snapshot));
        return true;
    } catch {
        return false;
    }
};

const clearSnapshot = (
    key: string,
    storage: SnapshotStorage | null = getBrowserStorage(),
) => {
    if (!storage) return false;

    try {
        storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
};

export const readLocalGameSnapshot = (storage?: SnapshotStorage | null) => (
    readSnapshot(LOCAL_GAME_SNAPSHOT_KEY, storage)
);

export const writeLocalGameSnapshot = (snapshot: Record<string, any>, storage?: SnapshotStorage | null) => (
    writeSnapshot(LOCAL_GAME_SNAPSHOT_KEY, snapshot, storage)
);

export const clearLocalGameSnapshot = (storage?: SnapshotStorage | null) => (
    clearSnapshot(LOCAL_GAME_SNAPSHOT_KEY, storage)
);

const getDeviceQaSnapshotKey = (scenario?: string | null) => {
    if (scenario === 'grave-recovery') return GRAVE_RECOVERY_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === 'ascension-journey') return ASCENSION_JOURNEY_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === 'mirror-journey') return MIRROR_JOURNEY_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === 'crystal-exchange') return CRYSTAL_EXCHANGE_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === 'system-settings') return SYSTEM_SETTINGS_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === 'progression-acceptance') return PROGRESSION_ACCEPTANCE_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === 'true-ending-journey') return TRUE_ENDING_JOURNEY_DEVICE_QA_SNAPSHOT_KEY;
    if (scenario === ['toss', 'first-five'].join('-')) return TOSS_FIRST_FIVE_DEVICE_QA_SNAPSHOT_KEY;
    return DEVICE_QA_SNAPSHOT_KEY;
};

export const readDeviceQaSnapshot = (storage?: SnapshotStorage | null, scenario?: string | null) => (
    readSnapshot(getDeviceQaSnapshotKey(scenario), storage)
);

export const writeDeviceQaSnapshot = (snapshot: Record<string, any>, storage?: SnapshotStorage | null, scenario?: string | null) => (
    writeSnapshot(getDeviceQaSnapshotKey(scenario), snapshot, storage)
);

export const clearDeviceQaSnapshot = (storage?: SnapshotStorage | null, scenario?: string | null) => (
    clearSnapshot(getDeviceQaSnapshotKey(scenario), storage)
);
