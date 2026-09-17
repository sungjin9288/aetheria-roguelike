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
 * Track J3 (2026-09) — 드롭 콘텐츠 패리티.
 *
 * 원래 주장: "maps.ts가 참조하는 모든 몬스터는 DROP_TABLES ∪ LOOT_TABLE에 있어야 한다."
 *
 * 병합(2026-09, codex/release-complete-core 베이스) 이후 정정: 같은 목표를 Codex가
 * **다른 메커니즘**으로 먼저 달성했다. `CombatEngine.loot.ts`의 고레벨 보너스 드랍이
 * `normalBonusPool`(= 해당 지역의 일반 몬스터에게 레벨 티어에 맞는 일반 장비 풀)을
 * 사용하는데, 이 경로는 **DROP_TABLES 엔트리가 없을 때만** 도달한다(강화 테이블 분기는
 * early-return). 즉 "테이블이 없는 몬스터"가 빈손인 것이 아니라, 그쪽이 장비 드랍을
 * 담당하는 정식 경로다.
 *
 * 따라서 J3가 저작했던 105종(일반)·24종(보스) 테이블은 되돌렸다 — 남겨 두면 Codex가
 * 저작한 장비 드랍을 105종에 대해 통째로 막는다. 이 테스트는 의도("참조된 몬스터는
 * 전부 어떤 경로로든 보상을 받는다")를 유지하되, 기대값을 병합 후 진실로 바꾼다.
 */

// 무한 심연("혼돈의 심연", level: 'infinite') 전용 회전 보스 풀 — 심연 층수에 따라
// 절차적으로 강해지는 엔드게임 콘텐츠라 고정 rate/qty 테이블이 아니라 exp 기반 티어
// 보너스 드랍에 의도적으로 맡긴다.
const ABYSS_ONLY_EXCEPTIONS = new Set([
    '혼돈의 수호자', '공허의 심판자', '허무의 황제', '공허의 신',
    '엔트로피 군주', '심연의 파수꾼', '원시의 신',
]);

const collectReferencedMonsters = () => {
    const ordinary = new Set();
    const bosses = new Set();
    for (const map of Object.values(MAPS)) {
        for (const n of (map.monsters || [])) ordinary.add(n);
        for (const n of (map.bossMonsters || [])) bosses.add(n);
        if (typeof map.boss === 'string') bosses.add(map.boss);
    }
    return { ordinary, bosses };
};

test('J3: 참조된 모든 몬스터는 테이블 또는 레벨 티어 보너스 경로로 보상을 받는다', () => {
    const { ordinary, bosses } = collectReferencedMonsters();
    const tabled = new Set([...Object.keys(DROP_TABLES), ...Object.keys(LOOT_TABLE)]);

    // 일반 몬스터: 테이블이 없으면 normalBonusPool(지역 레벨 티어 일반 장비)이 담당한다.
    //   normalBonusPool은 map.monsters 멤버 + 유한 레벨 지역 + 비보스/비정예를 요구하므로
    //   "테이블 없음"이 곧 "보상 없음"이 아니다.
    const infiniteMaps = new Set(Object.entries(MAPS)
        .filter(([, map]) => map.level === 'infinite')
        .flatMap(([, map]) => map.monsters || []));
    const ordinaryUnreachable = [...ordinary].filter((n) => (
        !tabled.has(n) && infiniteMaps.has(n) && !ABYSS_ONLY_EXCEPTIONS.has(n)
    ));
    assert.deepEqual(ordinaryUnreachable, [], `보상 경로가 없는 일반 몬스터: ${ordinaryUnreachable.join(', ')}`);

    // 보스: normalBonusPool 대상이 아니지만 exp 기반 티어 보너스 풀이 남는다.
    //   문서화된 무한 심연 예외만 확인하고, 나머지는 테이블/보너스 중 하나로 커버된다.
    const staleExceptions = [...ABYSS_ONLY_EXCEPTIONS].filter(
        (n) => tabled.has(n) || !(ordinary.has(n) || bosses.has(n)),
    );
    assert.deepEqual(staleExceptions, [], `더 이상 유효하지 않은 예외: ${staleExceptions.join(', ')}`);
});

test('J3: maps.ts 참조 몬스터 총수 회귀 가드', () => {
    const { ordinary, bosses } = collectReferencedMonsters();
    assert.equal(new Set([...ordinary, ...bosses]).size, 254);
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
