// 앱인토스 SDK는 토스 빌드에만 들어간다 (scripts/tossSdkTarget.mjs · src/platform/tossSdk.ts).
// 웹 · iOS · Android 진입 청크에 SDK와 의존성(semver · valibot · @webview-bridge)이 실려 499KB 중 72KB(gzip 22KB)를
// 매번 내려받고 파싱했다 — 그 빌드의 런타임은 'toss' | 'sandbox'가 될 수 없어 SDK를 부르지 않는다.
// 계약: ① 다른 빌드는 패키지를 대역으로 풀고 토스 빌드는 SDK를 담는다(실제 Vite 빌드) ② 대역은 앱이 쓰는 표면과
// 같은 이름을 내고, 부르면 던진다(지원 여부만 false) ③ 앱에서 SDK를 가져오는 곳은 tossSdk.ts 하나다(부재 불변식).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

import viteConfig from '../vite.config.js';
import {
    TOSS_SDK_SPECIFIER,
    TOSS_SDK_UNAVAILABLE_MODULE,
    tossSdkTargetPlugin,
} from '../scripts/tossSdkTarget.mjs';
import * as tossSdk from '../src/platform/tossSdk.ts';
import * as tossSdkUnavailable from '../src/platform/tossSdkUnavailable.ts';
import { getRuntimeEnvironment, readTossOperationalEnvironment } from '../src/platform/runtimeEnvironment.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
// SDK 번들에만 있는 문자열 — 웹뷰 브리지와 SDK의 버전 판정(semver).
const SDK_MARKERS = ['ReactNativeWebView', 'SEMVER_SPEC_VERSION'];
const UNAVAILABLE_MARKER = 'Apps in Toss SDK is not bundled in this build';

const buildRuntimeEnvironment = async (platformTarget) => {
    const previous = process.env.VITE_PLATFORM_TARGET;
    if (platformTarget === undefined) delete process.env.VITE_PLATFORM_TARGET;
    else process.env.VITE_PLATFORM_TARGET = platformTarget;
    try {
        const [result] = await build({
            configFile: false,
            root: repoRoot,
            publicDir: false,
            logLevel: 'silent',
            plugins: [tossSdkTargetPlugin({ repoRoot })],
            build: {
                write: false,
                minify: false,
                lib: { entry: path.join(repoRoot, 'src/platform/runtimeEnvironment.ts'), formats: ['es'], fileName: 'runtime' },
                rollupOptions: { external: ['@capacitor/core'] },
            },
        });
        return result.output.filter((entry) => entry.type === 'chunk').map((chunk) => chunk.code).join('\n');
    } finally {
        if (previous === undefined) delete process.env.VITE_PLATFORM_TARGET;
        else process.env.VITE_PLATFORM_TARGET = previous;
    }
};

test('토스가 아닌 빌드는 SDK 대신 대역을 담고, 토스 빌드는 SDK를 담는다 — 실제 Vite 빌드', async () => {
    const web = await buildRuntimeEnvironment(undefined);
    assert.ok(web.includes(UNAVAILABLE_MARKER), '웹 빌드는 대역을 담는다');
    for (const marker of SDK_MARKERS) assert.ok(!web.includes(marker), `웹 빌드에 SDK가 없다: ${marker}`);

    const toss = await buildRuntimeEnvironment('toss');
    for (const marker of SDK_MARKERS) assert.ok(toss.includes(marker), `토스 빌드는 SDK를 담는다: ${marker}`);
    assert.ok(!toss.includes(UNAVAILABLE_MARKER), '토스 빌드에는 대역이 없다');
});

test('vite.config.js가 SDK 빌드 대상 플러그인을 쓰고, 플러그인은 토스 빌드에서만 패키지를 그대로 푼다', () => {
    assert.ok(viteConfig.plugins.flat().some((plugin) => plugin?.name === 'aetheria:toss-sdk-target'));

    const plugin = tossSdkTargetPlugin({ repoRoot });
    plugin.configResolved({ env: {} });
    assert.equal(plugin.resolveId(TOSS_SDK_SPECIFIER), path.join(repoRoot, TOSS_SDK_UNAVAILABLE_MODULE));
    assert.equal(plugin.resolveId('@apps-in-toss/web-framework/config'), null);
    assert.equal(plugin.resolveId('@capacitor/core'), null);

    plugin.configResolved({ env: { VITE_PLATFORM_TARGET: 'toss' } });
    assert.equal(plugin.resolveId(TOSS_SDK_SPECIFIER), null);
});

test('대역은 앱이 쓰는 SDK 표면과 같은 이름을 내고, 부르면 던진다 — 지원 여부만 false', () => {
    assert.deepEqual(Object.keys(tossSdkUnavailable).sort(), Object.keys(tossSdk).sort());
    assert.equal(Object.keys(tossSdk).length, 8);

    const { Environment, Storage, SafeArea, Screen, generateHapticFeedback, graniteEvent, loadFullScreenAd, showFullScreenAd } = tossSdkUnavailable;
    const calls = [
        () => Environment.environment,
        () => Environment.deploymentId,
        () => Storage.getItem('key'),
        () => Storage.setItem('key', 'value'),
        () => Storage.removeItem('key'),
        () => SafeArea.get(),
        () => SafeArea.subscribe({ onEvent: () => {} }),
        () => Screen.close(),
        () => generateHapticFeedback({ type: 'tap' }),
        () => graniteEvent.addEventListener('backEvent', { onEvent: () => {} }),
        () => loadFullScreenAd({ onEvent: () => {}, onError: () => {} }),
        () => showFullScreenAd({ onEvent: () => {}, onError: () => {} }),
    ];
    for (const call of calls) assert.throws(call, new RegExp(UNAVAILABLE_MARKER));
    assert.equal(loadFullScreenAd.isSupported(), false);
    assert.equal(showFullScreenAd.isSupported(), false);
});

test('토스 빌드가 아니면 런타임은 SDK를 읽지 않는다 — 대역이 던지는 일이 없다', () => {
    let reads = 0;
    const readEnvironment = () => {
        reads += 1;
        return tossSdkUnavailable.Environment.environment;
    };
    assert.equal(readTossOperationalEnvironment(undefined, readEnvironment), null);
    assert.equal(readTossOperationalEnvironment('web', readEnvironment), null);
    assert.equal(reads, 0);
    // 테스트 런타임의 VITE_PLATFORM_TARGET은 비어 있다 — 웹 빌드와 같은 판정이다.
    assert.equal(getRuntimeEnvironment(), 'web');
});

test('[부재] 앱에서 앱인토스 SDK를 가져오는 곳은 src/platform/tossSdk.ts 하나다', async () => {
    const walk = async (directory) => (await Promise.all((await readdir(directory, { withFileTypes: true })).map((entry) => {
        const full = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    }))).flat();
    const sources = (await walk(path.join(repoRoot, 'src'))).filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));
    const importers = [];
    for (const file of sources) {
        const source = await readFile(file, 'utf8');
        if (/from\s*['"]@apps-in-toss\/web-framework['"]|import\(\s*['"]@apps-in-toss\/web-framework['"]/.test(source)) {
            importers.push(path.relative(repoRoot, file).split(path.sep).join('/'));
        }
    }
    assert.deepEqual(importers, ['src/platform/tossSdk.ts']);
});
