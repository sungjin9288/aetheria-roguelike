import { createContext, useContext } from 'react';
import type { FieldMapControl } from '../../hooks/useFieldMap';

/**
 * 지역 지도 걷기(2026-11) — GameRoot가 `useFieldMap`을 한 번 돌리고 무대(휴대폰 · 데스크톱)와 조작판이 읽는다.
 *   prop으로 두 배치를 거쳐 내리지 않으려는 전달 통로일 뿐이고 판정은 리듀서 · `systems/fieldMapWalk.ts`가 소유한다.
 */
export const FieldMapContext = createContext<FieldMapControl | null>(null);

export const useFieldMapControl = (): FieldMapControl | null => useContext(FieldMapContext);
