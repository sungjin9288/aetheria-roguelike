import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 2026-11 화면 B안 뒤 낮은 화면의 필드 무대(혼돈의 심연) — 무대 그림이 접히면 한 줄 소식 띠가 칸을 채운다.
 *   #238이 띠를 내용 높이(`flex: 0 0 auto`)로 묶은 뒤, 그림을 접는 높이(칸 185px 이하)에서 그 자리가 비어 있었다
 *   (375×667 · 390×664에서 띠 아래 50 ~ 80px). 그림이 보이는 높이에서는 띠가 내용 높이 그대로다.
 */

const LOW = [
    { width: 375, height: 667 },
    { width: 390, height: 664 },
] as const;

const box = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, display: getComputedStyle(el).display };
});

const seedAbyssField = async (page: Page) => {
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAutoExploreScenario?.())).toBe(true);
    await expect(page.getByTestId('field-stage-column')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('log-ticker')).toBeVisible();
};

for (const viewport of LOW) {
    test(`${viewport.width}x${viewport.height}: 무대 그림이 접히면 소식 띠가 칸을 채운다`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await startE2ERun(page);
        await seedAbyssField(page);

        const column = await box(page, '[data-testid="field-stage-column"]');
        const slot = await box(page, '.ae-field-stage-slot');
        const strip = await box(page, '.ae-field-log-strip');
        const line = await box(page, '[data-testid="log-ticker"]');

        // 이 높이에서는 그림을 접는다(칸 185px 이하) — 접히지 않으면 이 스펙이 재는 경우가 아니다.
        expect(column.height).toBeLessThanOrEqual(185);
        expect(slot.display).toBe('none');
        // 띠 · 줄 상자가 칸의 바닥까지 닿는다(빈 칸 없음).
        expect(Math.abs(strip.bottom - column.bottom)).toBeLessThanOrEqual(1);
        expect(Math.abs(line.bottom - column.bottom)).toBeLessThanOrEqual(1);
        // '지난 소식' 단추는 늘어나지 않고 44px 그대로다.
        const open = await box(page, '[data-testid="log-sheet-open"]');
        expect(open.height).toBeGreaterThanOrEqual(44);
        expect(open.height).toBeLessThan(60);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
}

test('390x844: 무대 그림이 보이면 소식 띠는 내용 높이 그대로다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await seedAbyssField(page);

    const slot = await box(page, '.ae-field-stage-slot');
    const strip = await box(page, '.ae-field-log-strip');
    expect(slot.display).toBe('flex');
    expect(slot.height).toBeGreaterThanOrEqual(88);
    expect(strip.height).toBeLessThan(100);
});
