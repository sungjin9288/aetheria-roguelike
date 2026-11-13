import { test, expect } from '@playwright/test';
import { startE2ERun, waitForModeTransition } from './testHelpers';

/**
 * 2026-11 H5 충전 강타 — 보스가 강타를 모은 동안 전투 화면의 의도 칩은 충전 강타 이름 · 끊기까지 남은 피해 · 예상 피해를 보이고,
 * 권하는 문구가 없다(Wave 88). 세 폭에서 칩이 화면 안이고 글자가 11px 이상이다(Wave 133).
 */
for (const width of [375, 390, 430]) {
    test(`충전 강타 예고 칩 — ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await startE2ERun(page);
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedBossChargeScenario?.('고대 호수의 수호신', '신성한 호수', 100));
        expect(seeded).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
        await waitForModeTransition(page);

        const intent = page.getByTestId('enemy-intent');
        await expect(intent).toBeVisible();
        await expect(intent).toHaveAttribute('data-intent-kind', 'charge');
        // 고대 호수의 수호신 생명 3200 × 15% = 480, 이미 100을 깎았다.
        await expect(page.getByTestId('enemy-intent-label')).toHaveText('대해일 — 다음 행동 · 끊기까지 피해 380');
        await expect(page.getByTestId('enemy-intent-hit')).toBeVisible();
        await expect(intent).not.toContainText(/하세요|추천|권장/);

        const box = await intent.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        const fontSize = await page.getByTestId('enemy-intent-label').evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
        expect(fontSize).toBeGreaterThanOrEqual(11);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
}
