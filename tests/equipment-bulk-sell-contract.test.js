import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.js';
import { isSignatureItem } from '../src/data/signatureItems.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { getGoldIncome } from '../src/utils/challengeRules.js';
import { getSellPrice } from '../src/utils/equipmentUtils.js';
import { getUnusedEquipmentSummary, getUnusedEquipmentTargets } from '../src/utils/equipmentBulkSell.js';

/**
 * 쓰지 않는 장비 한 번에 팔기 — 2026-11 재미 분석 G4.
 * 판정은 이미 있는 두 판정(장비 비교 점수 · 직업 경로)이고, 리듀서는 판매 순간 다시 판정해 화면이 본 id와 겹치는 것만 판다.
 */

const findItem = (list, name) => {
    const item = list.find((entry) => entry.name === name);
    assert.ok(item, `${name} 데이터가 있어야 한다`);
    return item;
};

const longsword = findItem(DB.ITEMS.weapons, '롱소드');
const apprenticeDagger = findItem(DB.ITEMS.weapons, '견습생의 단검'); // 도적 · 어쌔신 — 전사 경로 밖
const leatherArmor = findItem(DB.ITEMS.armors, '가죽 갑옷'); // 전사 착용 가능
const trainingRobe = findItem(DB.ITEMS.armors, '수련복'); // 마법사 계열 — 전사 경로 밖
const signature = [...DB.ITEMS.weapons, ...DB.ITEMS.armors].find((item) => isSignatureItem(item) && item.jobs?.includes('전사'));
assert.ok(signature, '전사가 쓸 수 있는 전설 각인이 있어야 한다');
const material = DB.ITEMS.materials.find((entry) => (entry.price || 0) > 0);

const inv = [
    { ...leatherArmor, id: 'dup-armor' }, // 끼고 있는 갑옷과 같다(점수 0) → 판다
    { ...apprenticeDagger, id: 'off-path-dagger' }, // 경로 밖 → 판다
    { ...trainingRobe, id: 'off-path-robe' }, // 경로 밖 → 판다
    { ...longsword, id: 'enhanced-longsword', enhance: 2 }, // 강화 → 남긴다
    { ...longsword, id: 'offhand-longsword' }, // 보조 칸이 비어 있어 쌍수가 된다(더 낫다) → 남긴다
    { ...signature, id: 'signature-copy' }, // 전설 각인(레벨도 모자람) → 남긴다
    { ...longsword, id: 'starter_weapon' }, // 시작 지급품 → 남긴다
    { ...material, id: 'material-1' }, // 재료 → 장비 판정 밖
];

const makePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    job: '전사',
    level: 3,
    gold: 0,
    equip: { weapon: { ...longsword, id: 'equipped-longsword' }, armor: { ...leatherArmor, id: 'equipped-armor' }, offhand: null },
    inv: structuredClone(inv),
    ...overrides,
});

const makeState = (gameState, player = makePlayer()) => ({ ...structuredClone(INITIAL_STATE), gameState, player });

const SOLD_IDS = ['dup-armor', 'off-path-dagger', 'off-path-robe'];

test('대상은 끼고 있는 것보다 낫지 않거나 직업 경로 밖인 장비이고, 강화 · 각인 · 더 나은 장비(쌍수) · 지급품 · 재료는 남긴다', () => {
    const targets = getUnusedEquipmentTargets(makePlayer());
    assert.deepEqual(targets.map((item) => item.id), SOLD_IDS);
});

test('미리보기 금액은 판매가 합에 수입 규칙을 한 번 건 값이다 — 빈손의 시작이면 합계의 절반', () => {
    const plain = getUnusedEquipmentSummary(makePlayer());
    const total = SOLD_IDS.reduce((sum, id) => sum + getSellPrice(inv.find((item) => item.id === id)), 0);
    assert.equal(plain.totalPrice, total);
    assert.equal(plain.income, total);

    const handicapped = makePlayer({ challengeModifiers: ['noGold'] });
    const summary = getUnusedEquipmentSummary(handicapped);
    assert.equal(summary.income, getGoldIncome(handicapped, total));
});

test('리듀서는 상점에서만, 판매 순간에도 대상인 id만 팔고 미리보기와 같은 골드를 준다 — 다시 보내면 동일 참조', () => {
    const state = makeState(GS.SHOP);
    const preview = getUnusedEquipmentSummary(state.player);
    const action = { type: AT.SELL_UNUSED_EQUIPMENT, payload: { itemIds: preview.items.map((item) => item.id) } };

    const sold = gameReducer(state, action);
    assert.deepEqual(
        sold.player.inv.map((item) => item.id),
        inv.map((item) => item.id).filter((id) => !SOLD_IDS.includes(id)),
    );
    assert.equal(sold.player.gold, preview.income);
    assert.equal(sold.logs.filter((log) => log.text.includes('쓰지 않는 장비')).length, 1);
    assert.equal(gameReducer(sold, action), sold);

    assert.equal(gameReducer(makeState(GS.IDLE), action).player.inv.length, inv.length, '상점 밖에서는 팔지 않는다');
});

test('화면이 보여 준 뒤 대상에서 빠진 장비 · 화면이 보여 주지 않은 장비는 팔지 않는다', () => {
    const player = makePlayer();
    const seenIds = getUnusedEquipmentTargets(player).map((item) => item.id);
    // 화면을 연 뒤 같은 갑옷을 강화했다 — 이제 대상이 아니다.
    const changed = makeState(GS.SHOP, {
        ...player,
        inv: player.inv.map((item) => (item.id === 'dup-armor' ? { ...item, enhance: 1 } : item)),
    });
    const sold = gameReducer(changed, { type: AT.SELL_UNUSED_EQUIPMENT, payload: { itemIds: seenIds } });
    assert.ok(sold.player.inv.some((item) => item.id === 'dup-armor'));
    assert.ok(!sold.player.inv.some((item) => item.id === 'off-path-robe'), '여전히 대상인 장비는 판다');

    // 보여 주지 않은 id(각인 · 강화 장비)를 끼워 보내도 대상 판정 밖이면 팔리지 않는다.
    const forged = gameReducer(makeState(GS.SHOP), {
        type: AT.SELL_UNUSED_EQUIPMENT,
        payload: { itemIds: ['signature-copy', 'enhanced-longsword', 'off-path-robe'] },
    });
    assert.deepEqual(
        inv.map((item) => item.id).filter((id) => !forged.player.inv.some((item) => item.id === id)),
        ['off-path-robe'],
    );

    const none = makeState(GS.SHOP);
    assert.equal(gameReducer(none, { type: AT.SELL_UNUSED_EQUIPMENT, payload: { itemIds: [] } }), none);
});
