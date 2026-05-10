import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 444: Dashboard handleMenuAction 'reset' 분기 unreachable 정리
 *   (cycle 222-443 silent dead config 시리즈 202번째 — unreachable code path lens
 *   회귀, cycle 357/425 패턴).
 *
 * 발견 (2 dead conditional branches + 1 redundant guard):
 * - src/components/Dashboard.tsx handleMenuAction (line 118+):
 *     `if (actionId !== 'reset') { setConfirmMenuReset(false); }`
 *     `if (actionId === 'reset') { setConfirmMenuReset(true); }`
 * - 호출 사이트 분석:
 *     · handleMenuAction은 단일 caller `onClick={() => handleMenuAction(action.id)}` (line 383).
 *     · `action.id`는 TOWN_MENU_ACTIONS map에서 옴: rest / class / quest / craft.
 *     · 'reset' actionId는 어떤 caller도 전달 0건.
 * - 결과:
 *     · `actionId !== 'reset'` 항상 true → 가드 redundant (unconditional 처리).
 *     · `actionId === 'reset'` 항상 false → 분기 unreachable.
 * - confirmMenuReset state는 별도 caller (`onClick={() => setConfirmMenuReset(true)}`)
 *   에서 직접 set. handleMenuAction 경로 불필요.
 *
 * 패턴 (cycle 222-443 시리즈 202번째):
 * - cycle 357: pickFallbackEvent explicit 분기 unreachable.
 * - cycle 425: pickFallbackEvent paired completion.
 * - cycle 444: handleMenuAction 'reset' 분기 unreachable — 동일 lens 회귀.
 *
 * 수정 (src/components/Dashboard.tsx):
 * - `if (actionId !== 'reset')` 가드 제거 → 무조건 `setConfirmMenuReset(false)`.
 * - `if (actionId === 'reset')` 분기 제거 (unreachable).
 *
 * 회귀 가드:
 * - rest / class / quest / craft 분기 동작 그대로.
 * - confirmMenuReset state 자체는 보존 (별도 caller가 set).
 * - handleMenuAction 호출 시 무조건 confirmMenuReset이 false로 reset (기존 동작 유지).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 444: handleMenuAction에서 'reset' 분기 0건", async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const fnIdx = source.indexOf('const handleMenuAction');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/actionId === 'reset'/.test(block),
        "handleMenuAction에서 actionId === 'reset' 분기 0건");
    assert.ok(!/actionId !== 'reset'/.test(block),
        "handleMenuAction에서 actionId !== 'reset' 가드 0건");
});

test('cycle 444: 활성 분기 (rest / class / quest / craft) 보존', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const fnIdx = source.indexOf('const handleMenuAction');
    const fnEnd = source.indexOf('};', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/actionId === 'rest'/.test(block), "rest 분기 보존");
    assert.ok(/actionId === 'class'/.test(block), "class 분기 보존");
    assert.ok(/actionId === 'quest'/.test(block), "quest 분기 보존");
    assert.ok(/actionId === 'craft'/.test(block), "craft 분기 보존");
});

test('cycle 444: 정합성 가드 — TOWN_MENU_ACTIONS는 reset id 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const constIdx = source.indexOf('const TOWN_MENU_ACTIONS');
    const constEnd = source.indexOf('];', constIdx);
    const block = source.slice(constIdx, constEnd);
    assert.ok(!/id: 'reset'/.test(block), 'TOWN_MENU_ACTIONS에 reset id 0건');
});

test('cycle 444: confirmMenuReset state 자체는 보존 (별도 caller가 set)', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    assert.ok(/confirmMenuReset, setConfirmMenuReset/.test(source),
        'confirmMenuReset state 정의 보존');
    // 직접 caller (별도 button onClick)는 보존
    const directCaller = source.match(/onClick={\(\) => setConfirmMenuReset\(true\)}/);
    assert.ok(directCaller, '별도 caller 보존');
});

test('cycle 443 회귀 가드: getRunBuildProfile primary.score 0건', async () => {
    const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
    const player = {
        equip: { weapon: null, offhand: null, armor: null },
        relics: [], hp: 100, maxHp: 100, job: '모험가',
    };
    const result = getRunBuildProfile(player, { maxHp: 100 });
    assert.equal(result.primary.score, undefined, 'cycle 443 primary.score 0건 보존');
});
