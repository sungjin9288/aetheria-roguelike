import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 392: ACTION_KIND_TO_BUTTON `open_shop` 매핑 dead 정리
 *   (cycle 222-391 silent dead config 시리즈 155번째 — cleanup lens 연속).
 *
 * 발견 (1 dead lookup entry):
 * - src/components/controlPanelConfig.ts ACTION_KIND_TO_BUTTON에 `open_shop: 'market'` 매핑.
 * - 유일한 producer는 adventureGuide.getAdventureGuidance — primaryAction.kind 후보:
 *   `claim_quest / open_class / rest / open_inventory / open_move / open_quest_board / explore`.
 * - `open_shop`은 src/, tests/ 어디에서도 producer 0건 — 룩업 절대 hit 안 됨.
 * - `recommendedButton = ACTION_KIND_TO_BUTTON[kind] || null` 패턴이라 unmatched는 fallback.
 *
 * 패턴 (cycle 222-391 silent dead config 시리즈 155번째):
 * - cycle 359: ELEMENT_FILTERS 3 unreachable aliases.
 * - cycle 361: JOB_AFFINITY_NAMES `'그림자주군'` unreachable duplicate key.
 * - cycle 392: ACTION_KIND_TO_BUTTON `open_shop` unreachable lookup entry
 *   (unreachable lens 회귀 — producer 0건이라 절대 lookup 안 됨).
 *
 * 수정 (src/components/controlPanelConfig.ts):
 * - `open_shop: 'market',` 라인 제거.
 *
 * 회귀 가드:
 * - 나머지 6 매핑 보존 (explore/open_move/rest/open_class/open_quest_board/claim_quest).
 * - ControlPanel recommendedButton lookup 동작 그대로 (fallback chain 그대로).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 392: ACTION_KIND_TO_BUTTON에서 open_shop 매핑 0건', async () => {
    const source = await readSrc('src/components/controlPanelConfig.ts');
    assert.ok(!/open_shop:/.test(source),
        'ACTION_KIND_TO_BUTTON에서 open_shop 매핑 제거됨');
});

test('cycle 392: open_shop kind producer 0건 (회귀 가드 — 정합성 검증)', async () => {
    const adventureGuide = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/kind:\s*'open_shop'/.test(adventureGuide),
        'adventureGuide에서 open_shop kind producer 0건 (이전 상태 유지)');
});

test('cycle 392: 나머지 매핑 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/controlPanelConfig.ts');
    const preservedKeys = ['explore', 'open_move', 'rest', 'open_class', 'open_quest_board', 'claim_quest'];
    preservedKeys.forEach((key) => {
        const re = new RegExp(`${key}:`);
        assert.ok(re.test(source), `${key} 매핑 보존`);
    });
});

test('cycle 392: ACTION_KIND_TO_BUTTON 동작 보존 (lookup 검증)', async () => {
    const { ACTION_KIND_TO_BUTTON } = await import('../src/components/controlPanelConfig.js');
    assert.equal(ACTION_KIND_TO_BUTTON.explore, 'explore', 'explore 매핑');
    assert.equal(ACTION_KIND_TO_BUTTON.rest, 'rest', 'rest 매핑');
    assert.equal(ACTION_KIND_TO_BUTTON.open_move, 'move', 'open_move 매핑');
    assert.equal(ACTION_KIND_TO_BUTTON.claim_quest, 'quests', 'claim_quest 매핑');
    assert.equal(ACTION_KIND_TO_BUTTON.open_shop, undefined, 'open_shop 제거됨');
});

test('cycle 391 회귀 가드: DEFAULT_COMBAT_FLAGS private 유지', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(!/export const DEFAULT_COMBAT_FLAGS\b/.test(source),
        'cycle 391 DEFAULT_COMBAT_FLAGS private 유지');
});
