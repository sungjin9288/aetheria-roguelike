import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.ts';
import { BOUNDED_ENCOUNTERS } from '../src/data/boundedEncounters.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import {
    applyBoundedEncounterChoice,
    buildBoundedEncounterContext,
} from '../src/utils/boundedEncounterSelector.ts';
import { buildChainJournal } from '../src/utils/chainJournal.ts';
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

// ─── Wave 14 F2: 이벤트 체인 진행도의 영구 이월 ──────────────────────────────
//
// 체인은 "열렸다가 닫히지 않는" 유일한 축이었다 — 4개가 승천(Lv48 ≈ 53.28h) 이전에
// 열리는데(ancient_prophecy 2.05h · dragon_legacy 2.73h · forgotten_god 5.23h ·
// world_tree_corruption 21.08h) 완주가 전부 승천보다 깊었고, `ASCEND`의
// `...INITIAL_STATE.player`가 그 사이에서 진행도를 0으로 되돌렸다. 지식 축의 나머지
// (stats.discoveryChains / visitedMaps / codex / titles)는 전부 계승되는데 이것만이었다.
//
// 2026-09 Wave 15 G1이 그 넷의 완주 게이트를 승천 지점 **이하**로 내렸다
// (ancient_prophecy 48 · dragon_legacy 40 · forgotten_god 48 · world_tree_corruption 40 —
// `tests/event-chain-cost.test.js`가 걸치는 체인 0개를 고정한다). 즉 "완주는 전부 그보다
// 깊다"는 더 이상 참이 아니다. 그래도 이 이월은 남는다 — 승천은 레벨에 도달해야 하는
// 게이트가 아니라 **플레이어가 고르는 시점**이라 체인을 열어 둔 채 승천하는 런은 여전히
// 가능하고, 그때 진행도가 0으로 돌아가면 이야기가 끊긴다. 이월은 그 경우의 안전망이다.
//
// **함정**: `eventChainProgress`는 용도가 둘이다 — 예약 키 `boundedEncounterReceipts`가
// 원정 조우 영수증 레저를 겸한다. 통째로 이월하면 그 영수증이 승천을 넘어가 같은
// 조우의 재획득을 영구히 막는다. 아래 테스트는 **둘을 함께** 고정한다.

const RECEIPT_LEDGER_KEY = 'boundedEncounterReceipts';

const chainProgressFixture = () => ({
    ancient_prophecy: 2,
    dragon_legacy: 1,
    forgotten_god: 'failed',
    world_tree_corruption: 1,
    [RECEIPT_LEDGER_KEY]: {
        'expedition-1:forest-old-pillars:1': { encounterId: 'forest-old-pillars', choiceId: 'lift-stone' },
    },
});

test('pickPermanentPlayerState는 체인 id 키만 이월하고 영수증 레저는 남긴다', () => {
    const eventChainProgress = chainProgressFixture();
    const permanent = pickPermanentPlayerState(
        { ...INITIAL_STATE.player, eventChainProgress },
        INITIAL_STATE.player,
    );

    assert.deepEqual(permanent.eventChainProgress, {
        ancient_prophecy: 2,
        dragon_legacy: 1,
        forgotten_god: 'failed',
        world_tree_corruption: 1,
    });
    // 예약 키는 체인 id가 아니므로 화이트리스트에 걸리지 않는다.
    assert.equal(Object.hasOwn(permanent.eventChainProgress, RECEIPT_LEDGER_KEY), false);
    // 이월본을 만져도 원본이 흔들리지 않는다.
    assert.notEqual(permanent.eventChainProgress, eventChainProgress);
});

test('이월은 EVENT_CHAINS 화이트리스트다 — 정의에 없는 키와 레코드 값은 실리지 않는다', () => {
    const permanent = pickPermanentPlayerState(
        {
            ...INITIAL_STATE.player,
            eventChainProgress: {
                lost_wizard: 3,
                '없는_체인': 2,
                // 체인 id 키에 레코드가 들어와도(형태 붕괴) 스텝 값이 아니므로 버린다.
                last_hero: { forged: { encounterId: 'x', choiceId: 'y' } },
                shadow_guild: -1,
            },
        },
        INITIAL_STATE.player,
    );

    assert.deepEqual(permanent.eventChainProgress, { lost_wizard: 3 });
    for (const key of Object.keys(permanent.eventChainProgress)) {
        assert.ok(EVENT_CHAINS.some((chain) => chain.id === key), `${key}는 체인 id가 아니다`);
    }
});

test('ASCEND는 체인 진행도를 이어가고 RESET_GAME도 같다', () => {
    const eventChainProgress = chainProgressFixture();
    const base = {
        ...INITIAL_STATE,
        player: { ...INITIAL_STATE.player, eventChainProgress },
        uid: 'test-uid',
    };

    const ascended = gameReducer(
        { ...base, gameState: 'ascension' },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: null } },
    );
    const restarted = gameReducer(base, { type: AT.RESET_GAME });

    for (const next of [ascended, restarted]) {
        assert.equal(next.player.eventChainProgress.ancient_prophecy, 2);
        assert.equal(next.player.eventChainProgress.dragon_legacy, 1);
        assert.equal(next.player.eventChainProgress.forgotten_god, 'failed');
        assert.equal(next.player.eventChainProgress.world_tree_corruption, 1);
        // 플레이어가 보는 곳: 진행 중 목록이 리셋으로 비지 않는다.
        assert.deepEqual(
            buildChainJournal(next.player.eventChainProgress).map((entry) => entry.chainId).toSorted(),
            ['ancient_prophecy', 'dragon_legacy', 'world_tree_corruption'],
        );
    }
});

test('영수증은 승천을 넘지 않는다 — 같은 조우를 다시 정산할 수 있다', () => {
    const encounter = BOUNDED_ENCOUNTERS[0];
    const receipt = { expeditionId: 'expedition-1', occurrenceSequence: 1 };
    const explorer = {
        ...INITIAL_STATE.player,
        hp: 200,
        maxHp: 200,
        mp: 80,
        maxMp: 80,
        gold: 1_000,
        eventChainProgress: { ancient_prophecy: 1 },
    };

    const first = applyBoundedEncounterChoice(explorer, encounter, 'lift-stone', receipt);
    assert.equal(first.applied, true);
    // 같은 런 안에서는 재정산이 막힌다 — 영수증이 그 일을 한다.
    assert.equal(
        applyBoundedEncounterChoice(first.player, encounter, 'lift-stone', receipt).reason,
        'already_applied',
    );

    const ascended = gameReducer(
        { ...INITIAL_STATE, gameState: 'ascension', player: first.player, uid: 'test-uid' },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 0, sourceReceiptKey: null } },
    );

    // 체인은 남고 영수증은 사라진다.
    assert.equal(ascended.player.eventChainProgress.ancient_prophecy, 1);
    assert.equal(Object.hasOwn(ascended.player.eventChainProgress, RECEIPT_LEDGER_KEY), false);
    assert.deepEqual(
        buildBoundedEncounterContext({ ...ascended.player, hp: 200, maxHp: 200 }, encounter.region).receiptKeys,
        [],
    );

    // 그래서 다음 런에서 같은 조우를 다시 얻을 수 있다 — 이월이 재획득을 막지 않는다.
    const afterAscension = applyBoundedEncounterChoice(
        { ...ascended.player, hp: 200, maxHp: 200, mp: 80, maxMp: 80, gold: 1_000 },
        encounter,
        'lift-stone',
        receipt,
    );
    assert.equal(afterAscension.applied, true);
    assert.equal(afterAscension.reason, 'applied');
});
