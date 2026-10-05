import { DB } from '../../data/db';
import { getMapAccess } from '../../utils/mapAccess';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getGravesAtLoc } from '../../utils/graveUtils.js';
import { clearTemporaryAdventureState, hasTemporaryAdventureState } from '../../utils/playerStateUtils.js';
import { getFirstVisitReward } from '../../utils/exploreUtils';
import { grantGold } from '../../utils/gameUtils';
import { getGoldIncome, getVisibleLocationName, isBlindMap } from '../../utils/challengeRules';
import { getFirstVisitClaimedMaps, markFirstVisitRewardClaimed } from '../../utils/firstVisitRewards';
import { checkDiscoveryChains } from './exploreFlow';
import { CombatEngine } from '../../systems/CombatEngine';
import { isAreaBossUndefeated, getAreaBossName } from '../../utils/bossGauge';
import { finishExpedition, normalizeActiveExpedition, startExpedition } from '../../utils/expeditionLedger';
import { resolveProgressionProfile, scaleProgressionExpReward } from '../../data/progressionProfiles';
import type { Player } from '../../types';
import type { GameActionDeps } from '../actionDeps';

// cycle 314: addStoryLog 미사용 dependency 제거 — moveActions 어디에서도 호출 0건.
//   `void addStoryLog` 자가-suppress 라인도 함께 cleanup.
// cycle 315: _shared?: any 미사용 2번째 파라미터 제거 — moveActions에서 shared 헬퍼 사용 0건.
//   useGameActions에서 createMoveActions(deps, shared) 호출하지만 extra arg는 무시되어 동작 동일.
export const createMoveActions = (deps: GameActionDeps) => {
    const { player, gameState, grave, isAiThinking, liveConfig, dispatch, addLog } = deps;
    return {
        move: (loc: string) => {
            if (isAiThinking) return;
            // 2026-10 Wave 62 (원장 §61.2 A10): '길 잃은 여행'은 이동 로그에서도 지역 이름 · 설명 · 원정 목표(구역 보스 이름)를 숨긴다 —
            //   상태줄 · 조작판 · 지도만 숨기던 동안 "고요한 숲에 도착했습니다"가 그대로 찍혔다.
            const blindMap = isBlindMap(player);
            if (!loc) {
                const exitNames = DB.MAPS[player.loc!]?.exits || [];
                if (blindMap) return addLog('info', MSG.MOVE_EXITS_BLIND(exitNames.length));
                const exits = exitNames.join(', ') || MSG.MOVE_NO_EXITS;
                return addLog('info', MSG.MOVE_EXITS(exits));
            }
            if (!['idle', 'moving'].includes(gameState)) return addLog('error', MSG.MOVE_BLOCKED);

            const targetMap = DB.MAPS[loc];
            const { reason, requiredLevel } = getMapAccess(DB.MAPS, player.loc!, loc, player.level!, Boolean(liveConfig?.seasonEvent?.active));
            if (reason === 'missing') return addLog('error', MSG.MAP_NOT_FOUND);
            if (reason === 'season') {
                return addLog('warn', MSG.MOVE_SEASON_ONLY);
            }
            if (reason === 'level') return addLog('error', MSG.MOVE_LEVEL_REQUIRED(requiredLevel));
            if (reason === 'exit') return addLog('error', MSG.MOVE_NO_EXIT);

            const firstVisit = !(player.stats?.visitedMaps || []).includes(loc);
            const isSafeOrigin = DB.MAPS[player.loc!]?.type === 'safe';
            const isSafeDestination = targetMap.type === 'safe';
            const activeExpedition = normalizeActiveExpedition(player.activeExpedition);
            const shouldStartExpedition = isSafeOrigin && !isSafeDestination && !activeExpedition;
            const shouldFinishExpedition = isSafeDestination && Boolean(activeExpedition);
            const shouldClearTemporaryState = isSafeDestination && hasTemporaryAdventureState(player);
            const gravesAtDestination = getGravesAtLoc(grave, loc);
            const movedAt = Date.now();

            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: Player) => {
                    let nextPlayer = { ...p };
                    if (isSafeDestination) nextPlayer = clearTemporaryAdventureState(nextPlayer);
                    if (shouldFinishExpedition) {
                        nextPlayer = finishExpedition(nextPlayer, loc, movedAt, DB.QUESTS).player;
                    }
                    if (shouldStartExpedition) {
                        nextPlayer = startExpedition(
                            nextPlayer,
                            loc,
                            movedAt,
                            DB.QUESTS,
                            resolveProgressionProfile(liveConfig?.progressionProfile),
                        );
                    }
                    return {
                        ...nextPlayer,
                        loc,
                        // 예전 세이브(목록 없음)는 방문 기록을 받은 목록으로 읽는다 — 아래에서 방문 기록에 이 지역을 더하기 전에 목록을
                        //   굳혀 둬야 이번 이동의 첫 방문 보상이 "이미 받음"으로 읽히지 않는다.
                        firstVisitRewardMaps: getFirstVisitClaimedMaps(p),
                        stats: {
                            ...(nextPlayer.stats || {}),
                            visitedMaps: Array.from(new Set([...(p.stats?.visitedMaps || []), loc]))
                        }
                    };
                }
            });
            if (shouldFinishExpedition) {
                dispatch({ type: AT.SET_EXPEDITION_DEBRIEF_OPEN, payload: true });
            }
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            const visibleLoc = getVisibleLocationName(player, loc) ?? loc;
            addLog('success', MSG.MOVE_ARRIVED(visibleLoc));

            if (firstVisit) {
                addLog('event', MSG.MOVE_NEW_AREA(visibleLoc));
                // C-2 (B+ 2026-06): 갓 진입한 위험 던전(권장 레벨 근접) 경고 — 정예/보스
                //   readability. 하드 레벨 락으로 과진입은 불가하나, gap≤1 지역은 위협이 실재.
                //   길 잃은 여행이면 진입 레벨(지도 정보)은 말하지 않는다(지도의 선택 카드도 감춘다).
                if (!isSafeDestination && ((player.level || 1) - Number(requiredLevel)) <= 1) {
                    addLog('warn', blindMap ? MSG.MOVE_AREA_DANGER_BLIND : MSG.MOVE_AREA_DANGER(requiredLevel));
                }
            }
            // 2026-10 Wave 62 (원장 §61.4 C11): 첫 방문 보상은 여정마다 지역당 한 번이다 — 방문 기록(발견 지역)이 아니라 이번 여정에
            //   받은 지역 목록을 본다(계승 뒤에도 다시 받고, 같은 여정에서는 한 번). 지급 전이가 목록을 다시 확인해 두 번 주지 않는다.
            const visitReward = getFirstVisitReward(loc, player);
            if (visitReward) {
                // 실제 지급 골드(빈손의 시작이면 절반)와 숨긴 이름이 데이터 문구와 다르면 같은 형식의 MSG 문구로 적는다.
                const paidGold = getGoldIncome(player, visitReward.gold);
                addLog('system', blindMap || paidGold !== visitReward.gold
                    ? MSG.FIRST_VISIT_REWARD(visibleLoc, paidGold, visitReward.exp)
                    : visitReward.msg);
                dispatch({
                    type: AT.SET_PLAYER,
                    payload: (p: Player) => {
                        if (!getFirstVisitReward(loc, p)) return p;
                        let updated = isSafeDestination ? clearTemporaryAdventureState(p) : { ...p };
                        updated = markFirstVisitRewardClaimed(grantGold(updated, visitReward.gold), loc);
                        const expResult = CombatEngine.applyExpGain(
                            updated,
                            scaleProgressionExpReward(updated, visitReward.exp),
                        );
                        return expResult.updatedPlayer;
                    }
                });
            }
            addLog('system', blindMap ? MSG.MOVE_AREA_DESC_BLIND : (targetMap.desc ?? ''));
            if (firstVisit && targetMap.lore && !blindMap) addLog('event', targetMap.lore);

            // 원정 목표 배너 (2026-07 감사 축4 — 모바일 세션 정합): 미격파 구역 보스가 있는
            //   던전 진입 시마다 "지역 진입 → 구역 보스 격파" 원정 프레이밍을 안내한다.
            //   첫 방문 여부와 무관하게 매 진입마다 표시(재진입 시에도 원정 목표를 되새김).
            //   길 잃은 여행이면 띄우지 않는다 — 구역 보스 이름이 곧 지역이다(원정 HUD도 숨는다, `expeditionHud.ts`).
            if (!blindMap && isAreaBossUndefeated(targetMap, player)) {
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
