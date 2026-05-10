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

// cycle 288: ART_GRID / LIGHT_DIRECTION / OUTLINE_POLICY / SILHOUETTE_RULES 4 dead exports 제거.
//   런타임 consumer 0건이던 art direction 메타정보 — 문서 커멘트로 충분.

// Tone palette를 freeze된 객체로 노출.
// cycle 446: 4 출력 dead 필드 (outline / mid / hi / material) 제거 — production
//   read 0건. equipmentArt.tintPalette는 base / shade / accent / trim 만 read.
//   raw 원본 (artPalette.json)은 무영향. base / accent는 mid / hi의 호환 alias.
const buildRuntimePalette = (raw: any) => Object.freeze({
    shade: raw.shade,
    trim: raw.trim,
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

// cycle 288: DEFAULT_TONE_KEY export 제거 (private const) — getDefaultToneKey 내부 사용만.
const DEFAULT_TONE_KEY: Record<string, any> = Object.freeze({ ...paletteSource.defaultToneKey });

// cycle 288: REFERENCE_ACCENTS dead export 제거 — runtime consumer 0건.

export const getTonePalette = (toneKey: any) => TONE_PALETTES[toneKey] || TONE_PALETTES.steel;

export const getElementToneKey = (elem: any) => ELEMENT_TONE_KEY[elem] || null;

export const getDefaultToneKey = (slot: any) => DEFAULT_TONE_KEY[slot] || 'steel';
