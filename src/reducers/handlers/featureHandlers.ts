import { protocolActionMap } from './protocolHandlers';
import { rewardActionMap } from './rewardHandlers';
import { multiplayerActionMap } from './multiplayerHandlers';
import { questActionMap } from './questHandlers';
import { economyActionMap } from './economyHandlers';
import { equipmentActionMap } from './equipmentHandlers';
import { premiumActionMap } from './premiumHandlers';
import { makeCombatActionMap } from './combatHandlers';

export const makeFeatureActionMap = (initialPlayer: any) => ({
    ...protocolActionMap,
    ...rewardActionMap,
    ...questActionMap,
    ...economyActionMap,
    ...equipmentActionMap,
    ...premiumActionMap,
    ...makeCombatActionMap(initialPlayer),
    ...multiplayerActionMap,
});
