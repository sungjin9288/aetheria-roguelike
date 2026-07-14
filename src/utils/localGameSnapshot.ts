export const LOCAL_GAME_SNAPSHOT_KEY = 'aetheria.game.snapshot.v1';

type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getBrowserStorage = (): SnapshotStorage | null => {
    try {
        return globalThis.localStorage;
    } catch {
        return null;
    }
};

export const readLocalGameSnapshot = (
    storage: SnapshotStorage | null = getBrowserStorage(),
): Record<string, any> | null => {
    if (!storage) return null;

    try {
        const raw = storage.getItem(LOCAL_GAME_SNAPSHOT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.player) return null;
        return parsed;
    } catch {
        return null;
    }
};

export const writeLocalGameSnapshot = (
    snapshot: Record<string, any>,
    storage: SnapshotStorage | null = getBrowserStorage(),
) => {
    if (!storage || !snapshot?.player) return false;

    try {
        storage.setItem(LOCAL_GAME_SNAPSHOT_KEY, JSON.stringify(snapshot));
        return true;
    } catch {
        return false;
    }
};

export const clearLocalGameSnapshot = (
    storage: SnapshotStorage | null = getBrowserStorage(),
) => {
    if (!storage) return false;

    try {
        storage.removeItem(LOCAL_GAME_SNAPSHOT_KEY);
        return true;
    } catch {
        return false;
    }
};
