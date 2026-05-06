import test from 'node:test';
import assert from 'node:assert/strict';

import { PRESTIGE_TITLES, TITLES } from '../src/data/titles.js';
import { getTitleDefinition, getTitleColor, getTitleLabel } from '../src/utils/gameUtils.js';

/**
 * cycle 197: PRESTIGE_TITLES 10종 정식 TITLES 등록 + visual lookup 가드.
 *
 * 발견 (visual UX 회귀):
 * - PRESTIGE_TITLES (Korean rank 1-10 칭호 토큰)이 ASCEND 시 player.titles에 push됨.
 * - 그러나 getTitleDefinition은 'TITLES.find(t => t.id === token)' — Korean 토큰 vs
 *   English id ('transcendent'/'eternal'/'void_lord') 미매치 → null 반환.
 * - 결과: getTitleColor / getTitleLabel이 모두 fallback. 모든 prestige 칭호가
 *   default 'text-cyber-purple'으로 표시되던 visual inconsistency.
 * - 10종 모두 영향 (각성자~에테르의 신).
 *
 * 수정 (src/data/titles.ts):
 * - 10 PRESTIGE_TITLES 토큰을 Korean id로 TITLES에 정식 등록 — cycle 175/185/192
 *   컨벤션 동일.
 * - cond.type='prestigeRank' + cond.val=rank — 의도 명시.
 * - 색상 차별화: cyan→purple→indigo→violet→fuchsia→pink→rose→yellow→amber→emerald
 *   (rank 1-10 progression).
 * - 기존 'transcendent'/'eternal'/'void_lord'는 다른 cond.type(prestige/abyssFloor)으로
 *   유지(checkTitles auto-grant). 본 cycle은 PRESTIGE_TITLES 토큰 자체에 정식 entry.
 */

test('cycle 197: 10 PRESTIGE_TITLES 모두 TITLES에 Korean id로 등록됨', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    const missing = [];
    for (const t of PRESTIGE_TITLES) {
        if (!ids.has(t)) missing.push(t);
    }
    assert.deepEqual(missing, []);
});

test('cycle 197: getTitleDefinition으로 모든 PRESTIGE_TITLES 토큰 lookup 성공', () => {
    const broken = [];
    for (const token of PRESTIGE_TITLES) {
        const def = getTitleDefinition(token);
        if (!def) broken.push(`${token}: null`);
    }
    assert.deepEqual(broken, []);
});

test('cycle 197: getTitleColor가 default fallback 안 함 (모두 distinct)', () => {
    const fallbacks = [];
    for (const token of PRESTIGE_TITLES) {
        const color = getTitleColor(token);
        if (color === 'text-cyber-purple') fallbacks.push(token);
    }
    assert.deepEqual(fallbacks, []);
});

test('cycle 197: getTitleLabel이 raw token이 아닌 정식 name 반환', () => {
    for (const token of PRESTIGE_TITLES) {
        const label = getTitleLabel(token);
        assert.equal(label, token, `label should equal name='${token}' for id='${token}'`);
    }
});

test('cycle 174 회귀 가드: TITLES id 유일성 (10 prestige 추가 후에도 0 dup)', () => {
    const counts = new Map();
    for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
    const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, []);
});
