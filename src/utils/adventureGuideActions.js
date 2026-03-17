import { DB } from '../data/db';
import { GS } from '../reducers/gameStates';

export const runGuidanceAction = ({
    action,
    actions,
    setGameState,
    setSideTab,
    onOpenArchive,
}) => {
    if (!action) return;

    switch (action.kind) {
        case 'claim_quest':
            actions.completeQuest?.(action.questId);
            break;
        case 'rest':
            actions.rest?.();
            break;
        case 'open_class':
            setGameState?.(GS.JOB_CHANGE);
            break;
        case 'open_quest_board':
            setGameState?.(GS.QUEST_BOARD);
            break;
        case 'open_move':
            setGameState?.(GS.MOVING);
            break;
        case 'explore':
            actions.explore?.();
            break;
        case 'open_inventory':
            setSideTab?.('inventory');
            onOpenArchive?.('inventory');
            break;
        case 'open_shop':
            actions.setShopItems?.([...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors]);
            setGameState?.(GS.SHOP);
            break;
        case 'open_quest':
            setSideTab?.('quest');
            onOpenArchive?.('quest');
            break;
        default:
            break;
    }
};
