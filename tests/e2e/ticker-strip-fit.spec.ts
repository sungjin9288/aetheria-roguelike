import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 한 줄 소식 띠는 칸에 남은 높이를 넘지 않는다 — 넘치는 줄은 줄 상자 안에서 스크롤한다.
 *   #238이 띠를 내용 높이(`flex: 0 0 auto`)로 묶은 뒤, 375×568 전투에서 칸이 219px인데 세 줄 소식(142px)이
 *   무대 최소(116px) 아래로 들어가 칸 밖 45px이 조작판 밑에 깔렸다. 띠를 접는 기준(칸 213px)은 92px 띠를 전제로 한 값이다.
 *   줄 상자가 줄어도 첫 줄('내 행동' · 묶음의 첫 줄)은 맨 위에서 보여야 한다 — 가운데 정렬이 넘친 위쪽을 자르면 스크롤로도 닿지 못한다.
 */

type Box = { top: number; bottom: number; height: number; display: string; scrollHeight: number };

const box = (page: Page, selector: string): Promise<Box | null> => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, display: getComputedStyle(el).display, scrollHeight: el.scrollHeight };
}, selector);

const HEIGHTS = [568, 600, 640, 667, 700] as const;

const expectStripFits = async (page: Page, columnSelector: string, stripSelector: string, width: number) => {
    const column = await box(page, columnSelector);
    const strip = await box(page, stripSelector);
    expect(column).not.toBeNull();
    expect(strip).not.toBeNull();
    if (strip!.display === 'none') return; // 칸이 띠를 담지 못해 접은 높이 — 접기 규칙이 맡는다.

    // 띠가 칸 밖(조작판 밑)으로 나가지 않는다.
    expect(strip!.bottom).toBeLessThanOrEqual(column!.bottom + 1);

    const line = await box(page, `${stripSelector} [data-testid="log-ticker"]`);
    const first = await box(page, `${stripSelector} [data-testid="log-ticker-text"]`);
    expect(line).not.toBeNull();
    expect(first).not.toBeNull();
    expect(line!.bottom).toBeLessThanOrEqual(column!.bottom + 1);
    // 첫 줄은 줄 상자 안 맨 위에서 시작한다(넘친 위쪽이 잘리지 않는다).
    expect(first!.top).toBeGreaterThanOrEqual(line!.top);
    // '지난 소식' 단추는 44px 그대로 칸 안에 있다.
    const open = await box(page, `${stripSelector} [data-testid="log-sheet-open"]`);
    expect(open!.height).toBeGreaterThanOrEqual(44);
    expect(open!.height).toBeLessThan(60);
    expect(open!.bottom).toBeLessThanOrEqual(column!.bottom + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
};

for (const height of HEIGHTS) {
    test(`375x${height}: 전투 소식 띠가 칸을 넘지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height });
        await startE2ERun(page);
        expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false))).toBe(true);
        await expect(page.getByTestId('combat-stage')).toBeVisible({ timeout: 8_000 });
        await expectStripFits(page, '[data-testid="combat-stage"]', '.ae-combat-log-strip', 375);
    });

    test(`375x${height}: 필드 소식 띠가 칸을 넘지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height });
        await startE2ERun(page);
        expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAutoExploreScenario?.())).toBe(true);
        await expect(page.getByTestId('field-stage-column')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('log-ticker')).toBeVisible();
        await expectStripFits(page, '[data-testid="field-stage-column"]', '.ae-field-log-strip', 375);
    });
}
