import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: REST 버튼 (안전지대 액션).
 */
test.describe('Rest action', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('Town Ops에 REST 버튼 노출', async ({ page }) => {
        const rest = page.getByRole('button', { name: /REST/i }).first();
        await expect(rest).toBeVisible({ timeout: 8_000 });
    });
});
