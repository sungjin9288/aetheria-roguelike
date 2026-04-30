import { test, expect } from '@playwright/test';

/**
 * E2E: REST 버튼 (안전지대 액션).
 */
test.describe('Rest action', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        if (await introInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await page.getByTestId('intro-start-button').click();
            await expect(introInput).toBeHidden({ timeout: 15_000 });
        }
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 20_000 });
        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await statusChip.click();
        }
    });

    test('Town Ops에 REST 버튼 노출', async ({ page }) => {
        const rest = page.getByRole('button', { name: /REST/i }).first();
        await expect(rest).toBeVisible({ timeout: 8_000 });
    });
});
