import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { MAPS } from '../src/data/maps.js';
import { ITEMS } from '../src/data/items.js';
import { DROP_TABLES } from '../src/data/dropTables.js';
import { LOOT_TABLE } from '../src/data/loot.js';

/**
 * Track J3 (2026-09) — 드롭 테이블 콘텐츠 패리티.
 *
 * maps.ts의 monsters[]/bossMonsters[]/boss(string) 전체가 DROP_TABLES ∪
 * LOOT_TABLE에 커버되는지(문서화된 "무한 심연 전용" 예외 제외) + 참조된
 * 모든 아이템/소재명이 DB.ITEMS에 실존하는지를 검증한다.
 */

// 무한 심연("혼돈의 심연", level: 'infinite') 전용 회전 보스 풀 — 심연 층수에
// 따라 절차적으로 강해지는 엔드게임 콘텐츠라 고정 rate/qty 테이블이 아니라
// CombatEngine.loot.ts의 exp 기반 티어 보너스 드랍(고레벨 몬스터 보너스 장비
// 드랍, ~133-150)에 의도적으로 맡긴다. 이 7종만 예외로 문서화한다.
const ABYSS_ONLY_EXCEPTIONS = new Set([
    '혼돈의 수호자', '공허의 심판자', '허무의 황제', '공허의 신',
    '엔트로피 군주', '심연의 파수꾼', '원시의 신',
]);

const collectAllReferencedMonsterNames = () => {
    const names = new Set();
    for (const map of Object.values(MAPS)) {
        for (const n of (map.monsters || [])) names.add(n);
        for (const n of (map.bossMonsters || [])) names.add(n);
        if (typeof map.boss === 'string') names.add(map.boss);
    }
    return names;
};

test('J3: maps.ts의 모든 몬스터/보스 이름은 DROP_TABLES ∪ LOOT_TABLE에 커버되거나 문서화된 예외다', () => {
    const referenced = collectAllReferencedMonsterNames();
    const covered = new Set([...Object.keys(DROP_TABLES), ...Object.keys(LOOT_TABLE)]);

    const uncovered = [...referenced].filter(
        (n) => !covered.has(n) && !ABYSS_ONLY_EXCEPTIONS.has(n),
    );
    assert.deepEqual(uncovered, [], `커버되지 않은 몬스터: ${uncovered.join(', ')}`);

    // 예외 목록 자체가 실제로 uncovered 집합에 해당하는지도 검증 —
    // 더 이상 필요 없는 예외를 남겨두는 것을 방지.
    const staleExceptions = [...ABYSS_ONLY_EXCEPTIONS].filter(
        (n) => covered.has(n) || !referenced.has(n),
    );
    assert.deepEqual(staleExceptions, [], `더 이상 유효하지 않은 예외: ${staleExceptions.join(', ')}`);
});

test('J3: 총 254개 참조 몬스터 = 기존 커버(119) + 신규 저작(128) + 무한 심연 예외(7)', () => {
    const referenced = collectAllReferencedMonsterNames();
    const covered = new Set([...Object.keys(DROP_TABLES), ...Object.keys(LOOT_TABLE)]);
    assert.equal(referenced.size, 254, 'maps.ts 참조 몬스터 총수 회귀 가드');
    assert.equal(covered.size, 119 + 128, 'DROP_TABLES ∪ LOOT_TABLE 총 커버 수');
});

test('J3: DROP_TABLES/LOOT_TABLE이 참조하는 모든 아이템/소재명은 DB.ITEMS에 실존한다', () => {
    const allItemNames = new Set([
        ...ITEMS.materials.map((i) => i.name),
        ...ITEMS.consumables.map((i) => i.name),
        ...ITEMS.weapons.map((i) => i.name),
        ...ITEMS.armors.map((i) => i.name),
    ]);

    const badRefs = [];
    for (const [monster, entries] of Object.entries(DROP_TABLES)) {
        for (const entry of entries) {
            if (!allItemNames.has(entry.item)) badRefs.push(`${monster} -> ${entry.item} (DROP_TABLES)`);
        }
    }
    for (const [monster, items] of Object.entries(LOOT_TABLE)) {
        for (const item of items) {
            if (!allItemNames.has(item)) badRefs.push(`${monster} -> ${item} (LOOT_TABLE)`);
        }
    }
    assert.deepEqual(badRefs, [], `존재하지 않는 아이템 참조: ${badRefs.join(', ')}`);
});

test('J3: DROP_TABLES/LOOT_TABLE에는 중복 선언된 몬스터 키가 없다', async () => {
    // 회귀 가드: authoring 중 기존 키와 중복 정의되면(JS 객체 리터럴은 마지막
    // 선언이 조용히 승리) 값이 소리 없이 바뀔 수 있다. 소스 텍스트를 직접
    // 읽어 각 키가 정확히 한 번만 선언됐는지 확인한다(import된 객체는 이미
    // 중복이 합쳐진 결과라 소스 텍스트 검사가 필요).
    const assertNoDuplicateKeys = (source, label) => {
        const keyPattern = /^\s{4}'([^']+)':\s*\[/gm;
        const seen = new Map();
        let match;
        while ((match = keyPattern.exec(source)) !== null) {
            const key = match[1];
            seen.set(key, (seen.get(key) || 0) + 1);
        }
        const dupes = [...seen.entries()].filter(([, count]) => count > 1);
        assert.deepEqual(dupes, [], `${label}에 중복 선언된 키: ${JSON.stringify(dupes)}`);
    };

    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const dropTablesSrc = await readFile(path.join(root, 'src/data/dropTables.ts'), 'utf8');
    const lootSrc = await readFile(path.join(root, 'src/data/loot.ts'), 'utf8');
    assertNoDuplicateKeys(dropTablesSrc, 'dropTables.ts');
    assertNoDuplicateKeys(lootSrc, 'loot.ts');
});
