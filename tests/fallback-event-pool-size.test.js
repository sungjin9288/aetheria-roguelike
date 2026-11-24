// 2026-11 E8 4차(원장 §188): 폴백 이벤트 풀의 크기 하한과 저작 규칙.
//   AI는 꺼진 채 출시하므로 폴백 풀이 플레이어가 보는 사건의 전부다. 자연 플레이(사냥 지역 45곳 지도, 1회차)에서 반복이 몰린
//   풀(`default` · `cave` · `ruins` · `forest`)을 보강했다 — 풀을 다시 줄이면 반복률이 돌아온다(원장 §160 · §161 · §188).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.ts';
import { classifyChoice, pickFallbackEvent } from '../src/utils/aiEventUtils.ts';

/** 보강한 풀의 하한(지금 크기). 나머지 생물군 풀은 12, `structured`는 원장 소유 트랜잭션을 포함한 10이다. */
const MIN_POOL_SIZE = Object.freeze({
    default: 30,
    cave: 34,
    ruins: 20,
    forest: 16,
    desert: 12,
    ice: 12,
    dark: 12,
    abyss: 12,
    treasure: 12,
    machina: 12,
    sky: 12,
    deepsea: 12,
    gate: 12,
    structured: 10,
});

test('E8 4차: 폴백 풀은 하한 크기를 지킨다', () => {
    assert.deepEqual(Object.keys(FALLBACK_EVENT_POOL).sort(), Object.keys(MIN_POOL_SIZE).sort());
    for (const [key, min] of Object.entries(MIN_POOL_SIZE)) {
        assert.ok(FALLBACK_EVENT_POOL[key].length >= min, `${key} 풀 ${FALLBACK_EVENT_POOL[key].length} < ${min}`);
    }
});

test('E8 4차: 모든 폴백 글은 풀 전체에서 문장이 하나뿐이다 — 반복 필터 · 기록 동일성은 문장으로 비교한다', () => {
    const seen = new Map();
    for (const [key, entries] of Object.entries(FALLBACK_EVENT_POOL)) {
        for (const entry of entries) {
            assert.ok(!seen.has(entry.desc), `${key} · ${seen.get(entry.desc)} 같은 문장: ${entry.desc}`);
            seen.set(entry.desc, key);
        }
    }
});

test('E8 4차: 절차적 결과 글은 선택지 2 ~ 3개이고 서로 다르며, 물러서는 선택이 하나 있다', () => {
    for (const [key, entries] of Object.entries(FALLBACK_EVENT_POOL)) {
        if (key === 'structured') continue;
        for (const entry of entries) {
            assert.ok(entry.choices.length >= 2 && entry.choices.length <= 3, `${key}: ${entry.desc}`);
            assert.equal(new Set(entry.choices).size, entry.choices.length, `${key} 선택지 중복: ${entry.desc}`);
        }
    }
    // 보강 풀의 4차 저작(절차적 결과)은 셋 중 정확히 하나가 물러서는 선택이고 셋이 모두 같은 성향은 아니다 — 진짜 고르기다.
    const authoredFourth = { default: 14, cave: 12, ruins: 8, forest: 4 };
    for (const [key, count] of Object.entries(authoredFourth)) {
        for (const entry of FALLBACK_EVENT_POOL[key].slice(-count)) {
            assert.equal(entry.outcomes, undefined, `${key} 4차 글은 절차적 결과: ${entry.desc}`);
            assert.equal(entry.choices.length, 3, `${key}: ${entry.desc}`);
            const styles = entry.choices.map((choice) => classifyChoice(choice));
            assert.equal(styles.filter((style) => style === 'retreat').length, 1, `${key} 물러서는 선택 하나: ${entry.desc} ${styles}`);
            assert.ok(new Set(styles).size >= 2, `${key} 성향이 갈린다: ${entry.desc} ${styles}`);
        }
    }
});

test('E8 4차: 보강한 풀의 지역에서 연속 조우는 최근 8건 안에서 같은 글을 다시 내지 않는다', () => {
    const regions = [['어둠의 지하 감옥', 'default'], ['지하 미궁', 'cave'], ['잊혀진 폐허', 'ruins'], ['세계수 숲', 'forest']];
    for (const [loc, key] of regions) {
        const descs = new Set(FALLBACK_EVENT_POOL[key].map((entry) => entry.desc));
        let history = [];
        const seen = [];
        for (let i = 0; i < 24; i += 1) {
            // 구조화 이벤트가 섞이지 않는 쪽(첫 추첨 ≥ 혼합 확률)으로 그 풀만 본다.
            const draws = [0.99, (i * 7 + 0.5) / 24 % 1];
            const event = pickFallbackEvent(loc, history, {
                playerSnapshot: { level: 40, maxHp: 500, maxMp: 250, hp: 500 },
                mapSnapshot: { level: 40 },
            }, () => draws.shift());
            assert.ok(event && descs.has(event.desc), `${loc}은 ${key} 풀을 쓴다: ${event?.desc}`);
            assert.ok(!seen.slice(-8).includes(event.desc), `${loc} 최근 8건 내 반복: ${event.desc}`);
            seen.push(event.desc);
            history = [...history, { event: event.desc, choice: event.choices[0], outcome: event.outcomes[0].log }];
        }
    }
});
