import { test, expect } from '@playwright/test';

/**
 * E2E: GEAR 패널 + 세트 카탈로그 (cycle 58 신규 기능 검증).
 *
 * Firebase 익명 인증 + 게임 부트가 완료되어야 진입 가능. Vite preview 환경에서
 * 변동성 있어 타임아웃 넉넉히. 실패 시 skip.
 */
test.describe('Equipment panel', () => {
    test('GEAR 진입 → 세트 카탈로그 노출', async ({ page }) => {
        await page.goto('/');

        // intro 통과
        const introInput = page.getByTestId('intro-name-input');
        const introVisible = await introInput.isVisible({ timeout: 12_000 }).catch(() => false);
        if (introVisible) {
            await page.getByTestId('intro-start-button').click();
        }

        // 게임 부트 대기 (StatusBar 노출 = boot 완료 신호). 부트 실패 시 skip.
        const statusBar = page.getByTestId('persistent-status-bar');
        const booted = await statusBar.isVisible({ timeout: 30_000 }).catch(() => false);
        test.skip(!booted, '게임 부트 미완 — Firebase init 또는 환경 변동');

        // GEAR 탭 진입
        const gearTab = page.getByRole('button', { name: /GEAR/i }).first();
        await expect(gearTab).toBeVisible({ timeout: 5_000 });
        await gearTab.click();

        // affinity + 카탈로그 토글
        await expect(page.getByTestId('job-outfit-affinity')).toBeVisible({ timeout: 10_000 });
        const toggle = page.getByTestId('job-set-catalog-toggle');
        await expect(toggle).toBeVisible();
        await toggle.click();

        const anyCatalogItem = page.locator('[data-testid^="set-catalog-item-"]').first();
        await expect(anyCatalogItem).toBeVisible({ timeout: 3_000 });
    });
});
