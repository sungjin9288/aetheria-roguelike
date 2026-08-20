import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const readState = (page: Page) => (
    page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'))
);

test.describe('structured fallback event transaction', () => {
    test('390x844에서 실제 비용을 먼저 보여 주고 현재 보유 자원으로 한 번만 정산한다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);

        expect(await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedFallbackWagerScenario?.('insufficient')
        ))).toBe(true);

        const panel = page.getByTestId('event-panel');
        const choice = page.getByTestId('event-choice-0');
        const preview = page.getByTestId('event-choice-preview-0');
        await expect(panel).toBeVisible();
        await expect(preview).toContainText('골드 500 소모 · 1000 획득 · 순증가 500');
        await expect(choice).toBeInViewport();

        await choice.click();
        await expect(panel).toBeVisible();
        let state = await readState(page);
        expect(state.player.gold).toBe(499);
        expect(state.currentEvent?.desc).toContain('골드 500');
        expect(state.logTail.filter((entry: { text: string }) => entry.text.includes('골드가 부족')).length).toBe(1);

        await choice.click();
        state = await readState(page);
        expect(state.player.gold).toBe(499);
        expect(state.logTail.filter((entry: { text: string }) => entry.text.includes('골드가 부족')).length).toBe(1);

        expect(await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedFallbackWagerScenario?.('boundary')
        ))).toBe(true);
        await expect(preview).toContainText('골드 500 소모 · 1000 획득 · 순증가 500');
        await choice.click();

        await expect(panel).toBeHidden();
        state = await readState(page);
        expect(state.player.gold).toBe(1_000);
        expect(state.currentEvent).toBeNull();
        expect(state.logTail.filter((entry: { text: string }) => entry.text.includes('골드 1000')).length).toBe(1);
    });
});
