import type { Item } from '../types/index.js';
import { getEquipmentArtProfile } from './equipmentArt.js';
import { getArmorStyleFromItem, getAvatarLoadoutStyle, getOffhandVisualKey, getWeaponVisualKey } from './itemVisuals.js';
import {
    getArmorPlacement,
    getOffhandPlacement,
    getWeaponPlacement,
    placementToTransform,
} from './anchorPoints.js';

const HOLY_PREVIEW_PATTERNS = ['성', '천', '심판', '성광', '이지스', '기사'];
const SHADOW_PREVIEW_PATTERNS = ['암흑', '어둠', '심연', '공허', '그림자'];
const NATURE_PREVIEW_PATTERNS = ['엘프', '숲', '사냥', '레인저', '자연'];
const HEAVY_WEAPON_STYLES = new Set(['greatsword', 'greataxe', 'axe', 'hammer', 'mace', 'spear', 'lance', 'scythe']);
const DAGGER_WEAPON_STYLES = new Set(['dagger', 'fang-dagger', 'throwing-blade', 'twinblade']);
const FOCUS_OFFHAND_STYLES = new Set(['grimoire', 'tome', 'tablet', 'scroll', 'book']);

/**
 * `getEquipmentArtProfile()`(equipmentArt.ts)가 만드는 슬롯별 모양 중 이 파일이
 * 실제로 읽는 필드만 — armor 분기만 `bodyStyle`/`headgearStyle`/`isHeadgearOnly`를,
 * weapon/shield 분기만 `style`을 채운다(equipmentArt.ts 참고). 전부 optional이라
 * 어느 분기 결과든 그대로 대입된다.
 */
interface EquipmentArtStylingProfile {
    slot?: string;
    style?: string;
    bodyStyle?: string;
    headgearStyle?: string;
    isHeadgearOnly?: boolean;
}

const resolvePreviewArmorStyle = (item: Item | null | undefined, profile: EquipmentArtStylingProfile | null | undefined) => {
    if (!item || item.type !== 'armor') return 'coat';

    if (profile?.bodyStyle === 'robe') return 'robe';
    if (profile?.bodyStyle === 'plate') return 'plate';
    if (profile?.bodyStyle === 'leather') return 'leather';
    if (profile?.bodyStyle === 'none') return 'coat';

    return getArmorStyleFromItem(item, 'coat');
};

const containsAny = (text: string, patterns: string[]) => patterns.some((pattern) => text.includes(pattern));

const resolvePreviewJobFromArmor = (item: Item | null | undefined, profile: EquipmentArtStylingProfile | null | undefined) => {
    const name = String(item?.name || '');
    const tone = String(item?.elem || '');

    if (profile?.headgearStyle === 'wizard-hat' || profile?.headgearStyle === 'circlet') {
        return containsAny(name, SHADOW_PREVIEW_PATTERNS) || tone === '어둠' ? '흑마법사' : '마법사';
    }
    if (profile?.headgearStyle === 'helm') {
        return containsAny(name, HOLY_PREVIEW_PATTERNS) || tone === '빛' ? '팔라딘' : '나이트';
    }
    if (profile?.headgearStyle === 'hood') return '레인저';
    if (profile?.headgearStyle === 'mask') return '도적';
    if (profile?.headgearStyle === 'straw-hat' || profile?.headgearStyle === 'cap') return '모험가';

    if (profile?.bodyStyle === 'robe') {
        if (containsAny(name, SHADOW_PREVIEW_PATTERNS) || tone === '어둠') return '흑마법사';
        if (containsAny(name, HOLY_PREVIEW_PATTERNS) || tone === '빛') return '아크메이지';
        return '마법사';
    }
    if (profile?.bodyStyle === 'plate') {
        return containsAny(name, HOLY_PREVIEW_PATTERNS) || tone === '빛' ? '팔라딘' : '나이트';
    }
    if (profile?.bodyStyle === 'leather') return '도적';
    if (profile?.bodyStyle === 'cloak') return containsAny(name, NATURE_PREVIEW_PATTERNS) ? '레인저' : '모험가';
    return '모험가';
};

const resolvePreviewJobFromWeapon = (item: Item | null | undefined, visualKey: string) => {
    const name = String(item?.name || '');
    const tone = String(item?.elem || '');

    if (visualKey === 'bow' || visualKey === 'longbow') return '레인저';
    if (visualKey === 'staff' || visualKey === 'rod' || visualKey === 'wand') {
        if (containsAny(name, SHADOW_PREVIEW_PATTERNS) || tone === '어둠') return '흑마법사';
        if (containsAny(name, HOLY_PREVIEW_PATTERNS) || tone === '빛') return '아크메이지';
        return '마법사';
    }
    if (visualKey === 'dagger' || visualKey === 'fang-dagger' || visualKey === 'throwing-blade' || visualKey === 'twinblade') {
        return '도적';
    }
    if (visualKey === 'greataxe' || visualKey === 'axe' || visualKey === 'hammer' || visualKey === 'mace') {
        return '전사';
    }
    if (visualKey === 'spear' || visualKey === 'lance') {
        return containsAny(name, HOLY_PREVIEW_PATTERNS) ? '나이트' : '모험가';
    }
    return '모험가';
};

const resolvePreviewJobFromOffhand = (item: Item | null | undefined, visualKey: string) => {
    const name = String(item?.name || '');
    const tone = String(item?.elem || '');

    if (visualKey === 'shield') {
        return containsAny(name, HOLY_PREVIEW_PATTERNS) || tone === '빛' ? '팔라딘' : '나이트';
    }
    if (visualKey === 'book') {
        if (containsAny(name, SHADOW_PREVIEW_PATTERNS) || tone === '어둠') return '흑마법사';
        if (containsAny(name, HOLY_PREVIEW_PATTERNS) || tone === '빛') return '아크메이지';
        return '마법사';
    }
    return resolvePreviewJobFromWeapon(item, visualKey);
};

export const getWeaponTransform = (profile: EquipmentArtStylingProfile | null | undefined) => placementToTransform(getWeaponPlacement(profile?.style));

export const getOffhandTransform = (profile: EquipmentArtStylingProfile | null | undefined) => placementToTransform(getOffhandPlacement(profile?.style));

export const getArmorTransform = (profile: EquipmentArtStylingProfile | null | undefined) => placementToTransform(getArmorPlacement(profile));

/** `withVariant()`가 받는 기본 배치값 — 카드/기본 두 variant 공용 6필드. */
interface EquipmentPreviewStage {
    focus: string;
    scale: number;
    translateX: number;
    translateY: number;
    spotlight: string;
    origin: string;
}

/** 'card' variant에서 baseStage를 덮어쓰는 값 — 전부 선택적(없으면 baseStage 유지). */
interface EquipmentPreviewStageOverrides {
    scale?: number;
    translateX?: number;
    translateY?: number;
    spotlight?: string;
    origin?: string;
}

// cycle 564: overrides default {} 제거 — 10 internal callsite (line 128부터)
//   모두 3 args 명시 (object literal로 overrides 전달)이라 default 도달
//   불가. private (no export). 청소 메가 시리즈 57번째.
const withVariant = (baseStage: EquipmentPreviewStage, variant: string | undefined, overrides: EquipmentPreviewStageOverrides) => {
    if (variant === 'card') {
        return {
            ...baseStage,
            scale: overrides.scale ?? Math.round(baseStage.scale * 118) / 100,
            translateX: overrides.translateX ?? baseStage.translateX,
            translateY: overrides.translateY ?? baseStage.translateY,
            spotlight: overrides.spotlight || baseStage.spotlight,
            origin: overrides.origin || baseStage.origin || '50% 52%',
        };
    }

    return {
        ...baseStage,
        origin: baseStage.origin || '50% 55%',
    };
};

// cycle 514: variant default 'default' 제거 — 1 callsite (EquipmentAvatarPreview
//   :11) 항상 3 args (variant prop) 전달이라 default 도달 불가. util default
//   청소 메가 시리즈 12번째 (cycle 502-513).
export const getEquipmentPreviewStage = (
    item: Item | null | undefined,
    appearance: ReturnType<typeof buildEquipmentPreviewAppearance>,
    variant: string | undefined,
) => {
    const armorArt = appearance?.armor?.art || null;
    const weaponStyle = appearance?.weapon?.art?.style || appearance?.weapon?.visual || 'none';
    const offhandStyle = appearance?.offhand?.art?.style || appearance?.offhand?.visual || 'none';

    if (armorArt?.isHeadgearOnly) {
        return withVariant({
            focus: 'headgear',
            scale: 1.28,
            translateX: 0,
            translateY: 10,
            spotlight: 'radial-gradient(circle at 50% 14%, rgba(246,231,200,0.24), transparent 42%)',
            origin: '50% 18%',
        }, variant, {
            scale: 1.62,
            translateY: 18,
            spotlight: 'radial-gradient(circle at 50% 14%, rgba(246,231,200,0.28), transparent 46%)',
            origin: '50% 14%',
        });
    }

    if (armorArt?.bodyStyle && armorArt.bodyStyle !== 'none') {
        const armorStageMap: Record<string, any> = {
            robe: { scale: 1.17, translateX: 0, translateY: 6 },
            plate: { scale: 1.14, translateX: 0, translateY: 5 },
            leather: { scale: 1.17, translateX: 0, translateY: 6 },
            cloak: { scale: 1.16, translateX: -2, translateY: 5 },
            tunic: { scale: 1.18, translateX: 0, translateY: 6 },
            boots: { scale: 1.1, translateX: 0, translateY: 3 },
        };

        const stage = armorStageMap[armorArt.bodyStyle] || armorStageMap.tunic;
        return withVariant({
            focus: 'armor',
            ...stage,
            spotlight: 'radial-gradient(circle at 50% 48%, rgba(125,212,216,0.18), transparent 46%)',
            origin: '50% 52%',
        }, variant, {
            scale: armorArt.bodyStyle === 'plate' ? 1.38 : 1.34,
            translateX: armorArt.bodyStyle === 'cloak' ? -3 : 0,
            translateY: armorArt.bodyStyle === 'boots' ? 7 : 11,
            spotlight: 'radial-gradient(circle at 50% 48%, rgba(125,212,216,0.22), transparent 48%)',
            origin: '50% 48%',
        });
    }

    if (appearance?.offhand?.item) {
        if (offhandStyle === 'shield' || String(offhandStyle).includes('shield')) {
            return withVariant({
                focus: 'offhand',
                scale: 1.15,
                translateX: 5,
                translateY: 4,
                spotlight: 'radial-gradient(circle at 30% 54%, rgba(246,231,200,0.22), transparent 44%)',
                origin: '34% 54%',
            }, variant, {
                scale: 1.34,
                translateX: 12,
                translateY: 8,
                spotlight: 'radial-gradient(circle at 28% 56%, rgba(246,231,200,0.28), transparent 46%)',
                origin: '32% 56%',
            });
        }
        if (FOCUS_OFFHAND_STYLES.has(offhandStyle)) {
            return withVariant({
                focus: 'offhand',
                scale: 1.14,
                translateX: 4,
                translateY: 5,
                spotlight: 'radial-gradient(circle at 30% 42%, rgba(167,139,250,0.2), transparent 44%)',
                origin: '34% 42%',
            }, variant, {
                scale: 1.3,
                translateX: 9,
                translateY: 8,
                spotlight: 'radial-gradient(circle at 28% 40%, rgba(167,139,250,0.26), transparent 46%)',
                origin: '30% 42%',
            });
        }
    }

    if (appearance?.weapon?.item) {
        if (weaponStyle === 'bow' || weaponStyle === 'longbow') {
            return withVariant({
                focus: 'weapon',
                scale: 1.18,
                translateX: -4,
                translateY: 4,
                spotlight: 'radial-gradient(circle at 72% 50%, rgba(134,239,172,0.18), transparent 46%)',
                origin: '70% 52%',
            }, variant, {
                scale: 1.34,
                translateX: -9,
                translateY: 8,
                spotlight: 'radial-gradient(circle at 74% 52%, rgba(134,239,172,0.22), transparent 48%)',
                origin: '72% 52%',
            });
        }
        if (HEAVY_WEAPON_STYLES.has(weaponStyle)) {
            return withVariant({
                focus: 'weapon',
                scale: 1.19,
                translateX: -2,
                translateY: 4,
                spotlight: 'radial-gradient(circle at 74% 54%, rgba(214,179,139,0.2), transparent 46%)',
                origin: '70% 56%',
            }, variant, {
                scale: 1.32,
                translateX: -6,
                translateY: 8,
                spotlight: 'radial-gradient(circle at 76% 56%, rgba(214,179,139,0.24), transparent 48%)',
                origin: '72% 56%',
            });
        }
        if (DAGGER_WEAPON_STYLES.has(weaponStyle)) {
            return withVariant({
                focus: 'weapon',
                scale: 1.17,
                translateX: -3,
                translateY: 7,
                spotlight: 'radial-gradient(circle at 72% 58%, rgba(251,191,36,0.16), transparent 42%)',
                origin: '70% 60%',
            }, variant, {
                scale: 1.28,
                translateX: -7,
                translateY: 11,
                spotlight: 'radial-gradient(circle at 74% 58%, rgba(251,191,36,0.22), transparent 44%)',
                origin: '72% 60%',
            });
        }
        if (weaponStyle === 'staff' || weaponStyle === 'rod' || weaponStyle === 'wand') {
            return withVariant({
                focus: 'weapon',
                scale: 1.16,
                translateX: -3,
                translateY: 5,
                spotlight: 'radial-gradient(circle at 70% 38%, rgba(103,232,249,0.18), transparent 42%)',
                origin: '68% 44%',
            }, variant, {
                scale: 1.3,
                translateX: -7,
                translateY: 9,
                spotlight: 'radial-gradient(circle at 72% 38%, rgba(103,232,249,0.22), transparent 44%)',
                origin: '70% 42%',
            });
        }
        return withVariant({
            focus: 'weapon',
            scale: 1.16,
            translateX: -3,
            translateY: 6,
            spotlight: 'radial-gradient(circle at 72% 56%, rgba(246,231,200,0.18), transparent 44%)',
            origin: '70% 56%',
        }, variant, {
            scale: 1.28,
            translateX: -7,
            translateY: 9,
            spotlight: 'radial-gradient(circle at 74% 56%, rgba(246,231,200,0.22), transparent 46%)',
            origin: '72% 56%',
        });
    }

    return withVariant({
        focus: 'base',
        scale: 1.08,
        translateX: 0,
        translateY: 4,
        spotlight: 'radial-gradient(circle at 50% 40%, rgba(125,212,216,0.12), transparent 44%)',
        origin: '50% 52%',
    }, variant, {
        scale: 1.18,
        translateY: 5,
        spotlight: 'radial-gradient(circle at 50% 40%, rgba(125,212,216,0.18), transparent 44%)',
        origin: '50% 50%',
    });
};

/** 슬롯 1개(무기/보조/방어구)에 실제로 장착된 아이템의 미리보기 조각. */
interface EquipmentPreviewSlotArt {
    item: Item;
    art: EquipmentArtStylingProfile;
    type?: string;
    visual: string;
}

/** `buildEquipmentPreviewAppearance()` 산출물 — 슬롯 3종(무기/보조/방어구) 중 실제
 *  장착된 것만 채워지고 나머지는 null. */
interface EquipmentPreviewAppearance {
    job: string;
    frameTone: string | null;
    armorStyle: string;
    loadoutStyle: string;
    weapon: EquipmentPreviewSlotArt | null;
    offhand: EquipmentPreviewSlotArt | null;
    armor: EquipmentPreviewSlotArt | null;
}

export const buildEquipmentPreviewAppearance = (item: Item | null | undefined): EquipmentPreviewAppearance => {
    const preview: EquipmentPreviewAppearance = {
        job: '모험가',
        frameTone: item?.elem || null,
        armorStyle: 'coat',
        loadoutStyle: 'sword',
        weapon: null,
        offhand: null,
        armor: null,
    };

    if (!item) return preview;

    const profile = getEquipmentArtProfile(item, item.type === 'shield' ? 'offhand' : item.type);
    if (!profile) return preview;

    if (profile.slot === 'weapon') {
        const weaponVisualKey = getWeaponVisualKey(item);
        preview.job = resolvePreviewJobFromWeapon(item, weaponVisualKey);
        preview.armorStyle = weaponVisualKey === 'bow' || weaponVisualKey === 'longbow'
            ? 'coat'
            : weaponVisualKey === 'staff' || weaponVisualKey === 'rod' || weaponVisualKey === 'wand'
                ? 'robe'
                : weaponVisualKey === 'dagger' || weaponVisualKey === 'fang-dagger' || weaponVisualKey === 'throwing-blade' || weaponVisualKey === 'twinblade'
                    ? 'leather'
                    : weaponVisualKey === 'greataxe' || weaponVisualKey === 'axe' || weaponVisualKey === 'hammer' || weaponVisualKey === 'mace'
                        ? 'plate'
                        : 'coat';
        preview.loadoutStyle = getAvatarLoadoutStyle(weaponVisualKey, 'none');
        preview.weapon = { item, art: profile, type: weaponVisualKey, visual: weaponVisualKey };
    } else if (profile.slot === 'offhand') {
        const offhandVisualKey = item.type === 'weapon' ? getWeaponVisualKey(item) : getOffhandVisualKey(item);
        preview.job = resolvePreviewJobFromOffhand(item, offhandVisualKey);
        preview.armorStyle = offhandVisualKey === 'shield'
            ? 'plate'
            : offhandVisualKey === 'book'
                ? 'robe'
                : 'coat';
        preview.loadoutStyle = getAvatarLoadoutStyle('none', offhandVisualKey);
        preview.offhand = { item, art: profile, type: offhandVisualKey, visual: offhandVisualKey };
    } else if (profile.slot === 'armor') {
        preview.job = resolvePreviewJobFromArmor(item, profile);
        preview.armorStyle = resolvePreviewArmorStyle(item, profile);
        preview.armor = { item, art: profile, visual: preview.armorStyle };
    }

    return preview;
};
