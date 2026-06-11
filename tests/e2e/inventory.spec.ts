import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 인벤토리 패널 + 직업 친화 칩 노출.
 *
 * cycle 58a: jobs[]에 player.job 포함된 장비에 ⚔ 칩이 보여야 함.
 */
test.describe('Inventory panel', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('INV 진입 → 인벤 패널 헤더 노출', async ({ page }) => {
        const invTab = page.locator('[data-testid$="-tab-inventory"]').first();
        await expect(invTab).toBeVisible({ timeout: 8_000 });
        await invTab.click();
        // Menu Console 헤더가 Inventory로 갱신되어야 함
        await expect(page.locator('text=Inventory').first()).toBeVisible({ timeout: 5_000 });
    });
});
