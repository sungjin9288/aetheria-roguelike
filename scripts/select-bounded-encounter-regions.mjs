import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAPS } from '../src/data/maps.ts';

const OBSERVATION_ID = /^obs_[a-f0-9]{32}$/;
const ISSUE_ID = /^issue_[a-f0-9]{32}$/;
const CANDIDATE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ACTION_KINDS = new Set(['move', 'explore', 'combat_start']);
const SURFACES = new Set(['browser', 'ios', 'android']);
const ISSUE_SEVERITIES = new Set(['P0', 'P1', 'P2']);
const ISSUE_CATEGORIES = new Set(['confusion', 'boredom', 'unfair', 'technical']);
const REQUIRED_OBSERVATIONS = 5;
const OBSERVATION_KEYS = new Set([
    'observationId', 'candidateId', 'sourceTreeSha256', 'humanObserved',
    'freshStateAttested', 'testMarker', 'surface', 'startedAt', 'endedAt',
    'firstScreenMs', 'firstActionMs', 'firstActionAccepted', 'combatReached',
    'safeReturnReached', 'saveRestorePassed', 'backgroundRestorePassed',
    'backEventApplicable', 'backEventPassed', 'outcome', 'attachmentSha256', 'issueIds',
]);
const ISSUE_KEYS = new Set(['issueId', 'observationId', 'severity', 'category', 'blocking']);
const SUMMARY_KEYS = new Set([
    'schemaVersion', 'candidateId', 'sourceTreeSha256',
    'requiredFreshHumanObservations', 'observations', 'issues', 'actions',
]);

const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
};

const digestJson = (value) => createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');

const hasExactKeys = (value, expected) => (
    value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === expected.size
    && Object.keys(value).every((key) => expected.has(key))
);

const isCanonicalTimestamp = (value) => {
    if (typeof value !== 'string') return false;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const assertObservationSession = (row) => {
    if (!hasExactKeys(row, OBSERVATION_KEYS)
        || !OBSERVATION_ID.test(row.observationId)
        || !CANDIDATE_ID.test(row.candidateId)
        || !SHA256.test(row.sourceTreeSha256)
        || row.humanObserved !== true
        || row.freshStateAttested !== true
        || row.testMarker !== false
        || !SURFACES.has(row.surface)
        || !isCanonicalTimestamp(row.startedAt)
        || !isCanonicalTimestamp(row.endedAt)
        || Date.parse(row.endedAt) <= Date.parse(row.startedAt)
        || !Number.isFinite(row.firstScreenMs) || row.firstScreenMs < 0 || row.firstScreenMs > 10_000
        || !Number.isFinite(row.firstActionMs) || row.firstActionMs < row.firstScreenMs
        || row.firstActionMs > 10_000
        || typeof row.backEventApplicable !== 'boolean'
        || ![true, false, null].includes(row.backEventPassed)
        || row.outcome !== 'pass'
        || !SHA256.test(row.attachmentSha256)
        || !Array.isArray(row.issueIds)
        || row.issueIds.some((id) => !ISSUE_ID.test(id))
        || new Set(row.issueIds).size !== row.issueIds.length) {
        throw new Error('INVALID_OBSERVATION_SESSION');
    }
    if ((row.surface === 'ios' || row.surface === 'android')
        && (!row.backEventApplicable || row.backEventPassed !== true)) {
        throw new Error('INVALID_OBSERVATION_SESSION');
    }
    if (row.surface === 'browser'
        && (row.backEventApplicable || row.backEventPassed !== null)) {
        throw new Error('INVALID_OBSERVATION_SESSION');
    }
    if (row.firstActionAccepted !== true
        || row.combatReached !== true
        || row.safeReturnReached !== true
        || row.saveRestorePassed !== true
        || row.backgroundRestorePassed !== true) {
        throw new Error('INCOMPLETE_OBSERVATION_JOURNEY');
    }
};

const assertIssue = (issue) => {
    if (!hasExactKeys(issue, ISSUE_KEYS)
        || !ISSUE_ID.test(issue.issueId)
        || !OBSERVATION_ID.test(issue.observationId)
        || !ISSUE_SEVERITIES.has(issue.severity)
        || !ISSUE_CATEGORIES.has(issue.category)
        || typeof issue.blocking !== 'boolean'
        || (issue.severity === 'P0' && !issue.blocking)
        || (issue.severity === 'P2' && issue.blocking)) {
        throw new Error('INVALID_OBSERVATION_ISSUE');
    }
};

const assertAction = (row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error('INVALID_OBSERVATION_ACTION');
    }
    if (!OBSERVATION_ID.test(row.observationId)
        || !Number.isSafeInteger(row.sequence) || row.sequence < 1
        || !CANDIDATE_ID.test(row.candidateId)
        || !SHA256.test(row.sourceTreeSha256)
        || typeof row.humanObserved !== 'boolean'
        || typeof row.freshStateAttested !== 'boolean'
        || typeof row.testMarker !== 'boolean'
        || typeof row.accepted !== 'boolean'
        || !ACTION_KINDS.has(row.kind)
        || typeof row.region !== 'string' || row.region.trim() !== row.region || !row.region) {
        throw new Error('INVALID_OBSERVATION_ACTION');
    }
    if (!Object.hasOwn(MAPS, row.region)) throw new Error('UNKNOWN_REGION_EVIDENCE');
};

const analyzeActions = (actions, count) => {
    if (!Array.isArray(actions) || !Number.isSafeInteger(count) || count < 1) {
        throw new Error('INVALID_REGION_SELECTION_INPUT');
    }

    const candidateIds = new Set();
    const sourceDigests = new Set();
    const actionKeys = new Set();
    const validObservationIds = new Set();
    const counts = new Map();

    for (const row of actions) {
        assertAction(row);
        candidateIds.add(row.candidateId);
        sourceDigests.add(row.sourceTreeSha256);
        const actionKey = `${row.observationId}:${row.sequence}`;
        if (actionKeys.has(actionKey)) throw new Error('DUPLICATE_OBSERVATION_ACTION');
        actionKeys.add(actionKey);

        const map = MAPS[row.region];
        if (!row.accepted || !row.humanObserved || !row.freshStateAttested
            || row.testMarker || map.type === 'safe') continue;

        validObservationIds.add(row.observationId);
        counts.set(row.region, (counts.get(row.region) || 0) + 1);
    }

    if (candidateIds.size !== 1 || sourceDigests.size !== 1) {
        throw new Error('MIXED_CANDIDATE_EVIDENCE');
    }
    if (validObservationIds.size < REQUIRED_OBSERVATIONS) {
        throw new Error('INSUFFICIENT_FRESH_OBSERVATIONS');
    }

    const ranked = [...counts.entries()]
        .map(([region, acceptedActionCount]) => ({ region, acceptedActionCount }))
        .sort((left, right) => (
            right.acceptedActionCount - left.acceptedActionCount
            || left.region.localeCompare(right.region, 'ko')
        ));
    if (ranked.length < count) throw new Error('INSUFFICIENT_OBSERVED_REGIONS');

    return {
        ranked,
        selectedRegions: ranked.slice(0, count).map(({ region }) => region),
        freshObservationCount: validObservationIds.size,
        candidateId: [...candidateIds][0],
        sourceTreeSha256: [...sourceDigests][0],
    };
};

export const selectEncounterRegions = (actions, count = 2) => (
    analyzeActions(actions, count).selectedRegions
);

export const buildEncounterRegionSelection = (summary, count = 2) => {
    if (!hasExactKeys(summary, SUMMARY_KEYS) || summary.schemaVersion !== 2
        || !CANDIDATE_ID.test(summary.candidateId)
        || !SHA256.test(summary.sourceTreeSha256)
        || summary.requiredFreshHumanObservations !== REQUIRED_OBSERVATIONS
        || !Array.isArray(summary.observations)
        || !Array.isArray(summary.issues)
        || !Array.isArray(summary.actions)) {
        throw new Error('INVALID_OBSERVATION_SUMMARY');
    }

    if (summary.observations.length < REQUIRED_OBSERVATIONS) {
        throw new Error('INSUFFICIENT_FRESH_OBSERVATIONS');
    }
    const observationMap = new Map();
    const attachmentDigests = new Set();
    for (const observation of summary.observations) {
        assertObservationSession(observation);
        if (observation.candidateId !== summary.candidateId
            || observation.sourceTreeSha256 !== summary.sourceTreeSha256) {
            throw new Error('MIXED_CANDIDATE_EVIDENCE');
        }
        if (observationMap.has(observation.observationId)
            || attachmentDigests.has(observation.attachmentSha256)) {
            throw new Error('DUPLICATE_OBSERVATION_SESSION');
        }
        observationMap.set(observation.observationId, observation);
        attachmentDigests.add(observation.attachmentSha256);
    }

    const issueMap = new Map();
    for (const issue of summary.issues) {
        assertIssue(issue);
        if (issueMap.has(issue.issueId)) throw new Error('DUPLICATE_OBSERVATION_ISSUE');
        if (!observationMap.has(issue.observationId)) throw new Error('ORPHAN_OBSERVATION_ISSUE');
        issueMap.set(issue.issueId, issue);
    }
    for (const observation of summary.observations) {
        for (const id of observation.issueIds) {
            const issue = issueMap.get(id);
            if (!issue || issue.observationId !== observation.observationId) {
                throw new Error('ORPHAN_OBSERVATION_ISSUE');
            }
        }
    }
    for (const issue of summary.issues) {
        if (!observationMap.get(issue.observationId).issueIds.includes(issue.issueId)) {
            throw new Error('ORPHAN_OBSERVATION_ISSUE');
        }
    }
    if (summary.issues.some((issue) => issue.severity === 'P0'
        || (issue.severity === 'P1' && issue.blocking))) {
        throw new Error('BLOCKING_OBSERVATION_ISSUES');
    }

    const actionSequences = new Map();
    const acceptedObservationIds = new Set();
    for (const row of summary.actions) {
        const observation = observationMap.get(row?.observationId);
        if (!observation) throw new Error('ORPHAN_OBSERVATION_ACTION');
        if (row.candidateId !== observation.candidateId
            || row.sourceTreeSha256 !== observation.sourceTreeSha256
            || row.humanObserved !== observation.humanObserved
            || row.freshStateAttested !== observation.freshStateAttested
            || row.testMarker !== observation.testMarker) {
            throw new Error('MIXED_CANDIDATE_EVIDENCE');
        }
        const sequences = actionSequences.get(row.observationId) || [];
        sequences.push(row.sequence);
        actionSequences.set(row.observationId, sequences);
        if (row.accepted && MAPS[row.region]?.type !== 'safe') {
            acceptedObservationIds.add(row.observationId);
        }
    }
    for (const observation of summary.observations) {
        const sequences = [...(actionSequences.get(observation.observationId) || [])]
            .sort((left, right) => left - right);
        if (sequences.length === 0
            || sequences.some((sequence, index) => sequence !== index + 1)
            || !acceptedObservationIds.has(observation.observationId)) {
            throw new Error('OBSERVATION_SEQUENCE_INVALID');
        }
    }

    const analysis = analyzeActions(summary.actions, count);
    if (analysis.candidateId !== summary.candidateId
        || analysis.sourceTreeSha256 !== summary.sourceTreeSha256) {
        throw new Error('MIXED_CANDIDATE_EVIDENCE');
    }
    const orderedObservations = [...summary.observations]
        .sort((left, right) => left.observationId.localeCompare(right.observationId));
    const orderedIssues = [...summary.issues]
        .sort((left, right) => left.issueId.localeCompare(right.issueId));
    const orderedActions = [...summary.actions].sort((left, right) => (
        left.observationId.localeCompare(right.observationId)
        || left.sequence - right.sequence
    ));

    const surfaceCounts = { browser: 0, ios: 0, android: 0 };
    for (const observation of summary.observations) surfaceCounts[observation.surface] += 1;
    const issueCounts = {
        P0: summary.issues.filter((issue) => issue.severity === 'P0').length,
        blockingP1: summary.issues.filter((issue) => issue.severity === 'P1' && issue.blocking).length,
        nonblocking: summary.issues.filter((issue) => issue.severity === 'P2'
            || (issue.severity === 'P1' && !issue.blocking)).length,
    };

    return {
        schemaVersion: 2,
        candidateId: summary.candidateId,
        sourceTreeSha256: summary.sourceTreeSha256,
        observationDigestSha256: digestJson({
            schemaVersion: 2,
            candidateId: summary.candidateId,
            sourceTreeSha256: summary.sourceTreeSha256,
            requiredFreshHumanObservations: summary.requiredFreshHumanObservations,
            observations: orderedObservations,
            issues: orderedIssues,
            actions: orderedActions,
        }),
        freshObservationCount: analysis.freshObservationCount,
        surfaceCounts,
        issueCounts,
        counts: analysis.ranked,
        selectedRegions: analysis.selectedRegions,
        enabled: true,
    };
};

const parseCli = (argv) => {
    const options = {};
    for (let index = 0; index < argv.length; index += 2) {
        const flag = argv[index];
        const value = argv[index + 1];
        if (!['--input', '--output'].includes(flag) || !value) {
            throw new Error('Usage: --input <observation-summary.json> --output <region-selection.json>');
        }
        options[flag.slice(2)] = value;
    }
    if (!options.input || !options.output || Object.keys(options).length !== 2) {
        throw new Error('Usage: --input <observation-summary.json> --output <region-selection.json>');
    }
    return options;
};

const main = async () => {
    const options = parseCli(process.argv.slice(2));
    const summary = JSON.parse(await readFile(path.resolve(options.input), 'utf8'));
    const result = buildEncounterRegionSelection(summary);
    const outputPath = path.resolve(options.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`selected ${result.selectedRegions.join(', ')}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
