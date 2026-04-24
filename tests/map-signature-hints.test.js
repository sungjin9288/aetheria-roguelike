import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
    getMapSignatureDrops,
    getMapUndiscoveredSignatures,
} from '../src/utils/mapSignatureHints.js';

/**
 * Map → 그 맵의 monsters 리스트에서 드롭 가능한 signature 집계.
 * MapNavigator에서 "이 맵에 전설 각인 떨어진다" 배지를 그리기 위한 조회 계약.
 *
 * 계약:
 *   1. getMapSignatureDrops(name) → [{ name, rate }] rate 내림차순, unique by name
 *   2. 같은 signature가 다중 몬스터에서 드롭 가능하면 최고 rate로 집계 (플레이어 관점)
 *   3. 미등록/monsters 없는 맵 → []
 *   4. getMapUndiscoveredSignatures는 player.stats.codex를 가지고 미발견만 반환
 *   5. MapNavigator에 wiring (import + 배지 + detail 패널)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('getMapSignatureDrops collects signature drops from 마왕성 map monsters', () => {
    // 마왕성의 monsters 중 마왕이 성검 에테르니아, 마왕의 대낫 드롭
    const drops = getMapSignatureDrops('마왕성');
    assert.ok(Array.isArray(drops));
    const names = drops.map((d) => d.name);
    assert.ok(names.includes('마왕의 대낫'), '마왕의 대낫 should be in 마왕성 drops');
    assert.ok(names.includes('성검 에테르니아'), '성검 에테르니아 should be in 마왕성 drops');
});

test('getMapSignatureDrops returns drops sorted by rate descending', () => {
    const drops = getMapSignatureDrops('마왕성');
    for (let i = 1; i < drops.length; i += 1) {
        assert.ok(drops[i - 1].rate >= drops[i].rate);
    }
});

test('getMapSignatureDrops deduplicates by signature name (keeps max rate)', () => {
    // 성검 에테르니아는 마왕(0.10) + 마왕의 사도(0.02) 양쪽에서 드롭 가능.
    // 같은 맵에 두 몬스터가 있으면 0.10으로 한 번만 집계되어야 한다.
    const drops = getMapSignatureDrops('마왕성');
    const ethernia = drops.filter((d) => d.name === '성검 에테르니아');
    assert.equal(ethernia.length, 1, 'should appear exactly once even if multiple monsters drop it');
});

test('getMapSignatureDrops returns [] for unknown/safe maps', () => {
    assert.deepEqual(getMapSignatureDrops('시작의 마을'), []); // 타운 — monsters 없음
    assert.deepEqual(getMapSignatureDrops('없는 맵'), []);
    assert.deepEqual(getMapSignatureDrops(null), []);
    assert.deepEqual(getMapSignatureDrops(undefined), []);
    assert.deepEqual(getMapSignatureDrops(''), []);
});

test('getMapUndiscoveredSignatures filters by player codex state', () => {
    const drops = getMapSignatureDrops('마왕성');
    assert.ok(drops.length >= 2);

    // 코덱스 비어 있음 → 전부 미발견
    const allMissing = getMapUndiscoveredSignatures('마왕성', null);
    assert.equal(allMissing.length, drops.length);

    // 마왕의 대낫만 발견 → 나머지만 반환
    const partial = getMapUndiscoveredSignatures('마왕성', {
        stats: {
            codex: {
                weapons: { '마왕의 대낫': { discovered: true } },
                armors: {},
                shields: {},
            },
        },
    });
    assert.ok(partial.length < drops.length);
    assert.ok(!partial.find((d) => d.name === '마왕의 대낫'));
});

test('getMapUndiscoveredSignatures returns [] when player has discovered all', () => {
    const drops = getMapSignatureDrops('마왕성');
    const codex = { weapons: {}, armors: {}, shields: {} };
    for (const d of drops) codex.weapons[d.name] = { discovered: true };
    const missing = getMapUndiscoveredSignatures('마왕성', { stats: { codex } });
    assert.equal(missing.length, 0);
});

test('getMapUndiscoveredSignatures handles null player', () => {
    const missing = getMapUndiscoveredSignatures('마왕성', null);
    assert.ok(missing.length > 0, 'null player means nothing discovered yet');
});

test('MapNavigator imports helpers and renders signature hint UI', async () => {
    const source = await readSrc('src/components/MapNavigator.jsx');
    assert.ok(
        /import\s*\{[^}]*getMapSignatureDrops[^}]*\}\s*from\s*['"]\.\.\/utils\/mapSignatureHints/.test(source)
            || source.includes('getMapSignatureDrops'),
        'MapNavigator should import getMapSignatureDrops'
    );
    assert.ok(
        source.includes('getMapUndiscoveredSignatures'),
        'MapNavigator should use getMapUndiscoveredSignatures'
    );
    // Node 뱃지 또는 detail 패널에 "전설" 레이블 노출
    assert.ok(
        /전설/.test(source),
        'MapNavigator should include 전설 label for signature UI'
    );
    // 골드 팔레트 재사용
    assert.ok(
        /f6e7a2/.test(source),
        'signature UI should use gold palette (#f6e7a2)'
    );
});
