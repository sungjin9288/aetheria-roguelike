import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.ts';
import { getPrestigeEnemyLevelBonus, getPrestigeEnemyLevelRate } from '../src/systems/metaBonusRamp.ts';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 73 — 소유자 결정 "현행 유지하되 회차가 누적됨에 따라 몬스터들도 강해지는 걸로".
 *
 * Wave 40의 적 전투 레벨 비율(rank당 +10%)은 rank 3에서 상한 30%에 닿아 4회차부터 그대로였다. 자연 플레이(80시드 ×
 * 계승 5회)에서 2 · 3회차는 72 · 68%가 한 번도 죽지 않았다. 상한만 없앤 직선(rank당 +10%)과 기울기를 올린 직선
 * (+20%)은 회차가 쌓일수록 끝없이 커져, +20%는 5 · 6회차에 런당 사망 4.2 · 6.5회 · 최악 시드 15 · 18회의 사망 루프였다.
 * 비율은 이제 `LIMIT × (1 − DECAY^rank)`다 — 계승할 때마다 오르고 오르는 폭은 줄어든다(원장 §76).
 */

const rate = (rank) => getPrestigeEnemyLevelRate(rank);

test('[곡선] rank 1 ~ 5의 적 전투 레벨 비율은 +21 · 35 · 44 · 49 · 53%이고 rank 0은 0이다', () => {
    assert.equal(rate(0), 0);
    assert.deepEqual([1, 2, 3, 4, 5].map((rank) => Math.round(rate(rank) * 100)), [21, 35, 44, 49, 53]);
});

test('[회차마다 강해진다] 비율은 계승할 때마다 오르고, 오르는 폭은 줄어든다', () => {
    for (let rank = 0; rank < 40; rank += 1) {
        assert.ok(rate(rank + 1) > rate(rank), `rank ${rank} → ${rank + 1}: ${rate(rank)} → ${rate(rank + 1)}`);
    }
    for (let rank = 1; rank < 40; rank += 1) {
        const before = rate(rank) - rate(rank - 1);
        const after = rate(rank + 1) - rate(rank);
        assert.ok(after < before, `rank ${rank}: 증가폭 ${before} → ${after}`);
    }
});

test('[사망 루프 방지] 비율은 몇 번을 계승해도 LIMIT(60%)을 넘지 않는다', () => {
    for (const rank of [0, 1, 5, 10, 20, 50, 100, 1000]) {
        assert.ok(rate(rank) <= BALANCE.PRESTIGE_ENEMY_LEVEL_PCT_LIMIT, `rank ${rank}: ${rate(rank)}`);
    }
    // Lv48 마왕성 적은 어느 rank에서도 전투 레벨 +29 이하다(직선 +20%/rank는 rank 5에서 +48이었다).
    assert.ok(getPrestigeEnemyLevelBonus(1000, 48) <= Math.round(48 * BALANCE.PRESTIGE_ENEMY_LEVEL_PCT_LIMIT));
    // 초반 지역(Lv1 ~ 5)은 비례 가산이라 어느 rank에서도 +3 이하다 — 고정 가산의 사망 루프(Wave 40)가 돌아오지 않는다.
    for (let level = 1; level <= 5; level += 1) {
        assert.ok(getPrestigeEnemyLevelBonus(1000, level) <= 3, `Lv${level}: +${getPrestigeEnemyLevelBonus(1000, level)}`);
    }
});

test('[실제 적] 마왕성 · 용의 둥지 적의 생명 · 공격력 · 방어력은 계승할 때마다 커진다(rank 0 ~ 20)', () => {
    for (const [loc, species] of [['마왕성', '지옥의 문지기'], ['용의 둥지', '화염 와이번']]) {
        const map = DB.MAPS[loc];
        const spawnAt = (rank) => spawnEnemy(
            { ...map, monsters: [species], boss: false, bossMonsters: [] },
            { level: 50, loc, relics: [], meta: { prestigeRank: rank }, stats: {} },
            [],
            { addLog: () => {} },
            { rng: () => 0.99 },
        ).mStats;
        let previous = spawnAt(0);
        for (let rank = 1; rank <= 20; rank += 1) {
            const enemy = spawnAt(rank);
            assert.equal(enemy.baseName ?? species, species);
            assert.ok(enemy.maxHp > previous.maxHp, `${loc} rank ${rank}: 생명 ${previous.maxHp} → ${enemy.maxHp}`);
            assert.ok(enemy.atk > previous.atk, `${loc} rank ${rank}: 공격력 ${previous.atk} → ${enemy.atk}`);
            assert.ok(enemy.def >= previous.def, `${loc} rank ${rank}: 방어력 ${previous.def} → ${enemy.def}`);
            previous = enemy;
        }
    }
});

test('[계승 화면] 지금 → 다음 세계의 적 전투 레벨 가산은 엔진 곡선 그대로이고, 적은 언제나 더 강해진다고 보인다', () => {
    for (let rank = 0; rank <= 15; rank += 1) {
        const outcome = getAscensionOutcome({ prestigeRank: rank });
        assert.equal(outcome.currentEnemyLevelPercent, Math.round(rate(rank) * 100), `rank ${rank}: 지금`);
        assert.equal(outcome.nextEnemyLevelPercent, Math.round(rate(rank + 1) * 100), `rank ${rank}: 다음`);
        assert.ok(outcome.nextEnemyLevelPercent >= outcome.currentEnemyLevelPercent);
        // 반올림한 레벨 비율이 같아지는 깊은 rank에서도 적 능력치 배율은 오른다 — 화면은 언제나 "더 강해진다"를 보인다.
        assert.ok(outcome.nextEnemyStatPercent > outcome.currentEnemyStatPercent, `rank ${rank}: 적 능력치`);
    }
    const html = renderStatic(createElement(AscensionScreen, { player: makePlayerFixture({ meta: { prestigeRank: 3 }, quests: [] }) }));
    assert.ok(html.includes(MSG.ASCENSION_ENEMY_LEVEL_BONUS(44, 49)), '계승 화면(rank 3 → 4)이 엔진 값을 그린다');
});
