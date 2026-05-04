import test from 'node:test';
import assert from 'node:assert/strict';

import { ACHIEVEMENTS } from '../src/data/quests.js';
import { getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';

/**
 * cycle 102: 발견 체인(discovery chains) 완료 achievement 추가.
 *
 * 배경:
 * - cycle 초기에 BALANCE.DISCOVERY_CHAINS 5개(fire/frozen/void/ancient/demon)와
 *   stats.discoveryChains 누적 배열이 도입되어 있었음.
 * - exploreUtils.checkDiscoveryChains가 체인 완료 시 보상(gold/exp/item)을 즉시
 *   부여하지만, 영구 reflection / 보상 보정(achievement / title)은 비어있던 자리.
 *
 * 추가:
 * - target: 'discoveryChains' 타깃 핸들러 (stats.discoveryChains 배열 길이 반환)
 * - ach_chain_1 (첫 체인 완료, gold 보상)
 * - ach_chain_3 (3 체인 완료, 강화 보상)
 * - ach_chain_all (5 체인 모두 완료, 전설 reward)
 */

const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);

test('ach_chain_1/3/all 등록됨', () => {
    for (const id of ['ach_chain_1', 'ach_chain_3', 'ach_chain_all']) {
        const ach = findAch(id);
        assert.ok(ach, `${id} should exist`);
        assert.equal(ach.target, 'discoveryChains');
    }
});

test('chain achievements 목표가 단조 증가 (1 < 3 < 5)', () => {
    const goals = ['ach_chain_1', 'ach_chain_3', 'ach_chain_all'].map((id) => findAch(id).goal);
    assert.deepEqual(goals, [1, 3, 5]);
});

test('getAchievementCurrentValue("discoveryChains"): array length 반환', () => {
    const player = { stats: { discoveryChains: ['fire_convergence', 'frozen_truth'] } };
    assert.equal(getAchievementCurrentValue({ target: 'discoveryChains' }, player), 2);
});

test('getAchievementCurrentValue: 누락 시 0', () => {
    assert.equal(getAchievementCurrentValue({ target: 'discoveryChains' }, { stats: {} }), 0);
    assert.equal(getAchievementCurrentValue({ target: 'discoveryChains' }, { }), 0);
});

test('isAchievementUnlocked: chain 1개 완료 → ach_chain_1만 unlock', () => {
    const player = { stats: { discoveryChains: ['fire_convergence'] } };
    assert.equal(isAchievementUnlocked(findAch('ach_chain_1'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_chain_3'), player), false);
    assert.equal(isAchievementUnlocked(findAch('ach_chain_all'), player), false);
});

test('isAchievementUnlocked: chain 5개 모두 완료 → 3종 모두 unlock', () => {
    const player = { stats: { discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
    assert.equal(isAchievementUnlocked(findAch('ach_chain_1'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_chain_3'), player), true);
    assert.equal(isAchievementUnlocked(findAch('ach_chain_all'), player), true);
});
