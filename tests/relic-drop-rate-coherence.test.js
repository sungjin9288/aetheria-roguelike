import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DROP_TABLES } from '../src/data/dropTables.ts';
import { RELICS } from '../src/data/relics.ts';
import { getStrongestNumericRelicValue } from '../src/systems/CombatEngine.actions.ts';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import {
    buildRelicDropRateReport,
    canonicalizeRelicDropRateReport,
} from '../src/systems/relicDropRateAudit.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { migrateData } from '../src/utils/gameUtils.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_PATH = 'docs/evidence/qa/release-complete-core/relic-drop-rate.json';

const relicById = (id) => RELICS.find((relic) => relic.id === id);
const luckyCoin = relicById('lucky_coin');
const fortuneRelic = relicById('fortune_relic');

assert.ok(luckyCoin);
assert.ok(fortuneRelic);

const runLoot = (enemy, relics, rolls, player = {}) => {
    let calls = 0;
    const result = processLoot(enemy, { ...player, relics }, 1, () => {
        const roll = rolls[Math.min(calls, rolls.length - 1)];
        calls += 1;
        return roll;
    }, () => 1);
    return {
        itemNames: result.items.map((item) => item.name),
        logTypes: result.logs.map((log) => log.type),
        calls,
    };
};

const makeVictoryState = (relics) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        atk: 200,
        def: 20,
        relics,
        weeklyProtocol: {
            ...structuredClone(INITIAL_STATE.player.weeklyProtocol),
            kills: 0,
            bossKills: 0,
        },
    },
    gameState: 'combat',
    enemy: {
        name: '훈련용 정령',
        baseName: '훈련용 정령',
        level: 1,
        hp: 1,
        maxHp: 1,
        atk: 10,
        def: 0,
        exp: 8,
        gold: 10,
        pattern: { guardChance: 0, heavyChance: 0 },
    },
    combatTurn: 0,
    combatReceipt: null,
});

test('canonical drop_rate catalog values and copy remain byte-exact', () => {
    assert.deepEqual(
        [luckyCoin, fortuneRelic].map(({ id, name, rarity, desc, effect, val }) => ({ id, name, rarity, desc, effect, val })),
        [
            {
                id: 'lucky_coin',
                name: '행운의 동전',
                rarity: 'uncommon',
                desc: '아이템 획득 확률 50% 증가',
                effect: 'drop_rate',
                val: 0.5,
            },
            {
                id: 'fortune_relic',
                name: '운명의 결정',
                rarity: 'rare',
                desc: '아이템 획득 확률 100% 증가 (행운의 동전 강화형)',
                effect: 'drop_rate',
                val: 1.0,
            },
        ],
    );
});

test('drop_rate imports the shared strongest selector and does not define another resolver', () => {
    const lootSource = readFileSync(path.join(ROOT, 'src/systems/CombatEngine.loot.ts'), 'utf8');
    const auditSource = readFileSync(path.join(ROOT, 'src/systems/relicDropRateAudit.ts'), 'utf8');
    assert.match(lootSource, /import \{ getStrongestNumericRelicValue \} from '.\/CombatEngine\.actions\.js';/);
    assert.match(lootSource, /getStrongestNumericRelicValue\(relics, 'drop_rate'\)/);
    assert.match(auditSource, /import \{ getStrongestNumericRelicValue \} from '.\/CombatEngine\.actions\.js';/);
    assert.doesNotMatch(`${lootSource}\n${auditSource}`, /function\s+getStrongestNumericRelicValue/);
});

test('drop_rate uses the strongest finite non-negative value independently of inventory order', () => {
    assert.equal(getStrongestNumericRelicValue([], 'drop_rate'), 0);
    assert.equal(getStrongestNumericRelicValue([luckyCoin], 'drop_rate'), 0.5);
    assert.equal(getStrongestNumericRelicValue([fortuneRelic], 'drop_rate'), 1);
    assert.equal(getStrongestNumericRelicValue([luckyCoin, fortuneRelic], 'drop_rate'), 1);
    assert.equal(getStrongestNumericRelicValue([fortuneRelic, luckyCoin], 'drop_rate'), 1);
});

test('exact threshold and cap behavior are deterministic through production DROP_TABLES loot', () => {
    const thresholdKey = '__drop_rate_threshold__';
    const capKey = '__drop_rate_cap__';
    DROP_TABLES[thresholdKey] = [{ item: '슬라임 젤리', rate: 0.4 }];
    DROP_TABLES[capKey] = [{ item: '슬라임 젤리', rate: 0.6 }];
    try {
        for (const relics of [[luckyCoin, fortuneRelic], [fortuneRelic, luckyCoin]]) {
            assert.equal(runLoot({ name: thresholdKey, dropMod: 1 }, relics, [0.799999, 0.99]).itemNames.length, 1);
            assert.equal(runLoot({ name: thresholdKey, dropMod: 1 }, relics, [0.8, 0.99]).itemNames.length, 0);
            assert.equal(runLoot({ name: capKey, dropMod: 1 }, relics, [0.999999, 0.99]).itemNames.length, 1);
        }
    } finally {
        delete DROP_TABLES[thresholdKey];
        delete DROP_TABLES[capKey];
    }
});

test('one resolved multiplier drives enriched, legacy, and high-level bonus paths with unchanged RNG order', () => {
    const vectors = [
        { enemy: { name: '슬라임', dropMod: 1 }, rolls: [0.9], itemCount: 3, rngCalls: 9 },
        { enemy: { name: '물의 정령', dropMod: 1 }, rolls: [0.7], itemCount: 2, rngCalls: 6 },
        {
            enemy: { name: '__drop_rate_high_level_bonus__', dropMod: 1, exp: 160 },
            rolls: [0.1, 0.99],
            itemCount: 1,
            rngCalls: 4,
        },
    ];

    for (const vector of vectors) {
        const weakFirst = runLoot(vector.enemy, [luckyCoin, fortuneRelic], vector.rolls);
        const strongFirst = runLoot(vector.enemy, [fortuneRelic, luckyCoin], vector.rolls);
        assert.equal(weakFirst.itemNames.length, vector.itemCount);
        assert.equal(weakFirst.calls, vector.rngCalls);
        assert.deepEqual(weakFirst, strongFirst);
    }
});

test('valid prestige guaranteed drop remains unchanged by the shared drop_rate selector', () => {
    const enemy = { name: '__drop_rate_prestige__', isBoss: true, dropMod: 1, exp: 160 };
    const player = { meta: { prestigeRank: 3 } };
    const baseline = runLoot(enemy, [], [0.99], player);
    const withFortune = runLoot(enemy, [fortuneRelic], [0.99], player);

    assert.deepEqual(baseline, {
        itemNames: ['빙화 경갑'],
        logTypes: ['event'],
        calls: 4,
    });
    assert.deepEqual(withFortune, baseline);
});

test('malformed matching values and unsafe chance arithmetic fail closed before a production RNG draw', () => {
    for (const val of [undefined, '1.0', Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
        let calls = 0;
        assert.throws(
            () => processLoot(
                { name: '슬라임', isBoss: true, dropMod: 1, exp: 160 },
                { relics: [{ id: 'invalid', effect: 'drop_rate', val }], meta: { prestigeRank: 3 } },
                1,
                () => {
                    calls += 1;
                    return 0;
                },
                () => 1,
            ),
            /INVALID_RELIC_EFFECT_VALUE/,
        );
        assert.equal(calls, 0);
    }

    let overflowCalls = 0;
    assert.throws(
        () => processLoot(
            { name: '물의 정령', dropMod: 3 },
            { relics: [{ id: 'overflow', effect: 'drop_rate', val: Number.MAX_VALUE }] },
            1,
            () => {
                overflowCalls += 1;
                return 0;
            },
            () => 1,
        ),
        /INVALID_LOOT_DROP_CHANCE/,
    );
    assert.equal(overflowCalls, 0);
});

test('save migration keeps active-run drop_rate descriptions and values authoritative', () => {
    const legacyRelics = [
        {
            id: 'lucky_coin',
            name: '행운의 동전',
            rarity: 'uncommon',
            desc: '구 저장본: 아이템 획득 확률 75% 증가',
            effect: 'drop_rate',
            val: 0.75,
        },
        {
            id: 'fortune_relic',
            name: '운명의 결정',
            rarity: 'rare',
            desc: '구 저장본: 아이템 획득 확률 125% 증가',
            effect: 'drop_rate',
            val: 1.25,
        },
    ];
    const migrated = migrateData({ version: 6, player: { name: 'legacy', relics: legacyRelics } });
    assert.deepEqual(migrated.player.relics, legacyRelics);
    assert.equal(getStrongestNumericRelicValue(migrated.player.relics, 'drop_rate'), 1.25);
});

test('victory reducer replay remains an exact no-op after valid drop_rate settlement', () => {
    const actionMap = makeCombatActionMap(INITIAL_STATE.player);
    const state = makeVictoryState([luckyCoin, fortuneRelic]);
    const action = {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed: 20260817, now: 1_700_000_000_000 },
    };
    const won = actionMap.RESOLVE_COMBAT_ACTION(state, action);
    assert.equal(actionMap.RESOLVE_COMBAT_ACTION(won, action), won);
});

test('drop_rate audit produces deterministic catalog, paths, malformed cases, migration, and replay policy', () => {
    const report = buildRelicDropRateReport();
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report, canonicalizeRelicDropRateReport(report));
    assert.equal(report.pathVectors.length, 3);
    assert.deepEqual(report.pathVectors.map((vector) => vector.path), ['enriched', 'legacy', 'high-level-bonus']);
    assert.ok(report.pathVectors.every((vector) => vector.orders[0].rngCalls === vector.orders[1].rngCalls));
    assert.ok(report.malformedCases.every((entry) => entry.rngCalls === 0));
    assert.deepEqual(report.prestigeInvariant, { itemCount: 1, logTypes: ['event'], rngCalls: 4 });
    assert.equal(report.legacySnapshot.preserved, true);
    assert.equal(report.reducerReplay.contract, 'same action receipt returns the existing state object');

    const drifted = RELICS.map((relic) => ({ ...relic }));
    drifted.find((relic) => relic.id === 'lucky_coin').val = 0.4;
    assert.ok(buildRelicDropRateReport({ relics: drifted }).errors.includes('DROP_RATE_CATALOG_MISMATCH'));
});

test('strict drop_rate evidence rejects tampered policy, vectors, catalog, malformed cases, RNG order, hashes, and paths', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-drop-rate.mjs');
    const run = (...args) => spawnSync(process.execPath, [script, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
    });

    assert.equal(run('--verify', EVIDENCE_PATH).status, 0);
    for (const args of [
        [],
        ['--unknown', EVIDENCE_PATH],
        ['--verify', EVIDENCE_PATH, '--verify', EVIDENCE_PATH],
        ['--write', EVIDENCE_PATH, '--verify', EVIDENCE_PATH],
        ['--verify', '../relic-drop-rate.json'],
        ['--verify', '/tmp/relic-drop-rate.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-drop-rate.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-drop-rate.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const evidence = JSON.parse(readFileSync(path.join(ROOT, EVIDENCE_PATH), 'utf8'));
    const mutations = [
        (copy) => { copy.report.policy.resolution = 'tampered'; },
        (copy) => { copy.report.pathVectors[0].orders[0].relicIds.reverse(); },
        (copy) => { copy.report.pathVectors[1].path = 'tampered'; },
        (copy) => { copy.report.catalog.luckyCoin.val = 0.4; },
        (copy) => { copy.report.malformedCases[0].error = 'NO_ERROR'; },
        (copy) => { copy.report.pathVectors[2].orders[0].rngCalls += 1; },
        (copy) => { copy.reportHash = '0'.repeat(64); },
        (copy) => { copy.sourceSnapshot.files[0].sha256 = '0'.repeat(64); },
        (copy) => { copy.sourceSnapshot.changedPaths.reverse(); },
    ];

    for (const mutate of mutations) {
        const name = `relic-drop-rate-tampered-${randomUUID()}.json`;
        const relative = `docs/evidence/qa/release-complete-core/${name}`;
        const target = path.join(ROOT, relative);
        try {
            const copy = structuredClone(evidence);
            mutate(copy);
            writeFileSync(target, `${JSON.stringify(copy, null, 2)}\n`);
            assert.match(run('--verify', relative).stderr, /EVIDENCE_BYTE_MISMATCH/);
        } finally {
            if (existsSync(target)) unlinkSync(target);
        }
    }
});

test('canonical drop_rate evidence binds the exact report and source snapshot receipts', () => {
    const evidence = JSON.parse(readFileSync(path.join(ROOT, EVIDENCE_PATH), 'utf8'));
    assert.deepEqual(Object.keys(evidence).sort(), ['hashAlgorithm', 'report', 'reportHash', 'sourceSnapshot']);
    assert.equal(evidence.hashAlgorithm, 'sha256');
    const canonicalReport = canonicalizeRelicDropRateReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
    assert.deepEqual(evidence.sourceSnapshot.changedPaths, [
        'docs/evidence/qa/release-complete-core/relic-drop-rate.json',
        'docs/superpowers/plans/2026-08-17-aetheria-relic-drop-rate-plan.md',
        'scripts/verify-relic-drop-rate.mjs',
        'src/systems/CombatEngine.loot.ts',
        'src/systems/relicDropRateAudit.ts',
        'tests/combat-engine-loot.test.js',
        'tests/relic-drop-rate-coherence.test.js',
    ]);
});
