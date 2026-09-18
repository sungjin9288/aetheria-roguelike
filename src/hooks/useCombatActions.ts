import { makeEmitTitles } from '../utils/gameUtils';
import { getSelectedSkill } from './combatActions/_helpers';
import { createCombatAttackActions } from './combatActions/combatAttack';
import { createCombatItemActions } from './combatActions/combatItem';
import type { CombatActionDeps, CombatPendingControl, CombatSharedHelpers } from './actionDeps';

/**
 * createCombatActions — 전투 로직 (공격, 스킬, 도주, 아이템 사용)
 * pendingEnemyTurn ref를 공유 mutable ref로 관리합니다.
 */
export const createCombatActions = (deps: CombatActionDeps) => {
    const { player, dispatch, addLog } = deps;

    const emitUnlockedTitles = makeEmitTitles(dispatch, addLog);
    const shared: CombatSharedHelpers = { emitUnlockedTitles };

    // 공격과 아이템 사용이 같은 지연 적 턴을 취소하거나 예약하도록 공유한다.
    // useGameEngine.ts가 항상 clearPendingCombat/schedulePendingCombat을 명시 전달하므로
    // (line 177-178) 자체 fallback 구현은 불필요.
    const pendingControl: CombatPendingControl = {
        clear: deps.clearPendingCombat,
        schedule: deps.schedulePendingCombat,
    };

    return {
        ...createCombatAttackActions(deps, shared, pendingControl),
        ...createCombatItemActions(deps, shared, pendingControl),
        getSelectedSkill: () => getSelectedSkill(player)?.skill || null,
    };
};
