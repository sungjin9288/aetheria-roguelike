import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test('오늘의 임무 보상과 완성된 유물이 모바일 기록에 함께 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const seeded = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedDailyMissionRewardScenario?.()
    ));
    expect(seeded).toBe(true);

    const terminal = page.getByTestId('terminal-panel');
    const rewardRows = terminal.locator('[data-log-type="success"]');
    await expect(rewardRows.filter({ hasText: '오늘의 임무 완료 · 유물 파편 +1' })).toBeVisible();

    await expect.poll(async () => (
        page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').logTail?.slice(-2))
    )).toEqual([
            expect.objectContaining({ text: '오늘의 임무 완료 · 유물 파편 +1' }),
            expect.objectContaining({ text: expect.stringMatching(/^유물 파편 완성 · .+ 획득$/) }),
    ]);

    const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    const completedRelicLog = snapshot.logTail.at(-1).text;
    const completedRelicRow = rewardRows.filter({ hasText: completedRelicLog });
    await expect(completedRelicRow).toBeVisible();
    await expect.poll(() => completedRelicRow.evaluate((row) => getComputedStyle(row).opacity)).toBe('1');

    await page.screenshot({
        path: 'playtest-artifacts/mobile/daily-mission-reward.png',
        fullPage: false,
    });
});
