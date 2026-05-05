import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 173: cycle 165 baseline 가드의 boss/bossMonsters 누락 검출 보강.
 *
 * 발견:
 * - cycle 165 baseline 테스트는 maps.ts의 monsters[] 배열만 스캔했음.
 * - boss: 'name' 단일 참조와 bossMonsters: [...] 배열은 검사 누락.
 * - 결과: '봄의 여왕' (정원 dungeon bossMonsters) / '서리 군주' (서리 폭풍 유적
 *   bossMonsters)가 MONSTERS에 profile 미등록인데 baseline가 통과해 잠복.
 * - 해당 보스 처치 시 generic stat-blank — 약점/저항/phase2 모두 미적용 회귀.
 *
 * 수정:
 * 1. cycle 165 collectMapMonsterRefs를 확장 — monsters[] + bossMonsters[] +
 *    boss: 'X' 모두 수집.
 * 2. MONSTERS에 '봄의 여왕' / '서리 군주' 추가 (isBoss + phase2 포함):
 *    - 봄의 여왕: weakness 화염, resistance 자연, phase2 statusEffect 'poison'.
 *    - 서리 군주: weakness 화염, resistance 냉기, phase2 statusEffect 'freeze'.
 */

test("cycle 173: '봄의 여왕' MONSTERS 등록 + isBoss + phase2 (정원 보스)", () => {
    const m = MONSTERS['봄의 여왕'];
    assert.ok(m, '봄의 여왕 profile 누락');
    assert.equal(m.isBoss, true);
    assert.equal(m.weakness, '화염');
    assert.equal(m.resistance, '자연');
    assert.ok(m.phase2, 'phase2 누락');
    assert.equal(m.phase2.statusEffect, 'poison');
});

test("cycle 173: '서리 군주' MONSTERS 등록 + isBoss + phase2 (서리 보스)", () => {
    const m = MONSTERS['서리 군주'];
    assert.ok(m);
    assert.equal(m.isBoss, true);
    assert.equal(m.weakness, '화염');
    assert.equal(m.resistance, '냉기');
    assert.ok(m.phase2);
    assert.equal(m.phase2.statusEffect, 'freeze');
});

test("cycle 173: cycle 165 baseline 테스트가 boss/bossMonsters도 검사함 (회귀 가드)", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const baselineSrc = await readFile(path.join(ROOT, 'tests/cycle-165-map-monster-profile-baseline.test.js'), 'utf8');
    assert.match(baselineSrc, /bossMonsters/, 'cycle 165 가드가 bossMonsters 검사');
    assert.match(baselineSrc, /boss:/, 'cycle 165 가드가 boss: 단일 참조 검사');
});
