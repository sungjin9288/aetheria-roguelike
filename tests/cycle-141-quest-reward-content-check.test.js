import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { QUESTS, ACHIEVEMENTS } from '../src/data/quests.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';

/**
 * cycle 141: quest / achievement reward.item baseline 가드 — known content gap.
 *
 * cycle 140이 이벤트 체인의 7건 missing item을 발견·수정한 후 같은 패턴을
 * QUESTS / ACHIEVEMENTS에서도 검증해 보니 75종의 unique missing item 발견
 * (40 quests + 40 achievements references). 모든 reward가 silent no-op.
 *
 * 이 컨텐츠 갭은 큰 데이터 정리(75개 신규 items.ts 등록 또는 이름 매핑) 사이클이
 * 필요해 단일 cycle 범위 초과. 대신 이번 사이클은:
 *
 * 1. 현재 missing 75종을 baseline으로 기록 — 명시 인정.
 * 2. NEW missing item(이 baseline 외 추가)이 생기면 즉시 실패 — 회귀 가드.
 * 3. baseline 줄어들면 (콘텐츠 정리 진행됐다면) 즉시 실패 — 점진 좁히기.
 *
 * 결국 baseline이 0이 될 때까지 이 테스트가 진행도를 lock한다.
 */

const allItemNames = new Set();
for (const bucket of Object.values(DB.ITEMS || {})) {
    if (Array.isArray(bucket)) {
        for (const item of bucket) {
            if (item?.name) allItemNames.add(item.name);
        }
    }
}

// cycle 141 baseline 75 → 142 (-7) → 143 (-7) → 144 (-15) → 145 (-46) = 0.
// 모든 quest/achievement reward.item이 실재 items.ts 항목으로 매핑됨!
// NEW missing 가드와 baseline 좁히기 가드 둘 다 빈 set 기준으로 lock.
const KNOWN_MISSING_REWARD_ITEMS = new Set([]);

const collectMissing = (entries) => {
    const missing = [];
    for (const e of entries) {
        if (typeof e?.reward?.item === 'string' && !allItemNames.has(e.reward.item)) {
            missing.push(e.reward.item);
        }
    }
    return missing;
};

test('quest/achievement reward.item: NEW missing item 0건 (회귀 가드)', () => {
    const missingNames = new Set([...collectMissing(QUESTS), ...collectMissing(ACHIEVEMENTS)]);
    const newMissing = [...missingNames].filter((n) => !KNOWN_MISSING_REWARD_ITEMS.has(n));
    assert.deepEqual(newMissing, [],
        `NEW missing items detected (need to add to items.ts or to baseline):\n  ${newMissing.join('\n  ')}`);
});

test('quest/achievement reward.item: baseline 좁히기 — 등록된 known missing이 실제 missing에서 사라지면 baseline에서도 제거 (점진 정리)', () => {
    const missingNames = new Set([...collectMissing(QUESTS), ...collectMissing(ACHIEVEMENTS)]);
    const staleBaseline = [...KNOWN_MISSING_REWARD_ITEMS].filter((n) => !missingNames.has(n));
    assert.deepEqual(staleBaseline, [],
        `stale baseline (these items are now defined — remove from KNOWN_MISSING_REWARD_ITEMS):\n  ${staleBaseline.join('\n  ')}`);
});

test('cycle 140 회귀 가드: EVENT_CHAINS 보상은 모두 실재 item (cycle 140 fix 보존)', () => {
    // cycle 140 baseline (이벤트 체인은 실제로 모두 fix 됨) — 0이어야 함.
    const missing = [];
    for (const chain of (EVENT_CHAINS || [])) {
        for (const step of (chain.steps || [])) {
            for (const outcome of (step.event?.outcomes || [])) {
                const rwd = outcome.reward;
                if (rwd && (rwd.type === 'item' || rwd.type === 'legendary_item') && rwd.name) {
                    if (!allItemNames.has(rwd.name)) missing.push(rwd.name);
                }
            }
        }
    }
    assert.deepEqual(missing, [], 'EVENT_CHAINS rewards should all reference existing items');
});
