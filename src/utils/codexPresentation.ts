export type CodexCategoryId = 'weapons' | 'armors' | 'shields' | 'monsters' | 'recipes' | 'materials';

export interface CodexMilestone {
    id: string;
    category: CodexCategoryId;
    count: number;
    label: string;
    reward: Record<string, number>;
    reached: boolean;
    claimed: boolean;
}

export interface CodexGoal extends CodexMilestone {
    current: number;
    remaining: number;
}

export const CODEX_CATEGORY_LABELS: Record<CodexCategoryId, string> = {
    weapons: '무기',
    armors: '방어구',
    shields: '방패',
    monsters: '몬스터',
    recipes: '제작법',
    materials: '소재',
};

export const formatCodexRewardParts = (reward: Record<string, number>): string[] => {
    const parts: string[] = [];
    if (reward.atk) parts.push(`공격력 +${reward.atk}`);
    if (reward.def) parts.push(`방어력 +${reward.def}`);
    if (reward.hp) parts.push(`생명 +${reward.hp}`);
    if (reward.gold) parts.push(`골드 ${reward.gold}`);
    if (reward.premiumCurrency) parts.push(`에테르 크리스탈 ${reward.premiumCurrency}`);
    return parts;
};

export const getNextCodexGoals = (
    milestones: CodexMilestone[],
    discoveredCounts: Partial<Record<CodexCategoryId, number>>,
    limit = 3,
): CodexGoal[] => (
    milestones
        .filter((milestone) => !milestone.reached && !milestone.claimed)
        .map((milestone) => {
            const current = discoveredCounts[milestone.category] || 0;
            return {
                ...milestone,
                current,
                remaining: Math.max(0, milestone.count - current),
            };
        })
        .sort((left, right) => {
            if (left.remaining !== right.remaining) return left.remaining - right.remaining;
            const progressDifference = (right.current / right.count) - (left.current / left.count);
            if (progressDifference !== 0) return progressDifference;
            return left.count - right.count;
        })
        .filter((goal, index, goals) => (
            goals.findIndex((entry) => entry.category === goal.category) === index
        ))
        .slice(0, limit)
);
