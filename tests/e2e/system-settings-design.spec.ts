import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const openSystemSettings = async (page: any) => {
    await startE2ERun(page, { openStatusConsole: true });
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSystemSettingsScenario?.());
    await expect(page.getByTestId('system-tab')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
};

test.describe('System settings design', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openSystemSettings(page);
    });

    test('첫 화면은 플레이 설정과 장기 성장 판단을 먼저 보여 준다', async ({ page }) => {
        const settings = page.getByTestId('system-player-settings');
        const growth = page.getByTestId('system-growth-links');

        await expect(settings).toBeVisible();
        await expect(growth).toBeVisible();
        await expect(settings).toContainText('화면 선명도');
        await expect(settings).toContainText('장비 설명');
        await expect(growth).toContainText('220 정수');
        await expect(growth).toContainText('65 크리스탈');
        await expect(page.getByTestId('system-online-records')).not.toHaveAttribute('open', '');
        await expect(page.getByTestId('system-feedback')).not.toHaveAttribute('open', '');
        await expect(page.getByTestId('system-support-tools')).not.toHaveAttribute('open', '');
        await expect(page.getByText(/SESSION=/)).toBeHidden();

        const geometry = await page.getByTestId('system-tab').evaluate((root) => {
            const visible = (node: Element) => {
                const rect = node.getBoundingClientRect();
                const style = window.getComputedStyle(node);
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            };
            const fontSizes = Array.from(root.querySelectorAll('*'))
                .filter((node) => visible(node) && node.children.length === 0 && node.textContent?.trim())
                .map((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
            const actionHeights = Array.from(root.querySelectorAll('button, summary'))
                .filter(visible)
                .map((node) => Math.round(node.getBoundingClientRect().height));
            const scroll = root.closest('[data-testid="mobile-archive-console-content"]') as HTMLElement | null;
            return {
                minFont: Math.min(...fontSizes),
                minAction: Math.min(...actionHeights),
                scrollWidth: scroll?.scrollWidth || 0,
                clientWidth: scroll?.clientWidth || 0,
            };
        });

        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minAction).toBeGreaterThanOrEqual(44);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/system-settings-390x844.png',
            fullPage: false,
        });
    });

    test('화면과 장비 설명 설정은 선택 즉시 현재 상태에 반영된다', async ({ page }) => {
        await page.getByTestId('readability-mode-high').click();
        await expect(page.locator('[data-app-shell]')).toHaveAttribute('data-readability-mode', 'high');
        await expect(page.getByTestId('readability-mode-current')).toHaveText('선명하게');

        await page.getByTestId('equipment-detail-mode-full').click();
        await expect(page.getByTestId('equipment-detail-mode-current')).toHaveText('상세');
        await expect(page.getByTestId('system-notice')).toContainText('장비 정보를 상세 표시로 바꿨습니다.');
    });

    test('칭호는 현재 효과를 확인한 뒤 명시적으로 바꾼다', async ({ page }) => {
        const titleSection = page.getByTestId('system-title-section');
        await titleSection.scrollIntoViewIfNeeded();
        await expect(titleSection).toContainText('지도 제작자');

        const picker = page.getByTestId('system-title-picker');
        await picker.locator('summary').click();
        await page.getByTestId('system-title-wanderer').click();
        await expect(titleSection).toContainText('방랑자');
        await expect(page.getByTestId('system-title-wanderer')).toHaveAttribute('aria-pressed', 'true');
    });

    test('진단과 초기화는 보조 영역에서 필요할 때만 드러난다', async ({ page }) => {
        const support = page.getByTestId('system-support-tools');
        await support.scrollIntoViewIfNeeded();
        await support.locator('summary').click();

        await expect(support).toHaveAttribute('open', '');
        await expect(page.getByTestId('system-export-play-record')).toBeVisible();
        await expect(page.getByTestId('system-copy-diagnostics')).toBeVisible();
        await expect(support.getByText(/SESSION=/)).toBeVisible();

        const reset = page.getByTestId('system-reset-section');
        await reset.scrollIntoViewIfNeeded();
        await expect(reset).toContainText('이번 회차만 정리하고 영구 성장과 기록은 보존합니다.');
        await expect(page.getByTestId('menu-reset')).toBeVisible();
    });
});
