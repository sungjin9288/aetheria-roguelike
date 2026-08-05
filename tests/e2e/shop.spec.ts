import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

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
        await openTownFacilities(page);
        const shopButton = page.getByTestId('control-market');
        await expect(shopButton).toBeVisible({ timeout: 8_000 });
        await expect(shopButton).toHaveAccessibleName('상점');
    });

    test('상점 진입 → 패널 헤더 또는 구매/판매 토글 노출', async ({ page }) => {
        await openTownFacilities(page);
        const shopButton = page.getByTestId('control-market');
        await shopButton.click();
        // ShopPanel 안에 "구매" 또는 "판매" 토글이 있어야 함
        await expect(page.locator('text=/마을 상점|구매|판매|오늘의 할인/').first()).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('shop-equipment-disclosure')).toHaveAttribute('data-equipment-view', 'summary');
        await expect(page.getByTestId('shop-equipment-detail-toggle')).toContainText('상세 보기');
    });

    test('같은 구매 버튼을 빠르게 두 번 눌러도 한 번만 결제된다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedEnhanceScenario?.({
            gold: 5_000,
            materialCount: 0,
            weaponEnhance: 0,
        }));
        await openTownFacilities(page);
        await page.getByTestId('control-market').click();

        const buyButton = page.locator('[data-testid="shop-buy-inline"]:not(:disabled)').first();
        await expect(buyButton).toBeVisible({ timeout: 8_000 });
        const row = buyButton.locator('xpath=ancestor::*[@data-testid="shop-buy-item"]');
        const priceText = await row.innerText();
        const priceMatch = priceText.match(/([\d,]+) 골드/);
        expect(priceMatch).not.toBeNull();
        const price = Number(priceMatch?.[1].replaceAll(',', ''));
        const before = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getInvestmentSnapshot?.());

        await buyButton.evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });

        await expect(page.getByText(/^구매 완료 ·/)).toHaveCount(1);
        await expect.poll(async () => (
            page.evaluate(() => window.__AETHERIA_TEST_API__?.getInvestmentSnapshot?.())
        )).toMatchObject({
            gold: before.gold - price,
        });
        const after = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getInvestmentSnapshot?.());
        expect(after.inventory).toHaveLength(before.inventory.length + 1);

        const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(snapshot.logTail.filter((log: { text: string }) => log.text.includes('구매 완료'))).toHaveLength(1);
    });
});
