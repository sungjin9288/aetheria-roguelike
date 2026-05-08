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

// cycle 301: GameState type alias 제거 — 외부 import 0건 (모두 GS const만 사용).
//   GS const literal types로 narrowing 가능. gameReducer.ts의 GameState (다른 의미)와 명칭 충돌도 해소.
