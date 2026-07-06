import { DB } from '../../data/db';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getGravesAtLoc } from '../../utils/graveUtils.js';
import { clearTemporaryAdventureState, hasTemporaryAdventureState } from '../../utils/playerStateUtils.js';
import { checkDiscoveryChains, getFirstVisitReward } from '../../utils/exploreUtils';
import { CombatEngine } from '../../systems/CombatEngine';
import { soundManager } from '../../systems/SoundManager';
import { isAreaBossUndefeated, getAreaBossName } from '../../utils/bossGauge';

// cycle 314: addStoryLog 미사용 dependency 제거 — moveActions 어디에서도 호출 0건.
//   `void addStoryLog` 자가-suppress 라인도 함께 cleanup.
// cycle 315: _shared?: any 미사용 2번째 파라미터 제거 — moveActions에서 shared 헬퍼 사용 0건.
//   useGameActions에서 createMoveActions(deps, shared) 호출하지만 extra arg는 무시되어 동작 동일.
export const createMoveActions = (deps: any) => {
    const { player, gameState, grave, isAiThinking, liveConfig, dispatch, addLog } = deps;
    return {
        move: (loc: string) => {
            if (isAiThinking) return;
            if (!loc) {
                const exits = DB.MAPS[player.loc]?.exits?.join(', ') || MSG.MOVE_NO_EXITS;
                return addLog('info', MSG.MOVE_EXITS(exits));
            }
            if (!['idle', 'moving'].includes(gameState)) return addLog('error', MSG.MOVE_BLOCKED);

            const targetMap = DB.MAPS[loc];
            if (!targetMap) return addLog('error', MSG.MAP_NOT_FOUND);
            if (targetMap.seasonOnly && !liveConfig?.seasonEvent?.active) {
                return addLog('warn', MSG.MOVE_SEASON_ONLY);
            }
            // 2026-07 타입화: targetMap.level은 number | number[] | 'infinite'. minLv가
            // 없는 무한 심연 진입로('마왕성' 등)는 원래도 level: 'infinite' 그대로 비교식에
            // 들어가던 latent 케이스 — MSG.MOVE_LEVEL_REQUIRED 등 number 파라미터와
            // 호환되도록 number | string 유니온으로 명시해 동일 런타임 동작 보존.
            const requiredLevel: number | string = targetMap.minLv ?? (Array.isArray(targetMap.level) ? targetMap.level[0] : targetMap.level) ?? 1;
            if (player.level < requiredLevel) return addLog('error', MSG.MOVE_LEVEL_REQUIRED(requiredLevel));
            if (!targetMap.seasonOnly && !(DB.MAPS[player.loc]?.exits || []).includes(loc)) return addLog('error', MSG.MOVE_NO_EXIT);

            const firstVisit = !(player.stats?.visitedMaps || []).includes(loc);
            const isSafeDestination = targetMap.type === 'safe';
            const shouldClearTemporaryState = isSafeDestination && hasTemporaryAdventureState(player);
            const gravesAtDestination = getGravesAtLoc(grave, loc);

            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: any) => {
                    const nextPlayer = isSafeDestination ? clearTemporaryAdventureState(p) : { ...p };
                    return {
                        ...nextPlayer,
                        loc,
                        stats: {
                            ...(nextPlayer.stats || {}),
                            visitedMaps: Array.from(new Set([...(p.stats?.visitedMaps || []), loc]))
                        }
                    };
                }
            });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('success', MSG.MOVE_ARRIVED(loc));

            if (firstVisit) {
                addLog('event', MSG.MOVE_NEW_AREA(loc));
                // C-2 (B+ 2026-06): 갓 진입한 위험 던전(권장 레벨 근접) 경고 — 정예/보스
                //   readability. 하드 레벨 락으로 과진입은 불가하나, gap≤1 지역은 위협이 실재.
                if (!isSafeDestination && ((player.level || 1) - Number(requiredLevel)) <= 1) {
                    addLog('warn', MSG.MOVE_AREA_DANGER(requiredLevel));
                }
                // cycle 118: 첫 방문 sensory cue — D major triad 짧은 arpeggio.
                // cycle 117 discovery_chain과 짝을 이루는 가벼운 audio reflection.
                soundManager.play('new_area');
                const visitReward = getFirstVisitReward(loc, player);
                if (visitReward) {
                    addLog('system', visitReward.msg);
                    dispatch({
                        type: AT.SET_PLAYER,
                        payload: (p: any) => {
                            let updated = isSafeDestination ? clearTemporaryAdventureState(p) : { ...p };
                            updated = { ...updated, gold: (updated.gold || 0) + visitReward.gold };
                            const expResult = CombatEngine.applyExpGain(updated, visitReward.exp);
                            return expResult.updatedPlayer;
                        }
                    });
                }
            }
            addLog('system', targetMap.desc);
            if (firstVisit && targetMap.lore) addLog('event', `📖 ${targetMap.lore}`);

            // 원정 목표 배너 (2026-07 감사 축4 — 모바일 세션 정합): 미격파 구역 보스가 있는
            //   던전 진입 시마다 "지역 진입 → 구역 보스 격파" 원정 프레이밍을 안내한다.
            //   첫 방문 여부와 무관하게 매 진입마다 표시(재진입 시에도 원정 목표를 되새김).
            if (isAreaBossUndefeated(targetMap, player)) {
                addLog('event', MSG.EXPEDITION_GOAL_BANNER(getAreaBossName(targetMap) as string));
            }

            checkDiscoveryChains(player, loc, { dispatch, addLog });
            if (shouldClearTemporaryState) addLog('info', MSG.TOWN_BUFF_CLEAR);
            if (gravesAtDestination.length > 0) {
                addLog('event', gravesAtDestination.length > 1
                    ? MSG.GRAVE_FOUND_MULTI(gravesAtDestination.length)
                    : MSG.GRAVE_FOUND_SINGLE);
            }
        },
    };
};
