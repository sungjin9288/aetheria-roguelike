import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RELICS } from '../src/data/relics.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { getStrongestNumericRelicValue } from '../src/systems/CombatEngine.actions.ts';
import { migrateData } from '../src/utils/gameUtils.ts';
import {
    buildRelicGoldMultiplierReport,
    canonicalizeRelicGoldMultiplierReport,
} from '../src/systems/relicGoldMultiplierAudit.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const goldMagnet = Object.freeze({
    id: 'gold_magnet',
    name: '황금 자석',
    rarity: 'common',
    desc: '골드 획득 30% 증가',
    effect: 'gold_mult',
    val: 0.3,
});
const merchantSeal = Object.freeze({
    id: 'merchant_seal',
    name: '상인의 인장',
    rarity: 'rare',
    desc: '골드 획득 60% 증가 (공허의 왕좌 다음 등급)',
    effect: 'gold_mult',
    val: 0.6,
});

const makePlayer = (relics) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '골드 정책 검증자',
    level: 1,
    gold: 0,
    relics,
});

const enemy = Object.freeze({
    name: '골드 정책 허수아비',
    baseName: '골드 정책 허수아비',
    level: 1,
    hp: 1,
    maxHp: 1,
    atk: 1,
    def: 0,
    exp: 0,
    gold: 101,
});

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

const makeCombatState = (relics) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...makePlayer(relics),
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        atk: 200,
        def: 20,
    },
    gameState: 'combat',
    enemy: structuredClone(enemy),
    combatTurn: 0,
    combatReceipt: null,
});

const victoryAction = Object.freeze({
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: 0, seed: 20260813, now: 1_700_000_000_000 },
});

test('RED characterization: production handleVictory must not settle gold_mult by first inventory match', () => {
    const result = CombatEngine.handleVictory(
        makePlayer([goldMagnet, merchantSeal]),
        enemy,
        { expMult: 0, goldMult: 0 },
        {},
    );

    assert.equal(result.goldGained, 161);
});

test('gold_mult resolves the strongest finite non-negative matching value in both inventory orders', () => {
    assert.equal(getStrongestNumericRelicValue([], 'gold_mult'), 0);
    assert.equal(getStrongestNumericRelicValue([goldMagnet], 'gold_mult'), 0.3);
    assert.equal(getStrongestNumericRelicValue([merchantSeal], 'gold_mult'), 0.6);
    assert.equal(getStrongestNumericRelicValue([goldMagnet, merchantSeal], 'gold_mult'), 0.6);
    assert.equal(getStrongestNumericRelicValue([merchantSeal, goldMagnet], 'gold_mult'), 0.6);

    const forward = CombatEngine.handleVictory(
        makePlayer([goldMagnet, merchantSeal]), enemy, { expMult: 0, goldMult: 0 }, {},
    );
    const reverse = CombatEngine.handleVictory(
        makePlayer([merchantSeal, goldMagnet]), enemy, { expMult: 0, goldMult: 0 }, {},
    );
    assert.equal(forward.goldGained, 161);
    assert.equal(reverse.goldGained, 161);
    assert.deepEqual(forward.updatedPlayer.gold, reverse.updatedPlayer.gold);
});

test('canonical gold_mult catalog keeps the approved 0.3 and 0.6 bytes unchanged', () => {
    const family = RELICS.filter((relic) => relic.effect === 'gold_mult');
    assert.deepEqual(family.map(({ id, name, rarity, desc, effect, val }) => ({
        id, name, rarity, desc, effect, val,
    })), [goldMagnet, merchantSeal]);

    const catalogBytes = readFileSync(path.join(ROOT, 'src/data/relics.ts'), 'utf8');
    assert.match(catalogBytes, /id: 'gold_magnet',[\s\S]*?val: 0\.3,/);
    assert.match(catalogBytes, /id: 'merchant_seal',[\s\S]*?val: 0\.6,/);
});

test('legacy active-run gold_mult snapshots survive migration and reload without description or value rewrites', () => {
    const legacyGoldMagnet = {
        ...goldMagnet,
        desc: '골드 획득 45% 증가 (기존 실행 스냅샷)',
        val: 0.45,
    };
    const legacyRelics = [legacyGoldMagnet, { ...merchantSeal }];
    const migrated = migrateData({
        version: 5,
        player: { name: '기록된 탐험가', job: '모험가', stats: {}, equip: {}, relics: legacyRelics },
    });
    const reloaded = migrateData(migrated);

    assert.equal(JSON.stringify(migrated.player.relics), JSON.stringify(legacyRelics));
    assert.equal(JSON.stringify(reloaded.player.relics), JSON.stringify(legacyRelics));
    assert.equal(
        CombatEngine.handleVictory(
            makePlayer([legacyGoldMagnet]), enemy, { expMult: 0, goldMult: 0 }, {},
        ).goldGained,
        146,
    );
});

test('malformed matching values and reward overflow fail closed before any victory settlement', () => {
    const malformedValues = [undefined, '0.6', Number.NaN, Number.POSITIVE_INFINITY, -0.01];
    for (const val of malformedValues) {
        const relic = { ...goldMagnet, id: `malformed-${String(val)}`, val };
        const player = makePlayer([relic]);
        const playerBefore = structuredClone(player);
        assert.throws(
            () => CombatEngine.handleVictory(player, enemy, { expMult: 0, goldMult: 0 }, {}),
            /INVALID_RELIC_EFFECT_VALUE/,
        );
        assert.deepEqual(player, playerBefore);

        const state = makeCombatState([relic]);
        const stateBefore = structuredClone(state);
        assert.throws(
            () => actionMap.RESOLVE_COMBAT_ACTION(state, victoryAction),
            /INVALID_RELIC_EFFECT_VALUE/,
        );
        assert.deepEqual(state, stateBefore);
    }

    const overflowPlayer = makePlayer([{ ...merchantSeal, val: Number.MAX_VALUE }]);
    const overflowEnemy = { ...enemy, gold: 2 };
    const overflowBefore = structuredClone(overflowPlayer);
    assert.throws(
        () => CombatEngine.handleVictory(overflowPlayer, overflowEnemy, { expMult: 0, goldMult: 0 }, {}),
        /INVALID_RELIC_EFFECT_VALUE/,
    );
    assert.deepEqual(overflowPlayer, overflowBefore);

    const storedGoldOverflowPlayer = { ...makePlayer([merchantSeal]), gold: Number.MAX_VALUE };
    const storedGoldOverflowBefore = structuredClone(storedGoldOverflowPlayer);
    assert.throws(
        () => CombatEngine.handleVictory(
            storedGoldOverflowPlayer,
            { ...enemy, gold: 1 },
            { expMult: 0, goldMult: 0 },
            {},
        ),
        /INVALID_RELIC_EFFECT_VALUE/,
    );
    assert.deepEqual(storedGoldOverflowPlayer, storedGoldOverflowBefore);
});

test('handleVictory rounding is deterministic and reducer replay is an exact no-op for both orders', () => {
    for (const relics of [[goldMagnet, merchantSeal], [merchantSeal, goldMagnet]]) {
        const first = CombatEngine.handleVictory(
            makePlayer(relics), enemy, { expMult: 0, goldMult: 0 }, {},
        );
        const second = CombatEngine.handleVictory(
            makePlayer(relics), enemy, { expMult: 0, goldMult: 0 }, {},
        );
        assert.equal(first.goldGained, Math.floor(101 * 1.6));
        assert.deepEqual(first, second);

        const state = makeCombatState(relics);
        const settled = actionMap.RESOLVE_COMBAT_ACTION(state, victoryAction);
        const replayed = actionMap.RESOLVE_COMBAT_ACTION(settled, victoryAction);
        assert.equal(settled.player.gold - state.player.gold, 161);
        assert.equal(settled.combatReceipt?.kind, 'victory');
        assert.equal(replayed, settled);
    }
});

test('gold multiplier audit binds policy, orders, rewards, catalog, and malformed cases', () => {
    const report = buildRelicGoldMultiplierReport({ relics: RELICS });
    assert.deepEqual(report.policy, {
        effect: 'gold_mult',
        stacking: 'strongest-only',
        goldMagnetValue: 0.3,
        merchantSealValue: 0.6,
        bothOrdersValue: [0.6, 0.6],
        activeRunSnapshot: 'preserved',
    });
    assert.deepEqual(report.reward, {
        enemyGold: 101,
        strongestValue: 0.6,
        bothOrdersGold: [161, 161],
        rounding: 'Math.floor',
    });
    assert.deepEqual(report.malformedCases, {
        undefined: 'INVALID_RELIC_EFFECT_VALUE',
        string: 'INVALID_RELIC_EFFECT_VALUE',
        nan: 'INVALID_RELIC_EFFECT_VALUE',
        infinity: 'INVALID_RELIC_EFFECT_VALUE',
        negative: 'INVALID_RELIC_EFFECT_VALUE',
        overflow: 'INVALID_RELIC_EFFECT_VALUE',
    });
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report, canonicalizeRelicGoldMultiplierReport(report));
});

test('strict gold multiplier evidence verifier rejects unsafe arguments, symlinks, and every tampered field family', () => {
    const script = path.join(ROOT, 'scripts/verify-relic-gold-multiplier.mjs');
    const outputRelative = 'docs/evidence/qa/release-complete-core/relic-gold-multiplier.json';
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
        ['--verify', '../relic-gold-multiplier.json'],
        ['--verify', '/tmp/relic-gold-multiplier.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\relic-gold-multiplier.json'],
        ['--verify', 'docs/evidence/qa/./release-complete-core/relic-gold-multiplier.json'],
    ]) {
        assert.notEqual(run(...args).status, 0, args.join(' '));
    }

    const evidence = JSON.parse(readFileSync(path.join(ROOT, outputRelative), 'utf8'));
    const variants = [
        ['policy', (candidate) => { candidate.report.policy.stacking = 'additive'; }],
        ['order', (candidate) => { candidate.report.policy.bothOrdersValue[1] = 0.3; }],
        ['reward', (candidate) => { candidate.report.reward.bothOrdersGold[0] = 131; }],
        ['catalog', (candidate) => { candidate.report.catalog.goldMagnet.value = 0.31; }],
        ['malformed-case', (candidate) => { candidate.report.malformedCases.nan = 'ACCEPTED'; }],
        ['hash', (candidate) => { candidate.reportHash = '0'.repeat(64); }],
    ];
    const evidenceDir = path.join(ROOT, 'docs/evidence/qa/release-complete-core');
    const createdPaths = [];
    try {
        for (const [label, mutate] of variants) {
            const name = `relic-gold-multiplier-${label}-${randomUUID()}.json`;
            const relative = `docs/evidence/qa/release-complete-core/${name}`;
            const destination = path.join(evidenceDir, name);
            const candidate = structuredClone(evidence);
            mutate(candidate);
            writeFileSync(destination, `${JSON.stringify(candidate, null, 2)}\n`);
            createdPaths.push(destination);
            assert.match(run('--verify', relative).stderr, /EVIDENCE_BYTE_MISMATCH/);
        }

        const symlinkName = `relic-gold-multiplier-symlink-${randomUUID()}.json`;
        const symlinkPath = path.join(evidenceDir, symlinkName);
        symlinkSync('relic-gold-multiplier.json', symlinkPath);
        createdPaths.push(symlinkPath);
        assert.match(
            run('--verify', `docs/evidence/qa/release-complete-core/${symlinkName}`).stderr,
            /SYMLINK_OUTPUT_PATH/,
        );
    } finally {
        for (const candidate of createdPaths) {
            if (existsSync(candidate)) unlinkSync(candidate);
        }
    }
});

test('canonical gold multiplier evidence binds report and authority hashes to SHA-256', () => {
    const evidence = JSON.parse(readFileSync(
        path.join(ROOT, 'docs/evidence/qa/release-complete-core/relic-gold-multiplier.json'),
        'utf8',
    ));
    assert.deepEqual(Object.keys(evidence).sort(), [
        'authorityHashes', 'hashAlgorithm', 'report', 'reportHash',
    ]);
    assert.equal(evidence.hashAlgorithm, 'sha256');
    assert.deepEqual(Object.keys(evidence.authorityHashes).sort(), [
        'catalog', 'combatActions', 'combatOutcome',
    ]);
    Object.values(evidence.authorityHashes).forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
    const canonicalReport = canonicalizeRelicGoldMultiplierReport(evidence.report);
    const reportBytes = Buffer.from(`${JSON.stringify(canonicalReport, null, 2)}\n`, 'utf8');
    assert.equal(evidence.reportHash, createHash('sha256').update(reportBytes).digest('hex'));
});
