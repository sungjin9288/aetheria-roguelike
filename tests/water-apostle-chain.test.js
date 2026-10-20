import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CHAINS, getChainEventForLoc, isChainEventStep } from '../src/data/eventChains.js';

// cycle 66: 신규 체인 "물의 사도" — 호수의 신전 → 사막 오아시스 → 피라미드.
// 약 Lv5~30 진행 곡선에 맞춰 자연스러운 경로 + 정수의 결정 / 엘릭서 / 유물 보상.

test('water_apostle chain has 3 steps', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'water_apostle');
    assert.ok(chain, 'chain should exist');
    assert.equal(chain.steps.length, 3);
});

// Wave 128: 0단계는 이벤트가 아니라 호수의 신전 임무 '호수의 수호자'(5)가 연다 — 신관의 일기는 그 수령 기록이 말한다.
test('water_apostle step 0 location is 호수의 신전 — 임무 5가 열고 신관의 일기가 사막 오아시스를 가리킨다', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'water_apostle');
    assert.equal(chain.steps[0].loc, '호수의 신전');
    assert.equal(chain.steps[0].event, undefined);
    assert.equal(chain.steps[0].questStart.questId, 5);
    assert.match(chain.steps[0].questStart.log, /신관의 일기/);
    assert.match(chain.steps[0].questStart.log, /사막 오아시스/);
});

test('water_apostle step 1 triggers at 사막 오아시스 after step 0', () => {
    const result = getChainEventForLoc('사막 오아시스', { water_apostle: 1 });
    assert.ok(result, 'should return event');
    if (result.chain.id === 'water_apostle') {
        assert.equal(result.step.step, 1);
        assert.equal(result.step.event.title, '메마른 우물');
    }
});

test('water_apostle step 2 triggers at 피라미드 after step 1', () => {
    const result = getChainEventForLoc('피라미드', { water_apostle: 2 });
    assert.ok(result, 'should return event');
    if (result.chain.id === 'water_apostle') {
        assert.equal(result.step.step, 2);
        assert.equal(result.step.event.title, '봉인된 정수');
    }
});

test('water_apostle outcomes use only supported reward types', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'water_apostle');
    const validTypes = new Set(['gold', 'item', 'relic', 'combat_bonus', 'stat_bonus']);
    for (const step of chain.steps.filter(isChainEventStep)) {
        for (const outcome of step.event.outcomes) {
            if (outcome.reward) {
                assert.ok(
                    validTypes.has(outcome.reward.type),
                    `reward type "${outcome.reward.type}" should be supported by eventActions`
                );
            }
        }
    }
});
