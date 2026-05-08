/**
 * Player domain types (cycle 58 phase 4).
 *
 * gameReducer.ts의 INITIAL_STATE.player 구조를 망라.
 * 점진 적용용 — strict하게 만들지 말고 필드는 optional 위주.
 */

import type { EquipSlots, Item, ConsumableItem } from './item.js';

/**
 * PlayerStats — `[key: string]: any` 인덱스 시그니처로 ad-hoc 필드 허용.
 * (signaturePity, areaBossDefeated, codexBonusAtk 등 동적 추가).
 */
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
    // cycle 280: comboCount 제거 — stats에 set/read 0건. active combo는 player.combatFlags.comboCount.
    crafts?: number;
    abyssFloor?: number;
    abyssRecord?: number;
    demonKingSlain?: number;
    dailyProtocol?: any;
    claimedAchievements?: string[];
    explores?: number;
    lowHpWins?: number;
    // cycle 280: discoveries 제거 — cycle 83/84 deprecated (visitedMaps.length로 통일).
    buildWins?: Record<string, number>;
    visitedMaps?: string[];
    exploreState?: Record<string, any>;
    codex?: PlayerCodex;
    codexClaimed?: string[];
    [key: string]: any;
}

export interface PlayerCodex {
    weapons?: Record<string, any>;
    armors?: Record<string, any>;
    shields?: Record<string, any>;
    monsters?: Record<string, any>;
    recipes?: Record<string, any>;
    materials?: Record<string, any>;
    [key: string]: any;
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
    // cycle 281: totalPrestigeAtk/Hp/Mp 3 dead 필드 제거 (cycle 277 runtime cleanup paired completion).
    //   runtime read 0건 + saved 데이터 잔존 필드는 무시되지만 무해 (runtime access 안 함).
}

export interface CombatFlags {
    comboCount?: number;
    deathSaveUsed?: boolean;
    deathSaveUsedCount?: number;
    voidHeartUsed?: boolean;
    voidHeartArmed?: boolean;
    echoArmed?: boolean;
    /** 동적으로 추가되는 임의 플래그 (런타임 확장 호환). */
    [key: string]: any;
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

/**
 * Player 도메인 타입 — 모든 필드가 optional.
 *
 * 이유: 코드베이스 곳곳에서 player.X를 다양한 부분 형태로 사용해서
 * 모든 필드를 optional로 두는 게 호환성 좋음. 점진 적용 — 향후 부분 인터페이스
 * (PlayerCore, PlayerCombat 등) 분화 가능.
 *
 * 또한 PlayerStats / 기타 sub-shape도 자주 ad-hoc 필드 추가 (e.g. relicShards,
 * areaBossDefeated 등) 가능하도록 [key: string]: any 인덱스 시그니처 포함.
 */
export interface Player {
    name?: string;
    job?: string;
    gender?: 'male' | 'female' | string;
    level?: number;
    hp?: number;
    maxHp?: number;
    mp?: number;
    maxMp?: number;
    atk?: number;
    def?: number;
    exp?: number;
    nextExp?: number;
    gold?: number;
    loc?: string;
    inv?: Item[];
    equip?: EquipSlots;
    quests?: any[];
    achievements?: string[];
    stats?: PlayerStats & { [key: string]: any };
    premiumCurrency?: number;
    seasonPass?: SeasonPassState;
    weeklyProtocol?: WeeklyProtocol;
    skillChoices?: Record<string, string>;
    challengeModifiers?: string[];
    tempBuff?: TempBuff;
    status?: any[];
    skillLoadout?: SkillLoadout;
    meta?: PlayerMeta & { [key: string]: any };
    relics?: import('./relic.js').Relic[];
    titles?: string[];
    activeTitle?: string | null;
    combatFlags?: CombatFlags;
    killStreak?: number;
    history?: any[];
    archivedHistory?: any[];
    eventChainProgress?: Record<string, any>;
    signaturePity?: SignaturePity | number;
    maxInv?: number;
    [key: string]: any;
}
