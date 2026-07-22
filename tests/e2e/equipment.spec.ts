import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: GEAR 패널 + 세트 카탈로그 (cycle 58 신규 기능).
 *
 * ?e2e=1로 Firebase 스킵, intro → Dashboard 진입 후 GEAR 검증.
 */
test.describe('Equipment panel', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('초반 GEAR 진입 → 핵심 정보 요약과 affinity 박스 노출', async ({ page }) => {
        const gearTab = page.locator('[data-testid$="-tab-equipment"]').first();
        await gearTab.click();
        await expect(page.getByTestId('equipment-panel')).toHaveAttribute('data-equipment-view', 'summary');
        await expect(page.getByTestId('equipment-detail-toggle')).toContainText('상세 보기');
        await expect(page.getByTestId('job-outfit-affinity')).toBeVisible({ timeout: 8_000 });
        await page.getByTestId('damage-number').waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: 'playtest-artifacts/mobile-equipment-disclosure/equipment-summary.png' });
        await page.getByTestId('equipment-detail-toggle').click();
        await expect(page.getByTestId('equipment-slot-weapon').locator('[data-item-icon-style]')).toBeVisible();
    });

    test('양손무기 + 방어구 → 3/3 풀세트와 보조 손 점유 표시', async ({ page }) => {
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('ranger-coat'));
        expect(seeded).toBe(true);

        const affinity = page.getByTestId('job-outfit-affinity');
        await expect(page.getByTestId('equipment-panel')).toHaveAttribute('data-equipment-view', 'full');
        await expect(affinity).toHaveAttribute('data-match-count', '3');
        await expect(affinity).toHaveAttribute('data-affinity-tier', 'full');
        await expect(affinity).toContainText('(3/3)');
        await expect(affinity).toContainText('풀세트 발동');
        await expect(page.getByTestId('job-outfit-two-hand-hint')).toContainText('2피스로 계산');
        await expect(page.getByTestId('equipment-panel')).toContainText('양손 무기가 함께 사용');
    });

    test('GEAR 진입 → 세트 카탈로그 토글 펼침', async ({ page }) => {
        const gearTab = page.locator('[data-testid$="-tab-equipment"]').first();
        await gearTab.click();

        await page.getByTestId('equipment-detail-toggle').click();
        const toggle = page.getByTestId('job-set-catalog-toggle');
        await expect(toggle).toBeVisible({ timeout: 8_000 });
        await toggle.click();

        const anyCatalogItem = page.locator('[data-testid^="set-catalog-item-"]').first();
        await expect(anyCatalogItem).toBeVisible({ timeout: 5_000 });
    });
});
