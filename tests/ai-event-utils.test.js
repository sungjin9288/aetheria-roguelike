import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.js';
import { buildEventPackage, classifyChoice, normalizeOutcomeSpecials, pickFallbackEvent, summarizeHistory } from '../src/utils/aiEventUtils.js';

test('summarizeHistory compacts recent event records', () => {
    const history = [
        { event: '고대 문자가 빛난다', choice: '해독한다', outcome: '비밀 통로를 찾았다' },
        { event: '수상한 발자국', choice: '추적한다', outcome: '함정을 밟았다' },
    ];

    assert.deepEqual(summarizeHistory(history), [
        '고대 문자가 빛난다 / 선택:해독한다 / 결과:비밀 통로를 찾았다',
        '수상한 발자국 / 선택:추적한다 / 결과:함정을 밟았다'
    ]);
});

test('classifyChoice distinguishes safe, risky, and retreat styles', () => {
    assert.equal(classifyChoice('조심히 접근한다'), 'safe');
    assert.equal(classifyChoice('강제로 연다'), 'risky');
    assert.equal(classifyChoice('후퇴한다'), 'retreat');
    assert.equal(classifyChoice('살펴본다'), 'balanced');
});

test('buildEventPackage dedupes choices and fills missing outcomes procedurally', () => {
    const packaged = buildEventPackage({
        desc: '벽면에서 고대 문자가 빛나기 시작합니다.',
        choices: ['1. 해독한다', '해독한다', '손으로 만진다'],
        outcomes: [{ choiceIndex: 0, log: '문자를 해독해 금화를 찾았습니다.', gold: 25 }]
    }, {
        location: '잊혀진 폐허',
        playerSnapshot: { level: 9, maxHp: 180, maxMp: 90 },
        mapSnapshot: { level: 5 }
    });

    assert.equal(packaged.desc, '벽면에서 고대 문자가 빛나기 시작합니다.');
    assert.deepEqual(packaged.choices, ['해독한다', '손으로 만진다', '조심히 접근한다']);
    assert.equal(packaged.outcomes.length, 3);
    assert.deepEqual(packaged.outcomes[0], {
        choiceIndex: 0,
        log: '문자를 해독해 금화를 찾았습니다.',
        gold: 25,
        exp: 0,
        hp: 0,
        mp: 0
    });
    assert.ok(typeof packaged.outcomes[1].log === 'string' && packaged.outcomes[1].log.length > 0);
    assert.ok(Number.isInteger(packaged.outcomes[1].gold));
});

test('buildEventPackage replaces an unknown AI item promise with a safe procedural outcome', () => {
    const packaged = buildEventPackage({
        desc: '낯선 상자가 열립니다.',
        choices: ['상자를 연다', '그대로 둔다'],
        outcomes: [{
            choiceIndex: 0,
            item: '존재하지 않는 전설검',
            log: '존재하지 않는 전설검을 얻었습니다.',
        }],
    }, {
        location: '잊혀진 폐허',
        playerSnapshot: { level: 9, maxHp: 180, maxMp: 90 },
        mapSnapshot: { level: 5 },
    });

    assert.equal(packaged.outcomes[0].item, undefined);
    assert.doesNotMatch(packaged.outcomes[0].log, /존재하지 않는 전설검/);
});

test('buildEventPackage preserves an exact canonical item reward', () => {
    const packaged = buildEventPackage({
        desc: '여행자의 가방을 발견했습니다.',
        choices: ['가방을 연다', '그대로 둔다'],
        outcomes: [{
            choiceIndex: 0,
            item: '하급 체력 물약',
            log: '하급 체력 물약을 얻었습니다.',
        }],
    }, {
        location: '고요한 숲',
        playerSnapshot: { level: 3, maxHp: 150, maxMp: 60 },
        mapSnapshot: { level: 1 },
    });

    assert.equal(packaged.outcomes[0].item, '하급 체력 물약');
    assert.match(packaged.outcomes[0].log, /하급 체력 물약/);
});

test('pickFallbackEvent avoids immediately repeating recent event descriptions', () => {
    const history = [
        { event: '벽면에서 고대 문자가 빛나기 시작합니다.' },
        { event: '바닥에 함정 흔적이 보입니다.' }
    ];

    const event = pickFallbackEvent('잊혀진 폐허', history, {
        playerSnapshot: { level: 12, maxHp: 220, maxMp: 120 },
        mapSnapshot: { level: 5 }
    });

    assert.ok(event);
    assert.equal(event.source, 'fallback');
    assert.notEqual(event.desc, '벽면에서 고대 문자가 빛나기 시작합니다.');
    assert.notEqual(event.desc, '바닥에 함정 흔적이 보입니다.');
    assert.ok(event.choices.length >= 2);
    assert.equal(event.outcomes.length, event.choices.length);
});

test('pickFallbackEvent does not immediately repeat the previous event when alternatives exist', () => {
    let history = [];
    let previous = null;

    for (let i = 0; i < 12; i += 1) {
        const event = pickFallbackEvent('잊혀진 폐허', history, {
            playerSnapshot: { level: 12, maxHp: 220, maxMp: 120 },
            mapSnapshot: { level: 5 }
        });

        assert.ok(event);
        if (previous) {
            assert.notEqual(event.desc, previous);
        }

        previous = event.desc;
        history = [...history, { event: event.desc, choice: event.choices[0], outcome: event.outcomes[0].log }];
    }
});

// ── 2026-09 Wave 3 I1: outcome 어휘 확장 (relic / status / elite / buff) ──────
// 모델 출력은 신뢰 불가 — 화이트리스트 밖의 값은 조용히 드롭되고, 수치는 BALANCE
// 상한으로 잘린다. 실행 기반 검증(문자열 가드 아님).

const vocabularyContext = {
    location: '에테르 관문',
    playerSnapshot: { level: 20, maxHp: 300, maxMp: 150, hp: 300 },
    mapSnapshot: { level: 20 },
};

const packageWithOutcome = (outcome) => buildEventPackage({
    desc: '관문 중앙의 룬이 순차적으로 점등됩니다.',
    choices: ['동조한다', '즉시 봉인'],
    outcomes: [{ choiceIndex: 0, log: '결과', gold: 10, ...outcome }],
}, vocabularyContext).outcomes[0];

test('normalizeOutcomes: 유효한 relic/status/elite/buff는 정규화되어 통과한다', () => {
    const outcome = packageWithOutcome({
        relic: { count: 2 },
        status: { id: 'poison', turns: 2 },
        elite: true,
        buff: { atkMult: 1.2, turns: 3 },
    });

    assert.deepEqual(outcome.relic, { count: 2 });
    assert.deepEqual(outcome.status, { id: 'poison', turns: 2 });
    assert.equal(outcome.elite, true);
    assert.deepEqual(outcome.buff, { atkMult: 1.2, turns: 3 });
});

test('normalizeOutcomes: 화이트리스트 밖 상태이상 id와 정체불명 필드는 드롭된다', () => {
    const outcome = packageWithOutcome({
        status: { id: 'instant_death', turns: 99 },
        relic: { count: 'all' },
        elite: 'yes',
        buff: { atkMult: 1.2 },      // turns 없음 → 무효
        teleport: '마왕성',          // 미지원 어휘
    });

    assert.equal(outcome.status, undefined);
    assert.equal(outcome.elite, undefined);
    assert.equal(outcome.buff, undefined);
    assert.equal(outcome.teleport, undefined);
    // relic.count는 숫자가 아니면 1로 수렴 (선택지 자체는 살린다)
    assert.deepEqual(outcome.relic, { count: 1 });
});

test('normalizeOutcomes: 확장 어휘 수치는 BALANCE 상한으로 잘린다', () => {
    const outcome = packageWithOutcome({
        relic: { count: 9 },
        status: { id: 'curse', turns: 99 },
        buff: { atkMult: 99, defMult: 50, turns: 99 },
    });

    assert.equal(outcome.relic.count, BALANCE.EVENT_RELIC_MAX_COUNT);
    assert.equal(outcome.status.turns, BALANCE.EVENT_STATUS_MAX_TURNS);
    assert.equal(outcome.buff.atkMult, BALANCE.EVENT_BUFF_MAX_MULT);
    assert.equal(outcome.buff.defMult, BALANCE.EVENT_BUFF_MAX_MULT);
    assert.equal(outcome.buff.turns, BALANCE.EVENT_BUFF_MAX_TURNS);
});

test('normalizeOutcomes: 배율 1 이하 버프는 디버프 통로가 되지 않도록 드롭된다', () => {
    const outcome = packageWithOutcome({ buff: { atkMult: 0.5, defMult: 1, turns: 3 } });
    assert.equal(outcome.buff, undefined);
});

test('normalizeOutcomeSpecials: status 문자열 축약형도 화이트리스트를 통과해야만 정규화된다', () => {
    assert.deepEqual(
        normalizeOutcomeSpecials({ status: 'burn' }),
        { status: { id: 'burn', turns: BALANCE.EVENT_SPECIAL_STATUS_TURNS } },
    );
    assert.deepEqual(normalizeOutcomeSpecials({ status: 'stun' }), {});
    assert.deepEqual(normalizeOutcomeSpecials({ status: 'freeze' }), {});
    assert.deepEqual(normalizeOutcomeSpecials(null), {});
});

// ── 2026-09 Wave 3 I2: 절차적 outcome의 "위험" 선택 특수 결과 ────────────────
// buildProceduralOutcome은 rng가 아니라 hashString(location|desc|choice|index)
// 시드로 움직인다 → 같은 입력은 항상 같은 결과. 분포는 서로 다른 입력을 쓸어서 본다.

const specialKindOf = (outcome) => (
    outcome.status ? 'status'
        : outcome.elite ? 'elite'
            : outcome.relic ? 'relic'
                : outcome.buff ? 'buff'
                    : 'none'
);

const sweepProceduralOutcomes = (count, { hp = 300 } = {}) => {
    const rows = [];
    for (let i = 0; i < count; i += 1) {
        const packaged = buildEventPackage({
            desc: `시험용 조우 ${i}`,
            choices: ['강제로 연다', '후퇴한다', '조심히 접근한다'],
        }, {
            location: '에테르 관문',
            playerSnapshot: { level: 20, maxHp: 300, maxMp: 150, hp },
            mapSnapshot: { level: 20 },
        });
        const [risky, retreat, safe] = packaged.outcomes;
        rows.push({ risky, retreat, safe });
    }
    return rows;
};

test('buildProceduralOutcome: "위험" 선택만 특수 결과를 받는다 — safe/retreat는 0건', () => {
    const rows = sweepProceduralOutcomes(400);

    for (const row of rows) {
        assert.equal(specialKindOf(row.safe), 'none', '신중한 선택에는 특수 결과가 붙지 않는다');
        assert.equal(specialKindOf(row.retreat), 'none', '후퇴 선택에는 특수 결과가 붙지 않는다');
    }
    assert.ok(rows.some((row) => specialKindOf(row.risky) !== 'none'), '위험 선택에는 특수 결과가 나와야 함');
});

test('buildProceduralOutcome: 위험 선택 특수 결과 발생률이 EVENT_RISKY_SPECIAL_CHANCE 근방이고 가중 분포를 따른다', () => {
    const rows = sweepProceduralOutcomes(600);
    const kinds = rows.map((row) => specialKindOf(row.risky));
    const countOf = (kind) => kinds.filter((value) => value === kind).length;

    const specials = kinds.filter((kind) => kind !== 'none').length;
    const rate = specials / kinds.length;
    assert.ok(
        Math.abs(rate - BALANCE.EVENT_RISKY_SPECIAL_CHANCE) <= 0.07,
        `특수 결과 발생률 ${rate.toFixed(3)}이 ${BALANCE.EVENT_RISKY_SPECIAL_CHANCE} 근방이어야 함`,
    );

    // 가중 표 status 45 / elite 30 / relic 15 / buff 10 — 순서와 대략적 비율을 고정한다.
    assert.ok(countOf('status') > countOf('elite'), '상태이상이 가장 흔해야 함');
    assert.ok(countOf('elite') > countOf('relic'), '정예가 유물보다 흔해야 함');
    assert.ok(countOf('relic') > countOf('buff'), '유물이 버프보다 흔해야 함');

    const weights = BALANCE.EVENT_SPECIAL_WEIGHTS;
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    for (const kind of Object.keys(weights)) {
        const share = countOf(kind) / specials;
        assert.ok(
            Math.abs(share - (weights[kind] / total)) <= 0.12,
            `${kind} 비중 ${share.toFixed(3)}이 가중치 ${weights[kind]}/${total} 근방이어야 함`,
        );
    }
});

test('buildProceduralOutcome: 같은 입력은 항상 같은 특수 결과를 준다 (시드 결정론)', () => {
    const first = sweepProceduralOutcomes(40);
    const second = sweepProceduralOutcomes(40);
    assert.deepEqual(first, second);
});

test('buildProceduralOutcome: 생명이 바닥이면 정예 조우로 밀어 넣지 않는다 (부당한 죽음 금지)', () => {
    const healthy = sweepProceduralOutcomes(600).map((row) => specialKindOf(row.risky));
    const wounded = sweepProceduralOutcomes(600, { hp: 300 * BALANCE.SCOUT_LOW_HP_RATIO }).map((row) => specialKindOf(row.risky));

    assert.ok(healthy.includes('elite'), '전제: 정상 체력에서는 정예 조우가 나온다');
    assert.ok(!wounded.includes('elite'), '저생명 구간에서는 정예 조우 0건');
    assert.equal(
        wounded.filter((kind) => kind !== 'none').length,
        healthy.filter((kind) => kind !== 'none').length,
        '정예는 사라지는 게 아니라 상태이상으로 대체된다 (발생률 자체는 동일)',
    );
});

test('buildProceduralOutcome: "균형" 선택은 소폭 버프만 낮은 확률로 받는다', () => {
    let buffs = 0;
    const total = 400;
    for (let i = 0; i < total; i += 1) {
        const packaged = buildEventPackage({
            desc: `균형 시험 ${i}`,
            choices: ['살펴본다', '지켜본다'],
        }, vocabularyContext);
        const outcome = packaged.outcomes[0];
        const kind = specialKindOf(outcome);
        assert.ok(kind === 'none' || kind === 'buff', `균형 선택 특수 결과는 버프만: ${kind}`);
        if (kind === 'buff') {
            buffs += 1;
            assert.equal(outcome.buff.atkMult, BALANCE.EVENT_SPECIAL_BUFF_MULT);
            assert.equal(outcome.buff.turns, BALANCE.EVENT_SPECIAL_BUFF_TURNS);
        }
    }
    const rate = buffs / total;
    assert.ok(
        Math.abs(rate - BALANCE.EVENT_BALANCED_BUFF_CHANCE) <= 0.06,
        `균형 버프 확률 ${rate.toFixed(3)}이 ${BALANCE.EVENT_BALANCED_BUFF_CHANCE} 근방이어야 함`,
    );
});

test('buildProceduralOutcome: 특수 결과가 붙어도 생명 피해 크기는 기존 그대로다', () => {
    const rows = sweepProceduralOutcomes(200);
    const withSpecial = rows.filter((row) => specialKindOf(row.risky) !== 'none').map((row) => row.risky.hp);
    const withoutSpecial = rows.filter((row) => specialKindOf(row.risky) === 'none').map((row) => row.risky.hp);

    assert.ok(withSpecial.length > 0 && withoutSpecial.length > 0, '두 표본 모두 존재해야 함');
    const worst = Math.min(...withSpecial, ...withoutSpecial);
    // 위험 선택의 생명 피해는 최대 12% (maxHp 300 → 36). 특수 결과가 이를 키우지 않는다.
    assert.ok(worst >= -Math.floor(300 * 0.12), `생명 피해 상한 유지: ${worst}`);
});

// ── 2026-09 Wave 3 I3: 후반 5개 풀 두껍게 하기 (6 → 12) ──────────────────────

const ENDGAME_REGIONS = [
    { loc: '고대 보물고', key: 'treasure' },
    { loc: '기계 폐도', key: 'machina' },
    { loc: '천공 정원', key: 'sky' },
    { loc: '심해 회랑', key: 'deepsea' },
    { loc: '에테르 관문', key: 'gate' },
];

test('FALLBACK_EVENT_POOL: 후반 5개 지역 풀이 12개 엔트리를 가진다 (8-deep 반복 필터가 돌 여유)', () => {
    for (const { key } of ENDGAME_REGIONS) {
        assert.equal(FALLBACK_EVENT_POOL[key].length, 12, `${key} 풀 엔트리 수`);
    }
});

test('FALLBACK_EVENT_POOL: 후반 5개 지역마다 저작 outcomes 4건 이상 + 확장 어휘 4종을 모두 쓴다', () => {
    for (const { key } of ENDGAME_REGIONS) {
        const pool = FALLBACK_EVENT_POOL[key];
        const authored = pool.filter((entry) => Array.isArray(entry.outcomes));
        assert.ok(authored.length >= 4, `${key} 저작 엔트리 ${authored.length}건`);

        const outcomes = authored.flatMap((entry) => entry.outcomes);
        for (const kind of ['relic', 'status', 'elite', 'buff']) {
            assert.ok(outcomes.some((outcome) => outcome[kind]), `${key} 풀에 ${kind} 결과 존재`);
        }
        for (const entry of pool) {
            assert.ok(entry.choices.length >= 2 && entry.choices.length <= 3, `${key} 선택지 2~3개: ${entry.desc}`);
            assert.equal(new Set(entry.choices).size, entry.choices.length, `${key} 선택지 중복 없음: ${entry.desc}`);
        }
    }
});

test('pickFallbackEvent: 후반 지역에서도 12연속 조우가 서로 다른 이벤트로 이어진다 (반복 필터 유지)', () => {
    for (const { loc } of ENDGAME_REGIONS) {
        let history = [];
        const seen = [];
        for (let i = 0; i < 12; i += 1) {
            const event = pickFallbackEvent(loc, history, {
                playerSnapshot: { level: 45, maxHp: 500, maxMp: 250, hp: 500 },
                mapSnapshot: { level: 45 },
            }, () => (i + 0.5) / 12);
            assert.ok(event, `${loc} 폴백 이벤트 생성`);
            assert.ok(!seen.slice(-8).includes(event.desc), `${loc} 최근 8건 내 반복 없음: ${event.desc}`);
            seen.push(event.desc);
            history = [...history, { event: event.desc, choice: event.choices[0], outcome: event.outcomes[0].log }];
        }
        assert.ok(new Set(seen).size >= 8, `${loc} 12회 중 서로 다른 이벤트 ${new Set(seen).size}종`);
    }
});

test('pickFallbackEvent: 저작된 확장 어휘가 정규화를 통과해 이벤트 패키지에 살아남는다', () => {
    const kinds = new Set();
    for (const { loc, key } of ENDGAME_REGIONS) {
        for (const entry of FALLBACK_EVENT_POOL[key]) {
            if (!Array.isArray(entry.outcomes)) continue;
            const packaged = buildEventPackage({ ...entry, source: 'fallback' }, {
                location: loc,
                playerSnapshot: { level: 45, maxHp: 500, maxMp: 250, hp: 500 },
                mapSnapshot: { level: 45 },
            });
            for (const authored of entry.outcomes) {
                const normalized = packaged.outcomes.find((outcome) => outcome.choiceIndex === authored.choiceIndex);
                for (const kind of ['relic', 'status', 'elite', 'buff']) {
                    if (!authored[kind]) continue;
                    assert.ok(normalized[kind], `${loc} ${kind} 결과 보존: ${entry.desc}`);
                    kinds.add(kind);
                }
            }
        }
    }
    assert.deepEqual([...kinds].sort(), ['buff', 'elite', 'relic', 'status']);
});

test('BALANCE.EVENT_STATUS_IDS: 이벤트는 턴 강탈(freeze/stun) 어휘를 쓰지 않는다 (공정성 규칙)', () => {
    assert.deepEqual(BALANCE.EVENT_STATUS_IDS, ['poison', 'burn', 'bleed', 'curse']);
    assert.ok(!BALANCE.EVENT_STATUS_IDS.includes('freeze'));
    assert.ok(!BALANCE.EVENT_STATUS_IDS.includes('stun'));
});


test('buildEventPackage: 모델이 넣은 라우팅 플래그(isScout/isBossGaugeChallenge/_chainId)는 패키지에 남지 않는다', async () => {
    const { buildEventPackage } = await import('../src/utils/aiEventUtils.ts');
    const pkg = buildEventPackage({
        desc: '낯선 표식이 새겨진 문이 있다.',
        choices: ['조사한다', '지나친다'],
        isScout: true,
        isBossGaugeChallenge: true,
        _chainId: 'forged',
        bossName: '가짜 보스',
        outcomes: [{ choiceIndex: 0, gold: 5 }],
    }, { location: '고대 하수도', source: 'ai', playerLevel: 3 });
    assert.ok(pkg, '정상 이벤트는 패키지가 만들어진다');
    assert.deepEqual(Object.keys(pkg).sort(), ['choices', 'desc', 'outcomes', 'source']);
    assert.equal(pkg.isScout, undefined);
    assert.equal(pkg.isBossGaugeChallenge, undefined);
    assert.equal(pkg._chainId, undefined);
});
