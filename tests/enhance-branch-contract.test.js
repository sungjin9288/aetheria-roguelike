import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * 강화 갈래 계약 (2026-11 H6, 실행 스케치 EXECUTION_SKETCH_H6_2026-11.md §4 · §5 커밋 1).
 *
 * - 갈래는 `BALANCE.ENHANCE_BRANCH_LEVELS` 단계에서만, 장비 종류마다 서로 다른 효과 둘이다.
 * - 리듀서는 갈래 단계로 가는 강화를 고른 갈래와 함께만 받고(비용을 쓰기 전에 거부), 실패하면 갈래도 붙이지 않는다.
 * - 효과 = 엔진 실측: 갈래의 몫은 같은 값을 엔진의 다른 입력에 넣었을 때와 같다(`calculateFullStats` · `tickCombatState`).
 * - 장착하지 않은 장비의 갈래는 효과가 없고, 사망 · 계승은 장비와 함께 갈래를 넘기지 않는다.
 * - 이전 세이브(갈래 없이 +3 이상)는 다음 골드 강화가 건너뛴 단계까지 고르게 한다. 위조 값은 읽지 않는다.
 */

import { BALANCE } from '../src/data/constants.js';
import { ENHANCE_BRANCHES, ENHANCE_BRANCH_IDS } from '../src/data/enhanceBranches.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { equipmentActionMap } from '../src/reducers/handlers/equipmentHandlers.js';
import { createInventoryActions } from '../src/hooks/useInventoryActions.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import {
    getEnhanceBranchOptions,
    getItemEnhanceBranches,
    getOwedEnhanceBranchLevels,
    resolveEnhanceBranchChoices,
} from '../src/utils/enhanceBranch.js';
import { getEnhanceBranchStages, getEnhanceBranchSummary } from '../src/utils/enhanceBranchView.js';
import { getEquipmentIdentity, getEquipmentProfile } from '../src/utils/equipmentUtils.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { makePlayerFixture } from './helpers/render.ts';

const WEAPON = { id: 'w-1', name: '강철 롱소드', type: 'weapon', val: 100, tier: 2 };
const ARMOR = { id: 'a-1', name: '가죽 갑옷', type: 'armor', val: 100, tier: 1 };
const SHIELD = { id: 's-1', name: '철제 방패', type: 'shield', val: 15, tier: 2 };
const MATERIAL = { id: 'mat', name: '강화 재료', type: 'mat' };

const makePlayer = (equip = {}, overrides = {}) => makePlayerFixture({
    gold: 1_000_000,
    level: 30,
    maxHp: 1000,
    hp: 400,
    maxMp: 200,
    mp: 200,
    inv: Array.from({ length: 10 }, (_, index) => ({ ...MATERIAL, id: `mat-${index}` })),
    equip: { weapon: null, armor: null, offhand: null, ...equip },
    ...overrides,
});

const makeState = (player) => ({ player, gameState: 'idle', logs: [], quickSlots: [null, null, null], syncStatus: 'synced' });

const enhanceAction = (player, slot, roll, branches) => {
    const item = player.equip[slot];
    return {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: item.id,
            slot,
            expectedItemIdentity: getEquipmentIdentity(item),
            expectedLevel: item.enhance || 0,
            expectedGold: player.gold,
            roll,
            relicRoll: 0.5,
            ...(branches === undefined ? {} : { branches }),
        },
    };
};

const enhance = (player, slot, roll, branches) => (
    equipmentActionMap.ENHANCE_ITEM(makeState(player), enhanceAction(player, slot, roll, branches))
);

test('갈래는 갈래 단계에서만, 장비 종류 × 단계마다 효과가 다른 둘이다', () => {
    const levels = BALANCE.ENHANCE_BRANCH_LEVELS;
    assert.deepEqual([...levels], [3, 6]);
    for (const id of ENHANCE_BRANCH_IDS) assert.ok(levels.includes(ENHANCE_BRANCHES[id].level), id);
    for (const kind of ['weapon', 'armor', 'offhand']) {
        for (const level of levels) {
            const options = getEnhanceBranchOptions(kind, level);
            assert.equal(options.length, 2, `${kind} +${level}`);
            assert.notEqual(ENHANCE_BRANCHES[options[0]].stat, ENHANCE_BRANCHES[options[1]].stat, `${kind} +${level}`);
            assert.ok(options.every((id) => ENHANCE_BRANCHES[id].value > 0));
        }
        for (const level of [1, 2, 4, 5, 7, 10]) assert.deepEqual(getEnhanceBranchOptions(kind, level), [], `${kind} +${level}`);
    }
});

test('갈래 단계로 가는 강화는 고른 갈래 없이는 비용을 쓰지 않고 거부된다', () => {
    const player = makePlayer({ weapon: { ...WEAPON, enhance: 2 } });
    for (const branches of [undefined, [], ['armor_guard_3'], ['weapon_edge_6'], ['weapon_edge_3', 'weapon_edge_6'], ['nope']]) {
        const next = enhance(player, 'weapon', 0, branches);
        assert.equal(next.player.gold, player.gold, JSON.stringify(branches));
        assert.equal(next.player.inv.length, player.inv.length);
        assert.equal(next.player.equip.weapon.enhance, 2);
        assert.equal(next.player.equip.weapon.enhanceBranches, undefined);
    }
    const rejected = enhance(player, 'weapon', 0, undefined);
    assert.ok(rejected.logs.some((log) => log.text === MSG.ENHANCE_BRANCH_REQUIRED));
});

test('갈래 단계가 아닌 강화에 보낸 갈래는 거부된다', () => {
    const player = makePlayer({ weapon: { ...WEAPON, enhance: 0 } });
    const next = enhance(player, 'weapon', 0, ['weapon_edge_3']);
    assert.equal(next.player.gold, player.gold);
    assert.equal(next.player.equip.weapon.enhance, 0);
    assert.equal(enhance(player, 'weapon', 0, undefined).player.equip.weapon.enhance, 1);
});

test('성공하면 단계와 갈래가 함께 붙고, 실패하면 비용만 쓰고 갈래는 붙지 않는다', () => {
    const player = makePlayer({ weapon: { ...WEAPON, enhance: 2 } });
    const won = enhance(player, 'weapon', 0, ['weapon_vital_3']);
    assert.equal(won.player.equip.weapon.enhance, 3);
    assert.deepEqual(won.player.equip.weapon.enhanceBranches, ['weapon_vital_3']);
    assert.ok(won.player.gold < player.gold);

    const lost = enhance(player, 'weapon', 0.999, ['weapon_vital_3']);
    assert.ok(lost.player.gold < player.gold);
    assert.equal(lost.player.equip.weapon.enhance, 2);
    assert.equal(lost.player.equip.weapon.enhanceBranches, undefined);

    // 같은 갈래 단계를 다시 시도할 수 있다(실패해 갈래가 없으므로 여전히 골라야 한다).
    assert.deepEqual(getOwedEnhanceBranchLevels(lost.player.equip.weapon, 3), [3]);
});

test('가방의 장비도 같은 규칙으로 갈래를 받는다', () => {
    const bagWeapon = { ...WEAPON, id: 'bag-w', enhance: 2 };
    const player = makePlayer({}, { inv: [bagWeapon, MATERIAL] });
    const action = {
        type: AT.ENHANCE_ITEM,
        payload: {
            itemId: 'bag-w', expectedItemIdentity: getEquipmentIdentity(bagWeapon), expectedLevel: 2,
            expectedGold: player.gold, roll: 0, relicRoll: 0.5, branches: ['weapon_edge_3'],
        },
    };
    const next = equipmentActionMap.ENHANCE_ITEM(makeState(player), action);
    const item = next.player.inv.find((entry) => entry.id === 'bag-w');
    assert.equal(item.enhance, 3);
    assert.deepEqual(item.enhanceBranches, ['weapon_edge_3']);
});

test('건너뛴 갈래 단계(이전 세이브 · 무료 강화)는 다음 골드 강화가 순서대로 함께 고르게 한다', () => {
    const legacy = { ...ARMOR, enhance: 5 };
    assert.deepEqual(getItemEnhanceBranches(legacy), []);
    assert.deepEqual(getOwedEnhanceBranchLevels(legacy, 6), [3, 6]);
    assert.equal(resolveEnhanceBranchChoices(legacy, 6, ['armor_guard_6']), null);
    assert.equal(resolveEnhanceBranchChoices(legacy, 6, ['armor_guard_6', 'armor_guard_3']), null);
    assert.deepEqual(resolveEnhanceBranchChoices(legacy, 6, ['armor_vigor_3', 'armor_guard_6']), ['armor_vigor_3', 'armor_guard_6']);

    const player = makePlayer({ armor: legacy });
    const won = enhance(player, 'armor', 0, ['armor_vigor_3', 'armor_guard_6']);
    assert.equal(won.player.equip.armor.enhance, 6);
    assert.deepEqual(won.player.equip.armor.enhanceBranches, ['armor_vigor_3', 'armor_guard_6']);
    // 이전 세이브의 +4 장비가 +5로 갈 때도 +3 갈래 하나를 고른다.
    assert.deepEqual(getOwedEnhanceBranchLevels({ ...ARMOR, enhance: 4 }, 5), [3]);
});

test('맞지 않는 저장 값(다른 종류 · 순서 · 아직 닿지 않은 단계 · 모르는 id)은 읽지 않는다', () => {
    assert.deepEqual(getItemEnhanceBranches({ ...WEAPON, enhance: 9, enhanceBranches: ['armor_guard_3'] }), []);
    assert.deepEqual(getItemEnhanceBranches({ ...WEAPON, enhance: 9, enhanceBranches: ['weapon_edge_6'] }), []);
    assert.deepEqual(getItemEnhanceBranches({ ...WEAPON, enhance: 2, enhanceBranches: ['weapon_edge_3'] }), []);
    assert.deepEqual(getItemEnhanceBranches({ ...WEAPON, enhance: 9, enhanceBranches: ['x', 'weapon_edge_6'] }), []);
    assert.deepEqual(getItemEnhanceBranches({ ...WEAPON, enhance: 9, enhanceBranches: ['weapon_edge_3', 'weapon_edge_3'] }), ['weapon_edge_3']);
    assert.deepEqual(getItemEnhanceBranches({ ...SHIELD, enhance: 9, enhanceBranches: ['offhand_mend_3', 'offhand_focus_6'] }), ['offhand_mend_3', 'offhand_focus_6']);
});

test('효과 = 엔진 실측: 갈래의 몫은 같은 값을 엔진의 다른 입력에 넣었을 때와 같다', () => {
    const weapon3 = { ...WEAPON, enhance: 3 };
    const base = makePlayer({ weapon: weapon3, armor: { ...ARMOR, enhance: 3 }, offhand: { ...SHIELD, enhance: 3 } });
    const baseStats = calculateFullStats(base);
    const withEquip = (slot, branches) => makePlayer({ ...base.equip, [slot]: { ...base.equip[slot], enhanceBranches: branches } });

    const mainAttack = getEquipmentProfile(base.equip).mainAttack;
    const edge = calculateFullStats(withEquip('weapon', ['weapon_edge_3']));
    const flatAtk = calculateFullStats({ ...base, atk: (base.atk || 0) + Math.floor(mainAttack * 0.06) });
    assert.ok(Math.floor(mainAttack * 0.06) > 0);
    assert.equal(edge.atk, flatAtk.atk);
    assert.ok(edge.atk > baseStats.atk);

    const vital = calculateFullStats(withEquip('weapon', ['weapon_vital_3']));
    assert.ok(Math.abs(vital.critChance - baseStats.critChance - 0.04) < 1e-9);
    assert.equal(vital.atk, baseStats.atk);

    const guard = calculateFullStats(withEquip('armor', ['armor_guard_3']));
    const flatDef = calculateFullStats({ ...base, def: (base.def || 0) + Math.floor(ARMOR.val * 0.1) });
    assert.equal(guard.def, flatDef.def);
    assert.ok(guard.def > baseStats.def);

    const vigor = calculateFullStats(withEquip('armor', ['armor_vigor_3']));
    const flatHp = calculateFullStats({ ...base, maxHp: base.maxHp + Math.floor(base.maxHp * 0.05) });
    assert.equal(vigor.maxHp, flatHp.maxHp);
    assert.ok(vigor.maxHp > baseStats.maxHp);

    const focus = calculateFullStats(withEquip('offhand', ['offhand_focus_3']));
    const flatMp = calculateFullStats({ ...base, maxMp: base.maxMp + Math.floor(base.maxMp * 0.1) });
    assert.equal(focus.maxMp, flatMp.maxMp);
    assert.ok(focus.maxMp > baseStats.maxMp);

    const mend = withEquip('offhand', ['offhand_mend_3']);
    assert.ok(Math.abs(calculateFullStats(mend).equipRegenPerTurn - 0.01) < 1e-9);
    const healed = CombatEngine.tickCombatState(mend).updatedPlayer;
    const unhealed = CombatEngine.tickCombatState(base).updatedPlayer;
    assert.equal(healed.hp - unhealed.hp, Math.floor(base.maxHp * 0.01));
});

test('장착하지 않은 장비의 갈래는 효과가 없다', () => {
    const bag = { ...WEAPON, id: 'bag', enhance: 6, enhanceBranches: ['weapon_edge_3', 'weapon_edge_6'] };
    const without = makePlayer({}, { inv: [] });
    const withBag = makePlayer({}, { inv: [bag] });
    assert.deepEqual(calculateFullStats(withBag), calculateFullStats(without));
});

test('사망 · 계승은 장비와 함께 갈래를 넘기지 않는다', () => {
    const branched = { ...WEAPON, enhance: 3, enhanceBranches: ['weapon_edge_3'] };
    const player = makePlayer({ weapon: branched }, { inv: [{ ...branched, id: 'bag' }] });
    for (const kind of ['death', 'ascension']) {
        const kept = pickPermanentPlayerState(player, makePlayerFixture(), kind);
        assert.equal(kept.equip, undefined, kind);
        assert.equal(kept.inv, undefined, kind);
        assert.ok(!JSON.stringify(kept).includes('weapon_edge_3'), kind);
    }
});

test('화면 뷰모델: 장착 장비는 갈래마다 엔진 수치(전 → 뒤), 가방 장비는 효과 문구만', () => {
    const weapon = { ...WEAPON, enhance: 2 };
    const player = makePlayer({ weapon });
    const [stage] = getEnhanceBranchStages(player, weapon, 'weapon');
    assert.equal(stage.level, 3);
    assert.deepEqual(stage.options.map((option) => option.id), ['weapon_edge_3', 'weapon_vital_3']);
    const after = calculateFullStats(makePlayer({ weapon: { ...weapon, enhance: 3, enhanceBranches: ['weapon_edge_3'] } }));
    const before = calculateFullStats(makePlayer({ weapon: { ...weapon, enhance: 3 } }));
    assert.deepEqual(stage.options[0].change, { label: MSG.ENHANCE_BRANCH_STAT_LABELS.atkPct, before: String(before.atk), after: String(after.atk) });
    assert.notEqual(stage.options[1].change.before, stage.options[1].change.after);

    const bag = { ...WEAPON, id: 'bag', enhance: 2 };
    const bagStages = getEnhanceBranchStages(makePlayer({}, { inv: [bag] }), bag, null);
    assert.equal(bagStages.length, 1);
    assert.ok(bagStages[0].options.every((option) => option.change === null && option.effect.length > 0));

    assert.deepEqual(getEnhanceBranchStages(player, { ...WEAPON, enhance: 3, enhanceBranches: ['weapon_edge_3'] }, 'weapon'), []);
    assert.deepEqual(getEnhanceBranchStages(player, { ...WEAPON, enhance: 0 }, 'weapon'), []);
    assert.deepEqual(getEnhanceBranchStages(player, { ...ARMOR, enhance: 5 }, null).map((s) => s.level), [3, 6]);

    assert.equal(getEnhanceBranchSummary({ ...WEAPON, enhance: 2 }), null);
    assert.equal(
        getEnhanceBranchSummary({ ...WEAPON, enhance: 3, enhanceBranches: ['weapon_edge_3'] }),
        MSG.ENHANCE_BRANCH_CHOSEN([MSG.ENHANCE_BRANCH_CHOSEN_ITEM(3, MSG.ENHANCE_BRANCH_NAMES.atkPct, MSG.ENHANCE_BRANCH_EFFECT('atkPct', 0.06))]),
    );
});

test('강화 훅은 고른 갈래를 그대로 보내고, 없으면 필드를 싣지 않는다', () => {
    const dispatched = [];
    const player = makePlayer({ weapon: { ...WEAPON, enhance: 2 } });
    const actions = createInventoryActions({
        player, gameState: 'idle', dispatch: (action) => dispatched.push(action),
        addLog: () => {}, addStoryLog: () => {}, getFullStats: () => ({}),
    });
    actions.enhanceItem('w-1', ['weapon_edge_3']);
    actions.enhanceItem('w-1');
    assert.deepEqual(dispatched[0].payload.branches, ['weapon_edge_3']);
    assert.ok(!('branches' in dispatched[1].payload));
});
