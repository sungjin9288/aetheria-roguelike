import { getDailyProtocolCompletions, formatDailyProtocolReward, makeEmitTitles } from '../utils/gameUtils';
import { MSG } from '../data/messages';
import { getSelectedSkill } from './combatActions/_helpers';
import { createCombatAttackActions } from './combatActions/combatAttack';
import { createCombatItemActions } from './combatActions/combatItem';

/**
 * createCombatActions — 전투 로직 (공격, 스킬, 도주, 아이템 사용)
 * pendingEnemyTurn ref를 공유 mutable ref로 관리합니다.
 */
export const createCombatActions = (deps: any) => {
    const { player, dispatch, addLog } = deps;

    // cycle 504: amount default 1 제거 — 호출자 5건 모두 amount 명시 전달.
    const emitDailyProtocolLogs = (type: any, amount: any) => {
        const completed = getDailyProtocolCompletions(player, type, amount);
        completed.forEach((mission: any) => {
            addLog('system', MSG.DAILY_PROTOCOL_DONE(formatDailyProtocolReward(mission.reward)));
        });
    };
    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);
    const shared = { emitDailyProtocolLogs, emitUnlockedTitles };

    // pendingEnemyTurn을 ref 객체로 래핑하여 combatUseItem과 공유
    const pendingRef: { current: any } = { current: null };

    return {
        ...createCombatAttackActions(deps, shared, pendingRef),
        ...createCombatItemActions(deps, shared, pendingRef),
        getSelectedSkill: () => getSelectedSkill(player)?.skill || null,
    };
};
