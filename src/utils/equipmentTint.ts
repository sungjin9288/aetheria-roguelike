/**
 * equipmentTint.ts — 일반 (비-시그니처) 장비 overlay에 per-item 색감 차별화.
 *
 * 시그니처는 generate_exact_avatar_style_equipment_items.py가 PNG에 직접 tint_image()를
 * 적용해 별도 자산으로 만든다. 일반 장비는 family overlay PNG 1종을 공유하므로
 * 모든 같은-family 무기가 똑같이 보이는 한계가 있었다.
 *
 * 이 모듈은 같은 룰(이름 hint + 속성 + tier)을 CSS filter 문자열로 포팅해
 * 런타임에 SVG <image>에 적용한다. 시그니처는 이미 PNG에 색이 들어있으니 skip.
 *
 * Pure 함수, side effect 없음.
 *
 * cycle 58: TS 마이그레이션 (leaf 유틸).
 */

import { isSignatureItem } from '../data/signatureItems.js';

interface TintMod {
    hue: number;
    sat: number;
    bright: number;
    glow?: string;
}

interface TintableItem {
    name?: string;
    tier?: number;
    elem?: string;
}

// scripts/generate_exact_avatar_style_equipment_items.py의 hint 리스트와 동기 유지
const RUST_HINTS = ['녹슨', '낡은'];
const HOLY_HINTS = ['성', '천공', '천상', '팔라딘', '심판', '성광'];
const ARCANE_HINTS = ['마법', '주문', '룬', '그리모어', '마도', '현자', '아크', '에테르', '차원'];
const SHADOW_HINTS = ['암흑', '어둠', '심연', '공허', '혼돈', '그림자'];
const NATURE_HINTS = ['세계수', '정령', '숲', '엘프', '레인저', '자연', '사냥'];
const WOOD_HINTS = ['나무', '목재', '곤봉', '완드'];

const ELEMENT_FILTERS: Readonly<Record<string, TintMod>> = Object.freeze({
    화염: { hue: -10, sat: 1.4, bright: 1.1, glow: '#ff8c4a' },
    불: { hue: -10, sat: 1.4, bright: 1.1, glow: '#ff8c4a' },
    화염속성: { hue: -10, sat: 1.4, bright: 1.1, glow: '#ff8c4a' },
    냉기: { hue: 180, sat: 1.2, bright: 1.05, glow: '#7ec8e3' },
    얼음: { hue: 180, sat: 1.2, bright: 1.05, glow: '#7ec8e3' },
    빛: { hue: 30, sat: 1.3, bright: 1.2, glow: '#f6d878' },
    자연: { hue: 90, sat: 1.25, bright: 1.0, glow: '#7ad48a' },
    대지: { hue: 25, sat: 1.0, bright: 0.95, glow: '#b58d52' },
    어둠: { hue: 260, sat: 1.15, bright: 0.85, glow: '#7a4fc4' },
    에테르: { hue: 200, sat: 1.2, bright: 1.05, glow: '#6cb4d4' },
    바람: { hue: 110, sat: 1.15, bright: 1.05, glow: '#a8e0b4' },
});

const HINT_FILTERS: Readonly<Record<string, TintMod>> = Object.freeze({
    rust: { hue: -20, sat: 1.25, bright: 0.85, glow: '#d97a3a' },
    holy: { hue: 35, sat: 1.3, bright: 1.15, glow: '#f6d878' },
    arcane: { hue: 240, sat: 1.2, bright: 1.0, glow: '#9b8aff' },
    shadow: { hue: 270, sat: 1.1, bright: 0.82, glow: '#7a4fc4' },
    nature: { hue: 100, sat: 1.2, bright: 1.0, glow: '#7ad48a' },
    wood: { hue: 20, sat: 0.95, bright: 0.95, glow: '#b58d52' },
});

/**
 * Tier별 drop-shadow blur 반경 (px). T3부터 visible glow.
 */
const TIER_GLOW_BLUR: Record<number, number> = {
    1: 0,
    2: 0,
    3: 1.5,
    4: 2.5,
    5: 3.5,
    6: 4.5,
};

const matchHint = (name: string, hints: string[]): boolean => hints.some((hint) => name.includes(hint));

/**
 * 아이템 → CSS filter 문자열 (없으면 null).
 * 예: "hue-rotate(35deg) saturate(1.3) brightness(1.15)"
 */
export const getEquipmentTintFilter = (item: TintableItem | null | undefined): string | null => {
    if (!item) return null;
    // 시그니처는 PNG에 색이 이미 들어있음. 추가 tint는 색이 깨질 위험.
    if (isSignatureItem(item)) return null;

    const name = String(item.name || '');
    const tier = Number(item.tier) || 1;
    const elem = String(item.elem || '');

    let mod: TintMod | null = null;
    if (matchHint(name, RUST_HINTS)) mod = HINT_FILTERS.rust;
    else if (matchHint(name, HOLY_HINTS)) mod = HINT_FILTERS.holy;
    else if (matchHint(name, ARCANE_HINTS)) mod = HINT_FILTERS.arcane;
    else if (matchHint(name, SHADOW_HINTS)) mod = HINT_FILTERS.shadow;
    else if (matchHint(name, NATURE_HINTS)) mod = HINT_FILTERS.nature;
    else if (matchHint(name, WOOD_HINTS)) mod = HINT_FILTERS.wood;
    else if (elem && ELEMENT_FILTERS[elem]) mod = ELEMENT_FILTERS[elem];

    if (!mod) return null;

    const tierSat = 1 + Math.min(0.04, (tier - 1) * 0.01);
    const tierBright = tier >= 4 ? 1.08 : 1.0;

    const finalSat = mod.sat * tierSat;
    const finalBright = mod.bright * tierBright;

    const glowBlur = TIER_GLOW_BLUR[Math.max(1, Math.min(6, tier))] || 0;
    const glow = glowBlur > 0 && mod.glow
        ? ` drop-shadow(0 0 ${glowBlur}px ${mod.glow})`
        : '';

    return `hue-rotate(${mod.hue}deg) saturate(${finalSat.toFixed(2)}) brightness(${finalBright.toFixed(2)})${glow}`;
};
