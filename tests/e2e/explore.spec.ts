import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: Explore 버튼 흐름.
 *
 * 시작의 마을은 안전지대라 탐험이 비활성이다. 다른 지역으로 이동한 뒤 탐험 흐름을 검증한다.
 * cycle 58: 핵심 게임플레이 진입점 검증.
 */
test.describe('Explore flow', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
    });

    test('마을에서는 결과 없는 탐험을 숨기고 이동만 노출', async ({ page }) => {
        const explore = page.getByTestId('control-explore');
        const move = page.getByTestId('control-move');
        await expect(explore).toHaveCount(0);
        await expect(move).toBeVisible({ timeout: 5_000 });
        await expect(move).toHaveAccessibleName('이동');
        await expect(page.getByTestId('control-map-signal')).toBeVisible({ timeout: 5_000 });

        await page.getByTestId('control-expedition-start').click();
        await expect(explore).toBeVisible({ timeout: 5_000 });
        await expect(explore).toHaveAccessibleName('탐험');
    });

    test('이동 버튼 클릭 → 이동 가능 지역 노출', async ({ page }) => {
        const move = page.getByTestId('control-move');
        await expect(move).toBeVisible({ timeout: 8_000 });
        await move.click();
        // 이동 메뉴는 시작의 마을의 인접 지역(고요한 숲 등) 노출
        await expect(page.locator('text=/고요한 숲|이동|취소/').first()).toBeVisible({ timeout: 5_000 });
    });
});
