import assert from 'node:assert/strict';
import test from 'node:test';
import { DB } from '../src/data/db.ts';
import { BALANCE } from '../src/data/constants.ts';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.ts';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { validateCanonicalEquipmentCatalog } from '../src/utils/equipmentBaseIdentity.ts';
import { DROP_TABLES } from '../src/data/dropTables.ts';
import { LOOT_TABLE } from '../src/data/loot.ts';

const player = { job: '아크메이지', level: 75, loc: '용암 지대', relics: [], meta: {}, stats: {} };
const enemy = { name: '용암 거북', baseName: '용암 거북', level: 36, exp: 370, isBoss: false, isElite: false };
const roll = (target, owner = player, value = 0) => processLoot(target, owner, 1, () => value, () => 1);

test('normal bonus uses actual level tier boundaries, not EXP or player level', () => {
  for (const [level, tier] of [[9,1],[10,2],[27,2],[28,3],[44,3],[45,4],[59,4],[60,5],[74,5],[75,6]]) {
    for (const exp of [370, 1000]) {
      const result = roll({ ...enemy, level, exp });
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].tier, tier);
      assert.ok(!SIGNATURE_ITEM_REGISTRY[result.items[0].baseName || result.items[0].name]);
    }
  }
});

test('actual regional spawn returns ordinary equipment usable at its level', () => {
  const generated = spawnEnemy({ ...DB.MAPS[player.loc], monsters: [enemy.name], boss: false, bossMonsters: [] }, player, [], { addLog() {} }, { rng: () => 0.5 }).mStats;
  assert.equal(generated.level, 36);
  const result = roll(generated);
  assert.equal(result.items[0].tier, 3);
  assert.ok(BALANCE.TIER_REQ_LEVEL[result.items[0].tier] <= generated.level);
});

test('excluded and unproven encounters preserve exact legacy results', () => {
  for (const [target, owner] of [
    [{ ...enemy, isBoss: true }, player],
    [{ ...enemy, isElite: true }, player],
    [enemy, { ...player, loc: '시작의 마을' }],
    [enemy, { ...player, loc: 'unknown' }],
    [enemy, { ...player, loc: '무한 심연' }],
    [enemy, null],
    ...[undefined, 0, -1, NaN, Infinity, '36', 1.5].map(level => [{ ...enemy, level }, player]),
  ]) {
    assert.deepEqual(roll(target, owner), roll({ ...target, level: undefined }, owner));
  }
});

test('normal tier selection does not add a bonus roll or relax eligibility', () => {
  assert.equal(roll(enemy, player, BALANCE.LOOT_NORMAL_BONUS_CHANCE).items.length, 0);
  assert.equal(roll({ ...enemy, exp: 10 }).items.length, 0);
});

test('every ordinary pool member is reachable and signature members are excluded', () => {
  for (const [tier, level] of Object.entries(BALANCE.TIER_REQ_LEVEL)) {
    const expected = [...DB.ITEMS.weapons, ...DB.ITEMS.armors]
      .filter(item => item.tier === Number(tier) && !SIGNATURE_ITEM_REGISTRY[item.name]);
    const names = [];
    for (let index = 0; index < expected.length; index += 1) {
      const values = [0, (index + 0.5) / expected.length, 0.5, 0.99];
      let calls = 0;
      const result = processLoot({ ...enemy, level }, player, 1, () => {
        assert.ok(calls < values.length, 'unexpected extra RNG draw');
        return values[calls++];
      }, () => 1);
      assert.equal(calls, 4);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].name, expected[index].name);
      assert.ok(!SIGNATURE_ITEM_REGISTRY[result.items[0].name]);
      names.push(result.items[0].name);
    }
    assert.equal(new Set(names).size, expected.length);
  }
});

test('an empty ordinary pool fails closed and does not invent a fallback reward', () => {
  const weapons = DB.ITEMS.weapons;
  const armors = DB.ITEMS.armors;
  try {
    DB.ITEMS.weapons = weapons.filter(item => item.tier !== 3);
    DB.ITEMS.armors = armors.filter(item => item.tier !== 3);
    assert.throws(() => roll(enemy), /INVALID_NORMAL_BONUS_POOL/);
  } finally {
    DB.ITEMS.weapons = weapons;
    DB.ITEMS.armors = armors;
  }
});

test('canonical catalog validation rejects empty ordinary pools before combat', () => {
  const rows = [...DB.ITEMS.weapons, ...DB.ITEMS.armors]
    .map(item => ({ ...item, tier: item.tier === 3 ? 4 : item.tier }));
  assert.throws(() => validateCanonicalEquipmentCatalog({ rows }), /empty ordinary bonus pool for tier 3/);
});

test('canonical infinite-map members retain legacy bonus selection', () => {
  const target = { ...enemy, name: '타락한 용사', baseName: '타락한 용사', level: 50, exp: 700 };
  const owner = { ...player, loc: '혼돈의 심연' };
  assert.equal(DB.MAPS[owner.loc].level, 'infinite');
  assert.ok(DB.MAPS[owner.loc].monsters.includes(target.baseName));
  const enriched = DROP_TABLES[target.baseName];
  const legacy = LOOT_TABLE[target.baseName];
  try {
    delete DROP_TABLES[target.baseName];
    delete LOOT_TABLE[target.baseName];
    assert.equal(roll(target, owner).items[0].tier, 6);
    assert.deepEqual(roll(target, owner), roll({ ...target, level: undefined }, owner));
  } finally {
    if (enriched === undefined) delete DROP_TABLES[target.baseName];
    else DROP_TABLES[target.baseName] = enriched;
    if (legacy === undefined) delete LOOT_TABLE[target.baseName];
    else LOOT_TABLE[target.baseName] = legacy;
  }
});

test('canonical regional spawns at18/36/55/62 use the approved tier curve', () => {
  for (const [loc, name, level, tier] of [
    ['몰락한 전초기지', '전초기지 파수꾼', 18, 2],
    ['용암 지대', '용암 거북', 36, 3],
    ['금지된 도서관', '살아있는 마법서', 55, 4],
    ['붕괴된 마법 요새', '마법 감시자', 62, 5],
  ]) {
    const owner = { ...player, loc };
    const map = DB.MAPS[loc];
    assert.ok(map.monsters.includes(name));
    const target = spawnEnemy({ ...map, monsters: [name], boss: false, bossMonsters: [] }, owner, [], { addLog() {} }, { rng: () => 0.5 }).mStats;
    assert.equal(target.level, level);
    assert.equal(roll(target, owner).items[0].tier, tier);
  }
});

test('production victory receipt admits or blocks the new pool once and rejects replay', () => {
  const resolve = makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION;
  for (const maxInv of [1, 2, 20]) {
    let observed = false;
    for (let seed = 20260824; seed < 20260888; seed += 1) {
      const initial = structuredClone(INITIAL_STATE);
      const state = {
        ...initial, gameState: 'combat', combatTurn: 0, combatReceipt: null, logs: [],
        player: { ...initial.player, ...player, level: 45, atk: 1000000, hp: 10000, maxHp: 10000, equip: {}, inv: [{ ...DB.ITEMS.materials[0], id: 'occupied' }], maxInv, status: [] },
        enemy: { ...enemy, hp: 1, maxHp: 100, def: 0, atk: 1, gold: 1, pattern: { guardChance: 0, heavyChance: 0 } },
      };
      const action = { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'attack', expectedTurn: 0, seed, now: 1 } };
      const result = resolve(state, action);
      assert.equal(result.combatReceipt?.kind, 'victory');
      const receipt = result.combatReceipt.lootSettlement;
      assert.ok(receipt);
      if (receipt.rolledCount === 0) continue;
      observed = true;
      assert.equal(receipt.rolledCount, 1);
      assert.equal(receipt.admittedCount, maxInv === 1 ? 0 : 1);
      assert.equal(receipt.blockedCount, maxInv === 1 ? 1 : 0);
      assert.equal(receipt.admittedSignatureCount, 0);
      assert.equal(receipt.blockedSignatureCount, 0);
      for (const id of receipt.admittedItemIds) assert.equal(result.player.inv.find(item => item.id === id)?.tier, 3);
      assert.equal(resolve(result, action), result);
      break;
    }
    assert.ok(observed, `no bonus receipt observed at capacity ${maxInv}`);
  }
});
