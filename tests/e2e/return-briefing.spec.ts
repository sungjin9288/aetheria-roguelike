import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test('복귀 브리핑은 현재 목표와 받을 보상을 보여주고 임무 화면으로 이어진다', async ({ page }) => {
    await startE2ERun(page);

    await page.evaluate(() => {
        (window as any).__AETHERIA_TEST_API__.showReturnBriefingScenario();
    });

    const briefing = page.getByTestId('return-briefing-card');
    await expect(briefing).toBeVisible({ timeout: 8_000 });
    await expect(briefing).toContainText('오늘의 진행');
    await expect(briefing).toContainText('0/3 완료');
    await expect(briefing).toContainText('받을 임무 보상');
    await expect(briefing).toContainText('2건');

    const geometry = await briefing.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);

    await page.screenshot({ path: 'playtest-artifacts/mobile/return-briefing-current-goals.png' });
    await page.getByTestId('return-briefing-primary').click();

    await expect(briefing).toBeHidden();
    await expect(page.getByTestId('archive-tab-quest')).toHaveAttribute('data-active', 'true');
    await expect(page.getByText('오늘의 임무', { exact: true })).toBeVisible({ timeout: 8_000 });
});
