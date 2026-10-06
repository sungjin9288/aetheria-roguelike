import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DB } from '../src/data/db.js';
import { AT } from '../src/reducers/actionTypes.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { applyBattleStartRelics } from '../src/hooks/gameActions/exploreFlow.js';
import { endCombatScope } from '../src/utils/combatScope.js';
import { migrateData } from '../src/utils/dataMigration.js';
import { getJobSkills } from '../src/utils/gameUtils.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';

/**
 * 2026-10 Wave 66 — 기술 재사용 대기는 전투마다 새로 시작한다(소유자 결정 "기술 대기시간은 전투시마다 새로 시작 —
 * 어차피 마나 · 기력 등 비용이 있어 무한정 쓸 수는 없다").
 *
 * 대기는 전투 턴에만 줄어서, 비우지 않던 동안 자연 플레이 대기 상태 스냅숏 9,600개의 92.1%가 잠긴 기술을 들고 다음
 * 전투를 시작했다(휴식 · 귀환에서도 그대로였다, 원장 §67.6). 이제 전투가 끝나는 모든 경로가 `endCombatScope` 하나를
 * 거치며 대기를 비운다. 같은 전투 안에서는 대기가 그대로 작동한다(대조군).
 */

const STALE = { 강타: 3, '프로스트 노바': 2 };

const basePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: 'tester', job: '전사', level: 20, hp: 5_000, maxHp: 5_000, mp: 500, maxMp: 500, atk: 200, def: 50,
    equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
    relics: [], combatFlags: {}, status: [], killStreak: 0,
    skillLoadout: { selected: 0, cooldowns: { ...STALE } },
    ...overrides,
});
const enemy = (hp) => ({
    name: '슬라임', baseName: '슬라임', hp, maxHp: hp, atk: 1, def: 0, level: 5, exp: 10, gold: 10,
    pattern: { guardChance: 0, heavyChance: 0 },
});
const combatState = (player, foe) => {
    const state = structuredClone(INITIAL_STATE);
    state.player = player;
    state.gameState = 'combat';
    state.enemy = foe;
    state.combatTurn = 0;
    state.combatReceipt = null;
    return state;
};
const ACTIONS = makeCombatActionMap(INITIAL_STATE.player);
const resolve = (state, kind, seed = 20261006) => ACTIONS.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind, expectedTurn: state.combatTurn, seed: seed + state.combatTurn, now: 1_700_000_000_000 },
});
const liveCooldowns = (player) => Object.entries(player.skillLoadout?.cooldowns || {}).filter(([, turns]) => turns > 0);

test('endCombatScope: 남은 재사용 대기를 비우고, 끝낼 것이 없으면 같은 참조를 돌려준다', () => {
    const stale = basePlayer();
    assert.deepEqual(endCombatScope(stale).skillLoadout.cooldowns, {});
    assert.equal(endCombatScope(stale).skillLoadout.selected, stale.skillLoadout.selected);
    const clean = basePlayer({ skillLoadout: { selected: 1, cooldowns: { 강타: 0 } } });
    assert.equal(endCombatScope(clean), clean);
});

test('같은 전투 안에서는 재사용 대기가 그대로 작동한다(대조군) — 쓴 기술은 다음 턴에 잠겨 있다', () => {
    const skills = getJobSkills(basePlayer());
    const heavy = skills.reduce((best, skill, index) => ((skill.mp || 0) > (skills[best].mp || 0) ? index : best), 0);
    const player = basePlayer({ skillLoadout: { selected: heavy, cooldowns: {} } });
    const after = resolve(combatState(player, enemy(1e9)), 'skill');
    assert.equal(after.gameState, 'combat');
    const name = String(skills[heavy].name);
    assert.ok((after.player.skillLoadout.cooldowns[name] || 0) > 0, `${name} 대기가 남아야 한다`);
    const again = resolve(after, 'skill');
    assert.equal(again.enemy.hp, after.enemy.hp, '대기 중인 기술은 피해를 주지 않는다');
});

test('승리: 마무리 일격이 기술이어도 · 공격이어도 승리 정산 뒤 재사용 대기가 비어 있다', () => {
    const skills = getJobSkills(basePlayer());
    const finisher = skills.findIndex((skill) => (skill.mult || 0) > 0);
    const bySkill = resolve(combatState(basePlayer({ skillLoadout: { selected: finisher, cooldowns: {} } }), enemy(1)), 'skill');
    assert.notEqual(bySkill.gameState, 'combat');
    assert.deepEqual(liveCooldowns(bySkill.player), []);

    const byAttack = resolve(combatState(basePlayer(), enemy(1)), 'attack');
    assert.notEqual(byAttack.gameState, 'combat');
    assert.deepEqual(liveCooldowns(byAttack.player), []);

    // 승리 정산 자체(진 보스전이 이어지는 마왕 처치도 이 정산을 거친다).
    const settled = CombatEngine.handleVictory(basePlayer(), enemy(1), {}, {}).updatedPlayer;
    assert.deepEqual(liveCooldowns(settled), []);
});

test('도주 성공: 재사용 대기가 비어 있다', () => {
    let escaped = null;
    for (let seed = 1; seed < 200 && !escaped; seed += 1) {
        const next = resolve(combatState(basePlayer(), enemy(1e9)), 'escape', seed);
        if (next.gameState !== 'combat') escaped = next;
    }
    assert.ok(escaped, '도주에 성공하는 시드가 있어야 한다');
    assert.deepEqual(liveCooldowns(escaped.player), []);
});

test('세이브 복원: 전투가 아닌 모드로 복원하면 남은 대기가 비고, 전투로 복원하면 그대로다', () => {
    const restore = (gameState, foe) => gameReducer(INITIAL_STATE, {
        type: 'LOAD_DATA', payload: migrateData({ version: 5, player: basePlayer(), gameState, enemy: foe }),
    }).player;
    for (const mode of ['idle', 'event', 'dead']) assert.deepEqual(liveCooldowns(restore(mode, null)), [], mode);
    assert.deepEqual(Object.fromEntries(liveCooldowns(restore('combat', enemy(500)))), STALE);
});

test('전투 시작: 이전 세이브처럼 대기를 든 채 시작해도 새 전투는 대기 없이 시작한다', () => {
    const stale = basePlayer();
    const started = applyBattleStartRelics(stale, stale.relics, calculateFullStats(stale), { addLog() {}, rng: () => 0.99 });
    assert.deepEqual(liveCooldowns(started), []);
});

test('부재 불변식: 전투 종료 경로는 endCombatScope만 부른다 — 유물 전용 종료를 직접 부르지 않는다', () => {
    const offenders = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
            const path = join(dir, entry);
            if (statSync(path).isDirectory()) { walk(path); continue; }
            if (!/\.(ts|tsx)$/.test(entry)) continue;
            if (path.endsWith(join('utils', 'combatScope.ts')) || path.endsWith(join('utils', 'combatScopedRelics.ts'))) continue;
            if (/\bendCombatScopedRelics\s*\(/.test(readFileSync(path, 'utf8'))) offenders.push(path);
        }
    };
    walk('src');
    assert.deepEqual(offenders, []);
});
