import { useEffect, useState } from 'react';
import { advanceModeTransition, createModeTransition, getModeEnterClass } from '../../utils/modeTransition';
import type { GameMode } from '../../reducers/gameStates';

/**
 * 2026-10 (감사 GF-09): 모드가 바뀌면 조작판 칸에 진입 박자를 준다(utils/modeTransition.ts). 렌더 중에 이전 모드와 비교해
 * 바로 갱신한다 — 컨테이너를 다시 마운트하지 않으므로 조작판의 지역 상태는 그대로다. 모바일 · 데스크톱 배치가 같이 쓴다.
 */
export const useStageEnterClass = (gameState: GameMode): string => {
    const [modeTransition, setModeTransition] = useState(() => createModeTransition(gameState));
    const nextModeTransition = advanceModeTransition(modeTransition, gameState);
    if (nextModeTransition !== modeTransition) setModeTransition(nextModeTransition);
    return getModeEnterClass(nextModeTransition);
};

/**
 * 감사 GF-10: 전투 결과 카드는 지연 로드라 첫 승리에서 한 박자 늦게 떴다 — 전투에 들어가면 미리 불러 둔다(같은 청크를 GameRoot의 lazy가 쓴다).
 * 미리 불러 두기가 실패해도 게임은 그대로다 — 카드는 승리 때 GameRoot의 lazy가 다시 불러오고, 그 실패는 그쪽 경계가 처리한다.
 */
export const usePreloadPostCombatCard = (isCombat: boolean): void => {
    useEffect(() => {
        if (isCombat) import('../PostCombatCard').catch(() => undefined);
    }, [isCombat]);
};
