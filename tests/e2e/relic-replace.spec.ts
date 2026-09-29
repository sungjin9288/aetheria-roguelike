import { test, expect, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 유물 상한에서의 교체 제안 (RelicChoicePanel) — 2026-09 Wave 30.
 *
 * Wave 27 N2(D3)가 상한에서 유물을 조용히 넘기거나 버리지 않고 교체를 제안하게 했지만, 그 패널은 렌더 단언만
 * 있었다(원장 §27.6). 시드: window.__AETHERIA_TEST_API__.injectRelicReplaceChoice() — 현재 rank의 상한만큼 유물을
 * 채우고 아직 없는 유물 하나를 pendingRelics로 올린다(src/hooks/useGameTestApi.ts).
 */

const openRelicSection = async (page: Page) => {
    const statusChip = page.getByTestId('status-character-chip');
    if (await statusChip.count()) {
        await statusChip.click();
    }
    await page.getByTestId('archive-tab-system').click();
    const relicSection = page.getByTestId('system-relic-section');
    await expect(relicSection).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('system-relic-list').locator('summary').click();
    return relicSection;
};

test.describe('유물 상한 교체 제안', () => {
    let seed: { capacity: number; ownedNames: string[]; offeredName: string };

    test.beforeEach(async ({ page }) => {
        await startE2ERun(page);
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRelicReplaceChoice?.());
        expect(seeded).toBeTruthy();
        seed = seeded as typeof seed;
        await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('relic-choice-capacity-notice')).toBeVisible();
    });

    test('제안 유물을 고르면 보유 유물 목록이 교체 대상으로 뜨고, 하나를 내려놓으면 수는 그대로다', async ({ page }) => {
        await expect(page.getByTestId('relic-choice-0')).toContainText(seed.offeredName);
        await page.getByTestId('relic-choice-0').click();

        await expect(page.getByTestId('relic-replace-options')).toBeVisible();
        for (let index = 0; index < seed.capacity; index += 1) {
            await expect(page.getByTestId(`relic-replace-${index}`)).toBeVisible();
        }
        await expect(page.getByTestId(`relic-replace-${seed.capacity}`)).toHaveCount(0);

        await page.getByTestId('relic-replace-0').click();
        await expect(page.getByTestId('relic-choice-panel')).toBeHidden({ timeout: 5_000 });

        const relicSection = await openRelicSection(page);
        await expect(relicSection).toContainText(`보유 유물 ${seed.capacity}/${seed.capacity}`);
        await expect(relicSection).toContainText(seed.offeredName);
        await expect(relicSection).not.toContainText(seed.ownedNames[0]);
    });

    test('"이번에는 고르지 않기"는 보유 유물을 그대로 두고 패널만 닫는다', async ({ page }) => {
        await page.getByTestId('relic-choice-skip').click();
        await expect(page.getByTestId('relic-choice-panel')).toBeHidden({ timeout: 5_000 });

        const relicSection = await openRelicSection(page);
        await expect(relicSection).toContainText(`보유 유물 ${seed.capacity}/${seed.capacity}`);
        await expect(relicSection).toContainText(seed.ownedNames[0]);
        await expect(relicSection).not.toContainText(seed.offeredName);
    });
});
