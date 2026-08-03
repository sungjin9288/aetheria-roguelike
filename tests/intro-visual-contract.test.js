import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSource = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('first journey art keeps its portrait source and optimized runtime asset', async () => {
    const sourcePath = path.join(ROOT, 'scripts/art_sources/intro/aetheria-starting-village-master.png');
    const runtimePath = path.join(ROOT, 'public/assets/intro/aetheria-starting-village.webp');
    const source = await readFile(sourcePath);
    const runtime = await stat(runtimePath);

    assert.equal(source.toString('ascii', 1, 4), 'PNG');
    assert.equal(source.readUInt32BE(16), 941);
    assert.equal(source.readUInt32BE(20), 1672);
    assert.ok(runtime.size > 100_000, 'runtime art must retain enough detail for a phone display');
    assert.ok(runtime.size < 300_000, 'runtime art must stay lightweight for first launch');
});

test('intro uses one immersive scene and keeps advanced rules optional', async () => {
    const app = await readSource('src/App.tsx');
    const intro = await readSource('src/components/IntroScreen.tsx');

    assert.match(app, /<MainLayout visualEffect=\{null\} immersive>/);
    assert.match(intro, /aetheria-starting-village\.webp/);
    assert.match(intro, /data-testid="intro-location"/);
    assert.match(intro, /시작의 마을/);
    assert.match(intro, /data-testid="intro-challenge-settings"/);
    assert.doesNotMatch(intro, /<details[^>]*open/);
});

test('performance guard keeps working after the visible terminal is removed', async () => {
    const perfGuard = await readSource('scripts/perf-guard.mjs');

    assert.match(perfGuard, /if \(!await input\.count\(\)\) \{\s*await sendGameCommand\(page, command\);\s*return;/);
    assert.match(perfGuard, /await revealTownMarket\(page\);\s*const marketButton/);
});
