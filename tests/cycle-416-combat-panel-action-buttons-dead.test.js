import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 416: CombatPanel ACTION_BUTTONS `tag` / `detail` 출력 dead 정리
 *   (cycle 222-415 silent dead config 시리즈 177번째 — function output dead lens 회귀).
 *
 * 발견 (4 entries × 2 fields = 8 dead 출력 필드):
 * - src/components/tabs/CombatPanel.tsx ACTION_BUTTONS (line 20-57): 4 entry —
 *   attack / skill / swap / escape. 각 entry에 `tag` (Burst/Core/Loadout/Exit) +
 *   `detail` (한국어 설명) 필드.
 * - 렌더 사이트 (line 358-378): `action.icon`, `action.key`, `action.className`,
 *   `action.mobileLabel`, `action.label` 5 필드만 read.
 * - `action.tag` / `action.detail` src/, tests/ 어디에서도 read 0건.
 * - compactMetaEntries (line 140) 등의 별개 `entry.detail`은 다른 배열로 무관.
 *
 * 패턴 (cycle 222-415 시리즈 177번째):
 * - cycle 270/278/279/333/336/352/353/354/389/393/409/415: 함수/객체 출력 dead.
 * - cycle 393: PREMIUM_SHOP entry category/repeatable 10 dead 일괄.
 * - cycle 416: ACTION_BUTTONS entry tag/detail 8 dead 일괄 — data-config-dead 회귀.
 *
 * 수정 (src/components/tabs/CombatPanel.tsx):
 * - ACTION_BUTTONS 4 entry에서 `tag` + `detail` 8 라인 제거.
 *
 * 회귀 가드:
 * - icon / key / className / mobileLabel / label 5 활성 필드 보존.
 * - 4 entry (attack/skill/swap/escape) 자체 보존.
 * - compactMetaEntries entry.detail (별개 배열) 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 416: ACTION_BUTTONS에서 tag / detail 0건', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const blockStart = source.indexOf('const ACTION_BUTTONS');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/\btag:/.test(block),
        'ACTION_BUTTONS에서 tag 필드 0건');
    assert.ok(!/\bdetail:/.test(block),
        'ACTION_BUTTONS에서 detail 필드 0건');
});

test('cycle 416: ACTION_BUTTONS 활성 필드 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const blockStart = source.indexOf('const ACTION_BUTTONS');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const field of ['key', 'label', 'mobileLabel', 'icon', 'className']) {
        const re = new RegExp(`\\b${field}:`);
        assert.ok(re.test(block), `${field} 필드 보존`);
    }
});

test('cycle 416: ACTION_BUTTONS 4 entry 보존 (attack/skill/swap/escape)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const blockStart = source.indexOf('const ACTION_BUTTONS');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const key of ['attack', 'skill', 'swap', 'escape']) {
        const re = new RegExp(`key:\\s*'${key}'`);
        assert.ok(re.test(block), `${key} entry 보존`);
    }
});

test('cycle 416: compactMetaEntries entry.detail 동작 보존 (별개 배열)', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const blockStart = source.indexOf('compactMetaEntries =');
    const blockEnd = source.indexOf('].filter', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(/detail:/.test(block),
        'compactMetaEntries entry.detail 보존');
});

test('cycle 415 회귀 가드: getWeeklySpecial isWeeklySpecial 0건', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    const fnStart = source.indexOf('export const getWeeklySpecial');
    const fnBlock = source.slice(fnStart);
    assert.ok(!/isWeeklySpecial:\s*true/.test(fnBlock),
        'cycle 415 isWeeklySpecial 0건 보존');
});
