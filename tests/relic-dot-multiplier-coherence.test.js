import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { RELICS } from '../src/data/relics.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getStrongestNumericRelicValue } from '../src/systems/CombatEngine.actions.ts';
import {
    buildRelicDotMultiplierReport,
    canonicalizeRelicDotMultiplierReport,
} from '../src/systems/relicDotMultiplierAudit.ts';
import { migrateData } from '../src/utils/dataMigration.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const deathMark = {
    id: 'death_mark',
    name: '죽음의 낙인',
    rarity: 'rare',
    desc: '독과 화상으로 주는 피해가 3배로 증가',
    effect: 'dot_mult',
    val: 3.0,
};
const curseCrystal = {
    id: 'curse_crystal',
    name: '저주의 결정',
    rarity: 'rare',
    desc: '상태 이상 피해 50% 증가',
    effect: 'dot_mult',
    val: 1.5,
};

const makePlayer = (relics = []) => ({
    name: 'dot-test',
    job: '모험가',
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100,
    relics,
    status: [],
    skillChoices: {},
    skillLoadout: { selected: 0, cooldowns: {} },
    combatFlags: { firstSkillUsed: true },
});

const makeEnemy = (def = 50) => ({
    name: 'dot-target',
    hp: 100,
    maxHp: 100,
    atk: 1,
    def,
});

const burnSkill = { name: '화상 시험', mp: 10, mult: 1, cooldown: 1, effect: 'burn' };
const strikeSkill = { name: '비상태 시험', mp: 10, mult: 1, cooldown: 1 };

const sequenceRng = (...values) => {
    let index = 0;
    let draws = 0;
    return {
        random: () => {
            draws += 1;
            return values[index++] ?? values.at(-1) ?? 0;
        },
        draws: () => draws,
    };
};

const perform = ({ relics, skill = burnSkill, critChance = 0, rolls = [0, 0.99, 0], enemyDef = 50 }) => {
    const rng = sequenceRng(...rolls);
    const result = CombatEngine.performSkill(
        makePlayer(relics),
        makeEnemy(enemyDef),
        { atk: 10, def: 0, elem: 'physical', critChance, relics, activeSynergies: [] },
        skill,
        rng.random,
    );
    return { result, rngDraws: rng.draws() };
};

const makeReducerState = (relics) => {
    const state = structuredClone(INITIAL_STATE);
    state.player = {
        ...state.player,
        name: 'dot-replay',
        job: '마법사',
        hp: 200,
        maxHp: 200,
        mp: 200,
        maxMp: 200,
        atk: 100,
        relics,
        skillLoadout: { selected: 0, cooldowns: {} },
        combatFlags: { firstSkillUsed: true },
    };
    state.gameState = 'combat';
    state.enemy = {
        name: 'replay target',
        baseName: 'replay target',
        hp: 1_000,
        maxHp: 1_000,
        atk: 0,
        def: 0,
        exp: 0,
        gold: 0,
        pattern: { guardChance: 0, heavyChance: 0 },
    };
    state.combatTurn = 0;
    state.combatReceipt = null;
    return state;
};

const stableSkillAction = {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'skill', expectedTurn: 0, seed: 20260817, now: 1_700_000_000_000 },
};

test('production performSkill resolves dot_mult strongest-only after the captured first-match RED', () => {
    const deathThenCurse = perform({ relics: [deathMark, curseCrystal] }).result;
    const curseThenDeath = perform({ relics: [curseCrystal, deathMark] }).result;

    assert.equal(deathThenCurse.updatedEnemy.hp, 91);
    assert.equal(curseThenDeath.updatedEnemy.hp, 91);
});

test('RED: no dot_mult keeps the production 1.0 baseline bonus and status log at zero DEF', () => {
    const { result } = perform({ relics: [], enemyDef: 0 });

    assert.equal(result.updatedEnemy.hp, 90);
    assert.ok(result.logs.some((entry) => entry.text.includes('[burn] 추가 피해 +1')));
});

test('dot_mult selector reuses the sole strongest numeric resolver and rejects malformed matches', () => {
    assert.equal(getStrongestNumericRelicValue([], 'dot_mult'), 0);
    assert.equal(getStrongestNumericRelicValue([deathMark], 'dot_mult'), 3);
    assert.equal(getStrongestNumericRelicValue([curseCrystal], 'dot_mult'), 1.5);
    assert.equal(getStrongestNumericRelicValue([deathMark, curseCrystal], 'dot_mult'), 3);
    assert.equal(getStrongestNumericRelicValue([curseCrystal, deathMark], 'dot_mult'), 3);

    for (const val of [undefined, '1.5', Number.NaN, Number.POSITIVE_INFINITY, -1]) {
        const relic = val === undefined
            ? { id: 'invalid-dot', effect: 'dot_mult' }
            : { id: 'invalid-dot', effect: 'dot_mult', val };
        assert.throws(
            () => getStrongestNumericRelicValue([relic], 'dot_mult'),
            /INVALID_RELIC_EFFECT_VALUE:invalid-dot/,
        );
    }
});

test('catalog values and descriptions stay exact while active-run snapshots survive two migration reloads', () => {
    const family = RELICS.filter((relic) => relic.effect === 'dot_mult');
    assert.equal(JSON.stringify(family), JSON.stringify([deathMark, curseCrystal]));

    const legacySnapshots = [
        { ...deathMark, desc: 'legacy death mark snapshot', val: 2.75 },
        { ...curseCrystal, desc: 'legacy curse crystal snapshot', val: 1.25 },
    ];
    const first = migrateData({ version: 6, player: { name: 'legacy-dot', relics: legacySnapshots } });
    const second = migrateData(first);

    assert.equal(JSON.stringify(first.player.relics), JSON.stringify(legacySnapshots));
    assert.equal(JSON.stringify(second.player.relics), JSON.stringify(legacySnapshots));
    assert.equal(JSON.stringify(legacySnapshots), JSON.stringify([
        { ...deathMark, desc: 'legacy death mark snapshot', val: 2.75 },
        { ...curseCrystal, desc: 'legacy curse crystal snapshot', val: 1.25 },
    ]));
});

test('production performSkill measures baseline, single relics, both orders, status, critical, mitigation, and floors', () => {
    const noRelicZeroDef = perform({ relics: [], enemyDef: 0 });
    const none = perform({ relics: [] });
    const deathOnly = perform({ relics: [deathMark] });
    const curseOnly = perform({ relics: [curseCrystal] });
    const deathThenCurse = perform({ relics: [deathMark, curseCrystal] });
    const curseThenDeath = perform({ relics: [curseCrystal, deathMark] });
    const nonStatusNone = perform({ relics: [], skill: strikeSkill, rolls: [0, 0.99] });
    const nonStatusBoth = perform({ relics: [curseCrystal, deathMark], skill: strikeSkill, rolls: [0, 0.99] });
    const criticalDeathThenCurse = perform({
        relics: [deathMark, curseCrystal],
        critChance: 1,
        rolls: [0, 0, 0],
    });
    const criticalCurseThenDeath = perform({
        relics: [curseCrystal, deathMark],
        critChance: 1,
        rolls: [0, 0, 0],
    });

    assert.equal(noRelicZeroDef.result.updatedEnemy.hp, 90);
    assert.ok(noRelicZeroDef.result.logs.some((entry) => entry.text.includes('[burn] 추가 피해 +1')));
    assert.deepEqual(
        [none, deathOnly, curseOnly, deathThenCurse, curseThenDeath].map(({ result }) => result.updatedEnemy.hp),
        [94, 91, 93, 91, 91],
        'fixed production RNG gives raw 10/14/11 then applies one DEF mitigation floor',
    );
    for (const { result, rngDraws } of [none, deathOnly, curseOnly, deathThenCurse, curseThenDeath]) {
        assert.equal(result.updatedPlayer.mp, 90);
        assert.equal(result.updatedPlayer.skillLoadout.cooldowns['화상 시험'], 1);
        assert.deepEqual(result.updatedEnemy.dots, ['burn']);
        assert.equal(rngDraws, 3);
    }
    assert.deepEqual(
        [nonStatusNone.result.updatedEnemy.hp, nonStatusBoth.result.updatedEnemy.hp],
        [94, 94],
    );
    assert.equal(nonStatusNone.rngDraws, 2);
    assert.equal(nonStatusBoth.rngDraws, 2);
    assert.deepEqual(
        [criticalDeathThenCurse.result.updatedEnemy.hp, criticalCurseThenDeath.result.updatedEnemy.hp],
        [82, 82],
    );
    assert.equal(criticalDeathThenCurse.result.isCrit, true);
    assert.equal(criticalCurseThenDeath.result.isCrit, true);
    assert.equal(criticalDeathThenCurse.rngDraws, 3);
    assert.equal(criticalCurseThenDeath.rngDraws, 3);
});

test('malformed matching dot_mult fails before RNG, MP, cooldown, HP, enemy status, logs, or reducer settlement', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    for (const [name, val] of [
        ['missing', undefined],
        ['string', '1.5'],
        ['nan', Number.NaN],
        ['infinity', Number.POSITIVE_INFINITY],
        ['negative', -1],
    ]) {
        const relic = val === undefined
            ? { id: `invalid-${name}`, effect: 'dot_mult' }
            : { id: `invalid-${name}`, effect: 'dot_mult', val };
        const player = makePlayer([relic]);
        const enemy = makeEnemy();
        const beforePlayer = structuredClone(player);
        const beforeEnemy = structuredClone(enemy);
        let rngDraws = 0;

        assert.throws(
            () => CombatEngine.performSkill(
                player,
                enemy,
                { atk: 10, def: 0, elem: 'physical', critChance: 0, relics: [relic], activeSynergies: [] },
                burnSkill,
                () => {
                    rngDraws += 1;
                    return 0;
                },
            ),
            new RegExp(`INVALID_RELIC_EFFECT_VALUE:invalid-${name}`),
        );
        assert.equal(rngDraws, 0);
        assert.deepEqual(player, beforePlayer);
        assert.deepEqual(enemy, beforeEnemy);

        const state = makeReducerState([relic]);
        const beforeState = structuredClone(state);
        assert.throws(
            () => actionMap.RESOLVE_COMBAT_ACTION(state, stableSkillAction),
            new RegExp(`INVALID_RELIC_EFFECT_VALUE:invalid-${name}`),
        );
        assert.deepEqual(state, beforeState);
    }
});

test('production combat reducer settles a stable skill receipt exactly once and exact replay is identity no-op', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = makeReducerState([curseCrystal, deathMark]);
    const settled = actionMap.RESOLVE_COMBAT_ACTION(state, stableSkillAction);
    const replayed = actionMap.RESOLVE_COMBAT_ACTION(settled, stableSkillAction);

    assert.equal(settled.combatReceipt?.key, '1:1700000000000:20260817');
    assert.equal(settled.combatTurn, 1);
    assert.ok(settled.player.mp < state.player.mp);
    assert.ok(settled.enemy.hp < state.enemy.hp);
    assert.ok(settled.enemy.dots.includes('burn'));
    assert.ok(settled.logs.length > state.logs.length);
    assert.equal(replayed, settled);
    assert.equal(replayed.player.mp, settled.player.mp);
    assert.equal(replayed.enemy.hp, settled.enemy.hp);
    assert.deepEqual(replayed.enemy.dots, settled.enemy.dots);
    assert.equal(replayed.logs.length, settled.logs.length);
});

test('audit uses production paths, binds every vector, and has no local strongest resolver', () => {
    const report = buildRelicDotMultiplierReport({ relics: RELICS });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.policy, {
        selector: 'getStrongestNumericRelicValue',
        none: 0,
        deathMark: 3,
        curseCrystal: 1.5,
        bothOrders: [3, 3],
    });
    assert.deepEqual(report.production.status.map((vector) => vector.enemyHp), [90, 94, 91, 93, 91, 91]);
    assert.deepEqual(report.production.critical.map((vector) => vector.enemyHp), [82, 82]);
    assert.ok(report.malformed.every((vector) => vector.rngDraws === 0 && vector.inputUnchanged));
    assert.equal(report.migration.firstReloadPreserved, true);
    assert.equal(report.migration.secondReloadPreserved, true);
    assert.equal(report.replay.settledOnce, true);
    assert.equal(report.replay.replayIsSameObject, true);
    assert.deepEqual(report, canonicalizeRelicDotMultiplierReport(report));

    const actionsSource = readFileSync(path.join(ROOT, 'src/systems/CombatEngine.actions.ts'), 'utf8');
    const auditSource = readFileSync(path.join(ROOT, 'src/systems/relicDotMultiplierAudit.ts'), 'utf8');
    assert.equal((actionsSource.match(/export function getStrongestNumericRelicValue/g) || []).length, 1);
    assert.match(actionsSource, /const resolvedDotMult = getStrongestNumericRelicValue\(relics, 'dot_mult'\);/);
    assert.match(actionsSource, /const dotMult = hasDotMultRelic \? resolvedDotMult : 1;/);
    assert.doesNotMatch(actionsSource, /const dotRelic = relics\.find/);
    assert.match(auditSource, /import \{ getStrongestNumericRelicValue \} from '\.\/CombatEngine\.actions\.js';/);
    assert.doesNotMatch(auditSource, /function\s+\w*Strongest\w*/);
});

test('strict dot_mult evidence verifier rejects unsafe paths, stale bytes, and symlinks', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-dot-multiplier.mjs');
    const outputRelative = 'docs/evidence/qa/release-complete-core/relic-dot-multiplier.json';
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    assert.equal(run('--verify', outputRelative).status, 0);
    for (const args of [
        [],
        ['--unknown', outputRelative],
        ['--verify', outputRelative, '--verify', outputRelative],
        ['--write', outputRelative, '--verify', outputRelative],
        ['--verify', '../relic-dot-multiplier.json'],
        ['--verify', '/tmp/relic-dot-multiplier.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-dot-multiplier.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-dot-multiplier.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const suffix = randomUUID();
    const evidenceDir = path.join(ROOT, 'docs/evidence/qa/release-complete-core');
    const mismatchPath = path.join(evidenceDir, `relic-dot-multiplier-mismatch-${suffix}.json`);
    const symlinkPath = path.join(evidenceDir, `relic-dot-multiplier-symlink-${suffix}.json`);
    try {
        writeFileSync(mismatchPath, `${readFileSync(path.join(ROOT, outputRelative), 'utf8')} `);
        assert.match(
            run('--verify', path.relative(ROOT, mismatchPath)).stderr,
            /EVIDENCE_BYTE_MISMATCH/,
        );
        symlinkSync('relic-dot-multiplier.json', symlinkPath);
        assert.match(
            run('--verify', path.relative(ROOT, symlinkPath)).stderr,
            /SYMLINK_OUTPUT_PATH/,
        );
    } finally {
        if (existsSync(mismatchPath)) unlinkSync(mismatchPath);
        if (existsSync(symlinkPath)) unlinkSync(symlinkPath);
    }
});

test('canonical dot_mult evidence binds report and source hashes to SHA-256', () => {
    const evidence = JSON.parse(readFileSync(
        path.join(ROOT, 'docs/evidence/qa/release-complete-core/relic-dot-multiplier.json'),
        'utf8',
    ));
    assert.deepEqual(Object.keys(evidence).sort(), ['hashAlgorithm', 'report', 'reportHash', 'sourceHashes']);
    assert.equal(evidence.hashAlgorithm, 'sha256');
    const canonicalReport = canonicalizeRelicDotMultiplierReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
    for (const [relativePath, hash] of Object.entries(evidence.sourceHashes)) {
        const bytes = readFileSync(path.join(ROOT, relativePath));
        assert.equal(hash, createHash('sha256').update(bytes).digest('hex'), relativePath);
    }
});
