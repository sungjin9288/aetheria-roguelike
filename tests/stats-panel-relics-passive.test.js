import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import StatsPanel from '../src/components/StatsPanel.tsx';
import { MSG } from '../src/data/messages.ts';
import { RELICS } from '../src/data/relics.ts';
import { getTraitProfile } from '../src/utils/runProfileUtils.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 소유자 결정 2026-10-26 — 기록의 상태(능력치) 탭.
 *   D2: 보유 유물 목록은 설정 탭에서 이 탭으로 옮겼고 펼친 채로 보인다(유물이 없으면 칸이 없다).
 *   D28: 패시브 "방어력 +4%"는 항목마다 한 덩어리로 줄을 넘긴다 — 402px에서 "+4%"만 다음 줄로 떨어졌다.
 */

const relic = (name) => {
    const found = RELICS.find((entry) => entry.name === name);
    assert.ok(found, name);
    return { ...found };
};

const passiveParts = (html) => [...html.matchAll(/<span data-testid="stats-passive-part" class="([^"]*)">([^<]*)<\/span>/gu)]
    .map(([, className, text]) => ({ className, text }));

test('D28: 패시브 수치는 이름과 한 덩어리(줄바꿈 없음)이고, 항목 사이만 줄을 넘길 수 있다', () => {
    const player = makePlayerFixture({ name: '용사', level: 10 });
    const base = getTraitProfile(player, null);
    const stats = { traitProfile: { ...base, bonus: { ...base.bonus, atkMult: 1.04, defMult: 1.04, critBonus: 0, mpFlat: 0 } } };
    const parts = passiveParts(renderStatic(createElement(StatsPanel, { player, stats })));
    assert.deepEqual(parts.map((part) => part.text), ['공격력 +4% /', '방어력 +4%'], '구분자는 앞 항목에 붙는다');
    for (const part of parts) assert.match(part.className, /(^|\s)whitespace-nowrap(\s|$)/u, part.text);
});

test('D28: 수치 조각이 없는 성향은 데이터 문구를 같은 구분자로 나눠 같은 덩어리로 그린다', () => {
    const player = makePlayerFixture({ name: '용사', level: 10 });
    const base = getTraitProfile(player, null);
    const stats = { traitProfile: { ...base, passiveLabel: '방어력 +10% / 치명타 방어 강화', bonus: { atkMult: 1, defMult: 1, critBonus: 0, mpFlat: 0 } } };
    const parts = passiveParts(renderStatic(createElement(StatsPanel, { player, stats })));
    assert.deepEqual(parts.map((part) => part.text), ['방어력 +10% /', '치명타 방어 강화']);
});

test('D2: 보유 유물은 상태 탭에 펼친 채로 보이고, 보유 수 · 이름 · 효과를 든다', () => {
    const owned = [relic('혼돈의 심장'), relic('암석 피부')];
    const html = renderStatic(createElement(StatsPanel, { player: makePlayerFixture({ name: '용사', relics: owned }), stats: null }));
    const at = html.indexOf('data-testid="stats-relic-section"');
    assert.ok(at >= 0, '유물 칸이 있다');
    const section = html.slice(at, html.indexOf('</section>', at));
    assert.ok(section.includes(MSG.STATS_RELIC_TITLE(2, 5)));
    assert.equal(section.split('data-testid="stats-relic-row"').length - 1, owned.length);
    assert.ok(!section.includes('<details'), '접히지 않는다');
    for (const entry of owned) assert.ok(section.includes(entry.name), entry.name);

    const none = renderStatic(createElement(StatsPanel, { player: makePlayerFixture({ name: '용사', relics: [] }), stats: null }));
    assert.ok(!none.includes('data-testid="stats-relic-section"'), '유물이 없으면 칸이 없다');
});
