import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { MIRROR_NODES } from '../src/data/mirror.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { admitCombatLoot } from '../src/systems/combatLootCapacity.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { scaleEssenceReward } from '../src/systems/essenceRewardMult.js';
import { getAscensionOutcome } from '../src/utils/ascensionPreview.js';
import { getInventoryCapacity } from '../src/utils/inventoryCapacity.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getPassiveSkillBonuses } from '../src/utils/gameUtils.js';
import { getCurrentDailyProtocol } from '../src/utils/protocolCycle.js';
import { getChallengeSlotCount, sanitizeChallengeModifiers } from '../src/utils/runStart.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import QuestTab from '../src/components/tabs/QuestTab.tsx';
import { createElement } from 'react';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 58 — 계승 · 거울 · 일일 임무 · 계승 단계 · 고정 보너스 설명대로(소유자 결정: 강해지는 쪽은 "설명대로 구현 + 측정",
 * 계승 화면 도전 조건은 "계승 화면에서 함께 고름").
 */

const basePlayer = (extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '시험자', job: '전사', loc: '고요한 숲', level: 30, hp: 1_000, maxHp: 1_000, mp: 200, maxMp: 200,
    atk: 100, def: 20, equip: { weapon: null, armor: null, offhand: null }, relics: [], status: [],
    ...extra,
});

const ascend = (meta, payload = {}) => {
    const player = basePlayer({ level: 50, quests: [], meta: { ...structuredClone(INITIAL_STATE.player.meta), ...meta, endgame: { lastEndgameReceiptKey: 'rk' } } });
    return gameReducer(
        { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, player, bootStage: 'ready' },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: meta.prestigeRank || 0, sourceReceiptKey: 'rk', seed: 7, ...payload } },
    );
};

test('계승도 새 여정의 시작 조건을 적용한다 — 거울 시작 골드 · 첫 유물 선택지 · 도전 조건', () => {
    const mirror = { start_gold: 5, start_boot_extra: 2 };
    const after = ascend({ prestigeRank: 6, mirror }, { challengeModifiers: ['halfHp', 'eliteOnly', 'noPotion', 'blindMap', 'randomSkills'] });
    assert.equal(after.player.meta.prestigeRank, 7);
    assert.equal(after.player.gold, CONSTANTS.START_GOLD + 5 * BALANCE.MIRROR_START_GOLD_PER_LEVEL);
    // 7단계에서 오른 rank로 고른다 — 3 + 1칸.
    assert.equal(getChallengeSlotCount(7), BALANCE.CHALLENGE_MODIFIER_SLOTS + 1);
    assert.deepEqual(after.player.challengeModifiers, ['halfHp', 'eliteOnly', 'noPotion', 'blindMap']);
    assert.ok(after.player.maxHp < basePlayer().maxHp, '약한 생명력이 적용됐다');
    // 5단계(첫 유물 선택지 +1) + 거울 각성의 선택 2.
    assert.equal(after.pendingRelics.length, getPrestigeUnlocks(7).startBootChoices + 2);
    assert.ok(after.logs.some((log) => log.text === MSG.START_BOOT_RELIC));

    // 같은 시드는 같은 제안 — 리듀서 결정론.
    const again = ascend({ prestigeRank: 6, mirror }, { challengeModifiers: ['halfHp'] });
    assert.deepEqual(again.pendingRelics.map((r) => r.id), after.pendingRelics.map((r) => r.id));
});

test('빈손의 시작은 계승 뒤에도 0골드다 · 알 수 없는 도전 조건은 버린다', () => {
    const after = ascend({ prestigeRank: 0, mirror: { start_gold: 5 } }, { challengeModifiers: ['noGold', 'noGold', 'unknown'] });
    assert.equal(after.player.gold, 0);
    assert.deepEqual(after.player.challengeModifiers, ['noGold']);
    assert.deepEqual(sanitizeChallengeModifiers('noGold', 0), []);
});

test('계승 보상 정수에도 정수 배율(계승 단계 × 거울 에센스 공명)이 곱해진다', () => {
    const meta = { prestigeRank: 1, essence: 0, essenceLifetime: 0, mirror: { essence_flow: 5 } };
    const outcome = getAscensionOutcome(meta);
    const expected = scaleEssenceReward(BALANCE.PRESTIGE_ESSENCE_REWARD, meta);
    assert.equal(expected, Math.floor(BALANCE.PRESTIGE_ESSENCE_REWARD * (1 + BALANCE.PRESTIGE_ESSENCE_BONUS) * 1.5));
    assert.equal(outcome.meta.essence, expected);
    assert.equal(outcome.meta.essenceLifetime, expected);
});

test('일일 처치 임무의 정수 표시는 실제 지급량이다', () => {
    const player = basePlayer({ level: 10, meta: { prestigeRank: 1, mirror: { essence_flow: 5 } } });
    const daily = getCurrentDailyProtocol(player, new Date());
    const kill = daily.missions.find((mission) => mission.type === 'kills');
    const granted = scaleEssenceReward(kill.reward.essence, player.meta);
    assert.notEqual(granted, kill.reward.essence);
    const html = renderStatic(createElement(QuestTab, { player: { ...player, stats: { ...player.stats, dailyProtocol: daily } }, actions: {} }));
    assert.ok(html.includes(`에센스 +${granted}`), '지급량을 그린다');
    assert.ok(!html.includes(`에센스 +${kill.reward.essence}<`), '원액을 그리지 않는다');
});

test('유료 정찰 · 기술 교체 비용도 일일 임무 "골드 소비"에 센다', () => {
    const player = basePlayer({ level: 10, gold: 5_000 });
    const dailyProtocol = getCurrentDailyProtocol(player, new Date());
    const state = { ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, player: { ...player, stats: { ...player.stats, dailyProtocol } } };
    const scouted = gameReducer(state, { type: AT.RESOLVE_SCOUT, payload: { seed: 7, now: Date.now() } });
    const spent = player.gold - scouted.player.gold;
    assert.ok(spent > 0, '유료 정찰');
    const progress = (p) => p.stats.dailyProtocol.missions.find((mission) => mission.type === 'goldSpend').progress;
    assert.equal(progress(scouted.player), spent);

    const branchJob = Object.entries(DB.CLASSES).find(([, cls]) => cls.skillBranches && Object.keys(cls.skillBranches).length > 0);
    assert.ok(branchJob);
    const [job, cls] = branchJob;
    const [skillName, branches] = Object.entries(cls.skillBranches)[0];
    const safe = Object.entries(DB.MAPS).find(([, map]) => map.type === 'safe')[0];
    const dispatched = [];
    createCharacterActions({
        player: basePlayer({ job, loc: safe, gold: 5_000 }), gameState: GS.IDLE, dispatch: (entry) => dispatched.push(entry),
        addLog: () => {}, addStoryLog: () => {}, getFullStats: () => null,
    }, { emitUnlockedTitles: () => {} }).swapSkillChoice(skillName, branches[0].choice);
    const daily = dispatched.find((entry) => entry.type === AT.UPDATE_DAILY_PROTOCOL);
    assert.deepEqual(daily?.payload, { type: 'goldSpend', amount: BALANCE.SKILL_SWAP_COST || 50 });
});

test('거울 에테르 수호 2단계는 실효 최대 생명의 60%로 일으킨다', () => {
    const armor = DB.ITEMS.armors.find((item) => item.type === 'armor' && (item.hpBonus || 0) > 0 && (!item.jobs || item.jobs.includes('전사')));
    assert.ok(armor);
    const player = basePlayer({ hp: 10, maxHp: 500, equip: { weapon: null, armor: { ...armor, id: 'a' }, offhand: null }, meta: { mirror: { revive: 2 } }, combatFlags: {} });
    const effectiveMax = calculateFullStats(player).maxHp;
    assert.ok(effectiveMax > player.maxHp);
    const result = CombatEngine.applyFatalProtection(player, [], 100, []);
    assert.equal(result.isDead, false);
    assert.equal(result.updatedPlayer.hp, Math.floor(effectiveMax * 2 * BALANCE.MIRROR_REVIVE_HP_RATIO));
});

test('야영 기술 문구는 실제로 할 수 있는 휴식(안전지대)을 말한다', () => {
    const node = MIRROR_NODES.find((entry) => entry.id === 'rest_discount');
    assert.doesNotMatch(node.desc, /마을 밖/);
    assert.match(node.desc, /안전지대 휴식/);
});

test('계승 2단계 "유물 선택지 4개"는 이벤트 유물 선택에도 적용된다', () => {
    const offer = (prestigeRank) => {
        const player = basePlayer({ meta: { prestigeRank } });
        const event = { desc: '시험', choices: ['고른다'], outcomes: [{ choiceIndex: 0, relic: { count: 1 }, log: '빛' }] };
        const dispatched = [];
        createEventActions({
            player, currentEvent: event, gameState: GS.EVENT, dispatch: (entry) => dispatched.push(entry),
            addLog: () => {}, addStoryLog: () => {}, getFullStats: (p) => calculateFullStats(p ?? player), rng: () => 0.5,
        }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);
        return dispatched.find((entry) => entry.type === AT.SET_PENDING_RELICS)?.payload || [];
    };
    assert.equal(offer(0).length, 1, '그 아래 단계는 이벤트가 정한 수');
    assert.equal(offer(2).length, getPrestigeUnlocks(2).relicChoices);
    assert.equal(getPrestigeUnlocks(2).relicChoices, 4);
});

test('계승 3단계 보스 희귀 장비 보장은 가득 찬 가방에도 들어간다', () => {
    const player = basePlayer({ meta: { prestigeRank: 3 } });
    const capacity = getInventoryCapacity(player);
    const full = { ...player, inv: Array.from({ length: capacity }, (_, i) => ({ ...DB.ITEMS.materials[0], id: `m${i}` })) };
    const boss = { name: '고블린 왕', baseName: '고블린 왕', isBoss: true, exp: 3_000, gold: 100, level: 30 };
    const loot = CombatEngine.processLoot(boss, full, 1, () => 0.99, () => 1);
    const guaranteed = loot.candidates.filter((candidate) => candidate.guaranteed);
    assert.equal(guaranteed.length, 1);
    const admission = admitCombatLoot(full, loot.candidates);
    assert.ok(admission.admitted.includes(guaranteed[0]), '보장 장비는 들어간다');
    assert.ok(admission.blocked.every((candidate) => !candidate.guaranteed));
});

test('"+N" 고정 보너스(직업 패시브 · 도감 · 칭호)는 모든 배율 뒤에 그대로 더해진다', () => {
    // 직업 세트(공격 · 방어 · 생명 배율)를 갖춰 배율이 1이 아닌 상태에서 잰다.
    const outfit = (job) => ({
        weapon: DB.ITEMS.weapons.find((w) => w.jobs?.includes(job) && (w.hands ?? 1) === 1),
        armor: DB.ITEMS.armors.find((a) => a.type === 'armor' && a.jobs?.includes(job)),
        offhand: DB.ITEMS.armors.find((a) => a.type === 'shield' && a.jobs?.includes(job)),
    });
    const knight = basePlayer({ job: '나이트', equip: outfit('나이트') });
    const knightBase = calculateFullStats(knight);
    assert.equal(knightBase.jobAffinity.tier, 'full');
    const withCodex = calculateFullStats({ ...knight, stats: { ...knight.stats, codexBonusAtk: 7, codexBonusDef: 3, codexBonusHp: 40 } });
    assert.equal(withCodex.atk - knightBase.atk, 7);
    assert.equal(withCodex.def - knightBase.def, 3);
    assert.equal(withCodex.maxHp - knightBase.maxHp, 40);

    const player = basePlayer({ job: '전사' });
    const base = calculateFullStats(player);

    const titled = calculateFullStats({ ...player, activeTitle: 'warlord' });
    assert.equal(titled.atk - base.atk, 4, '칭호 ATK +4');

    // 직업 패시브는 같은 값의 도감 고정 보너스와 똑같이 동작한다 — 패시브를 뺀 시험 직업 + 같은 값의 도감 보너스 = 원래 직업.
    //   (고정 보너스는 빌드 성향 판정의 입력이기도 해서, 패시브만 빼고 비교하면 성향 배율 변화가 섞인다.)
    const passive = getPassiveSkillBonuses(player);
    assert.ok(passive.atk > 0 && passive.hp > 0);
    // 직업 기본 성향은 직업 이름이 정하므로, 같은 '전사' 정의에서 패시브만 잠시 뺀다.
    const warrior = DB.CLASSES['전사'];
    const originalSkills = warrior.skills;
    warrior.skills = (originalSkills || []).filter((skill) => !skill.passive);
    try {
        const equivalent = calculateFullStats({
            ...player,
            stats: { ...player.stats, codexBonusAtk: passive.atk, codexBonusDef: passive.def, codexBonusHp: passive.hp },
        });
        assert.equal(equivalent.atk, base.atk, `전사 ATK +${passive.atk}는 고정 보너스다`);
        assert.equal(equivalent.def, base.def);
        assert.equal(equivalent.maxHp, base.maxHp);
    } finally {
        warrior.skills = originalSkills;
    }
});

test('무당 "HP 30% 이하"는 정확히 30%에서도 발동한다', () => {
    const at = (hp) => getPassiveSkillBonuses(basePlayer({ job: '무당', hp, maxHp: 1_000 })).lowHpAtkMult;
    assert.ok(at(300) > 1);
    assert.equal(at(301), 1);
    assert.equal(BALANCE.LOW_HP_PASSIVE_THRESHOLD, 0.3);
});
