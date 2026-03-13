import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from 'playwright';

const DEFAULT_URL = 'http://127.0.0.1:4173/';
const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ALLOWED_404_PATHS = new Set(['/favicon.ico', '/api/ai-proxy']);
const args = process.argv.slice(2);
const isMobile = args.includes('--mobile');
const urlArgIndex = args.indexOf('--url');
const targetUrl = urlArgIndex >= 0 ? args[urlArgIndex + 1] : process.env.AETHERIA_SMOKE_URL || DEFAULT_URL;
const viewportLabel = isMobile ? 'mobile' : 'desktop';
const artifactDir = path.resolve(process.cwd(), 'playtest-artifacts', viewportLabel);

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sanitizeName = (value) => value.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();

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
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function writeStateArtifact(name, state, page) {
  const basename = sanitizeName(name);
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, `${basename}.json`), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: path.join(artifactDir, `${basename}.png`), fullPage: true });
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

async function settleAfterCommand(page, timeout = 12000) {
  return waitForState(
    page,
    (state) => !state.isAiThinking,
    'AI/event processing to settle',
    timeout
  );
}

async function resetToIntro(page) {
  let state = await readState(page);
  if (state.mode === 'intro') return state;

  await page.evaluate(() => window.__AETHERIA_TEST_API__?.resetGame?.());
  return waitForState(page, (nextState) => nextState.mode === 'intro', 'intro screen after reset');
}

async function startNewRun(page) {
  await resetToIntro(page);
  const startButton = page.locator('[data-testid="intro-start-button"]');
  const nameInput = page.locator('[data-testid="intro-name-input"]');
  if (await nameInput.count()) {
    await nameInput.fill(isMobile ? '모바일검증' : '데스크검증');
  }
  await startButton.click();

  const state = await waitForState(
    page,
    (nextState) => nextState.mode === 'game' && Boolean(nextState.player?.name),
    'new game state after intro start'
  );

  await writeStateArtifact('01-after-start', state, page);
  return state;
}

async function verifyTerminalStatus(page) {
  if (isMobile) {
    await sendGameCommand(page, 'status');
  } else {
    await sendTerminalCommand(page, 'status');
  }
  const state = await waitForState(
    page,
    (nextState) => nextState.logTail?.some((log) => typeof log.text === 'string' && log.text.includes('[상태]')),
    'status command log'
  );
  await writeStateArtifact('02-status-command', state, page);
}

async function moveToForest(page) {
  if (isMobile) {
    await sendGameCommand(page, 'move 고요한 숲');
  } else {
    await sendTerminalCommand(page, 'move 고요한 숲');
  }
  const state = await waitForState(
    page,
    (nextState) => nextState.player?.loc === '고요한 숲',
    'arrival at 고요한 숲'
  );
  await writeStateArtifact('03-arrived-forest', state, page);
  return state;
}

async function resolveRelic(page, observations) {
  const firstRelic = page.locator('[data-testid="relic-choice-0"]');
  if (await firstRelic.count()) {
    observations.relic = true;
    await firstRelic.click();
    await waitForState(page, (state) => !state.pendingRelics, 'relic overlay to close');
  }
}

async function resolveEvent(page, observations) {
  observations.event = true;
  await sendGameCommand(page, '1');
  await settleAfterCommand(page);
}

async function resolveCombat(page, observations) {
  observations.combat = true;
  for (let turn = 0; turn < 18; turn += 1) {
    const state = await readState(page);
    if (state.mode === 'run_summary') {
      throw new Error('Smoke run died during early forest combat');
    }
    if (state.postCombatResult || state.gameState !== 'combat') return;

    await sendGameCommand(page, 'attack');
    await delay(900);
  }

  const finalState = await readState(page);
  if (finalState.gameState === 'combat') {
    throw new Error('Combat did not resolve within the expected turn budget');
  }
}

async function closePostCombat(page, observations) {
  const continueButton = page.locator('[data-testid="post-combat-continue"]');
  if (await continueButton.count()) {
    observations.victory = true;
    await continueButton.click();
    await waitForState(page, (state) => !state.postCombatResult, 'post-combat card to close');
  } else {
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.clearPostCombat?.());
    await waitForState(page, (state) => !state.postCombatResult, 'post-combat state clear');
  }
}

async function driveExploreLoop(page) {
  const observations = {
    event: false,
    relic: false,
    combat: false,
    victory: false,
    syntheticEvent: false,
  };

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sendGameCommand(page, 'explore');
    await settleAfterCommand(page, 18000);

    let state = await readState(page);
    if (state.mode === 'run_summary') {
      throw new Error('Smoke run died before core loop verification completed');
    }

    if (state.pendingRelics?.length) {
      await resolveRelic(page, observations);
      state = await readState(page);
    }

    if (state.gameState === 'event' && state.currentEvent) {
      await writeStateArtifact(`04-event-${attempt + 1}`, state, page);
      await resolveEvent(page, observations);
      state = await readState(page);
    }

    if (state.gameState === 'combat' && state.enemy) {
      await writeStateArtifact(`05-combat-${attempt + 1}`, state, page);
      await resolveCombat(page, observations);
      state = await readState(page);
    }

    if (state.postCombatResult) {
      await writeStateArtifact(`06-post-combat-${attempt + 1}`, state, page);
      await closePostCombat(page, observations);
      state = await readState(page);
    }

    if (observations.combat && observations.victory && !observations.event) {
      await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectEvent?.());
      const forcedEventState = await waitForState(
        page,
        (nextState) => nextState.gameState === 'event' && Boolean(nextState.currentEvent),
        'synthetic event injection'
      );
      observations.syntheticEvent = true;
      await writeStateArtifact('06-forced-event', forcedEventState, page);
      await resolveEvent(page, observations);
      const completedState = await readState(page);
      await writeStateArtifact('07-core-loop-complete', completedState, page);
      return observations;
    }

    if (observations.event && observations.combat && observations.victory) {
      await writeStateArtifact('07-core-loop-complete', state, page);
      return observations;
    }
  }

  throw new Error(`Core loop smoke did not observe all required states: ${JSON.stringify(observations)}`);
}

async function verifyTabs(page) {
  await page.evaluate(() => window.__AETHERIA_TEST_API__?.setSideTab?.('stats'));
  const statsState = await waitForState(page, (state) => state.sideTab === 'stats', 'stats tab activation');
  await writeStateArtifact('08-stats-tab', statsState, page);

  await page.evaluate(() => window.__AETHERIA_TEST_API__?.setSideTab?.('system'));
  const systemState = await waitForState(page, (state) => state.sideTab === 'system', 'system tab activation');
  await writeStateArtifact('09-system-tab', systemState, page);

  const state = await readState(page);
  await writeStateArtifact('10-tabs-verified', state, page);
}

async function main() {
  const browser = await launchBrowser();
  const errors = [];
  const consoleErrors = [];
  const responseFailures = [];

  try {
    const context = isMobile
      ? await browser.newContext({
          ...devices['iPhone 13'],
        })
      : await browser.newContext({
          viewport: { width: 1440, height: 1100 },
        });

    const page = await context.newPage();
    page.on('pageerror', (error) => {
      errors.push(error.stack || error.message || String(error));
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (!text.startsWith('Failed to load resource: the server responded with a status of 404')) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('response', (response) => {
      if (response.status() < 400) return;
      try {
        const pathname = new URL(response.url()).pathname;
        if (ALLOWED_404_PATHS.has(pathname) && response.status() === 404) return;
        responseFailures.push(`${response.status()} ${pathname}`);
      } catch {
        responseFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', undefined, { timeout: 25000 });
    await waitForState(page, (state) => state.bootStage === 'ready', 'boot stage ready', 25000);

    await startNewRun(page);
    await verifyTerminalStatus(page);
    await moveToForest(page);
    const observations = await driveExploreLoop(page);
    await verifyTabs(page);

    const finalState = await readState(page);
    await writeStateArtifact('09-final-state', finalState, page);

    ensure(observations.combat, 'Smoke did not cover combat');
    ensure(observations.victory, 'Smoke did not cover post-combat victory flow');
    ensure(observations.event, 'Smoke did not cover event flow');
    ensure(finalState.mode === 'game', 'Smoke ended outside the main game loop');
    ensure(errors.length === 0, `Page errors detected:\n${errors.join('\n')}`);
    ensure(responseFailures.length === 0, `HTTP failures detected:\n${responseFailures.join('\n')}`);
    ensure(consoleErrors.length === 0, `Console errors detected:\n${consoleErrors.join('\n')}`);

    console.log(`[smoke:${viewportLabel}] ok`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[smoke:${viewportLabel}] failed`);
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
