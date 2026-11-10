/**
 * 후반 경험 구간 배율 계약 — 2026-11 H2 커밋 2(소유자 결정 S1 "1회차 Lv41-48 비중 약 40%").
 *
 * 레벨 EXP_LATE_BAND.from → .to 사이의 레벨업 요구량만 EXP_SCALE_RATE_LATE로 굴리고, 그 밖은 압축 전 곡선
 * (200에서 ×1.15 내림, 150,000 상한)과 같다. 구간 밖 오라클은 상수를 읽지 않고 숫자로 적는다 — 기본 곡선
 * 상수를 바꾸면 이 파일이 붉어져야 한다. 구간 배율 값은 측정으로 정해 BALANCE에서 읽는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getLevelExpRequirement } from '../src/systems/expCurve.ts';

const ORIGINAL_START = 200;
const ORIGINAL_RATE = 1.15;
const ORIGINAL_CAP = 150000;
const { from: BAND_FROM, to: BAND_TO } = BALANCE.EXP_LATE_BAND;

/** 압축 전 곡선: 레벨 level의 요구량(level → level + 1). */
const originalRequirement = (level) => {
    let requirement = ORIGINAL_START;
    for (let current = 2; current <= level; current += 1) {
        requirement = Math.min(Math.floor(requirement * ORIGINAL_RATE), ORIGINAL_CAP);
    }
    return requirement;
};

test('구간 선언: Lv40 → 48, 배율은 기본 배율보다 작고 0.9 이상이다', () => {
    assert.equal(BAND_FROM, 40);
    assert.equal(BAND_TO, 48);
    assert.ok(BALANCE.EXP_SCALE_RATE_LATE < BALANCE.EXP_SCALE_RATE);
    assert.ok(BALANCE.EXP_SCALE_RATE_LATE >= 0.9);
});

test('구간 앞(Lv1 - 40): 요구량이 압축 전 곡선과 같다', () => {
    for (let level = 1; level <= BAND_FROM; level += 1) {
        assert.equal(getLevelExpRequirement(level), originalRequirement(level), `Lv${level}`);
    }
});

test('구간 안(Lv41 - 48): 레벨마다 이전 요구량 × EXP_SCALE_RATE_LATE(내림)', () => {
    for (let level = BAND_FROM + 1; level <= BAND_TO; level += 1) {
        const expected = Math.min(Math.floor(getLevelExpRequirement(level - 1) * BALANCE.EXP_SCALE_RATE_LATE), ORIGINAL_CAP);
        assert.equal(getLevelExpRequirement(level), expected, `Lv${level}`);
        assert.ok(getLevelExpRequirement(level) < originalRequirement(level), `Lv${level}은 압축 전보다 싸다`);
    }
});

test('구간 뒤(Lv49 -): ×1.15로 돌아가고 150,000 상한에서 멈춘다', () => {
    for (let level = BAND_TO + 1; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        const expected = Math.min(Math.floor(getLevelExpRequirement(level - 1) * ORIGINAL_RATE), ORIGINAL_CAP);
        assert.equal(getLevelExpRequirement(level), expected, `Lv${level}`);
    }
    assert.equal(getLevelExpRequirement(CONSTANTS.MAX_LEVEL), ORIGINAL_CAP);
});

test('Lv1 → 48 누적 요구량이 압축 전보다 적다(구간 밖은 그대로라 줄어든 몫은 모두 구간 안이다)', () => {
    let compressed = 0;
    let original = 0;
    for (let level = 1; level < BAND_TO; level += 1) {
        compressed += getLevelExpRequirement(level);
        original += originalRequirement(level);
    }
    let bandSaving = 0;
    for (let level = BAND_FROM + 1; level < BAND_TO; level += 1) bandSaving += originalRequirement(level) - getLevelExpRequirement(level);
    assert.equal(original - compressed, bandSaving);
    assert.ok(bandSaving > 0);
});

test('처음 오르기 = 다시 오르기: 사망 재시작한 캐릭터가 같은 경험으로 같은 레벨 · 요구량에 닿는다(원장 §139)', () => {
    const fresh = structuredClone(INITIAL_STATE.player);
    const veteran = { ...structuredClone(INITIAL_STATE.player), level: 47, exp: 1234, nextExp: 999999 };
    const restarted = CombatEngine.handleDefeat(veteran, structuredClone(INITIAL_STATE.player), () => 0.5, () => 1).updatedPlayer;
    assert.equal(restarted.level, 1);
    assert.equal(restarted.nextExp, getLevelExpRequirement(1));

    let totalToBandEnd = 0;
    for (let level = 1; level < BAND_TO; level += 1) totalToBandEnd += getLevelExpRequirement(level);
    const climbFresh = CombatEngine.applyExpGain(fresh, totalToBandEnd).updatedPlayer;
    const climbAgain = CombatEngine.applyExpGain(restarted, totalToBandEnd).updatedPlayer;
    assert.equal(climbFresh.level, BAND_TO);
    assert.equal(climbAgain.level, BAND_TO);
    assert.equal(climbFresh.nextExp, getLevelExpRequirement(BAND_TO));
    assert.equal(climbAgain.nextExp, climbFresh.nextExp);
    assert.equal(climbAgain.exp, climbFresh.exp);
});
