import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 265: liveConfig.seasonEvent / eventMultiplier 보너스 dispatch 누락 dead config
 *   (cycle 222-264 silent dead config 시리즈 36번째 — 가장 큰 player-facing UX 회귀).
 *
 * 발견 (CRITICAL UX dead config):
 * - GameRoot 배너에 "⚡ 시즌 이벤트 진행 중 | 골드+30% XP+50%" 표시 (UI 광고).
 * - liveConfig 구조: { eventMultiplier, announcement, seasonEvent: { goldMultiplier, xpMultiplier, ... } }.
 * - 그러나 src/ 전체 검색에서 goldMultiplier / xpMultiplier / eventMultiplier dispatch 0건 —
 *   handleVictory가 expMult / goldMult를 계산하지만 liveConfig 정보 무시.
 * - SystemTab admin이 eventMultiplier 1-5로 변경하는 UI도 dead — 변경해도 게임에 영향 0.
 * - 결과: 시즌 이벤트 진행 중 광고된 보너스가 fake. 플레이어가 받는 gold/exp는 평소와 동일.
 *
 * 패턴 (cycle 222-264 silent dead config 시리즈 36번째 — UX 광고 vs 실제 동작 모순):
 * - cycle 245: BOSS_BRIEFS UI dispatch.
 * - cycle 250: stats.activeSet UI dispatch.
 * - cycle 261: claim 액션 sensory cue.
 * - cycle 265: liveConfig 보너스 dispatch (가장 큰 영향 — 시즌 이벤트 시스템 전체 활성화).
 *
 * 수정 (src/systems/CombatEngine.ts handleVictory):
 * - 4번째 param liveConfig 추가 (default 빈 객체).
 * - eventMultiplier (admin) 와 seasonEvent.xpMultiplier 적용 → expMult 추가 합산.
 * - seasonEvent.goldMultiplier 적용 → goldMult 추가 합산.
 * - liveConfig 미정의 시 default 1 fallback (회귀 가드).
 *
 * 회귀 가드:
 * - 기존 expMult / goldMult 계산 동작 유지 (relics, passive 등).
 * - liveConfig 미전달 시 기존 결과 동일.
 * - seasonEvent.active false 시 multiplier 무시.
 */

const makePlayer = () => ({
    name: 'Test', job: '전사', level: 30,
    hp: 100, maxHp: 1000, mp: 100, maxMp: 100,
    atk: 50, def: 20, gold: 0, exp: 0,
    relics: [], skillChoices: {}, titles: [], equip: {},
    combatFlags: {}, status: [], stats: {},
    skillLoadout: { selected: 0, cooldowns: {} },
    challengeModifiers: [],
});

const makeEnemy = () => ({
    name: '오크', baseName: '오크', hp: 0, maxHp: 100,
    atk: 50, def: 5, exp: 100, gold: 200,
});

test('cycle 265: liveConfig.seasonEvent.goldMultiplier 적용', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const liveConfig = {
        seasonEvent: { active: true, goldMultiplier: 2.0, xpMultiplier: 1.0 },
    };
    const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
    const boosted = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
    // baseline gold from enemy.gold * (1 + relicGold) * killBonus * levelPenalty * (challengeRewardMult).
    // boosted should be ~2x baseline (goldMultiplier 2.0).
    assert.ok(boosted.updatedPlayer.gold > baseline.updatedPlayer.gold,
        `seasonEvent goldMultiplier 2.0 → gold 증가 (baseline ${baseline.updatedPlayer.gold} vs boosted ${boosted.updatedPlayer.gold})`);
});

test('cycle 265: liveConfig.seasonEvent.xpMultiplier 적용', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const liveConfig = {
        seasonEvent: { active: true, goldMultiplier: 1.0, xpMultiplier: 1.5 },
    };
    const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
    const boosted = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
    assert.ok(boosted.expGained > baseline.expGained,
        `seasonEvent xpMultiplier 1.5 → exp 증가 (baseline ${baseline.expGained} vs boosted ${boosted.expGained})`);
});

test('cycle 265: liveConfig.eventMultiplier (admin) 적용', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const liveConfig = { eventMultiplier: 3.0 };
    const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
    const boosted = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
    // eventMultiplier 3.0 → exp 약 3배.
    assert.ok(boosted.expGained > baseline.expGained * 1.5,
        `eventMultiplier 3.0 → exp ≈3x (baseline ${baseline.expGained} vs boosted ${boosted.expGained})`);
});

test('cycle 265: seasonEvent.active false 시 multiplier 무시 (회귀 가드)', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const liveConfig = {
        seasonEvent: { active: false, goldMultiplier: 5.0, xpMultiplier: 5.0 },
    };
    const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
    const inactive = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
    // inactive 시 multiplier 미적용 → baseline과 동일.
    assert.equal(inactive.updatedPlayer.gold, baseline.updatedPlayer.gold,
        `seasonEvent.active false 시 gold 동일 (baseline ${baseline.updatedPlayer.gold} == inactive ${inactive.updatedPlayer.gold})`);
    assert.equal(inactive.expGained, baseline.expGained,
        `seasonEvent.active false 시 exp 동일`);
});

test('cycle 265: liveConfig 빈 객체 명시 vs 활성 객체 (회귀 가드)', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    // cycle 624: explicit default-elimination — 4 args 모두 명시 필수.
    const r1 = CombatEngine.handleVictory(player, enemy, {}, {});
    const r2 = CombatEngine.handleVictory(player, enemy, {}, {});
    assert.equal(r1.updatedPlayer.gold, r2.updatedPlayer.gold,
        '두 빈 객체 동일 동작');
    assert.equal(r1.expGained, r2.expGained, '두 빈 객체 expGained 동일');
});

test('cycle 265: liveConfig.eventMultiplier 1 (default) 시 영향 없음', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
    const neutral = CombatEngine.handleVictory(player, enemy, {}, { eventMultiplier: 1 });
    assert.equal(neutral.expGained, baseline.expGained,
        'eventMultiplier 1 시 동일 (회귀 가드)');
});
