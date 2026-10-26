import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import { build } from 'vite';
import { chromium } from 'playwright';

import { CLASSES } from '../src/data/classes.ts';
import { MSG } from '../src/data/messages.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { getPrestigeUnlocks } from '../src/systems/prestigeUnlocks.ts';
import { ENCOUNTER_BANNER_MS } from '../src/hooks/useEncounterBanner.ts';
import { RELIC_ACQUIRED_BANNER_MS, RELIC_SYNERGY_BANNER_MS } from '../src/hooks/useRelicAcquisitionMoment.ts';
import { CLASS_CHANGE_READY_HOLD_MS } from '../src/hooks/useClassChangeReadyLevel.ts';
import { POST_COMBAT_INPUT_GUARD_MS, POST_COMBAT_REVEAL_TIMING } from '../src/utils/postCombatReveal.ts';
import { formatSynergyDrawback } from '../src/utils/relicSynergyHint.ts';
import { getRelicDisplayName } from '../src/utils/relicPresentation.ts';

/**
 * 2026-10 감사 rewards-progression — 시간이 있는 순간을 실제 훅 · 컴포넌트로 Chromium에서 돌린다(가짜 시계).
 *   - GF-08: 유물을 받은 순간의 띠(1.4초, 조합이 켜지면 이름 · 대가와 2초) · 고른 카드가 짧게 빛난 뒤 받는다(0.2초).
 *   - GF-09: 보스 · 우두머리가 나타난 순간의 띠(1.2초) — 같은 조우 · 단계 전환 · 복원은 띠가 없다.
 *   - GF-10: 경험 · 골드가 0에서 끝값까지 늘고 전리품이 그 뒤에 나온다 — 누르면 바로 끝값, 모션 감소는 처음부터 끝값.
 *   - UX-10: '계속 탐험'은 탐험을 부르고 카드를 닫는다 — 나타난 직후 잠깐은 주 행동을 받지 않는다.
 *   - CL-05: 전직이 열린 레벨업의 띠는 부제 '전직할 수 있습니다'를 단다 — 복원 · 전직 · 새 여정은 지운다.
 */

let browser;
let script;

before(async () => {
    const result = await build({
        configFile: false,
        publicDir: false,
        logLevel: 'silent',
        define: { 'process.env.NODE_ENV': '"test"' },
        build: {
            write: false,
            lib: {
                entry: fileURLToPath(new URL('./fixtures/rewards-progression-presentation.js', import.meta.url)),
                name: 'RewardsProgressionPresentationTest',
                formats: ['iife'],
            },
        },
    });
    script = result[0].output.find((entry) => entry.type === 'chunk').code;
    browser = await chromium.launch();
});
after(async () => browser?.close());

const openHarness = async (t, { reducedMotion = 'no-preference' } = {}) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    // 그림 자산은 판정 대상이 아니다 — 기준 주소만 주고 네트워크는 막는다.
    await page.route('**/*', (route) => route.abort());
    await page.setContent('<!doctype html><html><head><base href="http://127.0.0.1/"></head><body></body></html>');
    await page.emulateMedia({ reducedMotion });
    // 시계를 멈춘다 — 평가 왕복에 실제 시간이 흘러도 연출 타이머는 runFor로 민 만큼만 간다.
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1_000);
    await page.addScriptTag({ content: script });
    return {
        render: (view, props) => page.evaluate(([v, p]) => window.rewardsHarness.render(v, p), [view, props]),
        rerender: (view, props) => page.evaluate(([v, p]) => window.rewardsHarness.rerender(v, p), [view, props]),
        click: (selector) => page.evaluate((s) => window.rewardsHarness.click(s), selector),
        read: () => page.evaluate(() => window.rewardsHarness.read()),
        tick: async (ms) => {
            await page.evaluate((value) => window.rewardsHarness.startTick(value), ms);
            await page.clock.runFor(ms);
            await page.evaluate(() => window.rewardsHarness.finishTick());
        },
    };
};

const relicByName = (name) => {
    const relic = RELICS.find((entry) => entry.name === name);
    assert.ok(relic, `유물 '${name}'`);
    return structuredClone(relic);
};
const PAIR = RELIC_SYNERGIES.find((syn) => syn.requires.length === 2);
const [PAIR_FIRST, PAIR_SECOND] = PAIR.requires.map(relicByName);
const SYNERGY_PIECES = new Set(RELIC_SYNERGIES.flatMap((syn) => syn.requires));
const LONERS = RELICS.filter((relic) => !SYNERGY_PIECES.has(relic.name)).map((relic) => structuredClone(relic));
const BOSS = { name: '리치 왕', baseName: '리치 왕', isBoss: true, hp: 900, maxHp: 900 };
const CHAMPION = { name: '탑의 대마도사', baseName: '마법사', huntChampion: true, hp: 600, maxHp: 600 };

/* ───────────────────────── GF-09 · 등장 띠 ───────────────────────── */

test('GF-09 등장 띠: 새 보스가 나타난 순간 1.2초 — 처음 렌더 · 같은 조우의 다음 차례 · 단계 전환은 띠가 없다', async (t) => {
    const h = await openHarness(t);
    assert.equal((await h.render('encounter', { enemy: BOSS, epoch: 0 })).snapshot.banner, null, '처음 렌더(새로 고침 · 복원)의 적은 나타난 순간이 아니다');
    await h.render('encounter', { enemy: null, epoch: 0 });
    const shown = (await h.render('encounter', { enemy: BOSS, epoch: 0 })).snapshot.banner;
    assert.deepEqual(shown, { kind: 'boss', name: '리치 왕', serial: 1 });
    assert.deepEqual((await h.render('encounter', { enemy: { ...BOSS, hp: 700 }, epoch: 0 })).snapshot.banner, shown, '같은 조우의 다음 차례');
    await h.tick(ENCOUNTER_BANNER_MS - 1);
    assert.ok((await h.read()).snapshot.banner, '아직 머문다');
    await h.tick(1);
    assert.equal((await h.read()).snapshot.banner, null);

    await h.render('encounter', { enemy: null, epoch: 0 });
    const named = { name: '거대 골렘', isBoss: true };
    assert.equal((await h.render('encounter', { enemy: named, epoch: 0 })).snapshot.banner.serial, 2, '전투가 끝난 뒤 다시 만나면 새 띠');
    assert.equal(
        (await h.render('encounter', { enemy: { name: '격노한 거대 골렘', isBoss: true, phase2Triggered: true }, epoch: 0 })).snapshot.banner.serial,
        2,
        '단계 전환은 새로 나타난 적이 아니다',
    );
    assert.equal((await h.render('encounter', { enemy: null, epoch: 0 })).snapshot.banner, null, '전투가 끝나면 띠도 내린다');
});

test('GF-09 등장 띠: 복원은 띠를 내리고 알리지 않는다 — 지난 띠의 타이머가 다음 띠를 지우지 않는다', async (t) => {
    const h = await openHarness(t);
    await h.render('encounter', { enemy: null, epoch: 0 });
    await h.render('encounter', { enemy: BOSS, epoch: 0 });
    await h.tick(500);
    assert.equal((await h.render('encounter', { enemy: CHAMPION, epoch: 1 })).snapshot.banner, null, '복원된 전투의 적');
    await h.render('encounter', { enemy: null, epoch: 1 });
    const champion = (await h.render('encounter', { enemy: CHAMPION, epoch: 1 })).snapshot.banner;
    assert.deepEqual({ kind: champion.kind, name: champion.name }, { kind: 'champion', name: CHAMPION.name });
    await h.tick(800);
    assert.ok((await h.read()).snapshot.banner, '첫 띠의 1.2초가 지나도 새 띠는 남는다');
    await h.tick(400);
    assert.equal((await h.read()).snapshot.banner, null);
});

test('GF-09 등장 띠 화면: 누가 나타났는지만 말한다 — 보스 · 우두머리 구분, 권고 없음', async (t) => {
    const h = await openHarness(t);
    await h.render('moments', { enemy: null, relics: [], epoch: 0 });
    const boss = (await h.render('moments', { enemy: BOSS, relics: [], epoch: 0 })).dom.encounter;
    assert.equal(boss.kind, 'boss');
    assert.equal(boss.text, `${MSG.BOSS_ENTRY_BANNER}${BOSS.name}`);
    for (const advice of ['도주', '물약', '추천', '권장']) assert.ok(!boss.text.includes(advice), `권고(${advice})가 없다`);

    await h.render('moments', { enemy: null, relics: [], epoch: 0 });
    await h.tick(600);
    const champion = (await h.render('moments', { enemy: CHAMPION, relics: [], epoch: 0 })).dom.encounter;
    assert.equal(champion.kind, 'champion');
    assert.equal(champion.text, `${MSG.HUNT_CHAMPION_ENTRY_BANNER}${CHAMPION.name}`);
});

/* ───────────────────────── GF-08 · 유물을 받은 순간 ───────────────────────── */

test('GF-08 획득 띠: 새 유물은 1.4초, 조합이 켜지면 이름 · 대가와 함께 2초 — 같은 목록 · 복원은 띠가 없다', async (t) => {
    const h = await openHarness(t);
    assert.equal((await h.render('relicMoment', { relics: [], epoch: 0 })).snapshot.moment, null);
    const plain = (await h.render('relicMoment', { relics: [LONERS[0]], epoch: 0 })).snapshot.moment;
    assert.deepEqual(plain, { relicName: LONERS[0].name, synergy: null, serial: 1 });
    assert.deepEqual((await h.render('relicMoment', { relics: [structuredClone(LONERS[0])], epoch: 0 })).snapshot.moment, plain, '새 배열이어도 같은 목록');
    await h.tick(RELIC_ACQUIRED_BANNER_MS - 1);
    assert.ok((await h.read()).snapshot.moment);
    await h.tick(1);
    assert.equal((await h.read()).snapshot.moment, null);

    await h.render('relicMoment', { relics: [LONERS[0], PAIR_FIRST], epoch: 0 });
    const pair = (await h.render('relicMoment', { relics: [LONERS[0], PAIR_FIRST, PAIR_SECOND], epoch: 0 })).snapshot.moment;
    assert.equal(pair.relicName, PAIR_SECOND.name);
    assert.deepEqual(pair.synergy, { label: PAIR.label, legendary: false, drawback: formatSynergyDrawback(PAIR) });
    await h.tick(RELIC_SYNERGY_BANNER_MS - 1);
    assert.ok((await h.read()).snapshot.moment, '조합 띠는 조금 더 머문다');
    await h.tick(1);
    assert.equal((await h.read()).snapshot.moment, null);

    await h.render('relicMoment', { relics: [LONERS[0], PAIR_FIRST, PAIR_SECOND, LONERS[1]], epoch: 0 });
    assert.equal((await h.render('relicMoment', { relics: [LONERS[2]], epoch: 1 })).snapshot.moment, null, '복원은 받은 유물이 아니다 — 떠 있던 띠도 내린다');
    assert.equal((await h.render('relicMoment', { relics: [LONERS[2], { ...LONERS[3], borrowed: true }], epoch: 1 })).snapshot.moment, null, '빌린 유물');
});

test('GF-08 획득 띠 화면: 조합 이름과 대가 한 줄 · 그냥 유물은 이름 — 레벨 상승 띠가 떠 있으면 그 아래 줄', async (t) => {
    const h = await openHarness(t);
    await h.render('moments', { enemy: null, relics: [PAIR_FIRST], epoch: 0 });
    const pair = (await h.render('moments', { enemy: null, relics: [PAIR_FIRST, PAIR_SECOND], epoch: 0 })).dom;
    assert.equal(pair.relicMoment.kind, 'pair');
    assert.ok(pair.relicMoment.text.startsWith(`${MSG.RELIC_PAIR_COMPLETE_BADGE}${PAIR.label}`));
    assert.equal(pair.relicMoment.drawback, MSG.RELIC_SYNERGY_DRAWBACK_LINE(formatSynergyDrawback(PAIR)));
    assert.equal(pair.momentTop, 'top-[calc(var(--aether-safe-area-top)+0.5rem)]');

    await h.tick(RELIC_SYNERGY_BANNER_MS + 600);
    const plain = (await h.render('moments', { enemy: null, relics: [PAIR_FIRST, PAIR_SECOND, LONERS[0]], epoch: 0, belowLevelUp: true })).dom;
    assert.equal(plain.relicMoment.kind, 'plain');
    assert.equal(plain.relicMoment.text, `${MSG.RELIC_ACQUIRED_LABEL}${getRelicDisplayName(LONERS[0].name)}`);
    assert.equal(plain.relicMoment.drawback, null);
    assert.notEqual(plain.momentTop, pair.momentTop, '레벨 상승 띠와 겹치지 않는다');
});

const relicPlayer = (relics = []) => ({ ...structuredClone(INITIAL_STATE.player), relics });

test('GF-08 · UX-11 고른 카드는 0.2초 빛난 뒤 받는다 — 그동안 다른 카드 · 넘기기는 받지 않는다', async (t) => {
    const h = await openHarness(t);
    const offer = LONERS.slice(0, 3);
    await h.render('relics', { offer, player: relicPlayer() });
    const picked = await h.click('[data-testid="relic-choice-1"]');
    assert.deepEqual(picked.dom.relicCards, [false, true, false]);
    assert.deepEqual(picked.dispatched, [], '아직 받지 않았다');
    await h.click('[data-testid="relic-choice-0"]');
    await h.click('[data-testid="relic-choice-skip"]');
    await h.tick(199);
    assert.deepEqual((await h.read()).dispatched, [], '확정 중 다른 카드 · 넘기기는 무시한다');
    await h.tick(1);
    const done = await h.read();
    assert.deepEqual(done.dispatched, [{ type: AT.ADD_RELIC, id: offer[1].id }], '고른 카드 하나를 받는다');
    assert.deepEqual(done.dom.relicCards, [false, false, false], '리듀서가 거부해 패널이 남아도 다시 고를 수 있다');

    await h.click('[data-testid="relic-choice-2"]');
    await h.tick(200);
    assert.deepEqual((await h.read()).dispatched.map((action) => action.id), [offer[1].id, offer[2].id]);
});

test('GF-08 확정 박자는 그 제안에만 묶인다 — 제안이 바뀌거나 패널이 내려가면 지난 카드를 받지 않는다', async (t) => {
    const h = await openHarness(t);
    const offer = LONERS.slice(0, 3);
    await h.render('relics', { offer, player: relicPlayer() });
    await h.click('[data-testid="relic-choice-0"]');
    await h.tick(100);
    const replaced = await h.render('relics', { offer: LONERS.slice(0, 3), player: relicPlayer() });
    assert.deepEqual(replaced.dom.relicCards, [false, false, false], '새 제안(같은 유물이어도)은 고르기 전이다');
    await h.tick(300);
    assert.deepEqual((await h.read()).dispatched, []);

    await h.click('[data-testid="relic-choice-2"]');
    await h.render('none', {});
    await h.tick(300);
    assert.deepEqual((await h.read()).dispatched, [], '패널이 내려가면(사망 · 복원) 받지 않는다');
});

test('GF-08 모션 감소 · 가득 찬 칸: 기다리지 않는다 — 바로 받거나 교체할 유물을 고른다', async (t) => {
    const reduced = await openHarness(t, { reducedMotion: 'reduce' });
    const offer = LONERS.slice(0, 3);
    await reduced.render('relics', { offer, player: relicPlayer() });
    const picked = await reduced.click('[data-testid="relic-choice-0"]');
    assert.deepEqual(picked.dispatched, [{ type: AT.ADD_RELIC, id: offer[0].id }]);
    assert.deepEqual(picked.dom.relicCards, [false, false, false]);

    const h = await openHarness(t);
    const cap = getPrestigeUnlocks(0).maxRelics;
    await h.render('relics', { offer, player: relicPlayer(LONERS.slice(3, 3 + cap)) });
    const atCap = await h.click('[data-testid="relic-choice-1"]');
    assert.deepEqual(atCap.dom.relicCards, [false, false, false], '칸이 차면 확정 박자 없이 교체 단계로 간다');
    await h.tick(300);
    assert.deepEqual((await h.read()).dispatched, []);
});

/* ───────────────────────── CL-05 · 전직이 열린 레벨업 ───────────────────────── */

const FIRST_CLASS_LV = Math.min(...CLASSES['모험가'].next.map((name) => CLASSES[name].reqLv || 1));

test('CL-05 레벨 상승 띠의 전직 부제: 전직이 열린 레벨업에만 — 이어서 오른 레벨에도 남고, 시간이 지나면 내린다', async (t) => {
    const h = await openHarness(t);
    const base = { job: '모험가', epoch: 0 };
    assert.equal((await h.render('classReady', { ...base, level: FIRST_CLASS_LV - 2 })).snapshot.readyLevel, null);
    const early = await h.render('classReady', { ...base, level: FIRST_CLASS_LV - 1, bannerLevel: FIRST_CLASS_LV - 1 });
    assert.equal(early.snapshot.readyLevel, null, '문턱 아래 레벨업');
    assert.equal(early.dom.levelUp.classChangeReady, 'false');

    const ready = await h.render('classReady', { ...base, level: FIRST_CLASS_LV, bannerLevel: FIRST_CLASS_LV });
    assert.equal(ready.snapshot.readyLevel, FIRST_CLASS_LV);
    assert.equal(ready.dom.levelUp.classChangeReady, 'true');
    assert.ok(ready.dom.levelUp.text.includes(MSG.JOB_CHANGE_READY));

    await h.tick(1_500);
    const next = await h.render('classReady', { ...base, level: FIRST_CLASS_LV + 1, bannerLevel: FIRST_CLASS_LV + 1 });
    assert.equal(next.dom.levelUp.classChangeReady, 'true', '이어서 오른 레벨의 띠도 부제를 단다');
    await h.tick(CLASS_CHANGE_READY_HOLD_MS - 1);
    assert.equal((await h.read()).snapshot.readyLevel, FIRST_CLASS_LV, '이어서 오른 레벨업이 해제 시간을 다시 잡는다');
    await h.tick(1);
    const cleared = await h.read();
    assert.equal(cleared.snapshot.readyLevel, null);
    assert.equal(cleared.dom.levelUp.classChangeReady, 'false');
});

test('CL-05 전직 부제는 복원 · 전직 · 새 여정에서 내리고 다시 알리지 않는다', async (t) => {
    const h = await openHarness(t);
    await h.render('classReady', { job: '모험가', epoch: 0, level: FIRST_CLASS_LV - 1 });
    assert.equal((await h.render('classReady', { job: '모험가', epoch: 0, level: FIRST_CLASS_LV })).snapshot.readyLevel, FIRST_CLASS_LV);
    const changed = CLASSES['모험가'].next[0];
    assert.equal((await h.render('classReady', { job: changed, epoch: 0, level: FIRST_CLASS_LV })).snapshot.readyLevel, null, '전직했다');

    await h.render('classReady', { job: '모험가', epoch: 0, level: FIRST_CLASS_LV - 1 });
    assert.equal((await h.render('classReady', { job: '모험가', epoch: 1, level: FIRST_CLASS_LV })).snapshot.readyLevel, null, '복원으로 오른 레벨');
    assert.equal((await h.render('classReady', { job: '모험가', epoch: 1, level: 1 })).snapshot.readyLevel, null, '새 여정');
    assert.equal((await h.render('classReady', { job: '모험가', epoch: 1, level: FIRST_CLASS_LV })).snapshot.readyLevel, FIRST_CLASS_LV, '그 뒤 실제 레벨업은 다시 알린다');
});

/* ───────────────────────── GF-10 · UX-10 · 승리 카드 ───────────────────────── */

const LOOT_RESULT = {
    enemy: '훈련용 정령', exp: 240, gold: 180, items: ['강철 롱소드', '벌레 껍질'],
    playerHp: 90, playerMaxHp: 100, playerMp: 40, playerMaxMp: 50,
};
const CONTINUE_RESULT = { enemy: '훈련용 정령', exp: 22, gold: 18, items: [], playerHp: 90, playerMaxHp: 100, playerMp: 40, playerMaxMp: 50 };
const expOf = (card) => Number(card.exp.replace(/[^0-9]/g, ''));

test('GF-10 순서 공개: 경험 · 골드가 0에서 끝값까지 늘고, 끝나면 전리품이 차례로 나온다', async (t) => {
    const h = await openHarness(t);
    const start = (await h.render('card', { result: LOOT_RESULT, withExplore: true, cardKey: 1 })).dom.card;
    assert.equal(start.stage, 'counting');
    assert.equal(start.exp, '경험 +0');
    assert.equal(start.gold, '골드 +0');
    assert.equal(start.lootPending, true, '전리품은 숫자가 끝난 뒤');

    await h.tick(200);
    const middle = (await h.read()).dom.card;
    assert.equal(middle.stage, 'counting');
    assert.ok(expOf(middle) > 0 && expOf(middle) < LOOT_RESULT.exp, `중간값 ${middle.exp}`);

    await h.tick(POST_COMBAT_REVEAL_TIMING.countUpMs);
    const done = (await h.read()).dom.card;
    assert.equal(done.stage, 'done');
    assert.equal(done.exp, `경험 +${LOOT_RESULT.exp}`);
    assert.equal(done.gold, `골드 +${LOOT_RESULT.gold}`);
    assert.equal(done.lootPending, false);
    assert.ok(done.lootPopping >= 1, '전리품 줄이 튀어나온다');
});

test('GF-10 카드를 누르면 순서 공개를 건너뛰고 끝값이다 — 주 행동의 입력 무시는 그대로다', async (t) => {
    const h = await openHarness(t);
    await h.render('card', { result: LOOT_RESULT, withExplore: true, cardKey: 1 });
    await h.tick(50);
    const skipped = (await h.click('[data-testid="post-combat-reward-summary"]')).dom.card;
    assert.equal(skipped.stage, 'done');
    assert.equal(skipped.exp, `경험 +${LOOT_RESULT.exp}`);
    assert.equal(skipped.lootPending, false);
    assert.equal(skipped.lootPopping, 0, '건너뛰면 튀어나오는 연출도 없다');
    assert.equal(skipped.primaryDisabled, true, '나타난 직후의 입력 무시는 건너뛰기와 별개다');
});

test('GF-10 모션 감소: 처음부터 끝값이고 튀어나오는 연출이 없다', async (t) => {
    const h = await openHarness(t, { reducedMotion: 'reduce' });
    const card = (await h.render('card', { result: LOOT_RESULT, withExplore: true, cardKey: 1 })).dom.card;
    assert.equal(card.stage, 'done');
    assert.equal(card.exp, `경험 +${LOOT_RESULT.exp}`);
    assert.equal(card.lootPending, false);
    assert.equal(card.lootPopping, 0);
});

test('UX-10 계속 탐험(주 행동): 나타난 직후에는 받지 않고, 그 뒤 탐험을 한 번 부르고 카드를 닫는다', async (t) => {
    const h = await openHarness(t);
    const card = (await h.render('card', { result: CONTINUE_RESULT, withExplore: true, cardKey: 1 })).dom.card;
    assert.equal(card.primaryKind, 'explore');
    assert.equal(card.primaryDisabled, true);
    assert.deepEqual((await h.click('[data-testid="post-combat-primary-action"]')).calls, { close: 0, explore: 0, inventory: 0 }, '전투를 끝낸 연타가 탐험을 누르지 않는다');

    await h.tick(POST_COMBAT_INPUT_GUARD_MS - 1);
    assert.equal((await h.read()).dom.card.inputReady, 'false');
    await h.tick(1);
    assert.equal((await h.read()).dom.card.primaryDisabled, false);
    assert.deepEqual((await h.click('[data-testid="post-combat-primary-action"]')).calls, { close: 0, explore: 1, inventory: 0 });
    const again = await h.click('[data-testid="post-combat-primary-action"]');
    assert.ok(again.dom.card, '퇴장 중인 카드가 아직 화면에 있다 — 이 연타는 실제로 단추를 누른다');
    assert.equal(again.calls.explore, 1, '퇴장 중 연타가 탐험을 두 번 부르지 않는다');
    await h.tick(300);
    assert.deepEqual((await h.read()).calls, { close: 1, explore: 1, inventory: 0 }, '탐험이 결과를 비우지 않은 경우에도 카드는 닫힌다');
});

test('UX-10 장비 확인 추천: 보조 단추 "계속 탐험"이 탐험을 부르고, 주 행동은 가방을 연다', async (t) => {
    const h = await openHarness(t);
    const upgrade = { ...LOOT_RESULT, upgradeHint: { name: '강철 롱소드', summary: '공격력 +4' } };
    const card = (await h.render('card', { result: upgrade, withExplore: true, cardKey: 1 })).dom.card;
    assert.equal(card.primaryKind, 'inventory');
    assert.equal(card.continueDisabled, true);
    await h.tick(POST_COMBAT_INPUT_GUARD_MS);
    assert.deepEqual((await h.click('[data-testid="post-combat-continue"]')).calls, { close: 0, explore: 1, inventory: 0 });
    await h.tick(300);
    assert.deepEqual((await h.read()).calls, { close: 1, explore: 1, inventory: 0 });

    await h.render('card', { result: upgrade, withExplore: true, cardKey: 2 });
    await h.tick(POST_COMBAT_INPUT_GUARD_MS);
    assert.deepEqual((await h.click('[data-testid="post-combat-primary-action"]')).calls, { close: 1, explore: 1, inventory: 1 });
});

test('UX-10 탐험할 수 없는 곳: 주 행동은 닫기만 한다 · 닫기 아이콘은 나타난 직후에도 받는다', async (t) => {
    const h = await openHarness(t);
    const card = (await h.render('card', { result: CONTINUE_RESULT, withExplore: false, cardKey: 1 })).dom.card;
    assert.equal(card.primaryKind, 'close');
    assert.deepEqual((await h.click('[data-testid="post-combat-close"]')).calls, { close: 0, explore: 0, inventory: 0 });
    await h.tick(300);
    assert.deepEqual((await h.read()).calls, { close: 1, explore: 0, inventory: 0 });

    await h.render('card', { result: CONTINUE_RESULT, withExplore: false, cardKey: 2 });
    await h.tick(POST_COMBAT_INPUT_GUARD_MS);
    await h.click('[data-testid="post-combat-primary-action"]');
    await h.tick(300);
    assert.deepEqual((await h.read()).calls, { close: 2, explore: 0, inventory: 0 });
});

test('UX-10 탐험이 카드를 먼저 내리면 늦은 닫기가 다음 결과를 지우지 않는다', async (t) => {
    const h = await openHarness(t);
    await h.render('card', { result: CONTINUE_RESULT, withExplore: true, cardKey: 1 });
    await h.tick(POST_COMBAT_INPUT_GUARD_MS);
    await h.click('[data-testid="post-combat-primary-action"]');
    await h.render('none', {});
    await h.tick(300);
    assert.deepEqual((await h.read()).calls, { close: 0, explore: 1, inventory: 0 });
});
