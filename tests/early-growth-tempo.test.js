import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { applyDynamicDifficulty } from '../src/systems/DifficultyManager.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * Slice 19: 초반 급성장 체감 (Early Growth Tempo)
 *
 * 실기기 피드백 기반 초반 30분 경험 재설계:
 * - 기존: Lv1 ATK 12 vs 슬라임 HP 105(신입 보호) → 기본공격 9턴, 강타 6-7턴.
 *   레벨업 ATK +2는 턴수 변화를 만들지 못해 성장 체감 0.
 * - 목표: 첫 전투 강타 기준 4-5턴, 레벨당 데미지 +3으로 레벨업마다
 *   턴수 단축 체감. 첫 유물은 6탐험 내 보장.
 *
 * 변경:
 * - BALANCE.ATK_PER_LEVEL 2 → 3 (레벨업 체감)
 * - 몬스터 HP 곡선 120+30L → BALANCE.MONSTER_HP_BASE(70)+L×MONSTER_HP_PER_LEVEL(32)
 *   (Lv1 -31%, Lv20 -1%, Lv50 +3% — 초반만 선택적 가속)
 * - 몬스터 골드 10+2L → BALANCE.MONSTER_GOLD_BASE(16)+2L (초반 휴식 경제 완화)
 * - INITIAL_STATE atk 10 → 12 (첫 전투 톤 설정)
 * - BALANCE.FIRST_RELIC_PITY_EXPLORES(6): 유물 0개 상태로 6탐험 경과 시
 *   다음 전투형 탐험에서 유물 선택 보장
 *
 * 보존 (회귀 금지):
 * - EXP 곡선 (START_NEXT_EXP 150 / EXP_SCALE_RATE 1.15) — Slice 17-18
 *   quest pacing 가드 (tests/quest-progression-pacing.test.js) 그대로.
 * - 몬스터 ATK/EXP 곡선 (15+4L / 10+10L) 불변.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const withStubbedRandom = (value, fn) => {
    const original = Math.random;
    Math.random = () => value;
    try {
        return fn();
    } finally {
        Math.random = original;
    }
};

const freshPlayer = () => ({
    level: 1,
    exp: 0,
    nextExp: CONSTANTS.START_NEXT_EXP,
    hp: CONSTANTS.START_HP,
    maxHp: CONSTANTS.START_HP,
    mp: CONSTANTS.START_MP,
    maxMp: CONSTANTS.START_MP,
    atk: 12,
    def: 5,
    gold: CONSTANTS.START_GOLD,
    loc: '고요한 숲',
    stats: {},
});

test('slice 19: 성장/템포 BALANCE 상수 계약', () => {
    assert.equal(BALANCE.ATK_PER_LEVEL, 3, '레벨당 ATK +3 (성장 체감)');
    assert.equal(BALANCE.MONSTER_HP_BASE, 70, '몬스터 HP 곡선 base 70');
    assert.equal(BALANCE.MONSTER_HP_PER_LEVEL, 32, '몬스터 HP 곡선 slope 32');
    assert.equal(BALANCE.MONSTER_GOLD_BASE, 16, '몬스터 골드 base 16');
    assert.equal(BALANCE.FIRST_RELIC_PITY_EXPLORES, 6, '첫 유물 보장 pity 6탐험');
    // EXP pacing 계약 — slice 23에서 150 → 200 감속 (학습 구간 확보).
    assert.equal(CONSTANTS.START_NEXT_EXP, 200);
    assert.equal(BALANCE.EXP_SCALE_RATE, 1.15);
});

test('slice 19: INITIAL_STATE 시작 ATK 12', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(/atk:\s*12,\s*def:\s*5/.test(source),
        'INITIAL_STATE atk 12 / def 5');
});

// B+ 재설계 (2026-06): 신입 보호가 적을 크게 약화시키지 않는다. 기존엔 hpMult
//   0.88로 raw 81 → 71까지 깎였으나, 이제 ×0.95 상한만 적용 → 76 (거의 정상).
//   "초반이 너무 쉽다" 해소의 핵심 레버. 5턴 처치 톤은 그대로 유지(아래 테스트).
test('slice 19: Lv1 슬라임 스폰 — 신입 보호는 거의 정상(×0.95 상한)', () => {
    const mapData = { level: 1, monsters: ['슬라임'] };
    // Math.random 0.5: 접두어 roll(0.5 > PREFIX_CHANCE 0.2) 미발동 고정
    const { mStats: raw } = withStubbedRandom(0.5, () =>
        ({ mStats: spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }).mStats }));
    // 기대 raw HP: floor((70 + 32) * 0.8 hpMult) = 81
    assert.equal(raw.hp, 81, `슬라임 raw HP 81 (실제: ${raw.hp})`);

    const { mStats: graced } = applyDynamicDifficulty(raw, freshPlayer(), null);
    // 신입 보호 ×0.95: floor(81 * 0.95) = 76 — 약화 폭이 작아 raw에 근접
    assert.equal(graced.hp, 76, `신입 보호 후 HP 76 (B+ ×0.95, 실제: ${graced.hp})`);
    assert.ok(graced.hp > 75, '기존 0.88 대비 적이 더 단단함 (B+ 의도)');
});

test('slice 19: 첫 전투 강타 기준 5턴 이내 처치 가능', () => {
    const mapData = { level: 1, monsters: ['슬라임'] };
    const { mStats: raw } = withStubbedRandom(0.5, () =>
        ({ mStats: spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }).mStats }));
    const { mStats: slime } = applyDynamicDifficulty(raw, freshPlayer(), null);

    // Lv1 실효 ATK = 시작 12 + 녹슨 단검 floor(5 × ONE_HAND_ATK_RATIO 0.44) = 14
    const lv1Atk = 12 + Math.floor(5 * BALANCE.ONE_HAND_ATK_RATIO);
    // 강타(mult 1.5) 최소 데미지 (variance 하한 0.9)
    const minSkillDmg = Math.floor(lv1Atk * BALANCE.DAMAGE_BASE_RATIO * 1.5);
    const worstCaseTurns = Math.ceil(slime.hp / minSkillDmg);
    assert.ok(worstCaseTurns <= 5,
        `강타 최악 분산 기준 5턴 이내 (실제: ${worstCaseTurns}턴, HP ${slime.hp} / 타격 ${minSkillDmg})`);
});

test('slice 19: 레벨업 시 ATK +3 — CombatEngine.applyExpGain 실측', () => {
    const player = freshPlayer();
    const result = CombatEngine.applyExpGain(player, player.nextExp);
    assert.equal(result.levelUps, 1);
    assert.equal(result.updatedPlayer.atk, player.atk + 3, '레벨업 ATK +3');
    assert.equal(result.updatedPlayer.def, player.def + 1, '레벨업 DEF +1 보존');
});

test('slice 19: 몬스터 HP 곡선 — 초반 가속, 후반 보존', () => {
    const hpAt = (level) => BALANCE.MONSTER_HP_BASE + level * BALANCE.MONSTER_HP_PER_LEVEL;
    assert.equal(hpAt(1), 102, 'Lv1 102 (기존 150 대비 -32%)');
    assert.ok(Math.abs(hpAt(20) - 720) <= 20, `Lv20 기존 720 ±20 이내 (실제: ${hpAt(20)})`);
    assert.ok(Math.abs(hpAt(50) - 1620) <= 80, `Lv50 기존 1620 ±80 이내 (실제: ${hpAt(50)})`);
});

test('slice 19: 몬스터 골드 — 초반 휴식 경제 (4전투 내 휴식 1회)', () => {
    const mapData = { level: 1, monsters: ['숲의 정령'] };
    const { mStats } = withStubbedRandom(0.5, () =>
        ({ mStats: spawnEnemy(mapData, freshPlayer(), [], { addLog: () => {} }).mStats }));
    // 기대: 16 + 1×2 = 18 → REST_COST 60 ÷ 18 ≈ 3.3전투
    assert.equal(mStats.gold, 18, `Lv1 골드 18 (실제: ${mStats.gold})`);
    assert.ok(mStats.gold * 4 >= BALANCE.REST_COST,
        '4전투 골드로 휴식 1회 가능');
});

test('slice 19: 첫 유물 보장 pity — exploreUtils 소스 가드', async () => {
    // 탐험 스카우팅(2026-07): 유물 pity 분기가 exploreUtils.ts의 runQuietRollAndCombat으로
    // 이동(exploreActions.ts와 eventActions.ts "짙은 안개" 카드 공유) — 경로만 갱신.
    const source = await readSrc('src/utils/exploreUtils.ts');
    assert.ok(/FIRST_RELIC_PITY_EXPLORES/.test(source),
        'exploreUtils가 FIRST_RELIC_PITY_EXPLORES 참조');
    assert.ok(/firstRelicPity/.test(source),
        '첫 유물 pity 분기 존재');
});

test('slice 19: 레벨업 로그에 스탯 상승 표기 (성장 가시화)', () => {
    const player = freshPlayer();
    const result = CombatEngine.applyExpGain(player, player.nextExp);
    const levelUpLog = result.logs.find((l) => l.type === 'system');
    assert.ok(levelUpLog, '레벨업 로그 존재');
    assert.ok(/공격력\s*\+3/.test(levelUpLog.text),
        `레벨 상승 로그에 공격력 +3 표기 (실제: "${levelUpLog.text}")`);
});
