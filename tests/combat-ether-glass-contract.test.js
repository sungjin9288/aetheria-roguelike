import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import CombatPanel from '../src/components/tabs/CombatPanel.tsx';
import CombatVitalsStrip from '../src/components/combat/CombatVitalsStrip.tsx';
import EnemyPortrait from '../src/components/combat/EnemyPortrait.tsx';
import MonsterIcon from '../src/components/icons/MonsterIcon.tsx';
import DamageNumber from '../src/components/DamageNumber.tsx';
import CritPulse from '../src/components/CritPulse.tsx';
import PhaseBanner from '../src/components/PhaseBanner.tsx';
import { MSG } from '../src/data/messages.ts';
import { getJobSkills } from '../src/utils/gameUtils.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 에테르 유리 전투 화면 계약(wave 3 · combat).
 *
 *  1. 금빛 주 행동은 화면에 하나 — '공격'만 primary, 기술 · 아이템은 glass, 도주는 ghost(낮은 위험).
 *  2. 행동 단추마다 아이콘 타일(`aether-combat-action-icon` — 공용 가독성 e2e가 28px 이상을 잰다)이 있다.
 *  3. 신호 칩의 색은 판정의 의미에서 온다 — 정예 위협 = threat 칩, 보스 위협 = threat 칩 + 금빛 테두리, 추천 문구 없음.
 *  4. 적 약화 칩은 MSG 상태 이상 라벨 + 남은 턴(`MSG.ENEMY_DOT_CHIP_TURNS`)이다.
 *  5. 전투 화면이 그리는 글은 하드코딩 색(#hex · rgba) · 그림 문자(✦ ⚡ 💀) · 회색 · 장밋빛 유틸리티를 쓰지 않는다(VD-06 · VD-10 · VD-13).
 *  6. 보스 초상만 정적 마법진을 든다. 그림은 80px 그대로다.
 */

const eliteEnemy = (overrides = {}) => ({
    name: '정예 숲의 정령', baseName: '숲의 정령', level: 2, hp: 134, maxHp: 134, atk: 16, def: 5,
    exp: 24, gold: 18, isElite: true, isBoss: false, pattern: { heavyChance: 0.2, guardChance: 0.1 }, ...overrides,
});

const bossEnemy = () => ({
    name: '고대 호수의 수호신', baseName: '고대 호수의 수호신', level: 35, hp: 3200, maxHp: 3200, atk: 120, def: 54,
    exp: 2400, gold: 1800, isElite: false, isBoss: true, pattern: { heavyChance: 0.4, guardChance: 0.45 },
});

const paladin = (overrides = {}) => makePlayerFixture({ name: '시험 기사', job: '팔라딘', level: 45, hp: 400, mp: 500, ...overrides });

const actionsFor = (player) => ({
    getSelectedSkill: () => getJobSkills(player)[0] ?? null,
    selectSkill: () => {},
    combat: () => {},
    combatUseItem: () => {},
    useItem: () => {},
});

const renderPanel = (player, enemy) => renderStatic(createElement(CombatPanel, {
    player, actions: actionsFor(player), enemy, stats: calculateFullStats(player), isAiThinking: false, mobile: true,
}));

const openingTag = (html, testId) => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';

/** 하드코딩 색 · 그림 문자 · 예전 팔레트 유틸리티 — 토큰 밖의 색. */
const OFF_TOKEN = [
    [/#[0-9a-fA-F]{3,8}\b/, '#hex 색'],
    [/rgba?\(\s*\d/, '숫자 rgb(a) 색'],
    [/[✦⚡💀]/u, '그림 문자'],
    [/\b(?:text|bg|border)-(?:rose|emerald|slate|amber|cyan|sky|white|black)\b/, '토큰 밖 팔레트 유틸리티'],
];

const assertOnToken = (html, where) => {
    for (const [pattern, label] of OFF_TOKEN) {
        assert.doesNotMatch(html, pattern, `${where}: ${label}`);
    }
};

test('주 행동은 공격 하나 — 기술 · 아이템은 유리, 도주는 낮은 위험', () => {
    const html = renderPanel(paladin(), eliteEnemy());
    const variants = Object.fromEntries(['attack', 'skill', 'item', 'escape'].map((key) => {
        const tag = openingTag(html, `combat-action-${key}`);
        return [key, tag.match(/data-variant="([a-z]+)"/)?.[1]];
    }));
    assert.deepEqual(variants, { attack: 'primary', skill: 'glass', item: 'glass', escape: 'ghost' });
    assert.equal(html.split('data-variant="primary"').length - 1, 1, '금빛 주 행동은 하나');
    assert.equal(html.split('aether-combat-action-icon').length - 1, 4, '행동 단추마다 아이콘 타일');
});

test('신호 칩의 색은 의미에서 온다 — 정예 = 위협 칩, 보스 = 위협 칩 + 금빛 테두리', () => {
    const elite = renderPanel(paladin(), eliteEnemy());
    const eliteChip = openingTag(elite, 'combat-signal-elite');
    assert.match(eliteChip, /\bae-chip-threat\b/);
    assert.doesNotMatch(eliteChip, /\bae-combat-signal-boss\b/);

    const boss = renderPanel(paladin(), bossEnemy());
    const bossChip = openingTag(boss, 'combat-signal-boss-threat');
    assert.match(bossChip, /\bae-chip-threat\b/);
    assert.match(bossChip, /\bae-combat-signal-boss\b/);
});

test('적 약화 칩은 MSG 상태 이상 라벨과 남은 턴이다', () => {
    const html = renderPanel(paladin(), eliteEnemy({ stunnedTurns: 2, fearTurns: 1, dots: ['bleed'], dotTurns: { bleed: 3 } }));
    const tag = openingTag(html, 'combat-enemy-debuff-chip');
    assert.match(tag, /data-enemy-debuff-count="3"/);
    const stun = MSG.ENEMY_DOT_CHIP_TURNS(MSG.STATUS_LABELS.stun, 2);
    assert.ok(html.includes(`${stun} +2`), '첫 약화 + 나머지 수');
    const aria = tag.match(/aria-label="([^"]*)"/)?.[1] ?? '';
    assert.ok(aria.includes(MSG.ENEMY_DOT_CHIP_TURNS(MSG.STATUS_LABELS.fear, 1)), '공포 남은 턴');
    assert.ok(aria.includes(MSG.ENEMY_DOT_CHIP_TURNS(MSG.DOT_LABELS.bleed, 3)), '출혈 남은 턴');
});

test('전투 화면의 글은 토큰 색만 쓴다 — 하드코딩 색 · 그림 문자 · 예전 팔레트 없음', () => {
    const player = paladin({ hp: 120, mp: 30 });
    assertOnToken(renderPanel(player, bossEnemy()), 'CombatPanel(보스)');
    assertOnToken(renderPanel(player, eliteEnemy({ stunnedTurns: 1 })), 'CombatPanel(정예)');
    assertOnToken(renderStatic(createElement(CombatVitalsStrip, { hp: 10, maxHp: 40, mp: 5, maxMp: 20, damageFlash: true })), 'CombatVitalsStrip');
    assertOnToken(renderStatic(createElement(EnemyPortrait, { enemy: bossEnemy(), rank: 'boss' })), 'EnemyPortrait');
    assertOnToken(renderStatic(createElement(MonsterIcon, { name: '__없는 이름__', discovered: false, isBoss: false, size: 46 })), 'MonsterIcon 실루엣');
    assertOnToken(renderStatic(createElement(DamageNumber, { amount: { value: 12, isHeal: false } })), 'DamageNumber');
    assertOnToken(renderStatic(createElement(CritPulse, { active: true, tone: 'heavy' })), 'CritPulse');
    assertOnToken(renderStatic(createElement(PhaseBanner, { phase: { n: 3, name: '최후의 형상' } })), 'PhaseBanner');
});

test('숫자는 고정폭 숫자 글꼴이다 — 내 생명 · 기력 값과 떠오르는 숫자', () => {
    const vitals = renderStatic(createElement(CombatVitalsStrip, { hp: 10, maxHp: 40, mp: 5, maxMp: 20 }));
    assert.match(openingTag(vitals, 'combat-player-hp-value'), /\bfont-fira\b[^"]*\btabular-nums\b|\btabular-nums\b[^"]*\bfont-fira\b/);
    assert.match(vitals, /role="meter"[^>]*aria-label="생명"/, '생명 막대는 이름 있는 meter');
    const number = renderStatic(createElement(DamageNumber, { amount: { value: 7, isHeal: true } }));
    assert.match(openingTag(number, 'damage-number'), /\bfont-fira\b/);
});

test('보스 초상만 정적 마법진을 든다 — 그림은 80px 그대로', () => {
    const boss = renderStatic(createElement(EnemyPortrait, { enemy: bossEnemy(), rank: 'boss' }));
    assert.ok(boss.includes('ae-enemy-magic-circle'), '보스 마법진');
    assert.match(boss, /style="width:80px;height:80px"/);
    for (const rank of ['elite', 'champion', 'normal']) {
        const html = renderStatic(createElement(EnemyPortrait, { enemy: eliteEnemy(), rank }));
        assert.ok(!html.includes('ae-enemy-magic-circle'), `${rank}에는 마법진 없음`);
        assert.ok(html.includes('ae-enemy-ground'), `${rank} 발밑 그림자`);
    }
});
