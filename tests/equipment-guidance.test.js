import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SmartInventory from '../src/components/SmartInventory.tsx';
import EquipmentPanel from '../src/components/EquipmentPanel.tsx';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { findItemByName } from '../src/utils/gameUtils.ts';
import { getEquipmentDecision } from '../src/utils/equipmentUtils.ts';
import { canEquip } from '../src/utils/equipmentValidation.ts';
import { DB } from '../src/data/db.ts';
import { getCraftingInvestmentPreview } from '../src/utils/itemInvestmentPreview.ts';
import * as signature from '../src/utils/signatureSetBonus.ts';
import * as outfit from '../src/utils/jobOutfitAffinity.ts';

const item = (name, id = name) => ({ ...findItemByName(name), id });
const player = (job, equip = {}, level = 75) => ({
    ...structuredClone(INITIAL_STATE.player), job, level, equip, inv: [],
});

test('equipment panel identifies the fixed job portrait without promising worn appearance', () => {
    const html = renderToStaticMarkup(React.createElement(EquipmentPanel, {
        player: player('모험가'),
    }));
    assert.match(html, /aria-label="직업 초상 · 모험가"/);
    assert.doesNotMatch(html, /장비 외형 미리보기/);
});

test('equipment guidance shares level, job and two-hand rejection with production validation', () => {
    const tome = item('천공 성전');
    const cases = [
        [player('아크메이지', {}, 1), tome, /레벨 \d+ 필요/],
        [player('전사'), tome, /직업 제한/],
        [player('아크메이지', { weapon: item('신전 도시의 지팡이') }), tome, /양손 무기 사용 중/],
    ];
    for (const [p, gear, reason] of cases) {
        const before = structuredClone(p);
        const decision = getEquipmentDecision(p, gear);
        assert.equal(decision.equipable, canEquip(gear, p, p.equip).ok);
        assert.equal(decision.tone, 'blocked');
        assert.match(decision.recommendation, reason);
        assert.equal(decision.setContribution, 0);
        assert.deepEqual(p, before);
    }
    assert.equal(getEquipmentDecision(player('아크메이지'), tome).equipable, true);
});

test('low-level equipment can still be crafted when materials and gold are sufficient', () => {
    const recipe = DB.ITEMS.recipes.find((entry) => entry.name === '강철 롱소드');
    assert.ok(recipe);
    const p = player('전사', {}, 5);
    p.gold = recipe.gold;
    p.inv = recipe.inputs.flatMap((input) => Array.from({ length: input.qty }, (_, index) => item(input.name, `${input.name}-${index}`)));
    const preview = getCraftingInvestmentPreview(p, recipe);
    assert.equal(preview.canCraft, true, 'crafting and equip permissions are distinct');
    assert.equal(preview.output.equipmentDecision.equipable, false);
    assert.equal(preview.output.equipmentDecision.recommendation, '레벨 10 필요');
});

test('signature guidance never promises additions that discard current signature members', () => {
    for (const p of [
        player('아크메이지', { offhand: item('천공 성전') }),
        player('나이트', { offhand: item('차원 방패 이지스') }),
    ]) {
        const guidance = signature.getSignatureSetGuidance(p);
        assert.ok(guidance.nextBonus, 'the abstract tier remains defined');
        assert.deepEqual(guidance.nextItems, []);
        assert.equal(guidance.additionStatus, 'unavailable');
    }
});

test('a second copy of a one-hand signature is a real reducer completion path', () => {
    const p = player('전사', { weapon: item('성검 에테르니아', 'existing-sword') });
    const guidance = signature.getSignatureSetGuidance(p);
    assert.deepEqual(guidance.nextItems.map((entry) => entry.name), ['성검 에테르니아']);
    assert.equal(guidance.additionStatus, 'available');
    const candidate = item(guidance.nextItems[0].name, 'second-sword');
    const next = gameReducer({ ...structuredClone(INITIAL_STATE), player: { ...p, inv: [candidate] } }, {
        type: 'USE_INVENTORY_ITEM', payload: { itemId: candidate.id },
    });
    assert.equal(signature.getSignatureSetProgress(next.player.equip).currentTier, guidance.nextTier);
    assert.ok(Object.values(next.player.equip).includes(p.equip.weapon));
});

test('two-hand plus armor is offered with its actual future level requirement', () => {
    const definitions = signature.getSignatureSetDefinitions();
    const robeName = definitions.worldtree.members.find((name) => findItemByName(name)?.type === 'armor');
    const staffName = definitions.worldtree.members.find((name) => findItemByName(name)?.hands === 2);
    const robe = item(robeName);
    const high = signature.getSignatureSetGuidance(player('아크메이지', { weapon: item(staffName) }));
    assert.deepEqual(high.nextItems.map((entry) => entry.name), [robeName]);
    const low = signature.getSignatureSetGuidance(player('아크메이지', { weapon: item(staffName) }, 1));
    assert.equal(low.nextItems[0].requiredLevel, canEquip(robe, player('아크메이지', {}, 1), {}).reqLevel);
    assert.equal(low.nextItems[0].availableNow, false);
    assert.equal(signature.getSignatureSetGuidance(player('흑마법사', { weapon: item(staffName) })).additionStatus, 'unavailable');
});

test('retained gear from another job is not advertised as a current-job completion', () => {
    const guidance = signature.getSignatureSetGuidance(player('아크메이지', { weapon: item('성검 에테르니아') }));
    assert.equal(guidance.additionStatus, 'previous-job');
    assert.deepEqual(guidance.nextItems, []);
});

test('complete and empty signature states offer no unnecessary next purchase', () => {
    assert.equal(signature.getSignatureSetGuidance(player('모험가')), null);
    const guidance = signature.getSignatureSetGuidance(player('아크메이지', { weapon: item('신전 도시의 지팡이') }));
    assert.equal(guidance.nextTier, null);
    assert.deepEqual(guidance.nextItems, []);
});

test('job outfit copy measures the next threshold rather than the full set', () => {
    const hints = [0, 1, 2, 3].map((matchCount) => outfit.getJobOutfitNextHint({ matchCount }, '전사'));
    assert.match(hints[0], /1개 장착/);
    assert.match(hints[1], /1개 더 맞추면 2단계/);
    assert.match(hints[2], /1개 더 맞추면 풀세트/);
    assert.match(hints[3], /풀세트 발동/);
    assert.doesNotMatch(hints[3], /더/);
});

test('inventory offers smart equip only when a legal upgrade exists', () => {
    const p = player('전사', {}, 5);
    p.inv = [item('시간 파편 소드')];
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(SmartInventory, { player: p, actions: {} })), /추천 장착/);
    p.inv.push(item('롱소드'));
    assert.match(renderToStaticMarkup(React.createElement(SmartInventory, { player: p, actions: {} })), /추천 장착/);
});

test('rendered set panel distinguishes standalone gear from reachable duplicate weapon completion', () => {
    const render = (p) => renderToStaticMarkup(React.createElement(EquipmentPanel, {
        player: { ...p, settings: { equipmentDetailMode: 'full' } },
        stats: { jobAffinity: outfit.getJobOutfitAffinity(p) },
    }));
    const shield = render(player('나이트', { offhand: item('차원 방패 이지스') }));
    assert.match(shield, /현재 직업에서 이 세트 장비를 유지한 채/);
    assert.doesNotMatch(shield, /개 더 장착 시|필요:|2세트 대기/);
    assert.match(shield, /1개 더 맞추면 2단계/);
    const sword = render(player('전사', { weapon: item('성검 에테르니아') }));
    assert.match(sword, /후보:.*성검 에테르니아/);
    assert.match(sword, /별도의 한 자루가 필요/);
});

test('equipment surfaces consume shared restrictions and actionable signature guidance', () => {
    const panel = readFileSync(new URL('../src/components/EquipmentPanel.tsx', import.meta.url), 'utf8');
    const inventory = readFileSync(new URL('../src/components/SmartInventory.tsx', import.meta.url), 'utf8');
    const crafting = readFileSync(new URL('../src/components/tabs/CraftingPanel.tsx', import.meta.url), 'utf8');
    assert.match(panel, /getSignatureSetGuidance\(player\)/);
    assert.match(panel, /getJobOutfitNextHint\(aff, player\.job\)/);
    assert.doesNotMatch(panel, /setProgress\.missingMembers/);
    assert.match(inventory, /decision\.recommendation/);
    assert.doesNotMatch(inventory, /!canEquip.*>직업 제한</);
    assert.ok(!crafting.includes("decision.equipable ? '장착 가능' : '직업 제한'"), 'craft preview must use the shared rejection reason');
    assert.ok(crafting.includes('가정 비교'), 'unavailable craft results need an explicit hypothetical comparison');
});
