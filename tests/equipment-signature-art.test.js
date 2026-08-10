import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import signatureRegistry from '../src/data/signatureRegistry.json' with { type: 'json' };
import { buildEquipmentCatalogRows } from '../scripts/dump-equipment-catalog.mjs';
import { verifyArtAssets } from '../scripts/verify-art-assets.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'src/data/equipmentArtManifest.json');
const PROVENANCE_PATH = path.join(ROOT, 'docs/evidence/art/equipment-signature-mythic-provenance.json');
const ANSWER_KEY_PATH = path.join(ROOT, 'docs/evidence/art/equipment-signature-mythic-contact-sheet-answer-key.json');
const NAMED_CONTACT_PATH = path.join(ROOT, 'docs/evidence/art/equipment-signature-mythic-contact-sheet.png');
const ANONYMOUS_CONTACT_PATH = path.join(ROOT, 'docs/evidence/art/equipment-signature-mythic-contact-sheet-anonymous.png');
const STAFF_COMPARISON_PATH = path.join(ROOT, 'docs/evidence/art/equipment-signature-mythic-staff-blind-comparison.png');
const SOURCE_DIR = path.join(ROOT, 'scripts/art_sources/equipment/v2/signature-mythic');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SHA256 = /^[0-9a-f]{64}$/;
const CELL_ORDER = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

const EXPECTED_BATCHES = Object.freeze({
    'signature-mythic-armor-cloak-01': ['암흑 군주의 망토'],
    'signature-mythic-armor-plate-01': ['광기의 갑주', '드래곤로드 갑주', '심해의 수호복', '혼돈의 갑주'],
    'signature-mythic-armor-robe-01': ['세계수의 로브'],
    'signature-mythic-offhand-book-01': ['에테르 그리모어', '천공 성전'],
    'signature-mythic-offhand-shield-01': ['차원 방패 이지스'],
    'signature-mythic-weapon-bow-01': ['바람의 궁극'],
    'signature-mythic-weapon-dagger-01': ['그림자 절단기', '영혼 절단자'],
    'signature-mythic-weapon-lance-01': ['마왕의 대낫', '성스러운 창', '차원 마왕의 낫'],
    'signature-mythic-weapon-staff-01': ['세계수의 지팡이', '신전 도시의 지팡이', '천벌의 지팡이'],
    'signature-mythic-weapon-sword-01': ['대지의 심판', '라그나로크', '빙결의 왕관검', '성검 에테르니아', '세계수의 검', '에테르 거인의 대검'],
    'signature-mythic-weapon-sword-02': ['용의 화염'],
});

const EXPECTED_SIGNATURES = Object.freeze([
    ['광기의 갑주', 'armor', 'armor-plate', 'signature-armor-mad-armor'],
    ['그림자 절단기', 'weapon', 'weapon-dagger', 'signature-weapon-shadow-cutter'],
    ['대지의 심판', 'weapon', 'weapon-sword', 'signature-weapon-earth-verdict'],
    ['드래곤로드 갑주', 'armor', 'armor-plate', 'signature-armor-dragon-lord'],
    ['라그나로크', 'weapon', 'weapon-sword', 'signature-weapon-ragnarok'],
    ['마왕의 대낫', 'weapon', 'weapon-lance', 'signature-weapon-demon-scythe'],
    ['바람의 궁극', 'weapon', 'weapon-bow', 'signature-weapon-wind-ultimate-bow'],
    ['빙결의 왕관검', 'weapon', 'weapon-sword', 'signature-weapon-frost-crown-sword'],
    ['성검 에테르니아', 'weapon', 'weapon-sword', 'signature-weapon-ethernia'],
    ['성스러운 창', 'weapon', 'weapon-lance', 'signature-weapon-holy-spear'],
    ['세계수의 검', 'weapon', 'weapon-sword', 'signature-weapon-worldtree-sword'],
    ['세계수의 로브', 'armor', 'armor-robe', 'signature-armor-worldtree-robe'],
    ['세계수의 지팡이', 'weapon', 'weapon-staff', 'signature-weapon-worldtree-staff'],
    ['신전 도시의 지팡이', 'weapon', 'weapon-staff', 'signature-weapon-temple-city-staff'],
    ['심해의 수호복', 'armor', 'armor-plate', 'signature-armor-abyssal-guardian'],
    ['암흑 군주의 망토', 'armor', 'armor-cloak', 'signature-armor-dark-lord-cloak'],
    ['에테르 거인의 대검', 'weapon', 'weapon-sword', 'signature-weapon-ether-giant-greatsword'],
    ['에테르 그리모어', 'shield', 'offhand-book', 'signature-shield-ether-grimoire'],
    ['영혼 절단자', 'weapon', 'weapon-dagger', 'signature-weapon-soul-reaper'],
    ['용의 화염', 'weapon', 'weapon-sword', 'signature-weapon-dragon-flame'],
    ['차원 마왕의 낫', 'weapon', 'weapon-lance', 'signature-weapon-dimension-scythe'],
    ['차원 방패 이지스', 'shield', 'offhand-shield', 'signature-shield-aegis-dimension'],
    ['천공 성전', 'shield', 'offhand-book', 'signature-shield-celestial-tome'],
    ['천벌의 지팡이', 'weapon', 'weapon-staff', 'signature-weapon-divine-wrath-staff'],
    ['혼돈의 갑주', 'armor', 'armor-plate', 'signature-armor-chaos-armor'],
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (target) => JSON.parse(await readFile(target, 'utf8'));
const readJsonIfPresent = async (target) => {
    try {
        return await readJson(target);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
};

const readPngContract = async (target) => {
    const bytes = await readFile(target);
    assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG', `${target} must be a PNG`);
    return {
        bytes,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        colorType: bytes[25],
    };
};

test('Task 8 canonical signature inventory is the exact registry-backed 25 identities', async () => {
    const rows = (await buildEquipmentCatalogRows()).filter((row) => row.cohort === 'signature-mythic');
    const actual = rows.map((row) => [
        row.name,
        row.type,
        row.familyKey,
        signatureRegistry.entries[row.name]?.spriteKey,
    ]);

    assert.deepEqual(actual, EXPECTED_SIGNATURES);
    assert.equal(Object.keys(signatureRegistry.entries).length, 25);
    assert.deepEqual(
        [...Object.keys(signatureRegistry.entries)].sort(),
        rows.map((row) => row.name).sort(),
        'catalog and signature registry must have exact two-way identity coverage',
    );
});

test('Task 8 manifest routes all 25 signature item and overlay surfaces to styleVersion 2 evidence', async () => {
    const [rows, manifest] = await Promise.all([buildEquipmentCatalogRows(), readJson(MANIFEST_PATH)]);
    const signatures = rows.filter((row) => row.cohort === 'signature-mythic');
    const overlays = manifest.art?.signatureOverlays || {};

    assert.equal(Object.keys(overlays).length, 25, 'manifest must cover 25 dedicated signature overlays');
    assert.deepEqual(manifest.art?.signatureOverlay, {
        width: 72,
        height: 72,
        margin: 4,
        assetRoot: '/assets/equipment-wearable-exact/',
    });

    for (const row of signatures) {
        const registry = signatureRegistry.entries[row.name];
        assert.equal(manifest.entries[row.name], registry.spriteKey, `${row.name} item route must bind to its registry spriteKey`);
        assert.equal(row.runtimePath, `/assets/equipment-exact/${registry.spriteKey}.png`);

        const artwork = manifest.artwork?.[row.name];
        assert.equal(artwork?.styleVersion, 2, `${row.name} item artwork must be styleVersion 2`);
        assert.equal(artwork?.familyKey, row.familyKey, `${row.name} item artwork must retain its live family`);
        assert.match(artwork?.sourceSha256 || '', SHA256);
        assert.match(artwork?.exportSha256 || '', SHA256);

        const overlay = overlays[row.name];
        assert.equal(overlay?.styleVersion, 2, `${row.name} overlay must be styleVersion 2`);
        assert.equal(overlay?.familyKey, row.familyKey, `${row.name} overlay must retain its live family`);
        assert.equal(overlay?.runtimePath, `/assets/equipment-wearable-exact/${registry.spriteKey}.png`);
        assert.match(overlay?.sourceSha256 || '', SHA256);
        assert.match(overlay?.exportSha256 || '', SHA256);
    }
});

test('Task 8 paired source evidence covers 11 family-pure batches and both runtime surfaces', async () => {
    const [provenance, catalog] = await Promise.all([
        readJsonIfPresent(PROVENANCE_PATH),
        buildEquipmentCatalogRows(),
    ]);
    const familyByName = new Map(catalog.map((row) => [row.name, row.familyKey]));
    assert.ok(provenance, 'signature/mythic provenance must exist before asset approval');
    assert.equal(provenance.cohort, 'signature-mythic');
    assert.equal(provenance.batches?.length, 11);

    const accepted = provenance.generationReview?.accepted || [];
    const acceptedSurfaces = new Set(accepted.map((entry) => `${entry.batchId}:${entry.surface}`));
    assert.equal(accepted.length, 22, 'each paired batch needs one accepted item source and one accepted overlay source');

    const coveredNames = [];
    for (const record of provenance.batches) {
        const expectedNames = EXPECTED_BATCHES[record.batchId];
        assert.ok(expectedNames, `unexpected signature batch ${record.batchId}`);
        assert.deepEqual(record.identityNames, expectedNames);
        assert.equal(
            new Set(record.identityNames.map((name) => familyByName.get(name))).size,
            1,
            `${record.batchId} must stay family-pure`,
        );
        assert.equal(record.itemSourceSheet, `${record.batchId}-item.png`);
        assert.equal(record.overlaySourceSheet, `${record.batchId}-overlay.png`);
        assert.match(record.itemSourceSheetSha256 || '', SHA256);
        assert.match(record.overlaySourceSheetSha256 || '', SHA256);
        assert.equal(record.itemExports?.length, expectedNames.length);
        assert.equal(record.overlayExports?.length, expectedNames.length);
        assert.ok(acceptedSurfaces.has(`${record.batchId}:item`));
        assert.ok(acceptedSurfaces.has(`${record.batchId}:overlay`));

        const trackedBatch = await readJson(path.join(SOURCE_DIR, 'batches', `${record.batchId}.json`));
        assert.deepEqual(trackedBatch.identityNames, expectedNames);
        for (const [index, identity] of trackedBatch.identities.entries()) {
            const registry = signatureRegistry.entries[identity.name];
            assert.equal(identity.cell, CELL_ORDER[index]);
            assert.equal(identity.spriteKey, registry.spriteKey);
            assert.equal(identity.artNote, registry.artNote);
            assert.match(identity.itemPrompt, new RegExp(identity.name));
            assert.match(identity.itemPrompt, new RegExp(registry.artNote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
            assert.match(identity.overlayPrompt, new RegExp(identity.name));
            assert.match(identity.overlayPrompt, new RegExp(registry.artNote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }

        for (const [surface, sourceName] of [['item', record.itemSourceSheet], ['overlay', record.overlaySourceSheet]]) {
            const source = await readPngContract(path.join(SOURCE_DIR, sourceName));
            assert.deepEqual([source.width, source.height, source.colorType], [600, 400, 6], `${record.batchId} ${surface} source must be RGBA 600x400`);
        }

        coveredNames.push(...record.identityNames);
    }

    assert.deepEqual(coveredNames.sort(), EXPECTED_SIGNATURES.map(([name]) => name).sort());
});

test('Task 8 closes the globally unique 229 item, 22 family, and 25 overlay hash surfaces', async () => {
    const [rows, manifest] = await Promise.all([buildEquipmentCatalogRows(), readJson(MANIFEST_PATH)]);
    assert.equal(rows.length, 229);
    assert.equal(manifest.styleVersion, 2);
    assert.equal(Object.keys(manifest.entries || {}).length, 229);
    assert.equal(Object.keys(manifest.artwork || {}).length, 229);
    assert.equal(Object.keys(manifest.art?.families || {}).length, 22);
    assert.equal(Object.keys(manifest.art?.signatureOverlays || {}).length, 25);

    const runtimePaths = new Set();
    const hashes = new Set();
    for (const row of rows) {
        assert.equal(runtimePaths.has(row.runtimePath), false, `duplicate item runtime path: ${row.runtimePath}`);
        runtimePaths.add(row.runtimePath);
        const runtime = await readFile(path.join(PUBLIC_DIR, row.runtimePath.replace(/^\//, '')));
        const exportHash = sha256(runtime);
        assert.equal(manifest.artwork[row.name]?.exportSha256, exportHash);
        assert.equal(hashes.has(exportHash), false, `duplicate item export hash: ${row.name}`);
        hashes.add(exportHash);
    }
    for (const [familyKey, family] of Object.entries(manifest.art.families)) {
        assert.equal(hashes.has(family.exportSha256), false, `family export collides with another surface: ${familyKey}`);
        hashes.add(family.exportSha256);
    }
    for (const [name, overlay] of Object.entries(manifest.art.signatureOverlays)) {
        const runtime = await readPngContract(path.join(PUBLIC_DIR, overlay.runtimePath.replace(/^\//, '')));
        assert.deepEqual([runtime.width, runtime.height, runtime.colorType], [72, 72, 6]);
        assert.equal(overlay.exportSha256, sha256(runtime.bytes));
        assert.equal(hashes.has(overlay.exportSha256), false, `signature overlay collides with another surface: ${name}`);
        hashes.add(overlay.exportSha256);
    }
    assert.equal(hashes.size, 276);
});

test('Task 8 anonymous contact answer key is an exact deterministic row-major registry projection', async () => {
    const [provenance, answerKeyBytes] = await Promise.all([
        readJson(PROVENANCE_PATH),
        readFile(ANSWER_KEY_PATH),
    ]);
    assert.equal(sha256(answerKeyBytes), '7e909dfa746bf332c8a98e3cc7277a9590130d4128d31c0cb2c906e75efe3092');
    const answerKey = JSON.parse(answerKeyBytes.toString('utf8'));
    const names = provenance.batches.flatMap((record) => record.identityNames);
    assert.deepEqual(Object.keys(answerKey), ['version', 'order', 'entries']);
    assert.equal(answerKey.version, 1);
    assert.equal(answerKey.order, 'row-major');
    assert.deepEqual(answerKey.entries, names.map((name, index) => ({
        index: index + 1,
        name,
        artNote: signatureRegistry.entries[name].artNote,
    })));
});

test('Task 8 named, anonymous, and corrected staff review sheets are deterministic', async () => {
    const [named, anonymous, staff] = await Promise.all([
        readPngContract(NAMED_CONTACT_PATH),
        readPngContract(ANONYMOUS_CONTACT_PATH),
        readPngContract(STAFF_COMPARISON_PATH),
    ]);
    assert.deepEqual([named.width, named.height, named.colorType], [1400, 1100, 6]);
    assert.deepEqual([anonymous.width, anonymous.height, anonymous.colorType], [1400, 900, 6]);
    assert.deepEqual([staff.width, staff.height, staff.colorType], [560, 180, 6]);
    assert.equal(sha256(named.bytes), '2367047e45010b383dc77ecb2e0899b0be74bc53a13d41b61ee8aba186df566c');
    assert.equal(sha256(anonymous.bytes), 'b88f8826dec8501ac28cc0c4e21e2d792ce3d4adec736535a41ae824dc2d7e36');
    assert.equal(sha256(staff.bytes), '07eebdc19515cf234290662aca0602be1f33400524dec2527b4729d76e822556');
});

test('Task 8 full verifier includes families and signature overlays in the approved art report', async () => {
    const report = await verifyArtAssets({ scope: 'all' });
    assert.deepEqual(report.verifiedSurfaces, ['characters', 'equipment', 'families', 'signature-overlays']);
    assert.equal(report.counts.equipment, 229);
    assert.equal(report.counts.families, 22);
    assert.equal(report.counts.signatureOverlays, 25);
    assert.equal(report.exports.length, 294, '18 characters + 229 equipment + 22 families + 25 overlays');
    assert.equal(report.ok, true, JSON.stringify(report, null, 2));
});
