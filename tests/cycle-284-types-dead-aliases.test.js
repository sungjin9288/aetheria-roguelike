import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 284: types/item.ts ItemType + types/map.ts MapType / isSignatureZone dead cleanup
 *   (cycle 222-283 silent dead config 시리즈 54번째 — cleanup lens 연속).
 *
 * 발견 (3 dead types/fields across 2 type files):
 * - src/types/item.ts:
 *   - export type ItemType = 'weapon' | 'armor' | ...: 정의만, import 0건.
 * - src/types/map.ts:
 *   - export type MapType = string: 정의 + GameMap.type에서 1회 사용. import 0건.
 *   - GameMap.isSignatureZone?: boolean: 정의만, runtime access 0건.
 *
 * 패턴 (cycle 222-283 silent dead config 시리즈 54번째):
 * - cycle 280-283: types/ 정리 시리즈 4사이클.
 * - cycle 284: types/ item.ts + map.ts 잔존 dead 정리 (cleanup lens 연속).
 *
 * 수정:
 * 1) src/types/item.ts: ItemType export 제거.
 * 2) src/types/map.ts: MapType export 제거 + GameMap.type을 string으로 직접 정의 + isSignatureZone 제거.
 *
 * 회귀 가드:
 * - GameMap.type / level / desc / exits / monsters / boss / bossMonsters / eventChance / lore /
 *   minLv / shopBonus / graveDropBonus / seasonOnly 등 활성 필드 유지.
 * - [key: string]: any 인덱스 시그니처 유지로 런타임 동적 필드 호환.
 * - cycle 280-283 cleanup 동작 유지.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 284: types/item.ts ItemType 제거', async () => {
    const source = await readSrc('src/types/item.ts');
    assert.ok(!/export type ItemType/.test(source),
        'ItemType type alias 제거됨');
});

test('cycle 284: types/map.ts MapType 제거', async () => {
    const source = await readSrc('src/types/map.ts');
    assert.ok(!/export type MapType/.test(source),
        'MapType type alias 제거됨');
});

test('cycle 284: GameMap.isSignatureZone 제거', async () => {
    const source = await readSrc('src/types/map.ts');
    assert.ok(!/isSignatureZone\?:\s*boolean;/.test(source),
        'GameMap.isSignatureZone 필드 제거됨');
});

test('cycle 284: 활성 GameMap 필드 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/types/map.ts');
    const activeFields = ['name', 'type', 'level', 'minLv', 'desc', 'exits', 'monsters', 'boss', 'bossMonsters', 'eventChance', 'lore'];
    activeFields.forEach((field) => {
        const re = new RegExp(`${field}\\??:\\s*`);
        assert.ok(re.test(source), `GameMap.${field} 필드 유지`);
    });
});

test('cycle 280-283 회귀 가드: 이전 cleanup 동작 유지', async () => {
    const playerSrc = await readSrc('src/types/player.ts');
    const monsterSrc = await readSrc('src/types/monster.ts');
    // cycle 280
    // cycle 299: PlayerStats export 제거 (private).
    const statsBlock = playerSrc.match(/(?:export )?interface PlayerStats[\s\S]+?\n\}/);
    assert.ok(statsBlock && !/discoveries\?:\s*number;/.test(statsBlock[0]),
        'cycle 280 PlayerStats.discoveries 0건');
    // cycle 282
    assert.ok(!/export interface SignaturePity/.test(playerSrc),
        'cycle 282 SignaturePity interface 0건');
    // cycle 283
    const monsterBaseBlock = monsterSrc.match(/export interface MonsterBase \{[\s\S]+?\n\}/);
    assert.ok(monsterBaseBlock && !/dropTable\?:\s*string;/.test(monsterBaseBlock[0]),
        'cycle 283 MonsterBase.dropTable 0건');
});
