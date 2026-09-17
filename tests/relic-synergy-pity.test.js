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


// ─── 2026-09 감사 G8: 3피스 시너지 pity 확장 ───
/**
 * 3피스 세트 5종은 "정확히 1개 부족" 상태에 도달하는 것 자체가 어려워 구 pity가
 * 사실상 발동하지 않았다. 1개 보유 + 2개 부족 단계도 pity 후보로 받쳐준다.
 * 단, "1개 부족" 후보가 있으면 그쪽이 우선 (완성에 가까운 쪽 우선).
 */
test('6) 3피스 시너지: 1개만 보유(2개 부족)해도 부족분이 pity 후보가 된다', () => {
    const owned = [manaCrystal];
    // 마나 수정이 얽힌 2피스 시너지("비전 파동": 마나 수정 + 주문 메아리)가
    // "1개 부족" 1순위 후보를 만들지 않도록 주문 메아리는 pool에서 제외한다.
    const pool = RELICS.filter((r) => r.id !== manaCrystal.id && r.id !== spellEcho.id);

    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        const picked = pickWeightedRelics(pool, 3, { owned });
        assert.ok(
            picked.some((r) => r.id === mindBurn.id),
            '3피스 시너지에서 1개 보유 상태의 부족분(정신 연소)이 pity 후보로 포함됨',
        );
    } finally {
        Math.random = originalRandom;
    }
});

test('6) "1개 부족" 후보가 있으면 "2개 부족" 후보보다 우선한다', () => {
    // 피의 서약(2피스 흡혈 군주의 한쪽) + 마나 수정(3피스 비전 특이점의 한쪽) 보유.
    // → 영혼 흡수는 1순위(1개 부족), 주문 메아리/정신 연소는 2순위(2개 부족).
    const owned = [bloodPact, manaCrystal];
    const pool = RELICS.filter((r) => !owned.some((o) => o.id === r.id));

    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
        const picked = pickWeightedRelics(pool, 1, { owned });
        assert.equal(picked.length, 1);
        const ownedNames = new Set(owned.map((r) => r.name));
        const nearNames = new Set();
        for (const syn of RELIC_SYNERGIES) {
            const missing = syn.requires.filter((name) => !ownedNames.has(name));
            if (missing.length === 1) nearNames.add(missing[0]);
        }
        assert.ok(nearNames.size > 0, '1순위 후보가 실제로 존재하는 상황');
        assert.ok(
            nearNames.has(picked[0].name),
            `pity 슬롯은 1개 부족 후보에서 뽑혀야 함 (뽑힘: ${picked[0].name})`,
        );
    } finally {
        Math.random = originalRandom;
    }
});

test('6) pity 후보가 전혀 없으면 owned 전달 여부와 무관하게 기존 분포 그대로', () => {
    // owned가 아무 시너지와도 얽히지 않은 유물 1개뿐이면 후보 0개 → 기존 로직 동일.
    const synergyNames = new Set(RELIC_SYNERGIES.flatMap((s) => s.requires));
    const neutral = RELICS.find((r) => !synergyNames.has(r.name));
    assert.ok(neutral, '어떤 시너지에도 속하지 않는 유물이 존재');

    const owned = [neutral];
    const pool = RELICS.filter((r) => r.id !== neutral.id);

    const originalRandom = Math.random;
    try {
        const seq = [0.1, 0.4, 0.7, 0.2, 0.9];
        let i1 = 0;
        Math.random = () => seq[i1++ % seq.length];
        const withOwned = pickWeightedRelics(pool, 3, { owned });

        let i2 = 0;
        Math.random = () => seq[i2++ % seq.length];
        const withoutOwned = pickWeightedRelics(pool, 3);

        assert.deepEqual(
            withOwned.map((r) => r.id),
            withoutOwned.map((r) => r.id),
            'pity 후보가 없으면 owned 전달 여부와 무관하게 동일 결과',
        );
    } finally {
        Math.random = originalRandom;
    }
});
