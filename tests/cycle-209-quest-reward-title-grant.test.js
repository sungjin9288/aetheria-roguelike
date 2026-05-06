import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TITLES } from '../src/data/titles.js';
import { QUESTS } from '../src/data/quests.js';
import { getTitleDefinition } from '../src/utils/gameUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 209: quest reward.title이 실제로 player.titles에 grant되도록 fix
 *   + 누락된 2 Korean-id TITLES 등록 (cycle 192 follow-up).
 *
 * 발견 (cycle 192 incomplete):
 * - cycle 192는 3 endgame 칭호('에테르 탐험가' / '공허의 방랑자' / '종말의 정복자')를
 *   Korean id로 TITLES에 정식 등록 — getTitleDefinition lookup 가능하도록.
 * - 그러나 claimQuestReward(useInventoryActions.ts:263+) 핸들러는 reward.gold / exp /
 *   item만 처리하고 reward.title 미처리. checkTitles에도 'questReward' cond.type
 *   handler 없음 → 모든 5 quest reward title이 player.titles에 grant 안 됨 (dead grant).
 * - cycle 192가 TITLES 등록만 하고 grant 경로는 미수리한 incomplete fix.
 *
 * 추가 발견:
 * - 5 quest reward titles 중 2건('지도 제작자' / '전설의 기록자')은 cycle 192 등록도 안 됨:
 *   · quest 201 '지도 완성가' → '지도 제작자' (cartographer 영문 id의 name과 동일)
 *   · quest 202 '전설 기록자' → '전설의 기록자' (legend_chronicler 영문 id의 name과 동일)
 * - cycle 192 baseline 가드는 'TITLES.id 또는 .name 매칭'으로 통과시켰으나, 실제 grant
 *   경로는 .id 기준이라 visual lookup fail.
 *
 * 수정:
 * 1. src/hooks/useInventoryActions.ts claimQuestReward:
 *    - qData.reward?.title 있을 때 player.titles에 push (이미 있으면 skip).
 *    - emitUnlockedTitles 호출 전에 적용 (TITLES 등록 entry 자동 인식 + visual lookup 통합).
 * 2. src/data/titles.ts:
 *    - '지도 제작자' / '전설의 기록자' Korean-id entry 추가 (cycle 192 패턴 동일,
 *      cond.type='questReward', cond.val=201/202).
 *    - 기존 cartographer / legend_chronicler 영문-id entry 유지 (checkTitles auto-grant
 *      파이프라인은 그대로).
 */

test('cycle 209: TITLES에 지도 제작자 Korean-id entry 등록됨', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    assert.ok(ids.has('지도 제작자'), `'지도 제작자' Korean id missing from TITLES`);
});

test('cycle 209: TITLES에 전설의 기록자 Korean-id entry 등록됨', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    assert.ok(ids.has('전설의 기록자'), `'전설의 기록자' Korean id missing from TITLES`);
});

test('cycle 209: getTitleDefinition으로 2 신규 Korean 토큰 lookup 성공', () => {
    const def1 = getTitleDefinition('지도 제작자');
    assert.ok(def1, `'지도 제작자' lookup must succeed`);
    assert.equal(def1.cond?.type, 'questReward');
    assert.equal(def1.cond?.val, 201);

    const def2 = getTitleDefinition('전설의 기록자');
    assert.ok(def2, `'전설의 기록자' lookup must succeed`);
    assert.equal(def2.cond?.type, 'questReward');
    assert.equal(def2.cond?.val, 202);
});

test('cycle 209: 5 quest reward.title 모두 TITLES.id에 등록 (정합성 lock — id 기준)', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    const missing = [];
    for (const q of QUESTS) {
        if (q.reward?.title) {
            if (!ids.has(q.reward.title)) {
                missing.push(`${q.id} '${q.title}': '${q.reward.title}'`);
            }
        }
    }
    assert.deepEqual(missing, [], `quest reward.title이 모두 TITLES.id로 등록되어야 grant 후 visual lookup 정합:\n  ${missing.join('\n  ')}`);
});

test('cycle 209: claimQuestReward가 reward.title을 player.titles에 push (코드 패턴 가드)', () => {
    const file = path.join(ROOT, 'src/hooks/useInventoryActions.ts');
    const content = fs.readFileSync(file, 'utf-8');
    // claimQuestReward 함수 내에서 reward.title 처리 패턴 존재 확인
    assert.match(
        content,
        /qData\.reward[?\.]+title/,
        'claimQuestReward에 qData.reward?.title 처리 코드 필요',
    );
    // titles 배열에 push하는 패턴
    assert.match(
        content,
        /titles:\s*\[\s*\.\.\.new\s+Set\(\s*\[\s*\.\.\.[\s\S]+title/,
        'reward.title을 titles 배열에 push (Set으로 dedup)하는 패턴 필요',
    );
});

test('cycle 192/197 회귀 가드: 기존 등록 칭호 유지', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    // cycle 192
    assert.ok(ids.has('에테르 탐험가'));
    assert.ok(ids.has('공허의 방랑자'));
    assert.ok(ids.has('종말의 정복자'));
    // cycle 197 PRESTIGE_TITLES 일부
    assert.ok(ids.has('각성자'));
    assert.ok(ids.has('초월자'));
});

test('cycle 174 회귀 가드: TITLES id 유일성 (2 신규 추가 후에도 0 dup)', () => {
    const counts = new Map();
    for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
    const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
    assert.deepEqual(dupes, []);
});
