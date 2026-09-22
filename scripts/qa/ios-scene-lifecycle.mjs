/** iOS Simulator runtime QA. See docs/qa/IOS_SCENE_LIFECYCLE_QA.md. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const [udid, platformVersion, bundleId, output] = process.argv.slice(2);
assert(udid && platformVersion && bundleId && output, 'Required: UDID iOS-version QA-bundle-id output.json');
assert(bundleId.startsWith('com.aetheria.roguelike.') && bundleId.endsWith('qa'), 'Use a separate QA bundle');
assert(process.env.AETHERIA_IOS_INSPECTOR_DIR, 'Set the temporary inspector install directory');
const requireInspector = createRequire(resolve(process.env.AETHERIA_IOS_INSPECTOR_DIR, 'package.json'));
const importInspector = (name) => import(pathToFileURL(resolve(dirname(requireInspector.resolve(`${name}/package.json`)), 'build/lib/index.js')));
const { getSimulator } = await importInspector('appium-ios-simulator');
const { RemoteDebugger } = await importInspector('appium-remote-debugger');
const { pageArrayFromDict } = await import(pathToFileURL(resolve(dirname(requireInspector.resolve('appium-remote-debugger/package.json')), 'build/lib/utils/index.js')));
const { log } = requireInspector('@appium/logger');
log.level = 'error';
const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', timeout: 30000 });
const device = await getSimulator(udid);
const socketPath = await device.getWebInspectorSocket();
assert(socketPath, 'Web Inspector socket unavailable');
mkdirSync(dirname(resolve(output)), { recursive: true });
const receipt = { timestamp: new Date().toISOString(), udid, platformVersion, bundleId, status: 'running', checks: {} };
let debuggerClient;
const launch = () => {
    const text = simctl('launch', '--terminate-running-process', udid, bundleId);
    const pid = text.match(/: (\d+)/)?.[1];
    assert(pid, 'Launch did not return a PID');
    receipt.launchPids ??= [];
    receipt.launchPids.push(pid);
    return pid;
};
const connect = async (pid) => {
    if (!debuggerClient) {
        debuggerClient = new RemoteDebugger({ bundleId, platformVersion, isSafari: false, socketPath });
        await debuggerClient.connect(5000);
    }
    // Request the exact PID's fresh listing; another app or an early about:blank
    // page must not satisfy discovery. Keep the socket across process relaunch.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
        if (debuggerClient.appDict[`PID:${pid}`]) {
            let listing;
            try {
                listing = await debuggerClient.requireRpcClient().selectApp(`PID:${pid}`);
            } catch (error) {
                if (!['New application has connected', 'Empty page dictionary received'].includes(error.message)) throw error;
            }
            if (listing) {
                const [appId, dictionary] = listing;
                assert.equal(appId, `PID:${pid}`, 'Inspector must stay on the launched QA process');
                const pages = pageArrayFromDict(dictionary);
                if (pages.length && pages[0].url !== 'about:blank') {
                    assert.equal(pages.length, 1, 'Expected exactly one bridge WebView');
                    const url = new URL(pages[0].url);
                    assert.equal(url.protocol, 'capacitor:');
                    assert.equal(url.hostname, 'localhost');
                    await debuggerClient.selectPage(pid, String(pages[0].id));
                    return;
                }
            }
        }
        await delay(500);
    }
    receipt.debuggerApps = Object.entries(debuggerClient.appDict).map(([id, app]) => ({id, pages: app.pageArray?.map(p => ({id:p.id,url:p.url}))}));
    throw new Error('Launched app did not expose a live bridge WebView');
};
const evaluate = (expression) => debuggerClient.execute(expression);
const snapshot = () => evaluate('JSON.stringify({investment:window.__AETHERIA_TEST_API__.getInvestmentSnapshot(),location:JSON.parse(window.render_game_to_text()).player.loc})');
const waitFor = async (expression) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (await evaluate(`JSON.stringify(Boolean(${expression}))`)) return;
        await delay(250);
    }
    throw new Error(`Runtime condition not met: ${expression}`);
};
const disconnect = async () => { await debuggerClient?.disconnect(); debuggerClient = undefined; };
try {
    await connect(launch());
    await waitFor('!!window.__AETHERIA_TEST_API__');
    assert.equal(await evaluate('Capacitor.getPlatform()'), 'ios');
    // Use the existing isolated fixture; never touch the production save.
    await evaluate('window.__AETHERIA_TEST_API__.seedItemInvestmentScenario(); "ok"');
    await waitFor('window.__AETHERIA_TEST_API__.getInvestmentSnapshot().gold === 5000 && !!document.querySelector(\'[data-testid="crafting-recipe-r1"] [data-testid="crafting-recipe-action"]\')');
    receipt.checks.singleWebView = true;
    receipt.before = await snapshot();
    await evaluate(`(() => {
        window.__iosSceneQA = {events: [], ready: false};
        const add = (type, value) => window.__iosSceneQA.events.push({type, value, time: Date.now()});
        for (const name of ['pause', 'resume']) document.addEventListener(name, () => add('document.' + name, null));
        document.addEventListener('visibilitychange', () => add('visibility', document.visibilityState));
        Capacitor.Plugins.App.addListener('appStateChange', event => add('appStateChange', event.isActive))
            .then(() => { window.__iosSceneQA.ready = true; });
        return "ok";
    })()`);
    await waitFor('window.__iosSceneQA.ready');
    await evaluate('document.querySelector(\'[data-testid="crafting-recipe-r1"] [data-testid="crafting-recipe-action"]\').click(); "ok"');
    await waitFor('window.__AETHERIA_TEST_API__.getInvestmentSnapshot().gold === 4900');
    receipt.afterCraft = await snapshot();
    assert.equal(receipt.afterCraft.investment.crafts, receipt.before.investment.crafts + 1);
    // Observe the ordinary save; do not call flushLocalSave or fake OS events.
    await waitFor('JSON.parse(localStorage.getItem("aetheria.device-qa.item-investment.snapshot.v1"))?.player.gold === 4900');
    receipt.checks.craftAndSave = true;
    simctl('launch', udid, 'com.apple.Preferences');
    await delay(10000);
    simctl('launch', udid, bundleId);
    await delay(2000);
    receipt.events = await evaluate('JSON.stringify(window.__iosSceneQA.events)');
    assert.deepEqual(receipt.events.filter(event => event.type.startsWith('document.')).map(event => event.type),
        ['document.pause', 'document.resume'], 'Document events must occur once in order');
    assert.deepEqual(receipt.events.filter(event => event.type === 'appStateChange').map(event => event.value),
        [false, true], 'App state events must occur once in order');
    receipt.checks.backgroundForeground = true;
    assert.deepEqual(await snapshot(), receipt.afterCraft);
    // A real UI handler must still work after foregrounding.
    await evaluate('document.querySelector(\'[data-testid="crafting-close"]\').click(); "ok"');
    await waitFor('!document.querySelector(\'[data-testid="crafting-panel"]\')');
    receipt.checks.foregroundInput = true;
    await delay(60000);
    assert.deepEqual(await snapshot(), receipt.afterCraft);
    receipt.checks.sixtySecondSurvival = true;
    simctl('io', udid, 'screenshot', resolve(dirname(output), `ios-${platformVersion}-foreground.png`));
    await connect(launch());
    await waitFor('!!window.__AETHERIA_TEST_API__');
    receipt.afterRelaunch = await snapshot();
    assert.deepEqual(receipt.afterRelaunch, receipt.afterCraft);
    receipt.checks.forcedRelaunchPersistence = true;
    receipt.status = 'passed';
} catch (error) {
    receipt.status = 'failed';
    receipt.error = error.message;
    process.exitCode = 1;
} finally {
    try { await disconnect(); } catch (error) {
        receipt.cleanupError = error.message;
        receipt.status = 'failed';
        process.exitCode = 1;
    }
    writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify({status: receipt.status, checks: receipt.checks, error: receipt.error}));
}
