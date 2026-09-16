import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { getBossGaugeValue } from '../src/utils/bossGauge.js';
import {
    applyPostCombatChoice,
    getPostCombatChoiceOptions,
    isPostCombatChoiceOffered,
} from '../src/utils/postCombatChoice.js';

/**
 * 2026-09 D2 — 전투 후 "밀어붙인다 / 숨을 고른다".
 *
 * 두 선택 모두 reducer 단일 전이(AT.RESOLVE_POST_COMBAT_CHOICE)로만 적용되며,
 * postCombatResult.postCombatChoiceResolved 플래그가 연타에 의한 이중 적용을 막는다.
 */

const VICTORY_RESULT = {
    enemy: '숲 늑대',
    exp: 30,
    gold: 20,
    items: [],
    leveledUp: false,
};

const makeState = (playerOverrides = {}, resultOverrides = {}) => ({
    ...INITIAL_STATE,
    gameState: 'idle',
    logs: [],
    postCombatResult: { ...VICTORY_RESULT, ...resultOverrides },
    player: {
        ...INITIAL_STATE.player,
        name: '모험가',
        job: '모험가',
        level: 5,
        hp: 40,
        maxHp: 120,
        killStreak: 4,
        loc: '어스름 숲',
        ...playerOverrides,
    },
});

const resolve = (state, choice) => gameReducer(state, {
    type: AT.RESOLVE_POST_COMBAT_CHOICE,
    payload: { choice },
});

// ── ① 선택 제시 조건 ──────────────────────────────────────────────────────
test('① 일반 승리 결과에는 두 선택지를 제시한다', () => {
    assert.equal(isPostCombatChoiceOffered(VICTORY_RESULT), true);
    const options = getPostCombatChoiceOptions();
    assert.deepEqual(options.map((option) => option.label), [
        MSG.POST_COMBAT_PUSH_CHOICE,
        MSG.POST_COMBAT_BREATHER_CHOICE,
    ]);
    assert.deepEqual(options.map((option) => option.testId), [
        'post-combat-choice-push',
        'post-combat-choice-breather',
    ]);
});

test('① 보스 격파와 이미 해소된 결과에는 제시하지 않는다', () => {
    assert.equal(isPostCombatChoiceOffered({ ...VICTORY_RESULT, enemyTier: 'BOSS' }), false);
    assert.equal(isPostCombatChoiceOffered({ ...VICTORY_RESULT, isBoss: true }), false);
    assert.equal(isPostCombatChoiceOffered({ ...VICTORY_RESULT, bossRewardHint: '첫 토벌 보상' }), false);
    assert.equal(isPostCombatChoiceOffered({ ...VICTORY_RESULT, postCombatChoiceResolved: true }), false);
    assert.equal(isPostCombatChoiceOffered(null), false);
});

// ── ② 밀어붙인다 ─────────────────────────────────────────────────────────
test('② 밀어붙이면 다음 전투 공격력 버프와 모닥불 차단이 함께 적용된다', () => {
    const next = resolve(makeState(), 'push');

    assert.equal(next.player.tempBuff.atk, BALANCE.POST_COMBAT_PUSH_ATK_BONUS);
    assert.equal(next.player.tempBuff.turn, BALANCE.POST_COMBAT_PUSH_TURNS);
    assert.equal(next.player.tempBuff.name, MSG.POST_COMBAT_PUSH_BUFF_NAME);
    assert.equal(next.player.stats.nextExploreCampfireBlocked, true);
    assert.equal(next.player.hp, 40, '밀어붙이기는 회복하지 않는다');
    assert.equal(next.player.killStreak, 4, '연속 처치는 유지된다');
});

test('② 미격파 구역 보스가 있는 지역에서는 보스 게이지가 한 칸 오른다', () => {
    // '고대 하수도'는 구역 보스('하수도의 여왕')가 있는 실제 던전 지역이다.
    const state = makeState({
        loc: '고대 하수도',
        stats: { ...INITIAL_STATE.player.stats, bossGauge: { '고대 하수도': 0.2 } },
    });
    const next = resolve(state, 'push');

    assert.ok(
        Math.abs(getBossGaugeValue(next.player, '고대 하수도') - (0.2 + BALANCE.BOSS_GAUGE_PER_EXPLORE)) < 1e-9,
        '밀어붙이면 보스가 한 칸 가까워진다',
    );
    assert.ok(next.logs.some((log) => log.text === MSG.POST_COMBAT_PUSH_GAUGE_LOG));
});

test('② 이미 격파한 구역 보스 지역에서는 게이지가 오르지 않는다', () => {
    const state = makeState({
        loc: '고대 하수도',
        stats: {
            ...INITIAL_STATE.player.stats,
            bossGauge: { '고대 하수도': 0.2 },
            areaBossDefeated: { '하수도의 여왕': true },
        },
    });
    const next = resolve(state, 'push');
    assert.equal(getBossGaugeValue(next.player, '고대 하수도'), 0.2);
});

test('② 구역 보스가 없는 지역에서는 게이지를 건드리지 않는다', () => {
    const player = { ...makeState().player, loc: '없는 지역' };
    const applied = applyPostCombatChoice(player, 'push', null, 120);
    assert.equal(applied.player.stats.bossGauge, undefined);
    assert.equal(applied.player.stats.nextExploreCampfireBlocked, true);
    assert.equal(applied.logs.length, 1, '게이지 로그는 실제로 오를 때만 남긴다');
});

// ── ③ 숨을 고른다 ────────────────────────────────────────────────────────
test('③ 숨을 고르면 최대 생명 비율만큼 회복하고 연속 처치가 끊긴다', () => {
    const applied = applyPostCombatChoice(
        { hp: 40, maxHp: 120, killStreak: 4, stats: {} },
        'breather',
        null,
        120,
    );
    const expectedHeal = Math.floor(120 * BALANCE.POST_COMBAT_BREATHER_HEAL_RATIO);

    assert.equal(applied.player.hp, 40 + expectedHeal);
    assert.equal(applied.player.killStreak, 0);
    assert.equal(applied.player.tempBuff, undefined, '숨 고르기는 버프를 주지 않는다');
    assert.equal(applied.logs[0].text, MSG.POST_COMBAT_BREATHER_LOG(expectedHeal));
});

test('③ 회복은 실효 최대 생명을 넘지 않는다', () => {
    const applied = applyPostCombatChoice(
        { hp: 118, maxHp: 120, killStreak: 2, stats: {} },
        'breather',
        null,
        120,
    );
    assert.equal(applied.player.hp, 120);
    assert.equal(applied.logs[0].text, MSG.POST_COMBAT_BREATHER_LOG(2));
});

test('③ 숨을 고르면 보스 게이지는 그대로다', () => {
    const state = makeState({
        stats: { ...INITIAL_STATE.player.stats, bossGauge: { '어스름 숲': 0.3 } },
    });
    const next = resolve(state, 'breather');
    assert.equal(getBossGaugeValue(next.player, '어스름 숲'), 0.3);
    assert.equal(next.player.stats.nextExploreCampfireBlocked, undefined);
});

// ── ④ 단일 전이 / 연타 방어 ───────────────────────────────────────────────
test('④ 같은 선택을 두 번 dispatch해도 한 번만 적용된다', () => {
    const first = resolve(makeState(), 'breather');
    const second = resolve(first, 'breather');

    assert.equal(first.postCombatResult.postCombatChoiceResolved, true);
    assert.equal(first.postCombatResult.postCombatChoice, 'breather');
    assert.equal(second, first, '두 번째 dispatch는 같은 state를 그대로 반환한다');
    assert.equal(second.player.hp, first.player.hp);
    assert.equal(second.logs.length, first.logs.length);
});

test('④ 첫 선택 이후 다른 선택으로 덮어쓸 수 없다', () => {
    const pushed = resolve(makeState(), 'push');
    const attempted = resolve(pushed, 'breather');

    assert.equal(attempted, pushed);
    assert.equal(attempted.player.hp, 40, '회복이 뒤늦게 적용되지 않는다');
    assert.equal(attempted.postCombatResult.postCombatChoice, 'push');
});

test('④ 알 수 없는 선택값과 결과 없는 상태는 무시된다', () => {
    const state = makeState();
    assert.equal(resolve(state, 'unknown'), state);
    assert.equal(gameReducer(state, { type: AT.RESOLVE_POST_COMBAT_CHOICE }), state);

    const noResult = { ...state, postCombatResult: null };
    assert.equal(resolve(noResult, 'push'), noResult);
});

test('④ 보스 전투 결과에서는 선택이 적용되지 않는다', () => {
    const bossState = makeState({}, { enemyTier: 'BOSS' });
    assert.equal(resolve(bossState, 'push'), bossState);
});

test('④ 원본 state와 player를 변이하지 않는다 (immutable)', () => {
    const state = makeState();
    const snapshotHp = state.player.hp;
    const snapshotLogs = state.logs.length;
    resolve(state, 'breather');
    assert.equal(state.player.hp, snapshotHp);
    assert.equal(state.logs.length, snapshotLogs);
    assert.equal(state.postCombatResult.postCombatChoiceResolved, undefined);
});

// ── ⑤ UI / 소비처 계약 (정적 가드) ────────────────────────────────────────
test('⑤ PostCombatCard는 두 선택지를 testid와 함께 렌더한다', async () => {
    const source = await readFile(new URL('../src/components/PostCombatCard.tsx', import.meta.url), 'utf8');

    assert.match(source, /data-testid="post-combat-choice"/);
    assert.match(source, /isPostCombatChoiceOffered/);
    assert.match(source, /getPostCombatChoiceOptions/);
    assert.match(source, /data-testid=\{option\.testId\}/);
    assert.match(source, /onResolveChoice/);
    // 기존 e2e / smoke가 찾는 testid는 이름이 바뀌지 않는다.
    assert.match(source, /data-testid="post-combat-card"/);
    assert.match(source, /data-testid="post-combat-close"/);
    assert.match(source, /data-testid="post-combat-decision-strip"/);
    assert.match(source, /data-testid="post-combat-reward-summary"/);
    assert.match(source, /data-testid="post-combat-primary-action"/);
});

test('⑤ 선택 전이는 reducer 한 곳에서만 일어난다', async () => {
    const handler = await readFile(new URL('../src/reducers/handlers/combatHandlers.ts', import.meta.url), 'utf8');
    const root = await readFile(new URL('../src/components/app/GameRoot.tsx', import.meta.url), 'utf8');

    assert.match(handler, /RESOLVE_POST_COMBAT_CHOICE/);
    assert.match(handler, /postCombatChoiceResolved === true\) return state/);
    assert.match(handler, /applyPostCombatChoice/);
    assert.match(root, /AT\.RESOLVE_POST_COMBAT_CHOICE/);
});

test('⑤ 밀어붙이기 직후 다음 탐험의 모닥불 분기가 차단된다', async () => {
    const source = await readFile(new URL('../src/hooks/gameActions/exploreActions.ts', import.meta.url), 'utf8');

    assert.match(source, /nextExploreCampfireBlocked/);
    assert.match(source, /if \(!campfireBlocked && mapData\.type === 'dungeon'/);
});
