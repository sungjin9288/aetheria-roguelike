import type { LeaderboardEntry } from '../../../types/session.js';
import { getTitleLabel } from '../../../utils/gameUtils';
import { MSG } from '../../../data/messages';

interface SystemLeaderboardProps {
    entries: LeaderboardEntry[];
    playerName?: string;
    /** 내 uid — 있으면 내 줄을 uid로 찾는다(같은 이름의 다른 모험가와 섞이지 않는다). */
    uid?: string | null;
}

/**
 * 명예의 전당 목록 — 줄은 구분선, 이름은 말줄임 없이 줄을 넘긴다.
 * 2026-11 E7: 순서는 계승 단계 → 심연 최고 기록 → 회차 최고 레벨이고(`rankScore`), 줄 끝에 그 세 값을 그린다.
 */
const SystemLeaderboard = ({ entries, playerName, uid }: SystemLeaderboardProps) => {
    if (entries.length === 0) {
        return <p className="py-3 text-center font-readable aether-type-meta text-ae-ink-3">{MSG.SYSTEM_LEADERBOARD_EMPTY}</p>;
    }
    return (
        <ol className="ab-rows">
            {entries.map((ranker, index) => {
                const isMe = uid && ranker.uid ? ranker.uid === uid : ranker.nickname === playerName;
                const prestigeRank = ranker.prestigeRank ?? 0;
                const abyssRecord = ranker.abyssRecord ?? 0;
                const bestLevel = ranker.bestLevel ?? ranker.level ?? 1;
                return (
                    <li
                        key={ranker.uid || `${ranker.nickname}-${index}`}
                        data-testid="system-leaderboard-row"
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
                        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right font-readable aether-type-meta text-ae-ink-2">
                            {prestigeRank > 0 && (
                                <span data-testid="system-leaderboard-prestige" className="text-ae-exp">{MSG.SYSTEM_LEADERBOARD_RANK(prestigeRank)}</span>
                            )}
                            {abyssRecord > 0 && (
                                <span data-testid="system-leaderboard-abyss">{MSG.SYSTEM_LEADERBOARD_ABYSS(abyssRecord)}</span>
                            )}
                            <span data-testid="system-leaderboard-best-level" className="font-fira tabular-nums text-ae-ink">
                                {MSG.SYSTEM_LEADERBOARD_BEST_LEVEL(bestLevel)}
                            </span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
};

export default SystemLeaderboard;
