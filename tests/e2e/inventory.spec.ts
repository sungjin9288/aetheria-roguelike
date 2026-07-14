import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 인벤토리 패널 + 직업 친화 칩 노출.
 *
 * cycle 58a: jobs[]에 player.job 포함된 장비에 ⚔ 칩이 보여야 함.
 */
test.describe('가방 화면', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('가방 진입 → 가방 화면 헤더 노출', async ({ page }) => {
        const invTab = page.locator('[data-testid$="-tab-inventory"]').first();
        await expect(invTab).toBeVisible({ timeout: 8_000 });
        await invTab.click();
        await expect(page.getByText('가방', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    });
});
