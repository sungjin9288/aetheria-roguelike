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
 * 이전 계약(미발견 수 칩)은 의도적으로 뒤집었다. 2026-10 Wave 136(원장 §150): 그리지 않던 LV · STATE · RETURN 칩도 지웠다 —
 * 경로 카드가 그리는 글(등급 · 배지 · 이유 · 접근 · 귀환)에 각인 이름이 없는지를 본다.
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

test('routes to signature-bearing maps carry no undiscovered count and name no signature', () => {
    const fixture = findExitWithSignatures();
    assert.ok(fixture, 'expected at least one map with a signature-bearing exit');
    const signatureNames = new Set(Object.keys(MAPS).flatMap((name) => getMapSignatureDrops(name).map((drop) => drop.name ?? drop)));
    assert.ok(signatureNames.size > 0, 'expected signature names to check against');
    for (const [mapName, map] of Object.entries(MAPS)) {
        const recs = getMoveRecommendations(basePlayer({ loc: mapName }), baseStats, map, MAPS);
        for (const route of recs) {
            assert.equal('undiscoveredSignatureCount' in route, false, `${mapName} → ${route.name}`);
            assert.equal('chips' in route, false, `${mapName} → ${route.name}`);
            const rendered = [route.levelLabel, route.badge, route.reason, route.routePlan.approach, route.routePlan.returnLabel].join(' ');
            for (const signature of signatureNames) assert.ok(!rendered.includes(signature), `${mapName} → ${route.name}: ${signature}`);
        }
    }
});

// --- adventureGuide.js source guard (부재 불변식) ---

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('adventureGuide.ts does not count undiscovered signatures (Wave 103)', async () => {
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/getMapUndiscoveredSignatures|undiscoveredSignatureCount/.test(source));
});
