import { test, expect } from '@playwright/test';

/**
 * E2E: Intro 화면 렌더링 + 캐릭터 시작 flow.
 *
 * cycle 58: Playwright 인프라 검증용 첫 E2E. 무거운 시나리오는 후속 사이클.
 */
test.describe('Intro flow', () => {
    test('페이지 로드 시 Intro 화면 또는 게임 즉시 노출', async ({ page }) => {
        await page.goto('/');

        // intro 입력창(신규) 또는 StatusBar(기존 save 로드) 둘 중 하나가 노출되어야 함
        const introInput = page.getByTestId('intro-name-input');
        const statusBar = page.getByTestId('persistent-status-bar');

        await expect(introInput.or(statusBar).first()).toBeVisible({ timeout: 20_000 });
    });

    test('Intro 화면에서 시작 버튼이 보이고 누르면 Intro가 사라짐', async ({ page }) => {
        await page.goto('/');

        const introInput = page.getByTestId('intro-name-input');
        const startButton = page.getByTestId('intro-start-button');

        // intro가 떠야 의미있는 테스트. 아니면 스킵.
        const isIntro = await introInput.isVisible({ timeout: 10_000 }).catch(() => false);
        test.skip(!isIntro, '기존 save 로드 — intro 안 뜸');

        // 이름은 자동 채워져 있음. 시작 버튼 클릭.
        await expect(startButton).toBeVisible();
        await startButton.click();

        // Intro 입력창이 사라져야 함 (Dashboard 진입)
        await expect(introInput).toBeHidden({ timeout: 15_000 });
    });
});
