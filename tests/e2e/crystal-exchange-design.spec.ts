import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const openExchange = async (page: Page, balance: number) => {
    await page.evaluate((amount) => window.__AETHERIA_TEST_API__?.seedCrystalExchangeScenario?.(amount), balance);
    await expect(page.getByTestId('open-crystal-exchange')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('open-crystal-exchange').click();
    await expect(page.getByTestId('premium-shop')).toBeVisible();
};

test.describe('에테르 교환소', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('작은 화면에서 상품 변화와 실제 획득처를 읽을 수 있다', async ({ page }) => {
        await openExchange(page, 80);

        await expect(page.getByTestId('crystal-exchange-balance')).toContainText('80');
        await expect(page.getByTestId('crystal-current-state')).toHaveText('25칸');
        await expect(page.getByTestId('crystal-next-state')).toHaveText('30칸');
        await expect(page.getByTestId('crystal-source-list')).toContainText('주간 임무');
        await expect(page.getByTestId('crystal-source-list')).toContainText('5~10개');
        await expect(page.getByTestId('crystal-source-list')).toContainText('모험 도감');
        await expect(page.getByTestId('crystal-source-list')).toContainText('장기 업적');
        await expect(page.getByTestId('crystal-source-list')).toContainText('발견 여정');

        const geometry = await page.getByTestId('premium-shop').evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const buttons = [...root.querySelectorAll<HTMLElement>('button')];
            const footer = root.querySelector<HTMLElement>('[data-testid="crystal-exchange-action-footer"]');

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
            path: 'playtest-artifacts/long-term-progression-audit/crystal-exchange-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('상품 선택은 잔액을 바꾸지 않고 하단 확정에서만 교환한다', async ({ page }) => {
        await openExchange(page, 80);
        const before = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getCrystalExchangeSnapshot?.());

        await page.getByTestId('premium-buy-synth_protect').click();
        await expect(page.getByTestId('crystal-current-state')).toHaveText('2개');
        await expect(page.getByTestId('crystal-next-state')).toHaveText('3개');
        const afterSelection = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getCrystalExchangeSnapshot?.());
        expect(afterSelection).toEqual(before);

        await page.getByTestId('premium-buy-inv_expand').click();
        await page.getByTestId('crystal-exchange-confirm').click();

        await expect(page.getByTestId('crystal-exchange-balance')).toContainText('30');
        await expect(page.getByTestId('crystal-current-state')).toHaveText('30칸');
        await expect(page.getByTestId('crystal-next-state')).toHaveText('35칸');
        const afterExchange = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getCrystalExchangeSnapshot?.());
        expect(afterExchange.premiumCurrency).toBe(30);
        expect(afterExchange.maxInv).toBe(30);
    });

    test('크리스탈이 없어도 획득 목표를 확인할 수 있다', async ({ page }) => {
        await openExchange(page, 0);

        await expect(page.getByTestId('crystal-exchange-balance')).toContainText('0');
        await expect(page.getByTestId('crystal-exchange-confirm')).toBeDisabled();
        await expect(page.getByTestId('crystal-exchange-confirm')).toContainText('크리스탈 50개 부족');
        await expect(page.getByTestId('crystal-source-list')).toBeVisible();
    });

    test('칭호는 선택 후 명시적으로 교환하고 다시 구매할 수 없다', async ({ page }) => {
        await openExchange(page, 180);
        await page.getByTestId('crystal-category-titles').click();
        await page.getByTestId('premium-title-buy-title_stargazer').click();

        const before = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getCrystalExchangeSnapshot?.());
        expect(before.premiumCurrency).toBe(180);
        expect(before.cosmeticTitles).toEqual([]);

        await page.getByTestId('crystal-exchange-confirm').click();
        await expect(page.getByTestId('crystal-exchange-confirm')).toBeDisabled();
        await expect(page.getByTestId('crystal-exchange-confirm')).toContainText('이미 보유한 칭호입니다');

        const after = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getCrystalExchangeSnapshot?.());
        expect(after.premiumCurrency).toBe(80);
        expect(after.cosmeticTitles).toEqual(['title_stargazer']);
        expect(after.titles).toContain('별을 보는 자');
    });
});
