import test from 'node:test';
import assert from 'node:assert/strict';
import { RELICS, RELIC_SYNERGIES, pickWeightedRelics } from '../src/data/relics.js';

/**
 * 유물 시너지 소프트 pity 테스트.
 *
 * 배경: RELICS 67개 풀 × 5슬롯에서 RELIC_SYNERGIES가 요구하는 정확한 name 페어가
 * 자연 발생할 확률이 낮음 — 대부분의 런에서 시너지가 한 번도 안 뜬다.
 *
 * 기능: pickWeightedRelics(pool, count, { owned })를 호출하면, 보유 유물(owned)
 * 기준 "1개만 더 모으면 완성"되는 시너지의 잔여 유물이 pool에 있을 때,
 * count개 후보 중 1개 슬롯(BALANCE.SYNERGY_PITY_SLOT)을 그 잔여 유물 후보군에서
 * 가중 추첨으로 보장한다. 해당 후보가 없으면 완전히 기존 로직과 동일하게 동작한다
 * (owned 미전달 시에도 동일 — 기존 호출부 무수정 하위호환).
 */

const findRelicByName = (name) => RELICS.find((r) => r.name === name);

/**
 * owned 보유 시 "1개만 더 모으면 완성"되는 시너지가 하나도 없도록, owned가 얽힌
 * 모든 시너지의 나머지 유물 name을 계산해 반환한다 (프로그래밍적으로 완전 차단 —
 * 특정 시너지만 수동으로 나열하면 owned 유물이 얽힌 다른 시너지를 놓치기 쉽다).
 */
const namesToExcludeForNoPity = (owned) => {
    const ownedNames = new Set(owned.map((r) => r.name));
    const toExclude = new Set();
    for (const syn of RELIC_SYNERGIES) {
        if (syn.requires.some((name) => ownedNames.has(name))) {
            for (const name of syn.requires) {
                if (!ownedNames.has(name)) toExclude.add(name);
            }
        }
    }
    return toExclude;
};

// "흡혈 군주" 2피스 시너지: 피의 서약 + 영혼 흡수
const bloodPact = findRelicByName('피의 서약');
const soulDrain = findRelicByName('영혼 흡수');

// "비전 특이점" 3피스 시너지: 마나 수정 + 주문 메아리 + 정신 연소
const manaCrystal = findRelicByName('마나 수정');
const spellEcho = findRelicByName('주문 메아리');
const mindBurn = findRelicByName('정신 연소');

test('사전 조건: 흡혈 군주/비전 특이점 시너지 원본 유물이 RELICS 풀에 존재', () => {
    assert.ok(bloodPact, '피의 서약 존재');
    assert.ok(soulDrain, '영혼 흡수 존재');
    assert.ok(manaCrystal, '마나 수정 존재');
    assert.ok(spellEcho, '주문 메아리 존재');
    assert.ok(mindBurn, '정신 연소 존재');

    const bloodLord = RELIC_SYNERGIES.find((s) => s.requires.includes('피의 서약') && s.requires.includes('영혼 흡수'));
    assert.ok(bloodLord && bloodLord.requires.length === 2, '흡혈 군주 2피스 시너지 정의 확인');

    const arcaneSingularity = RELIC_SYNERGIES.find((s) => s.requires.length === 3 && s.requires.includes('마나 수정'));
    assert.ok(arcaneSingularity, '비전 특이점 3피스 시너지 정의 확인');
});

test('1) 보유 유물이 시너지 페어 한쪽일 때 — pity 슬롯에 페어 완성 유물 포함', () => {
    // 피의 서약을 보유 중 → 영혼 흡수가 pity 후보가 되어야 함.
    const owned = [bloodPact];
    const pool = RELICS.filter((r) => r.id !== bloodPact.id);

    // Math.random 고정: 항상 0 반환 → 가중 추첨 시 항상 후보 목록의 첫 항목 선택.
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        const picked = pickWeightedRelics(pool, 3, { owned });
        assert.equal(picked.length, 3, '요청한 count만큼 반환');
        assert.ok(
            picked.some((r) => r.id === soulDrain.id),
            'pity 슬롯 덕분에 영혼 흡수가 후보에 포함됨'
        );
    } finally {
        Math.random = originalRandom;
    }
});

test('2) 보유 0개(신규 런) — 기존 로직과 동일 분포 (pity 미발동)', () => {
    const pool = RELICS.slice();

    const originalRandom = Math.random;
    let calls = 0;
    const seq = [0.1, 0.4, 0.7, 0.2, 0.9];
    Math.random = () => seq[calls++ % seq.length];
    try {
        const seq1 = [0.1, 0.4, 0.7, 0.2, 0.9];
        let i1 = 0;
        Math.random = () => seq1[i1++ % seq1.length];
        const withoutOwned = pickWeightedRelics(pool, 3);

        let i2 = 0;
        const seq2 = [0.1, 0.4, 0.7, 0.2, 0.9];
        Math.random = () => seq2[i2++ % seq2.length];
        const withEmptyOwned = pickWeightedRelics(pool, 3, { owned: [] });

        assert.deepEqual(
            withEmptyOwned.map((r) => r.id),
            withoutOwned.map((r) => r.id),
            'owned 미전달과 owned: [] 전달 시 동일 분포 (pity 미발동)'
        );
    } finally {
        Math.random = originalRandom;
    }
});

test('3) 시너지 완성 불가(잔여 유물이 pool에 없음) — 기존 로직 그대로', () => {
    // 피의 서약을 보유했지만, "피의 서약"이 얽힌 모든 시너지의 나머지 유물을
    // pool에서 제외 — 어떤 시너지도 "1개만 더 모으면 완성" 상태에 도달하지
    // 못하므로 pity 후보가 0개여야 한다.
    const owned = [bloodPact];
    const excludedPartnerNames = namesToExcludeForNoPity(owned);
    const poolWithoutPartners = RELICS.filter((r) => !excludedPartnerNames.has(r.name) && r.id !== bloodPact.id);

    const originalRandom = Math.random;
    try {
        let i1 = 0;
        const seq1 = [0.1, 0.4, 0.7, 0.2, 0.9];
        Math.random = () => seq1[i1++ % seq1.length];
        const withOwned = pickWeightedRelics(poolWithoutPartners, 3, { owned });

        let i2 = 0;
        const seq2 = [0.1, 0.4, 0.7, 0.2, 0.9];
        Math.random = () => seq2[i2++ % seq2.length];
        const withoutOwned = pickWeightedRelics(poolWithoutPartners, 3);

        assert.deepEqual(
            withOwned.map((r) => r.id),
            withoutOwned.map((r) => r.id),
            'pity 후보가 pool에 없으면 owned 유무와 무관하게 동일 분포'
        );
    } finally {
        Math.random = originalRandom;
    }
});

test('4) 3피스 시너지: 2개 보유 시 마지막 1개가 pity 후보가 되는 것', () => {
    // 마나 수정 + 주문 메아리 보유 → 정신 연소가 pity 후보.
    const owned = [manaCrystal, spellEcho];
    const pool = RELICS.filter((r) => r.id !== manaCrystal.id && r.id !== spellEcho.id);

    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        const picked = pickWeightedRelics(pool, 3, { owned });
        assert.ok(
            picked.some((r) => r.id === mindBurn.id),
            '3피스 시너지 마지막 1개(정신 연소)가 pity 후보로 포함됨'
        );
    } finally {
        Math.random = originalRandom;
    }
});

test('5) 반환 유물 수 / 중복 없음 불변식 (pity 발동 시에도 유지)', () => {
    const owned = [bloodPact, manaCrystal, spellEcho];
    const pool = RELICS.filter((r) => !owned.some((o) => o.id === r.id));

    for (const seed of [0, 0.15, 0.33, 0.5, 0.66, 0.88, 0.99]) {
        const picked = pickWeightedRelics(pool, 4, { owned });
        assert.equal(picked.length, 4, `count=4 요청 시 4개 반환 (seed ${seed})`);
        const ids = picked.map((r) => r.id);
        assert.equal(new Set(ids).size, ids.length, `중복 없음 (seed ${seed})`);
    }
});

test('이미 완성된 시너지·중복 보유 유물은 pity 후보에서 제외', () => {
    // 피의 서약 + 영혼 흡수 + 허공의 심장 셋 다 보유 → "흡혈 군주"(2피스)와
    // "혈맹 불사"(3피스) 모두 이미 완성. owned가 얽힌 다른 시너지("불멸의 전사":
    // 불사조의 깃털 + 피의 서약, "지옥의 수확자": 심연의 계약 + 영혼 흡수)의
    // 나머지 유물도 함께 제외해 pity 후보가 정말 0개인 상태를 만든다.
    const heartOfVoid = findRelicByName('허공의 심장');
    const owned = [bloodPact, soulDrain, heartOfVoid];
    const excludedNames = namesToExcludeForNoPity(owned);
    const ownedIds = new Set(owned.map((o) => o.id));
    const pool = RELICS.filter((r) => !excludedNames.has(r.name) && !ownedIds.has(r.id));

    const originalRandom = Math.random;
    try {
        let i1 = 0;
        const seq1 = [0.1, 0.4, 0.7, 0.2, 0.9];
        Math.random = () => seq1[i1++ % seq1.length];
        const withOwned = pickWeightedRelics(pool, 3, { owned });

        let i2 = 0;
        const seq2 = [0.1, 0.4, 0.7, 0.2, 0.9];
        Math.random = () => seq2[i2++ % seq2.length];
        const withoutOwned = pickWeightedRelics(pool, 3);

        assert.deepEqual(
            withOwned.map((r) => r.id),
            withoutOwned.map((r) => r.id),
            '이미 완성된 시너지는 pity 후보를 만들지 않음'
        );
    } finally {
        Math.random = originalRandom;
    }
});
