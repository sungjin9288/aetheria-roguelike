import { makeSharedHelpers } from './gameActions/_shared';
import { createMoveActions } from './gameActions/moveActions';
import { createExploreActions } from './gameActions/exploreActions';
import { createCharacterActions } from './gameActions/characterActions';
import { createEventActions } from './gameActions/eventActions';
import { createQuestActions } from './gameActions/questActions';
import { createAscensionActions } from './gameActions/ascensionActions';

/**
 * useGameActions — 이동, 탐색, 휴식, 이벤트, 직업, 퀘스트 수락, 시작, 리셋
 * createGameActions는 팩토리 함수로, useGameEngine에서 useMemo로 호출됩니다.
 */
export const createGameActions = (deps) => {
    const shared = makeSharedHelpers(deps);
    return {
        ...createMoveActions(deps, shared),
        ...createExploreActions(deps, shared),
        ...createCharacterActions(deps, shared),
        ...createEventActions(deps, shared),
        ...createQuestActions(deps, shared),
        ...createAscensionActions(deps, shared),
    };
};
