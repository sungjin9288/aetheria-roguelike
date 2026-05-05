import test from 'node:test';
import assert from 'node:assert/strict';

import { DROP_TABLES } from '../src/data/dropTables.js';
import { MONSTERS } from '../src/data/monsters.js';
import { DB } from '../src/data/db.js';

/**
 * cycle 183: cycle 173에서 추가된 시즌 보스 2종 drop table 추가 + 정합성 가드.
 *
 * 발견:
 * - cycle 173에서 '봄의 여왕' / '서리 군주'를 MONSTERS에 isBoss로 등록.
 * - 그러나 dropTables.ts / loot.ts에 등록 없어 cycle 171 보너스 드랍(25% tier
 *   5/6 random)만 발동. 큐레이션된 thematic 보상 부재.
 * - 시즌 이벤트 보스라 처치 빈도가 낮음 — 큐레이션 부재 더 두드러짐.
 *
 * 수정 (src/data/dropTables.ts):
 * 봄의 여왕 (자연 테마, weakness 화염): 자연의 결정 / 엘프의 눈물 / 영웅의 물약 /
 *   세계수의 지팡이 (5% legendary). cycle 177 fire_convergence 보상의 친척.
 * 서리 군주 (얼음 테마, weakness 화염): 냉기의 결정 / 상급 체력 물약 / 영웅의 물약 /
 *   빙결의 왕관검 (5% legendary). cycle 177 frozen_truth 보상과 일관 — 같은 legendary
 *   reuse.
 */

test('cycle 183: 봄의 여왕 drop table 등록', () => {
    const dt = DROP_TABLES['봄의 여왕'];
    assert.ok(Array.isArray(dt), '봄의 여왕 drop table 등록');
    assert.ok(dt.length >= 3, '최소 3개 drop entry');
});

test('cycle 183: 서리 군주 drop table 등록', () => {
    const dt = DROP_TABLES['서리 군주'];
    assert.ok(Array.isArray(dt), '서리 군주 drop table 등록');
    assert.ok(dt.length >= 3);
});

test('cycle 183: 시즌 보스 drop table item이 모두 items.ts 등록됨', () => {
    const allItemNames = new Set();
    for (const arr of Object.values(DB.ITEMS)) {
        if (Array.isArray(arr)) for (const i of arr) if (i.name) allItemNames.add(i.name);
    }
    const issues = [];
    for (const bossName of ['봄의 여왕', '서리 군주']) {
        const dt = DROP_TABLES[bossName] || [];
        for (const entry of dt) {
            if (entry.item && !allItemNames.has(entry.item)) {
                issues.push(`${bossName}: '${entry.item}' not in items.ts`);
            }
        }
    }
    assert.deepEqual(issues, []);
});

test('cycle 183: 시즌 보스가 MONSTERS에 isBoss로 등록됨 (cycle 173 회귀 가드)', () => {
    assert.equal(MONSTERS['봄의 여왕']?.isBoss, true);
    assert.equal(MONSTERS['서리 군주']?.isBoss, true);
});

test('cycle 183: legendary drop rate 합리적 (0.03~0.1)', () => {
    const spring = DROP_TABLES['봄의 여왕'];
    const frost = DROP_TABLES['서리 군주'];
    const springLegendary = spring.find((e) => e.item === '세계수의 지팡이');
    const frostLegendary = frost.find((e) => e.item === '빙결의 왕관검');
    assert.ok(springLegendary && springLegendary.rate >= 0.03 && springLegendary.rate <= 0.1);
    assert.ok(frostLegendary && frostLegendary.rate >= 0.03 && frostLegendary.rate <= 0.1);
});
