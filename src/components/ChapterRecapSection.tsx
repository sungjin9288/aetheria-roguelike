import { Flag } from 'lucide-react';
import type { ChapterRecap } from '../utils/chapterRecap.js';
import { getExpeditionChapterRecapView } from '../utils/chapterRecapView.js';
import { MSG } from '../data/messages';
import Chip from './ui/Chip';

interface ChapterRecapSectionProps {
    /** 그 원정 중에 넘은 장의 결산(최신이 먼저). 비어 있으면 아무것도 그리지 않는다. */
    recaps: readonly ChapterRecap[];
    className?: string;
}

/**
 * 2026-11 B1 장 결산 — 원정 정리 시트 맨 위 칸(소유자 결정 Q1 (a)). 새 단추가 없고 확인 기록도 쓰지 않는다.
 * 줄은 `getExpeditionChapterRecapView`가 만들고 여기서는 그리기만 한다.
 */
const ChapterRecapSection = ({ recaps, className = '' }: ChapterRecapSectionProps) => {
    if (recaps.length === 0) return null;
    const view = getExpeditionChapterRecapView(recaps);
    return (
        <div data-testid="debrief-chapter-recap" className={`space-y-2 ${className}`}>
            {view.cards.map((card) => (
                <section
                    key={card.chapter}
                    data-testid="debrief-chapter-recap-card"
                    data-chapter={card.chapter}
                    aria-label={card.aria}
                    className="ae-card is-quiet px-3.5 py-3"
                >
                    <div className="flex items-center gap-1.5 text-ae-gold-text">
                        <Flag size={13} aria-hidden="true" />
                        <span className="ae-eyebrow text-ae-gold-text">{MSG.CHAPTER_RECAP_EYEBROW}</span>
                    </div>
                    <h3 className="mt-1 font-display text-[16px] font-extrabold leading-snug text-ae-ink">{card.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {card.chips.map((chip) => (
                            <Chip key={chip} className="font-fira tabular-nums">{chip}</Chip>
                        ))}
                    </div>
                    {card.moments.length > 0 && (
                        <div className="mt-2.5">
                            <div className="font-readable text-[11px] font-bold text-ae-ink-2">{MSG.CHAPTER_RECAP_MOMENTS_HEADING}</div>
                            <ul className="mt-1 space-y-0.5">
                                {card.moments.map((moment) => (
                                    <li key={moment} className="font-readable text-[13px] leading-[1.45] text-ae-ink">{moment}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {card.passed && (
                        <div data-testid="debrief-chapter-recap-passed" className="mt-2 font-readable text-[12px] text-ae-ink-3">
                            {card.passed}
                        </div>
                    )}
                </section>
            ))}
            {view.more > 0 && (
                <div data-testid="debrief-chapter-recap-more" className="px-1 font-readable text-[12px] text-ae-ink-3">
                    {MSG.CHAPTER_RECAP_MORE(view.more)}
                </div>
            )}
        </div>
    );
};

export default ChapterRecapSection;
