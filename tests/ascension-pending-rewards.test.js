import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { getClaimableQuestEntries } from '../src/utils/questProgress.ts';
import { createAscensionActions } from '../src/hooks/gameActions/ascensionActions.ts';
import AscensionScreen from '../src/components/AscensionScreen.tsx';
import { renderStatic } from './helpers/render.ts';

const apply = (state, type, payload) => gameReducer(state, { type, payload });
const winFinalQuest = () => {
    const initial = structuredClone(INITIAL_STATE);
    initial.gameState = 'idle';
    initial.player = { ...initial.player, name: '종장 검증', level: 68, atk: 100000, loc: '시작의 마을', quests: [],
        stats: { ...initial.player.stats, claimedQuestIds: [80, 81, 82, 84, 83, 85, 86] },
        meta: { ...initial.player.meta, prestigeRank: 0 } };
    const accepted = apply(initial, AT.ACCEPT_QUEST, { questId: 87 });
    assert.deepEqual(accepted.player.quests, [{ id: 87, progress: 0 }]);
    const combat = { ...accepted, gameState: 'combat', combatTurn: 0,
        enemy: { name: '마왕', baseName: '마왕', isBoss: true, level: 70, hp: 1, maxHp: 1, atk: 1, def: 0, exp: 0, gold: 0, pattern: { guardChance: 0, heavyChance: 0 } },
        player: { ...accepted.player, loc: '마왕성' } };
    return apply(combat, AT.RESOLVE_COMBAT_ACTION, { kind: 'attack', expectedTurn: 0, seed: 11, now: 1000 });
};
const ascendAction = (state) => ({ type: AT.ASCEND, payload: {
    expectedPrestigeRank: state.player.meta.prestigeRank,
    sourceReceiptKey: state.player.meta.endgame.lastEndgameReceiptKey,
} });

test('일반 마왕 승리의 완료 보상은 계승 전에 보호되고 수령 원장은 한 번만 남는다', () => {
    const won = winFinalQuest();
    assert.equal(won.gameState, 'ascension');
    assert.deepEqual(getClaimableQuestEntries(won.player).map((entry) => entry.id), [87]);
    const ascend = ascendAction(won);
    assert.equal(gameReducer(won, ascend), won, '미수령 완료 임무가 있으면 실제 ASCEND를 거부한다');
    const claimed = apply(won, AT.CLAIM_QUEST_REWARD, { questId: 87 });
    assert.notEqual(claimed, won);
    assert.equal(claimed.questClaimReceipt.questId, 87);
    assert.equal(claimed.player.stats.claimedQuestIds.filter((id) => id === 87).length, 1);
    assert.equal(claimed.player.inv.filter((item) => item.name === '성검 에테르니아').length, 1);
    assert.equal(apply(claimed, AT.CLAIM_QUEST_REWARD, { questId: 87 }), claimed);
    const ascended = gameReducer(claimed, ascend);
    assert.notEqual(ascended, claimed, '수령 후에는 계승이 실제 진행된다');
    assert.equal(ascended.gameState, 'idle');
    assert.equal(ascended.player.meta.prestigeRank, 1);
    assert.ok(ascended.player.stats.claimedQuestIds.includes(87));
    assert.equal(ascended.player.inv.some((item) => item.name === '성검 에테르니아'), false, '현재 장비 초기화 정책은 유지한다');
    assert.equal(gameReducer(ascended, ascend), ascended);
});

test('일반 계승 action은 보상이 남으면 dispatch와 성공 로그를 만들지 않는다', () => {
    const won = winFinalQuest();
    const dispatched = [], logs = [];
    const create = (state) => createAscensionActions({ player: state.player, gameState: state.gameState,
        dispatch: (action) => dispatched.push(action), addLog: (type, text) => logs.push({ type, text }) });
    const blocked = create(won);
    blocked.confirmAscension(); blocked.confirmAscension();
    assert.deepEqual(dispatched, []);
    assert.deepEqual(logs, []);
    const claimed = apply(won, AT.CLAIM_QUEST_REWARD, { questId: 87 });
    const allowed = create(claimed);
    allowed.confirmAscension(); allowed.confirmAscension();
    assert.equal(dispatched.filter((action) => action.type === AT.ASCEND).length, 1);
    assert.deepEqual(logs, [], '성공 안내는 action의 예측이 아니라 승인된 reducer 전이에서 생성한다');
    const accepted = gameReducer(claimed, dispatched[0]);
    assert.equal(accepted.logs.filter((log) => log.text === MSG.ASCEND_DONE(1, accepted.player.activeTitle)).length, 1);
    assert.ok(accepted.player.titles.includes('reborn'));
});

test('여러 완료 임무와 현상수배는 모두 수령해야 하며 미완료 임무는 계승을 막지 않는다', () => {
    const won = winFinalQuest();
    won.player.quests.push({ id: 'bounty-final', isBounty: true, title: '최종 현상수배', goal: 1, progress: 1, reward: { gold: 10 } }, { id: 1, progress: 0 });
    const ascend = ascendAction(won);
    const firstClaim = apply(won, AT.CLAIM_QUEST_REWARD, { questId: 87 });
    assert.equal(gameReducer(firstClaim, ascend), firstClaim);
    const allClaimed = apply(firstClaim, AT.CLAIM_QUEST_REWARD, { questId: 'bounty-final' });
    assert.deepEqual(getClaimableQuestEntries(allClaimed.player), []);
    assert.equal(allClaimed.player.quests.length, 1);
    const ascended = gameReducer(allClaimed, ascend);
    assert.notEqual(ascended, allClaimed);
    assert.deepEqual(ascended.player.quests, []);
    const continued = apply(won, AT.SET_GAME_STATE, 'idle');
    assert.equal(continued.player, won.player, '현재 여정 계속은 미수령 보상을 보존한다');
});

test('계승 화면은 실제 보상과 수령 버튼을 보여주고 완료 보상이 있는 동안만 확정을 막는다', () => {
    const won = winFinalQuest();
    won.player.quests[0].title = '위조 제목';
    won.player.quests[0].reward = { gold: 1 };
    const html = renderStatic(createElement(AscensionScreen, { player: won.player }));
    assert.match(html, /\[스토리\] 세계의 끝 보상 받기/);
    assert.match(html, /성검 에테르니아/);
    assert.ok(!html.includes('위조 제목'));
    assert.match(html, /data-testid="ascension-confirm"[^>]*disabled=""/);
    assert.match(html, /수령 기록은 계승 후에도 남습니다/);
    const claimed = apply(won, AT.CLAIM_QUEST_REWARD, { questId: 87 });
    const clean = renderStatic(createElement(AscensionScreen, { player: claimed.player }));
    assert.ok(!clean.includes('ascension-pending-quests'));
    assert.doesNotMatch(clean, /data-testid="ascension-confirm"[^>]* disabled=""/);
});

test('오래된 계승 action이 최신 미수령 상태에서 거부되면 칭호와 성공 안내도 남기지 않는다', () => {
    const won = winFinalQuest();
    let current = won;
    const logs = [];
    const actions = createAscensionActions({ player: { ...won.player, quests: [] }, gameState: won.gameState,
        dispatch: (action) => { current = gameReducer(current, action); },
        addLog: (type, text) => logs.push({ type, text }) });
    actions.confirmAscension();
    assert.equal(current, won);
    assert.deepEqual(logs, []);
});

test('보상 경험치로 새로 완료된 임무도 다시 계산해 계승 전에 수령한다', () => {
    const won = winFinalQuest();
    won.player.level = 69;
    won.player.exp = 149999;
    won.player.nextExp = 150000;
    won.player.quests.push({ id: 103, progress: 69 });
    assert.deepEqual(getClaimableQuestEntries(won.player).map((entry) => entry.id), [87]);
    const claimed = apply(won, AT.CLAIM_QUEST_REWARD, { questId: 87 });
    assert.ok(claimed.player.level >= 70);
    assert.deepEqual(getClaimableQuestEntries(claimed.player).map((entry) => entry.id), [103]);
    assert.equal(gameReducer(claimed, ascendAction(claimed)), claimed);
    const finished = apply(claimed, AT.CLAIM_QUEST_REWARD, { questId: 103 });
    assert.notEqual(gameReducer(finished, ascendAction(finished)), finished);
});
