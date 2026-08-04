import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('시즌 여정 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSeasonJourneyScenario?.());
        await expect(page.getByTestId('season-journey-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('현재 진행과 가까운 보상을 먼저 보여주고 전체 여정은 세 구간으로 접는다', async ({ page }) => {
        const panel = page.getByTestId('season-journey-panel');
        await page.getByTestId('mobile-archive-console-content').evaluate((node) => { node.scrollTop = 0; });

        await expect(panel).toContainText('다음 단계까지 150');
        await expect(panel).toContainText('성장하는 방법');
        await expect(page.locator('[data-testid^="season-next-reward-"]')).toHaveCount(3);
        await expect(page.locator('[data-testid^="season-chapter-"]')).toHaveCount(3);
        await expect(panel).not.toContainText(/SEASON PASS|PREMIUM|FREE|추후 업데이트 예정/);

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            const buttonHeights = [...root.querySelectorAll<HTMLElement>('button')]
                .map((node) => node.getBoundingClientRect().height)
                .filter((height) => height > 0);
            const summaryHeights = [...root.querySelectorAll<HTMLElement>('summary')]
                .map((node) => node.getBoundingClientRect().height)
                .filter((height) => height > 0);

            return {
                panelHeight: root.getBoundingClientRect().height,
                minFont: Math.min(...fontSizes),
                minButtonHeight: Math.min(...buttonHeights),
                minSummaryHeight: Math.min(...summaryHeights),
                openChapterCount: root.querySelectorAll('details[open]').length,
                nestedScrollCount: root.querySelectorAll('.custom-scrollbar').length,
                horizontalOverflow: root.scrollWidth - root.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        expect(geometry.panelHeight).toBeLessThan(1_200);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.minSummaryHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.openChapterCount).toBe(0);
        expect(geometry.nestedScrollCount).toBe(0);
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/season-redesign-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('필요한 구간만 열어 열 단계 보상을 확인할 수 있다', async ({ page }) => {
        const chapter = page.getByTestId('season-chapter-opening');
        await chapter.locator('summary').click();

        await expect(chapter).toHaveAttribute('open', '');
        await expect(chapter.locator('[data-testid^="season-tier-"]')).toHaveCount(10);
        await expect(page.locator('details[open]')).toHaveCount(1);
        await expect(page.getByTestId('season-tier-10')).toContainText('칭호 시즌 선구자');
    });

    test('해금된 보상은 명시적으로 받은 뒤 한 번만 지급된다', async ({ page }) => {
        const claim = page.getByTestId('season-claim-3');
        const goldBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);

        await claim.click();

        await expect(claim).toBeHidden();
        await expect(page.getByTestId('season-chapter-opening')).toContainText('수령 3/10');
        const goldAfter = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldAfter).toBe(goldBefore + 800);
    });
});
