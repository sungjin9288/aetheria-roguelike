import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('에테르 거울 영구 성장', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedMirrorJourneyScenario?.());
        await expect(page.getByTestId('open-mirror-panel')).toBeVisible({ timeout: 8_000 });
        await page.getByTestId('open-mirror-panel').click();
        await expect(page.getByTestId('mirror-panel')).toBeVisible();
    });

    test('네 성장 경로와 투자 전후 효과를 작은 화면에서 읽을 수 있다', async ({ page }) => {
        const panel = page.getByTestId('mirror-panel');

        await expect(panel).toContainText('새 여정에도 남는 성장');
        await expect(page.getByTestId('mirror-completion')).toHaveText('2/13 단계');
        for (const pathId of ['departure', 'exploration', 'survival', 'legacy']) {
            await expect(page.getByTestId(`mirror-path-${pathId}`)).toBeVisible();
        }
        await expect(page.getByTestId('mirror-current-effect')).toHaveText('시작 골드 +100');
        await expect(page.getByTestId('mirror-next-effect')).toHaveText('시작 골드 +200');
        await expect(page.getByTestId('mirror-confirm')).toContainText('유산의 금고 2단계 투자');

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const buttons = [...root.querySelectorAll<HTMLElement>('button')];
            const footer = root.querySelector<HTMLElement>('[data-testid="mirror-action-footer"]');

            return {
                bounds: root.getBoundingClientRect().toJSON(),
                minFont: Math.min(...leaves.map((node) => parseFloat(getComputedStyle(node).fontSize))),
                minButtonHeight: Math.min(...buttons.map((node) => node.getBoundingClientRect().height)),
                footerBottom: footer?.getBoundingClientRect().bottom || 0,
                horizontalOverflow: root.scrollWidth - root.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        expect(geometry.bounds.top).toBe(0);
        expect(geometry.bounds.bottom).toBeGreaterThanOrEqual(843);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.footerBottom).toBeLessThanOrEqual(844);
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/mirror-journey-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('성장 선택은 미리보기만 바꾸고 고정 버튼을 눌러야 정수가 사용된다', async ({ page }) => {
        const before = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getMirrorSnapshot?.());

        await page.getByTestId('mirror-node-select-start_boot_extra').click();
        await expect(page.getByTestId('mirror-next-effect')).toHaveText('첫 유물 선택 +1');
        const afterSelection = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getMirrorSnapshot?.());
        expect(afterSelection).toEqual(before);

        await page.getByTestId('mirror-node-select-start_gold').click();
        await page.getByTestId('mirror-confirm').click();

        await expect(page.getByTestId('mirror-current-effect')).toHaveText('시작 골드 +200');
        await expect(page.getByTestId('mirror-confirm')).toContainText('계승 정수 140 부족');
        const afterPurchase = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getMirrorSnapshot?.());
        expect(afterPurchase.essence).toBe(100);
        expect(afterPurchase.mirror.start_gold).toBe(2);
        expect(afterPurchase.mirror.campfire_rate).toBe(1);
    });
});
