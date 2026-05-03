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
const viewportLabel = isMobile ? 'mobile' : 'desktop';
const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sanitizeName = (value) => value.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
const getArgValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const parseDimension = (name, fallback) => {
  const raw = Number(getArgValue(name));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const smokeUrl = new URL(getArgValue('--url') || process.env.AETHERIA_SMOKE_URL || DEFAULT_URL);
smokeUrl.searchParams.set('smoke', '1');

const targetUrl = smokeUrl.toString();
const targetOrigin = smokeUrl.origin;
const artifactLabel = sanitizeName(getArgValue('--artifact-label') || viewportLabel);
const desktopViewport = {
  width: parseDimension('--viewport-width', 1440),
  height: parseDimension('--viewport-height', 1100),
};
const artifactDir = path.resolve(process.cwd(), 'playtest-artifacts', artifactLabel);
const logSmoke = (message) => console.log(`[smoke:${viewportLabel}] ${message}`);
const CLOSE_TIMEOUT_MS = 2500;

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

async function settleClose(task, label) {
  try {
    await Promise.race([
      task,
      delay(CLOSE_TIMEOUT_MS).then(() => {
        throw new Error(`${label} timeout`);
      }),
    ]);
  } catch (error) {
    console.warn(`[smoke:${viewportLabel}] ${label} skipped: ${error.message}`);
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
  const domMetrics = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getDomMetrics?.() || null);
  const artifactState = domMetrics ? { ...state, domMetrics } : state;
  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(path.join(artifactDir, `${basename}.json`), `${JSON.stringify(artifactState, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: path.join(artifactDir, `${basename}.png`), fullPage: true, timeout: 60000 });
}

async function scrollToTop(page) {
  await page.evaluate(() => {
    const shell = document.querySelector('[data-app-shell]');
    if (shell instanceof HTMLElement) {
      shell.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await delay(120);
}

async function sendTerminalCommand(page, command) {
  const input = page.locator('[data-terminal-input]');
  if (!await input.count()) {
    await sendGameCommand(page, command);
    return;
  }
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

function isGeneratedHangulName(value) {
  return /^[가-힣]{2,5}$/.test(String(value || ''));
}

async function verifyIntroNameGenerator(page) {
  const nameInput = page.locator('[data-testid="intro-name-input"]');
  const rerollButton = page.locator('[data-testid="intro-reroll-name"]');

  if (!await nameInput.count()) return;

  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await rerollButton.waitFor({ state: 'visible', timeout: 10000 });

  const firstName = await nameInput.inputValue();
  ensure(isGeneratedHangulName(firstName), `Initial intro name did not match 2~5 char Hangul rule: ${firstName}`);

  const seenNames = new Set([firstName]);
  for (let index = 0; index < 3; index += 1) {
    await rerollButton.click();
    await delay(120);
    const nextName = await nameInput.inputValue();
    ensure(isGeneratedHangulName(nextName), `Rerolled intro name did not match 2~5 char Hangul rule: ${nextName}`);
    seenNames.add(nextName);
  }

  ensure(seenNames.size >= 2, 'Intro reroll did not produce at least one distinct generated name');
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
    await verifyIntroNameGenerator(page);
    await nameInput.fill(isMobile ? '모바일검증' : '데스크검증');
  }
  await startButton.waitFor({ state: 'visible', timeout: 10000 });
  await startButton.evaluate((node) => node.click());

  const state = await waitForState(
    page,
    (nextState) => nextState.mode === 'game' && Boolean(nextState.player?.name),
    'new game state after intro start'
  );

  await scrollToTop(page);
  await writeStateArtifact('01-after-start', state, page);
  return state;
}

const isRunOver = (state) => (
  state?.mode === 'run_summary'
  || state?.gameState === 'dead'
  || Boolean(state?.runSummary)
);

async function restartFromRunOver(page, label = 'recovery') {
  logSmoke(`restart after run-over (${label})`);
  await resetToIntro(page);
  const state = await startNewRun(page);
  await writeStateArtifact(`${label}-restart`, state, page);
  await moveToForest(page);
  return readState(page);
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
  await scrollToTop(page);
  await writeStateArtifact('02-status-command', state, page);
}

async function verifyMobileFirstFold(page) {
  if (!isMobile) return;

  const terminalPanel = page.locator('[data-testid="terminal-panel"]');
  const archiveOpenButton = page.locator('[data-testid="mobile-console-open-archive"]');
  const statusCharacterChip = page.locator('[data-testid="status-character-chip"]');
  const moveButton = page.locator('[data-testid="control-move"]');
  const shopButton = page.locator('[data-testid="control-market"]');

  await terminalPanel.waitFor({ state: 'visible', timeout: 10000 });
  await archiveOpenButton.waitFor({ state: 'visible', timeout: 10000 });
  await statusCharacterChip.waitFor({ state: 'visible', timeout: 10000 });
  await moveButton.waitFor({ state: 'visible', timeout: 10000 });
  await shopButton.waitFor({ state: 'visible', timeout: 10000 });
  ensure(
    !await page.locator('[data-testid="control-reset"]').first().isVisible().catch(() => false),
    'Mobile action bar should not render reset after menu consolidation'
  );

  const terminalBox = await terminalPanel.boundingBox();
  ensure(terminalBox && terminalBox.height >= 240, 'Mobile log panel did not retain the expanded first-fold height');
}

async function verifyMobileArchiveConsole(page) {
  if (!isMobile) return;

  const statusCharacterChip = page.locator('[data-testid="status-character-chip"]');
  const archiveOpenButton = page.locator('[data-testid="mobile-console-open-archive"]');
  const archiveConsole = page.locator('[data-testid="mobile-archive-console"]');
  const archiveReturnButton = page.locator('[data-testid="mobile-console-return-log"]');
  const equipmentPreview = page.locator('[data-testid="equipment-character-preview"]');

  await statusCharacterChip.click();
  await archiveConsole.waitFor({ state: 'visible', timeout: 10000 });
  await equipmentPreview.waitFor({ state: 'visible', timeout: 5000 });
  await archiveReturnButton.click();
  await page.locator('[data-testid="terminal-panel"]').waitFor({ state: 'visible', timeout: 10000 });

  await archiveOpenButton.click();
  await archiveConsole.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="menu-town-rest"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="menu-town-class"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="menu-town-quest"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="menu-town-craft"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="menu-reset"]').waitFor({ state: 'visible', timeout: 5000 });
  // cycle 81: 모바일 archive console의 inline rail 레이아웃에서 primary tabs(equipment /
  // inventory / quest / map / stats)는 archive-tab-* testid를, secondary tabs(achievements /
  // skills / codex / pass / graves / system)만 dashboard-tab-* testid를 사용한다.
  // 이전엔 equipment/stats를 dashboard-tab-* 으로 잘못 매칭해 모바일 smoke가 archive
  // 진입 직후 실패하던 잠재 회귀 (cycle 73의 verify:full에서 발견 — 표준 `npm run
  // test:smoke`는 desktop만 돌려 안 잡혔음).
  await page.locator('[data-testid="archive-tab-equipment"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="archive-tab-stats"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="archive-tab-equipment"]').click();
  await page.locator('[data-testid="equipment-slot-weapon"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="equipment-slot-armor"]').waitFor({ state: 'visible', timeout: 5000 });
  const weaponSlot = page.locator('[data-testid="equipment-slot-weapon"]');

  await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedEnhanceScenario?.({ gold: 100, materialCount: 0, weaponEnhance: 0 }));
  await weaponSlot.getByText('골드 부족').waitFor({ state: 'visible', timeout: 5000 });
  ensure(await page.locator('[data-testid="equipment-enhance-weapon"]').isDisabled(), 'Equipment enhance button should be disabled when gold is insufficient');

  await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedEnhanceScenario?.({ gold: 500, materialCount: 0, weaponEnhance: 0 }));
  await weaponSlot.getByText('재료 부족').waitFor({ state: 'visible', timeout: 5000 });
  ensure(await page.locator('[data-testid="equipment-enhance-weapon"]').isDisabled(), 'Equipment enhance button should be disabled when material is insufficient');

  await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedEnhanceScenario?.({ gold: 500, materialCount: 1, weaponEnhance: 0 }));
  await weaponSlot.getByText('강화 가능').waitFor({ state: 'visible', timeout: 5000 });
  ensure(!await page.locator('[data-testid="equipment-enhance-weapon"]').isDisabled(), 'Equipment enhance button should be enabled when requirements are met');

  await page.locator('[data-testid="dashboard-tab-inventory"]').click();
  await page.locator('[data-testid="mobile-archive-console-content"]').waitFor({ state: 'visible', timeout: 5000 });
  const returnText = await page.locator('[data-testid="mobile-console-return-log"]').textContent();
  ensure(String(returnText || '').includes('닫기'), 'Mobile menu close affordance should use 닫기 label');

  const avatarPresets = [
    { id: 'paladin-plate', job: '팔라딘' },
    { id: 'archmage-robe', job: '아크메이지' },
    { id: 'shadow-lord-leather', job: '그림자 주군' },
    { id: 'ranger-coat', job: '레인저' },
    { id: 'berserker-plate', job: '버서커' },
    { id: 'adventurer-straw-hat', job: '모험가' },
    { id: 'adventurer-travel-tunic', job: '모험가' },
  ];

  const avatarStates = {};

  for (const preset of avatarPresets) {
    const seeded = await page.evaluate((value) => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.(value), preset.id);
    ensure(seeded, `Avatar preset ${preset.id} could not be injected`);
    const avatarState = await waitForState(
      page,
      (nextState) => nextState.player?.job === preset.job && nextState.sideTab === 'equipment',
      `${preset.id} avatar scenario to load`
    );
    if (!await archiveConsole.isVisible().catch(() => false)) {
      const reopenedWith = await page.evaluate(() => {
        const chip = document.querySelector('[data-testid="status-character-chip"]');
        if (chip instanceof HTMLElement) {
          chip.click();
          return 'status-character-chip';
        }
        const archiveButton = document.querySelector('[data-testid="mobile-console-open-archive"]');
        if (archiveButton instanceof HTMLElement) {
          archiveButton.click();
          return 'mobile-console-open-archive';
        }
        return null;
      });
      ensure(reopenedWith, `Avatar preset ${preset.id} could not reopen the archive console`);
    }
    await archiveConsole.waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[data-testid="equipment-character-preview"]').waitFor({ state: 'visible', timeout: 5000 });
    const avatarMeta = await page.locator('[data-testid="equipment-character-preview"]').evaluate((node) => ({
      weapon: node.getAttribute('data-avatar-weapon'),
      offhand: node.getAttribute('data-avatar-offhand'),
      armor: node.getAttribute('data-avatar-armor'),
      headgear: node.getAttribute('data-avatar-headgear'),
    }));
    avatarStates[preset.id] = avatarMeta;
    await writeStateArtifact(`02b-avatar-${preset.id}`, avatarState, page);
  }

  ensure(
    avatarStates['adventurer-straw-hat']?.headgear === 'straw-hat',
    'Adventurer straw-hat scenario did not expose straw-hat avatar state'
  );
  ensure(
    avatarStates['adventurer-travel-tunic']?.headgear === 'none',
    'Adventurer travel-tunic scenario should not expose a headgear state'
  );
  ensure(
    avatarStates['adventurer-straw-hat']?.armor !== avatarStates['adventurer-travel-tunic']?.armor
      || avatarStates['adventurer-straw-hat']?.weapon !== avatarStates['adventurer-travel-tunic']?.weapon
      || avatarStates['adventurer-straw-hat']?.offhand !== avatarStates['adventurer-travel-tunic']?.offhand,
    'Avatar state attributes did not change between same-job equipment presets'
  );

  await page.locator('[data-testid="menu-reset"]').click();
  await page.locator('[data-testid="menu-reset-confirm"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="menu-reset-cancel"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="menu-reset-cancel"]').click();
  await page.locator('[data-testid="menu-reset"]').waitFor({ state: 'visible', timeout: 5000 });
  await writeStateArtifact('02-archive-console-open', await readState(page), page);

  await archiveReturnButton.click();
  await page.locator('[data-testid="terminal-panel"]').waitFor({ state: 'visible', timeout: 10000 });
}

async function verifyShopFlow(page) {
  const marketButton = page.locator('[data-testid="control-market"]');
  if (!await marketButton.count()) return;

  await marketButton.click();
  const openState = await waitForState(
    page,
    (nextState) => nextState.gameState === 'shop',
    'shop panel to open'
  );
  await writeStateArtifact('02a-shop-open', openState, page);

  if (isMobile) {
    const archiveOpenButton = page.locator('[data-testid="mobile-console-open-archive"]');
    const shopCards = page.locator('[data-testid="shop-buy-item"]');
    const inlineBuyButton = page.locator('[data-testid="shop-buy-inline"]').first();
    const anyItemIcons = page.locator('[data-item-icon-style]');
    const equipmentAssetIcons = page.locator('[data-item-icon-style="equipment-asset"]');

    ensure(!await archiveOpenButton.isVisible(), 'Archive console trigger should hide while the mobile shop overlay is open');
    ensure(await page.locator('[data-testid="shop-close-footer"]').count() === 0, 'Mobile shop should not render the desktop footer close control');
    ensure(await shopCards.count() > 0, 'Mobile shop did not render compact buy cards');
    ensure(await anyItemIcons.count() > 0, 'Mobile shop did not render any item icon cards');
    ensure(await equipmentAssetIcons.count() > 0, 'Mobile shop should render standalone equipment asset illustrations for gear items');

    await inlineBuyButton.waitFor({ state: 'visible', timeout: 5000 });
  }

  const closeButton = page.locator('[data-testid="shop-close"]');
  await closeButton.click();
  await waitForState(
    page,
    (nextState) => nextState.gameState === 'idle',
    'shop panel to close'
  );
  if (isMobile) {
    await page.locator('[data-testid="mobile-console-open-archive"]').waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function verifyMobileFocusPanelFlow(page, {
  trigger,
  openPredicate,
  openDescription,
  artifactName,
  closePredicate = (nextState) => nextState.gameState === 'idle',
}) {
  const archiveOpenButton = page.locator('[data-testid="mobile-console-open-archive"]');
  const backButton = page.getByRole('button', { name: /복귀/i }).first();

  await trigger();
  const openState = await waitForState(page, openPredicate, openDescription);
  await writeStateArtifact(artifactName, openState, page);

  await backButton.waitFor({ state: 'visible', timeout: 5000 });
  ensure(!await archiveOpenButton.isVisible(), `${artifactName} should hide archive console trigger while open`);

  await backButton.click();
  await waitForState(page, closePredicate, `${artifactName} to close`);
  const returnToLogButton = page.locator('[data-testid="mobile-console-return-log"]');
  if (await returnToLogButton.isVisible().catch(() => false)) {
    await returnToLogButton.click();
  }
  await archiveOpenButton.waitFor({ state: 'visible', timeout: 10000 });
}

async function verifyMobileFocusPanels(page) {
  if (!isMobile) return;

  const openTownMenuShortcut = async (testId) => {
    await page.locator('[data-testid="mobile-console-open-archive"]').click();
    await page.locator('[data-testid="mobile-archive-console"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator(`[data-testid="${testId}"]`).click();
  };

  await verifyMobileFocusPanelFlow(page, {
    trigger: async () => {
      await openTownMenuShortcut('menu-town-class');
    },
    openPredicate: (nextState) => nextState.gameState === 'job_change',
    openDescription: 'job change panel to open',
    artifactName: '02b-class-open',
  });

  await openTownMenuShortcut('menu-town-quest');
  await waitForState(page, (nextState) => nextState.sideTab === 'quest', 'quest menu tab to open');
  await writeStateArtifact('02c-quest-open', await readState(page), page);
  await page.locator('[data-testid="mobile-console-return-log"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="mobile-console-return-log"]').click();
  await page.locator('[data-testid="mobile-console-open-archive"]').waitFor({ state: 'visible', timeout: 10000 });

  await verifyMobileFocusPanelFlow(page, {
    trigger: async () => {
      await openTownMenuShortcut('menu-town-craft');
    },
    openPredicate: (nextState) => nextState.gameState === 'crafting',
    openDescription: 'crafting panel to open',
    artifactName: '02d-craft-open',
  });

  await verifyMobileFocusPanelFlow(page, {
    trigger: async () => {
      await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectEvent?.());
    },
    openPredicate: (nextState) => nextState.gameState === 'event' && Boolean(nextState.currentEvent),
    openDescription: 'event panel to open',
    artifactName: '02e-event-open',
    closePredicate: (nextState) => nextState.gameState === 'idle' && !nextState.currentEvent,
  });
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
    if (isRunOver(state)) {
      await restartFromRunOver(page, '05-run-over');
      return;
    }
    if (state.gameState !== 'combat') return;

    await sendGameCommand(page, 'attack');
    await delay(900);
  }

  const finalState = await readState(page);
  if (finalState.gameState === 'combat') {
    throw new Error('Combat did not resolve within the expected turn budget');
  }
}

function hasVictorySignal(state) {
  return state.logTail?.some((entry) => (
    typeof entry.text === 'string'
    && (
      entry.text.includes('승리!')
      || entry.text.includes('전투 정리:')
    )
  ));
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
    // Debug logging removed after smoke fix
    if (isRunOver(state)) {
      state = await restartFromRunOver(page, `04-run-over-${attempt + 1}`);
      continue;
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
      state = await waitForState(
        page,
        (nextState) =>
          isRunOver(nextState) ||
          (nextState.gameState !== 'combat' && !nextState.enemy && !nextState.isAiThinking) ||
          hasVictorySignal(nextState),
        'combat resolution to settle'
      );
      if (isRunOver(state)) {
        state = await restartFromRunOver(page, `06-run-over-${attempt + 1}`);
        continue;
      }
      if (!state.enemy && state.mode === 'game' && state.gameState !== 'combat') {
        observations.victory = true;
      }
    }

    if (hasVictorySignal(state)) {
      observations.victory = true;
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
  const current = await readState(page);
  if (isRunOver(current)) {
    await restartFromRunOver(page, '08-tabs-run-over');
  }

  await page.evaluate(() => window.__AETHERIA_TEST_API__?.setSideTab?.('map'));
  const mapState = await waitForState(page, (state) => state.sideTab === 'map', 'map tab activation');
  await writeStateArtifact('08a-map-tab', mapState, page);

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
  logSmoke('start');
  const browser = await launchBrowser();
  let context;
  const errors = [];
  const consoleErrors = [];
  const responseFailures = [];
  const requestFailures = [];

  try {
    context = isMobile
      ? await browser.newContext({
          ...devices['iPhone 13'],
        })
      : await browser.newContext({
          viewport: desktopViewport,
        });

    const page = await context.newPage();
    page.on('pageerror', (error) => {
      errors.push(error.stack || error.message || String(error));
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (text.startsWith('Failed to load resource:')) return;
        consoleErrors.push(text);
      }
    });
    page.on('response', (response) => {
      if (response.status() < 400) return;
      try {
        const url = new URL(response.url());
        if (url.origin !== targetOrigin) return;
        const pathname = url.pathname;
        if (ALLOWED_404_PATHS.has(pathname) && response.status() === 404) return;
        responseFailures.push(`${response.status()} ${pathname}`);
      } catch {
        responseFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('requestfailed', (request) => {
      try {
        const url = new URL(request.url());
        if (url.origin !== targetOrigin) return;
        if (ALLOWED_404_PATHS.has(url.pathname)) return;
        requestFailures.push(`${request.failure()?.errorText || 'REQUEST_FAILED'} ${url.pathname}`);
      } catch {
        requestFailures.push(`${request.failure()?.errorText || 'REQUEST_FAILED'} ${request.url()}`);
      }
    });

    // cycle 65: preview 서버가 미기동이거나 다른 포트에 떠 있을 때 명확한 안내
    // 메시지를 제공한다. 기존에는 ERR_CONNECTION_REFUSED만 보여 디버깅이 느렸음.
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      const msg = error?.message || '';
      if (msg.includes('ERR_CONNECTION_REFUSED') || msg.includes('net::')) {
        throw new Error(
          `${msg}\n\n` +
          `[smoke] preview 서버에 연결할 수 없습니다 (${targetUrl}).\n` +
          `[smoke] 다음 중 하나를 먼저 실행하세요:\n` +
          `[smoke]   - npm run preview -- --port 4173 --host 127.0.0.1 (백그라운드)\n` +
          `[smoke]   - 또는 --url http://localhost:5173 같은 활성 dev/preview URL\n` +
          `[smoke]   - 또는 AETHERIA_SMOKE_URL 환경변수로 다른 포트 지정`
        );
      }
      throw error;
    }
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function', undefined, { timeout: 25000 });
    await waitForState(page, (state) => state.bootStage === 'ready', 'boot stage ready', 25000);

    logSmoke('boot ready');
    await startNewRun(page);
    await verifyMobileFirstFold(page);
    await verifyMobileArchiveConsole(page);
    await verifyShopFlow(page);
    await verifyMobileFocusPanels(page);
    await verifyTerminalStatus(page);
    logSmoke('field ready');
    await moveToForest(page);
    logSmoke('core loop');
    const observations = await driveExploreLoop(page);
    logSmoke('tab verification');
    await verifyTabs(page);

    let finalState = await readState(page);
    if (isRunOver(finalState)) {
      finalState = await restartFromRunOver(page, '09-final-run-over');
    }
    await writeStateArtifact('09-final-state', finalState, page);

    ensure(observations.combat, 'Smoke did not cover combat');
    ensure(observations.victory, 'Smoke did not cover post-combat victory flow');
    ensure(observations.event, 'Smoke did not cover event flow');
    ensure(finalState.mode === 'game' && !isRunOver(finalState), 'Smoke ended outside the main game loop');
    ensure(errors.length === 0, `Page errors detected:\n${errors.join('\n')}`);
    ensure(responseFailures.length === 0, `HTTP failures detected:\n${responseFailures.join('\n')}`);
    ensure(requestFailures.length === 0, `Request failures detected:\n${requestFailures.join('\n')}`);
    ensure(consoleErrors.length === 0, `Console errors detected:\n${consoleErrors.join('\n')}`);

    console.log(`[smoke:${viewportLabel}] ok`);
  } finally {
    if (context) {
      await settleClose(context.close(), 'context.close');
    }
    await settleClose(browser.close(), 'browser.close');
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`[smoke:${viewportLabel}] failed`);
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
