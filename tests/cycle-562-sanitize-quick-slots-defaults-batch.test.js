import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 562: sanitizeQuickSlots `slots = []` + `inventory = []` defaults batch
 *   unreachable (cycle 222-561 silent dead config 시리즈 302번째 — redundant
 *   default annotation 청소 메가 시리즈 55번째). reducers/handlers/.
 *
 * 발견 (2 defaults batch):
 * - src/reducers/handlers/helpers.ts (line 9):
 *     export const sanitizeQuickSlots = (slots: any = [], inventory: any = []) => {
 *         const ids = new Set((inventory || []).map(...).filter(Boolean));
 *         const normalized = Array.from(..., (_, i) => (Array.isArray(slots) ? slots[i] : undefined) ?? null);
 *         ...
 *     };
 * - 호출 사이트:
 *     · bootstrapHandlers.ts:20 — sanitizeQuickSlots(action.payload.quickSlots,
 *       loadedPlayer.inv) — 2 args 명시.
 *     · uiHandlers.ts:53 — sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv)
 *       — 2 args 명시.
 *     · 다른 caller 0건 (test caller 0건).
 * - 결과: 두 default 모두 도달 불가. body의 (inventory || []) +
 *   Array.isArray(slots) defensive guards가 undefined/null 안전 처리.
 *
 * 패턴 (cycle 222-561 시리즈 302번째):
 * - cycle 502-561: default 청소 메가 시리즈 60사이클.
 * - cycle 562: reducers/ 추가 cleanup — cycle 538에 이은 reducers/ 2번째.
 *
 * 수정 (src/reducers/handlers/helpers.ts):
 * - signature에서 slots: any = [] → slots: any.
 * - signature에서 inventory: any = [] → inventory: any.
 * - body의 (inventory || []) / Array.isArray(slots) defensive guards 보존.
 *
 * 회귀 가드:
 * - 2 production callsite 동작 그대로.
 * - body defensive guards + null 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 562: sanitizeQuickSlots signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/reducers/handlers/helpers.ts');
    const fnIdx = source.indexOf('export const sanitizeQuickSlots');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/slots:\s*any\s*=\s*\[\]/.test(sig),
        'sanitizeQuickSlots slots default [] 제거');
    assert.ok(!/inventory:\s*any\s*=\s*\[\]/.test(sig),
        'sanitizeQuickSlots inventory default [] 제거');
});

test('cycle 562: 정합성 가드 — 2 production callsite 보존', async () => {
    const bs = await readSrc('src/reducers/handlers/bootstrapHandlers.ts');
    assert.ok(/sanitizeQuickSlots\(action\.payload\.quickSlots,\s*loadedPlayer\.inv\)/.test(bs),
        'bootstrapHandlers callsite 보존');

    const ui = await readSrc('src/reducers/handlers/uiHandlers.ts');
    assert.ok(/sanitizeQuickSlots\(state\.quickSlots,\s*mergedPlayer\.inv\)/.test(ui),
        'uiHandlers callsite 보존');
});

test('cycle 562: body defensive guards 보존', async () => {
    const source = await readSrc('src/reducers/handlers/helpers.ts');
    assert.ok(/\(inventory \|\| \[\]\)\.map/.test(source),
        '(inventory || []) defensive guard 보존');
    assert.ok(/Array\.isArray\(slots\) \? slots\[i\] : undefined/.test(source),
        'Array.isArray(slots) defensive guard 보존');
});

test('cycle 562: cycle 502-561 회귀 가드 — default 청소 시리즈 보존', async () => {
    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const buildEventPackage[^=]*context:\s*any\s*=\s*\{\}/.test(aiu),
        'cycle 561 buildEventPackage context default 0건');

    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getEnemyTacticalProfile[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
        'cycle 559 getEnemyTacticalProfile stats default 0건');
});
