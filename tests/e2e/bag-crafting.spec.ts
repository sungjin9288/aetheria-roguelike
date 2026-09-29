import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 제작소 가방 탭 (2026-09 Wave 33, 소유자 결정 "가방을 제작요소로" · "런마다 다시 만드는 가방").
 *
 * 시드: window.__AETHERIA_TEST_API__.seedBagCraftingScenario() — 가방 1단계 재료와 골드를 채우고 제작소를 연다.
 * 판정의 정본은 reducer `CRAFT_BAG`이다(tests/bag-crafting-contract.test.js). 여기서는 화면 경로를 확인한다.
 */

test.describe('제작소 가방', () => {
    test('가방 탭에서 1단계를 만들면 상한이 3칸 늘고 다음 단계가 열린다', async ({ page }) => {
        await startE2ERun(page);
        const seed = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedBagCraftingScenario?.());
        expect(seed).toBeTruthy();
        const { recipeName, capacityBefore, capacityAfter } = seed as { recipeName: string; capacityBefore: number; capacityAfter: number };

        await expect(page.getByTestId('crafting-panel')).toBeVisible({ timeout: 8_000 });
        await page.getByTestId('crafting-mode-bag').click();

        const capacity = page.getByTestId('bag-capacity');
        await expect(capacity).toContainText(`${capacityBefore}칸`);
        const first = page.getByTestId('bag-recipe-1');
        await expect(first).toHaveAttribute('data-bag-state', 'ready');
        await expect(first).toContainText(recipeName);
        await expect(page.getByTestId('bag-recipe-2')).toHaveAttribute('data-bag-state', 'locked');

        await first.getByTestId('bag-craft-action').click();

        await expect(first).toHaveAttribute('data-bag-state', 'done');
        await expect(capacity).toContainText(`${capacityAfter}칸`);
        await expect(page.getByTestId('bag-recipe-2')).toHaveAttribute('data-bag-state', 'short');
        // 시드는 골드를 "1단계 비용 + 1,000"으로 채운다 — 제작 뒤 1,000이 남는다.
        const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(snapshot.player.gold).toBe(1_000);
    });
});
