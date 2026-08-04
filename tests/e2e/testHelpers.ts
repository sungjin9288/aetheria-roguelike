import { expect, type Page } from '@playwright/test';

export const startE2ERun = async (
    page: Page,
    options: { openStatusConsole?: boolean } = {},
) => {
    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });

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

    // 이전 플레이 기록을 불러온 재도전은 시작 유물 선택을 제공할 수 있다.
    // 일반 E2E가 후속 화면을 검증할 수 있도록 있을 때만 선택을 끝낸다.
    const bootRelic = page.getByTestId('relic-choice-0');
    if (await bootRelic.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        await bootRelic.click();
        await expect(bootRelic).toBeHidden({ timeout: 10_000 });
    }

    if (options.openStatusConsole) {
        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
            await statusChip.click();
        }
    }
};

export const openTownFacilities = async (page: Page) => {
    const facilities = page.getByTestId('control-town-facilities');
    await expect(facilities).toBeVisible({ timeout: 8_000 });
    if (await facilities.getAttribute('open') === null) {
        await facilities.locator('summary').click();
    }
    await expect(facilities).toHaveAttribute('open', '');
};
