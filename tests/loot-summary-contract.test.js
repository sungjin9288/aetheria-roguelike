import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { MSG } from '../src/data/messages.ts';
import { addCombatDigestLogs } from '../src/hooks/combatActions/_helpers.ts';
import { getLootChips, getLootRarity, stackLootNames, summarizeLoot } from '../src/utils/lootSummary.ts';
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

const SWORD = '강철 롱소드';
const PREFIXED_SWORD = `날카로운 ${SWORD}`;

const chipsOf = (html) => [...html.matchAll(/data-testid="post-combat-loot-chip" data-rarity="([a-z]+)"[^>]*>([^<]*)</g)]
    .map(([, rarity, label]) => ({ rarity, label }));

test('전투 결과 카드: 같은 전리품 두 개가 "이름 x2" 칸 하나로 보인다', () => {
    const html = renderStatic(createElement(PostCombatCard, {
        result: { enemy: '거대 벌레', items: [SHELL, SHELL, POTION], leveledUp: false },
        onClose: () => {},
    }));
    assert.match(html, /data-card-mode="full"/);
    assert.deepEqual(chipsOf(html).map((chip) => chip.label), [`${SHELL} x2`, POTION], html.slice(0, 400));
    assert.ok(!html.includes(`${SHELL} · ${SHELL}`));
});

// 2026-11 디자인 고도화 A3 — 접히지 않은 카드는 묶음마다 칸 하나, 등급은 테두리 색(data-rarity)으로만 보인다.
test('getLootRarity: 카탈로그 등급을 읽고, 접두어 장비는 바탕 장비의 등급, 모르는 이름은 common', () => {
    assert.equal(getLootRarity(SHELL), 'common');
    assert.equal(getLootRarity(SWORD), 'uncommon');
    assert.equal(getLootRarity(PREFIXED_SWORD), 'uncommon');
    assert.equal(getLootRarity('존재하지 않는 전리품'), 'common');
});

test('getLootChips: 앞의 네 묶음만 칸이고, 나머지는 아이템 개수로 센다', () => {
    assert.deepEqual(getLootChips([SHELL, SHELL, SWORD]), {
        chips: [{ label: `${SHELL} x2`, rarity: 'common' }, { label: SWORD, rarity: 'uncommon' }],
        restCount: 0,
    });
    const many = getLootChips(['가', '나', '다', '라', '마', '마', '바']);
    assert.deepEqual(many.chips.map((chip) => chip.label), ['가', '나', '다', '라']);
    assert.equal(many.restCount, 3);
    assert.deepEqual(getLootChips([]), { chips: [], restCount: 0 });
});

test('전투 결과 카드: 칸마다 등급을 들고, 넘친 묶음은 "외 N개" 칸 하나다', () => {
    const html = renderStatic(createElement(PostCombatCard, {
        result: { enemy: '거대 벌레', items: [PREFIXED_SWORD, SHELL, SHELL, POTION, ORE, ORE, '마력석'], leveledUp: false },
        onClose: () => {},
    }));
    const chips = chipsOf(html);
    assert.equal(chips.length, 4);
    assert.deepEqual(chips[0], { rarity: 'uncommon', label: PREFIXED_SWORD });
    assert.equal(chips[1].label, `${SHELL} x2`);
    assert.match(html, new RegExp(`data-testid="post-combat-loot-more"[^>]*>${MSG.POST_COMBAT_LOOT_MORE(1)}<`));
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
