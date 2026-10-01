import { getMirrorEffects, type MirrorLevels } from './mirrorUpgrades.js';
import { getPrestigeUnlocks } from './prestigeUnlocks.js';

type EssenceRewardMeta = { prestigeRank?: number; mirror?: MirrorLevels } | null | undefined;

/**
 * 계승 정수 획득 배율 — 계승 단계(1단계 "에센스 획득 +10%")와 거울 에센스 공명의 곱(2026-10 Wave 58).
 * 전투 처치 · 오늘의 임무 · 계승 보상이 같은 배율을 쓰고, 화면의 보상 표시도 이 값으로 그린다 — 지급만 배율을 곱하고
 * 표시는 원액이던 동안 처치 임무 카드가 실제 지급량보다 적게 보였다.
 */
export const getEssenceRewardMult = (meta: EssenceRewardMeta): number => (
    getPrestigeUnlocks(meta?.prestigeRank).essenceMult * getMirrorEffects(meta).essenceFlowMult
);

/** 원액 보상을 배율을 곱한 지급량으로 — 최소 1. */
export const scaleEssenceReward = (base: number, meta: EssenceRewardMeta): number => (
    Math.max(1, Math.floor(base * getEssenceRewardMult(meta)))
);
