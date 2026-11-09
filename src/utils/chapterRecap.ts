import { BALANCE, CONSTANTS } from '../data/constants.js';
import { MAPS } from '../data/maps.js';
import { MAIN_STORY_QUEST_IDS } from '../data/storyChapters.js';
import type { Player } from '../types/player.js';
import { getChapterOf } from './chapters.js';
import { ELITE_TITLE_PREFIX } from './eliteTitles.js';
import { getDiscoveredSignatureNames } from './signatureDiscovery.js';

/**
 * 2026-11 B1 장 결산 (소유자 결정 2026-11-09 — 명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §1):
 * 장은 사냥 지역을 경로 게이트로 묶은 것이다(`utils/chapters.ts`). 이번 여정에서 더 높은 장의 지역에 들어서는 순간(넘음),
 * 떠나는 장의 결산을 그 순간의 값으로 굳혀 `stats.currentRun.chapters.recaps`에 붙인다.
 *
 * - 쓰는 곳은 이동(`moveActions.move`의 `SET_PLAYER` payload → `advanceChapterOnEntry`) 하나다. 생성(`createChapterProgress`)은
 *   새 여정을 만드는 `createCurrentRunProgress`가, 정규화(`readChapterProgress`)는 `normalizeCurrentRunProgress`가 부른다.
 * - 난수 · 기록 줄 · 디스패치를 쓰지 않는다(자연 플레이 바이트 동일).
 * - 여정 범위다 — `currentRun` 안이라 사망 · 계승 · 다시 시작이 새 여정과 함께 1장부터 다시 찍는다.
 */
export type ChapterMoment =
    | { kind: 'areaBoss'; names: string[]; more: number }
    | { kind: 'story'; count: number }
    | { kind: 'job'; job: string }
    | { kind: 'signature'; count: number }
    | { kind: 'hunt'; count: number }
    | { kind: 'eliteTitle'; count: number };

export interface ChapterMarkCounters {
    kills: number;
    bossKills: number;
    explores: number;
    relicCount: number;
}

/** 지금 장에 들어선 순간의 값 — 다음 넘음이 이 값과의 차이로 결산을 만든다. */
export interface ChapterMark {
    level: number;
    job: string;
    counters: ChapterMarkCounters;
    signatures: number;
    storyClaimed: number;
    areaBosses: string[];
    huntRounds: number;
    eliteTitles: number;
    /** 탐험 없이 지나쳐 결산을 만들지 않은 장(다음 결산이 한 줄로 말한다). */
    passed: number[];
}

export interface ChapterRecap {
    /** 떠난 장. */
    chapter: number;
    passed: number[];
    /** 넘은 순간의 원정 id — 원정 정리 시트가 이 값으로 고른다. 원정 밖이면 null. */
    expeditionId: string | null;
    levelFrom: number;
    levelTo: number;
    explores: number;
    kills: number;
    bossKills: number;
    relics: number;
    moments: ChapterMoment[];
}

export interface ChapterProgress {
    /** 이번 여정에서 들어선 가장 높은 장(내려가지 않는다). */
    reached: number;
    mark: ChapterMark;
    recaps: ChapterRecap[];
}

type ChapterSource = Pick<Player, 'stats'> & Partial<Pick<Player, 'loc' | 'level' | 'job' | 'titles' | 'huntContracts' | 'meta' | 'classJourney' | 'activeExpedition'>>;

const toCount = (value: unknown): number => (Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0);

const isRecord = (value: unknown): value is Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
);

const readStrings = (value: unknown): string[] => (
    Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))] : []
);

const readChapterNumbers = (value: unknown): number[] => (
    Array.isArray(value)
        ? [...new Set(value.filter((entry): entry is number => Number.isInteger(entry) && entry >= 1))]
        : []
);

/** 지역의 `boss`(구역 보스) 이름 집합 — `areaBossDefeated`는 처치한 보스 종 전부를 들고 있어 구역 보스만 고른다. */
let areaBossNames: ReadonlySet<string> | null = null;
const getAreaBossNames = (): ReadonlySet<string> => {
    if (!areaBossNames) {
        areaBossNames = new Set(Object.values(MAPS)
            .map((map) => map?.boss)
            .filter((boss): boss is string => typeof boss === 'string' && boss.length > 0));
    }
    return areaBossNames;
};

const getDefeatedAreaBosses = (stats: Player['stats']): string[] => {
    const defeated = stats?.areaBossDefeated;
    if (!isRecord(defeated)) return [];
    const known = getAreaBossNames();
    return Object.entries(defeated).filter(([name, cleared]) => cleared === true && known.has(name)).map(([name]) => name);
};

const countStoryClaimed = (stats: Player['stats']): number => (
    new Set((stats?.claimedQuestIds || []).map(Number).filter((id) => MAIN_STORY_QUEST_IDS.has(id))).size
);

/** 완수한 토벌 의뢰 차수의 합 — 우두머리 처치 한 번이 한 차수다(완수면 그 차수까지, 아니면 이전 차수까지). */
export const countCompletedHuntRounds = (huntContracts: Player['huntContracts']): number => {
    if (!isRecord(huntContracts)) return 0;
    return Object.values(huntContracts).reduce<number>((sum, progress) => {
        if (!isRecord(progress)) return sum;
        const round = Math.max(1, toCount(progress.round) || 1);
        const done = toCount(progress.stage) >= 3;
        return sum + (done ? round : round - 1);
    }, 0);
};

const countEliteTitles = (titles: unknown): number => readStrings(titles).filter((title) => title.startsWith(ELITE_TITLE_PREFIX)).length;

const countSignatures = (source: ChapterSource): number => getDiscoveredSignatureNames(source as Player).length;

const snapshotMark = (source: ChapterSource, passed: number[] = []): ChapterMark => {
    const stats = source.stats || {};
    return {
        level: Math.max(1, toCount(source.level) || 1),
        job: typeof source.job === 'string' && source.job ? source.job : CONSTANTS.DEFAULT_JOB,
        counters: {
            kills: toCount(stats.kills),
            bossKills: toCount(stats.bossKills),
            explores: toCount(stats.explores),
            relicCount: toCount(stats.relicCount),
        },
        signatures: countSignatures(source),
        storyClaimed: countStoryClaimed(stats),
        areaBosses: getDefeatedAreaBosses(stats),
        huntRounds: countCompletedHuntRounds(source.huntContracts),
        eliteTitles: countEliteTitles(source.titles),
        passed,
    };
};

/**
 * 새 여정의 장 진행 — 1장, 지금 값(새 여정은 Lv1 · 시작 직업 · 구역 보스 · 의뢰 · 정예 칭호 0)의 표식, 결산 없음.
 * `createCurrentRunProgress`가 부른다(stats만 받는 자리라 레벨 · 직업 · 칭호 · 의뢰는 새 여정의 시작 값이다).
 */
export const createChapterProgress = (stats: Player['stats'] = {}): ChapterProgress => ({
    reached: 1,
    mark: snapshotMark({ stats: { ...stats, areaBossDefeated: {} } }),
    recaps: [],
});

const readMoment = (value: unknown): ChapterMoment | null => {
    if (!isRecord(value)) return null;
    switch (value.kind) {
        case 'areaBoss': {
            const names = readStrings(value.names);
            return names.length > 0 ? { kind: 'areaBoss', names, more: toCount(value.more) } : null;
        }
        case 'job':
            return typeof value.job === 'string' && value.job ? { kind: 'job', job: value.job } : null;
        case 'story':
        case 'signature':
        case 'hunt':
        case 'eliteTitle': {
            const count = toCount(value.count);
            return count > 0 ? { kind: value.kind, count } : null;
        }
        default:
            return null;
    }
};

const readMark = (value: unknown): ChapterMark | null => {
    if (!isRecord(value)) return null;
    const counters = isRecord(value.counters) ? value.counters : {};
    return {
        level: Math.max(1, toCount(value.level) || 1),
        job: typeof value.job === 'string' && value.job ? value.job : CONSTANTS.DEFAULT_JOB,
        counters: {
            kills: toCount(counters.kills),
            bossKills: toCount(counters.bossKills),
            explores: toCount(counters.explores),
            relicCount: toCount(counters.relicCount),
        },
        signatures: toCount(value.signatures),
        storyClaimed: toCount(value.storyClaimed),
        areaBosses: readStrings(value.areaBosses),
        huntRounds: toCount(value.huntRounds),
        eliteTitles: toCount(value.eliteTitles),
        passed: readChapterNumbers(value.passed),
    };
};

const readRecap = (value: unknown): ChapterRecap | null => {
    if (!isRecord(value) || !Number.isInteger(value.chapter) || Number(value.chapter) < 1) return null;
    return {
        chapter: Number(value.chapter),
        passed: readChapterNumbers(value.passed),
        expeditionId: typeof value.expeditionId === 'string' && value.expeditionId ? value.expeditionId : null,
        levelFrom: Math.max(1, toCount(value.levelFrom) || 1),
        levelTo: Math.max(1, toCount(value.levelTo) || 1),
        explores: toCount(value.explores),
        kills: toCount(value.kills),
        bossKills: toCount(value.bossKills),
        relics: toCount(value.relics),
        moments: Array.isArray(value.moments)
            ? value.moments.map(readMoment).filter((moment): moment is ChapterMoment => moment !== null)
            : [],
    };
};

/** 저장된 장 진행을 다시 짓는다(불러오기 경계). 모양이 깨졌으면 null — 이전 세이브처럼 첫 이동에서 조용히 시작한다. */
export const readChapterProgress = (value: unknown): ChapterProgress | null => {
    if (!isRecord(value) || !Number.isInteger(value.reached) || Number(value.reached) < 1) return null;
    const mark = readMark(value.mark);
    if (!mark) return null;
    return {
        reached: Number(value.reached),
        mark,
        recaps: Array.isArray(value.recaps)
            ? value.recaps.map(readRecap).filter((recap): recap is ChapterRecap => recap !== null)
            : [],
    };
};

const buildMoments = (source: ChapterSource, mark: ChapterMark): ChapterMoment[] => {
    const stats = source.stats || {};
    const markedBosses = new Set(mark.areaBosses);
    const newBosses = getDefeatedAreaBosses(stats).filter((name) => !markedBosses.has(name));
    const limit = BALANCE.CHAPTER_RECAP_AREA_BOSS_NAMES;
    const job = typeof source.job === 'string' && source.job ? source.job : mark.job;
    const candidates: Array<ChapterMoment | null> = [
        newBosses.length > 0 ? { kind: 'areaBoss', names: newBosses.slice(0, limit), more: Math.max(0, newBosses.length - limit) } : null,
        { kind: 'story', count: Math.max(0, countStoryClaimed(stats) - mark.storyClaimed) },
        job !== mark.job ? { kind: 'job', job } : null,
        { kind: 'signature', count: Math.max(0, countSignatures(source) - mark.signatures) },
        { kind: 'hunt', count: Math.max(0, countCompletedHuntRounds(source.huntContracts) - mark.huntRounds) },
        { kind: 'eliteTitle', count: Math.max(0, countEliteTitles(source.titles) - mark.eliteTitles) },
    ];
    return candidates
        .filter((moment): moment is ChapterMoment => moment !== null && ('count' in moment ? moment.count > 0 : true))
        .slice(0, BALANCE.CHAPTER_RECAP_MAX_MOMENTS);
};

const buildRecap = (source: ChapterSource, progress: ChapterProgress): ChapterRecap => {
    const stats = source.stats || {};
    const { mark } = progress;
    const expeditionId = source.activeExpedition?.id;
    return {
        chapter: progress.reached,
        passed: mark.passed,
        expeditionId: typeof expeditionId === 'string' && expeditionId ? expeditionId : null,
        levelFrom: mark.level,
        levelTo: Math.max(1, toCount(source.level) || 1),
        explores: Math.max(0, toCount(stats.explores) - mark.counters.explores),
        kills: Math.max(0, toCount(stats.kills) - mark.counters.kills),
        bossKills: Math.max(0, toCount(stats.bossKills) - mark.counters.bossKills),
        relics: Math.max(0, toCount(stats.relicCount) - mark.counters.relicCount),
        moments: buildMoments(source, mark),
    };
};

const withChapters = <P extends Pick<Player, 'stats'>>(player: P, chapters: ChapterProgress): P => ({
    ...player,
    stats: {
        ...(player.stats || {}),
        currentRun: { ...(player.stats?.currentRun as NonNullable<NonNullable<Player['stats']>['currentRun']>), chapters },
    },
});

/**
 * 이동 한 번의 장 넘음(순수 함수). `player.loc`은 아직 떠나는 자리이고 `loc`이 도착지다.
 * 도착지가 장 지역이 아니거나 지금 장 이하면 그대로 돌려준다(같은 참조). 여정 기록(`currentRun`)이 없으면 아무것도 하지 않는다.
 */
export const advanceChapterOnEntry = <P extends ChapterSource>(player: P, loc: string): P => {
    const destination = getChapterOf(loc);
    const currentRun = player.stats?.currentRun;
    if (destination === null || !isRecord(currentRun)) return player;
    const progress = readChapterProgress(currentRun.chapters);

    if (!progress) {
        // 이전 세이브: 기준점이 없으니 결산을 지어내지 않는다 — 지금 값으로 조용히 시작한다.
        const reached = Math.max(getChapterOf(player.loc) ?? 1, destination);
        return withChapters(player, { reached, mark: snapshotMark(player), recaps: [] });
    }
    if (destination <= progress.reached) return player;

    const explores = Math.max(0, toCount(player.stats?.explores) - progress.mark.counters.explores);
    if (explores < BALANCE.CHAPTER_RECAP_MIN_EXPLORES) {
        // 지나친 장: 결산을 만들지 않고 표식을 그대로 둔 채 그 장을 접는다.
        return withChapters(player, {
            ...progress,
            reached: destination,
            mark: { ...progress.mark, passed: [...new Set([...progress.mark.passed, progress.reached])] },
        });
    }
    return withChapters(player, {
        reached: destination,
        mark: snapshotMark(player),
        recaps: [...progress.recaps, buildRecap(player, progress)],
    });
};

/** 이번 여정의 결산(넘은 순서). */
export const getChapterRecaps = (player: Pick<Player, 'stats'> | null | undefined): ChapterRecap[] => (
    readChapterProgress(player?.stats?.currentRun?.chapters)?.recaps ?? []
);

/** 원정 정리 시트가 그리는 결산 — 그 원정 중에 넘은 것, 최신이 먼저. */
export const getExpeditionChapterRecaps = (
    player: Pick<Player, 'stats'> | null | undefined,
    expeditionId: string | null | undefined,
): ChapterRecap[] => (
    expeditionId ? getChapterRecaps(player).filter((recap) => recap.expeditionId === expeditionId).reverse() : []
);
