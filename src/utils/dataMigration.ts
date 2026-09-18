import { ITEMS } from '../data/items.js';
import { normalizeDeferredEventChainSteps } from '../data/eventChains.js';
import { QUESTS } from '../data/quests.js';
import { getCumulativeQuestProgress } from './cumulativeQuestProgress.js';
import { DEFAULT_EXPLORE_STATE } from './explorationPacing.js';
import { isTwoHandWeapon, isShield, isWeapon } from './equipmentUtils.js';
import { normalizeActiveExpedition, normalizeExpeditionSummary } from './expeditionLedger.js';
import { getDefaultExpeditionFocusQuestIds, getPreparedExpeditionFocusQuestIds } from './expeditionMissionFocus.js';
import { normalizeMilestoneStoryState } from './milestoneStory.js';
import { normalizeCurrentRunProgress } from './runProgress.js';
import { normalizeClassJourneyLedger } from './classJourney.js';
import { normalizeReturnSupplyRewardLedger } from './returnSupplyReward.js';
import { getSpentMirrorEssence, type MirrorLevels } from '../systems/mirrorUpgrades.js';
import { migrateEquipmentInstancePrice } from './equipmentBaseIdentity.js';
import { advanceSeasonIfComplete, createSeasonPassState } from './seasonPassPresentation.js';
import { BALANCE } from '../data/constants.js';
import type { EndgameProgress, Player } from '../types/player.js';
import type { Item } from '../types/item.js';
import type { Monster } from '../types/monster.js';
import type { GameEvent } from '../types/session.js';
import type { Relic } from '../types/relic.js';
import type { GraveEntry } from './graveUtils.js';
import { normalizeAdventureRelicBonuses, getAdventureRelicDescription } from './adventureRelicState.js';

// gameUtils.ts에서 분리 (저장 데이터 마이그레이션) — 행동 보존 리팩토링.
//   순환 의존을 피하려 toArray(1줄 헬퍼)는 인라인.
// 입력은 저장 데이터의 임의 필드(unknown) — 배열이면 원본 참조를 그대로 돌려주므로
// 호출부가 push/mutate 해도 저장 객체에 반영된다(기존 동작 유지).
const toArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ── 구형 세이브를 읽는 렌즈 ───────────────────────────────────────────────────
// `migrateData`의 입력은 Firestore/로컬 스냅샷의 임의 구형 JSON이다. 아래 렌즈들은
// **값을 바꾸지 않는다**(정규화는 `migrateData` 본문의 필드별 분기가 한다) — 타입만
// `unknown`에서 "읽을 수 있는 모양"으로 좁혀, 아래 300여 줄이 `any`가 아닌 `unknown`
// 위에서 분기하도록 만든다.

/** 구형 세이브의 레코드 슬롯 — 키는 임의(레거시 필드명)이고 값은 항상 `unknown`이다. */
type SaveRecord = Record<string, unknown>;

/**
 * 임의 필드를 "객체처럼 읽는" 렌즈 — 런타임 값 변환 없음(항등).
 * 스칼라에 `?.field`를 읽으면 JS가 undefined를 주고 스프레드도 기존과 같게 동작하므로
 * (`{...'ab'}` → `{0:'a',1:'b'}`), 지금까지 `any`로 흘려보내던 것과 결과가 동일하다.
 * 반환 값 타입이 `unknown`이라 읽은 뒤에는 다시 좁혀야 한다 — 그게 이 렌즈의 목적이다.
 */
const readFields = (value: unknown) => value as SaveRecord | undefined;

/** 숫자 필드 렌즈 — 구세이브의 문자열/널을 소비자(`typeof x === 'number'` 가드)와 같게 취급한다. */
const readNumber = (value: unknown) => (typeof value === 'number' ? value : undefined);

/** 문자열 필드 렌즈. */
const readString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * 장비 슬롯 렌즈 — `equipmentUtils`의 술어(`isWeapon`/`isShield`/`isTwoHandWeapon`)는
 * `item?.type`/`item?.subtype`만 읽으므로 스칼라·null도 기존과 동일하게 흘려보낸다.
 */
const readItem = (value: unknown) => value as Item | null | undefined;

/**
 * `Player` 계약을 요구하는 헬퍼(`getCumulativeQuestProgress` /
 * `get*ExpeditionFocusQuestIds`)에 넘기기 위한 읽기 렌즈 — 값 변환 없음(항등).
 * 세 헬퍼는 모두 `player.stats?.X` / `|| 0` / `Array.isArray` 같은 관용 패턴으로만 읽어서
 * 구세이브가 빠뜨린 필드를 그대로 견딘다 — 지금까지 `any`로 넘기던 것과 런타임 계약이 같다.
 * 이것이 이 파일의 유일한 `Player` 단언이다. 입력 경계(`rawData`)는 `unknown`이고
 * 거기서는 Player를 주장하지 않는다 — 구형 drift를 고치는 것이 이 함수의 존재 이유다.
 */
const asPlayerView = (slot: SaveRecord) => slot as Player;

/**
 * `desc`를 재생성하는 모험 유물 2종인지 판정한다. 구세이브도 `effect` 판별자는 항상
 * 보유하므로 그 값만으로 `Relic` 계약(`getAdventureRelicDescription`)에 연결한다 —
 * 판정에 걸리지 않은 원소(null·스칼라·다른 효과)는 손대지 않고 그대로 되돌린다.
 */
const isAdventureRelic = (value: unknown): value is Relic => {
    const effect = readFields(value)?.effect;
    return effect === 'kill_stack_atk' || effect === 'devour_hp';
};

/**
 * 마이그레이션이 직접 쓰는 player 슬롯의 작업용 모양.
 * 값은 전부 `unknown`이다 — `Player`가 아니다(그 drift를 고치는 것이 이 함수다).
 * 다만 아래 4개 하위 레코드는 바로 앞줄의 `|| {기본값}`이 객체를 보장한 뒤
 * `target.stats.X = …` 형태로 직접 쓰므로 여기서 레코드로 선언해 둔다. 구형 세이브가
 * 그 자리에 스칼라를 넣어 뒀다면 예전에도 그 쓰기가 TypeError를 냈고 지금도 같다
 * (선언은 전제를 문서화할 뿐, 새 런타임 검사를 추가하지 않는다).
 */
type MigrationPlayerSlot = SaveRecord & {
    stats: SaveRecord;
    meta: SaveRecord;
    equip: SaveRecord;
    skillLoadout: SaveRecord;
};

/**
 * `migrateData`의 반환 모양 — 생산자가 곧 정의다(2026-09-18 Wave 8 Z2 실측).
 *
 * 반환값은 입력의 딥클론이고, 그 위에 이 함수가
 *   · `quickSlots`(3칸)와 `pendingRelics: null`을 **항상** 쓰고,
 *   · `version`은 없거나 2.7 미만일 때만 2.7로 올리며(그 외는 입력 값 보존),
 *   · 나머지 정규화는 전부 **player 슬롯**(`savedData.player`, 없으면 최상위 객체 자신)에 쓴다.
 *
 * 그래서 `player`는 **optional**이다 — `player` 키가 없는 구형 flat 세이브는 최상위가
 * 곧 player였고, 그 경우 player 필드가 이 봉투와 같은 객체에 남는다(현재 소비자 0건).
 * `player`가 `Partial<Player>`인 것도 실측이다: 이 함수는 알려진 필드만 정규화하고
 * 구세이브가 빠뜨린 필드는 채우지 않는다 — `AT.LOAD_DATA`가
 * `{...state.player, ...payload.player}`로 병합하는 `PlayerPatch` 계약과 같은 폭이다.
 *
 * `lastActive`를 선언하지 않는 것은 의도다 — Firestore Timestamp는 위 JSON 왕복에서
 * `{seconds,nanoseconds}` 평범한 객체로 죽는다. 권위 있는 `lastActive` 읽기는
 * `useFirebaseSync`가 원본 문서에서 하고 이 사본에서는 하지 않는다.
 */
export type MigratedSave = {
    player?: Partial<Player>;
    gameState?: string;
    enemy?: Monster | null;
    grave?: GraveEntry | GraveEntry[] | null;
    currentEvent?: GameEvent | null;
    /** 항상 길이 3 — 모자라면 null로 채우고 넘치면 자른다. */
    quickSlots: Array<Item | null>;
    /** 런타임 전용이라 로드 시 항상 null로 초기화된다. */
    pendingRelics: null;
    /** 입력에 없거나 2.7 미만이면 2.7로 올라간다. */
    version?: number;
    savedAt?: number;
};

/** player 슬롯을 실제로 가진 마이그레이션 결과 — `AT.LOAD_DATA` payload가 요구하는 폭이다. */
export type MigratedPlayerSave = MigratedSave & { player: Partial<Player> };

/**
 * `migrateData` 결과에 player 슬롯이 있는지 판정한다 — `null`(빈 입력)과
 * player 키 없는 구형 flat 세이브를 한 번에 걸러 낸다.
 */
export const hasMigratedPlayer = (save: MigratedSave | null): save is MigratedPlayerSave => Boolean(save?.player);

const ENDGAME_RECEIPT_KEY = /^[A-Za-z0-9:_-]{1,160}$/;

export const normalizeEndgameProgress = (value: unknown): EndgameProgress => {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
    const rawShards = Number(candidate.primalShards);
    const requiredShards = Math.max(1, Number(BALANCE.PRIMAL_SHARD_REQUIRED) || 3);
    const receipt = typeof candidate.lastEndgameReceiptKey === 'string'
        && ENDGAME_RECEIPT_KEY.test(candidate.lastEndgameReceiptKey)
        ? candidate.lastEndgameReceiptKey
        : null;
    return {
        version: 1,
        primalShards: Number.isSafeInteger(rawShards) && rawShards >= 0
            ? Math.min(requiredShards, rawShards)
            : 0,
        legacyInventoryMigrated: candidate.legacyInventoryMigrated === true,
        lastEndgameReceiptKey: receipt,
        trueEndingSeen: candidate.trueEndingSeen === true,
    };
};

export interface MigrateDataOptions {
    /**
     * 이 저장본을 읽는 시각(ms). `currentRun`이 없는 구형 세이브에 런을 새로 열 때
     * `stats.currentRun.startedAt`이 된다 — 그 외 어떤 필드에도 쓰이지 않는다.
     *
     * W11-C2(B2): 이 인자가 생기기 전에는 `createCurrentRunProgress`가 `Date.now()`를
     * 직접 읽어 `migrateData` 자체가 비결정적이었다(골든 하네스가 그 필드를 정규화해야
     * 비교가 가능했다). 벽시계 기본값은 **이 경계 한 곳에만** 남는다 — 결정론이 필요한
     * 호출자(골든 차등 하네스·테스트·감사 스크립트)는 고정 시각을 넘긴다.
     */
    now?: number;
}

/**
 * 저장 데이터 마이그레이션 — 입력은 Firestore/로컬 스냅샷의 임의 구형 모양(unknown)이다.
 * 여기서 도메인 타입(`Player`)을 강제하면 이 함수가 존재하는 이유인 "구형 저장 데이터와
 * 현재 타입의 drift"를 오히려 감춘다. 딥클론 이후의 동적 읽기/쓰기는 `unknown` 값을 가진
 * 레코드(`SaveRecord`)로 다루고, 필드별로 좁혀 읽는다 — 이후 300여 줄의 필드별 정규화가
 * 실질적인 "타입 좁히기"다. 반환 계약만 `MigratedSave`로 닫혀 있다.
 *
 * `options.now`를 주면 이 함수는 완전히 결정론적이다(그 외 벽시계 읽기가 없다).
 */
export const migrateData = (rawData: unknown, options: MigrateDataOptions = {}): MigratedSave | null => {
    if (!rawData) return null;
    const now = options.now ?? Date.now();
    // Deep clone to avoid mutating the Firestore snapshot directly
    // (`JSON.parse`의 선언 반환형 `any`를 여기서 `SaveRecord`로 받아 더 흘리지 않는다 —
    //  스칼라 스냅샷이면 예전처럼 아래 첫 필드 쓰기에서 TypeError가 난다. 새 검사 없음.)
    const savedData: SaveRecord = JSON.parse(JSON.stringify(rawData));

    // Target the specific player object if clear structure exists
    // If savedData IS the player (old flat format?), use it.
    // But in this app, usually savedData matches App state structure.
    const target = (savedData.player || savedData) as MigrationPlayerSlot;
    const playerView = asPlayerView(target);
    const deferredSteps = normalizeDeferredEventChainSteps(
        target.deferredEventChainSteps,
        readFields(target.eventChainProgress),
    );
    if (deferredSteps) target.deferredEventChainSteps = deferredSteps;
    else delete target.deferredEventChainSteps;
    const adventureRelicBonuses = normalizeAdventureRelicBonuses(
        target.adventureRelicBonuses,
        readNumber(target.maxHp),
    );
    if (adventureRelicBonuses) target.adventureRelicBonuses = adventureRelicBonuses;
    else delete target.adventureRelicBonuses;
    if (Array.isArray(target.relics)) {
        target.relics = target.relics.map((relic: unknown) => (
            isAdventureRelic(relic)
                ? { ...relic, desc: getAdventureRelicDescription(relic) }
                : relic));
    }

    // Version Limit
    // (`Number(...)`는 기존 `savedData.version < 2.7`의 JS 관계 연산 강제 변환과 동일하다.)
    if (!savedData.version || Number(savedData.version) < 2.7) {
        savedData.version = 2.7;

        target.mp = target.mp ?? 50;
        target.maxMp = target.maxMp ?? 50;
        target.history = target.history || [];

        // New stats for v3.1
        target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0 };
        target.stats.killRegistry = target.stats.killRegistry || {};
        target.stats.bossKills = target.stats.bossKills || 0;
        target.stats.rests = target.stats.rests || 0;
    }

    // Ensure equip is object not string (Old version compatibility)
    target.equip = target.equip || {};
    const legacyWeaponName = target.equip.weapon;
    if (typeof legacyWeaponName === 'string') {
        target.equip.weapon = ITEMS.weapons.find((w) => w.name === legacyWeaponName) || ITEMS.weapons[0];
    }
    const legacyArmorName = target.equip.armor;
    if (typeof legacyArmorName === 'string') {
        target.equip.armor = ITEMS.armors.find((a) => a.name === legacyArmorName) || ITEMS.armors[0];
    }
    const legacyOffhandName = target.equip.offhand;
    if (typeof legacyOffhandName === 'string') {
        const shield = ITEMS.armors.find((a) => a.type === 'shield' && a.name === legacyOffhandName);
        const weapon = ITEMS.weapons.find((w) => w.name === legacyOffhandName);
        target.equip.offhand = shield || weapon || null;
    }
    if (!target.equip.weapon || !isWeapon(readItem(target.equip.weapon))) {
        target.equip.weapon = ITEMS.weapons[0];
    }
    const equippedArmor = readItem(target.equip.armor);
    if (!equippedArmor || equippedArmor.type !== 'armor') {
        target.equip.armor = ITEMS.armors.find((a) => a.type === 'armor') || ITEMS.armors[0];
    }
    const equippedOffhand = readItem(target.equip.offhand);
    if (equippedOffhand && !isShield(equippedOffhand) && !isWeapon(equippedOffhand)) {
        target.equip.offhand = null;
    }
    if (isTwoHandWeapon(readItem(target.equip.weapon))) {
        target.equip.offhand = null;
    }

    // Modern runtime fields (safe defaults for older saves)
    // cycle 374: 3 sub-field fallback 제거 (cycle 373 meta 동일 lens) — 모든 consumer가
    //   이미 `buff.X || 0` protection (statsCalculator) 또는 EMPTY_TEMP_BUFF 병합
    //   (playerStateUtils)로 undefined 안전. 객체 자체 초기화만 필요.
    target.tempBuff = target.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
    // cycle 381: target.status / skillLoadout.selected normalizations 제거 (cycle 373-379
    //   동일 lens) — 모든 consumer가 이미 동일 패턴 (Array.isArray, Number.isInteger,
    //   `|| []`, toArray) 사용으로 undefined / 비정상 값 안전 처리.
    // W2 (Wave 5): 단, `status`가 배열이 아닌 구세이브(스칼라 문자열)는 별개 문제다.
    //   consumer의 `Array.isArray ? : []` / `toArray` 패턴은 그런 값을 조용히 버려서
    //   걸려 있던 상태이상이 로드와 함께 증발한다(`consumableEffect`만 `[player.status]`로
    //   감싸 관용 처리 중). `player.status: StatusId[]` 계약을 로드 시점에 한 번 세우되,
    //   스칼라는 버리지 않고 1원소 배열로 승격한다. 배열이거나 아예 없으면 손대지 않으므로
    //   직렬화 모양은 그대로다 — cycle 381이 지운 `= Array.isArray(...) ? ... : []`
    //   (스칼라를 []로 날리는 형태)의 부활이 아니고, DATA_VERSION bump 대상도 아니다.
    if (target.status !== undefined && !Array.isArray(target.status)) {
        target.status = typeof target.status === 'string' && target.status
            ? [target.status]
            : [];
    }
    target.skillLoadout = target.skillLoadout || { selected: 0, cooldowns: {} };
    target.skillLoadout.cooldowns = target.skillLoadout.cooldowns || {};
    // cycle 373: 5 sub-field fallback 제거 — 모든 consumer가 이미 `meta.X || 0`
    //   protection 또는 CombatEngine 로컬 reconstruction (DEFAULT_META 병합)으로
    //   undefined 안전. 객체 자체 초기화만 필요.
    target.meta = target.meta || { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 };
    // 2026-07 — 에테르 거울: meta.mirror가 없는 구세이브(v5.0 이전 전부 + v5.0 일부)에서도
    //   getMirrorEffects가 항상 객체를 참조할 수 있도록 {}로 보강. 기존 레벨은 보존.
    target.meta.mirror = target.meta.mirror || {};
    // v5.1 — 2026-09 G2: meta.essenceLifetime(누적 획득 정수) 도입. 구세이브에는 없으므로
    //   `잔여 정수 + 거울에서 이미 지출한 정수`로 정확히 역산한다. 지출액은 구매 이력
    //   (meta.mirror의 노드별 레벨)과 MIRROR_NODES의 레벨별 비용으로 결정론적으로 재구성
    //   되므로 기존 유저는 rank를 단 한 단계도 잃지 않는다.
    // `null`은 Number(null) === 0 으로 finite라 별도 검사 — 숫자가 아니면 전부 역산한다.
    if (typeof target.meta.essenceLifetime !== 'number' || !Number.isFinite(target.meta.essenceLifetime)) {
        // `getSpentMirrorEssence`는 노드별 레벨을 `Number(...) || 0`으로 읽으므로
        // 구세이브의 비숫자 레벨도 기존과 똑같이 0으로 취급된다.
        target.meta.essenceLifetime = Math.max(0, Number(target.meta.essence) || 0)
            + getSpentMirrorEssence(target.meta.mirror as MirrorLevels);
    }
    target.meta.storyMilestones = normalizeMilestoneStoryState(target.meta.storyMilestones);
    const priorEndgame = normalizeEndgameProgress(target.meta.endgame);
    const legacyInventoryMigrated = priorEndgame.legacyInventoryMigrated;
    const inventory = toArray(target.inv);
    const legacyShardCount = legacyInventoryMigrated
        ? 0
        : inventory.filter((item) => readFields(item)?.name === '원시의 파편').length;
    const requiredShards = Math.max(1, Number(BALANCE.PRIMAL_SHARD_REQUIRED) || 3);
    target.meta.endgame = {
        ...priorEndgame,
        primalShards: Math.min(requiredShards, priorEndgame.primalShards + legacyShardCount),
        legacyInventoryMigrated: true,
    };
    target.inv = inventory.filter((item) => readFields(item)?.name !== '원시의 파편');
    const settings = readFields(target.settings);
    const settingsDetailMode = readString(settings?.equipmentDetailMode);
    target.settings = {
        ...(settings ?? {}),
        readabilityMode: settings?.readabilityMode === 'high' ? 'high' : 'standard',
        equipmentDetailMode: settingsDetailMode !== undefined && ['summary', 'full'].includes(settingsDetailMode)
            ? settingsDetailMode
            : 'auto',
    };
    target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0 };
    // cycle 376: bountyDate / bountyIssued normalizations 제거 — 모든 consumer가
    //   strict equality (`bountyDate === today`) 또는 truthy 체크 (`&& bountyIssued`)
    //   로 undefined 안전 처리. Boolean coercion / `|| null` 정규화 redundant.
    // cycle 377: stats.rests / bountiesCompleted fallback 제거 (cycle 373/374/376 동일 lens) —
    //   모든 consumer가 이미 `|| 0` fallback 처리. ascensionActions 직접 read도 checkTitles
    //   `|| 0` fallback으로 안전.
    // cycle 379: claimedAchievements normalization 제거 (cycle 373-378 동일 lens) —
    //   모든 consumer (AchievementPanel / useInventoryActions / progressionHandlers)가
    //   이미 `Array.isArray` 또는 `|| []` fallback 처리.
    // cycle 260: stats.claimedQuestIds 정규화 보존 — quest 완료 영구 ledger.
    //   cycle-260 회귀 가드 테스트가 migrateData output 명시 검증.
    target.stats.claimedQuestIds = Array.isArray(target.stats.claimedQuestIds) ? target.stats.claimedQuestIds : [];
    target.stats.visitedMaps = Array.isArray(target.stats.visitedMaps) ? target.stats.visitedMaps : [];
    // 위 정규화 직후라 항상 배열이다 — 아래 includes/push를 위한 타입 좁히기(같은 참조).
    const visitedMaps = toArray(target.stats.visitedMaps);
    target.stats.exploresByLocation = target.stats.exploresByLocation
        && typeof target.stats.exploresByLocation === 'object'
        && !Array.isArray(target.stats.exploresByLocation)
        ? target.stats.exploresByLocation
        : {};
    target.stats.exploreState = { ...DEFAULT_EXPLORE_STATE, ...(readFields(target.stats.exploreState) ?? {}) };
    const questCatalog = new Map<unknown, typeof QUESTS[number]>(QUESTS.map((quest) => [quest.id, quest]));
    target.quests = toArray(target.quests).map((questState) => {
        const questFields = readFields(questState);
        const quest = questCatalog.get(questFields?.id);
        const cumulativeProgress = getCumulativeQuestProgress(quest, playerView);
        if (cumulativeProgress === null) return questState;
        return {
            ...(questFields ?? {}),
            progress: Math.max(Number(questFields?.progress) || 0, cumulativeProgress),
        };
    });
    const activeExpedition = normalizeActiveExpedition(target.activeExpedition);
    target.activeExpedition = activeExpedition;
    target.lastExpeditionSummary = normalizeExpeditionSummary(target.lastExpeditionSummary);
    target.classJourney = normalizeClassJourneyLedger(target.classJourney);
    const expeditionSequence = readNumber(target.expeditionSequence);
    target.expeditionSequence = expeditionSequence !== undefined
        && Number.isSafeInteger(expeditionSequence)
        && expeditionSequence >= 0
        ? expeditionSequence
        : 0;
    target.returnSupplyRewards = normalizeReturnSupplyRewardLedger(target.returnSupplyRewards);
    target.expeditionFocusQuestIds = Array.isArray(target.expeditionFocusQuestIds)
        ? getPreparedExpeditionFocusQuestIds({ ...playerView, activeExpedition: null })
        : getDefaultExpeditionFocusQuestIds(playerView, activeExpedition?.destination);
    if (target.loc && !visitedMaps.includes(target.loc)) {
        visitedMaps.push(target.loc);
    }

    if (!Array.isArray(savedData.quickSlots)) {
        savedData.quickSlots = [null, null, null];
    } else {
        const quickSlots: unknown[] = savedData.quickSlots.slice(0, 3);
        while (quickSlots.length < 3) quickSlots.push(null);
        savedData.quickSlots = quickSlots;
    }

    // v4.0 — 신규 필드 기본값 (기존 세이브 호환)
    // cycle 382: target.relics / target.titles normalizations 제거 (cycle 373-381 동일 lens) —
    //   모든 consumer가 이미 `|| []` 또는 `Array.isArray` 또는 optional chain fallback 처리.
    // cycle 375: target.activeTitle = target.activeTitle || null 제거 — 모든 consumer가
    //   이미 fallback (`|| null`) 또는 truthy 체크로 undefined / null 안전하게 처리.
    const priorCombatFlags = readFields(target.combatFlags);
    target.combatFlags = {
        comboCount: 0,
        deathSaveUsed: false,
        voidHeartUsed: Boolean(priorCombatFlags?.voidHeartUsed),
        voidHeartArmed: Boolean(priorCombatFlags?.voidHeartArmed),
    };
    // cycle 378: 8 sub-field fallback 일괄 제거 (cycle 373-377 동일 lens) —
    //   prestigeRank / relicCount / crafts / buildWins / abyssFloor / abyssRecord /
    //   demonKingSlain / dailyProtocol. 모든 consumer가 이미 fallback / optional chain
    //   처리. ascensionActions 직접 read도 checkTitles `|| 0` fallback으로 안전.
    // cycle 277: totalPrestigeAtk/Hp/Mp 3 dead 필드 정규화 제거 — read 0건. 잔존 saved 데이터는 무해.
    // cycle 124: dead `comboCount` migrate 제거. INITIAL_STATE에서도 제거됨.
    //   활성 combo 카운터는 combatFlags.comboCount(별도 필드)로 처리.
    // cycle 120: dead 'discoveries' migrate 제거 (cycle 84 INITIAL_STATE 정리 후속).
    //   신규 영구 카운터 default 추가 — cycle 119 ASCEND preserve와 정합.
    // cycle 120/131 회귀 가드: 다음 4 필드는 migrate output 명시 검증으로 fallback 유지.
    target.stats.escapes         = target.stats.escapes         || 0;
    target.stats.syntheses       = target.stats.syntheses       || 0;
    target.stats.maxKillStreak   = target.stats.maxKillStreak   || 0;
    target.stats.discoveryChains = Array.isArray(target.stats.discoveryChains) ? target.stats.discoveryChains : [];
    target.stats.currentRun = normalizeCurrentRunProgress(target.stats, { now });
    // pendingRelics는 런타임 전용 — 저장 불필요, 로드 시 null로 초기화
    savedData.pendingRelics = null;

    // v4.1 — 도감(Codex) + 프리미엄 재화
    if (!target.stats.codex) {
        const codex: Record<string, SaveRecord> = {
            weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {},
        };
        target.stats.codex = codex;
        // 기존 인벤토리에서 codex 부트스트랩
        for (const item of toArray(target.inv)) {
            // 여기만 옵셔널 체이닝 없이 읽는다 — 인벤에 null 원소가 섞인 구세이브는
            // 예전에도 이 줄에서 TypeError를 냈다(호출부가 오프라인 복구로 내려보낸다).
            const itemFields = item as SaveRecord;
            const cat = itemFields.type === 'weapon' ? 'weapons'
                : itemFields.type === 'armor' ? 'armors'
                : itemFields.type === 'shield' ? 'shields'
                : itemFields.type === 'mat' ? 'materials' : null;
            if (cat && itemFields.name) {
                codex[cat][String(itemFields.name)] = { discovered: true };
            }
        }
        // 기존 장비에서도 부트스트랩
        for (const slot of ['weapon', 'armor', 'offhand']) {
            const eq = readFields(target.equip?.[slot]);
            if (eq?.name) {
                const cat = eq.type === 'weapon' ? 'weapons'
                    : eq.type === 'armor' ? 'armors'
                    : eq.type === 'shield' ? 'shields' : null;
                if (cat) codex[cat][String(eq.name)] = { discovered: true };
            }
        }
        // killRegistry에서 몬스터 codex 부트스트랩
        // (`Number(kills) > 0`은 기존 `kills > 0`의 JS 관계 연산 강제 변환과 동일하다.)
        for (const [name, kills] of Object.entries(readFields(target.stats.killRegistry) ?? {})) {
            if (Number(kills) > 0) {
                codex.monsters[name] = { discovered: true, kills };
            }
        }
    }
    target.premiumCurrency = target.premiumCurrency || 0;
    // cycle 383: codexClaimed array normalization 제거 (cycle 373-382 동일 lens) —
    //   모든 consumer (Codex / rewardHandlers / progressionHandlers)가 이미 `|| []` 또는
    //   `Array.isArray` fallback 처리. cosmeticTitles는 cycle 189 회귀 가드로 보존.

    // cycle 189: PremiumShop 구매 자산 4종 default — cycle 185(cosmetic title) /
    //   cycle 186(reviveTokens, synthProtects) / cycle 188(ASCEND preserve) 정합성.
    //   옛 save에 미정의된 필드를 명시 0/[] 초기화 → fallback 분기 단순화 + 데이터 형태 lock.
    target.reviveTokens = Math.max(0, Number(target.reviveTokens) || 0);
    if (target.maxInv !== undefined) target.maxInv = Math.max(20, Number(target.maxInv) || 20);
    target.stats.synthProtects = Math.max(0, Number(target.stats.synthProtects) || 0);
    target.stats.cosmeticTitles = Array.isArray(target.stats.cosmeticTitles) ? target.stats.cosmeticTitles : [];

    // v4.2 — 시즌 패스
    // 2026-09 Wave 12 D2: 'S1' 리터럴이 아니라 레지스트리의 첫 시즌을 쓴다(값은 동일 —
    //   골든/왕복 출력이 한 바이트도 바뀌지 않는다). 회전으로 생긴 선택 필드
    //   (`ordinal`/`completedSeasons`/`archive`)는 **여기서 채우지 않는다**:
    //   기본값이 읽는 쪽(`resolveSeasonOrdinal`/`getSeasonArchive`)에 있으므로
    //   구세이브는 그대로 시즌 1로 굴러 들어가고 DATA_VERSION bump가 필요 없다.
    if (!target.seasonPass) {
        target.seasonPass = createSeasonPassState();
    }
    // 회전 도입 **이전에** 30단계를 전부 수령하고 멈춰 버린 세이브를 한 번 굴려준다.
    //   그 상태는 이제 어떤 액션으로도 벗어날 수 없다 — 남은 수령이 0이라
    //   CLAIM_SEASON_REWARD가 즉시 거부되고, 회전을 여는 유일한 문이 그 액션이기 때문이다.
    //   판정은 회전 트리거와 **같은 함수**를 쓰고 완주 여부만 본다(벽시계 무관 → 결정론 유지).
    //   시즌 칭호 3종은 그 30번의 수령에서 이미 지급됐으므로 여기서 퇴행하는 것은 없다.
    const rolledSeason = advanceSeasonIfComplete(target.seasonPass as Player['seasonPass']);
    if (rolledSeason) target.seasonPass = rolledSeason;

    // v4.3 — 강화, 주간 미션, 챌린지, 스킬 분기, 묘비 침략
    if (!target.weeklyProtocol) {
        target.weeklyProtocol = { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
    }
    // cycle 387: skillChoices / challengeModifiers normalizations 제거 (cycle 373-386
    //   동일 lens) — 모든 consumer가 이미 optional chain (`?.[name]`, `?.includes()`)
    //   또는 `|| {}` / `|| []` fallback 처리.
    // cycle 386: dailyInvadeCount / lastInvadeDate fallback 제거 (cycle 373-385 동일 lens) —
    //   모든 consumer가 이미 `|| 0` fallback 또는 strict equal 비교 (`=== today`)로
    //   undefined / null 안전 처리.
    // 기존 저장 계약대로 모든 아이템 인스턴스에 enhance 기본값을 보장한다.
    // 뒤의 경제 마이그레이션은 canonical 장비의 baseItemName / price만 바꾼다.
    if (Array.isArray(target.inv)) {
        target.inv = target.inv.map((item: unknown) => {
            if (!item) return item;
            const itemFields = readFields(item) ?? {};
            return { ...itemFields, enhance: itemFields.enhance || 0 };
        });
    }

    // v5.0 — 진 엔딩, 이벤트 체인, 시너지
    if (!target.eventChainProgress || typeof target.eventChainProgress !== 'object') {
        target.eventChainProgress = {};
    }
    // cycle 384: areaBossDefeated / deathSaveUsedCount fallback 제거 (cycle 373-383 동일
    //   lens) — 모든 consumer가 이미 optional chain (`?.areaBossDefeated?.[name]`) 또는
    //   `|| {}` / `|| 0` fallback 처리.
    // cycle 388: killStreak 정규화 제거 (cycle 373-387 동일 lens) — 모든 consumer가
    //   `player.killStreak || 0` fallback 처리. 비숫자 값(corrupt save)도 이후 비교에서
    //   NaN → false 반환으로 안전 (crash 없음).
    // cycle 206: 진 엔딩 파편 dead meta 필드 제거 — v5.0 schema 잔해 wire-up 안 됨.
    //   파편 메커니즘은 inv 기반 (combatBossHandlers.ts:15 inv.filter shard count)으로
    //   구현되어 있어 meta 필드는 dead. cycle 120(discoveries) / cycle 124(comboCount) /
    //   cycle 195(6 dead constants)와 동일 cleanup 패턴.

    // cycle 385: discoveryChains 정규화 중복 제거 — 동일 코드가 line 440(cycle 120 영역)에
    //   이미 존재. 두 번째는 noop이라 redundant.

    // 장비 경제 마이그레이션은 exact canonical identity가 있는 인스턴스의
    // baseItemName / price만 고친다. 알 수 없는 legacy 이름·접두사·확장 필드는
    // 추측하거나 삭제하지 않고 그대로 보존한다.
    if (Array.isArray(target.inv)) {
        const inv: unknown[] = target.inv;
        target.inv = inv.map((entry) => migrateEquipmentInstancePrice(readItem(entry)));
    }
    if (target.equip) {
        target.equip.weapon = migrateEquipmentInstancePrice(readItem(target.equip.weapon));
        target.equip.armor = migrateEquipmentInstancePrice(readItem(target.equip.armor));
        target.equip.offhand = migrateEquipmentInstancePrice(readItem(target.equip.offhand));
    }

    // 이 단언이 이 함수의 반환 계약이다 — 위 300여 줄이 세운 봉투 모양(`MigratedSave`)을
    // 한 곳에서만 주장하고, 그 밖의 어디에서도 입력을 `Player`로 가정하지 않는다.
    return savedData as MigratedSave;
};
