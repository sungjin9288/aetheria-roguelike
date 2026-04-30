import { test, expect } from '@playwright/test';

/**
 * E2E: Intro 화면 → 캐릭터 시작 flow.
 *
 * ?e2e=1 플래그로 Firebase 익명 인증 스킵 (헤드리스 환경 안정성).
 * cycle 58.
 */
test.describe('Intro flow', () => {
    test('페이지 로드 시 Intro 화면 노출', async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        await expect(introInput).toBeVisible({ timeout: 15_000 });
    });

    test('Intro에서 시작 버튼 클릭 → Dashboard 진입', async ({ page }) => {
        await page.goto('/?e2e=1');

        const introInput = page.getByTestId('intro-name-input');
        await expect(introInput).toBeVisible({ timeout: 15_000 });

        const startButton = page.getByTestId('intro-start-button');
        await expect(startButton).toBeVisible();
        await startButton.click();

        // Intro 입력창 사라지고 게임 진입
        await expect(introInput).toBeHidden({ timeout: 15_000 });
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 15_000 });
    });

    test('StatusBar에 Lv 표시 (게임 부트 완료)', async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        if (await introInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await page.getByTestId('intro-start-button').click();
        }
        const statusBar = page.getByTestId('persistent-status-bar');
        await expect(statusBar).toBeVisible({ timeout: 20_000 });
        await expect(statusBar).toContainText(/Lv\.\d+/);
    });
});
