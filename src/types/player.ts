/**
 * Player domain types (cycle 58 phase 4).
 *
 * gameReducer.ts의 INITIAL_STATE.player 구조를 망라.
 * 점진 적용용 — strict하게 만들지 말고 필드는 optional 위주.
 */

import type { EquipSlots, Item, ConsumableItem } from './item.js';

export interface PlayerStats {
    kills?: number;
    total_gold?: number;
    deaths?: number;
    killRegistry?: Record<string, number>;
    bossKills?: number;
    rests?: number;
    bountyDate?: string | null;
    bountyIssued?: boolean;
    bountiesCompleted?: number;
    relicCount?: number;
    comboCount?: number;
    crafts?: number;
    abyssFloor?: number;
    abyssRecord?: number;
    demonKingSlain?: number;
    dailyProtocol?: { date?: string; completions?: number; claimed?: string[] } | null;
    claimedAchievements?: string[];
    explores?: number;
    lowHpWins?: number;
    discoveries?: number;
    buildWins?: Record<string, number>;
    visitedMaps?: string[];
    exploreState?: Record<string, unknown>;
    codex?: PlayerCodex;
    codexClaimed?: string[];
}

export interface PlayerCodex {
    weapons?: Record<string, true>;
    armors?: Record<string, true>;
    shields?: Record<string, true>;
    monsters?: Record<string, true>;
    recipes?: Record<string, true>;
    materials?: Record<string, true>;
}

export interface SignaturePity {
    drops?: number;
    pityResonance?: boolean;
}

export interface SkillLoadout {
    selected: number;
    cooldowns: Record<string, number>;
}

export interface TempBuff {
    atk?: number;
    def?: number;
    turn?: number;
    name?: string | null;
}

export interface PlayerMeta {
    essence?: number;
    rank?: number;
    bonusAtk?: number;
    bonusHp?: number;
    bonusMp?: number;
    prestigeRank?: number;
    totalPrestigeAtk?: number;
    totalPrestigeHp?: number;
    totalPrestigeMp?: number;
}

export interface CombatFlags {
    comboCount?: number;
    deathSaveUsed?: boolean;
    voidHeartUsed?: boolean;
    voidHeartArmed?: boolean;
}

export interface SeasonPassState {
    xp?: number;
    tier?: number;
    claimed?: string[];
    isPremium?: boolean;
    seasonId?: string;
}

export interface WeeklyProtocol {
    kills?: number;
    explores?: number;
    bossKills?: number;
    lastResetWeek?: number;
    claimed?: string[];
}

export interface Player {
    name: string;
    job: string;
    gender?: 'male' | 'female' | string;
    level: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    atk: number;
    def: number;
    exp: number;
    nextExp?: number;
    gold: number;
    loc: string;
    inv: Item[];
    equip: EquipSlots;
    quests?: string[];
    achievements?: string[];
    stats?: PlayerStats;
    premiumCurrency?: number;
    seasonPass?: SeasonPassState;
    weeklyProtocol?: WeeklyProtocol;
    skillChoices?: Record<string, string>;
    challengeModifiers?: string[];
    tempBuff?: TempBuff;
    status?: Array<{ name: string; turn: number; effect?: string }>;
    skillLoadout?: SkillLoadout;
    meta?: PlayerMeta;
    relics?: Array<{ id: string; name: string }>;
    titles?: string[];
    activeTitle?: string | null;
    combatFlags?: CombatFlags;
    killStreak?: number;
    history?: unknown[];
    archivedHistory?: unknown[];
    eventChainProgress?: Record<string, unknown>;
    signaturePity?: SignaturePity;
}
