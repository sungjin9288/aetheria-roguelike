import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { getClaimableQuestEntries, syncQuestProgress } from '../src/utils/questProgress.ts';

/**
 * 2026-09 Wave 32 — 자연 플레이 드라이버(원장 §32)가 잡은 불변식 위반 `questProgressOverGoal`.
 *
 * 레벨 목표 임무만 진행도를 목표에서 멈추지 않았다 — 수락 시 `player.level`, 갱신 시 `max(progress, level)`.
 * 101('레벨 45 달성', minLv 44)을 Lv46에서 받으면 46/45였다. 다른 유형은 모두 `latch`(내려가지 않고 목표에서
 * 멈춘다)다. 이제 레벨 임무도 같은 규칙이다.
 */

const quest101 = DB.QUESTS.find((quest) => quest.id === 101);

const townState = (level) => ({
    ...structuredClone(INITIAL_STATE),
    bootStage: 'ready',
    logs: [],
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '성장한 모험가',
        job: '나이트',
        level,
        loc: '시작의 마을',
        quests: [],
        stats: { ...structuredClone(INITIAL_STATE.player.stats), claimedQuestIds: [10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 100] },
    },
});

test('[수락] 목표보다 높은 레벨에서 받은 레벨 임무의 진행도는 목표다', () => {
    assert.equal(quest101.target, 'level');
    assert.equal(quest101.goal, 45);
    const next = gameReducer(townState(46), { type: AT.ACCEPT_QUEST, payload: { questId: 101 } });
    const accepted = next.player.quests.find((quest) => quest.id === 101);
    assert.ok(accepted, '비공허: 수락됐다');
    assert.equal(accepted.progress, 45);
    assert.ok(getClaimableQuestEntries(next.player).some((entry) => entry.id === 101), '바로 수령할 수 있다');
});

test('[갱신] 진행 중인 레벨 임무는 목표를 넘겨 오르지 않는다', () => {
    const player = { level: 47, job: '나이트', quests: [{ id: 101, progress: 44 }], stats: { kills: 0 } };
    const { updatedQuests } = syncQuestProgress(player, '슬라임', DB.QUESTS);
    assert.equal(updatedQuests.find((quest) => quest.id === 101).progress, 45);
});

test('[미달] 목표 아래 레벨은 그대로 진행도다', () => {
    const next = gameReducer(townState(44), { type: AT.ACCEPT_QUEST, payload: { questId: 101 } });
    assert.equal(next.player.quests.find((quest) => quest.id === 101).progress, 44);
    const player = { level: 44, job: '나이트', quests: [{ id: 101, progress: 43 }], stats: { kills: 0 } };
    assert.equal(syncQuestProgress(player, '슬라임', DB.QUESTS).updatedQuests.find((quest) => quest.id === 101).progress, 44);
});
