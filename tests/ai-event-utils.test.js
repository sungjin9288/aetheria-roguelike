import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
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

test('BALANCE.EVENT_STATUS_IDS: 이벤트는 턴 강탈(freeze/stun) 어휘를 쓰지 않는다 (공정성 규칙)', () => {
    assert.deepEqual(BALANCE.EVENT_STATUS_IDS, ['poison', 'burn', 'bleed', 'curse']);
    assert.ok(!BALANCE.EVENT_STATUS_IDS.includes('freeze'));
    assert.ok(!BALANCE.EVENT_STATUS_IDS.includes('stun'));
});
