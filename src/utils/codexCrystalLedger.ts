/**
 * 도감 보상의 크리스털은 계정당 한 번이다(2026-11 출시 전 결함 수정 — 업적 크리스털 장부 Wave 108과 같은 규칙).
 *
 * 도감(수집 · 수령 기록)은 사망하면 비워지므로 같은 마일스톤을 다시 모아 다시 받을 수 있다. 공격력 · 방어력 · 생명 · 골드는
 * 여정 보상이라 다시 주지만, 에테르 크리스털은 초기화를 넘어 남는 보상이라 처음 한 번만 준다. 장부가 없던 세이브는 지금까지
 * 수령한 크리스털 마일스톤(`codexClaimed`)으로 채운다.
 */
import { getCodexProgress, type CodexReward } from '../data/codexRewards.js';
import type { Player } from '../types/index.js';

const CRYSTAL_CODEX_MILESTONE_IDS: ReadonlySet<string> = new Set(
    getCodexProgress({}, []).milestones
        .filter((milestone) => Number(milestone.reward.premiumCurrency) > 0)
        .map((milestone) => milestone.id),
);

const readIdList = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
);

/** 크리스털을 이미 받은 도감 마일스톤 — 장부 + 지금까지 수령한 크리스털 마일스톤. */
export const collectCrystalRewardedCodexMilestoneIds = (stats: Player['stats'] | null | undefined): string[] => (
    [...new Set([
        ...readIdList(stats?.crystalRewardedCodexMilestones),
        ...readIdList(stats?.codexClaimed).filter((id) => CRYSTAL_CODEX_MILESTONE_IDS.has(id)),
    ])]
);

/** 이 플레이어가 이 마일스톤에서 실제로 받는 보상 — 크리스털을 이미 받았으면 크리스털을 뺀다(카드 · 정산 공용). */
export const getCodexMilestoneGrant = (
    milestoneId: string,
    reward: CodexReward,
    stats: Player['stats'] | null | undefined,
): CodexReward => {
    if (!reward.premiumCurrency || !collectCrystalRewardedCodexMilestoneIds(stats).includes(milestoneId)) return reward;
    const { premiumCurrency: _granted, ...rest } = reward;
    return rest;
};
