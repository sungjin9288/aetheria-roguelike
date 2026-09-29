import test from 'node:test';
import assert from 'node:assert/strict';

import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { applyAbyssFloorAdvance } from '../src/hooks/combatActions/combatBossHandlers.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { stripEnemyDecoration } from '../src/utils/enemyIdentity.js';
import { MAPS } from '../src/data/maps.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { AT } from '../src/reducers/actionTypes.js';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 35 — 혼돈의 심연 층 번호는 하나다.
//
// 자연 플레이 드라이버(계승을 미루고 마왕성 너머로 계속 가는 16시드)에서 16/16 재현:
//   ① 첫 돌파가 0 → 2층이었다 — `applyAbyssFloorAdvance`가 `(abyssFloor || 1) + 1`이라 0을 1로 읽었다.
//      2층 전투는 한 번도 일어나지 않고 기록 · 칭호 · 유물 층 보너스가 1층씩 앞서 갔다.
//   ② 일반 적의 표시 층이 실제 층보다 하나 낮았다 — 이름 태그는 `spawnEnemy`의 `abyssFloor || 1`,
//      스케일 · 보스 층 · 적 레벨은 `exploreFlow`의 `abyssFloor + 1`이었다. "[10층 보스]" 다음 적이 "[10층]"이었다.
//   ③ 접두어가 붙은 적은 층 태그가 통째로 사라졌다(`${접두어} ${종}`으로 이름을 다시 썼다).
// 정본: `stats.abyssFloor`는 **돌파한 층 수**이고, 지금 싸우는 층은 `abyssFloor + 1`이다.
// ─────────────────────────────────────────────────────────────────────────────

const ABYSS = CONSTANTS.ABYSS_MAP_NAME;
const clone = (value) => JSON.parse(JSON.stringify(value));
// 심연에 스텝이 있는 체인(`abyss_signal`)은 탐험보다 먼저 발동한다 — 전부 완주한 상태로 둔다.
const ALL_CHAINS_DONE = Object.fromEntries(EVENT_CHAINS.map((chain) => [chain.id, chain.steps.length]));
const floorTag = (name) => {
    const match = /^\[(\d+)층/.exec(String(name));
    return match ? Number(match[1]) : null;
};

const abyssPlayer = (abyssFloor, overrides = {}) => ({
    ...clone(INITIAL_STATE.player),
    name: '심연 잠수부',
    loc: ABYSS,
    level: 70,
    hp: 5000,
    maxHp: 5000,
    eventChainProgress: { ...ALL_CHAINS_DONE },
    ...overrides,
    stats: { ...clone(INITIAL_STATE.player.stats), abyssFloor, abyssRecord: abyssFloor, ...(overrides.stats || {}) },
});

const exploreAbyss = async (player) => {
    const dispatches = [];
    const actions = createExploreActions({
        player,
        gameState: GS.IDLE,
        uid: 'abyss-contract',
        dispatch: (action) => dispatches.push(action),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
        rng: () => 0.5,
    }, { commitExploreOutcome: () => {} });
    await actions.explore();
    const spawned = dispatches.find((action) => action.type === AT.SET_ENEMY);
    assert.ok(spawned, `전제: abyssFloor ${player.stats.abyssFloor}에서 탐험이 전투를 연다`);
    return spawned.payload;
};

test('[첫 돌파] 0층에서 첫 승리는 1층 돌파다(2층이 아니다)', () => {
    const logs = [];
    const after = applyAbyssFloorAdvance(abyssPlayer(0), () => {}, (type, text) => logs.push(String(text)));
    assert.equal(after.stats.abyssFloor, 1);
    assert.equal(after.stats.abyssRecord, 1);
    assert.ok(logs.includes(MSG.ABYSS_DESCEND(1)), '안내도 1층 돌파다');
});

test('[층 번호 하나] 적 이름의 층 태그 = 스케일 층 = 적 레벨 − 50 (일반 층 · 보스 층 모두)', async () => {
    const bossFloors = new Set(BALANCE.ABYSS_BOSS_FLOORS);
    for (const cleared of [0, 1, 4, 9, 10, 24, 49]) {
        const enemy = await exploreAbyss(abyssPlayer(cleared));
        const fighting = cleared + 1;
        assert.equal(floorTag(enemy.name), fighting, `돌파 ${cleared}층: 표시 층 ${enemy.name}`);
        assert.equal(enemy.level, 50 + fighting, `돌파 ${cleared}층: 적 레벨`);
        assert.equal(Boolean(enemy.isBoss), bossFloors.has(fighting), `돌파 ${cleared}층: 보스 층 여부`);
    }
});

test('[보스 다음 층] 10층 보스를 넘으면 다음 적은 11층이다', async () => {
    const afterBoss = applyAbyssFloorAdvance(abyssPlayer(9), () => {}, () => {});
    assert.equal(afterBoss.stats.abyssFloor, 10);
    const next = await exploreAbyss(afterBoss);
    assert.equal(floorTag(next.name), 11);
});

test('[접두어 적] 접두어가 붙어도 층 태그가 남고, 종 판정은 그대로다', () => {
    const map = { ...MAPS[ABYSS], name: ABYSS };
    // 접두어 굴림이 통과하는 작은 값 — 첫 조우 후보 · 접두어 풀 0번이 뽑힌다.
    const { mStats, baseName } = spawnEnemy(map, abyssPlayer(6), [], { addLog: () => {} }, { rng: () => 0.01 });
    assert.ok(mStats, '전제: 적이 만들어진다');
    assert.notEqual(mStats.name.replace(/^\[\d+층\]\s+/, ''), baseName, '전제: 접두어가 붙었다');
    assert.equal(floorTag(mStats.name), 7, `층 태그: ${mStats.name}`);
    assert.equal(stripEnemyDecoration(mStats.name), baseName, '임무 판정은 층 태그와 접두어를 함께 벗긴다');
});

test('[정예 격노] 심연 정예가 격노해도 층 태그가 남는다', () => {
    const map = { ...MAPS[ABYSS], name: ABYSS };
    // 프레스티지 rank 3의 정예 보너스 굴림이 통과하는 작은 값 — 완전 정예 접두어가 붙고 격노 페이즈가 생긴다.
    const player = abyssPlayer(6, { meta: { ...clone(INITIAL_STATE.player.meta), prestigeRank: 3 } });
    const { mStats, baseName } = spawnEnemy(map, player, [], { addLog: () => {} }, { rng: () => 0.01 });
    assert.ok(mStats?.isElite && mStats.phase2, '전제: 정예이고 격노 페이즈가 있다');
    assert.equal(floorTag(mStats.phase2.name), 7, `격노 이름: ${mStats.phase2.name}`);
    assert.ok(mStats.phase2.name.endsWith(baseName));
});
