import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 유물 3지선다 (RelicChoicePanel) 핵심 루프.
 *
 * 시드: window.__AETHERIA_TEST_API__.injectRelicChoice() — player.relics를 비우고
 * 3개(2 영웅 + 1 희귀)를 pendingRelics로 채운다(src/hooks/useGameTestApi.ts).
 * cycle 58 계열 기존 스펙(combat-focus.spec.ts 등)과 동일하게 startE2ERun 이후
 * window.__AETHERIA_TEST_API__로 시나리오를 주입하는 패턴을 따른다.
 */
test.describe('유물 3택 선택', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRelicChoice?.());
        expect(seeded).not.toBe(false);
        await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('3장의 유물 카드가 희귀도 라벨과 함께 보이고 그 이상은 없다', async ({ page }) => {
        await expect(page.getByTestId('relic-choice-options')).toBeVisible();

        for (const index of [0, 1, 2]) {
            const card = page.getByTestId(`relic-choice-${index}`);
            await expect(card).toBeVisible();
            // MSG.RARITY_LABEL — 이 시나리오는 영웅(epic) 2장 + 희귀(rare) 1장으로 구성된다.
            await expect(card).toContainText(/영웅|희귀/);
        }
        await expect(page.getByTestId('relic-choice-3')).toHaveCount(0);

        await expect(page.getByTestId('relic-choice-0')).toContainText('황혼의 파편');
        await expect(page.getByTestId('relic-choice-1')).toContainText('난공불락');
        await expect(page.getByTestId('relic-choice-2')).toContainText('균열의 서판');
    });

    test('유물을 고르면 패널이 닫히고 보유 유물 목록에 반영된다', async ({ page }) => {
        await page.getByTestId('relic-choice-1').click();
        await expect(page.getByTestId('relic-choice-panel')).toBeHidden({ timeout: 5_000 });

        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.count()) {
            await statusChip.click();
        }
        await page.getByTestId('archive-tab-system').click();

        const relicSection = page.getByTestId('system-relic-section');
        await expect(relicSection).toBeVisible({ timeout: 5_000 });
        await expect(relicSection).toContainText('보유 유물 1/');

        await page.getByTestId('system-relic-list').locator('summary').click();
        await expect(relicSection).toContainText('난공불락');
    });

    test('"이번에는 고르지 않기"를 누르면 유물을 얻지 않고 패널만 닫힌다', async ({ page }) => {
        await page.getByTestId('relic-choice-skip').click();
        await expect(page.getByTestId('relic-choice-panel')).toBeHidden({ timeout: 5_000 });

        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.count()) {
            await statusChip.click();
        }
        await page.getByTestId('archive-tab-system').click();

        // 유물이 0개면 SystemTab은 system-relic-section 자체를 렌더링하지 않는다.
        await expect(page.getByTestId('system-relic-section')).toHaveCount(0);
    });
});
