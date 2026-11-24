/**
 * 2026-11 지역 지도 걷기(설계 docs/OVERWORLD_WALK_DESIGN_2026-11.md). 지도 모양(`FieldMapLayout`)은 시드에서 다시 만들고
 * 저장하지 않는다 — 세이브에는 걷는 상태(`FieldMapState`)만 남는다.
 */

export type FieldDirection = 'up' | 'down' | 'left' | 'right';

/** 칸 글자: 벽 `#` · 길 `.`(위험 0) · 풀숲 `,`(위험 1) · 깊은 곳 `;`(위험 1.5). 입구 · 출구 · 상자는 칸 번호로 덧씌운다. */
export type FieldTileChar = '#' | '.' | ',' | ';';

export interface FieldExit {
    index: number;
    to: string;
}

export interface FieldChestSpot {
    id: number;
    index: number;
}

export interface FieldMapLayout {
    loc: string;
    seed: number;
    width: number;
    height: number;
    tiles: string;
    entrance: number;
    exits: FieldExit[];
    chests: FieldChestSpot[];
    /** 생성 시도가 모두 실패해 고정 비상 지도를 쓴다 */
    emergency: boolean;
}

/**
 * 걷기가 리듀서에 남기고 화면 쪽 훅이 처리하는 일 — 조우는 `explore()`, 출구는 이동 액션, 미믹은 전투 시작이 소유한다.
 * 저장되므로 처리하기 전에 다시 불러와도 그 일이 남는다(조우 · 미믹을 리로드로 피할 수 없다).
 */
export type FieldPending =
    | { kind: 'encounter' }
    | { kind: 'exit'; to: string }
    | { kind: 'mimic'; chestId: number }
    /** 3단계 보스 문 — 구역 보스 도전 카드(탐험의 카드와 같은 카드 · 같은 전투)를 연다 */
    | { kind: 'door' };

/**
 * 지도 갈래(2026-11 사람 테스트 전 묶음, docs/PRE_PLAYTEST_FEATURES_2026-11.md §1) — 이번 여정에서 클리어한 지역의 다음 지도 성격.
 * 카드 · 배율은 `systems/fieldTrait.ts`가 소유한다. `plain`은 성격이 없는 지도와 같다.
 */
export type FieldMapTrait = 'plain' | 'elite' | 'chest' | 'event' | 'quiet';

export interface FieldMapState {
    loc: string;
    /** 이 여정에서 만든 지도 순번 — 같은 탐험 수에서 다시 들어가도 새 지도가 나오게 한다 */
    seq: number;
    seed: number;
    pos: number;
    /** 밟은 칸 번호(오름차순) — 안개와 "이미 밟은 칸은 위험 0"이 읽는다 */
    visited: number[];
    openedChests: number[];
    danger: number;
    pending?: FieldPending | null;
    /** 이 지도에서 자동 탐험 횟수를 이미 썼다 — 멈춘 뒤 다시 켜도 횟수를 쓰지 않는다 */
    autoRun?: boolean;
    /** 고른 지도 성격 — 없으면 `plain`(첫 지도 · 고르지 않은 지도 · 이전 세이브). 지도와 함께 사라진다(런 범위). */
    trait?: FieldMapTrait;
    /** 오늘의 시련 지도 — 출구와 크기를 지역 데이터 대신 이 값에서 읽는다(`systems/dailyTrial.ts`가 만든다). 본편 지도에는 없다. */
    plan?: { exits: string[]; level: number };
}
