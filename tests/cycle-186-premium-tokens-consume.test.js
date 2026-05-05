import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * cycle 186: PremiumShop 'reviveTokens' / 'synthProtects' 토큰 소비 로직 추가 (dead purchase fix).
 *
 * 발견:
 * - PremiumShop 4종 중 2종이 'dead purchase' — 구매되지만 게임 로직에서 소비
 *   안 함:
 *   1. reviveTokens (즉시 부활권, 200 premium) — purchaseRevive로 +1되지만
 *      어디에서도 -1 / 사용 안 함. 사망 시 spec 'HP/MP 50% 회복 후 즉시 부활'
 *      미구현.
 *   2. synthProtects (합성 보호권, 가격 별도) — purchaseSynthProtect로 +1
 *      되지만 synthesize 함수가 보유 토큰 무시하고 premium currency만 차감.
 *      구매한 토큰이 영원히 stats에만 남음.
 *
 * 수정:
 * 1. CombatEngine.applyFatalProtection — death save chain의 새 fallback 추가:
 *    void_heart 다음, phoenix_revive 전에 reviveTokens 분기. nextHp = maxHp 50%,
 *    flags.reviveTokenUsed = true. updatedPlayer 합류 시점에 reviveTokens -1
 *    + mp = maxMp 50% (spec).
 * 2. useInventoryActions.synthesize — useProtect 시 synthProtects 토큰 우선
 *    소비 (없으면 기존 premium currency 차감 패턴 유지).
 */

test('cycle 186: reviveTokens 소비 — HP 0 도달 시 자동 부활', () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 0, maxMp: 100,
        relics: [], // death_save / void_heart / phoenix_revive 없음
        combatFlags: {},
        status: [],
        reviveTokens: 1,
    };
    const result = CombatEngine.applyFatalProtection(player, [], 50, [], []);

    // HP 50% 회복 (500), 부활 성공.
    assert.equal(result.updatedPlayer.hp, 500);
    assert.equal(result.isDead, false);
    // 토큰 1 → 0 차감.
    assert.equal(result.updatedPlayer.reviveTokens, 0);
    // MP 50% 회복.
    assert.equal(result.updatedPlayer.mp, 50);
});

test('cycle 186: reviveTokens 0 → 부활 안 함 (회귀 가드)', () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 100,
        relics: [],
        combatFlags: {},
        status: [],
        reviveTokens: 0,
    };
    const result = CombatEngine.applyFatalProtection(player, [], 50, [], []);
    // 부활 없음 → hp 0, 사망.
    assert.equal(result.updatedPlayer.hp, 0);
    assert.equal(result.isDead, true);
});

test('cycle 186: void_heart 우선 — reviveTokens 보유해도 voidHeart 먼저', () => {
    const player = {
        hp: 0, maxHp: 1000, mp: 50, maxMp: 100,
        relics: [{ effect: 'void_heart' }],
        combatFlags: {},
        status: [],
        reviveTokens: 5,
    };
    const result = CombatEngine.applyFatalProtection(player, player.relics, 50, [], []);
    // void_heart 발동: hp = 1, voidHeartUsed = true. reviveTokens 보존.
    assert.equal(result.updatedPlayer.hp, 1);
    assert.equal(result.updatedPlayer.combatFlags.voidHeartUsed, true);
    assert.notEqual(result.updatedPlayer.combatFlags.reviveTokenUsed, true);
    // reviveTokens 변화 없음 (소비 안 됨).
    // (cycle 186 토큰은 reviveTokens 필드를 그대로 둠 — voidHeart 분기에서 안 건드림.)
});

test('cycle 186: synthProtects 토큰 소비 — useProtect 시 token 우선', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const src = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.ts'), 'utf8');
    // synthesize 함수에 useToken 변수 + synthProtects 차감 로직 명시.
    assert.match(src, /useToken/, 'cycle 186: useToken 변수 도입');
    assert.match(src, /synthProtects/, 'synthProtects 참조');
    // ownedTokens > 0 시 premium currency 차감 안 함.
    assert.match(src, /useToken \?\s*0\s*:\s*result\.premiumSpent/);
});
