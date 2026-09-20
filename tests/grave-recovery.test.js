import test from 'node:test';
import assert from 'node:assert/strict';

import {
    appendGrave,
    buildGraveData,
    clampPublicGraveGold,
    getGraveRecoveryGroups,
    getGravesAtLoc,
    normalizeGraves,
    removeGravesAtLoc,
    resolveGraveRecovery,
} from '../src/utils/graveUtils.js';
import { CONSTANTS } from '../src/data/constants.js';

const BASE_PLAYER = {
    name: '',
    job: '모험가',
    level: 1,
    hp: 150,
    maxHp: 150,
    mp: 50,
    maxMp: 50,
    atk: 10,
    def: 5,
    exp: 0,
    nextExp: 100,
    gold: 100,
    loc: '시작의 마을',
    inv: [],
    equip: { weapon: null, armor: null, offhand: null },
    quests: [],
    achievements: [],
    stats: { kills: 0, total_gold: 0, deaths: 0 },
    tempBuff: { atk: 0, turn: 0 },
    status: [],
    skillLoadout: { selected: 0, cooldowns: {} },
    meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
    relics: [],
    titles: [],
    activeTitle: null,
    combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
    history: [],
    archivedHistory: []
};

test('grave creation keeps half the gold and one to two non-starter items', () => {
    const player = {
        ...BASE_PLAYER,
        name: '리아',
        gold: 199,
        loc: '고요한 숲',
        inv: [
            { id: 'starter_1', name: '하급 포션', type: 'consumable' },
            { id: 'wand_1', name: '호신용 지팡이', type: 'weapon' },
            { id: 'robe_1', name: '천 로브', type: 'armor' },
            { id: 'ring_1', name: '자연의 결정', type: 'material' },
        ],
    };

    const result = buildGraveData(player, () => 0.9, () => 12345);

    assert.equal(result.loc, '고요한 숲');
    assert.equal(result.gold, 99);
    assert.equal(result.timestamp, 12345);
    assert.equal(result.items.length, 2);
    assert.ok(result.items.every((item) => !item.id.startsWith('starter_')));
    assert.deepEqual(result.item, result.items[0]);
});

test('lootGrave restores stored gold and all dropped items before clearing the grave', () => {
    const player = {
        ...BASE_PLAYER,
        gold: 25,
        inv: [],
        stats: { ...(BASE_PLAYER.stats || {}) },
    };
    const grave = {
        loc: '고요한 숲',
        gold: 40,
        items: [
            { name: '녹슨 단검', type: 'weapon', price: 50 },
            { name: '천 로브', type: 'armor', price: 40 },
        ],
        timestamp: 987654321,
    };

    const result = resolveGraveRecovery(player, grave);

    assert.equal(result.updatedPlayer.gold, 65);
    assert.equal(result.updatedPlayer.inv.length, 2);
    assert.deepEqual(result.updatedPlayer.inv.map((item) => item.name), ['녹슨 단검', '천 로브']);
    assert.ok(result.updatedPlayer.inv.every((item) => typeof item.id === 'string' && item.id.length > 0));
    assert.match(result.logMsg, /유해 회수: 40G 획득/);
    assert.match(result.logMsg, /녹슨 단검/);
    assert.match(result.logMsg, /천 로브/);
});

test('grave recovery supports legacy single-item graves', () => {
    const player = {
        ...BASE_PLAYER,
        gold: 10,
        inv: [],
        stats: { ...(BASE_PLAYER.stats || {}) },
    };
    const grave = {
        loc: '고요한 숲',
        gold: 15,
        item: { name: '호신용 지팡이', type: 'weapon', price: 55 },
        timestamp: 123,
    };

    const result = resolveGraveRecovery(player, grave);

    assert.equal(result.updatedPlayer.gold, 25);
    assert.equal(result.updatedPlayer.inv.length, 1);
    assert.equal(result.updatedPlayer.inv[0].name, '호신용 지팡이');
    assert.match(result.logMsg, /호신용 지팡이/);
});

test('grave utilities preserve multiple corpses and recover by location', () => {
    const first = { loc: '고요한 숲', gold: 20, items: [{ name: '롱소드', type: 'weapon' }], timestamp: 100 };
    const second = { loc: '버려진 동굴', gold: 35, items: [{ name: '천 로브', type: 'armor' }], timestamp: 200 };
    const third = { loc: '고요한 숲', gold: 10, items: [{ name: '해독제', type: 'cure' }], timestamp: 300 };
    const merged = appendGrave(appendGrave(null, first), [second, third]);

    assert.equal(merged.length, 3);
    assert.deepEqual(getGravesAtLoc(merged, '고요한 숲').map((grave) => grave.timestamp), [300, 100]);

    const recovered = resolveGraveRecovery(
        { ...BASE_PLAYER, gold: 5, inv: [], stats: { ...(BASE_PLAYER.stats || {}) } },
        getGravesAtLoc(merged, '고요한 숲')
    );

    assert.equal(recovered.updatedPlayer.gold, 35);
    assert.deepEqual(recovered.updatedPlayer.inv.map((item) => item.name), ['해독제', '롱소드']);
    assert.match(recovered.logMsg, /2구의 유해 정리/);

    const remaining = removeGravesAtLoc(merged, '고요한 숲');
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].loc, '버려진 동굴');
});

test('grave recovery groups prioritize the current location and keep exact rewards', () => {
    const graves = [
        { loc: '고요한 숲', gold: 35, items: [{ name: '숲길 사냥활' }], timestamp: 300 },
        { loc: '시작의 마을', gold: 12, items: [{ name: '여행자의 반지' }], timestamp: 100 },
        { loc: '고요한 숲', gold: 20, item: { name: '초급 회복 물약' }, timestamp: 200 },
    ];

    const groups = getGraveRecoveryGroups(graves, '시작의 마을');

    assert.equal(groups.length, 2);
    assert.equal(groups[0].loc, '시작의 마을');
    assert.equal(groups[0].atCurrentLocation, true);
    assert.equal(groups[0].gold, 12);
    assert.deepEqual(groups[0].items.map((item) => item.name), ['여행자의 반지']);
    assert.equal(groups[1].loc, '고요한 숲');
    assert.equal(groups[1].count, 2);
    assert.equal(groups[1].gold, 55);
    assert.deepEqual(groups[1].items.map((item) => item.name), ['숲길 사냥활', '초급 회복 물약']);
});

// Wave 15 G2 — `firestore.rules`의 공개 묘비 `gold <= 9,999,999` 상한을 클라이언트가
// 보장하지 않던 유일한 필드였다(§18/§19 실측). 클램프는 `useFirebaseSync.ts`의 공개
// 업로드 페이로드에만 걸었고, 회수용 로컬 묘비(`buildGraveData`/`resolveGraveRecovery`)는
// 절대 건드리지 않는다 — 건드리면 플레이어 자기 골드가 사라진다(이 트랙의 가장 큰
// 실패 모드). 소스 정규식이 아니라 실제 함수를 호출해 값으로 확인한다(CLAUDE.md §7).
test('상한 초과 골드로 죽어도 공개 업로드만 클램프되고 로컬 회수 값은 그대로다 (Wave 15 G2)', () => {
    // 상한(9,999,999)의 4배 이상을 들고 죽는 상황 — buildGraveData는 절반을 묘비에 담는다.
    const dyingPlayer = { ...BASE_PLAYER, gold: 40_000_000, loc: '시작의 마을', inv: [] };
    const localGrave = buildGraveData(dyingPlayer, () => 0.9, () => 99999);

    // (b) 로컬 회수용 묘비는 원래 값 그대로다 — 클램프가 전혀 적용되지 않는다.
    //     '시작의 마을'은 graveDropBonus가 없는 지역이라 dropBonus는 1.0이다.
    const expectedLocalGold = Math.floor(dyingPlayer.gold / 2);
    assert.equal(localGrave.gold, expectedLocalGold);
    assert.ok(
        localGrave.gold > CONSTANTS.MAX_PUBLIC_GRAVE_GOLD,
        '테스트 전제: 로컬 묘비 골드가 공개 상한을 넘어야 클램프 차이를 검증할 수 있다',
    );

    // 회수 경로(resolveGraveRecovery)로 돌려받는 골드도 클램프 없는 원래 값이다 —
    // 플레이어가 자기 골드를 잃지 않는다.
    const recovered = resolveGraveRecovery({ ...BASE_PLAYER, gold: 0, inv: [] }, localGrave);
    assert.equal(recovered.updatedPlayer.gold, expectedLocalGold);

    // (a) 공개 업로드 페이로드는 정확히 CONSTANTS.MAX_PUBLIC_GRAVE_GOLD(9,999,999)에서
    //     멈춘다 — useFirebaseSync.ts가 부르는 것과 같은 exported 함수를 그대로 호출한다
    //     (사본을 손으로 다시 구현하지 않는다). 업로드 직전 합산도 production과 같은
    //     `normalizeGraves` + reduce를 쓴다.
    const totalGold = normalizeGraves(localGrave).reduce((sum, g) => sum + (g?.gold || 0), 0);
    const uploadGold = clampPublicGraveGold(totalGold);
    assert.equal(uploadGold, CONSTANTS.MAX_PUBLIC_GRAVE_GOLD);
    assert.equal(uploadGold, 9_999_999);

    // 클램프가 로컬 값을 in-place로 변형하지 않았는지도 확인한다(불변 업데이트 원칙).
    assert.equal(localGrave.gold, expectedLocalGold);
});
