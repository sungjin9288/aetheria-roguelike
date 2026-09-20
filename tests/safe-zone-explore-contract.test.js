import test from 'node:test';
import assert from 'node:assert/strict';

import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { spawnEnemy, selectEncounterMonster } from '../src/utils/exploreUtils.js';
import { getTownActionPresentation } from '../src/utils/townActionPresentation.js';
import { canInvestigateTown } from '../src/utils/townInvestigation.js';
import { MAPS } from '../src/data/maps.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { DB } from '../src/data/db.js';
import { MSG } from '../src/data/messages.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { AT } from '../src/reducers/actionTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 16 — 안전지대 탐험 계약.
//
// 발견: 평화 가드가 `player.loc === CONSTANTS.START_LOCATION`이라는 **하드코딩된 한
//   지역**이었다. safe 맵 6곳 중 시작의 마을만 막히고 나머지 4곳(전부 `monsters: []`)은
//   터미널 `탐색`으로 뚫렸는데, `selectEncounterMonster`가 빈 풀에서
//   `pool[Math.floor(rng() * 0)]` = `undefined`를 돌려주고 `spawnEnemy`가 그걸 이름으로
//   삼아 **실제 HP/ATK를 가진 적**을 만들었다(허공의 섬에서 HP 1,357 / ATK 175).
//   로그는 `'undefined 등장!'`이었고, 플레이어는 존재하지 않는 몬스터에게 죽을 수 있었다.
//
// 계약은 세 겹이고 각각 독립적으로 깨질 수 있어 따로 고정한다.
// ─────────────────────────────────────────────────────────────────────────────

const clone = (value) => JSON.parse(JSON.stringify(value));

const MONSTERLESS_SAFE_MAPS = Object.entries(MAPS)
    .filter(([, map]) => map.type === 'safe' && (map.monsters || []).length === 0)
    .map(([name]) => name);

const makePlayer = (loc, overrides = {}) => ({
    ...clone(INITIAL_STATE.player),
    loc,
    level: 40,
    hp: 500,
    maxHp: 500,
    eventChainProgress: {},
    ...overrides,
});

const runExplore = async (player) => {
    const dispatches = [];
    const logs = [];
    const actions = createExploreActions({
        player,
        gameState: GS.IDLE,
        uid: 'contract-user',
        dispatch: (action) => dispatches.push(action),
        addLog: (type, text) => logs.push({ type, text: String(text) }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
        rng: () => 0.5,
    }, { commitExploreOutcome: () => {} });
    await actions.explore();
    return { dispatches, logs };
};

// ── H1. 빈 몬스터 테이블에서는 적이 만들어지지 않는다 ────────────────────────

test('selectEncounterMonster는 빈 풀에서 null이다 (undefined가 아니다)', () => {
    const map = MAPS['북부 요새'];
    assert.equal(selectEncounterMonster([], map, makePlayer('북부 요새'), () => 0.5), null);
});

test('spawnEnemy는 빈 몬스터 테이블에서 mStats/baseName 모두 null이다', () => {
    for (const name of MONSTERLESS_SAFE_MAPS) {
        const spawned = spawnEnemy(
            { ...MAPS[name], name },
            makePlayer(name),
            [],
            { addLog: () => {} },
            { rng: () => 0.5 },
        );
        assert.equal(spawned.mStats, null, `${name}: mStats가 null이어야 한다`);
        assert.equal(spawned.baseName, null, `${name}: baseName이 null이어야 한다`);
    }
});

test('사냥감이 있는 지역은 그대로 스폰한다 — 수정이 조우 자체를 끄지 않았다', () => {
    const spawned = spawnEnemy(
        { ...MAPS['어둠의 동굴'], name: '어둠의 동굴' },
        makePlayer('어둠의 동굴'),
        [],
        { addLog: () => {} },
        { rng: () => 0.5 },
    );
    assert.ok(spawned.mStats, '일반 던전에서는 적이 나와야 한다');
    assert.equal(typeof spawned.mStats.name, 'string');
    assert.ok(spawned.mStats.name.length > 0);
});

// ── H2. 평화 가드는 지역 이름이 아니라 지역 종류로 판정한다 ──────────────────

test(`몬스터 없는 safe 지역 ${MONSTERLESS_SAFE_MAPS.length}곳은 전부 평화롭다 (전투 0건)`, async () => {
    assert.ok(MONSTERLESS_SAFE_MAPS.length >= 5, '전제: 몬스터 없는 safe 지역이 여럿이다');
    for (const name of MONSTERLESS_SAFE_MAPS) {
        const { dispatches, logs } = await runExplore(makePlayer(name));
        assert.equal(
            dispatches.some((action) => action.type === AT.SET_ENEMY), false,
            `${name}: 적이 스폰되면 안 된다`,
        );
        assert.deepEqual(
            logs.map((entry) => entry.text), [MSG.TOWN_PEACEFUL],
            `${name}: 평화 로그 하나만 남아야 한다`,
        );
    }
});

test('황금 왕국은 설계된 조사 지역이라 그대로 조우한다 — 가드가 과잉 적용되지 않았다', async () => {
    assert.equal(canInvestigateTown('황금 왕국', MAPS['황금 왕국']), true);
    const { dispatches } = await runExplore(makePlayer('황금 왕국'));
    const enemy = dispatches.find((action) => action.type === AT.SET_ENEMY);
    assert.ok(enemy, '황금 왕국에서는 적이 나와야 한다');
    assert.equal(typeof enemy.payload.name, 'string');
    assert.ok(enemy.payload.name.length > 0, '이름 없는 적이면 안 된다');
});

test('대기 중인 체인 스텝은 safe 지역에서도 발동한다 — 가드가 이야기를 막지 않는다', async () => {
    const { dispatches, logs } = await runExplore(
        makePlayer('북부 요새', { eventChainProgress: { machine_uprising: 2 } }),
    );
    const eventAction = dispatches.find((action) => action.type === AT.SET_EVENT);
    assert.ok(eventAction, '체인 이벤트가 떠야 한다');
    assert.equal(eventAction.payload._chainId, 'machine_uprising');
    assert.equal(eventAction.payload._chainStep, 2);
    assert.equal(
        logs.some((entry) => entry.text === MSG.TOWN_PEACEFUL), false,
        '체인이 뜬 턴에는 평화 로그가 남으면 안 된다',
    );
});

// ── H3. safe 지역의 대기 체인 스텝은 UI에 드러난다 ───────────────────────────

const townPresentationFor = (player) => getTownActionPresentation({
    player,
    mapData: MAPS[player.loc],
    stats: { maxHp: player.maxHp, maxMp: player.maxMp },
    guidance: { primaryAction: null },
    preparation: null,
    hasGrave: false,
    classes: DB.CLASSES,
    recipes: DB.ITEMS.recipes || [],
    consumables: DB.ITEMS.consumables || [],
});

test('safe 지역에 대기 체인 스텝이 있으면 explore가 마을 행동으로 노출된다', () => {
    const pending = townPresentationFor(
        makePlayer('북부 요새', { eventChainProgress: { machine_uprising: 2 } }),
    );
    assert.equal(pending.exploreIntent, 'chain');
    assert.ok(pending.quickKeys.includes('explore'), '버튼이 있어야 터미널 타이핑 없이 진행된다');

    const idle = townPresentationFor(makePlayer('북부 요새'));
    assert.equal(idle.exploreIntent, null);
    assert.equal(idle.quickKeys.includes('explore'), false, '대기 스텝이 없으면 노출하지 않는다');
});

test('황금 왕국의 explore 의도는 조사이지 체인이 아니다', () => {
    const presentation = townPresentationFor(makePlayer('황금 왕국'));
    assert.equal(presentation.exploreIntent, 'investigate');
    assert.ok(presentation.quickKeys.includes('explore'));
});

test('safe 지역에 놓인 체인 스텝 전부가 이 경로로 보인다', () => {
    const onSafeMaps = [];
    for (const chain of EVENT_CHAINS) {
        for (const step of chain.steps) {
            if (MAPS[step.loc]?.type === 'safe') onSafeMaps.push({ chain: chain.id, step: step.step, loc: step.loc });
        }
    }
    assert.ok(onSafeMaps.length > 0, '전제: safe 지역에 체인 스텝이 존재한다');
    for (const entry of onSafeMaps) {
        const presentation = townPresentationFor(
            makePlayer(entry.loc, { eventChainProgress: { [entry.chain]: entry.step } }),
        );
        assert.ok(
            presentation.quickKeys.includes('explore'),
            `${entry.chain}:${entry.step} @ ${entry.loc} 가 UI에 안 보인다`,
        );
    }
});
