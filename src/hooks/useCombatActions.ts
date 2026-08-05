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

    // 공격과 아이템 사용이 같은 지연 적 턴을 취소하거나 예약하도록 공유한다.
    let fallbackPending: any = null;
    const pendingControl = {
        clear: deps.clearPendingCombat || (() => {
            if (fallbackPending) clearTimeout(fallbackPending);
            fallbackPending = null;
        }),
        schedule: deps.schedulePendingCombat || ((callback: () => void, delay: number) => {
            fallbackPending = setTimeout(() => {
                fallbackPending = null;
                callback();
            }, delay);
        }),
    };

    return {
        ...createCombatAttackActions(deps, shared, pendingControl),
        ...createCombatItemActions(deps, shared, pendingControl),
        getSelectedSkill: () => getSelectedSkill(player)?.skill || null,
    };
};
