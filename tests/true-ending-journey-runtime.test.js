import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('true ending device journey seeds only the final production combat boundary', async () => {
    const source = await readFile(new URL('../src/hooks/useGameTestApi.ts', import.meta.url), 'utf8');

    assert.match(source, /seedTrueEndingJourneyScenario/);
    assert.match(source, /structuredClone\(INITIAL_STATE\.player\)/);
    assert.match(source, /primalShards:\s*2/);
    assert.match(source, /prestigeRank:\s*3/);
    assert.match(source, /classJourney:/);
    assert.match(source, /readabilityMode:\s*'high'/);
    assert.match(source, /baseName:\s*'마왕'/);
    assert.match(source, /hp:\s*1/);
    assert.match(source, /type:\s*AT\.LOAD_DATA/);
    assert.match(source, /type:\s*AT\.SET_ENEMY/);
    assert.match(source, /type:\s*AT\.SET_GAME_STATE,\s*payload:\s*GS\.COMBAT/);
});

test('true ending journey test API exposes bounded state, boss weakening, save and platform back only', async () => {
    const source = await readFile(new URL('../src/hooks/useGameTestApi.ts', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

    assert.match(source, /getTrueEndingJourneySnapshot/);
    assert.match(source, /armNextExploreSeed/);
    assert.match(source, /weakenTrueBossForJourney/);
    assert.match(source, /enemy\?\.baseName !== '원시의 신'/);
    assert.match(source, /triggerPlatformBack:\s*\(\)\s*=>\s*handlePlatformBack\?\.\(\) \?\? false/);
    assert.match(source, /flushLocalSave:\s*\(\)\s*=>\s*engineRef\.current\.flushLocalSave\(\)/);
    assert.match(app, /useRuntimeGameTestApi\(engineRef, fullStatsRef, handlePlatformBack\)/);
});
