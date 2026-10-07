import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { buildContentReachabilityReport } from '../src/systems/contentReachability.ts';
import { getQuestObjectiveGate, getQuestObjectiveGateNotice } from '../src/utils/questObjectiveGate.ts';
import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import QuestTab from '../src/components/tabs/QuestTab.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 28 (소유자 결정 "수락은 두고 보드에 진입 Lv 표시").
 *
 * 임무 19개(Wave 74 전 20개 — 84는 선행이 Lv35가 되어 빠졌다)는 목표 지역에 걸어 들어갈 수 있기 전에 수락된다(Wave 27 N3 `questGateDivergence`). 수락 규칙은 그대로
 * 두고 보드·추적기가 목표 지역의 실제 진입 레벨을 말한다. 계약: ① 런타임 판정(`getQuestObjectiveGate`)은 도달 비용
 * 리포트와 같은 목표 지역·같은 경로 게이트를 낸다(전 임무 대조 — 두 구현이 갈라지면 red) ② 안내는 지금 레벨로 아직
 * 못 들어갈 때만 ③ 보드와 추적기가 실제로 그 문장을 그린다.
 */

const QUESTS = DB.QUESTS;
const questById = (id) => QUESTS.find((quest) => quest.id === id);

test('[대조] 목표 게이트가 수락 게이트보다 늦은 19개 임무에서 런타임 판정은 리포트와 같은 지역·같은 레벨이다', () => {
    const { cost } = buildContentReachabilityReport();
    const rows = cost.questGateDivergence.filter((row) => row.objectiveGateLevel > row.acceptGateLevel);
    assert.equal(rows.length, 19, '비공허 — Wave 27이 센 20개에서 84가 빠졌다(Wave 74)');
    for (const row of rows) {
        assert.deepEqual(
            getQuestObjectiveGate(questById(row.quest)),
            { map: row.objectiveMap, routeGateLevel: row.objectiveGateLevel },
            `quest ${row.quest}`,
        );
    }
});

test('[대조] 나머지 임무에서 목표 지역의 경로 게이트는 리포트의 임무 게이트를 넘지 않는다', () => {
    const { cost } = buildContentReachabilityReport();
    const gateOf = new Map(cost.gates.quests.flatMap((bucket) => bucket.members.map((id) => [id, bucket.gateLevel])));
    const divergent = new Set(cost.questGateDivergence.map((row) => row.quest));
    let priced = 0;
    for (const quest of QUESTS) {
        if (divergent.has(quest.id) || !gateOf.has(quest.id)) continue;
        const gate = getQuestObjectiveGate(quest);
        if (!gate) continue;
        priced += 1;
        assert.ok(gate.routeGateLevel <= gateOf.get(quest.id), `quest ${quest.id}: ${gate.map} Lv${gate.routeGateLevel} > ${gateOf.get(quest.id)}`);
    }
    assert.ok(priced > 50, `목표 지역이 있는 임무를 충분히 대조했다(${priced})`);
    // 걸어서 못 가는 목표(보물고)와 시스템 카운터 목표는 값이 없다.
    assert.equal(getQuestObjectiveGate(questById(136)), null);
    assert.equal(getQuestObjectiveGate({ target: 'level' }), null);
});

test('안내는 지금 레벨로 목표 지역에 아직 못 들어갈 때만 나온다 — 124 기계 폐도(수락 30, 진입 35)', () => {
    const q124 = questById(124);
    assert.deepEqual(getQuestObjectiveGateNotice(q124, 30), { map: '기계 폐도', routeGateLevel: 35 });
    assert.deepEqual(getQuestObjectiveGateNotice(q124, 34), { map: '기계 폐도', routeGateLevel: 35 });
    assert.equal(getQuestObjectiveGateNotice(q124, 35), null);
    assert.equal(getQuestObjectiveGateNotice(questById(85), 48), null, '마왕성은 48부터 — 수락 레벨과 같다');
});

// Wave 74: 예시를 84에서 124로 옮겼다 — 84는 선행이 Lv35가 되어 진입 전에 수락할 수 없다.
const playerWith124 = (level) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '임무 검증',
    level,
    loc: '시작의 마을',
    quests: [{ id: 124, progress: 0 }],
    stats: { ...structuredClone(INITIAL_STATE.player.stats), claimedQuestIds: [80, 81, 82] },
});

const NOOP_ACTIONS = new Proxy({}, { get: () => () => {} });
const notice = MSG.QUEST_OBJECTIVE_GATE_NOTICE('기계 폐도', 35);

test('[표시] 임무 게시판은 진행 중인 124에 목표 지역의 실제 진입 레벨을 그리고, 들어갈 수 있게 되면 지운다', () => {
    const board = (level) => renderStatic(createElement(QuestBoardPanel, {
        player: playerWith124(level), actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));
    const early = board(30);
    assert.ok(early.includes('data-testid="quest-objective-gate"'));
    assert.ok(early.includes(notice));
    assert.equal(board(35).includes(notice), false);
});

test('[표시] 임무 추적기(임무 탭)도 같은 문장을 그린다', () => {
    const tab = (level) => renderStatic(createElement(QuestTab, {
        player: playerWith124(level), actions: NOOP_ACTIONS, isInSafeZone: true,
    }));
    assert.ok(tab(30).includes(notice));
    assert.equal(tab(35).includes(notice), false);
});
