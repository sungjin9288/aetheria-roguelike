import type {
    ClassJourneyEncounterDiscovery,
    ClassJourneyLedger,
    ClassJourneyRecord,
    Player,
} from '../types/player.js';

interface ClassJourneyExpeditionInput {
    job: string;
    expeditionId: string;
    skillBranches?: string[];
    signatureItems?: string[];
    bossNames?: string[];
    regions?: string[];
    encounterDiscoveries?: ClassJourneyEncounterDiscovery[];
    endedAt?: number | null;
}

const RESERVED_JOB_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_DISCOVERY_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;

const discoveryIdentity = ({
    encounterId,
    encounterVersion,
    choiceId,
}: ClassJourneyEncounterDiscovery) => `${encounterId}\u0000${encounterVersion}\u0000${choiceId}`;

export const normalizeClassJourneyEncounterDiscoveries = (
    value: unknown,
): ClassJourneyEncounterDiscovery[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.flatMap((entry) => {
        if (!entry
            || typeof entry !== 'object'
            || Array.isArray(entry)
            || Object.getPrototypeOf(entry) !== Object.prototype) return [];
        const candidate = entry as Record<string, unknown>;
        const encounterId = typeof candidate.encounterId === 'string' ? candidate.encounterId : '';
        const choiceId = typeof candidate.choiceId === 'string' ? candidate.choiceId : '';
        const encounterVersion = candidate.encounterVersion;
        const family = typeof candidate.family === 'string' ? candidate.family.trim() : '';
        const choiceLabel = typeof candidate.choiceLabel === 'string'
            ? candidate.choiceLabel.trim()
            : '';
        if (!SAFE_DISCOVERY_ID.test(encounterId)
            || !SAFE_DISCOVERY_ID.test(choiceId)
            || typeof encounterVersion !== 'number'
            || !Number.isSafeInteger(encounterVersion)
            || encounterVersion < 1
            || !family
            || !choiceLabel) return [];
        const discovery = { encounterId, encounterVersion, choiceId, family, choiceLabel };
        const identity = discoveryIdentity(discovery);
        if (seen.has(identity)) return [];
        seen.add(identity);
        return [discovery];
    });
};

const jobName = (value: unknown) => {
    const name = typeof value === 'string' ? value.trim() : '';
    return name && !RESERVED_JOB_KEYS.has(name) ? name : '';
};

const uniqueNames = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    const names = value.flatMap((entry) => (
        typeof entry === 'string' && entry.trim() ? [entry.trim()] : []
    ));
    return [...new Set(names)];
};

const appendFirstDiscoveries = (current: string[], additions: unknown) => [
    ...current,
    ...uniqueNames(additions).filter((entry) => !current.includes(entry)),
];

const appendFirstEncounterDiscoveries = (
    current: ClassJourneyEncounterDiscovery[],
    additions: unknown,
) => {
    const seen = new Set(current.map(discoveryIdentity));
    return [
        ...current,
        ...normalizeClassJourneyEncounterDiscoveries(additions).filter((discovery) => {
            const identity = discoveryIdentity(discovery);
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
        }),
    ];
};

const emptyClassJourneyRecord = (): ClassJourneyRecord => ({
    expeditionIds: [],
    skillBranches: [],
    signatureItems: [],
    bossNames: [],
    regions: [],
    encounterDiscoveries: [],
    representativeExpeditionId: null,
    lastPlayedAt: null,
});

const normalizeRecord = (value: unknown): ClassJourneyRecord => {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const expeditionIds = uniqueNames(candidate.expeditionIds);
    const representativeExpeditionId = typeof candidate.representativeExpeditionId === 'string'
        && expeditionIds.includes(candidate.representativeExpeditionId)
        ? candidate.representativeExpeditionId
        : expeditionIds.at(-1) || null;
    const hasPlayedAt = candidate.lastPlayedAt !== null && candidate.lastPlayedAt !== undefined;
    const playedAt = hasPlayedAt ? Number(candidate.lastPlayedAt) : Number.NaN;

    return {
        expeditionIds,
        skillBranches: uniqueNames(candidate.skillBranches),
        signatureItems: uniqueNames(candidate.signatureItems),
        bossNames: uniqueNames(candidate.bossNames),
        regions: uniqueNames(candidate.regions),
        encounterDiscoveries: normalizeClassJourneyEncounterDiscoveries(
            candidate.encounterDiscoveries,
        ),
        representativeExpeditionId,
        lastPlayedAt: Number.isFinite(playedAt) && playedAt >= 0 ? playedAt : null,
    };
};

export const normalizeClassJourneyLedger = (value: unknown): ClassJourneyLedger => {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const rawByJob = candidate.byJob && typeof candidate.byJob === 'object' && !Array.isArray(candidate.byJob)
        ? candidate.byJob as Record<string, unknown>
        : {};
    const mergedByJob = new Map<string, ClassJourneyRecord>();
    Object.entries(rawByJob).forEach(([rawJob, value]) => {
        const job = jobName(rawJob);
        if (!job) return;
        const record = normalizeRecord(value);
        if (record.expeditionIds.length === 0) return;
        const current = mergedByJob.get(job);
        if (!current) {
            mergedByJob.set(job, record);
            return;
        }
        const expeditionIds = appendFirstDiscoveries(current.expeditionIds, record.expeditionIds);
        const recordIsLatest = record.lastPlayedAt === null
            ? current.lastPlayedAt === null
            : current.lastPlayedAt === null || record.lastPlayedAt >= current.lastPlayedAt;
        mergedByJob.set(job, {
            expeditionIds,
            skillBranches: appendFirstDiscoveries(current.skillBranches, record.skillBranches),
            signatureItems: appendFirstDiscoveries(current.signatureItems, record.signatureItems),
            bossNames: appendFirstDiscoveries(current.bossNames, record.bossNames),
            regions: appendFirstDiscoveries(current.regions, record.regions),
            encounterDiscoveries: appendFirstEncounterDiscoveries(
                current.encounterDiscoveries,
                record.encounterDiscoveries,
            ),
            representativeExpeditionId: recordIsLatest
                ? record.representativeExpeditionId
                : current.representativeExpeditionId || record.representativeExpeditionId,
            lastPlayedAt: recordIsLatest ? record.lastPlayedAt : current.lastPlayedAt,
        });
    });
    const seenExpeditionIds = new Set<string>();
    const byJob = Object.fromEntries([...mergedByJob].flatMap(([job, record]) => {
        const expeditionIds = record.expeditionIds.filter((id) => {
            if (seenExpeditionIds.has(id)) return false;
            seenExpeditionIds.add(id);
            return true;
        });
        if (expeditionIds.length === 0) return [];
        const representativeExpeditionId = record.representativeExpeditionId
            && expeditionIds.includes(record.representativeExpeditionId)
            ? record.representativeExpeditionId
            : expeditionIds.at(-1) || null;
        return [[job, { ...record, expeditionIds, representativeExpeditionId }]];
    }));
    const expeditionCount = Object.values(byJob).reduce(
        (total, record) => total + record.expeditionIds.length,
        0,
    );
    const savedSequence = Number(candidate.sequence);
    return {
        version: 2,
        sequence: Math.max(
            expeditionCount,
            Number.isInteger(savedSequence) && savedSequence >= 0 ? savedSequence : 0,
        ),
        byJob,
    };
};

export const recordClassJourneyExpedition = (
    player: Player,
    input: ClassJourneyExpeditionInput,
): Player => {
    const job = jobName(input.job);
    const expeditionId = typeof input.expeditionId === 'string' ? input.expeditionId.trim() : '';
    if (!job || !expeditionId) return player;

    const ledger = normalizeClassJourneyLedger(player.classJourney);
    const current = Object.hasOwn(ledger.byJob, job)
        ? ledger.byJob[job]
        : emptyClassJourneyRecord();
    if (current.expeditionIds.includes(expeditionId)) return player;
    if (Object.values(ledger.byJob).some((record) => record.expeditionIds.includes(expeditionId))) return player;

    const hasEndedAt = input.endedAt !== null && input.endedAt !== undefined;
    const endedAt = hasEndedAt ? Number(input.endedAt) : Number.NaN;
    const nextRecord: ClassJourneyRecord = {
        expeditionIds: [...current.expeditionIds, expeditionId],
        skillBranches: appendFirstDiscoveries(current.skillBranches, input.skillBranches),
        signatureItems: appendFirstDiscoveries(current.signatureItems, input.signatureItems),
        bossNames: appendFirstDiscoveries(current.bossNames, input.bossNames),
        regions: appendFirstDiscoveries(current.regions, input.regions),
        encounterDiscoveries: appendFirstEncounterDiscoveries(
            current.encounterDiscoveries,
            input.encounterDiscoveries,
        ),
        representativeExpeditionId: expeditionId,
        lastPlayedAt: Number.isFinite(endedAt) && endedAt >= 0 ? endedAt : current.lastPlayedAt,
    };

    return {
        ...player,
        classJourney: {
            version: 2,
            sequence: ledger.sequence + 1,
            byJob: { ...ledger.byJob, [job]: nextRecord },
        },
    };
};
