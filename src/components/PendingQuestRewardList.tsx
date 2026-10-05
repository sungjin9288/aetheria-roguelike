import type { QuestReward } from '../types/index.js';
import type { getClaimableQuestEntries } from '../utils/questProgress';
import { getGoldIncome, type ChallengeHolder } from '../utils/challengeRules';

interface PendingQuestRewardListProps {
    entries: ReturnType<typeof getClaimableQuestEntries>;
    testIdPrefix: 'ascension' | 'true-ending';
    onClaim?: (questId: string | number) => void;
    /** 받을 플레이어 — 골드는 실제로 받는 금액이다('빈손의 시작'이면 절반, 2026-10 Wave 62). */
    player: ChallengeHolder;
}

const formatQuestReward = (reward: QuestReward | undefined, player: ChallengeHolder) => {
    const parts = [
        Number(reward?.exp) > 0 ? `경험치 ${Number(reward?.exp).toLocaleString()}` : null,
        Number(reward?.gold) > 0 ? `골드 ${getGoldIncome(player, Number(reward?.gold)).toLocaleString()}` : null,
        typeof reward?.item === 'string' && reward.item.trim() ? reward.item : null,
        typeof reward?.title === 'string' && reward.title.trim() ? `칭호 ${reward.title}` : null,
    ].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? `기본 보상 · ${parts.join(' · ')}` : '보상 확인';
};

const PendingQuestRewardList = ({ entries, testIdPrefix, onClaim, player }: PendingQuestRewardListProps) => (
    <div className="flex min-w-0 flex-col gap-2">
        {entries.map((entry) => (
            <div
                key={String(entry.id)}
                data-testid={`${testIdPrefix}-pending-quest-${String(entry.id)}`}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-black/25 p-3"
            >
                <div className="min-w-0 flex-1">
                    <p className="break-words text-[12px] font-readable font-bold text-slate-100">
                        {entry.quest?.title || `임무 ${String(entry.id)}`}
                    </p>
                    <p className="mt-1 break-words text-[11px] font-readable text-slate-400">
                        {formatQuestReward(entry.quest?.reward, player)}
                    </p>
                </div>
                <button
                    type="button"
                    data-testid={`${testIdPrefix}-claim-quest-${String(entry.id)}`}
                    aria-label={`${entry.quest?.title || `임무 ${String(entry.id)}`} 보상 받기`}
                    onClick={() => onClaim?.(entry.id)}
                    className="min-h-[48px] shrink-0 rounded-lg border border-emerald-300/35 bg-emerald-300/16 px-3 py-2 text-[11px] font-readable font-bold text-emerald-100 transition-colors hover:bg-emerald-300/24"
                >
                    보상 받기
                </button>
            </div>
        ))}
    </div>
);

export default PendingQuestRewardList;
