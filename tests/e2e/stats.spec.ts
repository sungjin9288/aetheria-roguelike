import { test, expect } from '@playwright/test';

/**
 * E2E: STAT 탭 진입.
 */
test.describe('Stats panel', () => {
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

    test('STAT 탭 진입 → 기본 스탯 노출', async ({ page }) => {
        const statTab = page.locator('[data-testid$="-tab-stats"]').first();
        await expect(statTab).toBeVisible({ timeout: 8_000 });
        await statTab.click();
        // ATK, DEF, HP 등 핵심 스탯 표시
        await expect(page.locator('text=/ATK|DEF|레벨|Stats/').first()).toBeVisible({ timeout: 5_000 });
    });
});
