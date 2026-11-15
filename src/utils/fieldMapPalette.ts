/**
 * 지역 지도 `<canvas>`의 색 — 디자인 토큰(`--aether-*-rgb`)을 읽어 캔버스가 쓰는 색 문자열로 바꾼다. 캔버스는 CSS 클래스를
 * 쓰지 못하므로 토큰 값을 직접 읽는다(색을 새로 정하지 않는다 — 토큰이 바뀌면 지도도 바뀐다).
 */

export type FieldMapPalette = Record<'bg' | 'wall' | 'path' | 'grass' | 'deep' | 'chest' | 'exit' | 'entrance' | 'hero' | 'ink', string>;

const TOKEN_OF: Record<keyof FieldMapPalette, string> = {
    bg: '--aether-bg-rgb',
    wall: '--aether-s1-rgb',
    path: '--aether-s4-rgb',
    grass: '--aether-sig-nature-rgb',
    deep: '--aether-good-rgb',
    chest: '--aether-gold-rgb',
    exit: '--aether-ether-rgb',
    entrance: '--aether-ether-hi-rgb',
    hero: '--aether-gold-hi-rgb',
    ink: '--aether-ink-rgb',
};

/** 토큰을 읽지 못하면(서버 렌더 · 시험) 중간 회색 채널 */
const FALLBACK_CHANNELS = '128 128 128';

export const readFieldMapPalette = (): FieldMapPalette => {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement) : null;
    const read = (token: string) => (style?.getPropertyValue(token).trim() || FALLBACK_CHANNELS).replace(/,/g, ' ');
    return Object.fromEntries(
        (Object.keys(TOKEN_OF) as (keyof FieldMapPalette)[]).map((key) => [key, read(TOKEN_OF[key])]),
    ) as FieldMapPalette;
};

/** 토큰 채널 + 투명도 → 캔버스 색 */
export const fieldColor = (channels: string, alpha: number): string => `rgb(${channels} / ${alpha})`;
