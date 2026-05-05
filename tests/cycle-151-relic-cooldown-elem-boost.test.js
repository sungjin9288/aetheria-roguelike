import test from 'node:test';
import assert from 'node:assert/strict';

import { CombatEngine } from '../src/systems/CombatEngine.js';
import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 151: 'cooldown_reduce' / 'elem_boost' 유물 핸들러 추가.
 *
 * cycle 148 baseline 30 → 28. cycle 149-150에 이은 점진 정리.
 * 이번 사이클은 단순 multiplier 범위를 넘어 CombatEngine 내부 분기까지
 * 확장:
 *
 * 1. cooldown_reduce (시간 군주의 왕관) — 스킬 사용 시 초기 쿨다운에서
 *    val.cdReduction(=1) 차감. firstFree(첫 스킬 MP 무소비)는 별도 사이클.
 * 2. elem_boost (프리즘 핵) — 약점 적중 시 ELEMENT_WEAK_MULT(=1.25)에
 *    val(=0.25) 추가 → 1.5 배율. resistance/none은 영향 없음.
 */

const baseEnemy = {
    name: 'tester',
    hp: 100, maxHp: 100,
    atk: 10, def: 5,
    weakness: '화염',
    resistance: '냉기',
};

test("elem_boost (prism_core): 약점 elem 적중 시 1.25 → 1.5 배율", () => {
    const enemy = { ...baseEnemy };
    const noRelic = CombatEngine.getElementMultiplier('화염', enemy, []);
    assert.equal(noRelic, BALANCE.ELEMENT_WEAK_MULT, 'baseline 약점 배율은 1.25여야 함');

    const withPrism = CombatEngine.getElementMultiplier('화염', enemy, [
        { effect: 'elem_boost', val: 0.25 },
    ]);
    assert.equal(withPrism, BALANCE.ELEMENT_WEAK_MULT + 0.25,
        `expected 1.5; got ${withPrism}`);
});

test("elem_boost: resistance/일반 elem 영향 없음 (약점 적중에만 적용)", () => {
    const enemy = { ...baseEnemy };
    const resistMult = CombatEngine.getElementMultiplier('냉기', enemy, [
        { effect: 'elem_boost', val: 0.25 },
    ]);
    // 저항 배율은 그대로 (cycle 151 변경 외 회귀 가드)
    assert.equal(resistMult, BALANCE.ELEMENT_RESIST_MULT);

    const neutralMult = CombatEngine.getElementMultiplier('암흑', enemy, [
        { effect: 'elem_boost', val: 0.25 },
    ]);
    assert.equal(neutralMult, 1);
});

test("getElementMultiplier 회귀: relics 미전달 시(undefined) 기존 동작 유지", () => {
    const enemy = { ...baseEnemy };
    const mult = CombatEngine.getElementMultiplier('화염', enemy);
    assert.equal(mult, BALANCE.ELEMENT_WEAK_MULT);
});

test("cycle 148 baseline 회귀: cooldown_reduce / elem_boost effect string이 src/에서 참조됨", async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const HERE = path.dirname(fileURLToPath(import.meta.url));
    const ROOT = path.join(HERE, '..');
    const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
    assert.match(engineSrc, /'cooldown_reduce'/);
    assert.match(engineSrc, /'elem_boost'/);
});
