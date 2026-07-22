import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('map and movement surfaces share one route topology renderer', async () => {
    const [controlPanel, mapNavigator] = await Promise.all([
        readSrc('src/components/ControlPanel.tsx'),
        readSrc('src/components/MapNavigator.tsx'),
    ]);

    assert.match(controlPanel, /<RouteTopology/);
    assert.match(controlPanel, /routes=\{routeTopologyEntries\}/);
    assert.match(mapNavigator, /<RouteTopology/);
    assert.match(mapNavigator, /routes=\{topologyRoutes\}/);
});

test('shared topology renders signature count only when discoveries remain', async () => {
    const source = await readSrc('src/components/RouteTopology.tsx');

    assert.match(source, /\(route\.undiscoveredSignatureCount \|\| 0\) > 0/);
    assert.match(source, /data-testid=\{`move-recommendation-signature-\$\{index\}`\}/);
    assert.match(source, /data-signature-count=\{route\.undiscoveredSignatureCount\}/);
    assert.match(source, /미발견 전설 각인/);
    assert.match(source, /#f6e7a2/);
});

test('route topology entries preserve recommendation metadata from the guide', async () => {
    const [controlPanel, mapNavigator, topology] = await Promise.all([
        readSrc('src/components/ControlPanel.tsx'),
        readSrc('src/components/MapNavigator.tsx'),
        readSrc('src/components/RouteTopology.tsx'),
    ]);

    assert.match(controlPanel, /routeTopologyEntries:[^=]+= moveRecommendations\.map/);
    assert.match(mapNavigator, /topologyRoutes:[^=]+= moveRecommendations\.map/);
    assert.match(controlPanel, /\.\.\.route/);
    assert.match(mapNavigator, /\.\.\.route/);
    assert.match(topology, /undiscoveredSignatureCount\?: number/);
});
