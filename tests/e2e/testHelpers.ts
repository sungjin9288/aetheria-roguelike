import { expect, type Page } from '@playwright/test';

export const startE2ERun = async (
    page: Page,
    options: { openStatusConsole?: boolean } = {},
) => {
    await page.goto('/?e2e=1');

    const statusBar = page.getByTestId('persistent-status-bar');
    const startButton = page.getByTestId('intro-start-button');

    // Locator.isVisible() is an immediate snapshot. Wait for either persisted
    // game state or the intro start action so cold boot timing does not flake.
    const readyState = await Promise.race([
        statusBar.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'game' as const).catch(() => null),
        startButton.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'intro' as const).catch(() => null),
    ]);

    if (readyState === 'intro') {
        await expect(startButton).toBeEnabled({ timeout: 5_000 });
        await startButton.click();
        await expect(page.getByTestId('intro-name-input')).toBeHidden({ timeout: 15_000 });
    }

    await expect(statusBar).toBeVisible({ timeout: 20_000 });

    if (options.openStatusConsole) {
        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
            await statusChip.click();
        }
    }
};
