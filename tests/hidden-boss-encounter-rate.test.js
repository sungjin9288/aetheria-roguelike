import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { RELICS } from '../src/data/relics.js';
import { HIDDEN_BOSS_UNLOCKS } from '../src/utils/bossPresence.js';
import { selectEncounterMonster, spawnEnemy } from '../src/utils/exploreUtils.js';

/**
 * 2026-10 Wave 76 — 소유자 결정 "숨은 보스 출현 확률을 낮추자"(원장 §77.6).
 *
 * 해금된 숨은 보스는 조우 풀의 한 칸(지역 5종 + 1 = 1/6)이 아니라 그 지역 조우의 `HIDDEN_BOSS_ENCOUNTER_CHANCE`(3%)다.
 * 원한의 용사가 지하 미궁 조우의 1/6이던 동안 2회차 사망 증가 전부가 그 보스였다(원장 §77.5).
 * 계약: ① 네 숨은 보스 모두 해금 지역에서 3% ② 일반 몬스터는 나머지를 고르게 나눈다 ③ 추첨은 여전히 한 번 — 해금 전 ·
 * 다른 지역의 조우는 이전과 같은 칸을 뽑는다 ④ 허공의 눈은 숨은 보스도 같은 배수로 올린다.
 */

const N = 6_000;
const sweep = (fn) => {
    const counts = new Map();
    for (let k = 0; k < N; k += 1) {
        const roll = (k + 0.5) / N;
        const name = fn(() => roll);
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
};

/** 표의 해금 조건을 만족하는 플레이어 — 지역 · 직업 · 레벨 · 체인 · 심연 · 계승 rank. */
const unlockedAt = (entry) => ({
    loc: entry.loc,
    job: '시간술사',
    level: 70,
    stats: { abyssFloor: 100 },
    eventChainProgress: { last_hero: 3 },
    meta: { prestigeRank: 10 },
    challengeModifiers: [],
    quests: [],
});
const lockedAt = (entry) => ({ loc: entry.loc, job: '전사', level: 30, stats: {}, eventChainProgress: {}, meta: {}, challengeModifiers: [], quests: [] });

const spawnName = (loc, player, relics = []) => (rng) => spawnEnemy(DB.MAPS[loc], player, relics, { addLog: () => {} }, { rng }).baseName;

test('[비율] 네 숨은 보스 모두 해금 지역 조우의 3%로 나온다 — 풀의 한 칸(1/6)이 아니다', () => {
    assert.equal(BALANCE.HIDDEN_BOSS_ENCOUNTER_CHANCE, 0.03);
    assert.deepEqual(HIDDEN_BOSS_UNLOCKS.map((entry) => entry.boss), ['시간의 파수꾼', '원한의 용사', '공허의 군주', '에테르 군주']);
    for (const entry of HIDDEN_BOSS_UNLOCKS) {
        const player = unlockedAt(entry);
        assert.ok(entry.isUnlocked(player), `${entry.boss} 해금`);
        const counts = sweep(spawnName(entry.loc, player));
        const share = (counts.get(entry.boss) || 0) / N;
        assert.ok(Math.abs(share - BALANCE.HIDDEN_BOSS_ENCOUNTER_CHANCE) <= 1 / N, `${entry.boss}: ${share}`);
        // 일반 몬스터는 나머지를 고르게 나눈다.
        const monsters = DB.MAPS[entry.loc].monsters;
        for (const name of monsters) {
            const each = (counts.get(name) || 0) / N;
            assert.ok(Math.abs(each - (1 - BALANCE.HIDDEN_BOSS_ENCOUNTER_CHANCE) / monsters.length) <= 2 / N, `${entry.loc} ${name}: ${each}`);
        }
        // 나온 숨은 보스는 보스로 정산된다.
        const boss = spawnEnemy(DB.MAPS[entry.loc], player, [], { addLog: () => {} }, { rng: () => 0.999 }).mStats;
        assert.equal(boss.baseName, entry.boss);
        assert.equal(boss.isBoss, true);
    }
});

test('[난수] 추첨은 한 번이다 — 해금 전 · 다른 지역에서는 이전과 같은 칸을 뽑는다', () => {
    for (const entry of HIDDEN_BOSS_UNLOCKS) {
        const monsters = DB.MAPS[entry.loc].monsters;
        // 해금 전: 이전 규칙 그대로 floor(r × n)번째.
        for (let k = 0; k < 500; k += 1) {
            const roll = (k + 0.5) / 500;
            assert.equal(spawnName(entry.loc, lockedAt(entry))(() => roll), monsters[Math.floor(roll * monsters.length)], `${entry.loc} 해금 전 r=${roll}`);
        }
        // 해금했어도 다른 지역에서는 숨은 보스가 끼지 않는다.
        const elsewhere = { ...unlockedAt(entry), loc: '고요한 숲' };
        assert.equal(sweep(spawnName('고요한 숲', elsewhere)).get(entry.boss), undefined);
    }
    // 선택 함수의 추첨 수: 숨은 보스가 있어도 없어도 1번.
    for (const hidden of [[], ['원한의 용사']]) {
        let draws = 0;
        const rng = () => { draws += 1; return 0.5; };
        selectEncounterMonster(DB.MAPS['지하 미궁'].monsters, DB.MAPS['지하 미궁'], lockedAt(HIDDEN_BOSS_UNLOCKS[1]), rng, hidden, hidden.length * BALANCE.HIDDEN_BOSS_ENCOUNTER_CHANCE);
        assert.equal(draws, 1, `숨은 보스 ${hidden.length}`);
    }
});

test('[허공의 눈] 숨은 보스도 같은 배수(×3)로 오른다 — 해금되지 않은 숨은 보스는 여전히 부르지 않는다', () => {
    const eye = RELICS.find((relic) => relic.effect === 'boss_hunter');
    const mult = Math.floor(eye.val.spawn);
    assert.equal(mult, 3);
    const entry = HIDDEN_BOSS_UNLOCKS.find((row) => row.boss === '원한의 용사');
    const counts = sweep(spawnName(entry.loc, unlockedAt(entry), [eye]));
    assert.ok(Math.abs((counts.get(entry.boss) || 0) / N - BALANCE.HIDDEN_BOSS_ENCOUNTER_CHANCE * mult) <= 1 / N);
    assert.equal(sweep(spawnName(entry.loc, lockedAt(entry), [eye])).get(entry.boss), undefined);
});
