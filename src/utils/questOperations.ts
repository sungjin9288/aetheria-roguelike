import { QUESTS } from '../data/quests.js';
import type { Player } from "../types/index.js";
import { MAPS } from '../data/maps.js';
import { BALANCE } from '../data/constants.js';
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
const RUN_PLAN_LOW_HP_RATIO = 0.5;
const OPERATION_BRIEF_LOW_HP_RATIO = 0.45;
const OPERATION_BRIEF_BOSS_HP_RATIO = 0.75;
const OPERATION_BRIEF_INVENTORY_BUFFER = 2;
const RUN_PLAN_PREP_BY_LANE: any = {
    story: 'REST 후 출발',
    build: 'GEAR 매칭 점검',
    growth: '보급과 성장 확인',
    boss: 'HP/소모품 점검',
    hunt: '장비와 HP 점검',
};

const toArray = (value: any) => (Array.isArray(value) ? value : []);
// cycle 523: playerLevel default 1 제거 — 1 internal callsite (line 116)
//   getQuestLevelGap(quest, playerLevel) 명시 전달이라 default 도달 불가.
//   util default 청소 메가 시리즈 20번째 (cycle 502-522). body의
//   (playerLevel || 1) defensive 가드는 별개 (caller가 0/undefined 넘기는
//   path 보존). cycle 519 getMapLevel 패턴과 동일.
const getQuestLevelGap = (quest: any, playerLevel: any) => Math.abs((quest?.minLv || 1) - (playerLevel || 1));
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

// cycle 555: maps default MAPS 제거 (inner) — 2 callers (line 78/122)
//   chain caller가 maps 명시 전달이라 default 도달 불가. entry-point pattern
//   (cycle 513 재적용): wrapper getQuestBoardRecommendations의 default는
//   외부 1-arg caller가 reachable이라 보존, inner chain은 redundant 정리.
const getQuestTargetMaps = (quest: any, maps: any) => {
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

const isBossQuest = (quest: any, maps: any) => {
    if (String(quest?.title || '').includes('[보스]')) return true;
    return getQuestTargetMaps(quest, maps).some((mapName: any) => {
        const map = maps[mapName];
        return Boolean(map?.boss) || toArray(map?.bossMonsters).includes(quest?.target);
    });
};

const getQuestLane = (quest: any, resonance: any, maps: any) => {
    if (isStoryQuest(quest)) return 'story';
    if (quest?.buildTag || quest?.type === 'build_victory' || (quest?.type === 'survive_low_hp' && resonance.score >= 3)) return 'build';
    if (quest?.target === 'Level' || ['craft', 'explore_count', 'discovery_count', 'bounty_count'].includes(quest?.type)) return 'growth';
    if (isBossQuest(quest, maps)) return 'boss';
    return 'hunt';
};

// cycle 545: targetMaps default [] 제거 — 1 internal callsite (line 153)
//   getQuestReason(quest, lane, resonance, targetMaps) 명시 전달이라
//   default 도달 불가. cross-file batch와 동일 사이클.
const getQuestReason = (quest: any, lane: any, resonance: any, targetMaps: any[]) => {
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

const getOperationPlanObjective = (quest: any, targetMaps: any[]) => {
    if (targetMaps[0]) return `${targetMaps[0]} 진입`;
    if (quest?.target === 'Level') return `Lv.${quest.goal} 달성`;
    if (quest?.type === 'craft') return '제작 루프 가동';
    if (['explore_count', 'discovery_count'].includes(quest?.type)) return '탐험 루트 확장';
    if (quest?.target) return `${quest.target} 추적`;
    return '임무 목표 추적';
};

const getOperationPrepStep = (player: Player, lane: any) => {
    const hp = player?.hp || 0;
    const maxHp = player?.maxHp || 0;
    if (maxHp > 0 && hp / maxHp <= RUN_PLAN_LOW_HP_RATIO) return 'REST 회복 우선';
    return RUN_PLAN_PREP_BY_LANE[lane] || RUN_PLAN_PREP_BY_LANE.hunt;
};

const getOperationPlanSteps = (quest: any, player: Player, lane: any, targetMaps: any[]) => ([
    { label: '수락', value: 'BOARD 계약 확정' },
    { label: '정비', value: getOperationPrepStep(player, lane) },
    { label: '목표', value: getOperationPlanObjective(quest, targetMaps) },
]);

const getOperationRouteLabel = (quest: any, targetMaps: any[]) => {
    if (targetMaps[0]) return targetMaps[0];
    if (quest?.target === 'Level') return '성장 루트';
    if (quest?.type === 'craft') return '제작/보급 루트';
    if (['explore_count', 'discovery_count'].includes(quest?.type)) return '미답사 루트';
    return '현재 권역';
};

const getOperationTargetLevel = (targetMaps: any[], maps: any, playerLevel: any) => {
    const targetMap = maps?.[targetMaps[0]];
    if (!targetMap) return null;
    if (targetMap.level === 'infinite') return Math.max((playerLevel || 1) + 8, 50);
    if (typeof targetMap.minLv === 'number') return targetMap.minLv;
    if (typeof targetMap.level === 'number') return targetMap.level;
    return null;
};

const getOperationRiskProfile = (quest: any, player: Player, lane: any, targetMaps: any[], maps: any) => {
    const hpRatio = (player?.hp || 0) / Math.max(1, player?.maxHp || 1);
    const playerLevel = player?.level || 1;
    const targetLevel = getOperationTargetLevel(targetMaps, maps, playerLevel);
    const levelGap = typeof targetLevel === 'number' ? targetLevel - playerLevel : 0;

    if (hpRatio <= OPERATION_BRIEF_LOW_HP_RATIO) {
        return {
            label: '정비 필요',
            tone: 'danger',
            detail: 'HP 회복 후 출발',
        };
    }

    if (lane === 'boss') {
        return {
            label: hpRatio >= OPERATION_BRIEF_BOSS_HP_RATIO ? '보스 준비' : '보스 경계',
            tone: hpRatio >= OPERATION_BRIEF_BOSS_HP_RATIO ? 'warning' : 'danger',
            detail: 'HP 75% 이상 유지',
        };
    }

    if (levelGap >= 4) {
        return {
            label: '도전',
            tone: 'warning',
            detail: `Lv.${targetLevel} 권역`,
        };
    }

    if (lane === 'build') {
        return {
            label: '빌드 정렬',
            tone: 'resonance',
            detail: '장비/성향 보상 확인',
        };
    }

    if (lane === 'growth') {
        return {
            label: '성장 안정',
            tone: 'upgrade',
            detail: quest?.target === 'Level' ? '레벨업 목표' : '누적 성장 목표',
        };
    }

    return {
        label: '안정',
        tone: 'recommended',
        detail: targetMaps[0] ? '목표 권역 확인' : '기본 토벌',
    };
};

const getOperationPayoff = (quest: any, lane: any, resonance: any) => {
    if (lane === 'story') return '서사 해금';
    if (lane === 'build' && resonance?.label) return `${resonance.label} 보상 고정`;
    if (lane === 'growth') return quest?.target === 'Level' ? '레벨 스파이크' : '성장 자원';
    if (lane === 'boss') return '보스 전리품';
    if (quest?.reward?.item) return `${quest.reward.item} 확보`;
    return '골드/EXP 회수';
};

const getOperationExtractionRule = (quest: any, player: Player, lane: any, targetMaps: any[]) => {
    const hpRatio = (player?.hp || 0) / Math.max(1, player?.maxHp || 1);
    const inventoryCap = (player as any)?.maxInv || BALANCE.INV_MAX_SIZE;
    const inventoryCount = player?.inv?.length || 0;

    if (hpRatio <= OPERATION_BRIEF_LOW_HP_RATIO) return '수락 전 REST, HP 회복 후 출발';
    if (inventoryCount >= inventoryCap - OPERATION_BRIEF_INVENTORY_BUFFER) return '가방 정리 후 출발';
    if (lane === 'boss') return '보스 조우 전 HP 75% 미만이면 귀환';
    if (quest?.target === 'Level') return `Lv.${quest.goal} 달성 즉시 마을 회수`;
    if (targetMaps[0]) return `${targetMaps[0]} 목표 ${quest.goal || 1}회 후 귀환`;
    if (lane === 'build') return '보상 장비 확인 후 빌드 점검';
    return '목표 달성 후 마을 회수';
};

const getOperationReturnTag = (extraction: string, lane: any) => {
    if (extraction.includes('REST')) return 'REST';
    if (extraction.includes('HP 75%')) return 'HP 75%';
    if (extraction.includes('가방')) return 'BAG';
    if (lane === 'growth') return 'SPIKE';
    return '회수';
};

const getOperationBrief = (quest: any, player: Player, lane: any, resonance: any, targetMaps: any[], maps: any) => {
    const risk = getOperationRiskProfile(quest, player, lane, targetMaps, maps);
    const route = getOperationRouteLabel(quest, targetMaps);
    const extraction = getOperationExtractionRule(quest, player, lane, targetMaps);

    return {
        label: 'Scout Brief',
        route,
        riskLabel: risk.label,
        riskTone: risk.tone,
        riskDetail: risk.detail,
        payoff: getOperationPayoff(quest, lane, resonance),
        extraction,
        tags: [
            { label: 'ROUTE', value: route },
            { label: 'RISK', value: risk.label },
            { label: 'RETURN', value: getOperationReturnTag(extraction, lane) },
        ],
    };
};

const enrichActiveQuestEntry = (entry: any, player: Player, traitProfile: any, maps: any) => {
    const resonance = getTraitQuestResonance(entry.quest, traitProfile);
    const lane = entry.isBounty ? 'hunt' : getQuestLane(entry.quest, resonance, maps);
    const targetMaps = getQuestTargetMaps(entry.quest, maps);

    return {
        ...entry,
        lane,
        resonance,
        targetMaps,
        meta: OPERATION_META[lane] || OPERATION_META.hunt,
        planSteps: getOperationPlanSteps(entry.quest, player, lane, targetMaps),
        brief: getOperationBrief(entry.quest, player, lane, resonance, targetMaps, maps),
    };
};

const scoreQuest = (quest: any, player: Player, traitProfile: any, activeEntries: any, maps: any) => {
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
        planSteps: getOperationPlanSteps(quest, player, lane, targetMaps),
        brief: getOperationBrief(quest, player, lane, resonance, targetMaps, maps),
    };
};

export const getQuestBoardRecommendations = (player: Player, maps: any = MAPS, questCatalog: any = QUESTS) => {
    const traitProfile = getTraitProfile(player, { maxHp: player?.maxHp, maxMp: player?.maxMp });
    const activeEntries = getActiveQuestEntries(player)
        .map((entry: any) => enrichActiveQuestEntry(entry, player, traitProfile, maps));
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
