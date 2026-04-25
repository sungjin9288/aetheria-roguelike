import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getMoveRecommendations } from '../src/utils/adventureGuide.js';
import { MAPS } from '../src/data/maps.js';
import { getMapUndiscoveredSignatures } from '../src/utils/mapSignatureHints.js';

/**
 * getMoveRecommendations — 맵 이동 권고에 signature 드롭 신호 통합.
 *
 * MapNavigator / ControlPanel의 추천 경로 카드는 LV / STATE 칩만 보여줘서
 * "이 경로에 미발견 전설이 있다"는 collection-driven 신호가 빠져있다.
 * pity hint(cycle 23)가 "지금 보스로 가라"는 시점 신호라면,
 * 이 칩은 "어느 보스로?"라는 공간 신호 — 두 신호의 동선 파리티.
 *
 * 계약:
 *   1. 각 route에 undiscoveredSignatureCount 필드 (number) 노출
 *   2. count > 0인 route는 chips에 { label: 'LEGEND', value: '✦N' } 포함
 *   3. count === 0이면 LEGEND 칩 미포함 (silence over noise)
 *   4. 기존 chips(LV, STATE) 순서/내용 보존 (회귀 방지)
 */

// 실제 맵 데이터에서 signature를 가진 맵을 찾는다 — fixture 의존도 최소화
const findExitWithSignatures = () => {
    for (const [mapName, map] of Object.entries(MAPS)) {
        const exits = Array.isArray(map?.exits) ? map.exits : [];
        for (const exitName of exits) {
            const undiscovered = getMapUndiscoveredSignatures(exitName, { stats: { codex: {} } });
            if (undiscovered.length > 0) {
                return { sourceName: mapName, sourceMap: map, exitName, expectedCount: undiscovered.length };
            }
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

test('getMoveRecommendations exposes undiscoveredSignatureCount per route', () => {
    const fixture = findExitWithSignatures();
    assert.ok(fixture, 'expected at least one map with a signature-bearing exit');

    const recs = getMoveRecommendations(basePlayer({ loc: fixture.sourceName }), baseStats, fixture.sourceMap, MAPS);
    const target = recs.find((r) => r.name === fixture.exitName);
    assert.ok(target, `expected route to ${fixture.exitName}`);
    assert.equal(typeof target.undiscoveredSignatureCount, 'number', 'undiscoveredSignatureCount field should be numeric');
    assert.equal(target.undiscoveredSignatureCount, fixture.expectedCount);
});

test('routes with undiscovered signatures get a ✦N chip', () => {
    const fixture = findExitWithSignatures();
    assert.ok(fixture);

    const recs = getMoveRecommendations(basePlayer({ loc: fixture.sourceName }), baseStats, fixture.sourceMap, MAPS);
    const target = recs.find((r) => r.name === fixture.exitName);
    const legendChip = target.chips.find((c) => c.label === 'LEGEND');
    assert.ok(legendChip, `route to ${fixture.exitName} should carry a LEGEND chip`);
    assert.match(legendChip.value, /✦\d+/, `chip value should be "✦N", got: ${legendChip.value}`);
    assert.equal(legendChip.value, `✦${fixture.expectedCount}`);
});

test('routes with 0 undiscovered signatures DO NOT get a LEGEND chip', async () => {
    // 모든 signature를 codex에 등록해서 모든 맵의 undiscovered count = 0
    const fakeCodex = { weapons: {}, armors: {}, shields: {} };
    const { SIGNATURE_ITEM_REGISTRY } = await import('../src/data/signatureItems.js');
    for (const [name, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        if (meta.spriteKey?.startsWith('signature-weapon-')) fakeCodex.weapons[name] = { discovered: true };
        else if (meta.spriteKey?.startsWith('signature-shield-')) fakeCodex.shields[name] = { discovered: true };
        else if (meta.spriteKey?.startsWith('signature-armor-')) fakeCodex.armors[name] = { discovered: true };
    }

    const fixture = findExitWithSignatures();
    if (!fixture) return; // 데이터셋에 signature가 없는 환경에서는 skip
    const player = basePlayer({ loc: fixture.sourceName, stats: { codex: fakeCodex } });
    const recs = getMoveRecommendations(player, baseStats, fixture.sourceMap, MAPS);
    const target = recs.find((r) => r.name === fixture.exitName);
    assert.equal(target.undiscoveredSignatureCount, 0);
    const legendChip = target.chips.find((c) => c.label === 'LEGEND');
    assert.equal(legendChip, undefined, 'LEGEND chip should be absent when count is 0');
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

// --- adventureGuide.js source guard ---

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('adventureGuide.js imports getMapUndiscoveredSignatures', async () => {
    const source = await readSrc('src/utils/adventureGuide.js');
    assert.ok(
        /import\s*\{[^}]*getMapUndiscoveredSignatures[^}]*\}\s*from\s*['"][^'"]*mapSignatureHints/.test(source),
        'adventureGuide should import getMapUndiscoveredSignatures from mapSignatureHints'
    );
});
