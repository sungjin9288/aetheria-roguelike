import { getMirrorNode, MIRROR_NODES, type MirrorNodeDef } from '../data/mirror';
import { getMirrorEffects, type MirrorLevels } from '../systems/mirrorUpgrades';

export type MirrorPathId = 'departure' | 'exploration' | 'survival' | 'legacy';

export interface MirrorPath {
    id: MirrorPathId;
    label: string;
    summary: string;
    nodeIds: string[];
}

export const MIRROR_PATHS: MirrorPath[] = [
    {
        id: 'departure',
        label: '새 여정',
        summary: '다음 여정의 출발 자원과 첫 선택을 넓힙니다.',
        nodeIds: ['start_gold', 'start_boot_extra'],
    },
    {
        id: 'exploration',
        label: '탐험',
        summary: '탐험에서 회복 지점과 유물을 만날 기회를 늘립니다.',
        nodeIds: ['campfire_rate', 'relic_pity'],
    },
    {
        id: 'survival',
        label: '생존',
        summary: '회복 부담을 줄이고 치명적인 실패를 한 번 막습니다.',
        nodeIds: ['rest_discount', 'revive'],
    },
    {
        id: 'legacy',
        label: '순환',
        summary: '다음 성장을 위한 계승 정수 획득량을 늘립니다.',
        nodeIds: ['essence_flow'],
    },
];

const clampLevel = (node: MirrorNodeDef, mirror: MirrorLevels): number => (
    Math.min(node.maxLevel, Math.max(0, Math.floor(Number(mirror[node.id]) || 0)))
);

const formatPercent = (value: number): number => Math.round(value * 100);

export const getMirrorEffectLabel = (nodeId: string, level: number): string => {
    const effects = getMirrorEffects({ mirror: { [nodeId]: level } });

    switch (nodeId) {
        case 'start_gold':
            return effects.startGoldBonus > 0 ? `시작 골드 +${effects.startGoldBonus}` : '시작 골드 기본';
        case 'start_boot_extra':
            return effects.startBootChoiceBonus > 0 ? `첫 유물 선택 +${effects.startBootChoiceBonus}` : '첫 유물 선택 기본';
        case 'campfire_rate':
            return effects.campfireChanceBonus > 0
                ? `모닥불 발견 +${formatPercent(effects.campfireChanceBonus)}%p`
                : '모닥불 발견 기본';
        case 'relic_pity':
            return effects.relicPityBonus > 0
                ? `유물 발견 누적 보정 +${formatPercent(effects.relicPityBonus)}%`
                : '유물 발견 누적 보정 기본';
        case 'rest_discount': {
            const discount = formatPercent(1 - effects.restCostMult);
            return discount > 0 ? `휴식 비용 -${discount}%` : '휴식 비용 기본';
        }
        case 'revive':
            return effects.reviveEnabled
                ? `치명상 1회 방어 · 생명 ${formatPercent(effects.reviveHpRatio)}% 회복`
                : '치명상 보호 없음';
        case 'essence_flow': {
            const bonus = formatPercent(effects.essenceFlowMult - 1);
            return bonus > 0 ? `계승 정수 획득 +${bonus}%` : '계승 정수 획득 기본';
        }
        default:
            return '효과 없음';
    }
};

export interface MirrorInvestmentPreview {
    node: MirrorNodeDef;
    currentLevel: number;
    nextLevel: number | null;
    currentEffect: string;
    nextEffect: string | null;
    nextCost: number | null;
    remainingEssence: number;
    shortage: number;
    maxed: boolean;
    canAfford: boolean;
}

export const getMirrorInvestmentPreview = (
    nodeId: string,
    mirror: MirrorLevels = {},
    essence = 0,
): MirrorInvestmentPreview | null => {
    const node = getMirrorNode(nodeId);
    if (!node) return null;

    const currentLevel = clampLevel(node, mirror);
    const maxed = currentLevel >= node.maxLevel;
    const nextLevel = maxed ? null : currentLevel + 1;
    const nextCost = maxed ? null : node.costs[currentLevel];
    const availableEssence = Math.max(0, Math.floor(Number(essence) || 0));
    const cost = nextCost || 0;

    return {
        node,
        currentLevel,
        nextLevel,
        currentEffect: getMirrorEffectLabel(node.id, currentLevel),
        nextEffect: nextLevel === null ? null : getMirrorEffectLabel(node.id, nextLevel),
        nextCost,
        remainingEssence: Math.max(0, availableEssence - cost),
        shortage: Math.max(0, cost - availableEssence),
        maxed,
        canAfford: !maxed && availableEssence >= cost,
    };
};

export const getMirrorCompletion = (mirror: MirrorLevels = {}) => {
    const completed = MIRROR_NODES.reduce((total, node) => total + clampLevel(node, mirror), 0);
    const total = MIRROR_NODES.reduce((sum, node) => sum + node.maxLevel, 0);
    return { completed, total };
};
