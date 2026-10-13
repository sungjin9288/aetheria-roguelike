import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MIRROR_ENDLESS_NODES, MIRROR_NODES } from '../src/data/mirror.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getMirrorEndlessCycle, getMirrorEndlessStatGain } from '../src/systems/mirrorUpgrades.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 99 (원장 §103.4 b — 소유자 결정 "b로 진행" · "회차 단위로"): 계승 화면은 이번 회차에 새긴 끝없는 거울 단계를 돌아본다.
 * Wave 98 줄("계승 뒤 정수로 살 수 있는 것")은 회차 중에 사는 플레이어에게 1 ~ 2단계로 보였다 — 회차마다 6 ~ 7단계라는 꾸준한 보상은
 * 이 기록이 보인다. 기록은 영구 meta(`mirrorEndlessCycle`)이고 지금 계승 단계로 키를 맞춘다: 사망 재시작을 넘어 회차 내내 쌓이고,
 * 계승하면 지워진다(단계가 다른 기록은 0으로 읽는다).
 */

const FULL_TREE = Object.fromEntries(MIRROR_NODES.map((node) => [node.id, node.maxLevel]));
const STAT_OF = Object.fromEntries(MIRROR_ENDLESS_NODES.map((node) => [node.id, node.endless.stat]));

const veteran = (meta = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '거울지기', job: '전사', level: 50, loc: '마왕성', hp: 900, maxHp: 900, mp: 200, maxMp: 200, atk: 300, def: 100,
    meta: {
        ...structuredClone(INITIAL_STATE.player.meta),
        prestigeRank: 3, essence: 200_000, bonusAtk: 100, bonusHp: 500, bonusMp: 300, mirror: FULL_TREE,
        endgame: { lastEndgameReceiptKey: 'rk-cycle' },
        ...meta,
    },
});
const stateOf = (player, gameState = GS.IDLE) => ({ ...structuredClone(INITIAL_STATE), gameState, bootStage: 'ready', player });
const buy = (state, nodeId) => gameReducer(state, {
    type: AT.PURCHASE_MIRROR_NODE,
    payload: { nodeId, expectedEssence: state.player.meta.essence, expectedLevel: Math.max(0, Number(state.player.meta.mirror?.[nodeId]) || 0) },
});
const buyAll = (state, nodeIds) => nodeIds.reduce(buy, state);

test('Wave 99: 끝없는 단계를 사면 지금 계승 단계로 회차 기록이 오른다 — 능력치별 단계 · 오른 양', () => {
    const order = ['endless_atk', 'endless_hp', 'endless_atk', 'endless_mp', 'endless_atk'];
    const state = buyAll(stateOf(veteran()), order);
    assert.deepEqual(state.player.meta.mirrorEndlessCycle, { rank: 3, atk: 3, hp: 1, mp: 1 });
    const cycle = getMirrorEndlessCycle(state.player.meta);
    assert.equal(cycle.steps, order.length);
    for (const stat of ['atk', 'hp', 'mp']) {
        const count = order.filter((id) => STAT_OF[id] === stat).length;
        assert.equal(cycle.levels[stat], count);
        assert.equal(cycle.gains[stat], count * getMirrorEndlessStatGain(stat));
    }
    const base = veteran().meta;
    assert.equal(state.player.meta.bonusAtk - base.bonusAtk, cycle.gains.atk, '기록한 양 = 실제로 오른 영구 공격력');
    assert.equal(state.player.meta.bonusHp - base.bonusHp, cycle.gains.hp);
    assert.equal(state.player.meta.bonusMp - base.bonusMp, cycle.gains.mp);
});

test('Wave 99: 거울 8노드 구매 · 실패한 구매는 회차 기록을 바꾸지 않는다', () => {
    const partial = { ...FULL_TREE, revive: 0 };
    const tree = buy(stateOf(veteran({ mirror: partial })), 'revive');
    assert.equal(tree.player.meta.mirror.revive, 1);
    assert.equal(tree.player.meta.mirrorEndlessCycle, undefined, '8노드 구매는 끝없는 단계가 아니다');
    const locked = buy(stateOf(veteran({ mirror: partial })), 'endless_atk');
    assert.equal(locked.player.meta.mirrorEndlessCycle, undefined, '잠긴 끝없는 단계는 사지 못한다');
    const poor = buy(stateOf(veteran({ essence: 10 })), 'endless_atk');
    assert.equal(poor.player.meta.mirrorEndlessCycle, undefined, '정수가 모자란 구매는 기록하지 않는다');
});

test('Wave 99: 기록은 사망 재시작을 넘어 회차 내내 쌓인다', () => {
    const before = buyAll(stateOf(veteran()), ['endless_atk', 'endless_hp']);
    const carried = pickPermanentPlayerState(before.player, structuredClone(INITIAL_STATE.player));
    assert.deepEqual(carried.meta.mirrorEndlessCycle, { rank: 3, atk: 1, hp: 1, mp: 0 }, '영구 meta로 넘어간다');
    // 실제 사망 재시작 경로(전투 패배 정산)를 탄다.
    const restarted = CombatEngine.handleDefeat(before.player, structuredClone(INITIAL_STATE.player), () => 0.5, () => 1).updatedPlayer;
    assert.equal(restarted.level, 1, '사망 재시작이 적용됐다');
    assert.deepEqual(restarted.meta.mirrorEndlessCycle, { rank: 3, atk: 1, hp: 1, mp: 0 });
    const after = buy(stateOf(restarted), 'endless_mp');
    assert.deepEqual(after.player.meta.mirrorEndlessCycle, { rank: 3, atk: 1, hp: 1, mp: 1 }, '같은 회차는 이어서 센다');
});

test('Wave 99: 계승 미리보기가 이번 회차를 돌아보고, 계승하면 기록이 지워져 다음 회차는 0부터 센다', () => {
    const played = buyAll(stateOf(veteran()), ['endless_atk', 'endless_atk', 'endless_hp']);
    const outcome = getAscensionOutcome(played.player.meta);
    assert.equal(outcome.mirrorEndlessCycle.steps, 3);
    assert.equal(outcome.mirrorEndlessCycle.gains.atk, 2 * getMirrorEndlessStatGain('atk'));
    assert.equal('mirrorEndlessCycle' in outcome.meta, false, '다음 회차 meta에는 기록이 없다');

    const ascended = gameReducer({ ...played, gameState: GS.ASCENSION }, {
        type: AT.ASCEND,
        payload: { expectedPrestigeRank: 3, sourceReceiptKey: 'rk-cycle', seed: 1, challengeModifiers: [] },
    });
    assert.equal(ascended.player.meta.prestigeRank, 4, '계승이 적용됐다');
    assert.equal(ascended.player.meta.mirrorEndlessCycle, undefined);
    assert.equal(getMirrorEndlessCycle(ascended.player.meta).steps, 0);
    const next = buy(stateOf(ascended.player), 'endless_mp');
    assert.deepEqual(next.player.meta.mirrorEndlessCycle, { rank: 4, atk: 0, hp: 0, mp: 1 });
});

test('Wave 99: 단계가 다른 기록(이전 회차가 남긴 값)은 0으로 읽고, 다음 구매는 지금 단계로 새로 센다', () => {
    const stale = veteran({ mirrorEndlessCycle: { rank: 2, atk: 9, hp: 9, mp: 9 } });
    assert.equal(getMirrorEndlessCycle(stale.meta).steps, 0);
    assert.equal(getAscensionOutcome(stale.meta).mirrorEndlessCycle.steps, 0);
    const bought = buy(stateOf(stale), 'endless_hp');
    assert.deepEqual(bought.player.meta.mirrorEndlessCycle, { rank: 3, atk: 0, hp: 1, mp: 0 });
    assert.equal(getMirrorEndlessCycle({ prestigeRank: 0 }).steps, 0, '기록 없는 이전 세이브');
    assert.equal(getMirrorEndlessCycle(undefined).steps, 0);
});

test('Wave 99: 세이브 마이그레이션은 기록을 그대로 둔다(DATA_VERSION 그대로 — 없는 세이브는 0으로 읽는다)', () => {
    const player = veteran({ mirrorEndlessCycle: { rank: 3, atk: 4, hp: 2, mp: 1 } });
    const migrated = migrateData({ player, gameState: 'idle' });
    assert.deepEqual(migrated.player.meta.mirrorEndlessCycle, { rank: 3, atk: 4, hp: 2, mp: 1 });
    assert.equal(getMirrorEndlessCycle(migrated.player.meta).steps, 7);
});

test('Wave 99: 계승 화면은 끝없는 거울이 열렸으면 이번 회차 기록을 그린다(없으면 없다고), 잠겨 있으면 그리지 않는다', () => {
    const played = buyAll(stateOf(veteran()), ['endless_atk', 'endless_hp', 'endless_mp', 'endless_atk']).player;
    const cycle = getMirrorEndlessCycle(played.meta);
    const html = renderStatic(createElement(AscensionScreen, { player: played }));
    assert.ok(html.includes('data-testid="ascension-mirror-endless-cycle"'));
    assert.ok(html.includes(MSG.ASCEND_MIRROR_ENDLESS_CYCLE(cycle.steps, cycle.gains.atk, cycle.gains.hp, cycle.gains.mp)));
    assert.ok(html.includes('data-testid="ascension-mirror-endless"'), 'Wave 98 줄(지금 살 수 있는 것)도 함께 있다');

    const fresh = renderStatic(createElement(AscensionScreen, { player: veteran() }));
    assert.ok(fresh.includes(MSG.ASCEND_MIRROR_ENDLESS_CYCLE_NONE));

    const locked = renderStatic(createElement(AscensionScreen, { player: veteran({ mirror: { ...FULL_TREE, revive: 0 } }) }));
    assert.ok(!locked.includes('ascension-mirror-endless-cycle'));
});
