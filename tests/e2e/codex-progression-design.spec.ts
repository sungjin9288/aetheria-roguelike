import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('도감 수집 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.getByTestId('archive-tab-codex').click();
        await expect(page.getByTestId('codex-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('가까운 수집 목표와 다섯 분류가 첫 흐름에 노출된다', async ({ page }) => {
        const panel = page.getByTestId('codex-panel');
        await page.getByTestId('mobile-archive-console-content').evaluate((node) => { node.scrollTop = 0; });

        await expect(page.locator('[data-testid^="codex-next-goal-"]')).toHaveCount(3);
        await expect(page.locator('[data-testid^="codex-tab-"]')).toHaveCount(5);
        await expect(panel).toContainText('다음 수집 목표');
        await expect(panel).not.toContainText(/EQUIP|MONSTER|RECIPE|MATERIAL|LEGEND/);

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            const buttonHeights = [...root.querySelectorAll<HTMLElement>('button')]
                .map((node) => node.getBoundingClientRect().height)
                .filter((height) => height > 0);
            const categoryBounds = [...root.querySelectorAll<HTMLElement>('[data-testid^="codex-tab-"]')]
                .map((node) => node.getBoundingClientRect());
            const rootBounds = root.getBoundingClientRect();

            return {
                panelHeight: rootBounds.height,
                minFont: Math.min(...fontSizes),
                minButtonHeight: Math.min(...buttonHeights),
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                allCategoriesInside: categoryBounds.every((rect) => (
                    rect.left >= rootBounds.left - 1 && rect.right <= rootBounds.right + 1
                )),
                openEquipmentTierCount: root.querySelectorAll('[data-testid^="codex-equipment-tier-"][open]').length,
                nestedScrollCount: root.querySelectorAll('.custom-scrollbar').length,
            };
        });

        expect(geometry.panelHeight).toBeLessThan(1_500);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.allCategoriesInside).toBe(true);
        expect(geometry.openEquipmentTierCount).toBe(0);
        expect(geometry.nestedScrollCount).toBe(0);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/codex-redesign-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('미발견 기록은 수로 요약하고 필요한 분류만 펼쳐 본다', async ({ page }) => {
        await page.getByTestId('codex-tab-monster').click();
        await expect(page.getByTestId('codex-monster-research-goals')).toBeVisible();
        await expect(page.getByTestId('codex-monster-undiscovered')).toHaveCount(1);
        await expect(page.getByTestId('codex-monsters').locator('button')).toHaveCount(0);

        await page.getByTestId('codex-tab-recipe').click();
        await expect(page.getByTestId('codex-recipe-undiscovered')).toContainText('미발견 제작법 60개');

        await page.getByTestId('codex-tab-material').click();
        await expect(page.getByTestId('codex-material-undiscovered')).toContainText('미발견 소재 56개');

        await page.getByTestId('codex-tab-legend').click();
        await expect(page.getByTestId('legendary-codex-empty-hint')).toBeVisible();
        await expect(page.getByTestId('legendary-codex-collection')).not.toHaveAttribute('open', '');
    });

    test('장비 단계는 필요할 때 선택해 펼쳐 본다', async ({ page }) => {
        const tiers = page.locator('[data-testid^="codex-equipment-tier-"]');
        expect(await tiers.count()).toBeGreaterThan(1);
        await expect(page.locator('[data-testid^="codex-equipment-tier-"][open]')).toHaveCount(0);

        const secondTier = page.getByTestId('codex-equipment-tier-2');
        await secondTier.locator('summary').click();
        await expect(secondTier).toHaveAttribute('open', '');
    });
});
