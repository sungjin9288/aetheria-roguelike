import { BALANCE } from '../data/constants';
import { PRESTIGE_TITLES } from '../data/titles';

export interface PrestigeMilestone {
    rank: number;
    name: string;
    description: string;
}

export const PRESTIGE_MILESTONES: readonly PrestigeMilestone[] = Object.freeze([
    { rank: 1, name: '에테르 각성', description: '에센스 획득 +10% · 마왕에게서 원시의 파편 발견' },
    { rank: 2, name: '강화된 유물', description: '유물 선택지 4개 · 최대 보유 6개' },
    { rank: 3, name: '심연의 메아리', description: '정예 출현 증가 · 보스 희귀 장비 보장 · 진 보스 도전' },
    { rank: 4, name: '재의 인장', description: '캠프파이어 발견율 +4%p' },
    { rank: 5, name: '심연의 인장', description: '첫 유물 선택지 4개' },
    { rank: 6, name: '잔향의 나침반', description: '유물을 얻지 못할수록 다음 발견 확률이 더 빠르게 상승' },
    { rank: 7, name: '심연의 서약', description: '도전 조건을 하나 더 선택 가능' },
    { rank: 8, name: '에테르 심화', description: '에센스 획득 보너스가 누적 +20%로 상승' },
    { rank: 9, name: '심연 사냥꾼', description: '정예 몬스터 처치 보상 +25%' },
    { rank: 10, name: '에테르 초월', description: '영구 능력치 2배 · 에테르 관문의 숨겨진 보스 출현' },
]);

type AscensionMeta = Record<string, any>;

export interface AscensionOutcome {
    currentRank: number;
    nextRank: number;
    title: string;
    meta: AscensionMeta;
    milestone: PrestigeMilestone | null;
    upcomingMilestone: PrestigeMilestone | null;
    currentEnemyStatPercent: number;
    nextEnemyStatPercent: number;
    currentEnemyRewardPercent: number;
    nextEnemyRewardPercent: number;
}

const toNonNegativeNumber = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const getAscensionOutcome = (meta: AscensionMeta | null | undefined): AscensionOutcome => {
    const currentMeta = meta || {};
    const currentRank = Math.floor(toNonNegativeNumber(currentMeta.prestigeRank));
    const nextRank = currentRank + 1;
    const titleIndex = Math.min(nextRank - 1, PRESTIGE_TITLES.length - 1);

    return {
        currentRank,
        nextRank,
        title: PRESTIGE_TITLES[titleIndex],
        meta: {
            ...currentMeta,
            prestigeRank: nextRank,
            essence: toNonNegativeNumber(currentMeta.essence) + BALANCE.PRESTIGE_ESSENCE_REWARD,
            bonusAtk: toNonNegativeNumber(currentMeta.bonusAtk) + BALANCE.PRESTIGE_ATK_BONUS,
            bonusHp: toNonNegativeNumber(currentMeta.bonusHp) + BALANCE.PRESTIGE_HP_BONUS,
            bonusMp: toNonNegativeNumber(currentMeta.bonusMp) + BALANCE.PRESTIGE_MP_BONUS,
        },
        milestone: PRESTIGE_MILESTONES.find((entry) => entry.rank === nextRank) || null,
        upcomingMilestone: PRESTIGE_MILESTONES.find((entry) => entry.rank > nextRank) || null,
        currentEnemyStatPercent: Math.round(currentRank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK * 100),
        nextEnemyStatPercent: Math.round(nextRank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK * 100),
        currentEnemyRewardPercent: Math.round(currentRank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK * 100),
        nextEnemyRewardPercent: Math.round(nextRank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK * 100),
    };
};
