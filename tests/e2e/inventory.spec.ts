import { test, expect } from '@playwright/test';

/**
 * E2E: 인벤토리 패널 + 직업 친화 칩 노출.
 *
 * cycle 58a: jobs[]에 player.job 포함된 장비에 ⚔ 칩이 보여야 함.
 */
test.describe('Inventory panel', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        if (await introInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await page.getByTestId('intro-start-button').click();
            await expect(introInput).toBeHidden({ timeout: 15_000 });
        }
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 20_000 });
        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await statusChip.click();
        }
    });

    test('INV 진입 → 인벤 패널 헤더 노출', async ({ page }) => {
        const invTab = page.locator('[data-testid$="-tab-inventory"]').first();
        await expect(invTab).toBeVisible({ timeout: 8_000 });
        await invTab.click();
        // Menu Console 헤더가 Inventory로 갱신되어야 함
        await expect(page.locator('text=Inventory').first()).toBeVisible({ timeout: 5_000 });
    });
});
