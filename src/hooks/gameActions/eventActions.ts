import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { toArray, grantGold } from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { pickWeightedRelics } from '../../data/relics';
import { CombatEngine } from '../../systems/CombatEngine';
import { soundManager } from '../../systems/SoundManager';

export const createEventActions = (deps: any, { emitUnlockedTitles }: any) => {
    const { player, currentEvent, dispatch, addLog, getFullStats } = deps;
    return {
        handleEventChoice: (idx: any) => {
            if (!currentEvent) return;

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
                addLog('event', outcome.log || '');
                const rwd = outcome.reward;
                if (rwd) {
                    if (rwd.type === 'gold' && rwd.amount) {
                        updatedPlayer = grantGold(updatedPlayer, rwd.amount);
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
                            rwd.atk && `ATK +${rwd.atk}`,
                            rwd.def && `DEF +${rwd.def}`,
                            rwd.hp && `HP +${rwd.hp}`,
                            rwd.mp && `MP +${rwd.mp}`,
                        ].filter(Boolean).join(' · ');
                        addLog('success', `[체인 보상] ${parts}`);
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
                resultText = selectedOutcome.log || MSG.EVENT_RESULT_DEFAULT;
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

            const newHistory = [
                ...updatedPlayer.history,
                { timestamp: Date.now(), event: currentEvent.desc, choice: currentEvent.choices?.[idx], outcome: resultText }
            ].slice(-50);
            updatedPlayer = { ...updatedPlayer, history: newHistory };

            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            emitUnlockedTitles(updatedPlayer);
            dispatch({ type: AT.SET_EVENT, payload: null });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
        },
    };
};
