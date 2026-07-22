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

    test('초반 장비 후보는 추천·대표 변화·장착·세트 기여를 바로 표시', async ({ page }) => {
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('early-gear-choice'));
        expect(seeded).toBe(true);

        await page.locator('[data-testid$="-tab-inventory"]').first().click();
        await expect(page.getByTestId('inventory-equipment-disclosure')).toHaveAttribute('data-equipment-view', 'summary');

        const decision = page.locator('[data-testid^="inventory-equipment-decision-"]').first();
        await expect(decision).toBeVisible({ timeout: 5_000 });
        await expect(decision).toContainText('추천 교체');
        await expect(decision).toContainText('장착 가능');
        await expect(decision).toContainText('모험가 세트 +2');

        const widthMetrics = await page.evaluate(() => ({
            viewport: window.innerWidth,
            page: document.documentElement.scrollWidth,
            scrollX: window.scrollX,
        }));
        expect(widthMetrics.page).toBeLessThanOrEqual(widthMetrics.viewport);
        expect(widthMetrics.scrollX).toBe(0);

        await page.getByTestId('damage-number').waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
        await decision.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
        await page.evaluate(() => window.scrollTo(0, 0));

        await page.screenshot({
            path: 'playtest-artifacts/mobile-equipment-disclosure/inventory-summary.png',
        });
    });
});
