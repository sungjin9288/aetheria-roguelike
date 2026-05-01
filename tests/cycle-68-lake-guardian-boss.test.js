import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS, BOSS_BRIEFS, BOSS_MONSTERS } from '../src/data/monsters.js';
import { MAPS } from '../src/data/maps.js';
import { DROP_TABLES } from '../src/data/dropTables.js';

// cycle 68: 신성한 호수 mid-game 보스 "고대 호수의 수호신" 완전 통합.
// MONSTERS / BOSS_BRIEFS / BOSS_MONSTERS / MAPS (boss field) / DROP_TABLES
// 5개 데이터 소스가 모두 일관되게 등록됐는지 회귀 가드.

const BOSS_NAME = '고대 호수의 수호신';

test('MONSTERS에 고대 호수의 수호신이 isBoss=true로 등록됨', () => {
    const entry = MONSTERS[BOSS_NAME];
    assert.ok(entry, 'monster entry should exist');
    assert.equal(entry.isBoss, true, 'isBoss should be true');
    assert.ok(entry.weakness && entry.resistance, 'weakness + resistance defined');
    assert.ok(entry.phase2, 'phase2 transition defined');
    assert.ok(entry.phase2.statusEffect, 'phase2 statusEffect defined');
});

test('BOSS_MONSTERS computed list에 자동 포함됨', () => {
    assert.ok(BOSS_MONSTERS.includes(BOSS_NAME), 'auto-derived BOSS_MONSTERS should include the new boss');
});

test('BOSS_BRIEFS에 entryHint / counterHint / phaseHint / rewardHint 모두 등록됨', () => {
    const brief = BOSS_BRIEFS[BOSS_NAME];
    assert.ok(brief, 'brief should exist');
    assert.ok(brief.signature, 'signature missing');
    assert.ok(brief.entryHint, 'entryHint missing');
    assert.ok(brief.counterHint, 'counterHint missing');
    assert.ok(brief.phaseHint, 'phaseHint missing');
    assert.ok(brief.rewardHint, 'rewardHint missing');
    assert.ok(Array.isArray(brief.warningChips) && brief.warningChips.length > 0, 'warningChips populated');
    assert.ok(Array.isArray(brief.recommendedBuilds) && brief.recommendedBuilds.length > 0, 'recommendedBuilds populated');
});

test('MAPS의 신성한 호수에 boss 필드 연결됨', () => {
    const map = MAPS['신성한 호수'];
    assert.ok(map, 'map should exist');
    assert.equal(map.boss, BOSS_NAME, 'map.boss should reference the new boss name');
});

test('DROP_TABLES에 고대 호수의 수호신 엔트리 등록됨', () => {
    const drops = DROP_TABLES[BOSS_NAME];
    assert.ok(Array.isArray(drops), 'drop entries should be an array');
    assert.ok(drops.length >= 3, 'should have at least 3 drop slots');
    for (const entry of drops) {
        assert.ok(entry.item && typeof entry.item === 'string', 'each drop has item name');
        assert.ok(typeof entry.rate === 'number' && entry.rate > 0 && entry.rate <= 1, 'rate in (0, 1]');
    }
});
