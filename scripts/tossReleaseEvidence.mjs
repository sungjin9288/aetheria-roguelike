const SHA256 = /^[a-f0-9]{64}$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;
const TOSS_AIT_MAX_BYTES = 100 * 1024 * 1024;
const TOSS_DIST_MAX_BYTES = 80 * 1024 * 1024;

const TOP_LEVEL_KEYS = [
    'schemaVersion',
    'evaluatedAt',
    'candidate',
    'deployment',
    'observations',
    'issues',
    'consoleAssets',
    'externalGates',
];
const CANDIDATE_KEYS = [
    'candidateId', 'gitCommit', 'gitTree', 'cleanTree', 'sdkVersion',
    'aitPath', 'aitSha256', 'aitBytes', 'distRoot', 'distTreeSha256', 'distBytes',
    'verifierReportPath', 'verifierReportSha256', 'builtAt',
];
const DEPLOYMENT_KEYS = [
    'candidateId', 'artifactSha256', 'appName', 'environment', 'deploymentId', 'releaseId',
    'uploadedAt', 'receiptRef', 'receiptSha256',
];
const OBSERVATION_KEYS = [
    'observationId', 'sessionId', 'phase', 'candidateId', 'artifactSha256', 'deploymentId', 'releaseId',
    'runtime', 'platform', 'osMajor', 'deviceClass', 'testerAlias', 'observerAlias',
    'freshStateMethod', 'freshStateAttested', 'observed', 'startedAt', 'endedAt',
    'firstScreenMs', 'firstActionMs', 'firstActionType', 'combatReached', 'safeReturnReached',
    'saveRestorePassed', 'backgroundForegroundPassed', 'forcedRestartRestorePassed',
    'backEventApplicable', 'backEventPassed', 'serviceWorkerAbsent', 'outcome', 'issueIds',
    'attachments',
];
const ATTACHMENT_KEYS = ['ref', 'sha256'];
const ISSUE_KEYS = [
    'issueId', 'observationIds', 'discoveredCandidateId', 'discoveryEvidenceRef',
    'discoveryEvidenceSha256', 'severity', 'category', 'blocking', 'status', 'repro',
    'expected', 'actual', 'redactionAttested', 'fixedCandidateId', 'fixedAt',
    'retestObservationId',
];
const ASSET_KEYS = [
    'kind', 'path', 'width', 'height', 'sha256', 'candidateId', 'releaseId',
    'originalPlay', 'testMarker',
];
const EXTERNAL_GATE_KEYS = [
    'status', 'candidateId', 'releaseId', 'evidenceRef', 'evidenceSha256', 'verifiedAt',
    'expiresAt', 'approverRole',
];

const REQUIRED_EXTERNAL_GATES = [
    'app_name', 'sdk3_nonrollback', 'cors', 'game_navigation', 'business', 'settlement',
    'grac_rating', 'privacy_policy', 'support_channel', 'event_collector', 'sentry_release',
    'console_assets_review',
];

const isPlainObject = (value) => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const hasExactKeys = (value, keys) => (
    isPlainObject(value)
    && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n')
);

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() === value && value.length > 0;
const isFiniteNonNegative = (value) => Number.isFinite(value) && value >= 0;
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;
const isIsoDate = (value) => isNonEmptyString(value) && Number.isFinite(Date.parse(value));
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_REF = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,255}$/;
const FRESH_STATE_METHODS = new Set(['isolated_install', 'sandbox_reset', 'app_data_clear']);
const FIRST_ACTION_TYPES = new Set(['move', 'explore', 'mission_open']);

const isSafeId = (value) => isNonEmptyString(value) && SAFE_ID.test(value);
const isSafeRelativeRef = (value) => (
    isNonEmptyString(value)
    && !value.startsWith('/')
    && !value.includes('\\')
    && SAFE_RELATIVE_REF.test(value)
    && value.split('/').every((segment) => segment !== '.' && segment !== '..' && segment.length > 0)
);
const isSafeIssueText = (value) => (
    isNonEmptyString(value)
    && value.length <= 280
    && !/[\r\n\\/@]/.test(value)
    && !/https?:|\b(?:nickname|user.?key|session.?id|inventory|equipment)\b/i.test(value)
    && !/[A-Z][A-Z0-9]*_[A-Z0-9_]+/.test(value)
    && !/\b[a-f0-9]{24,}\b/i.test(value)
);

const validAttachment = (attachment) => (
    hasExactKeys(attachment, ATTACHMENT_KEYS)
    && isSafeRelativeRef(attachment.ref)
    && SHA256.test(attachment.sha256)
);

const validateCandidate = (candidate, errors) => {
    if (!hasExactKeys(candidate, CANDIDATE_KEYS)) {
        errors.push('candidate_schema_invalid');
        return;
    }
    if (!isSafeId(candidate.candidateId)) errors.push('candidate_id_invalid');
    if (!GIT_COMMIT.test(candidate.gitCommit)) errors.push('candidate_git_commit_invalid');
    if (!GIT_COMMIT.test(candidate.gitTree)) errors.push('candidate_git_tree_invalid');
    if (candidate.cleanTree !== true) errors.push('candidate_tree_not_clean');
    for (const field of ['aitSha256', 'distTreeSha256', 'verifierReportSha256']) {
        if (!SHA256.test(candidate[field])) errors.push(`candidate_${field}_invalid`);
    }
    for (const field of ['aitPath', 'distRoot', 'verifierReportPath']) {
        if (!isSafeRelativeRef(candidate[field])) errors.push(`candidate_${field}_invalid`);
    }
    if (candidate.aitPath !== 'aetheria.ait' || candidate.distRoot !== 'dist-toss'
        || candidate.verifierReportPath !== `docs/evidence/toss/releases/${candidate.candidateId}/bundle-report.json`) {
        errors.push('candidate_path_contract_invalid');
    }
    if (!/^3\.\d+\.\d+$/.test(candidate.sdkVersion)) errors.push('candidate_sdk_invalid');
    if (!isPositiveInteger(candidate.aitBytes) || !isPositiveInteger(candidate.distBytes)) {
        errors.push('candidate_size_invalid');
    }
    if (candidate.aitBytes > TOSS_AIT_MAX_BYTES || candidate.distBytes > TOSS_DIST_MAX_BYTES) {
        errors.push('candidate_budget_exceeded');
    }
    if (!isIsoDate(candidate.builtAt)) errors.push('candidate_built_at_invalid');
};

const validateDeployment = (deployment, candidate, errors) => {
    if (!hasExactKeys(deployment, DEPLOYMENT_KEYS)) {
        errors.push('deployment_missing');
        return;
    }
    if (deployment.candidateId !== candidate?.candidateId) errors.push('deployment_candidate_mismatch');
    if (deployment.artifactSha256 !== candidate?.aitSha256) errors.push('deployment_artifact_mismatch');
    if (deployment.appName !== 'aetheria') errors.push('deployment_app_name_invalid');
    if (!['sandbox', 'production'].includes(deployment.environment)) errors.push('deployment_environment_invalid');
    for (const field of ['deploymentId', 'releaseId']) {
        if (!isSafeId(deployment[field])) errors.push(`deployment_${field}_invalid`);
    }
    if (!isSafeRelativeRef(deployment.receiptRef)) errors.push('deployment_receipt_ref_invalid');
    if (!SHA256.test(deployment.receiptSha256)) errors.push('deployment_receipt_invalid');
    if (!isIsoDate(deployment.uploadedAt)) errors.push('deployment_uploaded_at_invalid');
};

const validateObservation = (row, deployment, candidate, seen, seenSessions, seenAttachments, errors) => {
    if (!hasExactKeys(row, OBSERVATION_KEYS)) {
        errors.push('observation_schema_invalid');
        return;
    }
    if (!isSafeId(row.observationId) || seen.has(row.observationId)) {
        errors.push('observation_id_invalid');
    }
    seen.add(row.observationId);
    if (typeof row.sessionId !== 'string' || !/^obs_[a-f0-9]{32}$/.test(row.sessionId)
        || seenSessions.has(row.sessionId)) errors.push('observation_session_id_invalid');
    seenSessions.add(row.sessionId);
    if (!['internal', 'private_qr'].includes(row.phase)) errors.push('observation_phase_invalid');
    if (row.candidateId !== candidate?.candidateId) errors.push('observation_candidate_mismatch');
    if (row.artifactSha256 !== candidate?.aitSha256) errors.push('observation_artifact_mismatch');
    if (row.deploymentId !== deployment?.deploymentId || row.releaseId !== deployment?.releaseId) {
        errors.push('observation_deployment_mismatch');
    }
    if (row.runtime !== 'sandbox') errors.push('observation_runtime_invalid');
    if (!['ios', 'android'].includes(row.platform)) errors.push('observation_platform_invalid');
    if (!isPositiveInteger(row.osMajor) || !['phone', 'tablet'].includes(row.deviceClass)) {
        errors.push('observation_device_invalid');
    }
    if (!isSafeId(row.testerAlias) || !isSafeId(row.observerAlias)) errors.push('observation_alias_invalid');
    if (!FRESH_STATE_METHODS.has(row.freshStateMethod)) errors.push('observation_fresh_state_method_invalid');
    if (!FIRST_ACTION_TYPES.has(row.firstActionType)) errors.push('observation_first_action_type_invalid');
    if (!isIsoDate(row.startedAt) || !isIsoDate(row.endedAt) || Date.parse(row.endedAt) <= Date.parse(row.startedAt)) {
        errors.push('observation_time_invalid');
    }
    if (!isFiniteNonNegative(row.firstScreenMs) || !isFiniteNonNegative(row.firstActionMs)) {
        errors.push('observation_latency_invalid');
    }
    if (row.firstActionMs < row.firstScreenMs) errors.push('observation_action_before_screen');
    const durationMs = Date.parse(row.endedAt) - Date.parse(row.startedAt);
    if (Number.isFinite(durationMs) && (row.firstScreenMs > durationMs || row.firstActionMs > durationMs)) {
        errors.push('observation_latency_exceeds_session');
    }
    if (isIsoDate(deployment?.uploadedAt) && isIsoDate(row.startedAt)
        && Date.parse(row.startedAt) < Date.parse(deployment.uploadedAt)) {
        errors.push('observation_before_deployment');
    }
    if (!['pass', 'fail'].includes(row.outcome)) errors.push('observation_outcome_invalid');
    if (!Array.isArray(row.issueIds) || !row.issueIds.every(isNonEmptyString)) errors.push('observation_issue_ids_invalid');
    if (!Array.isArray(row.attachments) || row.attachments.length === 0
        || !row.attachments.every(validAttachment)) errors.push('observation_attachments_invalid');
    for (const attachment of Array.isArray(row.attachments) ? row.attachments : []) {
        if (seenAttachments.has(attachment.sha256)) errors.push('observation_attachment_duplicate');
        seenAttachments.add(attachment.sha256);
    }
};

const validateIssue = (issue, observationIds, seen, candidate, errors) => {
    if (!hasExactKeys(issue, ISSUE_KEYS)) {
        errors.push('issue_schema_invalid');
        return;
    }
    if (!isSafeId(issue.issueId) || seen.has(issue.issueId)) errors.push('issue_id_invalid');
    seen.add(issue.issueId);
    if (!Array.isArray(issue.observationIds)
        || !issue.observationIds.every((id) => observationIds.has(id))) errors.push('issue_observation_invalid');
    if (!isSafeId(issue.discoveredCandidateId)
        || !isSafeRelativeRef(issue.discoveryEvidenceRef)
        || !SHA256.test(issue.discoveryEvidenceSha256)) errors.push('issue_discovery_evidence_invalid');
    if (!['P0', 'P1', 'P2'].includes(issue.severity)) errors.push('issue_severity_invalid');
    if (!['confusion', 'boredom', 'unfair', 'technical'].includes(issue.category)) errors.push('issue_category_invalid');
    if (typeof issue.blocking !== 'boolean' || !['open', 'fixed', 'wont_fix'].includes(issue.status)) {
        errors.push('issue_status_invalid');
    }
    for (const field of ['repro', 'expected', 'actual']) {
        if (!isSafeIssueText(issue[field])) errors.push(`issue_${field}_invalid`);
    }
    if (issue.redactionAttested !== true) errors.push('issue_redaction_missing');
    if (issue.status === 'fixed') {
        if (issue.fixedCandidateId !== candidate?.candidateId
            || issue.discoveredCandidateId === candidate?.candidateId
            || !isIsoDate(issue.fixedAt)
            || !isSafeId(issue.retestObservationId)) errors.push('issue_fix_candidate_mismatch');
    } else if (issue.discoveredCandidateId !== candidate?.candidateId
        || issue.observationIds.length === 0
        || issue.fixedCandidateId !== null
        || issue.fixedAt !== null
        || issue.retestObservationId !== null) {
        errors.push('issue_open_state_invalid');
    }
};

const validateConsoleAsset = (asset, deployment, candidate, errors) => {
    if (!hasExactKeys(asset, ASSET_KEYS)) {
        errors.push('console_asset_schema_invalid');
        return;
    }
    if (!['logo', 'thumbnail', 'portrait_screenshot'].includes(asset.kind)) errors.push('console_asset_kind_invalid');
    if (!isSafeRelativeRef(asset.path)) errors.push('console_asset_path_invalid');
    if (!isPositiveInteger(asset.width) || !isPositiveInteger(asset.height)) errors.push('console_asset_dimensions_invalid');
    if (!SHA256.test(asset.sha256)) errors.push('console_asset_sha_invalid');
    if (asset.candidateId !== candidate?.candidateId || asset.releaseId !== deployment?.releaseId) {
        errors.push('console_asset_release_mismatch');
    }
    if (asset.testMarker !== false || typeof asset.originalPlay !== 'boolean') errors.push('console_asset_attestation_invalid');
};

const validateExternalGate = (key, gate, candidate, deployment, evaluatedAt, errors) => {
    if (!hasExactKeys(gate, EXTERNAL_GATE_KEYS)) {
        errors.push(`external_gate_${key}_schema_invalid`);
        return;
    }
    if (!['unverified', 'verified', 'approved', 'rejected', 'expired'].includes(gate.status)) {
        errors.push(`external_gate_${key}_status_invalid`);
    }
    if (gate.status === 'verified' || gate.status === 'approved') {
        if (gate.candidateId !== candidate?.candidateId || gate.releaseId !== deployment?.releaseId
            || !isSafeRelativeRef(gate.evidenceRef) || !SHA256.test(gate.evidenceSha256)
            || !isIsoDate(gate.verifiedAt) || !isSafeId(gate.approverRole)
            || Date.parse(gate.verifiedAt) > Date.parse(evaluatedAt)
            || (gate.expiresAt !== null && (!isIsoDate(gate.expiresAt)
                || Date.parse(gate.expiresAt) <= Date.parse(evaluatedAt)))) {
            errors.push(`external_gate_${key}_evidence_invalid`);
        }
    }
};

export const validateTossReleaseEvidence = (evidence) => {
    const errors = [];
    if (!hasExactKeys(evidence, TOP_LEVEL_KEYS) || evidence.schemaVersion !== 1) {
        return { ok: false, errors: ['evidence_schema_invalid'] };
    }
    if (!isIsoDate(evidence.evaluatedAt)) errors.push('evidence_evaluated_at_invalid');
    validateCandidate(evidence.candidate, errors);
    validateDeployment(evidence.deployment, evidence.candidate, errors);
    if (isIsoDate(evidence.candidate?.builtAt) && isIsoDate(evidence.deployment?.uploadedAt)
        && Date.parse(evidence.deployment.uploadedAt) < Date.parse(evidence.candidate.builtAt)) {
        errors.push('deployment_before_candidate_build');
    }
    if (!Array.isArray(evidence.observations)) errors.push('observations_invalid');
    const observationIds = new Set();
    const observationSessions = new Set();
    const observationAttachments = new Set();
    for (const row of Array.isArray(evidence.observations) ? evidence.observations : []) {
        validateObservation(
            row,
            evidence.deployment,
            evidence.candidate,
            observationIds,
            observationSessions,
            observationAttachments,
            errors,
        );
    }
    if (!Array.isArray(evidence.issues)) errors.push('issues_invalid');
    const issueIds = new Set();
    for (const issue of Array.isArray(evidence.issues) ? evidence.issues : []) {
        validateIssue(issue, observationIds, issueIds, evidence.candidate, errors);
    }
    const observationsById = new Map((Array.isArray(evidence.observations) ? evidence.observations : [])
        .map((row) => [row.observationId, row]));
    for (const issue of Array.isArray(evidence.issues) ? evidence.issues : []) {
        if (Array.isArray(issue.observationIds) && issue.observationIds.some((observationId) => (
            !observationsById.get(observationId)?.issueIds?.includes(issue.issueId)
        ))) errors.push('issue_observation_reference_invalid');
    }
    for (const row of Array.isArray(evidence.observations) ? evidence.observations : []) {
        if (Array.isArray(row.issueIds) && row.issueIds.some((issueId) => !issueIds.has(issueId))) {
            errors.push('observation_issue_reference_invalid');
        }
    }
    if (!Array.isArray(evidence.consoleAssets)) errors.push('console_assets_invalid');
    for (const asset of Array.isArray(evidence.consoleAssets) ? evidence.consoleAssets : []) {
        validateConsoleAsset(asset, evidence.deployment, evidence.candidate, errors);
    }
    if (!isPlainObject(evidence.externalGates)) errors.push('external_gates_invalid');
    for (const [key, gate] of Object.entries(isPlainObject(evidence.externalGates) ? evidence.externalGates : {})) {
        validateExternalGate(key, gate, evidence.candidate, evidence.deployment, evidence.evaluatedAt, errors);
    }
    const latestEvidenceTime = Math.max(
        Date.parse(evidence.deployment?.uploadedAt || '') || 0,
        ...(Array.isArray(evidence.observations) ? evidence.observations : [])
            .map((row) => Date.parse(row.endedAt || '') || 0),
        ...(Array.isArray(evidence.issues) ? evidence.issues : [])
            .map((issue) => Date.parse(issue.fixedAt || '') || 0),
    );
    if (isIsoDate(evidence.evaluatedAt) && Date.parse(evidence.evaluatedAt) < latestEvidenceTime) {
        errors.push('evidence_evaluated_before_inputs');
    }
    return { ok: errors.length === 0, errors: [...new Set(errors)] };
};

const observationPasses = (row) => (
    row.observed === true
    && row.freshStateAttested === true
    && row.firstScreenMs <= 10_000
    && row.firstActionMs <= 10_000
    && row.combatReached === true
    && row.safeReturnReached === true
    && row.saveRestorePassed === true
    && row.backgroundForegroundPassed === true
    && row.forcedRestartRestorePassed === true
    && row.backEventApplicable === true
    && row.backEventPassed === true
    && row.serviceWorkerAbsent === true
    && row.outcome === 'pass'
);

const addObservationGate = (evidence, phase, minimum, blockers) => {
    const rows = evidence.observations.filter((row) => row.phase === phase);
    if (rows.length < minimum) blockers.push(`${phase}_observation_count`);
    if (!rows.some((row) => row.platform === 'ios') || !rows.some((row) => row.platform === 'android')) {
        blockers.push(`${phase}_platform_coverage`);
    }
    if (!rows.every(observationPasses)) blockers.push(`${phase}_acceptance_failed`);
};

const addIssueGate = (evidence, blockers) => {
    const observations = new Map(evidence.observations.map((row) => [row.observationId, row]));
    for (const issue of evidence.issues) {
        if (issue.severity !== 'P0' && issue.blocking !== true) continue;
        const retest = observations.get(issue.retestObservationId);
        const fixedAt = Date.parse(issue.fixedAt || '') || 0;
        if (issue.status !== 'fixed' || issue.fixedCandidateId !== evidence.candidate.candidateId
            || !retest || retest.candidateId !== evidence.candidate.candidateId || !observationPasses(retest)
            || !retest.issueIds.includes(issue.issueId)
            || fixedAt < Date.parse(evidence.deployment.uploadedAt)
            || Date.parse(retest.startedAt) <= fixedAt) {
            blockers.push('blocking_issue_open_or_unretested');
        }
    }
};

const addConsoleAssetGate = (evidence, blockers) => {
    const logo = evidence.consoleAssets.find((asset) => asset.kind === 'logo');
    const thumbnail = evidence.consoleAssets.find((asset) => asset.kind === 'thumbnail');
    const portraits = evidence.consoleAssets.filter((asset) => asset.kind === 'portrait_screenshot');
    if (!logo || logo.width !== 600 || logo.height !== 600) blockers.push('console_logo_missing');
    if (!thumbnail || thumbnail.width !== 1932 || thumbnail.height !== 828) blockers.push('console_thumbnail_missing');
    if (portraits.length < 3 || !portraits.every((asset) => asset.height > asset.width && asset.originalPlay === true)) {
        blockers.push('console_portraits_missing');
    }
    if (new Set(portraits.map((asset) => asset.sha256)).size !== portraits.length) {
        blockers.push('console_portraits_duplicate');
    }
};

const gateReady = (externalGates, key, approved = false) => {
    const status = externalGates[key]?.status;
    return approved ? status === 'approved' : status === 'verified' || status === 'approved';
};

export const evaluateTossReleaseGate = (evidence, phase) => {
    const blockers = [];
    if (!['sandbox', 'private-qr', 'review', 'public', 'ad-activation'].includes(phase)) {
        return { ok: false, phase, blockers: ['phase_invalid'] };
    }
    const validation = validateTossReleaseEvidence(evidence);
    blockers.push(...validation.errors);
    if (!evidence?.deployment) blockers.push('deployment_missing');
    if (blockers.length > 0) return { ok: false, phase, blockers: [...new Set(blockers)] };

    addObservationGate(evidence, 'internal', 5, blockers);
    addIssueGate(evidence, blockers);
    if (phase !== 'sandbox') {
        addObservationGate(evidence, 'private_qr', 10, blockers);
        const internalEndedAt = Math.max(...evidence.observations
            .filter((row) => row.phase === 'internal')
            .map((row) => Date.parse(row.endedAt)));
        const privateStartedAt = Math.min(...evidence.observations
            .filter((row) => row.phase === 'private_qr')
            .map((row) => Date.parse(row.startedAt)));
        if (privateStartedAt < internalEndedAt) blockers.push('private_qr_before_internal_complete');
    }
    if (phase === 'review' || phase === 'public' || phase === 'ad-activation') {
        addConsoleAssetGate(evidence, blockers);
        for (const key of REQUIRED_EXTERNAL_GATES) {
            if (!gateReady(evidence.externalGates, key)) blockers.push(`external_gate_${key}_missing`);
        }
        if (!gateReady(evidence.externalGates, 'review_request_approval', true)) {
            blockers.push('review_request_approval_missing');
        }
        const privateEndedAt = Math.max(...evidence.observations
            .filter((row) => row.phase === 'private_qr')
            .map((row) => Date.parse(row.endedAt)));
        const reviewRequestAt = Date.parse(
            evidence.externalGates.review_request_approval?.verifiedAt || '',
        ) || 0;
        if (reviewRequestAt < privateEndedAt) blockers.push('review_requested_before_private_qr_complete');
    }
    if (phase === 'public' || phase === 'ad-activation') {
        if (!gateReady(evidence.externalGates, 'review_accepted')) blockers.push('review_acceptance_missing');
        if (!gateReady(evidence.externalGates, 'public_release_approval', true)) {
            blockers.push('public_release_approval_missing');
        }
    }
    if (phase === 'ad-activation') {
        if (!gateReady(evidence.externalGates, 'ad_group')) blockers.push('ad_group_missing');
        if (!gateReady(evidence.externalGates, 'ad_activation_approval', true)) {
            blockers.push('ad_activation_approval_missing');
        }
    }
    const requestAt = Date.parse(evidence.externalGates.review_request_approval?.verifiedAt || '') || 0;
    const acceptedAt = Date.parse(evidence.externalGates.review_accepted?.verifiedAt || '') || 0;
    const publicAt = Date.parse(evidence.externalGates.public_release_approval?.verifiedAt || '') || 0;
    if ((phase === 'public' || phase === 'ad-activation')
        && (acceptedAt < requestAt || publicAt < acceptedAt)) blockers.push('release_approval_order_invalid');
    return { ok: blockers.length === 0, phase, blockers: [...new Set(blockers)] };
};
