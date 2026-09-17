import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';
import { build } from 'vite';
import { chromium } from 'playwright';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';

const EMPTY = { damageFlash: false, healFlash: false, damageAmount: null };
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
                entry: fileURLToPath(new URL('./fixtures/damage-feedback.js', import.meta.url)),
                name: 'DamageFeedbackTest',
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
    await page.clock.install();
    await page.addScriptTag({ content: script });
    return {
        render: (hp, epoch) => page.evaluate(([hp, epoch]) => window.feedbackHarness.render(hp, epoch), [hp, epoch]),
        snapshot: () => page.evaluate(() => window.feedbackHarness.snapshot()),
        tick: async (ms) => {
            const acting = page.evaluate((ms) => window.feedbackHarness.tick(ms), ms);
            await page.waitForFunction(() => window.feedbackHarness.ticking);
            await page.clock.runFor(ms);
            await acting;
        },
    };
};

test('LOAD_DATA gives every restore a non-persisted presentation epoch, independent of snapshot timestamp', () => {
    const payload = { player: { ...INITIAL_STATE.player, hp: 97 }, lastActive: 123, presentationEpoch: 999 };
    const first = gameReducer(INITIAL_STATE, { type: 'LOAD_DATA', payload });
    const second = gameReducer(first, { type: 'LOAD_DATA', payload });
    assert.equal(INITIAL_STATE.presentationEpoch, 0);
    assert.equal(first.presentationEpoch, 1);
    assert.equal(second.presentationEpoch, 2);
    assert.equal(first.lastLoadedTimestamp, second.lastLoadedTimestamp);
    assert.equal(second.player.hp, 97);
    assert.equal('presentationEpoch' in second.player, false);
    assert.equal(gameReducer(second, { type: 'SET_PLAYER', payload: { hp: 90 } }).presentationEpoch, 2);
});

test('initial and ready-to-ready restore never render damage or healing feedback', async (t) => {
    const h = await openHarness(t);
    await h.render(150, 0);
    for (const [hp, epoch] of [[97, 1], [80, 2], [140, 3], [140, 4]]) {
        const result = await h.render(hp, epoch);
        assert.deepEqual(result.feedback, EMPTY);
        assert.ok(result.renders.every((frame) => JSON.stringify(frame) === JSON.stringify(EMPTY)));
    }
});

test('restore clears an active effect before the next render and cancels its timers', async (t) => {
    const h = await openHarness(t);
    await h.render(150, 0);
    assert.deepEqual((await h.render(120, 0)).feedback.damageAmount, { value: 30, isHeal: false });
    await h.tick(300);
    const restored = await h.render(97, 1);
    assert.ok(restored.renders.every((frame) => JSON.stringify(frame) === JSON.stringify(EMPTY)));
    await h.render(90, 1);
    await h.tick(201);
    assert.equal((await h.snapshot()).damageFlash, true, 'the old 500ms timer must not clear a new hit');
    await h.tick(699);
    assert.deepEqual((await h.snapshot()).damageAmount, { value: 7, isHeal: false });
    await h.tick(301);
    assert.deepEqual(await h.snapshot(), EMPTY);
});

test('real damage and healing after restore retain their normal amounts and expiry', async (t) => {
    const h = await openHarness(t);
    await h.render(150, 0);
    await h.render(97, 1);
    assert.deepEqual((await h.render(90, 1)).feedback, {
        damageFlash: true, healFlash: false, damageAmount: { value: 7, isHeal: false },
    });
    await h.tick(500);
    assert.equal((await h.snapshot()).damageFlash, false);
    await h.tick(700);
    assert.deepEqual(await h.snapshot(), EMPTY);
    assert.deepEqual((await h.render(110, 1)).feedback, {
        damageFlash: false, healFlash: true, damageAmount: { value: 20, isHeal: true },
    });
    assert.deepEqual((await h.render(110, 2)).feedback, EMPTY, 'same HP restore clears healing too');
    await h.tick(1500);
    assert.deepEqual(await h.snapshot(), EMPTY);
});
