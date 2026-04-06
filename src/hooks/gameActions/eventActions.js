import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { toArray, grantGold } from '../../utils/gameUtils';
import { addItemByName } from '../../utils/inventoryUtils';
import { pickWeightedRelics } from '../../data/relics';
import { CombatEngine } from '../../systems/CombatEngine';

export const createEventActions = (deps, { emitUnlockedTitles }) => {
    const { player, currentEvent, dispatch, addLog, getFullStats } = deps;
    return {
        handleEventChoice: (idx) => {
            if (!currentEvent) return;

            const isChainEvent = Boolean(currentEvent._chainId);
            const selectedOutcome = isChainEvent
                ? (toArray(currentEvent.outcomes)[idx] || null)
                : (toArray(currentEvent.outcomes).find((o) => o.choiceIndex === idx) || null);
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
                }
                dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
                if (outcome.type === 'chain_advance' || outcome.type === 'chain_advance_fail') {
                    const nextStep = (currentEvent._chainStep ?? 0) + 1;
                    dispatch({ type: AT.UPDATE_EVENT_CHAIN, payload: { chainId: currentEvent._chainId, step: nextStep } });
                }
                dispatch({ type: AT.SET_EVENT, payload: null });
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                return;
            }

            // 일반 이벤트 outcome 처리
            let resultText = '';
            if (selectedOutcome) {
                if (selectedOutcome.gold) updatedPlayer = grantGold(updatedPlayer, selectedOutcome.gold);
                if (selectedOutcome.exp) {
                    const expResult = CombatEngine.applyExpGain(updatedPlayer, selectedOutcome.exp);
                    updatedPlayer = expResult.updatedPlayer;
                    expResult.logs.forEach((log) => addLog(log.type, log.text));
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
