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
    FORMATION: 'formation',
});
