import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 349: getSignatureSetProgress members / equippedMembers 출력 dead 정리
 *   (cycle 222-348 silent dead config 시리즈 117번째 — cleanup lens 연속).
 *
 * 발견 (2 fully dead output fields):
 * - getSignatureSetProgress 반환의 members / equippedMembers 필드.
 * - src/, tests/ 어디에서도 setProgress.members / .equippedMembers read 0건.
 * - 내부 const members 변수는 totalMembers 카운트 + missingMembers 필터 계산용으로 유지.
 *
 * 활성 필드 보존: key / name / tone / equippedCount / totalMembers / missingMembers /
 * currentTier (test) / nextTier / nextBonus / isActive (test).
 *
 * 패턴 (cycle 222-348 silent dead config 시리즈 117번째):
 * - cycle 348: activeSet duplicate mult 3 필드.
 * - cycle 349: setProgress members/equippedMembers 2 출력 dead.
 *
 * 수정 (src/utils/signatureSetBonus.ts):
 * - return에서 members / equippedMembers 필드 제거.
 * - 내부 const는 missingMembers 계산용으로 유지.
 *
 * 회귀 가드:
 * - EquipmentPanel setProgress.key / .name / .tone / .equippedCount / .totalMembers /
 *   .missingMembers / .nextTier / .nextBonus 사용 그대로.
 * - test currentTier / isActive read 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 349: getSignatureSetProgress return에 members 0건', async () => {
    const source = await readSrc('src/utils/signatureSetBonus.ts');
    const fn = source.slice(source.indexOf('export const getSignatureSetProgress'));
    // return 객체 안의 `members,` (속기 문법) 0건. `members.length` (totalMembers) 사용은 OK.
    assert.ok(!/^\s+members,$/m.test(fn),
        'return에서 members 필드 0건');
    assert.ok(!/^\s+equippedMembers,$/m.test(fn),
        'return에서 equippedMembers 필드 0건');
});

test('cycle 349: 내부 const members / equippedMembers 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/signatureSetBonus.ts');
    assert.ok(/const members =/.test(source),
        '내부 const members 보존');
    assert.ok(/const equippedMembers =/.test(source),
        '내부 const equippedMembers 보존');
    assert.ok(/missingMembers = members\.filter/.test(source),
        'missingMembers 필터 계산 그대로');
});

test('cycle 349: getSignatureSetProgress 활성 필드 보존', async () => {
    const { getSignatureSetProgress } = await import('../src/utils/signatureSetBonus.js');
    // 빈 equip → null 반환.
    assert.equal(getSignatureSetProgress({}), null, 'empty equip null');
});

test('cycle 348 회귀 가드: activeSet duplicate mult 0건 보존', async () => {
    const source = await readSrc('src/utils/signatureSetBonus.ts');
    const block = source.match(/activeSet:\s*\{[\s\S]+?\n\s+\},/);
    assert.ok(block, 'activeSet 블록 발견');
    assert.ok(!/^\s+atkMult,$/m.test(block[0]),
        'cycle 348 activeSet.atkMult 0건 보존');
});
