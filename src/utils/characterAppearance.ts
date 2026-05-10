import type { Item } from '../types/index.js';
import { isTwoHandWeapon } from './equipmentUtils.js';
import type { Player } from "../types/index.js";
import { getEquipmentArtProfile } from './equipmentArt.js';
// cycle 342: getItemIconAssetKey import 제거 — iconKey 출력 필드 cleanup 후 cascade dead.
import { getArmorStyleFromItem, getAvatarLoadoutStyle, getOffhandVisualKey, getWeaponVisualKey } from './itemVisuals.js';

const DEFAULT_JOB_STYLE: any = {
    hairColor: '#7a4f3d',
    outfitColor: '#5b7dd8',
    accentColor: '#f6e7c8',
    armorStyle: 'coat',
    accessoryStyle: 'ribbon',
};

const JOB_STYLE_MAP: any = {
    모험가: { hairColor: '#7a4f3d', outfitColor: '#5b7dd8', accentColor: '#f6e7c8', armorStyle: 'coat', accessoryStyle: 'ribbon' },
    전사: { hairColor: '#4d3c2f', outfitColor: '#6b7280', accentColor: '#d5b180', armorStyle: 'plate', accessoryStyle: 'plume' },
    나이트: { hairColor: '#5a4638', outfitColor: '#64748b', accentColor: '#f6e7c8', armorStyle: 'plate', accessoryStyle: 'crest' },
    버서커: { hairColor: '#6b2f2f', outfitColor: '#7c3f3f', accentColor: '#f97316', armorStyle: 'plate', accessoryStyle: 'horn' },
    도적: { hairColor: '#2f3f4a', outfitColor: '#475569', accentColor: '#7dd4d8', armorStyle: 'leather', accessoryStyle: 'mask' },
    어쌔신: { hairColor: '#1f2937', outfitColor: '#553c7b', accentColor: '#f472b6', armorStyle: 'leather', accessoryStyle: 'mask' },
    레인저: { hairColor: '#6b4f3d', outfitColor: '#4f6f52', accentColor: '#86efac', armorStyle: 'coat', accessoryStyle: 'leaf' },
    마법사: { hairColor: '#4a2f5f', outfitColor: '#5b4b9a', accentColor: '#7dd4d8', armorStyle: 'robe', accessoryStyle: 'hat' },
    아크메이지: { hairColor: '#3f2b63', outfitColor: '#5f59b5', accentColor: '#e3dcff', armorStyle: 'robe', accessoryStyle: 'circlet' },
    흑마법사: { hairColor: '#251633', outfitColor: '#4b2d63', accentColor: '#c084fc', armorStyle: 'robe', accessoryStyle: 'horn' },
    팔라딘: { hairColor: '#6f543d', outfitColor: '#7087a6', accentColor: '#f6e7c8', armorStyle: 'plate', accessoryStyle: 'halo' },
    시간술사: { hairColor: '#48607b', outfitColor: '#506c92', accentColor: '#dff7f5', armorStyle: 'robe', accessoryStyle: 'clock' },
    '그림자 주군': { hairColor: '#1c1730', outfitColor: '#41305d', accentColor: '#e879f9', armorStyle: 'leather', accessoryStyle: 'shadow' },
    대마법사: { hairColor: '#3f2b63', outfitColor: '#6073c8', accentColor: '#dff7f5', armorStyle: 'robe', accessoryStyle: 'circlet' },
};

const ELEMENT_COLOR_MAP: any = {
    화염: '#fb923c',
    냉기: '#67e8f9',
    어둠: '#a78bfa',
    빛: '#f6e7c8',
    자연: '#86efac',
    대지: '#d6b38b',
    물리: '#d1d5db',
};

const clampEnhance = (value: any) => Math.max(0, Math.min(9, Number(value) || 0));

const getOverlayTone = (slot: any, item: Item | null | undefined, fallback: any) => {
    if (!item) return fallback;

    if (slot === 'weapon') return '#d8c7a5';
    if (slot === 'offhand') return isTwoHandWeapon(item) ? '#d8c7a5' : '#bfa88b';

    const armorStyle = getArmorStyleFromItem(item, 'coat');
    if (armorStyle === 'plate') return '#7c7568';
    if (armorStyle === 'robe') return '#6d6258';
    if (armorStyle === 'leather') return '#715f4f';
    return '#6c665d';
};

export const deriveCharacterAppearance = (player: Player) => {
    const baseStyle = JOB_STYLE_MAP[player?.job as string] || DEFAULT_JOB_STYLE;
    const equip = player?.equip || {};
    const armor = equip.armor || null;
    const weapon = equip.weapon || null;
    const offhand = equip.offhand || null;
    const weaponArt = getEquipmentArtProfile(weapon, 'weapon');
    const offhandArt = getEquipmentArtProfile(offhand, 'offhand');
    const armorArt = getEquipmentArtProfile(armor, 'armor', baseStyle.armorStyle);
    const frameTone = armor?.elem || weapon?.elem || offhand?.elem || null;
    const weaponType = getWeaponVisualKey(weapon);
    const offhandType = getOffhandVisualKey(offhand);

    // cycle 342: level / hairStyle 출력 필드 제거 — read 0건이던 dead.
    return {
        job: player?.job || '모험가',
        frameTone,
        armorStyle: getArmorStyleFromItem(armor, baseStyle.armorStyle),
        loadoutStyle: getAvatarLoadoutStyle(weaponType, offhandType),
        accessoryStyle: baseStyle.accessoryStyle,
        // cycle 447: 5 dead palette 필드 정리 (skin / outline / eye / blush / armor) —
        //   production read 0건. PixelCharacterAvatar는 glow / accent만 사용,
        //   tests는 outfit / weapon / offhand / hair 사용.
        palette: {
            hair: baseStyle.hairColor,
            outfit: baseStyle.outfitColor,
            accent: baseStyle.accentColor,
            weapon: getOverlayTone('weapon', weapon, '#d8c7a5'),
            offhand: getOverlayTone('offhand', offhand, '#bfa88b'),
            glow: ELEMENT_COLOR_MAP[frameTone as string] || baseStyle.accentColor,
        },
        // cycle 342: dead 출력 필드 정리 — item / iconKey / hands / equipped read 0건.
        //   활성 필드 (test 또는 production read): type / visual / enhance / art.
        weapon: {
            type: weaponType,
            visual: weaponType,
            enhance: clampEnhance(weapon?.enhance),
            art: weaponArt,
        },
        offhand: {
            type: offhandType,
            visual: offhandType,
            enhance: clampEnhance(offhand?.enhance),
            art: offhandArt,
        },
        armor: {
            visual: getArmorStyleFromItem(armor, baseStyle.armorStyle),
            enhance: clampEnhance(armor?.enhance),
            art: armorArt,
        },
    };
};
