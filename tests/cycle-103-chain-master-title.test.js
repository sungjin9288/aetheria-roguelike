import test from 'node:test';
import assert from 'node:assert/strict';

import { TITLES } from '../src/data/titles.js';
import { checkTitles } from '../src/utils/gameUtils.js';

/**
 * cycle 103: 발견 체인 마스터(chain_master) 칭호 추가.
 *
 * cycle 102에서 ach_chain_1/3/all achievement를 깔았으나 칭호는 없었음.
 * cycle 95(berserker), 85(alchemist) 패턴 그대로 — achievement chain의 최고
 * 임계값에 짝을 이루는 칭호 추가.
 *
 * 추가:
 * - title 'chain_master' / name '세계의 길잡이' / cond discoveryChains >= 5 /
 *   indigo-300 톤 (모든 5종 chain의 보상 색감 평균 — fire/frost/void/ancient/demon
 *   각각 red/blue/purple/yellow/black의 중성)
 * - checkTitles에 cond.type === 'discoveryChains' 핸들러
 * - TITLE_PASSIVES.chain_master = ATK +1 · DEF +1 · MP +15 (탐험 + 전투 균형 패시브)
 */

const findTitle = (id) => TITLES.find((t) => t.id === id);

test('chain_master 칭호 등록됨 (discoveryChains 5)', () => {
    const title = findTitle('chain_master');
    assert.ok(title, 'chain_master title should exist');
    assert.equal(title.name, '세계의 길잡이');
    assert.equal(title.cond.type, 'discoveryChains');
    assert.equal(title.cond.val, 5);
});

test('checkTitles: discoveryChains 5개 완료 → chain_master 활성', () => {
    const player = { titles: [], stats: { discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
    const unlocked = checkTitles(player);
    assert.ok(unlocked.includes('chain_master'));
});

test('checkTitles: discoveryChains 4개 → chain_master 비활성', () => {
    const player = { titles: [], stats: { discoveryChains: ['a', 'b', 'c', 'd'] } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('chain_master'));
});

test('checkTitles: discoveryChains 누락 → 0 취급, chain_master 비활성', () => {
    const player = { titles: [], stats: {} };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('chain_master'));
});

test('checkTitles: 이미 보유한 chain_master는 재해금 안 됨', () => {
    const player = { titles: ['chain_master'], stats: { discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
    const unlocked = checkTitles(player);
    assert.ok(!unlocked.includes('chain_master'));
});
