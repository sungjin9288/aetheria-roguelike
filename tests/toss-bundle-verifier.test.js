import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifyTossBundle } from '../scripts/tossBundle.mjs';

test('Toss bundle verifier rejects missing assets, service workers, and an oversized bundle', async (t) => {
    const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'aetheria-toss-bundle-'));
    t.after(() => rm(bundleDir, { recursive: true, force: true }));
    await mkdir(path.join(bundleDir, 'assets'), { recursive: true });
    await writeFile(path.join(bundleDir, 'sw.js'), 'forbidden');
    await writeFile(path.join(bundleDir, 'oversized.bin'), '');
    await truncate(path.join(bundleDir, 'oversized.bin'), 81 * 1024 * 1024);

    const result = await verifyTossBundle({
        bundleDir,
        catalog: { files: ['public/assets/required.png'] },
    });

    assert.equal(result.ok, false);
    assert.ok(result.missing.includes('assets/required.png'));
    assert.ok(result.forbidden.includes('sw.js'));
    assert.ok(result.totalBytes > 80 * 1024 * 1024);
});

test('Toss bundle verifier accepts a complete bundle inside the working budget', async (t) => {
    const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'aetheria-toss-bundle-'));
    t.after(() => rm(bundleDir, { recursive: true, force: true }));
    await mkdir(path.join(bundleDir, 'assets'), { recursive: true });
    await writeFile(path.join(bundleDir, 'assets/required.png'), 'asset');
    await writeFile(path.join(bundleDir, 'index.html'), '<main>Aetheria</main>');

    const result = await verifyTossBundle({
        bundleDir,
        catalog: { files: ['public/assets/required.png'] },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.forbidden, []);
});

test('Toss bundle verifier requires the boot document', async (t) => {
    const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'aetheria-toss-bundle-'));
    t.after(() => rm(bundleDir, { recursive: true, force: true }));
    await mkdir(path.join(bundleDir, 'assets'), { recursive: true });
    await writeFile(path.join(bundleDir, 'assets/required.png'), 'asset');

    const result = await verifyTossBundle({
        bundleDir,
        catalog: { files: ['public/assets/required.png'] },
    });

    assert.equal(result.ok, false);
    assert.ok(result.missing.includes('index.html'));
});

test('Toss bundle verifier rejects static files outside the asset allowlist', async (t) => {
    const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'aetheria-toss-bundle-'));
    t.after(() => rm(bundleDir, { recursive: true, force: true }));
    await mkdir(path.join(bundleDir, 'assets'), { recursive: true });
    await writeFile(path.join(bundleDir, 'index.html'), '<main>Aetheria</main>');
    await writeFile(path.join(bundleDir, 'assets/required.png'), 'asset');
    await writeFile(path.join(bundleDir, 'assets/unallowlisted.png'), 'legacy');
    await writeFile(path.join(bundleDir, 'assets/index.js'), 'generated');
    await writeFile(path.join(bundleDir, 'assets/index.js.map'), 'private source map');

    const result = await verifyTossBundle({
        bundleDir,
        catalog: { files: ['public/assets/required.png'] },
    });

    assert.equal(result.ok, false);
    assert.ok(result.unexpected.includes('assets/unallowlisted.png'));
    assert.ok(!result.unexpected.includes('assets/index.js'));
    assert.ok(result.unexpected.includes('assets/index.js.map'));
});

test('Toss bundle verifier rejects alternate service worker names', async (t) => {
    const bundleDir = await mkdtemp(path.join(os.tmpdir(), 'aetheria-toss-bundle-'));
    t.after(() => rm(bundleDir, { recursive: true, force: true }));
    await mkdir(path.join(bundleDir, 'assets'), { recursive: true });
    await writeFile(path.join(bundleDir, 'index.html'), '<main>Aetheria</main>');
    await writeFile(path.join(bundleDir, 'assets/required.png'), 'asset');
    await writeFile(path.join(bundleDir, 'service-worker.js'), 'forbidden');

    const result = await verifyTossBundle({
        bundleDir,
        catalog: { files: ['public/assets/required.png'] },
    });

    assert.equal(result.ok, false);
    assert.ok(result.forbidden.includes('service-worker.js'));
});

test('production Toss verifier rejects every device-QA/test-harness marker', async (t) => {
    const markers = [
        '__AETHERIA_TEST_API__',
        'aetheria.device-qa.',
        'toss-first-five',
        'VITE_ENABLE_TEST_API=1',
    ];

    for (const [index, marker] of markers.entries()) {
        const bundleDir = await mkdtemp(path.join(os.tmpdir(), `aetheria-toss-qa-${index}-`));
        t.after(() => rm(bundleDir, { recursive: true, force: true }));
        await mkdir(path.join(bundleDir, 'assets'), { recursive: true });
        await writeFile(path.join(bundleDir, 'index.html'), '<main>Aetheria</main>');
        await writeFile(path.join(bundleDir, 'assets/required.png'), 'asset');
        await writeFile(path.join(bundleDir, 'assets/index.js'), marker);

        const result = await verifyTossBundle({
            bundleDir,
            catalog: { files: ['public/assets/required.png'] },
        });

        assert.equal(result.ok, false, marker);
        assert.deepEqual(result.testHarnessMarkers, [marker]);
    }
});
