import { isSignatureItem } from '../data/signatureItems';
import { getEquipmentDecision, getSellPrice } from './equipmentUtils';
import { getGoldIncome, type ChallengeHolder } from './challengeRules';
import { getJobPath } from './signatureSale';
import type { Item, Player } from '../types/index.js';

/**
 * 쓰지 않는 장비 한 번에 팔기 — 2026-11 재미 분석 G4.
 *
 * 직접 플레이에서 Lv4에 가방이 찼고 장비는 물건마다 두 번 눌러야 팔렸다(재료 일괄 정리는 재료만 판다). 판정은 새 점수가 아니라
 * 이미 있는 두 판정이다: 장비 비교(`getEquipmentDecision` — 상점 · 전리품 힌트와 같은 점수, 강화 반영)와 직업 경로(`getJobPath` —
 * 전설 각인 판매와 같은 전직 폐포).
 *
 *  - 판다: 지금 직업과 앞으로의 전직 누구도 쓰지 못하는 장비, 지금 낄 수 있고 끼고 있는 것보다 낫지 않은 장비(점수 ≤ 0).
 *  - 남긴다: 강화한 장비(들인 것), 전설 각인(판매 규칙은 `signatureSale`), 지금보다 나은 장비, 레벨 · 전직이 모자라 아직 못 끼는 장비,
 *    시작 지급품(상점 판매 목록에서도 빠진다).
 */

const EQUIPMENT_TYPES: ReadonlySet<string> = new Set(['weapon', 'armor', 'shield']);

type BulkSellPlayer = Pick<Player, 'inv' | 'job' | 'level' | 'equip'>;

const isOffPath = (item: Item, path: Set<string>): boolean => (
    Array.isArray(item.jobs) && item.jobs.length > 0 && path.size > 0 && ![...path].some((job) => item.jobs?.includes(job))
);

export const isUnusedEquipment = (item: Item | null | undefined, player: BulkSellPlayer, path = getJobPath(player.job)): boolean => {
    if (!item || !EQUIPMENT_TYPES.has(String(item.type))) return false;
    if (String(item.id).startsWith('starter_')) return false;
    if ((item.enhance || 0) > 0) return false;
    if (isSignatureItem(item)) return false;
    if (isOffPath(item, path)) return true;
    const decision = getEquipmentDecision(player, item);
    return Boolean(decision && decision.equipable && decision.score <= 0);
};

export const getUnusedEquipmentTargets = (player: BulkSellPlayer): Item[] => {
    const path = getJobPath(player.job);
    return (player.inv || []).filter((item) => isUnusedEquipment(item, player, path));
};

export interface UnusedEquipmentSummary {
    items: Item[];
    /** 판매가 합(수입 규칙 전). 리듀서가 이 합을 `grantGold`로 한 번에 지급한다. */
    totalPrice: number;
    /** 실제로 받는 골드 — 합계에 수입 규칙을 한 번 건 값(재료 일괄 정리 · 리듀서 로그와 같은 계산). */
    income: number;
}

export const getUnusedEquipmentSummary = (player: BulkSellPlayer & NonNullable<ChallengeHolder>): UnusedEquipmentSummary => {
    const items = getUnusedEquipmentTargets(player);
    const totalPrice = items.reduce((total, item) => total + getSellPrice(item), 0);
    return { items, totalPrice, income: getGoldIncome(player, totalPrice) };
};
