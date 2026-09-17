import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DB } from '../src/data/db.ts';
import { createAscensionActions } from '../src/hooks/gameActions/ascensionActions.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import {
    ENDING_LINES,
    buildTrueEndingStars,
    getNextTrueEndingTimedStep,
    resolveTrueEndingBackAction,
} from '../src/utils/trueEndingPresentation.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const questProgress = await import('../src/utils/questProgress.ts');

const makeTrueEndingQuestState = () => {
    const player = structuredClone(INITIAL_STATE.player);
    return {
        ...structuredClone(INITIAL_STATE),
        gameState: GS.TRUE_ENDING,
        player: {
            ...player,
            level: 75,
            loc: '마왕성',
            quests: [{
                id: 87,
                progress: 1,
                title: '위조된 제목',
                reward: { gold: 1 },
                done: true,
                isBounty: false,
            }],
            stats: {
                ...player.stats,
                claimedQuestIds: [],
            },
            meta: {
                ...player.meta,
                prestigeRank: 3,
                endgame: {
                    ...player.meta.endgame,
                    lastEndgameReceiptKey: 'true-boss:87',
                    trueEndingSeen: true,
                },
            },
        },
    };
};

test('true ending timed narrative advances deterministically into a complete surface', () => {
    assert.equal(ENDING_LINES.length, 5);
    assert.deepEqual(getNextTrueEndingTimedStep(0), {
        delayMs: 1800,
        nextLineIndex: 1,
        revealState: 'narrative',
    });
    assert.deepEqual(getNextTrueEndingTimedStep(ENDING_LINES.length), {
        delayMs: 600,
        nextLineIndex: ENDING_LINES.length,
        revealState: 'complete',
    });
});

test('true ending star field is byte-stable and does not require global randomness', () => {
    const first = buildTrueEndingStars(60);
    const second = buildTrueEndingStars(60);
    assert.deepEqual(first, second);
    assert.equal(first.length, 60);
    assert.equal(new Set(first.map((star) => JSON.stringify(star))).size, 60);
});

test('platform back reveals an incomplete ending and consumes a completed ending', () => {
    assert.equal(resolveTrueEndingBackAction('narrative'), 'reveal_all');
    assert.equal(resolveTrueEndingBackAction('complete'), 'consume');
});

test('true ending eligibility uses canonical quest metadata and claimed ids', () => {
    assert.equal(typeof questProgress.getClaimableQuestEntries, 'function');
    if (typeof questProgress.getClaimableQuestEntries !== 'function') return;

    const state = makeTrueEndingQuestState();
    const canonicalQuest = DB.QUESTS.find((quest) => quest.id === 87);
    const entries = questProgress.getClaimableQuestEntries(state.player);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 87);
    assert.equal(entries[0].quest, canonicalQuest);
    assert.equal(entries[0].progress, 1);

    const claimedState = makeTrueEndingQuestState();
    claimedState.player.stats.claimedQuestIds = ['87'];
    assert.deepEqual(questProgress.getClaimableQuestEntries(claimedState.player), []);
});

test('true ending blocks ASCEND until the pending quest is claimed, then preserves the claim across New Game+', () => {
    const state = makeTrueEndingQuestState();
    const ascend = {
        type: AT.ASCEND,
        payload: {
            expectedPrestigeRank: 3,
            sourceReceiptKey: 'true-boss:87',
        },
    };

    const blocked = gameReducer(state, ascend);
    assert.equal(blocked, state);

    const claimed = gameReducer(state, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: 87 },
    });
    assert.equal(claimed.player.quests.some((quest) => quest.id === 87), false);
    assert.ok(claimed.player.stats.claimedQuestIds.includes(87));
    assert.ok(claimed.player.inv.some((item) => item.name === '성검 에테르니아'));

    const replayed = gameReducer(claimed, {
        type: AT.CLAIM_QUEST_REWARD,
        payload: { questId: 87 },
    });
    assert.equal(replayed, claimed);

    const ascended = gameReducer(claimed, ascend);
    assert.equal(ascended.gameState, GS.IDLE);
    assert.equal(ascended.player.meta.prestigeRank, 4);
    assert.equal(ascended.player.meta.endgame.trueEndingSeen, true);
    assert.equal(ascended.player.meta.endgame.lastEndgameReceiptKey, 'true-boss:87');
    assert.ok(ascended.player.stats.claimedQuestIds.includes(87));
    assert.equal(ascended.player.quests.some((quest) => quest.id === 87), false);
});

test('true ending confirmation does not dispatch or log while a quest reward is pending', () => {
    const state = makeTrueEndingQuestState();
    const dispatched = [];
    const logs = [];
    const actions = createAscensionActions({
        player: state.player,
        gameState: state.gameState,
        dispatch: (action) => dispatched.push(action),
        addLog: (type, text) => logs.push({ type, text }),
    });

    actions.confirmAscension();

    assert.deepEqual(dispatched, []);
    assert.deepEqual(logs, []);
});

test('true ending source exposes immediate skip, reduced-motion, safe-area and one-shot controls', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/TrueEndingScreen.tsx'), 'utf8');

    assert.doesNotMatch(source, /Math\.random/);
    assert.match(source, /useReducedMotion\(\)/);
    assert.match(source, /data-testid="true-ending-skip"/);
    assert.match(source, /revealAll/);
    assert.match(source, /usePlatformBackHandler\(true,[\s\S]*500\)/);
    assert.match(source, /confirmationAcceptedRef/);
    assert.match(source, /h-\[100dvh\]/);
    assert.match(source, /overflow-y-auto/);
    assert.match(source, /overflow-x-hidden/);
    assert.match(source, /min-h-\[44px\]/);
    assert.match(source, /--aether-safe-area-top/);
    assert.match(source, /--aether-safe-area-bottom/);
    assert.match(source, /true-ending-pending-quests/);
    assert.match(source, /true-ending-claim-quest/);
    assert.match(source, /true-ending-continue/);
    assert.match(source, /completeQuest/);
    assert.match(source, /cancelAscension/);
});
