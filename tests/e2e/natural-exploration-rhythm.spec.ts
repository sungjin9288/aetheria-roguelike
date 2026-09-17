/// <reference types="node" />

import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { devices } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import { startE2ERun } from './testHelpers';
import {
    NATURAL_EXPLORATION_OUTCOMES,
    NATURAL_EXPLORATION_REQUIRED_GATES,
    NATURAL_EXPLORATION_SEEDS,
    NATURAL_EXPLORATION_SOURCE_CONTRACT,
    serializeNaturalExplorationReport,
} from './naturalExplorationReport';

const MOBILE_CONTEXT = {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    userAgent: devices['iPhone 12'].userAgent,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    screen: { width: 390, height: 844 },
    viewport: { width: 390, height: 844 },
};

const REPORT_DEVICE = {
    model: 'iPhone 12',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
};

const MANDATORY_VISIBLE_TEXT = '숲 한가운데에서 이상한 마법 연기가 피어오릅니다. 주변에는 불에 탄 흔적과 지팡이 파편이 있습니다.';
const OPTIONAL_LOCAL_RESOURCE_PATHS = new Set(['/favicon.ico']);

const isOptionalLocalResource = (resourceUrl: string) => {
    try {
        const appUrl = new URL(MOBILE_CONTEXT.baseURL);
        const resource = new URL(resourceUrl, appUrl);
        return resource.origin === appUrl.origin && OPTIONAL_LOCAL_RESOURCE_PATHS.has(resource.pathname);
    } catch {
        return false;
    }
};

type ErrorCollections = {
    page: string[];
    console: string[];
    response: string[];
    request: string[];
};

type JourneyResult = {
    sequence: readonly Record<string, unknown>[];
    gates: Record<string, boolean>;
    errors: ErrorCollections;
    aiProxyRequests: string[];
};

const createErrorCollectors = (page: Page) => {
    const errors: ErrorCollections = {
        page: [],
        console: [],
        response: [],
        request: [],
    };
    const aiProxyRequests: string[] = [];

    page.on('pageerror', (error) => errors.page.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            const location = message.location().url;
            errors.console.push(location ? `${message.text()} @ ${location}` : message.text());
        }
    });
    page.on('response', (response) => {
        if (response.status() >= 400 && !isOptionalLocalResource(response.url())) {
            errors.response.push(`${response.status()} ${response.url()}`);
        }
    });
    page.on('requestfailed', (request) => {
        errors.request.push(`${request.url()} ${request.failure()?.errorText || 'failed'}`);
    });
    page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/ai-proxy') {
            aiProxyRequests.push(`${request.method()} ${request.url()}`);
        }
    });

    return { errors, aiProxyRequests };
};

const assertMobileRuntime = async (page: Page) => {
    const metrics = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
        touch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
    }));

    expect(metrics).toEqual({
        width: 390,
        height: 844,
        dpr: 3,
        touch: true,
        screenWidth: 390,
        screenHeight: 844,
    });
    return true;
};

const armExploreSeed = async (page: Page, seed: number) => {
    const armed = await page.evaluate((nextSeed) => (
        window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(nextSeed)
    ), seed);
    expect(armed).toBe(true);
};

const winCombatThroughVisibleAttacks = async (page: Page) => {
    const attack = page.getByTestId('combat-action-attack');
    await expect(attack).toBeVisible({ timeout: 10_000 });
    let attackCount = 0;

    for (let turn = 0; turn < 40; turn += 1) {
        if (!await attack.isVisible().catch(() => false)) break;
        await expect(attack).toBeEnabled({ timeout: 5_000 });
        await attack.click();
        attackCount += 1;
        await page.waitForTimeout(120);
    }

    await expect(attack).toBeHidden({ timeout: 10_000 });
    const continueButton = page.getByTestId('post-combat-continue');
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
    await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 10_000 });
    return attackCount;
};

const assertBoundedSurface = async (page: Page) => {
    const panel = page.getByTestId('event-panel');
    const choiceList = page.getByTestId('event-choice-list');
    const choices = choiceList.getByRole('button');
    const visual = page.getByTestId('event-location-visual');
    const expected = NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter;

    await expect(panel).toBeVisible({ timeout: 8_000 });
    await expect(panel.getByTestId('event-situation')).toContainText(expected.visibleSituation);
    await expect(panel.getByTestId('event-choice-0')).toContainText(expected.visibleChoices[0]);
    await expect(panel.getByTestId('event-choice-1')).toContainText(expected.visibleChoices[1]);
    await expect(choiceList).toBeVisible();
    await expect(choices).toHaveCount(2);
    await expect(visual).toBeVisible();
    await expect(visual).toHaveAttribute('data-location-visual', 'quiet-forest');
    await expect.poll(() => visual.locator('img').evaluate((image) => (
        image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    ))).toBe(true);

    await page.waitForTimeout(300);
    const metrics = await panel.evaluate((root) => {
        const readableLeaves = [...root.querySelectorAll<HTMLElement>('.font-readable')]
            .filter((element) => element.textContent?.trim())
            .map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        const rootBounds = root.getBoundingClientRect();
        const choiceBounds = [...root.querySelectorAll<HTMLButtonElement>('button[data-testid^="event-choice-"]')]
            .map((choice) => {
                const bounds = choice.getBoundingClientRect();
                const style = getComputedStyle(choice);
                return {
                    height: bounds.height,
                    width: bounds.width,
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                    pointerEvents: style.pointerEvents,
                };
            });
        return {
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            localOverflow: root.scrollWidth - root.clientWidth,
            panel: {
                width: rootBounds.width,
                height: rootBounds.height,
                left: rootBounds.left,
                right: rootBounds.right,
                top: rootBounds.top,
                bottom: rootBounds.bottom,
            },
            choiceBounds,
            readableLeafFont: readableLeaves.some((fontSize) => fontSize >= 11),
            locationVisualLoaded: [...root.querySelectorAll<HTMLImageElement>('img')]
                .some((image) => image.complete && image.naturalWidth > 0),
        };
    });

    expect(metrics.documentOverflow).toBe(0);
    expect(metrics.localOverflow).toBe(0);
    expect(metrics.panel.width).toBeGreaterThan(0);
    expect(metrics.panel.height).toBeGreaterThan(0);
    expect(metrics.panel.left).toBeGreaterThanOrEqual(0);
    expect(metrics.panel.right).toBeLessThanOrEqual(390);
    expect(metrics.panel.top).toBeGreaterThanOrEqual(0);
    expect(metrics.panel.bottom).toBeLessThanOrEqual(844);
    expect(metrics.readableLeafFont).toBe(true);
    expect(metrics.locationVisualLoaded).toBe(true);
    expect(metrics.choiceBounds).toHaveLength(2);
    for (const choice of metrics.choiceBounds) {
        expect(choice.height).toBeGreaterThanOrEqual(72);
        expect(choice.width).toBeGreaterThan(0);
        expect(choice.left).toBeGreaterThanOrEqual(0);
        expect(choice.right).toBeLessThanOrEqual(390);
        expect(choice.top).toBeGreaterThanOrEqual(0);
        expect(choice.bottom).toBeLessThanOrEqual(844);
        expect(choice.pointerEvents).not.toBe('none');
    }

    return {
        documentOverflow: metrics.documentOverflow === 0,
        localOverflow: metrics.localOverflow === 0,
        choiceTouchTargets: metrics.choiceBounds.every((choice) => choice.height >= 72),
        readableLeafFont: metrics.readableLeafFont,
        panelReachable: metrics.panel.width > 0
            && metrics.panel.height > 0
            && metrics.panel.left >= 0
            && metrics.panel.right <= 390
            && metrics.panel.top >= 0
            && metrics.panel.bottom <= 844,
        choicesReachable: metrics.choiceBounds.every((choice) => (
            choice.width > 0
            && choice.left >= 0
            && choice.right <= 390
            && choice.top >= 0
            && choice.bottom <= 844
            && choice.pointerEvents !== 'none'
        )),
        locationVisual: metrics.locationVisualLoaded,
    };
};

const runJourney = async (browser: Browser, testInfo: TestInfo, journeyNumber: number): Promise<JourneyResult> => {
    const context = await browser.newContext(MOBILE_CONTEXT);
    const page = await context.newPage();
    const { errors, aiProxyRequests } = createErrorCollectors(page);

    try {
        const runtimeGate = await startE2ERun(page).then(() => assertMobileRuntime(page));
        await page.getByTestId('control-expedition-start').click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });

        await page.getByTestId('control-explore').click();
        const mandatoryPanel = page.getByTestId('event-panel');
        await expect(mandatoryPanel).toBeVisible({ timeout: 8_000 });
        await expect(mandatoryPanel.getByText(NATURAL_EXPLORATION_SOURCE_CONTRACT.mandatoryEvent.visibleTitle, { exact: true })).toBeVisible();
        await expect(mandatoryPanel.getByTestId('event-situation')).toContainText(MANDATORY_VISIBLE_TEXT);
        const mandatory = {
            kind: 'mandatory_event',
            visibleTitle: NATURAL_EXPLORATION_SOURCE_CONTRACT.mandatoryEvent.visibleTitle,
            visibleText: MANDATORY_VISIBLE_TEXT,
        };
        await page.getByTestId('event-choice-0').click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });

        await armExploreSeed(page, NATURAL_EXPLORATION_SEEDS[0]);
        await page.getByTestId('control-explore').click();
        const attackCount = await winCombatThroughVisibleAttacks(page);
        const combat = {
            kind: 'combat',
            seed: NATURAL_EXPLORATION_SEEDS[0],
            combatSurfaceVisible: attackCount > 0,
            wonThroughVisibleAttacks: attackCount > 0,
        };

        await armExploreSeed(page, NATURAL_EXPLORATION_SEEDS[1]);
        await page.getByTestId('control-explore').click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('event-panel')).toBeHidden();
        await expect(page.getByTestId('combat-action-attack')).toBeHidden();
        const nothing = {
            kind: 'nothing',
            seed: NATURAL_EXPLORATION_SEEDS[1],
            exploreControlVisible: true,
            eventSurfaceVisible: false,
            combatSurfaceVisible: false,
        };

        await armExploreSeed(page, NATURAL_EXPLORATION_SEEDS[2]);
        await page.getByTestId('control-explore').click();
        const boundedSurfaceGates = await assertBoundedSurface(page);
        const bounded = {
            kind: 'bounded_event',
            seed: NATURAL_EXPLORATION_SEEDS[2],
            visibleSituation: NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter.visibleSituation,
            visibleChoices: [...NATURAL_EXPLORATION_SOURCE_CONTRACT.boundedEncounter.visibleChoices],
        };
        const sequence = [mandatory, combat, nothing, bounded];
        const ordinaryActionsBetweenNarratives = sequence
            .slice(1, -1)
            .filter((step) => step.kind === 'combat' || step.kind === 'nothing')
            .length;
        expect(ordinaryActionsBetweenNarratives).toBe(2);
        expect(sequence.map((step) => (
            step.kind === 'mandatory_event' ? 'mandatory_story' : step.kind === 'bounded_event' ? 'bounded_encounter' : step.kind
        ))).toEqual(NATURAL_EXPLORATION_OUTCOMES);

        await page.screenshot({
            path: testInfo.outputPath(`natural-exploration-rhythm-${journeyNumber}.png`),
            fullPage: false,
            animations: 'disabled',
        });

        const gates = {
            freshContext: true,
            runtime: runtimeGate,
            mandatoryEvent: true,
            naturalCombat: combat.combatSurfaceVisible && combat.wonThroughVisibleAttacks,
            naturalNothing: nothing.exploreControlVisible
                && !nothing.eventSurfaceVisible
                && !nothing.combatSurfaceVisible,
            boundedEncounter: true,
            cadence: ordinaryActionsBetweenNarratives === 2,
            ...boundedSurfaceGates,
            pageErrorsEmpty: errors.page.length === 0,
            consoleErrorsEmpty: errors.console.length === 0,
            responseErrorsEmpty: errors.response.length === 0,
            requestErrorsEmpty: errors.request.length === 0,
        };
        expect(Object.keys(gates).sort()).toEqual([...NATURAL_EXPLORATION_REQUIRED_GATES].sort());

        return { sequence, gates, errors, aiProxyRequests };
    } finally {
        await context.close();
    }
};

test('two fresh iPhone 12 journeys prove natural exploration rhythm on the real UI surface', async ({ browser }, testInfo) => {
    test.slow();
    const first = await runJourney(browser, testInfo, 1);
    const second = await runJourney(browser, testInfo, 2);

    expect(first.sequence).toEqual(second.sequence);
    expect(first.gates).toEqual(second.gates);
    expect(first.aiProxyRequests).toEqual([]);
    expect(second.aiProxyRequests).toEqual([]);
    expect(first.errors).toEqual({ page: [], console: [], response: [], request: [] });
    expect(second.errors).toEqual(first.errors);

    const reportInput = {
        sourceContract: NATURAL_EXPLORATION_SOURCE_CONTRACT,
        surfaceObservation: {
            device: REPORT_DEVICE,
            freshContextCount: 2,
            seeds: [...NATURAL_EXPLORATION_SEEDS],
            outcomes: [...NATURAL_EXPLORATION_OUTCOMES],
            ordinaryActionsBetweenNarratives: 2,
            sequence: first.sequence,
        },
        gates: first.gates,
        errors: first.errors,
    };
    const firstReport = serializeNaturalExplorationReport(reportInput);
    const secondReport = serializeNaturalExplorationReport({
        ...reportInput,
        surfaceObservation: {
            ...reportInput.surfaceObservation,
            sequence: second.sequence,
        },
        gates: second.gates,
        errors: second.errors,
    });
    expect(firstReport).toBe(secondReport);
    await writeFile(testInfo.outputPath('natural-exploration-rhythm-1.json'), firstReport, 'utf8');
    await writeFile(testInfo.outputPath('natural-exploration-rhythm-2.json'), secondReport, 'utf8');
});
