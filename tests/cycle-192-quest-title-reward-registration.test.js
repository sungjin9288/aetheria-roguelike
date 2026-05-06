import test from 'node:test';
import assert from 'node:assert/strict';

import { QUESTS, ACHIEVEMENTS } from '../src/data/quests.js';
import { TITLES } from '../src/data/titles.js';
import { getTitleDefinition } from '../src/utils/gameUtils.js';

/**
 * cycle 192: quest reward.title 정합성 가드 + 엔드게임 칭호 3종 정식 등록.
 *
 * 발견 (cycle 175 / 185와 같은 패턴):
 * - QUESTS의 reward.title 5건 중 3건이 TITLES 미등록:
 *   - quest 152 '에테르 폐허 완전 탐험' → '에테르 탐험가'
 *   - quest 153 '공허의 회랑 정복' → '공허의 방랑자'
 *   - quest 154 '종말을 넘어서' → '종말의 정복자'
 * - 결과: getTitleDefinition undefined → color/label fallback. SystemTab에서
 *   default 색상으로 표시되던 inconsistency.
 *
 * 수정 (src/data/titles.ts):
 * - 3 endgame title을 TITLES에 정식 등록 (cycle 175/185 컨벤션 — Korean name id,
 *   cond.type='questReward'와 cond.val=questId).
 * - 색상: 에테르(cyan-200) / 공허(purple-200) / 종말(orange-300).
 *
 * 가드: QUESTS / ACHIEVEMENTS reward.title이 모두 TITLES에 등록됐는지 정합성 lock.
 *   cycle 134/138/141/148/164/165/176/178/181/184 baseline pattern 시리즈 11번째 합류.
 */

const ENDGAME_TITLES = ['에테르 탐험가', '공허의 방랑자', '종말의 정복자'];

test('cycle 192: 3 엔드게임 칭호 모두 TITLES 등록됨', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    for (const name of ENDGAME_TITLES) {
        assert.ok(ids.has(name), `'${name}' missing from TITLES`);
    }
});

test('QUESTS / ACHIEVEMENTS reward.title이 모두 TITLES 등록됨 (정합성 lock)', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    const names = new Set(TITLES.map((t) => t.name));
    const missing = [];
    for (const q of [...QUESTS, ...ACHIEVEMENTS]) {
        if (q.reward?.title) {
            const t = q.reward.title;
            if (!ids.has(t) && !names.has(t)) {
                missing.push(`${q.id} '${q.title}': '${t}'`);
            }
        }
    }
    assert.deepEqual(missing, [],
        `quest title reward not in TITLES:\n  ${missing.join('\n  ')}`);
});

test('cycle 192: getTitleDefinition으로 endgame 칭호 lookup 가능', () => {
    const def = getTitleDefinition('에테르 탐험가');
    assert.ok(def);
    assert.equal(def.name, '에테르 탐험가');
    assert.equal(def.cond?.type, 'questReward');
    assert.match(def.color, /text-/);
});

test('cycle 174 회귀 가드: TITLES id 유일성 (3 endgame 추가 후에도 0 dup)', () => {
    const counts = new Map();
    for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
    const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, []);
});
