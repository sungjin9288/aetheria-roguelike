import { useState } from 'react';
import { nextCombatExitTrack } from '../utils/appScreen';

/**
 * 전투가 끝날 때마다 하나 오르는 수 — 전이 판정은 `nextCombatExitTrack`(순수 함수)이 소유한다.
 *   이전 렌더 값과 비교해 렌더 중에 상태를 맞추는 React 권장 패턴이라, 효과가 도는 커밋에는 이미 새 값이 들어 있다.
 */
export const useCombatExitCount = (inCombat: boolean): number => {
    const [track, setTrack] = useState(() => ({ inCombat, exits: 0 }));
    const next = nextCombatExitTrack(track, inCombat);
    if (next !== track) setTrack(next);
    return next.exits;
};
