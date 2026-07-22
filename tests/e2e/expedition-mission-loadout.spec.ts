import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const readPlayer = (page: any) => page.evaluate(() => {
    const state = window.render_game_to_text?.();
    return state ? JSON.parse(state).player : null;
});

test('마을에서 고른 원정 임무 3개가 출정 snapshot, 필드 tracker, Map에 동일하게 유지된다', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionMissionLoadoutScenario?.());

    await page.getByTestId('control-edit-expedition-focus').click();
    const board = page.getByTestId('quest-board-panel');
    await expect(board).toBeVisible({ timeout: 8_000 });
    await expect(board).toContainText('3/3');

    const selectedRow = page.getByTestId('quest-active-row').filter({ hasText: '멧돼지 사냥' });
    const replacementRow = page.getByTestId('quest-active-row').filter({ hasText: '광산의 위협' });
    await expect(selectedRow.getByTestId('quest-board-toggle-expedition-focus')).toHaveAttribute('data-focus-selected', 'true');
    await expect(replacementRow.getByTestId('quest-board-toggle-expedition-focus')).toBeDisabled();

    await selectedRow.getByTestId('quest-board-toggle-expedition-focus').click();
    await expect(replacementRow.getByTestId('quest-board-toggle-expedition-focus')).toBeEnabled();
    await replacementRow.getByTestId('quest-board-toggle-expedition-focus').click();
    await expect(board).toContainText('3/3');
    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 5_000 });
    await page.screenshot({ path: 'playtest-artifacts/expedition-mission-loadout/quest-board.png' });

    await page.getByTestId('quest-board-close').click();
    const preparation = page.getByTestId('control-expedition-prep');
    await expect(preparation.getByTestId('control-expedition-focus-list')).toContainText('첫 번째 여정');
    await expect(preparation.getByTestId('control-expedition-focus-list')).toContainText('슬라임 소탕');
    await expect(preparation.getByTestId('control-expedition-focus-list')).toContainText('광산의 위협');
    await expect(preparation.getByTestId('control-expedition-focus-list')).not.toContainText('멧돼지 사냥');
    await page.screenshot({ path: 'playtest-artifacts/expedition-mission-loadout/expedition-prep.png' });

    await page.getByTestId('control-expedition-start').click();
    await expect.poll(() => readPlayer(page)).toMatchObject({
        loc: '고요한 숲',
        expeditionFocusQuestIds: [80, 1, 3],
        activeExpeditionFocusQuestIds: [80, 1, 3],
    });

    const tracker = page.getByTestId('control-mission-tracker');
    await expect(tracker).toContainText('이번 원정 · 3/3');
    await expect(tracker.getByTestId('control-expedition-focus-list')).toContainText('광산의 위협');
    await page.screenshot({ path: 'playtest-artifacts/expedition-mission-loadout/field-tracker.png' });

    await page.getByTestId('control-map-open').click();
    const map = page.getByTestId('map-navigator');
    await expect(map).toBeVisible();
    await expect(map.locator('[aria-label*="임무 경로"]').first()).toBeVisible();
    await page.screenshot({ path: 'playtest-artifacts/expedition-mission-loadout/map.png' });
});
