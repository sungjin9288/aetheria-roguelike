import { makeEmitTitles } from '../utils/gameUtils';
import { getSelectedSkill } from './combatActions/_helpers';
import { createCombatAttackActions } from './combatActions/combatAttack';
import { createCombatItemActions } from './combatActions/combatItem';

/**
 * createCombatActions — 전투 로직 (공격, 스킬, 도주, 아이템 사용)
 * pendingEnemyTurn ref를 공유 mutable ref로 관리합니다.
 */
export const createCombatActions = (deps: any) => {
    const { player, dispatch, addLog } = deps;

    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);
    const shared = { emitUnlockedTitles };

    // pendingEnemyTurn을 ref 객체로 래핑하여 combatUseItem과 공유
    const pendingRef: { current: any } = { current: null };

    return {
        ...createCombatAttackActions(deps, shared, pendingRef),
        ...createCombatItemActions(deps, shared, pendingRef),
        getSelectedSkill: () => getSelectedSkill(player)?.skill || null,
    };
};
