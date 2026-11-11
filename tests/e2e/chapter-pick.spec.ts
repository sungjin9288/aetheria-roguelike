import { test, expect, type Locator, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

// 2026-11 H3 장 경계 3택 (실행 스케치 docs/EXECUTION_SKETCH_H2_H3_2026-11.md §3.3 커밋 2):
//   장에 들어선 대기 상태 → 가장 낮은 받을 장의 카드 셋 → 고르고 확정 → 다음 장 → 넘기기 → 화면이 내려간다.
//   세 폭에서 넘침 · 잘림 0, 11px 이상. 받은 장은 저장되어 리로드 뒤 다시 뜨지 않는다.

const SAVE_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [{ text: element.textContent?.trim() || '', fontSize }] : [];
}));

const findClippedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    if (!(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const hasOwnText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
    if (!hasOwnText) return [];
    const style = getComputedStyle(element);
    const clipsX = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible';
    const clipsY = element.scrollHeight > element.clientHeight + 1 && style.overflowY !== 'visible';
    const ellipsis = style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1;
    return clipsX || clipsY || ellipsis ? [element.textContent?.trim() || ''] : [];
}));

const expectNoHorizontalOverflow = async (page: Page) => {
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
};

for (const width of [375, 390, 430]) {
    test.describe(`Chapter pick @${width}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            await startE2ERun(page);
        });

        test('카드 셋 → 고르고 확정 → 다음 장 → 넘기기', async ({ page }) => {
            expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedChapterPickScenario?.(5))).toBe(true);
            const panel = page.getByTestId('chapter-pick-panel');
            await expect(panel).toBeVisible({ timeout: 8_000 });
            await expect(panel).toHaveAttribute('data-chapter', '4');
            await expect(page.getByTestId('chapter-pick-card-relic')).toBeVisible();
            await expect(page.getByTestId('chapter-pick-card-prefix')).toBeVisible();
            await expect(page.getByTestId('chapter-pick-card-enhance')).toBeVisible();
            await expect(page.getByTestId('chapter-pick-confirm')).toBeDisabled();

            await expectNoHorizontalOverflow(page);
            expect(await findUndersizedText(panel)).toEqual([]);
            expect(await findClippedText(panel)).toEqual([]);
            await panel.screenshot({ path: `playtest-artifacts/chapter-pick/chapter-pick-${width}.png`, animations: 'disabled' });

            await page.getByTestId('chapter-pick-card-enhance').click();
            await expect(page.getByTestId('chapter-pick-card-enhance')).toHaveAttribute('aria-pressed', 'true');
            await page.getByTestId('chapter-pick-confirm').click();

            await expect(panel).toHaveAttribute('data-chapter', '5', { timeout: 8_000 });
            await expect(page.getByTestId('chapter-pick-confirm')).toBeDisabled();
            const weaponEnhance = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.weaponEnhance);
            expect(weaponEnhance).toBe(2);

            await page.getByTestId('chapter-pick-skip').click();
            await expect(panel).toHaveCount(0);
        });
    });
}

test('받은 장은 저장되어 리로드 뒤 다시 뜨지 않는다', async ({ page }) => {
    await page.goto('/?e2e=1&deviceQa=system-settings');
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.level), { timeout: 20_000 }).toBe(18);
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedChapterPickScenario?.(4))).toBe(true);
    await expect(page.getByTestId('chapter-pick-panel')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('chapter-pick-skip').click();
    await expect(page.getByTestId('chapter-pick-panel')).toHaveCount(0);

    await expect.poll(() => page.evaluate((key) => (
        JSON.parse(localStorage.getItem(key) || '{}').player?.stats?.currentRun?.chapterPicks ?? []
    ), SAVE_KEY)).toEqual([4]);

    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.level), { timeout: 20_000 }).toBe(18);
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('chapter-pick-panel')).toHaveCount(0);
});
