import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('유해 회수 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedGraveRecoveryScenario?.());
        await expect(page.getByTestId('grave-recovery-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('현재 위치의 유해와 다음 회수 목적지를 먼저 보여준다', async ({ page }) => {
        const panel = page.getByTestId('grave-recovery-panel');
        const currentRecovery = page.getByTestId('grave-recovery-시작의 마을');
        const nextRecovery = page.getByTestId('grave-recovery-고요한 숲');

        await expect(panel).toContainText('회수 지역');
        await expect(panel).toContainText('96');
        await expect(currentRecovery).toHaveAttribute('data-current-location', 'true');
        await expect(currentRecovery).toContainText('여행자의 반지');
        await expect(nextRecovery).toContainText('숲길 사냥활');
        await expect(nextRecovery).toContainText('초급 회복 물약');

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            const buttonHeights = [...root.querySelectorAll<HTMLElement>('button')]
                .map((node) => node.getBoundingClientRect().height)
                .filter((height) => height > 0);

            return {
                minFont: Math.min(...fontSizes),
                minButtonHeight: Math.min(...buttonHeights),
                horizontalOverflow: root.scrollWidth - root.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/grave-recovery-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('현재 위치 유해를 회수하고 남은 목적지는 지도에서 이어 본다', async ({ page }) => {
        const goldBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);

        await page.getByTestId('grave-recover-here').click();

        await expect(page.getByTestId('grave-recovery-시작의 마을')).toBeHidden();
        await expect(page.getByTestId('grave-recovery-고요한 숲')).toBeVisible();
        const goldAfter = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldAfter).toBe(goldBefore + 24);

        await page.getByTestId('grave-open-map-고요한 숲').click();
        await expect(page.getByTestId('map-navigator')).toBeVisible({ timeout: 8_000 });
    });

    test('server authority가 없는 다른 모험가 침입은 노출하거나 요청하지 않는다', async ({ page }) => {
        const publicGraveRequests: string[] = [];
        page.on('request', (request) => {
            if (/\/public\/data\/graves|graves/i.test(request.url())) {
                publicGraveRequests.push(request.url());
            }
        });

        await expect(page.getByTestId('grave-view-public')).toHaveCount(0);
        await expect(page.getByTestId('grave-public-view')).toHaveCount(0);
        await expect(page.getByTestId('grave-mine-view')).toBeVisible();
        await page.waitForTimeout(250);
        expect(publicGraveRequests).toEqual([]);
    });
});
