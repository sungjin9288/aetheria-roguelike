import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.ts';
import { SEASON_REWARDS } from '../src/data/seasonPass.ts';
import SeasonPassPanel from '../src/components/tabs/SeasonPassPanel.tsx';
import WeaponCodex from '../src/components/codex/WeaponCodex.tsx';
import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import { getClaimableSeasonRewards } from '../src/utils/seasonPassPresentation.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave-3 기록 탭 B(에테르 유리) — 다시 그린 화면이 지켜야 하는 동작 두 가지.
 *
 * 1. 시즌 단계 길(30마디)은 장식이지만 거짓말하면 안 된다 — 받은 마디 수 = 받은 단계 수, 금빛(받을 수 있음) 마디 수 =
 *    "받을 보상" 칸의 줄 수. 마디 판정이 수령 기록이나 도달 단계를 놓치면 길과 목록이 갈라진다.
 * 2. 도감의 발견 우선(Wave 103) — 아직 얻지 않은 장비 · 전설 각인은 이름 · 누르는 단추가 없는 조용한 타일(`???`)로만 그린다.
 */

const countNodes = (html, state) => (html.match(new RegExp(`class="ab-node[^"]*\\bis-${state}\\b`, 'g')) || []).length;

test('시즌 단계 길: 받은 마디 = 받은 단계, 금빛 마디 = 받을 보상 줄', () => {
    const cases = [
        { tier: 3, xp: 650, claimed: [1, 2] },
        { tier: 12, xp: 2450, claimed: [1, 2, 3, 5, 8] },
        { tier: 0, xp: 40, claimed: [] },
        { tier: 30, xp: 6000, claimed: Array.from({ length: 29 }, (_, i) => i + 1) },
    ];
    for (const { tier, xp, claimed } of cases) {
        const player = makePlayerFixture({ seasonPass: { tier, xp, claimed, isPremium: false, seasonId: 'S1' } });
        const html = renderStatic(createElement(SeasonPassPanel, { player, dispatch: () => {} }));
        const track = html.match(/data-testid="season-track"[^>]*>([\s\S]*?)<\/div>/u)?.[1] || '';
        assert.equal((track.match(/class="ab-node/g) || []).length, 30, '마디는 30개');
        assert.equal(track.includes('aria-hidden'), false, '마디 자체가 아니라 길 전체가 숨는다');
        assert.match(html, /aria-hidden="true" data-testid="season-track"/u, '수치는 옆 글자가 말하므로 길은 보조 기술에 숨긴다');

        const claimable = getClaimableSeasonRewards(SEASON_REWARDS, tier, claimed);
        assert.equal(countNodes(track, 'claimed'), claimed.length, `tier ${tier}: 받은 마디`);
        assert.equal(countNodes(track, 'claimable'), claimable.length, `tier ${tier}: 금빛 마디`);
        const claimButtons = (html.match(/data-testid="season-claim-\d+"/g) || []).length;
        assert.equal(claimButtons, claimable.length, `tier ${tier}: 받기 단추 수 = 금빛 마디 수`);
    }
});

test('장비 도감: 발견하지 않은 장비는 이름 · 단추 없는 조용한 타일이다', () => {
    const weapons = DB.ITEMS.weapons || [];
    const [found, ...rest] = weapons;
    const html = renderStatic(createElement(WeaponCodex, { codex: { weapons: { [found.name]: { count: 1 } } } }));

    assert.ok(html.includes(`data-testid="codex-equipment-item-${found.name}"`), '발견한 장비는 누를 수 있다');
    const hidden = rest.filter((item) => !html.includes(item.name));
    assert.equal(hidden.length, rest.length, '발견하지 않은 장비 이름은 그리지 않는다');
    const quietTiles = (html.match(/class="ab-tile is-undiscovered/g) || []).length;
    assert.equal(quietTiles, rest.length, '발견하지 않은 장비마다 조용한 타일 하나');
    const buttons = (html.match(/<button[^>]*class="ab-tile/g) || []).length;
    assert.equal(buttons, 1, '타일 단추는 발견한 장비뿐이다');
});

test('전설 도감: 미발견 각인은 단추가 아니고 이름을 말하지 않는다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(LegendaryCodex, { player }));
    const collection = html.match(/data-testid="legendary-codex-collection"[\s\S]*?<\/details>/u)?.[0] || '';
    assert.ok(collection.length > 0);
    assert.equal((collection.match(/<button/g) || []).length, 0, '발견 0개면 누를 타일이 없다');
    assert.ok((collection.match(/ab-tile is-undiscovered/g) || []).length > 0, '조용한 타일로 자리만 보인다');
});
