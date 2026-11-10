import { test, expect, type Locator, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

// 2026-11 B1 · B6 P1 (명세 docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md §1.6 · §2.5):
//   능력치 탭 '이번 여정의 장' · '돌기둥의 증언' 목록 · 필드 무대 장 칩 — 세 폭에서 넘침 · 잘림 0, 11px 이상.

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

const openStatsTab = async (page: Page) => {
    await page.getByTestId('status-character-chip').click();
    await page.getByTestId('archive-tab-stats').click();
    await expect(page.getByTestId('stats-panel')).toBeVisible({ timeout: 8_000 });
};

for (const width of [375, 390, 430]) {
    test.describe(`Chapter recap · death lore P1 @${width}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            await startE2ERun(page);
        });

        test("능력치 탭 '이번 여정의 장' — 결산 전부, 최신이 먼저", async ({ page }) => {
            expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedChapterRecapScenario?.())).toBe(true);
            await expect(page.getByTestId('expedition-debrief-card')).toBeVisible({ timeout: 8_000 });
            await page.getByTestId('expedition-debrief-close-icon').click();
            await openStatsTab(page);

            const section = page.getByTestId('stats-chapter-recaps');
            await expect(section).toBeVisible();
            await expect(section).toContainText('이번 여정의 장');
            await expect(section).toContainText('결산 3개');
            await section.locator('summary').click();
            const cards = page.getByTestId('stats-chapter-recap-card');
            await expect(cards).toHaveCount(3);
            await expect(cards.nth(0)).toHaveAttribute('data-chapter', '3');
            await expect(cards.nth(2)).toHaveAttribute('data-chapter', '1');
            await expect(section).not.toContainText(/\b(?:LV|Lv|EXP|HP)\b/);

            await expectNoHorizontalOverflow(page);
            expect(await findUndersizedText(section)).toEqual([]);
            expect(await findClippedText(section)).toEqual([]);
            await section.scrollIntoViewIfNeeded();
            await section.screenshot({ path: `playtest-artifacts/expedition-return-flow/stats-chapter-recaps-${width}.png`, animations: 'disabled' });
        });

        test("능력치 탭 '돌기둥의 증언' — 첫 증언 전에는 없고, 들은 줄만 그린다", async ({ page }) => {
            await openStatsTab(page);
            await expect(page.getByTestId('stats-death-lore')).toHaveCount(0);

            expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedDeathLoreLedger?.(3))).toBe(3);
            const section = page.getByTestId('stats-death-lore');
            await expect(section).toBeVisible();
            await expect(page.getByTestId('stats-death-lore-count')).toHaveText(/^3\/\d+$/);
            await section.locator('summary').click();
            await expect(page.getByTestId('stats-death-lore-line')).toHaveCount(3);

            await expectNoHorizontalOverflow(page);
            expect(await findUndersizedText(section)).toEqual([]);
            expect(await findClippedText(section)).toEqual([]);
            await section.scrollIntoViewIfNeeded();
            await section.screenshot({ path: `playtest-artifacts/expedition-return-flow/stats-death-lore-${width}.png`, animations: 'disabled' });
        });

        test('필드 무대의 장 칩 — 첫 원정 지역은 1장, 무대 머리가 잘리지 않는다', async ({ page }) => {
            await page.getByTestId('control-expedition-start').click();
            const chip = page.getByTestId('field-stage-chapter');
            await expect(chip).toHaveText('1장', { timeout: 8_000 });
            const stage = page.getByTestId('field-stage');
            await expectNoHorizontalOverflow(page);
            expect(await findUndersizedText(stage)).toEqual([]);
            expect(await findClippedText(page.getByTestId('field-stage-location'))).toEqual([]);
        });
    });
}
