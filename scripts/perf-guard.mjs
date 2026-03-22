import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, devices } from 'playwright';

const DEFAULT_URL = 'http://127.0.0.1:4173/';
const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const isMobile = args.includes('--mobile');
const viewportLabel = isMobile ? 'mobile' : 'desktop';

const getArgValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const sanitizeName = (value) => value.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
const parseNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const smokeUrl = new URL(getArgValue('--url') || process.env.AETHERIA_PERF_URL || DEFAULT_URL);
smokeUrl.searchParams.set('smoke', '1');

const targetUrl = smokeUrl.toString();
const artifactLabel = sanitizeName(getArgValue('--artifact-label') || `perf-${viewportLabel}`);
const artifactDir = path.resolve(process.cwd(), 'playtest-artifacts', artifactLabel);

const thresholds = isMobile
  ? {
      domContentLoadedMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_DCL_MS, 2500),
      firstContentfulPaintMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_FCP_MS, 2500),
      bootReadyMeasureMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_BOOT_MS, 3000),
      introVisibleMeasureMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_INTRO_VISIBLE_MS, 3000),
      introReadyMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_INTRO_MS, 3000),
      startRunMeasureMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_START_MEASURE_MS, 3000),
      startRunMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_START_MS, 3000),
      firstInteractionMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_INTERACTION_MS, 1800),
      marketOpenMeasureMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_MARKET_MEASURE_MS, 1800),
      marketOpenMs: parseNumber(process.env.AETHERIA_PERF_MOBILE_MARKET_MS, 1800),
    }
  : {
      domContentLoadedMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_DCL_MS, 2000),
      firstContentfulPaintMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_FCP_MS, 2200),
      bootReadyMeasureMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_BOOT_MS, 2500),
      introVisibleMeasureMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_INTRO_VISIBLE_MS, 2500),
      introReadyMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_INTRO_MS, 2500),
      startRunMeasureMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_START_MEASURE_MS, 2500),
      startRunMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_START_MS, 2500),
      firstInteractionMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_INTERACTION_MS, 1400),
      marketOpenMeasureMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_MARKET_MEASURE_MS, 1400),
      marketOpenMs: parseNumber(process.env.AETHERIA_PERF_DESKTOP_MARKET_MS, 1400),
    };

const logPerf = (message) => console.log(`[perf:${viewportLabel}] ${message}`);

async function launchBrowser() {
  const executablePath = process.env.PLAYWRIGHT_CHROME_PATH || DEFAULT_CHROME_PATH;
  try {
    return await chromium.launch({
      headless: true,
      executablePath,
    });
  } catch (error) {
    if (process.env.PLAYWRIGHT_CHROME_PATH || executablePath === DEFAULT_CHROME_PATH) {
      throw error;
    }
    return chromium.launch({ headless: true });
  }
}

async function readState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() || '{}');
  return JSON.parse(raw);
}

async function waitForState(page, predicate, description, timeout = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const state = await readState(page);
    if (predicate(state)) return state;
    await page.waitForTimeout(150);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function sendTerminalCommand(page, command) {
  const input = page.locator('[data-terminal-input]');
  await input.click();
  await input.fill(command);
  await input.press('Enter');
}

async function sendGameCommand(page, command) {
  await page.evaluate((value) => window.__AETHERIA_TEST_API__?.sendCommand?.(value), command);
}

async function markAndDomClick(locator, markName) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.evaluate((node, payload) => {
    window.__AETHERIA_TEST_API__?.markPerf?.(payload.markName);
    node.click();
  }, { markName });
}

async function capturePerfMetrics(page) {
  return page.evaluate(() => {
    const navigationEntry = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const firstPaint = paints.find((entry) => entry.name === 'first-paint');
    const firstContentfulPaint = paints.find((entry) => entry.name === 'first-contentful-paint');

    return {
      domContentLoadedMs: navigationEntry?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigationEntry?.loadEventEnd ?? null,
      responseEndMs: navigationEntry?.responseEnd ?? null,
      firstPaintMs: firstPaint?.startTime ?? null,
      firstContentfulPaintMs: firstContentfulPaint?.startTime ?? null,
    };
  });
}

async function readAppPerfSnapshot(page) {
  return page.evaluate(() => window.__AETHERIA_TEST_API__?.getPerfSnapshot?.() || {});
}

async function main() {
  const browser = await launchBrowser();
  const context = await browser.newContext(
    isMobile
      ? { ...devices['iPhone 13'] }
      : {
          viewport: {
            width: parseNumber(getArgValue('--viewport-width'), 1440),
            height: parseNumber(getArgValue('--viewport-height'), 1100),
          },
        },
  );

  const page = await context.newPage();
  const metrics = {};

  try {
    const navigationStartedAt = performance.now();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    const startButton = page.locator('[data-testid="intro-start-button"]');
    await startButton.waitFor({ state: 'visible', timeout: 10000 });
    metrics.introReadyMs = Number((performance.now() - navigationStartedAt).toFixed(1));

    Object.assign(metrics, await capturePerfMetrics(page));
    const initialAppPerf = await readAppPerfSnapshot(page);
    metrics.bootReadyMeasureMs = initialAppPerf['aetheria:boot-ready-ms'] ?? null;
    metrics.introVisibleMeasureMs = initialAppPerf['aetheria:intro-visible-ms'] ?? null;

    const nameInput = page.locator('[data-testid="intro-name-input"]');
    if (await nameInput.count()) {
      await nameInput.fill(isMobile ? '모바일성능' : '데스크성능');
    }

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.markPerf?.('aetheria:test-start-run'));
    const startRunAt = performance.now();
    await startButton.click();
    await waitForState(
      page,
      (state) => state.mode === 'game' && Boolean(state.player?.name),
      'new run after intro start',
    );
    metrics.startRunMs = Number((performance.now() - startRunAt).toFixed(1));
    const postStartPerf = await readAppPerfSnapshot(page);
    metrics.startRunMeasureMs = postStartPerf['aetheria:start-run-from-click-ms'] ?? null;

    const interactionStartedAt = performance.now();
    if (isMobile) {
      await sendGameCommand(page, 'status');
    } else {
      await sendTerminalCommand(page, 'status');
    }
    await waitForState(
      page,
      (state) => state.logTail?.some((log) => typeof log.text === 'string' && log.text.includes('[상태]')),
      'status command response',
    );
    metrics.firstInteractionMs = Number((performance.now() - interactionStartedAt).toFixed(1));

    const marketButton = page.locator('[data-testid="control-market"]');
    const marketStartedAt = performance.now();
    await markAndDomClick(marketButton, 'aetheria:test-market-open');
    await waitForState(
      page,
      (state) => state.gameState === 'shop',
      'market open',
    );
    metrics.marketOpenMs = Number((performance.now() - marketStartedAt).toFixed(1));
    const postMarketPerf = await readAppPerfSnapshot(page);
    metrics.marketOpenMeasureMs = postMarketPerf['aetheria:market-open-from-click-ms'] ?? null;

    await fs.mkdir(artifactDir, { recursive: true });
    await fs.writeFile(
      path.join(artifactDir, 'perf-summary.json'),
      `${JSON.stringify({ targetUrl, viewport: viewportLabel, thresholds, metrics }, null, 2)}\n`,
      'utf8',
    );
    await page.screenshot({
      path: path.join(artifactDir, 'perf-final.png'),
      fullPage: true,
      timeout: 60000,
    });

    const failures = Object.entries(thresholds)
      .filter(([name, limit]) => metrics[name] != null && metrics[name] > limit)
      .map(([name, limit]) => `${name}: ${metrics[name]}ms > ${limit}ms`);

    logPerf(`metrics ${JSON.stringify(metrics)}`);

    if (failures.length > 0) {
      throw new Error(`threshold failures:\n- ${failures.join('\n- ')}`);
    }

    logPerf('ok');
  } finally {
    await context.close();
    await browser.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[perf:${viewportLabel}] failed: ${error.message}`);
    process.exit(1);
  });
