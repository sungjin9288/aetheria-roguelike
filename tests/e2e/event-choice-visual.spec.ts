import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('Event choice location continuity', () => {
    test('선택지를 밀지 않고 현재 지역 일러스트를 남는 공간에 보여 준다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);

        await page.getByTestId('control-expedition-start').click();
        await expect(page.getByTestId('terminal-location-visual')).toHaveAttribute(
            'data-location-visual',
            'quiet-forest',
        );

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectEvent?.());
        const panel = page.getByTestId('event-panel');
        const visual = page.getByTestId('event-location-visual');
        const firstChoice = page.getByTestId('event-choice-0');

        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(visual).toHaveAttribute('data-location-visual', 'quiet-forest');
        await expect.poll(() => visual.locator('img').evaluate((image) => (
            image instanceof HTMLImageElement
            && image.complete
            && image.naturalWidth === 96
            && image.naturalHeight === 96
        ))).toBe(true);

        const [panelBounds, visualBounds, choiceBounds] = await Promise.all([
            panel.boundingBox(),
            visual.boundingBox(),
            firstChoice.boundingBox(),
        ]);
        expect(panelBounds).not.toBeNull();
        expect(visualBounds).not.toBeNull();
        expect(choiceBounds).not.toBeNull();
        expect(choiceBounds!.height).toBeGreaterThanOrEqual(72);
        expect(choiceBounds!.y + choiceBounds!.height).toBeLessThanOrEqual(844);
        expect(visualBounds!.x).toBeGreaterThanOrEqual(panelBounds!.x);
        expect(visualBounds!.x + visualBounds!.width).toBeLessThanOrEqual(panelBounds!.x + panelBounds!.width);
        expect(visualBounds!.y).toBeGreaterThanOrEqual(choiceBounds!.y + choiceBounds!.height);
        await expect.poll(async () => {
            const [settledPanel, settledVisual] = await Promise.all([
                panel.boundingBox(),
                visual.boundingBox(),
            ]);
            if (!settledPanel || !settledVisual) return false;
            return settledVisual.y + settledVisual.height <= settledPanel.y + settledPanel.height + 0.5;
        }).toBe(true);

        await page.evaluate(() => document.fonts.ready);
        await expect.poll(() => panel.evaluate((viewport) => ({
            hasVerticalOverflow: viewport.scrollHeight > viewport.clientHeight + 1,
            overflowX: getComputedStyle(viewport).overflowX,
        }))).toEqual({
            hasVerticalOverflow: false,
            overflowX: 'hidden',
        });

        await page.screenshot({
            path: 'playtest-artifacts/mobile-event-choice/event-location-390x844.png',
            fullPage: false,
        });
    });
});
