import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

test.describe('Town decision hierarchy', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
    });

    test('첫 화면은 원정 준비와 실제 결과가 있는 마을 행동만 먼저 보인다', async ({ page }) => {
        const primary = page.getByTestId('control-town-primary');
        const quickActions = page.getByTestId('control-town-quick-actions').locator('button');
        const facilities = page.getByTestId('control-town-facilities');

        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_move');
        await expect(primary.getByRole('button')).toContainText('고요한 숲으로 첫 출발');
        await expect(quickActions).toHaveCount(1);
        await expect(page.getByTestId('control-explore')).toHaveCount(0);
        await expect(page.getByTestId('control-move')).toBeVisible();
        await expect(page.getByTestId('mobile-console-open-archive')).toBeVisible();
        await expect(facilities).not.toHaveAttribute('open', '');
        await expect(page.getByTestId('control-market')).toBeHidden();

        const primaryBounds = await primary.boundingBox();
        expect(primaryBounds).not.toBeNull();
        expect(primaryBounds!.y).toBeGreaterThanOrEqual(0);
        expect(primaryBounds!.y + primaryBounds!.height).toBeLessThanOrEqual(844);

        const archive = page.getByTestId('mobile-console-open-archive');
        const readiness = page.getByTestId('control-expedition-prep').getByText('출발 가능', { exact: true });
        const [archiveBounds, readinessBounds] = await Promise.all([
            archive.boundingBox(),
            readiness.boundingBox(),
        ]);
        expect(archiveBounds).not.toBeNull();
        expect(readinessBounds).not.toBeNull();
        expect(Math.abs(archiveBounds!.y - readinessBounds!.y)).toBeLessThan(16);
        expect(await archive.evaluate((node) => node.closest('[data-testid="control-expedition-prep"]') !== null)).toBe(true);

        const terminalBounds = await page.getByTestId('terminal-panel').boundingBox();
        expect(terminalBounds).not.toBeNull();
        expect(terminalBounds!.height).toBeGreaterThanOrEqual(280);

        const locationVisual = page.getByTestId('terminal-location-visual');
        await expect(locationVisual).toHaveAttribute('data-location-visual', 'start-village');
        await expect.poll(() => locationVisual.locator('img').evaluate((image) => (
            image instanceof HTMLImageElement
            && image.complete
            && image.naturalWidth === 96
            && image.naturalHeight === 96
        ))).toBe(true);
        const locationBounds = await locationVisual.boundingBox();
        expect(locationBounds).not.toBeNull();
        expect(locationBounds!.x).toBeGreaterThanOrEqual(terminalBounds!.x);
        expect(locationBounds!.x + locationBounds!.width).toBeLessThanOrEqual(terminalBounds!.x + terminalBounds!.width);
        expect(locationBounds!.y + locationBounds!.height).toBeLessThanOrEqual(terminalBounds!.y + terminalBounds!.height);
        const terminalScroll = await page.getByTestId('terminal-panel').locator('.custom-scrollbar').evaluate((viewport) => ({
            clientHeight: viewport.clientHeight,
            scrollHeight: viewport.scrollHeight,
        }));
        expect(terminalScroll.scrollHeight).toBeLessThanOrEqual(terminalScroll.clientHeight + 1);

        const pageWidth = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
        }));
        expect(pageWidth.document).toBeLessThanOrEqual(pageWidth.viewport);

        await page.screenshot({
            path: 'playtest-artifacts/mobile-town-hierarchy/first-town.png',
            fullPage: false,
        });

        await page.getByTestId('control-expedition-start').click();
        await expect(locationVisual).toHaveAttribute('data-location-visual', 'quiet-forest');
        await expect(locationVisual.locator('img')).toHaveAttribute('src', '/assets/locations/quiet-forest.png');
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

    test('전투 중에는 지역 장식보다 교전 정보가 우선한다', async ({ page }) => {
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
        expect(seeded).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('terminal-location-visual')).toHaveCount(0);
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
