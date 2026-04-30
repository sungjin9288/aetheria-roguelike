import { test, expect } from '@playwright/test';

/**
 * E2E: Shop 패널 진입 + 구매 사유 표시 (cycle 56).
 *
 * SHOP 진입 시 구매 가능/불가 상태가 명확히 표시되어야 함.
 */
test.describe('Shop panel', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        if (await introInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await page.getByTestId('intro-start-button').click();
            await expect(introInput).toBeHidden({ timeout: 15_000 });
        }
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 20_000 });
    });

    test('SHOP 버튼 노출', async ({ page }) => {
        // 하단 ControlPanel의 SHOP 버튼은 시작의 마을(safe zone)에서 노출
        const shopButton = page.getByRole('button', { name: /SHOP/i }).first();
        await expect(shopButton).toBeVisible({ timeout: 8_000 });
    });

    test('SHOP 진입 → 패널 헤더 또는 구매/판매 토글 노출', async ({ page }) => {
        const shopButton = page.getByRole('button', { name: /SHOP/i }).first();
        await shopButton.click();
        // ShopPanel 안에 "구매" 또는 "판매" 토글이 있어야 함
        await expect(page.locator('text=/구매|판매|Daily Deals/').first()).toBeVisible({ timeout: 8_000 });
    });
});
