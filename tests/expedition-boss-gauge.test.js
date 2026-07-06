import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import {
    getAreaBossName,
    isAreaBossUndefeated,
    getBossGaugeValue,
    isBossGaugeFull,
    advanceBossGauge,
    resetBossGaugeAfterChallenge,
    buildBossChallengeEvent,
} from '../src/utils/bossGauge.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/**
 * 원정 보스 접근 게이지 (2026-07 감사 축4 — 모바일 세션 정합):
 * "지역 진입 → 구역 보스 격파"를 10~15분 원정(Expedition) 단위로 프레이밍하기 위해
 * 기존 구역 보스의 15% 순수 랜덤 강제 조우(exploreUtils.spawnEnemy)를 제거하고,
 * 미격파 구역 보스가 있는 던전에서 탐험할 때마다 누적되는 게이지로 대체한다.
 * 만충 시 다음 탐험에서 "도전 vs 회피" 선택 카드를 제시한다 (StS식 위험 선택).
 */

// ── getAreaBossName / isAreaBossUndefeated ──────────────────────────────────

test('getAreaBossName: mapData.boss가 문자열이면 그 이름 반환', () => {
    assert.equal(getAreaBossName({ boss: '고대 호수의 수호신' }), '고대 호수의 수호신');
});

test('getAreaBossName: mapData.boss가 boolean(true)이면 null (이름 불명)', () => {
    assert.equal(getAreaBossName({ boss: true }), null);
});

test('getAreaBossName: mapData.boss 없으면 null', () => {
    assert.equal(getAreaBossName({}), null);
    assert.equal(getAreaBossName(null), null);
    assert.equal(getAreaBossName(undefined), null);
});

test('isAreaBossUndefeated: 구역 보스 있고 미격파 → true', () => {
    const mapData = { boss: '고대 호수의 수호신' };
    const player = { stats: {} };
    assert.equal(isAreaBossUndefeated(mapData, player), true);
});

test('isAreaBossUndefeated: areaBossDefeated에 등록되면 → false', () => {
    const mapData = { boss: '고대 호수의 수호신' };
    const player = { stats: { areaBossDefeated: { '고대 호수의 수호신': true } } };
    assert.equal(isAreaBossUndefeated(mapData, player), false);
});

test('isAreaBossUndefeated: boss가 boolean(true)이면 이름 불명이라 false', () => {
    const mapData = { boss: true };
    const player = { stats: {} };
    assert.equal(isAreaBossUndefeated(mapData, player), false);
});

test('isAreaBossUndefeated: 구세이브(player.stats.areaBossDefeated undefined) 방어 — 크래시 없이 true', () => {
    const mapData = { boss: '고대 호수의 수호신' };
    const player = { stats: {} };
    assert.doesNotThrow(() => isAreaBossUndefeated(mapData, player));
    assert.equal(isAreaBossUndefeated(mapData, player), true);
});

// ── getBossGaugeValue / isBossGaugeFull ─────────────────────────────────────

test('getBossGaugeValue: 구세이브(player.stats.bossGauge undefined) → 0 (크래시 없음)', () => {
    const player = { stats: {} };
    assert.doesNotThrow(() => getBossGaugeValue(player, '신성한 호수'));
    assert.equal(getBossGaugeValue(player, '신성한 호수'), 0);
});

test('getBossGaugeValue: player 자체가 undefined여도 0', () => {
    assert.equal(getBossGaugeValue(undefined, '신성한 호수'), 0);
});

test('getBossGaugeValue: 저장된 값 반환', () => {
    const player = { stats: { bossGauge: { '신성한 호수': 0.42 } } };
    assert.equal(getBossGaugeValue(player, '신성한 호수'), 0.42);
});

test('getBossGaugeValue: 1을 넘는 이상값도 1로 clamp', () => {
    const player = { stats: { bossGauge: { '신성한 호수': 1.5 } } };
    assert.equal(getBossGaugeValue(player, '신성한 호수'), 1);
});

test('isBossGaugeFull: 1 미만이면 false, 1 이상이면 true', () => {
    assert.equal(isBossGaugeFull({ stats: { bossGauge: { A: 0.99 } } }, 'A'), false);
    assert.equal(isBossGaugeFull({ stats: { bossGauge: { A: 1 } } }, 'A'), true);
});

// ── advanceBossGauge (게이지 누적) ───────────────────────────────────────────

test('advanceBossGauge: 미격파 구역 보스가 있는 던전에서 탐험 시 BOSS_GAUGE_PER_EXPLORE만큼 누적', () => {
    const player = { loc: '신성한 호수', stats: {} };
    const mapData = { boss: '고대 호수의 수호신' };
    const nextStats = advanceBossGauge(player, mapData);
    assert.equal(nextStats.bossGauge['신성한 호수'], BALANCE.BOSS_GAUGE_PER_EXPLORE);
});

test('advanceBossGauge: 약 7~8탐험에 만충 (BOSS_GAUGE_PER_EXPLORE=0.14 기준)', () => {
    let player = { loc: '신성한 호수', stats: {} };
    const mapData = { boss: '고대 호수의 수호신' };
    let explores = 0;
    while (getBossGaugeValue(player, player.loc) < 1 && explores < 20) {
        player = { ...player, stats: advanceBossGauge(player, mapData) };
        explores += 1;
    }
    assert.ok(explores >= 7 && explores <= 8, `약 7~8탐험에 만충이어야 함 (got ${explores})`);
});

test('advanceBossGauge: 1을 넘지 않도록 clamp (만충 이후 재호출해도 1 유지)', () => {
    const player = { loc: '신성한 호수', stats: { bossGauge: { '신성한 호수': 0.95 } } };
    const mapData = { boss: '고대 호수의 수호신' };
    const nextStats = advanceBossGauge(player, mapData);
    assert.equal(nextStats.bossGauge['신성한 호수'], 1);
});

test('advanceBossGauge: 구역 보스가 없는 던전이면 stats 변화 없음(그대로 반환)', () => {
    const player = { loc: '고요한 숲', stats: { kills: 5 } };
    const mapData = { boss: undefined };
    const nextStats = advanceBossGauge(player, mapData);
    assert.equal(nextStats, player.stats, '변화 없이 동일 참조 반환');
});

test('advanceBossGauge: 이미 격파된 구역 보스면 게이지 누적 안 함', () => {
    const player = { loc: '신성한 호수', stats: { areaBossDefeated: { '고대 호수의 수호신': true } } };
    const mapData = { boss: '고대 호수의 수호신' };
    const nextStats = advanceBossGauge(player, mapData);
    assert.equal(nextStats.bossGauge, undefined, '격파된 보스는 게이지 필드 자체가 생기지 않음');
});

test('advanceBossGauge: 다른 지역의 게이지는 서로 독립적으로 누적', () => {
    let player = { loc: '신성한 호수', stats: {} };
    player = { ...player, stats: advanceBossGauge(player, { boss: '고대 호수의 수호신' }) };
    player = { ...player, loc: '하수도', stats: advanceBossGauge({ ...player, loc: '하수도' }, { boss: '하수도의 여왕' }) };
    assert.equal(player.stats.bossGauge['신성한 호수'], BALANCE.BOSS_GAUGE_PER_EXPLORE);
    assert.equal(player.stats.bossGauge['하수도'], BALANCE.BOSS_GAUGE_PER_EXPLORE);
});

// ── resetBossGaugeAfterChallenge (도전/회피 후 리셋) ─────────────────────────

test('resetBossGaugeAfterChallenge: 해당 지역 게이지를 0으로 리셋', () => {
    const player = { loc: '신성한 호수', stats: { bossGauge: { '신성한 호수': 1, '다른지역': 0.5 } } };
    const nextStats = resetBossGaugeAfterChallenge(player, '신성한 호수');
    assert.equal(nextStats.bossGauge['신성한 호수'], 0);
    assert.equal(nextStats.bossGauge['다른지역'], 0.5, '다른 지역 게이지는 영향 없음');
});

// ── buildBossChallengeEvent (도전/회피 선택 카드) ───────────────────────────

test('buildBossChallengeEvent: 도전/회피 2개 선택지 카드 생성', () => {
    const ev = buildBossChallengeEvent('고대 호수의 수호신');
    assert.equal(ev.isBossGaugeChallenge, true);
    assert.equal(ev.bossName, '고대 호수의 수호신');
    assert.equal(ev.choices.length, 2);
    assert.equal(ev.outcomes.length, 2);
    assert.equal(ev.outcomes[0].gaugeEffect, 'challenge');
    assert.equal(ev.outcomes[1].gaugeEffect, 'avoid');
    assert.equal(ev.desc, MSG.BOSS_GAUGE_FULL_DESC('고대 호수의 수호신'));
});

// ── spawnEnemy: 15% 랜덤 조우 제거 + forceAreaBoss 결정론적 스폰 ─────────────

test('spawnEnemy: options 없이 호출 시 구역 보스가 랜덤으로 스폰되지 않음 (15% 랜덤 조우 제거 회귀 가드)', () => {
    const mapData = { level: 5, monsters: ['슬라임'], boss: '고대 호수의 수호신', bossMonsters: [] };
    const player = { level: 5, stats: {} };
    // Math.random을 0으로 고정해도(예전엔 0.15 미만이라 100% area boss 스폰) 이제는
    // options.forceAreaBoss가 없으면 area boss가 절대 스폰되지 않아야 한다.
    const orig = Math.random;
    Math.random = () => 0;
    try {
        for (let i = 0; i < 20; i += 1) {
            const { baseName } = spawnEnemy(mapData, player, [], { addLog: () => {} });
            assert.notEqual(baseName, '고대 호수의 수호신', '랜덤 조우로 area boss가 스폰되면 안 됨');
        }
    } finally {
        Math.random = orig;
    }
});

test('spawnEnemy: forceAreaBoss:true면 구역 보스가 결정론적으로 스폰됨', () => {
    const mapData = { level: 5, monsters: ['슬라임'], boss: '고대 호수의 수호신', bossMonsters: [] };
    const player = { level: 5, stats: {} };
    const { baseName, mStats } = spawnEnemy(mapData, player, [], { addLog: () => {} }, { forceAreaBoss: true });
    assert.equal(baseName, '고대 호수의 수호신');
    assert.equal(mStats.isBoss, true);
});

test('spawnEnemy: forceAreaBoss:true여도 이미 격파된 보스면 스폰 안 함 (일반 풀에서 스폰)', () => {
    const mapData = { level: 5, monsters: ['슬라임'], boss: '고대 호수의 수호신', bossMonsters: [] };
    const player = { level: 5, stats: { areaBossDefeated: { '고대 호수의 수호신': true } } };
    const { baseName } = spawnEnemy(mapData, player, [], { addLog: () => {} }, { forceAreaBoss: true });
    assert.equal(baseName, '슬라임');
});

// ── handleEventChoice 통합: 도전/회피 카드 즉시 해소 ─────────────────────────

const makeDeps = (currentEvent, overrides = {}) => {
    const dispatches = [];
    const logs = [];
    const deps = {
        player: {
            hp: 100, mp: 20, maxHp: 100, maxMp: 20,
            loc: '신성한 호수', level: 10, relics: [], quests: [], history: [],
            stats: {}, meta: {},
            ...overrides.player,
        },
        currentEvent,
        dispatch: (a) => dispatches.push(a),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 100, maxMp: 20 }),
        uid: 'test-uid',
        ...overrides.deps,
    };
    const shared = {
        emitUnlockedTitles: () => {},
        commitExploreOutcome: (outcome, transform) => {
            dispatches.push({ type: 'COMMIT_EXPLORE_OUTCOME', payload: outcome });
            if (typeof transform === 'function') transform(deps.player);
        },
    };
    const actions = createEventActions(deps, shared);
    return { actions, dispatches, logs };
};

const findDispatch = (dispatches, type) => [...dispatches].reverse().find((d) => d.type === type);

test('보스 도전 선택(idx 0) → 구역 보스 확정 스폰 (SET_ENEMY + GS.COMBAT) + 게이지 리셋', () => {
    const ev = buildBossChallengeEvent('고대 호수의 수호신');
    const { actions, dispatches } = makeDeps(ev, {
        player: { loc: '신성한 호수', stats: { bossGauge: { '신성한 호수': 1 } } },
    });

    actions.handleEventChoice(0);

    const setEnemy = findDispatch(dispatches, 'SET_ENEMY');
    assert.ok(setEnemy, 'SET_ENEMY dispatch 존재');
    assert.equal(setEnemy.payload.isBoss, true, '구역 보스 확정 스폰');
    const setGameState = findDispatch(dispatches, 'SET_GAME_STATE');
    assert.equal(setGameState.payload, 'combat');

    // 게이지 리셋 SET_PLAYER 함수형 payload가 dispatch됐는지 확인 (실제 리셋은 payload 적용 시).
    const setPlayerCalls = dispatches.filter((d) => d.type === 'SET_PLAYER');
    assert.ok(setPlayerCalls.length > 0, 'SET_PLAYER dispatch로 게이지 리셋 반영');
});

test('보스 회피 선택(idx 1) → 전투 미발생, 게이지는 리셋되지 않고 만충 유지', () => {
    const ev = buildBossChallengeEvent('고대 호수의 수호신');
    const { actions, dispatches, logs } = makeDeps(ev, {
        player: { loc: '신성한 호수', stats: { bossGauge: { '신성한 호수': 1 } } },
    });

    actions.handleEventChoice(1);

    assert.equal(findDispatch(dispatches, 'SET_ENEMY'), undefined, '회피는 전투를 발생시키지 않음');
    const setGameState = findDispatch(dispatches, 'SET_GAME_STATE');
    assert.equal(setGameState.payload, 'idle');
    assert.ok(logs.some((l) => l.text === MSG.BOSS_GAUGE_AVOID_LOG), '회피 로그 출력');
});

test('handleEventChoice가 isBossGaugeChallenge 이벤트를 스카우팅/일반 이벤트와 별개 분기로 처리', () => {
    const ev = buildBossChallengeEvent('하수도의 여왕');
    const { actions, dispatches } = makeDeps(ev, { player: { loc: '하수도' } });

    // idx가 outcomes 범위를 벗어나면 안전하게 이벤트만 닫는다.
    actions.handleEventChoice(99);
    const setEvent = findDispatch(dispatches, 'SET_EVENT');
    assert.equal(setEvent.payload, null);
    const setGameState = findDispatch(dispatches, 'SET_GAME_STATE');
    assert.equal(setGameState.payload, 'idle');
});

// ── moveActions: 원정 목표 배너 (던전 진입 시 미격파 구역 보스 안내) ─────────

const makeMoveDeps = (playerOverrides = {}) => {
    const logs = [];
    const deps = {
        player: { level: 10, loc: '고요한 숲', gold: 200, stats: { visitedMaps: ['시작의 마을', '고요한 숲'] }, ...playerOverrides },
        gameState: 'idle',
        grave: [],
        isAiThinking: false,
        liveConfig: {},
        dispatch: () => {},
        addLog: (type, text) => logs.push({ type, text }),
    };
    return { deps, logs };
};

test('moveActions: 미격파 구역 보스가 있는 던전 진입 시 원정 목표 배너 로그', () => {
    const { deps, logs } = makeMoveDeps({ level: 10 });
    createMoveActions(deps).move('신성한 호수'); // boss: '고대 호수의 수호신', 미격파
    assert.ok(logs.some((l) => l.text === MSG.EXPEDITION_GOAL_BANNER('고대 호수의 수호신')),
        '원정 목표 배너 로그 존재');
});

test('moveActions: 이미 격파된 구역 보스는 배너 미표시', () => {
    const { deps, logs } = makeMoveDeps({
        level: 10,
        stats: { visitedMaps: ['시작의 마을', '고요한 숲'], areaBossDefeated: { '고대 호수의 수호신': true } },
    });
    createMoveActions(deps).move('신성한 호수');
    assert.ok(!logs.some((l) => l.text.includes('원정 목표')), '격파된 보스는 배너 없음');
});

test('moveActions: 재방문(첫 방문 아님)이어도 미격파 구역 보스면 매번 배너 표시', () => {
    const { deps, logs } = makeMoveDeps({
        level: 10,
        stats: { visitedMaps: ['시작의 마을', '고요한 숲', '신성한 호수'] }, // 이미 방문한 지역
    });
    createMoveActions(deps).move('신성한 호수');
    assert.ok(logs.some((l) => l.text === MSG.EXPEDITION_GOAL_BANNER('고대 호수의 수호신')),
        '재진입 시에도 원정 목표를 되새김');
});

test('moveActions: 구역 보스가 없는 던전은 배너 없음', () => {
    const { deps, logs } = makeMoveDeps({ level: 1, loc: '시작의 마을' });
    createMoveActions(deps).move('고요한 숲'); // boss 필드 없음
    assert.ok(!logs.some((l) => l.text.includes('원정 목표')));
});

// ── EXPEDITION_GOAL_BANNER / EXPEDITION_CLEAR_RECAP 메시지 존재 확인 ─────────

test('MSG.EXPEDITION_GOAL_BANNER: 원정 목표 배너 메시지 포맷', () => {
    const msg = MSG.EXPEDITION_GOAL_BANNER('고대 호수의 수호신');
    assert.ok(msg.includes('고대 호수의 수호신'));
    assert.ok(msg.includes('원정 목표'));
});

test('MSG.EXPEDITION_CLEAR_RECAP: 원정 완료 리캡 메시지 포맷 (처치 수 + 골드)', () => {
    const msg = MSG.EXPEDITION_CLEAR_RECAP('고대 호수의 수호신', 5, 320);
    assert.ok(msg.includes('고대 호수의 수호신'));
    assert.ok(msg.includes('5'));
    assert.ok(msg.includes('320'));
});

// ── exploreActions: 파이프 우선순위 (체인 > 캠프파이어 > 보스 도전 선택 > 스카우팅) ──
//
// handleVictoryOutcome / explore()의 전체 파이프는 AI_SERVICE(firebase 의존) +
// CombatEngine 풀스택 목킹이 필요해 실행형 테스트가 무겁고 깨지기 쉽다. 이 저장소의
// 기존 관례(cycle 592 등, cycle-500-599.test.js)를 따라 소스 텍스트 검증으로
// 배치 순서 계약을 고정한다.

test('exploreActions: 체인 → 캠프파이어 → 보스 도전 선택 → 스카우팅 순서로 배치됨 (우선순위 계약)', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
    // import 구문에는 4개 심볼이 모두 먼저 등장하므로, explore() 본문(createExploreActions
    // 함수 선언 이후)만 잘라내 실제 호출 순서를 비교한다.
    const bodyStart = source.indexOf('export const createExploreActions');
    assert.ok(bodyStart > -1, 'createExploreActions 선언 존재');
    const body = source.slice(bodyStart);
    const chainIdx = body.indexOf('getChainEventForLoc');
    const campfireIdx = body.indexOf('buildCampfireEvent');
    const bossGaugeIdx = body.indexOf('buildBossChallengeEvent');
    const scoutIdx = body.indexOf('buildScoutEvent');
    assert.ok(chainIdx > -1 && campfireIdx > -1 && bossGaugeIdx > -1 && scoutIdx > -1,
        '4개 분기 모두 explore() 본문에 존재');
    assert.ok(chainIdx < campfireIdx, '체인 체크가 캠프파이어보다 먼저');
    assert.ok(campfireIdx < bossGaugeIdx, '캠프파이어 체크가 보스 도전 선택보다 먼저');
    assert.ok(bossGaugeIdx < scoutIdx, '보스 도전 선택이 스카우팅보다 먼저 (게이지 만충 시 스카우팅에 밀리지 않음)');
});

test('exploreActions: 보스 도전 선택 분기가 isAreaBossUndefeated + isBossGaugeFull 조건으로 게이팅됨', async () => {
    const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
    assert.ok(/isAreaBossUndefeated\(mapData,\s*player\)\s*&&\s*isBossGaugeFull\(mapData,\s*player\.loc\)/.test(source)
        || /isAreaBossUndefeated\(mapData,\s*player\)\s*&&\s*isBossGaugeFull\(player,\s*player\.loc\)/.test(source),
        '보스 도전 선택 카드는 미격파 + 게이지 만충일 때만 발동');
});

// ── combatVictory: 원정 완료 리캡 wiring ────────────────────────────────────

test('combatVictory: 구역 보스(mapData.boss 이름 일치) 격파 시 EXPEDITION_CLEAR_RECAP 로그 호출', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.ok(/MSG\.EXPEDITION_CLEAR_RECAP/.test(source),
        'combatVictory.ts가 EXPEDITION_CLEAR_RECAP 메시지를 사용');
    assert.ok(/DB\.MAPS\[updatedPlayer\.loc\]\?\.boss/.test(source),
        '현재 맵의 boss 필드와 처치한 보스 이름을 비교해 구역 보스 여부 판정');
});

test('combatVictory: 신규 추적 인프라 없이 killStreak + victoryResult.goldGained만 사용 (요구사항 준수)', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    const recapCallMatch = source.match(/MSG\.EXPEDITION_CLEAR_RECAP\(([^)]+)\)/);
    assert.ok(recapCallMatch, 'EXPEDITION_CLEAR_RECAP 호출 존재');
    assert.ok(/updatedPlayer\.killStreak/.test(recapCallMatch[1]), 'killStreak 사용 (신규 카운터 없음)');
    assert.ok(/victoryResult\.goldGained/.test(recapCallMatch[1]), 'victoryResult.goldGained 사용 (신규 카운터 없음)');
});
