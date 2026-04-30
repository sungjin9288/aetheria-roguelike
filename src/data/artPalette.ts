/**
 * 아트 팔레트 & 작풍 규칙 — 단일 진실 원천.
 *
 * 실제 데이터는 artPalette.json에 있고, 이 파일은 런타임에서 쓰기 좋은 JS 객체로 노출한다.
 * 새 wearable asset을 만들거나 상점 item art를 리드로잉할 때는 JSON을 수정하면
 * 이 런타임 값과 Python generator 둘 다 자동 반영된다.
 *
 * 핵심 원칙 (art direction 리뷰에서 확정):
 *   - base grid는 32×48px 아바타, 1px = 1 unit.
 *   - outline은 pure black 금지. 모든 팔레트는 동일 dark plum outline(#2a1f2e)으로 통일 — 레퍼런스 매칭.
 *   - 내부 라인 금지. 내부 디테일은 1-step darker shade block으로만.
 *   - 광원은 top-left 45° 고정.
 *   - 총 3 shade 이내 (shade / mid / hi). trim은 액센트 1색.
 */

import paletteSource from './artPalette.json' with { type: 'json' };

export const ART_GRID = Object.freeze({
    avatarWidth: 32,
    avatarHeight: 48,
    overlayViewBox: 72,
    pixelsPerUnit: 1,
});

export const LIGHT_DIRECTION = Object.freeze({
    angleDeg: paletteSource.artDirection.lightAngleDeg,
    description: paletteSource.artDirection.lightDirection,
});

export const OUTLINE_POLICY = Object.freeze({
    outerTone: 'palette.outline',
    defaultColor: paletteSource.artDirection.defaultOutline,
    innerLines: false,
    note: '모든 wearable은 shared outline(#2a1f2e) 사용. 순검정 금지. 내부 라인 대신 1-step darker shade block.',
});

export const SILHOUETTE_RULES = Object.freeze({
    maxInternalShades: paletteSource.artDirection.maxInternalShades,
    allowHighlight: true,
    allowGradient: paletteSource.artDirection.allowGradient,
    allowGlowBlur: paletteSource.artDirection.allowGlowBlur,
    allowDropShadow: paletteSource.artDirection.allowDropShadow,
});

// Tone palette를 freeze된 객체로 노출.
// base/accent는 기존 코드 호환용 alias (base = mid, accent = hi).
const buildRuntimePalette = (raw: any) => Object.freeze({
    outline: raw.outline,
    shade: raw.shade,
    mid: raw.mid,
    hi: raw.hi,
    trim: raw.trim,
    material: raw.material,
    // 호환 레이어 — 기존 equipmentArt.js가 참조하는 키
    base: raw.mid,
    accent: raw.hi,
});

export const TONE_PALETTES: Record<string, any> = Object.freeze(
    Object.fromEntries(
        Object.entries(paletteSource.tonePalettes).map(([key, value]: any) => [key, buildRuntimePalette(value)])
    )
);

export const ELEMENT_TONE_KEY: Record<string, any> = Object.freeze({ ...paletteSource.elementToneKey });

export const DEFAULT_TONE_KEY: Record<string, any> = Object.freeze({ ...paletteSource.defaultToneKey });

export const REFERENCE_ACCENTS = Object.freeze({ ...paletteSource.referenceAccents });

export const getTonePalette = (toneKey: any) => TONE_PALETTES[toneKey] || TONE_PALETTES.steel;

export const getElementToneKey = (elem: any) => ELEMENT_TONE_KEY[elem] || null;

export const getDefaultToneKey = (slot: any) => DEFAULT_TONE_KEY[slot] || 'steel';
