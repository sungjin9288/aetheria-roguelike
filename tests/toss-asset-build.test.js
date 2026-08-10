import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildTossAssetCatalog,
    normalizePublicAssetPath,
    stageTossAssets,
} from '../scripts/tossAssetCatalog.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

test('Toss asset paths are normalized inside public and reject traversal', () => {
    assert.equal(normalizePublicAssetPath('/assets/items/potion.png'), 'public/assets/items/potion.png');
    assert.throws(() => normalizePublicAssetPath('../secret.txt'), /safe public asset path/i);
    assert.throws(() => normalizePublicAssetPath('/assets/../secret.txt'), /safe public asset path/i);
    assert.throws(() => normalizePublicAssetPath('\\assets\\secret.txt'), /safe public asset path/i);
});

test('Toss asset catalog includes every canonical player surface and excludes legacy art', async () => {
    const catalog = await buildTossAssetCatalog({ repoRoot });

    assert.deepEqual(catalog.counts, {
        characters: 18,
        equipment: 229,
        equipmentFamilies: 22,
        signatureOverlays: 25,
        nonEquipment: 77,
        compatibilityAvatars: 52,
    });
    assert.equal(catalog.missing.length, 0);
    assert.equal(catalog.files.length, 522);
    assert.equal(catalog.filesSha256, '3a336d99252762c24cf6b00dc1893b1ad51b54c7a8e3cf142c564fcd24155f20');
    assert.equal(new Set(catalog.files).size, catalog.files.length);
    assert.ok(catalog.files.includes('public/assets/avatars/canonical/adventurer.png'));
    assert.ok(catalog.files.includes('public/assets/equipment-exact/signature-weapon-ragnarok.png'));
    assert.ok(catalog.files.includes('public/assets/equipment-family/items/armor-plate.png'));
    assert.ok(catalog.files.includes('public/assets/equipment-wearable-exact/signature-weapon-ragnarok.png'));
    assert.ok(catalog.files.includes('public/assets/items/potion.png'));
    assert.ok(!catalog.files.includes('public/sw.js'));
    assert.ok(!catalog.files.includes('public/assets/locations/unknown-route.png'));
    assert.ok(!catalog.files.some((file) => file.startsWith('public/assets/regions/')));
    assert.ok(!catalog.files.includes('public/assets/equipment-exact/item-weapon-078.png'));
    assert.ok(!catalog.files.some((file) => file.startsWith('public/assets/avatars/layers/')));
});

test('Toss asset catalog stays below the 80 MiB uncompressed working budget', async () => {
    const catalog = await buildTossAssetCatalog({ repoRoot });

    assert.ok(
        catalog.totalBytes <= 80 * 1024 * 1024,
        `Toss asset catalog is ${catalog.totalBytes} bytes`,
    );
});

test('Toss asset staging copies only allowlisted files', async (t) => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'aetheria-toss-assets-'));
    t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

    const result = await stageTossAssets({ repoRoot, outputRoot: temporaryRoot });

    assert.equal(result.copiedFiles, result.catalog.files.length);
    assert.equal(
        await readFile(path.join(temporaryRoot, 'manifest.webmanifest'), 'utf8'),
        await readFile(path.join(repoRoot, 'public/manifest.webmanifest'), 'utf8'),
    );
    await assert.rejects(readFile(path.join(temporaryRoot, 'sw.js')));
    await assert.rejects(readFile(path.join(temporaryRoot, 'assets/equipment-exact/item-weapon-078.png')));
});
