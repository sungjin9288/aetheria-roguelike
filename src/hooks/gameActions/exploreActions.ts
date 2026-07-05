import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { AI_SERVICE } from '../../services/aiService';
import { toArray } from '../../utils/gameUtils';
import { runQuietRollAndCombat } from '../../utils/exploreUtils';
import { getMapPacingProfile, getNarrativeEventChance } from '../../utils/explorationPacing';
import { getRunBuildProfile } from '../../utils/runProfileUtils';
import { enrichSnapshotWithDifficulty } from '../../systems/DifficultyManager';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getChainEventForLoc } from '../../data/eventChains';
import { buildCampfireEvent } from '../../utils/campfireEvent';
import { shouldTriggerScout, buildScoutEvent } from '../../utils/scoutEvents';
import { soundManager } from '../../systems/SoundManager';

/**
 * 캠프파이어/스카우팅 이후 AI 랜덤 이벤트 체크 (explore() 전용 — AI_SERVICE는 firebase에
 * 의존하므로 eventActions.ts의 스카우팅 "짙은 안개" 카드는 이 함수를 거치지 않고
 * runQuietRollAndCombat(exploreUtils.ts)만 재사용한다 — firebase-free 단위 테스트 유지).
 * AI 이벤트가 발동하지 않으면 quiet 롤 이하 파이프(runQuietRollAndCombat)로 이어진다.
 */
const runExplorePostDecisionRoll = async (mapData: any, deps: any, { commitExploreOutcome }: any) => {
    const { player, uid, dispatch, addLog, addStoryLog, getFullStats } = deps;
    const playerRelics = player.relics || [];
    const eventChanceBonus = playerRelics.reduce((acc: any, relic: any) => (
        relic.effect === 'event_chance' ? acc + relic.val : acc
    ), 0);
    const pacingProfile = getMapPacingProfile(mapData);
    const effectiveEventChance = getNarrativeEventChance(mapData.eventChance || 0, eventChanceBonus, player.stats, mapData);

    // AI 랜덤 이벤트 체크
    if (Math.random() < effectiveEventChance) {
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
        dispatch({ type: AT.SET_AI_THINKING, payload: true });
        try {
            const fullStats = getFullStats();
            const baseSnapshot: Record<string, any> = {
                name: player.name, job: player.job, level: player.level,
                hp: player.hp, maxHp: fullStats.maxHp, mp: player.mp, maxMp: fullStats.maxMp,
                gold: player.gold, title: player.activeTitle || null,
                relicCount: playerRelics.length,
                status: toArray(player.status).slice(0, 4),
                activeQuests: toArray(player.quests).filter((q: any) => !q.done).slice(0, 3).map((q: any) => q.title),
                buildProfile: getRunBuildProfile(player, fullStats).tags.map((tag: any) => tag.name).slice(0, 4)
            };
            const playerSnapshot = enrichSnapshotWithDifficulty(baseSnapshot, player);
            const eventData = await AI_SERVICE.generateEvent(player.loc, player.history, uid, {
                playerSnapshot,
                mapSnapshot: {
                    name: player.loc, type: mapData.type, level: mapData.level,
                    exits: toArray(mapData.exits).slice(0, 3), boss: Boolean(mapData.boss),
                    rhythm: pacingProfile.label
                }
            });
            if (eventData?.exhausted) {
                commitExploreOutcome('nothing', null);
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                addLog('warning', eventData.message || MSG.AI_QUOTA_REACHED);
            } else if (eventData && eventData.desc) {
                commitExploreOutcome('narrative_event', null);
                if (eventData.fallbackReason === 'quota' && eventData.fallbackMessage) addLog('info', eventData.fallbackMessage);
                const normalizedChoices = toArray(eventData.choices)
                    .map((choice: any, idx: any) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || MSG.CHOICE_DEFAULT(idx + 1)))
                    .slice(0, 3);
                const normalized = { ...eventData, choices: normalizedChoices, outcomes: toArray(eventData.outcomes) };
                dispatch({ type: AT.SET_EVENT, payload: normalized });
                addLog('event', normalized.desc);
            } else {
                commitExploreOutcome('nothing', null);
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                addLog('info', MSG.EXPLORE_NOTHING);
            }
        } finally {
            dispatch({ type: AT.SET_AI_THINKING, payload: false });
        }
        return;
    }

    runQuietRollAndCombat(player, mapData, { dispatch, addLog, addStoryLog, getFullStats, commitExploreOutcome });
};

export const createExploreActions = (deps: any, shared: any) => {
    const { commitExploreOutcome } = shared;
    const { player, gameState, dispatch, addLog, getFullStats } = deps;
    return {
        explore: async () => {
            if (gameState !== GS.IDLE) return addLog('error', MSG.EXPLORE_BLOCKED);
            if (player.loc === CONSTANTS.START_LOCATION) return addLog('info', MSG.TOWN_PEACEFUL);

            const mapData = DB.MAPS[player.loc];
            if (!mapData) return addLog('error', MSG.MAP_UNKNOWN);
            // cycle 220: 탐험 tick sensory cue — sine wave 800→1200→800Hz arc, 0.16s 짧은 cue
            //   (gain 0.04 subtle). 정의 있으나 dispatch 0건이던 dead path. 탐험 트리거 시점에
            //   1회 — narrative event / combat / nothing 분기 전 사용자 입력 confirmation.
            //   cycle 217-219 sensory cue 시리즈 마지막 합류.
            soundManager.play('explore');

            // 내러티브 이벤트 체인 체크 (AI 이벤트보다 우선)
            const chainTrigger = getChainEventForLoc(player.loc, player.eventChainProgress);
            if (chainTrigger) {
                commitExploreOutcome('narrative_event', null);
                const { chain, step } = chainTrigger;
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: {
                    ...step.event,
                    _chainId: chain.id,
                    _chainStep: step.step,
                }});
                addLog('event', `📜 [${chain.label}] ${step.event.desc}`);
                return;
            }

            // 캠프파이어 노드 (Phase 2, B+): 던전에서 낮은 확률로 "휴식 vs 단련" 결정.
            //   위협(A-1/A-4)이 강해진 만큼 회복은 실질 선택 — 결정 밀도를 높인다 (StS 캠프파이어).
            // feat/prestige-rank-ladder: rank≥4 "재의 인장" — 캠프파이어 발견율 +4%p.
            const campfireChance = BALANCE.CAMPFIRE_CHANCE + getPrestigeUnlocks(player.meta?.prestigeRank).campfireChanceBonus;
            if (mapData.type === 'dungeon' && Math.random() < campfireChance) {
                commitExploreOutcome('narrative_event', null);
                const campfireEvent = buildCampfireEvent(getFullStats());
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: campfireEvent });
                addLog('event', campfireEvent.desc);
                soundManager.play('new_area');
                return;
            }

            // 탐험 스카우팅 (2026-07 감사 (b)): "정보 없는 단일 버튼 탐험" 갭 대응 — 던전(비안전지대)
            //   탐험 시 낮은 확률로 사전 정찰 카드 2~3장을 제시한다. 체인 > 캠프파이어 > 스카우팅 >
            //   나머지 롤(AI 이벤트/quiet/전투) 순 우선순위. 선택은 eventActions.ts가 같은 턴에 해소.
            if (shouldTriggerScout(mapData, Math.random)) {
                commitExploreOutcome('narrative_event', null);
                const scoutEvent = buildScoutEvent(player, mapData, Math.random);
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
                dispatch({ type: AT.SET_EVENT, payload: scoutEvent });
                addLog('event', scoutEvent.desc);
                soundManager.play('new_area');
                return;
            }

            await runExplorePostDecisionRoll(mapData, deps, shared);
        },
    };
};
