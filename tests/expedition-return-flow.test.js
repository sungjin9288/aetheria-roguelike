import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import {
    getExpeditionReturnAction,
    getRestCost,
} from '../src/utils/expeditionReturnFlow.js';

const makeSummary = (overrides = {}) => ({
    id: 'return-flow-test',
    startedAt: 1_000,
    endedAt: 61_000,
    origin: '시작의 마을',
    destination: '고요한 숲',
    lastLocation: '고요한 숲',
    returnLocation: '시작의 마을',
    returnReason: 'safe_return',
    durationMs: 60_000,
    startLevel: 1,
    endLevel: 2,
    expGained: 80,
    goldDelta: 50,
    battles: 3,
    bossBattles: 0,
    explores: 4,
    newItems: [],
    lostItemCount: 0,
    completedQuests: [],
    lowestHp: 50,
    lowestHpPercent: 30,
    returnHp: 180,
    maxHpAtReturn: 180,
    reviewedAt: null,
    ...overrides,
});

const makePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '귀환자',
    hp: 180,
    maxHp: 180,
    mp: 50,
    maxMp: 50,
    gold: 500,
    quests: [],
    inv: [],
    ...overrides,
});

test('완료 임무 보상은 회복과 다른 정비보다 먼저 제안한다', () => {
    const player = makePlayer({
        hp: 20,
        quests: [{ id: 80, progress: 1, isBounty: false }],
    });

    const action = getExpeditionReturnAction(player, makeSummary());

    assert.equal(action.kind, 'claim_quest');
    assert.equal(action.questId, 80);
    assert.equal(action.label, '임무 보상 받기');
});

test('회복이 필요하고 비용이 충분하면 실제 휴식 비용과 같은 action을 제안한다', () => {
    const player = makePlayer({ hp: 60, gold: 500 });
    const action = getExpeditionReturnAction(player, makeSummary(), { maxHp: 200, maxMp: 50 });

    assert.equal(action.kind, 'rest');
    assert.match(action.detail, new RegExp(getRestCost(player).toLocaleString('ko-KR')));
});

test('휴식 비용이 부족해도 보유 회복 아이템으로 이어진다', () => {
    const player = makePlayer({
        hp: 60,
        gold: 0,
        inv: [{ id: 'return-potion', name: '하급 체력 물약', type: 'hp', val: 50 }],
    });

    const action = getExpeditionReturnAction(player, makeSummary());

    assert.equal(action.kind, 'open_inventory');
    assert.equal(action.label, '회복 아이템 확인');
});

test('회복 아이템이 없고 휴식보다 저렴한 물약을 살 수 있으면 상점으로 이어진다', () => {
    const player = makePlayer({ hp: 60, gold: 30, inv: [] });
    const action = getExpeditionReturnAction(player, makeSummary());

    assert.ok(getRestCost(player) > player.gold);
    assert.equal(action.kind, 'open_shop');
    assert.equal(action.label, '회복 물품 마련');
});

test('이번 원정에서 얻은 실제 강화 장비를 회복 다음 순서로 제안한다', () => {
    const upgrade = {
        id: 'return-upgrade',
        name: '귀환자의 롱소드',
        type: 'weapon',
        val: 60,
        hands: 1,
        jobs: ['모험가'],
    };
    const player = makePlayer({ inv: [upgrade] });
    const action = getExpeditionReturnAction(player, makeSummary({ newItems: [upgrade.name] }));

    assert.equal(action.kind, 'open_equipment');
    assert.equal(action.itemName, upgrade.name);
    assert.match(action.detail, /공격력 \+/);
});

test('가방이 두 칸 이하로 남으면 다음 전리품보다 정리를 먼저 제안한다', () => {
    const capacity = BALANCE.INV_MAX_SIZE;
    const inv = Array.from({ length: capacity - 2 }, (_, index) => ({
        id: `material-${index}`,
        name: `재료 ${index}`,
        type: 'mat',
    }));
    const action = getExpeditionReturnAction(makePlayer({ inv }), makeSummary());

    assert.equal(action.kind, 'open_inventory');
    assert.equal(action.label, '가방 정리하기');
});

test('회복과 가방 정리가 끝났고 재료가 충분하면 제작으로 이어진다', () => {
    const recipe = DB.ITEMS.recipes[0];
    const inv = recipe.inputs.flatMap((input) => (
        Array.from({ length: input.qty }, (_, index) => ({
            id: `${input.name}-${index}`,
            name: input.name,
            type: 'mat',
        }))
    ));
    const action = getExpeditionReturnAction(makePlayer({ gold: recipe.gold, inv }), makeSummary());

    assert.equal(action.kind, 'open_crafting');
});

test('즉시 정비할 일이 없으면 다음 임무 선택으로 돌아간다', () => {
    const action = getExpeditionReturnAction(makePlayer({ gold: 0, inv: [] }), makeSummary());

    assert.equal(action.kind, 'open_quest_board');
    assert.equal(action.label, '다음 임무 고르기');
});
