import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 364: eventChains.ts reward.itemType / reward.tier 7 dead annotations 정리
 *   (cycle 222-363 silent dead config 시리즈 130번째 — cleanup lens 연속).
 *
 * 발견 (7 dead config field — 4 itemType + 3 tier):
 * - eventChains.ts에 4 chain reward 객체에 `itemType: 'weapon'/'armor'` 필드.
 * - eventChains.ts에 3 chain reward 객체에 `tier: 4/5` 필드.
 * - eventActions.ts handleEventChoice는 reward.name만 read해서 addItemByName으로
 *   처리. 이 함수는 DB.ITEMS에서 아이템 데이터(type/tier 포함)를 lookup해 사용.
 * - reward.itemType / reward.tier — eventActions / 어떤 hook에서도 read 0건.
 *
 * 패턴 (cycle 222-363 silent dead config 시리즈 130번째):
 * - cycle 363: AVATAR_ANCHORS shoulder 2 unreachable.
 * - cycle 364: eventChain reward itemType / tier 7 dead annotations.
 *
 * 수정 (src/data/eventChains.ts):
 * - 4 chain reward 객체에서 itemType 필드 제거.
 * - 3 chain reward 객체에서 tier 필드 제거.
 *
 * 회귀 가드:
 * - reward.type / reward.name 보존 (eventActions read).
 * - water_apostle chain reward type validation test (이미 itemType/tier 검증 안 함).
 * - addItemByName 동작 그대로 (DB.ITEMS에서 type/tier lookup).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 364: eventChains.ts reward.itemType 0건', async () => {
    const source = await readSrc('src/data/eventChains.ts');
    const matches = source.match(/itemType:/g) || [];
    assert.equal(matches.length, 0,
        `eventChains.ts에서 itemType 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 364: eventChains.ts reward.tier 0건', async () => {
    const source = await readSrc('src/data/eventChains.ts');
    // reward 객체 안의 tier만 체크 — outcome 안의 reward { ..., tier: 5 } 패턴.
    const matches = source.match(/, tier: \d/g) || [];
    assert.equal(matches.length, 0,
        `eventChains.ts에서 reward tier 0건이어야 함, ${matches.length}건 발견`);
});

test('cycle 364: getChainEventForLoc 동작 보존 (item reward name)', async () => {
    const { EVENT_CHAINS } = await import('../src/data/eventChains.js');
    const lostWizard = EVENT_CHAINS.find((c) => c.id === 'lost_wizard');
    assert.ok(lostWizard, 'lost_wizard chain 존재');
    // legendary_item reward는 name이 보존되어야 함.
    let found = false;
    for (const step of lostWizard.steps) {
        for (const outcome of step.event.outcomes) {
            if (outcome.reward?.type === 'legendary_item') {
                assert.ok(outcome.reward.name, `legendary_item reward에 name 보존`);
                assert.equal(outcome.reward.itemType, undefined, `itemType 0건`);
                found = true;
            }
        }
    }
    assert.ok(found, 'legendary_item reward 발견');
});

test('cycle 363 회귀 가드: AVATAR_ANCHORS shoulder 0건 보존', async () => {
    const { AVATAR_ANCHORS } = await import('../src/utils/anchorPoints.js');
    assert.equal(AVATAR_ANCHORS.shoulder_l, undefined, 'cycle 363 shoulder_l 0건 보존');
    assert.equal(AVATAR_ANCHORS.shoulder_r, undefined, 'cycle 363 shoulder_r 0건 보존');
});
