import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

type GoldMultiplierOrder = 'gold-magnet-first' | 'merchant-seal-first';

const snapshot = async (page: any) => page.evaluate(() => (
    window.__AETHERIA_TEST_API__?.getGoldMultiplierCombatSnapshot?.()
));

const settleOrder = async (page: any, order: GoldMultiplierOrder, seed: number) => {
    expect(await page.evaluate((value: GoldMultiplierOrder) => (
        window.__AETHERIA_TEST_API__?.injectGoldMultiplierCombat?.(value)
    ), order)).toBe(true);
    const attack = page.getByTestId('combat-action-attack');
    await expect(attack).toBeVisible();
    const before = await snapshot(page);
    expect(before).toMatchObject({
        gameState: 'combat',
        enemy: { name: '골드 정책 허수아비', hp: 1, gold: 101 },
        gold: 0,
    });
    expect(before.relicOrder).toEqual(order === 'gold-magnet-first'
        ? ['gold_magnet', 'merchant_seal']
        : ['merchant_seal', 'gold_magnet']);

    expect(await page.evaluate((value: number) => (
        window.__AETHERIA_TEST_API__?.armNextCombatSeed?.(value)
    ), seed)).toBe(true);
    await attack.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
    });
    await expect.poll(async () => (await snapshot(page))?.gameState).toBe('idle');
    const after = await snapshot(page);
    expect(after).toMatchObject({
        enemy: null,
        gold: 161,
        totalGold: 161,
        kills: before.kills + 1,
    });
    return after;
};

test('390x844 production reducer settles both gold_mult inventory orders identically without clipping or duplicate settlement', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    expect(await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.injectGoldMultiplierCombat?.('gold-magnet-first')
    ))).toBe(true);
    const panel = page.getByTestId('combat-focus-panel');
    await expect(panel).toBeVisible();
    const layout = await panel.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const actions = ['attack', 'skill', 'item', 'escape'].map((key) => (
            document.querySelector<HTMLElement>(`[data-testid="combat-action-${key}"]`)?.getBoundingClientRect()
        ));
        return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            documentHeight: document.documentElement.scrollHeight,
            panelBounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom },
            actionBounds: actions.map((action) => action && ({
                left: action.left,
                top: action.top,
                right: action.right,
                bottom: action.bottom,
                height: action.height,
            })),
        };
    });
    expect(layout).toMatchObject({ viewportWidth: 390, viewportHeight: 844 });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.panelBounds.left).toBeGreaterThanOrEqual(0);
    expect(layout.panelBounds.top).toBeGreaterThanOrEqual(0);
    expect(layout.panelBounds.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.panelBounds.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    for (const action of layout.actionBounds) {
        if (!action) throw new Error('COMBAT_ACTION_BOUNDS_MISSING');
        expect(action.height).toBeGreaterThanOrEqual(44);
        expect(action.left).toBeGreaterThanOrEqual(0);
        expect(action.top).toBeGreaterThanOrEqual(0);
        expect(action.right).toBeLessThanOrEqual(layout.viewportWidth);
        expect(action.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    }

    const forward = await settleOrder(page, 'gold-magnet-first', 20260813);
    const reverse = await settleOrder(page, 'merchant-seal-first', 20260814);
    expect(forward.gold).toBe(reverse.gold);
    expect(forward.totalGold).toBe(reverse.totalGold);

    const postCombatCard = page.getByTestId('post-combat-card');
    if (await postCombatCard.isVisible()) {
        await postCombatCard.getByTestId('post-combat-close').click();
        await expect(postCombatCard).toBeHidden();
    }
    await expect(page.getByTestId('damage-number')).toHaveCount(0);
    await expect(page.locator('[data-log-type="loading"]')).toHaveCount(0);

    const logReview = await page.getByTestId('terminal-panel').evaluate((panel) => {
        const viewport = panel.querySelector<HTMLElement>('.custom-scrollbar');
        if (!viewport) throw new Error('COMBAT_LOG_VIEWPORT_MISSING');
        viewport.scrollTo({ top: 0, behavior: 'auto' });
        const bounds = viewport.getBoundingClientRect();
        const clippedRows = [...viewport.querySelectorAll<HTMLElement>('.aether-log-row')]
            .filter((row) => {
                const rowBounds = row.getBoundingClientRect();
                return rowBounds.top < bounds.bottom && rowBounds.bottom > bounds.top
                    && (rowBounds.top < bounds.top || rowBounds.bottom > bounds.bottom);
            });
        return { clippedRowCount: clippedRows.length };
    });
    expect(logReview.clippedRowCount).toBe(0);

    await page.screenshot({
        path: 'docs/evidence/qa/release-complete-core/screenshots/relic-gold-multiplier-390x844.png',
        fullPage: true,
    });
});
