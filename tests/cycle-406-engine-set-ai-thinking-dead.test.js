import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 406: useGameEngine `actions.setAiThinking` dead action method 정리
 *   (cycle 222-405 silent dead config 시리즈 168번째 — function output dead lens 회귀).
 *
 * 발견 (1 dead action method):
 * - src/hooks/useGameEngine.ts line 133:
 *   `setAiThinking: (val: any) => dispatch({ type: AT.SET_AI_THINKING, payload: val }),`
 * - actions.setAiThinking 정의만 있고 src/, tests/ 어디에서도 호출 0건.
 * - AT.SET_AI_THINKING 자체는 reducer에서 처리되지만 dispatch path 없음.
 *   isAiThinking 변경은 explore/event/AI 호출 코드가 직접 dispatch.
 *
 * 패턴 (cycle 222-405 시리즈 168번째):
 * - cycle 401-405: interface dead lens 5사이클 연속 (다양한 prop dead).
 * - cycle 406: function output dead lens 회귀 — actions 객체의 dead method.
 *   cycle 270/278/279/333/336/352/353/354 등 함수 출력 dead 패턴.
 *
 * 수정 (src/hooks/useGameEngine.ts):
 * - actions 객체에서 `setAiThinking: ...` 라인 제거.
 *
 * 회귀 가드:
 * - 다른 setter (setSideTab/setGameState/setShopItems/setActiveTitle/setQuickSlot/
 *   dismissEvent/clearPostCombat/getUid/isAdmin) 동작 그대로.
 * - AT.SET_AI_THINKING reducer handler 보존 (uiActionMap.SET_AI_THINKING).
 * - 실제 isAiThinking 변경은 다른 dispatch path로 동작 그대로.
 * - cycle 401-405 dead prop 정리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 406: useGameEngine actions에서 setAiThinking 0건', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.ok(!/setAiThinking:/.test(source),
        'useGameEngine actions에서 setAiThinking 정의 0건');
});

test('cycle 406: 다른 setter 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    for (const fn of ['setSideTab', 'setGameState', 'setShopItems', 'setActiveTitle',
                       'dismissEvent', 'setQuickSlot', 'clearPostCombat', 'getUid', 'isAdmin']) {
        const re = new RegExp(`\\b${fn}: `);
        assert.ok(re.test(source), `${fn} setter 보존`);
    }
});

test('cycle 406: AT.SET_AI_THINKING reducer handler 보존', async () => {
    const source = await readSrc('src/reducers/handlers/uiHandlers.ts');
    assert.ok(/SET_AI_THINKING:/.test(source),
        'uiHandlers.SET_AI_THINKING handler 보존 (다른 dispatch path 의존)');
});

test('cycle 405 회귀 가드: Codex compact 0건', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const ifaceStart = source.indexOf('interface CodexProps');
    const ifaceEnd = source.indexOf('}', ifaceStart);
    const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
    assert.ok(!/compact\?:/.test(ifaceBlock),
        'cycle 405 Codex compact 0건 보존');
});
