import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
    BASELINE_PROGRESSION_PROFILE,
    EXPLORATION_RHYTHM_PROFILE,
    EXPLORATION_RHYTHM_V3_PROFILE,
} from '../src/data/progressionProfiles.ts';
import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import {
    MODEL_TIME_POLICY,
    PROGRESSION_CHECKPOINT_LEVELS,
    PROGRESSION_EXP_LADDER_AUTHORITY,
    PROGRESSION_SIMULATOR_BASELINE,
    ProgressionSimulationError,
    cumulativeExpToLevel,
    simulateProgression,
    toModeledHours,
} from '../src/systems/progressionSimulator.ts';
import { BALANCE, CONSTANTS } from '../src/data/constants.ts';

const EXPECTED_JOB_NAMES = [
    '모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사', '어쌔신',
    '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '무당', '시간술사', '사냥의 군주',
];
// Track J3 (2026-09): 이 골든 해시는 DROP_TABLES/LOOT_TABLE 내용에 의존한다
// (simulateProgression이 CombatEngine.loot.ts의 processLoot를 authority로
// 호출하므로, 커버리지가 늘어난 몬스터를 시드가 실제로 만나면 리포트가
// 바뀐다). 이전 값 '2e4c0726be5d78bb7af5e8b3f6377976d1bc397613512c83dc8e2681dd699c43'는
// Track J3 드롭 테이블 확장(105+30종 신규 커버) 전 골든 값이었다 — 콘텐츠
// 추가로 인한 의도된 변경이라 새 값으로 갱신한다(첫 방문 보상 J2는
// authorityUsage에 없어 이 해시에 영향 없음 — J2 단독 적용 시 해시는
// 기존 값과 동일했음을 실측으로 확인).
// 병합(2026-09): J3가 드롭 테이블을 늘리며 갱신했던 해시를 Codex 값으로 되돌린다 —
//   J3 데이터는 Codex의 normalBonusPool(레벨 티어 일반 장비) 경로와 충돌해 철회했다.
// Wave 13 E1 (2026-09-19): tier-3 직업 5종의 `reqLv`를 60 → 45로 내렸다. 시뮬레이터는
//   jobSnapshots를 각 직업의 `reqLv`에서 찍으므로 그 5칸의 스냅샷 레벨과 스탯이 바뀌고,
//   따라서 리포트 해시도 바뀐다 — **의도된 이동이며 예고값 `488c4c01…`과 일치해야 한다**.
//   곡선은 한 글자도 안 건드렸다: 체크포인트 액션 14/52/82/164/1,575/5,246/8,176과
//   `tierEquip`은 이 편집 전후로 바이트 동일하다(`cost.anchors` 8행 불변의 근거).
//   이전 값: '2e4c0726be5d78bb7af5e8b3f6377976d1bc397613512c83dc8e2681dd699c43'.
const EXPECTED_BASELINE_REPORT_SHA256 = '488c4c0166c913b2dceca6fe2946fcbf7ffb0cd56b7e499c57a81f55b014f96c';
// 순서는 EXPECTED_JOB_NAMES와 같다 — 45가 찍힌 다섯 칸이 tier-3 5종(팔라딘·드래곤 나이트·
// 대마법사·그림자 주군·사냥의 군주)이고, 시간술사는 원래부터 tier 3 / reqLv 25다.
const EXPECTED_JOB_LEVELS = [1, 5, 5, 5, 30, 30, 30, 30, 30, 30, 5, 45, 45, 45, 45, 12, 25, 45];

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
    // Wave 13 E1: Lv45 체크포인트에서 tier-3 5종이 함께 열려 13 → 18.
    assert.deepEqual(report.checkpoints.map((checkpoint) => checkpoint.reachableJobCount), [1, 5, 5, 6, 18, 18, 18]);
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

// Wave 12 D1: 접근 비용 축의 보간 기준이 되는 누적 EXP 사다리.
// 시뮬레이터는 CombatEngine.applyExpGain을 굴려서 만들고, 이 테스트는 BALANCE 곡선을
// 독립 오라클로 다시 계산해 둘이 일치하는지 본다(사다리에 두 번째 곡선이 생기면 깨진다).
test('cumulative EXP ladder matches the BALANCE curve and anchors the cost axis at level 1', () => {
    assert.equal(PROGRESSION_EXP_LADDER_AUTHORITY, 'CombatEngine.applyExpGain');
    assert.equal(cumulativeExpToLevel(1), 0);

    let nextExp = Number(INITIAL_STATE.player.nextExp);
    let expected = 0;
    for (let level = 2; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        expected += nextExp;
        nextExp = Math.min(
            Math.floor(nextExp * BALANCE.EXP_SCALE_RATE),
            BALANCE.EXP_LEVEL_HARD_CAP,
        );
        assert.equal(cumulativeExpToLevel(level), expected, `cumulative EXP to level ${level}`);
    }

    // 범위 밖 입력은 사다리 양 끝으로 클램프한다(호출자가 beyond-anchors로 따로 표기한다).
    assert.equal(cumulativeExpToLevel(0), 0);
    assert.equal(cumulativeExpToLevel(-5), 0);
    assert.equal(cumulativeExpToLevel(Number.NaN), 0);
    assert.equal(cumulativeExpToLevel(CONSTANTS.MAX_LEVEL + 50), cumulativeExpToLevel(CONSTANTS.MAX_LEVEL));
    assert.ok(cumulativeExpToLevel(60) > cumulativeExpToLevel(45));
});

test('modeled hours conversion is exact integer arithmetic on the modeled seconds', () => {
    assert.deepEqual({ ...MODEL_TIME_POLICY }, { secondsPerHour: 3_600, hoursPrecisionScale: 100 });
    assert.equal(toModeledHours(0), 0);
    assert.equal(toModeledHours(3_600), 1);
    assert.equal(toModeledHours(472_140), 131.15);
    assert.equal(toModeledHours(735_840), 204.4);
    assert.equal(toModeledHours(14_760), 4.1);
    assert.equal(toModeledHours(45), 0.01);
});

test('checkpoint modeled seconds are the exact action cost of the modeled time policy', () => {
    const report = simulateProgression({ seed: 20_260_810 });
    for (const checkpoint of report.checkpoints) {
        assert.equal(
            checkpoint.modeledSeconds,
            checkpoint.modeledActions * report.modelPolicy.secondsPerAction,
            `checkpoint ${checkpoint.targetLevel}`,
        );
    }
    const actions = report.checkpoints.map((checkpoint) => checkpoint.modeledActions);
    assert.deepEqual(actions, [...actions].sort((left, right) => left - right));
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

test('v3 event candidate keeps EXP and loot multipliers unchanged from its registered v2 predecessor', () => {
    const baseline = simulateProgression({ seed: 20_260_824 });
    const v3 = simulateProgression({
        seed: 20_260_824,
        profile: EXPLORATION_RHYTHM_V3_PROFILE,
        predecessorProfile: EXPLORATION_RHYTHM_PROFILE,
        declaredAxis: 'event',
    });
    assert.deepEqual(v3.progressionProfile, EXPLORATION_RHYTHM_V3_PROFILE);
    assert.equal(v3.progressionProfile.expMultiplier, 1);
    assert.equal(v3.progressionProfile.lootMultiplier, 1);
    assert.equal(v3.totalModeledActions, baseline.totalModeledActions);
    assert.deepEqual(v3.final, baseline.final);
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
            activeExpedition: { id: 'expedition-rng-test', explores: 0 },
            stats: {
                ...structuredClone(INITIAL_STATE.player.stats),
                explores: 1,
                exploreState: { ...structuredClone(INITIAL_STATE.player.stats.exploreState), sinceNarrativeEvent: 1 },
            },
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
