import { Skull } from 'lucide-react';
import type { LeaderboardEntry } from '../../../types/session.js';
import { getTitleLabel } from '../../../utils/gameUtils';
import { MSG } from '../../../data/messages';

interface SystemLeaderboardProps {
    entries: LeaderboardEntry[];
    playerName?: string;
}

/** 명예의 전당 목록 — 줄은 구분선, 이름은 말줄임 없이 줄을 넘긴다. */
const SystemLeaderboard = ({ entries, playerName }: SystemLeaderboardProps) => {
    if (entries.length === 0) {
        return <p className="py-3 text-center font-readable aether-type-meta text-ae-ink-3">{MSG.SYSTEM_LEADERBOARD_EMPTY}</p>;
    }
    return (
        <ol className="ab-rows">
            {entries.map((ranker, index) => {
                const isMe = ranker.nickname === playerName;
                return (
                    <li
                        key={`${ranker.nickname}-${index}`}
                        className={`flex min-h-11 items-center gap-3 px-1 py-2 ${isMe ? 'rounded-ae-xs bg-ae-ether/10' : ''}`}
                    >
                        <span className={`w-6 shrink-0 text-center font-fira tabular-nums aether-type-body font-bold ${index < 3 ? 'text-ae-gold-text' : 'text-ae-ink-3'}`}>
                            {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 font-readable aether-type-body text-ae-ink">
                            {ranker.nickname}
                            {ranker.activeTitle && <span className="ml-1 text-ae-ink-2">[{getTitleLabel(ranker.activeTitle)}]</span>}
                            {isMe && <span className="ml-1 font-bold text-ae-ether-hi">{MSG.SYSTEM_LEADERBOARD_ME}</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-readable aether-type-meta text-ae-ink-2">
                            {(ranker.prestigeRank ?? 0) > 0 && (
                                <span className="text-ae-exp">{MSG.SYSTEM_LEADERBOARD_RANK(ranker.prestigeRank ?? 0)}</span>
                            )}
                            <Skull size={13} aria-hidden="true" className="text-ae-ink-3" />
                            <span className="font-fira tabular-nums text-ae-ink">{(ranker.totalKills || 0).toLocaleString('ko-KR')}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
};

export default SystemLeaderboard;
