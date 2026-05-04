import test from 'node:test';
import assert from 'node:assert/strict';

import {
    toArray,
    getItemRarity,
    makeItem,
    findItemByName,
    getDailyProtocolCompletions,
    formatDailyProtocolReward,
    formatRewardParts,
    getTitleLabel,
    getTitleColor,
    grantGold,
    getAchievementCurrentValue,
    isAchievementUnlocked,
    checkMilestones,
    registerCodex,
    registerLootToCodex,
} from '../src/utils/gameUtils.js';

// ─── toArray ────────────────────────────────────────────────────────────
test('toArray returns the original array or an empty array fallback', () => {
    assert.deepEqual(toArray([1, 2, 3]), [1, 2, 3]);
    assert.deepEqual(toArray(null), []);
    assert.deepEqual(toArray(undefined), []);
    assert.deepEqual(toArray('string'), []);
    assert.deepEqual(toArray({ a: 1 }), []);
});

// ─── Item rarity / makeItem ─────────────────────────────────────────────
test('getItemRarity prefers explicit rarity, then tier mapping, then common', () => {
    assert.equal(getItemRarity({ rarity: 'epic', tier: 1 }), 'epic');
    assert.equal(getItemRarity({ tier: 2 }), 'uncommon');
    assert.equal(getItemRarity({ tier: 5 }), 'legendary');
    assert.equal(getItemRarity({ tier: 6 }), 'legendary');
    assert.equal(getItemRarity({}), 'common');
    assert.equal(getItemRarity(null), 'common');
});

test('makeItem preserves template fields and adds a unique id', () => {
    const template = { name: 'Sword', type: 'weapon', val: 10 };
    const a = makeItem(template);
    const b = makeItem(template);

    assert.equal(a.name, 'Sword');
    assert.equal(a.val, 10);
    assert.ok(a.id);
    assert.ok(b.id);
    assert.notEqual(a.id, b.id);
    // Ensure template is untouched
    assert.equal(template.id, undefined);
});

// ─── findItemByName ─────────────────────────────────────────────────────
test('findItemByName retrieves an item from the global DB', () => {
    const potion = findItemByName('하급 체력 물약');
    assert.ok(potion);
    assert.equal(potion.name, '하급 체력 물약');

    assert.equal(findItemByName('존재하지 않는 아이템'), undefined);
});

// ─── Daily protocol helpers ─────────────────────────────────────────────
test('getDailyProtocolCompletions returns only missions that will finish now', () => {
    const player = {
        stats: {
            dailyProtocol: {
                missions: [
                    { id: 'kills', type: 'kills', progress: 9, goal: 10, done: false },
                    { id: 'explores', type: 'explores', progress: 2, goal: 5, done: false },
                    { id: 'goldSpend', type: 'goldSpend', progress: 10, goal: 10, done: true }, // already done
                ],
            },
        },
    };

    const completed = getDailyProtocolCompletions(player, 'kills', 1);
    assert.equal(completed.length, 1);
    assert.equal(completed[0].id, 'kills');

    // not enough progress yet
    assert.equal(getDailyProtocolCompletions(player, 'explores', 1).length, 0);
    // already done → excluded
    assert.equal(getDailyProtocolCompletions(player, 'goldSpend', 100).length, 0);
});

test('formatDailyProtocolReward summarizes reward payload', () => {
    assert.equal(formatDailyProtocolReward({ essence: 50 }), '에센스 50');
    assert.equal(formatDailyProtocolReward({ item: '체력 물약' }), '체력 물약');
    assert.equal(formatDailyProtocolReward({ relicShard: 2 }), '유물 조각 2');
    assert.equal(formatDailyProtocolReward({}), '보상');
});

test('formatRewardParts returns an array of labeled reward segments', () => {
    const parts = formatRewardParts({ exp: 10, gold: 30, item: '아이템' });
    assert.deepEqual(parts, ['EXP 10', '30G', '아이템']);
    assert.deepEqual(formatRewardParts({}), []);
});

// ─── Titles ─────────────────────────────────────────────────────────────
test('getTitleLabel returns empty for null and string fallback for unknown', () => {
    assert.equal(getTitleLabel(null), '');
    assert.equal(getTitleLabel(undefined), '');
    // unknown titles stringify to their id
    assert.equal(getTitleLabel('unknown_title_xyz'), 'unknown_title_xyz');
});

test('getTitleColor returns a tailwind class string for known or unknown tokens', () => {
    const color = getTitleColor('unknown_token');
    assert.ok(typeof color === 'string' && color.length > 0);
});

// ─── grantGold ──────────────────────────────────────────────────────────
test('grantGold returns a new player with accumulated stats when amount > 0', () => {
    const player = { gold: 100, stats: { total_gold: 200 } };
    const next = grantGold(player, 50);

    assert.notEqual(next, player); // new object
    assert.equal(next.gold, 150);
    assert.equal(next.stats.total_gold, 250);
});

test('grantGold is a no-op when amount is zero or missing', () => {
    const player = { gold: 100, stats: { total_gold: 200 } };
    assert.equal(grantGold(player, 0), player);
    assert.equal(grantGold(player), player);
});

test('grantGold clamps negative amounts on the stats accumulator', () => {
    const player = { gold: 100, stats: { total_gold: 200 } };
    const next = grantGold(player, -30);

    // gold itself decreases, but total_gold accumulator never decreases
    assert.equal(next.gold, 70);
    assert.equal(next.stats.total_gold, 200);
});

// ─── Achievements ───────────────────────────────────────────────────────
test('getAchievementCurrentValue resolves based on the achievement target', () => {
    // cycle 101: relicCount는 stats.relicCount 단일 source. ADD_RELIC handler가 매 획득
    // 시 stats.relicCount++ + relics push 둘 다 수행하므로, 정상 데이터는 두 값이 같다.
    const player = {
        level: 5,
        meta: { prestigeRank: 2 },
        stats: { syntheses: 3, visitedMaps: { a: 1, b: 1 }, kills: 42, relicCount: 2 },
        relics: [{ id: 'r1' }, { id: 'r2' }],
    };

    assert.equal(getAchievementCurrentValue({ target: 'level' }, player), 5);
    assert.equal(getAchievementCurrentValue({ target: 'prestige' }, player), 2);
    assert.equal(getAchievementCurrentValue({ target: 'synths' }, player), 3);
    assert.equal(getAchievementCurrentValue({ target: 'discoveries' }, player), 2);
    assert.equal(getAchievementCurrentValue({ target: 'relicCount' }, player), 2);
    assert.equal(getAchievementCurrentValue({ target: 'kills' }, player), 42);
    assert.equal(getAchievementCurrentValue({ target: 'missing' }, player), 0);
});

test('isAchievementUnlocked compares current to goal', () => {
    const player = { level: 10 };
    assert.equal(isAchievementUnlocked({ target: 'level', goal: 5 }, player), true);
    assert.equal(isAchievementUnlocked({ target: 'level', goal: 20 }, player), false);
});

// ─── Milestones ─────────────────────────────────────────────────────────
test('checkMilestones emits rewards at 10/50/100 kill thresholds', () => {
    const name = '슬라임';
    const rewards10 = checkMilestones({ [name]: 10 }, name);
    assert.equal(rewards10.length, 1);
    assert.equal(rewards10[0].type, 'gold');

    const rewards50 = checkMilestones({ [name]: 50 }, name);
    assert.equal(rewards50.length, 1);
    assert.equal(rewards50[0].type, 'item');

    const rewards100 = checkMilestones({ [name]: 100 }, name);
    assert.equal(rewards100.length, 1);

    assert.equal(checkMilestones({ [name]: 25 }, name).length, 0);
});

// ─── Codex ──────────────────────────────────────────────────────────────
test('registerCodex adds a discovered entry immutably', () => {
    const base = { stats: { codex: {} } };
    const next = registerCodex(base, 'weapons', 'Sword');

    assert.notEqual(next, base);
    assert.ok(next.stats.codex.weapons.Sword);
    assert.equal(next.stats.codex.weapons.Sword.discovered, true);
    assert.equal(base.stats.codex.weapons, undefined); // untouched
});

test('registerCodex is idempotent when the entry exists', () => {
    const base = {
        stats: {
            codex: { weapons: { Sword: { discovered: true, obtainedAt: 1 } } },
        },
    };
    const next = registerCodex(base, 'weapons', 'Sword');
    assert.equal(next, base);
});

test('registerLootToCodex maps item types to codex categories', () => {
    const base = { stats: { codex: {} } };
    const loot = [
        { type: 'weapon', name: 'Sword' },
        { type: 'armor', name: 'Plate' },
        { type: 'shield', name: 'Buckler' },
        { type: 'mat', name: 'Iron' },
        { type: 'hp', name: 'Potion' }, // unsupported category → ignored
    ];

    const next = registerLootToCodex(base, loot);
    assert.ok(next.stats.codex.weapons.Sword);
    assert.ok(next.stats.codex.armors.Plate);
    assert.ok(next.stats.codex.shields.Buckler);
    assert.ok(next.stats.codex.materials.Iron);
    assert.equal(next.stats.codex.hp, undefined);
});
