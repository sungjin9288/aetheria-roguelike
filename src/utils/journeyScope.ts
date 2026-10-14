import type { AchievementTarget } from '../types/quest.js';
import type { Player } from '../types/player.js';
import { MSG } from '../data/messages.js';
import { ELITE_TITLE_PREFIX } from './eliteTitles.js';

/**
 * 2026-10 Wave 108 (소유자 결정 "죽으면 모든 게 초기화 — 정수로 올린 것만 남는다 · 계승은 도감을 남긴다"):
 * 사망 · 계승에서 무엇이 남는지는 이 표 하나가 정한다.
 *
 * - `journey` — 이번 여정의 진행. 사망 · 계승 모두 초기화한다(임무 · 이야기 · 체인 · 칭호 · 업적의 진행).
 * - `codex` — 도감(수집 · 발견). 사망은 초기화, 계승은 유지한다.
 * - `account` — 계정 장부(계승 단계 · 회차 규칙 · 사망 수 · 마왕 처치 · 심연 기록 · 시즌 · 크리스털로 산 것).
 *   초기화하지 않는다. 이 값을 읽는 업적은 지우면 곧바로 다시 달성되어 죽을 때마다 같은 보상을 받게 되므로
 *   수령 기록도 남긴다.
 *
 * 누적 카운터(처치 · 탐험 · 누적 골드 …)는 평생 기록으로 남는다 — 통계 화면 · 난수 씨앗(행상인 · 의뢰 보상) ·
 * 첫 출발 안내가 읽는다. 여정 범위 진행(업적 · 칭호 · 임무)은 `getJourneyCounter`로 여정 시작 기준점
 * (`stats.currentRun`, 사망 · 계승 · 다시 시작이 새로 찍는다)과의 차이를 읽는다.
 */
export type ResetScope = 'journey' | 'codex' | 'account';
export type JourneyResetKind = 'death' | 'ascension';

export const isScopeKeptOn = (scope: ResetScope, kind: JourneyResetKind): boolean => (
    scope === 'account' || (scope === 'codex' && kind === 'ascension')
);

/** 업적 목표 → 초기화 범위. 새 목표는 여기에 분류해야 컴파일된다. */
export const ACHIEVEMENT_TARGET_SCOPE: Readonly<Record<AchievementTarget, ResetScope>> = Object.freeze({
    abyssRecord: 'account',
    bossKills: 'journey',
    bountiesCompleted: 'journey',
    crafts: 'journey',
    deaths: 'account',
    demonKingSlain: 'account',
    discoveries: 'codex',
    discoveryChains: 'codex',
    escapes: 'journey',
    explores: 'journey',
    kills: 'journey',
    level: 'journey',
    maxKillStreak: 'journey',
    prestige: 'account',
    relicCount: 'journey',
    rests: 'journey',
    signatureSetsCompleted: 'codex',
    signaturesDiscovered: 'codex',
    synths: 'journey',
    total_gold: 'journey',
});

/** 칭호 조건(`TITLES[*].cond.type`) — 데이터가 문자열로 추론되므로 여기서 닫는다(계약이 데이터 전수를 대조한다). */
export type TitleCondType =
    | 'abyssFloor'
    | 'abyssRecord'
    | 'bossKills'
    | 'bountyDone'
    | 'cosmetic'
    | 'crafts'
    | 'deaths'
    | 'demonKingSlain'
    | 'discoveries'
    | 'discoveryChains'
    | 'escapes'
    | 'explores'
    | 'kills'
    | 'level'
    | 'maxKillStreak'
    | 'noDeathWin'
    | 'prestige'
    | 'prestigeRank'
    | 'questReward'
    | 'relicCount'
    | 'rests'
    | 'ruleConquest'
    | 'seasonTier'
    | 'signatureSetsCompleted'
    | 'signaturesDiscovered'
    | 'synths'
    | 'total_gold';

/**
 * 칭호 조건 → 초기화 범위. 크리스털로 산 칭호(`cosmetic`)는 계정 장부다.
 * `noDeathWin`(죽지 않고 마왕 처치)은 사망 수 · 마왕 처치가 모두 계정 장부라 계정이다.
 */
export const TITLE_COND_SCOPE: Readonly<Record<TitleCondType, ResetScope>> = Object.freeze({
    abyssFloor: 'account',
    abyssRecord: 'account',
    bossKills: 'journey',
    bountyDone: 'journey',
    cosmetic: 'account',
    crafts: 'journey',
    deaths: 'account',
    demonKingSlain: 'account',
    discoveries: 'codex',
    discoveryChains: 'codex',
    escapes: 'journey',
    explores: 'journey',
    kills: 'journey',
    level: 'journey',
    maxKillStreak: 'journey',
    noDeathWin: 'account',
    prestige: 'account',
    prestigeRank: 'account',
    questReward: 'journey',
    relicCount: 'journey',
    rests: 'journey',
    ruleConquest: 'account',
    seasonTier: 'account',
    signatureSetsCompleted: 'codex',
    signaturesDiscovered: 'codex',
    synths: 'journey',
    total_gold: 'journey',
});

export const isTitleCondType = (value: unknown): value is TitleCondType => (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(TITLE_COND_SCOPE, value)
);

/** 칭호 id의 초기화 범위 — 정예 목격 칭호와 표에 없는 칭호(이야기 보상 등)는 여정 범위다. */
export const getTitleScope = (titleId: string, condTypeById: ReadonlyMap<string, string>): ResetScope => {
    if (titleId.startsWith(ELITE_TITLE_PREFIX)) return 'journey';
    const type = condTypeById.get(titleId);
    return isTitleCondType(type) ? TITLE_COND_SCOPE[type] : 'journey';
};

/** 여정 기준점과의 차이로 읽는 누적 카운터. */
export type JourneyCounterKey =
    | 'kills'
    | 'bossKills'
    | 'total_gold'
    | 'escapes'
    | 'explores'
    | 'rests'
    | 'crafts'
    | 'syntheses'
    | 'relicCount'
    | 'bountiesCompleted';

const toCount = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

/**
 * 이번 여정에서 쌓인 양. 기준점이 없는 이전 세이브는 0을 기준으로 읽는다(평생 값 그대로 — 다음 사망 · 계승부터
 * 기준점이 생긴다).
 */
export const getJourneyCounter = (stats: Player['stats'] | null | undefined, key: JourneyCounterKey): number => {
    const lifetime = toCount(stats?.[key]);
    const base = stats?.currentRun?.countersAtStart?.[key];
    return Math.max(0, lifetime - toCount(base));
};

/** 이번 여정의 최대 연속 처치(`currentRun.maxKillStreak`). 기준점이 없는 이전 세이브는 평생 값을 읽는다. */
export const getJourneyMaxKillStreak = (stats: Player['stats'] | null | undefined): number => {
    const run = stats?.currentRun;
    if (run && typeof run === 'object' && run.countersAtStart) return toCount(run.maxKillStreak);
    return toCount(stats?.maxKillStreak);
};

/**
 * 2026-10 Wave 109: 사망 · 다시 시작 · 계승 화면이 "남는 것 / 새로 시작하는 것"으로 말하는 항목.
 * 화면은 이 표의 라벨(`MSG.JOURNEY_ITEM_LABELS`)만 그리고, `tests/journey-surface-copy-contract.test.js`가 항목마다
 * 실제 전이(`handleDefeat` · `RESET_GAME` · `ASCEND`)로 그 약속을 확인한다 — Wave 108 뒤에도 사망 화면이
 * "칭호 · 도감 기록은 다음 모험에도 이어집니다"라고 말하던 것처럼 문구가 규칙과 갈라지지 않게.
 */
export type JourneySurfaceItem =
    | 'essenceGrowth'
    | 'prestigeLedger'
    | 'classJourney'
    | 'settings'
    | 'seasonPass'
    | 'crystals'
    | 'codex'
    | 'unrecoveredGraves'
    | 'level'
    | 'gear'
    | 'relics'
    | 'questsStory'
    | 'journeyTitles'
    | 'activeExpedition';

export interface JourneySurface {
    readonly kept: readonly JourneySurfaceItem[];
    readonly reset: readonly JourneySurfaceItem[];
}

const DEATH_SURFACE: JourneySurface = {
    kept: ['essenceGrowth', 'prestigeLedger', 'classJourney', 'seasonPass', 'crystals', 'settings'],
    reset: ['level', 'gear', 'relics', 'questsStory', 'journeyTitles', 'codex', 'activeExpedition'],
};
const ASCENSION_SURFACE: JourneySurface = {
    kept: ['essenceGrowth', 'prestigeLedger', 'codex', 'classJourney', 'seasonPass', 'crystals', 'settings', 'unrecoveredGraves'],
    reset: ['level', 'gear', 'relics', 'questsStory', 'journeyTitles', 'activeExpedition'],
};

export const JOURNEY_RESET_SURFACE: Readonly<Record<JourneyResetKind, JourneySurface>> = Object.freeze({
    death: DEATH_SURFACE,
    ascension: ASCENSION_SURFACE,
});

export const getJourneySurfaceText = (kind: JourneyResetKind, side: keyof JourneySurface): string => (
    JOURNEY_RESET_SURFACE[kind][side].map((item) => MSG.JOURNEY_ITEM_LABELS[item]).join(' · ')
);
