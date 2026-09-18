import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.ts';
import {
    getCompletedSeasonCount,
    getSeasonArchive,
    resolveSeasonOrdinal,
} from '../src/utils/seasonPassPresentation.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSource = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('manual reset copy names the current journey and distinguishes reset from preservation', async () => {
    const source = await readSource('src/components/Dashboard.tsx');

    assert.match(source, /현재 여정 다시 시작/);
    assert.match(source, /레벨[^\n]*장비[^\n]*(가방|소지품)[^\n]*(임무|퀘스트)[^\n]*현재 원정/);
    assert.match(source, /영구 성장[^\n]*직업 여정[^\n]*설정[^\n]*도감/);
    assert.doesNotMatch(source, /진행 초기화/);
    assert.doesNotMatch(source, /지금까지의 진행 상황을.*지/);
});

test('ascension copy includes permanent journey and accessibility state', async () => {
    const source = await readSource('src/components/AscensionScreen.tsx');

    assert.match(source, /영구 능력[^\n]*직업 여정[^\n]*설정[^\n]*도감/);
    assert.match(source, /레벨[^\n]*장비와 가방[^\n]*유물[^\n]*임무[^\n]*현재 원정/);
    assert.match(source, /data-testid="ascension-confirm"[\s\S]*min-h-\[48px\]/);
    assert.match(source, /data-testid="ascension-cancel"[\s\S]*min-h-\[48px\]/);
});

test('primal shard guidance derives its percentage from the live balance constant', async () => {
    const prophecy = EVENT_CHAINS.find((chain) => chain.id === 'ancient_prophecy');
    const infoReward = prophecy.steps
        .flatMap((step) => step.event.outcomes)
        .map((outcome) => outcome.reward)
        .find((reward) => reward?.type === 'info');
    const expectedPercent = Math.round(BALANCE.PRIMAL_SHARD_DROP_CHANCE * 100);
    const source = await readSource('src/data/eventChains.ts');

    assert.equal(infoReward.text, `원시의 파편: 계승 1단계부터 마왕 처치 시 ${expectedPercent}% 확률로 획득`);
    assert.match(source, /BALANCE\.PRIMAL_SHARD_DROP_CHANCE/);
    assert.doesNotMatch(source, /마왕 처치 시 40%/);
});

// ─── Wave 12 D2: 시즌 회전 상태의 영구 이월 ────────────────────────────────
//
// 시즌은 런(run)이 아니라 계정 단위 사다리라서 승천/사망을 넘어 이어진다. 회전이
// 생긴 뒤에는 이월 대상에 "완주 기록"이 추가되므로, 승천 한 번이 완주 이력을
// 지워버리지 않는다는 것을 실제 함수/리듀서를 호출해 확인한다.

test('pickPermanentPlayerState는 회전 아카이브와 완주 횟수까지 이월한다', () => {
    const seasonPass = {
        xp: 450,
        tier: 2,
        claimed: [1, 2],
        isPremium: true,
        seasonId: 'S3',
        ordinal: 3,
        completedSeasons: 2,
        archive: [
            { seasonId: 'S1', ordinal: 1, tier: 30, xp: 6000, claimed: [1, 2, 3] },
            { seasonId: 'S2', ordinal: 2, tier: 30, xp: 6000, claimed: [1] },
        ],
    };
    const permanent = pickPermanentPlayerState(
        { ...INITIAL_STATE.player, seasonPass },
        INITIAL_STATE.player,
    );

    assert.deepEqual(permanent.seasonPass, seasonPass);
    assert.equal(resolveSeasonOrdinal(permanent.seasonPass), 3);
    assert.equal(getCompletedSeasonCount(permanent.seasonPass), 2);
    // 깊은 복사여야 한다 — 이월본을 만져도 원본이 흔들리지 않는다.
    assert.notEqual(permanent.seasonPass, seasonPass);
    assert.notEqual(permanent.seasonPass.archive[0], seasonPass.archive[0]);
});

test('pickPermanentPlayerState는 구세이브의 시즌 상태를 정규화하지 않고 그대로 넘긴다', () => {
    // 선택 필드를 여기서 채우면 "필드 추가 없는 승천"을 단언하는 기존 계약이 깨지고,
    // 무엇보다 기본값 소유자가 둘이 된다 — 기본값은 읽는 쪽(resolveSeasonOrdinal)에만 있다.
    const legacy = { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
    const permanent = pickPermanentPlayerState(
        { ...INITIAL_STATE.player, seasonPass: legacy },
        INITIAL_STATE.player,
    );

    assert.deepEqual(Object.keys(permanent.seasonPass).sort(), Object.keys(legacy).sort());
    assert.equal(resolveSeasonOrdinal(permanent.seasonPass), 1);
});

test('ASCEND는 완주 기록을 지우지 않는다 (승천으로 시즌 이력이 사라지지 않는다)', () => {
    const seasonPass = {
        xp: 200,
        tier: 1,
        claimed: [1],
        isPremium: false,
        seasonId: 'S2',
        ordinal: 2,
        completedSeasons: 1,
        archive: [{ seasonId: 'S1', ordinal: 1, tier: 30, xp: 6000, claimed: [1, 2, 3] }],
    };
    const state = {
        ...INITIAL_STATE,
        gameState: 'ascension',
        player: { ...INITIAL_STATE.player, seasonPass },
        uid: 'test-uid',
    };

    const ascended = gameReducer(state, {
        type: AT.ASCEND,
        payload: { expectedPrestigeRank: 0, sourceReceiptKey: null },
    });

    assert.deepEqual(ascended.player.seasonPass, seasonPass);
    assert.equal(getCompletedSeasonCount(ascended.player.seasonPass), 1);
    assert.deepEqual(
        getSeasonArchive(ascended.player.seasonPass).flatMap((entry) => entry.claimed),
        [1, 2, 3],
    );
});
