import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import { build } from 'vite';
import { chromium } from 'playwright';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';

/**
 * 게임 필 감사 GF-01 · 02 · 06 · 11 · 12 · 13 — 실제 리듀서 전이가 만든 차례 기록을 실제 표시 훅 · 컴포넌트에 넣고
 * Chromium에서 무엇이 켜지는지 본다(slice 30 · 31의 소스 정규식 가드를 대체한다).
 *
 *   - 내 치명타만 금빛(비네트 · 금빛 '✦' 피해 숫자) — 적 강타는 붉은 비네트 + 흔들림, 내 타격 뒤 박자에.
 *   - 처치 순간: 쓰러진 적 · 마지막 일격 숫자 · '처치' 도장 → 그 뒤 결과 카드.
 *   - 내 피격 숫자는 적 반격 박자에 보인다(한 차례에 한 번) · 모션 감소는 지연 없이 정지 표시.
 *   - 전설 대기열은 동시 · 표시 중에 들어온 전설을 잃지 않는다 · 복원은 연출하지 않는다.
 *   - 레벨 상승 배너는 복원으로 바뀐 레벨을 축하하지 않는다.
 */

const NOW = 1_700_000_000_000;
let browser;
let script;
let css;

before(async () => {
    const result = await build({
        configFile: false,
        publicDir: false,
        logLevel: 'silent',
        define: { 'process.env.NODE_ENV': '"test"' },
        build: {
            write: false,
            lib: {
                entry: fileURLToPath(new URL('./fixtures/combat-feedback-presentation.js', import.meta.url)),
                name: 'CombatFeedbackPresentationTest',
                formats: ['iife'],
            },
        },
    });
    script = result[0].output.find((entry) => entry.type === 'chunk').code;
    css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
    browser = await chromium.launch();
});
after(async () => browser?.close());

const openHarness = async (t, { reducedMotion = 'no-preference', withCss = false } = {}) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    // 그림 자산은 묶음이 기준 주소로 푼다 — 문서에 기준 주소를 주고 네트워크는 막는다(그림은 판정 대상이 아니다).
    await page.route('**/*', (route) => route.abort());
    await page.setContent('<!doctype html><html><head><base href="http://127.0.0.1/"></head><body></body></html>');
    await page.emulateMedia({ reducedMotion });
    // 시계를 멈춘다 — 평가 왕복에 실제 시간이 흘러도 연출 타이머는 runFor로 민 만큼만 간다.
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1_000);
    // 저장소의 index.css를 그대로 싣는다 — @tailwind 같은 빌드 지시문은 브라우저가 건너뛰고 나머지 규칙은 실제로 적용된다.
    if (withCss) await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: script });
    return {
        render: (view, props) => page.evaluate(([v, p]) => window.presentationHarness.render(v, p), [view, props]),
        read: () => page.evaluate(() => window.presentationHarness.read()),
        dismiss: () => page.evaluate(() => window.presentationHarness.dismiss()),
        tick: async (ms) => {
            await page.evaluate((value) => window.presentationHarness.startTick(value), ms);
            await page.clock.runFor(ms);
            await page.evaluate(() => window.presentationHarness.finishTick());
        },
    };
};

const PLAYER = { ...INITIAL_STATE.player, name: '리베이아', level: 8, hp: 900, maxHp: 900, mp: 50, maxMp: 50 };

const makeCombat = ({ enemy = {}, player = {} } = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: { ...structuredClone(PLAYER), atk: 40, loc: '고요한 숲', ...player },
    gameState: GS.COMBAT,
    enemy: {
        name: '정예 숲의 정령',
        baseName: '숲의 정령',
        level: 3,
        hp: 100000,
        maxHp: 100000,
        atk: 30,
        def: 0,
        exp: 1,
        gold: 1,
        pattern: { guardChance: 0, heavyChance: 0 },
        ...enemy,
    },
});

const attack = (state, seed) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn ?? 0, seed, now: NOW },
});

/** 조건에 맞는 실제 차례를 시드로 찾는다(기록 줄은 [내 행동, …, 적 반격] 순서다). */
const findTurn = (state, predicate) => {
    for (let seed = 1; seed <= 400; seed += 1) {
        const next = attack(state, seed);
        const logs = next.logs.slice(state.logs.length);
        if (predicate(next.combatFeedback, logs)) return next;
    }
    throw new Error('NO_MATCHING_TURN');
};

const heavyState = makeCombat({ enemy: { pattern: { guardChance: 0, heavyChance: 1 } } });

test('GF-01: 내 치명타 차례 — 금빛 비네트 · 금빛 피해 숫자는 곧바로, 적 강타의 붉은 비네트 · 흔들림은 박자 뒤', async (t) => {
    const crit = findTurn(heavyState, (feedback) => feedback.playerCrit && feedback.enemyHeavy);
    const h = await openHarness(t);
    await h.render('stage', { feedback: null, epoch: 0, liveEnemy: heavyState.enemy, player: PLAYER });
    const hit = await h.render('stage', { feedback: crit.combatFeedback, epoch: 0, liveEnemy: crit.enemy, player: PLAYER });
    assert.equal(hit.dom.critPulse, true, '내 치명타 금빛 비네트');
    assert.equal(hit.dom.heavyPulse, false, '적 강타는 아직 — 내 타격이 먼저다');
    assert.equal(hit.snapshot.shake, false);
    assert.equal(hit.dom.enemyNumberCrit, 'true');
    assert.equal(hit.dom.enemyNumber, `✦ -${crit.combatFeedback.enemyDamage}`);

    await h.tick(BALANCE.ENEMY_TURN_DELAY_MS);
    const counter = await h.read();
    assert.equal(counter.dom.heavyPulse, true, '적 강타 붉은 비네트는 박자 뒤');
    assert.equal(counter.snapshot.shake, true, '흔들림도 박자 뒤');
    assert.equal(counter.snapshot.critPulse, false, '금빛은 짧게 끝났다');

    await h.tick(BALANCE.COMBAT_SHAKE_MS);
    const settled = await h.read();
    assert.equal(settled.snapshot.heavyPulse, false);
    assert.equal(settled.snapshot.shake, false);
});

test('GF-01: 적 강타만 있던 차례 — 금빛이 뜨지 않는다(예전 기록 꼬리 판정의 오발)', async (t) => {
    const heavyOnly = findTurn(heavyState, (feedback, logs) => (
        !feedback.playerCrit && feedback.enemyHeavy && logs[logs.length - 1].type === 'critical'
    ));
    const h = await openHarness(t);
    await h.render('stage', { feedback: null, epoch: 0, liveEnemy: heavyState.enemy, player: PLAYER });
    const hit = await h.render('stage', { feedback: heavyOnly.combatFeedback, epoch: 0, liveEnemy: heavyOnly.enemy, player: PLAYER });
    assert.equal(hit.dom.critPulse, false, '적 강타에 금빛 비네트가 붙지 않는다');
    assert.equal(hit.dom.enemyNumberCrit, null, '내 일반 타격 숫자는 금빛이 아니다');
    assert.equal(hit.dom.enemyNumber, `-${heavyOnly.combatFeedback.enemyDamage}`);
    await h.tick(BALANCE.ENEMY_TURN_DELAY_MS);
    assert.equal((await h.read()).dom.heavyPulse, true, '적 강타는 붉은 비네트');
});

test('GF-02: 처치 순간 — 쓰러진 적 · 마지막 일격 숫자 · 처치 도장을 그린 뒤 결과 카드를 연다', async (t) => {
    const before = makeCombat({ enemy: { hp: 5, maxHp: 400 } });
    const kill = findTurn(before, (feedback) => feedback.kind === 'victory');
    assert.equal(kill.gameState, GS.IDLE);
    assert.equal(kill.enemy, null, '리듀서는 같은 전이에서 적을 지운다');

    const h = await openHarness(t);
    await h.render('stage', { feedback: null, epoch: 0, liveEnemy: before.enemy, player: PLAYER });
    const beat = await h.render('stage', { feedback: kill.combatFeedback, epoch: 0, liveEnemy: null, player: PLAYER });
    assert.equal(beat.dom.enemyStatus, true, '적 패널이 사라지지 않는다');
    assert.equal(beat.dom.enemyName, '정예 숲의 정령');
    assert.equal(beat.dom.defeated, 'true');
    assert.equal(beat.dom.stamp, MSG.COMBAT_DEFEATED_STAMP);
    assert.ok(beat.dom.enemyNumber?.endsWith(`-${kill.combatFeedback.enemyDamage}`), '마지막 일격 숫자');
    assert.ok(!beat.dom.statusText.includes('전투 중'), '끝난 전투는 전투 중이 아니다');
    assert.equal(beat.snapshot.holdResultCards, true, '결과 카드 · 유물 선택은 처치 순간 뒤');

    await h.tick(BALANCE.KILL_BEAT_MS - 1);
    assert.equal((await h.read()).snapshot.holdResultCards, true);
    await h.tick(1);
    const done = await h.read();
    assert.equal(done.dom.enemyStatus, false);
    assert.equal(done.snapshot.holdResultCards, false);
    assert.equal(done.snapshot.announcement.includes(MSG.COMBAT_FEEDBACK_KILL('정예 숲의 정령')), true);
});

test('GF-13: 마운트 · 복원 때 있던 기록은 연출하지 않는다 — 그 뒤 새 차례만 연출한다', async (t) => {
    const crit = findTurn(heavyState, (feedback) => feedback.playerCrit);
    const kill = findTurn(makeCombat({ enemy: { hp: 5 } }), (feedback) => feedback.kind === 'victory');
    const h = await openHarness(t);
    const mounted = await h.render('stage', { feedback: kill.combatFeedback, epoch: 0, liveEnemy: null, player: PLAYER });
    assert.equal(mounted.dom.enemyStatus, false, '마운트 때의 처치 기록은 기준일 뿐이다');
    assert.equal(mounted.snapshot.announcement, '');
    const restored = await h.render('stage', { feedback: crit.combatFeedback, epoch: 1, liveEnemy: crit.enemy, player: PLAYER });
    assert.equal(restored.dom.critPulse, false, '복원된 렌더의 기록도 기준일 뿐이다');
    assert.equal(restored.snapshot.hitCrit, false);
    const next = attack(crit, 77);
    const fresh = await h.render('stage', { feedback: next.combatFeedback, epoch: 1, liveEnemy: next.enemy, player: PLAYER });
    assert.equal(fresh.snapshot.announcementKey, next.combatFeedback.key, '복원 뒤의 새 차례는 연출한다');
});

test('GF-06: 내 피격 숫자는 적 반격 박자에 한 번 — 휴식 회복은 지연 없이, 모션 감소는 지연 없이', async (t) => {
    const turn = findTurn(heavyState, (feedback) => feedback.enemyDamage > 0 && feedback.playerHpDelta < 0);
    const loss = -turn.combatFeedback.playerHpDelta;
    const h = await openHarness(t);
    await h.render('damage', { hp: PLAYER.hp, epoch: 0, feedback: null, reducedMotion: false });
    const sameFrame = await h.render('damage', { hp: turn.player.hp, epoch: 0, feedback: turn.combatFeedback, reducedMotion: false });
    assert.equal(sameFrame.snapshot.damageAmount, null, '내 타격과 같은 프레임에 내 피격이 터지지 않는다');
    await h.tick(BALANCE.ENEMY_TURN_DELAY_MS - 1);
    assert.equal((await h.read()).snapshot.damageAmount, null);
    await h.tick(1);
    const counter = await h.read();
    assert.deepEqual(counter.snapshot.damageAmount, { value: loss, isHeal: false });
    assert.equal(counter.dom.playerNumber, `-${loss}`);
    await h.tick(1200);
    assert.equal((await h.read()).snapshot.damageAmount, null);

    const rested = await h.render('damage', { hp: turn.player.hp + 20, epoch: 0, feedback: turn.combatFeedback, reducedMotion: false });
    assert.deepEqual(rested.snapshot.damageAmount, { value: 20, isHeal: true }, '같은 차례의 지연은 한 번만 쓴다');

    const reduced = await openHarness(t);
    await reduced.render('damage', { hp: PLAYER.hp, epoch: 0, feedback: null, reducedMotion: true });
    const still = await reduced.render('damage', { hp: turn.player.hp, epoch: 0, feedback: turn.combatFeedback, reducedMotion: true });
    assert.deepEqual(still.snapshot.damageAmount, { value: loss, isHeal: false }, '모션 감소는 박자를 나누지 않는다');
});

test('GF-06: 박자 안에 다음 차례를 눌러도 두 차례의 피격 숫자가 차례대로 보인다 — 앞 차례 표시를 지우지 않는다', async (t) => {
    const hurt = (feedback) => feedback.enemyDamage > 0 && feedback.playerHpDelta < 0;
    const first = findTurn(heavyState, hurt);
    const second = findTurn(first, hurt);
    const firstLoss = -first.combatFeedback.playerHpDelta;
    const secondLoss = -second.combatFeedback.playerHpDelta;
    const early = 200;
    const h = await openHarness(t);
    await h.render('damage', { hp: PLAYER.hp, epoch: 0, feedback: null, reducedMotion: false });
    await h.render('damage', { hp: first.player.hp, epoch: 0, feedback: first.combatFeedback, reducedMotion: false });
    await h.tick(early);
    await h.render('damage', { hp: second.player.hp, epoch: 0, feedback: second.combatFeedback, reducedMotion: false });

    await h.tick(BALANCE.ENEMY_TURN_DELAY_MS - early);
    const firstShown = await h.read();
    assert.deepEqual(firstShown.snapshot.damageAmount, { value: firstLoss, isHeal: false }, '앞 차례의 피격 숫자');
    assert.equal(firstShown.snapshot.damageFlash, true);
    await h.tick(early);
    const secondShown = await h.read();
    assert.deepEqual(secondShown.snapshot.damageAmount, { value: secondLoss, isHeal: false }, '뒤 차례의 피격 숫자');

    await h.tick(1200);
    const settled = await h.read();
    assert.equal(settled.snapshot.damageAmount, null);
    assert.equal(settled.snapshot.damageFlash, false, '붉은 테두리가 남지 않는다');
});

test('GF-11: 모션 감소 설정에서도 피해 숫자가 보인다 — 처치 순간은 짧게 정지 표시', async (t) => {
    const turn = findTurn(heavyState, (feedback) => feedback.enemyDamage > 0 && feedback.playerHpDelta < 0);
    const h = await openHarness(t, { reducedMotion: 'reduce', withCss: true });
    await h.render('stage', { feedback: null, epoch: 0, liveEnemy: heavyState.enemy, player: PLAYER });
    const hit = await h.render('stage', { feedback: turn.combatFeedback, epoch: 0, liveEnemy: turn.enemy, player: PLAYER });
    assert.equal(hit.dom.enemyNumberOpacity, '1', '적 피해 숫자가 투명하지 않다');
    assert.equal(hit.snapshot.heavyPulse, turn.combatFeedback.enemyHeavy, '모션 감소는 박자를 나누지 않는다');

    await h.render('damage', { hp: PLAYER.hp, epoch: 0, feedback: null, reducedMotion: true });
    const own = await h.render('damage', { hp: turn.player.hp, epoch: 0, feedback: turn.combatFeedback, reducedMotion: true });
    assert.equal(own.dom.playerNumberOpacity, '1', '내 피해 숫자가 투명하지 않다');

    const before = makeCombat({ enemy: { hp: 5 } });
    const kill = findTurn(before, (feedback) => feedback.kind === 'victory');
    await h.render('stage', { feedback: null, epoch: 0, liveEnemy: before.enemy, player: PLAYER });
    const beat = await h.render('stage', { feedback: kill.combatFeedback, epoch: 0, liveEnemy: null, player: PLAYER });
    assert.equal(beat.dom.stamp, MSG.COMBAT_DEFEATED_STAMP);
    await h.tick(BALANCE.KILL_BEAT_REDUCED_MS);
    assert.equal((await h.read()).snapshot.holdResultCards, false, '모션 감소의 처치 순간은 150ms 이하');
});

const signatureItems = Object.keys(SIGNATURE_ITEM_REGISTRY).slice(0, 6)
    .map((name, index) => ({ id: `sig-${index}`, name, type: 'weapon', tier: 5 }));

test('GF-12: 전설 대기열 — 동시에 둘, 표시 중에 하나가 들어와도 모두 차례로 보인다', async (t) => {
    const [a, b, c, d] = signatureItems;
    const h = await openHarness(t);
    await h.render('legendary', { inv: [], codex: {}, epoch: 0 });
    const both = await h.render('legendary', { inv: [a, b], codex: {}, epoch: 0 });
    assert.equal(both.snapshot.current, a.name);
    assert.equal(both.dispatched.filter((type) => type === AT.ADD_LOG).length, 2, '둘 다 기록한다');
    assert.equal((await h.dismiss()).snapshot.current, b.name, '동시에 들어온 둘째를 잃지 않는다');
    assert.equal((await h.dismiss()).snapshot.current, null);

    assert.equal((await h.render('legendary', { inv: [a, b, c], codex: {}, epoch: 0 })).snapshot.current, c.name);
    const whileShowing = await h.render('legendary', { inv: [a, b, c, d], codex: {}, epoch: 0 });
    assert.equal(whileShowing.snapshot.current, c.name, '보이는 전설은 그대로');
    assert.equal((await h.dismiss()).snapshot.current, d.name, '표시 중에 들어온 전설을 잃지 않는다');
});

test('GF-13: 복원된 가방의 전설은 연출 · 도감 · 시즌 · 기록 dispatch 없이 기준만 잡는다', async (t) => {
    const [a, b, c, , e, f] = signatureItems;
    const h = await openHarness(t);
    await h.render('legendary', { inv: [a], codex: {}, epoch: 0 });
    const showing = await h.render('legendary', { inv: [a, b], codex: {}, epoch: 0 });
    assert.equal(showing.snapshot.current, b.name);
    const dispatchedBefore = showing.dispatched.length;
    const restored = await h.render('legendary', { inv: [a, b, c, e], codex: {}, epoch: 1 });
    assert.equal(restored.snapshot.current, null, '복원 전의 대기열도 내린다');
    assert.equal(restored.dispatched.length, dispatchedBefore, '복원은 dispatch하지 않는다');
    const fresh = await h.render('legendary', { inv: [a, b, c, e, f], codex: {}, epoch: 1 });
    assert.equal(fresh.snapshot.current, f.name, '복원 뒤 새로 얻은 전설은 연출한다');
    assert.ok(fresh.dispatched.length > dispatchedBefore);
});

test('GF-13: 레벨 상승 배너는 실제로 오른 레벨만 축하한다 — 복원으로 바뀐 레벨은 아니다', async (t) => {
    const h = await openHarness(t);
    assert.equal((await h.render('level', { level: 5, epoch: 0 })).snapshot.banner, null, '마운트는 기준');
    assert.equal((await h.render('level', { level: 6, epoch: 0 })).snapshot.banner, 6);
    await h.tick(1000);
    assert.equal((await h.render('level', { level: 7, epoch: 0 })).snapshot.banner, 7, '연속 레벨업');
    await h.tick(1800);
    assert.equal((await h.read()).snapshot.banner, null, '1.8초 뒤 내려간다');

    assert.equal((await h.render('level', { level: 35, epoch: 1 })).snapshot.banner, null, '복원으로 바뀐 레벨은 축하하지 않는다');
    assert.equal((await h.render('level', { level: 36, epoch: 1 })).snapshot.banner, 36, '복원 뒤 실제 레벨업은 축하한다');
    const reloaded = await h.render('level', { level: 36, epoch: 2 });
    assert.equal(reloaded.snapshot.banner, null, '떠 있던 배너도 복원이 내린다');
    await h.tick(1800);
    assert.equal((await h.render('level', { level: 20, epoch: 2 })).snapshot.banner, null, '레벨이 내려가도 축하하지 않는다');
});
