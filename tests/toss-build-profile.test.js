import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import tossConfig from '../apps-in-toss.config.ts';

test('Apps in Toss profile binds the immutable app identity to the curated web bundle', () => {
    assert.equal(tossConfig.appName, 'aetheria');
    assert.equal(tossConfig.webBundleDir, 'dist-toss');
    assert.deepEqual(tossConfig.permissions, []);
    assert.equal(tossConfig.webView?.bounces, false);
    assert.equal(tossConfig.webView?.pullToRefreshEnabled, false);
    assert.equal(tossConfig.webView?.overScrollMode, 'never');
    assert.equal(tossConfig.webView?.allowsBackForwardNavigationGestures, false);
});

test('Apps in Toss artifact build always refreshes and verifies the web bundle first', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(packageJson.scripts['toss:build'], 'npm run build:toss:web && ait build');
});

test('canonical Toss web build refuses every QA activation flag', async () => {
    const source = await readFile(new URL('../scripts/build-toss-web.mjs', import.meta.url), 'utf8');
    assert.match(source, /bundleDirectoryName === 'dist-toss'/);
    assert.match(source, /VITE_ENABLE_TEST_API/);
    assert.match(source, /VITE_DEVICE_QA_SCENARIO/);
    assert.match(source, /AETHERIA_TOSS_ALLOW_TEST_HARNESS/);
    assert.match(source, /Canonical Toss bundle refuses test-harness and device-QA build flags/);
});
