import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import { multiplayerActionMap } from './multiplayerHandlers';
import { questActionMap } from './questHandlers';
import { economyActionMap } from './economyHandlers';

export const featureActionMap = {
    ...protocolActionMap,
    ...rewardActionMap,
    ...questActionMap,
    ...economyActionMap,
    ...multiplayerActionMap,
};
