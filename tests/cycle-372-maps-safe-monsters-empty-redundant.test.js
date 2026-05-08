import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 372: maps.ts safe-zone monsters: [] 5회 redundant 정리
 *   (cycle 222-371 silent dead config 시리즈 137번째 — cleanup lens 연속).
 *
 * 발견 (5 redundant default annotations):
 * - src/data/maps.ts에 5 safe-zone 맵 (시작의 마을 / 여행자의 쉼터 /
 *   사막 오아시스 / 북부 요새 / 허공의 섬)이 `monsters: []` 명시.
 * - 모든 monsters 사용 사이트가 `|| []` 또는 `Array.isArray ? : []` fallback
 *   처리 (mapSignatureHints / exploreUtils / Codex / MonsterCodex 4곳).
 * - monsters: [] = undefined와 동일 효과 → redundant.
 *
 * 핵심 비교:
 * - 황금 왕국 (type: 'safe', monsters: ['황금 왕국 수호자', ...]) — 비어있지 않음 → 보존.
 *
 * 패턴 (cycle 222-371 silent dead config 시리즈 137번째):
 * - cycle 371: maps safe-zone eventChance: 0 5 redundant.
 * - cycle 372: maps safe-zone monsters: [] 5 redundant (동일 lens 후속).
 *
 * 수정 (src/data/maps.ts):
 * - 5 safe-zone 맵에서 `monsters: []` 명시 제거.
 *
 * 회귀 가드:
 * - 황금 왕국 monsters: [...] 보존 (비어있지 않은 명시 값).
 * - 6 safe-zone 맵 (type: 'safe') 정의 자체는 모두 보존.
 * - mapSignatureHints / exploreUtils / Codex 동작 그대로 (`|| []` fallback).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 372: maps.ts safe-zone monsters: [] 0건', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/monsters: \[\]/g) || [];
    assert.equal(matches.length, 0,
        `safe-zone monsters: [] 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 372: 6 safe-zone 맵 정의 보존', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/type: 'safe'/g) || [];
    assert.ok(matches.length >= 6, `6+ safe-zone 보존 (${matches.length}건)`);
});

test('cycle 372: 황금 왕국 monsters 배열 보존 (비어있지 않음)', async () => {
    const { MAPS } = await import('../src/data/maps.js');
    assert.equal(MAPS['황금 왕국'].type, 'safe', '황금 왕국 type=safe');
    assert.ok(Array.isArray(MAPS['황금 왕국'].monsters),
        '황금 왕국 monsters 배열 보존');
    assert.ok(MAPS['황금 왕국'].monsters.length > 0,
        '황금 왕국 monsters 비어있지 않음');
});

test('cycle 372: MAPS 동작 보존', async () => {
    const { MAPS } = await import('../src/data/maps.js');
    const safeMaps = ['시작의 마을', '여행자의 쉼터', '사막 오아시스', '북부 요새', '허공의 섬'];
    for (const name of safeMaps) {
        assert.equal(MAPS[name].type, 'safe', `${name} type 'safe' 보존`);
        assert.equal(MAPS[name].monsters, undefined,
            `${name} monsters 0건 (undefined fallback)`);
    }
});

test('cycle 371 회귀 가드: maps safe-zone eventChance: 0 0건 보존', async () => {
    const source = await readSrc('src/data/maps.ts');
    const matches = source.match(/eventChance: 0$/gm) || [];
    assert.equal(matches.length, 0, 'cycle 371 eventChance: 0 0건 보존');
});
