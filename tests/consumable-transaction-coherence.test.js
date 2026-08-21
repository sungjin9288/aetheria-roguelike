import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveConsumableEffect } from '../src/systems/consumableEffect.js';

const makePlayer = (overrides = {}) => ({
    name: '리베이아',
    job: '모험가',
    level: 10,
    hp: 40,
    maxHp: 100,
    mp: 10,
    maxMp: 50,
    inv: [],
    equip: {},
    relics: [],
    stats: {},
    status: [],
    tempBuff: { atk: 0, def: 0, turn: 0, name: null },
    ...overrides,
});

const resolve = (player, item) => resolveConsumableEffect({ player, item });

test('shared authority rejects every consumable under noPotion without mutation', () => {
    for (const item of [
        { id: 'hp', name: '체력 물약', type: 'hp', val: 20 },
        { id: 'mp', name: '마나 물약', type: 'mp', val: 20 },
        { id: 'cure', name: '해독제', type: 'cure', effect: 'poison' },
        { id: 'buff', name: '분노의 물약', type: 'buff', effect: 'atk_up', val: 1.3, turn: 3 },
    ]) {
        const player = makePlayer({ challengeModifiers: ['noPotion'], inv: [item], status: ['poison'] });
        const result = resolve(player, item);
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'NO_POTION');
        assert.equal(result.player, player);
    }
});

test('effectless HP MP cure and dominated buff are rejected before inventory removal', () => {
    const hp = { id: 'hp', name: '체력 물약', type: 'hp', val: 20 };
    const mp = { id: 'mp', name: '마나 물약', type: 'mp', val: 20 };
    const cure = { id: 'cure', name: '해독제', type: 'cure', effect: 'poison' };
    const buff = { id: 'buff', name: '분노의 물약', type: 'buff', effect: 'atk_up', val: 1.3, turn: 3 };

    for (const [player, item, reason] of [
        [makePlayer({ hp: 999_999, inv: [hp] }), hp, 'FULL_HP'],
        [makePlayer({ mp: 999_999, inv: [mp] }), mp, 'FULL_MP'],
        [makePlayer({ inv: [cure] }), cure, 'STATUS_ABSENT'],
        [makePlayer({ inv: [buff], tempBuff: { atk: 0.3, def: 0, turn: 5, name: '기존 강화' } }), buff, 'BUFF_DOMINATED'],
    ]) {
        const result = resolve(player, item);
        assert.equal(result.ok, false);
        assert.equal(result.reason, reason);
        assert.equal(result.player, player);
    }
});

test('malformed consumables fail closed and never remove a duplicate selected instance', () => {
    const malformed = [
        { id: 'nan', name: '오염 물약', type: 'hp', val: Number.NaN },
        { id: 'infinity', name: '오염 물약', type: 'mp', val: Infinity },
        { id: 'zero', name: '오염 물약', type: 'hp', val: 0 },
        { id: 'bad-cure', name: '오염 치료약', type: 'cure', effect: 'bleed' },
        { id: 'bad-buff-value', name: '오염 강화제', type: 'buff', effect: 'atk_up', val: 1, turn: 3 },
        { id: 'bad-buff-turn', name: '오염 강화제', type: 'buff', effect: 'atk_up', val: 1.3, turn: 0 },
        { id: 'malformed-full', name: '엘릭서', type: 'hp', val: 'MAX' },
        { id: 'unknown', name: '오염 아이템', type: 'material', val: 1 },
    ];

    for (const item of malformed) {
        const player = makePlayer({ inv: [item] });
        const result = resolve(player, item);
        assert.equal(result.ok, false, item.id);
        assert.equal(result.player, player, item.id);
    }
});

test('legacy canonical Elixir restores calculated effective max HP without rewriting its schema', () => {
    const elixir = { id: 'legacy-elixir', name: '엘릭서', type: 'hp', val: 1 };
    const player = makePlayer({ hp: 1, maxHp: 100, equip: { armor: { hpBonus: 50 } }, inv: [elixir] });

    const result = resolve(player, elixir);

    assert.equal(result.ok, true);
    assert.ok(result.player.hp > player.maxHp);
    assert.equal(result.player.inv.length, 0);
    assert.equal(elixir.val, 1);
    assert.equal(elixir.name, '엘릭서');
});

test('a useful buff trade-off remains consumable and removes exactly one matching instance', () => {
    const first = { id: 'same-id', name: '수호의 물약', type: 'buff', effect: 'def_up', val: 1.3, turn: 3 };
    const second = { ...first, name: '중복 수호의 물약' };
    const player = makePlayer({
        inv: [first, second],
        tempBuff: { atk: 0.4, def: 0, turn: 5, name: '공격 강화' },
    });

    const result = resolve(player, first);

    assert.equal(result.ok, true);
    assert.equal(result.player.inv.length, 1);
    assert.equal(result.player.inv[0], second);
    assert.equal(result.player.tempBuff.atk, 0);
    assert.ok(Math.abs(result.player.tempBuff.def - 0.3) < Number.EPSILON);
    assert.equal(result.player.tempBuff.turn, 3);
    assert.equal(result.player.tempBuff.name, '수호의 물약');
});

test('stronger or longer same-stat buffs remain useful and are accepted', () => {
    for (const item of [
        { id: 'stronger', name: '강한 분노의 물약', type: 'buff', effect: 'atk_up', val: 1.5, turn: 3 },
        { id: 'longer', name: '긴 분노의 물약', type: 'buff', effect: 'atk_up', val: 1.3, turn: 6 },
    ]) {
        const result = resolve(makePlayer({
            inv: [item],
            tempBuff: { atk: 0.3, def: 0, turn: 5, name: '기존 강화' },
        }), item);
        assert.equal(result.ok, true, item.id);
    }
});
