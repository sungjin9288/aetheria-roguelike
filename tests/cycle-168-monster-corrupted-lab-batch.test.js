import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTERS } from '../src/data/monsters.js';

/**
 * cycle 168: maps.ts 참조 누락 monster profile 추가 — 부패/실험실 8종 batch
 * (cycle 165 baseline 18 → 10).
 *
 * cycle 165(화염/얼음) → 166(언데드/폭풍) → 167(자연/공허/동굴) → 168(부패/실험실)
 * batch 시리즈 4번째.
 *
 * 부패/타락 (5종) — weakness 빛, resistance 어둠:
 * - 붕괴한 수호자 (탱커 + curse)
 * - 실험실 수호자 (탱커, def 48)
 * - 최후의 수호자 (보스 톤, hp 540)
 * - 타락한 용사 (전사형 atk 92)
 * - 파멸의 기사 (탱커-전사 + curse)
 *
 * 실험실/기계 (3종) — weakness 자연/냉기, resistance 대지:
 * - 생체 병기 (statusOnHit poison)
 * - 오염된 연구원 (mage + curse)
 * - 폭주 자동인형 (탱커, weakness 냉기)
 */

const CORRUPTED = ['붕괴한 수호자', '실험실 수호자', '최후의 수호자', '타락한 용사', '파멸의 기사'];
const LAB = ['생체 병기', '오염된 연구원', '폭주 자동인형'];

test('cycle 168: 부패/타락 5종 weakness 빛 / resistance 어둠', () => {
    for (const name of CORRUPTED) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.equal(profile.weakness, '빛');
        assert.equal(profile.resistance, '어둠');
    }
});

test('cycle 168: 실험실 3종 등록 + resistance 대지', () => {
    for (const name of LAB) {
        const profile = MONSTERS[name];
        assert.ok(profile, `${name} profile 누락`);
        assert.equal(profile.resistance, '대지');
    }
});

test('cycle 168: statusOnHit 매핑 — curse 3종 (붕괴한/파멸의/오염된) + poison 1종 (생체)', () => {
    assert.equal(MONSTERS['붕괴한 수호자'].statusOnHit, 'curse');
    assert.equal(MONSTERS['파멸의 기사'].statusOnHit, 'curse');
    assert.equal(MONSTERS['오염된 연구원'].statusOnHit, 'curse');
    assert.equal(MONSTERS['생체 병기'].statusOnHit, 'poison');
});

test('cycle 168: 최후의 수호자 보스 톤 (hp 540, exp 268+, gold 125+)', () => {
    const m = MONSTERS['최후의 수호자'];
    assert.ok(m.hp >= 500);
    assert.ok(m.exp >= 260);
    assert.ok(m.gold >= 120);
});

test('cycle 168: 폭주 자동인형 weakness 냉기 (대지 resistance과 분리)', () => {
    const m = MONSTERS['폭주 자동인형'];
    assert.equal(m.weakness, '냉기');
    assert.equal(m.resistance, '대지');
});
