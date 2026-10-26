// 소유자 결정 D5(2026-10-26, 감사 CL-08): 기술 성장(분기) 선택이 새로 열릴 때 기록에 한 줄만 남긴다.
// 분기는 직업 데이터라 직업을 얻는 전이(새 게임 시작 · 전직 · 계승)에서 열린다 — 레벨 상승은 열지 않는다.
// 같은 분기를 두 번 알리지 않는다(이전 직업에 이미 있던 분기 · 이미 고른 분기는 빠진다). 튜토리얼 · 반복 안내는 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { getOpenedSkillBranchSkills, getSkillBranchOpenedLog } from '../src/utils/skillBranchOpening.ts';

const isBranchLine = (text) => /의 성장을 고를 수 있습니다/u.test(String(text));

const makeActions = (player) => {
    const logs = [];
    const dispatches = [];
    const actions = createCharacterActions({
        player,
        gameState: 'idle',
        dispatch: (action) => dispatches.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: (candidate = player) => calculateFullStats(candidate),
    }, { emitUnlockedTitles: () => {} });
    return { actions, logs, dispatches };
};

test('판정: 직업을 얻을 때 그 직업의 분기 기술이 열리고, 이전 직업에 있던 것 · 이미 고른 것은 빠진다', () => {
    assert.deepEqual(getOpenedSkillBranchSkills(null, '모험가', {}), ['강타']);
    assert.deepEqual(getOpenedSkillBranchSkills('모험가', '전사', {}), Object.keys(CLASSES['전사'].skillBranches));
    assert.deepEqual(getOpenedSkillBranchSkills('모험가', '전사', { 파워배시: 'A' }), ['광폭화', '출혈베기']);
    assert.deepEqual(getOpenedSkillBranchSkills('전사', '전사', {}), [], '같은 직업으로 다시 전이해도 다시 알리지 않는다');
    assert.equal(getSkillBranchOpenedLog('모험가', '전사', { 파워배시: 'A', 광폭화: 'B', 출혈베기: 'A' }), null);
    assert.equal(getSkillBranchOpenedLog(null, '없는 직업', {}), null);
    // 모든 직업 전이(next)는 분기를 하나 이상 연다 — 데이터가 그렇다(분기가 없는 직업이 생기면 줄이 나오지 않을 뿐이다).
    for (const [job, cls] of Object.entries(CLASSES)) {
        for (const next of cls.next || []) {
            const line = getSkillBranchOpenedLog(job, next, {});
            assert.ok(line && line.includes('기술 탭'), `${job} → ${next}`);
        }
    }
});

test('문구: 어느 기술의 성장을 고를 수 있는지와 어디서 고르는지만 말한다', () => {
    const line = MSG.SKILL_BRANCH_OPENED(['파워배시', '광폭화']);
    assert.equal(line, '파워배시 · 광폭화의 성장을 고를 수 있습니다. 기록의 기술 탭에서 고릅니다.');
});

test('새 게임 시작은 모험가의 강타 성장을 한 줄로 알린다', () => {
    const { actions, logs } = makeActions(structuredClone(INITIAL_STATE.player));
    actions.start('히어로', 'male', '모험가', []);
    const lines = logs.filter((log) => isBranchLine(log.text));
    assert.deepEqual(lines, [{ type: 'system', text: MSG.SKILL_BRANCH_OPENED(['강타']) }]);
});

test('전직은 새 직업의 분기를 한 줄로 알리고, 이미 고른 분기는 말하지 않는다', () => {
    const base = { ...structuredClone(INITIAL_STATE.player), name: '히어로', level: 5, job: '모험가', skillChoices: { 강타: 'A' } };
    const first = makeActions(base);
    first.actions.jobChange('전사');
    assert.deepEqual(first.logs.filter((log) => isBranchLine(log.text)).map((log) => log.text),
        [MSG.SKILL_BRANCH_OPENED(['파워배시', '광폭화', '출혈베기'])]);

    const chosen = makeActions({ ...base, level: 30, job: '전사', skillChoices: { 실드배시: 'A' } });
    chosen.actions.jobChange('나이트');
    assert.deepEqual(chosen.logs.filter((log) => isBranchLine(log.text)).map((log) => log.text),
        [MSG.SKILL_BRANCH_OPENED(['신성한 심판'])]);

    const blocked = makeActions({ ...base, level: 1 });
    blocked.actions.jobChange('전사');
    assert.equal(blocked.logs.some((log) => isBranchLine(log.text)), false, '전직이 거부되면 열리지 않는다');
});

test('레벨 상승은 분기를 열지 않는다 — 고르지 않은 분기를 레벨마다 다시 알리지 않는다', () => {
    const player = { ...structuredClone(INITIAL_STATE.player), level: 3, exp: 0, nextExp: 100, skillChoices: {} };
    const texts = CombatEngine.applyExpGain(player, 100_000).logs.map((log) => log.text);
    assert.equal(texts.some(isBranchLine), false);
});

test('계승은 새 여정의 모험가 강타 성장을 한 줄로 알린다', () => {
    const initial = structuredClone(INITIAL_STATE);
    initial.gameState = 'combat';
    initial.combatTurn = 0;
    initial.player = { ...initial.player, name: '계승 검증', level: 68, atk: 100000, loc: '마왕성', quests: [],
        skillChoices: { 강타: 'B', 파워배시: 'A' },
        meta: { ...initial.player.meta, prestigeRank: 0 } };
    initial.enemy = { name: '마왕', baseName: '마왕', isBoss: true, level: 70, hp: 1, maxHp: 1, atk: 1, def: 0, exp: 0, gold: 0,
        pattern: { guardChance: 0, heavyChance: 0 } };
    const won = gameReducer(initial, { type: AT.RESOLVE_COMBAT_ACTION, payload: { kind: 'attack', expectedTurn: 0, seed: 11, now: 1000 } });
    assert.equal(won.gameState, 'ascension');
    const ascended = gameReducer(won, { type: AT.ASCEND, payload: {
        expectedPrestigeRank: 0,
        sourceReceiptKey: won.player.meta.endgame.lastEndgameReceiptKey,
    } });
    assert.equal(ascended.player.meta.prestigeRank, 1);
    assert.deepEqual(ascended.player.skillChoices, {}, '계승한 여정은 성장 선택을 처음부터 한다');
    assert.deepEqual(ascended.logs.filter((log) => isBranchLine(log.text)).map((log) => log.text),
        [MSG.SKILL_BRANCH_OPENED(['강타'])]);
});
