import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    APPROVED_EQUIPMENT_SIDEGRADE_CORRECTIONS,
    APPROVED_EQUIPMENT_PRICE_CORRECTIONS,
    buildEquipmentEconomyReport,
    EQUIPMENT_ECONOMY_CANDIDATE_DIGEST,
    EQUIPMENT_ECONOMY_PREDECESSOR_DIGEST,
    EQUIPMENT_ECONOMY_PRICE_REMOVED_INVARIANT,
} from '../src/systems/equipmentEconomyAudit.js';
import { CANONICAL_EQUIPMENT, migrateEquipmentInstancePrice } from '../src/utils/equipmentBaseIdentity.js';
import { ITEMS } from '../src/data/items.js';
import { getCanonicalShopOffer, getDailyDeals, getWeeklySpecial } from '../src/utils/shopRotation.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';

const execFileAsync = promisify(execFile);
const evidencePath = 'docs/evidence/qa/release-complete-core/equipment-economy.json';
const verifierPath = path.resolve('scripts/verify-equipment-economy.mjs');

test('equipment economy report is deterministic, complete, and has only the 20 approved corrections', () => {
    const first = buildEquipmentEconomyReport();
    const second = buildEquipmentEconomyReport();

    assert.deepEqual(first, second);
    assert.equal(first.catalog.count, 229);
    assert.equal(first.rows.length, 229);
    assert.equal(first.candidateCanonicalRows.length, 229);
    assert.equal(first.predecessorCanonicalRows.length, 229);
    assert.equal(first.priceCorrections.length, 20);
    assert.deepEqual(first.priceCorrections, [...APPROVED_EQUIPMENT_PRICE_CORRECTIONS].sort((a, b) => (
        `${a.type}\0${a.name}`.localeCompare(`${b.type}\0${b.name}`)
    )));
    assert.deepEqual(first.errors, []);
    assert.deepEqual(first.candidateDiscontinuities, []);
    assert.equal(first.predecessorDiscontinuities.length, 20);
    assert.deepEqual(
        first.predecessorDiscontinuities.map((row) => `${row.type}\0${row.name}`),
        first.priceCorrections.map((row) => `${row.type}\0${row.name}`),
    );
});

test('economy restores the exact four pre-sidegrade rows while retaining their candidate identities', () => {
    const report = buildEquipmentEconomyReport();
    assert.equal(report.sidegradeCorrections.length, 4);
    assert.deepEqual(report.sidegradeCorrections, [...APPROVED_EQUIPMENT_SIDEGRADE_CORRECTIONS].sort((a, b) => (
        `${a.type}\0${a.name}`.localeCompare(`${b.type}\0${b.name}`)
    )));
    assert.equal(report.priceCorrections.length, 20);

    for (const correction of report.sidegradeCorrections) {
        const identity = `${correction.type}\0${correction.name}`;
        const predecessor = report.predecessorCanonicalRows.find((row) => `${row.type}\0${row.name}` === identity);
        const candidate = report.candidateCanonicalRows.find((row) => `${row.type}\0${row.name}` === identity);
        assert.ok(predecessor, `missing predecessor ${identity}`);
        assert.ok(candidate, `missing candidate ${identity}`);
        assert.deepEqual(
            Object.fromEntries(Object.keys(correction.predecessor).map((key) => [key, predecessor[key]])),
            correction.predecessor,
        );
        assert.deepEqual(
            Object.fromEntries(Object.keys(correction.candidate).map((key) => [key, candidate[key]])),
            correction.candidate,
        );
        for (const field of Object.keys(correction.candidate).filter((key) => key !== 'desc_stat')) {
            assert.equal(Object.hasOwn(predecessor, field), false, `${identity} predecessor retains ${field}`);
        }
    }

    assert.equal(EQUIPMENT_ECONOMY_PREDECESSOR_DIGEST, '25eac085e5b5f48f44632346fe8b767b50d36b8665166175b3b8fc2fcaf72119');
    assert.equal(EQUIPMENT_ECONOMY_PRICE_REMOVED_INVARIANT, '9a4bfd472a7ad47c990a00fcf9d949f0c2bab11905d5eb9dd2800170bd2df644');
    assert.equal(EQUIPMENT_ECONOMY_CANDIDATE_DIGEST, '6e3fb6effec3b88a95849a2cfbb74502f21accf777a24597129068625ec5af8f');
});

test('economy fails closed for fifth-stat, wrong-value, and wrong-copy sidegrade drift', () => {
    const mutate = (name, change) => CANONICAL_EQUIPMENT.map((row) => (
        row.name === name ? change({ ...row }) : row
    ));

    const fifthStat = buildEquipmentEconomyReport({
        rows: mutate('레인저 외투', (row) => ({ ...row, crit: 0.01 })),
    });
    assert.ok(fifthStat.errors.includes('unexpected sidegrade secondary fields for armor\0레인저 외투'));

    const wrongValue = buildEquipmentEconomyReport({
        rows: mutate('독아 채찍', (row) => ({ ...row, crit: 0.08 })),
    });
    assert.ok(wrongValue.errors.includes('sidegrade candidate mismatch for weapon\0독아 채찍'));

    const wrongCopy = buildEquipmentEconomyReport({
        rows: mutate('성운 지팡이', (row) => ({ ...row, desc_stat: 'ATK+195(빛) / MP+19 / 2H' })),
    });
    assert.ok(wrongCopy.errors.includes('sidegrade candidate mismatch for weapon\0성운 지팡이'));
});

test('every canonical row exposes route, identity, stat, hand, and signature metadata', () => {
    const report = buildEquipmentEconomyReport();
    for (const row of report.rows) {
        assert.equal(row.canonicalIdentityResolution.result, 'resolved');
        assert.equal(typeof row.artworkRoute, 'string');
        assert.equal(row.shopReachability, true);
        assert.equal(typeof row.primaryStat.value, 'number');
        assert.equal(typeof row.jobBreadth, 'number');
        assert.ok(Array.isArray(row.jobs));
        if (row.type === 'weapon') {
            assert.ok(row.hands === 1 || row.hands === 2);
        } else {
            assert.equal(row.hands, null);
        }
        assert.equal(typeof row.signature.isSignature, 'boolean');
    }
});

test('cohort statistics include exact medians and explicit zero-denominator corridor handling', () => {
    const report = buildEquipmentEconomyReport();
    const weaponT4 = report.cohortStatistics.find((row) => row.cohort === 'weapon:T4');
    assert.ok(weaponT4);
    assert.equal(weaponT4.count, 22);
    assert.equal(weaponT4.price.median, 6100);
    assert.equal(weaponT4.priceToPrimaryStat.zeroDenominatorHandling, 'excluded');
    assert.equal(weaponT4.priceToPrimaryStat.zeroDenominatorCount, 0);

    const rows = CANONICAL_EQUIPMENT.map((row) => (
        row.name === '에테르 검' ? { ...row, val: 0 } : row
    ));
    const mutated = buildEquipmentEconomyReport({ rows });
    const mutatedWeaponT4 = mutated.cohortStatistics.find((row) => row.cohort === 'weapon:T4');
    assert.ok(mutated.errors.some((error) => error.includes('invalid stat')));
    assert.equal(mutatedWeaponT4.priceToPrimaryStat.zeroDenominatorCount, 1);
});

test('audit fails closed for catalog routes, invalid typed data, and unresolved identities', () => {
    const invalidRows = CANONICAL_EQUIPMENT.map((row, index) => (
        index === 0 ? { ...row, tier: 0, price: -1, val: 0, jobs: [], hands: 3 } : row
    ));
    const artEntries = Object.fromEntries(CANONICAL_EQUIPMENT.map((row) => [row.name, 'route']));
    delete artEntries[CANONICAL_EQUIPMENT[0].name];
    const report = buildEquipmentEconomyReport({
        rows: invalidRows,
        artEntries,
        shopRows: [],
        identitySamples: [{ type: 'weapon', name: '유사 차원절단자' }],
    });
    assert.ok(report.errors.some((error) => error.includes('invalid tier')));
    assert.ok(report.errors.some((error) => error.includes('invalid price')));
    assert.ok(report.errors.some((error) => error.includes('invalid stat')));
    assert.ok(report.errors.some((error) => error.includes('invalid job route')));
    assert.ok(report.errors.some((error) => error.includes('invalid hands')));
    assert.ok(report.errors.some((error) => error.includes('art route')));
    assert.ok(report.errors.some((error) => error.includes('shop route')));
    assert.ok(report.errors.some((error) => error.includes('unresolved canonical identity sample')));
});

test('audit rejects hands fields on armor and shield instead of hiding them in the row projection', () => {
    const armor = CANONICAL_EQUIPMENT.find((row) => row.type === 'armor');
    const shield = CANONICAL_EQUIPMENT.find((row) => row.type === 'shield');
    assert.ok(armor);
    assert.ok(shield);
    const rows = CANONICAL_EQUIPMENT.map((row) => {
        if (row === armor) return { ...row, hands: 1 };
        if (row === shield) return { ...row, hands: 2 };
        return row;
    });
    const report = buildEquipmentEconomyReport({ rows });

    assert.ok(report.errors.includes(`invalid hands for ${armor.type}\0${armor.name}`));
    assert.ok(report.errors.includes(`invalid hands for ${shield.type}\0${shield.name}`));
});

test('audit rejects an undeclared predecessor price-scale discontinuity', () => {
    const rows = CANONICAL_EQUIPMENT.map((row) => (
        row.name === '에테르 세이버' ? { ...row, price: 1 } : row
    ));
    const report = buildEquipmentEconomyReport({ rows });
    assert.ok(report.errors.some((error) => error.includes('undeclared price-scale discontinuity weapon:에테르 세이버')));
    assert.ok(report.errors.some((error) => error.includes('candidate price-scale discontinuity weapon:에테르 세이버')));
});

test('strict verifier uses node crypto evidence hashes and compares exact bytes without writing in verify mode', async () => {
    const before = await readFile(evidencePath, 'utf8');
    const parsed = JSON.parse(before);
    assert.equal(parsed.hashAlgorithm, 'sha256');
    assert.equal(parsed.hashes.candidateDigest, EQUIPMENT_ECONOMY_CANDIDATE_DIGEST);
    assert.equal(parsed.hashes.predecessorDigest, EQUIPMENT_ECONOMY_PREDECESSOR_DIGEST);
    assert.equal(parsed.hashes.priceRemovedInvariantDigest, EQUIPMENT_ECONOMY_PRICE_REMOVED_INVARIANT);

    const { stdout } = await execFileAsync(
        process.execPath,
        ['--import', 'tsx', 'scripts/verify-equipment-economy.mjs', '--verify', evidencePath],
    );
    assert.match(stdout, /equipment economy evidence verified/i);
    assert.equal(await readFile(evidencePath, 'utf8'), before);

    const auditSource = await readFile('src/systems/equipmentEconomyAudit.ts', 'utf8');
    assert.doesNotMatch(auditSource, /SHA256_K|rightRotate|createHash|function\s+digest/);
});

test('strict verifier rejects duplicate, unknown, absolute, dot, traversal, and backslash paths before writing', async () => {
    const target = '/tmp/aetheria-equipment-economy-unsafe.json';
    await writeFile(target, 'sentinel');
    const invalidArgs = [
        ['--write', target, '--verify', evidencePath],
        ['--wat', evidencePath],
        ['--verify', target],
        ['--verify', `./${evidencePath}`],
        ['--verify', 'docs/evidence/qa/release-complete-core/../release-complete-core/equipment-economy.json'],
        ['--verify', 'docs\\evidence\\qa\\release-complete-core\\equipment-economy.json'],
    ];
    for (const args of invalidArgs) {
        await assert.rejects(
            execFileAsync(process.execPath, ['--import', 'tsx', 'scripts/verify-equipment-economy.mjs', ...args]),
        );
    }
    assert.equal(await readFile(target, 'utf8'), 'sentinel');
});

test('strict verifier rejects a symlink ancestor and does not write', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'aetheria-economy-symlink-'));
    const linkedTarget = await mkdtemp(path.join(os.tmpdir(), 'aetheria-economy-target-'));
    const linkedPath = path.join(root, 'docs/evidence/qa/release-complete-core');
    try {
        await mkdir(path.dirname(linkedPath), { recursive: true });
        await symlink(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir');
        await symlink(linkedTarget, linkedPath);
        await assert.rejects(
            execFileAsync(
                process.execPath,
                ['--import', 'tsx', verifierPath, '--write', evidencePath],
                { cwd: root },
            ),
            /symlink evidence path/i,
        );
        await assert.rejects(readFile(path.join(linkedTarget, 'equipment-economy.json'), 'utf8'));
    } finally {
        await rm(root, { recursive: true, force: true });
        await rm(linkedTarget, { recursive: true, force: true });
    }
});

test('stock, discounts, migrated sell values, and reducer purchase use canonical price authority', () => {
    const canonical = ITEMS.weapons.find((item) => item.name === '차원절단자');
    assert.ok(canonical);
    assert.equal(canonical.price, 22000);
    assert.deepEqual(getCanonicalShopOffer('stock', canonical.name, 60, '황금 왕국'), {
        item: canonical,
        price: 22000,
    });

    for (const deal of getDailyDeals(60).items) {
        const base = [...ITEMS.weapons, ...ITEMS.armors, ...ITEMS.consumables].find((item) => item.name === deal.name);
        assert.ok(base);
        assert.equal(deal.originalPrice, base.price);
        assert.equal(deal.price, Math.floor(base.price * 0.9));
    }
    const weekly = getWeeklySpecial(60);
    assert.ok(weekly);
    const weeklyBase = [...ITEMS.weapons, ...ITEMS.armors].find((item) => item.name === weekly.name);
    assert.ok(weeklyBase);
    assert.equal(weekly.price, Math.floor(weeklyBase.price * 0.85));

    const migrated = migrateEquipmentInstancePrice({
        ...canonical,
        id: 'legacy-candidate',
        price: 2500,
        enhance: 3,
        extension: { preserved: true },
    });
    const state = structuredClone(INITIAL_STATE);
    state.gameState = GS.SHOP;
    state.player.gold = 0;
    state.player.inv = [migrated];
    const sold = gameReducer(state, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: 'legacy-candidate' } });
    assert.equal(sold.player.gold, 11000);
    assert.deepEqual(sold.player.inv, []);
});
