import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { BALANCE } from '../src/data/constants.js';
import { createSeededRandom } from '../src/systems/combatItemTurn.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { makeItem } from '../src/utils/gameUtils.js';

/**
 * W10-B1 — 전투 턴 authority 계약 매트릭스 (CLAUDE.md §5 "전투 턴을 hook에서 해석 금지",
 * §8-1 "전투 턴 authority").
 *
 * 계약: 플레이어 행동 · 적 반격 · 승패 정산 · 보상이 **한 reducer 전이**에서 끝나고,
 * replay는 `combatTurn`/`expectedTurn`으로 거부되며, RNG는 action의 seed 스트림에서만
 * 나온다(`Math.random` 직접 호출 금지).
 *
 * 이 파일은 그 계약을 (행 × 적 종류)의 매트릭스로 열거한다. 기존 테스트가 이미 닫은 칸은
 * 아래 표에서 참조만 하고 다시 만들지 않는다 — 여기 `test()`로 존재하는 칸이 **새로 추가한**
 * 칸이다.
 *
 * ┌────────────────────────────────────────────────────────────────────────────────────────┐
 * │ 행 (계약)                        │ 기존 커버                                            │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ stale expectedTurn → exact no-op │ tests/combat-item-transaction-authority.test.js       │
 * │                                  │   'combat item action without an expected turn is an  │
 * │                                  │    exact no-op after attack advances the turn'        │
 * │                                  │   'stale combat turn and duplicate item IDs preserve  │
 * │                                  │    state or remove only the selected instance'        │
 * │                                  │ tests/combat-loot-capacity-authority.test.js          │
 * │                                  │   'stale expected turn preserves inventory, pity,     │
 * │                                  │    Codex, logs and RNG-observable state exactly'      │
 * │                                  │ → 소모품 턴 · loot 관점만 커버. **행동 턴의 네 가지    │
 * │                                  │   stale 모양(turn−1 / turn+1 / NaN / 누락)을 적        │
 * │                                  │   종류별로 열거한 칸은 없어 여기서 추가**             │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 같은 action 연속 2회 → 1회 정산  │ tests/combat-action-transaction-authority.test.js      │
 * │                                  │   'attack victory commits rewards and replay          │
 * │                                  │    protection in one reducer transition'  (승리 한정) │
 * │                                  │ tests/combat-item-transaction-authority.test.js       │
 * │                                  │   'combat item turn consumes one item and replay is   │
 * │                                  │    an exact no-op'                        (소모품)    │
 * │                                  │ → **전투가 계속되는(continue) 분기의 연타**는 미커버   │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 같은 seed → deep-equal           │ tests/combat-action-transaction-authority.test.js      │
 * │                                  │   'victory reward logs are deterministic …'           │
 * │                                  │   'skill combat action is deterministic …'            │
 * │                                  │ tests/combat-item-transaction-authority.test.js       │
 * │                                  │   'combat item resolver is deterministic …'           │
 * │                                  │ → systems 전이/승리 정산만. **다른 seed가 실제로      │
 * │                                  │   결과를 바꾸면서도 combatTurn은 정확히 1만 오른다**   │
 * │                                  │   는 짝 명제는 미커버                                 │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 행동 → 소모품 → 행동 턴 시퀀스   │ tests/combat-item-transaction-authority.test.js       │
 * │                                  │   'combat damage remains the expedition minimum after │
 * │                                  │    healing, victory and return' (원정 원장 관점)      │
 * │                                  │ → **각 전이가 자기 expectedTurn만 소비한다**는 계약은  │
 * │                                  │   적 종류별로 미커버                                  │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 승리 정산 1회 · 이후 replay 거부 │ tests/combat-action-transaction-authority.test.js      │
 * │                                  │   'attack victory commits rewards …'                  │
 * │                                  │   'boss victory commits one expedition boss …'        │
 * │                                  │ tests/combat-loot-capacity-authority.test.js          │
 * │                                  │   'skill victory uses capacity settlement once …'     │
 * │                                  │ tests/endgame-settlement.test.js                      │
 * │                                  │   'combat reducer uses permanent shards …'            │
 * │                                  │ → 일반/정예/보스 **세 종류를 같은 단언으로 나란히**    │
 * │                                  │   놓은 칸이 없어 여기서 추가(정예 미커버)             │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 사망 정산 1회 · 유해 1개         │ tests/combat-non-victory-settlement.test.js           │
 * │                                  │   'H2: 전투 행동 사망 정산의 모든 필드'                │
 * │                                  │   'H2: 소모품 턴 사망 정산은 …'                        │
 * │                                  │ tests/combat-action-transaction-authority.test.js      │
 * │                                  │   'failed escape defeat commits death, grave, and run │
 * │                                  │    summary atomically'                                │
 * │                                  │ → **사망 후 replay 거부**와 적 종류별 열거는 미커버     │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 도주 성공 / 실패                 │ tests/combat-non-victory-settlement.test.js           │
 * │                                  │   'H2: 도주 성공 정산의 모든 필드'                     │
 * │                                  │   'H2: 도주 실패는 전투를 계속하고 적을 유지한다'      │
 * │                                  │ → **도주 뒤 replay 거부**와 적 종류별 열거는 미커버     │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ 보스/정예 2페이즈 전환           │ tests/adventure-relic-lifetime.test.js                │
 * │                                  │   'boss phase 변화는 같은 전투로 유지하고 …'          │
 * │                                  │ → 유물 관점. **전환이 한 전이에서 끝나고 replay가      │
 * │                                  │   거부된다**는 턴 계약 관점은 미커버                   │
 * ├────────────────────────────────────────────────────────────────────────────────────────┤
 * │ `Math.random` 미참조             │ **전 테스트 미커버** — tests/*에서 Math.random을 던지게 │
 * │                                  │ 바꾸는 가드는 story-log-identity / bounded-encounter-  │
 * │                                  │ discovery 두 곳뿐이고 전투 reducer는 대상이 아니다.    │
 * │                                  │ 이 파일의 **모든 reducer 호출**은 `withoutGlobalRandom`│
 * │                                  │ 안에서 실행된다 (§8-1 규칙의 가장 강한 형태).          │
 * └────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * 적 종류는 전부 실제 데이터(`DB.MAPS` + `DB.MONSTERS`)에서 `spawnEnemy`로 만든다:
 *   일반 = 얼음 성채(Lv20)의 일반 스폰, 정예 = 같은 지역 eliteOnly 강제 접두어,
 *   보스 = 몰락한 전초기지(Lv18)의 구역 보스(BALANCE.BOSS_PHASE2_THRESHOLD 페이즈 보유).
 * 전투 state는 게임과 같은 action(`SET_PLAYER`/`SET_QUICK_SLOT`/`SET_ENEMY`/`SET_GAME_STATE`)을
 * `gameReducer`에 흘려 만든다 — 손으로 조립한 state 객체를 쓰지 않는다.
 */

const MAP = '얼음 성채';
const BOSS_MAP = '몰락한 전초기지';
const NOW = 1_700_000_000_000;

const noop = () => {};

/** 실제 스폰 경로(exploreUtils.spawnEnemy)로 적을 만든다 — rng는 seed 스트림. */
const spawnFixture = (map, player, options = {}) => spawnEnemy(
    DB.MAPS[map],
    player,
    [],
    { addLog: noop },
    { rng: createSeededRandom(11), ...options },
).mStats;

/** 전투 소모품은 실제 DB 템플릿 + makeItem (rng/now 명시 → 결정론적 id). */
const potion = makeItem(DB.ITEMS.consumables[0], () => 0.5, () => NOW);

const makePlayer = (over = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '리베이아',
    job: '전사',
    level: 20,
    hp: 6_000,
    maxHp: 6_000,
    mp: 120,
    maxMp: 120,
    atk: 40,
    def: 60,
    loc: MAP,
    inv: [potion],
    ...over,
});

/** 게임과 같은 action 순서로 전투 state를 만든다. */
const buildCombatState = (player, enemy) => {
    let state = structuredClone(INITIAL_STATE);
    state = gameReducer(state, { type: AT.SET_PLAYER, payload: player });
    state = gameReducer(state, { type: AT.SET_QUICK_SLOT, payload: { index: 0, item: potion } });
    state = gameReducer(state, { type: AT.SET_ENEMY, payload: enemy });
    state = gameReducer(state, { type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    return state;
};

/**
 * §8-1의 가장 강한 형태 — 이 블록 안에서 `Math.random`은 던진다.
 * 전투 전이가 전역 RNG를 한 번이라도 참조하면 그 자리에서 실패한다.
 * (타이머·벽시계 없음: `now`는 항상 인자로 넘긴다.)
 */
const withoutGlobalRandom = (fn) => {
    const real = Math.random;
    Math.random = () => {
        throw new Error('전투 전이가 Math.random을 참조했다 (§8-1: seed 스트림만 사용)');
    };
    try {
        return fn();
    } finally {
        Math.random = real;
    }
};

const resolveAction = (state, kind, expectedTurn, seed, now) => withoutGlobalRandom(() => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind, expectedTurn, seed, now },
}));

const resolveItem = (state, itemId, expectedTurn, seed, now) => withoutGlobalRandom(() => gameReducer(state, {
    type: AT.USE_COMBAT_ITEM,
    payload: { itemId, expectedTurn, seed, now },
}));

/** payload 자체를 넘겨야 하는 칸(키 누락 등)을 위한 저수준 전이. */
const dispatchRaw = (state, type, payload) => withoutGlobalRandom(
    () => gameReducer(state, { type, payload }),
);

/**
 * 적 종류 3종. 각각 `{ enemy, player }`를 새로 만들어 돌려준다
 * (state를 공유하지 않아야 칸끼리 간섭하지 않는다).
 */
const ENEMY_KINDS = {
    일반: () => ({
        enemy: spawnFixture(MAP, makePlayer()),
        loc: MAP,
    }),
    정예: () => ({
        enemy: spawnFixture(MAP, makePlayer({ challengeModifiers: ['eliteOnly'] })),
        loc: MAP,
    }),
    보스: () => ({
        enemy: spawnFixture(BOSS_MAP, makePlayer({ loc: BOSS_MAP }), { forceAreaBoss: true }),
        loc: BOSS_MAP,
    }),
};

const KIND_NAMES = Object.keys(ENEMY_KINDS);

/** 스폰 fixture가 실제로 의도한 종류인지 — 매트릭스의 전제 조건. */
test('matrix: 적 종류 fixture는 실제 DB 스폰에서 일반/정예/보스 정체성을 갖는다', () => {
    const 일반 = ENEMY_KINDS.일반().enemy;
    const 정예 = ENEMY_KINDS.정예().enemy;
    const 보스 = ENEMY_KINDS.보스().enemy;

    assert.equal(일반.isBoss, false);
    assert.equal(일반.isElite, undefined);
    assert.equal(일반.phase2, undefined, '일반 몬스터에는 페이즈가 없다');

    assert.equal(정예.isElite, true);
    assert.equal(정예.isBoss, false);
    assert.ok(정예.phase2, '정예는 HP 50% 페이즈를 갖는다');
    assert.ok(정예.maxHp > 일반.maxHp);

    assert.equal(보스.isBoss, true);
    assert.ok(보스.phase2, '구역 보스는 phase2 정의를 갖는다');
    assert.equal(보스.phase2.threshold, undefined, 'threshold 미정의 → BALANCE 기본값 사용');
    assert.equal(BALANCE.BOSS_PHASE2_THRESHOLD, 0.5);
});

/** 가드 자체가 무장되어 있는지 — 나머지 칸의 Math.random 단언이 공허하지 않음을 보장한다. */
test('matrix: Math.random 금지 가드 × 하네스 자기검증', () => {
    const sentinel = Math.random;
    assert.throws(() => withoutGlobalRandom(() => Math.random()), /Math\.random/);
    assert.equal(Math.random, sentinel, '가드는 finally에서 원본을 복원한다');

    const { enemy, loc } = ENEMY_KINDS.일반();
    const state = buildCombatState(makePlayer({ loc }), enemy);
    // 실제 전투 전이 — 가드 안에서 통과해야 한다.
    const next = resolveAction(state, 'attack', 0, 20260918, NOW);
    assert.equal(next.combatTurn, 1);
    assert.equal(Math.random, sentinel);
});

KIND_NAMES.forEach((kind) => {
    test(`matrix: stale expectedTurn(turn−1 / turn+1 / NaN / 누락)은 exact no-op × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const start = buildCombatState(makePlayer({ loc }), enemy);

        // 한 턴 진행시켜 turn−1이 실제로 "지난 턴"이 되게 한다.
        const settled = resolveAction(start, 'attack', 0, 20260918, NOW);
        assert.equal(settled.combatTurn, 1);
        assert.equal(settled.gameState, GS.COMBAT, '이 fixture는 한 턴으로 끝나지 않는다');

        const stalePast = resolveAction(settled, 'attack', 0, 991, NOW + 10);
        const staleFuture = resolveAction(settled, 'attack', 2, 992, NOW + 11);
        const staleNaN = resolveAction(settled, 'attack', Number.NaN, 993, NOW + 12);
        const staleMissing = dispatchRaw(settled, AT.RESOLVE_COMBAT_ACTION, {
            kind: 'attack', seed: 994, now: NOW + 13,
        });

        [stalePast, staleFuture, staleNaN, staleMissing].forEach((rejected, index) => {
            assert.equal(rejected, settled, `stale #${index}은 같은 state 객체를 돌려준다`);
            assert.equal(rejected.combatTurn, 1, `stale #${index}은 combatTurn을 올리지 않는다`);
        });
        assert.deepEqual(staleMissing, settled);

        // 소모품 전이도 같은 네 모양에서 거부된다.
        const itemPast = resolveItem(settled, potion.id, 0, 995, NOW + 14);
        const itemFuture = resolveItem(settled, potion.id, 2, 996, NOW + 15);
        const itemNaN = resolveItem(settled, potion.id, Number.NaN, 997, NOW + 16);
        const itemMissing = dispatchRaw(settled, AT.USE_COMBAT_ITEM, {
            itemId: potion.id, seed: 998, now: NOW + 17,
        });
        [itemPast, itemFuture, itemNaN, itemMissing].forEach((rejected, index) => {
            assert.equal(rejected, settled, `소모품 stale #${index}은 같은 state 객체를 돌려준다`);
        });
        assert.equal(settled.player.inv.length, 1, '거부된 소모품 턴은 인벤을 건드리지 않는다');
    });

    test(`matrix: 같은 action 연타 → 두 번째는 no-op × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const start = buildCombatState(makePlayer({ loc }), enemy);
        const action = { kind: 'attack', expectedTurn: 0, seed: 20260919, now: NOW + 20 };

        const first = resolveAction(start, action.kind, action.expectedTurn, action.seed, action.now);
        const second = resolveAction(first, action.kind, action.expectedTurn, action.seed, action.now);

        assert.equal(first.combatTurn, 1);
        assert.equal(second, first, '두 번째 연타는 같은 state 객체다');
        assert.equal(second.combatTurn, 1, '연타로 턴이 두 번 오르지 않는다');
        assert.equal(second.player.hp, first.player.hp, '적 반격이 두 번 들어가지 않는다');
        assert.equal(second.enemy?.hp, first.enemy?.hp, '적 HP가 두 번 깎이지 않는다');
        assert.equal(second.player.exp, first.player.exp);
        assert.equal(second.player.gold, first.player.gold);
        assert.equal(second.logs.length, first.logs.length, '로그가 두 번 붙지 않는다');

        // 소모품 연타도 같다 — 아이템은 정확히 한 개만 사라진다.
        const used = resolveItem(first, potion.id, 1, 20260921, NOW + 21);
        const usedAgain = resolveItem(used, potion.id, 1, 20260921, NOW + 21);
        assert.equal(used.player.inv.length, 0);
        assert.equal(usedAgain, used);
        assert.equal(usedAgain.combatTurn, 2);
    });

    test(`matrix: 같은 seed는 deep-equal · 다른 seed도 combatTurn은 정확히 +1 × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const start = buildCombatState(makePlayer({ loc }), enemy);

        const a = resolveAction(start, 'attack', 0, 4242, NOW + 30);
        const b = resolveAction(start, 'attack', 0, 4242, NOW + 30);
        assert.deepEqual(a, b, '같은 state · seed · now → deep-equal');
        assert.equal(start.combatTurn, 0, '입력 state는 변이되지 않는다');

        const seeds = [1, 7, 23, 101, 8_191, 20_260_918];
        const shapes = new Set();
        seeds.forEach((seed) => {
            const next = resolveAction(start, 'attack', 0, seed, NOW + 30);
            assert.equal(next.combatTurn, 1, `seed ${seed}도 combatTurn을 정확히 1만 올린다`);
            assert.notEqual(next, start);
            shapes.add(JSON.stringify({
                hp: next.player.hp,
                enemyHp: next.enemy?.hp ?? null,
                kind: next.combatReceipt?.kind,
            }));
        });
        assert.ok(shapes.size > 1, 'seed가 실제로 결과를 가른다 (결정론 단언이 공허하지 않다)');

        // 스킬 전이도 같은 계약.
        const s1 = resolveAction(start, 'skill', 0, 777, NOW + 31);
        const s2 = resolveAction(start, 'skill', 0, 777, NOW + 31);
        assert.deepEqual(s1, s2);
        assert.equal(s1.combatTurn, 1);
        assert.ok(s1.player.mp < start.player.mp, '스킬은 MP를 쓴다');
    });

    test(`matrix: 행동 → 소모품 → 행동 시퀀스는 각자의 expectedTurn만 소비한다 × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const start = buildCombatState(makePlayer({ loc }), enemy);
        assert.equal(start.quickSlots[0]?.id, potion.id);

        const t1 = resolveAction(start, 'attack', 0, 31_337, NOW + 40);
        assert.equal(t1.combatTurn, 1);
        assert.equal(t1.gameState, GS.COMBAT);

        // 지난 턴 번호로는 소모품을 쓸 수 없다.
        assert.equal(resolveItem(t1, potion.id, 0, 31_338, NOW + 41), t1);

        const t2 = resolveItem(t1, potion.id, 1, 31_338, NOW + 41);
        assert.equal(t2.combatTurn, 2);
        assert.equal(t2.gameState, GS.COMBAT);
        assert.equal(t2.player.inv.length, 0, '소모품 한 개가 정확히 소비된다');
        assert.equal(t2.quickSlots[0], null, '소비된 소모품의 퀵슬롯이 정리된다');

        // 소모품이 쓴 턴 번호로는 행동을 다시 밀어넣을 수 없다.
        assert.equal(resolveAction(t2, 'attack', 1, 31_339, NOW + 42), t2);

        const t3 = resolveAction(t2, 'attack', 2, 31_339, NOW + 42);
        assert.equal(t3.combatTurn, 3);
        assert.deepEqual(
            [start.combatTurn, t1.combatTurn, t2.combatTurn, t3.combatTurn],
            [0, 1, 2, 3],
            'combatTurn은 전이마다 정확히 1씩 오른다',
        );
    });

    test(`matrix: 승리 정산은 한 번만 일어나고 이후 replay는 거부된다 × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const player = makePlayer({ loc });
        const start = buildCombatState(player, { ...enemy, hp: 1 });

        const won = resolveAction(start, 'attack', 0, 4_242, NOW + 50);

        assert.equal(won.gameState, GS.IDLE, '승리는 전투를 닫는다');
        assert.equal(won.enemy, null);
        assert.equal(won.combatTurn, 1);
        assert.equal(won.combatReceipt?.kind, 'victory');
        assert.equal(won.player.stats.kills, start.player.stats.kills + 1);
        assert.ok(won.player.gold > start.player.gold, '골드 보상이 들어온다');
        assert.ok(won.player.exp > start.player.exp || won.player.level > start.player.level);
        assert.ok(won.postCombatResult, '전투 결과 카드는 승리 전이에서 한 번 만들어진다');

        // 같은 action replay — 전투가 이미 닫혔으므로 exact no-op.
        const replayed = resolveAction(won, 'attack', 0, 4_242, NOW + 50);
        assert.equal(replayed, won);
        // 턴 번호를 "올바르게" 올린 재전송도 마찬가지로 거부된다.
        const replayedNext = resolveAction(won, 'attack', 1, 4_243, NOW + 51);
        assert.equal(replayedNext, won);
        // 승리 뒤 소모품 턴도 열리지 않는다.
        assert.equal(resolveItem(won, potion.id, 1, 4_244, NOW + 52), won);

        assert.equal(replayedNext.player.gold, won.player.gold, '보상이 두 번 지급되지 않는다');
        assert.equal(replayedNext.player.stats.kills, won.player.stats.kills);
        assert.equal(replayedNext.postCombatResult, won.postCombatResult);
    });

    test(`matrix: 사망 정산은 한 번만 일어나고 유해도 한 번만 남는다 × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const player = makePlayer({ loc, hp: 1 });
        const start = buildCombatState(player, { ...enemy, atk: 99_999 });
        assert.equal(start.grave, null);

        const dead = resolveAction(start, 'attack', 0, 31_337, NOW + 60);

        assert.equal(dead.gameState, GS.DEAD);
        assert.equal(dead.enemy, null);
        assert.equal(dead.combatTurn, 1);
        assert.equal(dead.combatReceipt?.kind, 'defeat');
        assert.equal(dead.player.stats.deaths, start.player.stats.deaths + 1);
        assert.equal(dead.grave.length, 1, '유해는 정확히 하나 생긴다');
        assert.equal(dead.grave[0].loc, loc);
        assert.ok(dead.runSummary, '런 요약은 사망 전이에서 만들어진다');

        const replayed = resolveAction(dead, 'attack', 0, 31_337, NOW + 60);
        const replayedNext = resolveAction(dead, 'attack', 1, 31_338, NOW + 61);
        assert.equal(replayed, dead);
        assert.equal(replayedNext, dead);
        assert.equal(replayedNext.grave.length, 1, 'replay가 유해를 하나 더 만들지 않는다');
        assert.equal(replayedNext.player.stats.deaths, dead.player.stats.deaths);
        assert.equal(resolveItem(dead, potion.id, 1, 31_339, NOW + 62), dead);
    });

    test(`matrix: 도주 성공은 전투를 닫고 실패는 턴만 올린다 · 둘 다 replay 거부 × ${kind}`, () => {
        const { enemy, loc } = ENEMY_KINDS[kind]();
        const start = buildCombatState(makePlayer({ loc }), enemy);

        // seed 1 = 도주 성공, seed 7 = 도주 실패 (ESCAPE_CHANCE 분기, seed 스트림 고정값)
        const escaped = resolveAction(start, 'escape', 0, 1, NOW + 70);
        assert.equal(escaped.combatReceipt?.kind, 'escape');
        assert.equal(escaped.gameState, GS.IDLE);
        assert.equal(escaped.enemy, null);
        assert.equal(escaped.combatTurn, 1);
        assert.equal(escaped.player.stats.escapes, start.player.stats.escapes + 1);
        assert.equal(escaped.grave, start.grave, '도주는 유해를 남기지 않는다');
        assert.equal(resolveAction(escaped, 'escape', 0, 1, NOW + 70), escaped);
        assert.equal(resolveAction(escaped, 'escape', 1, 2, NOW + 71), escaped);

        const failed = resolveAction(start, 'escape', 0, 7, NOW + 72);
        assert.equal(failed.combatReceipt?.kind, 'continue', '실패한 도주는 전투를 계속한다');
        assert.equal(failed.gameState, GS.COMBAT);
        assert.ok(failed.enemy, '적은 남는다');
        assert.equal(failed.combatTurn, 1, '실패해도 턴은 정확히 1 오른다 (적이 반격했다)');
        assert.ok(failed.player.hp < start.player.hp, '실패한 도주는 적 반격을 부른다');
        assert.equal(resolveAction(failed, 'escape', 0, 7, NOW + 72), failed);
    });
});

test('matrix: 페이즈 전환은 한 전이에서 끝나고 replay는 거부된다 × 보스', () => {
    const { enemy, loc } = ENEMY_KINDS.보스();
    // BOSS_PHASE2_THRESHOLD(0.5) ± 0.1 지터 하한(0.4) 아래에서 시작 → 전환이 결정론적으로 걸린다.
    const wounded = { ...enemy, hp: Math.floor(enemy.maxHp * 0.35) };
    const start = buildCombatState(makePlayer({ loc }), wounded);
    assert.equal(start.enemy.phase2Triggered, undefined);

    const phased = resolveAction(start, 'attack', 0, 1_234, NOW + 80);

    assert.equal(phased.combatTurn, 1, '페이즈 전환도 한 턴 안에서 끝난다');
    assert.equal(phased.gameState, GS.COMBAT);
    assert.equal(phased.enemy.phase2Triggered, true);
    assert.equal(phased.enemy.name, enemy.phase2.name);
    assert.equal(
        phased.enemy.atk,
        Math.floor(enemy.atk * (1 + enemy.phase2.atkBonus)),
        '2페이즈 공격력 보정은 한 번만 곱해진다',
    );
    assert.ok(phased.enemy.hp / phased.enemy.maxHp <= BALANCE.BOSS_PHASE2_THRESHOLD + 0.1);

    // 같은 action replay는 거부 → 보정이 두 번 곱해지지 않는다.
    assert.equal(resolveAction(phased, 'attack', 0, 1_234, NOW + 80), phased);
    assert.deepEqual(phased, resolveAction(start, 'attack', 0, 1_234, NOW + 80), '전환 전이도 결정론적');

    // 다음 턴에도 전환은 다시 일어나지 않는다.
    const next = resolveAction(phased, 'attack', 1, 1_235, NOW + 81);
    assert.equal(next.combatTurn, 2);
    if (next.enemy) {
        assert.equal(next.enemy.phase2Triggered, true);
        assert.equal(next.enemy.atk, phased.enemy.atk, '2페이즈 보정은 턴마다 재적용되지 않는다');
    }
});

test('matrix: 페이즈 전환은 한 전이에서 끝나고 replay는 거부된다 × 정예', () => {
    const { enemy, loc } = ENEMY_KINDS.정예();
    const wounded = { ...enemy, hp: Math.floor(enemy.maxHp * 0.35) };
    const start = buildCombatState(makePlayer({ loc }), wounded);

    const phased = resolveAction(start, 'attack', 0, 1_234, NOW + 90);

    assert.equal(phased.combatTurn, 1);
    assert.equal(phased.enemy.phase2Triggered, true);
    assert.equal(phased.enemy.name, enemy.phase2.name);
    assert.equal(resolveAction(phased, 'attack', 0, 1_234, NOW + 90), phased);
    assert.deepEqual(phased, resolveAction(start, 'attack', 0, 1_234, NOW + 90));
});

test('matrix: 페이즈가 없는 적은 페이즈 상태를 얻지 않는다 × 일반 (음성 대조군)', () => {
    const { enemy, loc } = ENEMY_KINDS.일반();
    const wounded = { ...enemy, hp: Math.floor(enemy.maxHp * 0.35) };
    const start = buildCombatState(makePlayer({ loc }), wounded);

    const next = resolveAction(start, 'attack', 0, 1_234, NOW + 100);

    assert.equal(next.combatTurn, 1);
    if (next.enemy) {
        assert.equal(next.enemy.phase2Triggered, undefined);
        assert.equal(next.enemy.name, enemy.name, '일반 몬스터는 이름이 바뀌지 않는다');
        assert.equal(next.enemy.atk, enemy.atk);
    }
});

/**
 * TODO(B1 finding): `expectedTurn` 타입 계약이 두 전이에서 다르다.
 *
 *   combatHandlers.RESOLVE_COMBAT_ACTION: `Number(action.payload?.expectedTurn)` + `Number.isFinite`
 *   combatHandlers.USE_COMBAT_ITEM:       `typeof expectedTurn !== 'number'` → 거부
 *
 * 그래서 행동 턴은 **숫자가 아닌 payload**(`null` / `''` / `[]` / `false` / `'0'` — 모두
 * Number() 강제변환이 현재 턴과 같아진다)로도 턴을 claim할 수 있고, 소모품 턴은 전부 거부한다.
 * §8-1이 약속하는 "combatTurn/expectedTurn으로 replay를 거부한다"는 계약 자체는 깨지지 않는다
 * (턴은 여전히 한 번만 오르고 정산도 한 번이다) — 하지만 위조/손상 payload에 대한 두 전이의
 * 방어선이 다르다. 아래는 **현재 동작을 그대로 고정**한 문서화 칸이다. 행동 턴 가드를
 * `typeof === 'number'`로 좁히면 이 테스트의 `acceptedByAction` 기대값을 false로 바꾸면 된다.
 */
test('matrix: expectedTurn 타입 계약 — 행동 턴은 강제변환, 소모품 턴은 엄격 (B1 finding)', () => {
    const { enemy, loc } = ENEMY_KINDS.일반();
    const start = buildCombatState(makePlayer({ loc }), enemy);

    const coercesToZero = [null, '', '0', [], false];
    coercesToZero.forEach((value) => {
        const viaAction = dispatchRaw(start, AT.RESOLVE_COMBAT_ACTION, {
            kind: 'attack', expectedTurn: value, seed: 55, now: NOW + 110,
        });
        const viaItem = dispatchRaw(start, AT.USE_COMBAT_ITEM, {
            itemId: potion.id, expectedTurn: value, seed: 55, now: NOW + 110,
        });

        // 현재 동작: 행동 턴은 받아들이고 (턴은 정확히 1회 소비), 소모품 턴은 거부한다.
        assert.notEqual(viaAction, start, `행동 턴은 ${JSON.stringify(value)}를 현재 동작상 수용한다`);
        assert.equal(viaAction.combatTurn, 1, '수용하더라도 턴은 정확히 한 번만 오른다');
        assert.equal(viaItem, start, `소모품 턴은 ${JSON.stringify(value)}를 거부한다`);
    });

    // 진짜 숫자만 양쪽이 함께 수용한다.
    assert.notEqual(dispatchRaw(start, AT.RESOLVE_COMBAT_ACTION, {
        kind: 'attack', expectedTurn: 0, seed: 55, now: NOW + 111,
    }), start);
    assert.notEqual(dispatchRaw(start, AT.USE_COMBAT_ITEM, {
        itemId: potion.id, expectedTurn: 0, seed: 55, now: NOW + 111,
    }), start);

    // 강제변환이 현재 턴과 다르면 양쪽 모두 거부한다 — replay 방어선 자체는 유지된다.
    [true, '1', [1], 1].forEach((value) => {
        assert.equal(dispatchRaw(start, AT.RESOLVE_COMBAT_ACTION, {
            kind: 'attack', expectedTurn: value, seed: 55, now: NOW + 112,
        }), start, `turn 0에서 ${JSON.stringify(value)}는 거부된다`);
    });
});
