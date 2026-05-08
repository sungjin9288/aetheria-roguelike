import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 302: ACTION_PRESENTATION dead export 제거 + TYPE_COLORS re-export 제거
 *   (cycle 222-301 silent dead config 시리즈 72번째 — cleanup lens 연속).
 *
 * 발견 (2 dead 표면):
 * - src/components/controlPanelConfig.ts: ACTION_PRESENTATION (line 16) — 8 키
 *   (explore/move/rest/market/class/quests/craft/grave) 각각 tag/tone/detail
 *   메타 정의되어 있지만 src/ 어디에서도 read 0건. ControlPanel은 ACTION_KIND_TO_BUTTON만 사용.
 * - src/components/icons/SkillTypeIcon.tsx:63 `export { TYPE_COLORS }` — 외부 import 0건.
 *   동일 컴포넌트 내부에서만 사용 (line 44).
 *
 * 패턴 (cycle 222-301 silent dead config 시리즈 72번째):
 * - cycle 301: 2 reducer type aliases dead 제거.
 * - cycle 302: components dead surface 2건 제거.
 *
 * 수정:
 * - controlPanelConfig.ts: ACTION_PRESENTATION 제거 (8 키 메타 ~10 lines).
 * - SkillTypeIcon.tsx: `export { TYPE_COLORS }` re-export 제거 (TYPE_COLORS const는 그대로).
 *
 * 회귀 가드:
 * - ACTION_KIND_TO_BUTTON / SkillTypeIcon default export 유지.
 * - SkillTypeIcon 컴포넌트 동작 동일 (내부 TYPE_COLORS 사용).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 302: ACTION_PRESENTATION dead export 제거', async () => {
    const source = await readSrc('src/components/controlPanelConfig.ts');
    assert.ok(!/export const ACTION_PRESENTATION\b/.test(source),
        'ACTION_PRESENTATION export 제거됨');
});

test('cycle 302: ACTION_KIND_TO_BUTTON active export 유지', async () => {
    const source = await readSrc('src/components/controlPanelConfig.ts');
    assert.ok(/export const ACTION_KIND_TO_BUTTON\b/.test(source),
        'ACTION_KIND_TO_BUTTON export 유지');
});

test('cycle 302: TYPE_COLORS re-export 제거', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    assert.ok(!/export\s*\{\s*TYPE_COLORS\s*\}/.test(source),
        'TYPE_COLORS re-export 제거됨');
    assert.ok(/const TYPE_COLORS\b/.test(source),
        'TYPE_COLORS const 정의 유지 (내부 사용)');
});

test('cycle 302: SkillTypeIcon default export 유지', async () => {
    const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
    assert.ok(/export default SkillTypeIcon\b/.test(source),
        'SkillTypeIcon default export 유지');
});

test('cycle 301 회귀 가드: 2 reducer type alias 제거 유지', async () => {
    const atSrc = await readSrc('src/reducers/actionTypes.ts');
    const gsSrc = await readSrc('src/reducers/gameStates.ts');
    assert.ok(!/export type ActionType\b/.test(atSrc), 'cycle 301 ActionType 제거 유지');
    assert.ok(!/export type GameState\b/.test(gsSrc), 'cycle 301 gameStates GameState 제거 유지');
});
