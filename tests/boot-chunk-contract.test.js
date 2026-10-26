// 첫 화면(부팅 · 시작 화면) 전에 받는 자바스크립트는 진입 청크와 그 정적 import 사슬이다 — Vite가 index.html에
// modulepreload로 전부 싣는다. 게임 화면(GameRoot 아래 전부 — 조작판 · 모드 화면 · 상태 표시줄)과 그림 매니페스트 ·
// 팔레트 · 그림 경로 유틸은 첫 화면에 쓰이지 않으므로 그 사슬 밖에 둔다(CH-03: 첫 화면 전 gzip 603KB → 490KB).
// 토스 SDK는 웹 · iOS · Android 앱 빌드의 어느 청크에도 없다(scripts/tossSdkTarget.mjs).
// 계약은 실제 앱 빌드(vite.config.js, 디스크에 쓰지 않음)의 청크 그래프로 잰다 — 소스의 import 문을 읽지 않는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { build } from 'vite';

import GameRootLoader from '../src/components/app/GameRootLoader.tsx';
import { renderStatic } from './helpers/render.ts';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// 첫 화면에 쓰이지 않는 모듈 — 게임 화면의 뿌리와 그 아래 화면, 그림 매니페스트 · 팔레트, 그림 경로 · 착용 미리보기 유틸.
const NOT_BEFORE_FIRST_SCREEN = [
    'src/components/app/GameRoot.tsx',
    'src/components/app/MobileGameLayout.tsx',
    'src/components/ControlPanel.tsx',
    'src/data/characterArtManifest.json',
    'src/data/consumableArtManifest.json',
    'src/data/monsterArtManifest.json',
    'src/data/artPalette.json',
    'src/utils/itemVisuals.ts',
    'src/utils/equipmentArt.ts',
    'src/utils/avatarEquipmentPreview.ts',
];

const toRepoPath = (id) => path.relative(repoRoot, id).split(path.sep).join('/');

let appBuild = null;
// 플레이어가 받는 빌드 — 토스 대상도, QA 테스트 API도 아니다.
const buildApp = () => {
    appBuild ??= (async () => {
        const saved = { VITE_PLATFORM_TARGET: process.env.VITE_PLATFORM_TARGET, VITE_ENABLE_TEST_API: process.env.VITE_ENABLE_TEST_API };
        delete process.env.VITE_PLATFORM_TARGET;
        delete process.env.VITE_ENABLE_TEST_API;
        try {
            const result = await build({
                root: repoRoot,
                configFile: path.join(repoRoot, 'vite.config.js'),
                logLevel: 'silent',
                build: { write: false },
            });
            const outputs = Array.isArray(result) ? result : [result];
            const chunks = outputs.flatMap((output) => output.output).filter((entry) => entry.type === 'chunk');
            const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
            const entries = chunks.filter((chunk) => chunk.isEntry);
            assert.equal(entries.length, 1, '앱 빌드의 진입 청크는 하나다');

            const bootFiles = new Set();
            const visit = (fileName) => {
                if (bootFiles.has(fileName)) return;
                bootFiles.add(fileName);
                for (const imported of byFile.get(fileName).imports) visit(imported);
            };
            visit(entries[0].fileName);

            const moduleChunk = new Map();
            for (const chunk of chunks) {
                for (const id of Object.keys(chunk.modules)) moduleChunk.set(toRepoPath(id), chunk);
            }
            return { chunks, bootFiles, moduleChunk };
        } finally {
            for (const [key, value] of Object.entries(saved)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
        }
    })();
    return appBuild;
};

test('첫 화면 전에 받는 청크(진입 청크 + 정적 import 사슬)에 게임 화면 · 그림 매니페스트 · 그림 유틸이 없다 — 실제 앱 빌드', async () => {
    const { bootFiles, moduleChunk } = await buildApp();
    for (const modulePath of NOT_BEFORE_FIRST_SCREEN) {
        const chunk = moduleChunk.get(modulePath);
        assert.ok(chunk, `${modulePath}는 앱 빌드에 있다(이름이 바뀌면 이 목록도 옮길 것)`);
        assert.ok(!bootFiles.has(chunk.fileName), `${modulePath}가 첫 화면 전에 받는 청크 ${chunk.fileName}에 있다`);
    }

    const gameRootChunk = moduleChunk.get('src/components/app/GameRoot.tsx');
    assert.ok(gameRootChunk.isDynamicEntry, '게임 화면은 따로 받는 청크(동적 import)의 뿌리다');
    // 시작 화면과 부팅 화면은 첫 화면이다 — 따로 받으면 첫 화면이 늦는다.
    for (const modulePath of ['src/components/IntroScreen.tsx', 'src/components/app/BootScreen.tsx']) {
        assert.ok(bootFiles.has(moduleChunk.get(modulePath).fileName), `${modulePath}는 첫 화면 전에 받는다`);
    }
});

test('토스 SDK 패키지는 웹 · iOS · Android 앱 빌드의 어느 청크에도 없다 — SDK 경로는 대역으로 남는다', async () => {
    const { chunks, bootFiles, moduleChunk } = await buildApp();
    const sdkModules = chunks.flatMap((chunk) => Object.keys(chunk.modules))
        .map(toRepoPath)
        .filter((modulePath) => modulePath.includes('node_modules/@apps-in-toss/'));
    assert.deepEqual(sdkModules, []);

    const unavailable = moduleChunk.get('src/platform/tossSdkUnavailable.ts');
    assert.ok(unavailable, 'SDK를 부르는 플랫폼 경로는 빌드에 남고 대역으로 풀린다');
    assert.ok(bootFiles.has(unavailable.fileName));
});

test('게임 화면 청크를 아직 받지 못했으면 부팅 화면을 그대로 둔다 — 빈 화면이 아니다', () => {
    const html = renderStatic(createElement(GameRootLoader, {}));
    assert.ok(html.includes('data-testid="boot-progress"'), html);
    assert.ok(html.includes('data-boot-stage="ready"'), html);
});
