import { isTwoHandWeapon } from './equipmentUtils.js';
import { getEquipmentArtProfile } from './equipmentArt.js';
import { getArmorStyleFromItem, getAvatarLoadoutStyle, getItemIconAssetKey, getOffhandVisualKey, getWeaponVisualKey } from './itemVisuals.js';

const DEFAULT_JOB_STYLE = {
    hairStyle: 'bob',
    hairColor: '#7a4f3d',
    outfitColor: '#5b7dd8',
    accentColor: '#f6e7c8',
    armorStyle: 'coat',
    accessoryStyle: 'ribbon',
};

const JOB_STYLE_MAP = {
    모험가: { hairStyle: 'bob', hairColor: '#7a4f3d', outfitColor: '#5b7dd8', accentColor: '#f6e7c8', armorStyle: 'coat', accessoryStyle: 'ribbon' },
    전사: { hairStyle: 'spike', hairColor: '#4d3c2f', outfitColor: '#6b7280', accentColor: '#d5b180', armorStyle: 'plate', accessoryStyle: 'plume' },
    나이트: { hairStyle: 'crest', hairColor: '#5a4638', outfitColor: '#64748b', accentColor: '#f6e7c8', armorStyle: 'plate', accessoryStyle: 'crest' },
    버서커: { hairStyle: 'spike', hairColor: '#6b2f2f', outfitColor: '#7c3f3f', accentColor: '#f97316', armorStyle: 'plate', accessoryStyle: 'horn' },
    도적: { hairStyle: 'short', hairColor: '#2f3f4a', outfitColor: '#475569', accentColor: '#7dd4d8', armorStyle: 'leather', accessoryStyle: 'mask' },
    어쌔신: { hairStyle: 'bangs', hairColor: '#1f2937', outfitColor: '#553c7b', accentColor: '#f472b6', armorStyle: 'leather', accessoryStyle: 'mask' },
    레인저: { hairStyle: 'ponytail', hairColor: '#6b4f3d', outfitColor: '#4f6f52', accentColor: '#86efac', armorStyle: 'coat', accessoryStyle: 'leaf' },
    마법사: { hairStyle: 'long', hairColor: '#4a2f5f', outfitColor: '#5b4b9a', accentColor: '#7dd4d8', armorStyle: 'robe', accessoryStyle: 'hat' },
    아크메이지: { hairStyle: 'long', hairColor: '#3f2b63', outfitColor: '#5f59b5', accentColor: '#e3dcff', armorStyle: 'robe', accessoryStyle: 'circlet' },
    흑마법사: { hairStyle: 'long', hairColor: '#251633', outfitColor: '#4b2d63', accentColor: '#c084fc', armorStyle: 'robe', accessoryStyle: 'horn' },
    팔라딘: { hairStyle: 'crest', hairColor: '#6f543d', outfitColor: '#7087a6', accentColor: '#f6e7c8', armorStyle: 'plate', accessoryStyle: 'halo' },
    시간술사: { hairStyle: 'bob', hairColor: '#48607b', outfitColor: '#506c92', accentColor: '#dff7f5', armorStyle: 'robe', accessoryStyle: 'clock' },
    '그림자 주군': { hairStyle: 'bangs', hairColor: '#1c1730', outfitColor: '#41305d', accentColor: '#e879f9', armorStyle: 'leather', accessoryStyle: 'shadow' },
    대마법사: { hairStyle: 'long', hairColor: '#3f2b63', outfitColor: '#6073c8', accentColor: '#dff7f5', armorStyle: 'robe', accessoryStyle: 'circlet' },
};

const ELEMENT_COLOR_MAP = {
    화염: '#fb923c',
    냉기: '#67e8f9',
    어둠: '#a78bfa',
    빛: '#f6e7c8',
    자연: '#86efac',
    대지: '#d6b38b',
    물리: '#d1d5db',
};

const clampEnhance = (value) => Math.max(0, Math.min(9, Number(value) || 0));

const getOverlayTone = (slot, item, fallback) => {
    if (!item) return fallback;

    if (slot === 'weapon') return '#d8c7a5';
    if (slot === 'offhand') return isTwoHandWeapon(item) ? '#d8c7a5' : '#bfa88b';

    const armorStyle = getArmorStyleFromItem(item, 'coat');
    if (armorStyle === 'plate') return '#7c7568';
    if (armorStyle === 'robe') return '#6d6258';
    if (armorStyle === 'leather') return '#715f4f';
    return '#6c665d';
};

export const deriveCharacterAppearance = (player) => {
    const baseStyle = JOB_STYLE_MAP[player?.job] || DEFAULT_JOB_STYLE;
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

    return {
        job: player?.job || '모험가',
        level: player?.level || 1,
        frameTone,
        armorStyle: getArmorStyleFromItem(armor, baseStyle.armorStyle),
        loadoutStyle: getAvatarLoadoutStyle(weaponType, offhandType),
        hairStyle: baseStyle.hairStyle,
        accessoryStyle: baseStyle.accessoryStyle,
        palette: {
            skin: '#f4c9a3',
            outline: '#111827',
            eye: '#0f172a',
            blush: '#f9a8d4',
            hair: baseStyle.hairColor,
            outfit: baseStyle.outfitColor,
            accent: baseStyle.accentColor,
            armor: getOverlayTone('armor', armor, '#6c665d'),
            weapon: getOverlayTone('weapon', weapon, '#d8c7a5'),
            offhand: getOverlayTone('offhand', offhand, '#bfa88b'),
            glow: ELEMENT_COLOR_MAP[frameTone] || baseStyle.accentColor,
        },
        weapon: {
            item: weapon,
            type: weaponType,
            visual: weaponType,
            iconKey: getItemIconAssetKey(weapon),
            enhance: clampEnhance(weapon?.enhance),
            hands: isTwoHandWeapon(weapon) ? 2 : 1,
            art: weaponArt,
        },
        offhand: {
            item: offhand,
            type: offhandType,
            visual: offhandType,
            iconKey: getItemIconAssetKey(offhand),
            enhance: clampEnhance(offhand?.enhance),
            art: offhandArt,
        },
        armor: {
            item: armor,
            visual: getArmorStyleFromItem(armor, baseStyle.armorStyle),
            iconKey: getItemIconAssetKey(armor),
            enhance: clampEnhance(armor?.enhance),
            equipped: Boolean(armor),
            art: armorArt,
        },
    };
};
