import { expect, test, type Locator, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 마을 시설 에테르 유리(2026-10 wave 3) — 임무 게시판 · 제작소 · 교환소 · 거울.
 * 렌더 계약(tests/town-facilities-design.test.js)이 단추 위계를 잡고, 여기서는 실제 화면의 크기 · 배치를 잰다.
 *   - 금빛 주 행동은 화면마다 하나, 조작은 44px, 가로 넘침 없음(375 · 430)
 *   - 교환소 · 거울은 1024px 이상에서 가운데 시트(폭 ≤ 640, 둥근 모서리), 휴대폰에서는 한 화면 가득
 */

const measurePanel = (panel: Locator) => panel.evaluate((root) => {
    const buttons = [...root.querySelectorAll<HTMLElement>('button')].filter((node) => node.offsetParent !== null);
    const leaves = [...root.querySelectorAll<HTMLElement>('*')]
        .filter((node) => node.children.length === 0 && (node.textContent || '').trim() && node.offsetParent !== null);
    return {
        primaryCount: root.querySelectorAll('[data-variant="primary"]').length,
        minButtonHeight: Math.min(...buttons.map((node) => node.getBoundingClientRect().height)),
        minFont: Math.min(...leaves.map((node) => parseFloat(getComputedStyle(node).fontSize))),
        horizontalOverflow: root.scrollWidth - root.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
    };
});

const expectTidyPanel = async (panel: Locator, maxPrimary = 1) => {
    const metrics = await measurePanel(panel);
    expect(metrics.primaryCount).toBeLessThanOrEqual(maxPrimary);
    expect(metrics.minButtonHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.minFont).toBeGreaterThanOrEqual(11);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    return metrics;
};

const sheetGeometry = (page: Page, testId: string) => page.getByTestId(testId).evaluate((section) => {
    const rect = section.getBoundingClientRect();
    return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        radius: parseFloat(getComputedStyle(section).borderTopLeftRadius),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    };
});

for (const width of [375, 430]) {
    test.describe(`마을 시설 유리 · ${width}px`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            await startE2ERun(page);
        });

        test('임무 게시판: 금빛 주 행동은 첫 추천 임무 하나 · 임무 카드는 호박빛 유리', async ({ page }) => {
            await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());
            await page.getByTestId('control-quests').click();
            const panel = page.getByTestId('quest-board-panel');
            await expect(panel).toBeVisible({ timeout: 8_000 });

            const metrics = await expectTidyPanel(panel);
            expect(metrics.primaryCount).toBe(1);
            await expect(page.getByTestId('quest-board-start-operation').first()).toHaveAttribute('data-variant', 'primary');
            await expect(page.getByTestId('quest-decision-row').first()).toHaveClass(/\bae-town-mission\b/);
        });

        test('제작소: 제작 방식 전환은 눌림 상태가 바뀌는 44px 단추다', async ({ page }) => {
            await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedBagCraftingScenario?.());
            const panel = page.getByTestId('crafting-panel');
            await expect(panel).toBeVisible({ timeout: 8_000 });
            await expect(page.getByTestId('crafting-mode-craft')).toHaveAttribute('aria-pressed', 'true');
            await expectTidyPanel(panel, 0);

            await page.getByTestId('crafting-mode-synth').click();
            await expect(page.getByTestId('crafting-mode-synth')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByTestId('crafting-mode-craft')).toHaveAttribute('aria-pressed', 'false');
            await expect(page.getByTestId('crafting-synthesize-action')).toHaveAttribute('data-variant', 'primary');
            await expectTidyPanel(panel, 1);

            await page.getByTestId('crafting-mode-bag').click();
            await expect(page.getByTestId('bag-craft-action')).toHaveAttribute('data-variant', 'glass');
            await expectTidyPanel(panel, 0);
        });
    });
}

test.describe('교환소 · 거울 시트', () => {
    for (const { label, seed, opener, sheet } of [
        { label: '교환소', seed: 'crystal', opener: 'open-crystal-exchange', sheet: 'premium-shop' },
        { label: '거울', seed: 'mirror', opener: 'open-mirror-panel', sheet: 'mirror-panel' },
    ]) {
        test(`${label}: 1280px에서는 가운데 둥근 시트, 390px에서는 한 화면 가득`, async ({ page }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await startE2ERun(page, { openStatusConsole: true });
            await page.evaluate((kind) => (kind === 'crystal'
                ? window.__AETHERIA_TEST_API__?.seedCrystalExchangeScenario?.(80)
                : window.__AETHERIA_TEST_API__?.seedMirrorJourneyScenario?.()), seed);
            await expect(page.getByTestId(opener)).toBeVisible({ timeout: 8_000 });
            await page.getByTestId(opener).click();
            await expect(page.getByTestId(sheet)).toBeVisible();

            const phone = await sheetGeometry(page, sheet);
            expect(phone.top).toBe(0);
            expect(phone.bottom).toBeGreaterThanOrEqual(843);
            expect(phone.radius).toBe(0);
            await expectTidyPanel(page.getByTestId(sheet));

            await page.setViewportSize({ width: 1280, height: 800 });
            await expect.poll(async () => (await sheetGeometry(page, sheet)).width).toBeLessThanOrEqual(640);
            const desk = await sheetGeometry(page, sheet);
            expect(Math.abs((desk.left + desk.right) / 2 - desk.viewportWidth / 2)).toBeLessThanOrEqual(2);
            expect(desk.top).toBeGreaterThanOrEqual(16);
            expect(desk.bottom).toBeLessThanOrEqual(desk.viewportHeight - 16);
            expect(desk.radius).toBeGreaterThan(0);
        });
    }
});
