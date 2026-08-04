import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('계승과 다음 여정 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.());
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });
    });

    test('영구 성장과 다음 세계의 변화를 결정 버튼과 함께 보여준다', async ({ page }) => {
        const screen = page.getByTestId('ascension-screen');

        await expect(screen).toContainText('다음 여정으로 계승');
        await expect(screen).toContainText('심연의 탐험가');
        await expect(page.getByTestId('ascension-current-unlock')).toContainText('심연의 메아리');
        await expect(page.getByTestId('ascension-permanent-growth')).toContainText('+180');
        await expect(page.getByTestId('ascension-permanent-growth')).toContainText('+380');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+10%');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+15%');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+16%');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+24%');
        await expect(page.getByTestId('ascension-preserved-summary')).toContainText('도감');
        await expect(page.getByTestId('ascension-reset-summary')).toContainText('장비와 가방');
        await expect(page.getByTestId('ascension-cancel')).toBeVisible();
        await expect(page.getByTestId('ascension-confirm')).toBeVisible();

        const geometry = await screen.evaluate((root) => {
            const scrollRegion = root.querySelector<HTMLElement>('[data-testid="ascension-scroll-region"]');
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            const buttons = [...root.querySelectorAll<HTMLElement>('button')];
            const buttonHeights = buttons.map((node) => node.getBoundingClientRect().height);
            const visibleButtons = buttons.every((node) => {
                const bounds = node.getBoundingClientRect();
                return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
            });

            return {
                bounds: root.getBoundingClientRect().toJSON(),
                minFont: Math.min(...fontSizes),
                minButtonHeight: Math.min(...buttonHeights),
                visibleButtons,
                scrollOverflow: scrollRegion ? getComputedStyle(scrollRegion).overflowY : null,
                horizontalOverflow: root.scrollWidth - root.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        expect(geometry.bounds.top).toBe(0);
        expect(geometry.bounds.bottom).toBeGreaterThanOrEqual(843);
        expect(geometry.bounds.bottom).toBeLessThanOrEqual(844);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(48);
        expect(geometry.visibleButtons).toBe(true);
        expect(geometry.scrollOverflow).toBe('auto');
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/ascension-journey-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('계승을 미루면 현재 여정과 성장 상태를 그대로 유지한다', async ({ page }) => {
        const before = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.());

        await page.getByTestId('ascension-cancel').click();
        await expect(page.getByTestId('ascension-screen')).toBeHidden();

        const after = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.());
        expect(after.gameState).toBe('idle');
        expect(after.level).toBe(before.level);
        expect(after.prestigeRank).toBe(before.prestigeRank);
        expect(after.essence).toBe(before.essence);
        expect(after.inventoryCount).toBe(before.inventoryCount);
        expect(after.relicCount).toBe(before.relicCount);
    });

    test('계승을 확정하면 표시된 영구 성장만 남기고 새 여정을 시작한다', async ({ page }) => {
        await page.getByTestId('ascension-confirm').click();
        await expect(page.getByTestId('ascension-screen')).toBeHidden();

        const after = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.());
        expect(after.gameState).toBe('idle');
        expect(after.name).toBe('리베아');
        expect(after.level).toBe(1);
        expect(after.prestigeRank).toBe(3);
        expect(after.essence).toBe(380);
        expect(after.bonusAtk).toBe(15);
        expect(after.bonusHp).toBe(75);
        expect(after.bonusMp).toBe(45);
        expect(after.relicCount).toBe(0);
        expect(after.inventoryIds).not.toContain('ascension-smoke-blade');
        expect(after.inventoryIds).not.toContain('ascension-smoke-potion');
    });
});
