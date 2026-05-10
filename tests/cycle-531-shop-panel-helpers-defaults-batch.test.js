import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 531: ShopPanel 3 helpers defaults batch unreachable
 *   (cycle 222-530 silent dead config 시리즈 274번째 — redundant default annotation
 *   util/component default 청소 메가 시리즈 27번째). component-level 확장 2번째
 *   (cycle 529에 이은).
 *
 * 발견 (3 defaults batch, ShopPanel.tsx 같은 모듈 private helpers):
 * - src/components/ShopPanel.tsx:
 *     · line 38: const formatPercent = (value: any = 0) => ...
 *     · line 46: const getComparisonMeta = (item, equip: any = {}) => {...}
 *     · line 87: const getCompactText = (value: any = '') => value.replaceAll(...)
 * - 호출 사이트 (모듈 내부 private):
 *     · formatPercent:1 callsite (line 60 formatPercent(critDelta)) — value
 *       명시 (Math.round 결과).
 *     · getComparisonMeta:2 callsite (line 295/370 getComparisonMeta(item,
 *       player.equip)) — equip 명시.
 *     · getCompactText:3 callsite (line 90/94/372) — value 명시 (string ||
 *       fallback으로 string 보장).
 *     · 다른 파일 import 0건 (private 모듈 helpers).
 * - 결과: 3 default 모두 도달 불가.
 *
 * Note: signedDelta는 4 callsite 모두 1 arg만 전달이라 suffix default ''가
 * REACHABLE → cycle 531 cleanup 대상 외(부분적 unreachable이라 관성 보존).
 *
 * 패턴 (cycle 222-530 시리즈 274번째):
 * - cycle 502-530: util default 청소 메가 시리즈 28사이클.
 * - cycle 531: components/ private helper 2번째 (cycle 529 softenColor에 이은).
 *
 * 수정 (src/components/ShopPanel.tsx):
 * - formatPercent signature: value: any = 0 → value: any.
 * - getComparisonMeta signature: equip: any = {} → equip: any.
 * - getCompactText signature: value: any = '' → value: any.
 * - body 동작 보존.
 *
 * 회귀 가드:
 * - 6 internal callsite 동작 그대로.
 * - body template literal / replaceAll / getEquipmentProfile 호출 보존.
 * - signedDelta suffix default '' 보존 (cleanup 대상 외).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 531: formatPercent signature에서 value default 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const formatPercent');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/value:\s*any\s*=\s*0/.test(sig),
        'formatPercent value default 0 제거');
});

test('cycle 531: getComparisonMeta signature에서 equip default 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const getComparisonMeta');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/equip:\s*any\s*=\s*\{\}/.test(sig),
        'getComparisonMeta equip default {} 제거');
});

test('cycle 531: getCompactText signature에서 value default 0건', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    const fnIdx = source.indexOf('const getCompactText');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/value:\s*any\s*=\s*''/.test(sig),
        "getCompactText value default '' 제거");
});

test('cycle 531: 정합성 가드 — 6 internal callsite 보존', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/formatPercent\(critDelta\)/.test(source),
        'formatPercent(critDelta) callsite 보존');
    const cmpCalls = (source.match(/getComparisonMeta\(item,\s*player\.equip\)/g) || []).length;
    assert.equal(cmpCalls, 2, `getComparisonMeta 2 callsite 보존: ${cmpCalls}건`);
    const cctCalls = (source.match(/getCompactText\(/g) || []).length;
    assert.ok(cctCalls >= 3, `getCompactText callsite 3건 이상 보존: ${cctCalls}건`);
});

test('cycle 531: signedDelta suffix default 보존 (cleanup 대상 외)', async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/suffix:\s*any\s*=\s*''/.test(source),
        "signedDelta suffix default '' 보존 (4 callsite 모두 1 arg 전달이라 reachable)");
});

test('cycle 531: cycle 502-529 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const av = await readSrc('src/components/PixelCharacterAvatar.tsx');
    assert.ok(!/const softenColor[^=]*alpha:\s*any\s*=\s*0\.24/.test(av),
        'cycle 529 softenColor alpha default 0건');

    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/const pickBestOneHandPair[^=]*weapons:\s*any\[\]\s*=\s*\[\]/.test(eu),
        'cycle 528 pickBestOneHandPair weapons default 0건');
});
