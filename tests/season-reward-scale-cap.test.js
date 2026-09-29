import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import { SEASON_REWARDS, getSeasonRewardScale } from '../src/data/seasonPass.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';

/**
 * 2026-09 Wave 37 — 시즌 보상 배율 상한 (소유자 결정 "시즌 배율 상한 낮추기").
 *
 * 시즌 무료 트랙은 시즌당 77,000골드이고 시즌마다 ×1.35가 붙어 S6부터 ×4에서 멈췄다. 시즌은 10 모델시간마다 돌아서
 * 225 모델시간 동안 무료 트랙 골드만 약 632만(최대 보유 골드 242만 → 750만)이었다(원장 §36.3). 상한을 ×1.5로 낮춘다.
 */

const FREE_GOLD_PER_SEASON = SEASON_REWARDS.reduce((sum, row) => sum + (row.free?.gold || 0), 0);

const claimWholeSeason = (ordinal) => {
    let state = {
        ...structuredClone(INITIAL_STATE),
        bootStage: 'ready',
        player: {
            ...structuredClone(INITIAL_STATE.player),
            name: '시즌 순례자',
            gold: 0,
            seasonPass: { xp: 30 * 200, tier: 30, claimed: [], isPremium: false, seasonId: `S${ordinal}`, ordinal },
        },
    };
    for (let tier = 1; tier <= 30; tier += 1) {
        const before = state;
        state = gameReducer(state, { type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
        assert.notEqual(state, before, `전제: 시즌 ${ordinal} ${tier}단계 수령`);
    }
    return state.player.gold;
};

test('[상한] 시즌 배율은 ×1.5에서 멈춘다 (S1 ×1 · S2 ×1.35 · S3부터 ×1.5)', () => {
    assert.equal(BALANCE.SEASON_REWARD_SCALE_MAX, 1.5);
    assert.equal(getSeasonRewardScale(1), 1);
    assert.equal(getSeasonRewardScale(2), 1.35);
    for (const ordinal of [3, 6, 12, 23, 100]) assert.equal(getSeasonRewardScale(ordinal), 1.5, `S${ordinal}`);
});

test('[실제 수령] 6시즌 30단계 무료 트랙 골드는 77,000 × 1.5다 (×4일 때 308,000)', () => {
    assert.equal(FREE_GOLD_PER_SEASON, 77_000);
    const gold = claimWholeSeason(6);
    assert.ok(Math.abs(gold - FREE_GOLD_PER_SEASON * 1.5) <= 30, `수령 골드 ${gold}`);
    assert.ok(gold < FREE_GOLD_PER_SEASON * 2, '예전 상한(×4)의 절반에도 못 미친다');
});

test('[초반 보존] 1시즌 무료 트랙 골드는 그대로 77,000이다', () => {
    assert.equal(claimWholeSeason(1), FREE_GOLD_PER_SEASON);
});
