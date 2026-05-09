// cycle 395: '그림자 주군' (공백 포함) 키 제거 — resolveAppearanceKeys가 항상
//   `appearance.job.replace(/\s+/g, '')`로 공백을 strip 후 lookup해 with-space 키
//   unreachable. CLASSES.ts에서 dispatch된 '그림자 주군'은 normalize 후 '그림자주군'
//   단일 키로 hit. cycle 361 jobOutfitAffinity 동일 lens 회귀 (변형: normalize-bypass).
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

// cycle 395: weaponless adventurer sprite 정적 set 제거 — cycle 35 시점 작성된
//   future-use 데이터였으나 도입 path가 끝내 미실현. src/, tests/ read 0건.

// cycle 327: JOB_TYPICAL_LOADOUT export 제거 — 정의되어 있지만 production 사용 0건.
//   getAvatarSpriteCandidates 내부 사용도 0건. cycle 43-46 시점 outfit affinity 표시용으로
//   보존했으나 그 dispatch path는 끝내 미구현. 테스트만이 유일한 consumer였음 (paired remove).

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
