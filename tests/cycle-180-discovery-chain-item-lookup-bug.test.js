import test from 'node:test';
import assert from 'node:assert/strict';

import { findItemByName } from '../src/utils/gameUtils.js';
import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 180: discovery chain item lookup 버그 fix (cycle 177 follow-up).
 *
 * cycle 177이 DISCOVERY_CHAINS reward.item 3건을 items.ts 등록 항목으로 매핑.
 * 그러나 매핑된 이후에도 실제 inventory에 추가되지 않던 잠복 회귀 발견.
 *
 * 발견:
 * - exploreUtils.ts:357 'DB.ITEMS?.allItems?.find(...)' 패턴.
 * - DB.ITEMS는 object — 'allItems' 필드 존재하지 않음 (undefined).
 * - optional chaining으로 throw 안 하지만 find 결과 undefined → 추가 분기 skip.
 * - 결과: cycle 177에서 reward.item을 '용의 화염' / '빙결의 왕관검' /
 *   '마왕의 대낫'으로 매핑했지만 실제로 inventory에 들어가지 않던 silent 회귀.
 *
 * 수정 (src/utils/exploreUtils.ts):
 * - 'DB.ITEMS.allItems.find(...)' → 'findItemByName(name)' (gameUtils helper).
 * - getAllItems()가 [...consumables, ...weapons, ...armors, ...materials]로 lookup.
 *
 * cycle 179 'Object.values(DB.ITEMS).flat()' 패턴과 같은 영역의 회귀 — DB.ITEMS
 * shape에 대한 잘못된 가정.
 */

test('cycle 180 sanity: DB.ITEMS.allItems는 undefined (잘못된 lookup 가정)', () => {
    assert.equal(DB.ITEMS.allItems, undefined,
        'DB.ITEMS는 {weapons,armors,...} object — allItems 필드 없음');
});

test('cycle 180: findItemByName이 cycle 177 매핑된 3 reward.item 모두 찾음', () => {
    // cycle 177에서 fire_convergence / frozen_truth / demon_trail의 reward를
    // 매핑한 아이템들이 lookup에서 찾아지는지 확인.
    const items = ['용의 화염', '빙결의 왕관검', '마왕의 대낫'];
    for (const name of items) {
        const found = findItemByName(name);
        assert.ok(found, `findItemByName('${name}') 실패`);
        assert.equal(found.name, name);
    }
});

test('cycle 180: BALANCE.DISCOVERY_CHAINS reward.item이 모두 findItemByName으로 lookup 가능', () => {
    const chains = BALANCE.DISCOVERY_CHAINS || [];
    const missing = [];
    for (const chain of chains) {
        if (chain.reward?.item) {
            const found = findItemByName(chain.reward.item);
            if (!found) missing.push(`${chain.id}: '${chain.reward.item}'`);
        }
    }
    assert.deepEqual(missing, [],
        `findItemByName lookup 실패한 reward.item:\n  ${missing.join('\n  ')}`);
});

test('cycle 180: exploreUtils.ts에 DB.ITEMS.allItems 잘못된 패턴 없음 (회귀 가드)', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const src = await readFile(path.join(ROOT, 'src/utils/exploreUtils.ts'), 'utf8');
    // 코멘트의 경고는 OK, 실제 코드에서 호출 안 되어야 함.
    // 'DB.ITEMS?.allItems?.find' 또는 'DB.ITEMS.allItems.find' 패턴이 .find 호출로 이어지면 안 됨.
    assert.doesNotMatch(src, /DB\.ITEMS\??\.\s*allItems\??\.\s*find/,
        'exploreUtils.ts에 DB.ITEMS.allItems.find 잘못된 lookup이 없어야 함');
});
