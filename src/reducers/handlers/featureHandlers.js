import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import { multiplayerActionMap } from './multiplayerHandlers';

export const featureActionMap = {
    ...protocolActionMap,
    ...rewardActionMap,
    ...multiplayerActionMap,
};
