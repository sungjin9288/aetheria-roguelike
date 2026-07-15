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

test('첫 이야기 다음에는 짧은 일반 토벌을 먼저 추천한다', async ({ page }) => {
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());

    await page.getByTestId('control-quests').click();
    await expect(page.getByTestId('quest-board-panel')).toBeVisible({ timeout: 8_000 });

    const firstRecommendation = page.getByTestId('quest-decision-row').first();
    await expect(firstRecommendation).toContainText('토벌 임무');
    await expect(firstRecommendation).toContainText('슬라임 소탕');
    await expect(firstRecommendation).not.toContainText('보스 임무');
    await expect(firstRecommendation).not.toContainText('거미떼 퇴치');
});

test('진행 중인 긴 임무를 손실 확인 후 포기할 수 있다', async ({ page }) => {
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAbandonableQuestScenario?.());

    await page.getByTestId('control-quests').click();
    await expect(page.getByTestId('quest-board-panel')).toBeVisible({ timeout: 8_000 });

    const activeMission = page.getByTestId('quest-active-row').filter({ hasText: '거미떼 퇴치' });
    await expect(activeMission).toContainText('2/10');
    await activeMission.getByTestId('quest-board-abandon-mission').click();
    await expect(activeMission.getByTestId('quest-board-abandon-warning')).toContainText('지금까지의 진행도 2/10이 사라집니다.');

    await activeMission.getByTestId('quest-board-abandon-cancel').click();
    await expect(activeMission).toBeVisible();
    await activeMission.getByTestId('quest-board-abandon-mission').click();
    await activeMission.getByTestId('quest-board-abandon-confirm').click();

    await expect(activeMission).toBeHidden({ timeout: 8_000 });
    await expect.poll(async () => page.evaluate(() => {
        const state = window.render_game_to_text?.();
        return state ? JSON.parse(state).player?.questCount : null;
    })).toBe(0);
});
