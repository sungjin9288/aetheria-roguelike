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

/** 아바타 스프라이트 후보 조합에 필요한 필드만 좁힌 로컬 뷰 — 캐릭터/장비 프리뷰 어피어런스 공용. */
interface AvatarAppearanceLike {
    job?: string;
    armorStyle?: string;
    loadoutStyle?: string;
    weapon?: unknown;
    offhand?: unknown;
}

// cycle 395: weaponless adventurer sprite 정적 set 제거 — cycle 35 시점 작성된
//   future-use 데이터였으나 도입 path가 끝내 미실현. src/, tests/ read 0건.

// cycle 327: JOB_TYPICAL_LOADOUT export 제거 — 정의되어 있지만 production 사용 0건.
//   getAvatarSpriteCandidates 내부 사용도 0건. cycle 43-46 시점 outfit affinity 표시용으로
//   보존했으나 그 dispatch path는 끝내 미구현. 테스트만이 유일한 consumer였음 (paired remove).

export const getAvatarSpriteCandidates = (appearance: AvatarAppearanceLike | null | undefined) => {
    const normalizedJob = String(appearance?.job || '모험가').replace(/\s+/g, '');
    const canonicalEntry = CANONICAL_ENTRY_BY_NORMALIZED_JOB[normalizedJob];
    if (canonicalEntry) return [canonicalEntry.runtimePath];

    // Unknown/corrupt legacy save data is the only remaining safe-placeholder path.
    return ['/assets/avatars/canonical/adventurer.png'];
};

// 2026-11: 장비 미리보기도 정식 초상화 하나를 쓴다 — 옛 무장별 초상화 52장은 그림체 · 얼굴이 정식 초상화와 달라
//   아이콘을 불러오지 못한 순간 다른 캐릭터처럼 보였고, 토스 번들 79 MiB 중 52 MiB를 차지했다.
//   미리보기의 직업(무기 · 방어구로 정한다)은 그대로 쓴다.
export const getAvatarEquipmentPreviewCandidates = (appearance: AvatarAppearanceLike | null | undefined) => (
    getAvatarSpriteCandidates({ job: appearance?.job })
);
