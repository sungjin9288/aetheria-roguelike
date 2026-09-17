import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test('390x844 canonical Undying choice is epic, contained, tappable, and grants once', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const productionSaveKeys = [
        'aetheria.game.snapshot.v1',
        'aetheria.game.snapshot.v2.primary',
        'aetheria.game.snapshot.v2.staged',
    ];
    const readProductionSaves = () => page.evaluate((keys) => Object.fromEntries(
        keys.map((key) => [key, localStorage.getItem(key)]),
    ), productionSaveKeys);
    const productionSavesBefore = await readProductionSaves();
    await page.evaluate(() => {
        window.__AETHERIA_TEST_API__?.injectUndyingRelicChoice?.();
    });

    const panel = page.getByTestId('relic-choice-panel');
    const undyingCard = page.getByRole('button', { name: '불사의 의지 선택' });
    await expect(panel).toBeVisible();
    await expect(undyingCard).toContainText('영웅');
    await expect(undyingCard).not.toContainText('고급');
    await page.waitForTimeout(400);

    const layout = await panel.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const undying = node.querySelector<HTMLElement>('[aria-label="불사의 의지 선택"]');
        const touchBounds = undying?.getBoundingClientRect();
        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            panelScrollWidth: node.scrollWidth,
            panelClientWidth: node.clientWidth,
            panelScrollHeight: node.scrollHeight,
            panelClientHeight: node.clientHeight,
            panelBounds: {
                top: bounds.top,
                right: bounds.right,
                bottom: bounds.bottom,
                left: bounds.left,
            },
            touchHeight: touchBounds?.height || 0,
        };
    });
    expect(layout.viewportWidth).toBe(390);
    expect(layout.viewportHeight).toBe(844);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth);
    expect(layout.panelScrollHeight).toBeLessThanOrEqual(layout.panelClientHeight);
    expect(layout.panelBounds.left).toBeGreaterThanOrEqual(0);
    expect(layout.panelBounds.top).toBeGreaterThanOrEqual(0);
    expect(layout.panelBounds.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.panelBounds.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.touchHeight).toBeGreaterThanOrEqual(44);

    const before = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalUndyingRelicChoiceSnapshot?.()
    ));
    expect(before.pendingIds).toEqual(['undying', 'blood_pact', 'twin_blades']);
    await undyingCard.click();
    await expect(panel).toBeHidden();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalUndyingRelicChoiceSnapshot?.()
    ));
    expect(after.pendingIds).toEqual([]);
    expect(after.ownedUndyingCount).toBe(before.ownedUndyingCount + 1);
    expect(after.ownedRelicCount).toBe(before.ownedRelicCount + 1);
    expect(await readProductionSaves()).toEqual(productionSavesBefore);
});
