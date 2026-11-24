import { Trophy } from 'lucide-react';
import { MSG } from '../data/messages';

interface LeaderboardRankLineProps {
    /** 명예의 전당 순위(1부터) — 없으면(오프라인 · 읽기 전 · 순위표 밖) 아무것도 그리지 않는다. */
    rank: number | null;
    testId: string;
    className?: string;
}

/** 사망 · 계승 화면의 "내 순위" 한 줄(2026-11 E7) — 순위만 말하고 권하지 않는다. 말줄임 없이 줄을 넘긴다. */
const LeaderboardRankLine = ({ rank, testId, className = '' }: LeaderboardRankLineProps) => {
    if (rank === null || !Number.isFinite(rank) || rank < 1) return null;
    return (
        <div data-testid={testId} className={`flex items-center gap-1.5 font-readable text-[11px] text-ae-ink-2 ${className}`}>
            <Trophy size={12} className="shrink-0 text-ae-gold" aria-hidden="true" />
            <span className="min-w-0 break-keep font-semibold">{MSG.LEADERBOARD_MY_RANK(Math.floor(rank))}</span>
        </div>
    );
};

export default LeaderboardRankLine;
