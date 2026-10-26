import { ScrollText } from 'lucide-react';
import { MSG } from '../data/messages.js';
import type { Player } from '../types/index.js';
import { getCycleSummary, getCycleSummaryLines } from '../utils/cycleSummary';

interface AscensionCycleSummaryProps {
    player: Player;
    testIdPrefix: string;
}

/** 2026-10 Wave 100: 계승 · 진 엔딩 화면의 "이번 회차 요약" — 줄은 `getCycleSummaryLines`가 만든다(이 컴포넌트는 그리기만). */
const AscensionCycleSummary = ({ player, testIdPrefix }: AscensionCycleSummaryProps) => {
    const lines = getCycleSummaryLines(getCycleSummary(player));
    if (lines.length === 0) return null;
    return (
        <section
            data-testid={`${testIdPrefix}-cycle-summary`}
            className="ae-well w-full min-w-0 p-3 text-left"
        >
            <h2 className="aether-type-meta flex items-center gap-1.5 font-readable font-bold text-ae-ink">
                <ScrollText size={13} aria-hidden="true" className="shrink-0 text-ae-ether" />
                {MSG.CYCLE_SUMMARY_TITLE}
            </h2>
            <ul className="mt-2 space-y-1.5">
                {lines.map((line) => (
                    <li
                        key={line.id}
                        data-testid={`${testIdPrefix}-cycle-${line.id}`}
                        className={`aether-type-label font-readable leading-relaxed ${line.highlight ? 'font-bold text-ae-ether-hi' : 'text-ae-ink-2'}`}
                    >
                        {line.text}
                    </li>
                ))}
            </ul>
        </section>
    );
};

export default AscensionCycleSummary;
