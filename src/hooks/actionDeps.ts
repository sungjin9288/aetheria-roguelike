/**
 * actionDeps.ts — 액션 팩토리 주입 경계(deps) 타입 단일 원천. (Wave 6 X1)
 *
 * `useGameEngine`이 조립해 `createGameActions` / `createCombatActions` /
 * `createInventoryActions`에 넘기는 객체의 모양을 여기 한 번만 선언한다. 예전엔 모든
 * 팩토리가 deps를 `any`로 받아 그 안의 콜백(`p` / `entry` 같은 인자)까지 전부 `any`로
 * 번져 나갔다.
 *
 * 규칙:
 *  - 필드 타입은 "진짜 출처"에서 가져온다 — 상태 필드는 `GameState['x']`,
 *    플레이어는 `Player`, 파생 스탯은 `FullStats`, dispatch는 `Dispatch<GameAction>`.
 *    출처가 바뀌면 여기도 자동으로 따라간다(재선언 금지).
 *  - 이 파일은 타입 전용이다. 런타임 import가 없으므로 컴포넌트가
 *    `import type { GameActions } from '../hooks/actionDeps'`로 가져가도 React 훅
 *    모듈이 로드되지 않는다.
 */
import type { Dispatch } from 'react';
import type { GameAction, GameState } from '../reducers/gameReducer';
import type { FullStats, Player } from '../types';
import type { MilestoneStoryBeatId } from '../utils/milestoneStory';
import type { createGameActions } from './useGameActions';
import type { createCombatActions } from './useCombatActions';
import type { createInventoryActions } from './useInventoryActions';
import type { GameMode } from '../reducers/gameStates';

/** 게임 로그 출력 — `useGameEngine.addLog` (AT.ADD_LOG 래퍼)의 시그니처. */
export type AddLog = (type: string, text: string) => void;

/**
 * AI 서사 로그의 컨텍스트 — `AI_SERVICE.generateStory`로 그대로 흘러간다
 * (`{ loc }` / `{ level }` / `{ questTitle }` 등 호출부마다 다른 자유 키).
 */
export type StoryLogData = Record<string, unknown>;

/**
 * 서사 로그 요청. 실제 구현(`useGameEngine.addStoryLog`)은 async지만 반환값을 읽는
 * 호출부가 없고, reducer 쪽 수집기(combatHandlers의 `storyEvents.push`)도 같은 자리에
 * 들어오므로 반환 타입은 void로 열어 둔다.
 */
export type AddStoryLog = (type: string, data: StoryLogData) => void;

/**
 * 파생 전투 스탯 조회. 인자를 주면 "그 플레이어라면" 스냅샷(직업 변경 미리보기 등),
 * 생략하면 현재 player 기준이다.
 */
export type GetFullStats = (targetPlayer?: Player) => FullStats;

/** 신규 칭호 해금 로그 — `gameUtils.makeEmitTitles(dispatch, addLog)`의 반환 함수. */
export type EmitUnlockedTitles = (updatedPlayer: Player) => void;

/**
 * 이동/탐험/이벤트/퀘스트/직업/승천 액션 팩토리가 받는 주입 경계.
 * `useGameEngine.ts`의 `deps` 객체 리터럴이 이 타입의 유일한 생산자다.
 */
export interface GameActionDeps {
    player: Player;
    gameState: GameState['gameState'];
    uid: GameState['uid'];
    grave: GameState['grave'];
    /**
     * 진행 중인 이벤트 카드. AI 생성/체인/정찰/보스 게이지/구조화 폴백이 모두 같은
     * 슬롯을 쓰는 열린 모양이라 `GameState['currentEvent']`(`GameEvent | null`)를 그대로 따른다 —
     * 닫는 작업은 reducer 핸들러(chain/bounded/fallback) 소유라 이 트랙 범위 밖이다.
     */
    currentEvent: GameState['currentEvent'];
    isAiThinking: boolean;
    enemy: GameState['enemy'];
    liveConfig: GameState['liveConfig'];
    dispatch: Dispatch<GameAction>;
    addLog: AddLog;
    addStoryLog: AddStoryLog;
    getFullStats: GetFullStats;
    /**
     * 결정론 테스트용 RNG 주입점. 프로덕션(`useGameEngine`)은 전달하지 않으며,
     * 각 팩토리가 `typeof deps.rng === 'function' ? deps.rng : Math.random`으로 떨어진다.
     */
    rng?: () => number;
}

/** `GameActionDeps` + 팩토리 내부에서 rng가 이미 확정된 상태(스카우팅/보스 게이지 해소). */
export type GameActionDepsWithRng = GameActionDeps & { rng: () => number };

/**
 * 전투 액션 팩토리 경계. `useGameEngine`이 시각효과 타이머/중복 탭 잠금 4종과
 * 현재 전투 턴 번호를 추가로 주입한다(전투 턴 해석 자체는 reducer 소유).
 */
export interface CombatActionDeps extends GameActionDeps {
    /** 시각효과 해제 타이머 취소. */
    clearPendingCombat: () => void;
    /** 시각효과 해제 타이머 예약. */
    schedulePendingCombat: (callback: () => void, delay: number) => void;
    /** 같은 아이템의 중복 탭을 1회로 접는다(수락 시 true). */
    claimCombatItem: (itemId: string) => boolean;
    /** 같은 턴의 중복 탭을 1회로 접는다(수락 시 true). */
    claimCombatAction: (key: string) => boolean;
    combatTurn: GameState['combatTurn'];
}

/**
 * 전투 액션 2종(공격/아이템)이 공유하는 지연 타이머 제어.
 * `createCombatActions`가 deps의 clear/schedule을 묶어 두 sub-factory에 내려 준다.
 */
export interface CombatPendingControl {
    clear: () => void;
    schedule: (callback: () => void, delay: number) => void;
}

/** 전투 sub-factory가 받는 공유 헬퍼 묶음. */
export interface CombatSharedHelpers {
    emitUnlockedTitles: EmitUnlockedTitles;
}

/** 인벤토리 오케스트레이터가 받는 경계 — 엔진 deps와 동일 객체다. */
export type InventoryActionDeps = GameActionDeps;

/**
 * 인벤토리 도메인 sub-factory(rewards/equipment/economy/premium) 공통 ctx.
 * 오케스트레이터가 deps 일부 + 공유 클로저 2개를 묶어 주입한다.
 */
export interface InventoryActionCtx extends Pick<
    GameActionDeps,
    'player' | 'gameState' | 'dispatch' | 'addLog' | 'addStoryLog' | 'getFullStats'
> {
    emitUnlockedTitles: EmitUnlockedTitles;
    syncLevelQuests: (updatedPlayer: Player) => Player;
}

/**
 * player에 의존하지 않는 순수 dispatch 래퍼 묶음(`useGameEngine.stableActions`).
 * 이 그룹이 다시 player에 묶이지 않도록 tests/game-engine-actions-memo.test.js가
 * 의존성 배열을 정적으로 고정한다.
 */
export interface EngineStableActions {
    // --- UI 상태 setter ---
    setSideTab: (val: string) => void;
    setGameState: (val: GameMode) => void;
    setShopItems: (val: GameState['shopItems']) => void;
    acknowledgeMilestoneStoryBeat: (id: MilestoneStoryBeatId) => void;
    openExpeditionDebrief: () => void;
    setActiveTitle: (val: string | null) => void;
    setReadabilityMode: (val: string) => void;
    setEquipmentDetailMode: (val: string) => void;
    dismissEvent: () => void;

    // --- 기능 액션 ---
    setQuickSlot: (index: number, item: GameState['quickSlots'][number]) => void;
    clearPostCombat: () => void;
    clearEconomyReceipt: () => void;
    getUid: () => GameState['uid'];
    isAdmin: () => boolean;
}

/** `useGameEngine`이 팩토리 3종 위에 직접 얹는 액션/값 전체. */
export interface EngineOwnedActions extends EngineStableActions {
    // --- player 의존 ---
    closeExpeditionDebrief: () => void;

    // --- 조회용 값/함수 ---
    economyReceipt: GameState['economyReceipt'];
    liveConfig: GameState['liveConfig'];
    leaderboard: GameState['leaderboard'];
    getFullStats: GetFullStats;
    dispatch: Dispatch<GameAction>;
}

/**
 * 컴포넌트가 받는 `actions` 객체의 전체 모양.
 * `useGameEngine`의 `actions` useMemo가 돌려주는 객체 리터럴이 `satisfies GameActions`로
 * 검사되므로 실제 조립과 어긋나면 컴파일이 깨진다 — 이 타입은 "설명"이 아니라 계약이다.
 * (const 선언에 주석을 달지 않는 이유: tests/game-engine-actions-memo.test.js가
 *  `const actions = useMemo(` 원문을 정적으로 읽는다.)
 */
export type GameActions =
    ReturnType<typeof createGameActions>
    & ReturnType<typeof createCombatActions>
    & ReturnType<typeof createInventoryActions>
    & EngineOwnedActions;
