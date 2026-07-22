import type { Player } from '../types/player.js';

export const MILESTONE_STORY_BEATS = {
    first_safe_return: {
        eyebrow: '첫 귀환',
        title: '돌아오는 것도 모험이다',
        body: '마을의 불빛이 보이자 긴장이 풀렸다. 손에 쥔 전리품보다 더 값진 것은, 어디에서 멈추고 돌아와야 하는지 알게 된 경험이었다.',
        closing: '정비를 마치면 다음 원정은 조금 더 멀리 갈 수 있다.',
    },
    first_death: {
        eyebrow: '첫 패배',
        title: '끝난 자리에도 무언가는 남는다',
        body: '쓰러진 자리에서 에테르가 흩어졌지만, 몸에 밴 감각까지 사라지지는 않았다. 다음 발걸음은 처음보다 단단할 것이다.',
        closing: '이번 패배에서 얻은 영구 성장은 다음 모험에도 이어진다.',
    },
    first_area_boss: {
        eyebrow: '첫 구역 보스 격파',
        title: '막혀 있던 길이 열렸다',
        body: '길을 짓누르던 거대한 기척이 사라졌다. 이제 이 땅은 두려운 장소가 아니라, 다시 찾아와 더 깊이 살필 수 있는 길이 되었다.',
        closing: '마을로 돌아가 전리품을 정리하고 다음 권역을 준비하자.',
    },
    first_job_change: {
        eyebrow: '첫 전직',
        title: '싸우는 방식에 이름이 생겼다',
        body: '익숙한 동작을 되짚고 나니 앞으로 다듬어야 할 길이 선명해졌다. 이제 장비와 기술을 같은 방향으로 맞출 수 있다.',
        closing: '새 직업의 강점에 맞춰 장비와 기술을 한 번 확인하자.',
    },
} as const;

export type MilestoneStoryBeatId = keyof typeof MILESTONE_STORY_BEATS;

export interface MilestoneStoryBeat {
    id: MilestoneStoryBeatId;
    eyebrow: string;
    title: string;
    body: string;
    closing: string;
}

export interface MilestoneStoryState {
    seen: MilestoneStoryBeatId[];
    pending: MilestoneStoryBeatId[];
}

const isStoryBeatId = (value: unknown): value is MilestoneStoryBeatId => (
    typeof value === 'string' && value in MILESTONE_STORY_BEATS
);

const uniqueStoryBeatIds = (value: unknown) => (
    Array.isArray(value) ? [...new Set(value.filter(isStoryBeatId))] : []
);

export const normalizeMilestoneStoryState = (value: unknown): MilestoneStoryState => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { seen: [], pending: [] };
    }

    const candidate = value as Record<string, unknown>;
    const seen = uniqueStoryBeatIds(candidate.seen);
    return {
        seen,
        pending: uniqueStoryBeatIds(candidate.pending).filter((id) => !seen.includes(id)),
    };
};

export const queueMilestoneStoryBeat = (player: Player, id: MilestoneStoryBeatId): Player => {
    const storyMilestones = normalizeMilestoneStoryState(player.meta?.storyMilestones);
    if (storyMilestones.seen.includes(id) || storyMilestones.pending.includes(id)) return player;

    return {
        ...player,
        meta: {
            ...(player.meta || {}),
            storyMilestones: {
                ...storyMilestones,
                pending: [...storyMilestones.pending, id],
            },
        },
    };
};

export const acknowledgeMilestoneStoryBeat = (player: Player, id: MilestoneStoryBeatId): Player => {
    const storyMilestones = normalizeMilestoneStoryState(player.meta?.storyMilestones);
    if (!storyMilestones.pending.includes(id) && storyMilestones.seen.includes(id)) return player;

    return {
        ...player,
        meta: {
            ...(player.meta || {}),
            storyMilestones: {
                seen: [...new Set([...storyMilestones.seen, id])],
                pending: storyMilestones.pending.filter((pendingId) => pendingId !== id),
            },
        },
    };
};

export const getPendingMilestoneStoryBeat = (
    player: Player,
    preferredIds: MilestoneStoryBeatId[] = [],
): MilestoneStoryBeat | null => {
    const pending = normalizeMilestoneStoryState(player.meta?.storyMilestones).pending;
    const id = preferredIds.find((preferredId) => pending.includes(preferredId)) || pending[0];
    return id ? { id, ...MILESTONE_STORY_BEATS[id] } : null;
};
