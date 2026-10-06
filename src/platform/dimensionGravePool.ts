import type { GraveEntry } from '../utils/graveUtils';

/**
 * 다른 차원의 묘비 풀(Wave 70) — 최근 공개 묘비 문서. React 비의존 모듈 상태다.
 *
 * 쓰는 쪽은 둘이다: 온라인 세션의 `useDimensionGravePool`(Firestore 읽기)과 QA 시드 API(`useGameTestApi`, mock 런타임 전용).
 * 읽는 쪽은 탐험 액션 하나다(`GameActionDeps.getDimensionGraves`). 오프라인 · mock · Firebase 설정이 없는 빌드에서는
 * 아무도 쓰지 않으므로 언제나 빈 목록이고, 탐험은 이 기능의 난수를 쓰지 않는다.
 */
let pool: readonly GraveEntry[] = [];

export const getDimensionGravePool = (): readonly GraveEntry[] => pool;

export const setDimensionGravePool = (entries: readonly GraveEntry[] | null | undefined): void => {
    pool = Array.isArray(entries) ? Object.freeze([...entries]) : [];
};
