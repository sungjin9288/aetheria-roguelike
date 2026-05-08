import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DB } from '../src/data/db.js';

/**
 * cycle 181: DB shape 정합성 회귀 가드 (cycle 179/180 잠복 회귀 lessons learned).
 *
 * cycle 179: '(DB.ITEMS).flat()' 호출이 TypeError로 abyss 50층+ 진행 중단.
 * cycle 180: 'DB.ITEMS.allItems.find()' 호출이 silent miss로 chain reward 실종.
 *
 * 두 잠복 회귀의 공통 원인 — DB.ITEMS shape에 대한 잘못된 가정. DB.ITEMS는
 * { weapons, armors, consumables, materials, prefixes, sets, recipes } object
 * 인데 array 메서드(.flat) / 미존재 필드(.allItems)를 호출.
 *
 * 이번 가드는:
 * 1. DB의 핵심 sub-object들이 expected shape를 유지함을 lock.
 * 2. src/ 코드가 DB.ITEMS.<unknown_key> 패턴을 사용하지 않음을 정합 가드 —
 *    화이트리스트 외 키 access는 의심.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');

const ITEMS_VALID_KEYS = new Set([
    'weapons', 'armors', 'consumables', 'materials',
    'prefixes', 'sets', 'recipes',
]);

test('DB.ITEMS shape lock — 정확히 7 keys', () => {
    const keys = new Set(Object.keys(DB.ITEMS));
    assert.equal(keys.size, ITEMS_VALID_KEYS.size,
        `DB.ITEMS keys count mismatch — expected ${ITEMS_VALID_KEYS.size}, got ${keys.size}`);
    for (const k of ITEMS_VALID_KEYS) {
        assert.ok(keys.has(k), `DB.ITEMS missing expected key '${k}'`);
        assert.ok(Array.isArray(DB.ITEMS[k]), `DB.ITEMS.${k} not an array`);
    }
});

test('DB top-level shape lock — 6 sub-objects (CLASSES/ITEMS/MAPS/MONSTERS/QUESTS/ACHIEVEMENTS)', () => {
    // cycle 304: LOOT_TABLE / DROP_TABLES key 제거 — DB 접근 0건. 모든 consumer는
    //   data/loot.js / data/dropTables.js 직접 import. 기존 8 키 lock 이 6 키로 갱신.
    const expected = ['CLASSES', 'ITEMS', 'MAPS', 'MONSTERS', 'QUESTS', 'ACHIEVEMENTS'];
    const actual = new Set(Object.keys(DB));
    for (const k of expected) {
        assert.ok(actual.has(k), `DB missing '${k}'`);
    }
    assert.equal(actual.size, expected.length, `DB key count: expected ${expected.length}, got ${actual.size}`);
});

test('src/ 코드가 DB.ITEMS.<unknown_key>를 호출하지 않음 (화이트리스트 가드)', async () => {
    // src 전체에서 DB.ITEMS.<word>(  형태 + DB.ITEMS?.<word>  형태 모두 추출.
    const walk = async (dir) => {
        const entries = await readdir(dir, { withFileTypes: true });
        let out = '';
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) out += await walk(full);
            else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
                out += await readFile(full, 'utf8');
                out += '\n';
            }
        }
        return out;
    };

    const corpus = await walk(SRC);
    const re = /DB\.ITEMS\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const violations = new Set();
    let m;
    while ((m = re.exec(corpus)) !== null) {
        const key = m[1];
        if (!ITEMS_VALID_KEYS.has(key)) {
            violations.add(key);
        }
    }
    assert.deepEqual([...violations].sort(), [],
        `DB.ITEMS의 unknown 키 access 발견 (cycle 179/180 회귀 패턴):\n  ${[...violations].join('\n  ')}`);
});

test('DB.QUESTS / DB.ACHIEVEMENTS shape lock — 둘 다 array', () => {
    assert.ok(Array.isArray(DB.QUESTS), 'DB.QUESTS is array');
    assert.ok(Array.isArray(DB.ACHIEVEMENTS), 'DB.ACHIEVEMENTS is array');
    assert.ok(DB.QUESTS.length > 0);
    assert.ok(DB.ACHIEVEMENTS.length > 0);
});

test('DB.MAPS / DB.MONSTERS / DB.CLASSES shape lock — 모두 keyed object (not array)', () => {
    for (const key of ['MAPS', 'MONSTERS', 'CLASSES']) {
        assert.ok(typeof DB[key] === 'object', `DB.${key} is object`);
        assert.ok(!Array.isArray(DB[key]), `DB.${key} is NOT array`);
        assert.ok(Object.keys(DB[key]).length > 0);
    }
});
