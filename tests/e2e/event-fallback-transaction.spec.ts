import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const readState = (page: Page) => (
    page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'))
);

// 2026-10 Wave 62 C18: 내기는 운이다 — 미리보기는 판돈 · 지급액 · 승률을 말하고, 결과는 굴린 뒤에 정해진다(승률 50%).
const WAGER_PREVIEW = '판돈 골드 500 · 이기면 골드 1000 · 승률 50% · 결과는 굴린 뒤에 드러남';

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
        await expect(preview).toContainText(WAGER_PREVIEW);
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
        await expect(preview).toContainText(WAGER_PREVIEW);
        await choice.click();

        await expect(panel).toBeHidden();
        state = await readState(page);
        // 한 번만 정산한다 — 이기면 판돈 500을 내고 1000을 받고(1000), 지면 판돈만 잃는다(0). 결과 줄은 그 판의 것 하나다.
        expect([0, 1_000]).toContain(state.player.gold);
        expect(state.currentEvent).toBeNull();
        const resultText = state.player.gold === 1_000 ? '골드 1000' : '골드 -500';
        expect(state.logTail.filter((entry: { text: string }) => entry.text.includes(resultText)).length).toBe(1);
    });
});
