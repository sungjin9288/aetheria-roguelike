import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test('마을의 완료 임무 트래커에서 보상을 바로 수령한다', async ({ page }) => {
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedClaimableQuestScenario?.());

    const claimButton = page.getByTestId('control-claim-quest-reward');
    await expect(claimButton).toBeVisible({ timeout: 8_000 });
    await expect(claimButton).toBeEnabled();
    await expect(claimButton).toContainText('보상 받기');
    await claimButton.click();

    await expect(claimButton).toBeHidden({ timeout: 8_000 });
    await expect.poll(async () => page.evaluate(() => {
        const state = window.render_game_to_text?.();
        if (!state) return null;
        const parsed = JSON.parse(state);
        return {
            exp: parsed.player?.exp,
            gold: parsed.player?.gold,
            questCount: parsed.player?.questCount,
        };
    })).toEqual({ exp: 50, gold: 300, questCount: 0 });
});
