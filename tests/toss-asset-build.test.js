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
        monsters: 254,
        nonEquipment: 77,
    });
    assert.equal(catalog.missing.length, 0);
    assert.equal(catalog.files.length, 701);
    assert.equal(catalog.filesSha256, '61fcc62aff340e42b5f9b194babd342c6d813fac2d0c12fd3b195562b4312121');
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
    // 2026-11: 옛 무장별 초상화(public/assets/avatars/*.png 52장, 52 MiB)는 토스 번들에 싣지 않는다 — 미리보기도 정식 초상화를 쓴다.
    assert.ok(!catalog.files.some((file) => /^public\/assets\/avatars\/[^/]+\.png$/.test(file)));
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
