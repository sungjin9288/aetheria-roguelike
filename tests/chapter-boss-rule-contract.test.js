import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { MONSTERS } from '../src/data/monsters.js';
import { MAPS } from '../src/data/maps.js';
import { QUESTS } from '../src/data/quests.js';
import { DB } from '../src/data/db.js';
import { MAIN_STORY_QUEST_IDS } from '../src/data/storyChapters.js';
import {
    CHAPTER_BOSS_RULES,
    CHAPTER_BOSS_RULE_TEXT,
    CHAPTERS_WITHOUT_BOSS,
} from '../src/data/chapterBossRules.js';
import {
    getAppearRuleLine,
    getChapterBossRule,
    getChapterRuleChip,
    getChapterRuleForBossName,
} from '../src/systems/chapterBossRule.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { resolveCombatActionTurn } from '../src/systems/combatActionTurn.js';
import { resolveCombatItemTurn } from '../src/systems/combatItemTurn.js';
import { hitsEnemyWeakness } from '../src/systems/skillPower.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { buildBossChallengeEvent } from '../src/utils/bossGauge.js';
import { buildCombatView } from '../src/utils/combatView.js';
import { getCombatSkillReadiness } from '../src/utils/combatSkillReadiness.js';
import { endCombatScope } from '../src/utils/combatScope.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import MonsterCodex from '../src/components/codex/MonsterCodex.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-11 B5 — 장 보스 규칙(소유자 결정 2026-11-16 "본편 16장 보스 전부").
 *
 * (1) 표 ↔ 본편 장 · 지역 · 몬스터, (2) 규칙 문구 ↔ 화면(나타날 때의 줄 · 도전 카드 · 전투 칩 · 도감), (3) 규칙 ↔ 엔진 동작,
 * (4) 규칙 판정은 난수를 쓰지 않는다(막는 판정도 그 판정의 난수는 그대로 쓴다)를 함께 지킨다.
 */

const RULE_BOSSES = Object.keys(CHAPTER_BOSS_RULES);
const ADVICE = /하세요|추천|권장|권합니다|좋습니다/;

const makePlayer = (extra = {}) => ({
    name: '시험자', job: '전사', level: 40, hp: 4_000, maxHp: 4_000, mp: 200, maxMp: 200, atk: 200, def: 60, gold: 0,
    inv: [], equip: {}, relics: [], status: [], titles: [], stats: { kills: 0 }, meta: {},
    skillLoadout: { selected: 0, cooldowns: {} }, combatFlags: {}, ...extra,
});
const makeBoss = (name, extra = {}) => ({
    name, baseName: name, level: 40, hp: 50_000, maxHp: 50_000, atk: 300, def: 50, exp: 500, gold: 300, isBoss: true,
    pattern: { guardChance: 0, heavyChance: 0 },
    weakness: MONSTERS[name]?.weakness, resistance: MONSTERS[name]?.resistance,
    ...extra,
});
/** 같은 수치 · 규칙 없는 보스 — 규칙 유무만 다른 짝. */
const plainTwin = (boss) => ({ ...boss, name: '시험 보스', baseName: '시험 보스' });
const stats = (player) => calculateFullStats(player);
/** 쓴 난수를 세는 결정론 난수. */
const countingRng = (values = [0.42, 0.13, 0.77, 0.05, 0.61, 0.29, 0.88, 0.36]) => {
    const rng = () => { const v = values[rng.count % values.length]; rng.count += 1; return v; };
    rng.count = 0;
    return rng;
};
const texts = (result) => (result.logs || []).map((log) => log.text);
const bossOf = (rule) => RULE_BOSSES.find((name) => CHAPTER_BOSS_RULES[name].rule === rule);

// ── 1. 표 ↔ 본편 장 · 지역 · 몬스터 ─────────────────────────────────────────

test('본편 16장 모두 규칙 보스가 있거나 보스 없는 장으로 명시된다 — 한 장은 한 규칙', () => {
    const covered = new Map();
    for (const name of RULE_BOSSES) {
        for (const id of CHAPTER_BOSS_RULES[name].storyQuestIds) {
            assert.ok(!covered.has(id), `장 ${id}이 두 규칙에 있다`);
            covered.set(id, name);
        }
    }
    for (const id of [...MAIN_STORY_QUEST_IDS]) {
        const inTable = covered.has(id);
        const skipped = CHAPTERS_WITHOUT_BOSS.includes(id);
        assert.ok(inTable !== skipped, `장 ${id}: 규칙 보스 또는 보스 없는 장 중 하나`);
    }
    assert.equal(covered.size + CHAPTERS_WITHOUT_BOSS.length, MAIN_STORY_QUEST_IDS.size);
    assert.equal(MAIN_STORY_QUEST_IDS.size, 16);
});

test('장 보스는 그 장의 목표 보스이거나 그 장 지역의 보스다 — 몬스터 데이터의 보스다', () => {
    for (const name of RULE_BOSSES) {
        assert.equal(MONSTERS[name]?.isBoss, true, `${name}은 보스 몬스터`);
        for (const id of CHAPTER_BOSS_RULES[name].storyQuestIds) {
            const quest = QUESTS.find((q) => q.id === id);
            const map = MAPS[quest.location];
            const isTarget = quest.target === name;
            const isAreaBoss = (map?.bossMonsters || []).includes(name) || map?.boss === name;
            assert.ok(isTarget || isAreaBoss, `장 ${id}(${quest.target} @ ${quest.location}) ↔ ${name}`);
            if (!isTarget) assert.notEqual(MONSTERS[quest.target]?.isBoss, true, `장 ${id}의 목표가 보스면 그 보스가 장 보스다`);
        }
    }
});

test('보스 없는 장은 지역에 보스가 없고 목표도 보스가 아니다', () => {
    for (const id of CHAPTERS_WITHOUT_BOSS) {
        const quest = QUESTS.find((q) => q.id === id);
        const map = MAPS[quest.location];
        assert.ok(map, `장 ${id} 지역`);
        assert.equal((map.bossMonsters || []).length, 0, `${quest.location}: bossMonsters 없음`);
        assert.ok(!map.boss, `${quest.location}: 구역 보스 없음`);
        assert.notEqual(MONSTERS[quest.target]?.isBoss, true);
    }
});

test('규칙은 보스마다 다르고 모든 규칙에 문구가 있다 — 문구는 규칙만 말한다', () => {
    const rules = RULE_BOSSES.map((name) => CHAPTER_BOSS_RULES[name].rule);
    assert.equal(new Set(rules).size, rules.length, '보스마다 다른 규칙');
    assert.deepEqual([...new Set(rules)].sort(), Object.keys(CHAPTER_BOSS_RULE_TEXT).sort(), '쓰지 않는 규칙 · 문구 없는 규칙 없음');
    for (const name of RULE_BOSSES) {
        const rule = getChapterRuleForBossName(name);
        assert.ok(rule.name.length > 0 && rule.text.length > 0);
        for (const line of [rule.name, rule.text, MSG.CHAPTER_RULE_LINE(rule.name, rule.text), MSG.CHAPTER_RULE_CHIP(rule.name, rule.text)]) {
            assert.doesNotMatch(line, ADVICE, `${name}: 권고 없음`);
            assert.doesNotMatch(line, /\b(HP|MP|ATK|DEF)\b/, `${name}: 약어 없음`);
        }
    }
});

test('규칙은 보스로 나온 그 종에게만 걸린다', () => {
    const boss = makeBoss('마왕');
    assert.equal(getChapterBossRule(boss)?.rule, 'escape_sealed');
    assert.equal(getChapterBossRule({ ...boss, isBoss: false }), null, '보스가 아니면 없다');
    assert.equal(getChapterBossRule(plainTwin(boss)), null);
    assert.equal(getChapterBossRule({ ...boss, name: '[10층 보스] 마왕' })?.rule, 'escape_sealed', '표시 이름이 아니라 종으로 찾는다');
    assert.equal(getChapterBossRule(null), null);
});

// ── 2. 화면은 같은 선언을 읽는다 ─────────────────────────────────────────────

test('나타날 때의 줄 · 전투 칩 · 도전 카드 · 도감이 같은 규칙 이름과 문구를 보인다', () => {
    for (const name of RULE_BOSSES) {
        const rule = getChapterRuleForBossName(name);
        const boss = makeBoss(name);
        assert.equal(getAppearRuleLine(boss), MSG.CHAPTER_RULE_LINE(rule.name, rule.text));
        assert.equal(getChapterRuleChip(boss), MSG.CHAPTER_RULE_CHIP(rule.name, rule.text));
        const card = buildBossChallengeEvent(name, null);
        assert.ok(card.desc.includes(MSG.CHAPTER_RULE_LINE(rule.name, rule.text)), `${name}: 도전 카드`);
        const view = buildCombatView({ player: makePlayer(), enemy: boss, stats: stats(makePlayer()), selectedSkill: null, skillCooldown: 0 });
        assert.equal(view.chapterRuleChip, MSG.CHAPTER_RULE_CHIP(rule.name, rule.text), `${name}: 전투 칩`);
    }
    assert.equal(getAppearRuleLine(plainTwin(makeBoss('마왕'))), null);
    assert.ok(!buildBossChallengeEvent('기계 장군', null).desc.includes('📜'), '규칙 없는 구역 보스 카드에는 규칙 줄이 없다');
});

test('몬스터 도감 상세에 규칙 줄이 있다 — 규칙 없는 보스에는 없다', () => {
    const name = '타락한 세계수 수호자';
    const rule = getChapterRuleForBossName(name);
    const player = makePlayerFixture({ stats: { killRegistry: { [name]: 1, '기계 장군': 1 } } });
    const html = renderStatic(React.createElement(MonsterCodex, { player, initialSelectedMonster: name }));
    assert.ok(html.includes('codex-monster-chapter-rule'));
    assert.ok(html.includes(rule.text));
    const other = renderStatic(React.createElement(MonsterCodex, { player, initialSelectedMonster: '기계 장군' }));
    const detail = other.slice(other.indexOf('codex-monster-detail-기계 장군'));
    assert.ok(!detail.slice(0, detail.indexOf('codex-monster-detail-', 10) > 0 ? detail.indexOf('codex-monster-detail-', 10) : undefined).includes('codex-monster-chapter-rule'));
});

// ── 3. 엔진 동작 ─────────────────────────────────────────────────────────────

test('열기의 장막: 기술로 건 강화의 지속 턴이 절반(올림)이다', () => {
    const boss = makeBoss(bossOf('buff_halved'));
    const skill = { name: '시험 강화', type: 'buff', effect: 'atk_up', val: 1.5, mp: 10, turn: 3 };
    const ruled = CombatEngine.performSkill(makePlayer(), boss, stats(makePlayer()), skill, countingRng());
    const plain = CombatEngine.performSkill(makePlayer(), plainTwin(boss), stats(makePlayer()), skill, countingRng());
    assert.equal(plain.updatedPlayer.tempBuff.turn, 3);
    assert.equal(ruled.updatedPlayer.tempBuff.turn, Math.ceil(3 * BALANCE.CHAPTER_RULE_BUFF_TURN_MULT));
});

test('붉은 용린: 치명타가 나지 않는다 — 치명 판정 난수는 그대로 쓴다', () => {
    const boss = makeBoss(bossOf('crit_sealed'));
    const player = makePlayer();
    const critStats = { ...stats(player), critChance: 1 };
    const r1 = countingRng();
    const r2 = countingRng();
    const ruled = CombatEngine.attack(player, boss, critStats, r1);
    const plain = CombatEngine.attack(player, plainTwin(boss), critStats, r2);
    assert.equal(plain.isCrit, true);
    assert.equal(ruled.isCrit, false);
    assert.equal(r1.count, r2.count);
    const skill = { name: '시험 일격', type: 'physical', mult: 2, mp: 10, crit: 1 };
    const skillRuled = CombatEngine.performSkill(player, boss, critStats, skill, countingRng());
    assert.equal(skillRuled.isCrit, false);
});

test('망자의 봉인: 독 · 화상 · 출혈 틱이 보스 생명을 깎지 않는다', () => {
    const boss = makeBoss(bossOf('dot_sealed'), { dots: ['poison', 'burn', 'bleed'] });
    const logsRuled = [];
    const logsPlain = [];
    const ruled = CombatEngine.tickEnemyStatus(boss, logsRuled, 1, 1).updatedEnemy;
    const plain = CombatEngine.tickEnemyStatus(plainTwin(boss), logsPlain, 1, 1).updatedEnemy;
    assert.equal(ruled.hp, boss.hp);
    assert.ok(plain.hp < boss.hp);
    assert.ok(logsRuled.some((log) => log.text.includes(getChapterRuleForBossName(bossOf('dot_sealed')).name)));
    assert.deepEqual(ruled.dots, boss.dots, '걸린 지속 피해는 그대로 남는다');
});

test('과부하 회로: 기술 재사용 대기가 두 배다 — 전투가 끝나면 비운다', () => {
    const boss = makeBoss(bossOf('cooldown_double'));
    const skill = { name: '시험 포격', type: 'physical', mult: 2, mp: 30, cooldown: 3 };
    const ruled = CombatEngine.performSkill(makePlayer(), boss, stats(makePlayer()), skill, countingRng());
    const plain = CombatEngine.performSkill(makePlayer(), plainTwin(boss), stats(makePlayer()), skill, countingRng());
    assert.equal(plain.updatedPlayer.skillLoadout.cooldowns['시험 포격'], 3);
    assert.equal(ruled.updatedPlayer.skillLoadout.cooldowns['시험 포격'], 3 * BALANCE.CHAPTER_RULE_COOLDOWN_MULT);
    assert.deepEqual(endCombatScope(ruled.updatedPlayer).skillLoadout.cooldowns, {});
});

test('얼어붙은 마력: 기술 기력 소모가 두 배이고 기술 칸도 같은 값을 보인다', () => {
    const boss = makeBoss(bossOf('skill_mp_double'));
    const skill = { name: '시험 일격', type: 'physical', mult: 2, mp: 40 };
    const ruled = CombatEngine.performSkill(makePlayer({ mp: 200 }), boss, stats(makePlayer()), skill, countingRng());
    const plain = CombatEngine.performSkill(makePlayer({ mp: 200 }), plainTwin(boss), stats(makePlayer()), skill, countingRng());
    assert.equal(200 - plain.updatedPlayer.mp, 40);
    assert.equal(200 - ruled.updatedPlayer.mp, 40 * BALANCE.CHAPTER_RULE_SKILL_MP_MULT);
    // 재사용 대기 도출은 원래 소모로 한다(두 배 소모가 대기까지 늘리지 않는다).
    assert.equal(ruled.updatedPlayer.skillLoadout.cooldowns['시험 일격'], plain.updatedPlayer.skillLoadout.cooldowns['시험 일격']);
    const short = CombatEngine.performSkill(makePlayer({ mp: 60 }), boss, stats(makePlayer()), skill, countingRng());
    assert.equal(short.success, false);
    const readiness = getCombatSkillReadiness({ player: makePlayer({ mp: 60 }), selectedSkill: skill, enemy: boss });
    assert.equal(readiness.cost, 80);
    assert.equal(readiness.canUse, false);
    assert.equal(getCombatSkillReadiness({ player: makePlayer({ mp: 60 }), selectedSkill: skill, enemy: plainTwin(boss) }).canUse, true);
});

test('빙하의 숨: 상태이상 저항이 통하지 않는다 — 저항 판정 난수는 그대로 쓴다', () => {
    const boss = makeBoss(bossOf('resist_pierced'), { statusOnHit: 'freeze', pattern: { guardChance: 0, heavyChance: 1 } });
    const player = makePlayer({ relics: [{ id: 'seal', name: '고대의 봉인', effect: 'status_resist', val: 1 }] });
    const r1 = countingRng([0.01]);
    const r2 = countingRng([0.01]);
    const ruled = CombatEngine.enemyAttack(player, boss, stats(player), r1);
    const plain = CombatEngine.enemyAttack(player, plainTwin(boss), stats(player), r2);
    assert.ok(!(plain.updatedPlayer.status || []).includes('freeze'), '규칙 없으면 저항');
    assert.ok((ruled.updatedPlayer.status || []).includes('freeze'), '규칙이 있으면 걸린다');
    assert.equal(r1.count, r2.count);
});

test('꺼지지 않는 불: 전투 중 소모품은 한 번 — 두 번째는 쓰지 않고 거부 줄을 남긴다', () => {
    const potion = { ...DB.ITEMS.consumables.find((item) => item.type === 'hp'), id: 'potion-1' };
    const potion2 = { ...potion, id: 'potion-2' };
    const boss = makeBoss(bossOf('potion_once'));
    const player = makePlayer({ hp: 1_000, inv: [potion, potion2] });
    const first = resolveCombatItemTurn({ player, enemy: boss, item: potion, initialPlayer: player, seed: 7, now: 1, rng: countingRng() });
    assert.equal(first.kind, 'continue');
    assert.equal(first.enemy.ruleItemUses, 1);
    const r = countingRng();
    const second = resolveCombatItemTurn({ player: first.player, enemy: first.enemy, item: potion2, initialPlayer: player, seed: 8, now: 2, rng: r });
    assert.equal(second.kind, 'rejected');
    assert.equal(second.player, first.player, '소모하지 않는다');
    assert.equal(r.count, 0, '거부는 난수를 쓰지 않는다');
    assert.ok(texts(second)[0].includes(getChapterRuleForBossName(bossOf('potion_once')).name));
    const plainFirst = resolveCombatItemTurn({ player, enemy: plainTwin(boss), item: potion, initialPlayer: player, seed: 7, now: 1, rng: countingRng() });
    assert.equal(plainFirst.enemy.ruleItemUses, undefined, '규칙 없는 적은 세지 않는다');
});

test('꺼지지 않는 불: 리듀서는 막힌 소모품의 거부 줄을 남기고 소모하지 않는다', () => {
    const potion = { ...DB.ITEMS.consumables.find((item) => item.type === 'hp'), id: 'potion-9' };
    const boss = makeBoss(bossOf('potion_once'), { ruleItemUses: 1 });
    const state = {
        ...INITIAL_STATE,
        gameState: GS.COMBAT,
        player: makePlayer({ hp: 1_000, inv: [potion] }),
        enemy: boss,
        combatTurn: 3,
        logs: [],
    };
    const next = gameReducer(state, { type: AT.USE_COMBAT_ITEM, payload: { itemId: 'potion-9', seed: 11, now: 5, expectedTurn: 3 } });
    assert.equal(next.player.inv.length, 1);
    assert.equal(next.enemy.hp, boss.hp);
    assert.ok(next.logs.some((log) => String(log.text).includes(getChapterRuleForBossName(bossOf('potion_once')).text)));
});

test('폭풍의 눈: 장비 회피가 피하지 못한다 — 회피 판정까지의 난수는 같다', () => {
    const boss = makeBoss(bossOf('evasion_sealed'));
    const player = makePlayer({ equip: { armor: { name: '시험 외투', type: 'armor', val: 0, evasion: 1 } } });
    const seq = [0.3, 0.6, 0.2, 0.9, 0.4, 0.7, 0.1, 0.5];
    const r1 = countingRng(seq);
    const r2 = countingRng(seq);
    const ruled = CombatEngine.enemyAttack(player, boss, stats(player), r1);
    const plain = CombatEngine.enemyAttack(player, plainTwin(boss), stats(player), r2);
    assert.equal(plain.damage, 0, '규칙 없으면 피한다');
    assert.ok(ruled.damage > 0, '규칙이 있으면 맞는다');
    assert.ok(texts(ruled).some((text) => text.includes(getChapterRuleForBossName(bossOf('evasion_sealed')).name)));
    // 규칙 없는 쪽이 쓴 난수(회피 판정까지)를 규칙 있는 쪽도 같은 순서로 먼저 쓴다 — 그 뒤는 맞은 공격의 판정이다.
    assert.ok(r1.count >= r2.count);
});

test('폭풍의 눈: 은신 · 그림자 망토도 피하지 못한다 — 은신 횟수는 그대로 줄어든다', () => {
    const boss = makeBoss(bossOf('evasion_sealed'));
    const player = makePlayer({ combatFlags: { stealthHits: 2, stealthChance: 1, stealthFirstPending: true } });
    const ruled = CombatEngine.enemyAttack(player, boss, stats(player), countingRng());
    const plain = CombatEngine.enemyAttack(player, plainTwin(boss), stats(player), countingRng());
    assert.equal(plain.damage, 0);
    assert.ok(ruled.damage > 0);
    assert.equal(ruled.updatedPlayer.combatFlags.stealthHits, 1);
    const cloaked = makePlayer({
        relics: [{ id: 'cloak', name: '그림자 망토', effect: 'first_turn_evade', val: 1 }],
        combatFlags: { cloakEvadePending: true, stealthHits: 1, stealthChance: 1, stealthFirstPending: true },
    });
    const cloakRuled = CombatEngine.enemyAttack(cloaked, boss, stats(cloaked), countingRng());
    assert.ok(cloakRuled.damage > 0);
    assert.equal(cloakRuled.updatedPlayer.combatFlags.cloakEvadePending, false);
    assert.equal(cloakRuled.updatedPlayer.combatFlags.stealthHits, 1, '망토가 막힌 공격은 은신을 함께 쓰지 않는다');
});

test('물든 뿌리: 약점 속성 배율이 1이고 기술 칸의 약점 표시도 꺼진다', () => {
    const name = bossOf('weakness_sealed');
    const boss = makeBoss(name);
    assert.ok(boss.weakness, `${name}에게 약점이 있다(규칙이 공허하지 않다)`);
    assert.equal(CombatEngine.getElementMultiplier(boss.weakness, boss, []), 1);
    assert.equal(CombatEngine.getElementMultiplier(boss.weakness, plainTwin(boss), []), BALANCE.ELEMENT_WEAK_MULT);
    const skill = { name: '시험 원소', type: boss.weakness, mult: 2 };
    assert.equal(hitsEnemyWeakness(skill, boss, {}), false);
    assert.equal(hitsEnemyWeakness(skill, plainTwin(boss), {}), true);
});

test('혈월: 흡수 기술 · 영혼 흡수가 생명을 회복하지 않는다', () => {
    const boss = makeBoss(bossOf('lifesteal_sealed'));
    const player = makePlayer({ hp: 1_000, relics: [{ id: 'sl', name: '영혼 흡수', effect: 'skill_lifesteal', val: 0.5 }] });
    const skill = { name: '시험 흡수', type: 'physical', effect: 'drain', mult: 2, mp: 10, drainRatio: 0.5 };
    const r1 = countingRng();
    const r2 = countingRng();
    const ruled = CombatEngine.performSkill(player, boss, stats(player), skill, r1);
    const plain = CombatEngine.performSkill(player, plainTwin(boss), stats(player), skill, r2);
    assert.ok(plain.updatedPlayer.hp > 1_000);
    assert.equal(ruled.updatedPlayer.hp, 1_000);
    assert.equal(r1.count, r2.count);
});

test('마왕의 영역: 도주를 굴리지 않고 거부한다 — 순간 이동 기술도 막는다', () => {
    const boss = makeBoss(bossOf('escape_sealed'));
    const player = makePlayer();
    const r = countingRng();
    const result = resolveCombatActionTurn({ player, enemy: boss, kind: 'escape', initialPlayer: player, seed: 1, now: 1, rng: r });
    assert.equal(result.kind, 'rejected');
    assert.equal(result.enemy, boss);
    assert.equal(r.count, 0);
    assert.ok(texts(result)[0].includes(getChapterRuleForBossName('마왕').text));
    const plainRng = countingRng();
    const plain = resolveCombatActionTurn({ player, enemy: plainTwin(boss), kind: 'escape', initialPlayer: player, seed: 1, now: 1, rng: plainRng });
    assert.notEqual(plain.kind, 'rejected', '규칙 없으면 도주를 굴린다');
    assert.ok(plainRng.count > 0);
    const blink = CombatEngine.performSkill(player, boss, stats(player), { name: '순간 이동', effect: 'escape_100', mp: 20 }, countingRng());
    assert.equal(blink.success, false);
    assert.equal(blink.forceEscape, undefined);
});

// ── 4. 규칙 판정은 난수를 쓰지 않는다 ─────────────────────────────────────────

test('규칙이 결과를 바꾸지 않는 공격 · 기술 · 적 행동은 규칙 유무와 같은 난수를 같은 순서로 쓴다', () => {
    const skill = { name: '시험 일격', type: 'physical', mult: 1.5, mp: 10 };
    for (const name of RULE_BOSSES) {
        const boss = makeBoss(name);
        const player = makePlayer();
        const run = (enemy) => {
            const rng = countingRng();
            const a = CombatEngine.attack(player, enemy, stats(player), rng);
            const s = CombatEngine.performSkill(player, a.updatedEnemy, stats(player), skill, rng);
            const e = CombatEngine.enemyAttack(player, s.updatedEnemy, stats(player), rng);
            return { count: rng.count, enemyHp: e.updatedEnemy?.hp, playerHp: e.updatedPlayer.hp };
        };
        const ruled = run(boss);
        const plain = run(plainTwin(boss));
        assert.equal(ruled.count, plain.count, `${name}: 난수 수`);
    }
});
