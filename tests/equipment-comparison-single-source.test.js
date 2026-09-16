import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { getLootUpgradeHint } from '../src/hooks/combatActions/_helpers.js';
import {
    getEquipmentComparison,
    getEquipmentDecision,
    getSellPrice,
    pickBestEquippable,
} from '../src/utils/equipmentUtils.js';

/**
 * A2 (2026-09 감사 G4): 장비 비교 단일 원천.
 *
 * 기존엔 3표면이 서로 다른 계산을 했다.
 *   - getEquipmentDecision (인벤/판단)            → 강화(+N) 반영 ✓
 *   - ShopPanel.getComparisonMeta (상점)          → 강화 무시 ✗
 *   - combatActions/_helpers.getLootUpgradeHint   → 강화 무시 ✗ + 점수식 inline 복제
 * 강화 장비를 착용 중이면 상점/루팅 힌트가 업그레이드 폭을 과대 표시했다.
 *
 * 이 테스트는 "+3 강화 무기를 착용한 플레이어가 후보 무기를 비교할 때 세 표면이
 * 동일한 공격력 델타를 보고한다"를 고정한다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const enhancedWeapon = {
    id: 'equipped-sword', name: '강철 장검', type: 'weapon', val: 40, price: 400, enhance: 3,
};
const candidateWeapon = {
    id: 'candidate-sword', name: '흑철 장검', type: 'weapon', val: 52, price: 800,
};

const playerWithEnhancedWeapon = () => ({
    job: '전사',
    equip: { weapon: enhancedWeapon, armor: null, offhand: null },
    inv: [candidateWeapon],
});

test('A2: 강화 +3 착용 상태에서 상점/루팅/인벤 3표면이 동일한 공격력 델타를 보고한다', () => {
    const player = playerWithEnhancedWeapon();

    // 인벤(판단) 표면
    const decision = getEquipmentDecision(player, candidateWeapon);
    assert.ok(decision, '장비 판단이 계산되어야 함');

    // 상점 표면이 위임하는 공용 비교
    const comparison = getEquipmentComparison(player, candidateWeapon);
    assert.ok(comparison, '공용 비교가 계산되어야 함');
    assert.equal(comparison.diff.atk, decision.diff.atk, '상점 델타 = 인벤 델타');
    assert.equal(comparison.score, decision.score, '상점 점수 = 인벤 점수');

    // 루팅 표면
    const hint = getLootUpgradeHint(player, [candidateWeapon]);

    const atkDelta = decision.diff.atk;
    if (atkDelta > 0) {
        assert.ok(hint, '업그레이드면 루팅 힌트가 나와야 함');
        assert.equal(hint.name, candidateWeapon.name);
        assert.ok(
            hint.summary.includes(`${MSG.EQUIP_DELTA_LABEL.atk} +${atkDelta}`),
            `루팅 힌트 델타가 인벤/상점과 동일해야 함 (실제: ${hint.summary}, 기대 델타: ${atkDelta})`,
        );
        assert.ok(
            comparison.summaryText.includes(`${MSG.EQUIP_DELTA_LABEL.atk} +${atkDelta}`),
            `상점 요약 델타가 동일해야 함 (실제: ${comparison.summaryText})`,
        );
    } else {
        assert.equal(hint, null, '업그레이드가 아니면 루팅 힌트 없음');
    }
});

test('A2: 강화를 반영하므로 강화 무시 계산보다 델타가 작다 (과대 표시 회귀 가드)', () => {
    const player = playerWithEnhancedWeapon();
    const enhancedAware = getEquipmentComparison(player, candidateWeapon).diff.atk;

    const unenhancedPlayer = {
        ...player,
        equip: { ...player.equip, weapon: { ...enhancedWeapon, enhance: 0 } },
    };
    const unenhanced = getEquipmentComparison(unenhancedPlayer, candidateWeapon).diff.atk;

    assert.ok(
        enhancedAware < unenhanced,
        `강화 +3을 반영하면 업그레이드 폭이 줄어야 함 (반영 ${enhancedAware} vs 무시 ${unenhanced})`,
    );
});

test('A2: 세 표면 모두 BALANCE 가중치 기반 동일 점수식을 쓴다 (inline 복제 금지)', async () => {
    const helpers = await readSrc('src/hooks/combatActions/_helpers.ts');
    const shop = await readSrc('src/components/ShopPanel.tsx');

    assert.match(helpers, /getEquipmentComparison\(player, item\)/);
    assert.doesNotMatch(helpers, /critDelta \* 2/, '점수식 inline 복제 금지');
    assert.doesNotMatch(helpers, /Math\.floor\(mpDelta \/ 5\)/, '점수식 inline 복제 금지');
    assert.match(shop, /getEquipmentComparison\(player, item\)/);
    assert.doesNotMatch(shop, /const signedDelta/, '델타 포맷 헬퍼 재도입 금지');

    assert.equal(typeof BALANCE.EQUIP_SCORE_CRIT_WEIGHT, 'number');
    assert.equal(typeof BALANCE.EQUIP_SCORE_MP_DIVISOR, 'number');
});

test('A2: pickBestEquippable은 무기/방어구 모두 강화 반영 점수로 고른다', () => {
    const weakArmor = { id: 'a1', name: '가죽 갑옷', type: 'armor', val: 30, price: 100 };
    // val은 더 높지만 직업 제한으로 장착 불가 → 선택 대상에서 제외되어야 한다.
    const blockedArmor = { id: 'a2', name: '마도사 로브', type: 'armor', val: 60, price: 300, jobs: ['마법사'] };
    // val은 낮지만 강화 +5로 실효 방어가 가장 높다.
    const enhancedArmor = { id: 'a3', name: '강철 갑옷', type: 'armor', val: 40, price: 200, enhance: 5 };

    const player = {
        job: '전사',
        equip: { weapon: null, armor: null, offhand: null },
        inv: [weakArmor, blockedArmor, enhancedArmor],
    };

    const best = pickBestEquippable(player, 'armor');
    assert.equal(best?.id, 'a3', '강화 반영 점수 기준으로 골라야 함 (raw val 기준 아님)');

    const bestWeapon = pickBestEquippable(player, 'weapon');
    assert.equal(bestWeapon, undefined, '해당 타입이 없으면 undefined');
});

test('A2: getSellPrice가 BALANCE.SELL_PRICE_RATIO 단일 원천을 쓴다', async () => {
    assert.equal(BALANCE.SELL_PRICE_RATIO, 0.5);
    assert.equal(getSellPrice({ price: 401 }), Math.floor(401 * BALANCE.SELL_PRICE_RATIO));
    assert.equal(getSellPrice({ price: 0 }), 0);
    assert.equal(getSellPrice(null), 0);
    assert.equal(getSellPrice({}), 0);

    // 3 판매 지점(상점 목록 · 개별 판매 · 재료 일괄 판매)이 전부 헬퍼를 쓴다.
    const shop = await readSrc('src/components/ShopPanel.tsx');
    const economy = await readSrc('src/reducers/handlers/economyHandlers.ts');
    assert.match(shop, /getSellPrice\(item\)/);
    assert.equal((economy.match(/getSellPrice\(item\)/g) || []).length, 2);
    assert.doesNotMatch(shop, /\(item\.price \|\| 0\) \* 0\.5/, '판매가 inline 복제 금지');
    assert.doesNotMatch(economy, /\(item\.price \|\| 0\) \* 0\.5/, '판매가 inline 복제 금지');
});

test('A2: 잡템 재료 임계가 BALANCE 단일 원천이다', async () => {
    assert.equal(BALANCE.INVENTORY_JUNK_MATERIAL_PRICE_MAX, 30);

    const inventory = await readSrc('src/components/SmartInventory.tsx');
    const economy = await readSrc('src/reducers/handlers/economyHandlers.ts');
    assert.match(inventory, /BALANCE\.INVENTORY_JUNK_MATERIAL_PRICE_MAX/);
    assert.match(economy, /BALANCE\.INVENTORY_JUNK_MATERIAL_PRICE_MAX/);
    assert.doesNotMatch(inventory, /\(i\.price \|\| 0\) <= 30/, '임계 inline 하드코딩 금지');
    assert.doesNotMatch(economy, /\(item\.price \|\| 0\) <= 30/, '임계 inline 하드코딩 금지');
});
