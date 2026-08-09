import { BALANCE } from '../../data/constants';
import { GS } from '../gameStates';
import { resolveCombatItemTurn } from '../../systems/combatItemTurn';
import { createSeededRandom } from '../../systems/combatItemTurn';
import { resolveCombatActionTurn } from '../../systems/combatActionTurn';
import { appendGrave } from '../../utils/graveUtils.js';
import { trackExpeditionVitals } from '../../utils/expeditionLedger';
import { handleVictoryOutcome } from '../../hooks/combatActions/combatVictory';
import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import type { GameAction, GameState } from '../gameReducer';
import type { UseCombatItemPayload } from '../actionTypes';
import { addNewTitles, sanitizeQuickSlots } from './helpers';

const appendCombatLogs = (
    currentLogs: any[],
    entries: Array<{ type: string; text: string }>,
    now: number,
    seed: number,
) => [
    ...currentLogs,
    ...entries.map((entry, index) => ({
        id: `combat-item-${now}-${seed}-${index}`,
        type: entry.type,
        text: entry.text,
    })),
].slice(-BALANCE.LOG_MAX_SIZE);

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
    }: any,
): GameState => {
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
        if (nestedAction.type === 'TRIGGER_TRUE_ENDING') {
            draft = { ...draft, gameState: 'true_ending', syncStatus: 'syncing' };
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
    const emitUnlockedTitles = (candidate: any) => {
        const titleLogs: Array<{ type: string; text: string }> = [];
        const titled = addNewTitles(candidate, titleLogs);
        if (titled === candidate) return;
        draft = {
            ...draft,
            player: { ...draft.player, titles: titled.titles, activeTitle: titled.activeTitle },
        };
        titleLogs.forEach((entry) => appendLog(entry.type, entry.text));
    };

    handleVictoryOutcome({
        playerAfterCombat: player,
        deadEnemy,
        stats,
        dispatch,
        addLog: appendLog,
        addStoryLog: (type: string, data: any) => storyEvents.push({ type, data }),
        emitUnlockedTitles,
        extendedChecks,
        liveConfig: state.liveConfig,
        rng: random,
        now: () => now,
    });

    return {
        ...draft,
        combatReceipt: {
            key: `${nextTurn}:${now}:${seed}`,
            kind: 'victory',
            stories: storyEvents,
        },
    };
};

export const makeCombatActionMap = (initialPlayer: any) => ({
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
            return settleVictory(state, {
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
        }

        const logs = [...result.logs];
        const player = result.kind === 'defeat'
            ? addNewTitles(result.player, logs)
            : result.player;
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
            quickSlots: sanitizeQuickSlots(state.quickSlots, player.inv),
            visualEffect: result.visualEffect,
            combatTurn: nextTurn,
            combatReceipt: {
                key: `${nextTurn}:${now}:${seed}`,
                kind: result.kind,
                stories: result.stories,
            },
            syncStatus: 'syncing',
        };
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

        const item = (state.player.inv || []).find((entry: any) => entry.id === itemId);
        if (!item || typeof item.type !== 'string' || !['hp', 'mp', 'cure', 'buff'].includes(item.type)) return state;

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
        const logs = [...result.logs];
        const nextTurn = (state.combatTurn || 0) + 1;
        if (result.kind === 'victory') {
            return settleVictory(state, {
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
        }
        const player = result.kind === 'defeat'
            ? addNewTitles(result.player, logs)
            : result.player;

        return {
            ...state,
            player,
            enemy: result.enemy,
            gameState: result.kind === 'defeat'
                ? GS.DEAD
                : state.gameState,
            grave: result.kind === 'defeat'
                ? appendGrave(state.grave, result.graveData)
                : state.grave,
            runSummary: result.kind === 'defeat' ? result.runSummary : state.runSummary,
            logs: appendCombatLogs(state.logs, logs, now, seed),
            quickSlots: sanitizeQuickSlots(state.quickSlots, player.inv),
            visualEffect: result.visualEffect,
            combatTurn: nextTurn,
            combatReceipt: {
                key: `${nextTurn}:${now}:${seed}`,
                kind: result.kind,
                stories: result.kind === 'defeat'
                    ? [
                        { type: 'death', data: { loc: state.player.loc } },
                        { type: 'ruinRecap', data: { name: state.player.name, level: state.player.level } },
                    ]
                    : [],
            },
            syncStatus: 'syncing',
        };
    },
});
