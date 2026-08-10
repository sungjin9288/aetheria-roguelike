import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { BASELINE_PROGRESSION_PROFILE } from '../src/data/progressionProfiles.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import {
    PROGRESSION_CHECKPOINT_LEVELS,
    PROGRESSION_SIMULATOR_BASELINE,
    ProgressionSimulationError,
    simulateProgression,
} from '../src/systems/progressionSimulator.ts';

const EXPECTED_JOB_NAMES = [
    '모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사', '어쌔신',
    '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '무당', '시간술사', '사냥의 군주',
];
const EXPECTED_BASELINE_REPORT_SHA256 = '2e4c0726be5d78bb7af5e8b3f6377976d1bc397613512c83dc8e2681dd699c43';
const EXPECTED_JOB_LEVELS = [1, 5, 5, 5, 30, 30, 30, 30, 30, 30, 5, 60, 60, 60, 60, 12, 25, 60];

test('baseline simulation keeps immutable snapshots and reports the exact class graph/checkpoints', () => {
    const baselineBefore = structuredClone(PROGRESSION_SIMULATOR_BASELINE);
    const report = simulateProgression();

    assert.equal(Object.isFrozen(PROGRESSION_SIMULATOR_BASELINE), true);
    assert.equal(Object.isFrozen(PROGRESSION_SIMULATOR_BASELINE.player), true);
    assert.equal(Object.isFrozen(PROGRESSION_SIMULATOR_BASELINE.progressionProfile), true);
    assert.deepEqual(PROGRESSION_SIMULATOR_BASELINE, baselineBefore);
    assert.equal(Object.isFrozen(report), true);
    assert.equal(Object.isFrozen(report.progressionProfile), true);
    assert.deepEqual(report.progressionProfile, {
        id: 'baseline', version: 1, expMultiplier: 1, lootMultiplier: 1, eventMultiplier: 1,
    });

    assert.deepEqual(PROGRESSION_CHECKPOINT_LEVELS, [2, 5, 10, 20, 45, 60, 75]);
    assert.deepEqual(report.checkpoints.map((checkpoint) => checkpoint.targetLevel), [2, 5, 10, 20, 45, 60, 75]);
    assert.deepEqual(report.checkpoints.map((checkpoint) => checkpoint.reachableJobCount), [1, 5, 5, 6, 13, 18, 18]);
    assert.deepEqual(report.jobReachability, {
        rootJob: '모험가',
        expectedJobCount: 18,
        definedJobCount: 18,
        reachableJobCount: 18,
        reachableJobs: EXPECTED_JOB_NAMES,
        unreachableJobs: [],
    });

    assert.equal(report.modelPolicy.classification, 'report-only');
    assert.equal(report.modelPolicy.actualPlayClaim, false);
    assert.equal(report.modelPolicy.version, 1);
    assert.equal(report.totalModeledSeconds, report.totalModeledActions * report.modelPolicy.secondsPerAction);
    assert.equal(report.tierEquip.prematureEquipCount, 0);
    assert.equal(report.tierEquip.blockedByJobCount > 0, true);
    assert.deepEqual(report.jobSnapshots.map((snapshot) => snapshot.job), EXPECTED_JOB_NAMES);
    assert.deepEqual(report.jobSnapshots.map((snapshot) => snapshot.level), EXPECTED_JOB_LEVELS);
    for (const snapshot of report.jobSnapshots) {
        assert.equal(Number.isFinite(snapshot.vitals.maxHp) && snapshot.vitals.maxHp > 0, true);
        assert.equal(Number.isFinite(snapshot.vitals.maxMp) && snapshot.vitals.maxMp > 0, true);
        assert.equal(Number.isFinite(snapshot.encounter.enemyLevel) && snapshot.encounter.enemyLevel >= 1, true);
        assert.equal(Number.isFinite(snapshot.combat.damage) && snapshot.combat.damage >= 1, true);
        assert.equal(snapshot.combat.authority, 'CombatEngine.attack');
    }
    assert.equal(report.final.level >= 75, true);
});

test('event-axis candidate changes seeded narrative occurrences without changing reward/time outcomes', () => {
    const baseline = simulateProgression();
    const boosted = simulateProgression({
        profile: {
            id: 'baseline', version: 2, expMultiplier: 1, lootMultiplier: 1, eventMultiplier: 1.2,
        },
        predecessorProfile: BASELINE_PROGRESSION_PROFILE,
        declaredAxis: 'event',
    });

    assert.equal(boosted.eventProbe.classification, 'proxy-report-only');
    assert.equal(boosted.eventProbe.configuredMultiplier, 1.2);
    assert.equal(boosted.eventProbe.configuredNarrativeEvents > boosted.eventProbe.baselineNarrativeEvents, true);
    assert.equal(boosted.eventProbe.directionMatched, true);
    assert.equal(boosted.totalModeledActions, baseline.totalModeledActions);
    assert.equal(boosted.totalModeledSeconds, baseline.totalModeledSeconds);
    assert.deepEqual(boosted.final, baseline.final);
});

test('fixed-seed report and CLI SHA-256 envelope are byte-deterministic', () => {
    const first = simulateProgression({ seed: 20_260_810 });
    const second = simulateProgression({ seed: 20_260_810 });
    assert.deepEqual(second, first);

    const scriptPath = fileURLToPath(new URL('../scripts/simulate-progression.mjs', import.meta.url));
    const repoRoot = fileURLToPath(new URL('..', import.meta.url));
    const cli = spawnSync(process.execPath, [
        '--import', 'tsx', scriptPath, '--seed', '20260810',
    ], { cwd: repoRoot, encoding: 'utf8' });

    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(cli.stderr, '');
    const envelope = JSON.parse(cli.stdout);
    assert.deepEqual(envelope.report, first);
    assert.equal(envelope.hashAlgorithm, 'sha256');
    assert.equal(
        envelope.reportHash,
        createHash('sha256').update(JSON.stringify(envelope.report)).digest('hex'),
    );
    assert.equal(envelope.reportHash, EXPECTED_BASELINE_REPORT_SHA256);
});

test('invalid numeric inputs and a bounded run fail closed', () => {
    assert.throws(
        () => simulateProgression({ seed: Number.NaN }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_SEED',
    );
    assert.throws(
        () => simulateProgression({ maxSteps: Number.NaN }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_MAX_STEPS',
    );
    assert.throws(
        () => simulateProgression({
            profile: {
                id: 'invalid', version: 2, expMultiplier: Number.NaN, lootMultiplier: 1, eventMultiplier: 1,
            },
        }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_PROFILE',
    );
    assert.throws(
        () => simulateProgression({ maxSteps: 1 }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'MAX_STEPS_EXCEEDED',
    );
});

test('candidate profiles require a valid single-axis predecessor transition', () => {
    const noPredecessor = {
        id: 'baseline', version: 99, expMultiplier: 2, lootMultiplier: 2, eventMultiplier: 2,
    };
    assert.throws(
        () => simulateProgression({ profile: noPredecessor }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_PROFILE_TRANSITION',
    );
    assert.throws(
        () => simulateProgression({
            profile: {
                id: 'baseline', version: 2, expMultiplier: 1.1, lootMultiplier: 1.1, eventMultiplier: 1,
            },
            predecessorProfile: BASELINE_PROGRESSION_PROFILE,
            declaredAxis: 'exp',
        }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_PROFILE_TRANSITION',
    );
    assert.throws(
        () => simulateProgression({
            profile: {
                id: 'baseline', version: 2, expMultiplier: 2, lootMultiplier: 1, eventMultiplier: 1,
            },
            predecessorProfile: BASELINE_PROGRESSION_PROFILE,
            declaredAxis: 'exp',
        }),
        (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_PROFILE_TRANSITION',
    );
});

test('class and equipment gate mutations fail closed before simulation', () => {
    const warrior = DB.CLASSES['전사'];
    const originalReqLevel = warrior.reqLv;
    warrior.reqLv = Number.NaN;
    try {
        assert.throws(
            () => simulateProgression(),
            (error) => error instanceof ProgressionSimulationError && error.code === 'CLASS_GRAPH_MISMATCH',
        );
    } finally {
        warrior.reqLv = originalReqLevel;
    }

    warrior.reqLv = Number.MAX_SAFE_INTEGER;
    try {
        assert.throws(
            () => simulateProgression(),
            (error) => error instanceof ProgressionSimulationError && error.code === 'CLASS_GRAPH_MISMATCH',
        );
    } finally {
        warrior.reqLv = originalReqLevel;
    }

    const originalTier = warrior.tier;
    warrior.tier = Number.NaN;
    try {
        assert.throws(
            () => simulateProgression(),
            (error) => error instanceof ProgressionSimulationError && error.code === 'CLASS_GRAPH_MISMATCH',
        );
    } finally {
        warrior.tier = originalTier;
    }

    const tierSix = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((item) => item.tier === 6);
    assert.ok(tierSix);
    const hadReqLevel = Object.hasOwn(tierSix, 'reqLevel');
    const previousReqLevel = tierSix.reqLevel;
    tierSix.reqLevel = Number.NaN;
    try {
        assert.throws(
            () => simulateProgression(),
            (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_EQUIPMENT_GATE',
        );
    } finally {
        if (hadReqLevel) tierSix.reqLevel = previousReqLevel;
        else delete tierSix.reqLevel;
    }

    const originalJobs = tierSix.jobs;
    tierSix.jobs = '버서커';
    try {
        assert.throws(
            () => simulateProgression(),
            (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_EQUIPMENT_GATE',
        );
    } finally {
        tierSix.jobs = originalJobs;
    }

    tierSix.jobs = ['없는직업'];
    try {
        assert.throws(
            () => simulateProgression(),
            (error) => error instanceof ProgressionSimulationError && error.code === 'INVALID_EQUIPMENT_GATE',
        );
    } finally {
        tierSix.jobs = originalJobs;
    }
});

test('explore action carries the injected RNG through AI fallback selection', async () => {
    const originalWindow = globalThis.window;
    const hadWindow = Object.hasOwn(globalThis, 'window');
    globalThis.window = { location: { search: '?smoke=1' } };
    try {
        const player = {
            ...structuredClone(INITIAL_STATE.player),
            loc: '버려진 광산',
            history: [],
            eventChainProgress: {},
        };
        const draws = [0.99, 0.99, 0, 0.99, 0];
        let drawCount = 0;
        const dispatched = [];
        const actions = createExploreActions({
            player,
            uid: 'rng-test',
            gameState: GS.IDLE,
            dispatch: (action) => dispatched.push(action),
            addLog: () => {},
            addStoryLog: () => {},
            getFullStats: () => ({ atk: 12, def: 5, maxHp: player.maxHp, maxMp: player.maxMp, relics: [] }),
            rng: () => draws[drawCount++] ?? 0,
        }, { commitExploreOutcome: () => {} });

        await actions.explore();

        const eventAction = dispatched.find((action) => action.type === AT.SET_EVENT);
        assert.equal(drawCount, 5);
        assert.equal(eventAction?.payload?.source, 'fallback');
        assert.equal(eventAction?.payload?.desc, '벽면에서 고대 문자가 빛나기 시작합니다.');
    } finally {
        if (hadWindow) globalThis.window = originalWindow;
        else delete globalThis.window;
    }
});

test('simulator source consumes seeded domain streams without global random replacement', () => {
    const source = readFileSync(new URL('../src/systems/progressionSimulator.ts', import.meta.url), 'utf8');
    assert.match(source, /createDomainRandom/);
    assert.doesNotMatch(source, /Math\.random/);
    assert.doesNotMatch(source, /globalThis\.(?:Math|crypto)\s*=/);
});
