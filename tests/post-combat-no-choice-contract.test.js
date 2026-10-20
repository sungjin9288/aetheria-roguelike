// 2026-10 Wave 127 — 소유자 결정(2026-10-19): "전투 완료될때마다 회복 or 전투강화를 선택할 수 있던데 해당 기능 삭제.
//   이런 기능들은 낮은 확률로 등장해서 이벤트의 형태로 나타나야함".
//
// 보스가 아닌 승리마다 결과 카드가 "밀어붙인다(공격력 +25% · 6턴 · 구역 보스 게이지 +1칸) / 숨을 고른다(생명 18% 회복)"를
// 제시했다. 이제 승리 카드에는 고를 것이 없고, 회복 · 강화는 낮은 확률의 이벤트(모닥불 — 휴식 · 단련)로만 나온다.
//
// 행동 계약은 실제 승리 전이 · 카드 렌더 · 탐험 액션을 호출한다. 마지막 계약은 지운 코드가 되돌아오지 않는다는
// 부재 불변식(식별자 매칭 — Wave 11 C4 정책이 허용하는 유일한 소스 정규식)이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { BALANCE } from '../src/data/constants.ts';
import { MSG } from '../src/data/messages.ts';
import { DB } from '../src/data/db.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.ts';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.ts';
import { makeSharedHelpers } from '../src/hooks/gameActions/_shared.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import { renderStatic } from './helpers/render.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const actionMap = makeCombatActionMap(INITIAL_STATE.player);

const combatState = () => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '선택 없음', job: '전사', loc: '고요한 숲',
        hp: 40, maxHp: 100, mp: 40, maxMp: 50, atk: 200, def: 20,
    },
    gameState: GS.COMBAT,
    enemy: {
        name: '훈련용 정령', baseName: '훈련용 정령', level: 1, hp: 1, maxHp: 1, atk: 10, def: 0, exp: 8, gold: 10,
        pattern: { guardChance: 0, heavyChance: 0 },
    },
    combatTurn: 0,
    postCombatResult: null,
});

const win = (state) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn || 0, seed: 11, now: 1_700_000_000_000 },
});

test('실제 승리 결과 카드에는 고를 것이 없다 — 회복 · 강화 선택 칸이 그려지지 않는다', () => {
    const won = win(combatState());
    assert.ok(won.postCombatResult, '일반 승리는 결과 카드를 남긴다');
    assert.equal(won.gameState, GS.IDLE);
    const html = renderStatic(createElement(PostCombatCard, { result: won.postCombatResult, onClose: () => {}, onOpenInventory: () => {} }));
    assert.ok(html.includes('data-testid="post-combat-card"'));
    assert.ok(!html.includes('post-combat-choice'), '선택 칸(post-combat-choice)이 없다');
    for (const label of ['밀어붙인다', '숨을 고른다']) assert.ok(!html.includes(label), label);
    // 결과에는 선택 상태가 붙지 않는다.
    assert.equal('postCombatChoiceResolved' in won.postCombatResult, false);
});

test('승리는 그 자리에서 생명을 채우거나 강화를 걸지 않는다 — 카드를 닫아도 그대로다', () => {
    const before = combatState();
    const won = win(before);
    assert.ok(won.player.hp <= before.player.hp, '승리 정산이 회복을 더하지 않는다');
    assert.deepEqual(won.player.tempBuff ?? null, before.player.tempBuff ?? null);
    const closed = gameReducer(won, { type: AT.SET_POST_COMBAT_RESULT, payload: null });
    assert.equal(closed.player, won.player, '카드를 닫는 것은 플레이어를 바꾸지 않는다');
});

test('회복 · 강화는 낮은 확률의 이벤트로 나온다 — 모닥불(휴식 · 단련)은 사냥 지역 탐험에서 열린다', async () => {
    assert.ok(BALANCE.CAMPFIRE_CHANCE > 0 && BALANCE.CAMPFIRE_CHANCE <= 0.1, '낮은 확률');
    let state = {
        ...structuredClone(INITIAL_STATE),
        gameState: GS.IDLE,
        player: {
            ...structuredClone(INITIAL_STATE.player),
            name: '모닥불', job: '전사', loc: '고요한 숲', level: 5,
            // 이야기 체인은 이미 끝났고, 선택 사건을 막는 간격(직전 이야기 뒤 일반 탐험)은 채웠다.
            eventChainProgress: { lost_wizard: 3 },
            activeExpedition: undefined,
            stats: { ...structuredClone(INITIAL_STATE.player.stats), explores: 10, exploreState: { sinceNarrativeEvent: 10 } },
        },
    };
    assert.equal(DB.MAPS[state.player.loc].type, 'dungeon');
    const deps = {
        player: state.player, gameState: state.gameState, rng: () => 0,
        dispatch(action) { state = gameReducer(state, action); },
        addLog() {}, addStoryLog() {},
        getFullStats: () => calculateFullStats(state.player),
    };
    await createExploreActions(deps, makeSharedHelpers(deps)).explore();
    assert.equal(state.gameState, GS.EVENT);
    assert.equal(state.currentEvent?.isCampfire, true);
    assert.deepEqual(state.currentEvent.choices, [MSG.CAMPFIRE_REST_CHOICE, MSG.CAMPFIRE_FORGE_CHOICE]);
});

test('[부재] 승리 뒤 선택과 그 대가(다음 탐험 모닥불 차단)는 되돌아오지 않는다', () => {
    assert.equal(AT.RESOLVE_POST_COMBAT_CHOICE, undefined);
    for (const key of ['POST_COMBAT_PUSH_ATK_BONUS', 'POST_COMBAT_PUSH_TURNS', 'POST_COMBAT_BREATHER_HEAL_RATIO']) {
        assert.equal(Object.hasOwn(BALANCE, key), false, key);
    }
    for (const key of ['POST_COMBAT_CHOICE_TITLE', 'POST_COMBAT_PUSH_CHOICE', 'POST_COMBAT_BREATHER_CHOICE', 'POST_COMBAT_PUSH_DETAIL_BUFF_KEPT']) {
        assert.equal(Object.hasOwn(MSG, key), false, key);
    }
    assert.equal(existsSync(path.join(ROOT, 'src/utils/postCombatChoice.ts')), false);
    const files = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/.test(name)) files.push(full);
        }
    };
    walk(path.join(ROOT, 'src'));
    walk(path.join(ROOT, 'scripts/naturalPlay'));
    const offenders = files.filter((file) => /\b(RESOLVE_POST_COMBAT_CHOICE|nextExploreCampfireBlocked|postCombatChoiceResolved)\b/.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders.map((file) => path.relative(ROOT, file)), []);
});
