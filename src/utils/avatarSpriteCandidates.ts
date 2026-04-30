export const JOB_SPRITE_SLUG_MAP: Record<string, string> = {
    모험가: 'adventurer',
    전사: 'warrior',
    나이트: 'knight',
    버서커: 'berserker',
    도적: 'rogue',
    어쌔신: 'assassin',
    레인저: 'ranger',
    마법사: 'mage',
    아크메이지: 'archmage',
    흑마법사: 'warlock',
    팔라딘: 'paladin',
    시간술사: 'chronomancer',
    그림자주군: 'shadow-lord',
    '그림자 주군': 'shadow-lord',
    대마법사: 'grand-mage',
};

const AVAILABLE_AVATAR_KEYS = new Set([
    'adventurer',
    'adventurer-archer',
    'adventurer-caster',
    'adventurer-coat',
    'adventurer-dagger',
    'adventurer-guardian',
    'adventurer-heavy',
    'adventurer-lancer',
    'adventurer-leather',
    'adventurer-plate',
    'adventurer-robe',
    'adventurer-sword',
    'archmage',
    'archmage-robe',
    'archmage-robe-caster',
    'assassin',
    'assassin-leather',
    'assassin-leather-dagger',
    'berserker',
    'berserker-plate',
    'berserker-plate-heavy',
    'chronomancer',
    'chronomancer-robe',
    'chronomancer-robe-caster',
    'grand-mage',
    'grand-mage-robe',
    'grand-mage-robe-caster',
    'knight',
    'knight-plate',
    'knight-plate-guardian',
    'mage',
    'mage-robe',
    'mage-robe-caster',
    'paladin',
    'paladin-plate',
    'paladin-plate-guardian',
    'ranger',
    'ranger-coat',
    'ranger-coat-archer',
    'rogue',
    'rogue-leather',
    'rogue-leather-dagger',
    'shadow-lord',
    'shadow-lord-leather',
    'shadow-lord-leather-dagger',
    'warlock',
    'warlock-robe',
    'warlock-robe-caster',
    'warrior',
    'warrior-plate',
    'warrior-plate-heavy',
    'warrior-plate-sword',
]);

const buildCandidatePaths = (orderedKeys: any) => (
    [...new Set(orderedKeys.filter((key: any) => key && AVAILABLE_AVATAR_KEYS.has(key)))]
        .map((key: any) => `/assets/avatars/${key}.png`)
);

const resolveAppearanceKeys = (appearance: any) => {
    const normalizedJob = String(appearance?.job || '모험가').replace(/\s+/g, '');
    const jobSlug = JOB_SPRITE_SLUG_MAP[normalizedJob] || JOB_SPRITE_SLUG_MAP[appearance?.job] || 'adventurer';
    const armorStyle = appearance?.armorStyle || 'coat';
    const loadoutStyle = appearance?.loadoutStyle || 'sword';

    return { jobSlug, armorStyle, loadoutStyle };
};

/**
 * 무기가 baked-in 되어있지 않은 베이스 sprite 셋.
 * AvatarEquipmentOverlay가 무기를 그리는데 베이스에도 무기가 있으면
 * 시각 충돌 + redundancy 발생. 이 셋의 sprite는 빈 손이라 overlay가 정상 동작.
 *
 * 시각 감사 결과 (cycle 35):
 *   ✓ adventurer (generic, weaponless)
 *   ✓ adventurer-coat (weaponless)
 *   ✓ adventurer-leather (weaponless)
 *   ✓ adventurer-sword (소형 sheathed dagger만, 큰 무기 없음)
 *   ✗ adventurer-plate (sword baked-in)
 *   ✗ adventurer-robe (staff baked-in)
 *   ✗ adventurer-dagger / archer / caster / guardian / heavy / lancer (loadout-specific weapon)
 */
const WEAPONLESS_ADVENTURER_SPRITES = new Set([
    'adventurer',
    'adventurer-coat',
    'adventurer-leather',
    'adventurer-sword',
]);

/**
 * 직업별 typical loadout — 직업이 캐릭터 정체성을 결정. 무기를 변경해도 sprite는
 * 직업의 typical 시각을 유지 (cycle 43 — 사용자 피드백: 무기 바꿨다고 캐릭터가
 * 다른 sprite로 바뀌면 안 됨).
 *
 * 무기 시각 차별화는 인벤토리/장비 슬롯 (cycle 36-40 chibi PNG) + 시그니처
 * dedicated overlay에서만.
 */
export const JOB_TYPICAL_LOADOUT = Object.freeze({
    warrior: 'sword',
    knight: 'guardian',
    berserker: 'heavy',
    rogue: 'dagger',
    assassin: 'dagger',
    ranger: 'archer',
    mage: 'caster',
    archmage: 'caster',
    warlock: 'caster',
    paladin: 'guardian',
    chronomancer: 'caster',
    'shadow-lord': 'dagger',
    'grand-mage': 'caster',
});

/**
 * 직업별 default sprite — cycle 46. armor/weapon 모두 sprite에 영향 X.
 * 오직 직업(전직)만이 sprite 결정. 장비 변경은 stat + 인벤토리 슬롯 시각 + outfit
 * set bonus mechanic으로만 차별화 (cycle 45 jobOutfitAffinity).
 *
 * 사용자 피드백: "장비를 교체했을때 아바타가 바뀌는건 직업이 바뀌는게 되는거"
 * → 캐릭터 sprite는 절대 흔들리지 않게 직업으로만 fix.
 *
 * 각 직업의 가장 풍부한 default sprite를 명시 매핑 (디테일 큰 sprite 우선).
 */
const JOB_DEFAULT_SPRITE: any = Object.freeze({
    adventurer: 'adventurer',
    warrior: 'warrior-plate-sword',
    knight: 'knight-plate-guardian',
    berserker: 'berserker-plate-heavy',
    rogue: 'rogue-leather-dagger',
    assassin: 'assassin-leather-dagger',
    ranger: 'ranger-coat-archer',
    mage: 'mage-robe-caster',
    archmage: 'archmage-robe-caster',
    warlock: 'warlock-robe-caster',
    paladin: 'paladin-plate-guardian',
    chronomancer: 'chronomancer-robe-caster',
    'shadow-lord': 'shadow-lord-leather-dagger',
    'grand-mage': 'grand-mage-robe-caster',
});

export const getAvatarSpriteCandidates = (appearance: any) => {
    const { jobSlug } = resolveAppearanceKeys(appearance);

    // cycle 46: armor/loadout 모두 sprite에 영향 X. 직업만이 sprite 결정.
    // 장비 변경 = stat + 인벤토리 슬롯 + outfit set bonus 메카닉 (cycle 45).
    // 이렇게 해야 "캐릭터 정체성"이 흔들리지 않고 진짜 RPG 정체성 시스템.
    const orderedKeys = [
        JOB_DEFAULT_SPRITE[jobSlug] || null,
        jobSlug,
        'adventurer',
    ];

    return buildCandidatePaths(orderedKeys);
};

export const getAvatarEquipmentPreviewCandidates = (appearance: any) => {
    const { jobSlug, armorStyle, loadoutStyle } = resolveAppearanceKeys(appearance);
    const emphasizesLoadout = Boolean(appearance?.weapon || appearance?.offhand);

    const orderedKeys = emphasizesLoadout
        ? [
            `${jobSlug}-${armorStyle}-${loadoutStyle}`,
            `${jobSlug}-${loadoutStyle}`,
            `${jobSlug}-${armorStyle}`,
            jobSlug,
            `adventurer-${loadoutStyle}`,
            `adventurer-${armorStyle}`,
            'adventurer',
        ]
        : [
            `${jobSlug}-${armorStyle}-${loadoutStyle}`,
            `${jobSlug}-${armorStyle}`,
            `${jobSlug}-${loadoutStyle}`,
            jobSlug,
            `adventurer-${armorStyle}`,
            `adventurer-${loadoutStyle}`,
            'adventurer',
        ];

    return buildCandidatePaths(orderedKeys);
};
