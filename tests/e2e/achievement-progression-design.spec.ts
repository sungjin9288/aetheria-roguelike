import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('업적 성장 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.getByTestId('archive-tab-achievements').click();
        await expect(page.getByTestId('achievement-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('가까운 목표와 다섯 업적 분야가 첫 화면 흐름에 노출된다', async ({ page }) => {
        const panel = page.getByTestId('achievement-panel');
        const archiveContent = page.getByTestId('mobile-archive-console-content');
        await archiveContent.evaluate((node) => { node.scrollTop = 0; });

        await expect(page.locator('[data-testid^="achievement-next-goal-"]')).toHaveCount(3);
        await expect(page.locator('[data-testid^="achievement-category-"]')).toHaveCount(5);
        await expect(page.locator('[data-testid^="achievement-journey-"]')).toHaveCount(5);
        await expect(panel).toContainText('다음 목표');
        await expect(panel).toContainText('업적 여정');
        await expect(panel).not.toContainText(/Achievement Ledger|Unlocked|Locked Records|Claimed|Reward/);

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            const categoryBounds = [...root.querySelectorAll<HTMLElement>('[data-testid^="achievement-category-"]')]
                .map((node) => node.getBoundingClientRect());
            const rootBounds = root.getBoundingClientRect();
            const buttonHeights = [...root.querySelectorAll<HTMLElement>('button')]
                .map((node) => node.getBoundingClientRect().height)
                .filter((height) => height > 0);

            return {
                panelHeight: rootBounds.height,
                minFont: Math.min(...fontSizes),
                minButtonHeight: Math.min(...buttonHeights),
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                allCategoriesInside: categoryBounds.every((rect) => (
                    rect.left >= rootBounds.left - 1 && rect.right <= rootBounds.right + 1
                )),
                openJourneyCount: root.querySelectorAll('details[open]').length,
            };
        });

        expect(geometry.panelHeight).toBeLessThan(1_200);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.allCategoriesInside).toBe(true);
        expect(geometry.openJourneyCount).toBe(0);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/achievements-redesign-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('분야를 바꾸고 필요한 여정의 전체 단계만 펼쳐 볼 수 있다', async ({ page }) => {
        await page.getByTestId('achievement-category-collection').click();
        await expect(page.locator('[data-testid^="achievement-journey-"]')).toHaveCount(4);
        await expect(page.getByTestId('achievement-journey-crafts')).toBeVisible();
        await expect(page.getByTestId('achievement-journey-signaturesDiscovered')).toBeVisible();

        await page.getByTestId('achievement-journey-crafts').locator('summary').click();
        await expect(page.getByTestId('achievement-milestone-ach_craft_5')).toBeVisible();
        await expect(page.getByTestId('achievement-milestone-ach_craft_100')).toBeVisible();
        await expect(page.locator('details[open]')).toHaveCount(1);
    });

    test('달성한 업적 보상은 명시적 받기 뒤에만 지급된다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());
        const claim = page.getByTestId('achievement-claim-ach_first_blood');
        await expect(claim).toBeVisible({ timeout: 8_000 });

        await page.getByTestId('mobile-archive-console-content').evaluate((node) => { node.scrollTop = 0; });
        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/achievements-claimable-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });

        const goldBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        await claim.click();

        await expect(claim).toBeHidden();
        await expect(page.getByTestId('achievement-summary')).toContainText('보상 수령 1/73');
        const goldAfter = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldAfter).toBe(goldBefore + 50);
    });
});
