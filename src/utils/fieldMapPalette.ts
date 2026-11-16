/**
 * 지역 지도 `<canvas>`의 색 — 디자인 토큰(`--aether-*-rgb`)을 읽어 캔버스가 쓰는 색 문자열로 바꾼다. 캔버스는 CSS 클래스를
 * 쓰지 못하므로 토큰 값을 직접 읽는다(색을 새로 정하지 않는다 — 토큰이 바뀌면 지도도 바뀐다).
 */

import type { FieldBiome } from '../systems/fieldBiome';

export type FieldMapPalette = Record<'bg' | 'wall' | 'path' | 'grass' | 'deep' | 'chest' | 'exit' | 'entrance' | 'hero' | 'ink' | 'door', string>;

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
    door: '--aether-threat-rgb',
};

/**
 * 2026-11 오버월드 3단계 — 바이옴(8종)마다 얕은 풀숲 · 깊은 곳 · 무늬의 토큰. 칸 종류(벽 · 길 · 풀숲 · 깊은 곳)와 그 뜻은 그대로이고
 * 색 · 무늬만 바뀐다(숲은 2단계 색 그대로). 새 색을 정하지 않는다 — 이미 있는 디자인 토큰만 쓴다.
 */
export interface FieldBiomeTokens {
    /** 얕은 풀숲(`,`) 바탕 */
    shallow: string;
    /** 깊은 곳(`;`) 바탕 */
    deep: string;
    /** 무늬 · 길 · 벽에 얹는 옅은 빛 */
    motif: string;
}

export const FIELD_BIOME_TOKENS: Readonly<Record<FieldBiome, FieldBiomeTokens>> = Object.freeze({
    forest: { shallow: '--aether-sig-nature-rgb', deep: '--aether-good-rgb', motif: '--aether-sig-nature-rgb' },
    water: { shallow: '--aether-will-rgb', deep: '--aether-ether-rgb', motif: '--aether-ether-hi-rgb' },
    ember: { shallow: '--aether-sig-fire-rgb', deep: '--aether-threat-rgb', motif: '--aether-gold-rgb' },
    frost: { shallow: '--aether-sig-frost-rgb', deep: '--aether-ether-hi-rgb', motif: '--aether-ink-rgb' },
    sky: { shallow: '--aether-will-rgb', deep: '--aether-ink-2-rgb', motif: '--aether-ink-rgb' },
    arcane: { shallow: '--aether-sig-arcane-rgb', deep: '--aether-rarity-epic-rgb', motif: '--aether-sig-arcane-rgb' },
    abyss: { shallow: '--aether-sig-shadow-rgb', deep: '--aether-void-rgb', motif: '--aether-life-rgb' },
    ruin: { shallow: '--aether-sig-earth-rgb', deep: '--aether-sig-rust-rgb', motif: '--aether-sig-earth-rgb' },
});

export type FieldBiomePalette = Record<keyof FieldBiomeTokens, string>;

/** 토큰을 읽지 못하면(서버 렌더 · 시험) 중간 회색 채널 */
const FALLBACK_CHANNELS = '128 128 128';

const readToken = (): ((token: string) => string) => {
    const style = typeof window !== 'undefined' ? window.getComputedStyle(document.documentElement) : null;
    return (token: string) => (style?.getPropertyValue(token).trim() || FALLBACK_CHANNELS).replace(/,/g, ' ');
};

export const readFieldMapPalette = (): FieldMapPalette => {
    const read = readToken();
    return Object.fromEntries(
        (Object.keys(TOKEN_OF) as (keyof FieldMapPalette)[]).map((key) => [key, read(TOKEN_OF[key])]),
    ) as FieldMapPalette;
};

/** 바이옴의 토큰 채널 — 지도를 그릴 때 한 번 읽는다 */
export const readFieldBiomePalette = (biome: FieldBiome): FieldBiomePalette => {
    const read = readToken();
    const tokens = FIELD_BIOME_TOKENS[biome];
    return { shallow: read(tokens.shallow), deep: read(tokens.deep), motif: read(tokens.motif) };
};

/** 토큰 채널 + 투명도 → 캔버스 색 */
export const fieldColor = (channels: string, alpha: number): string => `rgb(${channels} / ${alpha})`;
