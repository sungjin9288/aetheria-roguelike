import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 363: AVATAR_ANCHORS shoulder_l / shoulder_r 2 unreachable anchors 정리
 *   (cycle 222-362 silent dead config 시리즈 129번째 — cleanup lens 연속).
 *
 * 발견 (2 dead anchor entries):
 * - anchorPoints.ts AVATAR_ANCHORS 9 anchors 정의: head_top / head_center /
 *   shoulder_l / shoulder_r / torso_center / back_anchor / hand_front / hand_back / feet.
 * - 활성 anchor (placement 함수 호출에서 사용): head_top / head_center / torso_center /
 *   back_anchor / hand_front / hand_back / feet 7종.
 * - shoulder_l / shoulder_r — placement 함수에서 anchor로 사용 0건. AVATAR_ANCHORS
 *   정의만 있고 placement / anchor 매핑 없음.
 * - tests/anchor-points.test.js도 7 anchor (shoulder 제외)만 검증.
 *
 * 패턴 (cycle 222-362 silent dead config 시리즈 129번째):
 * - cycle 362: JOB_STYLE_MAP hairStyle 15회 dead.
 * - cycle 363: AVATAR_ANCHORS shoulder_l / shoulder_r 2 unreachable anchors.
 *
 * 수정 (src/utils/anchorPoints.ts):
 * - AVATAR_ANCHORS에서 shoulder_l / shoulder_r 2 entries 제거.
 *
 * 회귀 가드:
 * - 활성 7 anchor (head_top / head_center / torso_center / back_anchor /
 *   hand_front / hand_back / feet) 보존.
 * - tests/anchor-points.test.js 통과 (7 anchor 검증).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 363: AVATAR_ANCHORS shoulder_l / shoulder_r 0건', async () => {
    const source = await readSrc('src/utils/anchorPoints.ts');
    const fnStart = source.indexOf('AVATAR_ANCHORS');
    const fnEnd = source.indexOf('// ──', fnStart + 1);
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/shoulder_l:/.test(block), 'AVATAR_ANCHORS에서 shoulder_l 0건');
    assert.ok(!/shoulder_r:/.test(block), 'AVATAR_ANCHORS에서 shoulder_r 0건');
});

test('cycle 363: AVATAR_ANCHORS 활성 7 anchor 보존 (회귀 가드)', async () => {
    const { AVATAR_ANCHORS } = await import('../src/utils/anchorPoints.js');
    const expected = ['head_top', 'head_center', 'torso_center', 'back_anchor',
                      'hand_front', 'hand_back', 'feet'];
    for (const name of expected) {
        assert.ok(AVATAR_ANCHORS[name], `${name} anchor 보존`);
        assert.equal(typeof AVATAR_ANCHORS[name].x, 'number', `${name}.x number`);
        assert.equal(typeof AVATAR_ANCHORS[name].y, 'number', `${name}.y number`);
    }
});

test('cycle 363: AVATAR_ANCHORS shoulder anchors 제거됐음', async () => {
    const { AVATAR_ANCHORS } = await import('../src/utils/anchorPoints.js');
    assert.equal(AVATAR_ANCHORS.shoulder_l, undefined, 'shoulder_l undefined');
    assert.equal(AVATAR_ANCHORS.shoulder_r, undefined, 'shoulder_r undefined');
});

test('cycle 362 회귀 가드: JOB_STYLE_MAP hairStyle 0건 보존', async () => {
    const source = await readSrc('src/utils/characterAppearance.ts');
    const fnStart = source.indexOf('const DEFAULT_JOB_STYLE');
    const fnEnd = source.indexOf('const ELEMENT_COLOR_MAP');
    const block = source.slice(fnStart, fnEnd);
    const matches = block.match(/hairStyle:/g) || [];
    assert.equal(matches.length, 0, 'cycle 362 hairStyle 0건 보존');
});
