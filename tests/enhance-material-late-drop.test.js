import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { BALANCE, CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { DROP_TABLES } from '../src/data/dropTables.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { processLoot } from '../src/systems/CombatEngine.loot.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import MaterialCodex from '../src/components/codex/MaterialCodex.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 39 — 후반 강화 재료 드롭 (소유자 결정 (b) "후반 드롭").
 *
 * 강화 재료는 Lv3~18 지역의 코볼트 · 광석골렘만 떨어뜨렸다. 그래서 225 모델시간 동안 16시드 중앙값이 10개였고
 * Lv40 이후는 16시드 합계 2개였다(원장 §38.2). 강화는 +10까지 재료 약 87개와 골드 약 88만을 쓰는 골드 소비처인데,
 * 재료가 그 문을 잠그고 있었다. 이제 적 레벨이 `ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL` 이상이면 드롭 표와 무관하게
 * 강화 재료를 판정한다. 표에 줄을 넣는 방식은 쓰지 않는다 — 표가 있는 적은 고레벨 보너스 장비 판정을 건너뛰기 때문이다.
 */

const MAT = CONSTANTS.ENHANCE_MATERIAL_NAME;
const MIN_LEVEL = BALANCE.ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL;
const countMat = (items) => items.filter((item) => item?.name === MAT).length;
const always = (value) => () => value;
const countingRng = (value) => {
    const rng = () => { rng.calls += 1; return value; };
    rng.calls = 0;
    return rng;
};
const mulberry32 = (seed) => () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const enemyOf = (name, level, extra = {}) => ({
    name, baseName: name, level, exp: 10 + level * 10, hp: 1, maxHp: 1, atk: 1, def: 0, gold: 1, ...extra,
});
const NOW = () => 1;

test('[상수] 후반 드롭 기준은 초반 공급원(Lv18 지역) 뒤이고, 일반 확률은 보스 확률보다 낮다', () => {
    assert.equal(MIN_LEVEL, 25);
    assert.ok(BALANCE.ENHANCE_MATERIAL_LATE_DROP_CHANCE > 0 && BALANCE.ENHANCE_MATERIAL_LATE_DROP_CHANCE < 0.1);
    assert.ok(BALANCE.ENHANCE_MATERIAL_LATE_BOSS_DROP_CHANCE > BALANCE.ENHANCE_MATERIAL_LATE_DROP_CHANCE);
    // 일괄 판매가 팔지 않는 가격대여야 모은 재료가 한 번의 버튼으로 사라지지 않는다.
    const material = DB.ITEMS.materials.find((item) => item.name === MAT);
    assert.ok(material.price > BALANCE.INVENTORY_JUNK_MATERIAL_PRICE_MAX);
});

test('[드롭 표가 있는 적] 기준 이상이면 표의 전리품은 그대로 두고 강화 재료가 더해진다', () => {
    const name = '레드 드래곤';
    assert.ok(DROP_TABLES[name], '전제: 드롭 표가 있는 적');
    assert.ok(!DROP_TABLES[name].some((entry) => entry.item === MAT), '전제: 표에는 강화 재료가 없다');
    const hit = processLoot(enemyOf(name, 25), null, 1, always(0), NOW);
    assert.equal(countMat(hit.items), 1);
    for (const entry of DROP_TABLES[name]) {
        assert.ok(hit.items.some((item) => item.name === entry.item || item.baseItemName === entry.item), `표 전리품 ${entry.item} 유지`);
    }
    const miss = processLoot(enemyOf(name, 25), null, 1, always(0.99), NOW);
    assert.equal(countMat(miss.items), 0);
});

test('[드롭 표가 없는 적] 기준 이상이면 강화 재료가 나오고 고레벨 보너스 장비 판정도 그대로 남는다', () => {
    const name = '변이 실험체';
    assert.ok(!DROP_TABLES[name], '전제: 드롭 표가 없는 적(보너스 장비만 떨어뜨린다)');
    const hit = processLoot(enemyOf(name, 32), null, 1, always(0), NOW);
    assert.equal(countMat(hit.items), 1);
    assert.ok(hit.items.some((item) => ['weapon', 'armor', 'shield'].includes(item.type)), '보너스 장비가 여전히 나온다');
});

test('[기준 아래] 초반 적은 예전과 같다 — 강화 재료는 표에 있는 만큼만, 난수도 더 쓰지 않는다', () => {
    // 광석골렘(Lv18)은 표에 강화 재료가 있다(0.24, 1~2개). 난수 0이면 1개다.
    assert.equal(countMat(processLoot(enemyOf('광석골렘', 18), null, 1, always(0), NOW).items), 1);
    assert.equal(countMat(processLoot(enemyOf('가상의 적', MIN_LEVEL - 1), null, 1, always(0), NOW).items), 0);

    // 추첨은 기준 이상 적에서만 한 번 늘어난다(실패하면 아이템 id 추첨도 없다).
    const below = countingRng(0.99);
    processLoot(enemyOf('가상의 적', MIN_LEVEL - 1), null, 1, below, NOW);
    const at = countingRng(0.99);
    processLoot(enemyOf('가상의 적', MIN_LEVEL), null, 1, at, NOW);
    assert.equal(at.calls, below.calls + 1);
});

test('[보스] 보스는 더 높은 확률로 판정한다', () => {
    const roll = (BALANCE.ENHANCE_MATERIAL_LATE_DROP_CHANCE + BALANCE.ENHANCE_MATERIAL_LATE_BOSS_DROP_CHANCE) / 2;
    assert.equal(countMat(processLoot(enemyOf('가상의 보스', 40, { isBoss: true }), null, 1, always(roll), NOW).items), 1);
    assert.equal(countMat(processLoot(enemyOf('가상의 적', 40), null, 1, always(roll), NOW).items), 0);
});

test('[확률] 기준 이상 일반 적 2만 회 처치의 드롭률은 상수와 같다', () => {
    const rng = mulberry32(39);
    const kills = 20_000;
    let drops = 0;
    for (let i = 0; i < kills; i += 1) drops += countMat(processLoot(enemyOf('가상의 적', 40), null, 1, rng, NOW).items);
    const p = BALANCE.ENHANCE_MATERIAL_LATE_DROP_CHANCE;
    const sigma = Math.sqrt((p * (1 - p)) / kills);
    assert.ok(Math.abs(drops / kills - p) < 4 * sigma, `관측 ${drops / kills} vs ${p}`);
});

test('[실제 스폰] 지역이 스폰한 적은 레벨을 들고 있어 규칙이 닿는다 — 용의 둥지 · 혼돈의 심연', () => {
    const noLog = { addLog: () => {} };
    for (const loc of ['용의 둥지', '혼돈의 심연']) {
        const player = { level: 60, loc, relics: [], stats: { abyssFloor: 9 } };
        const { mStats } = spawnEnemy(DB.MAPS[loc], player, [], noLog, { rng: mulberry32(7) });
        assert.ok(Number.isFinite(mStats.level) && mStats.level >= MIN_LEVEL, `${loc} 적 레벨 ${mStats.level}`);
        assert.equal(countMat(processLoot(mStats, player, 1, always(0), NOW).items) >= 1, true, loc);
    }
});

test('[도감] 강화 재료 기록은 후반 획득처를 알려 준다', () => {
    const html = renderStatic(createElement(MaterialCodex, { codex: { materials: { [MAT]: true } } }));
    assert.ok(html.includes('data-testid="codex-material-late-source"'));
    assert.ok(html.includes(`Lv${MIN_LEVEL}`));
    // 다른 소재에는 붙지 않는다.
    const other = DB.ITEMS.materials.find((item) => item.name !== MAT).name;
    const otherHtml = renderStatic(createElement(MaterialCodex, { codex: { materials: { [other]: true } } }));
    assert.ok(!otherHtml.includes('codex-material-late-source'));
});

test('[체인 문구] 강화 재료를 준다고 말하는 선택지는 실제로 강화 재료를 준다', () => {
    const promises = EVENT_CHAINS.flatMap((chain) => chain.steps.flatMap((step) => (step.event?.outcomes || [])
        .filter((outcome) => String(outcome.log || '').includes(MAT))
        .map((outcome) => ({ chain: chain.id, step: step.step, outcome }))));
    assert.ok(promises.length >= 1, '전제: 기계의 선물 거절 선택지');
    for (const { chain, step, outcome } of promises) {
        assert.deepEqual(outcome.reward, { type: 'item', name: MAT }, `${chain}:${step}`);
    }
});
