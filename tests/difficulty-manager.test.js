/**
 * DifficultyManager 유닛 테스트
 *
 * DifficultyManager.js는 db.js 미의존 → 직접 import 가능.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    calcPerformanceScore,
    getDifficultyMults,
    makeBattleRecord,
    pushBattleRecord,
    countLowHpWins,
} from '../src/systems/DifficultyManager.js';

// ── calcPerformanceScore ────────────────────────────────────────────────────

test('calcPerformanceScore: 데이터 부족 (<5 battles) → 중립 0.5', () => {
    const player = { stats: { recentBattles: [{ result: 'win', hpRatio: 1 }] } };
    assert.equal(calcPerformanceScore(player), 0.5);
});

test('calcPerformanceScore: recentBattles 없음 → 0.5', () => {
    assert.equal(calcPerformanceScore({}), 0.5);
    assert.equal(calcPerformanceScore({ stats: {} }), 0.5);
});

test('calcPerformanceScore: 전승 (5전 5승, HP 100%) → 높은 점수', () => {
    const battles = Array.from({ length: 5 }, () => ({ result: 'win', hpRatio: 1.0 }));
    const score = calcPerformanceScore({ stats: { recentBattles: battles } });
    // winRate=1.0*0.40 + avgHp=1.0*0.30 + (1-0)*0.15 + (1-0)*0.15 = 1.0
    assert.ok(score >= 0.95, `전승은 0.95 이상이어야 합니다 (실제: ${score})`);
});

test('calcPerformanceScore: 전사 (5전 5사) → 낮은 점수', () => {
    const battles = Array.from({ length: 5 }, () => ({ result: 'death', hpRatio: 0 }));
    const score = calcPerformanceScore({ stats: { recentBattles: battles } });
    // winRate=0 + avgHp=0.5(기본) + (1-0)*0.15 + (1-1)*0.15 = 0.30
    assert.ok(score <= 0.35, `전사는 0.35 이하여야 합니다 (실제: ${score})`);
});

test('calcPerformanceScore: 혼합 (3승 1사 1탈) → 중간 점수', () => {
    const battles = [
        { result: 'win', hpRatio: 0.8 },
        { result: 'win', hpRatio: 0.5 },
        { result: 'win', hpRatio: 0.6 },
        { result: 'death', hpRatio: 0 },
        { result: 'escape', hpRatio: 0.3 },
    ];
    const score = calcPerformanceScore({ stats: { recentBattles: battles } });
    assert.ok(score > 0.3 && score < 0.9, `혼합은 0.3~0.9 사이여야 합니다 (실제: ${score})`);
});

test('calcPerformanceScore: 최근 20전만 분석 (WINDOW=20)', () => {
    // 25전: 처음 5전 전사, 마지막 20전 전승
    const oldBattles = Array.from({ length: 5 }, () => ({ result: 'death', hpRatio: 0 }));
    const recentBattles = Array.from({ length: 20 }, () => ({ result: 'win', hpRatio: 1.0 }));
    const score = calcPerformanceScore({ stats: { recentBattles: [...oldBattles, ...recentBattles] } });
    assert.ok(score >= 0.95, `최근 20전 전승이면 0.95 이상 (실제: ${score})`);
});

test('calcPerformanceScore: 결과는 0~1 범위', () => {
    const battles = Array.from({ length: 10 }, () => ({ result: 'win', hpRatio: 1.0 }));
    const score = calcPerformanceScore({ stats: { recentBattles: battles } });
    assert.ok(score >= 0 && score <= 1, `점수는 0~1 범위여야 합니다 (실제: ${score})`);
});

// ── getDifficultyMults ──────────────────────────────────────────────────────

test('getDifficultyMults: 점수 0.85 이상 → 압도', () => {
    const result = getDifficultyMults(0.90);
    assert.equal(result.label, '압도');
    assert.equal(result.hpMult, 1.15);
    assert.equal(result.atkMult, 1.15);
});

test('getDifficultyMults: 점수 0.72 → 우세', () => {
    const result = getDifficultyMults(0.75);
    assert.equal(result.label, '우세');
});

test('getDifficultyMults: 점수 0.55 → 균형', () => {
    const result = getDifficultyMults(0.60);
    assert.equal(result.label, '균형');
});

test('getDifficultyMults: 점수 0.40 → 박빙', () => {
    const result = getDifficultyMults(0.45);
    assert.equal(result.label, '박빙');
});

test('getDifficultyMults: 점수 0.25 → 열세', () => {
    const result = getDifficultyMults(0.30);
    assert.equal(result.label, '열세');
    assert.equal(result.hpMult, 0.90);
});

test('getDifficultyMults: 점수 0.0 → 위기', () => {
    const result = getDifficultyMults(0.0);
    assert.equal(result.label, '위기');
    assert.equal(result.hpMult, 0.85);
    assert.equal(result.atkMult, 0.85);
});

test('getDifficultyMults: 경계값 0.85 정확히 → 압도', () => {
    assert.equal(getDifficultyMults(0.85).label, '압도');
});

test('getDifficultyMults: 경계값 0.84 → 우세 (압도 미만)', () => {
    assert.equal(getDifficultyMults(0.84).label, '우세');
});

// ── makeBattleRecord ────────────────────────────────────────────────────────

test('makeBattleRecord: hpRatio 0~1 범위로 clamp', () => {
    const record = makeBattleRecord('win', 1.5);
    assert.equal(record.hpRatio, 1);
    assert.equal(record.result, 'win');
});

test('makeBattleRecord: 음수 hpRatio → 0으로 clamp', () => {
    const record = makeBattleRecord('death', -0.3);
    assert.equal(record.hpRatio, 0);
});

test('makeBattleRecord: 정상 범위 hpRatio 유지', () => {
    const record = makeBattleRecord('escape', 0.7);
    assert.equal(record.hpRatio, 0.7);
    assert.equal(record.result, 'escape');
});

test('makeBattleRecord: timestamp 포함', () => {
    const before = Date.now();
    const record = makeBattleRecord('win', 0.5);
    assert.ok(record.ts >= before);
});

// ── pushBattleRecord ────────────────────────────────────────────────────────

test('pushBattleRecord: 기존 배열에 추가', () => {
    const stats = { recentBattles: [{ result: 'win', hpRatio: 1 }] };
    const newRecord = { result: 'death', hpRatio: 0 };
    const updated = pushBattleRecord(stats, newRecord);
    assert.equal(updated.recentBattles.length, 2);
    assert.equal(updated.recentBattles[1].result, 'death');
});

test('pushBattleRecord: 기존 stats 필드 보존', () => {
    const stats = { kills: 100, recentBattles: [] };
    const updated = pushBattleRecord(stats, { result: 'win', hpRatio: 0.5 });
    assert.equal(updated.kills, 100);
    assert.equal(updated.recentBattles.length, 1);
});

test('pushBattleRecord: 최대 50개 유지 (초과 시 오래된 것 제거)', () => {
    const battles = Array.from({ length: 50 }, (_, i) => ({ result: 'win', hpRatio: 1, ts: i }));
    const stats = { recentBattles: battles };
    const updated = pushBattleRecord(stats, { result: 'death', hpRatio: 0, ts: 50 });
    assert.equal(updated.recentBattles.length, 50);
    assert.equal(updated.recentBattles[0].ts, 1); // 첫 번째(ts=0) 제거됨
    assert.equal(updated.recentBattles[49].result, 'death');
});

test('pushBattleRecord: recentBattles 없으면 빈 배열에서 시작', () => {
    const updated = pushBattleRecord({}, { result: 'win', hpRatio: 1 });
    assert.equal(updated.recentBattles.length, 1);
});

test('pushBattleRecord: 원본 stats 변이 없음 (immutable)', () => {
    const original = { recentBattles: [{ result: 'win', hpRatio: 1 }] };
    const updated = pushBattleRecord(original, { result: 'death', hpRatio: 0 });
    assert.equal(original.recentBattles.length, 1);
    assert.equal(updated.recentBattles.length, 2);
    assert.notEqual(original, updated);
});

// ── countLowHpWins ──────────────────────────────────────────────────────────

test('countLowHpWins: 최근 전투에서 저HP 승리 카운트', () => {
    const stats = {
        recentBattles: [
            { result: 'win', hpRatio: 0.1 },
            { result: 'win', hpRatio: 0.5 },
            { result: 'win', hpRatio: 0.15 },
            { result: 'death', hpRatio: 0 },
        ],
    };
    assert.equal(countLowHpWins(stats), 2); // 0.1과 0.15
});

test('countLowHpWins: 전투 기록 없으면 레거시 lowHpWins 폴백', () => {
    const stats = { lowHpWins: 5 };
    assert.equal(countLowHpWins(stats), 5);
});

test('countLowHpWins: 커스텀 threshold 적용', () => {
    const stats = {
        recentBattles: [
            { result: 'win', hpRatio: 0.3 },
            { result: 'win', hpRatio: 0.4 },
        ],
    };
    assert.equal(countLowHpWins(stats, 0.35), 1); // 0.3만 해당
});
