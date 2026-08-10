import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createSdkRewardedAdPort,
    resolveRewardedAdGroupId,
} from '../src/platform/rewardedAdPort.ts';
import { startRewardedAdSession } from '../src/platform/rewardedAdSession.ts';

const bridge = (supported = true) => {
    const calls = [];
    const fn = (input) => {
        calls.push(input);
        return () => calls.push('disposed');
    };
    fn.isSupported = () => supported;
    fn.calls = calls;
    return fn;
};

test('rewarded ad configuration is Toss-only and rejects placeholders', () => {
    assert.equal(resolveRewardedAdGroupId('reward-group-1', 'toss'), 'reward-group-1');
    assert.equal(resolveRewardedAdGroupId('reward-group-1', 'sandbox'), 'reward-group-1');
    assert.equal(resolveRewardedAdGroupId('reward-group-1', 'web'), null);
    assert.equal(resolveRewardedAdGroupId('test-ad-group-id', 'toss'), null);
    assert.equal(resolveRewardedAdGroupId('ait-ad-test-rewarded-id', 'toss'), null);
    assert.equal(
        resolveRewardedAdGroupId('ait-ad-test-rewarded-id', 'sandbox'),
        'ait-ad-test-rewarded-id',
    );
    assert.equal(resolveRewardedAdGroupId('', 'toss'), null);
});

test('synchronous load and show bridge failures are isolated from gameplay', () => {
    const phases = [];
    const events = [];
    assert.doesNotThrow(() => startRewardedAdSession({
        port: {
            isSupported: () => true,
            load: () => { throw new Error('sync load failure'); },
            show: () => () => undefined,
        },
        adGroupId: 'group-1',
        onPhase: (phase) => phases.push(phase),
        onEvent: (event) => events.push(event),
        onEarned: () => assert.fail('must not earn'),
    }));
    assert.deepEqual(phases, ['loading', 'failed']);
    assert.deepEqual(events, ['loadError']);

    let loaded;
    let loadDisposed = 0;
    const showPhases = [];
    const session = startRewardedAdSession({
        port: {
            isSupported: () => true,
            load: ({ onLoaded }) => {
                loaded = onLoaded;
                return () => { loadDisposed += 1; };
            },
            show: () => { throw new Error('sync show failure'); },
        },
        adGroupId: 'group-1',
        onPhase: (phase) => showPhases.push(phase),
        onEarned: () => assert.fail('must not earn'),
    });
    loaded();
    assert.doesNotThrow(() => assert.equal(session.show(), false));
    assert.deepEqual(showPhases, ['loading', 'ready', 'showing', 'failed']);
    assert.equal(loadDisposed, 1);
});

test('disposed sessions ignore late load callbacks', () => {
    let loaded;
    const events = [];
    const session = startRewardedAdSession({
        port: {
            isSupported: () => true,
            load: ({ onLoaded }) => { loaded = onLoaded; return () => undefined; },
            show: () => () => undefined,
        },
        adGroupId: 'group-1',
        onPhase: () => undefined,
        onEarned: () => undefined,
        onEvent: (event) => events.push(event),
    });
    session.dispose();
    loaded();
    assert.deepEqual(events, []);
});

test('SDK adapter passes explicit group ID and fails closed when either bridge is unsupported', () => {
    const loadBridge = bridge();
    const showBridge = bridge(false);
    const port = createSdkRewardedAdPort({ loadBridge, showBridge });
    assert.equal(port.isSupported(), false);
    port.load({ adGroupId: 'group-1', onLoaded() {}, onError() {} });
    assert.deepEqual(loadBridge.calls[0].options, { adGroupId: 'group-1' });
});

test('session loads before show and only userEarnedReward grants once without dismissed', () => {
    const callbacks = {};
    const phases = [];
    const events = [];
    let rewards = 0;
    let disposals = 0;
    const port = {
        isSupported: () => true,
        load: ({ onLoaded, onError }) => {
            callbacks.onLoaded = onLoaded;
            callbacks.loadError = onError;
            return () => { disposals += 1; };
        },
        show: ({ onEvent, onError }) => {
            callbacks.onEvent = onEvent;
            callbacks.showError = onError;
            return () => { disposals += 1; };
        },
    };
    const session = startRewardedAdSession({
        port,
        adGroupId: 'group-1',
        onPhase: (phase) => phases.push(phase),
        onEvent: (event) => events.push(event),
        onEarned: () => { rewards += 1; },
    });
    assert.equal(session.show(), false);
    callbacks.onLoaded();
    assert.equal(session.show(), true);
    callbacks.onEvent('userEarnedReward');
    callbacks.onEvent('userEarnedReward');
    assert.equal(rewards, 1);
    assert.deepEqual(phases, ['loading', 'ready', 'showing', 'rewarded']);
    session.dispose();
    assert.equal(disposals, 2);
});

test('dismissed, failedToShow, and bridge errors never grant rewards', () => {
    for (const terminal of ['dismissed', 'failedToShow', 'showError']) {
        let earned = 0;
        let onEvent;
        let onError;
        const session = startRewardedAdSession({
            port: {
                isSupported: () => true,
                load: ({ onLoaded }) => { onLoaded(); return () => undefined; },
                show: (input) => { onEvent = input.onEvent; onError = input.onError; return () => undefined; },
            },
            adGroupId: 'group-1',
            onPhase: () => undefined,
            onEarned: () => { earned += 1; },
        });
        session.show();
        if (terminal === 'showError') onError();
        else onEvent(terminal);
        assert.equal(earned, 0, terminal);
        session.dispose();
    }
});

test('terminal load and show outcomes ignore every late callback', () => {
    let loaded;
    let loadError;
    const loadSession = startRewardedAdSession({
        port: {
            isSupported: () => true,
            load: (input) => {
                loaded = input.onLoaded;
                loadError = input.onError;
                return () => undefined;
            },
            show: () => assert.fail('failed load must never become showable'),
        },
        adGroupId: 'group-1',
        onPhase: () => undefined,
        onEarned: () => assert.fail('must not earn'),
    });
    loadError();
    loaded();
    assert.equal(loadSession.show(), false);

    for (const terminal of ['dismissed', 'failedToShow', 'showError']) {
        let earned = 0;
        let onEvent;
        let onError;
        const session = startRewardedAdSession({
            port: {
                isSupported: () => true,
                load: ({ onLoaded }) => { onLoaded(); return () => undefined; },
                show: (input) => {
                    onEvent = input.onEvent;
                    onError = input.onError;
                    return () => undefined;
                },
            },
            adGroupId: 'group-1',
            onPhase: () => undefined,
            onEarned: () => { earned += 1; },
        });
        session.show();
        if (terminal === 'showError') onError();
        else onEvent(terminal);
        onEvent('userEarnedReward');
        assert.equal(earned, 0, terminal);
    }
});

test('a valid earned event remains rewarded when dismissed follows', () => {
    let earned = 0;
    let onEvent;
    const phases = [];
    const session = startRewardedAdSession({
        port: {
            isSupported: () => true,
            load: ({ onLoaded }) => { onLoaded(); return () => undefined; },
            show: (input) => { onEvent = input.onEvent; return () => undefined; },
        },
        adGroupId: 'group-1',
        onPhase: (phase) => phases.push(phase),
        onEarned: () => { earned += 1; },
    });
    session.show();
    onEvent('userEarnedReward');
    onEvent('dismissed');
    onEvent('userEarnedReward');
    assert.equal(earned, 1);
    assert.equal(phases.at(-1), 'rewarded');
});

test('throwing SDK listener cleanup is isolated from gameplay', () => {
    let loaded;
    let onEvent;
    const phases = [];
    const session = startRewardedAdSession({
        port: {
            isSupported: () => true,
            load: (input) => {
                loaded = input.onLoaded;
                return () => { throw new Error('load dispose failure'); };
            },
            show: (input) => {
                onEvent = input.onEvent;
                return () => { throw new Error('show dispose failure'); };
            },
        },
        adGroupId: 'group-1',
        onPhase: (phase) => phases.push(phase),
        onEarned: () => undefined,
    });
    assert.doesNotThrow(() => loaded());
    assert.doesNotThrow(() => session.show());
    assert.doesNotThrow(() => onEvent('dismissed'));
    assert.doesNotThrow(() => session.dispose());
    assert.equal(phases.at(-1), 'dismissed');
});
