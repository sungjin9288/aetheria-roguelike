import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.ts';
import { MAPS } from '../src/data/maps.ts';
import { DROP_TABLES } from '../src/data/dropTables.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';

/**
 * PR #11 (2026-06): 프레스티지 rank≥10 "에테르 초월" 숨겨진 보스 에테르 군주.
 *   PR #8에서 미뤘던 PRESTIGE_UNLOCKS rank10의 dead display text를 실제 구현.
 *   에테르 관문(Lv68)에서 rank≥10일 때만 hiddenBossChecks로 출현 → 시그니처 로브 드롭.
 */

test('에테르 군주 보스 정의 — isBoss + 3페이즈 최강 hidden boss', () => {
    const b = MONSTERS['에테르 군주'];
    assert.ok(b, '에테르 군주 정의 존재');
    assert.equal(b.isBoss, true);
    assert.ok(b.phase2 && b.phase3, '3페이즈 ultimate');
    assert.ok(b.hpMult >= 2.5, `최강 hidden boss hpMult (실제 ${b.hpMult})`);
});

test('에테르 군주 DROP_TABLES — 시그니처 로브 + 심장 드롭', () => {
    const drops = DROP_TABLES['에테르 군주'] || [];
    assert.ok(drops.some((d) => d.item === '에테르 군주 로브'), '에테르 군주 로브 드롭');
    assert.ok(drops.some((d) => d.item === '에테르 심장'), '에테르 심장 드롭');
});

// hiddenBossChecks: 에테르 관문에서 encounterPool 마지막에 push → Math.random 0.99로 픽
const spawnAtGate = (loc, prestigeRank) => {
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
        const player = { loc, level: 70, stats: {}, job: '아크메이지', challengeModifiers: [], meta: { prestigeRank } };
        return spawnEnemy(MAPS['에테르 관문'], player, [], { addLog: () => {} }).mStats;
    } finally {
        Math.random = orig;
    }
};

test('rank≥10 + 에테르 관문 위치 → 에테르 군주 출현', () => {
    const m = spawnAtGate('에테르 관문', 10);
    assert.equal(m.name, '에테르 군주');
    assert.equal(m.isBoss, true);
});

test('rank<10 → 에테르 군주 미출현 (해금 안 됨)', () => {
    const m = spawnAtGate('에테르 관문', 9);
    assert.notEqual(m.name, '에테르 군주');
});

test('rank≥10이라도 다른 위치면 미출현 (loc 게이트)', () => {
    const m = spawnAtGate('시작의 마을', 10);
    assert.notEqual(m.name, '에테르 군주');
});
