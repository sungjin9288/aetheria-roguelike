import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 499: PixelCharacterAvatar 5 redundant defaults cleanup
 *   (cycle 222-498 silent dead config 시리즈 250번째 — redundant default annotation
 *   cleanup lens, cycle 451-452/467 패턴 회귀).
 *
 * 발견 (5 redundant defaults):
 * - src/components/PixelCharacterAvatar.tsx (line 43-53):
 *     · player = null      ← 2/2 callsite pass player
 *     · size = 'sm'        ← 2/2 callsite pass size ("sm"/"lg")
 *     · className = ''     ← 2/2 callsite pass "shrink-0"
 *     · dataTestId = null  ← 2/2 callsite pass dataTestId
 *     · label = '캐릭터 외형' ← 2/2 callsite pass label
 * - 호출 사이트 분석 (2 callsite):
 *     · StatusBar.tsx — player/size="sm"/interactive/onClick/dataTestId/
 *       label/className="shrink-0".
 *     · EquipmentPanel.tsx — player/appearance/size="lg"/dataTestId/label/
 *       className="shrink-0"/showEnhanceBadge=false.
 *     · 5 props 모두 명시 전달이라 default 도달 불가.
 *     · 활성 default 보존: providedAppearance / onClick / interactive /
 *       showEnhanceBadge (호출자 부분 누락 path).
 *
 * 패턴 (cycle 222-498 시리즈 250번째):
 * - cycle 451-452/467: 콜러가 항상 명시 전달하는 기본값 annotation 정리.
 * - cycle 499: PixelCharacterAvatar 5 redundant defaults — 동일 lens.
 *
 * 수정 (src/components/PixelCharacterAvatar.tsx):
 * - destructure에서 player = null / size = 'sm' / className = '' /
 *   dataTestId = null / label = '캐릭터 외형' default 제거.
 * - 활성 default (providedAppearance / onClick / interactive / showEnhanceBadge) 보존.
 *
 * 회귀 가드:
 * - 본체 동작 그대로.
 * - 2 callsite 명시 전달 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 499: PixelCharacterAvatar 5 redundant default 제거', async () => {
    const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
    const fnIdx = source.indexOf('const PixelCharacterAvatar = ({');
    const fnEnd = source.indexOf('}: any', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/player\s*=\s*null/.test(block), 'player default 제거');
    assert.ok(!/size\s*=\s*'sm'/.test(block), 'size default 제거');
    assert.ok(!/className\s*=\s*''/.test(block), 'className default 제거');
    assert.ok(!/dataTestId\s*=\s*null/.test(block), 'dataTestId default 제거');
    assert.ok(!/label\s*=\s*'캐릭터 외형'/.test(block), 'label default 제거');
});

test('cycle 499: 활성 default 보존 — providedAppearance / onClick / interactive / showEnhanceBadge', async () => {
    const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
    const fnIdx = source.indexOf('const PixelCharacterAvatar = ({');
    const fnEnd = source.indexOf('}: any', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(/providedAppearance\s*=\s*null/.test(block), 'providedAppearance default 보존');
    assert.ok(/onClick\s*=\s*null/.test(block), 'onClick default 보존');
    assert.ok(/interactive\s*=\s*false/.test(block), 'interactive default 보존');
    assert.ok(/showEnhanceBadge\s*=\s*true/.test(block), 'showEnhanceBadge default 보존');
});

test('cycle 499: 정합성 가드 — 2 callsite 명시 전달', async () => {
    const sb = await readSrc('src/components/StatusBar.tsx');
    const sbCall = sb.match(/<PixelCharacterAvatar[\s\S]*?\/>/);
    assert.ok(sbCall, 'StatusBar PixelCharacterAvatar 호출 발견');
    const reqs = ['player', 'size', 'dataTestId', 'label', 'className'];
    for (const f of reqs) {
        assert.ok(new RegExp(`\\b${f}=`).test(sbCall[0]), `StatusBar callsite에 ${f} 명시 전달`);
    }

    const ep = await readSrc('src/components/EquipmentPanel.tsx');
    const epCall = ep.match(/<PixelCharacterAvatar[\s\S]*?\/>/);
    assert.ok(epCall, 'EquipmentPanel PixelCharacterAvatar 호출 발견');
    for (const f of reqs) {
        assert.ok(new RegExp(`\\b${f}=`).test(epCall[0]), `EquipmentPanel callsite에 ${f} 명시 전달`);
    }
});

test('cycle 499: 본체 핵심 로직 보존', async () => {
    const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
    assert.ok(/SIZE_MAP\[size\]/.test(source), 'SIZE_MAP[size] lookup 보존');
    assert.ok(/FRAME_TONE_CLASS/.test(source), 'FRAME_TONE_CLASS 보존');
    assert.ok(/showEnhanceBadge/.test(source), 'showEnhanceBadge 본체 사용 보존');
    assert.ok(/spriteCandidates/.test(source), 'spriteCandidates 보존');
});
