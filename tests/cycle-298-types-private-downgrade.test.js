import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 298: 5 type exports → private downgrade (item.ts × 4, monster.ts × 1)
 *   (cycle 222-297 silent dead config 시리즈 68번째 — cleanup lens 연속).
 *
 * 발견 (5 type private downgrade, 모두 외부 import 0건, 동일 파일 유니온 구성용):
 * - WeaponItem (item.ts:46): EquipmentItem 유니온 구성용.
 * - ArmorItem (item.ts:58): EquipmentItem 유니온 구성용.
 * - ShieldItem (item.ts:66): EquipmentItem 유니온 구성용.
 * - EquipmentItem (item.ts:83): Item 유니온 구성용.
 * - BossMonster (monster.ts:45): Monster 유니온 구성용.
 *
 * 외부 (src/, tests/) 어디에서도 import 0건. 모두 같은 파일에서만 union 구성에 사용.
 *
 * 패턴 (cycle 222-297 silent dead config 시리즈 68번째):
 * - cycle 297: getExploreState private downgrade.
 * - cycle 298: 5 type exports private downgrade — public 타입 표면 5개 축소.
 *
 * 수정:
 * - item.ts: WeaponItem / ArmorItem / ShieldItem / EquipmentItem export 제거.
 * - monster.ts: BossMonster export 제거.
 *
 * 회귀 가드:
 * - Item / EquipSlots / ConsumableItem / Monster / MonsterBase active export 유지.
 * - Item 유니온 구조 동일 (WeaponItem | ArmorItem | ShieldItem | ConsumableItem | ItemBase).
 * - Monster 유니온 구조 동일 (MonsterBase | BossMonster).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 298: item.ts 4 type exports 제거 (private)', async () => {
    const source = await readSrc('src/types/item.ts');
    assert.ok(!/export interface WeaponItem\b/.test(source), 'WeaponItem export 제거');
    assert.ok(!/export interface ArmorItem\b/.test(source), 'ArmorItem export 제거');
    assert.ok(!/export interface ShieldItem\b/.test(source), 'ShieldItem export 제거');
    assert.ok(!/export type EquipmentItem\b/.test(source), 'EquipmentItem export 제거');
});

test('cycle 298: monster.ts BossMonster export 제거 (private)', async () => {
    const source = await readSrc('src/types/monster.ts');
    assert.ok(!/export interface BossMonster\b/.test(source), 'BossMonster export 제거');
    assert.ok(/interface BossMonster\b/.test(source), 'BossMonster 정의 유지');
});

test('cycle 298: Item / Monster 유니온 정의 유지', async () => {
    const itemSrc = await readSrc('src/types/item.ts');
    const monsterSrc = await readSrc('src/types/monster.ts');
    assert.ok(/export type Item =/.test(itemSrc), 'Item 유니온 export 유지');
    assert.ok(/export type Monster =/.test(monsterSrc), 'Monster 유니온 export 유지');
});

test('cycle 298: ConsumableItem / EquipSlots / MonsterBase active export 유지', async () => {
    const itemSrc = await readSrc('src/types/item.ts');
    const monsterSrc = await readSrc('src/types/monster.ts');
    assert.ok(/export interface ConsumableItem\b/.test(itemSrc), 'ConsumableItem 유지');
    assert.ok(/export interface EquipSlots\b/.test(itemSrc), 'EquipSlots 유지');
    assert.ok(/export interface MonsterBase\b/.test(monsterSrc), 'MonsterBase 유지');
});

test('cycle 297 회귀 가드: getExploreState private 유지', async () => {
    const source = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/export const getExploreState\b/.test(source),
        'cycle 297 getExploreState private 유지');
});
