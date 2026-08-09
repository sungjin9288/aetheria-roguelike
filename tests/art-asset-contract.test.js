import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import { buildArtCatalog } from '../scripts/artCatalog.mjs';
import { verifyArtAssets, writeArtVerificationReport } from '../scripts/verify-art-assets.mjs';

const FIXTURE_CATALOG_SHA256 = 'a'.repeat(64);

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

test('art catalog records the complete current player-facing inventory', async () => {
    const report = await buildArtCatalog();

    assert.equal(report.classes.length, 18);
    assert.equal(report.equipment.length, 233);
    assert.deepEqual(report.equipmentByType, { weapon: 119, armor: 93, shield: 21 });
    assert.equal(report.definedFamilies.length, 22);
    assert.equal(report.usedFamilies.length, 18);
    assert.deepEqual(report.elements, ['냉기', '대지', '바람', '빛', '어둠', '에테르', '자연', '화염']);
    assert.match(report.catalogSha256, /^[0-9a-f]{64}$/);
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
    try {
        const report = await verifyFixture(fixture);
        await writeArtVerificationReport(report, passingPath);
        assert.deepEqual(JSON.parse(await readFile(passingPath, 'utf8')), report);
        await assert.rejects(writeArtVerificationReport({ ...report, ok: false }, failingPath), /Refusing to write failing art verification/);
        await assert.rejects(readFile(failingPath), { code: 'ENOENT' });
    } finally {
        await fixture.dispose();
    }
});
