import { expect, test } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

test('390x844 assignment keeps an effectless potion, then consumes it on a valid combat turn and keeps cure copy readable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page, { openStatusConsole: true });

    const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('early-gear-choice'));
    expect(seeded).toBe(true);

    await page.locator('[data-testid$="-tab-inventory"]').first().click();
    const assign = page.getByTestId('quick-slot-assign-0');
    await expect(assign).toBeVisible();
    await assign.click();
    await page.getByRole('button', { name: '닫기', exact: true }).click();

    const quickSlot = page.getByTestId('quick-slot-0');
    await expect(quickSlot).toHaveAccessibleName(/초급 회복 물약.*HP 30 회복.*전투 턴 1회 소모/);
    const quickSlotBounds = await quickSlot.boundingBox();
    expect(quickSlotBounds).not.toBeNull();
    expect(quickSlotBounds!.width).toBeGreaterThanOrEqual(40);
    expect(quickSlotBounds!.height).toBeGreaterThanOrEqual(40);

    await quickSlot.click();
    await expect(page.getByText('생명이 이미 가득합니다.', { exact: true })).toBeVisible();
    await expect(quickSlot).toBeVisible();

    await openTownFacilities(page);
    await page.getByTestId('control-market').click();
    const shop = page.getByTestId('shop-panel');
    await expect(shop).toBeVisible();
    const antidote = shop.getByTestId('shop-buy-item').filter({ hasText: '해독제' });
    await expect(antidote).toContainText('독 해제');
    await expect(antidote).not.toContainText('poison');
    await expect.poll(() => page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-testid="shop-panel"]');
        return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : Number.POSITIVE_INFINITY,
        };
    })).toEqual({ documentWidth: 390, viewportWidth: 390, panelOverflow: 0 });

    await page.getByTestId('shop-close').click();
    const combatSeeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
    expect(combatSeeded).toBe(true);
    await page.getByTestId('combat-action-attack').click();
    await expect(page.getByTestId('combat-focus-panel')).toBeVisible();
    await page.getByTestId('quick-slot-0').click();
    await expect(page.getByTestId('terminal-panel')).toContainText('초급 회복 물약 사용.');
    await expect(page.getByTestId('quick-slot-0')).toHaveCount(0);
});
