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
    })).toEqual({ exp: 40, gold: 300, questCount: 0 });
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

test('모바일 게시판 첫 화면에 추천 임무 3개의 핵심 판단 정보가 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());

    await page.getByTestId('control-quests').click();
    const featuredList = page.getByTestId('quest-featured-list');
    await expect(featuredList).toBeVisible({ timeout: 8_000 });
    const rows = featuredList.getByTestId('quest-decision-row');
    await expect(rows).toHaveCount(3);

    for (let index = 0; index < 3; index += 1) {
        const row = rows.nth(index);
        await expect(row).toContainText('목적지');
        await expect(row).toContainText('위험');
        await expect(row).toContainText('보상');
        await expect(row.getByTestId('quest-board-start-operation')).toBeVisible();
        const bounds = await row.boundingBox();
        expect(bounds, `recommendation ${index + 1} should have geometry`).not.toBeNull();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    }

    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
    await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
    await page.screenshot({
        path: 'playtest-artifacts/mobile-quest-expedition/quest-board-compact.png',
        fullPage: false,
    });
});

test('추천 임무 수락 후 하나의 출발 버튼으로 목적 권역에 진입한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());

    await page.getByTestId('control-quests').click();
    const firstRecommendation = page.getByTestId('quest-featured-list').getByTestId('quest-decision-row').first();
    await expect(firstRecommendation).toContainText('슬라임 소탕');
    await firstRecommendation.getByTestId('quest-board-start-operation').click();

    const preparation = page.getByTestId('control-expedition-prep');
    await expect(preparation).toBeVisible({ timeout: 8_000 });
    await expect(preparation).toContainText('슬라임 소탕');
    await expect(preparation).toContainText('고요한 숲');
    await expect(preparation).toContainText('자원');
    await expect(preparation).toContainText('장비');
    await expect(preparation).toContainText('귀환 기준');

    const startButton = page.getByTestId('control-expedition-start');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();
    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
    await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
    await page.screenshot({
        path: 'playtest-artifacts/mobile-quest-expedition/expedition-prep.png',
        fullPage: false,
    });
    await startButton.click();

    await expect.poll(async () => page.evaluate(() => {
        const state = window.render_game_to_text?.();
        return state ? JSON.parse(state).player?.loc : null;
    })).toBe('고요한 숲');
});
