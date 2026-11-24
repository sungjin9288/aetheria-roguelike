import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { MSG } from '../data/messages';
import {
    buildDailyTrialPlayer,
    createDailyTrialField,
    getDailyTrialClearedMaps,
    getDailyTrialPlan,
    isDailyTrialBossDown,
    isDailyTrialUnlocked,
    readDailyTrialLedger,
    recordDailyTrial,
} from '../systems/dailyTrial';
import type { DailyTrialOutcome, DailyTrialResult, Player } from '../types';
import { getProtocolDayKey } from '../utils/protocolCycle';
import { AT } from './actionTypes';
import type { ActionOf, ActionType, GameAction, LoadDataPayload } from './actionTypes';
import type { GameState, HandlerMap } from './gameReducer';
import { GS, type GameMode } from './gameStates';
import { bootstrapActionMap } from './handlers/bootstrapHandlers';
import { appendRewardLogs } from './handlers/rewardLog';

/**
 * 2026-11 오늘의 시련의 격리 — 본편 상태를 통째로 보관하고(`slot.main`) 시련 상태를 그 자리에 세운다.
 *
 * - 시작(`BEGIN_DAILY_TRIAL`)과 끝(`END_DAILY_TRIAL`) 두 전이만 본편을 바꿔 낀다. 끝은 보관한 본편에 기록 장부
 *   (`stats.dailyTrial`) 하나만 더해 되돌린다 — 시련 안의 성장 · 전리품 · 도감 · 정수는 버린다.
 * - 시련을 걷는 동안 부트 · 동기화(세션) 전이는 보관한 본편에 적용하고, 본편의 진행을 쓰는 전이(보상 수령 · 계승 · 임무 …)는
 *   동일 참조로 무시한다. 새 액션은 아래 표에 분류해야 컴파일된다.
 * - 저장 · 업로드 · 텔레메트리가 읽는 상태는 `getMainGameState` 하나다 — 시련 중에도 본편을 읽으므로 시련이 새지 않는다.
 */

export interface DailyTrialSlot {
    dayKey: string;
    /** 보관한 본편 — 시련 중 세션 전이(동기화 · 순위표 …)만 반영된다 */
    main: GameState;
    /** 이번 판의 행동 수(적을수록 위) — 걸음은 세지 않는다 */
    actions: number;
    result: DailyTrialResult | null;
}

/** 시련 칸에 저장하는 봉투 — 본편 세이브와 같은 모양에 날짜 · 행동 수 · 결과를 더했다 */
export interface DailyTrialSave {
    dayKey: string;
    actions: number;
    result: DailyTrialResult | null;
    state: LoadDataPayload;
}

/** 시련 칸에 쓸 봉투 — 시련 중이 아니면 null이다. 본편 봉투(`useFirebaseSync`)와 같은 일곱 필드를 싣는다. */
export const buildDailyTrialSave = (state: GameState): DailyTrialSave | null => {
    const slot = state.dailyTrial;
    if (!slot) return null;
    const { player, gameState, enemy, grave, currentEvent, quickSlots, pendingRelics } = state;
    return {
        dayKey: slot.dayKey,
        actions: slot.actions,
        result: slot.result,
        state: { player, gameState, enemy, grave, currentEvent, quickSlots, pendingRelics: pendingRelics ?? null },
    };
};

/** 저장 · 업로드 · 텔레메트리 · 부트가 읽는 상태 — 시련 중이면 보관한 본편이다. */
export const getMainGameState = (state: GameState): GameState => state.dailyTrial?.main ?? state;

/** 본편에서 시련을 시작할 수 있는가 — 안전지대의 대기 상태, 첫 전직 뒤, 다른 화면이 덮이지 않았을 때. */
export const canBeginDailyTrial = (
    state: Pick<GameState, 'player' | 'gameState' | 'dailyTrial' | 'isAiThinking' | 'currentEvent' | 'pendingRelics' | 'postCombatResult' | 'runSummary'>,
): boolean => (
    !state.dailyTrial
    && state.gameState === GS.IDLE
    && !state.isAiThinking && !state.currentEvent && !state.pendingRelics && !state.postCombatResult && !state.runSummary
    && isDailyTrialUnlocked(state.player)
    && DB.MAPS[state.player.loc ?? '']?.type === 'safe'
);

type TrialActionKind = 'play' | 'session' | 'blocked';

/** 시련을 걷는 동안의 액션 분류 — `Record`라 새 액션은 분류해야 컴파일된다. */
const TRIAL_ACTION_KIND: Record<ActionType, TrialActionKind> = {
    [AT.SET_BOOT_STAGE]: 'session',
    [AT.SET_UID]: 'session',
    [AT.LOAD_DATA]: 'session',
    [AT.SET_LIVE_CONFIG]: 'session',
    [AT.SET_LEADERBOARD]: 'session',
    [AT.SET_SYNC_STATUS]: 'session',

    [AT.SET_GAME_STATE]: 'play',
    [AT.SET_PLAYER]: 'play',
    [AT.SET_ENEMY]: 'play',
    [AT.SET_EVENT]: 'play',
    [AT.LEAVE_EVENT]: 'play',
    [AT.SET_AI_THINKING]: 'play',
    [AT.SET_VISUAL_EFFECT]: 'play',
    [AT.SET_SIDE_TAB]: 'play',
    [AT.ADD_LOG]: 'play',
    [AT.UPDATE_LOG]: 'play',
    [AT.SET_QUICK_SLOT]: 'play',
    [AT.SET_POST_COMBAT_RESULT]: 'play',
    [AT.USE_INVENTORY_ITEM]: 'play',
    [AT.USE_COMBAT_ITEM]: 'play',
    [AT.RESOLVE_COMBAT_ACTION]: 'play',
    [AT.FIELD_ENTER]: 'play',
    [AT.FIELD_STEP]: 'play',
    [AT.FIELD_CLEAR_PENDING]: 'play',
    [AT.SET_PENDING_RELICS]: 'play',
    [AT.ADD_RELIC]: 'play',
    [AT.REPLACE_RELIC]: 'play',
    [AT.DECLINE_RELIC]: 'play',
    [AT.ENHANCE_ITEM]: 'play',
    [AT.CHOOSE_SKILL_BRANCH]: 'play',
    [AT.ABANDON_DAILY_TRIAL]: 'play',
    [AT.END_DAILY_TRIAL]: 'play',

    [AT.BEGIN_DAILY_TRIAL]: 'blocked',
    [AT.RESET_GAME]: 'blocked',
    [AT.ACCEPT_QUEST]: 'blocked',
    [AT.ABANDON_QUEST]: 'blocked',
    [AT.REQUEST_BOUNTY]: 'blocked',
    [AT.UPDATE_EXPEDITION_FOCUS_QUEST]: 'blocked',
    [AT.SET_GRAVE]: 'blocked',
    [AT.SET_SHOP_ITEMS]: 'blocked',
    [AT.SET_EXPEDITION_DEBRIEF_OPEN]: 'blocked',
    [AT.RECORD_RETURN_SUPPLY_REWARD]: 'blocked',
    [AT.CLEAR_ECONOMY_RECEIPT]: 'blocked',
    [AT.BUY_SHOP_ITEM]: 'blocked',
    [AT.SELL_INVENTORY_ITEM]: 'blocked',
    [AT.CRAFT_RECIPE]: 'blocked',
    [AT.CRAFT_BAG]: 'blocked',
    [AT.SYNTHESIZE_ITEMS]: 'blocked',
    [AT.AUTO_SELL_MATERIALS]: 'blocked',
    [AT.SELL_UNUSED_EQUIPMENT]: 'blocked',
    [AT.OPEN_MERCHANT_SHOP]: 'blocked',
    [AT.LEAVE_MERCHANT]: 'blocked',
    [AT.PURCHASE_PREMIUM_OFFER]: 'blocked',
    [AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE]: 'blocked',
    [AT.RESOLVE_CHAIN_GOLD_CHOICE]: 'blocked',
    [AT.DEFER_CHAIN_EVENT]: 'blocked',
    [AT.RESOLVE_FALLBACK_EVENT_TRANSACTION]: 'blocked',
    [AT.RESOLVE_SCOUT]: 'blocked',
    [AT.BEGIN_AI_EVENT]: 'blocked',
    [AT.RESOLVE_AI_EVENT]: 'blocked',
    [AT.FIELD_AUTO_START]: 'blocked',
    [AT.FIELD_CHOOSE_TRAIT]: 'blocked',
    [AT.CLAIM_CHAPTER_PICK]: 'blocked',
    [AT.ASCEND]: 'blocked',
    [AT.DEFER_ASCENSION]: 'blocked',
    [AT.REOPEN_ASCENSION]: 'blocked',
    [AT.REROLL_ASCENSION_RULE_OFFER]: 'blocked',
    [AT.UNLOCK_TITLES]: 'blocked',
    [AT.SET_ACTIVE_TITLE]: 'blocked',
    [AT.SET_DAILY_PROTOCOL]: 'blocked',
    [AT.UPDATE_DAILY_PROTOCOL]: 'blocked',
    [AT.SET_RUN_SUMMARY]: 'blocked',
    [AT.ADD_SEASON_XP]: 'blocked',
    [AT.CLAIM_QUEST_REWARD]: 'blocked',
    [AT.CLAIM_ACHIEVEMENT_REWARD]: 'blocked',
    [AT.CLAIM_SEASON_REWARD]: 'blocked',
    [AT.CLAIM_CODEX_REWARD]: 'blocked',
    [AT.CLAIM_WEEKLY_MISSION]: 'blocked',
    [AT.UPDATE_WEEKLY_PROTOCOL]: 'blocked',
    [AT.UPDATE_EVENT_CHAIN]: 'blocked',
    [AT.PURCHASE_MIRROR_NODE]: 'blocked',
};

/** 시련에서 설 수 있는 모드 — 화이트리스트라 새 `GS` 멤버는 자동으로 거부된다. */
const TRIAL_MODES: ReadonlySet<GameMode> = new Set<GameMode>([GS.IDLE, GS.COMBAT, GS.EVENT, GS.DEAD]);

/**
 * 세션 필드 — 보관한 본편의 값을 바깥에도 비춘다(저장 배지 · 순위표). 운영 설정(`liveConfig` — 시즌 배율 · 계절 출구)은 비추지 않는다:
 * 날짜가 같으면 누구나 같은 조건이어야 하므로 시련은 언제나 초기값으로 걷는다.
 */
const mirrorSession = (state: GameState, main: GameState): GameState => ({
    ...state,
    bootStage: main.bootStage,
    uid: main.uid,
    leaderboard: main.leaderboard,
    syncStatus: main.syncStatus,
    lastLoadedTimestamp: main.lastLoadedTimestamp,
});

const isSessionMirrored = (state: GameState, main: GameState): boolean => (
    state.bootStage === main.bootStage && state.uid === main.uid
    && state.leaderboard === main.leaderboard && state.syncStatus === main.syncStatus
    && state.lastLoadedTimestamp === main.lastLoadedTimestamp
);

const withLog = (state: GameState, type: string, text: string, now: number): GameState => ({
    ...state,
    logs: appendRewardLogs(state.logs, [{ type, text }], { now, seed: state.logs.length }),
});

const finishTrial = (state: GameState, slot: DailyTrialSlot, player: Player, outcome: DailyTrialOutcome): GameState => {
    const run = player.trialRun ?? { dayKey: slot.dayKey, map: 1 };
    const cleared = outcome === 'cleared';
    const result: DailyTrialResult = { outcome, cleared, maps: getDailyTrialClearedMaps(run, cleared), actions: slot.actions };
    return {
        ...state,
        player,
        gameState: GS.TRIAL_RESULT,
        enemy: null,
        currentEvent: null,
        postCombatResult: null,
        pendingRelics: null,
        grave: null,
        runSummary: null,
        visualEffect: null,
        expeditionDebriefOpen: false,
        dailyTrial: { ...slot, result },
    };
};

// ── 행동 수 ─────────────────────────────────────────────────────────────

/** 행동 하나로 세는 전이인가 — 전투 차례 · 조우 · 상자 · 사건과 유물의 선택 · 전투 밖 소모품. 걸음은 세지 않는다. */
const countAction = (prev: GameState, next: GameState, action: GameAction): number => {
    switch (action.type) {
        case AT.RESOLVE_COMBAT_ACTION:
        case AT.USE_COMBAT_ITEM:
            return next.combatTurn > prev.combatTurn ? 1 : 0;
        case AT.FIELD_STEP: {
            const before = prev.player.fieldMap;
            const after = next.player.fieldMap;
            if (before?.seq !== after?.seq) return 0;
            const opened = (after?.openedChests?.length ?? 0) > (before?.openedChests?.length ?? 0);
            const met = !before?.pending && (after?.pending?.kind === 'encounter' || after?.pending?.kind === 'mimic');
            return opened || met ? 1 : 0;
        }
        case AT.USE_INVENTORY_ITEM:
            return next.player !== prev.player ? 1 : 0;
        default:
            if (prev.pendingRelics && !next.pendingRelics) return 1;
            return prev.gameState === GS.EVENT && next.gameState !== GS.EVENT ? 1 : 0;
    }
};

// ── 시련을 걷는 동안의 전이 ──────────────────────────────────────────────

const endTrial = (slot: DailyTrialSlot, outer: GameState, now: number): GameState => {
    const { main, result } = slot;
    if (!result) return outer;
    const ledger = recordDailyTrial(readDailyTrialLedger(main.player.stats), slot.dayKey, result);
    const restored: GameState = {
        ...main,
        player: { ...main.player, stats: { ...main.player.stats, dailyTrial: ledger } },
        // 시련 중의 전투 영수증이 서사 이펙트의 소비 표시를 앞질러 갔다 — 본편의 옛 영수증을 다시 읽지 않게 비운다.
        combatReceipt: null,
        combatFeedback: null,
        isAiThinking: false,
        visualEffect: null,
        presentationEpoch: Math.max(main.presentationEpoch, outer.presentationEpoch) + 1,
        syncStatus: 'syncing',
        dailyTrial: null,
    };
    return withLog(restored, 'system', MSG.DAILY_TRIAL_RETURNED(result), now);
};

export const reduceDailyTrial = (
    state: GameState,
    slot: DailyTrialSlot,
    action: GameAction,
    reduceMain: (state: GameState, action: GameAction) => GameState,
): GameState => {
    const kind = TRIAL_ACTION_KIND[action.type];
    if (kind === 'session') {
        const main = reduceMain(slot.main, action);
        return main === slot.main ? state : mirrorSession({ ...state, dailyTrial: { ...slot, main } }, main);
    }
    if (kind !== 'play') return state;
    if (action.type === AT.END_DAILY_TRIAL) return endTrial(slot, state, action.payload.now);
    // 결과가 나온 판은 더 걷지 않는다 — 남은 타이머 · 연타가 결과를 바꾸지 못한다.
    if (slot.result) return state;
    if (action.type === AT.ABANDON_DAILY_TRIAL) return finishTrial(state, slot, state.player, 'left');
    if (action.type === AT.SET_GAME_STATE && !TRIAL_MODES.has(action.payload)) return state;

    const reduced = reduceMain(state, action);
    if (reduced === state) return state;
    const mirrored: GameState = isSessionMirrored(reduced, slot.main) ? reduced : mirrorSession(reduced, slot.main);
    // 시련에는 서사 호출(AI)이 없다 — 전투 영수증의 이야기를 비운다(엔진의 호출 차단과 두 겹).
    const next: GameState = mirrored.combatReceipt?.stories.length
        ? { ...mirrored, combatReceipt: { ...mirrored.combatReceipt, stories: [] } }
        : mirrored;
    const actions = slot.actions + countAction(state, next, action);
    const nextSlot = actions === slot.actions ? slot : { ...slot, actions };
    const run = state.player.trialRun ?? { dayKey: slot.dayKey, map: 1 };
    // 사망은 본편의 사망 처리(묘비 · 영구 상태 선별 · 요약)를 남기지 않는다 — 쓰러지기 전 시련 플레이어로 결과를 낸다.
    if (next.gameState === GS.DEAD) return finishTrial(next, nextSlot, { ...state.player, hp: 0 }, 'dead');
    const player = next.player.trialRun ? next.player : { ...next.player, trialRun: run };
    if (isDailyTrialBossDown(player)) return finishTrial(next, nextSlot, player, 'cleared');
    return { ...next, player, dailyTrial: nextSlot };
};

// ── 시작 ────────────────────────────────────────────────────────────────

/** 멈춘 판을 이어 세운다 — 본편 불러오기와 같은 정규화를 거치고, 지도 · 날짜는 조건에서 다시 확인한다. */
const resumeTrial = (fresh: GameState, slot: DailyTrialSlot, saved: DailyTrialSave): GameState => {
    const plan = getDailyTrialPlan(slot.dayKey);
    const loaded = bootstrapActionMap.LOAD_DATA(fresh, { type: AT.LOAD_DATA, payload: saved.state });
    const map = Math.min(BALANCE.DAILY_TRIAL_MAPS, Math.max(1, Math.trunc(Number(loaded.player.trialRun?.map) || 1)));
    const planned = createDailyTrialField(slot.dayKey, map);
    const savedField = loaded.player.fieldMap;
    const fieldMap = savedField?.loc === plan.region && savedField.seq === map && savedField.seed === planned.seed
        ? { ...savedField, plan: planned.plan }
        : planned;
    const { name, gender, settings } = fresh.player;
    const player: Player = { ...loaded.player, name, gender, settings, loc: plan.region, trialRun: { dayKey: slot.dayKey, map }, fieldMap };
    const nextSlot: DailyTrialSlot = { ...slot, actions: saved.actions, result: null };
    const gameState: GameMode = TRIAL_MODES.has(loaded.gameState) ? loaded.gameState : GS.IDLE;
    const resumed: GameState = { ...loaded, player, gameState, logs: fresh.logs, dailyTrial: nextSlot };
    return saved.result
        ? { ...finishTrial(resumed, nextSlot, player, saved.result.outcome), dailyTrial: { ...nextSlot, result: saved.result } }
        : resumed;
};

const beginTrial = (initialState: GameState, state: GameState, action: ActionOf<typeof AT.BEGIN_DAILY_TRIAL>): GameState => {
    const { now, saved } = action.payload;
    if (!Number.isFinite(now) || !canBeginDailyTrial(state)) return state;
    const dayKey = getProtocolDayKey(new Date(now));
    const slot: DailyTrialSlot = { dayKey, main: state, actions: 0, result: null };
    const plan = getDailyTrialPlan(dayKey);
    const started = withLog({
        ...initialState,
        player: buildDailyTrialPlayer(initialState.player, state.player, dayKey),
        presentationEpoch: state.presentationEpoch + 1,
        dailyTrial: slot,
    }, 'system', MSG.DAILY_TRIAL_STARTED(plan.region, plan.bossName, BALANCE.DAILY_TRIAL_MAPS), now);
    const resumed = saved && saved.dayKey === dayKey ? resumeTrial(started, slot, saved) : started;
    return mirrorSession(resumed, state);
};

export const makeDailyTrialActionMap = (initialState: GameState) => ({
    BEGIN_DAILY_TRIAL: (state, action) => beginTrial(initialState, state, action),
    // 본편에는 나갈 시련이 없다 — 시련 중의 두 전이는 `reduceDailyTrial`이 소유한다.
    ABANDON_DAILY_TRIAL: (state) => state,
    END_DAILY_TRIAL: (state) => state,
} satisfies HandlerMap);
