import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';

/**
 * cycle 231: 3 Tier-3 classes 도달 불가 회귀 fix.
 *
 * 발견 (class progression dead-end):
 * - 18 classes 정의, BFS로 모험가에서 도달 가능: 15.
 * - 3 unreachable: 드래곤 나이트 / 대마법사 / 그림자 주군.
 * - 각 T2 부모(나이트 / 버서커 / 아크메이지 / 흑마법사 / 어쌔신)의 next: []이라
 *   jobChange 액션이 절대 unlock 불가.
 * - 결과: 3개 T3 직업이 정의만 있고 영원히 진입 불가능 — 데이터 구조 자체에서 'orphan' classes.
 *
 * 패턴 (cycle 222-229 silent dead config 시리즈 lens 확장):
 * - cycle 222-229: item/monster/relic effect dead config.
 * - cycle 231: class progression chain dead-end (정의된 컨텐츠 미도달).
 *
 * 추정 origin:
 * - 18개 직업이 단계적으로 추가되면서 next 배열 확장이 누락된 incomplete content.
 * - T3 신규 직업 (드래곤 나이트 / 대마법사 / 그림자 주군) 합류 시 부모 next 업데이트 누락.
 *
 * 수정 (src/data/classes.ts):
 * - 나이트.next = ['드래곤 나이트'] (Knight → Dragon Knight, 자연 progression).
 * - 버서커.next = ['드래곤 나이트'] (Berserker → Dragon Knight, warrior path 양 분기).
 * - 아크메이지.next = ['대마법사'] (Archmage → Grand Archmage, 자연 progression).
 * - 흑마법사.next = ['대마법사'] (Warlock → Grand Archmage, mage path 양 분기).
 * - 어쌔신.next = ['그림자 주군'] (Assassin → Shadow Lord, 자연 progression).
 *
 * 회귀 가드:
 * - 모든 18 classes가 모험가에서 BFS reachable.
 * - 기존 progression(전사/마법사/도적/레인저/성직자/무당)은 그대로 유지.
 * - T3 자체는 next: [] 그대로 (end of tree).
 */

test('cycle 231: 모든 18 classes가 모험가에서 도달 가능', () => {
    const reachable = new Set(['모험가']);
    const queue = ['모험가'];
    while (queue.length > 0) {
        const job = queue.shift();
        const data = DB.CLASSES[job];
        for (const next of (data?.next || [])) {
            if (!reachable.has(next)) {
                reachable.add(next);
                queue.push(next);
            }
        }
    }
    const allClasses = Object.keys(DB.CLASSES);
    const unreachable = allClasses.filter((j) => !reachable.has(j));
    assert.deepEqual(unreachable, [],
        `모든 직업이 jobChange chain으로 도달 가능해야 함. 미도달: ${JSON.stringify(unreachable)}`);
});

test('cycle 231: T2 → T3 progression 정의 완성', () => {
    const expected = [
        { from: '나이트', to: '드래곤 나이트' },
        { from: '버서커', to: '드래곤 나이트' },
        { from: '아크메이지', to: '대마법사' },
        { from: '흑마법사', to: '대마법사' },
        { from: '어쌔신', to: '그림자 주군' },
    ];
    for (const { from, to } of expected) {
        const next = DB.CLASSES[from]?.next || [];
        assert.ok(next.includes(to),
            `${from}.next에 '${to}' 포함되어야 함 (T3 progression). 실제: ${JSON.stringify(next)}`);
    }
});

test('cycle 231: T3 classes는 next: [] (end of tree, 회귀 가드)', () => {
    const t3Classes = ['팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '시간술사', '사냥의 군주'];
    for (const cls of t3Classes) {
        const data = DB.CLASSES[cls];
        assert.ok(data, `${cls} should exist`);
        assert.deepEqual(data.next || [], [],
            `T3 class ${cls}는 next: [] (end of tree)`);
    }
});

test('cycle 231: 기존 T1 → T2 progression 보존 (회귀 가드)', () => {
    const expected = [
        { from: '모험가', to: ['전사', '마법사', '도적'] },
        { from: '전사', to: ['나이트', '버서커'] },
        { from: '마법사', to: ['아크메이지', '흑마법사', '성직자', '무당'] },
        { from: '도적', to: ['어쌔신', '레인저'] },
    ];
    for (const { from, to } of expected) {
        const next = DB.CLASSES[from]?.next || [];
        for (const t of to) {
            assert.ok(next.includes(t), `${from} → ${t} 보존`);
        }
    }
});

test('cycle 231: 기존 T2 → T3 progression (성직자/무당/레인저) 보존', () => {
    assert.ok((DB.CLASSES['성직자']?.next || []).includes('팔라딘'));
    assert.ok((DB.CLASSES['무당']?.next || []).includes('시간술사'));
    assert.ok((DB.CLASSES['레인저']?.next || []).includes('사냥의 군주'));
});
