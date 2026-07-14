import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 상점 패널 진입 + 구매 사유 표시 (cycle 56).
 *
 * 상점 진입 시 구매 가능/불가 상태가 명확히 표시되어야 한다.
 */
test.describe('Shop panel', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
    });

    test('상점 버튼 노출', async ({ page }) => {
        const shopButton = page.getByTestId('control-market');
        await expect(shopButton).toBeVisible({ timeout: 8_000 });
        await expect(shopButton).toHaveAccessibleName('상점');
    });

    test('상점 진입 → 패널 헤더 또는 구매/판매 토글 노출', async ({ page }) => {
        const shopButton = page.getByTestId('control-market');
        await shopButton.click();
        // ShopPanel 안에 "구매" 또는 "판매" 토글이 있어야 함
        await expect(page.locator('text=/구매|판매|Daily Deals/').first()).toBeVisible({ timeout: 8_000 });
    });
});
