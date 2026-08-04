import { BALANCE } from '../data/constants';
import { getCodexProgress } from '../data/codexRewards';
import { PREMIUM_SHOP } from '../data/premiumShop';
import { ACHIEVEMENTS } from '../data/quests';
import type { Player } from '../types/index.js';

export type CrystalExchangeCategory = 'preparation' | 'titles';

export interface CrystalExchangeOffer {
    id: string;
    category: CrystalExchangeCategory;
    name: string;
    description: string;
    cost: number;
    currentLabel: string;
    nextLabel: string;
    owned: boolean;
    canExchange: boolean;
    shortage: number;
    titleName?: string;
}

export interface CrystalSource {
    id: string;
    name: string;
    detail: string;
    rewardLabel: string;
}

interface CrystalRewardEntry {
    reward?: unknown;
}

const TITLE_DESCRIPTIONS: Record<string, string> = {
    title_stargazer: '별과 미지의 지역을 좇는 모험가의 칭호',
    title_voidwalker: '공허의 경계를 넘어 돌아온 모험가의 칭호',
    title_aetherborn: '에테르의 흐름과 하나가 된 모험가의 칭호',
    title_worldender: '세계의 끝까지 여정을 마친 모험가의 칭호',
};

const rewardRange = (entries: CrystalRewardEntry[]) => {
    const rewards = entries
        .map((entry) => {
            const reward = entry.reward as { premiumCurrency?: unknown } | undefined;
            return Number(reward?.premiumCurrency) || 0;
        })
        .filter((reward) => reward > 0);

    if (rewards.length === 0) return '보상 없음';

    const minimum = Math.min(...rewards);
    const maximum = Math.max(...rewards);
    return minimum === maximum ? `${minimum}개` : `${minimum}~${maximum}개`;
};

export const getCrystalSources = (): CrystalSource[] => {
    const codexMilestones = getCodexProgress({}, []).milestones;

    return [
        {
            id: 'weekly',
            name: '주간 임무',
            detail: '처치·탐험·보스 목표를 달성하고 수령',
            rewardLabel: rewardRange(BALANCE.WEEKLY_MISSIONS),
        },
        {
            id: 'codex',
            name: '모험 도감',
            detail: '장비·몬스터·제작 발견 마일스톤 달성',
            rewardLabel: rewardRange(codexMilestones),
        },
        {
            id: 'achievements',
            name: '장기 업적',
            detail: '심연·전설 수집·발견 체인 업적 달성',
            rewardLabel: rewardRange(ACHIEVEMENTS),
        },
        {
            id: 'discoveries',
            name: '발견 여정',
            detail: '공허의 공명과 고대 순례길 완주',
            rewardLabel: rewardRange(BALANCE.DISCOVERY_CHAINS),
        },
    ];
};

export const getCrystalExchangeOffers = (player?: Player | null): CrystalExchangeOffer[] => {
    const crystals = Math.max(0, Number(player?.premiumCurrency) || 0);
    const maxInv = Math.max(1, Number(player?.maxInv) || 20);
    const synthProtects = Math.max(0, Number(player?.stats?.synthProtects) || 0);
    const reviveTokens = Math.max(0, Number(player?.reviveTokens) || 0);
    const ownedTitles = new Set(player?.stats?.cosmeticTitles || []);

    const preparation = [
        {
            id: PREMIUM_SHOP.invExpand.id,
            name: '가방 확장',
            description: '모든 여정에서 사용할 수 있는 가방 공간을 늘립니다.',
            cost: PREMIUM_SHOP.invExpand.cost,
            currentLabel: `${maxInv}칸`,
            nextLabel: `${maxInv + BALANCE.INV_EXPAND_AMOUNT}칸`,
        },
        {
            id: PREMIUM_SHOP.synthProtect.id,
            name: '합성 보호석',
            description: '다음 합성에서 보호를 선택하면 재료 손실을 막습니다.',
            cost: PREMIUM_SHOP.synthProtect.cost,
            currentLabel: `${synthProtects}개`,
            nextLabel: `${synthProtects + 1}개`,
        },
        {
            id: PREMIUM_SHOP.revive.id,
            name: '에테르 부활석',
            description: '치명상 시 자동으로 사용해 생명과 기력을 50% 회복합니다.',
            cost: PREMIUM_SHOP.revive.cost,
            currentLabel: `${reviveTokens}개`,
            nextLabel: `${reviveTokens + 1}개`,
        },
    ].map((offer) => ({
        ...offer,
        category: 'preparation' as const,
        owned: false,
        canExchange: crystals >= offer.cost,
        shortage: Math.max(0, offer.cost - crystals),
    }));

    const titles = PREMIUM_SHOP.cosmeticTitles.map((title: any) => {
        const owned = ownedTitles.has(title.id);
        return {
            id: title.id,
            category: 'titles' as const,
            name: title.name,
            description: TITLE_DESCRIPTIONS[title.id] || '여정의 발자취를 나타내는 장식 칭호',
            cost: title.cost,
            currentLabel: owned ? '보유 중' : '미보유',
            nextLabel: '모험 기록에서 선택 가능',
            owned,
            canExchange: !owned && crystals >= title.cost,
            shortage: owned ? 0 : Math.max(0, title.cost - crystals),
            titleName: title.name,
        };
    });

    return [...preparation, ...titles];
};
