import { BALANCE } from '../../data/constants';
import { DB } from '../../data/db';
import { GS } from '../gameStates';
import { resolveCombatItemTurn, type CombatItemTurnResult } from '../../systems/combatItemTurn';
import { sanitizeConsumedQuickSlots } from '../../systems/consumableEffect';
import { createSeededRandom } from '../../systems/combatItemTurn';
import { resolveCombatActionTurn, type CombatActionTurnResult } from '../../systems/combatActionTurn';
import { resolveEndgameVictory } from '../../systems/endgameSettlement';
import { appendGrave } from '../../utils/graveUtils.js';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import { handleVictoryOutcome } from '../../hooks/combatActions/combatVictory';
import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import type { GameAction, GameState } from '../gameReducer';
import type { UseCombatItemPayload } from '../actionTypes';
import { addNewTitles, sanitizeQuickSlots } from './helpers';
import { applyPostCombatChoice, isPostCombatChoiceOffered, type PostCombatChoiceId } from '../../utils/postCombatChoice';
import { calculateFullStats } from '../../utils/statsCalculator';
import { activateDevourBonus } from '../../utils/adventureRelicBonuses';
import type { Item, LogEntry, Player, Monster } from '../../types';

const appendCombatLogs = (
    currentLogs: LogEntry[],
    entries: Array<{ type: string; text: string }>,
    now: number,
    seed: number,
): LogEntry[] => [
    ...currentLogs,
    ...entries.map((entry, index) => ({
        id: `combat-item-${now}-${seed}-${index}`,
        type: entry.type,
        text: entry.text,
    })),
].slice(-BALANCE.LOG_MAX_SIZE);

interface SettleVictoryParams {
    player: Player;
    deadEnemy: Monster;
    /** CombatActionTurnResult/CombatItemTurnResult.victoryStats — systems 쪽도 any. */
    stats: unknown;
    logs: Array<{ type: string; text: string }>;
    stories: Array<{ type: string; data: unknown }>;
    extendedChecks: boolean;
    seed: number;
    now: number;
    nextTurn: number;
    random: () => number;
}

const settleVictory = (
    state: GameState,
    {
        player,
        deadEnemy,
        stats,
        logs,
        stories,
        extendedChecks,
        seed,
        now,
        nextTurn,
        random,
    }: SettleVictoryParams,
): GameState => {
    const receiptKey = `${nextTurn}:${now}:${seed}`;
    if (state.player.meta?.endgame?.lastEndgameReceiptKey === receiptKey) return state;
    let logIndex = 0;
    let draft: GameState = {
        ...state,
        player,
        enemy: null,
        gameState: GS.IDLE,
        logs: appendCombatLogs(state.logs, logs, now, seed),
        visualEffect: null,
        combatTurn: nextTurn,
        combatReceipt: null,
        syncStatus: 'syncing',
    };
    const storyEvents = [...stories];
    const appendLog = (type: string, text: string) => {
        draft = {
            ...draft,
            logs: [
                ...draft.logs,
                { id: `combat-${now}-${seed}-${logIndex++}`, type, text },
            ].slice(-BALANCE.LOG_MAX_SIZE),
        };
    };
    const dispatch = (nestedAction: GameAction) => {
        if (nestedAction.type === 'SET_PLAYER') {
            const patch = typeof nestedAction.payload === 'function'
                ? nestedAction.payload(draft.player)
                : nestedAction.payload;
            const nextPlayer = trackExpeditionVitals({ ...draft.player, ...patch });
            draft = {
                ...draft,
                player: nextPlayer,
                quickSlots: sanitizeQuickSlots(draft.quickSlots, nextPlayer.inv),
                syncStatus: 'syncing',
            };
            return;
        }
        if (nestedAction.type === 'SET_ENEMY') {
            draft = { ...draft, enemy: nestedAction.payload, syncStatus: 'syncing' };
            return;
        }
        if (nestedAction.type === 'SET_GAME_STATE') {
            draft = { ...draft, gameState: nestedAction.payload, syncStatus: 'syncing' };
            return;
        }
        if (nestedAction.type === 'SET_VISUAL_EFFECT') {
            draft = { ...draft, visualEffect: nestedAction.payload };
            return;
        }
        if (nestedAction.type === 'SET_PENDING_RELICS') {
            draft = { ...draft, pendingRelics: nestedAction.payload };
            return;
        }
        if (nestedAction.type === 'SET_POST_COMBAT_RESULT') {
            draft = { ...draft, postCombatResult: nestedAction.payload };
            return;
        }
        if (nestedAction.type === 'UPDATE_DAILY_PROTOCOL') {
            draft = protocolActionMap.UPDATE_DAILY_PROTOCOL(draft, nestedAction);
            return;
        }
        if (nestedAction.type === 'UPDATE_WEEKLY_PROTOCOL') {
            draft = protocolActionMap.UPDATE_WEEKLY_PROTOCOL(draft, nestedAction);
            return;
        }
        if (nestedAction.type === 'ADD_SEASON_XP') {
            draft = rewardActionMap.ADD_SEASON_XP(draft, nestedAction);
        }
    };
    const emitUnlockedTitles = (candidate: Player) => {
        const titleLogs: Array<{ type: string; text: string }> = [];
        const titled = addNewTitles(candidate, titleLogs);
        if (titled === candidate) return;
        draft = {
            ...draft,
            player: { ...draft.player, titles: titled.titles, activeTitle: titled.activeTitle },
        };
        titleLogs.forEach((entry) => appendLog(entry.type, entry.text));
    };

    const victoryOutcome = handleVictoryOutcome({
        playerAfterCombat: player,
        deadEnemy,
        stats,
        dispatch,
        addLog: appendLog,
        addStoryLog: (type: string, data: unknown) => storyEvents.push({ type, data }),
        emitUnlockedTitles,
        extendedChecks,
        liveConfig: state.liveConfig,
        rng: random,
        now: () => now,
    });

    // Codex dc308c2: 마왕/진 보스/진엔딩 정산은 reducer 안에서 단일 전이로 끝낸다
    //   (승리 후처리의 dispatch가 아니라 여기서 gameState/enemy를 확정).
    const endgameResult = resolveEndgameVictory({
        player: draft.player,
        deadEnemy,
        receiptKey,
        rng: random,
        now,
    });
    if (endgameResult.outcome !== 'none' && endgameResult.outcome !== 'replay') {
        const endgamePlayer = trackExpeditionVitals(endgameResult.gameState === GS.COMBAT
            ? activateDevourBonus(endgameResult.player)
            : endgameResult.player);
        draft = {
            ...draft,
            player: endgamePlayer,
            enemy: endgameResult.enemy,
            gameState: endgameResult.gameState,
            quickSlots: sanitizeQuickSlots(draft.quickSlots, endgamePlayer.inv),
            syncStatus: 'syncing',
        };
        endgameResult.logs.forEach((entry) => appendLog(entry.type, entry.text));
    }

    // 2026-09 D3: 전투 결과 카드 게이트 — 승리 후처리(combatVictory)가 넣은 결과 카드는
    //   "플레이어의 다음 판단이 대기 중이 아닐 때"만 남긴다. 트랜잭션이 끝난 실제 상태로
    //   판단하므로 combatVictory 내부 dispatch 순서(심연 층 유물은 카드보다 먼저, 정예의
    //   흔적 유물은 카드보다 나중)와 무관하게 한 곳에서 결정된다. 엔드게임 정산 뒤에 두어야
    //   승천/진엔딩/진보스 전이(gameState 변경)도 같은 규칙으로 걸린다.
    //   - pendingRelics: 유물 3(4)선택(z-50 전체 화면)이 카드(z-40)를 덮으므로 카드는 내린다.
    //   - gameState !== idle: 승천(마왕 격파) / 진엔딩 / 진보스 재교전 화면을 카드가 가리지 않는다.
    if (draft.postCombatResult && (draft.pendingRelics || draft.gameState !== GS.IDLE)) {
        draft = { ...draft, postCombatResult: null };
    }

    return {
        ...draft,
        combatReceipt: {
            key: receiptKey,
            kind: 'victory',
            stories: storyEvents,
            lootSettlement: victoryOutcome.lootSettlement,
        },
    };
};

/**
 * H2 (Wave 3 감사): 승리가 아닌 전투 전이(계속 / 사망 / 도주)의 공통 정산.
 *
 * RESOLVE_COMBAT_ACTION과 USE_COMBAT_ITEM이 같은 20줄을 각각 들고 있었다. 두 곳의 차이는
 * 도주 분기(소모품 턴은 'escape'를 만들지 않는다), combatReceipt.stories, 그리고 소모품 턴만
 * 갖는 quick slot 소비 정산(consumedItem)뿐이므로 그 셋만 호출부가 넘긴다 —
 * 나머지 필드는 한 곳에서 계산한다.
 */
const settleNonVictory = (
    state: GameState,
    {
        result,
        stories,
        seed,
        now,
        nextTurn,
        consumedItem,
    }: {
        result: CombatActionTurnResult | CombatItemTurnResult;
        stories: Array<{ type: string; data: unknown }>;
        seed: number;
        now: number;
        nextTurn: number;
        // 소모품 턴에서만 전달된다. 전달되면 "이번에 소비한 아이템" 기준으로 quick slot을 정산한다.
        consumedItem?: Item;
    },
): GameState => {
    const logs = [...result.logs];
    // Codex: 비승리 전이에서도 원정 생명 원장(trackExpeditionVitals)을 갱신한다.
    const player = trackExpeditionVitals(result.kind === 'defeat'
        ? addNewTitles(result.player, logs)
        : result.player);

    return {
        ...state,
        player,
        enemy: result.enemy,
        gameState: result.kind === 'defeat'
            ? GS.DEAD
            : result.kind === 'escape'
                ? GS.IDLE
                : state.gameState,
        grave: result.kind === 'defeat'
            ? appendGrave(state.grave, result.graveData)
            : state.grave,
        runSummary: result.kind === 'defeat' ? result.runSummary : state.runSummary,
        logs: appendCombatLogs(state.logs, logs, now, seed),
        quickSlots: consumedItem
            ? sanitizeConsumedQuickSlots(state.quickSlots, consumedItem, player.inv || [])
            : sanitizeQuickSlots(state.quickSlots, player.inv),
        visualEffect: result.visualEffect,
        combatTurn: nextTurn,
        combatReceipt: {
            key: `${nextTurn}:${now}:${seed}`,
            kind: result.kind,
            stories,
        },
        syncStatus: 'syncing',
    };
};

export const makeCombatActionMap = (initialPlayer: Player) => ({
    /**
     * 2026-09 D2 — 전투 후 "밀어붙인다 / 숨을 고른다" 단일 전이.
     *
     * 효과 계산은 전부 순수 함수(utils/postCombatChoice)에 있고, 여기서는 상태 전이만 한다.
     * postCombatResult.postCombatChoiceResolved 플래그로 1회만 적용되므로 빠른 연타로
     * 버프·회복이 두 번 들어가지 않는다 (두 번째 dispatch는 같은 state를 그대로 반환).
     */
    RESOLVE_POST_COMBAT_CHOICE: (state: GameState, action: GameAction): GameState => {
        const choice = action.payload?.choice as PostCombatChoiceId | undefined;
        if (choice !== 'push' && choice !== 'breather') return state;

        const result = state.postCombatResult;
        if (!result || result.postCombatChoiceResolved === true) return state;
        if (!isPostCombatChoiceOffered(result)) return state;

        const mapData = DB.MAPS[state.player.loc as string] || null;
        const effectiveMaxHp = calculateFullStats(state.player)?.maxHp || state.player.maxHp || 1;
        const applied = applyPostCombatChoice(state.player, choice, mapData, effectiveMaxHp);

        return {
            ...state,
            player: applied.player,
            postCombatResult: { ...result, postCombatChoiceResolved: true, postCombatChoice: choice },
            logs: [
                ...state.logs,
                ...applied.logs.map((entry, index) => ({
                    id: `post-combat-choice-${choice}-${state.combatTurn || 0}-${state.logs.length + index}`,
                    type: entry.type,
                    text: entry.text,
                })),
            ].slice(-BALANCE.LOG_MAX_SIZE),
            syncStatus: 'syncing',
        };
    },
    RESOLVE_COMBAT_ACTION: (state: GameState, action: GameAction): GameState => {
        if (state.gameState !== GS.COMBAT || !state.enemy) return state;
        const kind = action.payload?.kind;
        const expectedTurn = Number(action.payload?.expectedTurn);
        const seed = Number(action.payload?.seed);
        const now = Number(action.payload?.now);
        if (!['attack', 'skill', 'escape'].includes(kind)) return state;
        if (!Number.isFinite(expectedTurn) || expectedTurn !== (state.combatTurn || 0)) return state;
        if (!Number.isFinite(seed) || !Number.isFinite(now)) return state;

        const random = createSeededRandom(seed);
        const result = resolveCombatActionTurn({
            player: state.player,
            enemy: state.enemy,
            kind,
            initialPlayer,
            seed,
            now,
            rng: random,
        });
        const nextTurn = (state.combatTurn || 0) + 1;
        if (result.kind === 'victory') {
            const settled = settleVictory(state, {
                player: result.player,
                deadEnemy: result.deadEnemy || state.enemy,
                stats: result.victoryStats,
                logs: result.logs,
                stories: result.stories,
                extendedChecks: result.extendedVictoryChecks === true,
                seed,
                now,
                nextTurn,
                random,
            });
            return settled;
        }

        return settleNonVictory(state, {
            result,
            stories: result.stories,
            seed,
            now,
            nextTurn,
        });
    },
    USE_COMBAT_ITEM: (state: GameState, action: GameAction): GameState => {
        if (state.gameState !== GS.COMBAT || !state.enemy) return state;

        const payload = action.payload as Partial<UseCombatItemPayload> | undefined;
        const itemId = typeof payload?.itemId === 'string' ? payload.itemId : '';
        const seed = Number(payload?.seed);
        const now = Number(payload?.now);
        const expectedTurn = payload?.expectedTurn;
        if (typeof expectedTurn !== 'number' || !Number.isFinite(expectedTurn)) return state;
        if (expectedTurn !== state.combatTurn) return state;
        if (!itemId || !Number.isFinite(seed) || !Number.isFinite(now)) return state;

        const item = (state.player.inv || []).find((entry) => entry.id === itemId);
        if (!item) return state;

        const random = createSeededRandom(seed);
        const result = resolveCombatItemTurn({
            player: state.player,
            enemy: state.enemy,
            item,
            initialPlayer,
            seed,
            now,
            rng: random,
        });
        if (result.kind === 'rejected') return state;
        const logs = [...result.logs];
        const nextTurn = (state.combatTurn || 0) + 1;
        if (result.kind === 'victory') {
            const settled = settleVictory(state, {
                player: result.player,
                deadEnemy: state.enemy,
                stats: result.victoryStats,
                logs,
                stories: [],
                extendedChecks: false,
                seed,
                now,
                nextTurn,
                random,
            });
            return {
                ...settled,
                quickSlots: sanitizeConsumedQuickSlots(state.quickSlots, item, settled.player.inv || []),
            };
        }
        // 소모품 턴은 'escape'를 만들지 않고, 사망 이야기는 턴 시작 시점의 player로 남긴다.
        return settleNonVictory(state, {
            result,
            stories: result.kind === 'defeat'
                ? [
                    { type: 'death', data: { loc: state.player.loc } },
                    { type: 'ruinRecap', data: { name: state.player.name, level: state.player.level } },
                ]
                : [],
            seed,
            now,
            nextTurn,
            consumedItem: item,
        });
    },
});
