import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { DB } from '../../data/db';
import { toArray, grantGold } from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { pickWeightedRelics } from '../../data/relics';
import { CombatEngine } from '../../systems/CombatEngine';
import { soundManager } from '../../systems/SoundManager';
import { spawnEnemy, rollExplorationEvent, applyBattleStartRelics, runQuietRollAndCombat } from '../../utils/exploreUtils';
import { BALANCE } from '../../data/constants';
import { resetBossGaugeAfterChallenge } from '../../utils/bossGauge';
import { formatEventText } from '../../utils/eventPresentation';

export const createEventActions = (deps: any, shared: any) => {
    const { emitUnlockedTitles } = shared;
    const { player, currentEvent, dispatch, addLog, getFullStats } = deps;
    return {
        handleEventChoice: (idx: any) => {
            if (!currentEvent) return;

            // 스카우팅 카드 처리 — 같은 탐험 턴 안에서 즉시 해소 (탐험의 나머지 롤 파이프 재호출).
            if (currentEvent.isScout) {
                handleScoutChoice(idx, currentEvent, deps, shared);
                return;
            }

            // 원정 보스 접근 게이지 만충 카드 처리 — 도전/회피 즉시 해소.
            if (currentEvent.isBossGaugeChallenge) {
                handleBossGaugeChoice(idx, currentEvent, deps);
                return;
            }

            const isChainEvent = Boolean(currentEvent._chainId);
            const selectedOutcome = isChainEvent
                ? (toArray(currentEvent.outcomes)[idx] || null)
                : (toArray(currentEvent.outcomes).find((o: any) => o.choiceIndex === idx) || null);
            const roll = Math.random();
            let updatedPlayer = player;
            const fullStats = getFullStats();

            // 체인 이벤트 outcome 처리
            if (isChainEvent && selectedOutcome) {
                const outcome = selectedOutcome;
                addLog('event', formatEventText(outcome.log || ''));
                const rwd = outcome.reward;
                if (rwd) {
                    if (rwd.type === 'gold' && rwd.amount) {
                        updatedPlayer = grantGold(updatedPlayer, rwd.amount);
                    }
                    // cycle 178: 'info' reward type 핸들러 추가 — eventChains의 ancient_prophecy
                    // chain에 정의됐으나 처리 분기 누락이라 reward.text 정보가 silent 누락이던 회귀.
                    // 단순히 reward.text를 system log로 출력 (인벤/스탯 변경 없음).
                    if (rwd.type === 'info' && rwd.text) {
                        addLog('system', formatEventText(rwd.text));
                    }
                    if (rwd.type === 'item' && rwd.name) {
                        updatedPlayer = addItemByName(updatedPlayer, rwd.name);
                    }
                    // cycle 139: 'legendary_item' reward 타입 핸들러 추가 — eventChains.ts의
                    // lost_wizard chain에 정의됐으나 처리 분기 누락이라 보상이 silently 누락
                    // 되던 회귀 fix. 'item'과 동일하게 addItemByName 호출 + LOOT_GET 로그.
                    if (rwd.type === 'legendary_item' && rwd.name) {
                        const before = updatedPlayer.inv?.length || 0;
                        updatedPlayer = addItemByName(updatedPlayer, rwd.name);
                        const after = updatedPlayer.inv?.length || 0;
                        if (after > before) {
                            addLog('success', MSG.LOOT_GET(rwd.name));
                        }
                    }
                    if (rwd.type === 'relic') {
                        const pickedRelics = pickWeightedRelics(updatedPlayer.relics || [], 1);
                        if (pickedRelics.length > 0) {
                            updatedPlayer = { ...updatedPlayer, relics: [...(updatedPlayer.relics || []), pickedRelics[0]] };
                            addLog('success', MSG.CHAIN_REWARD_RELIC(pickedRelics[0].name));
                        }
                    }
                    if (rwd.type === 'combat_bonus') {
                        updatedPlayer = { ...updatedPlayer, tempBuff: { atk: (rwd.atkMult || 1.3) - 1, def: 0, turn: rwd.duration || 5, name: '기사의 혼령' } };
                        addLog('success', MSG.CHAIN_REWARD_COMBAT_BONUS(Math.round(((rwd.atkMult || 1.3) - 1) * 100), rwd.duration || 5));
                    }
                    // cycle 62: stat_bonus는 영구 ATK/DEF/HP 가산 — 기존 chain(rift_secret)에서
                    // 사용 중이지만 핸들러가 없어 silently 무시되던 보상을 정상화.
                    if (rwd.type === 'stat_bonus') {
                        const next: any = { ...updatedPlayer };
                        if (rwd.atk) next.atk = (next.atk || 0) + rwd.atk;
                        if (rwd.def) next.def = (next.def || 0) + rwd.def;
                        if (rwd.hp) {
                            next.maxHp = (next.maxHp || 0) + rwd.hp;
                            next.hp = Math.min(next.maxHp, (next.hp || 0) + rwd.hp);
                        }
                        if (rwd.mp) {
                            next.maxMp = (next.maxMp || 0) + rwd.mp;
                            next.mp = Math.min(next.maxMp, (next.mp || 0) + rwd.mp);
                        }
                        updatedPlayer = next;
                        const parts = [
                            rwd.atk && `공격력 +${rwd.atk}`,
                            rwd.def && `방어력 +${rwd.def}`,
                            rwd.hp && `생명 +${rwd.hp}`,
                            rwd.mp && `기력 +${rwd.mp}`,
                        ].filter(Boolean).join(' · ');
                        addLog('success', `이야기 보상 · ${parts}`);
                    }
                }
                dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
                if (outcome.type === 'chain_advance' || outcome.type === 'chain_advance_fail') {
                    const nextStep = (currentEvent._chainStep ?? 0) + 1;
                    dispatch({ type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: currentEvent._chainId, step: nextStep } });
                }
                dispatch({ type: AT.SET_EVENT, payload: null });
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                // cycle 135: chain 이벤트 보상 sensory cue — cycle 122/123/133 quest_complete
                // 사운드 재사용 (4번째 "달성/회수" 액션이 동일 E major 정체성 공유).
                // rwd 처리되어 보상 grant된 outcome 만 — outcome 자체가 reward 없을 때는
                // 무음 (silence-over-noise).
                if (rwd) soundManager.play('quest_complete');
                return;
            }

            // 일반 이벤트 outcome 처리
            let resultText = '';
            if (selectedOutcome) {
                if (selectedOutcome.gold) updatedPlayer = grantGold(updatedPlayer, selectedOutcome.gold);
                if (selectedOutcome.exp) {
                    const expResult = CombatEngine.applyExpGain(updatedPlayer, selectedOutcome.exp);
                    updatedPlayer = expResult.updatedPlayer;
                    expResult.logs.forEach((log: any) => addLog(log.type, log.text));
                    if (expResult.visualEffect) dispatch({ type: AT.SET_VISUAL_EFFECT, payload: expResult.visualEffect });
                }
                if (selectedOutcome.hp) {
                    updatedPlayer = { ...updatedPlayer, hp: Math.max(1, Math.min(fullStats.maxHp, updatedPlayer.hp + selectedOutcome.hp)) };
                }
                if (selectedOutcome.mp) {
                    updatedPlayer = { ...updatedPlayer, mp: Math.max(0, Math.min(fullStats.maxMp, updatedPlayer.mp + selectedOutcome.mp)) };
                }
                if (selectedOutcome.item) updatedPlayer = addItemByName(updatedPlayer, selectedOutcome.item);
                // 캠프파이어 "단련" 등 — 다음 전투용 tempBuff 부여 (combatItem 물약과 동일 패턴).
                //   turn-based라 전투 전까지 유지되며 다음 전투에서 소모된다.
                if (selectedOutcome.buff) {
                    updatedPlayer = { ...updatedPlayer, tempBuff: { atk: 0, def: 0, turn: 0, name: null, ...selectedOutcome.buff } };
                }
                resultText = formatEventText(selectedOutcome.log || MSG.EVENT_RESULT_DEFAULT);
                addLog('event', resultText);
            } else if (roll > 0.4) {
                const rewardGold = player.level * 50;
                updatedPlayer = grantGold(updatedPlayer, rewardGold);
                resultText = MSG.EVENT_SUCCESS_GOLD(rewardGold);
                addLog('success', resultText);
            } else {
                const dmg = Math.floor(Math.max(1, updatedPlayer.maxHp) * 0.1);
                updatedPlayer = { ...updatedPlayer, hp: Math.max(1, updatedPlayer.hp - dmg) };
                resultText = MSG.EVENT_FAIL_DAMAGE(dmg);
                addLog('error', resultText);
            }

            const levelQuestSync = CombatEngine.updateQuestProgress(updatedPlayer, '');
            updatedPlayer = { ...updatedPlayer, quests: levelQuestSync.updatedQuests };

            // cycle 439: history record timestamp 출력 dead 제거 — aiEventUtils
            //   summarizeHistory / getRecentEventSet은 event / choice / outcome만 read.
            //   timestamp 필드 어디로도 흐르지 않는 dead (cycle 333-356 시리즈 회귀).
            const newHistory = [
                ...updatedPlayer.history,
                { event: currentEvent.desc, choice: currentEvent.choices?.[idx], outcome: resultText }
            ].slice(-50);
            updatedPlayer = { ...updatedPlayer, history: newHistory };

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            dispatch({ type: AT.SET_EVENT, payload: null });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        },
    };
};

/**
 * 스카우팅 카드 선택 처리 — 카드 4종(combat/anomaly/unknown/elite)을 같은 탐험 턴 안에서
 * 즉시 해소한다. exploreUtils.ts의 기존 파이프 함수들(spawnEnemy/rollExplorationEvent/
 * applyBattleStartRelics/runQuietRollAndCombat)을 재호출/재배치하는 방식 — 신규 스폰
 * 로직을 만들지 않는다.
 */
const handleScoutChoice = (idx: any, currentEvent: any, deps: any, shared: any) => {
    const { player, dispatch, addLog, getFullStats } = deps;
    const { commitExploreOutcome } = shared;
    const outcome = toArray(currentEvent.outcomes).find((o: any) => o.choiceIndex === idx) || null;
    if (!outcome) {
        dispatch({ type: AT.SET_EVENT, payload: null });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }

    addLog('event', outcome.log || '');
    const mapData = DB.MAPS[player.loc];
    const playerRelics = player.relics || [];

    // 이벤트 패널을 닫고(현재 스카우팅 카드) 아래 분기에서 필요한 다음 상태를 dispatch한다.
    dispatch({ type: AT.SET_EVENT, payload: null });

    if (outcome.scoutEffect === 'combat' || outcome.scoutEffect === 'elite') {
        const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, playerRelics, { addLog });
        const isEliteCard = outcome.scoutEffect === 'elite';
        const mStats = isEliteCard
            ? {
                ...rawStats,
                name: rawStats.name?.startsWith('정예') ? rawStats.name : `정예 ${baseName}`,
                baseName,
                isElite: true,
                hp: Math.floor(rawStats.hp * BALANCE.SCOUT_ELITE_HP_MULT),
                maxHp: Math.floor(rawStats.maxHp * BALANCE.SCOUT_ELITE_HP_MULT),
                atk: Math.floor(rawStats.atk * BALANCE.SCOUT_ELITE_HP_MULT),
                scoutGuaranteedRelic: true,
            }
            : { ...rawStats, scoutRewardBonus: outcome.rewardBonus ?? BALANCE.SCOUT_COMBAT_REWARD_BONUS };

        const fullStats = getFullStats();
        commitExploreOutcome('combat', (nextPlayer: any) => applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog }));
        dispatch({ type: AT.SET_ENEMY, payload: mStats });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
        addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
        return;
    }

    if (outcome.scoutEffect === 'anomaly') {
        // 관대함 하향 (2026-07 밸런스 감사): "이상 신호"는 전투를 확정 회피하고 quiet 롤만
        //   굴리는 사실상 "안전 버튼"이었다. anomaly(부정 효과) 확률에만 ×1.5를 가중해
        //   위험을 소폭 되돌린다 — 유물/이벤트 확률은 그대로.
        const quietResult = rollExplorationEvent(player, mapData, playerRelics, {
            dispatch, addLog, getFullStats, anomalyMult: BALANCE.SCOUT_SIGNAL_ANOMALY_MULT
        });
        commitExploreOutcome(quietResult === 'nothing' ? 'nothing' : quietResult, null);
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        if (quietResult === 'nothing') addLog('info', MSG.EXPLORE_QUIET);
        return;
    }

    // 'unknown' — 짙은 안개: 기존 explore() 롤(quiet 롤 → 유물 보장 → 전투)로 그대로 위임.
    // 같은 탐험 턴 안에서 결과가 나와야 하므로 runQuietRollAndCombat을 즉시 재호출 —
    // "무슨 일이 일어날지 모른다"는 컨셉대로 신규 로직 없이 원래 파이프를 탄다. AI 서사
    // 이벤트 단계는 건너뛴다(이미 스카우팅 카드로 결정 지점을 소비했으므로 즉시 해소 우선).
    // skipBossGaugeAdvance: 이 explore() 턴의 게이지는 스카우팅 카드가 처음 뜬 시점에
    // 이미 1회 누적됐으므로(exploreActions.ts) 여기서 재호출 시 중복 누적 방지.
    const { addStoryLog } = deps;
    runQuietRollAndCombat(player, mapData, { dispatch, addLog, addStoryLog, getFullStats, commitExploreOutcome, skipBossGaugeAdvance: true });
};

/**
 * 원정 보스 접근 게이지 만충 카드("도전 vs 회피") 선택 처리.
 * - 도전: exploreUtils.spawnEnemy를 forceAreaBoss:true로 재호출해 구역 보스를 결정론적으로
 *   스폰(기존 15% 랜덤 스폰과 동일한 스탯 산출 경로 재사용, 신규 스폰 로직 없음) + 게이지 리셋.
 * - 회피: 게이지를 만충 상태로 유지(다음 탐험에서 재선택 가능) — 리셋하지 않는다.
 */
const handleBossGaugeChoice = (idx: any, currentEvent: any, deps: any) => {
    const { player, dispatch, addLog, getFullStats } = deps;
    const outcome = toArray(currentEvent.outcomes).find((o: any) => o.choiceIndex === idx) || null;
    dispatch({ type: AT.SET_EVENT, payload: null });

    if (!outcome) {
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }

    addLog('event', outcome.log || '');

    if (outcome.gaugeEffect === 'avoid') {
        // 회피 — 게이지는 만충 유지, 다음 탐험에서 다시 선택지가 뜬다.
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        return;
    }

    // 도전 — 게이지 리셋 + 구역 보스 결정론적 스폰.
    const mapData = DB.MAPS[player.loc];
    const playerRelics = player.relics || [];
    const { mStats } = spawnEnemy(mapData, player, playerRelics, { addLog }, { forceAreaBoss: true });

    const fullStats = getFullStats();
    dispatch({
        type: AT.SET_PLAYER,
        payload: (p: any) => {
            const nextPlayer = { ...p, stats: resetBossGaugeAfterChallenge(p, p.loc) };
            return applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog });
        },
    });
    dispatch({ type: AT.SET_ENEMY, payload: mStats });
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
};
