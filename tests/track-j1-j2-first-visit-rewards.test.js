import test from 'node:test';
import assert from 'node:assert/strict';

import { MAPS } from '../src/data/maps.js';
import { FIRST_VISIT_REWARDS } from '../src/data/firstVisitRewards.js';
import { getFirstVisitReward } from '../src/utils/exploreUtils.js';

/**
 * Track J1/J2 (2026-09) — 첫 방문 보상 콘텐츠 패리티.
 *
 * J1: FIRST_VISIT_REWARDS를 exploreUtils.ts에서 data/firstVisitRewards.ts로
 *     분리해도 getFirstVisitReward()의 동작이 동일한지.
 * J2: 52개 지역 중 51개(시작의 마을 제외)에 첫 방문 보상 항목이 존재하는지 +
 *     기존 21개 항목의 값이 보존됐는지.
 */

// ─── J1: 분리 후 동일 동작 ──────────────────────────────────────────────────
test('J1: getFirstVisitReward는 분리 전과 동일한 3개 기존 지역 값을 반환한다', () => {
    const freshPlayer = { stats: { visitedMaps: [] } };
    const forest = getFirstVisitReward('고요한 숲', freshPlayer);
    assert.deepEqual(forest, { gold: 100, exp: 25, msg: '고요한 숲에 처음 발을 들였습니다. 골드 100 · 경험 25' });

    const boss = getFirstVisitReward('마왕성', freshPlayer);
    assert.deepEqual(boss, { gold: 1000, exp: 800, msg: '마왕성에 처음 도착했습니다. 운명이 기다립니다. 골드 1,000 · 경험 800' });

    const treasury = getFirstVisitReward('고대 보물고', freshPlayer);
    assert.deepEqual(treasury, { gold: 300, exp: 200, msg: '고대 보물고를 처음 발견했습니다. 골드 300 · 경험 200' });
});

test('J1: 이미 방문한 지역은 여전히 null을 반환한다', () => {
    const visited = { stats: { visitedMaps: ['고요한 숲'] } };
    assert.equal(getFirstVisitReward('고요한 숲', visited), null);
});

// ─── J2: 51개 지역(시작의 마을 제외) 전체 커버리지 ──────────────────────────
test('J2: 시작의 마을을 제외한 51개 지역 모두 첫 방문 보상 항목을 가진다', () => {
    const allMapNames = Object.keys(MAPS);
    assert.equal(allMapNames.length, 52, 'maps.ts 지역 수 회귀 가드');

    const missing = allMapNames.filter(
        (name) => name !== '시작의 마을' && !FIRST_VISIT_REWARDS[name],
    );
    assert.deepEqual(missing, [], `누락된 첫 방문 보상: ${missing.join(', ')}`);

    // 시작의 마을은 부팅 시 이미 visitedMaps에 포함돼 첫 방문이 발생할 수
    // 없으므로(gameReducer INITIAL_STATE) 의도적으로 항목이 없다.
    assert.equal(FIRST_VISIT_REWARDS['시작의 마을'], undefined);
});

test('J2: 새로 저작한 30개 항목은 gold/exp가 0 이상의 정수이고 msg를 가진다', () => {
    const newMapNames = [
        '신성한 호수', '수정 동굴', '고대 하수도', '바람의 고원', '몰락한 전초기지',
        '여행자의 쉼터', '화염의 사원', '북부 설원', '고대 마법 탑', '허공의 섬',
        '붕괴된 마법 요새', '차원의 틈새', '어둠의 지하 감옥', '황금 왕국', '지하 미궁',
        '공중 신전', '영혼의 강', '금지된 도서관', '세계수 숲', '고대 신전 도시',
        '차원의 균열 전초기지', '폐기된 연구소', '저주받은 묘지', '용암 지대',
        '폭풍의 고원', '에테르 폐허', '공허의 회랑', '종말의 전장', '봄의 정원',
        '서리 폭풍 유적',
    ];
    assert.equal(newMapNames.length, 30);
    for (const name of newMapNames) {
        const reward = FIRST_VISIT_REWARDS[name];
        assert.ok(reward, `${name} 항목 존재`);
        assert.ok(Number.isInteger(reward.gold) && reward.gold >= 0, `${name} gold 정수·비음수`);
        assert.ok(Number.isInteger(reward.exp) && reward.exp >= 0, `${name} exp 정수·비음수`);
        assert.ok(reward.msg.length > 0, `${name} msg 존재`);
        assert.ok(reward.msg.includes(name.split(' ')[0]) || reward.msg.startsWith(name.slice(0, 2)),
            `${name} msg가 지역명을 포함`);
    }
});

test('J2: safe 타입 지역(여행자의 쉼터/허공의 섬/황금 왕국)은 경험치 0, 골드만 지급', () => {
    for (const name of ['여행자의 쉼터', '허공의 섬', '황금 왕국']) {
        assert.equal(MAPS[name].type, 'safe', `${name}은 safe 타입`);
        const reward = FIRST_VISIT_REWARDS[name];
        assert.equal(reward.exp, 0, `${name} exp=0 (전투 없는 안전지역)`);
        assert.ok(reward.gold > 0, `${name} gold는 0 초과(테마 보상)`);
    }
});

test('J2: slice 23 초반 5지역 절반-EXP 값은 변경되지 않았다', () => {
    const EARLY_FIRST_VISIT_EXP_CAPS = {
        '고요한 숲': 25, '서쪽 평원': 30, '호수의 신전': 50, '잊혀진 폐허': 60, '버려진 광산': 80,
    };
    for (const [loc, expCap] of Object.entries(EARLY_FIRST_VISIT_EXP_CAPS)) {
        assert.equal(FIRST_VISIT_REWARDS[loc].exp, expCap, `${loc} 절반-EXP 보존`);
    }
});
