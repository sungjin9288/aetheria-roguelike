import { expect, test, type Page } from '@playwright/test';

const TRUE_ENDING_URL = '/?e2e=1&deviceQa=true-ending-journey';
const PRODUCTION_SAVE_SENTINELS = Object.freeze({
    'aetheria.game.snapshot.v1': 'release-complete-v1-sentinel',
    'aetheria.game.snapshot.v2.primary': 'release-complete-v2-primary-sentinel',
    'aetheria.game.snapshot.v2.staged': 'release-complete-v2-staged-sentinel',
});

const snapshot = (page: Page) => page.evaluate(() => (
    window.__AETHERIA_TEST_API__?.getTrueEndingJourneySnapshot?.()
));

const bootTrueEndingJourney = async (page: Page) => {
    await page.addInitScript((sentinels) => {
        for (const [key, value] of Object.entries(sentinels)) {
            window.localStorage.setItem(key, value);
        }
    }, PRODUCTION_SAVE_SENTINELS);
    await page.goto(TRUE_ENDING_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await snapshot(page))?.enemy?.baseName).toBe('마왕');
};

const clickAttackWithSeed = async (page: Page, seed: number) => {
    const armed = await page.evaluate((value) => (
        window.__AETHERIA_TEST_API__?.armNextCombatSeed?.(value)
    ), seed);
    expect(armed).toBe(true);
    await page.getByTestId('combat-action-attack').click();
};

const dismissLegendaryDropIfPresent = async (page: Page) => {
    const overlay = page.getByTestId('legendary-drop-overlay');
    if (await overlay.isVisible().catch(() => false)) await overlay.click();
};

const defeatDemonKing = async (page: Page) => {
    await clickAttackWithSeed(page, 1);
    await expect.poll(async () => (await snapshot(page))?.enemy?.baseName).toBe('원시의 신');
    await dismissLegendaryDropIfPresent(page);
    const state = await snapshot(page);
    expect(state.gameState).toBe('combat');
    expect(state.primalShards).toBe(0);
    expect(state.demonKingSlain).toBe(4);
    expect(state.trueEndingSeen).toBe(false);
};

const defeatTrueBoss = async (page: Page) => {
    const weakened = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.weakenTrueBossForJourney?.()
    ));
    expect(weakened).toBe(true);
    await expect.poll(async () => (await snapshot(page))?.enemy?.hp).toBe(1);
    await clickAttackWithSeed(page, 2);
    await expect(page.getByTestId('true-ending-screen')).toBeVisible({ timeout: 12_000 });
    const state = await snapshot(page);
    expect(state.gameState).toBe('true_ending');
    expect(state.trueEndingSeen).toBe(true);
    expect(state.primalShards).toBe(0);
    expect(state.heartCount).toBe(1);
    expect(state.endgameReceiptKey).toBeTruthy();
};

const flushJourney = async (page: Page) => {
    await page.evaluate(async () => {
        await window.__AETHERIA_TEST_API__?.flushLocalSave?.();
    });
};

const setSafeArea = (page: Page) => page.evaluate(() => {
    document.documentElement.style.setProperty('--aether-safe-area-top', '47px');
    document.documentElement.style.setProperty('--aether-safe-area-bottom', '34px');
});

const assertTrueEndingGeometry = async (
    page: Page,
    viewport: { width: number; height: number },
) => {
    await setSafeArea(page);
    const screen = page.getByTestId('true-ending-screen');
    const confirm = page.getByTestId('true-ending-confirm');
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport();

    const geometry = await screen.evaluate((root) => {
        const bounds = root.getBoundingClientRect();
        const buttons = [...root.querySelectorAll<HTMLElement>('button')];
        const confirmButton = root.querySelector<HTMLElement>('[data-testid="true-ending-confirm"]');
        const confirmBounds = confirmButton?.getBoundingClientRect();
        const style = getComputedStyle(root);
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            documentWidth: document.documentElement.scrollWidth,
            bounds: {
                top: Math.round(bounds.top),
                bottom: Math.round(bounds.bottom),
                left: Math.round(bounds.left),
                right: Math.round(bounds.right),
            },
            localOverflow: root.scrollWidth - root.clientWidth,
            paddingTop: Number.parseFloat(style.paddingTop),
            paddingBottom: Number.parseFloat(style.paddingBottom),
            minButtonHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
            confirmBounds: confirmBounds ? {
                top: Math.round(confirmBounds.top),
                bottom: Math.round(confirmBounds.bottom),
                left: Math.round(confirmBounds.left),
                right: Math.round(confirmBounds.right),
            } : null,
        };
    });

    expect(geometry.viewport).toEqual(viewport);
    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(geometry.localOverflow).toBeLessThanOrEqual(1);
    expect(geometry.bounds).toEqual({
        top: 0,
        bottom: viewport.height,
        left: 0,
        right: viewport.width,
    });
    expect(geometry.paddingTop).toBeGreaterThanOrEqual(47);
    expect(geometry.paddingBottom).toBeGreaterThanOrEqual(34);
    expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.confirmBounds?.top).toBeGreaterThanOrEqual(0);
    expect(geometry.confirmBounds?.bottom).toBeLessThanOrEqual(viewport.height);
    expect(geometry.confirmBounds?.left).toBeGreaterThanOrEqual(0);
    expect(geometry.confirmBounds?.right).toBeLessThanOrEqual(viewport.width);
};

const assertProductionSavesUntouched = async (page: Page) => {
    const values = await page.evaluate((keys) => Object.fromEntries(
        keys.map((key) => [key, window.localStorage.getItem(key)]),
    ), Object.keys(PRODUCTION_SAVE_SENTINELS));
    expect(values).toEqual(PRODUCTION_SAVE_SENTINELS);
};

test.describe('True Ending → New Game+ production journey', () => {
    test('390x844: production combat, platform back, reload and duplicate confirmation stay atomic', async ({ page }) => {
        const viewport = { width: 390, height: 844 };
        await page.setViewportSize(viewport);
        await bootTrueEndingJourney(page);
        const initial = await snapshot(page);

        await defeatDemonKing(page);
        await flushJourney(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 20_000 });
        await expect.poll(async () => (await snapshot(page))?.enemy?.baseName).toBe('원시의 신');
        const reloadedBoss = await snapshot(page);
        expect(reloadedBoss.primalShards).toBe(0);
        expect(reloadedBoss.classJourney).toEqual(initial.classJourney);
        expect(reloadedBoss.settings).toEqual(initial.settings);

        await defeatTrueBoss(page);
        const endingBeforeReload = await snapshot(page);
        await flushJourney(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('true-ending-screen')).toBeVisible({ timeout: 20_000 });
        const restoredEnding = await snapshot(page);
        expect(restoredEnding.endgameReceiptKey).toBe(endingBeforeReload.endgameReceiptKey);
        expect(restoredEnding.heartIds).toEqual(endingBeforeReload.heartIds);
        expect(restoredEnding.heartCount).toBe(1);
        expect(restoredEnding.classJourney).toEqual(initial.classJourney);
        expect(restoredEnding.settings).toEqual(initial.settings);

        const backHandled = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.triggerPlatformBack?.()
        ));
        expect(backHandled).toBe(true);
        await expect(page.getByTestId('true-ending-screen')).toHaveAttribute('data-reveal-state', 'complete');
        await assertTrueEndingGeometry(page, viewport);

        await page.evaluate(() => {
            const button = document.querySelector<HTMLButtonElement>('[data-testid="true-ending-confirm"]');
            button?.click();
            button?.click();
        });
        await expect(page.getByTestId('true-ending-screen')).toBeHidden({ timeout: 10_000 });
        const ascended = await snapshot(page);
        expect(ascended.gameState).toBe('idle');
        expect(ascended.level).toBe(1);
        expect(ascended.prestigeRank).toBe(4);
        expect(ascended.primalShards).toBe(0);
        expect(ascended.trueEndingSeen).toBe(true);
        expect(ascended.heartCount).toBe(0);
        expect(ascended.endgameReceiptKey).toBe(endingBeforeReload.endgameReceiptKey);
        expect(ascended.classJourney).toEqual(initial.classJourney);
        expect(ascended.settings).toEqual(initial.settings);
        expect(ascended.titles.filter((title: string) => title === ascended.activeTitle)).toHaveLength(1);

        await flushJourney(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect.poll(async () => (await snapshot(page))?.gameState).toBe('idle');
        const finalReload = await snapshot(page);
        expect(finalReload.prestigeRank).toBe(4);
        expect(finalReload.heartCount).toBe(0);
        expect(finalReload.endgameReceiptKey).toBe(endingBeforeReload.endgameReceiptKey);
        expect(finalReload.classJourney).toEqual(initial.classJourney);
        expect(finalReload.settings).toEqual(initial.settings);
        await assertProductionSavesUntouched(page);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/true-ending-new-game-plus-390x844.png',
            fullPage: false,
            animations: 'disabled',
        });
    });

    test('375x667: reduced motion reveals the complete ending without a forced wait', async ({ page }) => {
        const viewport = { width: 375, height: 667 };
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await bootTrueEndingJourney(page);
        await defeatDemonKing(page);
        await defeatTrueBoss(page);

        await expect(page.getByTestId('true-ending-screen')).toHaveAttribute('data-reveal-state', 'complete');
        await expect(page.getByTestId('true-ending-skip')).toBeHidden();
        await assertTrueEndingGeometry(page, viewport);
        await assertProductionSavesUntouched(page);
    });

    test('430x932: first-frame skip exposes a reachable New Game+ action', async ({ page }) => {
        const viewport = { width: 430, height: 932 };
        await page.setViewportSize(viewport);
        await bootTrueEndingJourney(page);
        await defeatDemonKing(page);
        await defeatTrueBoss(page);

        const skip = page.getByTestId('true-ending-skip');
        await expect(skip).toBeVisible();
        await expect(skip).toHaveCSS('min-height', '44px');
        await skip.click();
        await expect(page.getByTestId('true-ending-screen')).toHaveAttribute('data-reveal-state', 'complete');
        await assertTrueEndingGeometry(page, viewport);
        await assertProductionSavesUntouched(page);
    });
});
