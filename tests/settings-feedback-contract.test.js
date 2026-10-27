import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import { build } from 'vite';
import { chromium } from 'playwright';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';
import {
    createFeedbackPort,
    NATIVE_HAPTICS_PLUGIN_NAME,
    selectHapticBackendKind,
} from '../src/platform/feedbackPort.ts';
import { selectFeedbackCue, toFeedbackMoment } from '../src/utils/feedbackCues.ts';
import { isHapticsEnabled, isKeyboardShortcutsEnabled } from '../src/utils/playerSettings.ts';
import { migrateData } from '../src/utils/dataMigration.ts';

/**
 * 2026-10-26 소유자 결정 — 설정 · 접근성 · 진동 묶음.
 *
 *   D3  진동 피드백(맞음 · 치명타 · 레벨 상승 · 전설 획득 · 사망). 포트는 네이티브 Haptics(등록돼 있을 때) → 앱인토스 SDK →
 *       navigator.vibrate → 없음 순으로 하나를 고르고, 실패는 게임으로 전파하지 않는다. 기록 탭 설정 '진동'(기본 켬)이 끄면 울리지 않는다.
 *   D23 한 글자 단축키를 끄는 설정 — 끄면 실제 TerminalView의 키 처리기가 아무 동작도 하지 않는다.
 *   D24 전설 획득 화면은 초점을 옮기지 않는 상태 알림(role="status", aria-live polite)이다 — 대화상자가 아니다.
 */

// ---------------------------------------------------------------- D3: 포트(순수)

const makeEnv = (overrides = {}) => {
    const calls = [];
    const failures = [];
    const env = {
        runtime: 'web',
        isNativePluginAvailable: () => false,
        getNativeHaptics: () => ({
            impact: async (options) => { calls.push(['native.impact', options.style]); },
            notification: async (options) => { calls.push(['native.notification', options.type]); },
        }),
        tossHaptic: async (options) => { calls.push(['toss', options.type]); },
        vibrate: (pattern) => { calls.push(['web', pattern]); return true; },
        reportFailure: (backend, cue, error) => failures.push([backend, cue, error?.message ?? String(error)]),
        ...overrides,
    };
    return { env, calls, failures };
};

test('D3 포트: 뒤쪽은 네이티브 Haptics(등록됐을 때) → 앱인토스 → 웹 진동 → 없음 순으로 하나다', () => {
    const nativeAvailable = (name) => name === NATIVE_HAPTICS_PLUGIN_NAME;
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'capacitor', isNativePluginAvailable: nativeAvailable }).env), 'native');
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'capacitor' }).env), 'web',
        '패키지가 설치 · 동기화되기 전의 네이티브 앱은 플러그인이 없다 — 웹뷰 진동으로 내려간다');
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'capacitor', vibrate: null }).env), 'none');
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'toss' }).env), 'toss');
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'sandbox' }).env), 'toss');
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'web', isNativePluginAvailable: nativeAvailable }).env), 'web',
        '웹 런타임은 네이티브 플러그인 이름을 믿지 않는다');
    assert.equal(selectHapticBackendKind(makeEnv({ runtime: 'web', vibrate: null }).env), 'none', 'iOS Safari처럼 진동이 없으면 울리지 않는다');
});

test('D3 포트: 계기 다섯이 뒤쪽마다 실제 호출로 이어진다', async () => {
    const cues = ['hit', 'crit', 'levelUp', 'legendary', 'death'];
    const native = makeEnv({ runtime: 'capacitor', isNativePluginAvailable: () => true });
    const toss = makeEnv({ runtime: 'toss' });
    const web = makeEnv({ runtime: 'web' });
    for (const { env } of [native, toss, web]) {
        const port = createFeedbackPort(env);
        for (const cue of cues) port.play(cue);
    }
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(native.calls, [
        ['native.impact', 'MEDIUM'], ['native.impact', 'HEAVY'],
        ['native.notification', 'SUCCESS'], ['native.notification', 'SUCCESS'], ['native.notification', 'ERROR'],
    ]);
    assert.deepEqual(toss.calls.map(([, type]) => type), ['tickMedium', 'basicMedium', 'success', 'confetti', 'error']);
    assert.equal(web.calls.length, 5);
    assert.ok(web.calls.every(([kind, pattern]) => kind === 'web' && (Number.isFinite(pattern) || Array.isArray(pattern))));

    const none = makeEnv({ runtime: 'web', vibrate: null });
    const port = createFeedbackPort(none.env);
    assert.equal(port.kind, 'none');
    port.play('death');
    assert.deepEqual(none.calls, []);
});

test('D3 포트: 실패(던짐 · 거부된 약속)는 게임으로 전파하지 않고 보고한다', async () => {
    const thrown = makeEnv({ runtime: 'web', vibrate: () => { throw new Error('blocked'); } });
    assert.doesNotThrow(() => createFeedbackPort(thrown.env).play('hit'));
    assert.deepEqual(thrown.failures, [['web', 'hit', 'blocked']]);

    const rejected = makeEnv({ runtime: 'toss', tossHaptic: async () => { throw new Error('bridge'); } });
    createFeedbackPort(rejected.env).play('legendary');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(rejected.failures, [['toss', 'legendary', 'bridge']]);

    const nativeMissing = makeEnv({
        runtime: 'capacitor',
        isNativePluginAvailable: () => true,
        getNativeHaptics: () => ({ impact: () => Promise.reject(new Error('not implemented')), notification: () => Promise.resolve() }),
    });
    createFeedbackPort(nativeMissing.env).play('crit');
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(nativeMissing.failures, [['native', 'crit', 'not implemented']]);
});

// ---------------------------------------------------------------- D3: 계기 판정(순수)

const moment = (patch = {}) => ({ epoch: 0, combatKey: null, playerCrit: false, playerHit: false, level: 5, dead: false, ...patch });

test('D3 계기: 사망 > 레벨 상승 > 치명타 > 맞음, 새 차례만 · 첫 장면과 복원은 기준', () => {
    assert.equal(selectFeedbackCue(null, moment({ combatKey: 'k1', playerCrit: true })), null, '마운트는 기준');
    assert.equal(selectFeedbackCue(moment(), moment({ epoch: 1, dead: true, level: 9 })), null, '복원으로 바뀐 장면은 울리지 않는다');
    assert.equal(selectFeedbackCue(moment(), moment({ combatKey: 'k1', playerHit: true })), 'hit');
    assert.equal(selectFeedbackCue(moment(), moment({ combatKey: 'k1', playerHit: true, playerCrit: true })), 'crit');
    assert.equal(selectFeedbackCue(moment({ combatKey: 'k1' }), moment({ combatKey: 'k1', playerCrit: true })), null, '같은 차례는 다시 울리지 않는다');
    assert.equal(selectFeedbackCue(moment(), moment({ combatKey: 'k2', playerCrit: true, level: 6 })), 'levelUp');
    assert.equal(selectFeedbackCue(moment(), moment({ combatKey: 'k2', playerHit: true, dead: true })), 'death');
    assert.equal(selectFeedbackCue(moment({ dead: true }), moment({ dead: true })), null, '쓰러진 채로는 다시 울리지 않는다');
    assert.equal(selectFeedbackCue(moment({ level: 30 }), moment({ level: 1 })), null, '사망 재시작 · 계승으로 레벨이 내려가도 울리지 않는다');
    assert.equal(selectFeedbackCue(moment(), moment({ combatKey: 'k3' })), null, '맞지도 치명타도 아닌 차례');
});

const NOW = 1_700_000_000_000;
const PLAYER = { ...INITIAL_STATE.player, name: '리베이아', level: 8, hp: 900, maxHp: 900, mp: 50, maxMp: 50 };
const makeCombat = (enemyPatch = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: { ...structuredClone(PLAYER), atk: 40, loc: '고요한 숲' },
    gameState: GS.COMBAT,
    enemy: {
        name: '숲의 정령', baseName: '숲의 정령', level: 3, hp: 100000, maxHp: 100000, atk: 30, def: 0, exp: 1, gold: 1,
        pattern: { guardChance: 0, heavyChance: 0 }, ...enemyPatch,
    },
});
const attack = (state, seed) => gameReducer(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: { kind: 'attack', expectedTurn: state.combatTurn ?? 0, seed, now: NOW },
});
const findTurn = (state, predicate) => {
    for (let seed = 1; seed <= 400; seed += 1) {
        const next = attack(state, seed);
        if (predicate(next.combatFeedback)) return next;
    }
    throw new Error('NO_MATCHING_TURN');
};

test('D3 계기: 실제 리듀서 차례 기록 — 적이 친 차례는 맞음, 내 치명타 차례는 치명타', () => {
    const state = makeCombat();
    const hitOnly = findTurn(state, (feedback) => !feedback.playerCrit && feedback.enemyActed && feedback.playerHpDelta < 0);
    const crit = findTurn(state, (feedback) => feedback.playerCrit);
    const base = toFeedbackMoment({ epoch: 0, combatFeedback: state.combatFeedback, level: 8, dead: false });
    assert.equal(selectFeedbackCue(base, toFeedbackMoment({ epoch: 0, combatFeedback: hitOnly.combatFeedback, level: 8, dead: false })), 'hit');
    assert.equal(selectFeedbackCue(base, toFeedbackMoment({ epoch: 0, combatFeedback: crit.combatFeedback, level: 8, dead: false })), 'crit');
});

// ---------------------------------------------------------------- 실제 훅 · 컴포넌트(Chromium)

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
                entry: fileURLToPath(new URL('./fixtures/settings-feedback-harness.js', import.meta.url)),
                name: 'SettingsFeedbackHarness',
                formats: ['iife'],
            },
        },
    });
    script = result[0].output.find((entry) => entry.type === 'chunk').code;
    browser = await chromium.launch();
});
after(async () => browser?.close());

const openHarness = async (t) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.route('**/*', (route) => route.abort());
    await page.setContent('<!doctype html><html><head><base href="http://127.0.0.1/"></head><body></body></html>');
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1_000);
    await page.addScriptTag({ content: script });
    return {
        page,
        render: (view, props) => page.evaluate(([v, p]) => window.settingsFeedbackHarness.render(v, p), [view, props]),
        focus: (testId) => page.evaluate((id) => window.settingsFeedbackHarness.focus(id), testId),
        read: () => page.evaluate(() => window.settingsFeedbackHarness.read()),
        tick: async (ms) => {
            await page.evaluate((value) => window.settingsFeedbackHarness.startTick(value), ms);
            await page.clock.runFor(ms);
            await page.evaluate(() => window.settingsFeedbackHarness.finishTick());
        },
    };
};

test('D3 훅: 실제 차례 · 레벨 · 사망에 울리고, 진동을 끄면 울리지 않으며, 복원은 울리지 않는다', async (t) => {
    const state = makeCombat();
    const hitOnly = findTurn(state, (feedback) => !feedback.playerCrit && feedback.enemyActed && feedback.playerHpDelta < 0);
    const crit = findTurn(state, (feedback) => feedback.playerCrit);
    const h = await openHarness(t);
    const props = (patch) => ({ enabled: true, epoch: 0, combatFeedback: null, level: 8, dead: false, ...patch });

    await h.render('haptics', props());
    assert.deepEqual((await h.render('haptics', props({ combatFeedback: hitOnly.combatFeedback }))).played, ['hit']);
    assert.deepEqual((await h.render('haptics', props({ combatFeedback: crit.combatFeedback }))).played, ['hit', 'crit']);
    assert.deepEqual((await h.render('haptics', props({ combatFeedback: crit.combatFeedback, level: 9 }))).played, ['hit', 'crit', 'levelUp']);

    // 끄면 새 차례 · 사망도 울리지 않는다 — 다시 켜도 지나간 계기는 울리지 않는다.
    await h.render('haptics', props({ enabled: false, combatFeedback: hitOnly.combatFeedback, level: 9 }));
    await h.render('haptics', props({ enabled: false, combatFeedback: hitOnly.combatFeedback, level: 9, dead: true }));
    assert.deepEqual((await h.render('haptics', props({ combatFeedback: hitOnly.combatFeedback, level: 9, dead: true }))).played,
        ['hit', 'crit', 'levelUp']);

    // 복원(epoch)으로 바뀐 사망 · 레벨은 기준이다.
    await h.render('haptics', props({ epoch: 1, level: 30, dead: false }));
    const restoredDeath = await h.render('haptics', props({ epoch: 2, level: 30, dead: true }));
    assert.deepEqual(restoredDeath.played, ['hit', 'crit', 'levelUp'], '복원된 사망 세이브는 울리지 않는다');
    assert.deepEqual((await h.render('haptics', props({ epoch: 2, level: 30, dead: false }))).played.length, 3);
    assert.deepEqual((await h.render('haptics', props({ epoch: 2, level: 30, dead: true }))).played.at(-1), 'death');
});

test('D3 훅: 전설 획득 화면이 새 전설로 뜰 때만 울린다(마운트 · 같은 화면 · 끈 설정은 아니다)', async (t) => {
    const h = await openHarness(t);
    // 화면 대상은 참조로 비교한다 — 하네스 경계(직렬화)를 넘으므로 여기서는 원시 키로 같은 대상을 흉내 낸다.
    const a = 'drop-a';
    const b = 'drop-b';
    await h.render('presentation', { presentedKey: a, enabled: true });
    assert.deepEqual((await h.read()).played, [], '마운트 때 이미 떠 있던 화면은 울리지 않는다');
    assert.deepEqual((await h.render('presentation', { presentedKey: null, enabled: true })).played, []);
    assert.deepEqual((await h.render('presentation', { presentedKey: b, enabled: true })).played, ['legendary']);
    assert.deepEqual((await h.render('presentation', { presentedKey: b, enabled: true })).played, ['legendary'], '같은 화면은 한 번');
    assert.deepEqual((await h.render('presentation', { presentedKey: a, enabled: false })).played, ['legendary'], '끄면 울리지 않는다');
});

test('D3 · D23 설정: 기본 켬 · 끄면 끔 · 저장 마이그레이션을 넘어 남는다(실제 리듀서 · 설정 함수와 같은 payload)', () => {
    // useGameEngine의 setHapticsEnabled / setKeyboardShortcutsEnabled와 같은 함수형 SET_PLAYER payload.
    const setSetting = (state, key, value) => gameReducer(state, {
        type: AT.SET_PLAYER,
        payload: (current) => ({ settings: { ...(current.settings || {}), [key]: value === true } }),
    });

    const fresh = INITIAL_STATE;
    assert.equal(isHapticsEnabled(fresh.player), true, '새 캐릭터는 진동 켬');
    assert.equal(isKeyboardShortcutsEnabled(fresh.player), true, '새 캐릭터는 단축키 켬');
    assert.equal(isHapticsEnabled({ settings: {} }), true, '값이 없는 이전 세이브는 켬');

    const off = setSetting(setSetting(fresh, 'hapticsEnabled', false), 'keyboardShortcutsEnabled', false);
    assert.equal(isHapticsEnabled(off.player), false);
    assert.equal(isKeyboardShortcutsEnabled(off.player), false);
    assert.equal(off.player.settings.readabilityMode, fresh.player.settings?.readabilityMode, '다른 설정 키는 그대로');

    const migrated = migrateData(JSON.parse(JSON.stringify({ player: off.player })), { now: 0 });
    assert.equal(isHapticsEnabled(migrated.player), false, '끈 진동은 불러온 뒤에도 끔');
    assert.equal(isKeyboardShortcutsEnabled(migrated.player), false, '끈 단축키는 불러온 뒤에도 끔');

    const on = setSetting(off, 'hapticsEnabled', true);
    assert.equal(isHapticsEnabled(on.player), true);
    assert.equal(isKeyboardShortcutsEnabled(on.player), false, '하나를 켜도 다른 하나는 그대로');
});

test('D23: 실제 TerminalView 키 처리기 — 설정에서 끄면 1 · 2 · 3 · Q · W · E가 아무 동작도 하지 않는다', async (t) => {
    const h = await openHarness(t);
    const potion = { id: 'potion-1', name: '하급 체력 물약', type: 'hp', val: 50 };
    const onPlayer = { ...structuredClone(PLAYER), loc: '고요한 숲' };
    const offPlayer = { ...onPlayer, settings: { ...onPlayer.settings, keyboardShortcutsEnabled: false } };
    const press = async (keys) => { for (const key of keys) await h.page.keyboard.press(key); };

    await h.render('terminal', { gameState: GS.COMBAT, player: onPlayer, quickSlots: [potion, null, null] });
    await press(['Digit1', 'Digit2', 'Digit3', 'KeyQ']);
    const on = await h.read();
    assert.deepEqual(on.commands, ['attack', 'skill', 'escape'], '켜져 있으면 전투 단축키(판별 조건)');
    assert.deepEqual(on.quickSlotUses, [0]);

    await h.render('terminal', { gameState: GS.COMBAT, player: offPlayer, quickSlots: [potion, null, null] });
    await press(['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'KeyQ', 'KeyW', 'KeyE']);
    await h.render('terminal', { gameState: GS.IDLE, player: offPlayer, quickSlots: [potion, null, null] });
    await press(['KeyQ', 'Digit1']);
    const off = await h.read();
    assert.deepEqual(off.commands, on.commands, '끄면 전투 단축키가 나가지 않는다');
    assert.deepEqual(off.quickSlotUses, on.quickSlotUses, '끄면 빠른 칸도 쓰이지 않는다');

    await h.render('terminal', { gameState: GS.COMBAT, player: onPlayer, quickSlots: [potion, null, null] });
    await press(['Digit1']);
    assert.deepEqual((await h.read()).commands.at(-1), 'attack', '다시 켜면 돌아온다');
});

test('D24: 전설 획득은 초점을 옮기지 않는 상태 알림 — 저절로 닫히고, 대화상자 · inert가 없다', async (t) => {
    const name = Object.keys(SIGNATURE_ITEM_REGISTRY)[0];
    const item = { id: 'sig-1', name, type: 'weapon', tier: 5, desc: '전설의 설명' };
    const h = await openHarness(t);
    await h.render('legendary', { item: null });
    const idle = await h.focus('focus-anchor');
    assert.equal(idle.activeTestId, 'focus-anchor');
    assert.equal(idle.status?.role, 'status', '알림 칸은 늘 그려져 있다(나타나는 순간 생긴 칸은 낭독되지 않는다)');
    assert.equal(idle.status?.text, '');

    const shown = await h.render('legendary', { item });
    assert.equal(shown.activeTestId, 'focus-anchor', '초점이 옮겨지지 않는다');
    assert.equal(shown.status.live, 'polite');
    assert.equal(shown.status.text, MSG.A11Y_LEGENDARY_STATUS(name, item.desc));
    assert.equal(shown.overlay.ariaHidden, 'true', '그림 연출은 알림 칸과 같은 내용이라 낭독에서 숨긴다');
    assert.equal(shown.overlay.role, null);
    assert.equal(shown.overlay.ariaModal, null);
    assert.equal(shown.overlay.inDialog, false);
    assert.equal(shown.dialogCount, 0);
    assert.equal(shown.inertCount, 0, '배경을 inert로 만들지 않는다');

    await h.tick(3000);
    const after = await h.read();
    assert.equal(after.dismissed, 1, '3초 뒤 저절로 닫힌다');
    assert.equal(after.activeTestId, 'focus-anchor', '닫힌 뒤에도 초점은 그 자리');
});
