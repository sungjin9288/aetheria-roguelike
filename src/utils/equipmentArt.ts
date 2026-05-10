import type { Item } from '../types/index.js';
import { isFocusOffhand, isShield, isWeapon } from './equipmentUtils.js';
import { getArmorStyleFromItem, getWeaponVisualKey } from './itemVisuals.js';
import { ELEMENT_TONE_KEY, TONE_PALETTES } from '../data/artPalette.js';

const HEADGEAR_ONLY_PATTERN = /(모자|두건|후드|투구|헬름|왕관|관|면갑|복면)/;

const clamp = (value: any, min: any, max: any) => Math.min(max, Math.max(min, value));

const containsAny = (name: any, patterns: any) => patterns.some((pattern: any) => name.includes(pattern));

const hashText = (value: any = '') => (
    [...String(value)].reduce((total: any, char: any, index: any) => ((total * 31) + (char.codePointAt(0) || 0) + index) % 9973, 17)
);

const hexToRgb = (hex: any) => {
    const normalized = String(hex || '').replace('#', '');
    if (normalized.length !== 6) return { r: 255, g: 255, b: 255 };
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
};

const rgbToHex = ({ r, g, b }: any) => (
    `#${[r, g, b].map((channel: any) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('')}`
);

const mixHex = (left: any, right: any, ratio: any = 0.5) => {
    const l = hexToRgb(left);
    const r = hexToRgb(right);
    return rgbToHex({
        r: l.r + ((r.r - l.r) * ratio),
        g: l.g + ((r.g - l.g) * ratio),
        b: l.b + ((r.b - l.b) * ratio),
    });
};

const tintPalette = (palette: any, item: Item | null | undefined) => {
    const offset = hashText(item?.name || '') % 11;
    const ratio = 0.06 + (offset * 0.012);
    return {
        base: mixHex(palette.base, '#ffffff', ratio * 0.2),
        shade: mixHex(palette.shade, '#000000', ratio * 0.35),
        accent: mixHex(palette.accent, '#ffffff', ratio * 0.08),
        trim: mixHex(palette.trim, '#ffffff', ratio * 0.16),
    };
};

const getToneKey = (item: Item | null | undefined, slot: any = 'weapon') => {
    if (!item) {
        if (slot === 'armor') return 'cloth';
        if (slot === 'offhand') return 'wood';
        return 'steel';
    }

    const name = String(item.name || '');

    if (name.includes('짚')) return 'straw';
    if (name.includes('녹슨')) return 'rust';
    if (containsAny(name, ['나무', '목재', '농부', '가지', '세계수'])) return name.includes('세계수') ? 'nature' : 'wood';
    if (containsAny(name, ['뼈', '송곳니', '용아'])) return 'bone';
    if (containsAny(name, ['튜닉', '여행자'])) return 'canvas';
    if (containsAny(name, ['가죽', '조끼', '외피', '야복', '잠수복'])) return 'leather';
    if (containsAny(name, ['로브', '예복', '성의', '마도서', '주문서', '완드', '지팡이', '스태프', '로드'])) return item.elem ? (ELEMENT_TONE_KEY[item.elem] || 'arcane') : 'arcane';
    if (item.elem && ELEMENT_TONE_KEY[item.elem]) return ELEMENT_TONE_KEY[item.elem];
    if (slot === 'armor') return 'cloth';
    if (slot === 'offhand' && isFocusOffhand(item)) return 'arcane';
    return 'steel';
};

const getArmorHeadgearStyle = (item: Item | null | undefined) => {
    if (!item || item.type !== 'armor') return 'none';
    const name = String(item.name || '');

    if (name.includes('짚')) return 'straw-hat';
    if (containsAny(name, ['마법 모자', '현자의 관'])) return 'wizard-hat';
    if (containsAny(name, ['제관', '왕관', '관'])) return 'circlet';
    if (containsAny(name, ['복면'])) return 'mask';
    if (containsAny(name, ['두건', '후드', '복면'])) return 'hood';
    if (containsAny(name, ['투구', '헬름', '왕관', '관'])) return 'helm';
    if (name.includes('모자')) return 'cap';
    if (name.includes('망토')) return 'hood-cloak';
    return 'none';
};

const getArmorBodyStyle = (item: Item | null | undefined, fallback: any = 'coat') => {
    if (!item || item.type !== 'armor') return fallback;
    const name = String(item.name || '');

    if (HEADGEAR_ONLY_PATTERN.test(name) && !containsAny(name, ['갑', '로브', '예복', '성의', '외투', '망토', '튜닉', '조끼', '도복', '전투복', '잠수복', '경갑', '야복'])) {
        return 'none';
    }
    if (name.includes('장화')) return 'boots';
    if (containsAny(name, ['로브', '예복', '성의'])) return 'robe';
    if (containsAny(name, ['망토', '외투'])) return 'cloak';
    if (containsAny(name, ['튜닉', '수련복', '도복', '전투복', '잠수복'])) return 'tunic';
    if (containsAny(name, ['가죽', '조끼', '외피', '야복', '경갑'])) return 'leather';
    if (containsAny(name, ['갑', '흉갑', '갑주', '판금', '방어복'])) return 'plate';

    const armorStyle = getArmorStyleFromItem(item, fallback);
    if (armorStyle === 'robe') return 'robe';
    if (armorStyle === 'plate') return 'plate';
    if (armorStyle === 'leather') return 'leather';
    return 'cloak';
};

const getOffhandStyle = (item: Item | null | undefined) => {
    if (!item || !isShield(item)) return 'none';
    const name = String(item.name || '');

    if (isFocusOffhand(item)) {
        if (containsAny(name, ['서판', '석판'])) return 'tablet';
        if (containsAny(name, ['주문서', '성전'])) return 'scroll';
        if (containsAny(name, ['그리모어'])) return 'grimoire';
        return 'tome';
    }
    if (containsAny(name, ['이지스', '방벽'])) return 'tower-shield';
    if (containsAny(name, ['원형', '버클러'])) return 'buckler';
    return 'kite-shield';
};

const getWeaponStyle = (item: Item | null | undefined) => {
    if (!item || !isWeapon(item)) return 'none';
    return getWeaponVisualKey(item);
};

// cycle 513: slotHint default null 제거 — 4 callsite 모두 slotHint 명시 전달
//   ('weapon' / 'offhand' / 'armor'). default 도달 불가. fallbackArmorStyle은
//   3/4 caller가 default 'coat' 활용하므로 보존.
export const getEquipmentArtProfile = (item: Item | null | undefined, slotHint: any, fallbackArmorStyle: any = 'coat') => {
    // cycle 341: itemName / subtype / hands 3 dead 필드 제거 — 외부 read 0건.
    //   slot / key / toneKey / palette는 production 또는 tests에서 사용되므로 보존.
    if (!item) {
        return {
            slot: slotHint || 'none',
            key: 'none',
            toneKey: slotHint === 'armor' ? 'cloth' : 'steel',
            palette: TONE_PALETTES[slotHint === 'armor' ? 'cloth' : 'steel'],
        };
    }

    if (item.type === 'armor') {
        const toneKey = getToneKey(item, 'armor');
        const palette = tintPalette(TONE_PALETTES[toneKey] || TONE_PALETTES.cloth, item);
        const headgearStyle = getArmorHeadgearStyle(item);
        const bodyStyle = getArmorBodyStyle(item, fallbackArmorStyle);
        return {
            slot: 'armor',
            key: `${headgearStyle}:${bodyStyle}:${toneKey}`,
            toneKey,
            palette,
            headgearStyle,
            bodyStyle,
            isHeadgearOnly: bodyStyle === 'none' && headgearStyle !== 'none',
        };
    }

    if (item.type === 'shield') {
        const toneKey = getToneKey(item, 'offhand');
        const palette = tintPalette(TONE_PALETTES[toneKey] || TONE_PALETTES.wood, item);
        const style = getOffhandStyle(item);
        return {
            slot: 'offhand',
            key: `${style}:${toneKey}`,
            toneKey,
            palette,
            style,
        };
    }

    if (item.type === 'weapon') {
        const toneKey = getToneKey(item, 'weapon');
        const palette = tintPalette(TONE_PALETTES[toneKey] || TONE_PALETTES.steel, item);
        const style = getWeaponStyle(item);
        const slot = slotHint === 'offhand' ? 'offhand' : 'weapon';
        return {
            slot,
            key: `${style}:${toneKey}:${slot}`,
            toneKey,
            palette,
            style,
        };
    }

    return {
        slot: slotHint || item.type || 'misc',
        key: `${item.type || 'misc'}:${getToneKey(item, slotHint || item.type)}`,
        toneKey: getToneKey(item, slotHint || item.type),
        palette: tintPalette(TONE_PALETTES[getToneKey(item, slotHint || item.type)] || TONE_PALETTES.steel, item),
    };
};
