import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { DROP_TABLES } from '../src/data/dropTables.ts';
import { LOOT_TABLE } from '../src/data/loot.ts';
import { MSG } from '../src/data/messages.ts';
import { MONSTERS } from '../src/data/monsters.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import { getMaterialCodexSources, getMonsterCodexDrops } from '../src/utils/codexDropSources.ts';
import { getSellPrice } from '../src/utils/equipmentUtils.ts';
import { makeItem } from '../src/utils/gameUtils.ts';
import MaterialCodex from '../src/components/codex/MaterialCodex.tsx';
import MonsterCodex from '../src/components/codex/MonsterCodex.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 Wave 61 — 도감의 전리품 · 획득처는 엔진이 실제로 돌리는 표를 말한다.
 *
 * `processLoot`는 드롭 표(`DROP_TABLES`)가 있는 몬스터에게 그 표만 돌리고 곧바로 반환한다 — 레거시 표(`LOOT_TABLE`)는
 * 드롭 표가 없는 몬스터에게만 쓰인다. 몬스터 기록의 "획득 가능 아이템"과 소재 기록의 "획득처"가 레거시 표만 읽던 동안
 * 두 표를 다 가진 80종 중 28종이 틀렸고(미라 → 나오지 않는 저주해제 주문서, 레드 드래곤 → 숨은 라그나로크),
 * 드롭 표만 있는 6종은 빈칸, 소재 56개 중 20개의 획득처가 틀렸다(와이번 날개 등 6개는 "탐험과 상점에서 확인").
 *
 * 오라클 = 엔진 그 자체: 항상 0을 내는 rng로 `processLoot`를 한 번 돌린다. 모든 판정이 `random() < chance` 모양이라
 * 확률이 0보다 큰 줄은 전부 통과하고 수량은 최솟값이 된다 — 결과는 "그 몬스터에게서 나올 수 있는 표 항목 전부"다.
 * 접두어가 붙으면 바탕 이름으로 되돌린다. 적 레벨 · 경험치는 비워 둔다 — 후반 강화 재료(적 레벨 규칙)와 고레벨 보너스
 * 장비(등급 풀 무작위)는 몬스터 표가 아니라 스폰 레벨이 정하므로 도감의 몬스터별 목록이 말하지 않는다(아래 별도 단언).
 */

const ORACLE_RNG = () => 0;
const ORACLE_NOW = () => 0;

const engineTableDrops = (name) => {
    const enemy = { name, baseName: name, isBoss: Boolean(MONSTERS[name]?.isBoss), dropMod: MONSTERS[name]?.dropMod };
    const { items } = processLoot(enemy, null, 1, ORACLE_RNG, ORACLE_NOW);
    return new Set(items.map((item) => (item.prefixed ? item.name.slice(item.prefixName.length + 1) : item.name)));
};

const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const sorted = (values) => [...values].sort();

// 모든 후보 이름을 처치한 플레이어 — MonsterCodex가 목록에 올리는 몬스터는 렌더 결과로 확인한다.
const candidateNames = sorted(new Set([
    ...Object.keys(MONSTERS),
    ...Object.keys(DROP_TABLES),
    ...Object.keys(LOOT_TABLE),
    ...Object.values(DB.MAPS).flatMap((map) => [
        ...(map.monsters || []),
        ...(map.bossMonsters || []),
        ...(typeof map.boss === 'string' ? [map.boss] : []),
    ]),
]));
const playerWhoKilled = (names) => makePlayerFixture({
    stats: {
        ...structuredClone(INITIAL_STATE.player.stats),
        killRegistry: Object.fromEntries(names.map((name) => [name, 1])),
    },
});

// 한 종만 처치한 플레이어로 그 기록을 펼쳐 렌더한다 — 기록이 열리면 MonsterCodex가 그 몬스터를 목록에 올린다는 뜻이다.
const renderMonsterDetail = (name) => renderStatic(createElement(MonsterCodex, {
    player: playerWhoKilled([name]),
    initialSelectedMonster: name,
}));

const renderedDrops = (html) => [...html.matchAll(/data-testid="codex-monster-drop"[^>]*>([^<]*)</g)].map((match) => match[1]);

let listedCache = null;
const listedMonsters = () => {
    if (listedCache) return listedCache;
    listedCache = new Map();
    for (const name of candidateNames) {
        const html = renderMonsterDetail(name);
        if (html.includes(`data-testid="codex-monster-detail-${escapeHtml(name)}"`)) listedCache.set(name, html);
    }
    return listedCache;
};

test('[몬스터 기록] 목록에 오르는 모든 몬스터의 전리품 칩은 엔진이 그 몬스터에게서 낼 수 있는 표 항목과 같다', () => {
    const listed = listedMonsters();
    assert.ok(listed.size > 200, `목록 몬스터 ${listed.size}종 — 렌더 경로가 비어 있지 않아야 한다`);
    const allKilledHtml = renderStatic(createElement(MonsterCodex, { player: playerWhoKilled(candidateNames) })).replace(/<!-- -->/g, '');
    assert.ok(allKilledHtml.includes(`>${listed.size}/${listed.size}<`), '헤더의 발견 수 = 렌더로 확인한 목록 수');

    const mismatches = [];
    for (const [name, html] of listed) {
        const expected = sorted(engineTableDrops(name));
        const shown = renderedDrops(html);
        assert.equal(new Set(shown).size, shown.length, `${name}: 칩 중복 없음`);
        if (JSON.stringify(sorted(shown)) !== JSON.stringify(expected.map(escapeHtml))) {
            mismatches.push(`${name}: 도감 [${shown.join(', ')}] / 엔진 [${expected.join(', ')}]`);
        }
        assert.deepEqual(sorted(getMonsterCodexDrops(name)), expected, `${name}: getMonsterCodexDrops = 엔진`);
    }
    assert.deepEqual(mismatches, [], `도감 전리품이 엔진과 다른 몬스터:\n${mismatches.join('\n')}`);
});

test('[몬스터 기록] 감사에서 틀렸던 행 — 나오지 않는 항목은 사라지고 숨어 있던 드롭(전설 각인 포함)이 보인다', () => {
    const listed = listedMonsters();
    const dropsOf = (name) => {
        assert.ok(listed.has(name), `${name}은(는) 도감 목록에 있어야 한다`);
        return renderedDrops(listed.get(name));
    };

    // 레거시 표에만 있고 엔진은 내지 않는 항목.
    for (const [monster, ghost] of [['미라', '저주해제 주문서'], ['거대 지네', '독사의 송곳니'], ['타락한 천사', '천상의갑주']]) {
        assert.equal(engineTableDrops(monster).has(ghost), false, `${monster} → ${ghost}는 엔진이 내지 않는다(픽스처 비공허)`);
        assert.equal(dropsOf(monster).includes(ghost), false, `${monster} 기록에 ${ghost}가 없어야 한다`);
    }
    // 드롭 표에만 있던 항목.
    for (const [monster, hidden] of [['레드 드래곤', '라그나로크'], ['숲 요정', '세계수의 검'], ['미라', '미라의 붕대']]) {
        assert.equal(engineTableDrops(monster).has(hidden), true, `${monster} → ${hidden}는 엔진이 낸다(픽스처 비공허)`);
        assert.equal(dropsOf(monster).includes(hidden), true, `${monster} 기록에 ${hidden}가 있어야 한다`);
    }
    // 드롭 표만 있는 몬스터는 빈칸이 아니다.
    const dropTableOnly = Object.keys(DROP_TABLES).filter((name) => !LOOT_TABLE[name] && listed.has(name));
    assert.ok(dropTableOnly.length >= 6, `드롭 표만 있는 목록 몬스터 ${dropTableOnly.length}종`);
    for (const name of dropTableOnly) {
        assert.ok(dropsOf(name).length > 0, `${name}: 드롭 표만 있어도 전리품이 보인다`);
        assert.ok(listed.get(name).includes(MSG.CODEX_MONSTER_DROPS_LABEL));
    }
});

test('[몬스터 기록] 기록은 처치로 열린다고 말한다', () => {
    const html = renderStatic(createElement(MonsterCodex, { player: makePlayerFixture() }));
    assert.ok(html.includes(MSG.CODEX_MONSTER_HEADER_HINT));
    assert.ok(html.includes(MSG.CODEX_MONSTER_UNDISCOVERED_HINT));
    assert.ok(MSG.CODEX_MONSTER_HEADER_HINT.includes('처치') && MSG.CODEX_MONSTER_UNDISCOVERED_HINT.includes('처치'));
    assert.ok(!html.includes('조우'), '기록은 조우가 아니라 처치로 열린다');
    // 처치하지 않은 몬스터는 펼쳐 둘 수 없다 — 기록은 killRegistry가 연다.
    const unseen = renderStatic(createElement(MonsterCodex, { player: makePlayerFixture(), initialSelectedMonster: '미라' }));
    assert.ok(!unseen.includes('codex-monster-detail-'));
});

test('[소재 기록] 모든 소재의 획득처는 엔진 전리품 표에 그 소재가 있는, 목록에 오르는 몬스터다', () => {
    const listed = [...listedMonsters().keys()];
    const engineDrops = new Map(listed.map((name) => [name, engineTableDrops(name)]));
    for (const material of DB.ITEMS.materials) {
        const expected = sorted(listed.filter((name) => engineDrops.get(name).has(material.name)));
        assert.deepEqual(sorted(getMaterialCodexSources(material.name)), expected, `${material.name} 획득처`);
    }
});

test('[소재 기록] 화면의 획득처 줄은 판정 함수를 그대로 그리고, 드롭되는 소재는 대체 문구를 쓰지 않는다', () => {
    for (const material of DB.ITEMS.materials) {
        const html = renderStatic(createElement(MaterialCodex, { codex: { materials: { [material.name]: true } } }));
        const sources = getMaterialCodexSources(material.name);
        const expected = MSG.CODEX_MATERIAL_SOURCES(sources.length > 0 ? sources.slice(0, 4).join(' · ') : MSG.CODEX_MATERIAL_SOURCE_SPECIAL)
            + (sources.length > 4 ? MSG.CODEX_MATERIAL_SOURCES_MORE(sources.length - 4) : '');
        const match = html.match(/data-testid="codex-material-sources"[^>]*>([\s\S]*?)<\/div>/);
        assert.ok(match, `${material.name}: 획득처 줄`);
        assert.equal(match[1].replace(/<!-- -->/g, ''), escapeHtml(expected), `${material.name}: 획득처 줄`);
        assert.ok(!html.includes('상점'), `${material.name}: 소재는 어느 상점에서도 팔지 않는다`);
    }
    for (const name of ['와이번 날개', '미라의 붕대', '뱀파이어 송곳니', '천사의 깃털', '폭풍 정수', '심연의 잉크']) {
        const sources = getMaterialCodexSources(name);
        assert.ok(sources.length > 0, `${name}: 엔진이 떨어뜨리는 소재`);
        const html = renderStatic(createElement(MaterialCodex, { codex: { materials: { [name]: true } } }));
        assert.ok(html.includes(sources[0]), `${name}: 첫 획득처 ${sources[0]}`);
        assert.ok(!html.includes(MSG.CODEX_MATERIAL_SOURCE_SPECIAL), `${name}: 대체 문구 아님`);
    }
    const empty = renderStatic(createElement(MaterialCodex, { codex: {} }));
    assert.ok(empty.includes(MSG.CODEX_MATERIAL_EMPTY_HINT));
    assert.ok(!empty.includes('상점'), '빈 기록 안내도 상점을 획득처로 말하지 않는다');
});

test('[소재 기록] 가격 줄은 상점 판매 경로가 실제로 주는 판매가다', () => {
    const shopState = (inv) => ({
        ...structuredClone(INITIAL_STATE),
        gameState: GS.SHOP,
        logs: [],
        player: { ...structuredClone(INITIAL_STATE.player), level: 60, gold: 1000, inv },
    });
    let nonTrivial = 0;
    for (const material of DB.ITEMS.materials) {
        const item = makeItem(material, () => 0.5, () => 1);
        const before = shopState([item]);
        const after = gameReducer(before, { type: AT.SELL_INVENTORY_ITEM, payload: { itemId: item.id } });
        assert.equal(after.player.inv.length, 0, `${material.name}: 팔린다`);
        const gained = after.player.gold - before.player.gold;
        assert.equal(gained, Math.floor((material.price || 0) * BALANCE.SELL_PRICE_RATIO), `${material.name}: 판매 비율`);
        assert.equal(getSellPrice(material), gained);

        const html = renderStatic(createElement(MaterialCodex, { codex: { materials: { [material.name]: true } } }));
        const match = html.match(/data-testid="codex-material-sell-price"[^>]*>([^<]*)</);
        assert.ok(match, `${material.name}: 가격 줄`);
        assert.equal(match[1], escapeHtml(MSG.CODEX_MATERIAL_SELL_PRICE(gained)), `${material.name}: 판매가 표시`);
        if (gained !== material.price) nonTrivial += 1;
    }
    assert.ok(nonTrivial > 40, '판매가와 구매가가 다른 소재가 대부분이다(픽스처 비공허)');
});

test('[후반 강화 재료] 적 레벨 규칙은 몬스터별 표가 아니다 — 몬스터 기록은 말하지 않고 소재 기록이 규칙으로 알린다', () => {
    const MAT = CONSTANTS.ENHANCE_MATERIAL_NAME;
    const MIN = BALANCE.ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL;
    const monster = '타락한 천사';
    assert.equal(getMonsterCodexDrops(monster).includes(MAT), false, '표에 강화 재료가 없는 몬스터(픽스처 비공허)');
    const lootAt = (level) => processLoot({ name: monster, baseName: monster, level }, null, 1, ORACLE_RNG, ORACLE_NOW)
        .items.filter((item) => item.name === MAT).length;
    assert.equal(lootAt(MIN - 1), 0, '기준 아래 레벨에서는 나오지 않는다');
    assert.equal(lootAt(MIN), 1, '같은 몬스터도 기준 레벨 이상이면 나온다 — 스폰 레벨이 정한다');

    const html = renderStatic(createElement(MaterialCodex, { codex: { materials: { [MAT]: true } } }));
    assert.ok(html.includes(escapeHtml(MSG.CODEX_ENHANCE_MATERIAL_LATE_SOURCE(MIN))));
});
