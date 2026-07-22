import { test, expect, type Locator } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => (
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    ));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [{ text: element.textContent?.trim() || '', fontSize }] : [];
}));

test.describe('Expedition return debrief', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionDebriefScenario?.());
    });

    test('첫 귀환 요약을 읽고 닫은 뒤 마을에서 다시 연다', async ({ page }) => {
        const debrief = page.getByTestId('expedition-debrief-card');
        await expect(debrief).toBeVisible({ timeout: 8_000 });
        await expect(debrief).toContainText('원정 귀환');
        await expect(debrief).toContainText('고요한 숲 · 11분');
        await expect(debrief).toContainText('전투');
        await expect(debrief).toContainText('4회');
        await expect(debrief).toContainText('+185');
        await expect(page.getByTestId('expedition-debrief-items')).toContainText('초급 회복 물약 x2');
        await expect(page.getByTestId('expedition-debrief-quests')).toContainText('첫 숲길 조사');

        const bounds = await debrief.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

        const widths = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
        }));
        expect(widths.document).toBeLessThanOrEqual(widths.viewport);
        expect(await findUndersizedText(debrief)).toEqual([]);

        await page.screenshot({
            path: 'playtest-artifacts/expedition-debrief/mobile-return.png',
            fullPage: false,
        });

        await page.getByTestId('expedition-debrief-close').click();
        await expect(debrief).toBeHidden();

        const history = page.getByTestId('control-last-expedition');
        await expect(history).toBeVisible();
        await expect(history).toContainText('지난 원정 · 고요한 숲');
        await expect(history).toContainText('전투 4 · 탐험 6 · +185 EXP');
        expect(await findUndersizedText(history)).toEqual([]);

        await history.click();
        await expect(debrief).toBeVisible();
    });
});
