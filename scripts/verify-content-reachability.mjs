import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildContentReachabilityReport, canonicalizeContentReachability } from '../src/systems/contentReachability.ts';

const ROOT = process.cwd();
const EVIDENCE_ROOT = 'docs/evidence/qa/release-complete-core';

const fail = (message) => {
    console.error(message);
    process.exitCode = 1;
};

const parseArgs = (args) => {
    if (args.length !== 2 || !['--write', '--verify'].includes(args[0])) {
        throw new Error('usage: --write|--verify <repo-relative evidence .json path>');
    }
    const [mode, value] = args;
    if (!value || path.isAbsolute(value) || value.includes('\\')) throw new Error('evidence path must be repository-relative');
    const segments = value.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) throw new Error('evidence path contains unsafe segments');
    if (!value.startsWith(`${EVIDENCE_ROOT}/`) || !value.endsWith('.json')) throw new Error('evidence path is outside the canonical reachability folder');
    return { mode, relativePath: value, absolutePath: path.join(ROOT, value) };
};

const hashReport = (report) => createHash('sha256')
    .update(JSON.stringify(canonicalizeContentReachability(report)))
    .digest('hex');

const EXPECTED_SCHEMA_VERSION = 4;

/**
 * Wave 12 D1 하드 게이트 — 비용 축이 (1) 존재하고 (2) 앵커/보간을 구분하며
 * (3) 보간 행이 리포트에 적힌 규칙으로 재현되는지 확인한다. 보간값을 모델 산출처럼
 * 싣는 것이 이 트랙의 실패 모드라, 증빙을 쓰기 전에 여기서 막는다.
 */
const assertCostAxis = (report) => {
    const cost = report.cost;
    const { secondsPerAction, secondsPerHour } = cost.policy;
    if (report.schemaVersion !== EXPECTED_SCHEMA_VERSION) throw new Error('CONTENT_COST_SCHEMA_VERSION_MISMATCH');
    if (cost.anchors.length === 0
        || cost.policy.actualPlayClaim !== false
        || !Number.isSafeInteger(secondsPerAction)
        || !Number.isSafeInteger(secondsPerHour)
        || cost.malformedGates.length > 0
        || cost.unresolvedEventChainCompletions.length > 0) {
        throw new Error('CONTENT_COST_POLICY_INVALID');
    }
    const anchorLevels = new Set(cost.anchors.map((anchor) => anchor.level));
    // Wave 14 F2: 체인의 완주 게이트는 **전 스텝 max**다 — 종착 스텝의 게이트가 아니다.
    //   `chainEventHandlers`가 스텝 순서를 강제하므로 중간 스텝이 더 깊으면 그것이 완주 비용이다.
    //   버킷이 다시 종착 게이트로 퇴행하면 여기서 막는다(열림 ≤ 완주는 max의 정의상 항상 참이다).
    for (const span of cost.eventChainSpans) {
        if (span.completionGateLevel < span.openGateLevel
            || span.completionCost.level !== span.completionGateLevel
            || span.openCost.level !== span.openGateLevel) {
            throw new Error(`CONTENT_COST_CHAIN_SPAN_INVALID:${span.chain}`);
        }
        const bucket = cost.gates.eventChainCompletions.find((entry) => entry.members.includes(span.chain));
        if (!bucket || bucket.gateLevel !== span.completionGateLevel) {
            throw new Error(`CONTENT_COST_CHAIN_GATE_NOT_COMPLETION:${span.chain}`);
        }
    }
    const chainsInBuckets = cost.gates.eventChainCompletions.reduce((sum, bucket) => sum + bucket.count, 0);
    if (chainsInBuckets !== cost.eventChainSpans.length) throw new Error('CONTENT_COST_CHAIN_SPAN_COUNT_MISMATCH');
    const rows = [
        ...cost.gates.maps,
        ...cost.gates.quests,
        ...cost.gates.equipmentTiers,
        ...cost.gates.jobs,
        ...cost.gates.eventChainCompletions,
        ...cost.eventChainSpans.flatMap((span) => [{ cost: span.openCost }, { cost: span.completionCost }]),
    ].map(({ cost: modeled }) => modeled);
    for (const row of rows) {
        const anchored = anchorLevels.has(row.level);
        if (anchored !== (row.basis === 'anchored')) throw new Error(`CONTENT_COST_BASIS_MISMATCH:${row.level}`);
        if (row.basis === 'anchored' && row.interpolation !== null) {
            throw new Error(`CONTENT_COST_ANCHOR_CARRIES_INTERPOLATION:${row.level}`);
        }
        if (row.basis === 'beyond-anchors' && row.modeledActions !== null) {
            throw new Error(`CONTENT_COST_EXTRAPOLATED:${row.level}`);
        }
        if (row.basis !== 'interpolated') continue;
        const span = row.interpolation.upperCumulativeExp - row.interpolation.lowerCumulativeExp;
        const fraction = (row.cumulativeExp - row.interpolation.lowerCumulativeExp) / span;
        const actions = Math.round(
            row.interpolation.lowerModeledActions
            + fraction * (row.interpolation.upperModeledActions - row.interpolation.lowerModeledActions),
        );
        if (fraction !== row.interpolation.expFraction
            || actions !== row.modeledActions
            || row.modeledSeconds !== actions * secondsPerAction
            || row.modeledHours !== Math.round((row.modeledSeconds * 100) / secondsPerHour) / 100) {
            throw new Error(`CONTENT_COST_INTERPOLATION_IRREPRODUCIBLE:${row.level}`);
        }
    }
};

const main = async () => {
    const target = parseArgs(process.argv.slice(2));
    const report = buildContentReachabilityReport();
    if (report.errors.length > 0) throw new Error(`content reachability has errors: ${report.errors.join(', ')}`);
    assertCostAxis(report);
    const envelope = {
        hashAlgorithm: 'sha256',
        reportHash: hashReport(report),
        report,
    };
    const expected = `${JSON.stringify(envelope, null, 2)}\n`;
    if (target.mode === '--write') {
        await writeFile(target.absolutePath, expected, 'utf8');
        console.log(JSON.stringify({ hashAlgorithm: envelope.hashAlgorithm, reportHash: envelope.reportHash }));
        return;
    }
    const actual = await readFile(target.absolutePath, 'utf8');
    if (actual !== expected) throw new Error(`stale or malformed evidence: ${target.relativePath}`);
    console.log(JSON.stringify({ hashAlgorithm: envelope.hashAlgorithm, reportHash: envelope.reportHash }));
};

try {
    await main();
} catch (error) {
    fail(error instanceof Error ? error.message : String(error));
}
