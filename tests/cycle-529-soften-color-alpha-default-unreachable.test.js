import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 529: softenColor `alpha = 0.24` default unreachable
 *   (cycle 222-528 silent dead config 시리즈 273번째 — redundant default annotation
 *   util default 청소 메가 시리즈 26번째). component-level 진입 — utils/만이 아닌
 *   components/ private helper로 lens 확장.
 *
 * 발견 (1 default unreachable):
 * - src/components/PixelCharacterAvatar.tsx (line 32):
 *     const softenColor = (hex: any, alpha: any = 0.24) => {
 *         if (!hex || typeof hex !== 'string' || ...) {
 *             return `rgba(255,255,255,${alpha})`;
 *         }
 *         ...
 *     };
 * - 호출 사이트 (1 callsite, 모듈 내부 private):
 *     · PixelCharacterAvatar.tsx:89 — softenColor(
 *         appearance.palette.glow || appearance.palette.accent,
 *         0.28
 *       )
 *     · 다른 파일 import 0건 (private 모듈 helper).
 * - 결과: alpha 항상 0.28로 명시 전달. default 0.24 도달 불가.
 *
 * 패턴 (cycle 222-528 시리즈 273번째):
 * - cycle 502-528: util default 청소 메가 시리즈 25사이클.
 * - cycle 529: components/ private helper 확장 — utils/만이 아닌 components/
 *   파일도 동일 lens 적용.
 *
 * 수정 (src/components/PixelCharacterAvatar.tsx):
 * - signature에서 alpha: any = 0.24 → alpha: any.
 * - body의 hex 가드 (typeof / startsWith / length) + rgba template 보존.
 *
 * 회귀 가드:
 * - 1 internal callsite 동작 그대로.
 * - body hex 형식 검증 + rgba template 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 529: softenColor signature에서 alpha default 0건', async () => {
    const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
    const fnIdx = source.indexOf('const softenColor');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/alpha:\s*any\s*=\s*0\.24/.test(sig),
        'softenColor alpha default 0.24 제거');
    assert.ok(/\balpha\b/.test(sig), 'alpha 파라미터 자체는 보존');
});

test('cycle 529: 정합성 가드 — internal callsite 보존', async () => {
    const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
    assert.ok(/softenColor\(appearance\.palette\.glow \|\| appearance\.palette\.accent,\s*0\.28\)/.test(source),
        'softenColor(palette.glow || palette.accent, 0.28) callsite 보존');
});

test('cycle 529: body hex 가드 + rgba template 보존', async () => {
    const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
    assert.ok(/typeof hex !== 'string' \|\| !hex\.startsWith\('#'\) \|\| hex\.length !== 7/.test(source),
        'hex 형식 검증 가드 보존');
    assert.ok(/return `rgba\(255,255,255,\$\{alpha\}\)`/.test(source),
        'fallback rgba template 보존');
    assert.ok(/return `rgba\(\$\{red\}, \$\{green\}, \$\{blue\}, \$\{alpha\}\)`/.test(source),
        'main rgba template 보존');
});

test('cycle 529: cycle 502-528 회귀 가드 — util default 청소 시리즈 보존', async () => {
    const eu = await readSrc('src/utils/equipmentUtils.ts');
    assert.ok(!/const pickBestOneHandPair[^=]*weapons:\s*any\[\]\s*=\s*\[\]/.test(eu),
        'cycle 528 pickBestOneHandPair weapons default 0건');

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/const dedupeChoices[^=]*choices:\s*any\[\]\s*=\s*\[\]/.test(aiu),
        'cycle 527 dedupeChoices default 0건');
});
