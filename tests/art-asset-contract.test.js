import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { buildArtCatalog } from '../scripts/artCatalog.mjs';
import { verifyArtAssets, writeArtVerificationReport } from '../scripts/verify-art-assets.mjs';

const FIXTURE_CATALOG_SHA256 = 'a'.repeat(64);
const LIVE_CATALOG_SHA256 = 'c0f90046ac95f39d4f46411ab835a8460e48bed6d409937425af585b9c5bd9ef';
const VERIFY_ART_ASSETS_SCRIPT = fileURLToPath(new URL('../scripts/verify-art-assets.mjs', import.meta.url));
const PIXEL_INSPECTOR_SCRIPT = fileURLToPath(new URL('../scripts/inspect_art_pixels.py', import.meta.url));
const EQUIPMENT_GENERATOR_SCRIPT = fileURLToPath(new URL('../scripts/generate_equipment_item_art.py', import.meta.url));
const EQUIPMENT_MANIFEST_PATH = fileURLToPath(new URL('../src/data/equipmentArtManifest.json', import.meta.url));

const crc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const chunkType = Buffer.from(type, 'ascii');
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([chunkType, data])));
    return Buffer.concat([length, chunkType, data, checksum]);
};

const rgbaPng = ({ width = 4, height = 4, opaquePixels = [{ x: 1, y: 1 }] } = {}) => {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y += 1) {
        raw[y * (width * 4 + 1)] = 0;
    }
    for (const { x, y } of opaquePixels) {
        const offset = y * (width * 4 + 1) + 1 + x * 4;
        raw.set([255, 255, 255, 255], offset);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
};

const writeFixturePng = async (publicRoot, runtimePath, options) => {
    const destination = join(publicRoot, runtimePath.replace(/^\//, ''));
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, rgbaPng(options));
};

const createFixture = async ({
    catalog = {
        classes: [{ name: '모험가', tier: 0 }],
        equipment: [{ name: '나무 검', type: 'weapon', tier: 1, elem: '', family: 'weapon-sword' }],
        definedFamilies: ['weapon-sword'],
        usedFamilies: ['weapon-sword'],
        elements: [],
        catalogSha256: FIXTURE_CATALOG_SHA256,
    },
    characterEntries = {
        '모험가': { slug: 'adventurer', runtimePath: '/assets/avatars/canonical/adventurer.png' },
    },
    equipmentEntries = { '나무 검': 'item-wooden-sword' },
    characterArt = { width: 4, height: 4, margin: 1, footBaseline: 2 },
    equipmentArt = { width: 4, height: 4, margin: 1, families: { 'weapon-sword': {} } },
    equipmentStyleVersion = 2,
    pngs = {},
} = {}) => {
    const publicRoot = await mkdtemp(join(tmpdir(), 'aetheria-art-contract-'));
    const characterManifest = {
        catalogSha256: catalog.catalogSha256,
        art: characterArt,
        entries: characterEntries,
    };
    const equipmentManifest = {
        catalogSha256: catalog.catalogSha256,
        styleVersion: equipmentStyleVersion,
        art: equipmentArt,
        entries: equipmentEntries,
    };

    for (const entry of Object.values(characterEntries)) {
        await writeFixturePng(publicRoot, entry.runtimePath, pngs[entry.runtimePath] || { opaquePixels: [{ x: 1, y: 2 }] });
    }
    for (const key of Object.values(equipmentEntries)) {
        const runtimePath = `/assets/equipment-exact/${key}.png`;
        await writeFixturePng(publicRoot, runtimePath, pngs[runtimePath]);
    }

    return {
        publicRoot,
        catalog,
        characterManifest,
        equipmentManifest,
        async dispose() {
            await rm(publicRoot, { recursive: true, force: true });
        },
    };
};

const verifyFixture = async (options) => verifyArtAssets({
    ...options,
    inspectorPath: new URL('../scripts/inspect_art_pixels.py', import.meta.url),
});

const runArtVerifierCli = (args) => spawnSync(process.execPath, ['--import', 'tsx', VERIFY_ART_ASSETS_SCRIPT, ...args], {
    encoding: 'utf8',
});

const createCliScopeFixture = async () => {
    const catalog = await buildArtCatalog();
    const publicRoot = await mkdtemp(join(tmpdir(), 'aetheria-art-cli-'));
    const characterEntries = {};
    for (const [index, entry] of catalog.classes.entries()) {
        const slug = `class-${index + 1}`;
        const runtimePath = `/assets/avatars/canonical/${slug}.png`;
        characterEntries[entry.name] = { slug, runtimePath };
        await writeFixturePng(publicRoot, runtimePath, {
            width: 768,
            height: 768,
            opaquePixels: [{ x: 16, y: 708 }],
        });
    }

    const characterManifest = {
        catalogSha256: catalog.catalogSha256,
        art: { width: 768, height: 768, margin: 16, footBaseline: 708 },
        entries: characterEntries,
    };
    const equipmentManifest = {
        catalogSha256: catalog.catalogSha256,
        styleVersion: 1,
        art: { width: 4, height: 4, margin: 1 },
        entries: {},
    };
    const characterManifestPath = join(publicRoot, 'character-manifest.json');
    const equipmentManifestPath = join(publicRoot, 'equipment-manifest.json');
    await writeFile(characterManifestPath, `${JSON.stringify(characterManifest)}\n`);
    await writeFile(equipmentManifestPath, `${JSON.stringify(equipmentManifest)}\n`);

    return {
        catalog,
        characterManifest,
        equipmentManifest,
        characterManifestPath,
        equipmentManifestPath,
        publicRoot,
        async dispose() {
            await rm(publicRoot, { recursive: true, force: true });
        },
    };
};

test('art catalog records the complete current player-facing inventory', async () => {
    const report = await buildArtCatalog();

    assert.equal(report.classes.length, 18);
    assert.equal(report.equipment.length, 233);
    assert.deepEqual(report.equipmentByType, { weapon: 119, armor: 93, shield: 21 });
    assert.equal(report.definedFamilies.length, 22);
    assert.equal(report.usedFamilies.length, 19);
    assert.deepEqual(report.elements, ['냉기', '대지', '바람', '빛', '어둠', '에테르', '자연', '화염']);
    assert.equal(report.catalogSha256, LIVE_CATALOG_SHA256);
});

test('art catalog uses code-point order for shuffled identity rows', async () => {
    const report = await buildArtCatalog({
        classes: [{ name: 'a', tier: 0 }, { name: 'B', tier: 1 }],
        items: [],
        definedFamilies: [],
    });

    assert.deepEqual(report.classes, [{ name: 'B', tier: 1 }, { name: 'a', tier: 0 }]);
    assert.equal(report.catalogSha256, '1c67cbfa3a5025f1da32bccad93c615ba8e40ea819116a6adb688039add59575');
});

test('art catalog rejects duplicate identities and missing illustration families', async () => {
    await assert.rejects(
        buildArtCatalog({
            classes: [{ name: '모험가', tier: 0 }, { name: '모험가', tier: 1 }],
            items: [],
            definedFamilies: [],
        }),
        /Duplicate class name: 모험가/
    );
    await assert.rejects(
        buildArtCatalog({
            classes: [{ name: '모험가', tier: 0 }],
            items: [
                { name: '나무 검', type: 'weapon', tier: 1 },
                { name: '나무 검', type: 'weapon', tier: 2 },
            ],
            definedFamilies: ['weapon-sword'],
        }),
        /Duplicate equipment name: 나무 검/
    );
    await assert.rejects(
        buildArtCatalog({
            classes: [{ name: '모험가', tier: 0 }],
            items: [{ name: '나무 검', type: 'weapon', tier: 1 }],
            getFamilyKey: () => null,
            definedFamilies: ['weapon-sword'],
        }),
        /Equipment item is missing an illustration family: 나무 검/
    );
});

test('art verifier matches the catalog in both directions and records every export hash', async () => {
    const fixture = await createFixture();
    try {
        const report = await verifyFixture(fixture);

        assert.deepEqual(report.missing, []);
        assert.deepEqual(report.extra, []);
        assert.equal(report.catalogSha256, FIXTURE_CATALOG_SHA256);
        assert.equal(report.scope, 'all');
        assert.deepEqual(report.verifiedSurfaces, ['characters', 'equipment']);
        assert.equal(report.exports.length, 2);
        assert.deepEqual(report.exports.map((entry) => entry.identity), ['character:모험가', 'equipment:나무 검']);
        for (const entry of report.exports) {
            assert.match(entry.sha256, /^[0-9a-f]{64}$/);
        }
        assert.equal(report.exports[0].sha256, createHash('sha256').update(await readFile(join(fixture.publicRoot, 'assets/avatars/canonical/adventurer.png'))).digest('hex'));
        assert.deepEqual(await verifyFixture(fixture), report);
    } finally {
        await fixture.dispose();
    }
});

test('art verifier reports missing and extra class entries', async () => {
    const fixture = await createFixture({ characterEntries: { '다른 직업': { slug: 'other', runtimePath: '/assets/avatars/canonical/other.png' } } });
    try {
        const report = await verifyFixture(fixture);

        assert.ok(report.missing.includes('character:모험가'));
        assert.ok(report.extra.includes('character:다른 직업'));
    } finally {
        await fixture.dispose();
    }
});

test('art verifier reports duplicate runtime paths', async () => {
    const sharedPath = '/assets/avatars/canonical/shared.png';
    const fixture = await createFixture({
        catalog: {
            classes: [{ name: '모험가', tier: 0 }, { name: '전사', tier: 1 }],
            equipment: [{ name: '나무 검', type: 'weapon', tier: 1, elem: '', family: 'weapon-sword' }],
            definedFamilies: ['weapon-sword'],
            usedFamilies: ['weapon-sword'],
            elements: [],
            catalogSha256: FIXTURE_CATALOG_SHA256,
        },
        characterEntries: {
            '모험가': { slug: 'adventurer', runtimePath: sharedPath },
            '전사': { slug: 'warrior', runtimePath: sharedPath },
        },
    });
    try {
        const report = await verifyFixture(fixture);

        assert.deepEqual(report.duplicates, [`runtime-path:${sharedPath}`]);
    } finally {
        await fixture.dispose();
    }
});

test('art verifier reports a duplicate runtime path shared by character and equipment identities', async () => {
    const sharedPath = '/assets/equipment-exact/item-wooden-sword.png';
    const fixture = await createFixture({
        characterEntries: {
            '모험가': { slug: 'adventurer', runtimePath: sharedPath },
        },
    });
    try {
        const report = await verifyFixture(fixture);

        assert.deepEqual(report.duplicates, [`runtime-path:${sharedPath}`]);
        assert.equal(report.ok, false);
    } finally {
        await fixture.dispose();
    }
});

test('art verifier uses code-point order for stable export reports', async () => {
    const fixture = await createFixture({
        catalog: {
            classes: [{ name: 'a', tier: 0 }, { name: 'B', tier: 1 }],
            equipment: [],
            definedFamilies: [],
            usedFamilies: [],
            elements: [],
            catalogSha256: FIXTURE_CATALOG_SHA256,
        },
        characterEntries: {
            a: { slug: 'a', runtimePath: '/assets/avatars/canonical/a.png' },
            B: { slug: 'b', runtimePath: '/assets/avatars/canonical/b.png' },
        },
        equipmentEntries: {},
    });
    try {
        const report = await verifyFixture(fixture);

        assert.deepEqual(report.exports.map((entry) => entry.identity), ['character:B', 'character:a']);
    } finally {
        await fixture.dispose();
    }
});

test('art verifier reports wrong PNG dimensions from IHDR metadata', async () => {
    const equipmentPath = '/assets/equipment-exact/item-wooden-sword.png';
    const fixture = await createFixture({ pngs: { [equipmentPath]: { width: 3, height: 4 } } });
    try {
        const report = await verifyFixture(fixture);

        assert.ok(report.invalidPng.includes(`equipment:나무 검:expected 4x4, got 3x4`));
    } finally {
        await fixture.dispose();
    }
});

test('art verifier reports alpha, declared margin, and character foot-baseline violations', async () => {
    const characterPath = '/assets/avatars/canonical/adventurer.png';
    const equipmentPath = '/assets/equipment-exact/item-wooden-sword.png';
    const opaquePixels = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => ({ x, y }))).flat();
    const fixture = await createFixture({
        pngs: {
            [characterPath]: { opaquePixels: [{ x: 1, y: 1 }] },
            [equipmentPath]: { opaquePixels },
        },
    });
    try {
        const report = await verifyFixture(fixture);

        assert.ok(report.invalidAlpha.includes('equipment:나무 검:requires alpha channel and transparent pixels'));
        assert.ok(report.invalidBounds.includes('equipment:나무 검:opaque bounds exceed margin 1'));
        assert.ok(report.invalidBounds.includes('character:모험가:expected foot baseline 2, got 1'));
    } finally {
        await fixture.dispose();
    }
});

test('art verifier fails closed when the Pillow inspector is unavailable', async () => {
    const fixture = await createFixture();
    try {
        const report = await verifyArtAssets({
            ...fixture,
            inspectorPath: new URL('../scripts/inspect_art_pixels.py', import.meta.url),
            pythonCommand: 'missing-aetheria-art-python',
        });

        assert.equal(report.ok, false);
        assert.ok(report.invalidAlpha.every((value) => value.includes('pixel inspector unavailable')));
        assert.ok(report.invalidBounds.every((value) => value.includes('pixel inspector unavailable')));
    } finally {
        await fixture.dispose();
    }
});

test('only a passing stable report can be written as evidence', async () => {
    const fixture = await createFixture();
    const passingPath = join(fixture.publicRoot, 'evidence', 'passing-report.json');
    const failingPath = join(fixture.publicRoot, 'evidence', 'failing-report.json');
    const partialPath = join(fixture.publicRoot, 'evidence', 'partial-report.json');
    try {
        const report = await verifyFixture(fixture);
        await writeArtVerificationReport(report, passingPath);
        assert.deepEqual(JSON.parse(await readFile(passingPath, 'utf8')), report);

        const partialReport = await verifyFixture({ ...fixture, scope: 'characters' });
        assert.equal(partialReport.ok, true);
        assert.equal(partialReport.scope, 'characters');
        assert.deepEqual(partialReport.verifiedSurfaces, ['characters']);
        assert.equal(Object.getOwnPropertyDescriptor(partialReport, 'scope').writable, false);
        assert.equal(Object.isFrozen(partialReport.verifiedSurfaces), true);
        await assert.rejects(writeArtVerificationReport(partialReport, partialPath), /partial-scope art verification/);
        await assert.rejects(readFile(partialPath), { code: 'ENOENT' });

        await assert.rejects(writeArtVerificationReport({ ...report, ok: false }, failingPath), /Refusing to write failing art verification/);
        await assert.rejects(readFile(failingPath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('art verifier CLI refuses to approve a passing characters-only scope', async () => {
    const fixture = await createCliScopeFixture();
    const reportPath = join(fixture.publicRoot, 'evidence', 'partial-report.json');
    try {
        const fullReport = await verifyFixture({
            catalog: fixture.catalog,
            characterManifest: fixture.characterManifest,
            equipmentManifest: fixture.equipmentManifest,
            publicRoot: fixture.publicRoot,
        });
        assert.equal(fullReport.ok, false);
        assert.ok(fullReport.missing.includes('equipment:나무곤봉'));

        const result = runArtVerifierCli([
            '--scope', 'characters',
            '--character-manifest', fixture.characterManifestPath,
            '--equipment-manifest', fixture.equipmentManifestPath,
            '--public-root', fixture.publicRoot,
            '--write-report', reportPath,
        ]);

        assert.equal(result.status, 1, result.stderr);
        assert.equal(JSON.parse(result.stdout).ok, true);
        assert.match(result.stderr, /Refusing to write partial-scope art verification as approved evidence/);
        await assert.rejects(readFile(reportPath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});

test('art verifier CLI validates one equipment cohort without approving partial evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-art-cohort-'));
    const reportPath = join(directory, 'weapon-core-report.json');
    try {
        const result = runArtVerifierCli(['--cohort', 'weapon-core']);
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.scope, 'equipment');
        assert.equal(report.cohort, 'weapon-core');
        assert.equal(report.counts.equipment, 56);
        assert.equal(report.exports.length, 56);

        const refused = runArtVerifierCli([
            '--cohort', 'weapon-core',
            '--write-report', reportPath,
        ]);
        assert.equal(refused.status, 1);
        assert.match(refused.stderr, /partial-scope art verification/);
        await assert.rejects(readFile(reportPath), { code: 'ENOENT' });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('art verifier rejects weapon-core artwork metadata that is not bound to tracked evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-art-cohort-evidence-'));
    const manifestPath = join(directory, 'equipment-manifest.json');
    try {
        const manifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
        manifest.artwork['강철 롱소드'] = {
            ...manifest.artwork['강철 롱소드'],
            batchId: 'fabricated-batch',
            sourcePath: 'scripts/art_sources/equipment/v2/weapon-core/missing.png',
            sourceSha256: '1'.repeat(64),
            exportSha256: '0'.repeat(64),
        };
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

        const result = runArtVerifierCli([
            '--cohort', 'weapon-core',
            '--equipment-manifest', manifestPath,
        ]);

        assert.equal(result.status, 1, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.ok(report.invalidArtwork.some((entry) => entry.startsWith('equipment:강철 롱소드:')));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('art verifier rejects weapon-core player-facing runtime routing drift', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-art-cohort-route-'));
    const manifestPath = join(directory, 'equipment-manifest.json');
    try {
        const manifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
        manifest.entries['강철 롱소드'] = manifest.entries['여행자 튜닉'];
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

        const result = runArtVerifierCli([
            '--cohort', 'weapon-core',
            '--equipment-manifest', manifestPath,
        ]);

        assert.equal(result.status, 1, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.ok(report.invalidArtwork.some((entry) => entry.startsWith('equipment:강철 롱소드:')));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('art verifier CLI rejects missing and invalid option values without a report file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-art-cli-options-'));
    const reportPath = join(directory, 'must-not-exist.json');
    try {
        const missingScope = runArtVerifierCli(['--write-report', reportPath, '--scope']);
        assert.equal(missingScope.status, 1);
        assert.match(missingScope.stderr, /Missing value for --scope/);
        await assert.rejects(readFile(reportPath), { code: 'ENOENT' });

        const missingWriteReport = runArtVerifierCli(['--write-report']);
        assert.equal(missingWriteReport.status, 1);
        assert.match(missingWriteReport.stderr, /Missing value for --write-report/);

        const invalidScope = runArtVerifierCli(['--write-report', reportPath, '--scope', 'not-a-scope']);
        assert.equal(invalidScope.status, 1);
        assert.match(invalidScope.stderr, /Invalid value for --scope: not-a-scope/);
        await assert.rejects(readFile(reportPath), { code: 'ENOENT' });

        const invalidCohort = runArtVerifierCli(['--cohort', 'not-a-cohort']);
        assert.equal(invalidCohort.status, 1);
        assert.match(invalidCohort.stderr, /Invalid value for --cohort: not-a-cohort/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('equipment manifest writer preserves complete contract metadata and all legacy entry values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-manifest-writer-'));
    const outputPath = join(directory, 'equipmentArtManifest.json');
    try {
        const sourceManifest = JSON.parse(await readFile(EQUIPMENT_MANIFEST_PATH, 'utf8'));
        const script = [
            'import importlib.util',
            'import json',
            'from pathlib import Path',
            `spec = importlib.util.spec_from_file_location('equipment_generator', ${JSON.stringify(EQUIPMENT_GENERATOR_SCRIPT)})`,
            'module = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(module)',
            `entries = json.loads(${JSON.stringify(JSON.stringify(sourceManifest.entries))})`,
            `module.write_manifest(entries, Path(${JSON.stringify(outputPath)}), Path(${JSON.stringify(EQUIPMENT_MANIFEST_PATH)}))`,
        ].join('\n');
        const result = spawnSync('python3', ['-c', script], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        const regenerated = JSON.parse(await readFile(outputPath, 'utf8'));
        assert.equal(regenerated.$comment, sourceManifest.$comment);
        assert.equal(regenerated.version, sourceManifest.version);
        assert.equal(regenerated.catalogSha256, LIVE_CATALOG_SHA256);
        assert.equal(regenerated.styleVersion, sourceManifest.styleVersion);
        assert.deepEqual(regenerated.art, sourceManifest.art);
        assert.equal(Object.keys(regenerated.entries).length, 233);
        assert.deepEqual(regenerated.entries, sourceManifest.entries);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('pixel inspector emits JSON without a Pillow deprecation warning', async () => {
    const fixture = await createFixture();
    try {
        const result = spawnSync('python3', [
            PIXEL_INSPECTOR_SCRIPT,
            '--path', join(fixture.publicRoot, 'assets/avatars/canonical/adventurer.png'),
            '--margin', '1',
            '--foot-baseline', '2',
        ], {
            encoding: 'utf8',
            env: { ...process.env, PYTHONWARNINGS: 'default' },
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, '');
        assert.equal(JSON.parse(result.stdout).footBaseline, 2);
    } finally {
        await fixture.dispose();
    }
});
