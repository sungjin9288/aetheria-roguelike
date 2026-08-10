import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { bindLifecycleBridge } from '../src/platform/lifecycleBridge.ts';
import { resolvePlatformBackAction } from '../src/platform/platformBack.ts';
import { createPlatformBackRegistry } from '../src/platform/platformBackRegistry.tsx';

const makeDocument = () => {
    const listeners = new Map();
    const values = new Map();
    return {
        visibilityState: 'visible',
        documentElement: {
            style: {
                setProperty(name, value) { values.set(name, value); },
            },
        },
        addEventListener(name, listener) { listeners.set(name, listener); },
        removeEventListener(name, listener) {
            if (listeners.get(name) === listener) listeners.delete(name);
        },
        emit(name) { listeners.get(name)?.(); },
        listeners,
        values,
    };
};

test('web lifecycle uses document visibility without touching the Toss bridge', () => {
    const documentTarget = makeDocument();
    const transitions = [];
    const cleanup = bindLifecycleBridge({
        environment: 'web',
        documentTarget,
        callbacks: {
            onBackground: (source) => transitions.push(`background:${source}`),
            onForeground: (source) => transitions.push(`foreground:${source}`),
        },
        tossBridge: {
            getSafeArea() { throw new Error('must not read Toss safe area'); },
            subscribeSafeArea() { throw new Error('must not subscribe Toss safe area'); },
            subscribeBack() { throw new Error('must not subscribe Toss back'); },
            subscribeHome() { throw new Error('must not subscribe Toss home'); },
            async close() { throw new Error('must not close Toss screen'); },
        },
    });

    documentTarget.visibilityState = 'hidden';
    documentTarget.emit('visibilitychange');
    documentTarget.visibilityState = 'visible';
    documentTarget.emit('visibilitychange');
    cleanup();

    assert.deepEqual(transitions, ['background:visibility', 'foreground:visibility']);
    assert.equal(documentTarget.listeners.size, 0);
});

test('Toss lifecycle applies safe area and closes only after an unhandled back event', async () => {
    const documentTarget = makeDocument();
    const subscriptions = {};
    const removed = [];
    const transitions = [];
    let handled = true;
    let closeCalls = 0;
    const cleanup = bindLifecycleBridge({
        environment: 'sandbox',
        documentTarget,
        callbacks: {
            onBack: () => handled,
            onBackground: (source) => transitions.push(`background:${source}`),
            onForeground: (source) => transitions.push(`foreground:${source}`),
        },
        tossBridge: {
            getSafeArea: () => ({ top: 31, right: 2, bottom: 24, left: 3 }),
            subscribeSafeArea: (listener) => {
                subscriptions.safeArea = listener;
                return () => removed.push('safeArea');
            },
            subscribeBack: (listener) => {
                subscriptions.back = listener;
                return () => removed.push('back');
            },
            subscribeHome: (listener) => {
                subscriptions.home = listener;
                return () => removed.push('home');
            },
            async close() { closeCalls += 1; },
        },
    });

    assert.equal(documentTarget.values.get('--aether-safe-area-top'), '31px');
    assert.equal(documentTarget.values.get('--aether-safe-area-bottom'), '24px');
    subscriptions.safeArea({ top: 40, right: 4, bottom: 28, left: 5 });
    assert.equal(documentTarget.values.get('--aether-safe-area-top'), '40px');

    subscriptions.back();
    await Promise.resolve();
    assert.equal(closeCalls, 0);
    handled = false;
    subscriptions.back();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(closeCalls, 1);

    subscriptions.home();
    documentTarget.visibilityState = 'hidden';
    documentTarget.emit('visibilitychange');
    subscriptions.home();
    documentTarget.visibilityState = 'visible';
    documentTarget.emit('visibilitychange');
    assert.deepEqual(transitions, ['background:home', 'foreground:visibility']);

    cleanup();
    assert.deepEqual(removed.sort(), ['back', 'home', 'safeArea']);
    assert.equal(documentTarget.listeners.size, 0);
});

test('missing Toss lifecycle constants fail open without preventing game boot', () => {
    const documentTarget = makeDocument();
    assert.doesNotThrow(() => bindLifecycleBridge({
        environment: 'toss',
        documentTarget,
        callbacks: {},
        tossBridge: {
            getSafeArea() { throw new Error('bridge missing'); },
            subscribeSafeArea() { throw new Error('bridge missing'); },
            subscribeBack() { throw new Error('bridge missing'); },
            subscribeHome() { throw new Error('bridge missing'); },
            async close() {},
        },
    }));
});

test('platform back closes the nearest reversible game surface before the Toss screen', () => {
    assert.equal(resolvePlatformBackAction({ premiumShopOpen: true }), 'close-premium');
    assert.equal(resolvePlatformBackAction({ mirrorPanelOpen: true }), 'close-mirror');
    assert.equal(resolvePlatformBackAction({ expeditionDebriefOpen: true }), 'close-debrief');
    assert.equal(resolvePlatformBackAction({ postCombatOpen: true }), 'close-post-combat');
    assert.equal(resolvePlatformBackAction({ gameState: 'event' }), 'dismiss-event');
    assert.equal(resolvePlatformBackAction({ gameState: 'shop' }), 'close-focus-panel');
    assert.equal(resolvePlatformBackAction({ gameState: 'idle' }), 'close-app');
});

test('platform back registry closes only the top visible reversible surface', () => {
    const registry = createPlatformBackRegistry();
    const closed = [];
    const removeArchive = registry.register(30, () => closed.push('archive'));
    const removeBriefing = registry.register(50, () => closed.push('briefing'));
    const removeStory = registry.register(72, () => closed.push('story'));
    const removeEnhance = registry.register(76, () => closed.push('enhance'));
    const removePremium = registry.register(200, () => closed.push('premium'));

    assert.equal(registry.handleBack(), true);
    assert.deepEqual(closed, ['premium']);
    removePremium();
    assert.equal(registry.handleBack(), true);
    assert.deepEqual(closed, ['premium', 'enhance']);
    removeEnhance();
    assert.equal(registry.handleBack(), true);
    assert.deepEqual(closed, ['premium', 'enhance', 'story']);
    removeStory();
    assert.equal(registry.handleBack(), true);
    assert.deepEqual(closed, ['premium', 'enhance', 'story', 'briefing']);
    removeBriefing();
    assert.equal(registry.handleBack(), true);
    assert.deepEqual(closed, ['premium', 'enhance', 'story', 'briefing', 'archive']);
    removeArchive();
    assert.equal(registry.handleBack(), false);
});

test('App wires background persistence and reversible back actions through the lifecycle adapter', async () => {
    const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

    assert.match(source, /bindLifecycleBridge\(/);
    assert.match(source, /environment: getRuntimeEnvironment\(\)/);
    assert.match(source, /onBackground: \(\) =>[\s\S]+?engineRef\.current\.flushLocalSave\(\)/);
    assert.match(source, /platformBackRegistry\.handleBack\(\)/);
    assert.match(source, /PlatformBackProvider/);
    assert.match(source, /resolvePlatformBackAction\(/);
    assert.match(source, /case 'close-premium'[\s\S]+?setPremiumShopOpen\(false\)/);
    assert.match(source, /case 'close-app':[\s\S]+?return false/);
});

test('every local reversible surface registers a platform back handler', async () => {
    const paths = [
        '../src/components/app/GameRoot.tsx',
        '../src/components/MilestoneStoryCard.tsx',
        '../src/components/ReturnBriefingCard.tsx',
        '../src/components/EnhanceDecisionCard.tsx',
    ];
    const [gameRoot, story, briefing, enhance] = await Promise.all(paths.map((path) => (
        readFile(new URL(path, import.meta.url), 'utf8')
    )));

    assert.match(gameRoot, /usePlatformBackHandler\(mobileConsoleMode === 'archive'/);
    assert.match(story, /usePlatformBackHandler\(true, onClose, 72\)/);
    assert.match(briefing, /usePlatformBackHandler\(true, onClose, 50\)/);
    assert.match(enhance, /usePlatformBackHandler\(true, onCancel, 76\)/);
});

test('mobile surfaces consume the SDK-backed safe-area variables with web env defaults', async () => {
    const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
    assert.match(css, /--aether-safe-area-top:\s*env\(safe-area-inset-top,\s*0px\)/);
    assert.match(css, /--aether-safe-area-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);

    const componentPaths = [
        'MainLayout.tsx', 'IntroScreen.tsx', 'PostCombatCard.tsx', 'ReturnBriefingCard.tsx',
        'MirrorPanel.tsx', 'AscensionScreen.tsx', 'MilestoneStoryCard.tsx', 'TrueEndingScreen.tsx',
        'EnhanceDecisionCard.tsx', 'PremiumShop.tsx', 'RelicChoicePanel.tsx',
        'ExpeditionDebriefCard.tsx', 'RunSummaryCard.tsx',
    ];
    const sources = await Promise.all(componentPaths.map((path) => (
        readFile(new URL(`../src/components/${path}`, import.meta.url), 'utf8')
    )));
    assert.doesNotMatch(sources.join('\n'), /env\(safe-area-inset-/);
    assert.match(sources.join('\n'), /var\(--aether-safe-area-top\)/);
    assert.match(sources.join('\n'), /var\(--aether-safe-area-bottom\)/);
});
