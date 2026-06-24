import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';

/**
 * C-1 (B+ 2026-06): 첫 죽음 영구 메타 보상.
 *
 * 의도: 사망 = 레벨1 완전 리셋(가혹)인데 초반엔 거의 안 죽어 그 무게가 체감되지
 *   않는다. 첫 죽음에 소액 영구 메타 보너스를 주어 "죽어도 남는다 + 다음은 더
 *   강하게"를 1회차에 학습시켜 페널티를 공정하게 완충한다 (Rogue Legacy/Hades 모델).
 */

const buildPlayer = (overrides = {}) => ({
    ...INITIAL_STATE.player,
    name: 'tester',
    level: 3,
    hp: 0,
    ...overrides,
});

test('C-1: 첫 죽음(deaths 0) → 영구 메타 보너스 지급', () => {
    const player = buildPlayer({ stats: { ...INITIAL_STATE.player.stats, deaths: 0 } });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);

    assert.equal(result.updatedPlayer.meta.bonusAtk, BALANCE.FIRST_DEATH_BONUS_ATK);
    assert.equal(result.updatedPlayer.meta.bonusHp, BALANCE.FIRST_DEATH_BONUS_HP);
    // starter 스탯에 즉시 합산 (다음 런 시작이 강해짐)
    assert.equal(result.updatedPlayer.atk, INITIAL_STATE.player.atk + BALANCE.FIRST_DEATH_BONUS_ATK);
});

test('C-1: 첫 죽음 로그에 각성 안내 포함', () => {
    const player = buildPlayer({ stats: { ...INITIAL_STATE.player.stats, deaths: 0 } });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    const metaLog = result.logs.find((l) => l.text === MSG.FIRST_DEATH_META(BALANCE.FIRST_DEATH_BONUS_ATK, BALANCE.FIRST_DEATH_BONUS_HP));
    assert.ok(metaLog, '첫 죽음 메타 보상 로그 존재');
});

test('C-1: 두 번째 이후 죽음(deaths≥1) → 추가 보너스 없음', () => {
    const player = buildPlayer({
        stats: { ...INITIAL_STATE.player.stats, deaths: 3 },
        meta: { ...CombatEngine.DEFAULT_META, bonusAtk: 5, bonusHp: 50 },
    });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    // 보너스 변동 없음
    assert.equal(result.updatedPlayer.meta.bonusAtk, 5);
    assert.equal(result.updatedPlayer.meta.bonusHp, 50);
    // 메타 보상 로그 없음 (DEFEAT 로그만)
    assert.equal(result.logs.length, 1);
    assert.equal(result.logs[0].text, MSG.DEFEAT);
});

test('C-1: 첫 죽음도 deaths += 1 증가는 유지 (회귀 가드)', () => {
    const player = buildPlayer({ stats: { ...INITIAL_STATE.player.stats, deaths: 0 } });
    const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
    assert.equal(result.updatedPlayer.stats.deaths, 1);
});
