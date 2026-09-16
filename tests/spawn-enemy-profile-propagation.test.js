import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';

/**
 * A1 (2026-09 감사 G1): spawnEnemy 프로파일 전파.
 *
 * spawnEnemy는 DB.MONSTERS 프로파일에서 10개 필드만 복사했고 `statusOnHit`·`phase3`는
 * 누락되어 있었다. 리더(CombatEngine.enemyAI.ts:66 phase3, :239 statusOnHit,
 * utils/combatForecast.ts:74)는 이미 존재했으므로 27몬스터의 상태이상 정체성과
 * 마왕 포함 보스 3페이즈가 런타임에서 영구 미발동이었다.
 *
 * 이 테스트는 "프로파일에 있으면 스폰 인스턴스에도 있다 / 없으면 undefined"를 고정한다.
 */

const clone = (value) => structuredClone(value);

const freshPlayer = (loc) => {
    const player = clone(INITIAL_STATE.player);
    player.name = '테스트 모험가';
    player.loc = loc;
    return player;
};

// 단일 몬스터 풀 → 결정론적 스폰 (rng 값과 무관하게 baseName 고정)
const spawnOne = (mapData, player, options = {}) =>
    spawnEnemy(mapData, player, [], { addLog: () => {} }, { rng: () => 0.99, ...options });

test('A1: 슬라임 스폰이 프로파일의 statusOnHit(poison)을 전파한다', () => {
    assert.equal(MONSTERS['슬라임'].statusOnHit, 'poison', '전제: 슬라임 프로파일에 statusOnHit 존재');

    const player = freshPlayer('고요한 숲');
    const { mStats, baseName } = spawnOne({ level: 1, monsters: ['슬라임'] }, player);

    assert.equal(baseName, '슬라임');
    assert.equal(mStats.statusOnHit, 'poison');
});

test('A1: 마왕 스폰이 프로파일의 phase3와 phase2를 함께 전파한다', () => {
    const profile = MONSTERS['마왕'];
    assert.ok(profile.phase2, '전제: 마왕 프로파일에 phase2 존재');
    assert.ok(profile.phase3, '전제: 마왕 프로파일에 phase3 존재');

    const player = freshPlayer('마왕성');
    const { mStats, baseName } = spawnOne(
        { level: 48, monsters: ['마왕'], bossMonsters: ['마왕'], boss: true },
        player,
    );

    assert.equal(baseName, '마왕');
    assert.equal(mStats.isBoss, true);
    assert.deepEqual(mStats.phase2, profile.phase2);
    assert.deepEqual(mStats.phase3, profile.phase3);
    // phase3.threshold는 enemyAI가 읽는 실제 전환 지점 — 데이터가 그대로 살아있어야 한다.
    assert.equal(mStats.phase3.threshold, profile.phase3.threshold);
});

test('A1: statusOnHit/phase3가 없는 프로파일은 undefined로 남는다 (빈 키 주입 금지)', () => {
    const profile = MONSTERS['고블린'];
    assert.equal(profile.statusOnHit, undefined, '전제: 고블린 프로파일에 statusOnHit 없음');
    assert.equal(profile.phase3, undefined, '전제: 고블린 프로파일에 phase3 없음');

    const player = freshPlayer('고요한 숲');
    const { mStats } = spawnOne({ level: 1, monsters: ['고블린'] }, player);

    assert.equal(mStats.statusOnHit, undefined);
    assert.equal(mStats.phase3, undefined);
    assert.equal('statusOnHit' in mStats, false);
    assert.equal('phase3' in mStats, false);
});

test('A1: phase3 보유 보스 전원이 스폰 시 phase3를 잃지 않는다', () => {
    const phase3Bosses = Object.entries(MONSTERS)
        .filter(([, m]) => m && m.phase3)
        .map(([name]) => name);

    assert.ok(phase3Bosses.length >= 7, `phase3 보스 수: ${phase3Bosses.length}`);

    for (const name of phase3Bosses) {
        const player = freshPlayer('마왕성');
        const { mStats } = spawnOne({ level: 48, monsters: [name] }, player);
        assert.deepEqual(mStats.phase3, MONSTERS[name].phase3, `${name} phase3 전파 실패`);
    }
});

test('A1: statusOnHit 보유 몬스터 전원이 스폰 시 statusOnHit을 잃지 않는다', () => {
    const statusMonsters = Object.entries(MONSTERS)
        .filter(([, m]) => m && m.statusOnHit)
        .map(([name]) => name);

    assert.ok(statusMonsters.length >= 27, `statusOnHit 몬스터 수: ${statusMonsters.length}`);

    for (const name of statusMonsters) {
        const player = freshPlayer('고요한 숲');
        const { mStats } = spawnOne({ level: 10, monsters: [name] }, player);
        assert.equal(mStats.statusOnHit, MONSTERS[name].statusOnHit, `${name} statusOnHit 전파 실패`);
    }
});
