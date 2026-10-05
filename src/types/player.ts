/**
 * Player domain types (cycle 58 phase 4).
 *
 * gameReducer.ts의 INITIAL_STATE.player 구조를 망라.
 * 점진 적용용 — strict하게 만들지 말고 필드는 optional 위주.
 */

// cycle 319: ConsumableItem 미사용 import 제거 — player.ts는 Item / EquipSlots만 참조.
import type { EquipSlots, Item } from './item.js';
import type { QuestReward } from './quest.js';
import type { ProgressionProfile } from './progression.js';
// 타입 전용 re-import — types/index.ts의 FullStats re-export와 동일 패턴(런타임 의존 0).
//   단일 진실 원천을 중복 선언하지 않기 위해 계산/정규화 모듈의 타입을 그대로 쓴다.
import type { BattleRecord } from '../systems/DifficultyManager.js';
import type { CurrentRunProgress } from '../utils/runProgress.js';

/**
 * PlayerStats — `player.stats` 한 벌.
 *
 * 2026-09 B3 stage 1: 임의 문자열 키를 허용하던 인덱스 시그니처 제거.
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
    /**
     * 2026-10 Wave 58: 달성했지만 아직 수령하지 않은 업적 — 계승 · 사망 재시작 직전에 남긴다(`pickPermanentPlayerState`).
     * 레벨 · 방문 지역처럼 런마다 줄어드는 값이 수령 전 업적을 다시 잠그지 않게 한다.
     */
    achievedAchievements?: string[];
    /** cycle 260: 수령 완료 퀘스트 영구 ledger. quest.id는 숫자(DB.QUESTS)와 문자열(bounty) 혼용. */
    claimedQuestIds?: Array<string | number>;
    explores?: number;
    exploresByLocation?: Record<string, number>;
    /**
     * @deprecated cycle 435 이후 countLowHpWins()가 recentBattles에서 파생 계산한다.
     *   recentBattles가 빈 구세이브에서만 fallback으로 읽히므로 남겨둔다(신규 write 0건).
     */
    lowHpWins?: number;
    /**
     * Wave 61: 낮은 생명 승리의 누적 수 — 키는 `BALANCE.LOW_HP_WIN_THRESHOLDS`의 경계(문자열). 임무는 이 값을 읽는다.
     *   최근 50전 창(`recentBattles`)은 동적 난이도 · 성향 분석용이라 창이 돌면 임무 진행이 줄었다.
     */
    lowHpWinTotals?: Record<string, number>;
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
    /**
     * Wave 62 C5: 보스 게이지 카드에서 "회피"를 고른 시점의 그 지역 탐험 수(`exploresByLocation[loc]`) — 지역명 → 탐험 수.
     * 그 뒤 `BALANCE.BOSS_GAUGE_EVADE_EXPLORES`번 탐험하는 동안 카드가 뜨지 않는다(`bossGauge.ts`). 없으면(구세이브) 억제 없음.
     */
    bossGaugeEvadedAt?: Record<string, number>;
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

// 2026-09 B3 stage 2: 임의 문자열 키를 허용하던 인덱스 시그니처 제거 — 카테고리는 이 6개가 전부다.
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
    /** 'counter' 스킬(반격 자세)이 채우는 반격 확률 — CombatEngine.enemyAI.ts가 읽는다. */
    counterChance?: number;
}

/**
 * 2026-09 Wave 42: 회복 기술('hp_regen')이 광고하는 "N턴 지속 회복". 기술은 즉시 `val`을 회복하고,
 * 그 뒤 `turns`턴 동안 매 전투 턴 최대 생명의 `ratio`를 회복한다(`CombatEngine.tickCombatState` 소유).
 * `tempBuff`와 따로 둔다 — 한 칸을 같이 쓰면 회복이 방어 강화를 지운다.
 */
export interface SkillRegen {
    ratio: number;
    turns: number;
    name: string;
}

/** 기력 지속 회복(Wave 54 마나 가속) — `turns`턴 동안 턴마다 `amount`를 회복한다(`tickCombatState` 소유). */
export interface SkillMpRegen {
    amount: number;
    turns: number;
    name: string;
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
    // 2026-09 Wave 32: rank를 매기는 사다리 원장. 계승 때 남긴 단계만큼으로 줄어든다(누적 정수는 그대로).
    //   없으면 essenceLifetime으로 읽는다 — 구세이브는 계승 전까지 기존과 같다.
    essenceLadder?: number;
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
    /**
     * 은신(Wave 53): 남은 막는 적 공격 수 · 두 번째부터의 회피 확률 · 첫 공격(확정) 대기 여부.
     * 전투 플래그라 전투 시작 때 비워진다(이전 `nextHitEvaded`는 전투를 넘어 남았다).
     */
    stealthHits?: number;
    stealthChance?: number;
    stealthFirstPending?: boolean;
    /** 다음 피해 행동 1회의 피해 배율(Wave 53 그림자 이동). 쓰면 0으로 돌아간다. */
    nextAttackMult?: number;
    /** 그림자 망토 — 이번 전투에서 처음 받는 적 공격을 반드시 피한다(Wave 56). 전투 시작 때 세우고 쓰면 false. */
    cloakEvadePending?: boolean;
    /**
     * 혼돈의 보석 — 이번 전투에서 오른 능력치(Wave 57). 전투 시작 때 세우고 전투가 끝나면 지운다
     * (`endCombatScopedRelics`). 보석이 없으면 표시가 있어도 효과가 없다(`statsCalculator`).
     */
    chaosGemStat?: 'atk' | 'def';
    /** 빙결 누적(Wave 59) — 보스 강타가 쌓고, 보스가 선언한 수에 닿으면 빙결이 걸리고 0으로 돌아간다. */
    frostStacks?: number;
}

/**
 * 완주하고 넘어간 시즌 1건의 기록 (2026-09 Wave 12 D2).
 * 회전은 `claimed`를 비우므로, 비우기 전의 수령 기록을 여기에 그대로 옮긴다 —
 * 티어 보상은 칭호를 주고 칭호는 업적을 먹이므로 기록을 그냥 버리면 퇴행이다.
 * 벽시계는 담지 않는다(Wave 11 C2가 마이그레이션에서 제거한 비결정론을 되살리지 않는다).
 */
export interface SeasonArchiveEntry {
    seasonId: string;
    ordinal: number;
    /** 완주 시점 티어 — 항상 SEASON_MAX_TIER. */
    tier: number;
    /** 완주 시점 누적 시즌 경험. */
    xp: number;
    /** 정규화된(1~30) 수령 티어 목록. */
    claimed: number[];
}

// cycle 299: SeasonPassState는 private 유지 (Player composition 전용) — 외부에서 이 모양이
//   필요하면 `NonNullable<Player['seasonPass']>`로 파생한다(정본은 언제나 이 선언 하나).
interface SeasonPassState {
    xp?: number;
    tier?: number;
    claimed?: Array<number | string>;
    isPremium?: boolean;
    seasonId?: string;
    /**
     * 현재 시즌 서수. 구세이브에는 없으므로 읽는 쪽이 `seasonId`에서 파생한다
     * (`resolveSeasonOrdinal`) — 기본값 있는 선택 필드라 DATA_VERSION bump가 필요 없다.
     */
    ordinal?: number;
    /** 완주한 시즌 수. 회전마다 +1이며 감소하지 않는다. */
    completedSeasons?: number;
    /** 직전 시즌 기록 (최근 `BALANCE.SEASON_ARCHIVE_LIMIT`개). */
    archive?: SeasonArchiveEntry[];
}

interface WeeklyProtocol {
    kills?: number;
    explores?: number;
    bossKills?: number;
    lastResetWeek?: number | string;
    claimed?: string[];
}

// 2026-09 B3 stage 2: 임의 문자열 키를 허용하던 인덱스 시그니처 제거 — 설정 키는 이 2개가 전부다.
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

/**
 * eventChainProgress에 예외적으로 저장되는 "boundedEncounterReceipts" 키의 원소.
 * boundedEncounterSelector.ts의 applyBoundedEncounterChoice가 쓰는 원본 영수증
 * (post-processing 전) — ClassJourneyEncounterDiscovery보다 얇다.
 */
export interface EventChainBoundedEncounterReceipt {
    encounterId: string;
    choiceId: string;
}

/**
 * player.eventChainProgress[key] 값의 실제 형태 — Wave 9 A6 실측.
 * 대부분의 키(체인 id)는 진행 스텝(number) 또는 'failed'다. 예외적으로
 * "boundedEncounterReceipts" 키 하나만 원정 영수증 레저(Record)를 담는다
 * (boundedEncounterSelector.ts applyBoundedEncounterChoice가 같은 필드를
 * 재사용해 기록) — 필드 하나가 두 용도를 겸하는 기존 설계를 그대로 반영한다.
 */
export type EventChainProgressValue = number | 'failed' | Record<string, EventChainBoundedEncounterReceipt>;

export type EventChainProgress = Record<string, EventChainProgressValue>;

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
 * 플레이어 상태이상 id — `player.status` 배열의 원소 타입 (W2, Wave 5).
 *
 * 닫힌 집합인 근거(생산자 전수):
 *  - `CombatEngine.enemyAI` 보스 phase2/phase3 `statusEffect` + 몬스터 `statusOnHit`
 *    (`data/monsters.ts` 실측: bleed / burn / curse / freeze / poison / stun)
 *  - `BALANCE.EVENT_STATUS_IDS` (poison / burn / bleed / curse) — AI·고정 이벤트 결과
 *  - `exploreFlow` 이상현상 (poison / burn)
 * 소비자(`StatusBar` / `adventureGuide`의 라벨 표, `CombatEngine.enemyAI` statusLabels)가
 * 공통으로 아는 8종이 그대로 이 유니온이다. blind / fear는 유물·스킬이 적에게만 거는
 * 상태지만 라벨 표에 이미 포함돼 있어 플레이어 쪽 확장 여지를 남겨 둔다.
 *
 * 해제 경로: `consumableEffect`의 cure 아이템(poison / burn / freeze / curse),
 * 안전지대 휴식(`characterActions.rest` — 전체 초기화), `purify` 스킬,
 * `CombatEngine.tickPlayerStatusDurations`의 턴 만료.
 */
export type StatusId =
    | 'bleed'
    | 'blind'
    | 'burn'
    | 'curse'
    | 'fear'
    | 'freeze'
    | 'poison'
    | 'stun';

/**
 * 진행 중인 퀘스트 1건의 저장 상태 — `player.quests` 배열의 원소 (W2, Wave 5).
 *
 * 생산자는 둘뿐이다.
 *  1. `utils/questProgress.createQuestProgressState` — 카탈로그 퀘스트. `id`/`progress`만
 *     쓰고, `explore_count` 계열만 `startExploreCount` 기준점을 함께 기록한다.
 *     제목·목표·보상 같은 정의는 `DB.QUESTS`가 단일 진실 원천이라 복사하지 않는다.
 *  2. `reducers/handlers/questHandlers.REQUEST_BOUNTY` — 현상수배는 런타임 생성이라
 *     카탈로그에 없다. 그래서 정의 필드(`title`/`desc`/`target`/`goal`/`reward`)를
 *     진행 상태와 함께 보관하고 `isBounty: true`로 표시한다. 아래 정의 필드는 전부
 *     "현상수배 전용"이며 카탈로그 퀘스트에는 존재하지 않는다.
 */
export interface QuestProgressState {
    id: number | string;
    /** 현재 진행도. 목표치(`Quest.goal`)는 카탈로그(또는 현상수배의 `goal`)가 소유. */
    progress: number;
    /** `explore_count` 퀘스트 수락 시점의 지역 탐험 횟수 — 이후 증분만 진행도로 센다. */
    startExploreCount?: number;
    /** 현상수배 여부. true면 아래 정의 필드가 채워져 있고 카탈로그 조회를 건너뛴다. */
    isBounty?: boolean;
    /** 현상수배 전용 — 표시 제목. */
    title?: string;
    /** 현상수배 전용 — 표시 설명. */
    desc?: string;
    /** 현상수배 전용 — 처치 대상 몬스터 이름. */
    target?: string;
    /** 현상수배 전용 — 목표 처치 수. */
    goal?: number;
    /** 현상수배 전용 — 완료 보상. */
    reward?: QuestReward;
}

/**
 * AI 이벤트 컨텍스트용 최근 사건 기록 1건 — `player.history` 배열의 원소 (W2, Wave 5).
 *
 * 생산자는 `hooks/gameActions/eventActions`(AI 이벤트 선택 결과)와
 * `reducers/handlers/fallbackEventHandlers`(오프라인 fallback) 둘뿐이고, 둘 다 최근
 * 50건만 유지한다. 소비자는 `utils/aiEventUtils`의 `summarizeHistory` /
 * `getRecentEventSet`과 `SystemTab`의 플레이 기록 내보내기다.
 *
 * `summarizeHistory`는 `desc`/`text`/`result` 같은 구형 별칭도 읽지만, 현재 코드가
 * 기록하는 필드는 아래 셋뿐이라 타입은 셋만 선언한다(구형 별칭은 런타임 관용으로만 존속).
 */
export interface EventHistoryEntry {
    /** 사건 본문 (이벤트 설명). */
    event: string;
    /** 플레이어가 고른 선택지. 선택지가 없는 이벤트에서는 비어 있다. */
    choice?: string;
    /** 선택의 결과 문구. */
    outcome: string;
}

/**
 * Player 도메인 타입 — 모든 필드가 optional.
 *
 * 이유: 코드베이스 곳곳에서 player.X를 다양한 부분 형태로 사용해서
 * 모든 필드를 optional로 두는 게 호환성 좋음. 점진 적용 — 향후 부분 인터페이스
 * (PlayerCore, PlayerCombat 등) 분화 가능.
 *
 * 2026-09 B3 stage 3: 임의 문자열 키를 허용하던 인덱스 시그니처 제거. 이제 `player.anyTypo`가
 * 컴파일 에러다. 새 최상위 필드를 쓰려면 여기에 선언을 함께 넣어야 한다.
 */
/** 2026-09 Wave 40: 재구성 순간의 영구 생명 · 기력 전체량(에테르 초월 배율 포함). */
export interface MetaVitalsSnapshot {
    hp: number;
    mp: number;
}

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
    quests?: QuestProgressState[];
    expeditionFocusQuestIds?: Array<string | number>;
    achievements?: string[];
    stats?: PlayerStats;
    premiumCurrency?: number;
    seasonPass?: SeasonPassState;
    weeklyProtocol?: WeeklyProtocol;
    skillChoices?: Record<string, string>;
    challengeModifiers?: string[];
    /**
     * 2026-09 Wave 28 (D6): 이번 런에서 계승 제안을 한 번 미뤘다. 이후 마왕 처치는 계승 화면을 다시 열지 않고
     * 로그만 남기며, 계승은 `AT.REOPEN_ASCENSION`(조작판의 "계승하기")으로 연다. 런 범위 선택 필드라
     * `pickPermanentPlayerState`가 싣지 않는다 — 승천·사망으로 새 런이 되면 저절로 사라진다(DATA_VERSION 불변).
     */
    ascensionOfferDeferred?: boolean;
    tempBuff?: TempBuff;
    skillRegen?: SkillRegen;
    skillMpRegen?: SkillMpRegen;
    /** 'extraTurn' 스킬 효과·time_master/time_dominator 시너지 proc — 다음 적 턴 스킵(1회성 플래그). */
    extraTurnGranted?: boolean;
    status?: StatusId[];
    /** H1: 상태이상별 남은 턴 (status 배열과 짝 — CombatEngine.tickPlayerStatusDurations 소유) */
    statusTurns?: Record<string, number>;
    /**
     * 상태이상 중첩 수(Wave 59 보스 "누적") — status 배열에 있는 상태만 의미가 있고(없으면 1), 새로 걸릴 때 1에서 시작한다.
     * 읽기는 `getPlayerStatusStacks`(CombatEngine.status)만 한다.
     */
    statusStacks?: Partial<Record<StatusId, number>>;
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
    history?: EventHistoryEntry[];
    eventChainProgress?: EventChainProgress;
    deferredEventChainSteps?: Record<string, number>;
    activeExpedition?: ExpeditionSnapshot | null;
    lastExpeditionSummary?: ExpeditionSummary | null;
    classJourney?: ClassJourneyLedger;
    expeditionSequence?: number;
    returnSupplyRewards?: ReturnSupplyRewardLedger;
    // cycle 282: signaturePity top-level 필드 제거 — top-level access 0건.
    //   active dispatch는 player.stats.signaturePity (nested, number 형식).
    maxInv?: number;
    /** 2026-09 Wave 33: 이번 런에 제작한 가방 단계(`data/bagRecipes.ts`). 영구 상태가 아니라 사망·계승에서 0으로 돌아간다. */
    bagTier?: number;
    /**
     * 2026-09 Wave 40: 이번 런의 재구성(새 게임 · 전직 · 사망 재시작) 때 잡은 영구 생명 · 기력 전체량. 저장된 `maxHp`/`maxMp`에는
     * 이 값 × 레벨 연동 비율만 구워져 있고, 레벨업이 비율이 오른 만큼 더 굽는다(`systems/metaBonusRamp.ts`). 없으면 예전 세이브다.
     * 런 범위라 `pickPermanentPlayerState`에 넣지 않는다.
     */
    metaVitalsSnapshot?: MetaVitalsSnapshot;
    /**
     * 2026-10 Wave 61: 이야기(이벤트 체인) 능력치 보상의 이번 런 누적. 공격력 · 방어력은 `calculateFullStats`가 배율 뒤에
     * 더하고(구워 넣던 동안 "+15"가 직업 배율로 +18 ~ +35였다), 생명 · 기력은 저장 최대치에 굽되 전직이 이 값을 다시 더한다
     * (전직 재구성이 지우던 결함). 런 범위라 `pickPermanentPlayerState`에 넣지 않는다.
     */
    storyStatBonus?: { atk?: number; def?: number; hp?: number; mp?: number };
    /**
     * 2026-10 Wave 62 (원장 §61.4 C11, 소유자 결정 "첫 방문은 여정마다"): 이번 여정에 첫 방문 보상을 받은 지역. 새 여정(새 게임 ·
     * 사망 재시작 · 계승)이 빈 목록으로 연다. 런 범위라 `pickPermanentPlayerState`에 넣지 않는다. 없으면(예전 세이브) 방문 기록
     * (`stats.visitedMaps`)을 받은 것으로 읽는다(`utils/firstVisitRewards.ts`) — 이번 여정에 받은 보상을 다시 주지 않는다.
     */
    firstVisitRewardMaps?: string[];
    /** cycle 186: PremiumShop 부활 토큰 보유 수 — 환생에도 보존되는 영구 자산. */
    reviveTokens?: number;
    /** 2026-07 에테르 거울 revive를 이 런에서 이미 썼는지. 새 런 시작 시 자연 리셋. */
    mirrorReviveUsed?: boolean;
    /** 다음 적 공격 1회 회피 예약 — enemyAttack이 소비하며 즉시 해제. */
    nextHitEvaded?: boolean;
    /**
     * 마지막 처치 시각(ms). killStreak 시간 감쇠(BALANCE.KILL_STREAK_DECAY_MS) 비교용.
     * 2026-09 L stage 2: combatVictory가 쓰고 읽는데 미선언이라 안전하지 않은 캐스트로 우회하던 필드.
     */
    lastKillAt?: number;
}
