import { BALANCE } from '../../data/constants';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { getFieldChestReward, grantFieldChestReward, isFieldChestMimic } from '../../systems/fieldChest';
import { advanceDailyTrialMap } from '../../systems/dailyTrial';
import { getFieldDoor } from '../../systems/fieldDoor';
import { getFieldTraitOffer, isFieldTraitChoiceOpen, readFieldTrait } from '../../systems/fieldTrait';
import { getFirstChestRelicOffer, isFirstChestRelicOpen } from '../../systems/firstChestRelic';
import {
    areAllFieldChestsOpened,
    createFieldMapState,
    getFieldEncounterThreshold,
    getFieldMapLayout,
    isFieldMapRegion,
    resolveFieldStep,
} from '../../systems/fieldMapWalk';
import { getMapAccess } from '../../utils/mapAccess';
import { canPayFieldAutoCost, getFieldAutoRunCost, getFieldAutoRunsUsed, isFieldAutoResumable } from '../../utils/fieldAuto';
import { getProtocolDayKey } from '../../utils/protocolCycle';
import { createDomainRandom } from '../../utils/seededRandom';
import { isTrialPlayer } from '../../utils/trialPlayer';
import type { FieldMapState } from '../../types/fieldMap';
import type { Player } from '../../types/player';
import type { LogEntry } from '../../types/session.js';
import { GS } from '../gameStates';
import type { GameState, HandlerMap } from '../gameReducer';
import type { ActionOf } from '../actionTypes';
import { AT } from '../actionTypes';
import { appendRewardLogs } from './rewardLog';

/**
 * 2026-11 지역 지도 걷기(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md §2 · §5 · §6 · §7). 걷기 전이는 이 리듀서가 소유한다 —
 * 연타 · 빠른 누름에도 상태가 갈라지지 않는다(전투 턴과 같은 원칙). 조우 · 출구 · 미믹은 처리할 일(`pending`)로 남기고 화면 쪽
 * 훅이 기존 액션(`explore` · `move` · 전투 시작)으로 처리한다. 판정 · 보상은 게임 난수를 쓰지 않는다.
 */

type LogLine = { type: string; text: string };

const withLogs = (state: GameState, player: Player, lines: LogLine[], now: number): GameState => ({
    ...state,
    player,
    logs: appendRewardLogs(state.logs, lines, { now, seed: state.logs.length }) as LogEntry[],
    syncStatus: 'syncing',
});

/** 지금 걷는 지도 — 대기 상태 · 지도 지역 · 그 지역의 지도일 때만 */
const getWalkableField = (state: GameState): { field: FieldMapState; loc: string } | null => {
    const { player } = state;
    const loc = player.loc;
    if (!loc || !isFieldMapRegion(loc, DB.MAPS[loc])) return null;
    const field = player.fieldMap;
    if (!field || field.loc !== loc) return null;
    return { field, loc };
};

const fieldEnter = (state: GameState): GameState => {
    const loc = state.player.loc;
    const mapData = loc ? DB.MAPS[loc] : null;
    if (!loc || !mapData || !isFieldMapRegion(loc, mapData)) return state;
    if (state.player.fieldMap?.loc === loc) return state;
    return { ...state, player: { ...state.player, fieldMap: createFieldMapState(state.player, loc, mapData) }, syncStatus: 'syncing' };
};

const isWalkingAllowed = (state: GameState): boolean => (
    state.gameState === GS.IDLE && !state.pendingRelics && !state.postCombatResult && !state.currentEvent
);

const fieldStep = (state: GameState, action: ActionOf<typeof AT.FIELD_STEP>): GameState => {
    if (!isWalkingAllowed(state)) return state;
    const walkable = getWalkableField(state);
    if (!walkable) return state;
    const { field, loc } = walkable;
    const mapData = DB.MAPS[loc];
    const now = Number.isFinite(action.payload?.now) ? action.payload.now : 0;
    const auto = Boolean(action.payload?.auto);
    const layout = getFieldMapLayout(field, mapData);
    // 3단계 보스 문 — 보일 때만 밟을 수 있는 처리할 일이 된다(문은 저장된 게이지 · 격파 기록에서 나온다).
    const door = getFieldDoor(state.player, loc, mapData, layout);
    const result = resolveFieldStep(field, layout, action.payload.direction, getFieldEncounterThreshold(state.player, loc), door);
    const { outcome } = result;
    if (outcome.kind === 'blocked') return state;

    // 오늘의 시련: 출구는 다음 지도로 이어진다(지역을 떠나지 않는다).
    if (outcome.kind === 'exit' && isTrialPlayer(state.player)) {
        const player = advanceDailyTrialMap(state.player);
        return withLogs(state, player, [{ type: 'system', text: MSG.DAILY_TRIAL_MAP_ENTERED(player.trialRun?.map ?? 1, BALANCE.DAILY_TRIAL_MAPS) }], now);
    }

    if (outcome.kind === 'exit') {
        const access = getMapAccess(DB.MAPS, loc, outcome.to, state.player.level || 1, Boolean(state.liveConfig?.seasonEvent?.active));
        if (access.reason) {
            // 들어갈 수 없는 출구는 밟지 않는다 — 처리할 일이 남아 걷기가 막히지 않게 한다.
            const text = access.reason === 'level' ? MSG.MOVE_LEVEL_REQUIRED(access.requiredLevel)
                : access.reason === 'season' ? MSG.MOVE_SEASON_ONLY
                    : MSG.MOVE_NO_EXIT;
            return withLogs(state, state.player, [{ type: 'error', text }], now);
        }
        const cleared = state.player.fieldClearedRegions || [];
        const newlyCleared = areAllFieldChestsOpened(field, layout) && !cleared.includes(loc);
        const player: Player = {
            ...state.player,
            fieldMap: result.state,
            ...(newlyCleared ? { fieldClearedRegions: [...cleared, loc] } : {}),
        };
        return newlyCleared
            ? withLogs(state, player, [{ type: 'success', text: MSG.FIELD_CLEARED(loc) }], now)
            : { ...state, player, syncStatus: 'syncing' };
    }

    if (outcome.kind === 'chest') {
        // 자동 탐험에서는 미믹이 나오지 않는다(설계 §7) — 그 상자는 보통 상자로 열린다.
        //   오늘의 시련에서도 나오지 않는다 — 지도가 날짜마다 정해져 있어 그날 모두가 같은 상자에서 쓰러진다.
        // 계정 첫 여정의 첫 상자도 미믹이 아니다(`systems/firstChestRelic.ts`).
        const firstChest = isFirstChestRelicOpen(state.player);
        if (!auto && !firstChest && !isTrialPlayer(state.player) && isFieldChestMimic(loc, field.seed, outcome.chestId)) {
            const player = { ...state.player, fieldMap: { ...result.state, pending: { kind: 'mimic' as const, chestId: outcome.chestId } } };
            return withLogs(state, player, [{ type: 'warning', text: MSG.FIELD_MIMIC_AWAKE }], now);
        }
        const reward = getFieldChestReward(loc, mapData, field.seed, outcome.chestId, false, readFieldTrait(field));
        const grant = grantFieldChestReward(
            { ...state.player, fieldMap: result.state },
            reward,
            createDomainRandom(field.seed, loc, outcome.chestId, 'chest-item'),
            now,
        );
        const lines: LogLine[] = [{ type: 'success', text: MSG.FIELD_CHEST_OPENED(grant.gold, grant.admitted, grant.converted) }];
        if (grant.dropped.length > 0) lines.push({ type: 'warning', text: MSG.FIELD_CHEST_BAG_FULL(grant.dropped) });
        if (!firstChest) return withLogs(state, grant.player, lines, now);
        // 유물 제안과 장부는 같은 전이가 남긴다 — 기존 유물 선택 화면 · 리로드 복원(`pendingRelics`)이 이어받는다.
        const pendingRelics = getFirstChestRelicOffer(grant.player, { loc, seed: field.seed, chestId: outcome.chestId });
        lines.push({ type: 'event', text: MSG.FIRST_CHEST_RELIC_FOUND });
        return {
            ...withLogs(state, { ...grant.player, stats: { ...grant.player.stats, firstChestRelic: true } }, lines, now),
            pendingRelics,
        };
    }

    return { ...state, player: { ...state.player, fieldMap: result.state }, syncStatus: 'syncing' };
};

const fieldClearPending = (state: GameState, action: ActionOf<typeof AT.FIELD_CLEAR_PENDING>): GameState => {
    const field = state.player.fieldMap;
    if (!field?.pending || field.pending.kind !== action.payload?.kind) return state;
    return { ...state, player: { ...state.player, fieldMap: { ...field, pending: null } }, syncStatus: 'syncing' };
};

/**
 * 지도 갈래 — 이 지도의 성격을 정한다(한 번). 화면이 본 지도(`seq`) · 이 지도의 패 안의 성격일 때만 받고, 고를 수 없는 때(클리어하지 않은
 * 지역 · 이미 걸었거나 고름 · 자동 탐험의 지도)면 동일 참조다. 닫기는 `plain`이다.
 */
const fieldChooseTrait = (state: GameState, action: ActionOf<typeof AT.FIELD_CHOOSE_TRAIT>): GameState => {
    if (!isWalkingAllowed(state)) return state;
    const walkable = getWalkableField(state);
    if (!walkable || walkable.field.seq !== action.payload?.seq || !isFieldTraitChoiceOpen(state.player)) return state;
    const { field, loc } = walkable;
    const trait = action.payload.trait;
    if (!getFieldTraitOffer(state.player, field, DB.MAPS[loc]).includes(trait)) return state;
    const player: Player = { ...state.player, fieldMap: { ...field, trait } };
    if (trait === 'plain') return { ...state, player, syncStatus: 'syncing' };
    const now = Number.isFinite(action.payload.now) ? action.payload.now : 0;
    return withLogs(state, player, [{ type: 'system', text: MSG.FIELD_TRAIT_CHOSEN(MSG.FIELD_TRAIT_NAME[trait]) }], now);
};

const fieldAutoStart = (state: GameState, action: ActionOf<typeof AT.FIELD_AUTO_START>): GameState => {
    if (!isWalkingAllowed(state)) return state;
    const walkable = getWalkableField(state);
    if (!walkable || walkable.field.pending) return state;
    const { field, loc } = walkable;
    if (!(state.player.fieldClearedRegions || []).includes(loc)) return state;
    // 같은 지도에서 다시 켜면 횟수를 쓰지 않는다(설계 §7) — 이어 가기는 화면 쪽 훅이 전이 없이 한다.
    if (isFieldAutoResumable(field, getFieldMapLayout(field, DB.MAPS[loc]))) return state;
    const now = Number.isFinite(action.payload?.now) ? action.payload.now : 0;
    const used = getFieldAutoRunsUsed(state.player, now);
    // 무료를 다 쓴 뒤의 한 번은 값을 내고 시작한다 — 값을 내는 것과 횟수를 쓰는 것은 이 전이 하나다(연타에도 두 번 내지 않는다).
    const cost = getFieldAutoRunCost(used, state.player.level || 1);
    if (cost === undefined) return state;
    if (cost && !canPayFieldAutoCost(state.player, cost)) return state;
    const fresh = createFieldMapState(state.player, loc, DB.MAPS[loc]);
    const paid: Partial<Player> = !cost ? {}
        : cost.currency === 'gold' ? { gold: (state.player.gold || 0) - cost.amount }
            : { premiumCurrency: (state.player.premiumCurrency || 0) - cost.amount };
    const player: Player = {
        ...state.player,
        ...paid,
        fieldMap: { ...fresh, autoRun: true },
        stats: { ...state.player.stats, fieldAutoRuns: { day: getProtocolDayKey(new Date(now)), used: used + 1 } },
    };
    const text = !cost ? MSG.FIELD_AUTO_STARTED(BALANCE.FIELD_AUTO_RUNS_PER_DAY - used - 1)
        : cost.currency === 'gold' ? MSG.FIELD_AUTO_STARTED_PAID_GOLD(cost.amount)
            : MSG.FIELD_AUTO_STARTED_PAID_CRYSTAL(cost.amount);
    return withLogs(state, player, [{ type: 'system', text }], now);
};

export const fieldActionMap = {
    FIELD_ENTER: fieldEnter,
    FIELD_STEP: fieldStep,
    FIELD_CLEAR_PENDING: fieldClearPending,
    FIELD_AUTO_START: fieldAutoStart,
    FIELD_CHOOSE_TRAIT: fieldChooseTrait,
} satisfies HandlerMap;
