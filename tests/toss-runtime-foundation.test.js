import assert from 'node:assert/strict';
import test from 'node:test';

import {
    allowsServiceWorker,
    readTossOperationalEnvironment,
    resolveRuntimeEnvironment,
} from '../src/platform/runtimeEnvironment.ts';

test('runtime environment keeps web and Capacitor behavior while isolating Toss targets', () => {
    const cases = [
        { name: 'plain browser', input: { nativePlatform: false }, want: 'web' },
        { name: 'Capacitor shell', input: { nativePlatform: true }, want: 'capacitor' },
        { name: 'Toss production', input: { nativePlatform: false, platformTarget: 'toss' }, want: 'toss' },
        {
            name: 'same Toss bundle in sandbox',
            input: { nativePlatform: false, platformTarget: 'toss', operationalEnvironment: 'sandbox' },
            want: 'sandbox',
        },
        { name: 'unknown target fallback', input: { nativePlatform: false, target: 'preview' }, want: 'web' },
    ];

    for (const { name, input, want } of cases) {
        assert.equal(resolveRuntimeEnvironment(input), want, name);
    }
});

test('Capacitor native authority wins over an accidental web build target', () => {
    assert.equal(resolveRuntimeEnvironment({ nativePlatform: true, platformTarget: 'toss' }), 'capacitor');
    assert.equal(
        resolveRuntimeEnvironment({
            nativePlatform: true,
            platformTarget: 'toss',
            operationalEnvironment: 'sandbox',
        }),
        'capacitor',
    );
});

test('service worker is available only in the ordinary web runtime', () => {
    assert.equal(allowsServiceWorker('web'), true);
    assert.equal(allowsServiceWorker('capacitor'), false);
    assert.equal(allowsServiceWorker('toss'), false);
    assert.equal(allowsServiceWorker('sandbox'), false);
});

test('Toss target reads the SDK operational environment and fails safe when the bridge is absent', () => {
    assert.equal(readTossOperationalEnvironment('toss', () => 'sandbox'), 'sandbox');
    assert.equal(readTossOperationalEnvironment('toss', () => 'toss'), 'toss');
    assert.equal(readTossOperationalEnvironment('web', () => 'sandbox'), null);
    assert.equal(readTossOperationalEnvironment('toss', () => { throw new Error('bridge missing'); }), null);
});
