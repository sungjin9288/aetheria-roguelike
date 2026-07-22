import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import {
    getEnhancePreview,
    getItemEnhanceBonus,
} from '../src/utils/enhancementUtils.js';
import {
    getCraftingInvestmentPreview,
    getSynthesisOutcomePreviews,
} from '../src/utils/itemInvestmentPreview.js';
import { getWeaponAttackValue } from '../src/utils/equipmentUtils.js';
import { validateSynthesis } from '../src/utils/synthesisUtils.js';

const makePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '투자 판단자',
    gold: 5_000,
    inv: [],
    ...overrides,
});

const makeEnhanceMaterials = (count) => Array.from({ length: count }, (_, index) => ({
    id: `enhance-material-${index}`,
    name: CONSTANTS.ENHANCE_MATERIAL_NAME,
    type: 'mat',
}));

test('강화 preview는 실행과 같은 비용·확률·다음 능력치를 보여 준다', () => {
    const item = { id: 'preview-sword', name: '판단의 검', type: 'weapon', val: 40, enhance: 5 };
    const materials = makeEnhanceMaterials(20);
    const preview = getEnhancePreview(item, 20_000, materials, 'weapon');

    assert.ok(preview);
    assert.equal(preview.currentLevel, 5);
    assert.equal(preview.nextLevel, 6);
    assert.equal(preview.successRate, BALANCE.ENHANCE_RATES[5]);
    assert.equal(preview.requirement.gold, BALANCE.ENHANCE_COSTS[5]);
    assert.equal(preview.requirement.materials, BALANCE.ENHANCE_MATERIAL_COSTS[5]);
    const baseAttack = getWeaponAttackValue(item, 'main');
    assert.equal(preview.currentStat, baseAttack + getItemEnhanceBonus(item, 5, 'weapon'));
    assert.equal(preview.nextStat, baseAttack + getItemEnhanceBonus(item, 6, 'weapon'));
    assert.match(preview.failureText, /강화 단계는 유지/);
    assert.match(preview.failureText, /골드와 강화 재료는 소모/);
});

test('보조 무기 강화 preview는 실제 절반 기여 규칙을 사용한다', () => {
    const item = { id: 'offhand-sword', name: '좌수검', type: 'weapon', val: 50, enhance: 2, hands: 1 };
    const preview = getEnhancePreview(item, 20_000, makeEnhanceMaterials(20), 'offhand');

    assert.ok(preview);
    assert.equal(preview.statDelta, getItemEnhanceBonus(item, 3, 'offhand') - getItemEnhanceBonus(item, 2, 'offhand'));
    assert.equal(preview.statDelta, 2);
});

test('모든 장비는 강화 단계마다 최소 1의 실제 능력치를 얻는다', () => {
    const equipment = [...DB.ITEMS.weapons, ...DB.ITEMS.armors]
        .filter((item) => ['weapon', 'armor', 'shield'].includes(item.type));

    equipment.forEach((item) => {
        const slot = item.type === 'armor' ? 'armor' : item.type === 'shield' ? 'offhand' : 'weapon';
        for (let level = 0; level < BALANCE.ENHANCE_MAX; level += 1) {
            const current = getItemEnhanceBonus(item, level, slot);
            const next = getItemEnhanceBonus(item, level + 1, slot);
            assert.ok(next > current, `${item.name} +${level} -> +${level + 1} should increase its primary stat`);
        }
    });
});

test('모든 제작법은 실제 결과 아이템의 외형·수치 preview를 제공한다', () => {
    const player = makePlayer();
    const previews = DB.ITEMS.recipes.map((recipe) => getCraftingInvestmentPreview(player, recipe));

    assert.equal(previews.length, 60);
    assert.equal(previews.filter((preview) => !preview.output).length, 0);
    assert.ok(previews.every((preview) => preview.output.statText.length > 0));
});

test('제작 가능 여부와 부족 사유는 재료·골드 상태를 그대로 반영한다', () => {
    const recipe = DB.ITEMS.recipes.find((entry) => entry.id === 'r1');
    const iron = Array.from({ length: 5 }, (_, index) => ({
        id: `iron-${index}`,
        name: '철광석',
        type: 'mat',
    }));
    const ready = getCraftingInvestmentPreview(makePlayer({ gold: 100, inv: iron }), recipe);
    const noGold = getCraftingInvestmentPreview(makePlayer({ gold: 99, inv: iron }), recipe);
    const noMaterial = getCraftingInvestmentPreview(makePlayer({ gold: 100, inv: iron.slice(0, 4) }), recipe);

    assert.equal(ready.canCraft, true);
    assert.equal(noGold.canCraft, false);
    assert.match(noGold.lockReason, /골드 부족/);
    assert.equal(noMaterial.canCraft, false);
    assert.match(noMaterial.lockReason, /철광석 4\/5/);
});

test('합성 골드가 부족해도 비용·확률·결과 후보 preview는 보존된다', () => {
    const inputs = DB.ITEMS.weapons
        .filter((item) => item.tier === 1)
        .slice(0, BALANCE.SYNTHESIS_INPUT_COUNT)
        .map((item, index) => ({ ...item, id: `synth-${index}` }));
    const validation = validateSynthesis(inputs, 0);

    assert.equal(validation.valid, false);
    assert.equal(validation.reason, 'NO_GOLD');
    assert.ok(validation.goldCost > 0);
    assert.ok(validation.successRate > 0);
    assert.ok(validation.outputs.length > 0);

    const outcomes = getSynthesisOutcomePreviews(makePlayer(), validation.outputs);
    assert.equal(outcomes.length, validation.outputs.length);
    assert.ok(outcomes.every((outcome) => outcome.statText.length > 0));
});
