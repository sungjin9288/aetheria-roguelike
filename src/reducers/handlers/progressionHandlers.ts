/**
 * progressionHandlers — 런 진행/환생/유물/칭호 관련 액션 핸들러
 * INITIAL_STATE를 참조하므로 gameReducer.js에서 주입받습니다.
 */
import type { GameState, HandlerMap } from '../gameReducer';
import type { Player } from '../../types';
import { GS } from '../gameStates';
import { createCurrentRunProgress } from '../../utils/runProgress';
import { pickPermanentPlayerState } from '../../utils/permanentProgress';
import { getAscensionOutcome } from '../../utils/ascensionPreview';
import { getClaimableQuestEntries } from '../../utils/questProgress';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { clampVitalsToEffectiveMax } from '../../utils/effectiveVitals';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { MSG } from '../../data/messages';
import { appendRewardLogs } from './rewardLog';

/**
 * makeProgressionActionMap(INITIAL_STATE) → action map
 * 순환 참조 방지를 위해 팩토리 패턴 사용
 */
export const makeProgressionActionMap = (INITIAL_STATE: GameState) => ({
    // cycle 204: 사망 후 '다시 시작' 시 META 진행도 보존 — cycle 191(handleDefeat)와 정합.
    //   기존 동작은 ...INITIAL_STATE로 모든 META를 wipe해 cycle 191의 preserve를
    //   nullify(다시 시작 클릭 즉시 영구 자산 / 영구 카운터 사라짐).
    //   이제 cycle 119 / 188 / 191 / 202 / 203 보존 시리즈와 동일 패턴으로 META 명시 보존:
    //   - meta / titles / activeTitle (영구 자산)
    //   - premiumCurrency / reviveTokens / maxInv / seasonPass (premium 영구 자산)
    //   - stats: kills / bossKills / total_gold / abyssRecord / escapes / syntheses /
    //     maxKillStreak / visitedMaps / discoveryChains / explores / rests / killRegistry /
    //     buildWins / cosmeticTitles / synthProtects / claimedAchievements (multi-run 카운터/ledger)
    //   RUN 진행도(gold / inv / equip / relics / hp / mp / quests / skillLoadout)는
    //   INITIAL_STATE로 reset 유지.
    RESET_GAME: (state) => {
        const permanent = pickPermanentPlayerState(state.player, INITIAL_STATE.player);
        const permanentStats: NonNullable<Player['stats']> = permanent.stats || {};
        return {
            ...INITIAL_STATE,
            grave: state.grave,
            bootStage: 'ready',
            uid: state.uid,
            syncStatus: 'syncing',
            player: {
                ...INITIAL_STATE.player,
                ...permanent,
                stats: {
                    ...permanentStats,
                    currentRun: createCurrentRunProgress(permanentStats),
                },
            },
        };
    },

    SET_RUN_SUMMARY: (state, action) =>
        ({ ...state, runSummary: action.payload }),

    UPDATE_EVENT_CHAIN: (state, action) => {
        const { chainId, step } = action.payload;
        return {
            ...state,
            player: {
                ...state.player,
                eventChainProgress: {
                    ...(state.player.eventChainProgress || {}),
                    [chainId]: step,
                }
            }
        };
    },

    // 2026-09 D3: 유물 선택이 열리면 전투 결과 카드는 내린다 — 유물 패널(z-50 전체 화면)이
    //   카드(z-40)를 덮어 카드 CTA가 닿지 않는 상태로 남는 것을 막는다 (lessons R12).
    SET_PENDING_RELICS: (state, action) => ({
        ...state,
        pendingRelics: action.payload,
        postCombatResult: action.payload ? null : state.postCombatResult,
    }),

    ADD_RELIC: (state, action) => {
        const relic = action.payload;
        const relics = state.player.relics || [];
        // 2026-09 Wave 27 N2 (D3): 추가는 보유 상한을 넘지 못한다. 상한에서 열린 선택지
        //   (체인 완주 보상 · 심연 마일스톤)는 REPLACE_RELIC 또는 DECLINE_RELIC으로 닫는다 —
        //   제안(pendingRelics)은 남겨 두어 패널이 교체/넘기기를 계속 보여 준다.
        if (relics.length >= getPrestigeUnlocks(state.player.meta?.prestigeRank).maxRelics) {
            return {
                ...state,
                logs: appendRewardLogs(state.logs, [{ type: 'error', text: MSG.RELIC_SLOTS_FULL_REPLACE }]),
            };
        }
        return {
            ...state,
            pendingRelics: null,
            // D8: 유물이 빌드 성향을 바꾸면 성향 보너스만큼 유효 최대 기력이 줄 수 있다.
            player: clampVitalsToEffectiveMax({
                ...state.player,
                relics: [...relics, relic],
                stats: { ...state.player.stats, relicCount: (state.player.stats?.relicCount || 0) + 1 },
            }),
            syncStatus: 'syncing',
        };
    },

    // 2026-09 Wave 27 N2 (D3): 제안 유물(pendingRelics)을 보유 유물 하나와 맞바꾼다 — 유물 수는
    //   그대로라 상한 안팎 어디서든 늘지 않는다. 제안에 없는 유물 · 보유하지 않은 교체 대상 ·
    //   이미 보유한 제안은 동일 참조로 무시한다(연타·늦은 클릭).
    REPLACE_RELIC: (state, action) => {
        const relicId = action.payload?.relicId;
        const replaceRelicId = action.payload?.replaceRelicId;
        if (typeof relicId !== 'string' || typeof replaceRelicId !== 'string') return state;
        const offered = (state.pendingRelics || []).find((relic) => relic?.id === relicId);
        if (!offered) return state;
        const relics = state.player.relics || [];
        const releaseIndex = relics.findIndex((relic) => relic?.id === replaceRelicId);
        if (releaseIndex < 0 || relics.some((relic) => relic?.id === relicId)) return state;
        const released = relics[releaseIndex];
        return {
            ...state,
            pendingRelics: null,
            // D8: 내려놓은 유물의 생명/기력 배율만큼 유효 최대치가 줄 수 있다.
            player: clampVitalsToEffectiveMax({
                ...state.player,
                relics: relics.map((relic, index) => (index === releaseIndex ? offered : relic)),
                stats: { ...state.player.stats, relicCount: (state.player.stats?.relicCount || 0) + 1 },
            }),
            logs: appendRewardLogs(state.logs, [{
                type: 'success',
                text: MSG.RELIC_REPLACED(released.name || replaceRelicId, offered.name || relicId),
            }]),
            syncStatus: 'syncing',
        };
    },

    DECLINE_RELIC: (state) =>
        ({ ...state, pendingRelics: null }),

    ASCEND: (state, action) => {
        if (state.gameState !== GS.ASCENSION && state.gameState !== GS.TRUE_ENDING) return state;
        if (getClaimableQuestEntries(state.player).length > 0) return state;
        const payload = action.payload;
        const expectedPrestigeRank = Number(payload?.expectedPrestigeRank);
        if (!Number.isSafeInteger(expectedPrestigeRank) || expectedPrestigeRank < 0) return state;
        const outcome = getAscensionOutcome(state.player.meta);
        if (expectedPrestigeRank !== outcome.currentRank) return state;
        const sourceReceiptKey = payload?.sourceReceiptKey;
        if (sourceReceiptKey !== null && typeof sourceReceiptKey !== 'string') return state;
        const currentReceiptKey = state.player.meta?.endgame?.lastEndgameReceiptKey ?? null;
        if (sourceReceiptKey !== currentReceiptKey) return state;
        const permanent = pickPermanentPlayerState(state.player, INITIAL_STATE.player);
        const permanentStats: NonNullable<Player['stats']> = permanent.stats || {};
        const prevTitles = permanent.titles || [];
        const freshPlayer: Player = {
            ...INITIAL_STATE.player,
            ...permanent,
            name: state.player.name,
            gender: state.player.gender,
            meta: outcome.meta,
            titles: [...new Set([...prevTitles, outcome.title])],
            activeTitle: outcome.title,
            stats: {
                ...permanentStats,
                currentRun: createCurrentRunProgress(permanentStats),
            },
        };
        const ascensionTitles = checkTitles({ ...state.player, meta: outcome.meta, titles: freshPlayer.titles, activeTitle: outcome.title });
        freshPlayer.titles = [...new Set([...(freshPlayer.titles || []), ...ascensionTitles])];
        const logs = appendRewardLogs(INITIAL_STATE.logs, [
            ...ascensionTitles.map((id) => ({ type: 'system', text: MSG.TITLE_UNLOCKED(getTitleLabel(id)) })),
            { type: 'system', text: MSG.ASCEND_DONE(outcome.nextRank, outcome.title) },
        ]);
        return {
            ...INITIAL_STATE,
            logs,
            // 2026-09 Wave 21 M2: 회수하지 못한 묘비는 승천을 넘긴다 — `RESET_GAME`(:34)과 대칭.
            //   여기가 비어 있던 동안 승천은 묘비(골드+아이템)를 조용히 지웠는데, 공개 침공
            //   문서(`public/data/graves/{uid}`)는 rules `delete: false`라 그대로 남는다(§8-2).
            //   즉 "남들은 내 묘비를 털 수 있는데 나는 회수할 수 없는" 상태가 됐다.
            //   `...state` 스프레드로 바꾸지 말 것 — `enemy`/`currentEvent`까지 이월돼
            //   §8-6의 복원 폴드가 전제하는 "런이 접혔다"가 깨진다. 보존은 이 한 필드다.
            grave: state.grave,
            uid: state.uid,
            bootStage: 'ready',
            player: freshPlayer,
            syncStatus: 'syncing',
        };
    },

    UNLOCK_TITLES: (state, action) => {
        const newIds = action.payload;
        if (!newIds || newIds.length === 0) return state;
        const merged = [...new Set([...(state.player.titles || []), ...newIds])];
        return {
            ...state,
            player: {
                ...state.player,
                titles: merged,
                activeTitle: state.player.activeTitle || newIds[0],
            },
            syncStatus: 'syncing',
        };
    },

} satisfies HandlerMap);
