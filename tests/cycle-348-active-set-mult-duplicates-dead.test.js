import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 348: computeSignatureSetBonus activeSet의 3 mult duplicate 필드 dead 정리
 *   (cycle 222-347 silent dead config 시리즈 116번째 — cleanup lens 연속).
 *
 * 발견 (3 dead duplicate fields):
 * - computeSignatureSetBonus 반환의 activeSet 내부에 atkMult / defMult / hpMult 3 필드.
 * - 부모 return에 동일 필드 이미 노출됨 (statsCalculator는 result.atkMult / .defMult /
 *   .hpMult 부모를 read).
 * - activeSet.atkMult / .defMult / .hpMult 직접 read 0건.
 *
 * 활성 activeSet 필드: key / name / tone / count / tier / desc.
 *
 * 패턴 (cycle 222-347 silent dead config 시리즈 116번째):
 * - cycle 347: scoreQuest score → _sortKey internal.
 * - cycle 348: activeSet duplicate mult 3 필드 cleanup.
 *
 * 수정 (src/utils/signatureSetBonus.ts):
 * - computeSignatureSetBonus activeSet에서 atkMult/defMult/hpMult 3 필드 제거.
 *
 * 회귀 가드:
 * - 부모 return의 atkMult/defMult/hpMult 보존.
 * - activeSet.key/name/tone/count/tier/desc 보존.
 * - StatsPanel activeSet.desc / .name / .tone, EquipmentPanel 동일 필드 read 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 348: activeSet 내부 duplicate mult 3 필드 0건', async () => {
    const source = await readSrc('src/utils/signatureSetBonus.ts');
    // activeSet 객체 블록만 검사.
    const activeSetBlock = source.match(/activeSet:\s*\{[\s\S]+?\n\s+\},/);
    assert.ok(activeSetBlock, 'activeSet 객체 블록 발견');
    assert.ok(!/^\s+atkMult,$/m.test(activeSetBlock[0]),
        'activeSet.atkMult 0건');
    assert.ok(!/^\s+defMult,$/m.test(activeSetBlock[0]),
        'activeSet.defMult 0건');
    assert.ok(!/^\s+hpMult,$/m.test(activeSetBlock[0]),
        'activeSet.hpMult 0건');
});

test('cycle 348: 부모 return의 atkMult/defMult/hpMult 보존', async () => {
    const source = await readSrc('src/utils/signatureSetBonus.ts');
    // 부모 return의 atkMult, defMult, hpMult 보존.
    const parentReturnMatch = source.match(/return \{\s*\n\s+atkMult,\s*\n\s+defMult,\s*\n\s+hpMult,\s*\n\s+activeSet:/);
    assert.ok(parentReturnMatch, '부모 return의 atkMult/defMult/hpMult 보존');
});

test('cycle 348: computeSignatureSetBonus 동작 보존', async () => {
    const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.js');
    const equip = {};
    const result = computeSignatureSetBonus(equip);
    assert.equal(result.atkMult, 1, 'atkMult 보존');
    assert.equal(result.defMult, 1, 'defMult 보존');
    assert.equal(result.hpMult, 1, 'hpMult 보존');
    assert.equal(result.activeSet, null, 'empty activeSet null');
});

test('cycle 347 회귀 가드: scoreQuest score → _sortKey 보존', async () => {
    const source = await readSrc('src/utils/questOperations.ts');
    assert.ok(/_sortKey: score/.test(source),
        'cycle 347 _sortKey 보존');
});
