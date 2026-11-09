import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import type { ChapterMoment, ChapterRecap } from './chapterRecap.js';
import { getChapterBand } from './chapters.js';

/**
 * 2026-11 B1 장 결산의 화면 줄(명세 §1.6 · §1.7). 컴포넌트는 이 줄을 그리기만 한다.
 * 지역 이름을 쓰지 않는다 — 장 번호 · 장 이름 · 수 · 처치한 구역 보스 이름뿐이다.
 */
export interface ChapterRecapView {
    chapter: number;
    title: string;
    aria: string;
    chips: string[];
    moments: string[];
    passed: string | null;
}

export interface ExpeditionChapterRecapView {
    cards: ChapterRecapView[];
    /** 칸에 다 담지 못한 결산 수 — 0이면 줄이 없다. */
    more: number;
}

const formatMoment = (moment: ChapterMoment): string => {
    switch (moment.kind) {
        case 'areaBoss': return MSG.CHAPTER_RECAP_MOMENT_AREA_BOSS(moment.names, moment.more);
        case 'story': return MSG.CHAPTER_RECAP_MOMENT_STORY(moment.count);
        case 'job': return MSG.CHAPTER_RECAP_MOMENT_JOB(moment.job);
        case 'signature': return MSG.CHAPTER_RECAP_MOMENT_SIGNATURE(moment.count);
        case 'hunt': return MSG.CHAPTER_RECAP_MOMENT_HUNT(moment.count);
        case 'eliteTitle': return MSG.CHAPTER_RECAP_MOMENT_ELITE_TITLE(moment.count);
        default: return '';
    }
};

export const getChapterRecapView = (recap: ChapterRecap): ChapterRecapView => {
    const name = getChapterBand(recap.chapter)?.name ?? '';
    return {
        chapter: recap.chapter,
        title: MSG.CHAPTER_RECAP_TITLE(recap.chapter, name),
        aria: MSG.CHAPTER_RECAP_ARIA(recap.chapter),
        chips: [
            MSG.CHAPTER_RECAP_LEVEL(recap.levelFrom, recap.levelTo),
            MSG.CHAPTER_RECAP_EXPLORES(recap.explores),
            MSG.CHAPTER_RECAP_KILLS(recap.kills, recap.bossKills),
            ...(recap.relics > 0 ? [MSG.CHAPTER_RECAP_RELICS(recap.relics)] : []),
        ],
        moments: recap.moments.map(formatMoment).filter(Boolean).slice(0, BALANCE.CHAPTER_RECAP_MAX_MOMENTS),
        passed: recap.passed.length > 0 ? MSG.CHAPTER_RECAP_PASSED(recap.passed) : null,
    };
};

/** 원정 정리 시트의 결산 칸 — 최신이 먼저인 결산 목록에서 `CHAPTER_RECAP_MAX_CARDS`칸 + 나머지 수. */
export const getExpeditionChapterRecapView = (recaps: readonly ChapterRecap[]): ExpeditionChapterRecapView => ({
    cards: recaps.slice(0, BALANCE.CHAPTER_RECAP_MAX_CARDS).map(getChapterRecapView),
    more: Math.max(0, recaps.length - BALANCE.CHAPTER_RECAP_MAX_CARDS),
});
