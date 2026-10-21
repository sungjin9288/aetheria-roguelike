#!/usr/bin/env node
// 앱인토스 콘솔 자산을 만든다: 로고 600×600 · 썸네일 1932×828 · 실제 플레이 세로 스크린샷 636×1048.
// 규격은 저장소 검증기(scripts/tossReleaseEvidence.mjs의 review 단계)가 정한다.
//
// - 프로덕션 빌드(dist/)를 vite preview로 띄우고, 테스트 API 없이 화면의 단추로만 플레이한다.
// - 난수는 시드로 고정한다(같은 시드와 같은 빌드 = 같은 장면).
// - 결과는 --out 폴더에만 쓴다. 저장소에 커밋하지 않는다(docs/store/APPS_IN_TOSS_LISTING_DRAFT.md §4).
// - 글꼴은 이 명령을 돌린 기기의 시스템 글꼴이다. 콘솔에 올릴 최종본은 소유자 Mac에서 만든다.
//
// 사용: npm run build && node scripts/store/capture-toss-console-assets.mjs --out <폴더> [--name 에테리아]
//       [--tagline <한 줄>] [--hero <캐릭터 이름>] [--seed <정수>]

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

import { chromium, devices } from '@playwright/test';

const repoRoot = process.cwd();
const ICON_MASTER = path.join(repoRoot, 'scripts/art_sources/app-brand/aetheria-app-icon-master.png');
const PORTRAIT = { width: 636, height: 1048 };
const CAPTURE_VIEWPORT = { width: 390, height: 643 };
const THUMBNAIL = { width: 1932, height: 828 };
const LOGO = { width: 600, height: 600 };
const MAX_STEPS = 80;

const parseArgs = (argv) => {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const key = argv[index];
        if (!key.startsWith('--')) throw new Error(`알 수 없는 인자: ${key}`);
        args[key.slice(2)] = argv[index + 1];
        index += 1;
    }
    return args;
};

const args = parseArgs(process.argv.slice(2));
if (!args.out) throw new Error('사용: --out <폴더> [--name 에테리아] [--tagline <한 줄>] [--hero <이름>] [--seed <정수>]');
const outDir = path.resolve(args.out);
const displayName = args.name || '에테리아';
const tagline = args.tagline || '쓰러지면 처음부터 — 다시 오르는 판타지 로그라이크';
const heroName = args.hero || '아리아';
const seed = Number.parseInt(args.seed || '20261021', 10) >>> 0;

if (!existsSync(path.join(repoRoot, 'dist/index.html'))) {
    throw new Error('dist/index.html이 없다 — 먼저 npm run build');
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const freePort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        server.close(() => resolve(port));
    });
});

const waitForHttp = async (url, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {
            // 서버가 아직 뜨지 않았다
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`미리보기 서버가 ${timeoutMs}ms 안에 뜨지 않았다: ${url}`);
};

// mulberry32 — 앱이 읽기 전에 Math.random을 바꾼다(장면 재현용, 게임 코드는 그대로다).
const seededRandomInit = (initialSeed) => {
    let state = initialSeed;
    Math.random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const visible = (page, testId) => page.getByTestId(testId).first().isVisible().catch(() => false);
const settle = (page) => page.waitForTimeout(450);

const playAndCapture = async (browser, baseUrl) => {
    const context = await browser.newContext({
        ...devices['iPhone 12'],
        viewport: CAPTURE_VIEWPORT,
        screen: CAPTURE_VIEWPORT,
        deviceScaleFactor: 2,
        locale: 'ko-KR',
    });
    await context.addInitScript(seededRandomInit, seed);
    const page = await context.newPage();
    const shots = new Map();
    const shoot = async (key) => {
        if (shots.has(key)) return;
        await settle(page);
        shots.set(key, await page.screenshot({ type: 'png' }));
    };

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('intro-start-button').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByTestId('intro-name-input').fill(heroName);
    await page.getByTestId('intro-start-button').click();
    await page.getByTestId('persistent-status-bar').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByTestId('control-expedition-start').waitFor({ state: 'visible', timeout: 15_000 });
    await shoot('01-town');

    await page.getByTestId('control-expedition-start').click();
    await page.getByTestId('control-explore').waitFor({ state: 'visible', timeout: 15_000 });

    let attacks = 0;
    for (let step = 0; step < MAX_STEPS; step += 1) {
        if (shots.has('02-combat') && shots.has('03-result') && (shots.has('04-event') || shots.has('04-relic'))) break;
        if (await visible(page, 'run-summary-card')) break;
        if (await visible(page, 'relic-choice-panel')) {
            await shoot('04-relic');
            await page.getByTestId('relic-choice-0').click();
        } else if (await visible(page, 'event-panel')) {
            if (await visible(page, 'event-choice-0')) {
                await shoot('04-event');
                await page.getByTestId('event-choice-0').click();
            } else if (await visible(page, 'event-dismiss')) {
                await page.getByTestId('event-dismiss').click();
            }
        } else if (await visible(page, 'post-combat-card')) {
            await shoot('03-result');
            await page.getByTestId('post-combat-close').click();
        } else if (await visible(page, 'combat-action-attack')) {
            if (attacks >= 1) await shoot('02-combat');
            await page.getByTestId('combat-action-attack').click();
            attacks += 1;
        } else if (await visible(page, 'control-explore')) {
            await page.getByTestId('control-explore').click();
        }
        await settle(page);
    }
    await context.close();
    return shots;
};

const renderHtml = async (browser, size, html) => {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: 'png' });
    await context.close();
    return png;
};

const dataUrl = (png) => `data:image/png;base64,${png.toString('base64')}`;
const FONT_STACK = "-apple-system, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif";

const portraitHtml = (raw) => `<!doctype html><html><body style="margin:0;background:#03070d">
<img src="${dataUrl(raw)}" style="display:block;width:${PORTRAIT.width}px;height:${PORTRAIT.height}px;object-fit:cover;object-position:top">
</body></html>`;

const logoHtml = (icon) => `<!doctype html><html><body style="margin:0;background:#03070d">
<img src="${dataUrl(icon)}" style="display:block;width:${LOGO.width}px;height:${LOGO.height}px">
</body></html>`;

const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

const thumbnailHtml = (icon, portraits) => `<!doctype html><html><body style="margin:0">
<div style="position:relative;width:${THUMBNAIL.width}px;height:${THUMBNAIL.height}px;overflow:hidden;font-family:${FONT_STACK};
  background:radial-gradient(circle at 18% 50%, rgba(125,212,216,0.16), transparent 42%),
             radial-gradient(circle at 78% 30%, rgba(213,177,128,0.10), transparent 46%), #03070d">
  <div style="position:absolute;left:72px;top:0;bottom:0;width:600px;display:flex;flex-direction:column;justify-content:center;align-items:center">
    <img src="${dataUrl(icon)}" style="width:340px;height:340px;border-radius:68px;box-shadow:0 0 80px rgba(125,212,216,0.28)">
    <div style="margin-top:36px;font-size:108px;font-weight:800;color:#f6e7c8;letter-spacing:0.02em">${escapeHtml(displayName)}</div>
    <div style="margin-top:16px;font-size:36px;font-weight:600;line-height:1.35;color:#dff7f5;opacity:0.86;text-align:center;word-break:keep-all">${escapeHtml(tagline)}</div>
  </div>
  <div style="position:absolute;right:64px;top:${Math.round((THUMBNAIL.height - Math.round(352 * PORTRAIT.height / PORTRAIT.width)) / 2)}px;display:flex;gap:24px">
    ${portraits.map((png) => `<img src="${dataUrl(png)}" style="width:352px;height:${Math.round(352 * PORTRAIT.height / PORTRAIT.width)}px;border-radius:28px;border:2px solid rgba(255,255,255,0.14);box-shadow:0 24px 60px rgba(0,0,0,0.55)">`).join('')}
  </div>
</div></body></html>`;

const pngSize = (png) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

const main = async () => {
    await mkdir(outDir, { recursive: true });
    const port = await freePort();
    const baseUrl = `http://127.0.0.1:${port}/`;
    const preview = spawn(path.join(repoRoot, 'node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: repoRoot,
        stdio: 'ignore',
    });
    const browser = await chromium.launch();
    try {
        await waitForHttp(baseUrl, 30_000);
        const shots = await playAndCapture(browser, baseUrl);
        const order = ['01-town', '02-combat', '03-result', '04-event', '04-relic'].filter((key) => shots.has(key));
        if (order.length < 3) throw new Error(`실제 플레이 장면이 3개 미만이다(${order.join(', ')}) — --seed를 바꿔 다시 실행한다`);

        const assets = [];
        const write = async (file, png, kind, originalPlay) => {
            await writeFile(path.join(outDir, file), png);
            const { width, height } = pngSize(png);
            assets.push({ kind, path: `assets/${file}`, width, height, sha256: sha256(png), candidateId: null, releaseId: null, originalPlay, testMarker: false });
        };

        const icon = await readFile(ICON_MASTER);
        await write('logo-600.png', await renderHtml(browser, LOGO, logoHtml(icon)), 'logo', false);
        const portraits = [];
        for (const key of order) {
            const png = await renderHtml(browser, PORTRAIT, portraitHtml(shots.get(key)));
            portraits.push(png);
            await write(`screenshot-${key}.png`, png, 'portrait_screenshot', true);
        }
        await write('thumbnail-1932x828.png', await renderHtml(browser, THUMBNAIL, thumbnailHtml(icon, portraits.slice(0, 3))), 'thumbnail', false);

        const manifest = { schemaVersion: 1, seed, displayName, tagline, heroName, capturedAt: new Date().toISOString(), assets };
        await writeFile(path.join(outDir, 'prepared-console-assets.json'), `${JSON.stringify(manifest, null, 4)}\n`);
        for (const asset of assets) console.log(`${asset.kind}\t${asset.width}x${asset.height}\t${asset.path}`);
    } finally {
        await browser.close();
        preview.kill();
    }
};

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
