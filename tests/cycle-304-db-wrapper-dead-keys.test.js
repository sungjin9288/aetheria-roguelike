import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 304: DB wrapper 2 dead keys 제거 (LOOT_TABLE / DROP_TABLES)
 *   (cycle 222-303 silent dead config 시리즈 74번째 — cleanup lens 연속).
 *
 * 발견 (DB wrapper dead keys):
 * - src/data/db.ts: DB.LOOT_TABLE / DB.DROP_TABLES — 0 refs.
 *   모든 consumer는 data/loot.js / data/dropTables.js를 직접 import:
 *   - src/components/Bestiary.tsx, components/codex/MaterialCodex.tsx,
 *     MonsterCodex.tsx, systems/CombatEngine.ts, CombatEngine.loot.ts,
 *     utils/bossSignatureHint.ts, mapSignatureHints.ts, signatureDropSources.ts
 *     모두 LOOT_TABLE / DROP_TABLES 직접 import.
 *   - DB wrapper의 LOOT_TABLE / DROP_TABLES key는 read 0건.
 *
 * 패턴 (cycle 222-303 silent dead config 시리즈 74번째):
 * - cycle 303: isE2ERuntime / measurePerf private downgrade.
 * - cycle 304: DB wrapper 2 dead key cleanup — silent duplicate import 표면 축소.
 *
 * 수정 (src/data/db.ts):
 * - LOOT_TABLE / DROP_TABLES import 제거.
 * - DB 타입 선언과 객체 리터럴에서 2 key 제거.
 *
 * 회귀 가드:
 * - DB.CLASSES (26 refs) / DB.ITEMS (135 refs) / DB.MAPS (30 refs) /
 *   DB.MONSTERS (9 refs) / DB.QUESTS (7 refs) / DB.ACHIEVEMENTS (5 refs) 유지.
 * - LOOT_TABLE / DROP_TABLES export from data/loot.js / data/dropTables.js 그대로
 *   (모든 직접 import는 영향 없음).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 304: DB wrapper LOOT_TABLE / DROP_TABLES key 제거', async () => {
    const source = await readSrc('src/data/db.ts');
    assert.ok(!/LOOT_TABLE:\s*any;/.test(source), 'DB type LOOT_TABLE field 제거');
    assert.ok(!/DROP_TABLES:\s*any;/.test(source), 'DB type DROP_TABLES field 제거');
});

test('cycle 304: DB wrapper LOOT_TABLE / DROP_TABLES import 제거', async () => {
    const source = await readSrc('src/data/db.ts');
    assert.ok(!/import\s*\{\s*LOOT_TABLE\s*\}/.test(source),
        'LOOT_TABLE import 제거');
    assert.ok(!/import\s*\{\s*DROP_TABLES\s*\}/.test(source),
        'DROP_TABLES import 제거');
});

test('cycle 304: DB wrapper 6 active key 유지', async () => {
    const { DB } = await import('../src/data/db.js');
    assert.ok(DB.CLASSES, 'DB.CLASSES 유지');
    assert.ok(DB.ITEMS, 'DB.ITEMS 유지');
    assert.ok(DB.MAPS, 'DB.MAPS 유지');
    assert.ok(DB.MONSTERS, 'DB.MONSTERS 유지');
    assert.ok(DB.QUESTS, 'DB.QUESTS 유지');
    assert.ok(DB.ACHIEVEMENTS, 'DB.ACHIEVEMENTS 유지');
});

test('cycle 304: data/loot.js / data/dropTables.js 직접 import 동작 보존', async () => {
    const { LOOT_TABLE } = await import('../src/data/loot.js');
    const { DROP_TABLES } = await import('../src/data/dropTables.js');
    assert.ok(LOOT_TABLE, 'LOOT_TABLE 직접 import 동작');
    assert.ok(DROP_TABLES, 'DROP_TABLES 직접 import 동작');
});

test('cycle 303 회귀 가드: 2 utils private 유지', async () => {
    const rmSrc = await readSrc('src/utils/runtimeMode.ts');
    const pmSrc = await readSrc('src/utils/performanceMarks.ts');
    assert.ok(!/export const isE2ERuntime\b/.test(rmSrc),
        'cycle 303 isE2ERuntime private 유지');
    assert.ok(!/export const measurePerf\b/.test(pmSrc),
        'cycle 303 measurePerf private 유지');
});
