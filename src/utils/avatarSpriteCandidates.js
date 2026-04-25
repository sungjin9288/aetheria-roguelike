export const JOB_SPRITE_SLUG_MAP = {
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

const buildCandidatePaths = (orderedKeys) => (
    [...new Set(orderedKeys.filter((key) => key && AVAILABLE_AVATAR_KEYS.has(key)))]
        .map((key) => `/assets/avatars/${key}.png`)
);

const resolveAppearanceKeys = (appearance) => {
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

export const getAvatarSpriteCandidates = (appearance) => {
    const { jobSlug, armorStyle, loadoutStyle } = resolveAppearanceKeys(appearance);

    const armorKey = `adventurer-${armorStyle}`;
    const loadoutKey = `adventurer-${loadoutStyle}`;
    const isArmorWeaponless = WEAPONLESS_ADVENTURER_SPRITES.has(armorKey);
    // jobSlug === 'adventurer'면 job-specific 라인이 adventurer-{armor}/adventurer-{loadout}로
    // 풀려서 weaponful sprites가 top priority가 됨. 'adventurer' job은 job-specific 라인을 skip하고
    // 곧바로 weaponless 우선순위로 진입.
    const useJobSpecific = jobSlug !== 'adventurer';

    // 우선순위 (cycle 41 — 자연스러운 장비 착용감 우선):
    // 1-4. job-specific 매치 (class identity 보존)
    // 5. armor가 weaponful이면 그것 prefer (예: adventurer-plate = plate+sword 통합)
    //    armor가 weaponless면 loadout sprite로 폴백 (예: adventurer-dagger = hood+daggers)
    // 6. 위와 반대 케이스
    // 7. adventurer (generic 폴백)
    //
    // 사용자 QA 피드백: weaponless 베이스 + overlay floating dagger가 부자연스럽다
    // → weapon-baked-in sprite 우선시로 "캐릭터가 자연스럽게 장비 착용"한 시각 확보.
    const orderedKeys = [
        useJobSpecific ? `${jobSlug}-${armorStyle}-${loadoutStyle}` : null,
        useJobSpecific ? `${jobSlug}-${armorStyle}` : null,
        useJobSpecific ? `${jobSlug}-${loadoutStyle}` : null,
        useJobSpecific ? jobSlug : null,
        // weaponless armor → loadout sprite (weapon baked-in) 우선
        // weaponful armor → 그 자체로 자연스러우니 그것 우선
        isArmorWeaponless ? loadoutKey : armorKey,
        isArmorWeaponless ? armorKey : loadoutKey,
        'adventurer',
    ];

    return buildCandidatePaths(orderedKeys);
};

export const getAvatarEquipmentPreviewCandidates = (appearance) => {
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
