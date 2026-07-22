import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

test.describe('Town decision hierarchy', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
    });

    test('첫 화면에는 주 행동 하나와 두 개의 자유 행동만 먼저 보인다', async ({ page }) => {
        const primary = page.getByTestId('control-town-primary');
        const quickActions = page.getByTestId('control-town-quick-actions').locator('button');
        const facilities = page.getByTestId('control-town-facilities');

        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_move');
        await expect(primary.getByRole('button')).toContainText('고요한 숲으로 첫 출발');
        await expect(quickActions).toHaveCount(2);
        await expect(page.getByTestId('control-explore')).toBeVisible();
        await expect(page.getByTestId('control-move')).toBeVisible();
        await expect(facilities).not.toHaveAttribute('open', '');
        await expect(page.getByTestId('control-market')).toBeHidden();

        const primaryBounds = await primary.boundingBox();
        expect(primaryBounds).not.toBeNull();
        expect(primaryBounds!.y).toBeGreaterThanOrEqual(0);
        expect(primaryBounds!.y + primaryBounds!.height).toBeLessThanOrEqual(844);

        const pageWidth = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
        }));
        expect(pageWidth.document).toBeLessThanOrEqual(pageWidth.viewport);

        await page.screenshot({
            path: 'playtest-artifacts/mobile-town-hierarchy/first-town.png',
            fullPage: false,
        });
    });

    test('접힌 마을 시설을 열면 기존 기능을 모두 사용할 수 있다', async ({ page }) => {
        await openTownFacilities(page);

        for (const testId of ['control-rest', 'control-quests', 'control-market', 'control-class', 'control-craft']) {
            await expect(page.getByTestId(testId)).toBeVisible();
        }

        await page.screenshot({
            path: 'playtest-artifacts/mobile-town-hierarchy/facilities-open.png',
            fullPage: false,
        });
    });

    test('회복이 필요한 임무 복귀자는 휴식 후 곧바로 재출발 흐름으로 돌아간다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedTownRecoveryScenario?.());

        const primary = page.getByTestId('control-town-primary');
        await expect(primary).toHaveAttribute('data-town-primary-kind', 'rest');
        await expect(page.getByTestId('control-rest')).toContainText('휴식하고 준비');
        await page.getByTestId('control-rest').click();

        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_move');
        await expect(page.getByTestId('control-expedition-start')).toContainText('고요한 숲으로 출발');
    });

    test('진행 중인 임무가 없으면 게시판이 주 행동이 된다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());

        const primary = page.getByTestId('control-town-primary');
        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_quest_board');
        await page.getByTestId('control-quests').click();
        await expect(page.getByTestId('quest-board-panel')).toBeVisible();
    });
});
