import type { Item } from '../types/index.js';
import { ITEMS } from '../data/items.js';
import signatureRegistrySource from '../data/signatureRegistry.json' with { type: 'json' };
import equipmentArtManifest from '../data/equipmentArtManifest.json' with { type: 'json' };
import consumableArtManifest from '../data/consumableArtManifest.json' with { type: 'json' };
import { isFocusOffhand, isShield, isTwoHandWeapon, isWeapon, isMagicWeapon } from './equipmentUtils.js';

// slice 26: 장비 아이템별 고유 아트 매니페스트 — generate_equipment_item_art.py가
//   family 실루엣 + elem/tier 톤 리컬러로 229종 전수 생성. family 공유 그림
//   ('수련생의 검' == '강철 롱소드') 문제 해소. signature보다는 후순위.
const AUTO_EQUIPMENT_ART_BY_NAME: Record<string, string> = Object.freeze(
    (equipmentArtManifest as any).entries || {}
);

// slice 27: 비장비(소모품/재료) 아이템별 고유 아트 — 물약 14종이 전부 같은
//   빨간 potion.png(마나 물약도 빨간 병)이던 문제 해소. 소모품은 type 기반
//   톤(hp 적/mp 청/cure 녹/buff 금), 재료는 self-jitter 변주.
const AUTO_NONEQUIP_ART_BY_NAME: Record<string, string> = Object.freeze(
    (consumableArtManifest as any).entries || {}
);

// Signature item sprite overrides (Tier S 고유 아트). family/SPECIAL fallback보다 우선.
const SIGNATURE_SPRITE_KEY_BY_NAME: any = Object.freeze(
    Object.fromEntries(
        Object.entries(signatureRegistrySource.entries).map(([name, meta]: any) => [name, meta.spriteKey])
    )
);

export const SPECIAL_ITEM_ICON_KEYS: Record<string, string> = {
    '성검 에테르니아': 'named-weapon-01',
    '천벌의 지팡이': 'named-weapon-02',
    '마왕의 대낫': 'named-weapon-03',
    '바람의 궁극': 'named-weapon-04',
    '그림자 절단기': 'named-weapon-05',
    '라그나로크': 'named-weapon-06',
    '빙결의 왕관검': 'named-weapon-07',
    '세계수의 지팡이': 'named-weapon-08',
    '에테르 세이버': 'named-weapon-09',
    '성운 지팡이': 'named-weapon-10',
    '파멸의 검': 'named-weapon-11',
    '성스러운 창': 'named-weapon-12',
    '차원절단자': 'named-weapon-13',
    '용의 화염': 'named-weapon-14',
    '빙하의 지팡이': 'named-weapon-15',
    '공허의 대검': 'named-weapon-16',
    '에테르 플럭스 로드': 'named-weapon-17',
    '차원 붕괴창': 'named-weapon-18',
    '허공의 지팡이': 'named-weapon-19',
    '에테르 심판궁': 'named-weapon-20',
    '영겁의 세이버': 'named-weapon-21',
    '혼돈 절멸기': 'named-weapon-22',
    '영혼 절단자': 'named-weapon-23',
    '대지의 심판': 'named-weapon-24',
    '에테르 거인의 대검': 'named-weapon-25',
    '차원 마왕의 낫': 'named-weapon-26',
    '천상의갑주': 'named-armor-01',
    '현자의 예복': 'named-armor-02',
    '암흑 군주의 망토': 'named-armor-03',
    '전설의 사냥꾼 외투': 'named-armor-04',
    '광기의 갑주': 'named-armor-05',
    '드래곤로드 갑주': 'named-armor-06',
    '세계수의 로브': 'named-armor-07',
    '어둠의 왕 갑주': 'named-armor-08',
    '심해의 수호복': 'named-armor-09',
    '천공 성전': 'named-shield-01',
    '차원 방패 이지스': 'named-shield-02',
    '에테르 그리모어': 'named-shield-03',
    '세계의 방패': 'named-shield-04',
    '원시의 이지스': 'named-shield-05',
    '세계수의 검': 'named-weapon-27',
    '신전 도시의 지팡이': 'named-weapon-28',
    '균열의 날': 'named-weapon-29',
    '세계수 절멸창': 'named-weapon-30',
    '시간 파편 소드': 'named-weapon-31',
    '세계수 갑주': 'named-armor-10',
    '신전 제관 예복': 'named-armor-11',
    '균열 외피갑옷': 'named-armor-12',
    '신전 도시의 성의': 'named-armor-13',
    '세계수 뿌리 갑옷': 'named-armor-14',
    '에테르 전투복': 'named-armor-15',
    '혼돈의 갑주': 'named-armor-16',
    '차원 갑주': 'named-armor-17',
    '에테르 군주 로브': 'named-armor-18',
    '천상의 갑옷': 'named-armor-19',
    '차원의 로브': 'named-armor-20',
    '용비늘 갑주': 'named-armor-21',
    '공허의 전투 외투': 'named-armor-22',
    '별빛 경갑': 'named-armor-23',
    '원시의 전투갑주': 'named-armor-24',
    '에테르 로브 오브 아포칼립스': 'named-armor-25',
    '공허의 외투': 'named-armor-26',
    '드래곤 임페리얼': 'named-armor-27',
    '차원 사냥꾼 슈트': 'named-armor-28',
    '광기의 대갑주': 'named-armor-29',
};

// cycle 424: 'undefined' 엔트리 제거 — `obj[item.type] || 'misc'` 패턴에서
//   item.type 부재 시 lookup이 undefined 반환 → `||` fallback이 동일 'misc'
//   산출. 엔트리는 기능적 잉여 (defensive fallback redundancy).
const EXACT_ICON_CATEGORY_BY_TYPE: any = {
    weapon: 'weapon',
    armor: 'armor',
    shield: 'shield',
    hp: 'consumable',
    mp: 'consumable',
    cure: 'consumable',
    buff: 'consumable',
    mat: 'material',
    key: 'key',
    all: 'relic',
};

const buildExactItemIconKeys = () => {
    const counters: Record<string, number> = {};
    const exactKeys: Record<string, string> = {};
    const allItems = (Object.values(ITEMS).flat() as any[]).filter(Boolean);

    for (const item of allItems) {
        if (!item?.name) continue;
        if (SPECIAL_ITEM_ICON_KEYS[item.name as string]) continue;
        if (exactKeys[item.name]) continue;

        const category = EXACT_ICON_CATEGORY_BY_TYPE[item.type] || 'misc';
        counters[category] = (counters[category] || 0) + 1;
        exactKeys[item.name] = `item-${category}-${String(counters[category]).padStart(3, '0')}`;
    }

    return exactKeys;
};

export const EXACT_ITEM_ICON_KEYS = buildExactItemIconKeys();

export const ITEM_ICON_ASSET_KEYS = [
    'sword',
    'greatsword',
    'dagger',
    'staff',
    'wand',
    'bow',
    'axe',
    'hammer',
    'spear',
    'scythe',
    'whip',
    'armor',
    'robe',
    'cloak',
    'boots',
    'shield',
    'book',
    'potion',
    'material',
    'ore',
    'crystal',
    'scale',
    'fang',
    'bone',
    'core',
    'relic',
    'herb',
    'pouch',
    'key',
    ...Object.values(SPECIAL_ITEM_ICON_KEYS),
    ...Object.values(EXACT_ITEM_ICON_KEYS),
];

export const EQUIPMENT_FAMILY_ITEM_ASSET_KEYS = [
    'weapon-sword',
    'weapon-dagger',
    'weapon-heavy',
    'weapon-bow',
    'weapon-staff',
    'weapon-lance',
    'weapon-whip',
    'offhand-shield',
    'offhand-book',
    'headgear-straw-hat',
    'headgear-cap',
    'headgear-wizard-hat',
    'headgear-circlet',
    'headgear-helm',
    'headgear-hood',
    'headgear-mask',
    'armor-coat',
    'armor-leather',
    'armor-robe',
    'armor-plate',
    'armor-cloak',
    'armor-boots',
];

export const EQUIPMENT_FAMILY_OVERLAY_ASSET_KEYS = [
    'headgear-straw-hat',
    'headgear-cap',
    'headgear-wizard-hat',
    'headgear-circlet',
    'headgear-helm',
    'headgear-hood',
    'headgear-mask',
    'armor-coat',
    'armor-leather',
    'armor-robe',
    'armor-plate',
    'armor-cloak',
    'armor-boots',
    'weapon-sword',
    'weapon-dagger',
    'weapon-heavy',
    'weapon-bow',
    'weapon-staff',
    'weapon-lance',
    'weapon-whip',
    'offhand-shield',
    'offhand-book',
];

export const NON_EQUIPMENT_FAMILY_ITEM_ASSET_KEYS = [
    'potion',
    'material',
    'ore',
    'crystal',
    'scale',
    'fang',
    'bone',
    'core',
    'relic',
    'herb',
    'pouch',
    'key',
];

// cycle 512: fallback default 제거 — 7 callsite 모두 fallback 명시 전달이라
//   default 'coat' 도달 불가. util default 청소 메가 시리즈 10번째 (cycle 502-511).
export const getArmorStyleFromItem = (armor: any, fallback: any) => {
    if (!armor || armor.type !== 'armor') return fallback;
    const name = String(armor.name || '');

    if (name.includes('로브') || name.includes('예복') || name.includes('성의')) return 'robe';
    if (name.includes('가죽') || name.includes('경갑') || name.includes('조끼') || name.includes('외피') || name.includes('야복')) return 'leather';
    if (name.includes('망토') || name.includes('외투') || name.includes('튜닉') || name.includes('전투복')) return 'coat';
    if (name.includes('갑') || name.includes('흉갑') || name.includes('갑주') || name.includes('판금')) return 'plate';
    return fallback;
};

export const getWeaponVisualKey = (weapon: any) => {
    if (!isWeapon(weapon)) return 'none';
    const name = String(weapon.name || '');

    if (name.includes('표창')) return 'throwing-blade';
    if (name.includes('활') || name.includes('궁')) return (name.includes('장궁') || name.includes('심판궁') || name.includes('궁극')) ? 'longbow' : 'bow';
    if (name.includes('창')) return (name.includes('장창') || name.includes('중창') || name.includes('기병창')) ? 'lance' : 'spear';
    if (name.includes('낫')) return 'scythe';
    if (name.includes('도끼')) return isTwoHandWeapon(weapon) ? 'greataxe' : 'axe';
    if (name.includes('해머') || name.includes('망치')) return 'hammer';
    if (name.includes('철퇴') || name.includes('메이스') || name.includes('곤봉')) return 'mace';
    if (name.includes('단검') || name.includes('절멸기')) return 'dagger';
    if (name.includes('송곳니') || name.includes('독아')) return 'fang-dagger';
    if (name.includes('채찍')) return 'whip';
    if (name.includes('레이피어')) return 'rapier';
    if (name.includes('세이버') || name.includes('시미터')) return 'saber';
    if (name.includes('팔치온')) return 'falchion';
    if (name.includes('포크')) return 'fork';
    if (name.includes('쌍칼')) return 'twinblade';
    if (isMagicWeapon(weapon)) {
        if (name.includes('로드')) return 'rod';
        return isTwoHandWeapon(weapon) ? 'staff' : 'wand';
    }

    return isTwoHandWeapon(weapon) ? 'greatsword' : 'sword';
};

export const getOffhandVisualKey = (item: Item | null | undefined) => {
    if (!item) return 'none';
    if (isFocusOffhand(item)) return 'book';
    if (isShield(item)) return 'shield';
    if (isWeapon(item)) return getWeaponVisualKey(item);
    return 'none';
};

// cycle 294: export 제거 — getEquipmentVisualKey 내부 1회만 사용, 외부 consumer 0건.
const getMaterialVisualKey = (item: Item | null | undefined) => {
    if (!item) return 'material';
    const name = String(item.name || '');

    if (item.type === 'key' || name.includes('열쇠')) return 'key';
    if (name.includes('동전') || name.includes('주머니')) return 'pouch';
    if (name.includes('광석') || name.includes('원석') || name.includes('금속') || name.includes('오리할콘')) return 'ore';
    if (name.includes('결정') || name.includes('수정') || name.includes('마력석') || name.includes('진주')) return 'crystal';
    if (name.includes('비늘') || name.includes('가죽') || name.includes('날개') || name.includes('깃털') || name.includes('붕대')) return 'scale';
    if (name.includes('이빨') || name.includes('송곳니')) return 'fang';
    if (name.includes('뼈')) return 'bone';
    if (name.includes('핵') || name.includes('심장') || name.includes('정수') || name.includes('코어') || name.includes('혼') || name.includes('잉크')) return 'core';
    if (name.includes('각인석') || name.includes('문장') || name.includes('파편')) return 'relic';
    if (name.includes('포자') || name.includes('이슬') || name.includes('눈물') || name.includes('성수') || name.includes('젤리') || name.includes('피')) return 'herb';
    return 'material';
};

const TYPED_CATALOG_ITEM_BY_NAME: Record<string, any> = Object.freeze(
    Object.fromEntries(
        (Object.values(ITEMS).flat() as any[])
            .filter((item) => item?.name && item?.type)
            .map((item) => [item.name, item])
    )
);

const getTypedVisualItem = (item: Item | null | undefined) => {
    if (!item?.name || item.type) return item;
    return TYPED_CATALOG_ITEM_BY_NAME[item.name as string] || item;
};

export const getEquipmentVisualKey = (item: Item | null | undefined) => {
    const visualItem = getTypedVisualItem(item);
    if (!visualItem) return 'material';
    if (SPECIAL_ITEM_ICON_KEYS[visualItem.name as string]) return SPECIAL_ITEM_ICON_KEYS[visualItem.name as string];
    if (EXACT_ITEM_ICON_KEYS[visualItem.name as string]) return EXACT_ITEM_ICON_KEYS[visualItem.name as string];

    if (visualItem.type === 'weapon') return getWeaponVisualKey(visualItem);
    if (visualItem.type === 'armor') {
        const armorStyle = getArmorStyleFromItem(visualItem, 'coat');
        if (armorStyle === 'robe') return 'robe';
        if (armorStyle === 'coat' || armorStyle === 'leather') return 'cloak';
        return 'armor';
    }
    if (visualItem.type === 'shield') return isFocusOffhand(visualItem) ? 'book' : 'shield';
    if (visualItem.type === 'hp' || visualItem.type === 'mp' || visualItem.type === 'cure' || visualItem.type === 'buff') return 'potion';
    if (visualItem.type === 'mat' || visualItem.type === 'key') return getMaterialVisualKey(visualItem);
    return 'material';
};

const HEADGEAR_PATTERN = /(모자|두건|후드|투구|헬름|왕관|관|면갑|복면)/;

export const getEquipmentIllustrationFamilyKey = (item: Item | null | undefined) => {
    const visualItem = getTypedVisualItem(item);
    if (!visualItem || !['weapon', 'armor', 'shield'].includes(visualItem.type as string)) return null;

    if (visualItem.type === 'weapon') {
        const weaponKey = getWeaponVisualKey(visualItem);
        if (['sword', 'rapier', 'saber', 'falchion', 'fork'].includes(weaponKey)) return 'weapon-sword';
        if (['dagger', 'fang-dagger', 'throwing-blade', 'twinblade'].includes(weaponKey)) return 'weapon-dagger';
        if (['axe', 'greataxe', 'hammer', 'mace'].includes(weaponKey)) return 'weapon-heavy';
        if (['bow', 'longbow'].includes(weaponKey)) return 'weapon-bow';
        if (['staff', 'rod', 'wand'].includes(weaponKey)) return 'weapon-staff';
        if (['spear', 'lance', 'scythe'].includes(weaponKey)) return 'weapon-lance';
        if (weaponKey === 'whip') return 'weapon-whip';
        return 'weapon-sword';
    }

    if (visualItem.type === 'shield') {
        return isFocusOffhand(visualItem) ? 'offhand-book' : 'offhand-shield';
    }

    const name = String(visualItem.name || '');
    if (name.includes('짚')) return 'headgear-straw-hat';
    if (name.includes('마법 모자') || name.includes('현자의 관')) return 'headgear-wizard-hat';
    if (name.includes('제관') || name.includes('왕관') || name.includes('관')) return 'headgear-circlet';
    if (name.includes('복면')) return 'headgear-mask';
    if (name.includes('두건') || name.includes('후드')) return 'headgear-hood';
    if (name.includes('투구') || name.includes('헬름')) return 'headgear-helm';
    if (name.includes('모자')) return 'headgear-cap';
    if (name.includes('장화') || name.includes('부츠')) return 'armor-boots';
    if (HEADGEAR_PATTERN.test(name) && !name.includes('갑') && !name.includes('로브') && !name.includes('예복') && !name.includes('성의') && !name.includes('외투') && !name.includes('망토') && !name.includes('튜닉') && !name.includes('조끼') && !name.includes('전투복') && !name.includes('경갑') && !name.includes('야복')) {
        return 'headgear-cap';
    }

    const armorStyle = getArmorStyleFromItem(visualItem, 'coat');
    if (armorStyle === 'robe') return 'armor-robe';
    if (armorStyle === 'plate') return 'armor-plate';
    if (armorStyle === 'leather') return 'armor-leather';
    if (name.includes('망토') || name.includes('외투')) return 'armor-cloak';
    return 'armor-coat';
};

export const getEquipmentWearableFamilyKey = (item: Item | null | undefined) => {
    const visualItem = getTypedVisualItem(item);
    if (!visualItem || !['weapon', 'armor', 'shield'].includes(visualItem.type as string)) return null;
    return getEquipmentIllustrationFamilyKey(item);
};

export const getNonEquipmentIllustrationFamilyKey = (item: Item | null | undefined) => {
    const visualItem = getTypedVisualItem(item);
    if (!visualItem || ['weapon', 'armor', 'shield'].includes(visualItem.type as string)) return null;
    if (visualItem.type === 'hp' || visualItem.type === 'mp' || visualItem.type === 'cure' || visualItem.type === 'buff') return 'potion';
    if (visualItem.type === 'key') return 'key';
    if (visualItem.type === 'all') return 'relic';
    if (visualItem.type === 'mat') return getMaterialVisualKey(visualItem);
    return getMaterialVisualKey(visualItem);
};

export const shouldUseAvatarPreviewItemIcon = (item: Item | null | undefined) => {
    const familyKey = getEquipmentIllustrationFamilyKey(item);
    // Item surfaces should read as a unified equipment set. Avatar previews stay
    // as an image-load fallback only; mixing character thumbnails with item PNGs
    // made shop/inventory equipment look like different art systems.
    if (!familyKey) return false;
    return false;
};

export const getItemIconAssetKey = (item: Item | null | undefined) => getEquipmentVisualKey(item);

/**
 * cycle 40에서 chibi 결로 derive된 PNG가 있는 item 키 set.
 * 이 set의 키는 .png로 로드 (procedural SVG 대신).
 * scripts/derive_item_variants.py가 생성한 PNG들 등록.
 */
// cycle 294: export 제거 — getItemIconAssetExtension 내부 1회만 사용, 외부 consumer 0건.
const IMAGEGEN_ITEM_PNG_KEYS = new Set([
    // hp / mp / cure / buff (consumable) — potion.png base + hue-rotate
    'item-consumable-001', 'item-consumable-002', 'item-consumable-003', 'item-consumable-004',
    'item-consumable-005', 'item-consumable-006', 'item-consumable-007',
    'item-consumable-008', 'item-consumable-009', 'item-consumable-010', 'item-consumable-011',
    'item-consumable-012', 'item-consumable-013', 'item-consumable-014',
    // mat (재료) — herb/ore/scale/bone/fang/crystal/core/relic/pouch/material base
    'item-material-001', 'item-material-002', 'item-material-003', 'item-material-004',
    'item-material-005', 'item-material-006', 'item-material-007', 'item-material-008',
    'item-material-009', 'item-material-010', 'item-material-011', 'item-material-012',
    'item-material-013', 'item-material-014', 'item-material-015', 'item-material-016',
    'item-material-017', 'item-material-018', 'item-material-019', 'item-material-020',
    'item-material-021', 'item-material-022', 'item-material-023', 'item-material-024',
    'item-material-025', 'item-material-026', 'item-material-027', 'item-material-028',
    'item-material-029', 'item-material-030', 'item-material-031', 'item-material-032',
    'item-material-033', 'item-material-034', 'item-material-035', 'item-material-036',
    'item-material-037', 'item-material-038', 'item-material-039', 'item-material-040',
    'item-material-041', 'item-material-042', 'item-material-043', 'item-material-044',
    'item-material-045', 'item-material-046', 'item-material-047', 'item-material-048',
    'item-material-049', 'item-material-050', 'item-material-051', 'item-material-052',
    'item-material-053', 'item-material-054',
    // key
    'item-key-001', 'item-key-002',
    // all (relic) — relic.png base + name hint
    'item-relic-001', 'item-relic-002', 'item-relic-003', 'item-relic-004',
    'item-relic-005', 'item-relic-006', 'item-relic-007',
]);

// cycle 294: export 제거 — getItemIconAssetSrc 내부 1회만 사용, 외부 consumer 0건.
const getItemIconAssetExtension = (assetKey: any) => {
    const k = String(assetKey || '');
    // chibi PNG 우선 로드 (cycle 40)
    if (IMAGEGEN_ITEM_PNG_KEYS.has(k)) return 'png';
    return k.startsWith('item-') ? 'svg' : 'png';
};
export const getExactEquipmentItemAssetKey = (item: Item | null | undefined) => {
    const visualItem = getTypedVisualItem(item);
    if (!visualItem || !['weapon', 'armor', 'shield'].includes(visualItem.type as string)) return null;
    // 우선순위: 고유 signature art → named(tinted) → auto-exact
    return SIGNATURE_SPRITE_KEY_BY_NAME[visualItem.name as string]
        || SPECIAL_ITEM_ICON_KEYS[visualItem.name as string]
        || EXACT_ITEM_ICON_KEYS[visualItem.name as string]
        || null;
};
export const getItemIconAssetSrc = (item: Item | null | undefined) => {
    const visualItem = getTypedVisualItem(item);
    const signatureEquipmentKey = visualItem?.name ? SIGNATURE_SPRITE_KEY_BY_NAME[visualItem.name as string] : null;
    if (signatureEquipmentKey) {
        return `/assets/equipment-exact/${signatureEquipmentKey}.png`;
    }
    // slice 26: 아이템별 고유 아트 우선 — family 공유 그림은 매니페스트 미등록
    //   아이템(신규 추가 직후 등)의 fallback으로만 유지.
    const autoEquipmentKey = visualItem?.name ? AUTO_EQUIPMENT_ART_BY_NAME[visualItem.name as string] : null;
    if (autoEquipmentKey) {
        return `/assets/equipment-exact/${autoEquipmentKey}.png`;
    }
    const equipmentFamilyKey = getEquipmentIllustrationFamilyKey(visualItem);
    if (equipmentFamilyKey) {
        return `/assets/equipment-family/items/${equipmentFamilyKey}.png`;
    }
    // slice 27: 비장비도 아이템별 고유 아트 우선 — family 그림은 매니페스트
    //   미등록(신규 아이템) fallback.
    const autoNonEquipKey = visualItem?.name ? AUTO_NONEQUIP_ART_BY_NAME[visualItem.name as string] : null;
    if (autoNonEquipKey) {
        return `/assets/items/${autoNonEquipKey}.png`;
    }
    const nonEquipmentFamilyKey = getNonEquipmentIllustrationFamilyKey(visualItem);
    if (nonEquipmentFamilyKey) {
        return `/assets/items/${nonEquipmentFamilyKey}.png`;
    }
    const exactEquipmentKey = getExactEquipmentItemAssetKey(visualItem);
    if (exactEquipmentKey) {
        return `/assets/equipment-exact/${exactEquipmentKey}.png`;
    }
    const assetKey = getItemIconAssetKey(visualItem);
    return `/assets/items/${assetKey}.${getItemIconAssetExtension(assetKey)}`;
};
export const getEquipmentOverlayAssetSrc = (item: Item | null | undefined) => {
    // cycle 45 (사용자 피드백 — "합성 느낌이 부자연, 진짜 착용 느낌이어야"):
    // 일반 장비 overlay는 본질적으로 sprite 위에 합성되는 형태라 "착용 느낌"을 못 만듬.
    // 시그니처만 dedicated overlay (강조 효과). 일반 장비 차별화는:
    //   - 인벤토리/장비 슬롯의 chibi PNG (cycle 36-40)
    //   - sprite swap (cycle 43 직업×armor priority)
    //   - outfit set bonus (cycle 45 — 새 mechanic)
    if (item?.name && SIGNATURE_SPRITE_KEY_BY_NAME[item.name as string]) {
        return `/assets/equipment-wearable-exact/${SIGNATURE_SPRITE_KEY_BY_NAME[item.name as string]}.png`;
    }
    return null;
};

export const getAvatarLoadoutStyle = (weaponVisualKey: any, offhandVisualKey: any) => {
    if (offhandVisualKey === 'shield') return 'guardian';
    if (weaponVisualKey === 'bow' || weaponVisualKey === 'longbow') return 'archer';
    if (weaponVisualKey === 'staff' || weaponVisualKey === 'rod' || weaponVisualKey === 'wand' || offhandVisualKey === 'book') return 'caster';
    if (['dagger', 'fang-dagger', 'throwing-blade', 'twinblade'].includes(weaponVisualKey) || offhandVisualKey === 'dagger') return 'dagger';
    if (weaponVisualKey === 'spear' || weaponVisualKey === 'lance' || weaponVisualKey === 'scythe') return 'lancer';
    if (['axe', 'greataxe', 'hammer', 'mace', 'greatsword'].includes(weaponVisualKey)) return 'heavy';
    return 'sword';
};
