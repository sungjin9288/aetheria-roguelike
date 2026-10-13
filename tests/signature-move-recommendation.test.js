import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getMoveRecommendations } from '../src/utils/adventureGuide.js';
import { MAPS } from '../src/data/maps.js';
import { getMapSignatureDrops } from '../src/utils/mapSignatureHints.js';

/**
 * getMoveRecommendations — 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"):
 * 이동 추천 카드는 "이 경로에 미발견 전설이 N개 있다"를 말하지 않는다(LEGEND ✦N 칩 · undiscoveredSignatureCount 제거).
 * 이전 계약(미발견 수 칩)은 의도적으로 뒤집었다. LV · STATE 칩은 그대로다.
 */

const findExitWithSignatures = () => {
    for (const [mapName, map] of Object.entries(MAPS)) {
        const exits = Array.isArray(map?.exits) ? map.exits : [];
        for (const exitName of exits) {
            if (getMapSignatureDrops(exitName).length > 0) return { sourceName: mapName, sourceMap: map, exitName };
        }
    }
    return null;
};

const baseStats = { maxHp: 100, maxMp: 50 };
const basePlayer = (overrides = {}) => ({
    name: '테스트', job: '전사', level: 5,
    hp: 100, maxHp: 100, mp: 50, maxMp: 50, gold: 0,
    inv: [], equip: {}, relics: [], quests: [],
    stats: { codex: {} },
    ...overrides,
});

test('routes to signature-bearing maps carry no undiscovered count and no LEGEND chip', () => {
    const fixture = findExitWithSignatures();
    assert.ok(fixture, 'expected at least one map with a signature-bearing exit');
    for (const [mapName, map] of Object.entries(MAPS)) {
        const recs = getMoveRecommendations(basePlayer({ loc: mapName }), baseStats, map, MAPS);
        for (const route of recs) {
            assert.equal('undiscoveredSignatureCount' in route, false, `${mapName} → ${route.name}`);
            assert.equal(route.chips.find((c) => c.label === 'LEGEND'), undefined, `${mapName} → ${route.name}`);
        }
    }
});

test('LV and STATE chips remain in the chips array (regression guard)', () => {
    const fixture = findExitWithSignatures();
    assert.ok(fixture);

    const recs = getMoveRecommendations(basePlayer({ loc: fixture.sourceName }), baseStats, fixture.sourceMap, MAPS);
    const target = recs.find((r) => r.name === fixture.exitName);
    const labels = target.chips.map((c) => c.label);
    assert.ok(labels.includes('LV'), 'LV chip preserved');
    assert.ok(labels.includes('STATE'), 'STATE chip preserved');
});

// --- adventureGuide.js source guard (부재 불변식) ---

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('adventureGuide.ts does not count undiscovered signatures (Wave 103)', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/getMapUndiscoveredSignatures|undiscoveredSignatureCount/.test(source));
});
