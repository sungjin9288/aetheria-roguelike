import test from 'node:test';
import assert from 'node:assert/strict';

import { getMirrorEffects, purchaseMirrorNode } from '../src/systems/mirrorUpgrades.js';
import { MIRROR_NODES } from '../src/data/mirror.js';
import { BALANCE } from '../src/data/constants.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * 2026-07 감사 — 장르 갭 (a): 에테르 거울 (에센스 소비 영구 업그레이드 트리).
 *
 * 에센스(meta.essence)는 획득처 3곳(승천 +200 / 일일 프로토콜 / rank1·8 배율)이
 * 있었지만 소비처가 0건이던 죽은 통화였다. Hades의 "거울"(통화를 모아 선택적으로
 * 영구 투자)을 이식 — "한 판 더"의 명분을 만든다.
 */

// ── ① getMirrorEffects 기본값 (빈 mirror / 구세이브) ───────────────────────
test('① getMirrorEffects: mirror 없음(undefined) → 전부 무효과', () => {
    const eff = getMirrorEffects({});
    assert.equal(eff.startGoldBonus, 0);
    assert.equal(eff.startBootChoiceBonus, 0);
    assert.equal(eff.campfireChanceBonus, 0);
    assert.equal(eff.relicPityBonus, 0);
    assert.equal(eff.restCostMult, 1);
    assert.equal(eff.reviveEnabled, false);
    assert.equal(eff.essenceFlowMult, 1);
});

test('① getMirrorEffects: meta 자체가 null/undefined여도 안전 (방어적 기본값)', () => {
    const effNull = getMirrorEffects(null);
    const effUndef = getMirrorEffects(undefined);
    assert.equal(effNull.essenceFlowMult, 1);
    assert.equal(effUndef.restCostMult, 1);
});

test('① getMirrorEffects: mirror = {} (빈 객체) → 전부 무효과', () => {
    const eff = getMirrorEffects({ mirror: {} });
    assert.equal(eff.startGoldBonus, 0);
    assert.equal(eff.reviveEnabled, false);
});

// ── ② 노드별 효과 계산 ──────────────────────────────────────────────────────
test('② start_gold Lv1/Lv2/Lv3 → 시작 골드 +100/+200/+300', () => {
    assert.equal(getMirrorEffects({ mirror: { start_gold: 1 } }).startGoldBonus, 100);
    assert.equal(getMirrorEffects({ mirror: { start_gold: 2 } }).startGoldBonus, 200);
    assert.equal(getMirrorEffects({ mirror: { start_gold: 3 } }).startGoldBonus, 300);
});

test('② start_boot_extra Lv1 → 시작 부트 선택지 +1 (최대레벨 1)', () => {
    assert.equal(getMirrorEffects({ mirror: { start_boot_extra: 1 } }).startBootChoiceBonus, 1);
    assert.equal(getMirrorEffects({ mirror: { start_boot_extra: 0 } }).startBootChoiceBonus, 0);
});

test('② campfire_rate Lv1/Lv2 → 캠프파이어 확률 +2%p/+4%p', () => {
    assert.ok(Math.abs(getMirrorEffects({ mirror: { campfire_rate: 1 } }).campfireChanceBonus - 0.02) < 1e-9);
    assert.ok(Math.abs(getMirrorEffects({ mirror: { campfire_rate: 2 } }).campfireChanceBonus - 0.04) < 1e-9);
});

test('② relic_pity Lv1/Lv2 → pity 누적 +25%/+50%', () => {
    assert.ok(Math.abs(getMirrorEffects({ mirror: { relic_pity: 1 } }).relicPityBonus - 0.25) < 1e-9);
    assert.ok(Math.abs(getMirrorEffects({ mirror: { relic_pity: 2 } }).relicPityBonus - 0.50) < 1e-9);
});

test('② rest_discount Lv1/Lv2 → 휴식 비용 배율 0.8/0.6', () => {
    assert.ok(Math.abs(getMirrorEffects({ mirror: { rest_discount: 1 } }).restCostMult - 0.8) < 1e-9);
    assert.ok(Math.abs(getMirrorEffects({ mirror: { rest_discount: 2 } }).restCostMult - 0.6) < 1e-9);
});

test('② revive Lv1 → reviveEnabled true, HP 30% 부활 비율', () => {
    const eff = getMirrorEffects({ mirror: { revive: 1 } });
    assert.equal(eff.reviveEnabled, true);
    assert.ok(Math.abs(eff.reviveHpRatio - 0.30) < 1e-9);
});

test('② essence_flow Lv1/Lv2 → 에센스 획득 배율 1.10/1.20', () => {
    assert.ok(Math.abs(getMirrorEffects({ mirror: { essence_flow: 1 } }).essenceFlowMult - 1.10) < 1e-9);
    assert.ok(Math.abs(getMirrorEffects({ mirror: { essence_flow: 2 } }).essenceFlowMult - 1.20) < 1e-9);
});

test('② 레벨이 maxLevel을 초과한 corrupt 데이터도 캡 (방어적)', () => {
    const eff = getMirrorEffects({ mirror: { start_gold: 99, revive: 5 } });
    assert.equal(eff.startGoldBonus, 300, 'start_gold는 maxLevel 3에서 캡');
    assert.equal(eff.reviveEnabled, true);
});

test('② 존재하지 않는 노드 id는 무시', () => {
    const eff = getMirrorEffects({ mirror: { nonexistent_node: 5 } });
    assert.equal(eff.startGoldBonus, 0);
});

// ── ③ purchaseMirrorNode 순수 함수 (구매 로직) ──────────────────────────────
test('③ purchaseMirrorNode: 에센스 충분 → 레벨 +1, 비용 반환', () => {
    const node = MIRROR_NODES.find((n) => n.id === 'start_gold');
    const result = purchaseMirrorNode({}, 'start_gold', 1000);
    assert.equal(result.success, true);
    assert.equal(result.newLevel, 1);
    assert.equal(result.cost, node.costs[0]);
    assert.equal(result.mirror.start_gold, 1);
});

test('③ purchaseMirrorNode: 에센스 부족 → no-op (success false, mirror 불변)', () => {
    const before = { start_gold: 1 };
    const result = purchaseMirrorNode(before, 'start_gold', 1);
    assert.equal(result.success, false);
    assert.equal(result.mirror, before, '변경 없이 원본 참조 그대로 반환');
    assert.equal(result.newLevel, 1);
});

test('③ purchaseMirrorNode: 최대레벨 도달 → no-op (추가 구매 불가)', () => {
    const maxed = { start_boot_extra: 1 }; // maxLevel 1
    const result = purchaseMirrorNode(maxed, 'start_boot_extra', 99999);
    assert.equal(result.success, false);
    assert.equal(result.newLevel, 1);
});

test('③ purchaseMirrorNode: 존재하지 않는 노드 id → no-op', () => {
    const result = purchaseMirrorNode({}, 'not_a_real_node', 99999);
    assert.equal(result.success, false);
    assert.equal(result.cost, 0);
});

test('③ purchaseMirrorNode: immutable — 원본 mirror 객체를 변이하지 않음', () => {
    const before = { start_gold: 0 };
    const beforeSnapshot = { ...before };
    purchaseMirrorNode(before, 'start_gold', 1000);
    assert.deepEqual(before, beforeSnapshot, '원본 객체 불변');
});

// ── ③ PURCHASE_MIRROR_NODE reducer 액션 ────────────────────────────────────
test('③ reducer PURCHASE_MIRROR_NODE: 에센스 차감 + 레벨 증가 (immutable)', () => {
    const state = {
        ...INITIAL_STATE,
        player: { ...INITIAL_STATE.player, meta: { ...INITIAL_STATE.player.meta, essence: 1000, mirror: {} } },
    };
    const next = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'start_gold' } });
    const node = MIRROR_NODES.find((n) => n.id === 'start_gold');

    assert.equal(next.player.meta.mirror.start_gold, 1);
    assert.equal(next.player.meta.essence, 1000 - node.costs[0]);
    // immutability: 원본 state 불변
    assert.equal(state.player.meta.essence, 1000);
    assert.equal(state.player.meta.mirror.start_gold, undefined);
});

test('③ reducer PURCHASE_MIRROR_NODE: 에센스 부족 시 no-op (state 그대로)', () => {
    const state = {
        ...INITIAL_STATE,
        player: { ...INITIAL_STATE.player, meta: { ...INITIAL_STATE.player.meta, essence: 10, mirror: {} } },
    };
    const next = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'start_gold' } });
    assert.equal(next.player.meta.essence, 10, '에센스 변동 없음');
    assert.equal(next.player.meta.mirror.start_gold, undefined, '레벨 변동 없음');
});

test('③ reducer PURCHASE_MIRROR_NODE: 최대레벨 도달 시 no-op (캡)', () => {
    const state = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            meta: { ...INITIAL_STATE.player.meta, essence: 99999, mirror: { start_boot_extra: 1 } },
        },
    };
    const next = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'start_boot_extra' } });
    assert.equal(next.player.meta.mirror.start_boot_extra, 1, '최대레벨 유지');
    assert.equal(next.player.meta.essence, 99999, '에센스 차감 없음');
});

test('③ reducer PURCHASE_MIRROR_NODE: meta.mirror가 undefined인 구세이브에서도 안전', () => {
    const state = {
        ...INITIAL_STATE,
        player: { ...INITIAL_STATE.player, meta: { essence: 1000 } }, // mirror 필드 없음
    };
    const next = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'start_gold' } });
    assert.equal(next.player.meta.mirror.start_gold, 1);
});

test('③ reducer PURCHASE_MIRROR_NODE: 순차 구매로 레벨이 누적됨', () => {
    let state = {
        ...INITIAL_STATE,
        player: { ...INITIAL_STATE.player, meta: { ...INITIAL_STATE.player.meta, essence: 1000, mirror: {} } },
    };
    state = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'campfire_rate' } });
    assert.equal(state.player.meta.mirror.campfire_rate, 1);
    state = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'campfire_rate' } });
    assert.equal(state.player.meta.mirror.campfire_rate, 2);
    // maxLevel 2 도달 후 추가 구매 시도 → no-op
    const essenceAfterTwo = state.player.meta.essence;
    state = gameReducer(state, { type: AT.PURCHASE_MIRROR_NODE, payload: { nodeId: 'campfire_rate' } });
    assert.equal(state.player.meta.mirror.campfire_rate, 2, '최대레벨 캡');
    assert.equal(state.player.meta.essence, essenceAfterTwo, '초과 구매 시도는 에센스 미차감');
});

// ── ④ revive: 치명상 → 1회 부활 + 플래그, 2번째 → 사망, 새 런 리셋 ─────────────
test('④ CombatEngine.applyFatalProtection: mirror revive 미보유 시 부활 없음 (기존 동작 회귀 가드)', () => {
    const player = { hp: 50, maxHp: 200, relics: [], meta: { mirror: {} } };
    const logs = [];
    const result = CombatEngine.applyFatalProtection(player, [], 999, logs);
    assert.equal(result.isDead, true);
});

test('④ CombatEngine.applyFatalProtection: mirror revive 보유 + 치명상 → 1회 부활 (HP 30%)', () => {
    const player = { hp: 50, maxHp: 200, relics: [], meta: { mirror: { revive: 1 } }, combatFlags: {} };
    const logs = [];
    const result = CombatEngine.applyFatalProtection(player, [], 999, logs);
    assert.equal(result.isDead, false);
    assert.equal(result.updatedPlayer.hp, Math.floor(200 * BALANCE.MIRROR_REVIVE_HP_RATIO));
    assert.equal(result.updatedPlayer.mirrorReviveUsed, true, '런당 1회 소비 플래그 set');
    assert.ok(logs.length > 0, '부활 로그 출력');
});

test('④ CombatEngine.applyFatalProtection: mirror revive 이미 사용(mirrorReviveUsed) → 2번째는 사망', () => {
    const player = {
        hp: 50, maxHp: 200, relics: [], combatFlags: {},
        meta: { mirror: { revive: 1 } },
        mirrorReviveUsed: true, // 이미 이번 런에서 1회 소비함
    };
    const logs = [];
    const result = CombatEngine.applyFatalProtection(player, [], 999, logs);
    assert.equal(result.isDead, true, '이미 소비된 부활은 재사용 불가');
});

test('④ mirror revive는 기존 유물/토큰 부활 체인보다 우선순위가 낮거나 공존 가능 (death_save 유물 우선 확인)', () => {
    // death_save 유물 보유 시 그 경로가 먼저 소비되고 mirror revive는 소비되지 않아야 함
    // (동일 치명타에 이중 부활 스택 방지 — 자원 낭비 방지 설계 확인).
    const deathSaveRelic = { effect: 'death_save' };
    const player = {
        hp: 50, maxHp: 200, relics: [deathSaveRelic], combatFlags: {},
        meta: { mirror: { revive: 1 } },
    };
    const logs = [];
    const result = CombatEngine.applyFatalProtection(player, [deathSaveRelic], 999, logs);
    assert.equal(result.isDead, false);
    assert.equal(result.updatedPlayer.mirrorReviveUsed, undefined, 'death_save 유물이 먼저 소비 — mirror revive 플래그 미설정');
});

test('④ handleDefeat: mirrorReviveUsed 플래그는 새 런 시작 시 리셋됨 (INITIAL_PLAYER 기반이라 자연 리셋)', () => {
    const deadPlayer = {
        ...INITIAL_STATE.player,
        hp: 0, level: 5, mirrorReviveUsed: true,
        stats: { ...INITIAL_STATE.player.stats, deaths: 1 },
        meta: { ...INITIAL_STATE.player.meta, mirror: { revive: 1 } },
    };
    const result = CombatEngine.handleDefeat(deadPlayer, INITIAL_STATE.player);
    assert.equal(result.updatedPlayer.mirrorReviveUsed, undefined, '사망 후 리셋된 플레이어는 플래그 없음(INITIAL_PLAYER 기반)');
});

test('④ ASCEND 시에도 mirrorReviveUsed 플래그는 새 런 fresh player 기반이라 리셋 (freshPlayer가 INITIAL_STATE.player 기반)', async () => {
    const { makeProgressionActionMap } = await import('../src/reducers/handlers/progressionHandlers.js');
    const actionMap = makeProgressionActionMap(INITIAL_STATE);
    const state = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            mirrorReviveUsed: true,
            meta: { ...INITIAL_STATE.player.meta, mirror: { revive: 1 } },
            stats: { ...INITIAL_STATE.player.stats },
        },
    };
    const next = actionMap.ASCEND(state, { payload: { meta: { ...INITIAL_STATE.player.meta, mirror: { revive: 1 } }, newTitle: '테스트칭호' } });
    assert.equal(next.player.mirrorReviveUsed, undefined, 'ASCEND 후 mirrorReviveUsed 리셋');
    assert.equal(next.player.meta.mirror.revive, 1, 'mirror 레벨(영구 자산)은 보존');
});

test('④ RESET_GAME(사망 후 다시 시작) 시에도 mirrorReviveUsed 리셋 + mirror 레벨은 보존', async () => {
    const { makeProgressionActionMap } = await import('../src/reducers/handlers/progressionHandlers.js');
    const actionMap = makeProgressionActionMap(INITIAL_STATE);
    const state = {
        ...INITIAL_STATE,
        player: {
            ...INITIAL_STATE.player,
            mirrorReviveUsed: true,
            meta: { ...INITIAL_STATE.player.meta, mirror: { revive: 1, start_gold: 2 } },
        },
    };
    const next = actionMap.RESET_GAME(state);
    assert.equal(next.player.mirrorReviveUsed, undefined, 'RESET_GAME 후 mirrorReviveUsed 리셋');
    assert.equal(next.player.meta.mirror.revive, 1, 'mirror 레벨(영구 자산)은 RESET_GAME에도 보존');
    assert.equal(next.player.meta.mirror.start_gold, 2, '여러 노드 레벨 모두 보존');
});

test('④ mirror revive 사용은 첫 죽음(first-death) 메타 보상을 트리거하지 않음 (부활은 죽음이 아님)', () => {
    // applyFatalProtection에서 부활 성공 시 isDead:false → handleDefeat 자체가 호출되지 않는
    // 게임 루프 계약을 pure function 레벨에서 고정: isDead:false 반환 확인으로 대체 검증.
    const player = { hp: 50, maxHp: 200, relics: [], combatFlags: {}, meta: { mirror: { revive: 1 } }, stats: { deaths: 0 } };
    const logs = [];
    const result = CombatEngine.applyFatalProtection(player, [], 999, logs);
    assert.equal(result.isDead, false, '부활 성공 시 사망 처리(handleDefeat) 경로로 넘어가지 않음 → first-death 트리거 안 됨');
});

// ── ⑤ rank 해금과의 가산/곱 겹침 ───────────────────────────────────────────
test('⑤ start_boot_extra + rank5 startBootChoices 가산 (characterActions.ts 배선)', async () => {
    const { createCharacterActions } = await import('../src/hooks/gameActions/characterActions.js');
    const { AT: ATmod } = await import('../src/reducers/actionTypes.js');

    const makeDeps = (meta) => {
        const dispatches = [];
        const deps = {
            player: { meta, stats: {} },
            gameState: 'idle',
            dispatch: (a) => dispatches.push(a),
            addLog: () => {},
            addStoryLog: () => {},
            getFullStats: () => ({ maxHp: 178, maxMp: 52 }),
        };
        return { deps, dispatches };
    };
    const noopHooks = { emitUnlockedTitles: () => {}, emitDailyProtocolLogs: () => {} };

    // rank5 (+1) + mirror lv1 (+1) = base(3) + 2 = 5
    const { deps, dispatches } = makeDeps({ prestigeRank: 5, mirror: { start_boot_extra: 1 } });
    createCharacterActions(deps, noopHooks).start('테스터', 'male', '모험가', []);
    const pending = dispatches.find((d) => d.type === ATmod.SET_PENDING_RELICS);
    assert.equal(pending.payload.length, BALANCE.START_BOOT_RELIC_CHOICES + 2, 'rank5(+1) + mirror(+1) = base+2 = 5');
});

test('⑤ start_gold + 챌린지 모디파이어와 공존 (거울 보너스는 base START_GOLD에 가산)', async () => {
    const { createCharacterActions } = await import('../src/hooks/gameActions/characterActions.js');
    const { CONSTANTS } = await import('../src/data/constants.js');

    const dispatches = [];
    const deps = {
        player: { meta: { mirror: { start_gold: 2 } }, stats: {} },
        gameState: 'idle',
        dispatch: (a) => dispatches.push(a),
        addLog: () => {},
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 178, maxMp: 52 }),
    };
    const noopHooks = { emitUnlockedTitles: () => {}, emitDailyProtocolLogs: () => {} };
    createCharacterActions(deps, noopHooks).start('테스터', 'male', '모험가', []);
    const setPlayer = dispatches.find((d) => d.type === 'SET_PLAYER');
    assert.equal(setPlayer.payload.gold, CONSTANTS.START_GOLD + 200, 'start_gold Lv2 → +200 가산');
});

test('⑤ campfire_rate + rank4 campfireChanceBonus 가산 (exploreActions.ts 배선 공식 재현)', () => {
    const rank0 = getPrestigeUnlocks(0).campfireChanceBonus;
    const rank4 = getPrestigeUnlocks(4).campfireChanceBonus;
    const mirrorEff = getMirrorEffects({ mirror: { campfire_rate: 2 } });

    const totalRank0 = BALANCE.CAMPFIRE_CHANCE + rank0 + mirrorEff.campfireChanceBonus;
    const totalRank4 = BALANCE.CAMPFIRE_CHANCE + rank4 + mirrorEff.campfireChanceBonus;

    assert.ok(Math.abs(totalRank0 - (BALANCE.CAMPFIRE_CHANCE + 0.04)) < 1e-9, 'mirror만 적용된 rank0');
    assert.ok(totalRank4 > totalRank0, 'rank4 해금이 거울 보너스에 추가로 가산됨');
});

test('⑤ relic_pity(가산) × rank6 relicPityMult(곱연산) 겹침 — getDiscoveryOdds 통합 검증', async () => {
    const { getDiscoveryOdds } = await import('../src/utils/explorationPacing.js');
    const statsWithPity = { exploreState: { sinceRelic: 10, sinceDiscovery: 10, sinceNarrativeEvent: 10, quietStreak: 0, lastOutcome: 'nothing' } };
    const mapData = { type: 'dungeon', level: 5 };

    const oddsBase = getDiscoveryOdds({ stats: statsWithPity, meta: { prestigeRank: 0, mirror: {} } }, mapData);
    const oddsMirrorOnly = getDiscoveryOdds({ stats: statsWithPity, meta: { prestigeRank: 0, mirror: { relic_pity: 2 } } }, mapData);
    const oddsRankOnly = getDiscoveryOdds({ stats: statsWithPity, meta: { prestigeRank: 6, mirror: {} } }, mapData);
    const oddsBoth = getDiscoveryOdds({ stats: statsWithPity, meta: { prestigeRank: 6, mirror: { relic_pity: 2 } } }, mapData);

    assert.ok(oddsMirrorOnly.relicChance > oddsBase.relicChance, 'mirror relic_pity만으로도 확률 상승');
    assert.ok(oddsRankOnly.relicChance > oddsBase.relicChance, 'rank6 pity 가속만으로도 확률 상승');
    assert.ok(oddsBoth.relicChance >= Math.max(oddsMirrorOnly.relicChance, oddsRankOnly.relicChance),
        '거울+rank 동시 적용 시 둘 중 하나만 적용했을 때보다 확률이 낮아지지 않음 (겹침 시 손해 없음)');
});

test('⑤ rest_discount → characterActions.rest() 휴식 비용 실제 차감액 감소', async () => {
    const { createCharacterActions } = await import('../src/hooks/gameActions/characterActions.js');
    const { DB } = await import('../src/data/db.js');
    const safeLoc = Object.keys(DB.MAPS).find((loc) => DB.MAPS[loc].type === 'safe');

    const makeDeps = (mirror) => {
        const dispatches = [];
        const player = {
            level: 10, gold: 10000, loc: safeLoc,
            meta: { mirror },
            stats: {},
        };
        const deps = {
            player,
            gameState: 'idle',
            dispatch: (a) => dispatches.push(a),
            addLog: () => {},
            addStoryLog: () => {},
            getFullStats: () => ({ maxHp: 200, maxMp: 50 }),
        };
        return { deps, dispatches };
    };
    const noopHooks = { emitUnlockedTitles: () => {}, emitDailyProtocolLogs: () => {} };

    const { deps: depsNoDiscount, dispatches: dNoDiscount } = makeDeps({});
    createCharacterActions(depsNoDiscount, noopHooks).rest();
    const baseGold = dNoDiscount.find((d) => d.type === 'SET_PLAYER')?.payload?.gold;

    const { deps: depsDiscount, dispatches: dDiscount } = makeDeps({ rest_discount: 2 });
    createCharacterActions(depsDiscount, noopHooks).rest();
    const discountedGold = dDiscount.find((d) => d.type === 'SET_PLAYER')?.payload?.gold;

    assert.ok(discountedGold > baseGold, 'rest_discount Lv2 적용 시 휴식 후 남는 골드가 더 많아야 함 (비용 절감)');
});

// ── ⑥ 구세이브(meta.mirror 없음) 방어 ──────────────────────────────────────
test('⑥ dataMigration: meta.mirror 없는 구세이브 로드 시 {} 보강', async () => {
    const { migrateData } = await import('../src/utils/dataMigration.js');
    const oldSave = {
        version: 4.3,
        player: {
            name: '올드세이브', level: 10, meta: { essence: 500, rank: 1, bonusAtk: 1, bonusHp: 5, bonusMp: 3 },
            inv: [], equip: {}, stats: {},
        },
    };
    const migrated = migrateData(oldSave);
    assert.deepEqual(migrated.player.meta.mirror, {}, 'meta.mirror가 없으면 {}로 보강');
    assert.equal(migrated.player.meta.essence, 500, '기존 essence 값은 보존');
});

test('⑥ dataMigration: meta 자체가 없는 매우 오래된 세이브도 안전', async () => {
    const { migrateData } = await import('../src/utils/dataMigration.js');
    const veryOldSave = {
        version: 2.0,
        player: { name: '초창기세이브', inv: [], equip: {}, stats: {} },
    };
    const migrated = migrateData(veryOldSave);
    assert.deepEqual(migrated.player.meta.mirror, {});
});

test('⑥ dataMigration: 기존 mirror 레벨이 있으면 보존 (재마이그레이션 안전)', async () => {
    const { migrateData } = await import('../src/utils/dataMigration.js');
    const saveWithMirror = {
        version: 5.0,
        player: {
            name: '거울사용자', meta: { essence: 100, mirror: { start_gold: 2, revive: 1 } },
            inv: [], equip: {}, stats: {},
        },
    };
    const migrated = migrateData(saveWithMirror);
    assert.equal(migrated.player.meta.mirror.start_gold, 2);
    assert.equal(migrated.player.meta.mirror.revive, 1);
});

test('⑥ getMirrorEffects 자체도 완전히 빈 player.meta (undefined mirror) 입력에 방어적', () => {
    const legacyMeta = { essence: 500, rank: 1, bonusAtk: 1, bonusHp: 5, bonusMp: 3 }; // mirror 필드 없음
    const eff = getMirrorEffects(legacyMeta);
    assert.equal(eff.essenceFlowMult, 1);
    assert.equal(eff.reviveEnabled, false);
});

// ── essence_flow 배선: 획득처(전투 승리)에 rank essenceMult와 가산 검증 ──────
test('essence_flow: CombatEngine.handleVictory 에센스 획득에 mirror 배율이 배선됨', () => {
    const basePlayer = {
        level: 10, exp: 0, nextExp: 999999, gold: 0, maxHp: 200, hp: 200, maxMp: 50, mp: 50,
        atk: 20, def: 10, relics: [], stats: {},
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 0, mirror: {} },
    };
    const enemy = { name: '슬라임', baseName: '슬라임', exp: 80, gold: 50, level: 10 };

    const withoutMirror = CombatEngine.handleVictory(basePlayer, enemy, {}, {});
    const withMirrorPlayer = { ...basePlayer, meta: { ...basePlayer.meta, mirror: { essence_flow: 2 } } };
    const withMirror = CombatEngine.handleVictory(withMirrorPlayer, enemy, {}, {});

    assert.ok(withMirror.updatedPlayer.meta.essence > withoutMirror.updatedPlayer.meta.essence,
        'essence_flow Lv2(+20%)가 적용되어 에센스 획득이 더 많아야 함');
});

test('essence_flow + rank1 prestigeEssenceBonus 가산 (곱연산 배율 누적 확인)', () => {
    const basePlayer = {
        level: 10, exp: 0, nextExp: 999999, gold: 0, maxHp: 200, hp: 200, maxMp: 50, mp: 50,
        atk: 20, def: 10, relics: [], stats: {},
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 1, mirror: { essence_flow: 1 } },
    };
    const enemy = { name: '슬라임', baseName: '슬라임', exp: 80, gold: 50, level: 10 };

    const rank1Only = CombatEngine.handleVictory(
        { ...basePlayer, meta: { ...basePlayer.meta, mirror: {} } }, enemy, {}, {}
    );
    const rank1PlusMirror = CombatEngine.handleVictory(basePlayer, enemy, {}, {});

    assert.ok(rank1PlusMirror.updatedPlayer.meta.essence > rank1Only.updatedPlayer.meta.essence,
        'rank1 배율 위에 mirror essence_flow가 추가로 곱해져야 함');
});
