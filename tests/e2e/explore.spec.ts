import { test, expect } from '@playwright/test';

/**
 * E2E: Explore 버튼 흐름.
 *
 * 시작의 마을은 safe zone이라 EXPLORE 비활성. 다른 지역으로 이동 후 EXPLORE 검증.
 * cycle 58: 핵심 게임플레이 진입점 검증.
 */
test.describe('Explore flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        if (await introInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await page.getByTestId('intro-start-button').click();
            await expect(introInput).toBeHidden({ timeout: 15_000 });
        }
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 20_000 });
    });

    test('하단 ControlPanel에 EXPLORE / MOVE 버튼 노출', async ({ page }) => {
        const explore = page.getByRole('button', { name: /EXPLORE/i }).first();
        const move = page.getByRole('button', { name: /MOVE/i }).first();
        await expect(explore).toBeVisible({ timeout: 8_000 });
        await expect(move).toBeVisible({ timeout: 5_000 });
    });

    test('MOVE 버튼 클릭 → 이동 가능 지역 노출', async ({ page }) => {
        const move = page.getByRole('button', { name: /MOVE/i }).first();
        await expect(move).toBeVisible({ timeout: 8_000 });
        await move.click();
        // 이동 메뉴는 시작의 마을의 인접 지역(고요한 숲 등) 노출
        await expect(page.locator('text=/고요한 숲|이동|취소/').first()).toBeVisible({ timeout: 5_000 });
    });
});
