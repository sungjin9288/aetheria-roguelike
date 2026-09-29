import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.ts';
import {
    applyEssenceGain,
    carryEssenceLadderOnAscension,
    getLadderEssenceForRank,
    getLadderRank,
    getRankFromLifetime,
} from '../src/systems/essenceLedger.ts';

/**
 * 2026-09 Wave 37 — 체감형 정수 사다리 (소유자 결정 "로그라이크의 느낌에 맞게 체감형 사다리").
 *
 * 사다리는 처치 정수 150마다 공격력 +1 · 생명 +5 · 기력 +3을 1:1로 끝없이 쌓았다. 계승을 미룬 런은 225 모델시간에
 * 4,200단계(공격력 +4,200)까지 올라 심연 밖의 후반 콘텐츠가 무의미해졌다(원장 §35.5). 1회차는 계승까지 800단계 안팎이라
 * 그 구간(≤ `ESSENCE_LADDER_SOFTCAP_RANK`)은 그대로 두고, 그 뒤 단계부터 비용이 늘어난다.
 */

const PER = BALANCE.ESSENCE_PER_RANK;
const KNEE = BALANCE.ESSENCE_LADDER_SOFTCAP_RANK;

test('[1회차 구간] 무릎까지는 예전 규칙(정수 150마다 1단계) 그대로다', () => {
    for (let essence = 0; essence <= KNEE * PER; essence += 37) {
        assert.equal(getLadderRank(essence), Math.floor(essence / PER), `정수 ${essence}`);
    }
    // 1회차 규모(800단계)를 한 번에 벌어도 영구 스탯은 예전과 같다.
    const run1 = applyEssenceGain({}, 800 * PER + 90);
    assert.equal(run1.meta.rank, 800);
    assert.equal(run1.meta.bonusAtk, 800 * BALANCE.ESSENCE_RANK_ATK);
    assert.equal(run1.meta.bonusHp, 800 * BALANCE.ESSENCE_RANK_HP);
});

test('[체감] 무릎 뒤로는 단계마다 비용이 늘어난다 — 무릎 + SCALE 단계에서 단계당 비용이 두 배', () => {
    const cost = (rank) => getLadderEssenceForRank(rank) - getLadderEssenceForRank(rank - 1);
    assert.equal(cost(KNEE), PER, '무릎 단계까지는 150');
    let previous = cost(KNEE + 1);
    assert.ok(previous > PER, '무릎 다음 단계부터 150보다 비싸다');
    for (let rank = KNEE + 2; rank <= KNEE + 3000; rank += 1) {
        const current = cost(rank);
        assert.ok(current > previous, `단계 ${rank}: ${current} > ${previous}`);
        previous = current;
    }
    assert.equal(cost(KNEE + BALANCE.ESSENCE_LADDER_SOFTCAP_SCALE), PER * 2);
});

test('[역함수] 필요한 정수를 정확히 모으면 그 단계, 1 모자라면 한 단계 아래', () => {
    for (const rank of [1, 999, 1000, 1001, 1002, 1500, 2000, 2717, 4200, 10000]) {
        const need = getLadderEssenceForRank(rank);
        assert.equal(getLadderRank(need), rank, `단계 ${rank}`);
        assert.equal(getLadderRank(need - 1e-6), rank - 1, `단계 ${rank} 직전`);
    }
});

test('[계승을 미룬 런 규모] 예전 1:1 규칙의 4,200단계 분 정수로는 약 2,700단계다', () => {
    const essence = 4200 * PER;
    const rank = getLadderRank(essence);
    assert.ok(rank < 3000 && rank > 2400, `단계 ${rank}`);
    const meta = applyEssenceGain({}, essence).meta;
    assert.equal(meta.bonusAtk, rank * BALANCE.ESSENCE_RANK_ATK, '영구 공격력은 단계 수만큼');
});

test('[기존 세이브] 예전 규칙으로 오른 단계는 내려가지 않고, 다음 단계는 새 비용으로 오른다', () => {
    // 선형 규칙으로 3,000단계에 오른 세이브(사다리 정수 450,000).
    const legacy = { rank: 3000, essence: 0, essenceLifetime: 3000 * PER, essenceLadder: 3000 * PER, bonusAtk: 3000, bonusHp: 15000, bonusMp: 9000 };
    assert.ok(getLadderRank(legacy.essenceLadder) < 3000, '전제: 새 규칙으로는 더 낮은 단계의 정수다');
    const small = applyEssenceGain(legacy, PER);
    assert.equal(small.meta.rank, 3000, '단계가 내려가지 않는다');
    assert.equal(small.meta.bonusAtk, 3000, '영구 스탯도 그대로');
    assert.equal(getRankFromLifetime(getLadderEssenceForRank(3001), 3000), 3001, '새 비용을 채우면 다음 단계');
});

test('[계승 이월] 남긴 단계의 사다리 정수는 새 비용표에서 그 단계의 정수다', () => {
    // 이월 뒤 단계(10%)도 무릎을 넘는 규모여야 새 비용표를 쓰는지 가려진다.
    const rank = 25_000;
    const carried = carryEssenceLadderOnAscension({ rank, essenceLadder: getLadderEssenceForRank(rank), essenceLifetime: getLadderEssenceForRank(rank), bonusAtk: rank, bonusHp: rank * 5, bonusMp: rank * 3 });
    assert.equal(carried.rankKept, Math.floor(rank * BALANCE.ESSENCE_LADDER_ASCEND_CARRY));
    assert.ok(carried.rankKept > KNEE, '전제: 남긴 단계가 무릎 너머다');
    assert.equal(carried.meta.essenceLadder, getLadderEssenceForRank(carried.rankKept));
    assert.equal(getLadderRank(carried.meta.essenceLadder), carried.rankKept);
});
