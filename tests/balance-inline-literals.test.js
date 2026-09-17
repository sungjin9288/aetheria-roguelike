import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.js';

/**
 * H3 (Wave 3 감사): handleVictory / 탐험 이상기후의 inline 숫자 → BALANCE.
 *
 * R1(No Magic Numbers) 회귀 가드. 값은 그대로이고 참조만 상수로 옮겼으므로,
 * 이 테스트는 (1) BALANCE 키와 값, (2) 해당 함수 본문에 숫자가 다시 박히지 않는 것을 고정한다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/** 소스에서 한 메서드 본문만 잘라낸다(다음 최상위 메서드 선언 직전까지). */
const sliceMethod = (source, name) => {
    const start = source.indexOf(`${name}(`);
    assert.ok(start > -1, `${name} 선언을 찾을 수 없다`);
    const rest = source.slice(start + name.length);
    const nextMethod = rest.search(/\n {4}[a-zA-Z_$][\w$]*\(/);
    return nextMethod > -1 ? rest.slice(0, nextMethod) : rest;
};

test('H3: 추출한 BALANCE 키와 값이 그대로 보존된다', () => {
    assert.equal(BALANCE.VICTORY_GOLD_LEVEL_GAP_THRESHOLD, 9);
    assert.equal(BALANCE.VICTORY_GOLD_LEVEL_PENALTY_FLOOR, 0.3);
    assert.equal(BALANCE.VICTORY_GOLD_LEVEL_PENALTY_SLOPE, 0.07);
    assert.equal(BALANCE.NO_GOLD_MODIFIER_MULT, 0.5);
    assert.equal(BALANCE.FIRST_BOSS_BONUS_GOLD_FLOOR, 120);
    assert.equal(BALANCE.FIRST_BOSS_BONUS_GOLD_RATE, 0.35);
    assert.equal(BALANCE.ANOMALY_MANA_REGEN_RATIO, 0.3);
});

test('H3: handleVictory 본문에 골드 스케일링 숫자가 inline으로 남지 않는다', async () => {
    const body = sliceMethod(await readSrc('src/systems/CombatEngine.outcome.ts'), 'handleVictory');

    assert.doesNotMatch(body, /playerLevel - enemyLevel - 9/, '레벨 차 임계값은 BALANCE 참조');
    assert.doesNotMatch(body, /Math\.max\(0\.3,/, '골드 감쇠 하한은 BALANCE 참조');
    assert.doesNotMatch(body, /levelGap \* 0\.07/, '레벨당 감쇠율은 BALANCE 참조');
    assert.doesNotMatch(body, /noGold \? 0\.5 :/, 'noGold 배율은 BALANCE 참조');
    assert.doesNotMatch(body, /Math\.max\(120,/, '초회 토벌 보너스 하한은 BALANCE 참조');
    assert.doesNotMatch(body, /goldGained \* 0\.35/, '초회 토벌 보너스 비율은 BALANCE 참조');

    assert.match(body, /BALANCE\.VICTORY_GOLD_LEVEL_GAP_THRESHOLD/);
    assert.match(body, /BALANCE\.VICTORY_GOLD_LEVEL_PENALTY_FLOOR/);
    assert.match(body, /BALANCE\.VICTORY_GOLD_LEVEL_PENALTY_SLOPE/);
    assert.match(body, /BALANCE\.NO_GOLD_MODIFIER_MULT/);
    assert.match(body, /BALANCE\.FIRST_BOSS_BONUS_GOLD_FLOOR/);
    assert.match(body, /BALANCE\.FIRST_BOSS_BONUS_GOLD_RATE/);
});

test('H3: 탐험 이상기후 마력 회복 비율이 inline으로 남지 않는다', async () => {
    // Wave 4 N1: dispatch 소비 함수가 hooks/gameActions/exploreFlow.ts로 이동 — 경로만 갱신.
    const source = await readSrc('src/hooks/gameActions/exploreFlow.ts');
    const anomalyStart = source.indexOf('effectiveAnomalyChance');
    assert.ok(anomalyStart > -1);
    const block = source.slice(anomalyStart, anomalyStart + 2000);

    assert.doesNotMatch(block, /stats\.maxMp \* 0\.3/, '마력 회복 비율은 BALANCE 참조');
    assert.match(block, /BALANCE\.ANOMALY_MANA_REGEN_RATIO/);
});
