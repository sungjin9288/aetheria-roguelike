import type { QuestReward } from '../types/index.js';
import type { getClaimableQuestEntries } from '../utils/questProgress';
import { getGoldIncome, type ChallengeHolder } from '../utils/challengeRules';
import ActionButton from './ui/ActionButton';

interface PendingQuestRewardListProps {
    entries: ReturnType<typeof getClaimableQuestEntries>;
    testIdPrefix: 'ascension' | 'true-ending';
    onClaim?: (questId: string | number) => void;
    /** 받을 플레이어 — 골드는 실제로 받는 금액이다('빈손의 시작'이면 절반, 2026-10 Wave 62). */
    player: ChallengeHolder;
}

const formatQuestReward = (reward: QuestReward | undefined, player: ChallengeHolder) => {
    const parts = [
        Number(reward?.exp) > 0 ? `경험 ${Number(reward?.exp).toLocaleString()}` : null,
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
                className="ae-well flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 p-3"
            >
                <div className="min-w-0 flex-1">
                    <p className="aether-type-meta break-words font-readable font-bold text-ae-ink">
                        {entry.quest?.title || `임무 ${String(entry.id)}`}
                    </p>
                    <p className="aether-type-label mt-1 break-words font-readable text-ae-ink-2">
                        {formatQuestReward(entry.quest?.reward, player)}
                    </p>
                </div>
                <ActionButton
                    variant="glass"
                    data-testid={`${testIdPrefix}-claim-quest-${String(entry.id)}`}
                    aria-label={`${entry.quest?.title || `임무 ${String(entry.id)}`} 보상 받기`}
                    onClick={() => onClaim?.(entry.id)}
                    label="보상 받기"
                    className="ae-choice-claim min-h-[48px] shrink-0 font-readable"
                />
            </div>
        ))}
    </div>
);

export default PendingQuestRewardList;
