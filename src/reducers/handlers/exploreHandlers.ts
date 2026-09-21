import { BALANCE } from '../../data/constants';
import { DB } from '../../data/db';
import { MSG } from '../../data/messages';
import { advanceBossGauge, isAreaBossUndefeated } from '../../utils/bossGauge';
import { buildScoutEvent, consumeScoutCharge, getScoutAvailability } from '../../utils/scoutEvents';
import { createSeededRandom } from '../../utils/seededRandom';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import type { ResolveScoutPayload } from '../actionTypes';
import type { GameState, HandlerMap } from '../gameReducer';
import { GS } from '../gameStates';

/**
 * exploreHandlers — 탐험 보조 행동의 단일 reducer 전이.
 *
 * 2026-09 Wave 4 N1b: `scout()`은 훅에서 SET_PLAYER → SET_GAME_STATE → SET_EVENT를
 * 연달아 쏘는 다중 dispatch였다. 리렌더 전에 두 번 눌리면 같은 카드 1장에 골드/무료
 * 횟수가 2번 빠진다(전투 경로는 같은 위험을 combatAttack의 claimCombatAction으로 막는다).
 * 가용성 판정 · 비용 정산 · 게이지 · 카드 개방을 이 전이 하나로 합치고, 판정을 훅이
 * 본 스냅샷이 아니라 **리듀서 상태**로 다시 실행한다 — 두 번째 전이는 이미 GS.EVENT라
 * 불가 판정이 되어 `state`를 그대로 돌려준다(동일 객체 = no-op).
 *
 * 카드 선택의 정산 권한은 여전히 eventActions.handleScoutChoice 한 곳뿐이다
 * (79df84f). 이 핸들러는 commitExploreOutcome을 호출하지 않는다 — 카드가 열리는 것
 * 자체는 탐험 결과가 아니다.
 */

const PAYLOAD_KEYS = ['seed', 'now'];
const UINT32_MAX = 0xffffffff;

const isPayload = (value: unknown): value is ResolveScoutPayload => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const payload = value as Record<string, unknown>;
    const keys = Reflect.ownKeys(payload);
    return keys.length === PAYLOAD_KEYS.length
        && keys.every((key) => typeof key === 'string' && PAYLOAD_KEYS.includes(key))
        && Number.isSafeInteger(payload.seed)
        && Number(payload.seed) >= 0
        && Number(payload.seed) <= UINT32_MAX
        && Number.isSafeInteger(payload.now)
        && Number(payload.now) >= 0;
};

/**
 * 2026-09 Wave 19 K1 — AI 이벤트 준비/정산.
 *
 * 예전 구조는 훅이 `GS.EVENT`를 **먼저** 세우고 최대 9.5초를 기다린 뒤 `SET_EVENT`를
 * 쏘는 것이었다. 그 창의 상태는 `{gameState: 'event', currentEvent: null}`이고,
 *  - `generateEvent`가 reject하면(예: `TokenQuotaManager`의 `JSON.parse` 예외)
 *    `catch`가 없어 그 모양 그대로 남았다 — `EventPanel`은 `return null`, 터미널은
 *    `FOCUS_PANEL_STATES`라 마운트되지 않는 **라이브 벽돌**.
 *  - 기다리는 동안 dismiss/리로드가 일어나면 뒤늦은 `SET_EVENT`가 idle 위에 떨어져
 *    고아 `currentEvent`가 남았다.
 * 준비 중을 별도 모드(`EVENT_PENDING`)로 빼고, **응답을 반영해도 되는지의 판정을
 * 리듀서가 소유한다** — `EVENT_PENDING`이 아니면 `state`를 그대로 돌려준다(동일 참조).
 */
export const exploreActionMap = {
    BEGIN_AI_EVENT: (state): GameState => ({
        ...state,
        gameState: GS.EVENT_PENDING,
        currentEvent: null,
        isAiThinking: true,
        // SET_GAME_STATE가 하던 정리를 그대로 유지 (uiHandlers.ts).
        economyReceipt: null,
        postCombatResult: null,
        syncStatus: 'syncing',
    }),

    RESOLVE_AI_EVENT: (state, action): GameState => {
        // 준비 중이 아니면 이 응답은 주인이 없는 것이다(dismiss·리로드·다른 전이가
        // 이미 상태를 가져갔다). 버린다 — 동일 참조 반환이 곧 no-op이다.
        if (state.gameState !== GS.EVENT_PENDING) return state;
        const event = action.payload?.event ?? null;
        return {
            ...state,
            gameState: event ? GS.EVENT : GS.IDLE,
            currentEvent: event,
            isAiThinking: false,
            syncStatus: 'syncing',
        };
    },

    RESOLVE_SCOUT: (state, action): GameState => {
        if (!isPayload(action.payload)) return state;

        const mapData = DB.MAPS[state.player.loc ?? ''];
        // 훅과 같은 단일 판정을 리듀서 상태로 재실행한다 (scoutEvents.getScoutAvailability).
        const availability = getScoutAvailability(state.player, mapData, state.gameState === GS.IDLE);
        if (!availability.available) return state;

        const { seed, now } = action.payload;
        const chargedStats = availability.isFree
            ? consumeScoutCharge(state.player)
            : (state.player.stats || {});
        const withGauge = advanceBossGauge({ ...state.player, stats: chargedStats }, mapData);
        // SET_PLAYER 경로와 동일한 정규화 — 원정 최저 HP 추적을 건너뛰지 않는다.
        const player = trackExpeditionVitals({
            ...state.player,
            gold: Math.max(0, (state.player.gold || 0) - availability.cost),
            stats: withGauge,
        });

        const logs: Array<{ id: string; type: string; text: string }> = [{
            id: `scout:${now}:${seed}:cost`,
            type: 'system',
            text: availability.isFree
                ? MSG.SCOUT_FREE_LOG(Math.max(0, availability.remainingFree - 1))
                : MSG.SCOUT_PAID_LOG(availability.cost),
        }];
        // 게이지가 실제로 오르는 지역에서만 "시간이 흐른다"는 대가를 함께 알린다 (lessons R26).
        if (isAreaBossUndefeated(mapData, state.player)) {
            logs.push({ id: `scout:${now}:${seed}:time`, type: 'info', text: MSG.SCOUT_TIME_PASSES });
        }

        const scoutEvent = buildScoutEvent(state.player, mapData, createSeededRandom(seed));
        logs.push({ id: `scout:${now}:${seed}:card`, type: 'event', text: scoutEvent.desc });

        return {
            ...state,
            player,
            currentEvent: scoutEvent,
            gameState: GS.EVENT,
            // SET_GAME_STATE(EVENT)가 하던 정리를 그대로 유지 (uiHandlers.ts).
            economyReceipt: null,
            postCombatResult: null,
            logs: [...state.logs, ...logs].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
} satisfies HandlerMap;
