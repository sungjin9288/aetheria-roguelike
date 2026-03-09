import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEventPackage, classifyChoice, pickFallbackEvent, summarizeHistory } from '../src/utils/aiEventUtils.js';

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
