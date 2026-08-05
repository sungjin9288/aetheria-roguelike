/**
 * Quest / Achievement domain types (2026-07 타입화 — quests.js QUESTS/ACHIEVEMENTS export).
 *
 * 143개 퀘스트 + 73개 업적을 망라하는 최소 permissive 인터페이스.
 * reward 형태가 { exp, gold, item? } 등으로 다양해 val과 마찬가지로 폭넓게 둔다.
 */

export interface QuestReward {
    exp?: number;
    gold?: number;
    item?: string;
    [key: string]: any;
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

export interface Quest {
    id?: number | string;
    title?: string;
    desc?: string;
    target?: string;
    goal?: number;
    reward?: QuestReward;
    minLv?: number;
    location?: string;
    prerequisiteQuestId?: number | string;
    type?: QuestType;
    [key: string]: any;
}

export interface Achievement {
    id?: string;
    title?: string;
    desc?: string;
    target?: string;
    goal?: number;
    reward?: QuestReward;
    [key: string]: any;
}
