import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

const script = fileURLToPath(new URL('../scripts/normalize-monster-source.mjs', import.meta.url));
const inspector = fileURLToPath(new URL('../scripts/inspect_art_pixels.py', import.meta.url));

test('accepted synthetic source retains nearest-neighbor placement and exclusive deterministic output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-source-export-'));
    try {
        const source = join(directory, 'source.png');
        const first = join(directory, 'first.png');
        const second = join(directory, 'second.png');
        const bytes = png([0, 0, 255, 0]);
        await writeFile(source, bytes);
        for (const destination of [first, second]) {
            const result = spawnSync(process.execPath, [script, source, destination], { encoding: 'utf8', timeout: 30000 });
            assert.equal(result.error, undefined);
            assert.equal(result.status, 0, result.stderr);
        }
        const output = await readFile(first);
        assert.equal(output.readUInt32BE(16), 160);
        assert.equal(output.readUInt32BE(20), 160);
        assert.deepEqual(await readFile(second), output);
        const inspection = spawnSync('python3', [inspector, '--path', first, '--margin', '8'], { encoding: 'utf8', timeout: 30000 });
        assert.equal(inspection.error, undefined);
        assert.equal(inspection.status, 0, inspection.stderr);
        const pixels = JSON.parse(inspection.stdout);
        assert.equal(pixels.hasTransparentPixels, true);
        assert.equal(pixels.boundsWithinMargin, true);
        // The lower-left pixel of a2x2 source occupies72x72 pixels at offset8.
        assert.deepEqual(pixels.opaqueBounds, { left: 8, top: 80, right: 79, bottom: 151 });
        const duplicate = spawnSync(process.execPath, [script, source, first], { encoding: 'utf8', timeout: 30000 });
        assert.equal(duplicate.error, undefined);
        assert.notEqual(duplicate.status, 0);
        assert.match(duplicate.stderr, /EEXIST/);
        assert.deepEqual(await readFile(first), output);
        assert.deepEqual(await readFile(source), bytes);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('normal export refuses an opaque source before creating a destination', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-source-rejected-'));
    try {
        const source = join(directory, 'opaque.png');
        const destination = join(directory, 'export.png');
        const bytes = png([255, 255, 255, 255]);
        await writeFile(source, bytes);
        const result = spawnSync(process.execPath, [script, source, destination], { encoding: 'utf8', timeout: 30000 });
        assert.equal(result.error, undefined);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /no transparent background/i);
        assert.deepEqual(await readdir(directory), ['opaque.png']);
        assert.deepEqual(await readFile(source), bytes);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

function chunk(type, data) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
}

// Synthetic codec fixtures, not game artwork. Each row has two RGBA pixels.
function png(alphas) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(2, 0);
    header.writeUInt32BE(2, 4);
    header[8] = 8;
    header[9] = 6;
    const rows = Buffer.alloc(18);
    for (let i = 0; i < 4; i++) rows[Math.floor(i / 2) * 9 + 1 + (i % 2) * 4 + 3] = alphas[i];
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
        chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

for (const fixture of [
    { name: 'visible sprite with transparent background', alpha: [0, 0, 255, 0], ok: true },
    { name: 'fully opaque source even with an alpha channel', alpha: [255, 255, 255, 255], error: /no transparent background/i },
    { name: 'empty transparent image', alpha: [0, 0, 0, 0], error: /no visible pixels/i },
]) {
    test(`monster source preflight checks ${fixture.name} without writing an export`, async () => {
        const directory = await mkdtemp(join(tmpdir(), 'aetheria-source-preflight-'));
        try {
            const source = join(directory, 'source.png');
            const bytes = png(fixture.alpha);
            await writeFile(source, bytes);
            const result = spawnSync(process.execPath, [script, '--check', source], { encoding: 'utf8', timeout: 30000 });
            assert.equal(result.error, undefined);
            if (fixture.ok) {
                assert.equal(result.status, 0, result.stderr);
                assert.deepEqual(JSON.parse(result.stdout), { width: 2, height: 2, transparentPixels: 3, visiblePixels: 1 });
            } else {
                assert.notEqual(result.status, 0);
                assert.match(result.stderr, fixture.error);
            }
            assert.deepEqual(await readFile(source), bytes);
            assert.deepEqual(await readdir(directory), ['source.png']);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
}
