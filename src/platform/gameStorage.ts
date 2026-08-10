import { Storage as TossStorage } from '@apps-in-toss/web-framework';

import type { RuntimeEnvironment } from './runtimeEnvironment';

export const LEGACY_GAME_SNAPSHOT_KEY = 'aetheria.game.snapshot.v1';
export const GAME_SAVE_PRIMARY_KEY = 'aetheria.game.snapshot.v2.primary';
export const GAME_SAVE_STAGED_KEY = 'aetheria.game.snapshot.v2.staged';

const ENVELOPE_FORMAT_VERSION = 1;

export interface AsyncKeyValueStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}

export interface GameSaveRecord {
    saveVersion: number;
    revision: number;
    savedAt: number;
    payload: Record<string, any>;
}

interface GameSaveEnvelope {
    formatVersion: number;
    saveVersion: number;
    revision: number;
    savedAt: number;
    payloadJson: string;
    checksum: string;
}

interface CreateGameStorageOptions {
    backend: AsyncKeyValueStorage;
    now?: () => number;
    saveVersion?: number;
    checksum?: (value: string) => Promise<string>;
}

interface StoredEnvelopeRecord {
    raw: string;
    record: GameSaveRecord;
}

const finiteInteger = (value: unknown, fallback = 0) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const sha256 = async (value: string) => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('SHA-256 is unavailable in this runtime');
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const checksumInput = (envelope: Omit<GameSaveEnvelope, 'checksum'>) => [
    envelope.formatVersion,
    envelope.saveVersion,
    envelope.revision,
    envelope.savedAt,
    envelope.payloadJson,
].join('\n');

const isGameSnapshot = (value: unknown): value is Record<string, any> => (
    value !== null
    && typeof value === 'object'
    && 'player' in value
    && Boolean((value as Record<string, any>).player)
);

const parseStoredEnvelope = async (
    raw: string | null,
    checksum: (value: string) => Promise<string>,
): Promise<StoredEnvelopeRecord | null> => {
    if (!raw) return null;
    try {
        const envelope = JSON.parse(raw) as GameSaveEnvelope;
        if (
            envelope?.formatVersion !== ENVELOPE_FORMAT_VERSION
            || !Number.isSafeInteger(envelope.saveVersion)
            || envelope.saveVersion < 0
            || !Number.isSafeInteger(envelope.revision)
            || envelope.revision < 1
            || !Number.isSafeInteger(envelope.savedAt)
            || envelope.savedAt < 0
            || typeof envelope.payloadJson !== 'string'
            || !/^[a-f0-9]{64}$/.test(envelope.checksum)
        ) return null;

        const expected = await checksum(checksumInput({
            formatVersion: envelope.formatVersion,
            saveVersion: envelope.saveVersion,
            revision: envelope.revision,
            savedAt: envelope.savedAt,
            payloadJson: envelope.payloadJson,
        }));
        if (expected !== envelope.checksum) return null;

        const payload = JSON.parse(envelope.payloadJson);
        if (!isGameSnapshot(payload)) return null;
        return {
            raw,
            record: {
                saveVersion: envelope.saveVersion,
                revision: envelope.revision,
                savedAt: envelope.savedAt,
                payload,
            },
        };
    } catch {
        return null;
    }
};

export const resolveSaveAuthority = (
    local: Pick<GameSaveRecord, 'saveVersion' | 'revision' | 'savedAt'>,
    remote: Pick<GameSaveRecord, 'saveVersion' | 'revision' | 'savedAt'>,
): 'local' | 'remote' | 'equal' => {
    const comparisons = [
        [finiteInteger(local.saveVersion), finiteInteger(remote.saveVersion)],
        [finiteInteger(local.revision), finiteInteger(remote.revision)],
        [finiteInteger(local.savedAt), finiteInteger(remote.savedAt)],
    ];
    for (const [left, right] of comparisons) {
        if (left > right) return 'local';
        if (right > left) return 'remote';
    }
    return 'equal';
};

export const resolveCloudBootstrapAuthority = (
    local: GameSaveRecord | null,
    remote: Record<string, any> | null,
): 'local' | 'remote' | 'none' => {
    if (!local && !remote?.player) return 'none';
    if (!remote?.player) return 'local';
    if (!local) return 'remote';

    const remoteSchemaVersion = Number(remote.saveSchemaVersion);
    const remoteRevision = Number(remote.saveRevision);
    const remoteSavedAt = Number(remote.savedAt);
    if (
        !Number.isSafeInteger(remoteSchemaVersion)
        || remoteSchemaVersion < 0
        || !Number.isSafeInteger(remoteRevision)
        || remoteRevision < 0
        || !Number.isSafeInteger(remoteSavedAt)
        || remoteSavedAt < 0
    ) {
        // Legacy cloud documents retain their previous authority until both sides carry revisions.
        return 'remote';
    }

    return resolveSaveAuthority(local, {
        saveVersion: remoteSchemaVersion,
        revision: remoteRevision,
        savedAt: remoteSavedAt,
    }) === 'local' ? 'local' : 'remote';
};

export const createGameStorage = ({
    backend,
    now = Date.now,
    saveVersion = 1,
    checksum = sha256,
}: CreateGameStorageOptions) => {
    let writeQueue: Promise<unknown> = Promise.resolve();

    const parseEnvelope = (raw: string | null) => parseStoredEnvelope(raw, checksum);

    const load = async (): Promise<GameSaveRecord | null> => {
        const [primaryRaw, stagedRaw] = await Promise.all([
            backend.getItem(GAME_SAVE_PRIMARY_KEY),
            backend.getItem(GAME_SAVE_STAGED_KEY),
        ]);
        const [primary, staged] = await Promise.all([
            parseEnvelope(primaryRaw),
            parseEnvelope(stagedRaw),
        ]);

        let selected = primary;
        if (
            staged
            && (!selected || resolveSaveAuthority(staged.record, selected.record) !== 'remote')
        ) selected = staged;

        if (!selected) {
            if (stagedRaw) await backend.removeItem(GAME_SAVE_STAGED_KEY).catch(() => undefined);
            return null;
        }

        if (selected === staged) {
            try {
                await backend.setItem(GAME_SAVE_PRIMARY_KEY, staged.raw);
                const published = await parseEnvelope(await backend.getItem(GAME_SAVE_PRIMARY_KEY));
                if (published?.raw === staged.raw) await backend.removeItem(GAME_SAVE_STAGED_KEY);
            } catch {
                // A valid staged write remains the recovery authority until publication succeeds.
            }
        } else if (stagedRaw) {
            await backend.removeItem(GAME_SAVE_STAGED_KEY).catch(() => undefined);
        }

        return selected.record;
    };

    const encodeRecord = async (record: GameSaveRecord) => {
        const unsigned = {
            formatVersion: ENVELOPE_FORMAT_VERSION,
            saveVersion: record.saveVersion,
            revision: record.revision,
            savedAt: record.savedAt,
            payloadJson: JSON.stringify(record.payload),
        };
        const envelope: GameSaveEnvelope = {
            ...unsigned,
            checksum: await checksum(checksumInput(unsigned)),
        };
        return JSON.stringify(envelope);
    };

    const publishRecord = async (record: GameSaveRecord): Promise<GameSaveRecord> => {
        if (!isGameSnapshot(record.payload)) throw new Error('A game snapshot requires player data');
        const raw = await encodeRecord(record);

        await backend.setItem(GAME_SAVE_STAGED_KEY, raw);
        const staged = await parseEnvelope(await backend.getItem(GAME_SAVE_STAGED_KEY));
        if (staged?.raw !== raw) {
            throw new Error('Staged game snapshot verification failed');
        }
        await backend.setItem(GAME_SAVE_PRIMARY_KEY, raw);
        const published = await parseEnvelope(await backend.getItem(GAME_SAVE_PRIMARY_KEY));
        if (published?.raw !== raw) {
            throw new Error('Primary publication verification failed');
        }
        await backend.removeItem(GAME_SAVE_STAGED_KEY);
        return record;
    };

    const saveNow = async (payload: Record<string, any>): Promise<GameSaveRecord> => {
        if (!isGameSnapshot(payload)) throw new Error('A game snapshot requires player data');
        const current = await load();
        return publishRecord({
            saveVersion: Math.max(saveVersion, current?.saveVersion ?? 0),
            revision: (current?.revision ?? 0) + 1,
            savedAt: finiteInteger(now()),
            payload,
        });
    };

    const save = (payload: Record<string, any>) => {
        const operation = writeQueue.catch(() => undefined).then(() => saveNow(payload));
        writeQueue = operation;
        return operation;
    };

    const removeNow = async () => {
        await Promise.all([
            backend.removeItem(GAME_SAVE_PRIMARY_KEY),
            backend.removeItem(GAME_SAVE_STAGED_KEY),
            backend.removeItem(LEGACY_GAME_SNAPSHOT_KEY),
        ]);
    };

    const remove = () => {
        const operation = writeQueue.catch(() => undefined).then(removeNow);
        writeQueue = operation;
        return operation;
    };

    const importRecordNow = async (record: GameSaveRecord): Promise<GameSaveRecord> => {
        const normalized: GameSaveRecord = {
            saveVersion: finiteInteger(record.saveVersion),
            revision: finiteInteger(record.revision),
            savedAt: finiteInteger(record.savedAt),
            payload: record.payload,
        };
        if (!isGameSnapshot(normalized.payload)) throw new Error('A game snapshot requires player data');
        if (normalized.revision < 1) throw new Error('Imported game snapshot requires a positive revision');

        const current = await load();
        if (current && resolveSaveAuthority(current, normalized) === 'local') return current;
        return publishRecord(normalized);
    };

    const importRecord = (record: GameSaveRecord) => {
        const operation = writeQueue.catch(() => undefined).then(() => importRecordNow(record));
        writeQueue = operation;
        return operation;
    };

    const migrate = async (
        migratePayload: (payload: Record<string, any>) => Record<string, any>,
    ): Promise<GameSaveRecord | null> => {
        const current = await load();
        if (current) return current;

        const legacyRaw = await backend.getItem(LEGACY_GAME_SNAPSHOT_KEY);
        if (!legacyRaw) return null;
        let legacyPayload: unknown;
        try {
            legacyPayload = JSON.parse(legacyRaw);
        } catch {
            return null;
        }
        if (!isGameSnapshot(legacyPayload)) return null;

        const migrated = await save(migratePayload(legacyPayload));
        await backend.removeItem(LEGACY_GAME_SNAPSHOT_KEY);
        return migrated;
    };

    return { load, save, remove, migrate, importRecord };
};

export type GameStorage = ReturnType<typeof createGameStorage>;

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const createBrowserStorageBackend = (
    storage?: BrowserStorage | null,
): AsyncKeyValueStorage => {
    let activeStorage = storage;
    if (activeStorage === undefined) {
        try {
            activeStorage = globalThis.localStorage;
        } catch {
            activeStorage = null;
        }
    }
    return {
        getItem: async (key) => activeStorage?.getItem(key) ?? null,
        setItem: async (key, value) => {
            if (!activeStorage) throw new Error('Browser storage is unavailable');
            activeStorage.setItem(key, value);
        },
        removeItem: async (key) => {
            if (!activeStorage) return;
            activeStorage.removeItem(key);
        },
    };
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<T>((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Toss storage operation timed out')), timeoutMs);
            }),
        ]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
};

const createFallbackBackend = (
    primary: AsyncKeyValueStorage,
    fallback: AsyncKeyValueStorage,
    operationTimeoutMs: number,
): AsyncKeyValueStorage => {
    type JournalEntry = {
        generation: number;
        state: 'present' | 'removed';
        value: string | null;
    };
    const JOURNAL_SLOT_COUNT = 8;
    let primaryUnavailableUntil = 0;
    let lastIssuedGeneration = 0;
    const pendingPrimaryOperations = new Set<Promise<unknown>>();
    const deferredPrimaryRepairs = new Map<string, string>();
    let flushingPrimaryRepairs = false;
    let flushPrimaryRepairs: () => Promise<void> = async () => undefined;
    const runPrimary = async <T>(
        operation: () => Promise<T>,
        lateSuccessReceipt?: { key: string; raw: string },
    ): Promise<T> => {
        if (pendingPrimaryOperations.size > 0 || Date.now() < primaryUnavailableUntil) {
            throw new Error('Toss storage circuit is temporarily open');
        }
        const pending = operation();
        try {
            const result = await withTimeout(pending, operationTimeoutMs);
            primaryUnavailableUntil = 0;
            return result;
        } catch (error) {
            primaryUnavailableUntil = Date.now() + 5_000;
            if (error instanceof Error && error.message === 'Toss storage operation timed out') {
                pendingPrimaryOperations.add(pending);
                void pending.then(
                    () => {
                        if (
                            lateSuccessReceipt
                            && deferredPrimaryRepairs.get(lateSuccessReceipt.key) === lateSuccessReceipt.raw
                        ) {
                            deferredPrimaryRepairs.delete(lateSuccessReceipt.key);
                        }
                        pendingPrimaryOperations.delete(pending);
                        if (pendingPrimaryOperations.size === 0) {
                            primaryUnavailableUntil = 0;
                            void flushPrimaryRepairs();
                        }
                    },
                    () => {
                        pendingPrimaryOperations.delete(pending);
                    },
                );
            }
            throw error;
        }
    };
    flushPrimaryRepairs = async () => {
        if (
            flushingPrimaryRepairs
            || pendingPrimaryOperations.size > 0
            || Date.now() < primaryUnavailableUntil
        ) return;
        flushingPrimaryRepairs = true;
        try {
            for (const [key, raw] of deferredPrimaryRepairs) {
                try {
                    await runPrimary(
                        () => primary.setItem(key, raw),
                        { key, raw },
                    );
                    if (deferredPrimaryRepairs.get(key) === raw) deferredPrimaryRepairs.delete(key);
                } catch {
                    break;
                }
            }
        } finally {
            flushingPrimaryRepairs = false;
        }
    };
    const slotKey = (key: string, slot: number) => `aetheria.storage-journal.${key}.${slot}`;
    const parseEntry = (raw: string | null): JournalEntry | null => {
        if (!raw) return null;
        try {
            const value = JSON.parse(raw) as JournalEntry;
            if (
                !Number.isSafeInteger(value?.generation)
                || value.generation < 1
                || (value.state !== 'present' && value.state !== 'removed')
                || (value.state === 'present' && typeof value.value !== 'string')
                || (value.state === 'removed' && value.value !== null)
            ) return null;
            return value;
        } catch {
            return null;
        }
    };
    const selectLatest = (entries: Array<JournalEntry | null>) => entries.reduce<JournalEntry | null>(
        (latest, entry) => {
            if (!entry) return latest;
            if (!latest || entry.generation > latest.generation) return entry;
            if (entry.generation === latest.generation && entry.state === 'removed') return entry;
            return latest;
        },
        null,
    );
    const readLatest = async (key: string) => {
        const slots = Array.from({ length: JOURNAL_SLOT_COUNT }, (_, slot) => slot);
        const [primaryResults, fallbackResults] = await Promise.all([
            Promise.allSettled(slots.map((slot) => runPrimary(() => primary.getItem(slotKey(key, slot))))),
            Promise.allSettled(slots.map((slot) => fallback.getItem(slotKey(key, slot)))),
        ]);
        const entries = [...primaryResults, ...fallbackResults].map((result) => (
            result.status === 'fulfilled' ? parseEntry(result.value) : null
        ));
        return selectLatest(entries);
    };
    const repairEntry = async (key: string, entry: JournalEntry) => {
        const raw = JSON.stringify(entry);
        const physicalKey = slotKey(key, entry.generation % JOURNAL_SLOT_COUNT);
        const results = await Promise.allSettled([
            runPrimary(
                () => primary.setItem(physicalKey, raw),
                { key: physicalKey, raw },
            ),
            fallback.setItem(physicalKey, raw),
        ]);
        if (results[0].status === 'rejected' && results[1].status === 'fulfilled') {
            deferredPrimaryRepairs.set(physicalKey, raw);
            void flushPrimaryRepairs();
        }
    };
    const nextGeneration = (previous: JournalEntry | null) => {
        lastIssuedGeneration = Math.max(
            lastIssuedGeneration + 1,
            (previous?.generation ?? 0) + 1,
            Date.now(),
        );
        return lastIssuedGeneration;
    };
    const writeEntry = async (key: string, entry: JournalEntry) => {
        const raw = JSON.stringify(entry);
        const physicalKey = slotKey(key, entry.generation % JOURNAL_SLOT_COUNT);
        const results = await Promise.allSettled([
            runPrimary(
                () => primary.setItem(physicalKey, raw),
                { key: physicalKey, raw },
            ),
            fallback.setItem(physicalKey, raw),
        ]);
        if (results[0].status === 'rejected' && results[1].status === 'fulfilled') {
            deferredPrimaryRepairs.set(physicalKey, raw);
            void flushPrimaryRepairs();
        }
        if (results.every((result) => result.status === 'rejected')) {
            throw (results[0] as PromiseRejectedResult).reason;
        }
    };
    const reconcileLegacy = async (key: string) => {
        const [primaryResult, fallbackResult] = await Promise.allSettled([
            runPrimary(() => primary.getItem(key)),
            fallback.getItem(key),
        ]);
        const primaryRaw = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
        const fallbackRaw = fallbackResult.status === 'fulfilled' ? fallbackResult.value : null;
        if (primaryRaw === fallbackRaw) return primaryRaw;

        const [primaryEnvelope, fallbackEnvelope] = await Promise.all([
            parseStoredEnvelope(primaryRaw, sha256),
            parseStoredEnvelope(fallbackRaw, sha256),
        ]);
        if (primaryEnvelope && fallbackEnvelope) {
            return resolveSaveAuthority(primaryEnvelope.record, fallbackEnvelope.record) === 'local'
                ? primaryEnvelope.raw
                : fallbackEnvelope.raw;
        }
        return primaryEnvelope?.raw ?? fallbackEnvelope?.raw ?? primaryRaw ?? fallbackRaw;
    };

    return {
        async getItem(key) {
            await flushPrimaryRepairs();
            const latest = await readLatest(key);
            if (latest) {
                await repairEntry(key, latest);
                return latest.state === 'present' ? latest.value : null;
            }
            return reconcileLegacy(key);
        },
        async setItem(key, value) {
            await flushPrimaryRepairs();
            const previous = await readLatest(key);
            await writeEntry(key, {
                generation: nextGeneration(previous),
                state: 'present',
                value,
            });
        },
        async removeItem(key) {
            await flushPrimaryRepairs();
            const previous = await readLatest(key);
            await writeEntry(key, {
                generation: nextGeneration(previous),
                state: 'removed',
                value: null,
            });
        },
    };
};

interface CreateRuntimeGameStorageOptions {
    environment: RuntimeEnvironment;
    browserBackend?: AsyncKeyValueStorage;
    tossBackend?: AsyncKeyValueStorage;
    now?: () => number;
    saveVersion?: number;
    operationTimeoutMs?: number;
}

export const createRuntimeGameStorage = ({
    environment,
    browserBackend = createBrowserStorageBackend(),
    tossBackend = TossStorage,
    now,
    saveVersion,
    operationTimeoutMs = 250,
}: CreateRuntimeGameStorageOptions): GameStorage => createGameStorage({
    backend: environment === 'toss' || environment === 'sandbox'
        ? createFallbackBackend(tossBackend, browserBackend, operationTimeoutMs)
        : browserBackend,
    now,
    saveVersion,
});
