import { BALANCE } from '../data/constants';
import { CLASSES } from '../data/classes';
import { getDailyProtocolCompletions, formatDailyProtocolReward, makeEmitTitles } from '../utils/gameUtils';
import { AT } from '../reducers/actionTypes';
import { CombatEngine } from '../systems/CombatEngine';
import { MSG } from '../data/messages';
import { resolveInvasion } from '../utils/graveUtils';
import { createRewardActions } from './useInventoryActions.rewards';
import { createEquipmentActions } from './useInventoryActions.equipment';
import { createEconomyActions } from './useInventoryActions.economy';
import { createPremiumActions } from './useInventoryActions.premium';

/**
 * createInventoryActions — 인벤토리/경제 액션 오케스트레이터.
 *   PR #4: 도메인별 sub-factory(rewards/equipment/economy/premium)로 분할하고
 *   여기서 공유 클로저 + deps(ctx)를 주입해 조합한다. 단건 액션
 *   (chooseSkillBranch/invadeGrave)만 본 파일에 잔류.
 */
export const createInventoryActions = ({ player, gameState, dispatch, addLog, addStoryLog, getFullStats }: any) => {
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);

    // cycle 504: amount default 1 제거 — 호출자 5건 모두 amount 명시 전달.
    const emitDailyProtocolLogs = (type: any, amount: any) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission: any) => {
            addLog('system', `📋 일일 프로토콜 완료: ${formatDailyProtocolReward(mission.reward)}`);
        });
    };

    const syncLevelQuests = (updatedPlayer: any) => {
        const questResult = CombatEngine.updateQuestProgress(updatedPlayer, '');
        return { ...updatedPlayer, quests: questResult.updatedQuests };
    };

    // PR #4: 도메인별 sub-factory 조합. 공유 클로저 + deps를 ctx로 주입해
    //   각 도메인 파일이 동일 player 참조/헬퍼를 공유 (동작 보존).
    const ctx = { player, gameState, dispatch, addLog, addStoryLog, getFullStats, emitUnlockedTitles, emitDailyProtocolLogs, syncLevelQuests };

    return ({

        ...createRewardActions(ctx),
        ...createEquipmentActions(ctx),
        ...createEconomyActions(ctx),
        ...createPremiumActions(ctx),

        chooseSkillBranch: (skillName: any, choice: any) => {
            if (player.skillChoices?.[skillName]) {
                return addLog('warn', MSG.SKILL_BRANCH_ALREADY_CHOSEN(skillName));
            }
            const branch = CLASSES[player.job]?.skillBranches?.[skillName]?.find((entry: any) => entry.choice === choice);
            if (!branch) return addLog('error', MSG.SKILL_INVALID_BRANCH);
            dispatch({ type: AT.CHOOSE_SKILL_BRANCH, payload: { skillName, choice } });
            addLog('system', MSG.SKILL_BRANCH_CHOSEN(skillName, branch.label || '선택한 성장'));
        },

        invadeGrave: (targetGrave: any) => {
            const today = new Date().toDateString();
            const lastDate = player.stats?.lastInvadeDate;
            const count = lastDate === today ? (player.stats?.dailyInvadeCount || 0) : 0;
            // cycle 137: DAILY_INVADE_LIMIT(=5)이 BALANCE 객체에 있으나 기존엔 CONSTANTS의
            // 동일명 키(undefined)를 참조 → count >= undefined가 항상 false라 일일 5회
            // 침략 제한이 절대 작동 안 했음 (무제한 침략) 잠복 버그 수정.
            if (count >= BALANCE.DAILY_INVADE_LIMIT) {
                return addLog('warn', MSG.INVADE_LIMIT);
            }
            if (!targetGrave.items || targetGrave.items.length === 0) {
                return addLog('warn', MSG.INVADE_NO_ITEMS);
            }
            const playerAtk = getFullStats?.()?.atk || player.atk || 10;
            const { success, reward } = resolveInvasion(targetGrave, playerAtk);
            dispatch({ type: AT.INVADE_GRAVE, payload: { reward: reward || null, uid: targetGrave.uid } });
            if (success && reward) {
                addLog('success', MSG.INVADE_SUCCESS(targetGrave.playerName || '무명 용사', reward.name));
            } else {
                addLog('warn', MSG.INVADE_FAIL(targetGrave.playerName || '무명 용사'));
            }
        },

    });
};
