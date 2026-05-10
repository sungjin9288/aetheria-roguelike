import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 621: signedDelta suffix '' explicit default-elimination
 *   (cycle 222-620 silent dead config 시리즈 359번째 — explicit
 *   default-elimination pattern 12번째 적용).
 *
 * 발견 (1 default reachable → unreachable conversion):
 * - src/components/ShopPanel.tsx (line 41):
 *     const signedDelta = (value: any, suffix: any = '') => ...
 * - 호출 사이트 3개 모두 1 arg 전달 → suffix default '' 활성:
 *     · ShopPanel.tsx:68 — signedDelta(atkDelta)
 *     · ShopPanel.tsx:69 — signedDelta(defDelta)
 *     · ShopPanel.tsx:71 — signedDelta(mpDelta)
 *
 * 패턴 (cycle 222-620 시리즈 359번째):
 * - cycle 542: signedDelta value default 0 제거 (partial). suffix는 reachable
 *   보존이었음.
 * - cycle 621: explicit default-elimination 12번째. cycle 542 partial이
 *   reachable 처리한 suffix를 caller-side conversion으로 unreachable 변환.
 *
 * 수정:
 * - ShopPanel.tsx:68/69/71 — signedDelta(atkDelta, '') / (defDelta, '') /
 *   (mpDelta, '') 명시.
 * - ShopPanel.tsx:41 — suffix default '' 제거.
 *
 * 회귀 가드:
 * - 3 internal callsite 동작 그대로.
 * - body `${value >= 0 ? '+' : ''}${value}${suffix}` 처리 보존.
 * - cycle 542 value default 0 제거 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test("cycle 621: signedDelta signature에서 suffix default '' 0건", async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const signedDelta = \([^)]*suffix:\s*any\s*=\s*''\)/.test(source),
        "signedDelta suffix default '' 제거");
    assert.ok(/const signedDelta = \(value: any, suffix: any\)/.test(source),
        'signedDelta suffix 파라미터 보존 (default 없이)');
});

test("cycle 621: 3 callsite suffix '' 명시 추가", async () => {
    const source = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(/signedDelta\(atkDelta,\s*''\)/.test(source),
        "atkDelta caller suffix '' 명시");
    assert.ok(/signedDelta\(defDelta,\s*''\)/.test(source),
        "defDelta caller suffix '' 명시");
    assert.ok(/signedDelta\(mpDelta,\s*''\)/.test(source),
        "mpDelta caller suffix '' 명시");
});

test('cycle 621: cycle 502-620 회귀 가드 — default 청소 시리즈 보존', async () => {
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok(!/const signedDelta\s*=\s*\(value:\s*any\s*=\s*0/.test(sp),
        'cycle 542 signedDelta value default 0건 보존');
    const ea = await readSrc('src/utils/equipmentArt.ts');
    assert.ok(!/const getToneKey = \(item:[^)]+slot:\s*any\s*=\s*'weapon'\)/.test(ea),
        "cycle 619 getToneKey slot default 'weapon' 0건");
});
