import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MONSTERS } from '../src/data/monsters.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';

/**
 * PR #6 (2026-06): 몬스터 스탯 다양성 복원.
 *
 * 문제: named 몬스터 100종이 절대 hp/atk/def 리터럴을 가졌지만 spawnEnemy는
 *   profile의 *Mult만 읽어 리터럴을 무시 → 중후반 적이 스탯상 동일(글래스캐넌/탱크
 *   구분이 dead). 리터럴을 레벨 공식 기준 상대 *Mult로 변환해 정체성을 복원.
 *   atk=TTK-중립 정체성 레버(넓은 클램프), hp=TTK 직접(타이트), def=ratio 경감(중간).
 */

// prefix/areaBoss/earlyElite 회피 결정론 스폰
const spawnAt = (name, level) => {
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
        const mapData = { level, monsters: [name], boss: null, bossMonsters: [] };
        const player = { loc: '시험장', level: level + 2, stats: {}, job: '모험가', challengeModifiers: [], meta: { prestigeRank: 0 } };
        return spawnEnemy(mapData, player, [], { addLog: () => {} }).mStats;
    } finally {
        Math.random = orig;
    }
};

test('regression: 변환된 named 몬스터에 절대 hp/atk/def 리터럴 0건 (dead data 제거)', () => {
    const literal = Object.entries(MONSTERS).filter(([, v]) =>
        typeof v.hp === 'number' || typeof v.atk === 'number' || typeof v.def === 'number');
    assert.equal(literal.length, 0, `잔여 리터럴 몬스터: ${literal.map(([n]) => n).join(', ')}`);
});

test('variety: 탱크와 글래스캐넌이 상반된 *Mult 정체성을 가짐', () => {
    const tank = MONSTERS['잉크 슬라임'];      // 탱크: 높은 def, 낮은 atk
    const glass = MONSTERS['살아있는 마법서']; // 글래스캐넌: 높은 atk, 낮은 def
    assert.ok(tank.defMult > 1 && tank.atkMult < 1, `탱크 def↑/atk↓ (def${tank.defMult} atk${tank.atkMult})`);
    assert.ok(glass.atkMult > 1 && glass.defMult < 1, `글래스 atk↑/def↓ (atk${glass.atkMult} def${glass.defMult})`);
});

test('spawn: spawnEnemy가 *Mult를 적용 — 같은 레벨에서 탱크가 더 단단, 글래스가 더 공격적', () => {
    const tank = spawnAt('잉크 슬라임', 20);
    const glass = spawnAt('살아있는 마법서', 20);
    assert.ok(tank.hp > glass.hp, `탱크 hp(${tank.hp}) > 글래스 hp(${glass.hp})`);
    assert.ok(tank.def > glass.def, `탱크 def(${tank.def}) > 글래스 def(${glass.def})`);
    assert.ok(glass.atk > tank.atk, `글래스 atk(${glass.atk}) > 탱크 atk(${tank.atk})`);
});

test('band: 대표 변환 몬스터 TTK가 밴드(2~9) 내 (클램프 검증)', () => {
    // mid-game-ttk-bands 플레이어 모델 미러
    const maxTierAt = (lv) => Math.max(1, ...Object.entries(BALANCE.TIER_REQ_LEVEL).filter(([, r]) => lv >= r).map(([t]) => Number(t)));
    const medianTierVal = (items, mt) => {
        const el = items.filter((i) => (i.tier || 1) <= mt && typeof i.val === 'number');
        const top = Math.max(...el.map((i) => i.tier || 1));
        const vals = el.filter((i) => (i.tier || 1) === top).map((i) => i.val).sort((a, b) => a - b);
        return vals[Math.floor(vals.length / 2)] || 0;
    };
    const ttk = (name, lv) => {
        const e = spawnAt(name, lv);
        const ms = Math.floor((lv + 2) / BALANCE.LEVEL_MAJOR_MILESTONE_EVERY);
        const atk = 12 + (lv + 1) * BALANCE.ATK_PER_LEVEL + ms * BALANCE.MILESTONE_STAT_ATK
            + Math.floor(medianTierVal(DB.ITEMS.weapons, maxTierAt(lv + 2)) * BALANCE.ONE_HAND_ATK_RATIO);
        const K = BALANCE.ENEMY_DEF_K;
        const hit = Math.max(1, Math.floor(Math.floor(atk * BALANCE.DAMAGE_BASE_RATIO * 1.8) * K / (K + e.def)));
        return Math.ceil(e.hp / hit);
    };
    // 탱크/글래스/일반을 대표 레벨에서 — 모두 2~9턴
    for (const [name, lv] of [['잉크 슬라임', 20], ['살아있는 마법서', 20], ['꽃 골렘', 24], ['최후의 수호자', 44]]) {
        const t = ttk(name, lv);
        assert.ok(t >= 2 && t <= 9, `${name} Lv${lv}: TTK ${t} — 밴드(2~9) 이탈`);
    }
});
