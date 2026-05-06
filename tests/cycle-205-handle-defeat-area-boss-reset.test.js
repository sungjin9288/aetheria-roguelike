import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * cycle 205: handleDefeat가 areaBossDefeated를 per-run flag로 reset.
 *
 * 발견 (signature 드롭 path 잠복 lock):
 * - exploreUtils.ts:144 주석: '구역 보스 (15% 확률 스폰) — mapData.boss가 문자열이고
 *   이번 런 미처치 시 보장' — areaBossDefeated는 per-RUN flag.
 * - exploreUtils.ts:147: 게이트 `!(player.stats?.areaBossDefeated?.[areaBossName])` —
 *   defeated이면 spawnAreaBoss=false → 더 이상 spawn 안 함.
 * - combatVictory.ts:158: boss 처치 시 areaBossDefeated[name] = true 마킹.
 *
 * 문제 (handleDefeat ...prevStats spread 회귀):
 * - handleDefeat(CombatEngine.ts:1459): `starterState.stats = {...starterState.stats,
 *   ...prevStats, deaths: ...}` — prevStats spread로 areaBossDefeated 통째로 보존.
 * - 결과: 사망 후 재진입 시 이전 런에서 처치한 area boss가 더 이상 spawn 안 함.
 * - signature drop은 보스 kill에서만 발생 → 같은 보스 재대전 불가 → 그 area의
 *   signature 영구 차단. signaturePity는 보스 kill에서 +=1 하므로 pity counter도
 *   climb 불가 — mercy 시스템 (cycle 75)도 작동 차단.
 * - 다음 ASCEND까지 그 area의 signature 회수 영구 봉인.
 *
 * 정합성:
 * - ASCEND (progressionHandlers.ts:60): areaBossDefeated 미보존 → reset to {} ✓
 * - RESET_GAME (cycle 204): areaBossDefeated 미보존 → reset ✓
 * - handleDefeat: 유일하게 preserve → 회귀.
 *
 * 수정 (src/systems/CombatEngine.ts handleDefeat):
 * - prevStats spread 후 areaBossDefeated 명시 reset to {}.
 * - 다른 multi-run 카운터(kills/killRegistry/codex)는 그대로 보존 (cycle 119/202/203 정합).
 */

const buildPlayer = (areaBossDefeated) => ({
    ...INITIAL_STATE.player,
    name: 'Test',
    hp: 0,
    maxHp: 100,
    stats: {
        ...INITIAL_STATE.player.stats,
        kills: 50,
        bossKills: 3,
        killRegistry: { '슬라임': 30, '봄의 여왕': 1 },
        areaBossDefeated,
    },
});

test('cycle 205: handleDefeat가 areaBossDefeated reset (per-run flag)', () => {
    const player = buildPlayer({ '봄의 여왕': true, '서리 군주': true });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {},
        '사망 후 areaBossDefeated 리셋되어야 area boss 재진입 가능');
});

test('cycle 205: handleDefeat가 areaBossDefeated 미정의 시 {} (구형 save)', () => {
    const player = { ...INITIAL_STATE.player, name: 'Test', hp: 0, maxHp: 100 };
    delete player.stats.areaBossDefeated;
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {});
});

test('cycle 205: areaBossDefeated reset이 다른 multi-run 카운터를 깨지 않음 (회귀 가드)', () => {
    const player = buildPlayer({ '봄의 여왕': true });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    // 다른 multi-run 카운터는 보존
    assert.equal(result.updatedPlayer.stats.kills, 50);
    assert.equal(result.updatedPlayer.stats.bossKills, 3);
    assert.deepEqual(result.updatedPlayer.stats.killRegistry, { '슬라임': 30, '봄의 여왕': 1 });
    // deaths += 1 (cycle 191 회귀 가드)
    assert.equal(result.updatedPlayer.stats.deaths, 1);
});

test('cycle 191 회귀 가드: META 진행도 6종 보존 동시 유지', () => {
    const player = {
        ...INITIAL_STATE.player,
        name: 'Test',
        hp: 0,
        maxHp: 100,
        titles: ['warrior'],
        activeTitle: 'warrior',
        premiumCurrency: 100,
        reviveTokens: 2,
        maxInv: 25,
        seasonPass: { xp: 100, tier: 5, claimed: [], isPremium: true, seasonId: 'S1' },
        stats: {
            ...INITIAL_STATE.player.stats,
            areaBossDefeated: { '봄의 여왕': true },
            cosmeticTitles: ['별을 보는 자'],
            synthProtects: 1,
        },
    };
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    // cycle 191
    assert.deepEqual(result.updatedPlayer.titles, ['warrior']);
    assert.equal(result.updatedPlayer.activeTitle, 'warrior');
    assert.equal(result.updatedPlayer.premiumCurrency, 100);
    assert.equal(result.updatedPlayer.reviveTokens, 2);
    assert.equal(result.updatedPlayer.maxInv, 25);
    assert.deepEqual(result.updatedPlayer.seasonPass, { xp: 100, tier: 5, claimed: [], isPremium: true, seasonId: 'S1' });
    // cycle 188
    assert.deepEqual(result.updatedPlayer.stats.cosmeticTitles, ['별을 보는 자']);
    assert.equal(result.updatedPlayer.stats.synthProtects, 1);
    // cycle 205
    assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {});
});

test('cycle 205: 처치 안 된 areaBossDefeated 빈 {}는 그대로 빈 {}', () => {
    const player = buildPlayer({});
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {});
});
