import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { MSG } from '../src/data/messages.js';
import { buildReturnBriefing } from '../src/utils/returnBriefing.js';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 19 K2 — 아카이브 진입 소유권 이전 (J3).
//
// 이전에는 `GameRoot.handleOpenArchiveTab`과 `MobileGameLayout.openArchiveConsole`이
// **각자** `setSideTab` + `setGameState(GS.IDLE)` 2줄을 복제했고 공유 가드가 없었다.
// `ReturnBriefingCard`의 primary 버튼이 `claimableRewardCount > 0`일 때 그 경로로
// 도달했는데, 카드 게이트(`GameRoot`)에는 `gameState` 조건이 없다. `lastSeenAt`은
// 모든 저장이 찍으므로 전투 중 복원된 세이브에서도 브리핑이 뜬다 — 그 primary 버튼을
// 누르면 `enemy`가 남은 채 `gameState`만 idle로 넘어가 **도주 판정 없이 전투를 버릴 수**
// 있었다(Wave 17 I1 `openShop`과 같은 결함 클래스).
//
// 이 파일은 (1) `openArchive`의 상태 게이트, (2) 실제 도달 경로(LOAD_DATA 복원 →
// buildReturnBriefing → openArchive) 재현, (3) 시퀀스 복제 부재를 고정한다.
// ─────────────────────────────────────────────────────────────────────────────

const clone = (value) => JSON.parse(JSON.stringify(value));

/** `tests/restorable-mode-contract.test.js`의 ENEMY 픽스처와 동일 — 진짜 모양(Wave 18 교훈). */
const ENEMY = { name: '숲 늑대', hp: 80, maxHp: 80, atk: 20, def: 2, level: 8 };

const HOUR_MS = 60 * 60 * 1000;

const runOpenArchive = (tab, gameState, playerOverrides = {}) => {
    const dispatched = [];
    const logs = [];
    const player = { ...clone(INITIAL_STATE.player), loc: '고요한 숲', level: 12, ...playerOverrides };
    const actions = createCharacterActions({
        player,
        gameState,
        dispatch: (action) => dispatched.push(action),
        addLog: (type, text) => logs.push({ type, text: String(text) }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
    }, { emitUnlockedTitles: () => {} });
    const result = actions.openArchive(tab);
    return { dispatched, logs, result };
};

// ── 게이트 계약: 허용 상태만 아카이브에 들어간다 ─────────────────────────────

test('전투 중에는 아카이브가 열리지 않는다 — SET_GAME_STATE 0건, error 로그 1건, false', () => {
    const { dispatched, logs, result } = runOpenArchive('quest', GS.COMBAT);
    assert.equal(result, false);
    assert.deepEqual(
        dispatched.filter((action) => action.type === AT.SET_GAME_STATE),
        [],
        '전투 중에는 어떤 상태 전이도 없어야 한다',
    );
    assert.deepEqual(dispatched, [], '전투 중에는 SET_SIDE_TAB도 나가면 안 된다');
    assert.deepEqual(logs.map((entry) => entry.type), ['error']);
    assert.deepEqual(logs.map((entry) => entry.text), [MSG.ARCHIVE_BLOCKED]);
});

for (const gameState of [GS.IDLE, GS.SHOP]) {
    test(`${gameState}에서는 아카이브가 열린다 — SET_SIDE_TAB + SET_GAME_STATE(idle), true`, () => {
        const { dispatched, logs, result } = runOpenArchive('quest', gameState);
        assert.equal(result, true);
        assert.deepEqual(dispatched.map((action) => action.type), [AT.SET_SIDE_TAB, AT.SET_GAME_STATE]);
        assert.equal(dispatched[0].payload, 'quest');
        assert.equal(dispatched[1].payload, GS.IDLE);
        assert.deepEqual(logs, []);
    });
}

test('moving/job_change/quest_board/crafting도 허용 상태다', () => {
    for (const gameState of [GS.MOVING, GS.JOB_CHANGE, GS.QUEST_BOARD, GS.CRAFTING]) {
        const { dispatched, result } = runOpenArchive('inventory', gameState);
        assert.equal(result, true, gameState);
        assert.deepEqual(dispatched.map((action) => action.type), [AT.SET_SIDE_TAB, AT.SET_GAME_STATE], gameState);
    }
});

test('event/dead/ascension/true_ending은 화이트리스트 밖이라 거부된다', () => {
    for (const gameState of [GS.EVENT, GS.DEAD, GS.ASCENSION, GS.TRUE_ENDING]) {
        const { dispatched, result } = runOpenArchive('quest', gameState);
        assert.equal(result, false, gameState);
        assert.deepEqual(dispatched, [], gameState);
    }
});

// ── J3 재현 고정: 복원 → 브리핑 → openArchive ────────────────────────────────

test('J3 재현: 전투 중 복원된 세이브 + 완료 미수령 퀘스트에서 openArchive는 전투를 버리지 않는다', () => {
    const now = 1_000_000_000_000;
    const lastSeenAt = now - HOUR_MS * 7;
    const player = {
        ...clone(INITIAL_STATE.player),
        loc: '고요한 숲',
        level: 12,
        hp: 80,
        maxHp: 120,
        eventChainProgress: {},
        quests: [{
            id: 'return_bounty',
            isBounty: true,
            title: '귀환 현상수배',
            goal: 1,
            progress: 1,
            reward: { gold: 100 },
        }],
        stats: { ...clone(INITIAL_STATE.player.stats), lastSeenAt },
    };

    let state = gameReducer(
        { ...clone(INITIAL_STATE), bootStage: 'loading' },
        { type: AT.LOAD_DATA, payload: { player, gameState: GS.COMBAT, enemy: ENEMY, quickSlots: [] } },
    );

    // 복원 자체는 정상 동작한다(Wave 18) — combat + enemy가 함께 왔으므로 combat으로 복원.
    assert.equal(state.gameState, GS.COMBAT);
    assert.equal(state.enemy, ENEMY, 'enemy는 봉투 그대로 같은 객체다');

    // ReturnBriefingCard가 뜰 조건 — lastSeenAt은 모든 저장이 찍으므로 전투 중에도 성립한다.
    const briefing = buildReturnBriefing(state.player, now);
    assert.ok(briefing, '브리핑이 생성되어야 한다(J3의 전제)');
    assert.ok(briefing.claimableRewardCount > 0, 'claimableRewardCount가 0보다 커야 J3가 재현된다');

    // ReturnBriefingCard의 primary 버튼 → onOpenGoals → openArchive('quest')
    const actions = createCharacterActions({
        player: state.player,
        gameState: state.gameState,
        dispatch: (action) => { state = gameReducer(state, action); },
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: state.player.maxHp, maxMp: state.player.maxMp }),
    }, { emitUnlockedTitles: () => {} });

    const accepted = actions.openArchive('quest');

    assert.equal(accepted, false, '전투 중에는 openArchive가 거부되어야 한다');
    assert.equal(state.gameState, GS.COMBAT, '도주 판정 없이 전투를 이탈하면 안 된다');
    assert.equal(state.enemy, ENEMY, 'enemy가 그대로 남아 있어야 한다(같은 객체)');
});

// ── 부재 불변식: src/components/** 어디에도 시퀀스 복제가 없다 ───────────────
//
// CLAUDE.md §7이 소스 정규식 가드를 허용하는 바로 그 범주(부재 불변식)다.
// 포맷(줄바꿈/공백/인자 순서)이 아니라 식별자를 매칭한다.

test('src/components/** 어디에도 setSideTab + setGameState를 같은 파일에서 함께 부르는 곳이 없다', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.join(import.meta.dirname, '..', 'src', 'components');

    const walk = async (dir) => {
        const out = [];
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out.push(...await walk(full));
            else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
        }
        return out;
    };

    const offenders = [];
    for (const file of await walk(root)) {
        const source = await readFile(file, 'utf8');
        // 식별자를 매칭한다 — 호출 형태(옵셔널 체이닝/직접 호출)와 무관하게 잡는다.
        const callsSetSideTab = /\bsetSideTab\??\.?\(/.test(source);
        const callsSetGameState = /\bsetGameState\??\.?\(/.test(source);
        if (callsSetSideTab && callsSetGameState) {
            offenders.push(path.relative(root, file));
        }
    }
    assert.deepEqual(
        offenders, [],
        `아카이브 진입 시퀀스를 복제하는 컴포넌트가 남아 있다 — openArchive를 부를 것:\n  ${offenders.join('\n  ')}`,
    );
});
