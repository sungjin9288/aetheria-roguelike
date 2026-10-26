import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ControlPanel from '../src/components/ControlPanel.tsx';
import LevelUpBanner from '../src/components/LevelUpBanner.tsx';
import MomentBanners from '../src/components/MomentBanners.tsx';
import PostCombatCard from '../src/components/PostCombatCard.tsx';
import RelicChoicePanel from '../src/components/RelicChoicePanel.tsx';
import { CLASSES } from '../src/data/classes.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';
import {
    canChangeClassAt,
    isClassChangeNewlyReady,
    isLevelUpClassChangeReady,
} from '../src/utils/classChangeReadiness.ts';
import {
    getEncounterBanner,
    getEncounterBannerOnChange,
    getEncounterIdentity,
} from '../src/utils/encounterBanner.ts';
import { advanceModeTransition, createModeTransition, getModeEnterClass } from '../src/utils/modeTransition.ts';
import { canContinueExploreAfterCombat, getPostCombatExploreAction } from '../src/utils/postCombatContinue.ts';
import {
    POST_COMBAT_INPUT_GUARD_MS,
    POST_COMBAT_REVEAL_TIMING,
    getCountUpValue,
    getLootRevealDelayMs,
    getRevealProgress,
    getRevealStage,
} from '../src/utils/postCombatReveal.ts';
import {
    formatSynergyDrawback,
    getRelicAcquisitionMoment,
    getSynergyMomentsBetween,
} from '../src/utils/relicSynergyHint.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-10 감사 rewards-progression 묶음 — 보상 · 성장 순간의 반응(GF-08 · GF-09 · GF-10 · UX-10 · UX-11 · CL-05).
 *   유물을 받은 순간 · 조합이 켜진 순간의 띠, 보스 · 우두머리 등장 띠, 모드 전환 박자, 승리 카드의 순서 공개 ·
 *   '계속 탐험'의 실제 탐험, 유물 카드의 거짓 꺾쇠 제거, 전직이 열린 레벨업의 부제.
 * 모두 화면의 순간이다 — 리듀서 · 엔진의 기록 줄은 그대로다(줄 하나가 자연 플레이 측정의 난수열을 밀 수 있다, Wave 111).
 * 시간(타이머 · 숫자 증가 · 입력 무시 · 확정 박자)은 Chromium 하네스(`rewards-progression-presentation.test.js`)가 본다.
 */

const relicByName = (name) => {
    const relic = RELICS.find((entry) => entry.name === name);
    assert.ok(relic, `유물 '${name}'이 데이터에 있다`);
    return structuredClone(relic);
};

const PAIR = RELIC_SYNERGIES.find((syn) => syn.requires.length === 2);
const LEGENDARY = RELIC_SYNERGIES.find((syn) => (
    syn.requires.length >= 3
    && RELIC_SYNERGIES.some((pair) => pair.requires.length === 2 && pair.requires.every((name) => syn.requires.includes(name)))
));
const SYNERGY_PIECES = new Set(RELIC_SYNERGIES.flatMap((syn) => syn.requires));
const LONER = structuredClone(RELICS.find((relic) => !SYNERGY_PIECES.has(relic.name)));

const withoutMathRandom = (fn) => {
    const original = Math.random;
    Math.random = () => {
        throw new Error('Math.random을 쓰지 않는다 — 자연 플레이 드라이버의 난수열이 밀린다');
    };
    try {
        return fn();
    } finally {
        Math.random = original;
    }
};

const relicState = (relics, pendingRelics) => ({
    ...structuredClone(INITIAL_STATE),
    gameState: GS.IDLE,
    player: { ...structuredClone(INITIAL_STATE.player), name: '유물 순간', relics },
    pendingRelics,
});

/* ───────────────────────── GF-08 · 유물을 받은 순간 ───────────────────────── */

test('GF-08 조합 순간: 마지막 조각이 들어오면 이름 · 대가가 나오고, 함께 켜지면 세 조각 전설 조합이 먼저다', () => {
    assert.ok(PAIR && LEGENDARY && LONER, '두 조각 · 세 조각 조합과 어느 조합에도 들지 않는 유물이 데이터에 있다');
    const [first, second] = PAIR.requires.map(relicByName);
    assert.deepEqual(getSynergyMomentsBetween([first], [first, second]), [
        { label: PAIR.label, legendary: false, drawback: formatSynergyDrawback(PAIR) },
    ]);
    assert.deepEqual(getSynergyMomentsBetween([first, second], [first, second]), [], '이미 켜진 조합은 다시 알리지 않는다');

    // 전설 조합의 두 조각 짝이 아닌 조각 둘을 먼저 가진 뒤 마지막 조각이 짝과 전설을 함께 켠다.
    const inner = RELIC_SYNERGIES.find((pair) => pair.requires.length === 2 && pair.requires.every((name) => LEGENDARY.requires.includes(name)));
    const outsider = LEGENDARY.requires.find((name) => !inner.requires.includes(name));
    const before = [relicByName(inner.requires[0]), relicByName(outsider)];
    const after = [...before, relicByName(inner.requires[1])];
    const moments = getSynergyMomentsBetween(before, after);
    assert.deepEqual(moments.map((moment) => moment.label), [LEGENDARY.label, inner.label]);
    assert.equal(moments[0].legendary, true);
    assert.equal(moments[0].drawback, formatSynergyDrawback(LEGENDARY));
});

test('GF-08 획득 순간: 새 유물이 들어올 때만 — 이름과 그 유물로 켜진 조합 하나(전설 먼저)', () => {
    const [first, second] = PAIR.requires.map(relicByName);
    assert.deepEqual(getRelicAcquisitionMoment([], [LONER]), { relicName: LONER.name, synergy: null }, '조합이 없으면 이름만');
    assert.deepEqual(getRelicAcquisitionMoment([first], [first, second]), {
        relicName: second.name,
        synergy: { label: PAIR.label, legendary: false, drawback: formatSynergyDrawback(PAIR) },
    });

    const inner = RELIC_SYNERGIES.find((pair) => pair.requires.length === 2 && pair.requires.every((name) => LEGENDARY.requires.includes(name)));
    const outsider = LEGENDARY.requires.find((name) => !inner.requires.includes(name));
    const owned = [relicByName(inner.requires[0]), relicByName(outsider)];
    const legendaryMoment = getRelicAcquisitionMoment(owned, [...owned, relicByName(inner.requires[1])]);
    assert.equal(legendaryMoment.synergy.label, LEGENDARY.label, '함께 켜진 조합 중 전설이 띠에 오른다');
    assert.equal(legendaryMoment.synergy.legendary, true);

    // 교체: 내려놓은 유물 대신 들어온 유물이 순간이다.
    assert.equal(getRelicAcquisitionMoment([first, LONER], [first, second]).relicName, second.name);
});

test('GF-08 획득 순간이 아닌 것: 넘기기 · 같은 목록 · 처치 수 갱신 · 빌린 유물 · 반납 · 비움', () => {
    const [first, second] = PAIR.requires.map(relicByName);
    assert.equal(getRelicAcquisitionMoment([first], [first]), null, '넘기기(유물 그대로)');
    assert.equal(getRelicAcquisitionMoment([first], [structuredClone(first)]), null, '새 배열이어도 같은 유물');
    const soul = relicByName('영혼 수집가');
    assert.equal(getRelicAcquisitionMoment([{ ...soul, kills: 3 }], [{ ...soul, kills: 4 }]), null, '영혼 수집가의 처치 수 갱신');
    assert.equal(getRelicAcquisitionMoment([first], [first, { ...second, borrowed: true }]), null, '혼돈의 심장이 빌린 유물은 받은 것이 아니다');
    assert.deepEqual(getSynergyMomentsBetween([first], [first, { ...second, borrowed: true }]), [], '빌린 조각은 조합도 켜지 않는다');
    assert.equal(getRelicAcquisitionMoment([first, { ...second, borrowed: true }], [first]), null, '빌린 유물 반납');
    assert.equal(getRelicAcquisitionMoment([first, second], []), null, '사망 · 계승으로 비움');
    assert.equal(getRelicAcquisitionMoment(null, null), null);
});

test('GF-08 리듀서는 그대로다: ADD_RELIC은 기록 줄을 더하지 않고 Math.random을 쓰지 않는다 · REPLACE_RELIC은 교체 줄 하나', () => {
    const [first, second] = PAIR.requires.map(relicByName);
    const before = relicState([first], [second]);
    const after = withoutMathRandom(() => gameReducer(before, { type: AT.ADD_RELIC, payload: second }));
    assert.equal(after.pendingRelics, null);
    assert.deepEqual(after.player.relics.map((relic) => relic.id), [first.id, second.id]);
    assert.deepEqual(after.logs, before.logs, '조합이 켜져도 기록 줄은 없다 — 순간은 화면의 띠다');

    const cap = getPrestigeUnlocks(0).maxRelics;
    const fillers = RELICS.filter((relic) => !SYNERGY_PIECES.has(relic.name)).slice(0, cap - 1).map((relic) => structuredClone(relic));
    assert.equal(fillers.length, cap - 1);
    const full = relicState([first, ...fillers], [second]);
    // 교체 줄의 기록 id는 이전부터 리듀서가 만든다(appendRewardLogs) — 이 묶음은 그 줄 수를 바꾸지 않는다.
    const replaced = gameReducer(full, {
        type: AT.REPLACE_RELIC,
        payload: { relicId: second.id, replaceRelicId: fillers[0].id },
    });
    assert.equal(replaced.player.relics.length, cap);
    assert.deepEqual(replaced.logs.slice(full.logs.length).map(({ type, text }) => ({ type, text })), [
        { type: 'success', text: MSG.RELIC_REPLACED(fillers[0].name, second.name) },
    ]);
});

test('GF-08 획득 띠 렌더: 처음에는 비어 있는 상태 알림 칸만 있다(화면 낭독기가 띠를 읽는다) — 누르는 것을 받지 않는다', () => {
    const html = renderStatic(createElement(MomentBanners, { enemy: null, relics: [LONER], presentationEpoch: 0 }));
    assert.match(html, /^<div role="status" data-testid="moment-banners" class="pointer-events-none fixed[^"]*"><\/div>$/);
    const below = renderStatic(createElement(MomentBanners, { enemy: null, relics: [], presentationEpoch: 0, belowLevelUp: true }));
    assert.ok(!below.includes('top-[calc(var(--aether-safe-area-top)+0.5rem)]'), '레벨 상승 띠가 떠 있으면 그 아래 줄이다');
    const boss = renderStatic(createElement(MomentBanners, { enemy: { name: '리치 왕', isBoss: true }, relics: [], presentationEpoch: 0 }));
    assert.ok(!boss.includes('encounter-banner'), '처음 렌더의 적은 나타난 순간이 아니다(복원 · 새로 고침)');
});

/* ───────────────────────── CL-05 · 전직이 열린 레벨업 ───────────────────────── */

const firstClassChangeLevel = Math.min(...CLASSES['모험가'].next.map((name) => CLASSES[name].reqLv || 1));

test('CL-05 전직 준비 판정: 다음 직업의 레벨에 처음 닿는 레벨업만 참이고, 띠의 레벨이 그 레벨 이상일 때 부제를 단다', () => {
    const lv = firstClassChangeLevel;
    assert.equal(canChangeClassAt('모험가', lv - 1), false);
    assert.equal(canChangeClassAt('모험가', lv), true);
    assert.equal(isClassChangeNewlyReady('모험가', lv - 1, lv), true);
    assert.equal(isClassChangeNewlyReady('모험가', 1, lv + 2), true, '여러 레벨을 한 번에 올라도 그 문턱을 넘으면 참이다');
    assert.equal(isClassChangeNewlyReady('모험가', lv, lv + 1), false, '이미 열린 전직은 다시 알리지 않는다');
    assert.equal(isClassChangeNewlyReady('모험가', lv, lv), false);
    const leaf = Object.keys(CLASSES).find((name) => !(CLASSES[name].next || []).length);
    assert.ok(leaf);
    assert.equal(isClassChangeNewlyReady(leaf, 1, 99), false, '다음 직업이 없으면 거짓이다');
    assert.equal(isClassChangeNewlyReady(undefined, 1, 99), false);

    // 2 · 3차 전직도 같은 판정이다(직업마다 다음 직업의 reqLv).
    const second = CLASSES['모험가'].next[0];
    const secondLv = Math.min(...(CLASSES[second].next || []).map((name) => CLASSES[name].reqLv || 1));
    assert.equal(isClassChangeNewlyReady(second, secondLv - 1, secondLv), true);
    assert.equal(isClassChangeNewlyReady(second, secondLv - 2, secondLv - 1), false);

    assert.equal(isLevelUpClassChangeReady(lv, lv), true);
    assert.equal(isLevelUpClassChangeReady(lv + 1, lv), true, '이어서 오른 레벨의 띠도 부제를 단다');
    assert.equal(isLevelUpClassChangeReady(lv - 1, lv), false);
    assert.equal(isLevelUpClassChangeReady(null, lv), false, '띠가 없으면 없다');
    assert.equal(isLevelUpClassChangeReady(lv, null), false);
});

test('CL-05 엔진 기록은 그대로다: 전직이 열리는 레벨업도 기록에 전직 줄을 더하지 않는다(알림은 띠의 부제)', () => {
    const lv = firstClassChangeLevel;
    const player = { ...structuredClone(INITIAL_STATE.player), job: '모험가', level: lv - 1, exp: 0, nextExp: 100 };
    const crossed = CombatEngine.applyExpGain(player, 100);
    assert.equal(crossed.updatedPlayer.level, lv);
    assert.ok(crossed.logs.length > 0);
    assert.ok(crossed.logs.every((log) => !log.text.includes(MSG.JOB_CHANGE_READY) && !log.text.includes('전직')));
    for (const name of CLASSES['모험가'].next) {
        assert.ok(!MSG.JOB_CHANGE_READY.includes(name), `부제는 직업 이름(${name})을 말하지 않는다 — 고르는 곳은 전직 화면이다`);
    }
});

test('CL-05 · VD-02 레벨 상승 띠: 전직이 열리면 부제를 그리고, 기록 위(화면 30%)가 아니라 위쪽 알림 자리에 불투명하게 놓인다', () => {
    const ready = renderStatic(createElement(LevelUpBanner, { level: firstClassChangeLevel, classChangeReady: true }));
    assert.match(ready, /data-testid="level-up-banner"/);
    assert.match(ready, /data-class-change-ready="true"/);
    assert.match(ready, /data-testid="level-up-class-change-ready"/);
    assert.ok(ready.includes(MSG.JOB_CHANGE_READY));
    assert.ok(!ready.includes('top-[30%]'), '전투 기록 위에 놓지 않는다');
    assert.ok(ready.includes('top-[calc(var(--aether-safe-area-top)+0.5rem)]'), '위쪽 알림 자리');
    assert.ok(!ready.includes('backdrop-blur') && !/rgba\([^)]*,0\.[0-9]+\)_100%/.test(ready), '비쳐 보이지 않는 배경');

    const plain = renderStatic(createElement(LevelUpBanner, { level: 3 }));
    assert.match(plain, /data-class-change-ready="false"/);
    assert.ok(!plain.includes('level-up-class-change-ready'));
    // 띠를 감싸는 칸(예: 늘 있는 상태 알림 칸)은 있어도 되고, 띠 · 부제만 없어야 한다.
    const idle = renderStatic(createElement(LevelUpBanner, { level: null }));
    assert.ok(!idle.includes('data-testid="level-up-banner"'), '레벨 상승이 없으면 띠를 그리지 않는다');
    assert.ok(!idle.includes('레벨 상승') && !idle.includes(MSG.JOB_CHANGE_READY));
});

/* ───────────────────────── GF-09 · 등장 띠 · 모드 전환 ───────────────────────── */

test('GF-09 등장 띠 판정: 우두머리 · 보스만 받고, 같은 조우 · 단계 전환 · 사라짐은 새 띠가 아니다', () => {
    const boss = { name: '리치 왕', baseName: '리치 왕', isBoss: true };
    const champion = { name: '탑의 대마도사', baseName: '마법사', huntChampion: true, isBoss: false };
    const elite = { name: '정예 고블린', baseName: '고블린', isElite: true };
    assert.deepEqual(getEncounterBanner(boss), { kind: 'boss', name: '리치 왕' });
    assert.deepEqual(getEncounterBanner({ ...champion, isBoss: true }), { kind: 'champion', name: champion.name }, '우두머리가 먼저다');
    assert.equal(getEncounterBanner(elite), null, '정예 · 일반 적은 띠가 없다');
    assert.equal(getEncounterBanner(null), null);

    assert.equal(getEncounterIdentity(boss), '리치 왕');
    assert.equal(getEncounterIdentity({ name: '[10층 보스] 심연의 군주', baseName: '심연의 군주' }), '심연의 군주', '정체는 종이다');
    assert.deepEqual(getEncounterBannerOnChange(null, boss), { kind: 'boss', name: '리치 왕' });
    assert.equal(getEncounterBannerOnChange('리치 왕', { ...boss, name: '격노한 리치 왕' }), null, '단계 전환으로 이름이 바뀌어도 같은 조우다');
    assert.equal(
        getEncounterBannerOnChange('리치 왕', { name: '격노한 리치 왕', isBoss: true, phase2Triggered: true }),
        null,
        '종 이름이 없는 적의 단계 전환은 표시 이름이 바뀌어도 새로 나타난 적이 아니다',
    );
    assert.equal(getEncounterBannerOnChange('리치 왕', null), null);
    assert.deepEqual(getEncounterBannerOnChange('고블린', champion), { kind: 'champion', name: champion.name });
});

test('GF-09 모드 전환: 처음 마운트는 박자가 없고, 전투 진입은 전투 박자, 그 밖의 전환은 번갈아 도는 짧은 페이드다', () => {
    const initial = createModeTransition(GS.IDLE);
    assert.equal(getModeEnterClass(initial), '');
    assert.equal(advanceModeTransition(initial, GS.IDLE), initial, '같은 모드는 같은 상태(다시 돌지 않는다)');

    const combat = advanceModeTransition(initial, GS.COMBAT);
    assert.equal(getModeEnterClass(combat), 'animate-combat-start');
    const idle = advanceModeTransition(combat, GS.IDLE);
    const event = advanceModeTransition(idle, GS.EVENT);
    const idleAgain = advanceModeTransition(event, GS.IDLE);
    const classes = [idle, event, idleAgain].map(getModeEnterClass);
    for (const name of classes) assert.match(name, /^aether-mode-enter-[ab]$/);
    assert.notEqual(classes[0], classes[1], '연달아 바뀌면 다른 클래스라 애니메이션이 다시 돈다');
    assert.notEqual(classes[1], classes[2]);
});

/* ───────────────────────── GF-10 · 순서 공개 ───────────────────────── */

test('GF-10 순서 공개 시간표: 숫자는 0에서 끝값까지 오르고, 진행도 1이면 정확히 끝값이다', () => {
    const { countUpMs, lootStaggerMs } = POST_COMBAT_REVEAL_TIMING;
    assert.ok(countUpMs >= 300 && countUpMs <= 500, '약 400ms');
    assert.ok(lootStaggerMs >= 40 && lootStaggerMs <= 80, '약 60ms 간격');
    assert.ok(POST_COMBAT_INPUT_GUARD_MS > 0 && POST_COMBAT_INPUT_GUARD_MS <= 500, '입력 무시는 짧다');
    assert.equal(getRevealProgress(0), 0);
    assert.equal(getRevealProgress(-5), 0);
    assert.equal(getRevealProgress(Number.NaN), 0);
    assert.equal(getRevealProgress(countUpMs / 2), 0.5);
    assert.equal(getRevealProgress(countUpMs * 3), 1);
    assert.equal(getRevealStage(0.99), 0);
    assert.equal(getRevealStage(1), 1);

    assert.equal(getCountUpValue(137, 0), 0);
    assert.equal(getCountUpValue(137, 1), 137);
    assert.equal(getCountUpValue(Number.NaN, 1), 0);
    let previous = 0;
    for (let step = 1; step <= 10; step += 1) {
        const value = getCountUpValue(137, step / 10);
        assert.ok(value >= previous && value <= 137, '내려가지 않고 끝값을 넘지 않는다');
        previous = value;
    }
    assert.ok(getCountUpValue(137, 0.5) > 137 / 2, '처음이 빠르다(ease-out)');
    assert.deepEqual([0, 1, 2].map(getLootRevealDelayMs), [0, lootStaggerMs, lootStaggerMs * 2]);
});

const continueResult = { enemy: '훈련용 정령', exp: 22, gold: 18, items: [], playerHp: 90, playerMaxHp: 100, playerMp: 40, playerMaxMp: 50 };
const inventoryResult = {
    ...continueResult, items: ['강철 롱소드'], upgradeHint: { name: '강철 롱소드', summary: '공격력 +4' },
};
const renderCard = (result, extra = {}) => renderStatic(createElement(PostCombatCard, {
    result, onClose: () => {}, onOpenInventory: () => {}, ...extra,
}));

test('GF-10 승리 카드: 서버 렌더에서는 처음부터 끝값이고, 보스 처치는 금빛 머리말 · 테두리로 구분된다', () => {
    const plain = renderCard(continueResult);
    assert.match(plain, /data-reveal-stage="done"/);
    assert.match(plain, /data-testid="post-combat-reward-exp"[^>]*>경험 \+22</);
    assert.match(plain, /data-testid="post-combat-reward-gold"[^>]*>골드 \+18</);
    assert.ok(!plain.includes('post-combat-boss-label'));
    assert.ok(!plain.includes('aether-post-combat-boss'));

    const boss = renderCard({ ...continueResult, isBoss: true, enemyTier: 'BOSS' });
    assert.match(boss, /data-testid="post-combat-boss-label"/);
    assert.ok(boss.includes(MSG.POST_COMBAT_BOSS_LABEL));
    assert.match(boss, /data-boss-kill="true"/);
    assert.ok(boss.includes('aether-post-combat-boss'));
});

test('GF-10 · UX-10 승리 카드의 주 행동은 나타난 직후 잠깐 받지 않는다(연타 실수 방지) — 닫기는 언제나 받는다', () => {
    const html = renderCard(continueResult, { onExplore: () => {} });
    assert.match(html, /data-input-ready="false"/);
    assert.match(html, /<button[^>]*data-testid="post-combat-primary-action"[^>]*disabled=""/);
    assert.doesNotMatch(html, /<button[^>]*data-testid="post-combat-close"[^>]*disabled=""/);
});

/* ───────────────────────── UX-10 · '계속 탐험'은 탐험한다 ───────────────────────── */

const playerAt = (loc, overrides = {}) => makePlayerFixture({
    name: '탐험', job: '전사', level: 40, hp: 500, maxHp: 500, gold: 500, quests: [], status: [], inv: [],
    eventChainProgress: {}, loc, ...overrides,
});

const renderControlPanel = (player, gameState = GS.IDLE) => renderStatic(createElement(ControlPanel, {
    gameState, player, enemy: null, actions: new Proxy({}, { get: () => () => {} }), setGameState: () => {},
    shopItems: [], grave: null, isAiThinking: false, currentEvent: null, stats: null, onOpenArchiveConsole: () => {},
}));

test('UX-10 계속 탐험 판정은 조작판의 탐험 단추와 같다 — 사냥 지역 · 마을 · 조사 도시 · 이야기 스텝이 기다리는 안전지대', () => {
    const field = Object.entries(DB.MAPS).find(([, map]) => map.type !== 'safe' && (map.monsters || []).length > 0)?.[0];
    assert.ok(field);
    const cases = [
        ['사냥 지역', playerAt(field), true],
        ['시작 마을', playerAt('시작의 마을'), false],
        ['몬스터 없는 안전지대', playerAt('여행자의 쉼터'), false],
        ['조사할 수 있는 안전지대(황금 왕국)', playerAt('황금 왕국'), true],
        ['이야기 스텝이 기다리는 안전지대', playerAt('북부 요새', { eventChainProgress: { machine_uprising: 2 } }), true],
        ['이야기 스텝이 없는 같은 안전지대', playerAt('북부 요새'), false],
    ];
    for (const [label, player, expected] of cases) {
        assert.equal(DB.MAPS[player.loc].type === 'safe', label !== '사냥 지역', `${label}: 지역 종류`);
        const hasExploreButton = renderControlPanel(player).includes('data-testid="control-explore"');
        assert.equal(hasExploreButton, expected, `${label}: 조작판 탐험 단추`);
        assert.equal(canContinueExploreAfterCombat(GS.IDLE, player), hasExploreButton, `${label}: 결과 카드의 계속 탐험 = 조작판 탐험 단추`);
    }

    const fieldPlayer = playerAt(field);
    for (const mode of [GS.COMBAT, GS.EVENT, GS.SHOP, GS.EVENT_PENDING, GS.DEAD]) {
        assert.equal(canContinueExploreAfterCombat(mode, fieldPlayer), false, `${mode}: 대기 모드가 아니면 탐험하지 않는다`);
    }
    assert.equal(canContinueExploreAfterCombat(GS.IDLE, playerAt('없는 지역')), false);
    assert.equal(canContinueExploreAfterCombat(GS.IDLE, null), false);
});

test('UX-10 결과 카드에 넘기는 탐험은 실제 탐험 액션을 정확히 한 번 부르고, 탐험할 수 없으면 넘기지 않는다', () => {
    const field = playerAt('고요한 숲');
    let explored = 0;
    const explore = () => { explored += 1; return Promise.resolve(); };
    const action = getPostCombatExploreAction(GS.IDLE, field, explore);
    assert.equal(typeof action, 'function');
    assert.equal(action(), undefined, '약속을 돌려주지 않는다(카드는 기다리지 않는다)');
    assert.equal(explored, 1);
    assert.equal(getPostCombatExploreAction(GS.IDLE, playerAt('시작의 마을'), explore), null);
    assert.equal(getPostCombatExploreAction(GS.SHOP, field, explore), null);
    assert.equal(getPostCombatExploreAction(GS.IDLE, field, undefined), null);
    assert.equal(explored, 1);
});

const primaryButtonText = (html) => {
    const match = html.match(/<button[^>]*data-testid="post-combat-primary-action"[^>]*>([\s\S]*?)<\/button>/);
    assert.ok(match, '주 행동 단추가 있다');
    return match[1].replace(/<[^>]+>/g, '').trim();
};

test('UX-10 승리 카드: 탐험할 수 없는 곳에서는 주 행동이 "닫기"이고 "계속 탐험"이라 말하지 않는다', () => {
    const closeOnly = renderCard(continueResult);
    assert.match(closeOnly, /data-primary-kind="close"/);
    assert.equal(primaryButtonText(closeOnly), MSG.POST_COMBAT_CLOSE_LABEL, '탐험하지 않는 단추가 탐험을 약속하지 않는다');
    assert.ok(!closeOnly.includes('계속 탐험'), '판단 칸의 추천도 주 행동과 같은 이름이다');

    const explore = renderCard(continueResult, { onExplore: () => {} });
    assert.match(explore, /data-primary-kind="explore"/);
    assert.equal(primaryButtonText(explore), '계속 탐험');
});

test('UX-10 승리 카드: 장비 확인 추천이면 "계속 탐험" 보조 단추는 탐험할 수 있을 때만 있다', () => {
    const noExplore = renderCard(inventoryResult);
    assert.match(noExplore, /data-primary-kind="inventory"/);
    assert.ok(!noExplore.includes('post-combat-continue'), '닫기 아이콘과 같은 일을 하는 단추를 그리지 않는다');

    const withExplore = renderCard(inventoryResult, { onExplore: () => {} });
    assert.match(withExplore, /data-primary-kind="inventory"/);
    assert.match(withExplore, /data-testid="post-combat-continue"/);
    assert.match(withExplore, /<button[^>]*data-testid="post-combat-continue"[^>]*disabled=""/, '보조 단추도 입력 무시 시간을 지킨다');
});

/* ───────────────────────── UX-11 · 유물 카드의 거짓 꺾쇠 ───────────────────────── */

test('UX-11 유물 카드: 다른 화면으로 넘어가는 꺾쇠 아이콘이 없다 — 카드를 누르면 받는다', () => {
    const offered = RELICS.slice(0, 3).map((relic) => structuredClone(relic));
    const player = { ...structuredClone(INITIAL_STATE.player), relics: [] };
    const html = renderStatic(createElement(RelicChoicePanel, {
        pendingRelics: offered,
        dispatch: () => {},
        player,
        stats: calculateFullStats(player),
    }));
    assert.match(html, /data-testid="relic-choice-0"/);
    assert.ok(!html.includes('lucide-chevron-right'), '꺾쇠 아이콘이 없다');
    assert.ok(!html.includes('_18px]'), '꺾쇠 칸(18px)이 없다');
    assert.ok(!html.includes('data-relic-confirming'), '아직 고르지 않았다');
});
