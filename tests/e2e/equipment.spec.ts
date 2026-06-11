import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: GEAR 패널 + 세트 카탈로그 (cycle 58 신규 기능).
 *
 * ?e2e=1로 Firebase 스킵, intro → Dashboard 진입 후 GEAR 검증.
 */
test.describe('Equipment panel', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('GEAR 진입 → affinity 박스 노출', async ({ page }) => {
        const gearTab = page.locator('[data-testid$="-tab-equipment"]').first();
        await gearTab.click();
        await expect(page.getByTestId('job-outfit-affinity')).toBeVisible({ timeout: 8_000 });
    });

    test('GEAR 진입 → 세트 카탈로그 토글 펼침', async ({ page }) => {
        const gearTab = page.locator('[data-testid$="-tab-equipment"]').first();
        await gearTab.click();

        const toggle = page.getByTestId('job-set-catalog-toggle');
        await expect(toggle).toBeVisible({ timeout: 8_000 });
        await toggle.click();

        const anyCatalogItem = page.locator('[data-testid^="set-catalog-item-"]').first();
        await expect(anyCatalogItem).toBeVisible({ timeout: 5_000 });
    });
});
