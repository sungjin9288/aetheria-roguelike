import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import signatureRegistry from '../src/data/signatureRegistry.json' with { type: 'json' };
import signatureSets from '../src/data/signatureSets.json' with { type: 'json' };
import { getSignatureBaseName, isSignatureItem } from '../src/data/signatureItems.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { resolveConsumableEffect } from '../src/systems/consumableEffect.js';
import { getEquipmentComparison, getEquipmentProfile, getItemStatText } from '../src/utils/equipmentUtils.js';
import { formatOutfitBonus, getJobOutfitAffinity, getJobOutfitNextHint } from '../src/utils/jobOutfitAffinity.js';
import { computeSignatureSetBonus, getSignatureSetEquippedCounts, getSignatureSetProgress } from '../src/utils/signatureSetBonus.js';
import { getSignatureSaleVerdict } from '../src/utils/signatureSale.js';
import { countDiscoveredSignatures, makeItem, registerLootToCodex } from '../src/utils/gameUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 58 — 장비 부가 효과 · 문구 설명대로.
 *   접두어가 붙은 전설 각인은 그 전설 각인이고, 세트 구성원 · 도감 세트 줄 · 직업 세트 안내 · 보조 손 · 쌍수 · 엘릭서 문구가
 *   엔진과 같아야 한다.
 */

const item = (name, extra = {}) => {
    const found = [...DB.ITEMS.weapons, ...DB.ITEMS.armors, ...DB.ITEMS.consumables].find((entry) => entry.name === name);
    assert.ok(found, name);
    return { ...makeItem(found, () => 0.5, () => 1), ...extra };
};
const prefixed = (name, prefixName = '날카로운') => {
    const base = item(name);
    return { ...base, name: `${prefixName} ${base.name}`, prefixed: true, prefixName, baseItemName: base.name };
};
const player = (job, equip = {}, extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '시험자', job, level: 60, atk: 100, def: 50, maxHp: 1_000, hp: 1_000, maxMp: 200, mp: 200,
    equip: { weapon: null, armor: null, offhand: null, ...equip }, relics: [], inv: [], ...extra,
});

test('접두어가 붙은 전설 각인도 전설 각인이다 — 세트 효과 · 판정 · 도감', () => {
    const sharp = prefixed('라그나로크');
    assert.equal(getSignatureBaseName(sharp), '라그나로크');
    assert.equal(isSignatureItem(sharp), true);
    // 이름이 "접두어 바탕"이 아니면 인정하지 않는다.
    assert.equal(isSignatureItem({ ...sharp, name: '라그나로크 모조품' }), false);
    assert.equal(isSignatureItem({ ...sharp, baseItemName: '용의 화염' }), false);

    const armor = item('드래곤로드 갑주');
    const plain = computeSignatureSetBonus({ weapon: item('라그나로크'), armor, offhand: null });
    const withPrefix = computeSignatureSetBonus({ weapon: sharp, armor, offhand: null });
    assert.ok(plain.activeSet);
    assert.deepEqual(withPrefix.activeSet, plain.activeSet);
    assert.deepEqual(getSignatureSetProgress({ weapon: sharp, armor, offhand: null }).missingMembers, ['용의 화염']);

    const discovered = registerLootToCodex(player('버서커'), [sharp]);
    assert.equal(countDiscoveredSignatures(discovered), 1, '바탕 전설 각인을 발견한 것으로 남는다');
});

test('전설 각인 판매 — 접두어 사본과 원본은 같은 각인의 사본이다', () => {
    const sharp = prefixed('라그나로크');
    const original = item('라그나로크');
    const owner = player('버서커', { weapon: original }, { inv: [sharp] });
    assert.deepEqual(getSignatureSaleVerdict(sharp, owner), { sellable: true, reason: 'duplicate' });
    assert.deepEqual(getSignatureSaleVerdict(sharp, player('버서커', {}, { inv: [sharp] })), { sellable: false, reason: 'protected' });
});

test('세트 구성원은 레지스트리의 setGroup과 같은 집합이다', () => {
    const fromRegistry = {};
    for (const [name, meta] of Object.entries(signatureRegistry.entries)) {
        if (!meta.setGroup) continue;
        (fromRegistry[meta.setGroup] ||= []).push(name);
    }
    for (const [key, set] of Object.entries(signatureSets.sets)) {
        assert.deepEqual([...set.members].sort(), [...(fromRegistry[key] || [])].sort(), key);
    }
    assert.deepEqual(Object.keys(fromRegistry).sort(), Object.keys(signatureSets.sets).sort());
});

test('전설 도감의 세트 줄은 엔진 계산(장착 수 · 발동 단계)을 그린다', () => {
    const greatsword = item('에테르 거인의 대검');
    const equip = { weapon: greatsword, armor: null, offhand: null };
    const engine = computeSignatureSetBonus(equip);
    assert.equal(engine.activeSet?.key, 'celestial');
    assert.equal(getSignatureSetEquippedCounts(equip).celestial, 2, '양손 각인은 2피스');
    const html = renderStatic(createElement(LegendaryCodex, { player: player('전사', equip) }));
    assert.ok(html.includes('장착 2'), '엔진과 같은 장착 수');
    assert.ok(html.includes(engine.activeSet.desc), '엔진이 켠 단계의 효과');
});

test('직업 장비 세트 안내는 다음 단계의 모든 보너스(생명 · 기력 포함)를 말한다', () => {
    const hint1 = getJobOutfitNextHint({ matchCount: 1 }, '나이트');
    const hint2 = getJobOutfitNextHint({ matchCount: 2 }, '나이트');
    for (const hint of [hint1, hint2]) {
        assert.match(hint, new RegExp(MSG.OUTFIT_BONUS_LABELS.hp));
        assert.match(hint, new RegExp(MSG.OUTFIT_BONUS_LABELS.mp));
    }
    // 실제 3/3 보너스와 문구가 같은 표에서 나온다.
    const weapon = DB.ITEMS.weapons.find((w) => w.jobs?.includes('나이트') && (w.hands ?? 1) === 1);
    const armor = DB.ITEMS.armors.find((a) => a.type === 'armor' && a.jobs?.includes('나이트'));
    const shield = DB.ITEMS.armors.find((a) => a.type === 'shield' && a.jobs?.includes('나이트'));
    const full = getJobOutfitAffinity(player('나이트', { weapon, armor, offhand: shield }));
    assert.equal(full.tier, 'full');
    assert.ok(hint2.includes(formatOutfitBonus(full.bonus)));
});

test('접두어가 붙은 엘릭서도 "HP 완전 회복"이다', () => {
    const base = item('엘릭서');
    const holy = { ...base, id: 'e1', name: `신성한 ${base.name}`, prefixed: true, prefixName: '신성한', val: base.val + 7 };
    const huge = player('전사', {}, { maxHp: 30_000, hp: 1, inv: [holy] });
    const max = calculateFullStats(huge).maxHp;
    assert.ok(max > holy.val + 1, '엘릭서 수치보다 큰 최대 생명');
    const result = resolveConsumableEffect({ player: huge, item: holy });
    assert.equal(result.ok, true);
    assert.equal(result.player.hp, max);
});

test('보조 손에 낀 한손 무기 문구는 보조 손 기여를 그린다', () => {
    const oneHand = DB.ITEMS.weapons.find((w) => (w.hands ?? 1) === 1 && typeof w.crit !== 'number' && (w.val || 0) > 50);
    const off = { ...item(oneHand.name), enhance: 3 };
    const profile = getEquipmentProfile({ weapon: item(oneHand.name), armor: null, offhand: off });
    const mainText = getItemStatText(off);
    const offText = getItemStatText(off, 'offhand');
    assert.notEqual(mainText, offText);
    const shown = Number(/공격력 \+(\d+)/.exec(offText)[1]);
    assert.ok(shown > profile.offhandAttack, '보조 손 비율 + 강화');
    assert.ok(shown < Number(/공격력 \+(\d+)/.exec(mainText)[1]));
    assert.match(offText, new RegExp(`치명타 \\+${Math.round(BALANCE.OFFHAND_ONE_HAND_CRIT_BONUS * 100)}%`));
});

test('양손 무기 · 방어구 문구는 없는 효과를 말하지 않는다', () => {
    const twoHand = DB.ITEMS.weapons.find((w) => w.hands === 2);
    assert.doesNotMatch(getItemStatText(item(twoHand.name)), /강한 일격/);
    const elemArmor = DB.ITEMS.armors.find((a) => a.type === 'armor' && a.elem && a.name !== '원시의 이지스');
    assert.doesNotMatch(getItemStatText(item(elemArmor.name)), /속성/);
});

test('두 번째 한손 무기 비교 칩은 쌍수 배율(방어력 감소 포함)을 함께 말한다', () => {
    const oneHand = DB.ITEMS.weapons.find((w) => (w.hands ?? 1) === 1 && w.jobs?.includes('도적'));
    const owner = player('도적', { weapon: item(oneHand.name) });
    const comparison = getEquipmentComparison(owner, item(oneHand.name));
    const atkPct = Math.round((BALANCE.DUAL_WIELD_ATK_BONUS - 1) * 100);
    const defPct = Math.round((1 - BALANCE.DUAL_WIELD_DEF_MULT) * 100);
    assert.equal(comparison.dualWieldNote, MSG.EQUIP_DUAL_WIELD_ON(atkPct, defPct));
    assert.ok(comparison.summaryText.includes(comparison.dualWieldNote));
    const single = getEquipmentComparison(player('도적'), item(oneHand.name));
    assert.equal(single.dualWieldNote, null, '첫 무기는 쌍수가 아니다');
});
