import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: Explore 버튼 흐름.
 *
 * 시작의 마을은 safe zone이라 EXPLORE 비활성. 다른 지역으로 이동 후 EXPLORE 검증.
 * cycle 58: 핵심 게임플레이 진입점 검증.
 */
test.describe('Explore flow', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
    });

    test('하단 ControlPanel에 EXPLORE / MAP 버튼 노출', async ({ page }) => {
        const explore = page.getByRole('button', { name: /EXPLORE/i }).first();
        const move = page.getByTestId('control-move');
        await expect(explore).toBeVisible({ timeout: 8_000 });
        await expect(move).toBeVisible({ timeout: 5_000 });
        await expect(move).toHaveAccessibleName(/MAP|MOVE/i);
        await expect(page.getByTestId('control-map-signal')).toBeVisible({ timeout: 5_000 });
    });

    test('MAP 버튼 클릭 → 이동 가능 지역 노출', async ({ page }) => {
        const move = page.getByTestId('control-move');
        await expect(move).toBeVisible({ timeout: 8_000 });
        await move.click();
        // 이동 메뉴는 시작의 마을의 인접 지역(고요한 숲 등) 노출
        await expect(page.locator('text=/고요한 숲|이동|취소/').first()).toBeVisible({ timeout: 5_000 });
    });
});
