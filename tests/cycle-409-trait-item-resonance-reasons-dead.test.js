import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 409: getTraitItemResonance.reasons 출력 dead 필드 정리
 *   (cycle 222-408 silent dead config 시리즈 171번째 — function output dead lens 회귀).
 *
 * 발견 (1 dead 출력 필드):
 * - src/utils/runProfile.ts getTraitItemResonance return:
 *   `{ score, label, reasons, summary }` (line 295-300).
 *   초기 empty branch: `{ score: 0, label: null, reasons: [], summary: null }` (line 231).
 * - 외부 read 분석:
 *   · score: runProfile.ts:309-310 (getTraitFeaturedItems 정렬), 테스트 활성.
 *   · label: 테스트 활성 (`focusResonance.label === '성향 공명'`).
 *   · summary: runProfile.ts:323 (getTraitLootHint).
 *   · **reasons: src/, tests/ 어디에서도 read 0건**.
 * - 함수 내부에서 `reasons` 배열은 summary 계산 (`reasons.slice(0, 2).join(' · ')`)에
 *   필요 — 로컬 변수로 유지 + 출력에서만 strip.
 *
 * 패턴 (cycle 222-408 시리즈 171번째):
 * - cycle 270/278/279/333/336/352/353/354/389: 함수 출력 dead 필드 정리.
 * - cycle 409: getTraitItemResonance.reasons 동일 lens 회귀.
 *
 * 수정 (src/utils/runProfile.ts):
 * - 초기 empty branch return에서 `reasons: []` 제거.
 * - 메인 return 객체에서 `reasons` 필드 제거.
 * - 함수 내부 `reasons.push(...)` + `summary: reasons.slice(0, 2)...` 로컬 사용 보존.
 *
 * 회귀 가드:
 * - score / label / summary 필드 보존.
 * - getTraitFeaturedItems 정렬 / getTraitLootHint summary 동작 그대로.
 * - 테스트 (`focusResonance.label === '성향 공명'`) 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 409: getTraitItemResonance return에서 reasons 0건', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnStart = source.indexOf('export const getTraitItemResonance');
    const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    // return 객체 내부에 reasons 필드 0건 (단, reasons.push / reasons.slice 내부 사용은 보존).
    assert.ok(!/return \{[^}]*reasons,/.test(fnBlock),
        '메인 return 객체에서 reasons 필드 0건');
    assert.ok(!/return \{[^}]*reasons: \[\]/.test(fnBlock),
        '초기 empty branch return에서 reasons: [] 0건');
});

test('cycle 409: 활성 출력 필드 보존 (score/label/summary)', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnStart = source.indexOf('export const getTraitItemResonance');
    const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(/score,/.test(fnBlock), 'score 필드 보존');
    assert.ok(/label,/.test(fnBlock), 'label 필드 보존');
    assert.ok(/summary:/.test(fnBlock), 'summary 필드 보존');
});

test('cycle 409: 함수 내부 reasons 사용 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/runProfile.ts');
    const fnStart = source.indexOf('export const getTraitItemResonance');
    const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
    const fnBlock = source.slice(fnStart, fnEnd);
    assert.ok(/const reasons:/.test(fnBlock), 'reasons 로컬 변수 유지');
    assert.ok(/reasons\.push/.test(fnBlock), 'reasons.push 보존');
    assert.ok(/reasons\.slice\(0, 2\)/.test(fnBlock), 'summary 계산 보존');
});

test('cycle 409: getTraitItemResonance 동작 보존 (테스트 시나리오)', async () => {
    const { getTraitItemResonance, getTraitProfile } = await import('../src/utils/runProfile.js');
    const player = {
        job: '마법사', hp: 80, maxHp: 140, mp: 70, maxMp: 80,
        equip: {
            weapon: { type: 'weapon', name: '나무지팡이', val: 12, hands: 2, mp: 10, jobs: ['마법사'] },
            offhand: { type: 'shield', subtype: 'focus', name: '견습 주문서', val: 2, mp: 10 },
        },
        relics: [{ effect: 'mp_mult' }, { effect: 'skill_mult' }],
    };
    const trait = getTraitProfile(player, { maxHp: 140, isMagic: true });
    const focusResonance = getTraitItemResonance(
        { type: 'shield', subtype: 'focus', name: '룬 마도서', val: 4, mp: 20, jobs: ['마법사'] },
        trait,
        player,
    );
    assert.ok(typeof focusResonance.score === 'number', 'score 반환');
    assert.equal(focusResonance.label, '성향 공명', 'label 반환 보존');
    assert.equal(focusResonance.reasons, undefined, 'reasons 미반환');
});

test('cycle 408 회귀 가드: HEADGEAR / BODY PLACEMENTS private 보존', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    assert.ok(!/export const HEADGEAR_PLACEMENTS\b/.test(source),
        'cycle 408 HEADGEAR_PLACEMENTS private 유지');
    assert.ok(!/export const BODY_PLACEMENTS\b/.test(source),
        'cycle 408 BODY_PLACEMENTS private 유지');
});
