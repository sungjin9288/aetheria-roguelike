import type { GameAction, GameState } from '../gameReducer';
import { recordReturnSupplyReward } from '../../utils/returnSupplyReward';

export const returnSupplyRewardActionMap = {
    RECORD_RETURN_SUPPLY_REWARD: (state: GameState, action: GameAction): GameState => {
        const expeditionId = typeof action.payload?.expeditionId === 'string'
            ? action.payload.expeditionId
            : '';
        const player = recordReturnSupplyReward(state.player, expeditionId);
        if (player === state.player) return state;
        return { ...state, player, syncStatus: 'syncing' };
    },
};
