import { test, expect } from '@playwright/test';

test('첫 원정은 연결이 끊겨도 귀환 기록을 표시하고 다시 불러온다', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?deviceQa=toss-first-five');
    await page.getByTestId('intro-start-button').click();
    await expect(page.getByTestId('persistent-status-bar')).toBeVisible();
    await context.setOffline(true);
    try {
        await page.getByTestId('control-expedition-start').click();
        await page.getByTestId('control-explore').click();
        await page.getByTestId('event-choice-1').click();
        await page.getByTestId('control-route-open').click();
        await page.getByTestId('control-route-option-시작의 마을').click();

        const card = page.getByTestId('expedition-debrief-card');
        await expect(card).toBeVisible({ timeout: 8_000 });
        await expect(card).toContainText('원정 귀환');
        await expect(page.getByText('게임 화면을 불러오지 못했습니다')).toHaveCount(0);
        await expect(card).toHaveCSS('opacity', '1');
        await page.screenshot({ path: 'output/playwright/completion-20260907/offline-return-regression.png', scale: 'css' });

        // 읽기만 한다. 생성/탐험/귀환은 위의 실제 UI action을 사용한다.
        const before = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(before.player.loc).toBe('시작의 마을');
        expect(before.player.lastExpeditionSummaryId).toBeTruthy();
        await expect.poll(() => page.evaluate(() => {
            const raw = localStorage.getItem('aetheria.device-qa.toss-first-five.snapshot.v1');
            return raw ? JSON.parse(raw).player?.lastExpeditionSummary?.id : null;
        })).toBe(before.player.lastExpeditionSummaryId);
        await context.setOffline(false);
        await page.reload();
        await expect(card).toBeVisible({ timeout: 10_000 });
        const restored = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(restored.player.loc).toBe(before.player.loc);
        expect(restored.player.lastExpeditionSummaryId).toBe(before.player.lastExpeditionSummaryId);
    } finally {
        await context.setOffline(false);
    }
});
