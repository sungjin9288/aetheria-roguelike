import { QUESTS } from '../data/quests.js';
import type { Player } from "../types/index.js";
import { MAPS } from '../data/maps.js';
import { getTraitProfile, getTraitQuestResonance } from './runProfileUtils.js';

// cycle 356: OPERATION_META 5 lane에서 summary 필드 제거 — QuestBoardPanel은
//   entry.meta.label / .emphasis만 read. summary 외부 read 0건이던 dead config.
const OPERATION_META: any = {
    story: {
        label: 'Story Arc',
        emphasis: '서사 축',
    },
    build: {
        label: 'Build Path',
        emphasis: '빌드 축',
    },
    growth: {
        label: 'Power Spike',
        emphasis: '성장 축',
    },
    boss: {
        label: 'Boss Hunt',
        emphasis: '보스 축',
    },
    hunt: {
        label: 'Field Hunt',
        emphasis: '토벌 축',
    },
};

const FEATURED_LANE_ORDER: any = ['story', 'build', 'growth', 'boss', 'hunt'];

const toArray = (value: any) => (Array.isArray(value) ? value : []);
const getQuestLevelGap = (quest: any, playerLevel: any = 1) => Math.abs((quest?.minLv || 1) - (playerLevel || 1));
const isStoryQuest = (quest: any) => String(quest?.title || '').includes('[스토리]');
const getActiveQuestEntries = (player: Player) => (
    toArray(player?.quests)
        .map((questState: any) => {
            const quest = questState?.isBounty
                ? questState
                : QUESTS.find((entry: any) => entry.id === questState?.id);
            if (!quest) return null;

            const progress = questState?.progress || 0;
            return {
                id: questState.id,
                quest,
                progress,
                isBounty: Boolean(questState?.isBounty),
                isComplete: progress >= (quest.goal || 0),
            };
        })
        .filter(Boolean)
);

const getQuestTargetMaps = (quest: any, maps: any = MAPS) => {
    if (!quest?.target || quest.target === 'Level') return [];

    return (Object.entries(maps) as Array<[string, any]>)
        .filter(([, map]) => {
            const pool = [
                ...toArray(map?.monsters),
                ...toArray(map?.bossMonsters),
                ...(map?.boss ? [map.boss] : []),
            ];
            return pool.includes(quest.target);
        })
        .map(([name]) => name);
};

const isBossQuest = (quest: any, maps: any = MAPS) => {
    if (String(quest?.title || '').includes('[보스]')) return true;
    return getQuestTargetMaps(quest, maps).some((mapName: any) => {
        const map = maps[mapName];
        return Boolean(map?.boss) || toArray(map?.bossMonsters).includes(quest?.target);
    });
};

const getQuestLane = (quest: any, resonance: any, maps: any = MAPS) => {
    if (isStoryQuest(quest)) return 'story';
    if (quest?.buildTag || quest?.type === 'build_victory' || (quest?.type === 'survive_low_hp' && resonance.score >= 3)) return 'build';
    if (quest?.target === 'Level' || ['craft', 'explore_count', 'discovery_count', 'bounty_count'].includes(quest?.type)) return 'growth';
    if (isBossQuest(quest, maps)) return 'boss';
    return 'hunt';
};

const getQuestReason = (quest: any, lane: any, resonance: any, targetMaps: any[] = []) => {
    if (lane === 'story') {
        return `서사 진행을 당겨 ${quest.minLv || 1}레벨 구간의 다음 전개를 열어 주는 임무입니다.`;
    }
    if (lane === 'build' && resonance.summary) {
        return `${resonance.summary}. 현재 빌드 정체성을 보상으로 고정하기 좋습니다.`;
    }
    if (lane === 'growth') {
        if (quest?.target === 'Level') return '전직이나 다음 권역 진입 전에 가장 직관적인 파워 스파이크를 만들어 줍니다.';
        if (quest?.type === 'craft') return '전투 외 성장 루프를 열어 장비 체감과 보급 리듬을 같이 올려 줍니다.';
        return '누적 성장 축을 밀어 런의 중간 목표를 또렷하게 만드는 임무입니다.';
    }
    if (lane === 'boss') {
        return targetMaps[0]
            ? `${targetMaps[0]} 권역의 보스 흐름과 직접 연결됩니다.`
            : '현재 레벨대 보스 챌린지로 런의 긴장감을 끌어올립니다.';
    }
    if (targetMaps[0]) {
        return `${targetMaps[0]} 권역 토벌과 바로 이어져 전개가 끊기지 않습니다.`;
    }
    return '당장 밀기 좋은 기본 토벌 임무로 파밍과 전투 감각을 유지하기 쉽습니다.';
};

const scoreQuest = (quest: any, player: Player, traitProfile: any, activeEntries: any, maps: any = MAPS) => {
    const resonance = getTraitQuestResonance(quest, traitProfile);
    const lane = getQuestLane(quest, resonance, maps);
    const playerLevel = player?.level || 1;
    const targetMaps = getQuestTargetMaps(quest, maps);
    const activeTargets = new Set(activeEntries.map((entry: any) => entry.quest?.target).filter(Boolean));
    const levelGap = getQuestLevelGap(quest, playerLevel);
    const hasNearbyTargetMap = targetMaps.some((mapName: any) => {
        const level = maps[mapName]?.level;
        return typeof level === 'number' && level <= playerLevel + 6 && level >= Math.max(1, playerLevel - 8);
    });
    const isCurrentZoneTarget = targetMaps.includes(player?.loc as string);

    let score = resonance.score * 10;
    score += Math.max(0, 18 - (levelGap * 4));

    if (lane === 'story') score += 44;
    if (lane === 'build') score += resonance.score >= 6 ? 24 : 8;
    if (lane === 'growth') score += quest?.target === 'Level' ? 18 : 12;
    if (lane === 'boss') score += 14;
    if (lane === 'hunt') score += 10;

    if (hasNearbyTargetMap) score += 12;
    if (isCurrentZoneTarget) score += 8;

    if (activeTargets.has(quest?.target)) score -= 16;
    if (player?.job === '모험가' && quest?.target === 'Level') score += (playerLevel >= 5 ? 14 : 20);
    if (quest?.type === 'craft' && (player?.stats?.crafts || 0) === 0) score += 4;
    if (quest?.type === 'bounty_count' && (player?.stats?.bountiesCompleted || 0) === 0) score += 2;

    // cycle 347: score 출력 dead 정리 — 정렬용으로만 사용, 외부 read 0건. _sortKey로 변경 후 strip.
    return {
        quest,
        _sortKey: score,
        lane,
        resonance,
        targetMaps,
        meta: OPERATION_META[lane] || OPERATION_META.hunt,
        reason: getQuestReason(quest, lane, resonance, targetMaps),
    };
};

export const getQuestBoardRecommendations = (player: Player, maps: any = MAPS, questCatalog: any = QUESTS) => {
    const traitProfile = getTraitProfile(player, { maxHp: player?.maxHp, maxMp: player?.maxMp });
    const activeEntries = getActiveQuestEntries(player);
    const activeRegularQuestIds = new Set(activeEntries.filter((entry: any) => !entry.isBounty).map((entry: any) => entry.id));
    const playerLevel = player?.level || 1;

    const scoredAvailable = questCatalog
        .filter((quest: any) => !activeRegularQuestIds.has(quest.id) && playerLevel >= (quest.minLv || 1))
        .map((quest: any) => scoreQuest(quest, player, traitProfile, activeEntries, maps))
        // cycle 347: _sortKey로 정렬 후 strip (score 외부 노출 0건이므로).
        .sort((left: any, right: any) => right._sortKey - left._sortKey || left.quest.title.localeCompare(right.quest.title, 'ko'))
        .map((entry: any) => {
            const { _sortKey, ...exposed } = entry;
            void _sortKey;
            return exposed;
        });

    const featured: any[] = [];
    const usedIds = new Set();
    FEATURED_LANE_ORDER.forEach((lane: any) => {
        const match = scoredAvailable.find((entry: any) => entry.lane === lane && !usedIds.has(entry.quest.id));
        if (!match || featured.length >= 3) return;
        featured.push(match);
        usedIds.add(match.quest.id);
    });

    for (const entry of scoredAvailable) {
        if (featured.length >= 3) break;
        if (usedIds.has(entry.quest.id)) continue;
        featured.push(entry);
        usedIds.add(entry.quest.id);
    }

    const backlog = scoredAvailable.filter((entry: any) => !usedIds.has(entry.quest.id));
    const locked = questCatalog
        .filter((quest: any) => !activeRegularQuestIds.has(quest.id) && playerLevel < (quest.minLv || 1))
        .sort((left: any, right: any) => (left.minLv || 1) - (right.minLv || 1))
        .slice(0, 6);

    return {
        traitProfile,
        activeEntries,
        featured,
        backlog,
        locked,
    };
};
