import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import { multiplayerActionMap } from './multiplayerHandlers';
import { questActionMap } from './questHandlers';

export const featureActionMap = {
    ...protocolActionMap,
    ...rewardActionMap,
    ...questActionMap,
    ...multiplayerActionMap,
};
