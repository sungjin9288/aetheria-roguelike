import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';

/**
 * cycle 140: lost_wizard 체인 보상 콘텐츠 정합 fix.
 *
 * cycle 139에서 eventActions에 'legendary_item' 핸들러를 추가했지만, 데이터
 * 소스인 eventChains.ts의 lost_wizard chain이 reward.name을 '전설의 마법서'로
 * 지정하는데 items.ts에 정의되지 않은 이름. addItemByName이 itemDef 못 찾아
 * silent no-op — 핸들러는 올바르지만 콘텐츠 갭으로 보상이 여전히 안 줌.
 *
 * 수정:
 * lost_wizard outcome reward.name을 '전설의 마법서' → '아크스태프'(items.ts에
 * 실재하는 tier 4 마법사 weapon)로 교체. 디자인 의도(전설 보상 — mage 친화)
 * 와 호환.
 *
 * 검증:
 * 1. EVENT_CHAINS의 모든 reward.name 이 items.ts에 실재함.
 * 2. legendary_item type reward 도 같은 검증 통과.
 */

const allItemNames = new Set();
for (const bucket of Object.values(DB.ITEMS || {})) {
    if (Array.isArray(bucket)) {
        for (const item of bucket) {
            if (item?.name) allItemNames.add(item.name);
        }
    }
}

test('EVENT_CHAINS: 모든 item/legendary_item reward의 name이 items.ts에 존재', () => {
    const missing = [];
    for (const chain of (EVENT_CHAINS || [])) {
        for (const step of (chain.steps || [])) {
            const outcomes = step.event?.outcomes || [];
            for (const outcome of outcomes) {
                const rwd = outcome.reward;
                if (!rwd) continue;
                if ((rwd.type === 'item' || rwd.type === 'legendary_item') && rwd.name) {
                    if (!allItemNames.has(rwd.name)) {
                        missing.push(`${chain.id}/${step.event?.title}: '${rwd.name}'`);
                    }
                }
            }
        }
    }
    assert.deepEqual(missing, [], `chains reference unknown items:\n  ${missing.join('\n  ')}`);
});

test('lost_wizard chain: 전설 보상 outcome이 실재 item 이름 사용', () => {
    const chain = EVENT_CHAINS.find((c) => c.id === 'lost_wizard');
    assert.ok(chain, 'lost_wizard chain should exist');
    let foundLegendary = false;
    for (const step of (chain.steps || [])) {
        for (const outcome of (step.event?.outcomes || [])) {
            if (outcome.reward?.type === 'legendary_item') {
                foundLegendary = true;
                assert.ok(allItemNames.has(outcome.reward.name),
                    `legendary_item '${outcome.reward.name}' should be an existing item`);
            }
        }
    }
    assert.ok(foundLegendary, 'lost_wizard should have a legendary_item reward outcome');
});
