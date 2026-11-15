import { makeSharedHelpers } from './gameActions/_shared';
import { createMoveActions } from './gameActions/moveActions';
import { createExploreActions } from './gameActions/exploreActions';
import { createCharacterActions } from './gameActions/characterActions';
import { createEventActions } from './gameActions/eventActions';
import { createQuestActions } from './gameActions/questActions';
import { createAscensionActions } from './gameActions/ascensionActions';
import { createFieldActions } from './gameActions/fieldActions';
import type { GameActionDeps } from './actionDeps';

/**
 * useGameActions — 이동, 탐색, 휴식, 이벤트, 직업, 퀘스트 수락, 시작, 리셋
 * createGameActions는 팩토리 함수로, useGameEngine에서 useMemo로 호출됩니다.
 */
export const createGameActions = (deps: GameActionDeps) => {
    const shared = makeSharedHelpers(deps);
    // cycle 315: createMoveActions / createAscensionActions는 shared를 사용하지 않아 1-arg로 호출.
    const moveActions = createMoveActions(deps);
    const exploreActions = createExploreActions(deps, shared);
    return {
        ...moveActions,
        ...exploreActions,
        ...createCharacterActions(deps, shared),
        ...createEventActions(deps, shared),
        ...createQuestActions(deps, shared),
        ...createAscensionActions(deps),
        // 2026-11 지역 지도: 조우는 탐험 한 번, 출구는 이동 한 번 — 같은 액션을 부른다.
        ...createFieldActions(deps, { explore: exploreActions.explore, move: moveActions.move }),
    };
};
