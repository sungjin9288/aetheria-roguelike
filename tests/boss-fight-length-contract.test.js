import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { BOSS_BRIEFS, MONSTERS } from '../src/data/monsters.js';
import { MAPS } from '../src/data/maps.js';
import { resolveEndgameVictory } from '../src/systems/endgameSettlement.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';

/**
 * 2026-10 Wave 60 — 보스별 고정 생명 상향(소유자 결정). Wave 59 후속 1:1 대결(원장 §59.5)에서 보스 22종이 그 지역 레벨에
 * 막 닿은 자연 플레이어에게 평균 2.9턴(1.6 ~ 4.8)에 쓰러져 2페이즈(생명 50%)에 닿는 전투가 31%였다 — 브리핑이 약속한 기믹이
 * 보이기 전에 끝났다. `hpMult`를 보스마다 대결로 보정해 데이터에 고정했다(중앙값 6턴, 원장 §60). 보정 자체는 저장소 밖
 * 대결 하네스가 재므로, 이 파일은 그 결과가 되돌아가지 않는 구조 불변식과 그 값을 읽는 경로를 지킨다.
 */

const BRIEFED = Object.keys(BOSS_BRIEFS);

// 보스가 나오는 지역(구역 보스 · 보스 목록 · 일반 조우 풀)과 그 지역의 일반 몬스터.
const zonesOf = (boss) => Object.entries(MAPS)
    .filter(([, map]) => map.boss === boss || map.bossMonsters?.includes(boss) || map.monsters?.includes(boss));
const regularMonstersOf = (boss) => zonesOf(boss).flatMap(([, map]) => (map.monsters || [])
    .filter((name) => !MONSTERS[name]?.isBoss && !(map.bossMonsters || []).includes(name)));

test('Wave 60: 브리핑 보스는 자기 지역의 가장 단단한 일반 몬스터보다 생명 배율이 3배 이상이다', () => {
    // 보정 전에는 22종 모두 2.2배 미만이었다(원시의 신 2.2 / 1.45 = 1.5배). 보정 뒤 최소는 호수 수호신 3.6 / 1.18 = 3.05배다.
    assert.equal(BRIEFED.length, 22);
    for (const boss of BRIEFED) {
        const zones = zonesOf(boss);
        assert.ok(zones.length > 0, `${boss}: 나오는 지역이 없다`);
        const regulars = regularMonstersOf(boss);
        assert.ok(regulars.length > 0, `${boss}: 같은 지역 일반 몬스터가 없다`);
        const strongest = Math.max(...regulars.map((name) => MONSTERS[name]?.hpMult || 1));
        assert.ok(
            MONSTERS[boss].hpMult >= 3 * strongest,
            `${boss}: hpMult ${MONSTERS[boss].hpMult} < 3 × ${strongest} (${zones.map(([name]) => name).join(', ')})`,
        );
    }
});

test('Wave 60: 스폰된 보스의 생명은 데이터 hpMult를 그대로 곱한다 (구역 보스 · 일반 조우 공통 경로)', () => {
    // 접두어 판정을 피하는 난수(0.99)로 rank 0 · Lv 그대로의 기본 생명 × hpMult만 남긴다.
    const rng = () => 0.99;
    for (const boss of ['마왕', '고대 호수의 수호신', '레드 드래곤']) {
        const [loc, map] = zonesOf(boss)[0];
        const level = Array.isArray(map.level) ? map.level[0] : map.level;
        const player = { level, loc, stats: {}, meta: { prestigeRank: 0 }, relics: [] };
        const { mStats } = spawnEnemy({ ...map, boss }, player, [], { addLog: () => {} }, { forceAreaBoss: true, rng });
        assert.equal(mStats.baseName, boss);
        const base = BALANCE.MONSTER_HP_BASE + level * BALANCE.MONSTER_HP_PER_LEVEL;
        assert.equal(mStats.maxHp, Math.floor(base * MONSTERS[boss].hpMult), `${boss} @${loc}`);
    }
});

test('Wave 60: 진 보스(마왕 처치 정산의 원시의 신)도 같은 hpMult를 읽는다 — 8,000 × hpMult', () => {
    // 대결 측정: 계승 3단계 Lv48 스냅숏이 이전 값(17,600)을 중앙값 3턴에, 지금 값을 중앙값 7턴에 잡았다(원장 §60).
    const player = {
        level: 48,
        loc: '마왕성',
        stats: {},
        relics: [],
        inv: [],
        meta: { prestigeRank: 3, endgame: { primalShards: BALANCE.PRIMAL_SHARD_REQUIRED } },
    };
    const result = resolveEndgameVictory({
        player,
        deadEnemy: { name: '마왕', baseName: '마왕' },
        receiptKey: 'wave60-true-boss',
        rng: () => 0.99,
        now: 0,
    });
    assert.equal(result.outcome, 'true_boss');
    assert.equal(result.enemy.baseName, '원시의 신');
    assert.equal(result.enemy.maxHp, Math.floor(8_000 * MONSTERS['원시의 신'].hpMult));
    assert.ok(result.enemy.maxHp > 17_600, '진 보스가 보정 전 생명(8,000 × 2.2)으로 돌아가지 않는다');
});
