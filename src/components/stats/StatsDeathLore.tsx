import { useMemo } from 'react';
import { ChevronDown, Landmark } from 'lucide-react';
import type { Player } from '../../types/index.js';
import { DEATH_LORE_TOTAL, getHeardDeathLore } from '../../utils/deathLore.js';
import { MSG } from '../../data/messages';

interface StatsDeathLoreProps {
    player?: Player | null;
}

/**
 * 2026-11 B6 P1 능력치 탭 '돌기둥의 증언 N/46'(명세 §2.5): 첫 증언을 들은 뒤에만 생긴다(발견 원칙).
 * 들은 순서로 문장만 그린다 — 듣지 않은 줄의 자리 · 장소 · 조건은 그리지 않는다.
 * 사망 세이브를 다시 불러오면 그 사망의 증언은 여기서만 다시 읽을 수 있다.
 */
const StatsDeathLore = ({ player }: StatsDeathLoreProps) => {
    const heard = useMemo(() => getHeardDeathLore(player?.stats?.deathLore), [player?.stats?.deathLore]);
    if (heard.length === 0) return null;
    return (
        <details data-testid="stats-death-lore" className="group">
            <summary
                aria-label={MSG.DEATH_LORE_ARIA(heard.length, DEATH_LORE_TOTAL)}
                className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 font-readable [&::-webkit-details-marker]:hidden"
            >
                <Landmark size={14} aria-hidden="true" className="text-ae-ether" />
                <span className="flex-1 text-[13px] font-bold text-ae-ink">{MSG.STATS_DEATH_LORE_HEADING}</span>
                <span data-testid="stats-death-lore-count" className="font-fira text-[12px] tabular-nums text-ae-ink-3">
                    {MSG.DEATH_LORE_COUNT(heard.length, DEATH_LORE_TOTAL)}
                </span>
                <ChevronDown size={16} aria-hidden="true" className="text-ae-ink-3 transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <ol className="ae-rows pb-3">
                {heard.map((line) => (
                    <li
                        key={line.id}
                        data-testid="stats-death-lore-line"
                        className="py-2 font-readable text-[13px] leading-[1.5] text-ae-ink"
                    >
                        {line.text}
                    </li>
                ))}
            </ol>
        </details>
    );
};

export default StatsDeathLore;
