import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

/**
 * E2E: 휴식 버튼 (안전지대 액션).
 */
test.describe('Rest action', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
    });

    test('안전지대에 휴식 버튼 노출', async ({ page }) => {
        await openTownFacilities(page);
        const rest = page.getByTestId('control-rest');
        await expect(rest).toBeVisible({ timeout: 8_000 });
        await expect(rest).toHaveAccessibleName('휴식');
    });
});
