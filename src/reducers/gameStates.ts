/**
 * GAME_STATE — 게임 상태 문자열 상수 (중앙 집중 관리)
 * 오타 및 런타임 에러 방지를 위해 모든 gameState 참조는 이 상수를 사용합니다.
 */
export const GS = Object.freeze({
    IDLE: 'idle',
    COMBAT: 'combat',
    EVENT: 'event',
    MOVING: 'moving',
    SHOP: 'shop',
    JOB_CHANGE: 'job_change',
    QUEST_BOARD: 'quest_board',
    CRAFTING: 'crafting',
    DEAD: 'dead',
    ASCENSION: 'ascension',
    // cycle 207: dead 'formation' state 제거 — 미구현 placeholder. cycle 120/124/195/206
    //   dead cleanup 패턴. 어떤 핸들러도 dispatch / 비교 안 함.
    TRUE_ENDING: 'true_ending',
} as const);

/** 가능한 game state 값 (literal union — TS narrowing 용). */
export type GameState = typeof GS[keyof typeof GS];
