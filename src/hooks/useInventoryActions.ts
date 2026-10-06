import { CLASSES } from '../data/classes';
import { makeEmitTitles } from '../utils/gameUtils';
import { AT } from '../reducers/actionTypes';
import { CombatEngine } from '../systems/CombatEngine';
import { MSG } from '../data/messages';
import { createRewardActions } from './useInventoryActions.rewards';
import { createEquipmentActions } from './useInventoryActions.equipment';
import { createEconomyActions } from './useInventoryActions.economy';
import type { Player } from '../types';
import type { InventoryActionCtx, InventoryActionDeps } from './actionDeps';
import { createPremiumActions } from './useInventoryActions.premium';

/**
 * createInventoryActions — 인벤토리/경제 액션 오케스트레이터.
 *   PR #4: 도메인별 sub-factory(rewards/equipment/economy/premium)로 분할하고
 *   여기서 공유 클로저 + deps(ctx)를 주입해 조합한다. 단건 액션
 *   (chooseSkillBranch)만 본 파일에 잔류. 묘비 침공(invadeGrave)은 Wave 70에 다른 차원의 묘비 탐험 이벤트로 옮겼다.
 */
export const createInventoryActions = ({
    player,
    gameState,
    dispatch,
    addLog,
    addStoryLog,
    getFullStats,
}: InventoryActionDeps) => {
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);

    const syncLevelQuests = (updatedPlayer: Player) => {
        const questResult = CombatEngine.updateQuestProgress(updatedPlayer, '');
        return { ...updatedPlayer, quests: questResult.updatedQuests };
    };

    // PR #4: 도메인별 sub-factory 조합. 공유 클로저 + deps를 ctx로 주입해
    //   각 도메인 파일이 동일 player 참조/헬퍼를 공유 (동작 보존).
    const ctx: InventoryActionCtx = {
        player,
        gameState,
        dispatch,
        addLog,
        addStoryLog,
        getFullStats,
        emitUnlockedTitles,
        syncLevelQuests,
    };

    return ({

        ...createRewardActions(ctx),
        ...createEquipmentActions(ctx),
        ...createEconomyActions(ctx),
        ...createPremiumActions(ctx),

        chooseSkillBranch: (skillName: string, choice: string) => {
            if (player.skillChoices?.[skillName]) {
                return addLog('warn', MSG.SKILL_BRANCH_ALREADY_CHOSEN(skillName));
            }
            const branch = CLASSES[player.job!]?.skillBranches?.[skillName]?.find((entry) => entry.choice === choice);
            if (!branch) return addLog('error', MSG.SKILL_INVALID_BRANCH);
            dispatch({ type: AT.CHOOSE_SKILL_BRANCH, payload: { skillName, choice } });
            addLog('system', MSG.SKILL_BRANCH_CHOSEN(skillName, branch.label || '선택한 성장'));
        },


    });
};
