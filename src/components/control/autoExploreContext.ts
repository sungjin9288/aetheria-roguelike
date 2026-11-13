import { createContext, useContext } from 'react';
import type { AutoExploreControl } from '../../hooks/useAutoExplore';

/**
 * 연속 탐험 토글(2026-11 H1) — GameRoot가 `useAutoExplore`를 한 번 돌리고, 조작판(휴대폰 · 데스크톱 두 배치)이 읽는다.
 *   두 배치를 거쳐 prop으로 내리지 않으려는 전달 통로일 뿐이고 판정은 `utils/autoExplore.ts`가 소유한다.
 */
export const AutoExploreContext = createContext<AutoExploreControl | null>(null);

export const useAutoExploreControl = (): AutoExploreControl | null => useContext(AutoExploreContext);
