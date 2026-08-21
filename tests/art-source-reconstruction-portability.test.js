import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const hashFile = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');

const reencodePng = async (source, destination) => {
    await mkdir(dirname(destination), { recursive: true });
    const result = spawnSync('python3', [
        '-c',
        [
            'from pathlib import Path',
            'from PIL import Image',
            'import sys',
            'source, destination = map(Path, sys.argv[1:])',
            'with Image.open(source) as image:',
            '    image.load()',
            "    image.save(destination, format='PNG', optimize=True, compress_level=9)",
        ].join('\n'),
        source,
        destination,
    ], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
};

test('equipment source reconstruction accepts identical RGBA pixels with different PNG encoding', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-equipment-pixels-'));
    const publicRoot = join(directory, 'public');
    const runtimePath = '/assets/equipment-exact/auto/auto-d292a43f2b89.png';
    const canonicalRuntime = resolve(ROOT, `public${runtimePath}`);
    const reencodedRuntime = resolve(publicRoot, runtimePath.slice(1));
    try {
        await reencodePng(canonicalRuntime, reencodedRuntime);
        assert.notEqual(await hashFile(reencodedRuntime), await hashFile(canonicalRuntime));

        const result = spawnSync('python3', [
            'scripts/inspect_equipment_source_sheet.py',
            '--batch', 'scripts/art_sources/equipment/v2/armor/batches/armor-boots-01.json',
            '--source-sheet', 'scripts/art_sources/equipment/v2/armor/armor-boots-01.png',
            '--public-root', publicRoot,
        ], { cwd: ROOT, encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(result.stdout)[0].exportSha256, await hashFile(reencodedRuntime));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('signature source reconstruction accepts identical RGBA pixels with different PNG encoding', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aetheria-signature-pixels-'));
    const publicRoot = join(directory, 'public');
    const itemPath = '/assets/equipment-exact/signature-weapon-dragon-flame.png';
    const overlayPath = '/assets/equipment-wearable-exact/signature-weapon-dragon-flame.png';
    const reencodedItem = resolve(publicRoot, itemPath.slice(1));
    const reencodedOverlay = resolve(publicRoot, overlayPath.slice(1));
    try {
        await Promise.all([
            reencodePng(resolve(ROOT, `public${itemPath}`), reencodedItem),
            reencodePng(resolve(ROOT, `public${overlayPath}`), reencodedOverlay),
        ]);

        const result = spawnSync('python3', [
            'scripts/inspect_signature_source_pair.py',
            '--batch', 'scripts/art_sources/equipment/v2/signature-mythic/batches/signature-mythic-weapon-sword-02.json',
            '--item-source-sheet', 'scripts/art_sources/equipment/v2/signature-mythic/signature-mythic-weapon-sword-02-item.png',
            '--overlay-source-sheet', 'scripts/art_sources/equipment/v2/signature-mythic/signature-mythic-weapon-sword-02-overlay.png',
            '--public-root', publicRoot,
        ], { cwd: ROOT, encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        const [entry] = JSON.parse(result.stdout);
        assert.equal(entry.itemExportSha256, await hashFile(reencodedItem));
        assert.equal(entry.overlayExportSha256, await hashFile(reencodedOverlay));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
