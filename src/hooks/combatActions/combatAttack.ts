import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { BALANCE } from '../../data/constants';
import { resolveCombatActionSeed } from '../../utils/combatActionSeed';
import type { CombatActionDeps, CombatPendingControl, CombatSharedHelpers } from '../actionDeps';

const takeHarnessCombatSeed = (): number | undefined => {
    if (import.meta.env?.VITE_ENABLE_TEST_API !== '1' || typeof document === 'undefined') {
        return undefined;
    }
    const raw = document.documentElement.dataset.aetheriaCombatSeed;
    delete document.documentElement.dataset.aetheriaCombatSeed;
    if (raw === undefined || !/^\d{1,10}$/.test(raw)) return undefined;
    const seed = Number(raw);
    return Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff
        ? seed
        : undefined;
};

export const createCombatAttackActions = (
    deps: CombatActionDeps,
    _shared: CombatSharedHelpers,
    pendingControl: CombatPendingControl,
) => {
    const {
        gameState,
        enemy,
        dispatch,
        addLog,
        combatTurn = 0,
        claimCombatAction,
    } = deps;

    return {
        combat: (kind: string) => {
            pendingControl.clear();
            if (gameState !== GS.COMBAT || !enemy) {
                addLog('error', MSG.COMBAT_NOT_IN_BATTLE);
                return;
            }
            if (!['attack', 'skill', 'escape'].includes(kind)) return;

            // useGameEngine.ts가 항상 claimCombatAction을 명시 전달하므로
            // (line 180) 자체 fallback Set 구현은 불필요.
            const claimKey = `combat:${combatTurn}`;
            const accepted = claimCombatAction(claimKey);
            if (!accepted) return;

            dispatch({
                type: AT.RESOLVE_COMBAT_ACTION,
                payload: {
                    kind,
                    expectedTurn: combatTurn,
                    seed: resolveCombatActionSeed(Math.random, takeHarnessCombatSeed()),
                    now: Date.now(),
                },
            });
            pendingControl.schedule(
                () => dispatch({ type: AT.SET_VISUAL_EFFECT, payload: null }),
                BALANCE.ENEMY_TURN_DELAY_MS,
            );
        },
    };
};
