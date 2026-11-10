import { MSG } from '../../data/messages';
import { clampVitalsToEffectiveMax } from '../../utils/effectiveVitals';
import { resolveChapterPick } from '../../utils/chapterPick';
import { GS } from '../gameStates';
import type { GameState, HandlerMap } from '../gameReducer';
import type { ActionOf } from '../actionTypes';
import { AT } from '../actionTypes';
import { appendRewardLogs } from './rewardLog';

/**
 * 2026-11 H3 장 경계 3택: 카드 하나를 받거나 넘긴다. 대기 상태 · 열린 유물 제안이 없을 때만 받는다(화면 조건과 같다) —
 * 다른 화면 위의 늦은 클릭이 전투 · 제안을 덮지 않게 한다. 받을 권리가 없는 장 · 패 밖 카드 · 다른 상태는 동일 참조.
 */
const claimChapterPick = (state: GameState, action: ActionOf<typeof AT.CLAIM_CHAPTER_PICK>): GameState => {
    if (state.gameState !== GS.IDLE || state.pendingRelics) return state;
    const chapter = Number(action.payload?.chapter);
    const cardId = typeof action.payload?.cardId === 'string' ? action.payload.cardId : '';
    if (!Number.isInteger(chapter) || !cardId) return state;
    const resolution = resolveChapterPick(state.player, chapter, cardId);
    if (!resolution) return state;

    const base = { ...state, syncStatus: 'syncing' as const };
    switch (resolution.kind) {
        case 'skip':
            return {
                ...base,
                player: resolution.player,
                logs: appendRewardLogs(state.logs, [{ type: 'info', text: MSG.CHAPTER_PICK_LOG_SKIP(chapter) }]),
            };
        case 'relic':
            if (resolution.atCapacity) {
                // 약속한 보상이라 칸이 찼어도 잔향으로 접지 않는다 — 기존 교체 화면이 교체 · 넘기기를 준다.
                return {
                    ...base,
                    player: resolution.player,
                    pendingRelics: [resolution.relic],
                    postCombatResult: null,
                    logs: appendRewardLogs(state.logs, [{ type: 'event', text: MSG.CHAPTER_PICK_LOG_RELIC_REPLACE(chapter, resolution.relic.name || '') }]),
                };
            }
            return {
                ...base,
                player: clampVitalsToEffectiveMax(resolution.player),
                logs: appendRewardLogs(state.logs, [{ type: 'success', text: MSG.CHAPTER_PICK_LOG_RELIC(chapter, resolution.relic.name || '') }]),
            };
        case 'prefix':
            return {
                ...base,
                player: clampVitalsToEffectiveMax(resolution.player),
                logs: appendRewardLogs(state.logs, [{ type: 'success', text: MSG.CHAPTER_PICK_LOG_PREFIX(chapter, resolution.itemName) }]),
            };
        case 'enhance':
            return {
                ...base,
                player: resolution.player,
                logs: appendRewardLogs(state.logs, [{ type: 'success', text: MSG.CHAPTER_PICK_LOG_ENHANCE(chapter, resolution.itemName, resolution.level) }]),
            };
        default:
            return state;
    }
};

export const chapterPickActionMap = {
    CLAIM_CHAPTER_PICK: claimChapterPick,
} satisfies HandlerMap;
