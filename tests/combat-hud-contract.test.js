import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import StatusBar from '../src/components/StatusBar.tsx';
import CombatVitalsStrip from '../src/components/combat/CombatVitalsStrip.tsx';
import { MSG } from '../src/data/messages.ts';
import { buildCombatView } from '../src/utils/combatView.ts';
import { castTraySkill, getCombatSkillTray } from '../src/utils/combatSkillTray.ts';
import { getCombatForecast } from '../src/utils/combatForecast.ts';
import { hitsEnemyWeakness } from '../src/systems/skillPower.ts';
import { getBossThreatChip, getEnemyThreat } from '../src/utils/enemyThreat.ts';
import { getEnemyRank } from '../src/utils/enemyRank.ts';
import { getJobSkills } from '../src/utils/gameUtils.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 감사 — 전투 화면(CL-03 · CL-06 · CL-09 · VD-02 · GF-05) 계약.
 *
 *  CL-03  가진 기술이 모두 칸으로 보이고, 칸을 누르면 그 기술을 고르고(selectSkill) 곧바로 쓴다(combat('skill')).
 *         재사용 대기 · 기력 부족 칸은 누를 수 없고 아무것도 보내지 않는다. 이름 없는 순환 단추는 없다.
 *         고르기만 하는 길이 없으므로 약점 표시는 칸마다 있다 — 전투 예고의 '… 약점'과 같은 판정(`hitsEnemyWeakness`).
 *  CL-06  보스와 싸우는 동안에도 위협 칩(가장 센 한 방)이 보인다 — 정예 칩과 같은 추정기 · 같은 모양, 추천 없음.
 *  CL-09  보스 카드의 대응 문구는 '공략 요령'이다 — '권장 대응'은 판단 요약 칸 하나뿐이다.
 *  VD-02 · GF-05  전투 조작판에 내 생명 · 기력 막대가 있고 맞은 순간 번쩍인다. 적 초상은 80px(160px 원본의 정수 배율)이고
 *         적의 무게(보스 · 우두머리 · 정예 · 일반)가 초상 · 교전 카드에 실린다.
 */

const PALADIN = '팔라딘';

const bossEnemy = () => ({
    name: '고대 호수의 수호신',
    baseName: '고대 호수의 수호신',
    level: 35,
    hp: 3200,
    maxHp: 3200,
    atk: 120,
    def: 54,
    exp: 2400,
    gold: 1800,
    isElite: false,
    isBoss: true,
    pattern: { heavyChance: 0.4, guardChance: 0.45 },
});

const eliteEnemy = () => ({
    name: '정예 숲의 정령', baseName: '숲의 정령', level: 2, hp: 134, maxHp: 134, atk: 16, def: 5,
    exp: 24, gold: 18, isElite: true, isBoss: false, pattern: { heavyChance: 0.2, guardChance: 0.1 },
});

const paladin = (overrides = {}) => makePlayerFixture({ name: '시험 기사', job: PALADIN, level: 45, hp: 400, mp: 500, ...overrides });

const actionsFor = (player, calls = []) => ({
    getSelectedSkill: () => {
        const skills = getJobSkills(player);
        return skills[(player.skillLoadout?.selected ?? 0) % skills.length] ?? null;
    },
    selectSkill: (name) => calls.push(['selectSkill', name]),
    combat: (kind) => calls.push(['combat', kind]),
    combatUseItem: () => {},
    useItem: () => {},
});

const renderPanel = (player, enemy, extra = {}) => renderStatic(createElement(CombatPanel, {
    player,
    actions: actionsFor(player),
    enemy,
    stats: calculateFullStats(player),
    isAiThinking: false,
    mobile: true,
    ...extra,
}));

/** 렌더된 칸 하나의 여는 태그(속성 문자열). */
const chipTags = (html) => [...html.matchAll(/<button[^>]*data-testid="combat-skill-chip"[^>]*>/g)].map((m) => m[0]);

// ── CL-03 기술 칸 ────────────────────────────────────────────────────

test('CL-03: 기술 칸은 getJobSkills 순서 그대로 가진 기술을 모두 담고 고른 기술 하나를 표시한다', () => {
    const player = paladin({ skillLoadout: { selected: 2, cooldowns: {} } });
    const skills = getJobSkills(player);
    assert.ok(skills.length >= 8, `팔라딘 기술 ${skills.length}개`);
    const tray = getCombatSkillTray(player);
    assert.deepEqual(tray.map((entry) => entry.name), skills.map((skill) => skill.name));
    assert.deepEqual(tray.filter((entry) => entry.selected).map((entry) => entry.name), [skills[2].name]);
    assert.ok(tray.every((entry) => entry.state === 'ready' && entry.canUse), '기력이 넉넉하면 모두 쓸 수 있다');
});

test('CL-03: 칸마다 재사용 대기 · 기력 판정이 따로다 (고른 기술 줄과 같은 판정)', () => {
    const skills = getJobSkills(paladin());
    const cheap = [...skills].sort((a, b) => (a.mp || 0) - (b.mp || 0))[0];
    const costly = [...skills].sort((a, b) => (b.mp || 0) - (a.mp || 0))[0];
    const player = paladin({ mp: cheap.mp, skillLoadout: { selected: 0, cooldowns: { [skills[1].name]: 2 } } });
    const tray = getCombatSkillTray(player);
    const byName = Object.fromEntries(tray.map((entry) => [entry.name, entry]));
    assert.equal(byName[skills[1].name].state, 'cooldown');
    assert.equal(byName[skills[1].name].cooldown, 2);
    assert.equal(byName[skills[1].name].canUse, false);
    if (costly.name !== skills[1].name) {
        assert.equal(byName[costly.name].state, 'energy');
        assert.equal(byName[costly.name].canUse, false);
    }
    if (cheap.name !== skills[1].name) assert.equal(byName[cheap.name].canUse, true);
});

test('CL-03: 칸을 누르면 고르고(selectSkill) 곧바로 쓴다 — 이미 고른 칸은 쓰기만, 못 쓰는 칸은 아무것도 보내지 않는다', () => {
    const player = paladin({ skillLoadout: { selected: 0, cooldowns: {} } });
    const tray = getCombatSkillTray(player);

    const calls = [];
    assert.equal(castTraySkill(actionsFor(player, calls), tray[3]), true);
    assert.deepEqual(calls, [['selectSkill', tray[3].name], ['combat', 'skill']], '고르기 다음에 쓰기');

    const again = [];
    assert.equal(castTraySkill(actionsFor(player, again), tray[0]), true);
    assert.deepEqual(again, [['combat', 'skill']], '이미 고른 기술은 고르기를 건너뛴다');

    const blocked = [];
    assert.equal(castTraySkill(actionsFor(player, blocked), { ...tray[1], canUse: false, state: 'cooldown' }), false);
    assert.deepEqual(blocked, []);
    assert.equal(castTraySkill(undefined, tray[1]), false);
});

test('CL-03: 전투 조작판은 기술마다 44px 칸을 그리고, 대기 · 기력 부족 칸은 누를 수 없다 — 순환 단추는 없다', () => {
    const skills = getJobSkills(paladin());
    const player = paladin({ mp: 60, skillLoadout: { selected: 0, cooldowns: { [skills[1].name]: 3 } } });
    const html = renderPanel(player, eliteEnemy());
    const chips = chipTags(html);
    assert.equal(chips.length, skills.length, '기술마다 칸 하나');
    for (const [index, skill] of skills.entries()) {
        const tag = chips[index];
        assert.ok(tag.includes(`data-skill-name="${skill.name}"`), skill.name);
        assert.match(tag, /\bmin-h-11\b/, `${skill.name} 칸 높이 44px`);
        assert.match(tag, /\bmin-w-11\b/, `${skill.name} 칸 너비 44px 이상`);
        const state = getCombatSkillTray(player)[index].state;
        assert.equal(tag.includes('disabled=""'), state !== 'ready', `${skill.name}(${state}) 누를 수 ${state === 'ready' ? '있다' : '없다'}`);
    }
    assert.equal(chips.filter((tag) => tag.includes('aria-current="true"')).length, 1, '고른 기술 하나');
    assert.ok(chips[0].includes('aria-current="true"'), '고른 기술은 selected 칸');
    assert.ok(!chips.some((tag) => tag.includes('aria-pressed')), '누르면 쓰는 단추라 켜고 끄는 단추가 아니다');
    assert.ok(chips[1].includes('data-skill-state="cooldown"'));
    assert.ok(html.includes(MSG.COMBAT_SKILL_CHIP_COOLDOWN(3)), '대기 턴이 칸에 보인다');
    assert.ok(!html.includes('combat-skill-cycle'), '이름 없는 순환 단추 없음');
    assert.ok(html.includes('data-testid="combat-skill-readiness"'), '고른 기술 줄(주 행동의 설명)은 남는다');
    // 칸 이름은 잘리지 않는다 — 칸은 한 줄로 늘어서고(줄지 않는다) 넘치면 그 줄만 가로로 민다.
    //   줄을 넘겨 쌓던 첫 구현은 기술 10개에서 247px라 375 × 667 보스전의 '도주'를 첫 화면 밖으로 밀었다(실제 폭은 e2e가 잰다).
    assert.ok(!chips.some((tag) => /\btruncate\b/.test(tag)));
    assert.ok(chips.every((tag) => /\bshrink-0\b/.test(tag)), '칸은 줄지 않는다');
    const rail = html.match(/<div[^>]*data-testid="combat-skill-rail"[^>]*>/)?.[0] ?? '';
    assert.match(rail, /\boverflow-x-auto\b/, '넘치는 칸은 그 줄 안에서 가로로 민다');
    assert.doesNotMatch(rail, /\bflex-wrap\b|\bgrid\b/, '칸은 줄을 넘겨 쌓이지 않는다');
});

test('CL-03: 칸마다 약점 표시 — 위력 기술이고 그 원소(기술 원소, 없으면 무기 원소)가 적의 약점일 때만, 전투 예고와 같은 판정', () => {
    // 칸을 누르면 곧바로 쓴다 — 고르기만 하던 순환 단추로 전투 예고의 '… 약점'을 미리 보던 길이 없어졌으므로 칸이 말한다.
    assert.equal(hitsEnemyWeakness({ type: '빛', mult: 2 }, { weakness: '빛' }, { elem: '물리' }), true);
    assert.equal(hitsEnemyWeakness({ type: '빛', mult: 0 }, { weakness: '빛' }, { elem: '물리' }), false, '위력 없는 기술');
    assert.equal(hitsEnemyWeakness({ mult: 2 }, { weakness: '화염' }, { elem: '화염' }), true, '기술 원소가 없으면 무기 원소');
    assert.equal(hitsEnemyWeakness({ type: '빛', mult: 2 }, { weakness: '어둠' }, { elem: '빛' }), false, '기술 원소가 우선');
    assert.equal(hitsEnemyWeakness({ type: '빛', mult: 2 }, {}, { elem: '빛' }), false, '약점 없는 적');
    assert.equal(hitsEnemyWeakness({ type: '빛', mult: 2 }, null, null), false);

    const base = paladin({ skillLoadout: { selected: 0, cooldowns: {} } });
    const player = { ...base, hp: calculateFullStats(base).maxHp };
    const stats = calculateFullStats(player);
    const enemy = { ...bossEnemy(), weakness: '빛' };
    const skills = getJobSkills(player);
    const tray = getCombatSkillTray(player, { enemy, stats });
    const weakNames = tray.filter((entry) => entry.weak).map((entry) => entry.name);
    assert.ok(weakNames.length >= 2 && weakNames.length < skills.length, `빛 약점 칸 ${weakNames.length}/${skills.length}`);
    assert.ok(getCombatSkillTray(player).every((entry) => !entry.weak), '적이 없으면 약점 표시도 없다');
    assert.ok(getCombatSkillTray(player, { enemy: bossEnemy(), stats }).every((entry) => !entry.weak), '약점 없는 적');

    // 전투 예고는 고른 기술 하나만 본다 — 칸마다 그 기술을 골랐을 때의 예고와 같은 답이다.
    for (const [index, skill] of skills.entries()) {
        const forecast = getCombatForecast({ player, enemy, stats, selectedSkill: skill, skillCooldown: 0 });
        assert.equal(forecast.response.endsWith(' 약점'), tray[index].weak, `${skill.name}: 예고 "${forecast.response}"`);
    }

    // 화면: 약점 칸에만 표시가 있고 칸의 접근성 이름에도 실린다.
    const html = renderPanel(player, enemy);
    const chips = chipTags(html);
    const markedNames = chips
        .filter((tag) => tag.includes('data-skill-weak="true"'))
        .map((tag) => tag.match(/data-skill-name="([^"]+)"/)?.[1]);
    assert.deepEqual(markedNames, weakNames);
    for (const tag of chips) {
        assert.equal(tag.includes(` · ${MSG.COMBAT_SKILL_CHIP_WEAK}"`), tag.includes('data-skill-weak="true"'), '약점은 칸의 이름에도 실린다');
    }
    assert.equal(html.split('data-testid="combat-skill-chip-weak"').length - 1, weakNames.length, '보이는 표시도 약점 칸 수만큼');

    // 무기 원소로 찌르는 위력 기술(암살 — 기술 원소 없음)도 표시하고, 위력 없는 기술(은신)은 표시하지 않는다.
    const assassin = makePlayerFixture({ name: '시험 암살자', job: '어쌔신', level: 45, hp: 400, mp: 500 });
    const assassinStats = calculateFullStats(assassin);
    const assassinWeak = getCombatSkillTray(assassin, { enemy: { ...eliteEnemy(), weakness: assassinStats.elem }, stats: assassinStats })
        .filter((entry) => entry.weak)
        .map((entry) => entry.name);
    assert.ok(assassinWeak.includes('암살'), `무기 원소(${assassinStats.elem})로 찌르는 기술: ${assassinWeak.join(', ')}`);
    assert.ok(!assassinWeak.includes('은신'), '위력 없는 기술은 표시가 없다');
});

// ── CL-06 보스 위협 칩 ────────────────────────────────────────────────

test('CL-06: 보스와 싸우는 동안 첫 신호는 보스 위협 칩이다 — 추정기는 나타날 때의 줄과 같다', () => {
    const player = paladin();
    const boss = bossEnemy();
    const view = buildCombatView({ player, enemy: boss, stats: calculateFullStats(player) });
    const threat = getEnemyThreat(player, boss);
    const expected = MSG.BOSS_COMBAT_CHIP(threat.pct, threat.hits);
    assert.equal(view.mobileCombatSignals[0]?.key, 'boss-threat');
    assert.equal(view.mobileCombatSignals[0]?.text, expected);
    assert.equal(getBossThreatChip(player, boss), expected);

    const html = renderPanel(player, boss);
    // 2026-10 에테르 유리: 칩 앞에 장식 아이콘(aria-hidden)이 있고 글자는 그 뒤다.
    assert.match(html, new RegExp(`data-testid="combat-signal-boss-threat"[^>]*>(?:<span class="ae-chip-icon" aria-hidden="true">.*?</span>)?${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`),
        '보스 화면에 칩이 그려진다(이전에는 보스에서 신호 줄 전체를 숨겼다)');
});

test('CL-06: 위협 칩은 정보만이다 — 물약 · 도주 권고가 없다', () => {
    const player = paladin();
    const text = getBossThreatChip(player, bossEnemy());
    assert.ok(text);
    for (const word of ['권장', '추천', '도주', '물약', '하세요', '하십시오']) {
        assert.ok(!text.includes(word), `"${word}" 없음: ${text}`);
    }
});

test('CL-06: 보스가 아닌 적 · 의뢰 우두머리에는 보스 칩이 없다', () => {
    const player = paladin();
    assert.equal(getBossThreatChip(player, eliteEnemy()), null);
    assert.equal(getBossThreatChip(player, { ...bossEnemy(), huntChampion: '신성한 호수' }), null);
    assert.equal(getBossThreatChip(player, null), null);
    const view = buildCombatView({ player, enemy: eliteEnemy(), stats: calculateFullStats(player) });
    assert.ok(!view.mobileCombatSignals.some((signal) => signal?.key === 'boss-threat'));
});

// ── CL-09 보스 카드 이름 ─────────────────────────────────────────────

test("CL-09: 보스 화면에서 '권장 대응'은 판단 요약 칸 하나뿐이고 보스 카드는 '공략 요령'이다", () => {
    const html = renderPanel(paladin(), bossEnemy());
    assert.equal(html.split('권장 대응').length - 1, 1, "'권장 대응'이 한 번만 나온다");
    assert.match(html, /data-testid="combat-forecast-label"[^>]*>권장 대응</, '남은 하나는 판단 요약 칸');
    assert.match(html, new RegExp(`data-testid="combat-boss-counter"[^>]*><div[^>]*>${MSG.COMBAT_BOSS_CLUE_LABEL}<`));
    assert.match(html, new RegExp(`data-testid="combat-boss-signature"[^>]*><div[^>]*>${MSG.COMBAT_BOSS_SIGNATURE_LABEL}<`));
    assert.notEqual(MSG.COMBAT_BOSS_CLUE_LABEL, '권장 대응');
});

test('CL-09: 보스 카드는 행동 단추 · 기술 칸 아래다 — 보스 위협 칩은 행동 위의 신호 줄에 남는다', () => {
    const html = renderPanel(paladin(), bossEnemy());
    const at = (testId) => {
        const index = html.indexOf(`data-testid="${testId}"`);
        assert.ok(index >= 0, `${testId}가 그려진다`);
        return index;
    };
    assert.ok(at('combat-signal-boss-threat') < at('combat-action-attack'), '보스 위협 칩은 행동 단추 위');
    assert.ok(at('combat-action-escape') < at('combat-skill-tray'), '도주 다음에 기술 칸');
    assert.ok(at('combat-skill-tray') < at('combat-boss-signature'), '보스 기믹 카드는 기술 칸 아래');
    assert.ok(at('combat-skill-tray') < at('combat-boss-counter'), '공략 요령 카드는 기술 칸 아래');
});

// ── VD-02 · GF-05 내 생명 · 기력 막대 · 적 초상 ───────────────────────

test('VD-02: 전투 조작판에 내 생명 · 기력 막대가 있고 실효 최대치를 그린다', () => {
    const player = paladin({ hp: 123, mp: 45 });
    const stats = calculateFullStats(player);
    const html = renderPanel(player, eliteEnemy());
    assert.ok(html.includes('data-testid="combat-player-vitals"'));
    assert.ok(html.includes(`>${123}/${stats.maxHp}<`), '생명 값');
    assert.ok(html.includes(`>${45}/${stats.maxMp}<`), '기력 값');
    assert.ok(!html.includes('data-vitals-flash'), '맞지 않았으면 번쩍임 없음');
    const vitalsAt = html.indexOf('combat-player-vitals');
    assert.ok(vitalsAt < html.indexOf('combat-action-attack'), '행동 단추 위에 있다');
});

test('GF-05: 맞은 순간 · 회복한 순간은 App의 피해 번쩍임 상태를 그대로 읽는다', () => {
    const base = { hp: 50, maxHp: 100, mp: 10, maxMp: 40 };
    const hit = renderStatic(createElement(CombatVitalsStrip, { ...base, damageFlash: true }));
    assert.ok(hit.includes('data-vitals-flash="damage"'));
    const healed = renderStatic(createElement(CombatVitalsStrip, { ...base, healFlash: true }));
    assert.ok(healed.includes('data-vitals-flash="heal"'));
    const calm = renderStatic(createElement(CombatVitalsStrip, base));
    assert.ok(!calm.includes('data-vitals-flash'));
    assert.ok(calm.includes('style="width:50%"'), '생명 막대 50%');
    assert.ok(calm.includes('style="width:25%"'), '기력 막대 25%');
    assert.ok(!/text-\[(?:[0-9]|10)px\]/.test(calm), '11px 미만 글자 없음');

    const player = paladin();
    const panelHit = renderPanel(player, eliteEnemy(), { damageFlash: true });
    assert.ok(panelHit.includes('data-vitals-flash="damage"'), '조작판이 번쩍임 상태를 막대로 넘긴다');
});

test('VD-02: 적의 무게는 보스 > 우두머리 > 정예 > 일반이다', () => {
    assert.equal(getEnemyRank(bossEnemy()), 'boss');
    assert.equal(getEnemyRank({ ...eliteEnemy(), huntChampion: '고요한 숲' }), 'champion');
    assert.equal(getEnemyRank(eliteEnemy()), 'elite');
    assert.equal(getEnemyRank({ ...eliteEnemy(), isElite: false }), 'normal');
    assert.equal(getEnemyRank(null), 'normal');
});

test('VD-02: 적 초상은 80px 그림(160px 원본의 정수 배율)이고 무게를 초상 · 교전 카드에 싣는다', () => {
    const player = paladin();
    for (const [enemy, rank] of [[bossEnemy(), 'boss'], [eliteEnemy(), 'elite'], [{ ...eliteEnemy(), isElite: false, name: '숲의 정령' }, 'normal']]) {
        const html = renderStatic(createElement(StatusBar, { player, stats: calculateFullStats(player), enemy, enemyHitCrit: false }));
        // 속성 순서는 계약이 아니다 — 그 testid를 가진 여는 태그가 무게를 싣는지만 본다.
        const openingTag = (testId) => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
        assert.ok(openingTag('enemy-status').includes(`data-enemy-rank="${rank}"`), `${rank} 교전 카드`);
        assert.ok(openingTag('enemy-portrait').includes(`data-enemy-rank="${rank}"`), `${rank} 초상`);
        assert.match(html, /style="width:80px;height:80px"/, '80px 그림');
        assert.equal(160 % 80, 0, '정수 배율');
    }
});
