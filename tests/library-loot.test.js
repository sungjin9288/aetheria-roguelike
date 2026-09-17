import assert from 'node:assert/strict';
import test from 'node:test';
import { DB } from '../src/data/db.ts';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.ts';
import { validateCanonicalEquipmentCatalog } from '../src/utils/equipmentBaseIdentity.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';

const location = '금지된 도서관';
const monsters = ['살아있는 마법서', '잉크 슬라임'];
const names = ['아크스태프', '혼돈의 지팡이', '세이지 로드', '빙결 지팡이', '차원 균열 지팡이', '대마법사로브', '심연의 마도서', '상급 폭풍 로브'];
const player = { job: '아크메이지', level: 62, loc: location, relics: [], meta: {}, stats: {} };
const enemy = { name: monsters[0], baseName: monsters[0], level: 55, exp: 560, isBoss: false, isElite: false };
const roll = (target = enemy, owner = player, selection = 0) => {
  const draws = [0, selection, 0.5, 0.99];
  let calls = 0;
  const result = processLoot(target, owner, 1, () => {
    assert.ok(calls < draws.length, 'unexpected RNG consumption');
    return draws[calls++];
  }, () => 1);
  return { result, calls };
};

test('library exclusive species use the exact ordered eight Tier4 ordinary items', () => {
  for (const name of monsters) for (const level of [62, 74, 75]) {
    for (let index = 0; index < names.length; index += 1) {
      const { result, calls } = roll({ ...enemy, name, baseName: name }, { ...player, level }, (index + 0.5) / names.length);
      assert.equal(calls, 4);
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].name, names[index]);
      assert.equal(result.items[0].tier, 4);
      assert.ok(!SIGNATURE_ITEM_REGISTRY[result.items[0].name]);
    }
  }
});

test('real library spawns and prefixed baseName use the same specialized selection', () => {
  for (const name of monsters) {
    const generated = spawnEnemy({ ...DB.MAPS[location], monsters: [name], boss: false, bossMonsters: [] }, player, [], { addLog() {} }, { rng: () => 0.5 }).mStats;
    assert.equal(generated.level, 55);
    assert.equal(roll(generated).result.items[0].name, names[0]);
    assert.deepEqual(roll({ ...generated, name: `불길한 ${name}`, baseName: name }), roll(generated));
  }
});

test('shared species, other tier and invalid provenance retain normal or legacy pools', () => {
  for (const name of ['마법 감시자', '분노한 마구스', '책의 정령']) {
    assert.equal(roll({ ...enemy, name, baseName: name }).result.items[0].name, DB.ITEMS.weapons.find(item => item.tier === 4).name);
  }
  for (const level of [44, 60, 75]) {
    const target = { ...enemy, level };
    assert.deepEqual(roll(target), roll({ ...target, name: '마법 감시자', baseName: '마법 감시자' }));
  }
  for (const [target, owner] of [
    [{ ...enemy, isBoss: true }, player], [{ ...enemy, isElite: true }, player],
    [enemy, { ...player, loc: 'unknown' }], [enemy, { ...player, loc: '붕괴된 마법 요새' }],
    [enemy, { ...player, loc: '혼돈의 심연' }], [enemy, null],
    ...[undefined, 0, -1, 1.5, '55', NaN, Infinity].map(level => [{ ...enemy, level }, player]),
  ]) assert.deepEqual(roll(target, owner), roll({ ...target, level: undefined }, owner));
});

test('the library does not increase bonus frequency or relax legacy eligibility', () => {
  assert.equal(processLoot(enemy, player, 1, () => 0.06, () => 1).items.length, 0);
  assert.equal(processLoot({ ...enemy, exp: 10 }, player, 1, () => 0, () => 1).items.length, 0);
});

test('library copy names its real target species without claiming a general rate bonus', () => {
  assert.equal(DB.MAPS[location].desc, '금지된 마법서들이 가득한 도서관입니다. 살아있는 마법서와 잉크 슬라임에게서 지팡이·로브·마도서를 노릴 수 있습니다.');
});

test('library catalog rejects empty, duplicate, missing, wrong-tier and signature members', async () => {
  const { LIBRARY_BONUS_LOOT } = await import('../src/data/libraryLoot.ts');
  assert.equal(LIBRARY_BONUS_LOOT.location, location);
  assert.equal(LIBRARY_BONUS_LOOT.tier, 4);
  assert.deepEqual(LIBRARY_BONUS_LOOT.monsterNames, monsters);
  assert.deepEqual(LIBRARY_BONUS_LOOT.itemNames, names);
  const original = LIBRARY_BONUS_LOOT.itemNames;
  const cases = [[], [names[0], ...names.slice(0, 7)],
    ...['unknown', '녹슨 단검', Object.keys(SIGNATURE_ITEM_REGISTRY)[0]].map(name => [name, ...names.slice(1)])];
  try {
    for (const itemNames of cases) {
      LIBRARY_BONUS_LOOT.itemNames = itemNames;
      assert.throws(() => validateCanonicalEquipmentCatalog(), /library bonus/);
    }
  } finally { LIBRARY_BONUS_LOOT.itemNames = original; }
  assert.doesNotThrow(() => validateCanonicalEquipmentCatalog());
});

test('library victory admits or blocks once at full and one-slot capacity', () => {
  const resolve = makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION;
  for (const maxInv of [1, 2, 20]) {
    let seen = false;
    for (let seed = 20260824; seed < 20260888; seed += 1) {
      const base = structuredClone(INITIAL_STATE);
      const state = { ...base, gameState: 'combat', combatTurn: 0, combatReceipt: null, logs: [],
        player: { ...base.player, ...player, hp: 10000, maxHp: 10000, atk: 1000000, equip: {}, status: [], maxInv,
          inv: [{ ...DB.ITEMS.materials[0], id: 'occupied' }] },
        enemy: { ...enemy, hp: 1, maxHp: 100, atk: 1, def: 0, gold: 1, pattern: { guardChance: 0, heavyChance: 0 } } };
      const action = { payload: { kind: 'attack', expectedTurn: 0, seed, now: 1 } };
      const result = resolve(state, action);
      assert.equal(result.combatReceipt?.kind, 'victory');
      const receipt = result.combatReceipt.lootSettlement;
      assert.equal(resolve(result, action), result);
      if (!receipt.rolledCount) continue;
      seen = true;
      assert.equal(receipt.rolledCount, 1);
      assert.equal(receipt.admittedCount, maxInv === 1 ? 0 : 1);
      assert.equal(receipt.blockedCount, maxInv === 1 ? 1 : 0);
      assert.equal(receipt.admittedSignatureCount + receipt.blockedSignatureCount, 0);
      assert.equal(receipt.pityBefore, receipt.pityAfter);
      for (const id of receipt.admittedItemIds) {
        const item = result.player.inv.find(item => item.id === id);
        assert.ok(names.includes(item?.baseItemName || item?.name));
        assert.equal(item.tier, 4);
      }
      if (maxInv === 1) assert.deepEqual(result.player.inv, state.player.inv);
      break;
    }
    assert.ok(seen, `missing seeded bonus witness at capacity ${maxInv}`);
  }
});
