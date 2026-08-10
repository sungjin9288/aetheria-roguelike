import characterArtManifestSource from '../data/characterArtManifest.json' with { type: 'json' };

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

type CharacterArtEntry = {
    slug: string;
    runtimePath: string;
};

const canonicalCharacterEntries = characterArtManifestSource.entries as Record<string, CharacterArtEntry>;
const CANONICAL_ENTRY_BY_NORMALIZED_JOB = Object.freeze(
    Object.fromEntries(
        Object.entries(canonicalCharacterEntries).map(([job, entry]) => [
            job.replace(/\s+/g, ''),
            entry,
        ])
    ) as Record<string, CharacterArtEntry>
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

export const getAvatarSpriteCandidates = (appearance: any) => {
    const normalizedJob = String(appearance?.job || '모험가').replace(/\s+/g, '');
    const canonicalEntry = CANONICAL_ENTRY_BY_NORMALIZED_JOB[normalizedJob];
    if (canonicalEntry) return [canonicalEntry.runtimePath];

    // Unknown/corrupt legacy save data is the only remaining safe-placeholder path.
    return ['/assets/avatars/canonical/adventurer.png'];
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
