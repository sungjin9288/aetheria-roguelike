import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 한 줄 소식 띠는 칸에 남은 높이를 넘지 않는다 — 넘치는 줄은 줄 상자 안에서 스크롤한다.
 *   #238이 띠를 내용 높이(`flex: 0 0 auto`)로 묶은 뒤, 375×568 전투에서 칸이 219px인데 세 줄 소식(142px)이
 *   무대 최소(116px) 아래로 들어가 칸 밖 45px이 조작판 밑에 깔렸다.
 *   줄 상자가 줄어도 첫 줄('내 행동' · 묶음의 첫 줄)은 맨 위에서 보여야 한다 — 가운데 정렬이 넘친 위쪽을 자르면 스크롤로도 닿지 못한다.
 * 통합 수용 9차(원장 §184): 빠른 칸은 띠 안에 있다 — 기준이 소식 줄만 세던 동안 빠른 칸이 칸 밖으로 6 ~ 38px 나갔고, 보스전(카드 두 칸)은
 *   띠를 통째로 접어 '지난 소식' 입구가 사라졌다. 전투 칸 기준(index.css `ae-stage-column`): 소식 두 줄 179 · 빠른 칸까지 246 ·
 *   한 줄(단추와 빠른 칸) 166 — 그 아래만 띠를 접는다.
 */

type Box = { top: number; bottom: number; height: number; display: string; scrollHeight: number; visible: boolean };

const box = (page: Page, selector: string): Promise<Box | null> => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, display: getComputedStyle(el).display, scrollHeight: el.scrollHeight, visible: el.getClientRects().length > 0 };
}, selector);

const HEIGHTS = [568, 600, 640, 667, 700, 740] as const;
const TWO_LINES = 179;
const WITH_QUICK_SLOTS = 246;
const ONE_ROW = 166;

/** 빠른 칸 첫 칸에 물약을 넣는다(가방 탭의 '빠른 칸' 단추 — 소모품 거래 스펙과 같은 경로). */
const assignQuickSlot = async (page: Page) => {
    await page.setViewportSize({ width: 375, height: 844 });
    await startE2ERun(page, { openStatusConsole: true });
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('early-gear-choice'))).toBe(true);
    await page.locator('[data-testid$="-tab-inventory"]').first().click();
    await page.getByTestId('quick-slot-assign-0').click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();
};

const expectStripFits = async (page: Page, columnSelector: string, stripSelector: string, width: number, combat: boolean) => {
    const column = await box(page, columnSelector);
    const strip = await box(page, stripSelector);
    expect(column).not.toBeNull();
    expect(strip).not.toBeNull();
    const quickSlot = await box(page, `${stripSelector} [data-testid="quick-slot-0"]`);
    const hasQuickSlots = Boolean(quickSlot);
    if (combat) {
        // 한 줄을 담을 수 있으면 띠를 접지 않는다 — '지난 소식' 입구는 남는다.
        if (column!.height >= ONE_ROW + 1) expect(strip!.display).not.toBe('none');
    } else if (column!.height >= TWO_LINES) {
        expect(strip!.display).not.toBe('none');
    }
    if (strip!.display === 'none') return; // 칸이 한 줄도 담지 못해 접은 높이 — 접기 규칙이 맡는다.

    // 띠 · 빠른 칸이 칸 밖(조작판 밑)으로 나가지 않는다.
    expect(strip!.bottom).toBeLessThanOrEqual(column!.bottom + 1);
    if (quickSlot) {
        expect(quickSlot.visible).toBe(true);
        expect(quickSlot.bottom).toBeLessThanOrEqual(column!.bottom + 1);
    }

    // '지난 소식' 단추는 44px 그대로 칸 안에 있다.
    const open = await box(page, `${stripSelector} [data-testid="log-sheet-open"]`);
    expect(open!.visible).toBe(true);
    expect(open!.height).toBeGreaterThanOrEqual(44);
    expect(open!.height).toBeLessThan(60);
    expect(open!.bottom).toBeLessThanOrEqual(column!.bottom + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    const line = await box(page, `${stripSelector} [data-testid="log-ticker"]`);
    expect(line).not.toBeNull();
    // 소식 줄은 기준 높이를 담을 때 보인다(전투 칸이 낮으면 접는다).
    const lineThreshold = hasQuickSlots ? WITH_QUICK_SLOTS : TWO_LINES;
    if (!combat || column!.height >= lineThreshold) expect(line!.visible).toBe(true);
    if (!line!.visible) return;
    const first = await box(page, `${stripSelector} [data-testid="log-ticker-text"]`);
    expect(first).not.toBeNull();
    expect(line!.bottom).toBeLessThanOrEqual(column!.bottom + 1);
    // 첫 줄은 줄 상자 안 맨 위에서 시작한다(넘친 위쪽이 잘리지 않는다).
    expect(first!.top).toBeGreaterThanOrEqual(line!.top);
};

for (const height of HEIGHTS) {
    test(`375x${height}: 전투 소식 띠가 칸을 넘지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height });
        await startE2ERun(page);
        expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false))).toBe(true);
        await expect(page.getByTestId('combat-stage')).toBeVisible({ timeout: 8_000 });
        await expectStripFits(page, '[data-testid="combat-stage"]', '.ae-combat-log-strip', 375, true);
    });

    for (const boss of [false, true]) {
        test(`375x${height}: 빠른 칸이 있는 ${boss ? '보스' : '일반'} 전투 띠가 칸을 넘지 않고 '지난 소식'이 남는다`, async ({ page }) => {
            await assignQuickSlot(page);
            await page.setViewportSize({ width: 375, height });
            expect(await page.evaluate((b) => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(b), boss)).toBe(true);
            await expect(page.getByTestId('combat-stage')).toBeVisible({ timeout: 8_000 });
            await expectStripFits(page, '[data-testid="combat-stage"]', '.ae-combat-log-strip', 375, true);
        });
    }

    test(`375x${height}: 필드 소식 띠가 칸을 넘지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width: 375, height });
        await startE2ERun(page);
        expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAutoExploreScenario?.())).toBe(true);
        await expect(page.getByTestId('field-stage-column')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('log-ticker')).toBeVisible();
        await expectStripFits(page, '[data-testid="field-stage-column"]', '.ae-field-log-strip', 375, false);
    });
}
