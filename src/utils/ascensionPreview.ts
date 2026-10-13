import { BALANCE } from '../data/constants';
import { PRESTIGE_TITLES } from '../data/titles';
import { carryEssenceLadderOnAscension } from '../systems/essenceLedger';
import { getPrestigeEnemyLevelRate } from '../systems/metaBonusRamp';
import { scaleEssenceReward } from '../systems/essenceRewardMult';
import { getAscensionRulePaidRerolls, getAscensionRuleRerollLadderKeep } from '../systems/ascensionRule';
import { getMirrorEndlessAffordance, getMirrorEndlessCycle, type MirrorEndlessAffordance, type MirrorEndlessCycle } from '../systems/mirrorUpgrades';
import type { Player } from '../types/player';

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

type AscensionMeta = NonNullable<Player['meta']>;

export interface AscensionOutcome {
    currentRank: number;
    nextRank: number;
    title: string;
    meta: AscensionMeta;
    milestone: PrestigeMilestone | null;
    currentEnemyStatPercent: number;
    nextEnemyStatPercent: number;
    currentEnemyRewardPercent: number;
    nextEnemyRewardPercent: number;
    /** 2026-09 Wave 40: 계승 rank만큼 오르는 적 전투 레벨 비율(%, 상한 있음)과, 영구 스탯이 전부 적용되는 레벨. */
    currentEnemyLevelPercent: number;
    nextEnemyLevelPercent: number;
    metaBonusFullLevel: number;
    /** 2026-09 Wave 32: 정수 사다리 이월(계승 직전 단계 → 남는 단계). */
    ladder: { rankBefore: number; rankKept: number; carryPercent: number; rerollPaid: number };
    /** 2026-10 Wave 98: 계승한 뒤의 정수로 끝없는 거울을 몇 단계 살 수 있는가(표시만 — 구매는 거울이 한다). */
    mirrorEndless: MirrorEndlessAffordance;
    /** 2026-10 Wave 99: 이번 회차(계승 전 단계)에 새긴 끝없는 거울 — 계승하면 기록은 지워진다. */
    mirrorEndlessCycle: MirrorEndlessCycle;
}

/**
 * 2026-10 Wave 61: 계승 칭호가 플레이어에게 새 칭호인가. 칭호 표(`PRESTIGE_TITLES`)는 10단계에서 끝나 11단계부터는
 * 이미 가진 '에테르의 신'이 다시 온다 — 계승 로그(`ASCEND`)와 계승 화면은 새 칭호일 때만 '새 칭호'라 말한다.
 */
export const isNewAscensionTitle = (
    outcome: Pick<AscensionOutcome, 'title'>,
    ownedTitles: readonly string[] | null | undefined,
): boolean => !(ownedTitles || []).includes(outcome.title);

const toNonNegativeNumber = (value: unknown) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const getAscensionOutcome = (meta: AscensionMeta | null | undefined): AscensionOutcome => {
    // 2026-10 Wave 95: 회차 규칙 패 다시 뽑기 기록은 이 계승에서 쓰고 지운다(유료 횟수만큼 넘어가는 사다리를 내려놓는다).
    // 2026-10 Wave 99: 이번 회차 끝없는 거울 기록도 이 계승에서 돌아보고 지운다(다음 회차는 0부터 센다).
    const { ascensionRuleOffer: _usedRuleOffer, mirrorEndlessCycle: _closedMirrorCycle, ...currentMeta } = meta || {};
    const currentRank = Math.floor(toNonNegativeNumber(currentMeta.prestigeRank));
    const nextRank = currentRank + 1;
    const titleIndex = Math.min(nextRank - 1, PRESTIGE_TITLES.length - 1);
    const rerollPaid = getAscensionRulePaidRerolls(meta, nextRank);
    const ladderKeep = getAscensionRuleRerollLadderKeep(rerollPaid);
    // 2026-09 Wave 32: 사다리 이월을 먼저 적용하고 그 위에 이번 계승의 보상을 얹는다.
    const carried = carryEssenceLadderOnAscension(currentMeta, ladderKeep);
    const carriedMeta = carried.meta;
    // 2026-10 Wave 58: 거울 에센스 공명 "전투와 계승으로 얻는 계승 정수" · 계승 1단계 "에센스 획득 +10%" — 계승 보상에도
    //   전투 · 오늘의 임무와 같은 배율(지금 단계 × 거울)을 곱한다. 이전에는 고정 +200이었다.
    const essenceReward = scaleEssenceReward(BALANCE.PRESTIGE_ESSENCE_REWARD, currentMeta);
    const nextEssence = carriedMeta.essence + essenceReward;

    return {
        currentRank,
        nextRank,
        title: PRESTIGE_TITLES[titleIndex],
        meta: {
            ...currentMeta,
            ...carriedMeta,
            prestigeRank: nextRank,
            essence: nextEssence,
            // 2026-09 G2: 승천 보상도 누적 원장에 함께 기록 (rank는 사다리 기준으로 오른다).
            essenceLifetime: carriedMeta.essenceLifetime + essenceReward,
            essenceLadder: carriedMeta.essenceLadder + essenceReward,
            bonusAtk: carriedMeta.bonusAtk + BALANCE.PRESTIGE_ATK_BONUS,
            bonusHp: carriedMeta.bonusHp + BALANCE.PRESTIGE_HP_BONUS,
            bonusMp: carriedMeta.bonusMp + BALANCE.PRESTIGE_MP_BONUS,
        },
        milestone: PRESTIGE_MILESTONES.find((entry) => entry.rank === nextRank) || null,
        currentEnemyStatPercent: Math.round(currentRank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK * 100),
        nextEnemyStatPercent: Math.round(nextRank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK * 100),
        currentEnemyRewardPercent: Math.round(currentRank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK * 100),
        nextEnemyRewardPercent: Math.round(nextRank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK * 100),
        currentEnemyLevelPercent: Math.round(getPrestigeEnemyLevelRate(currentRank) * 100),
        nextEnemyLevelPercent: Math.round(getPrestigeEnemyLevelRate(nextRank) * 100),
        metaBonusFullLevel: BALANCE.META_BONUS_FULL_LEVEL,
        ladder: {
            rankBefore: carried.rankBefore,
            rankKept: carried.rankKept,
            carryPercent: Math.round(BALANCE.ESSENCE_LADDER_ASCEND_CARRY * ladderKeep * 100),
            rerollPaid,
        },
        mirrorEndless: getMirrorEndlessAffordance(currentMeta.mirror, nextEssence),
        mirrorEndlessCycle: getMirrorEndlessCycle(meta),
    };
};
