import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 떠돌이 행상인 (2026-10 Wave 75, 소유자 결정 "낮은 확률의 이벤트로 행상인 — 물품은 늘 바뀌고 가끔 희귀한 재료 · 장비,
 * 판매도 가능").
 *
 * 시드: seedWanderingMerchantScenario() — 지금 사냥 지역에서 행상인을 만나는 탐험 수로 기록을 맞추고(만남은 탐험 수 · 지역의
 * 해시라 난수를 쓰지 않는다) 판매할 재료 하나를 가방에 넣는다. 탐험 시드 1은 모닥불을 비껴간다(0.627).
 * 판정의 정본은 tests/wandering-merchant-contract.test.js(실제 explore · 리듀서)다. 여기서는 화면 경로를 확인한다:
 * 탐험 → 만남 카드 → 행상인 상점(이번 만남의 재고) → 구매 → 판매 → 떠나기.
 */

const TRIGGER_SEED = 1;
const snapshot = (page: import('@playwright/test').Page) => page.evaluate(() => window.__AETHERIA_TEST_API__?.getWanderingMerchantSnapshot?.());

test.describe('떠돌이 행상인', () => {
    test('탐험 중 행상인을 만나 이번 만남의 물건을 사고, 가방 물건을 팔고, 떠나면 다시 볼 수 없다', async ({ page }) => {
        await startE2ERun(page);
        await page.getByTestId('control-town-primary').getByRole('button').first().click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });

        const seed = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedWanderingMerchantScenario?.());
        expect(seed).toBeTruthy();
        const { sellItemName } = seed as { sellItemName: string };

        await page.evaluate((value) => window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(value), TRIGGER_SEED);
        await page.getByTestId('control-explore').click();

        const panel = page.getByTestId('event-panel');
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(panel).toContainText('떠돌이 행상인');
        await expect(page.getByTestId('event-choice-0')).toContainText('살펴본다');
        await expect(page.getByTestId('event-choice-1')).toContainText('지나친다');
        const met = await snapshot(page);
        expect(met?.stock.length).toBeGreaterThanOrEqual(4);

        await page.getByTestId('event-choice-0').click();
        await expect(page.getByTestId('shop-panel')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('merchant-shelf')).toBeVisible();
        await expect(page.getByTestId('merchant-offer')).toHaveCount(met!.stock.length);
        // 행상인 상점 머리글에는 기록 열기 단추가 없다(누르면 행상인이 떠난다).
        await expect(page.getByTestId('shop-open-archive')).toHaveCount(0);

        // 구매 — 첫 번째 살 수 있는 칸.
        const buyButton = page.locator('[data-testid="merchant-buy"]:not([disabled])').first();
        await expect(buyButton).toBeVisible();
        await buyButton.click();
        await expect(page.getByTestId('merchant-offer')).toHaveCount(met!.stock.length - 1, { timeout: 8_000 });
        const bought = await snapshot(page);
        const soldSlot = bought!.stock.find((slot) => slot.sold);
        expect(soldSlot).toBeTruthy();
        expect(bought!.gold).toBe(met!.gold - soldSlot!.price);
        expect(bought!.invNames).toContain(soldSlot!.name);

        // 판매 — 마을 상점과 같은 판매 목록 · 같은 판매가.
        await page.getByTestId('shop-panel').getByRole('button', { name: '판매', exact: true }).click();
        const row = page.locator(`[data-testid="shop-sell-row"][data-item-name="${sellItemName}"]`).first();
        await expect(row).toBeVisible({ timeout: 8_000 });
        const sellButton = row.getByRole('button');
        await sellButton.click();
        await sellButton.click();
        await expect.poll(async () => (await snapshot(page))?.invNames.filter((name) => name === sellItemName).length, { timeout: 8_000 }).toBe(0);
        const afterSell = await snapshot(page);
        expect(afterSell!.gold).toBeGreaterThan(bought!.gold);

        // 떠나기 — 만남이 끝나고 다시 볼 수 없다.
        await page.getByTestId('shop-close').click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });
        const left = await snapshot(page);
        expect(left!.gameState).toBe('idle');
        expect(left!.stock).toEqual([]);
    });
});
