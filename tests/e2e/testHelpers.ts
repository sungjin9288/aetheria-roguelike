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

    // B-1 (B+ 2026-06): 캐릭터 생성 직후 "시작 부트" 유물 선택 오버레이가 노출된다.
    //   다운스트림 navigation(탭/상점) 진입 전 첫 유물을 골라 오버레이를 해소해야
    //   이후 클릭이 가로채이지 않는다 (smoke startNewRun과 동일).
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
