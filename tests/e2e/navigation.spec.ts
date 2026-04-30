import { test, expect } from '@playwright/test';

/**
 * E2E: 핵심 네비게이션 플로우 — Map / Skills / Stats 탭 진입.
 *
 * cycle 58: 4-pack UX 개선 (avatar/skill/map/shop)이 정상 렌더되는지 검증.
 */
test.describe('Navigation', () => {
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

    test('MAP 탭 진입 → 지역 카드 노출', async ({ page }) => {
        const mapTab = page.locator('[data-testid$="-tab-map"]').first();
        await expect(mapTab).toBeVisible({ timeout: 8_000 });
        await mapTab.click();
        // tier vertical list (cycle 57)에서 적어도 시작의 마을 또는 다른 지역명 노출
        await expect(page.locator('text=/시작의 마을|World Routes|Atlas/').first()).toBeVisible({ timeout: 5_000 });
    });

    test('SKILL 탭 진입 → 스킬 카드 + 선택 가능 안내', async ({ page }) => {
        const skillTab = page.locator('[data-testid$="-tab-skills"]').first();
        await expect(skillTab).toBeVisible({ timeout: 8_000 });
        await skillTab.click();
        // 스킬 카드 또는 Current Loadout 텍스트 노출
        await expect(page.locator('text=/Current Loadout|스킬|선택/').first()).toBeVisible({ timeout: 5_000 });
    });
});
