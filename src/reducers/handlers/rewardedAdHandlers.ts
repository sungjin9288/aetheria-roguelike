import type { GameState, HandlerMap } from '../gameReducer';
import { recordReturnSupplyReward } from '../../utils/returnSupplyReward';

export const returnSupplyRewardActionMap = {
    RECORD_RETURN_SUPPLY_REWARD: (state, action): GameState => {
        const expeditionId = typeof action.payload?.expeditionId === 'string'
            ? action.payload.expeditionId
            : '';
        const player = recordReturnSupplyReward(state.player, expeditionId);
        if (player === state.player) return state;
        return { ...state, player, syncStatus: 'syncing' };
    },
} satisfies HandlerMap;
