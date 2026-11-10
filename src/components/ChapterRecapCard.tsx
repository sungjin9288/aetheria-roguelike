import { Flag } from 'lucide-react';
import type { ChapterRecapView } from '../utils/chapterRecapView.js';
import { MSG } from '../data/messages';
import Chip from './ui/Chip';

interface ChapterRecapCardProps {
    card: ChapterRecapView;
    /** 원정 정리 시트(`debrief-chapter-recap`)와 능력치 탭(`stats-chapter-recap`)이 같은 칸을 다른 이름으로 그린다. */
    testIdPrefix: string;
}

/**
 * 2026-11 B1 장 결산 한 칸 — 원정 정리 시트와 능력치 탭 '이번 여정의 장'이 같이 그린다.
 * 줄은 `getChapterRecapView`가 만들고 여기서는 그리기만 한다.
 */
const ChapterRecapCard = ({ card, testIdPrefix }: ChapterRecapCardProps) => (
    <section
        data-testid={`${testIdPrefix}-card`}
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
            <div data-testid={`${testIdPrefix}-passed`} className="mt-2 font-readable text-[12px] text-ae-ink-3">
                {card.passed}
            </div>
        )}
    </section>
);

export default ChapterRecapCard;
