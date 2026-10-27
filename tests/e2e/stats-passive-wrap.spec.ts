import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 소유자 결정 2026-10-26 D28: 기록의 상태 탭에서 패시브 "방어력 +4%"의 "+4%"만 다음 줄로 떨어졌다(iPhone 17 Pro, 402px).
 *   항목마다 한 덩어리로 그리므로 각 항목은 한 줄(줄 상자 하나)이다 — 항목 사이에서만 줄을 넘긴다.
 */
for (const width of [375, 402, 430]) {
    test(`${width}px: 상태 탭 패시브 항목은 이름과 수치가 한 줄이다`, async ({ page }) => {
        await page.setViewportSize({ width, height: 874 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.getByTestId('archive-tab-stats').click();
        await expect(page.getByTestId('stats-panel')).toBeVisible({ timeout: 8_000 });

        const parts = page.getByTestId('stats-passive-part');
        await expect(parts.first()).toBeVisible();
        const lines = await parts.evaluateAll((nodes) => nodes.map((node) => ({
            text: node.textContent,
            lines: new Set([...node.getClientRects()].map((rect) => Math.round(rect.top))).size,
        })));
        expect(lines.length).toBeGreaterThanOrEqual(2);
        for (const part of lines) expect(part.lines, part.text ?? '').toBe(1);
    });
}
