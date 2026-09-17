import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
    buildEncounterRegionSelection,
    selectEncounterRegions,
} from '../scripts/select-bounded-encounter-regions.mjs';

/**
 * 원래 계약 (이 파일은 W3-A 대상 중 유일하게 이미 "행동 테스트"였다 — 소스를
 * 텍스트로 읽어 정규식을 매치하는 게 아니라 `scripts/select-bounded-encounter-regions.mjs`의
 * 실제 export(`selectEncounterRegions`/`buildEncounterRegionSelection`)를 import해서
 * 직접 호출하고 반환값/throw를 검증한다):
 *   1. selectEncounterRegions: accepted+human-observed+non-safe 액션만 카운트해
 *      횟수·유니코드 타이브레이크로 지역을 고른다. rejected/synthetic(testMarker)/
 *      미관측/중복 관측 시퀀스/후보 ID·소스 다이제스트 불일치/관측 지역 2개 미만/
 *      신선한 관측 5개 미만은 모두 실패로 닫힌다(fail closed).
 *   2. buildEncounterRegionSelection: 완전한 5개 관측 세션(candidate 바인딩·인간
 *      관측·신선 상태·비동기 마커 아님·첫 화면/행동 타이밍·전투 도달·안전 귀환·
 *      저장/복원·백그라운드 복원·(모바일이면 적용 가능한 뒤로가기 통과)·outcome pass)
 *      이 모두 갖춰져야만 지역을 활성화하고, P0/차단 P1 이슈가 있으면 막는다.
 *      비차단 P1/P2는 집계에는 들어가되 원문(note 등)은 금지한다. 고아 액션/이슈,
 *      시퀀스 비연속도 fail closed. 결과는 schemaVersion/enabled/surfaceCounts/
 *      issueCounts/selectedRegions/counts/observationDigestSha256를 담는다.
 *   3. CLI(select-bounded-encounter-regions.mjs)는 증거가 부족하면 아무 출력도
 *      남기지 않고 실패 종료하고(exit 1), 게이트를 통과했을 때만 표준 selection.json을
 *      쓴다(exit 0).
 *
 * 이 파일의 모든 assertion은 이미 실제 함수 호출(1, 2) 또는 실제 CLI 프로세스
 * 실행 + 파일시스템 검사(3, spawnSync + existsSync/readFile)로 검증되고 있어
 * 변환이 필요 없다 — Wave 5 W3-A가 다른 8개 파일에 적용한 "renderStatic으로
 * 옮기기" 패턴이 이미 여기서는 (렌더가 아니라 함수/프로세스 호출로) 달성되어 있다.
 * 계약 문서화만 추가한다.
 */

const candidate = {
    candidateId: 'release-core-local-1',
    sourceTreeSha256: 'a'.repeat(64),
};

const observationId = (value) => `obs_${value.toString(16).padStart(32, '0')}`;
const issueId = (value) => `issue_${value.toString(16).padStart(32, '0')}`;

const action = (overrides = {}) => ({
    observationId: 'obs_00000000000000000000000000000001',
    sequence: 1,
    candidateId: candidate.candidateId,
    sourceTreeSha256: candidate.sourceTreeSha256,
    humanObserved: true,
    freshStateAttested: true,
    testMarker: false,
    region: '고요한 숲',
    kind: 'move',
    accepted: true,
    ...overrides,
});

const observation = (value, overrides = {}) => ({
    observationId: observationId(value),
    candidateId: candidate.candidateId,
    sourceTreeSha256: candidate.sourceTreeSha256,
    humanObserved: true,
    freshStateAttested: true,
    testMarker: false,
    surface: 'browser',
    startedAt: `2026-08-11T0${value}:00:00.000Z`,
    endedAt: `2026-08-11T0${value}:05:00.000Z`,
    firstScreenMs: 900,
    firstActionMs: 1800,
    firstActionAccepted: true,
    combatReached: true,
    safeReturnReached: true,
    saveRestorePassed: true,
    backgroundRestorePassed: true,
    backEventApplicable: false,
    backEventPassed: null,
    outcome: 'pass',
    attachmentSha256: value.toString(16).repeat(64).slice(0, 64),
    issueIds: [],
    ...overrides,
});

const observations = () => Array.from({ length: 5 }, (_, index) => observation(index + 1));

const completeSummary = (actions, overrides = {}) => ({
    schemaVersion: 2,
    ...candidate,
    requiredFreshHumanObservations: 5,
    observations: observations(),
    issues: [],
    actions,
    ...overrides,
});

test('accepted non-safe actions select by count and Unicode region tie-break', () => {
    const actions = [
        action({ observationId: observationId(1), sequence: 1, region: '서쪽 평원' }),
        action({ observationId: observationId(2), sequence: 1, region: '고요한 숲' }),
        action({ observationId: observationId(3), sequence: 1, region: '서쪽 평원', kind: 'explore' }),
        action({ observationId: observationId(4), sequence: 1, region: '고요한 숲', kind: 'combat_start' }),
        action({ observationId: observationId(5), sequence: 1, region: '잊혀진 폐허' }),
    ];

    assert.deepEqual(selectEncounterRegions(actions, 2), ['고요한 숲', '서쪽 평원']);
});

test('rejected, synthetic, unobserved and safe-region actions never contribute', () => {
    const actions = [
        action({ sequence: 1, region: '시작의 마을' }),
        action({ sequence: 2, region: '고요한 숲', accepted: false }),
        action({ sequence: 3, region: '고요한 숲', testMarker: true }),
        action({ sequence: 4, region: '고요한 숲', humanObserved: false }),
        action({ observationId: observationId(1), sequence: 5, region: '서쪽 평원' }),
        action({ observationId: observationId(2), sequence: 6, region: '잊혀진 폐허' }),
        action({ observationId: observationId(3), sequence: 7, region: '서쪽 평원' }),
        action({ observationId: observationId(4), sequence: 8, region: '잊혀진 폐허' }),
        action({ observationId: observationId(5), sequence: 9, region: '서쪽 평원' }),
    ];

    assert.deepEqual(selectEncounterRegions(actions, 2), ['서쪽 평원', '잊혀진 폐허']);
});

test('duplicate observation sequence rejects instead of double-counting', () => {
    const duplicate = action({ sequence: 1 });
    assert.throws(
        () => selectEncounterRegions([duplicate, { ...duplicate }], 2),
        /DUPLICATE_OBSERVATION_ACTION/,
    );
});

test('mixed candidate IDs or source digests reject', () => {
    assert.throws(
        () => selectEncounterRegions([
            action({ sequence: 1 }),
            action({ sequence: 2, candidateId: 'other-candidate' }),
        ], 2),
        /MIXED_CANDIDATE_EVIDENCE/,
    );
    assert.throws(
        () => selectEncounterRegions([
            action({ sequence: 1 }),
            action({ sequence: 2, sourceTreeSha256: 'b'.repeat(64) }),
        ], 2),
        /MIXED_CANDIDATE_EVIDENCE/,
    );
});

test('fewer than two accepted observed regions fails closed', () => {
    assert.throws(
        () => selectEncounterRegions(Array.from({ length: 5 }, (_, index) => action({
            observationId: observationId(index + 1),
            sequence: 1,
        })), 2),
        /INSUFFICIENT_OBSERVED_REGIONS/,
    );
});

test('fewer than five fresh human observations fails closed', () => {
    assert.throws(
        () => selectEncounterRegions([
            action({ observationId: observationId(1), sequence: 1, region: '고요한 숲' }),
            action({ observationId: observationId(2), sequence: 1, region: '서쪽 평원' }),
        ], 2),
        /INSUFFICIENT_FRESH_OBSERVATIONS/,
    );
});

test('selection evidence binds counts, order and input digest', () => {
    const actions = [
        action({ observationId: observationId(1), sequence: 1, region: '서쪽 평원' }),
        action({ observationId: observationId(2), sequence: 1, region: '고요한 숲' }),
        action({ observationId: observationId(3), sequence: 1, region: '고요한 숲', kind: 'explore' }),
        action({ observationId: observationId(4), sequence: 1, region: '고요한 숲' }),
        action({ observationId: observationId(5), sequence: 1, region: '서쪽 평원' }),
    ];
    const result = buildEncounterRegionSelection(completeSummary(actions));

    assert.equal(result.schemaVersion, 2);
    assert.equal(result.enabled, true);
    assert.deepEqual(result.surfaceCounts, { browser: 5, ios: 0, android: 0 });
    assert.deepEqual(result.issueCounts, { P0: 0, blockingP1: 0, nonblocking: 0 });
    assert.deepEqual(result.selectedRegions, ['고요한 숲', '서쪽 평원']);
    assert.deepEqual(result.counts, [
        { region: '고요한 숲', acceptedActionCount: 3 },
        { region: '서쪽 평원', acceptedActionCount: 2 },
    ]);
    assert.match(result.observationDigestSha256, /^[a-f0-9]{64}$/);
});

test('selection requires five complete candidate-bound human journey observations', () => {
    const actions = Array.from({ length: 5 }, (_, index) => action({
        observationId: observationId(index + 1),
        region: index % 2 === 0 ? '고요한 숲' : '서쪽 평원',
    }));

    for (const mutation of [
        { humanObserved: false },
        { freshStateAttested: false },
        { testMarker: true },
        { firstScreenMs: 10_001 },
        { firstActionMs: 10_001 },
        { firstActionAccepted: false },
        { combatReached: false },
        { safeReturnReached: false },
        { saveRestorePassed: false },
        { backgroundRestorePassed: false },
        { outcome: 'fail' },
    ]) {
        const rows = observations();
        rows[0] = { ...rows[0], ...mutation };
        assert.throws(
            () => buildEncounterRegionSelection(completeSummary(actions, { observations: rows })),
            /INVALID_OBSERVATION_SESSION|INCOMPLETE_OBSERVATION_JOURNEY/,
        );
    }

    assert.throws(
        () => buildEncounterRegionSelection(completeSummary(actions, {
            observations: observations().slice(0, 4),
        })),
        /INSUFFICIENT_FRESH_OBSERVATIONS/,
    );
});

test('mobile observations require a passing applicable back event', () => {
    const actions = Array.from({ length: 5 }, (_, index) => action({
        observationId: observationId(index + 1),
        region: index % 2 === 0 ? '고요한 숲' : '서쪽 평원',
    }));
    const rows = observations();
    rows[0] = { ...rows[0], surface: 'ios' };

    assert.throws(
        () => buildEncounterRegionSelection(completeSummary(actions, { observations: rows })),
        /INVALID_OBSERVATION_SESSION/,
    );

    rows[0] = { ...rows[0], backEventApplicable: true, backEventPassed: true };
    assert.equal(
        buildEncounterRegionSelection(completeSummary(actions, { observations: rows })).surfaceCounts.ios,
        1,
    );
});

test('P0 and blocking P1 issue metadata blocks region activation', () => {
    const actions = Array.from({ length: 5 }, (_, index) => action({
        observationId: observationId(index + 1),
        region: index % 2 === 0 ? '고요한 숲' : '서쪽 평원',
    }));
    for (const issue of [
        {
            issueId: issueId(1), observationId: observationId(1), severity: 'P0',
            category: 'technical', blocking: true,
        },
        {
            issueId: issueId(1), observationId: observationId(1), severity: 'P1',
            category: 'unfair', blocking: true,
        },
    ]) {
        const rows = observations();
        rows[0] = { ...rows[0], issueIds: [issue.issueId] };
        assert.throws(
            () => buildEncounterRegionSelection(completeSummary(actions, {
                observations: rows,
                issues: [issue],
            })),
            /BLOCKING_OBSERVATION_ISSUES/,
        );
    }
});

test('nonblocking P1 and P2 issues remain counted without raw free text', () => {
    const actions = Array.from({ length: 5 }, (_, index) => action({
        observationId: observationId(index + 1),
        region: index % 2 === 0 ? '고요한 숲' : '서쪽 평원',
    }));
    const issues = [
        {
            issueId: issueId(1), observationId: observationId(1), severity: 'P1',
            category: 'confusion', blocking: false,
        },
        {
            issueId: issueId(2), observationId: observationId(2), severity: 'P2',
            category: 'boredom', blocking: false,
        },
    ];
    const rows = observations();
    rows[0] = { ...rows[0], issueIds: [issues[0].issueId] };
    rows[1] = { ...rows[1], issueIds: [issues[1].issueId] };
    const result = buildEncounterRegionSelection(completeSummary(actions, {
        observations: rows,
        issues,
    }));
    assert.deepEqual(result.issueCounts, { P0: 0, blockingP1: 0, nonblocking: 2 });

    assert.throws(
        () => buildEncounterRegionSelection(completeSummary(actions, {
            observations: rows,
            issues: [{ ...issues[0], note: 'raw nickname or diagnostic text' }, issues[1]],
        })),
        /INVALID_OBSERVATION_ISSUE/,
    );
});

test('orphan actions, issue links and non-contiguous sequences fail closed', () => {
    const baseActions = Array.from({ length: 5 }, (_, index) => action({
        observationId: observationId(index + 1),
        region: index % 2 === 0 ? '고요한 숲' : '서쪽 평원',
    }));
    assert.throws(
        () => buildEncounterRegionSelection(completeSummary([
            ...baseActions,
            action({ observationId: observationId(9), region: '고요한 숲' }),
        ])),
        /ORPHAN_OBSERVATION_ACTION/,
    );
    assert.throws(
        () => buildEncounterRegionSelection(completeSummary([
            { ...baseActions[0], sequence: 2 },
            ...baseActions.slice(1),
        ])),
        /OBSERVATION_SEQUENCE_INVALID/,
    );
    const rows = observations();
    rows[0] = { ...rows[0], issueIds: [issueId(9)] };
    assert.throws(
        () => buildEncounterRegionSelection(completeSummary(baseActions, { observations: rows })),
        /ORPHAN_OBSERVATION_ISSUE/,
    );
});

test('CLI leaves no output when observation evidence is insufficient', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'aetheria-region-selection-'));
    const input = path.join(dir, 'observations.json');
    const output = path.join(dir, 'selection.json');
    await writeFile(input, `${JSON.stringify({
        ...completeSummary([], {
        actions: Array.from({ length: 5 }, (_, index) => action({
            observationId: observationId(index + 1),
            sequence: 1,
        })),
        }),
    }, null, 2)}\n`);

    const run = spawnSync(process.execPath, [
        '--import', 'tsx',
        'scripts/select-bounded-encounter-regions.mjs',
        '--input', input,
        '--output', output,
    ], {
        cwd: path.resolve(new URL('..', import.meta.url).pathname),
        encoding: 'utf8',
    });

    assert.equal(run.status, 1);
    assert.match(run.stderr, /INSUFFICIENT_OBSERVED_REGIONS/);
    assert.equal(existsSync(output), false);
});

test('CLI writes canonical selection only after the evidence gate passes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'aetheria-region-selection-'));
    const input = path.join(dir, 'observations.json');
    const output = path.join(dir, 'selection.json');
    await writeFile(input, `${JSON.stringify({
        ...completeSummary([], {
        actions: [
            action({ observationId: observationId(1), sequence: 1, region: '고요한 숲' }),
            action({ observationId: observationId(2), sequence: 1, region: '서쪽 평원' }),
            action({ observationId: observationId(3), sequence: 1, region: '고요한 숲' }),
            action({ observationId: observationId(4), sequence: 1, region: '서쪽 평원' }),
            action({ observationId: observationId(5), sequence: 1, region: '고요한 숲' }),
        ],
        }),
    }, null, 2)}\n`);

    const run = spawnSync(process.execPath, [
        '--import', 'tsx',
        'scripts/select-bounded-encounter-regions.mjs',
        '--input', input,
        '--output', output,
    ], {
        cwd: path.resolve(new URL('..', import.meta.url).pathname),
        encoding: 'utf8',
    });

    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(result.selectedRegions, ['고요한 숲', '서쪽 평원']);
});
