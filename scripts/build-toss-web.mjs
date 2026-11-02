import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { stageTossAssets } from './tossAssetCatalog.mjs';
import { verifyTossBundle } from './tossBundle.mjs';

const repoRoot = process.cwd();
const stagingRoot = path.join(repoRoot, '.toss/public');
const bundleDirectoryName = process.env.AETHERIA_TOSS_BUNDLE_DIR || 'dist-toss';
if (!['dist-toss', 'dist-toss-rehearsal'].includes(bundleDirectoryName)) {
    throw new Error(`Unsupported Toss bundle directory: ${bundleDirectoryName}`);
}
const bundleDir = path.join(repoRoot, bundleDirectoryName);
if (
    bundleDirectoryName === 'dist-toss'
    && (
        process.env.VITE_ENABLE_TEST_API === '1'
        || Boolean(process.env.VITE_DEVICE_QA_SCENARIO)
        || process.env.AETHERIA_TOSS_ALLOW_TEST_HARNESS === '1'
    )
) {
    throw new Error('Canonical Toss bundle refuses test-harness and device-QA build flags');
}

await rm(stagingRoot, { recursive: true, force: true });
await rm(bundleDir, { recursive: true, force: true });
await mkdir(stagingRoot, { recursive: true });

const { catalog } = await stageTossAssets({ repoRoot, outputRoot: stagingRoot });
const viteBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'vite.cmd' : 'vite',
);

const status = await new Promise((resolve, reject) => {
    const child = spawn(viteBin, ['build', '--config', 'vite.toss.config.js'], {
        cwd: repoRoot,
        env: {
            ...process.env,
            VITE_PLATFORM_TARGET: 'toss',
            // AI 이벤트는 끄고 출시한다(소유자 결정 2026-10-29). Vite는 이미 있는 환경 변수를 `.env` 파일보다 앞에 두므로
            //   로컬 `.env`가 켜 둔 값이 후보에 실리지 않는다. 켜려면 처리방침의 AI 항목을 먼저 되살린다(런북 §9).
            VITE_USE_AI_PROXY: 'false',
        },
        stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', resolve);
});

if (status !== 0) process.exit(status ?? 1);

const report = await verifyTossBundle({
    bundleDir,
    catalog,
    allowTestHarness: process.env.AETHERIA_TOSS_ALLOW_TEST_HARNESS === '1',
});
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
