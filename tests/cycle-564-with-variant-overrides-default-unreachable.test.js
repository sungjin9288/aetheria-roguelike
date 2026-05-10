import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 564: withVariant `overrides = {}` default unreachable
 *   (cycle 222-563 silent dead config 시리즈 304번째 — redundant default annotation
 *   청소 메가 시리즈 57번째). avatarEquipmentPreview.ts.
 *
 * 발견 (1 default unreachable):
 * - src/utils/avatarEquipmentPreview.ts (line 101):
 *     const withVariant = (baseStage: any, variant: any,
 *         overrides: any = {}) => {...};
 * - 호출 사이트 (10 internal callsite, 모듈 내부 private):
 *     · withVariant({...baseStage}, variant, {...overrides}) — 모두 3 args
 *       명시 (object literal로 overrides 전달).
 *     · 다른 caller 0건 (private 모듈 helper).
 * - 결과: overrides 항상 명시 전달. default {} 도달 불가.
 *
 * 패턴 (cycle 222-563 시리즈 304번째):
 * - cycle 502-563: default 청소 메가 시리즈 62사이클.
 * - cycle 564: avatarEquipmentPreview.ts 추가 cleanup — cycle 514에 이은
 *   동일 모듈 cleanup.
 *
 * 수정 (src/utils/avatarEquipmentPreview.ts):
 * - signature에서 overrides: any = {} → overrides: any.
 * - body의 overrides.scale ?? / overrides.translateX ?? 등 nullish 처리 보존.
 *
 * 회귀 가드:
 * - 10 internal callsite 동작 그대로.
 * - body variant ternary + overrides nullish coalescing 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 564: withVariant signature에서 overrides default 0건', async () => {
    const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
    const fnIdx = source.indexOf('const withVariant');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/overrides:\s*any\s*=\s*\{\}/.test(sig),
        'withVariant overrides default {} 제거');
});

test('cycle 564: 정합성 가드 — 10 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
    const calls = (source.match(/\}, variant, \{/g) || []).length;
    assert.equal(calls, 10, `withVariant 3-arg callsite 10건 보존: ${calls}건`);
});

test('cycle 564: body variant ternary + nullish coalescing 보존', async () => {
    const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
    assert.ok(/if \(variant === 'card'\)/.test(source),
        "variant === 'card' 분기 보존");
    assert.ok(/overrides\.scale \?\? Math\.round\(baseStage\.scale \* 118\) \/ 100/.test(source),
        'overrides.scale ?? nullish coalescing 보존');
});

test('cycle 564: cycle 502-563 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    assert.ok(!/useLegendaryDropDetector[^=]*dispatch:\s*any\s*=\s*null/.test(ld),
        'cycle 563 useLegendaryDropDetector dispatch default 0건');

    const helpers = await readSrc('src/reducers/handlers/helpers.ts');
    assert.ok(!/sanitizeQuickSlots[^=]*slots:\s*any\s*=\s*\[\]/.test(helpers),
        'cycle 562 sanitizeQuickSlots slots default 0건');
});
