import test from 'node:test';
import assert from 'node:assert/strict';

import { SEASON_REWARDS } from '../src/data/seasonPass.js';
import { TITLES } from '../src/data/titles.js';
import { getTitleDefinition, getTitleColor, getTitleLabel } from '../src/utils/gameUtils.js';

/**
 * cycle 175: 시즌 패스 보상 칭호 정합 가드 + 정식 등록.
 *
 * 발견:
 * - SEASON_REWARDS의 tier 10/20/30 premium track에 '시즌 선구자' / '시즌 정복자' /
 *   '시즌 마스터' 칭호 보상 정의.
 * - rewardHandlers.ts CLAIM_SEASON_REWARD가 player.titles에 Korean 문자열을 push.
 * - 그러나 TITLES 배열에는 미등록 → getTitleDefinition(token) undefined → 색상/
 *   라벨 fallback. 잠복 inconsistency.
 *
 * 수정:
 * 1. TITLES에 3 시즌 칭호 추가 (id = Korean name, prestige titles 패턴과 동일):
 *    - '시즌 선구자' (text-emerald-300)
 *    - '시즌 정복자' (text-amber-300)
 *    - '시즌 마스터' (text-rose-300)
 * 2. SEASON_REWARDS의 모든 title 보상이 TITLES에 등록됐는지 회귀 가드.
 */

test('SEASON_REWARDS title 보상 → TITLES 정합성 (모두 등록)', () => {
    const titleIds = new Set(TITLES.map((t) => t.id));
    const titleNames = new Set(TITLES.map((t) => t.name));
    const missing = [];
    for (const r of SEASON_REWARDS) {
        for (const slot of ['free', 'premium']) {
            const reward = r[slot];
            if (reward?.title && !titleIds.has(reward.title) && !titleNames.has(reward.title)) {
                missing.push(`tier ${r.tier} ${slot}: '${reward.title}'`);
            }
        }
    }
    assert.deepEqual(missing, [],
        `SEASON_REWARDS title 미등록 (TITLES에 추가 필요):\n  ${missing.join('\n  ')}`);
});

test('cycle 175: 3 시즌 칭호 모두 TITLES 등록됨', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    assert.ok(ids.has('시즌 선구자'));
    assert.ok(ids.has('시즌 정복자'));
    assert.ok(ids.has('시즌 마스터'));
});

test('cycle 175: getTitleDefinition이 시즌 칭호 토큰으로 정의 반환', () => {
    const def = getTitleDefinition('시즌 선구자');
    assert.ok(def, 'season title definition should be found');
    assert.equal(def.name, '시즌 선구자');
    assert.equal(def.color, 'text-emerald-300');
});

test('cycle 175: getTitleColor / getTitleLabel이 시즌 칭호 정상 처리', () => {
    assert.equal(getTitleColor('시즌 정복자'), 'text-amber-300');
    assert.equal(getTitleLabel('시즌 마스터'), '시즌 마스터');
});

test('cycle 174 회귀 가드: TITLES id 유일성 (시즌 칭호 추가 후에도 0 dup)', () => {
    const counts = new Map();
    for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
    const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, []);
});
