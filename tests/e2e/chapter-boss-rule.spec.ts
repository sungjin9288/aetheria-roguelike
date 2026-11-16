import { test, expect } from '@playwright/test';
import { startE2ERun, waitForModeTransition } from './testHelpers';

/**
 * 2026-11 B5 장 보스 규칙 — 장 보스와 싸우는 동안 전투 화면에 규칙 칩이 있고(규칙만 말한다, Wave 88), 규칙이 막은 행동
 * (마왕의 영역 = 도주)은 전투를 끝내지 않는다. 세 폭에서 칩이 화면 안이고 글자가 11px 이상이다(Wave 133).
 */
for (const width of [375, 390, 430]) {
    test(`장 보스 규칙 칩 · 도주 거부 — ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await startE2ERun(page);
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedChapterBossRuleScenario?.('마왕', '마왕성'));
        expect(seeded).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
        await waitForModeTransition(page);

        const chip = page.getByTestId('combat-chapter-rule-chip');
        await expect(chip).toBeVisible();
        await expect(chip).toHaveText('규칙 「마왕의 영역」 도주할 수 없다');
        await expect(chip).not.toContainText(/하세요|추천|권장/);

        const box = await chip.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        const fontSize = await chip.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
        expect(fontSize).toBeGreaterThanOrEqual(11);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        await page.getByTestId('combat-action-escape').click();
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible();
        await expect(chip).toBeVisible();
    });
}

test('규칙 없는 보스에는 규칙 칩이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedBossChargeScenario?.('고대 호수의 수호신', '신성한 호수', 0));
    expect(seeded).toBe(true);
    await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
    await waitForModeTransition(page);
    await expect(page.getByTestId('combat-chapter-rule-chip')).toHaveCount(0);
});
