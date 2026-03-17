import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGraveData, resolveGraveRecovery } from '../src/utils/graveUtils.js';

const BASE_PLAYER = {
    name: '',
    job: '모험가',
    level: 1,
    hp: 150,
    maxHp: 150,
    mp: 50,
    maxMp: 50,
    atk: 10,
    def: 5,
    exp: 0,
    nextExp: 100,
    gold: 100,
    loc: '시작의 마을',
    inv: [],
    equip: { weapon: null, armor: null, offhand: null },
    quests: [],
    achievements: [],
    stats: { kills: 0, total_gold: 0, deaths: 0 },
    tempBuff: { atk: 0, turn: 0 },
    status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
    meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
    relics: [],
    titles: [],
    activeTitle: null,
    combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
    history: [],
    archivedHistory: []
};

test('grave creation keeps half the gold and one to two non-starter items', () => {
    const player = {
        ...BASE_PLAYER,
        name: '리아',
        gold: 199,
        loc: '고요한 숲',
        inv: [
            { id: 'starter_1', name: '하급 포션', type: 'consumable' },
            { id: 'wand_1', name: '호신용 지팡이', type: 'weapon' },
            { id: 'robe_1', name: '천 로브', type: 'armor' },
            { id: 'ring_1', name: '자연의 결정', type: 'material' },
        ],
    };

    const result = buildGraveData(player, () => 0.9, () => 12345);

    assert.equal(result.loc, '고요한 숲');
    assert.equal(result.gold, 99);
    assert.equal(result.timestamp, 12345);
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((item) => !item.id.startsWith('starter_')));
    assert.deepEqual(result.item, result.items[0]);
});

test('lootGrave restores stored gold and all dropped items before clearing the grave', () => {
    const player = {
        ...BASE_PLAYER,
        gold: 25,
        inv: [],
        stats: { ...(BASE_PLAYER.stats || {}) },
    };
    const grave = {
        loc: '고요한 숲',
        gold: 40,
        items: [
            { name: '녹슨 단검', type: 'weapon', price: 50 },
            { name: '천 로브', type: 'armor', price: 40 },
        ],
        timestamp: 987654321,
    };

    const result = resolveGraveRecovery(player, grave);

    assert.equal(result.updatedPlayer.gold, 65);
    assert.equal(result.updatedPlayer.inv.length, 2);
    assert.deepEqual(result.updatedPlayer.inv.map((item) => item.name), ['녹슨 단검', '천 로브']);
    assert.ok(result.updatedPlayer.inv.every((item) => typeof item.id === 'string' && item.id.length > 0));
    assert.match(result.logMsg, /유해 회수: 40G 획득/);
    assert.match(result.logMsg, /녹슨 단검/);
    assert.match(result.logMsg, /천 로브/);
});

test('grave recovery supports legacy single-item graves', () => {
    const player = {
        ...BASE_PLAYER,
        gold: 10,
        inv: [],
        stats: { ...(BASE_PLAYER.stats || {}) },
    };
    const grave = {
        loc: '고요한 숲',
        gold: 15,
        item: { name: '호신용 지팡이', type: 'weapon', price: 55 },
        timestamp: 123,
    };

    const result = resolveGraveRecovery(player, grave);

    assert.equal(result.updatedPlayer.gold, 25);
    assert.equal(result.updatedPlayer.inv.length, 1);
    assert.equal(result.updatedPlayer.inv[0].name, '호신용 지팡이');
    assert.match(result.logMsg, /호신용 지팡이/);
});
