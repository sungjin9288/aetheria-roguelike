import assert from 'node:assert/strict';
import test from 'node:test';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';
import { DB } from '../src/data/db.js';
import { SEASON_XP } from '../src/data/seasonPass.js';
import { isSignatureItem } from '../src/data/signatureItems.js';
import { registerLootToCodex } from '../src/utils/gameUtils.js';

/**
 * 2026-10-26 소유자 결정 D33 — 전설 각인 획득의 원장(도감 · 시즌 경험 · 기록 줄)은 리듀서의 획득 전이가 소유한다.
 *
 * 예전에는 표시 훅이 가방을 관찰하다 dispatch로 남겼다. 그래서 (a) 화면 없는 경로(자연 플레이 드라이버)에서
 * 임무 · 체인 보상 각인이 도감 · 시즌에 오르지 않았고 (b) 장착했던 각인을 벗으면 다시 '획득'으로 기록됐다.
 * 이 파일은 실제 `gameReducer` 전이로 그 규칙을 잡는다.
 */

const signatureWeapons = DB.ITEMS.weapons.filter((item) => isSignatureItem(item)).slice(0, 3);
const copy = (item, id) => ({ ...item, id });
const base = () => structuredClone(INITIAL_STATE);
const addToInv = (state, ...items) => gameReducer(state, {
    type: AT.SET_PLAYER,
    payload: (player) => ({ ...player, inv: [...(player.inv || []), ...items] }),
});
const xpOf = (state) => state.player.seasonPass?.xp ?? 0;
const legendaryLogs = (state) => state.logs.filter((log) => log.type === 'legendary');
const inCodex = (state, name) => Boolean(state.player.stats?.codex?.weapons?.[name]);

/** 리듀서 전이가 `Math.random`을 부르면 던진다 — 획득 정산은 난수를 쓰지 않는다(드라이버 난수열 보존). */
const withoutRandom = (run) => {
    const original = Math.random;
    Math.random = () => { throw new Error('Math.random called during acquisition settlement'); };
    try { return run(); } finally { Math.random = original; }
};

test('전제: 실제 데이터에 전설 각인 무기가 셋 이상 있다', () => {
    assert.equal(signatureWeapons.length, 3);
});

test('가방에 처음 들어온 각인 — 도감 · 시즌 경험(도감 발견) · 기록 줄 · 획득 목록이 한 전이에 남는다(난수 없음)', () => {
    const [a] = signatureWeapons;
    const before = base();
    const after = withoutRandom(() => addToInv(before, copy(a, 'a-1')));
    assert.ok(inCodex(after, a.name), '도감 등록');
    assert.equal(xpOf(after) - xpOf(before), SEASON_XP.codexDiscover, '시즌 경험은 도감 발견 한 번');
    assert.deepEqual(legendaryLogs(after).map((log) => log.text), [MSG.SIGNATURE_DISCOVERED(a.name)]);
    assert.deepEqual(after.legendaryAcquisitions.map(({ seq, item }) => [seq, item.id]), [[1, 'a-1']]);
    assert.equal(after.syncStatus, 'syncing');
});

test('이중 적립 없음 — 같은 전이가 이미 도감에 올린 각인(전투 승리 정산과 같은 모양)은 시즌 경험을 다시 주지 않는다', () => {
    const [a] = signatureWeapons;
    const before = base();
    const after = gameReducer(before, {
        type: AT.SET_PLAYER,
        payload: (player) => registerLootToCodex({ ...player, inv: [...player.inv, copy(a, 'a-1')] }, [a]),
    });
    assert.equal(xpOf(after), xpOf(before), '정산은 자기가 새로 등록한 칸만 센다');
    assert.equal(legendaryLogs(after).length, 1, '획득 기록 줄과 화면은 그대로 남는다');
    assert.equal(after.legendaryAcquisitions.length, 1);
});

test('실제 임무 보상 경로(CLAIM_QUEST_REWARD) — 보상 각인이 도감 · 시즌 경험에 오른다', () => {
    const quest = DB.QUESTS.find((entry) => entry.reward?.item && isSignatureItem({ name: entry.reward.item }));
    assert.ok(quest, '각인을 보상으로 주는 임무');
    const before = { ...base(), player: { ...base().player, quests: [{ id: quest.id, progress: quest.goal }] } };
    const original = Math.random;
    Math.random = () => 0.5; // 임무 보상 기록 줄 자체가 쓰는 id 난수(획득 정산 밖)
    let after;
    try {
        after = gameReducer(before, { type: AT.CLAIM_QUEST_REWARD, payload: { questId: quest.id } });
    } finally { Math.random = original; }
    assert.ok((after.player.inv || []).some((item) => item.name === quest.reward.item), '보상이 가방에 들어왔다(판별 조건)');
    assert.ok(inCodex(after, quest.reward.item), '예전에는 화면 훅만 도감에 올렸다 — 이제 전이가 올린다');
    assert.equal(legendaryLogs(after).length, 1);
    assert.equal(after.legendaryAcquisitions.at(-1).item.name, quest.reward.item);
});

test('같은 각인 두 번 — 동시에 두 사본이면 한 번, 가진 채 둘째 사본도 아니다, 팔고 다시 얻으면 기록은 다시 · 시즌 경험은 한 번', () => {
    const [a] = signatureWeapons;
    const s0 = base();
    const twin = addToInv(s0, copy(a, 'a-1'), copy(a, 'a-2'));
    assert.equal(twin.legendaryAcquisitions.length, 1, '동시에 들어온 두 사본은 한 획득');
    assert.equal(legendaryLogs(twin).length, 1);
    const third = addToInv(twin, copy(a, 'a-3'));
    assert.equal(third.legendaryAcquisitions.length, 1, '가진 채 들어온 사본은 획득이 아니다');
    assert.equal(legendaryLogs(third).length, 1);

    const sold = gameReducer(third, {
        type: AT.SET_PLAYER,
        payload: (player) => ({ ...player, inv: player.inv.filter((item) => item.name !== a.name) }),
    });
    assert.equal(sold.legendaryAcquisitions.length, 1);
    const again = addToInv(sold, copy(a, 'a-4'));
    assert.deepEqual(again.legendaryAcquisitions.map(({ seq, item }) => [seq, item.id]), [[1, 'a-1'], [2, 'a-4']]);
    assert.equal(legendaryLogs(again).length, 2, '다시 손에 넣은 각인은 다시 알린다');
    assert.equal(xpOf(again), xpOf(twin), '도감 발견 시즌 경험은 처음 한 번뿐이다');
    assert.notEqual(legendaryLogs(again)[0].id, legendaryLogs(again)[1].id, '기록 줄 id는 겹치지 않는다');
});

test('여러 각인이 한 전이에 — 이름마다 하나씩, 가방 순서대로 순번이 오른다', () => {
    const [a, b, c] = signatureWeapons;
    const after = addToInv(base(), copy(b, 'b-1'), copy(a, 'a-1'), copy(c, 'c-1'));
    assert.deepEqual(after.legendaryAcquisitions.map(({ seq, item }) => [seq, item.name]), [[1, b.name], [2, a.name], [3, c.name]]);
    assert.equal(xpOf(after), SEASON_XP.codexDiscover * 3);
});

test('장착 · 해제(가방 ↔ 장비)는 획득이 아니다 — 벗은 각인이 다시 기록되지 않는다', () => {
    const [a] = signatureWeapons;
    const owned = addToInv(base(), copy(a, 'a-1'));
    const equipped = gameReducer(owned, {
        type: AT.SET_PLAYER,
        payload: (player) => ({
            ...player,
            inv: player.inv.filter((item) => item.id !== 'a-1'),
            equip: { ...player.equip, weapon: copy(a, 'a-1') },
        }),
    });
    const unequipped = gameReducer(equipped, {
        type: AT.SET_PLAYER,
        payload: (player) => ({
            ...player,
            inv: [...player.inv, player.equip.weapon],
            equip: { ...player.equip, weapon: DB.ITEMS.weapons[0] },
        }),
    });
    assert.equal(unequipped.legendaryAcquisitions.length, 1);
    assert.equal(legendaryLogs(unequipped).length, 1);
});

test('복원(LOAD_DATA)은 획득이 아니다 — 불러온 가방의 각인은 기록 · 도감 · 시즌 · 화면 없이 기준이 되고, 다음 전이에도 다시 오르지 않는다', () => {
    const [a, b] = signatureWeapons;
    const live = addToInv(base(), copy(a, 'a-1'));
    const savedPlayer = { ...structuredClone(INITIAL_STATE.player), name: '리베이아', inv: [copy(b, 'b-1')] };
    const restored = withoutRandom(() => gameReducer(live, {
        type: AT.LOAD_DATA,
        payload: { player: savedPlayer, gameState: GS.IDLE, quickSlots: [] },
    }));
    assert.ok(!inCodex(restored, b.name), '복원은 도감에 올리지 않는다');
    const newLegendaryLogs = (state) => legendaryLogs(state).filter((log) => log.text === MSG.SIGNATURE_DISCOVERED(b.name));
    assert.equal(newLegendaryLogs(restored).length, 0, '복원된 각인의 획득 기록 줄이 없다');
    assert.deepEqual(restored.legendaryAcquisitions, live.legendaryAcquisitions, '획득 목록에 더하지 않는다');

    const touched = gameReducer(restored, { type: AT.SET_PLAYER, payload: { gold: (restored.player.gold || 0) + 1 } });
    assert.deepEqual(touched.legendaryAcquisitions, live.legendaryAcquisitions, '복원된 각인은 다음 전이에서도 기준이다');
    assert.equal(newLegendaryLogs(touched).length, 0);
    assert.ok(!inCodex(touched, b.name));

    const fresh = addToInv(touched, copy(a, 'a-2'));
    assert.equal(fresh.legendaryAcquisitions.at(-1).seq, 2, '순번은 복원을 넘어 계속 오른다(기록 줄 id가 겹치지 않는다)');
});

test('각인이 아닌 아이템 · 가방이 그대로인 전이는 정산하지 않는다(같은 참조)', () => {
    const s0 = base();
    const potion = addToInv(s0, { ...DB.ITEMS.consumables[0], id: 'p-1' });
    assert.equal(potion.legendaryAcquisitions, s0.legendaryAcquisitions);
    const gold = gameReducer(potion, { type: AT.SET_PLAYER, payload: { gold: 10 } });
    assert.equal(gold.legendaryAcquisitions, s0.legendaryAcquisitions);
});
