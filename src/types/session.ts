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
    outcomes: EventOutcome[];
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
    /**
     * 거부된 선택의 이유(Wave 27 N1) — 이벤트가 열린 채 남는 거부에서 리듀서만 쓴다.
     * 이벤트 화면에는 로그(TerminalView)가 마운트되지 않으므로 `getEventChoicePreview`가
     * 누른 선택지의 미리보기 줄로 이 문장을 보여 준다. 이벤트가 닫히면 함께 사라진다.
     * 트랜잭션·한정 조우 검증기는 desc/choices/outcomes만 비교하므로 이 필드는 정본 판정에
     * 들어가지 않는다 — 이벤트 **전체**를 구조 비교하는 체인 핸들러에는 쓰지 말 것.
     */
    choiceFeedback?: EventChoiceFeedback;
}

/** `GameEvent.choiceFeedback` — 거부된 선택지 인덱스와 플레이어에게 보일 문장(MSG). */
export interface EventChoiceFeedback {
    choiceIndex: number;
    text: string;
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

// ---- 이벤트 outcome 정본 (Wave 8: eventActions·eventPresentation의 로컬 사본 2개를 단일화) ----
/** 이벤트 선택지 톤 — eventPresentation의 카드 색/라벨 판정 키. */
export type EventChoiceTone = 'reward' | 'recovery' | 'danger' | 'story' | 'unknown';

/** 체인 이벤트 outcome의 보상 블록 (eventChains.ts의 reward 스키마 합집합). */
export interface EventReward {
    type?: string;
    amount?: number;
    text?: string;
    name?: string;
    atkMult?: number;
    duration?: number;
    atk?: number;
    def?: number;
    hp?: number;
    mp?: number;
    /** 체인 보상 유물 지정자 (eventPresentation이 읽는다). */
    relicId?: string;
    /**
     * `combat_bonus` 전용 — 다음 전투 강화의 이름(`tempBuff.name`)과 로그 앞머리("…이 합류해").
     * 체인마다 다르다(2026-10: 셋 모두 '최후의 영웅 · 기사의 혼령'을 말하던 결함). 없으면 MSG의 일반 문구.
     */
    buffName?: string;
    buffIntro?: string;
}

/** 이벤트 outcome이 실어 보내는 버프 — 신규 배율 스키마와 캠프파이어 스키마 양쪽. */
export interface OutcomeBuff {
    atkMult?: number;
    defMult?: number;
    turns?: number;
    atk?: number;
    def?: number;
    turn?: number;
    name?: string | null;
}

/** 이벤트 outcome 상태이상 지정자. */
export interface OutcomeStatus {
    id?: string;
    turns?: number;
}

/** 이벤트 outcome 유물 보상 지정자. */
export interface OutcomeRelic {
    count?: number;
}

/**
 * 이벤트 카드 1개의 선택 결과(outcome). AI 이벤트·체인·정찰·보스 게이지·구조화 폴백이
 * 같은 배열에 실려 오므로, 각 경로가 읽는 필드를 여기 한 곳에 모아 optional로 선언한다
 * (`currentEvent` 자체는 아직 `GameState['currentEvent']` = any — reducer 핸들러 소유).
 */
export interface EventOutcome {
    choiceIndex?: number;
    /** 구조화 조우(boundedEncounter) 전용 선택 식별자. */
    choiceId?: string;
    type?: string;
    log?: string;
    /** 체인 스텝 데이터(eventChains.ts)는 보상 없는 선택지를 `reward: null`로 표기한다. */
    reward?: EventReward | null;
    gold?: number;
    exp?: number;
    hp?: number;
    mp?: number;
    item?: string;
    buff?: OutcomeBuff;
    status?: OutcomeStatus;
    relic?: OutcomeRelic;
    elite?: boolean;
    /** 모닥불 "휴식" 전용 — 휴식 횟수(업적 "N번 휴식")에 센다(2026-10 Wave 58). */
    rest?: boolean;
    /** 정찰 카드 전용 — 'combat' | 'elite' | 'anomaly' | 'unknown'. */
    scoutEffect?: string;
    /** 정찰 "전투의 기척" 전용 — 처치 보상 배율 가산. */
    rewardBonus?: number;
    /** 보스 게이지 카드 전용 — 'avoid' | (도전). */
    gaugeEffect?: string;
    /** 한정 조우 카드 전용 — 선택지 톤/트레이드오프 문구 (eventPresentation이 읽는다). */
    tradeoff?: string;
    tone?: EventChoiceTone;
}
