import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const HOUR = 60 * 60 * 1_000;
const EVENT_KEYS = [
    'cohortId', 'sessionId', 'releaseId', 'deploymentId', 'name', 'outcome',
    'receivedAt', 'serverSequence',
];
export const SOFT_LAUNCH_EVENT_OUTCOMES = Object.freeze({
    boot: Object.freeze(['ready', 'offline']),
    character_created: Object.freeze(['success']),
    first_action: Object.freeze(['mission_open', 'move', 'explore']),
    mission_open: Object.freeze(['success']),
    move: Object.freeze(['success', 'blocked']),
    explore: Object.freeze(['event', 'combat', 'nothing', 'blocked', 'failed']),
    combat_start: Object.freeze(['normal', 'boss']),
    combat_end: Object.freeze(['victory', 'defeat', 'escaped', 'interrupted']),
    safe_expedition_return: Object.freeze(['success']),
    save: Object.freeze(['success', 'failure', 'skipped']),
    restore: Object.freeze(['local', 'cloud', 'fresh', 'failure']),
    feedback_submission: Object.freeze(['success', 'validation_failed', 'transport_failed']),
    fatal_error_boundary: Object.freeze(['caught']),
    ad_offer: Object.freeze(['eligible']),
    ad_load: Object.freeze(['loaded']),
    ad_show: Object.freeze(['requested', 'shown', 'rewarded', 'dismissed']),
    ad_reward: Object.freeze(['pending', 'delivered']),
    ad_failure: Object.freeze(['load_failed', 'show_failed', 'reward_rejected']),
});

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => (
    isPlainObject(value)
    && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
);
const validIdentity = (value) => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,96}$/.test(value);
const validOpaqueId = (value, prefix) => (
    typeof value === 'string' && new RegExp(`^${prefix}_[a-f0-9]{32}$`).test(value)
);
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_EVIDENCE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

const canonicalJson = (value) => {
    if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (isPlainObject(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    throw new Error('authority canonicalization invalid');
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const canonicalEventsSha256 = (events) => sha256(JSON.stringify(events));
const canonicalAuthoritySha256 = (authority) => sha256(canonicalJson(authority));

const AUTHORITY_KEYS = [
    'schemaVersion', 'candidateId', 'artifactSha256', 'releaseId', 'deploymentId', 'cutoff',
    'inputSha256', 'eventCount', 'sequenceMin', 'sequenceMax',
    'crashFreeSessions', 'durableAdReceipts', 'openP0',
];
const CRASH_EVIDENCE_KEYS = ['verified', 'numerator', 'denominator', 'evidenceRef', 'evidenceSha256'];
const AD_EVIDENCE_KEYS = [
    'verified', 'succeeded', 'attempted', 'scope', 'evidenceRef', 'evidenceSha256',
];
const OPEN_P0_EVIDENCE_KEYS = ['count', 'evidenceRef', 'evidenceSha256'];

const validEvidenceRef = (value) => (
    typeof value === 'string'
    && SAFE_EVIDENCE_REF.test(value)
    && !value.startsWith('/')
    && !value.includes('\\')
    && value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
);

const validCountPair = (numerator, denominator) => (
    Number.isSafeInteger(numerator) && numerator >= 0
    && Number.isSafeInteger(denominator) && denominator >= numerator
);

const validateSoftLaunchAuthority = ({
    authority,
    candidateId,
    artifactSha256,
    releaseId,
    deploymentId,
    cutoff,
}) => {
    if (!hasExactKeys(authority, AUTHORITY_KEYS) || authority.schemaVersion !== 1) {
        throw new Error('authority schema invalid');
    }
    if (authority.candidateId !== candidateId) throw new Error('authority candidate mismatch');
    if (authority.artifactSha256 !== artifactSha256) throw new Error('authority artifact mismatch');
    if (authority.releaseId !== releaseId) throw new Error('authority release mismatch');
    if (authority.deploymentId !== deploymentId) throw new Error('authority deployment mismatch');
    if (authority.cutoff !== cutoff) throw new Error('authority cutoff mismatch');
    if (!SHA256.test(authority.inputSha256)
        || !Number.isSafeInteger(authority.eventCount) || authority.eventCount < 1
        || !Number.isSafeInteger(authority.sequenceMin) || authority.sequenceMin < 0
        || !Number.isSafeInteger(authority.sequenceMax) || authority.sequenceMax < authority.sequenceMin) {
        throw new Error('authority event input invalid');
    }
    if (!hasExactKeys(authority.crashFreeSessions, CRASH_EVIDENCE_KEYS)
        || typeof authority.crashFreeSessions.verified !== 'boolean'
        || !validCountPair(authority.crashFreeSessions.numerator, authority.crashFreeSessions.denominator)
        || !validEvidenceRef(authority.crashFreeSessions.evidenceRef)
        || !SHA256.test(authority.crashFreeSessions.evidenceSha256)) {
        throw new Error('authority crash-free-sessions evidence invalid');
    }
    if (!hasExactKeys(authority.durableAdReceipts, AD_EVIDENCE_KEYS)
        || typeof authority.durableAdReceipts.verified !== 'boolean'
        || !validCountPair(authority.durableAdReceipts.succeeded, authority.durableAdReceipts.attempted)
        || !['server_transaction', 'unavailable'].includes(authority.durableAdReceipts.scope)
        || (authority.durableAdReceipts.verified
            && authority.durableAdReceipts.scope !== 'server_transaction')
        || !validEvidenceRef(authority.durableAdReceipts.evidenceRef)
        || !SHA256.test(authority.durableAdReceipts.evidenceSha256)) {
        throw new Error('authority durable-ad-receipts evidence invalid');
    }
    if (!hasExactKeys(authority.openP0, OPEN_P0_EVIDENCE_KEYS)
        || !Number.isSafeInteger(authority.openP0.count)
        || authority.openP0.count < 0
        || !validEvidenceRef(authority.openP0.evidenceRef)
        || !SHA256.test(authority.openP0.evidenceSha256)) {
        throw new Error('authority open-p0 evidence invalid');
    }
};

const resolveAuthorityEvidenceFile = async (authorityRoot, reference) => {
    const rootReal = await realpath(authorityRoot);
    const target = path.resolve(authorityRoot, reference);
    const targetReal = await realpath(target);
    if (targetReal !== rootReal && !targetReal.startsWith(`${rootReal}${path.sep}`)) {
        throw new Error('authority evidence path escape');
    }
    const stats = await lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('authority evidence file invalid');
    return { target, bytes: await readFile(target) };
};

const receiptScopeMatches = (receipt, authority, kind, value) => (
    hasExactKeys(receipt, [
        'schemaVersion', 'kind', 'candidateId', 'artifactSha256', 'releaseId', 'deploymentId',
        'cutoff', 'inputSha256', 'eventCount', 'sequenceMin', 'sequenceMax', 'value',
    ])
    && receipt.schemaVersion === 1
    && receipt.kind === kind
    && receipt.candidateId === authority.candidateId
    && receipt.artifactSha256 === authority.artifactSha256
    && receipt.releaseId === authority.releaseId
    && receipt.deploymentId === authority.deploymentId
    && receipt.cutoff === authority.cutoff
    && receipt.inputSha256 === authority.inputSha256
    && receipt.eventCount === authority.eventCount
    && receipt.sequenceMin === authority.sequenceMin
    && receipt.sequenceMax === authority.sequenceMax
    && JSON.stringify(receipt.value) === JSON.stringify(value)
);

export const verifySoftLaunchAuthorityFiles = async (authority, authorityRoot) => {
    try {
        validateSoftLaunchAuthority({
            authority,
            candidateId: authority?.candidateId,
            artifactSha256: authority?.artifactSha256,
            releaseId: authority?.releaseId,
            deploymentId: authority?.deploymentId,
            cutoff: authority?.cutoff,
        });
        for (const [kind, value] of [
            ['crash_free_sessions', authority.crashFreeSessions],
            ['durable_ad_receipts', authority.durableAdReceipts],
            ['open_p0', authority.openP0],
        ]) {
            const { target, bytes } = await resolveAuthorityEvidenceFile(authorityRoot, value.evidenceRef);
            if (sha256(bytes) !== value.evidenceSha256) throw new Error('authority evidence digest mismatch');
            const receipt = JSON.parse(await readFile(target, 'utf8'));
            const publicValue = Object.fromEntries(Object.entries(value).filter(([key]) => (
                key !== 'evidenceRef' && key !== 'evidenceSha256'
            )));
            if (!receiptScopeMatches(receipt, authority, kind, publicValue)) {
                throw new Error('authority evidence scope mismatch');
            }
        }
        return { ok: true, reason: null };
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : 'authority evidence invalid' };
    }
};

const metric = (numerator, denominator, threshold, statusOverride = null) => {
    const rate = denominator > 0 ? numerator / denominator : null;
    const status = statusOverride || (rate === null ? 'pending' : rate >= threshold ? 'pass' : 'fail');
    return { numerator, denominator, rate, status };
};

const unavailableMetric = () => ({ numerator: null, denominator: null, rate: null, status: 'unavailable' });

const validateEvents = (events, releaseId, deploymentId, cutoff) => {
    if (!Array.isArray(events) || events.length === 0) throw new Error('event input is empty');
    const orderKeys = new Set();
    const sessionCohorts = new Map();
    for (const row of events) {
        if (!hasExactKeys(row, EVENT_KEYS)) throw new Error('event schema is not privacy-safe');
        if (!validOpaqueId(row.cohortId, 'c') || !validOpaqueId(row.sessionId, 's')) {
            throw new Error('event cohort authority invalid');
        }
        if (row.releaseId !== releaseId || row.deploymentId !== deploymentId) {
            throw new Error('release authority mismatch');
        }
        if (!validIdentity(row.name) || !validIdentity(row.outcome)
            || !Number.isFinite(row.receivedAt) || !Number.isSafeInteger(row.serverSequence)
            || row.serverSequence < 0) throw new Error('event authority invalid');
        if (row.receivedAt < 0 || row.receivedAt > cutoff) throw new Error('event cutoff authority invalid');
        const outcomes = SOFT_LAUNCH_EVENT_OUTCOMES[row.name];
        if (!outcomes || !outcomes.includes(row.outcome)) throw new Error('event outcome authority invalid');
        const existingCohort = sessionCohorts.get(row.sessionId);
        if (existingCohort && existingCohort !== row.cohortId) throw new Error('event session authority invalid');
        sessionCohorts.set(row.sessionId, row.cohortId);
        const orderKey = `${row.cohortId}\n${row.receivedAt}\n${row.serverSequence}`;
        if (orderKeys.has(orderKey)) throw new Error('event order authority missing');
        orderKeys.add(orderKey);
    }
};

const sortedEvents = (events) => [...events].sort((left, right) => (
    left.receivedAt - right.receivedAt || left.serverSequence - right.serverSequence
));

const isAfter = (candidate, authority) => (
    candidate.receivedAt > authority.receivedAt
    || (candidate.receivedAt === authority.receivedAt && candidate.serverSequence > authority.serverSequence)
);

const acceptedFirstAction = (event) => (
    event.name === 'first_action'
    && ['mission_open', 'move', 'explore'].includes(event.outcome)
);
const acceptedCombatStart = (event) => (
    event.name === 'combat_start' && ['normal', 'boss'].includes(event.outcome)
);
const acceptedSafeReturn = (event) => (
    event.name === 'safe_expedition_return' && event.outcome === 'success'
);

const buildRetentionMetric = ({ cohorts, cutoff, lower, upper, threshold, newUsers }) => {
    const matured = cohorts.filter((cohort) => cohort.bootAt + upper <= cutoff);
    if (matured.length === 0) return metric(0, 0, threshold, 'pending');
    const retained = matured.filter((cohort) => cohort.events.some((event) => (
        event.sessionId !== cohort.initialSessionId
        && event.name === 'boot'
        && ['ready', 'offline'].includes(event.outcome)
        && event.receivedAt >= cohort.bootAt + lower
        && event.receivedAt < cohort.bootAt + upper
    ))).length;
    return metric(retained, matured.length, threshold, newUsers < 100 ? 'directional_only' : null);
};

export const buildSoftLaunchReport = ({
    events,
    candidateId,
    artifactSha256,
    releaseId,
    deploymentId,
    cutoff,
    authority,
}) => {
    if (!validIdentity(candidateId) || !validIdentity(releaseId) || !validIdentity(deploymentId)) {
        throw new Error('release authority invalid');
    }
    if (!SHA256.test(artifactSha256)) throw new Error('artifact authority invalid');
    if (!Number.isSafeInteger(cutoff) || cutoff < 0) throw new Error('cutoff authority invalid');
    validateSoftLaunchAuthority({
        authority, candidateId, artifactSha256, releaseId, deploymentId, cutoff,
    });
    validateEvents(events, releaseId, deploymentId, cutoff);
    const sequenceValues = events.map((row) => row.serverSequence);
    if (authority.inputSha256 !== canonicalEventsSha256(events)
        || authority.eventCount !== events.length
        || authority.sequenceMin !== Math.min(...sequenceValues)
        || authority.sequenceMax !== Math.max(...sequenceValues)) {
        throw new Error('authority event input mismatch');
    }

    const ordered = sortedEvents(events);
    const byCohort = new Map();
    for (const row of ordered) {
        const current = byCohort.get(row.cohortId) || [];
        current.push(row);
        byCohort.set(row.cohortId, current);
    }
    const cohorts = [...byCohort.entries()].flatMap(([cohortId, cohortEvents]) => {
        const boot = cohortEvents.find((row) => row.name === 'boot' && ['ready', 'offline'].includes(row.outcome));
        if (!boot) return [];
        return [{
            cohortId,
            events: cohortEvents,
            boot,
            bootAt: boot.receivedAt,
            initialSessionId: boot.sessionId,
        }];
    });
    const newUsers = cohorts.length;
    const created = cohorts.filter((cohort) => cohort.events.some((row) => (
        row.name === 'character_created' && isAfter(row, cohort.boot)
    )));
    const afterCreation = (cohort, predicate) => {
        const createdEvent = cohort.events.find((row) => row.name === 'character_created' && isAfter(row, cohort.boot));
        return Boolean(createdEvent && cohort.events.some((row) => isAfter(row, createdEvent) && predicate(row)));
    };
    const acceptedBootBySession = new Map(ordered.flatMap((row) => (
        row.name === 'boot' && ['ready', 'offline'].includes(row.outcome)
            ? [[row.sessionId, row]]
            : []
    )));
    const followsAcceptedSessionBoot = (row) => {
        const boot = acceptedBootBySession.get(row.sessionId);
        return Boolean(boot && isAfter(row, boot));
    };
    const saveEvents = ordered.filter((row) => (
        row.name === 'save' && row.outcome !== 'skipped' && followsAcceptedSessionBoot(row)
    ));
    const successfulSaves = saveEvents.filter((row) => row.outcome === 'success').length;
    const restoreEvents = ordered.filter((row) => (
        row.name === 'restore' && row.outcome !== 'fresh' && followsAcceptedSessionBoot(row)
    ));
    const successfulRestores = restoreEvents.filter((row) => ['local', 'cloud'].includes(row.outcome)).length;
    const earliestBoot = Math.min(...cohorts.map((cohort) => cohort.bootAt));
    const elapsedMs = cohorts.length > 0 ? Math.max(0, cutoff - earliestBoot) : 0;

    const metrics = {
        crashFreeSession: authority.crashFreeSessions.verified
            ? metric(
                authority.crashFreeSessions.numerator,
                authority.crashFreeSessions.denominator,
                0.995,
            )
            : unavailableMetric(),
        saveSuccess: metric(successfulSaves, saveEvents.length, 0.999),
        restoreSuccess: metric(successfulRestores, restoreEvents.length, 0.999),
        firstAction: metric(created.filter((cohort) => afterCreation(cohort, acceptedFirstAction)).length, created.length, 0.80),
        firstCombat: metric(created.filter((cohort) => afterCreation(cohort, acceptedCombatStart)).length, created.length, 0.65),
        safeReturn: metric(created.filter((cohort) => {
            const createdEvent = cohort.events.find((row) => (
                row.name === 'character_created' && isAfter(row, cohort.boot)
            ));
            const combatEvent = cohort.events.find((row) => createdEvent && isAfter(row, createdEvent) && acceptedCombatStart(row));
            return Boolean(combatEvent && cohort.events.some((row) => isAfter(row, combatEvent) && acceptedSafeReturn(row)));
        }).length, created.length, 0.50),
        d1Retention: buildRetentionMetric({
            cohorts, cutoff, lower: 24 * HOUR, upper: 48 * HOUR, threshold: 0.25, newUsers,
        }),
        d7Retention: buildRetentionMetric({
            cohorts, cutoff, lower: 168 * HOUR, upper: 192 * HOUR, threshold: 0.10, newUsers,
        }),
        adTransactionSuccess: authority.durableAdReceipts.verified
            ? metric(
                authority.durableAdReceipts.succeeded,
                authority.durableAdReceipts.attempted,
                0.99,
            )
            : unavailableMetric(),
        openP0: {
            numerator: authority.openP0.count,
            denominator: null,
            rate: null,
            status: authority.openP0.count === 0 ? 'pass' : 'fail',
        },
    };

    return {
        schemaVersion: 2,
        candidateId,
        artifactSha256,
        releaseId,
        deploymentId,
        inputSha256: canonicalEventsSha256(events),
        authoritySha256: canonicalAuthoritySha256(authority),
        cutoff,
        observation: {
            elapsedHours: elapsedMs / HOUR,
            reviewable: elapsedMs >= 168 * HOUR || newUsers >= 100,
        },
        cohorts: { newUsers },
        metrics,
    };
};

const gateMetric = (name, value, blockers) => {
    if (!['pass', 'fail', 'pending', 'unavailable', 'directional_only'].includes(value?.status)) {
        blockers.push(`${name}_status_invalid`);
        return;
    }
    if (value.status === 'unavailable') blockers.push(`${name}_unavailable`);
    else if (value.status === 'pending') blockers.push(`${name}_pending`);
    else if (value.status === 'fail') blockers.push(`${name}_below_threshold`);
};

const REPORT_KEYS = [
    'schemaVersion', 'candidateId', 'artifactSha256', 'releaseId', 'deploymentId',
    'inputSha256', 'authoritySha256', 'cutoff', 'observation', 'cohorts', 'metrics',
];
const METRIC_KEYS = [
    'crashFreeSession', 'saveSuccess', 'restoreSuccess', 'firstAction', 'firstCombat',
    'safeReturn', 'd1Retention', 'd7Retention', 'adTransactionSuccess', 'openP0',
];
const METRIC_THRESHOLDS = Object.freeze({
    crashFreeSession: 0.995,
    saveSuccess: 0.999,
    restoreSuccess: 0.999,
    firstAction: 0.80,
    firstCombat: 0.65,
    safeReturn: 0.50,
    d1Retention: 0.25,
    d7Retention: 0.10,
    adTransactionSuccess: 0.99,
});

const validMetricShape = (name, value, report) => {
    if (!hasExactKeys(value, ['numerator', 'denominator', 'rate', 'status'])) return false;
    if (name === 'openP0') {
        return Number.isSafeInteger(value.numerator) && value.numerator >= 0
            && value.denominator === null && value.rate === null
            && value.status === (value.numerator === 0 ? 'pass' : 'fail');
    }
    if (value.status === 'unavailable') {
        return ['crashFreeSession', 'adTransactionSuccess'].includes(name)
            && value.numerator === null && value.denominator === null && value.rate === null;
    }
    if (!Number.isSafeInteger(value.numerator) || value.numerator < 0
        || !Number.isSafeInteger(value.denominator) || value.denominator < value.numerator) return false;
    if (value.denominator === 0) {
        return value.numerator === 0 && value.rate === null && value.status === 'pending';
    }
    const rate = value.numerator / value.denominator;
    if (value.rate !== rate) return false;
    if (value.status === 'directional_only') {
        return ['d1Retention', 'd7Retention'].includes(name) && report.cohorts.newUsers < 100;
    }
    if (['d1Retention', 'd7Retention'].includes(name) && report.cohorts.newUsers < 100) return false;
    return value.status === (rate >= METRIC_THRESHOLDS[name] ? 'pass' : 'fail');
};

const validReportShape = (report) => (
    hasExactKeys(report, REPORT_KEYS)
    && report.schemaVersion === 2
    && validIdentity(report.candidateId)
    && validIdentity(report.releaseId)
    && validIdentity(report.deploymentId)
    && SHA256.test(report.artifactSha256)
    && SHA256.test(report.inputSha256)
    && SHA256.test(report.authoritySha256)
    && Number.isSafeInteger(report.cutoff)
    && report.cutoff >= 0
    && hasExactKeys(report.observation, ['elapsedHours', 'reviewable'])
    && Number.isFinite(report.observation.elapsedHours)
    && report.observation.elapsedHours >= 0
    && typeof report.observation.reviewable === 'boolean'
    && hasExactKeys(report.cohorts, ['newUsers'])
    && Number.isSafeInteger(report.cohorts.newUsers)
    && report.cohorts.newUsers >= 0
    && report.observation.reviewable
        === (report.observation.elapsedHours >= 168 || report.cohorts.newUsers >= 100)
    && hasExactKeys(report.metrics, METRIC_KEYS)
    && METRIC_KEYS.every((name) => validMetricShape(name, report.metrics[name], report))
);

export const evaluateSoftLaunchGate = (report) => {
    const blockers = [];
    if (!validReportShape(report)) return { ok: false, blockers: ['report_schema_invalid'] };
    if (!report?.observation?.reviewable) blockers.push('observation_window_incomplete');
    for (const [name, value] of Object.entries(report?.metrics || {})) {
        if (name === 'd1Retention' || name === 'd7Retention') {
            if (!['pass', 'fail', 'pending', 'directional_only'].includes(value?.status)) {
                blockers.push(`${name}_status_invalid`);
            } else if (value.status === 'pending') blockers.push(`${name}_pending`);
            else if (value.status === 'fail') blockers.push(`${name}_below_threshold`);
            continue;
        }
        gateMetric(name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value, blockers);
    }
    return { ok: blockers.length === 0, blockers };
};

export const verifySoftLaunchReport = (report, events, authority) => {
    if (!isPlainObject(authority)) return { ok: false, reason: 'authority_input_required' };
    try {
        const rebuilt = buildSoftLaunchReport({
            events,
            candidateId: report.candidateId,
            artifactSha256: report.artifactSha256,
            releaseId: report.releaseId,
            deploymentId: report.deploymentId,
            cutoff: report.cutoff,
            authority,
        });
        if (report.authoritySha256 !== rebuilt.authoritySha256) {
            return { ok: false, reason: 'authority_input_binding_mismatch' };
        }
        if (JSON.stringify(rebuilt) !== JSON.stringify(report)) {
            return { ok: false, reason: 'report_input_binding_mismatch' };
        }
        return { ok: true, reason: null };
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('authority ')) {
            return { ok: false, reason: 'authority_input_binding_mismatch' };
        }
        return { ok: false, reason: 'report_input_binding_mismatch' };
    }
};
