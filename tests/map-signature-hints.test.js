import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
    getMapSignatureDrops,
    getMapDiscoveredSignatureDrops,
} from '../src/utils/mapSignatureHints.js';

/**
 * Map → 그 맵의 monsters 리스트에서 드롭 가능한 signature 집계.
 * MapNavigator에서 "이 맵에 전설 각인 떨어진다" 배지를 그리기 위한 조회 계약.
 *
 * 계약:
 *   1. getMapSignatureDrops(name) → [{ name, rate }] rate 내림차순, unique by name
 *   2. 같은 signature가 다중 몬스터에서 드롭 가능하면 최고 rate로 집계 (플레이어 관점)
 *   3. 미등록/monsters 없는 맵 → []
 *   4. getMapDiscoveredSignatureDrops는 player.stats.codex에 오른 각인만 반환 (Wave 103 — 미발견 각인의 획득처 · 개수는 숨긴다)
 *   5. MapNavigator는 발견한 각인만 그린다 (미발견 수 배지 없음)
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

const codexWith = (names) => {
    const codex = { weapons: {}, armors: {}, shields: {} };
    for (const name of names) { codex.weapons[name] = true; codex.armors[name] = true; codex.shields[name] = true; }
    return { stats: { codex } };
};

test('getMapDiscoveredSignatureDrops returns only signatures already in the codex', () => {
    const drops = getMapSignatureDrops('마왕성');
    assert.ok(drops.length >= 2);
    assert.deepEqual(getMapDiscoveredSignatureDrops('마왕성', codexWith([])), [], '발견 전에는 아무것도 없다');
    assert.deepEqual(getMapDiscoveredSignatureDrops('마왕성', null), []);

    const partial = getMapDiscoveredSignatureDrops('마왕성', codexWith(['마왕의 대낫']));
    assert.deepEqual(partial.map((d) => d.name), ['마왕의 대낫']);

    const all = getMapDiscoveredSignatureDrops('마왕성', codexWith(drops.map((d) => d.name)));
    assert.deepEqual(all, drops, '모두 발견하면 전체 — 순서 · 확률은 getMapSignatureDrops 그대로');
});

test('MapNavigator renders only discovered signatures (Wave 103 — no undiscovered count)', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    assert.ok(source.includes('getMapDiscoveredSignatureDrops'), 'MapNavigator should use getMapDiscoveredSignatureDrops');
    assert.ok(!source.includes('getMapUndiscoveredSignatures'), '미발견 각인 수 조회로 되돌리지 않는다');
    assert.ok(!source.includes('undiscoveredSignatures'), '미발견 각인 필드 부재');
});
