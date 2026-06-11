import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: STAT 탭 진입.
 */
test.describe('Stats panel', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('STAT 탭 진입 → 기본 스탯 노출', async ({ page }) => {
        const statTab = page.locator('[data-testid$="-tab-stats"]').first();
        await expect(statTab).toBeVisible({ timeout: 8_000 });
        await statTab.click();
        // ATK, DEF, HP 등 핵심 스탯 표시
        await expect(page.locator('text=/ATK|DEF|레벨|Stats/').first()).toBeVisible({ timeout: 5_000 });
    });
});
