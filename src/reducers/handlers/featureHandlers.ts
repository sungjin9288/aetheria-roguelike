import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import { multiplayerActionMap } from './multiplayerHandlers';
import { questActionMap } from './questHandlers';
import { economyActionMap } from './economyHandlers';
import { equipmentActionMap } from './equipmentHandlers';

export const featureActionMap = {
    ...protocolActionMap,
    ...rewardActionMap,
    ...questActionMap,
    ...economyActionMap,
    ...equipmentActionMap,
    ...multiplayerActionMap,
};
