import { getDailyProtocolCompletions, formatDailyProtocolReward, makeEmitTitles } from '../utils/gameUtils';
import { MSG } from '../data/messages';
import { getSelectedSkill } from './combatActions/_helpers';
import { createCombatAttackActions } from './combatActions/combatAttack';
import { createCombatItemActions } from './combatActions/combatItem';

/**
 * createCombatActions — 전투 로직 (공격, 스킬, 도주, 아이템 사용)
 * pendingEnemyTurn ref를 공유 mutable ref로 관리합니다.
 */
export const createCombatActions = (deps) => {
    const { player, dispatch, addLog } = deps;

    const emitDailyProtocolLogs = (type, amount = 1) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission) => {
            addLog('system', `📋 일일 프로토콜 완료: ${formatDailyProtocolReward(mission.reward)}`);
        });
    };
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);
    const shared = { emitDailyProtocolLogs, emitUnlockedTitles };

    // pendingEnemyTurn을 ref 객체로 래핑하여 combatUseItem과 공유
    const pendingRef = { current: null };

    return {
        ...createCombatAttackActions(deps, shared, pendingRef),
        ...createCombatItemActions(deps, shared, pendingRef),
        getSelectedSkill: () => getSelectedSkill(player)?.skill || null,
    };
};
