import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import CraftingPanel from '../src/components/tabs/CraftingPanel.tsx';
import MonsterCodex from '../src/components/codex/MonsterCodex.tsx';
import MapNavigator from '../src/components/MapNavigator.tsx';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { RELICS } from '../src/data/relics.ts';
import signatureSetsData from '../src/data/signatureSets.json' with { type: 'json' };
import { getAscensionOutcome } from '../src/utils/ascensionPreview.ts';
import { getDiscoveredBossSignatureDrops, getBossSignatureDrops } from '../src/utils/bossSignatureHint.ts';
import { getMonsterCodexDrops } from '../src/utils/codexDropSources.ts';
import { getEndgameJourney } from '../src/utils/endgameJourney.ts';
import { getMapDiscoveredSignatureDrops, getMapSignatureDrops } from '../src/utils/mapSignatureHints.ts';
import {
    getVisibleCraftRecipes,
    isEquipmentDiscovered,
    isSignatureName,
    SIGNATURE_NAMES,
    withoutUndiscoveredSignatures,
} from '../src/utils/signatureDiscovery.ts';
import { getSignatureSetGuidance } from '../src/utils/signatureSetBonus.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 Wave 103 — 발견형 표면 계약 (소유자 결정 §107.6).
 *
 *   전설 각인 획득처: 얻은 뒤에만 공개 — 지도 · 이동 · 보스 배너/기록 · 몬스터 기록 · 제작법 · 세트 후보가 같은 판정
 *     (`isSignatureDiscovered` = 도감 등록)을 읽는다.
 *   진 엔딩 · 계승 목표: 조건 숨김, 첫 단서(첫 원시의 파편) 뒤에만.
 *   유물 · 장비 미발견 목록: 미보유 이름만 숨김(조합 힌트 · 수는 그대로).
 *   업적: 현행 유지(이 파일 밖).
 *
 * 공략 안내 대신 도달 가능성을 테스트가 보장한다 — 숨긴 것은 여전히 실제로 얻을 수 있다(엔진 표 · 정예 칭호 · 진 보스 정산 계약).
 */

const withCodex = (names, overrides = {}) => {
    const base = makePlayerFixture();
    const bucket = (key) => ({ ...(base.stats.codex?.[key] || {}), ...Object.fromEntries(names.map((name) => [name, true])) });
    return makePlayerFixture({
        ...overrides,
        stats: { ...base.stats, codex: { ...base.stats.codex, weapons: bucket('weapons'), armors: bucket('armors'), shields: bucket('shields') } },
    });
};
const fresh = () => withCodex([]);

test('각인 판정 한 곳: 도감에 없으면 지도 · 보스 · 몬스터 기록 · 제작법 어디에서도 각인 이름이 나오지 않는다', () => {
    const player = fresh();
    for (const name of SIGNATURE_NAMES) assert.equal(isEquipmentDiscovered(name, player), false, name);

    for (const mapName of Object.keys(DB.MAPS)) {
        assert.deepEqual(getMapDiscoveredSignatureDrops(mapName, player), [], mapName);
    }
    const bossesWithSignature = Object.keys(DB.MONSTERS).filter((name) => getBossSignatureDrops(name).length > 0);
    assert.ok(bossesWithSignature.length >= 10, `각인을 내는 몬스터 ${bossesWithSignature.length}종 — 픽스처 비공허`);
    for (const name of bossesWithSignature) {
        assert.deepEqual(getDiscoveredBossSignatureDrops(name, player), [], name);
        assert.equal(withoutUndiscoveredSignatures(getMonsterCodexDrops(name), player).some(isSignatureName), false, name);
    }
    const signatureRecipes = (DB.ITEMS.recipes || []).filter((recipe) => isSignatureName(recipe.name));
    assert.ok(signatureRecipes.length >= 3, '각인 제작법 픽스처 비공허');
    assert.equal(getVisibleCraftRecipes(DB.ITEMS.recipes || [], player).some((recipe) => isSignatureName(recipe.name)), false);
});

test('각인을 얻으면 그 각인만 같은 표면에 다시 보인다 — 다른 각인은 숨은 채다', () => {
    const boss = Object.keys(DB.MONSTERS).find((name) => getBossSignatureDrops(name).length > 1);
    const [known, unknown] = getBossSignatureDrops(boss);
    const player = withCodex([known.name]);

    assert.deepEqual(getDiscoveredBossSignatureDrops(boss, player).map((drop) => drop.name), [known.name]);
    const chips = withoutUndiscoveredSignatures(getMonsterCodexDrops(boss), player);
    assert.ok(chips.includes(known.name));
    assert.ok(!chips.includes(unknown.name));

    const mapName = Object.keys(DB.MAPS).find((name) => getMapSignatureDrops(name).some((drop) => drop.name === known.name));
    assert.ok(mapName, '그 각인이 나오는 지역이 있다');
    assert.ok(getMapDiscoveredSignatureDrops(mapName, player).every((drop) => drop.name === known.name));

    const recipe = (DB.ITEMS.recipes || []).find((entry) => isSignatureName(entry.name));
    const visible = getVisibleCraftRecipes(DB.ITEMS.recipes || [], withCodex([recipe.name]));
    assert.ok(visible.includes(recipe));
    assert.equal(visible.filter((entry) => isSignatureName(entry.name)).length, 1);
});

test('제작소 화면: 각인 제작법은 그 각인을 얻기 전에는 그려지지 않는다 (렌더)', () => {
    const signatureRecipes = (DB.ITEMS.recipes || []).filter((recipe) => isSignatureName(recipe.name));
    const freshHtml = renderStatic(createElement(CraftingPanel, { player: fresh() }));
    assert.ok(freshHtml.includes('data-testid="crafting-recipe-'), '일반 제작법은 그려진다(렌더 경로 비공허)');
    for (const recipe of signatureRecipes) {
        assert.ok(!freshHtml.includes(`data-testid="crafting-recipe-${recipe.id}"`), `${recipe.name} 제작법 숨김`);
    }
    const [first] = signatureRecipes;
    const knownHtml = renderStatic(createElement(CraftingPanel, { player: withCodex([first.name]) }));
    assert.ok(knownHtml.includes(`data-testid="crafting-recipe-${first.id}"`), `${first.name}을(를) 얻으면 제작법이 보인다`);
});

test('몬스터 기록 화면: 처치한 보스의 전리품 칩에 미발견 각인 이름이 없다 (렌더)', () => {
    const boss = Object.keys(DB.MONSTERS).find((name) => getBossSignatureDrops(name).length > 0 && getMonsterCodexDrops(name).length > 0);
    const killer = (player) => ({ ...player, stats: { ...player.stats, killRegistry: { [boss]: 1 } } });
    const html = renderStatic(createElement(MonsterCodex, { player: killer(fresh()), initialSelectedMonster: boss }));
    assert.ok(html.includes('codex-monster-drop'), '전리품 칩이 그려진다(렌더 경로 비공허)');
    for (const drop of getBossSignatureDrops(boss)) assert.ok(!html.includes(drop.name), `${boss}: ${drop.name} 숨김`);
});

test('지도 화면: 어느 지역에 서 있어도 기본 선택 지역의 미발견 각인 이름 · 확률이 그려지지 않는다 (렌더)', () => {
    const render = (player, loc) => renderStatic(createElement(MapNavigator, {
        player: { ...player, loc, level: 99 }, grave: [], stats: { maxHp: 150, maxMp: 50 }, actions: {},
    }));
    let shownWhenKnown = 0;
    for (const loc of Object.keys(DB.MAPS)) {
        const unknownHtml = render(fresh(), loc);
        for (const name of SIGNATURE_NAMES) assert.ok(!unknownHtml.includes(name), `${loc}: ${name}`);
        const knownHtml = render(withCodex(SIGNATURE_NAMES), loc);
        if (SIGNATURE_NAMES.some((name) => knownHtml.includes(name))) shownWhenKnown += 1;
    }
    assert.ok(shownWhenKnown >= 3, `각인을 모두 얻으면 ${shownWhenKnown}곳에서 다시 노릴 곳이 보인다 — 렌더 경로 비공허`);
});

test('세트 후보: 아직 도감에 없는 각인은 이름 대신 미발견 문구로 — 판정 필드 discovered', () => {
    let checked = 0;
    for (const def of Object.values(signatureSetsData.sets)) {
        const first = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((item) => item.name === def.members[0]);
        const slot = first.type === 'weapon' ? 'weapon' : first.type === 'shield' ? 'offhand' : 'armor';
        const job = (first.jobs || [])[0] || '모험가';
        const guidance = getSignatureSetGuidance(makePlayerFixture({ job, level: 99, equip: { [slot]: first } }));
        for (const candidate of guidance?.nextItems || []) {
            checked += 1;
            assert.equal(candidate.discovered, false, candidate.name);
            const known = getSignatureSetGuidance(withCodex([candidate.name], { job, level: 99, equip: { [slot]: first } }));
            assert.equal(known.nextItems.find((entry) => entry.name === candidate.name).discovered, true);
        }
    }
    assert.ok(checked >= 3, `세트 후보 ${checked}개 — 픽스처 비공허`);
    assert.equal(typeof MSG.SIGNATURE_SET_UNKNOWN_CANDIDATE, 'string');
    assert.ok(!SIGNATURE_NAMES.some((name) => MSG.SIGNATURE_SET_UNKNOWN_CANDIDATE.includes(name)));
});

test('진 엔딩 봉인 · 계승 목표: 첫 파편 전에는 아무 조건도 보이지 않는다', () => {
    for (const rank of [0, 1, 2, 3, 6, 10]) {
        const player = makePlayerFixture({ meta: { ...makePlayerFixture().meta, prestigeRank: rank, endgame: { primalShards: 0, trueEndingSeen: false } }, stats: { ...makePlayerFixture().stats, demonKingSlain: 3 } });
        assert.equal(getEndgameJourney(player), null, `rank ${rank}`);
        assert.equal('upcomingMilestone' in getAscensionOutcome({ prestigeRank: rank }), false, `rank ${rank}: 다음 계승 목표 미리보기 없음`);
    }
});

test('미보유 유물 추천 문구는 수만 말한다 — 유물 이름이 섞이지 않는다', () => {
    const line = MSG.BUILD_ADVICE_UNOWNED_RELICS(3);
    assert.match(line, /3개/);
    assert.ok(RELICS.length > 50, '유물 픽스처 비공허');
    for (const relic of RELICS) assert.ok(!line.includes(relic.name), relic.name);
});
