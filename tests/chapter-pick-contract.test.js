import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { RELICS } from '../src/data/relics.js';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.js';
import { advanceChapterOnEntry } from '../src/utils/chapterRecap.js';
import { createCurrentRunProgress, normalizeCurrentRunProgress } from '../src/utils/runProgress.js';
import { getWeaponMagicSkills, isMagicWeapon } from '../src/utils/equipmentUtils.js';
import { applyItemPrefixByName } from '../src/utils/itemPrefixUtils.js';
import {
    CHAPTER_PICK_SKIP_ID,
    getChapterPickOffer,
    getNextChapterPick,
    getPendingChapterPicks,
} from '../src/utils/chapterPick.js';

/**
 * 2026-11 H3 장 경계 3택 (소유자 결정 Q2 · S2 · S3, 실행 스케치 §3):
 * 4 · 5 · 7장에 처음 들어서면 카드 셋 중 하나. 받을 권리는 `chapters.reached`에서 도출하고(장을 넘는 이동은 쓰지 않는다),
 * 패는 여정 안에서 변하지 않는 값으로 굴리며(장비 · 전역 난수 무관), 검증은 리듀서가 소유한다.
 */
const clone = (value) => structuredClone(value);

const weaponOf = (index, extra = {}) => ({ ...clone(DB.ITEMS.weapons[index]), id: `w-${index}`, ...extra });
const armorOf = (index, extra = {}) => ({ ...clone(DB.ITEMS.armors[index]), id: `a-${index}`, ...extra });

const freshPlayer = ({ reached = 1, picks, equip, relics = [], startExplores = 40, ...overrides } = {}) => {
    const base = clone(INITIAL_STATE.player);
    const currentRun = createCurrentRunProgress({ explores: startExplores, kills: 12 }, { startedAt: 0 });
    return {
        ...base,
        name: '장의 선물',
        level: 30,
        hp: 500,
        maxHp: 500,
        loc: '시작의 마을',
        relics,
        equip: equip ?? { weapon: weaponOf(2), armor: armorOf(2), offhand: null },
        ...overrides,
        stats: {
            ...base.stats,
            explores: startExplores + 30,
            currentRun: {
                ...currentRun,
                chapters: { ...currentRun.chapters, reached },
                ...(picks ? { chapterPicks: picks } : {}),
            },
        },
    };
};

const stateOf = (player, extra = {}) => ({ ...clone(INITIAL_STATE), bootStage: 'ready', gameState: GS.IDLE, player, ...extra });
const claim = (state, chapter, cardId) => gameReducer(state, { type: AT.CLAIM_CHAPTER_PICK, payload: { chapter, cardId } });

const withThrowingRandom = (fn) => {
    const original = Math.random;
    Math.random = () => { throw new Error('장의 선물이 Math.random을 불렀다'); };
    try { return fn(); } finally { Math.random = original; }
};

test('선물 장은 상수 하나가 정한다(소유자 결정 S3 — 4 · 5 · 7장)', () => {
    assert.deepEqual([...BALANCE.CHAPTER_PICK_CHAPTERS], [4, 5, 7]);
});

test('받을 권리는 도달한 장에서 도출한다 — 경계 · 건너뛰기 · 받은 장 · 이전 세이브', () => {
    assert.deepEqual(getPendingChapterPicks(freshPlayer({ reached: 3 })), []);
    assert.deepEqual(getPendingChapterPicks(freshPlayer({ reached: 4 })), [4]);
    assert.deepEqual(getPendingChapterPicks(freshPlayer({ reached: 5 })), [4, 5], '3장에서 5장으로 건너뛰면 둘 다');
    assert.deepEqual(getPendingChapterPicks(freshPlayer({ reached: 6 })), [4, 5]);
    assert.deepEqual(getPendingChapterPicks(freshPlayer({ reached: 11 })), [4, 5, 7]);
    assert.deepEqual(getPendingChapterPicks(freshPlayer({ reached: 11, picks: [4] })), [5, 7]);
    assert.equal(getNextChapterPick(freshPlayer({ reached: 11, picks: [4, 5] })), 7);
    assert.equal(getNextChapterPick(freshPlayer({ reached: 11, picks: [4, 5, 7] })), null);

    const legacy = freshPlayer({ reached: 9 });
    delete legacy.stats.currentRun.chapters;
    assert.deepEqual(getPendingChapterPicks(legacy), [], '장 기록이 없는 이전 세이브는 첫 이동 전까지 받을 것이 없다');
});

test('장을 넘는 이동은 받은 장 목록을 쓰지 않는다(장 결산의 쓰기 유일 그대로)', () => {
    const player = freshPlayer({ reached: 3 });
    const moved = advanceChapterOnEntry(player, '용의 둥지');
    assert.ok(moved.stats.currentRun.chapters.reached >= 4);
    assert.equal(moved.stats.currentRun.chapterPicks, undefined);
    assert.deepEqual(getPendingChapterPicks(moved), [4]);
});

test('패: 유물 · 접두어 · 무료 강화 — 장비가 설 수 없으면 대체 유물', () => {
    const offer = getChapterPickOffer(freshPlayer({ reached: 4 }), 4);
    assert.deepEqual(offer.cards.map((card) => card.kind), ['relic', 'prefix', 'enhance']);
    const [relicCard, prefixCard, enhanceCard] = offer.cards;
    assert.ok(BALANCE.CHAPTER_PICK_RELIC_RARITIES.includes(relicCard.relic.rarity), '유물 카드는 희귀 이상');
    assert.equal(prefixCard.slot, 'weapon');
    assert.equal(enhanceCard.to - enhanceCard.from, BALANCE.CHAPTER_PICK_ENHANCE_STEPS);

    const armorOnly = getChapterPickOffer(freshPlayer({ reached: 4, equip: { weapon: weaponOf(2, { prefixed: true }), armor: armorOf(2) } }), 4);
    assert.equal(armorOnly.cards[1].kind, 'prefix');
    assert.equal(armorOnly.cards[1].slot, 'armor', '무기에 접두어가 있으면 방어구');

    const nothing = getChapterPickOffer(freshPlayer({ reached: 4, equip: { weapon: null, armor: null } }), 4);
    assert.deepEqual(nothing.cards.map((card) => card.id), ['relic', 'relic-2', 'relic-3']);
    assert.equal(new Set(nothing.cards.map((card) => card.relic.id)).size, 3, '대체 유물은 서로 다르다');

    const plusNine = getChapterPickOffer(freshPlayer({ reached: 4, equip: { weapon: weaponOf(2, { enhance: 9 }), armor: armorOf(2) } }), 4);
    assert.equal(plusNine.cards[2].to, BALANCE.ENHANCE_MAX, '+9는 최대까지만');
    const maxed = getChapterPickOffer(freshPlayer({ reached: 4, equip: { weapon: weaponOf(2, { enhance: BALANCE.ENHANCE_MAX }), armor: armorOf(2) } }), 4);
    assert.equal(maxed.cards[2].kind, 'relic');

    const owned = new Set(freshPlayer().relics.map((relic) => relic.id));
    assert.ok(offer.cards.filter((card) => card.kind === 'relic').every((card) => !owned.has(card.relic.id)));
    assert.equal(getChapterPickOffer(freshPlayer({ reached: 3 }), 4), null, '받을 권리 없는 장');
});

test('결정론: 같은 여정 · 같은 장은 같은 패 — 장비를 바꿔도, 저장 후 불러와도, 전역 난수 없이', () => {
    const player = freshPlayer({ reached: 7 });
    // 기록 줄 id는 리듀서 공용 경로라 전역 난수를 쓴다 — 패 생성(화면 · 리듀서가 함께 읽는 판정)은 쓰지 않는다.
    const offer = withThrowingRandom(() => getChapterPickOffer(player, 5));
    assert.deepEqual(getChapterPickOffer(clone(player), 5), offer);

    const swapped = freshPlayer({ reached: 7, equip: { weapon: weaponOf(5), armor: armorOf(4) } });
    const swappedOffer = getChapterPickOffer(swapped, 5);
    assert.equal(swappedOffer.cards[0].relic.id, offer.cards[0].relic.id);
    assert.equal(swappedOffer.cards[1].prefixName, offer.cards[1].prefixName, '장비를 바꿔도 접두어는 그대로');

    const reloaded = { ...player, stats: { ...player.stats, currentRun: normalizeCurrentRunProgress(JSON.parse(JSON.stringify(player.stats))) } };
    assert.deepEqual(getChapterPickOffer(reloaded, 5), offer);

    const otherRun = freshPlayer({ reached: 7, startExplores: 9000 });
    const differs = [4, 5, 7].some((chapter) => JSON.stringify(getChapterPickOffer(otherRun, chapter)) !== JSON.stringify(getChapterPickOffer(player, chapter)));
    assert.ok(differs, '다른 여정은 다른 패');
});

test('첫 여정: 탐험 · 처치 수가 모두 0이어도 플레이어마다 패가 다르다(여정 시작 시각이 씨앗이다)', () => {
    // 첫 여정의 기준점은 누구나 탐험 0 · 처치 0이다 — 그 둘만 씨앗이던 동안 자연 플레이 120판이 모두
    // 4장 '불타는' 무기 · 5장 '저주받은' 방어구를 받았다.
    const firstRunOf = (startedAt) => {
        const player = freshPlayer({ reached: 7, startExplores: 0 });
        const currentRun = createCurrentRunProgress({}, { startedAt });
        return { ...player, stats: { ...player.stats, explores: 30, currentRun: { ...currentRun, chapters: player.stats.currentRun.chapters } } };
    };
    const startTimes = Array.from({ length: 12 }, (_, index) => 1_790_000_000_000 + index * 7_919);
    for (const chapter of [4, 5, 7]) {
        const offers = new Set(startTimes.map((startedAt) => JSON.stringify(getChapterPickOffer(firstRunOf(startedAt), chapter))));
        assert.ok(offers.size > 1, `${chapter}장: 시작 시각이 다른 첫 여정 12개가 모두 같은 패`);
    }
    const prefixes = new Set(startTimes.map((startedAt) => getChapterPickOffer(firstRunOf(startedAt), 4).cards.find((card) => card.kind === 'prefix')?.prefixName));
    assert.ok(prefixes.size > 1, '4장 접두어가 모든 플레이어에게 같다');

    const same = firstRunOf(startTimes[3]);
    assert.deepEqual(getChapterPickOffer(clone(same), 5), getChapterPickOffer(same, 5), '같은 여정은 같은 패');

    const legacy = firstRunOf(null);
    assert.equal(legacy.stats.currentRun.startedAt, null);
    assert.equal(getChapterPickOffer(legacy, 4).cards.length, 3, '시작 시각이 없는 이전 세이브도 패를 만든다');
});

test('불러오기는 받은 장 목록을 남긴다(빠뜨리면 같은 장의 선물을 다시 받는다)', () => {
    const player = freshPlayer({ reached: 7, picks: [4, 5] });
    const normalized = normalizeCurrentRunProgress(JSON.parse(JSON.stringify(player.stats)));
    assert.deepEqual(normalized.chapterPicks, [4, 5]);
    const fresh = normalizeCurrentRunProgress(JSON.parse(JSON.stringify(freshPlayer({ reached: 7 }).stats)));
    assert.equal('chapterPicks' in fresh, false, '받은 장이 없으면 필드를 만들지 않는다');
});

test('리듀서: 받을 권리 없는 장 · 패 밖 카드 · 다른 상태 · 열린 유물 제안은 동일 참조', () => {
    const state = stateOf(freshPlayer({ reached: 4 }));
    assert.equal(claim(state, 5, 'relic'), state);
    assert.equal(claim(state, 4, 'nope'), state);
    assert.equal(claim(state, 4, ''), state);
    assert.equal(claim({ ...state, gameState: GS.COMBAT }, 4, 'relic').player, state.player);
    const withPending = { ...state, pendingRelics: [RELICS[0]] };
    assert.equal(claim(withPending, 4, 'relic'), withPending);

    const claimed = claim(state, 4, CHAPTER_PICK_SKIP_ID);
    assert.equal(claim(claimed, 4, 'relic'), claimed, '이미 받은 장');
});

test('리듀서: 넘기기는 기록만, 유물은 지급, 접두어 · 강화는 장착 칸을 바꾼다', () => {
    const state = stateOf(freshPlayer({ reached: 4 }));
    const offer = getChapterPickOffer(state.player, 4);

    const skipped = claim(state, 4, CHAPTER_PICK_SKIP_ID);
    assert.deepEqual(skipped.player.stats.currentRun.chapterPicks, [4]);
    assert.deepEqual(skipped.player.relics, state.player.relics);
    assert.deepEqual(skipped.player.equip, state.player.equip);

    const relic = claim(state, 4, 'relic');
    assert.deepEqual(relic.player.relics.map((r) => r.id), [offer.cards[0].relic.id]);
    assert.equal(relic.player.stats.relicCount, (state.player.stats.relicCount || 0) + 1);
    assert.equal(relic.pendingRelics, null);

    const prefixed = claim(state, 4, 'prefix');
    assert.equal(prefixed.player.equip.weapon.prefixName, offer.cards[1].prefixName);
    assert.ok(prefixed.player.equip.weapon.val > state.player.equip.weapon.val);
    assert.equal(prefixed.player.equip.weapon.id, state.player.equip.weapon.id);

    const enhanced = claim(state, 4, 'enhance');
    assert.equal(enhanced.player.equip.weapon.enhance, BALANCE.CHAPTER_PICK_ENHANCE_STEPS);
    assert.equal(enhanced.player.gold, state.player.gold, '골드를 쓰지 않는다');
    assert.deepEqual(enhanced.player.inv, state.player.inv, '재료를 쓰지 않는다');
});

test('리듀서: 어떤 카드를 받아도 전역 난수를 쓰지 않는다(기록 id 포함 — 자연 플레이 짝 비교의 난수열을 밀지 않는다)', () => {
    const state = stateOf(freshPlayer({ reached: 4 }));
    const max = getPrestigeUnlocks(0).maxRelics;
    const full = stateOf(freshPlayer({ reached: 4, relics: RELICS.filter((relic) => relic.rarity === 'common').slice(0, max) }));
    for (const [from, cardId] of [[state, CHAPTER_PICK_SKIP_ID], [state, 'relic'], [state, 'prefix'], [state, 'enhance'], [full, 'relic']]) {
        const next = withThrowingRandom(() => claim(from, 4, cardId));
        assert.notEqual(next, from, cardId);
        assert.equal(next.logs.length, from.logs.length + 1, cardId);
    }
});

test('리듀서: 칸이 찬 유물 카드는 잔향으로 접지 않고 교체 화면을 연다', () => {
    const max = getPrestigeUnlocks(0).maxRelics;
    const ownedRelics = RELICS.filter((relic) => relic.rarity === 'common').slice(0, max);
    const state = stateOf(freshPlayer({ reached: 4, relics: ownedRelics }));
    const offer = getChapterPickOffer(state.player, 4);
    assert.equal(offer.cards[0].atCapacity, true);

    const next = claim(state, 4, 'relic');
    assert.deepEqual(next.pendingRelics.map((relic) => relic.id), [offer.cards[0].relic.id]);
    assert.equal(next.player.relics.length, max, '유물 수는 늘지 않는다');
    assert.deepEqual(next.player.stats.currentRun.chapterPicks, [4]);

    const replaced = gameReducer(next, { type: AT.REPLACE_RELIC, payload: { relicId: offer.cards[0].relic.id, replaceRelicId: ownedRelics[0].id } });
    assert.ok(replaced.player.relics.some((relic) => relic.id === offer.cards[0].relic.id));
});

test('범위: 사망 · 다시 시작은 받은 장을 비운다(새 여정은 다시 받는다)', () => {
    const veteran = freshPlayer({ reached: 8, picks: [4, 5, 7] });
    const reset = gameReducer(stateOf(clone(veteran)), { type: AT.RESET_GAME });
    assert.equal(reset.player.stats.currentRun.chapterPicks, undefined);
    const defeated = CombatEngine.handleDefeat(clone(veteran), clone(INITIAL_STATE.player), () => 0.5, () => 1).updatedPlayer;
    assert.equal(defeated.stats.currentRun.chapterPicks, undefined);
    assert.deepEqual(getPendingChapterPicks(defeated), []);
});

test('접두어 카드: 원소 접두어가 무기 마법 기술을 새로 열면 그 기술을 카드가 말한다', () => {
    // 접두어 정책의 1회차 사망 감소(원장 §167)는 접두어 수치가 아니라 원소 무기가 자동으로 여는 무기 마법 기술에서 왔다 —
    // 카드가 "공격력 +N · 화염 속성"만 말하던 동안 가장 큰 효과가 보이지 않았다.
    const prefixCardOf = (startedAt, weapon) => {
        const player = freshPlayer({ reached: 7, equip: { weapon, armor: armorOf(2), offhand: null } });
        player.stats.currentRun.startedAt = startedAt;
        return getChapterPickOffer(player, 4).cards.find((card) => card.kind === 'prefix');
    };
    const plain = weaponOf(1);
    assert.equal(isMagicWeapon(plain), false);
    const cards = Array.from({ length: 80 }, (_, index) => prefixCardOf(index * 104_729, plain));
    const elemental = cards.find((card) => card.elem);
    const physical = cards.find((card) => !card.elem);
    assert.ok(elemental && physical, '시작 시각 80개 안에 원소 · 비원소 접두어가 모두 나온다');

    const prefixed = applyItemPrefixByName(plain, elemental.prefixName);
    assert.equal(elemental.opensSkill, getWeaponMagicSkills({ weapon: prefixed })[0].name);
    assert.ok(elemental.opensSkill.length > 0);
    assert.equal(physical.opensSkill, null, '원소가 없는 접두어는 기술을 열지 않는다');

    const staff = weaponOf(2);
    assert.equal(isMagicWeapon(staff), true);
    const staffCards = Array.from({ length: 80 }, (_, index) => prefixCardOf(index * 104_729, staff));
    assert.ok(staffCards.every((card) => card.opensSkill === null), '이미 마법 무기면 새로 여는 기술이 없다');

    const armorCard = getChapterPickOffer(freshPlayer({ reached: 7, equip: { weapon: null, armor: armorOf(2), offhand: null } }), 4)
        .cards.find((card) => card.kind === 'prefix');
    assert.equal(armorCard?.slot, 'armor');
    assert.equal(armorCard.opensSkill, null, '방어구 접두어는 기술을 열지 않는다');
});
