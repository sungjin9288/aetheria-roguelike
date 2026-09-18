/**
 * Session / runtime state domain types (2026-09 Wave 6 X4).
 *
 * `gameReducer.ts`의 `GameState`가 들고 있는 필드 중 도메인(player/item/monster 등)
 * 타입으로 표현되지 않던 나머지 — 로그, 이벤트, 원격 설정, 리더보드 — 를 담는다.
 * 모두 점진 적용 패턴(필드 optional 위주)을 따른다.
 */

import type { ProgressionProfileRef } from './progression.js';

/**
 * 터미널 로그 1건 — `state.logs` 배열의 원소.
 *
 * 생산자는 `reducers/handlers/rewardLog.appendRewardLogs` / `combatHandlers.appendCombatLogs`
 * 와 각 핸들러의 인라인 로그 리터럴이고, 전부 `id`를 함께 채운다(`useGameEngine.addLog`도
 * 동일). `UPDATE_LOG`가 `id`로 기존 항목을 찾아 교체한다.
 */
export interface LogEntry {
    id: string;
    type: string;
    text: string;
}

/**
 * 진행 중인 이벤트(`state.currentEvent`) — AI 생성/오프라인 폴백/내러티브 체인/
 * 한정 조우/정찰 카드가 공유하는 형태.
 *
 * 생산자: `utils/aiEventUtils.EventPackage`(AI/폴백), `utils/scoutEvents.ScoutEvent`(정찰),
 * `utils/boundedEncounterEvent.BoundedEncounterEvent`(한정 조우), `data/eventChains.ts`의
 * 체인 스텝 `event`. 전부 `desc`/`choices`/`outcomes`를 채우므로 여기서는 필수로 두고,
 * 나머지는 생산자별 전용 필드라 optional이다. `outcomes`의 원소 모양은 생산자마다 달라
 * (체인 gold 보상 / 한정 조우 tone / 정찰 scoutEffect) `unknown[]`로 둔다 — 각 핸들러가
 * 자기 생산자의 outcome 모양만 좁혀 읽는다.
 */
export interface GameEvent {
    desc: string;
    choices: string[];
    outcomes: unknown[];
    title?: string;
    /** AI/오프라인 폴백 이벤트 전용 — 'ai' 또는 폴백 소스 이름. */
    source?: string;
    fallbackTransactionId?: string;
    fallbackReason?: string;
    /** 한정 조우(boundedEncounters) 전용. */
    isBoundedEncounter?: boolean;
    boundedEncounterId?: string;
    boundedOccurrenceSequence?: number;
    /** 정찰 카드 전용. */
    isScout?: boolean;
    /** 원정 보스 게이지 조우 전용. */
    isBossGaugeChallenge?: boolean;
    /** 내러티브 이벤트 체인 전용 — 진행 중인 체인 id/스텝. */
    _chainId?: string;
    _chainStep?: number;
}

/**
 * 원격 설정(`state.liveConfig`) — `artifacts/{APP_ID}/public/data` 문서를 그대로 반영.
 * 관리자(SystemTab)가 갱신하고, `CombatEngine.handleVictory`가 배율로 읽는다.
 */
export interface LiveConfig {
    eventMultiplier?: number;
    progressionProfile?: ProgressionProfileRef;
    announcement?: string;
    seasonEvent?: {
        active?: boolean;
        name?: string;
        /** Firestore Timestamp | 문자열 | 숫자 — 표시 시점에 `toDate?.()`로 정규화된다. */
        endsAt?: unknown;
        goldMultiplier?: number;
        xpMultiplier?: number;
        bonusMap?: string;
    } | null;
}

/**
 * 명예의 전당 순위 1건(`state.leaderboard`) — `createCloudAutosave`가 Firestore
 * `leaderboard` 컬렉션에 쓰는 문서 형태를 그대로 반영한다.
 */
export interface LeaderboardEntry {
    nickname?: string;
    totalKills?: number;
    prestigeRank?: number;
    activeTitle?: string | null;
    level?: number;
    bossKills?: number;
    job?: string;
    uid?: string;
    /** Firestore `serverTimestamp()` — 표시에 쓰이지 않는다. */
    updatedAt?: unknown;
}
