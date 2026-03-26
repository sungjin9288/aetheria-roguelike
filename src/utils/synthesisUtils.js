import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import { getItemRarity } from './gameUtils';

/**
 * synthesisUtils.js — 아이템 합성 순수 함수
 * 같은 type + 같은 tier 장비 3개 → 상위 tier 장비 1개
 */

const SYNTH_TYPES = ['weapon', 'armor', 'shield'];

/**
 * 합성 가능한 아이템인지 확인
 */
export const isSynthesizable = (item) =>
    item && SYNTH_TYPES.includes(item.type) && item.tier >= 1 && item.tier <= 5;

/**
 * 주어진 type + tier 조합의 상위 tier 결과 후보 목록
 */
export const getSynthesisOutputs = (inputType, inputTier) => {
    const nextTier = inputTier + 1;
    if (nextTier > 6) return [];

    const pool =
        inputType === 'weapon' ? DB.ITEMS.weapons :
        inputType === 'armor'  ? DB.ITEMS.armors  :
        inputType === 'shield' ? DB.ITEMS.armors  : [];

    return pool.filter((item) => item.type === inputType && item.tier === nextTier);
};

/**
 * 합성 유효성 검사
 * @param {Object[]} items - 선택된 3개 아이템 (player.inv 엔트리)
 * @param {number} playerGold - 보유 골드
 * @returns {{ valid: boolean, reason?: string, tier?: number, type?: string, outputs?: Object[], goldCost?: number, successRate?: number }}
 */
export const validateSynthesis = (items, playerGold) => {
    const required = BALANCE.SYNTHESIS_INPUT_COUNT;

    if (!items || items.length !== required) {
        return { valid: false, reason: 'NOT_ENOUGH' };
    }

    // 모두 합성 가능한 장비인지
    if (!items.every(isSynthesizable)) {
        return { valid: false, reason: 'INVALID_TYPE' };
    }

    // 같은 type + tier인지
    const type = items[0].type;
    const tier = items[0].tier;
    if (!items.every((item) => item.type === type && item.tier === tier)) {
        return { valid: false, reason: 'MISMATCH' };
    }

    // 최대 tier 초과
    if (tier >= 6) {
        return { valid: false, reason: 'MAX_TIER' };
    }

    const goldCost = BALANCE.SYNTHESIS_GOLD_COSTS[tier] || 0;
    if (playerGold < goldCost) {
        return { valid: false, reason: 'NO_GOLD', goldCost };
    }

    const outputs = getSynthesisOutputs(type, tier);
    if (outputs.length === 0) {
        return { valid: false, reason: 'NO_OUTPUT' };
    }

    const successRate = BALANCE.SYNTHESIS_SUCCESS_RATES[tier] || 0.5;

    return { valid: true, tier, type, outputs, goldCost, successRate };
};

/**
 * 합성 실행 (순수 함수 — Math.random 사용)
 * @param {Object[]} items - 합성 재료 3개
 * @param {Object|null} selectedOutput - 지정 결과물 (null이면 랜덤)
 * @param {boolean} useProtect - 프리미엄 보호 사용 여부
 * @returns {{ success: boolean, outputItem?: Object, returnedItems: Object[], goldSpent: number, premiumSpent: number }}
 */
export const performSynthesis = (items, selectedOutput = null, useProtect = false) => {
    const type = items[0].type;
    const tier = items[0].tier;
    const goldCost = BALANCE.SYNTHESIS_GOLD_COSTS[tier] || 0;
    const successRate = BALANCE.SYNTHESIS_SUCCESS_RATES[tier] || 0.5;
    const premiumSpent = useProtect ? BALANCE.SYNTHESIS_PROTECT_COST : 0;

    const roll = Math.random();
    const success = roll < successRate;

    if (success) {
        const outputs = getSynthesisOutputs(type, tier);
        const output = selectedOutput && outputs.find((o) => o.name === selectedOutput.name)
            ? selectedOutput
            : outputs[Math.floor(Math.random() * outputs.length)];

        return {
            success: true,
            outputItem: output,
            returnedItems: [],
            goldSpent: goldCost,
            premiumSpent,
        };
    }

    // 실패: 보호 사용 시 전부 반환, 아니면 FAIL_RETURN개만 반환
    const returnCount = useProtect ? items.length : BALANCE.SYNTHESIS_FAIL_RETURN;
    const returnedItems = items.slice(0, returnCount);

    return {
        success: false,
        outputItem: null,
        returnedItems,
        goldSpent: goldCost,
        premiumSpent,
    };
};

/**
 * 인벤토리에서 합성 가능한 그룹 목록
 * @param {Object[]} inventory - player.inv
 * @returns {{ type: string, tier: number, rarity: string, items: Object[], count: number }[]}
 */
export const getSynthesisGroups = (inventory) => {
    const groups = {};

    for (const item of inventory) {
        if (!isSynthesizable(item)) continue;
        if (item.tier >= 6) continue;
        const key = `${item.type}_${item.tier}`;
        if (!groups[key]) {
            groups[key] = { type: item.type, tier: item.tier, rarity: getItemRarity(item), items: [], count: 0 };
        }
        groups[key].items.push(item);
        groups[key].count += 1;
    }

    return Object.values(groups)
        .filter((g) => g.count >= BALANCE.SYNTHESIS_INPUT_COUNT)
        .sort((a, b) => a.tier - b.tier || a.type.localeCompare(b.type));
};
