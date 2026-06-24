import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BALANCE } from '../src/data/constants.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * PR #5 (2026-06): 프레스티지(환생) 적 난이도 스케일링.
 *
 * 문제: 기존 프레스티지는 플레이어 스탯(+5 atk/+25 hp per rank)만 올려 매 승천마다
 *   런이 점점 *쉬워졌다* — 로그라이크 "깊을수록 어려움" 원칙에 역행(초반이 너무
 *   쉬우면 안 된다는 방향성 위반).
 *
 * 수정: spawnEnemy가 player.meta.prestigeRank에 비례해 적 hp/atk/def(스탯)와
 *   exp/gold(보상)를 곱연산 스케일. rank0은 변화 없음(기본 곡선/신규 플레이어 불변).
 *   opt-in: 게임을 클리어한 하드코어 플레이어에게만 적용 → 신규 밸런스 무영향.
 */

// prefix/areaBoss/earlyElite 랜덤을 모두 회피 (Math.random=0.99, level>6, boss=null)
const spawnAt = (level, prestigeRank) => {
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
        const mapData = { level, monsters: ['숲의 정령'], boss: null, bossMonsters: [] };
        const player = { loc: '시험장', level: level + 2, stats: {}, job: '모험가', challengeModifiers: [], meta: { prestigeRank } };
        return spawnEnemy(mapData, player, [], { addLog: () => {} }).mStats;
    } finally {
        Math.random = orig;
    }
};

test('prestige: rank0 → 스케일링 없음 (기본 곡선 불변)', () => {
    const a = spawnAt(20, 0);
    const b = spawnAt(20, 0);
    assert.equal(a.hp, b.hp);
    assert.equal(a.def, BALANCE.MONSTER_DEF_BASE + 20 * BALANCE.MONSTER_DEF_PER_LEVEL, 'rank0 def = PR#3 공식 그대로');
});

test('prestige: rank5 → 적 hp/atk/def가 곱연산 스케일', () => {
    const r0 = spawnAt(20, 0);
    const r5 = spawnAt(20, 5);
    const m = 1 + 5 * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK;
    assert.equal(r5.hp, Math.floor(r0.hp * m), `hp ×${m}`);
    assert.equal(r5.maxHp, Math.floor(r0.maxHp * m), `maxHp ×${m}`);
    assert.equal(r5.atk, Math.floor(r0.atk * m), `atk ×${m}`);
    assert.equal(r5.def, Math.floor(r0.def * m), `def ×${m}`);
});

test('prestige: rank5 → 보상(exp/gold)도 스케일 (난도 보상)', () => {
    const r0 = spawnAt(20, 0);
    const r5 = spawnAt(20, 5);
    const mr = 1 + 5 * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK;
    assert.equal(r5.exp, Math.floor(r0.exp * mr), `exp ×${mr}`);
    assert.equal(r5.gold, Math.floor(r0.gold * mr), `gold ×${mr}`);
});

test('prestige: rank 단조 증가 — 높은 rank일수록 적이 더 강함', () => {
    const r1 = spawnAt(30, 1);
    const r10 = spawnAt(30, 10);
    assert.ok(r10.hp > r1.hp, `r10 hp(${r10.hp}) > r1 hp(${r1.hp})`);
    assert.ok(r10.atk > r1.atk, `r10 atk(${r10.atk}) > r1 atk(${r1.atk})`);
});

test('prestige: AscensionScreen이 적 강화를 명시 (silent 난이도 스파이크 방지)', async () => {
    const src = await readFile(path.join(ROOT, 'src/components/AscensionScreen.tsx'), 'utf8');
    assert.match(src, /PRESTIGE_ENEMY_STAT_PER_RANK/, '실제 스케일 상수에 연동');
    assert.match(src, /PRESTIGE_ENEMY_REWARD_PER_RANK/, '보상 스케일도 표시');
    assert.match(src, /data-testid="ascension-enemy-scaling"/, '디스클로저 카드 testid 존재');
});

test('prestige: meta 없는 구형 세이브 → 안전하게 rank0 취급', () => {
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
        const mapData = { level: 15, monsters: ['숲의 정령'], boss: null, bossMonsters: [] };
        // meta 필드 자체가 없는 player (구형 세이브)
        const legacy = { loc: '시험장', level: 17, stats: {}, job: '모험가', challengeModifiers: [] };
        const m = spawnEnemy(mapData, legacy, [], { addLog: () => {} }).mStats;
        assert.equal(m.def, BALANCE.MONSTER_DEF_BASE + 15 * BALANCE.MONSTER_DEF_PER_LEVEL, 'meta 없으면 rank0 곡선');
    } finally {
        Math.random = orig;
    }
});
