import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS, getChainEventForLoc, isChainEventStep } from '../src/data/eventChains.js';

// cycle 62: 신규 체인 "잊혀진 사령관" — 잊혀진 폐허 → 몰락한 전초기지 → 마왕성으로
// 이어지는 3단계 체인. 위치별 트리거 + outcome reward 형태가 정상인지 회귀 가드.

test('forgotten_commander chain has 3 steps', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'forgotten_commander');
    assert.ok(chain, 'chain should exist');
    assert.equal(chain.steps.length, 3);
});

// Wave 128: 0단계는 잊혀진 폐허의 본편 장 '폐허의 진실'(81)이 연다 — 폐허의 첫 탐험은 이야기 화면을 띄우지 않는다.
test('forgotten_commander step 0 is opened by 본편 81 at 잊혀진 폐허, not by an exploration event', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'forgotten_commander');
    assert.equal(chain.steps[0].loc, '잊혀진 폐허');
    assert.equal(chain.steps[0].questStart.questId, 81);
    assert.match(chain.steps[0].questStart.log, /몰락한 전초기지/);
    assert.equal(getChainEventForLoc('잊혀진 폐허', {}), null);
});

test('forgotten_commander step 1 triggers at 몰락한 전초기지 after step 0', () => {
    const result = getChainEventForLoc('몰락한 전초기지', { forgotten_commander: 1 });
    assert.ok(result, 'should return event');
    if (result.chain.id === 'forgotten_commander') {
        assert.equal(result.step.step, 1);
        assert.equal(result.step.event.title, '사령관의 일지');
    }
});

test('forgotten_commander step 2 triggers at 마왕성 after step 1', () => {
    const result = getChainEventForLoc('마왕성', { forgotten_commander: 2 });
    assert.ok(result, 'should return event');
    if (result.chain.id === 'forgotten_commander') {
        assert.equal(result.step.step, 2);
        assert.equal(result.step.event.title, '사령관의 영혼');
    }
});

test('forgotten_commander completed (progress >= 3) does not trigger', () => {
    // 모든 step 완료 후에는 트리거 안 함
    const allChains = EVENT_CHAINS.filter((c) => c.id === 'forgotten_commander');
    const result = getChainEventForLoc('마왕성', { forgotten_commander: 3 });
    // 다른 체인이 마왕성을 쓰면 결과는 그 체인. forgotten_commander 자체는 더 이상 안 나옴.
    if (result?.chain?.id) {
        assert.notEqual(result.chain.id, 'forgotten_commander');
    }
});

test('forgotten_commander outcomes use supported reward types', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'forgotten_commander');
    // cycle 62: stat_bonus 핸들러도 추가됨.
    const validTypes = new Set(['gold', 'item', 'relic', 'combat_bonus', 'stat_bonus']);

    for (const step of chain.steps.filter(isChainEventStep)) {
        for (const outcome of step.event.outcomes) {
            if (outcome.reward) {
                assert.ok(
                    validTypes.has(outcome.reward.type),
                    `reward type "${outcome.reward.type}" should be supported by eventActions handler`
                );
            }
        }
    }
});

test('forgotten_commander finale offers a class-neutral late-game defense choice beside the relic', () => {
    const chain = EVENT_CHAINS.find((candidate) => candidate.id === 'forgotten_commander');
    const finale = chain.steps.find((step) => step.step === 2);
    const peacefulOutcome = finale.event.outcomes[1];

    assert.equal(peacefulOutcome.type, 'chain_advance');
    assert.deepEqual(peacefulOutcome.reward, { type: 'stat_bonus', def: 12, hp: 100 });
    assert.match(peacefulOutcome.log, /방어력과 생명/);
});
