export const LOCAL_GAME_SNAPSHOT_KEY = 'aetheria.game.snapshot.v1';
export const DEVICE_QA_SNAPSHOT_KEY = 'aetheria.device-qa.item-investment.snapshot.v1';
export const GRAVE_RECOVERY_DEVICE_QA_SNAPSHOT_KEY = 'aetheria.device-qa.grave-recovery.snapshot.v1';
export const ASCENSION_JOURNEY_DEVICE_QA_SNAPSHOT_KEY = 'aetheria.device-qa.ascension-journey.snapshot.v1';

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
