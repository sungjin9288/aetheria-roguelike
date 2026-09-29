import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getEssenceGainFromExp } from '../src/systems/essenceLedger.ts';

/**
 * 2026-09 Wave 32 (소유자 결정 "정수 획득을 √exp로").
 *
 * 처치당 정수가 `floor(exp / 8)`이던 동안 한 런의 누적 정수는 9만~18만이었다(전투 1,500~1,900회 × 평균 63~121).
 * 150마다 영구 공격력 +1이라 런마다 +600~1,200이 쌓였고, rank 4 캐릭터는 Lv1에서 전투 공격력 3,732였다(원장 §32).
 * 계승 런의 적 강화를 rank당 +20%까지 올려도 사망이 0이던 원인이다. 이제 처치당 정수는 `floor(√exp × 배율)`이다 —
 * Lv5~10 구간(exp 63~125)은 7~11로 거의 그대로이고, Lv48(마왕성 평균 exp 611)은 76 → 24로 줄어든다.
 */

test('[초반] Lv5~10 구간의 처치당 정수는 예전과 같은 자릿수다(거울 첫 구매 접근성 유지)', () => {
    assert.equal(BALANCE.ESSENCE_EXP_ROOT_SCALE, 1);
    assert.equal(getEssenceGainFromExp(64), 8);
    assert.equal(getEssenceGainFromExp(100), 10);
    assert.equal(getEssenceGainFromExp(125), 11);
});

test('[후반] 마왕성 평균 exp(611)의 처치당 정수는 24다 — exp/8(76)의 약 1/3', () => {
    assert.equal(getEssenceGainFromExp(611), 24);
    assert.ok(getEssenceGainFromExp(1054) <= 32, '에테르 관문 평균 exp도 32 이하');
});

test('[배율] 프레스티지·거울 획득 배율은 근 위에 곱해진다', () => {
    assert.equal(getEssenceGainFromExp(400, 1.2), 24);
    assert.equal(getEssenceGainFromExp(400, 1.5), 30);
});

test('[최소] exp가 0이거나 비정상이어도 처치당 1은 준다', () => {
    assert.equal(getEssenceGainFromExp(0), 1);
    assert.equal(getEssenceGainFromExp(-50), 1);
    assert.equal(getEssenceGainFromExp(Number.NaN), 1);
});

test('[원장] 전투 승리 정산이 √exp 획득량을 누적 원장에 넣는다', () => {
    const basePlayer = {
        level: 30, exp: 0, nextExp: 9_999_999, gold: 0, maxHp: 400, hp: 400, maxMp: 80, mp: 80,
        atk: 40, def: 20, relics: [], stats: {},
        meta: { essence: 0, essenceLifetime: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 0, mirror: {} },
    };
    const enemy = { name: '해골 전사', baseName: '해골 전사', exp: 625, gold: 50, level: 30 };
    const meta = CombatEngine.handleVictory(basePlayer, enemy, {}, {}).updatedPlayer.meta;
    assert.equal(meta.essence, 25);
    assert.equal(meta.essenceLifetime, 25);
});
