import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

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
    // 다음 런 시작이 강해진다 — 전투 공격력(calculateFullStats)이 보너스만큼 오른다.
    //   2026-09 Wave 32: 예전에는 `updatedPlayer.atk` 필드를 핀으로 고정했는데, 계산기도 `meta.bonusAtk`를 더하므로
    //   필드에 굽는 것은 이중 가산이었다(아래 [사망 재시작] 행).
    //   2026-09 Wave 40: 영구 스탯은 레벨 연동이라 새 런 Lv1에서는 1/`META_BONUS_FULL_LEVEL`이고 그 레벨에서 전부다.
    const fullLevel = BALANCE.META_BONUS_FULL_LEVEL;
    const atkAt = (bonusAtk) => calculateFullStats({ ...result.updatedPlayer, level: fullLevel, meta: { ...result.updatedPlayer.meta, bonusAtk } }).atk;
    assert.equal(result.updatedPlayer.atk, INITIAL_STATE.player.atk, '기본 공격력 필드에는 굽지 않는다');
    assert.ok(atkAt(BALANCE.FIRST_DEATH_BONUS_ATK) > atkAt(0), '보너스가 전투 공격력에 반영된다(연동 완료 레벨)');
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

test('[사망 재시작] 영구 공격력(meta.bonusAtk)은 전투 공격력에 한 번만 더해진다', () => {
    // 2026-09 Wave 32: `handleDefeat`가 `meta.bonusAtk`를 새 캐릭터의 `atk` 필드에 굽고, `calculateFullStats`가
    //   같은 값을 다시 더했다. 정수 사다리로 bonusAtk가 1,000이면 사망 뒤 전투 공격력이 2,408, 같은 meta로
    //   계승한 캐릭터는 1,212였다 — 죽으면 강해졌다. `start()`가 `atk`를 다시 쓰지 않으므로 다음 런 내내 유지됐다.
    for (const bonusAtk of [5, 100, 1000]) {
        const meta = { ...CombatEngine.DEFAULT_META, ...INITIAL_STATE.player.meta, bonusAtk, bonusHp: 50 };
        const player = buildPlayer({ level: 30, atk: 60, meta, stats: { ...INITIAL_STATE.player.stats, deaths: 3 } });
        const restarted = CombatEngine.handleDefeat(player, INITIAL_STATE.player, () => 0.5, () => 0).updatedPlayer;
        const fresh = { ...INITIAL_STATE.player, name: '', meta: restarted.meta };
        assert.equal(calculateFullStats(restarted).atk, calculateFullStats(fresh).atk, `bonusAtk ${bonusAtk}`);
    }
});
