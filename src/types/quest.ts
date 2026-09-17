/**
 * Quest / Achievement domain types (2026-07 타입화 — quests.js QUESTS/ACHIEVEMENTS export).
 *
 * 143개 퀘스트 + 73개 업적을 망라한다.
 *
 * 2026-09 L stage 1: `[key: string]: any` 인덱스 시그니처 3개 제거.
 * QUESTS/ACHIEVEMENTS 실측 필드만 선언하고, 닫힌 집합(`type` / 업적 `target` /
 * `buildTag` / reward 키)은 리터럴 유니온으로 고정했다.
 */

/**
 * 보상 형태 — QUESTS 143개 + ACHIEVEMENTS 73개에 등장하는 키 전체(5종).
 */
export interface QuestReward {
    exp?: number;
    gold?: number;
    /** 지급 아이템 이름 (DB.ITEMS 이름과 매칭). */
    item?: string;
    /** 칭호 보상 (스토리 퀘스트 5개만 보유). */
    title?: string;
    /** 프리미엄 화폐 보상 (업적 5개만 보유). */
    premiumCurrency?: number;
}

export type QuestType =
    | 'bounty_count'
    | 'build_victory'
    | 'combat_count'
    | 'craft'
    | 'discovery_count'
    | 'escape_count'
    | 'explore_count'
    | 'signature_collect'
    | 'survive_low_hp';

/** 빌드 지향 퀘스트의 성향 태그 (questOperations.ts getQuestLane/scoreQuest). */
export type QuestBuildTag = 'arcane' | 'crusher' | 'dual' | 'explorer' | 'fortress';

export interface Quest {
    id?: number | string;
    title?: string;
    desc?: string;
    /**
     * 진행 카운터 키. 몬스터 처치 퀘스트는 몬스터 이름(개방 집합)이고,
     * 그 외에는 `level` / `kills` / `explores` 같은 통계 키다
     * (Wave 3 H5에서 `'Level'` → `'level'` 로 대소문자 통일).
     */
    target?: string;
    goal?: number;
    reward?: QuestReward;
    minLv?: number;
    location?: string;
    prerequisiteQuestId?: number | string;
    type?: QuestType;
    buildTag?: QuestBuildTag;
    /** 빌드 퀘스트 UI 라벨 (buildTag와 짝). */
    buildLabel?: string;
    /** 빌드 퀘스트의 달성 조건 설명 (buildTag와 짝). */
    objective?: string;
    /** `survive_low_hp` 계열의 HP 비율 임계값. */
    threshold?: number;
}

/**
 * 업적의 진행 카운터 키 — ACHIEVEMENTS 73개가 쓰는 20종.
 * 퀘스트와 달리 몬스터 이름을 쓰지 않아 닫힌 집합이다.
 */
export type AchievementTarget =
    | 'abyssRecord'
    | 'bossKills'
    | 'bountiesCompleted'
    | 'crafts'
    | 'deaths'
    | 'demonKingSlain'
    | 'discoveries'
    | 'discoveryChains'
    | 'escapes'
    | 'explores'
    | 'kills'
    | 'level'
    | 'maxKillStreak'
    | 'prestige'
    | 'relicCount'
    | 'rests'
    | 'signatureSetsCompleted'
    | 'signaturesDiscovered'
    | 'synths'
    | 'total_gold';

export interface Achievement {
    id?: string;
    title?: string;
    desc?: string;
    target?: AchievementTarget;
    goal?: number;
    reward?: QuestReward;
}
