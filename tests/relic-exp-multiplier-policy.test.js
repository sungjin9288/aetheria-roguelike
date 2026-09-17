import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { RELICS } from '../src/data/relics.js';

// 2026-09 Wave 5 W4: exp_mult 는 gold_mult/drop_rate/dot_mult 와 같은 "최강값 1개" 정책이다.
// 이전 구현(relics.find)은 보유 순서에 따라 첫 번째 exp_mult 유물만 읽어, 같은 유물 조합인데
// 획득 순서가 EXP 결과를 바꾸는 비결정을 만들었다.

const baseExpRelic = RELICS.find((entry) => entry.effect === 'exp_mult');
assert.ok(baseExpRelic, 'exp_mult 유물이 데이터에 있어야 한다');

const expRelic = (id, val) => ({ ...structuredClone(baseExpRelic), id, val });
const player = (relics) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: 'EXP 정책', job: '전사', loc: '고요한 숲',
    hp: 100, maxHp: 100, atk: 1000, def: 100, exp: 0, nextExp: 100000,
    equip: { weapon: null, armor: null, offhand: null },
    relics,
});
const enemy = () => ({
    name: '훈련용 정령', baseName: '훈련용 정령', level: 1,
    hp: 0, maxHp: 100, atk: 1, def: 0, exp: 100, gold: 0,
    pattern: { guardChance: 0, heavyChance: 0 },
});
const expAfterVictory = (relics) => CombatEngine.handleVictory(player(relics), enemy(), {}, {}).updatedPlayer.exp;

test('exp_mult 유물 두 개는 보유 순서와 무관하게 최강값 하나만 적용된다', () => {
    const weakFirst = expAfterVictory([expRelic('exp_weak', 0.1), expRelic('exp_strong', 0.4)]);
    const strongFirst = expAfterVictory([expRelic('exp_strong', 0.4), expRelic('exp_weak', 0.1)]);
    const strongOnly = expAfterVictory([expRelic('exp_strong', 0.4)]);
    const weakOnly = expAfterVictory([expRelic('exp_weak', 0.1)]);

    assert.equal(weakFirst, strongFirst, '획득 순서가 EXP 를 바꾸면 안 된다');
    assert.equal(weakFirst, strongOnly, '두 개 보유 = 최강값 하나와 동일 (합산 스택 아님)');
    assert.ok(strongOnly > weakOnly, '최강값이 실제로 반영돼야 한다');
});

test('exp_mult 유물이 없으면 배율 1 (회귀 기준선)', () => {
    const none = expAfterVictory([]);
    const weakOnly = expAfterVictory([expRelic('exp_weak', 0.1)]);
    assert.ok(weakOnly > none);
});
