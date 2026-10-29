import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 앱인토스 게임 체크리스트 '미니앱 종료 시 확인 모달'.
 *
 * 뒤로가기가 앱을 닫을 차례(마을 대기)면 닫지 않고 확인 창을 띄운다(처리됨 = true —
 * 브리지가 Screen.close()를 부르지 않는다). 창이 열린 동안의 뒤로가기와 '계속하기'는 창만 닫는다.
 */
const triggerBack = (page: import('@playwright/test').Page) => page.evaluate(() => (
    window.__AETHERIA_TEST_API__?.triggerPlatformBack?.()
));

test.describe('Exit confirm', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
        await expect(page.getByTestId('control-move')).toBeVisible({ timeout: 8_000 });
    });

    test('앱을 닫을 뒤로가기는 확인 창을 띄우고, 다시 뒤로가기 · 계속하기는 창만 닫는다', async ({ page }) => {
        const dialog = page.getByTestId('exit-confirm-dialog');
        await expect(dialog).toHaveCount(0);

        expect(await triggerBack(page)).toBe(true);
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('role', 'alertdialog');
        await expect(page.getByRole('heading', { name: '게임을 종료할까요?' })).toBeVisible();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        for (const id of ['exit-confirm-stay', 'exit-confirm-leave']) {
            const box = await page.getByTestId(id).boundingBox();
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        }

        expect(await triggerBack(page)).toBe(true);
        await expect(dialog).toHaveCount(0);
        await expect(page.getByTestId('control-move')).toBeVisible();

        expect(await triggerBack(page)).toBe(true);
        await expect(dialog).toBeVisible();
        await page.getByTestId('exit-confirm-stay').click();
        await expect(dialog).toHaveCount(0);
    });

    test('웹에서 종료를 누르면 닫을 창이 없으므로 확인 창만 닫히고 게임은 그대로다', async ({ page }) => {
        expect(await triggerBack(page)).toBe(true);
        await page.getByTestId('exit-confirm-leave').click();
        await expect(page.getByTestId('exit-confirm-dialog')).toHaveCount(0);
        await expect(page.getByTestId('control-move')).toBeVisible();
    });
});
