import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { MSG } from '../src/data/messages.ts';
import { addCombatDigestLogs } from '../src/hooks/combatActions/_helpers.ts';
import { stackLootNames, summarizeLoot } from '../src/utils/lootSummary.ts';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 67 — 같은 전리품은 묶어서 보인다(원장 §67.6).
 *
 * 전리품 목록은 지급된 아이템마다 이름 하나라서, 그대로 이어 붙이던 동안 전투 결과 카드가 "벌레 껍질 · 벌레 껍질"을 보였다.
 * 카드와 전투 정리 로그가 같은 판정(`utils/lootSummary.ts`)을 읽는다.
 */

const SHELL = '벌레 껍질';
const POTION = '체력 물약';
const ORE = '철광석';

test('stackLootNames: 같은 이름은 처음 나온 자리에서 개수로 묶고, 빈 이름은 건너뛴다', () => {
    assert.deepEqual(stackLootNames([SHELL, POTION, SHELL, undefined, '', SHELL]), [
        { name: SHELL, count: 3 },
        { name: POTION, count: 1 },
    ]);
    assert.deepEqual(stackLootNames([]), []);
});

test('summarizeLoot: 앞의 두 묶음만 이름으로 보이고, 나머지는 아이템 개수로 센다', () => {
    assert.deepEqual(summarizeLoot([SHELL, SHELL]), { shown: [MSG.LOOT_STACK(SHELL, 2)], restCount: 0 });
    assert.deepEqual(summarizeLoot([SHELL, POTION, ORE, ORE]), {
        shown: [SHELL, POTION],
        restCount: 2,
    });
    assert.equal(MSG.LOOT_STACK(SHELL, 2), `${SHELL} x2`);
    assert.equal(MSG.LOOT_STACK(SHELL, 1), SHELL);
});

test('전투 결과 카드: 같은 전리품 두 개가 "이름 x2" 한 번으로 보인다', () => {
    const html = renderStatic(createElement(PostCombatCard, {
        result: { enemy: '거대 벌레', items: [SHELL, SHELL, POTION], leveledUp: false },
        onClose: () => {},
    }));
    assert.ok(html.includes(`${SHELL} x2 · ${POTION}`), html.slice(0, 400));
    assert.ok(!html.includes(`${SHELL} · ${SHELL}`));
});

test('전투 정리 로그: 같은 전리품은 "이름 x2"로 묶고, 남은 수는 아이템 개수다', () => {
    const logs = [];
    const digest = (droppedItems) => {
        logs.length = 0;
        addCombatDigestLogs({
            addLog: (type, text) => logs.push(text),
            enemyName: '거대 벌레',
            droppedItems,
            upgradeHint: null,
            traitHint: null,
            bossRewardHint: null,
            bossClearBonus: 0,
        });
        return logs[0];
    };
    assert.equal(digest([SHELL, SHELL]), MSG.COMBAT_DIGEST([MSG.COMBAT_DIGEST_KILL('거대 벌레'), MSG.COMBAT_DIGEST_LOOT(`${SHELL} x2`)].join(' · ')));
    assert.ok(digest([SHELL, POTION, ORE, ORE]).includes(MSG.COMBAT_DIGEST_LOOT(`${SHELL} · ${POTION} +2`)));
});
