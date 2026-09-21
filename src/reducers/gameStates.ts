/**
 * GAME_STATE — 게임 상태 문자열 상수 (중앙 집중 관리)
 * 오타 및 런타임 에러 방지를 위해 모든 gameState 참조는 이 상수를 사용합니다.
 */
export const GS = Object.freeze({
    IDLE: 'idle',
    COMBAT: 'combat',
    EVENT: 'event',
    // 2026-09 Wave 19 K1: AI 이벤트 **준비 중** — 응답이 오기 전의 모드다.
    //   예전에는 `EVENT`를 먼저 세우고 최대 9.5초를 기다렸는데, 그 창의 상태는
    //   `{gameState: 'event', currentEvent: null}`이라 그대로 저장/복원되면
    //   `EventPanel`이 `return null`인 벽돌이 됐고, `generateEvent`가 reject하면
    //   리로드 없이도 같은 모양이 됐다(catch 부재). 준비 중은 동반 상태가 **없는**
    //   모드라 복원 시 언제나 idle로 접힌다(bootstrapHandlers.restorableMode).
    EVENT_PENDING: 'event_pending',
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

// 2026-09 Wave 20 L1: 그 alias를 **`GameMode`라는 이름으로** 되살린다 — 충돌 이유는
//   위 주석대로이고, §8-6의 어휘("복원할 수 없는 **모드**")와도 맞는다.
//   `gameState`는 src 17곳에서 `string`으로 선언돼 있었다. 값은 전부 GS 멤버였지만
//   (실측: 오타 0) 컴파일러는 그걸 보장하지 못했다 — `=== 'evnt'` 비교나
//   `dispatch({SET_GAME_STATE, payload: 'formation'})`이 조용히 통과했고,
//   `platformBack`/`commandParser`의 손으로 채운 모드 표는 새 GS 멤버를 놓쳐도
//   말이 없었다(K1이 `event_pending`에서 실제로 그랬다).
/** 게임 모드 — `GS`의 값 유니온. `gameState`를 선언하는 모든 자리의 타입이다. */
export type GameMode = typeof GS[keyof typeof GS];

const GAME_MODES: ReadonlySet<string> = new Set<string>(Object.values(GS));

/**
 * 세이브 봉투 경계의 유일한 술어.
 *
 * `LoadDataPayload.gameState`는 `JSON.parse`(localStorage/Firestore)의 결과라
 * **신뢰 밖**이다 — 그 자리에 `GameMode`를 선언하는 것은 `as` 캐스트와 같다(§2).
 * 그래서 선언은 `string`으로 두고 여기서 좁힌다.
 */
export const isGameMode = (value: string): value is GameMode => GAME_MODES.has(value);
