import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 521: hashText `value = ''` + mixHex `ratio = 0.5` defaults batch
 *   unreachable (cycle 222-520 silent dead config 시리즈 265번째 — redundant default
 *   annotation util-level cleanup, util default 청소 메가 시리즈 18번째).
 *
 * 발견 (2 defaults batch):
 * - src/utils/equipmentArt.ts (line 12, 30):
 *     const hashText = (value: any = '') => (...)
 *     const mixHex = (left: any, right: any, ratio: any = 0.5) => {...}
 * - 호출 사이트 (모듈 내부 private):
 *     · hashText:1 callsite — equipmentArt.ts:41 hashText(item?.name || '')
 *       — caller가 `|| ''` fallback으로 string 보장.
 *     · mixHex:4 callsite — equipmentArt.ts:44-47 mixHex(palette.X, '#ffffff'/
 *       '#000000', ratio * 0.2/0.35/0.08/0.16) — 4 calls 모두 3 args 명시.
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: hashText value 항상 string 보장 + mixHex ratio 항상 명시 전달.
 *   두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-520 시리즈 265번째):
 * - cycle 502-519: util default 청소 메가 시리즈 17사이클.
 * - cycle 521: equipmentArt.ts 내부 helper batch — 동일 lens, 같은 모듈에서
 *   cycle 513/517에 이은 3번째 cleanup.
 *
 * 수정 (src/utils/equipmentArt.ts):
 * - hashText signature: value: any = '' → value: any.
 * - mixHex signature: ratio: any = 0.5 → ratio: any.
 * - body의 String(value) coercion / hexToRgb / rgbToHex 호출 보존.
 *
 * 회귀 가드:
 * - 5 internal callsite 동작 그대로.
 * - body 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 521: hashText signature에서 value default '' 0건", async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fnIdx = source.indexOf('const hashText');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/value:\s*any\s*=\s*''/.test(sig), "hashText value default '' 제거");
    assert.ok(/\bvalue\b/.test(sig), 'value 파라미터 자체는 보존');
});

test('cycle 521: mixHex signature에서 ratio default 0.5 0건', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    const fnIdx = source.indexOf('const mixHex');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/ratio:\s*any\s*=\s*0\.5/.test(sig), 'mixHex ratio default 0.5 제거');
    assert.ok(/\bratio\b/.test(sig), 'ratio 파라미터 자체는 보존');
});

test('cycle 521: 정합성 가드 — 5 internal callsite 보존', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/hashText\(item\?\.name \|\| ''\)/.test(source),
        'hashText callsite (item?.name || \'\') 보존');
    const mixCount = (source.match(/mixHex\(/g) || []).length;
    assert.equal(mixCount, 4, `mixHex 사용처 4건 보존: ${mixCount}건`);
    assert.ok(/const mixHex = \(left/.test(source), 'mixHex 정의 보존');
});

test('cycle 521: body 동작 보존', async () => {
    const source = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(/\[\.\.\.String\(value\)\]\.reduce/.test(source),
        'hashText String(value) coercion 보존');
    assert.ok(/const l = hexToRgb\(left\)/.test(source),
        'mixHex hexToRgb(left) 호출 보존');
});

test('cycle 521: cycle 502-519 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const ag = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(!/getMapLevel[^=]*playerLevel:\s*any\s*=\s*1/.test(ag),
        'cycle 519 getMapLevel playerLevel default 0건');

    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/getWeaponEquipScore[^=]*slot:\s*any\s*=\s*'main'/.test(eu),
        'cycle 518 getWeaponEquipScore slot default 0건');
});
