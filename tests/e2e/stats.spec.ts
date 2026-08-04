import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('상태 성장 기록 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });
        await page.getByTestId('archive-tab-stats').click();
        await expect(page.getByTestId('stats-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('현재 성장과 핵심 기록을 첫 흐름에서 읽을 수 있다', async ({ page }) => {
        const panel = page.getByTestId('stats-panel');
        const archiveContent = page.getByTestId('mobile-archive-console-content');
        await archiveContent.evaluate((node) => { node.scrollTop = 0; });

        await expect(page.getByTestId('stats-current-growth')).toContainText('현재 성장');
        await expect(page.getByTestId('stats-current-growth')).toContainText('다음 성장');
        await expect(page.getByTestId('stats-current-growth')).toContainText('추천 임무');
        await expect(page.getByTestId('stats-core-records')).toContainText('총 처치');
        await expect(page.getByTestId('stats-core-records')).toContainText('보스 처치');
        await expect(panel.locator('details[open]')).toHaveCount(0);
        await expect(panel).not.toContainText(/Statistics|TOTAL KILLS|DEATHS|K\/D RATIO|LEGACY ESSENCE/);

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            const summaryHeights = [...root.querySelectorAll<HTMLElement>('summary')]
                .map((node) => node.getBoundingClientRect().height)
                .filter((height) => height > 0);
            const bounds = root.getBoundingClientRect();

            return {
                panelHeight: bounds.height,
                minFont: Math.min(...fontSizes),
                minSummaryHeight: Math.min(...summaryHeights),
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                rootOverflow: root.scrollWidth - root.clientWidth,
                detailCount: root.querySelectorAll('details').length,
                nestedScrollCount: root.querySelectorAll('.custom-scrollbar').length,
            };
        });

        expect(geometry.panelHeight).toBeLessThan(900);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minSummaryHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.rootOverflow).toBeLessThanOrEqual(1);
        expect(geometry.detailCount).toBe(3);
        expect(geometry.nestedScrollCount).toBe(0);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/stats-redesign-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('세부 기록과 계승 수치는 선택한 항목만 펼쳐 본다', async ({ page }) => {
        const lifetime = page.getByTestId('stats-lifetime-records');
        await lifetime.locator('summary').click();
        await expect(lifetime).toHaveAttribute('open', '');
        await expect(lifetime).toContainText('사망');
        await expect(lifetime).toContainText('누적 골드');
        await expect(lifetime).toContainText('완료한 발견 여정');

        const legacy = page.getByTestId('stats-legacy-records');
        await legacy.locator('summary').click();
        await expect(legacy).toContainText('계승 정수');
        await expect(legacy).toContainText('추가 공격력');
        await expect(page.getByTestId('stats-panel').locator('details[open]')).toHaveCount(2);
    });
});
