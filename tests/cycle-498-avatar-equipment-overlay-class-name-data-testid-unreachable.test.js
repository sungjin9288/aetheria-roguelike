import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 498: AvatarEquipmentOverlay `className` + `dataTestId` props unreachable batch
 *   (cycle 222-497 silent dead config 시리즈 249번째 — unreachable code path
 *   batch cleanup, cycle 463/465/466/493/495/496 className lens 회귀).
 *
 * 발견 (2 props unreachable):
 * - src/components/icons/AvatarEquipmentOverlay.tsx (line 41):
 *     const AvatarEquipmentOverlay = ({ appearance, className = '',
 *         dataTestId = null, layer }: any) => {...
 *         data-testid={dataTestId}
 *         className={`... ${className}`.trim()}
 *     }
 * - 호출 사이트:
 *     · EquipmentAvatarPreview.tsx:50 — appearance + layer="back".
 *     · EquipmentAvatarPreview.tsx:71 — appearance + layer="front".
 *     · 2 callsite 모두 className / dataTestId 전달 0건. 다른 import 0건.
 * - 결과:
 *     · className 항상 '' → ${className} 보간은 빈 문자열만 추가.
 *     · dataTestId 항상 null → data-testid={null} 으로 attr 의미 없음.
 *
 * 패턴 (cycle 222-497 시리즈 249번째):
 * - cycle 463/465/466/493/495/496: 다양한 컴포넌트 className unreachable.
 * - cycle 498: AvatarEquipmentOverlay className + dataTestId batch — 같은 lens.
 *
 * 수정 (src/components/icons/AvatarEquipmentOverlay.tsx):
 * - destructure에서 className = '' / dataTestId = null 제거.
 * - body className 템플릿 → 정적 'pointer-events-none absolute inset-0 h-full w-full'
 *   (.trim() 제거).
 * - body data-testid={dataTestId} attr 제거.
 *
 * 회귀 가드:
 * - appearance / layer prop 보존.
 * - 본체 overlay 렌더 / weapon/armor/offhand placement 그대로.
 * - 2 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 498: AvatarEquipmentOverlay destructure에서 className / dataTestId 0건', async () => {
    const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
    const fnIdx = source.indexOf('const AvatarEquipmentOverlay =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
    assert.ok(!/\bdataTestId\b/.test(sig), 'destructure에 dataTestId 0건');
});

test('cycle 498: 본체 ${className} 보간 + data-testid={dataTestId} 0건', async () => {
    const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
    assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
    assert.ok(!/data-testid=\{dataTestId\}/.test(source), 'data-testid={dataTestId} 0건');
    assert.ok(!/\bdataTestId\b/.test(source), '본체 dataTestId 참조 0건');
});

test('cycle 498: 정합성 가드 — 2 callsite className / dataTestId 전달 0건', async () => {
    const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
    const matches = source.match(/<AvatarEquipmentOverlay[^/]*\/>/g) || [];
    assert.equal(matches.length, 2, 'AvatarEquipmentOverlay 호출 2건');
    matches.forEach((m, i) => {
        assert.ok(!/\bclassName\b/.test(m), `callsite ${i}에 className 전달 0건`);
        assert.ok(!/\bdataTestId\b/.test(m), `callsite ${i}에 dataTestId 전달 0건`);
    });
});

test('cycle 498: appearance / layer prop 보존 + 본체 overlay 렌더 보존', async () => {
    const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
    const fnIdx = source.indexOf('const AvatarEquipmentOverlay =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/appearance/.test(sig), 'appearance prop 보존');
    assert.ok(/\blayer\b/.test(sig), 'layer prop 보존');
    assert.ok(/getEquipmentOverlayAssetSrc/.test(source), 'overlay asset 호출 보존');
    assert.ok(/shouldRenderArmor/.test(source), 'armor 렌더 분기 보존');
});
