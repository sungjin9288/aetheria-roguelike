import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { buildTossAssetCatalog, copyPublicFiles } from './tossAssetCatalog.mjs';

// 웹 · iOS · Android 빌드(dist → Capacitor)도 토스 빌드와 같은 런타임 그림만 담는다.
// public/assets에는 런타임이 읽지 않는 그림이 함께 있다 — 1024px 레거시 장비 원본(item-weapon-* 126MB),
// 몬스터 원본(monsterArtManifest의 sourceRuntimePath), 옛 SVG 아이콘. 저장소에는 그대로 두고(아트 재현성 · 증빙 계약),
// 빌드 산출물에는 런타임 그림 목록(buildTossAssetCatalog — 매니페스트의 runtimePath)만 복사한다.
// public/assets 밖의 파일은 웹 셸이다 — SPA 리다이렉트(_redirects), 서비스 워커와 그 앱 셸(/vite.svg),
// manifest · 아이콘, 정적 페이지(처리방침 등). 이 파일들은 목록 없이 그대로 담는다.
const PUBLIC_ROOT = 'public';
const ART_ROOT = 'public/assets';

const codePointSort = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const listShellFiles = async (repoRoot, directory = PUBLIC_ROOT) => {
    const files = [];
    for (const entry of await readdir(path.join(repoRoot, directory), { withFileTypes: true })) {
        const relativePath = path.posix.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (relativePath !== ART_ROOT) files.push(...await listShellFiles(repoRoot, relativePath));
        } else if (entry.isFile()) {
            files.push(relativePath);
        }
    }
    return files;
};

/** 웹 빌드가 담는 public 파일: 런타임 그림 목록 + public/assets 밖의 웹 셸. */
export const buildWebPublicFileList = async ({ repoRoot }) => {
    const catalog = await buildTossAssetCatalog({ repoRoot });
    const shellFiles = (await listShellFiles(repoRoot)).sort(codePointSort);
    const files = [...new Set([...catalog.files, ...shellFiles])].sort(codePointSort);

    let totalBytes = 0;
    for (const file of files) {
        if (!catalog.missing.includes(file)) totalBytes += (await lstat(path.join(repoRoot, file))).size;
    }

    return { files, shellFiles, missing: catalog.missing, totalBytes };
};

export const stageWebPublicAssets = async ({ repoRoot, outputRoot }) => {
    const list = await buildWebPublicFileList({ repoRoot });
    if (list.missing.length > 0) {
        throw new Error(`Missing runtime art: ${list.missing.join(', ')}`);
    }

    const copiedFiles = await copyPublicFiles({ repoRoot, files: list.files, outputRoot });
    return { ...list, copiedFiles };
};

/**
 * 저장소의 public/을 쓰는 빌드는 Vite의 public 통째 복사를 끄고 목록만 복사한다.
 * 다른 publicDir을 쓰는 빌드(토스 — 같은 목록을 .toss/public에 미리 담는다)는 Vite 복사를 그대로 둔다.
 */
export const webPublicAssetsPlugin = ({ repoRoot }) => {
    const repoPublicDir = path.join(repoRoot, PUBLIC_ROOT);
    let enabled = false;
    let outDir = null;

    return {
        name: 'aetheria:web-public-assets',
        apply: 'build',
        config(userConfig) {
            enabled = false;
            if (userConfig.publicDir === false) return undefined;
            const root = path.resolve(userConfig.root ?? process.cwd());
            if (path.resolve(root, userConfig.publicDir ?? PUBLIC_ROOT) !== repoPublicDir) return undefined;
            enabled = true;
            return { build: { copyPublicDir: false } };
        },
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
            if (!config.build.write) enabled = false;
        },
        async writeBundle() {
            if (!enabled) return;
            await stageWebPublicAssets({ repoRoot, outputRoot: outDir });
        },
    };
};
