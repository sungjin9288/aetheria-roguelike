import { test, expect, type Page } from '@playwright/test';
import { startE2ERun, waitForModeTransition } from './testHelpers';

/**
 * 2026-11 H4 행동 조합 — 전투 화면은 지금 걸린 조합 조건 하나를 칩으로 보이고(엔진 판정 그대로), 행동을 권하지 않는다(Wave 88).
 * 세 폭에서 칩이 화면 안이고 글자가 11px 이상이며 가로 넘침이 없다(Wave 133). 절멸자 칩이 뜬 적은 실제 일반 공격 한 번에 쓰러진다.
 */

const seed = (page: Page, effect: string, options: { enemyHpRatio?: number; beatCount?: number }) =>
    page.evaluate(([e, o]) => window.__AETHERIA_TEST_API__?.seedBehaviorComboScenario?.(e, o), [effect, options] as const);

const expectChipFits = async (page: Page, testId: string, width: number) => {
    const chip = page.getByTestId(testId);
    await expect(chip).toBeVisible();
    await expect(chip).not.toContainText(/하세요|추천|권장/);
    const box = await chip.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    const fontSize = await chip.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(11);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
};

for (const width of [375, 390, 430]) {
    test(`행동 조합 칩 — 절멸자 마무리 · 셋째 박자 세는 수 — ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await startE2ERun(page);

        expect(await seed(page, 'third_beat', { beatCount: 1 })).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
        await waitForModeTransition(page);
        await expect(page.getByTestId('combat-signal-behavior-third_beat')).toHaveText('셋째 박자 1/3');
        await expectChipFits(page, 'combat-signal-behavior-third_beat', width);

        // 대조: 절멸자 없이 같은 생명의 적은 일반 공격 한 번에 쓰러지지 않는다.
        expect(await seed(page, 'third_beat', { enemyHpRatio: 0.3 })).toBe(true);
        await page.getByTestId('combat-action-attack').click();
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible();
        await expect(page.getByTestId('post-combat-card')).toHaveCount(0);

        expect(await seed(page, 'finisher', { enemyHpRatio: 0.3 })).toBe(true);
        await expect(page.getByTestId('combat-signal-behavior-finisher')).toHaveText('절멸자 · 일반 공격 마무리');
        await expectChipFits(page, 'combat-signal-behavior-finisher', width);

        await page.getByTestId('combat-action-attack').click();
        await expect(page.getByTestId('post-combat-card')).toBeVisible({ timeout: 8_000 });
    });
}
