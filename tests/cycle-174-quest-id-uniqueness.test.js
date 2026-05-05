import test from 'node:test';
import assert from 'node:assert/strict';

import { QUESTS, ACHIEVEMENTS } from '../src/data/quests.js';

/**
 * cycle 174: QUESTS / ACHIEVEMENTS id 유일성 회귀 가드.
 *
 * 발견:
 * - QUESTS에 id 99(마왕 토벌 / [심연] 혼돈 속의 생존자) / id 95([심연] 심연의 절반 /
 *   세계 탐험가) 각각 2건씩 중복 사용.
 * - quest lookup은 typically `find(q => q.id === target)` 패턴 — 첫 매치만 반환.
 *   두 번째 중복 quest는 ID로 접근 불가 → 사실상 dead content (자동 reward 청구
 *   불가 등 부수 문제).
 *
 * 수정:
 * 1. 회귀 가드 테스트 (RED 상태 — 중복 발견되면 실패).
 * 2. 중복 id 재할당 — 두 번째 항목을 max+1 신규 id로:
 *    - id 99 (혼돈 속의 생존자) → id 205.
 *    - id 95 (세계 탐험가) → id 206.
 * 3. ACHIEVEMENTS도 동일 가드 — 현재 0 dup.
 */

test('QUESTS: id 유일성 (no duplicates)', () => {
    const idCounts = new Map();
    for (const q of QUESTS) {
        idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
    }
    const dupes = [...idCounts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, [],
        `duplicate quest ids:\n  ${dupes.map(([id, c]) => `id=${id} count=${c}`).join('\n  ')}`);
});

test('ACHIEVEMENTS: id 유일성 (no duplicates)', () => {
    const idCounts = new Map();
    for (const a of ACHIEVEMENTS) {
        idCounts.set(a.id, (idCounts.get(a.id) || 0) + 1);
    }
    const dupes = [...idCounts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, []);
});

test('quest 99 / 95 — 재할당 후 새 id 205 / 206 존재 확인', () => {
    const newIds = QUESTS.filter((q) => q.id === 205 || q.id === 206);
    assert.equal(newIds.length, 2, 'cycle 174 재할당 quest 2건이 존재해야 함');

    const titles = newIds.map((q) => q.title).sort();
    // 재할당 대상: '[심연] 혼돈 속의 생존자' / '세계 탐험가'
    assert.ok(titles.includes('[심연] 혼돈 속의 생존자'));
    assert.ok(titles.includes('세계 탐험가'));
});
