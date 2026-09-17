/**
 * Player domain types (cycle 58 phase 4).
 *
 * gameReducer.ts의 INITIAL_STATE.player 구조를 망라.
 * 점진 적용용 — strict하게 만들지 말고 필드는 optional 위주.
 */

// cycle 319: ConsumableItem 미사용 import 제거 — player.ts는 Item / EquipSlots만 참조.
import type { EquipSlots, Item } from './item.js';
import type { ProgressionProfile } from './progression.js';
// 타입 전용 re-import — types/index.ts의 FullStats re-export와 동일 패턴(런타임 의존 0).
//   단일 진실 원천을 중복 선언하지 않기 위해 계산/정규화 모듈의 타입을 그대로 쓴다.
import type { BattleRecord } from '../systems/DifficultyManager.js';
import type { CurrentRunProgress } from '../utils/runProgress.js';

/**
 * PlayerStats — `player.stats` 한 벌.
 *
 * 2026-09 B3 stage 1: `[key: string]: any` 인덱스 시그니처 제거.
 *   이전엔 `player.stats.anyTypo`가 통과해서 INITIAL_STATE와의 drift를 컴파일러가
 *   잡지 못했다. 이제 새 카운터를 추가할 때 여기에 선언을 함께 넣어야 한다.
 *   (필드는 여전히 전부 optional — 구세이브에는 없는 필드가 많고, 모든 consumer가
 *    optional chain + 기본값으로 읽는다. dataMigration.ts가 정규화 담당.)
 */
// cycle 299: 8 sub-interface exports → private (외부 import 0건, Player composition 전용).
interface PlayerStats {
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
    /** cycle 82: 합성 성공 누적(업적 target 'synths'). */
    syntheses?: number;
    /** cycle 95: 휘발성 killStreak와 별개인 max-ever 누적(업적 target 'maxKillStreak'). */
    maxKillStreak?: number;
    /** cycle 74: 전투 도주 성공 누적(퀘스트/업적/칭호 target 'escapes'). */
    escapes?: number;
    abyssFloor?: number;
    abyssRecord?: number;
    demonKingSlain?: number;
    dailyProtocol?: DailyProtocol | null;
    claimedAchievements?: string[];
    /** cycle 260: 수령 완료 퀘스트 영구 ledger. quest.id는 숫자(DB.QUESTS)와 문자열(bounty) 혼용. */
    claimedQuestIds?: Array<string | number>;
    explores?: number;
    exploresByLocation?: Record<string, number>;
    /**
     * @deprecated cycle 435 이후 countLowHpWins()가 recentBattles에서 파생 계산한다.
     *   recentBattles가 빈 구세이브에서만 fallback으로 읽히므로 남겨둔다(신규 write 0건).
     */
    lowHpWins?: number;
    // cycle 280: discoveries 제거 — cycle 83/84 deprecated (visitedMaps.length로 통일).
    buildWins?: Record<string, number>;
    /** cycle 102: 완료한 발견 체인 ID(BALANCE.DISCOVERY_CHAINS[].id) 목록. */
    discoveryChains?: string[];
    visitedMaps?: string[];
    currentRun?: CurrentRunProgress;
    exploreState?: ExploreState;
    codex?: PlayerCodex;
    codexClaimed?: string[];
    /** cycle 138: 도감 마일스톤 보상으로 적립된 영구 스탯 보너스(statsCalculator가 합산). */
    codexBonusAtk?: number;
    codexBonusDef?: number;
    codexBonusHp?: number;
    /** 최근 전투 기록(최대 50개) — DifficultyManager의 동적 난이도 입력. */
    recentBattles?: BattleRecord[];
    /** cycle 75: signature 드롭 bad-luck 보호 카운터. */
    signaturePity?: number;
    /** cycle 205: per-run 구역 보스 격파 플래그 — 보스 이름 → true. */
    areaBossDefeated?: Record<string, boolean>;
    /** 2026-07: 원정 보스 접근 게이지 — 지역명 → 0~1. */
    bossGauge?: Record<string, number>;
    /** cycle 82: 합성 보호 토큰 보유 수(프리미엄 자산 — 환생에도 보존). */
    synthProtects?: number;
    /** cycle 185: 프리미엄 상점에서 구매한 칭호 ID(영문) 목록 — 환생에도 보존. */
    cosmeticTitles?: string[];
    /** 묘비 침공 일일 제한 — 마지막 침공 날짜(Date.toDateString())와 그날의 횟수. */
    lastInvadeDate?: string | null;
    dailyInvadeCount?: number;
    /** 마지막 플레이(저장) 시각(ms). 복귀 브리핑 카드가 경과 시간 판정에 사용. */
    lastSeenAt?: number | null;
    /** 혼돈의 심연 일일 첫 다이브 — 오늘 날짜 문자열과 사용 여부. */
    abyssDailyDive?: AbyssDailyDive | null;
    /** 2026-09 D1 — 원정 단위 무료 정찰 사용 기록. expeditionId가 바뀌면 자동으로 다시 채워진다. */
    scoutCharges?: { expeditionId: string; used: number };
    /** 2026-09 D2 — "밀어붙인다" 직후 다음 탐험 1회의 모닥불 분기를 차단한다. */
    nextExploreCampfireBlocked?: boolean;
}

/** 탐험 pacing pity 카운터 — utils/explorationPacing.ts가 단일 진실 원천(DEFAULT_EXPLORE_STATE). */
export interface ExploreState {
    sinceNarrativeEvent?: number;
    sinceDiscovery?: number;
    sinceRelic?: number;
    quietStreak?: number;
    lastOutcome?: string;
}

/**
 * 오늘의 임무(일일 프로토콜) — 2026-09 Wave 3 L stage 3.
 * 생산자는 `utils/protocolCycle.createDailyProtocol` 하나뿐이고 QA 시드
 * (`useGameTestApi`)도 같은 모양을 쓴다. 소비처는 reducers/handlers/helpers.ts와
 * SystemTab QA readout. `stats.dailyProtocol`은 INITIAL_STATE에서 null로 시작한다.
 */
export type DailyProtocolMissionType = 'kills' | 'explores' | 'goldSpend';

/** 미션 1건의 보상 — 셋 중 하나만 채워진다. */
export interface DailyProtocolMissionReward {
    essence?: number;
    item?: string;
    relicShard?: number;
}

export interface DailyProtocolMission {
    id: string;
    type: DailyProtocolMissionType;
    goal: number;
    reward: DailyProtocolMissionReward;
    progress: number;
    done: boolean;
}

export interface DailyProtocol {
    /** YYYY-MM-DD (`getProtocolDayKey`). 날짜가 바뀌면 새로 생성한다. */
    date: string;
    /** 유물 파편 누적 — 5개마다 유물 1개로 변환된다. */
    relicShards: number;
    /** 항상 3건 (kills / explores / goldSpend). */
    missions: DailyProtocolMission[];
}

/** 심연 데일리 다이브 상태 — dailyProtocol과 동일한 날짜 문자열 판정 방식.
 *  combats: 오늘 버프가 적용된 전투 수 (ABYSS_DAILY_DIVE_COMBAT_COUNT까지).
 *  used: 구형 레코드 하위 호환 필드 (combats 도입 전 — 소진으로 간주). */
export interface AbyssDailyDive {
    date: string;
    combats?: number;
    used?: boolean;
}

/** 도감 한 칸 — registerCodex()/dataMigration이 기록하는 유일한 두 필드. */
export interface CodexEntry {
    discovered?: boolean;
    kills?: number;
}

/** 도감 카테고리 키 — registerCodex(player, category, name)의 category. */
export type CodexCategory = 'weapons' | 'armors' | 'shields' | 'monsters' | 'recipes' | 'materials';

// 2026-09 B3 stage 2: `[key: string]: any` 제거 — 카테고리는 이 6개가 전부다.
//   (CodexCategory와 키 집합이 일치해야 한다 — registerCodex/UPDATE_CODEX가 둘을 잇는다.)
interface PlayerCodex {
    weapons?: Record<string, CodexEntry>;
    armors?: Record<string, CodexEntry>;
    shields?: Record<string, CodexEntry>;
    monsters?: Record<string, CodexEntry>;
    recipes?: Record<string, CodexEntry>;
    materials?: Record<string, CodexEntry>;
}

// cycle 282: SignaturePity interface 제거 — Player.signaturePity 외 consumer 0건이라 동시 cleanup.
//   active signaturePity는 player.stats.signaturePity (number) 형식으로 dispatch.

interface SkillLoadout {
    selected: number;
    cooldowns: Record<string, number>;
}

interface TempBuff {
    atk?: number;
    def?: number;
    turn?: number;
    name?: string | null;
}

export interface EndgameProgress {
    version: 1;
    primalShards: number;
    legacyInventoryMigrated: boolean;
    lastEndgameReceiptKey: string | null;
    trueEndingSeen: boolean;
}

interface PlayerMeta {
    essence?: number;
    // 2026-09 G2: 지금까지 *번* 정수의 총합(소비해도 줄지 않음). rank 산출 기준.
    //   단일 진실 원천은 systems/essenceLedger.ts.
    essenceLifetime?: number;
    rank?: number;
    bonusAtk?: number;
    bonusHp?: number;
    bonusMp?: number;
    prestigeRank?: number;
    // cycle 281: totalPrestigeAtk/Hp/Mp 3 dead 필드 제거 (cycle 277 runtime cleanup paired completion).
    //   runtime read 0건 + saved 데이터 잔존 필드는 무시되지만 무해 (runtime access 안 함).
    // 2026-07 — 에테르 거울: 노드id → 레벨. getMirrorEffects(meta)가 단일 진실 원천.
    mirror?: Record<string, number>;
    storyMilestones?: {
        seen?: string[];
        pending?: string[];
    };
    endgame?: EndgameProgress;
}

/**
 * CombatFlags — 전투 내 한정 플래그. 2026-09 B3 stage 2: 인덱스 시그니처 제거.
 *
 * INITIAL_STATE가 초기화하는 것은 comboCount / deathSaveUsed / voidHeartUsed /
 * voidHeartArmed 4개뿐이고, 나머지는 유물 발동 시점에 처음 생긴다. 초기화 여부와
 * 무관하게 모든 consumer가 `|| 0` / `Boolean()` 로 읽으므로 전부 optional로 둔다
 * (INITIAL_STATE에 추가하는 것은 런타임 + 세이브 형태 변경이라 여기서 하지 않는다).
 */
interface CombatFlags {
    comboCount?: number;
    deathSaveUsed?: boolean;
    deathSaveUsedCount?: number;
    voidHeartUsed?: boolean;
    voidHeartArmed?: boolean;
    /** cycle 229: 연속 스킬 사용 스택 — 일반 공격이 0으로 리셋. */
    spellStackCount?: number;
    /** cycle 158: '허공의 왕좌' 전투 내 누적 ATK 보너스 — 전투 시작 시 0으로 리셋. */
    killStackAtkBonus?: number;
    /** 불사조 부활 유물 1회 소진 플래그. */
    phoenixUsed?: boolean;
    /** cycle 163: cooldown_reduce.firstFree — 전투 첫 스킬 무료 사용 소진 여부. */
    firstSkillUsed?: boolean;
    /** cycle 159: entropy_tick / entropy_brand 주기 판정용 전투 내 턴 수. */
    turnCount?: number;
    /** cycle 186: 부활 토큰 소비 신호 — applyDeathSave가 세우고 호출부가 소비. */
    reviveTokenUsed?: boolean;
    /** 2026-07 에테르 거울 revive 소진 신호 — 영속 값은 player.mirrorReviveUsed(top-level). */
    mirrorReviveUsed?: boolean;
    echoArmed?: boolean;
}

interface SeasonPassState {
    xp?: number;
    tier?: number;
    claimed?: Array<number | string>;
    isPremium?: boolean;
    seasonId?: string;
}

interface WeeklyProtocol {
    kills?: number;
    explores?: number;
    bossKills?: number;
    lastResetWeek?: number | string;
    claimed?: string[];
}

// 2026-09 B3 stage 2: `[key: string]: any` 제거 — 설정 키는 이 2개가 전부다.
interface PlayerSettings {
    readabilityMode?: 'standard' | 'high' | string;
    equipmentDetailMode?: 'auto' | 'summary' | 'full' | string;
}

export interface ExpeditionInventoryCheckpoint {
    key: string;
    name: string;
}

export interface ExpeditionQuestCheckpoint {
    id: string | number;
    title: string;
    progress: number;
    goal: number;
}

export interface ClassJourneyEncounterDiscovery {
    encounterId: string;
    encounterVersion: number;
    choiceId: string;
    family: string;
    choiceLabel: string;
}

export interface ClassJourneyRecord {
    expeditionIds: string[];
    skillBranches: string[];
    signatureItems: string[];
    bossNames: string[];
    regions: string[];
    encounterDiscoveries: ClassJourneyEncounterDiscovery[];
    representativeExpeditionId: string | null;
    lastPlayedAt: number | null;
}

export interface ClassJourneyLedger {
    version: 2;
    sequence: number;
    byJob: Record<string, ClassJourneyRecord>;
}

export interface ExpeditionSnapshot {
    id: string;
    startedAt: number;
    origin: string;
    destination: string;
    startLevel: number;
    startExp: number;
    startNextExp: number;
    startGold: number;
    startHp: number;
    maxHpAtStart: number;
    lowestHp: number;
    kills: number;
    bossKills: number;
    explores: number;
    inventory: ExpeditionInventoryCheckpoint[];
    quests: ExpeditionQuestCheckpoint[];
    focusQuestIds: Array<string | number>;
    job?: string;
    skillChoices?: Record<string, string>;
    equipmentNames?: string[];
    bossNames?: string[];
    signatureItems?: string[];
    progressionProfile: ProgressionProfile;
}

export interface ExpeditionSummary {
    id: string;
    startedAt: number;
    endedAt: number;
    origin: string;
    destination: string;
    lastLocation: string;
    returnLocation: string;
    returnReason: 'safe_return';
    durationMs: number;
    startLevel: number;
    endLevel: number;
    expGained: number;
    goldDelta: number;
    battles: number;
    bossBattles: number;
    explores: number;
    newItems: string[];
    lostItemCount: number;
    completedQuests: string[];
    lowestHp: number;
    lowestHpPercent: number;
    returnHp: number;
    maxHpAtReturn: number;
    reviewedAt: number | null;
    job?: string;
    skillChoices?: Record<string, string>;
    equipmentNames?: string[];
    bossNames?: string[];
    signatureItems?: string[];
    encounterDiscoveries: ClassJourneyEncounterDiscovery[];
    progressionProfile: ProgressionProfile;
}

export interface ReturnSupplyRewardReceipt {
    status: 'pending' | 'delivered';
}

export interface ReturnSupplyRewardLedger {
    version: 1;
    receipts: Record<string, ReturnSupplyRewardReceipt>;
}

/**
 * Player 도메인 타입 — 모든 필드가 optional.
 *
 * 이유: 코드베이스 곳곳에서 player.X를 다양한 부분 형태로 사용해서
 * 모든 필드를 optional로 두는 게 호환성 좋음. 점진 적용 — 향후 부분 인터페이스
 * (PlayerCore, PlayerCombat 등) 분화 가능.
 *
 * 2026-09 B3 stage 3: `[key: string]: any` 제거. 이제 `player.anyTypo`가 컴파일
 * 에러다. 새 최상위 필드를 쓰려면 여기에 선언을 함께 넣어야 한다.
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
    expeditionFocusQuestIds?: Array<string | number>;
    achievements?: string[];
    stats?: PlayerStats;
    premiumCurrency?: number;
    seasonPass?: SeasonPassState;
    weeklyProtocol?: WeeklyProtocol;
    skillChoices?: Record<string, string>;
    challengeModifiers?: string[];
    tempBuff?: TempBuff;
    status?: any[];
    /** H1: 상태이상별 남은 턴 (status 배열과 짝 — CombatEngine.tickPlayerStatusDurations 소유) */
    statusTurns?: Record<string, number>;
    skillLoadout?: SkillLoadout;
    settings?: PlayerSettings;
    meta?: PlayerMeta;
    relics?: import('./relic.js').Relic[];
    titles?: string[];
    activeTitle?: string | null;
    combatFlags?: CombatFlags;
    adventureRelicBonuses?: {
        killStackAtk?: number;
        devour?: { phase: 'ready' | 'active'; amount: number };
    };
    killStreak?: number;
    history?: any[];
    eventChainProgress?: Record<string, any>;
    deferredEventChainSteps?: Record<string, number>;
    activeExpedition?: ExpeditionSnapshot | null;
    lastExpeditionSummary?: ExpeditionSummary | null;
    classJourney?: ClassJourneyLedger;
    expeditionSequence?: number;
    returnSupplyRewards?: ReturnSupplyRewardLedger;
    // cycle 282: signaturePity top-level 필드 제거 — top-level access 0건.
    //   active dispatch는 player.stats.signaturePity (nested, number 형식).
    maxInv?: number;
    /** cycle 186: PremiumShop 부활 토큰 보유 수 — 환생에도 보존되는 영구 자산. */
    reviveTokens?: number;
    /** 2026-07 에테르 거울 revive를 이 런에서 이미 썼는지. 새 런 시작 시 자연 리셋. */
    mirrorReviveUsed?: boolean;
    /** 다음 적 공격 1회 회피 예약 — enemyAttack이 소비하며 즉시 해제. */
    nextHitEvaded?: boolean;
    /**
     * 마지막 처치 시각(ms). killStreak 시간 감쇠(BALANCE.KILL_STREAK_DECAY_MS) 비교용.
     * 2026-09 L stage 2: combatVictory가 쓰고 읽는데 미선언이라 `as any`로 우회하던 필드.
     */
    lastKillAt?: number;
}
