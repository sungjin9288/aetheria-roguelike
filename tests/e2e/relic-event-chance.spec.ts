import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test('390x844 event-chance relic curve is readable and stacks through the real reducer', async ({ page }) => {
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

    const injected = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.injectEventChanceRelicChoice?.()
    ));
    expect(injected).toBe(true);

    const panel = page.getByTestId('relic-choice-panel');
    const ancientMapCard = page.getByRole('button', { name: '고대 지도 선택' });
    const charmCard = page.getByRole('button', { name: '방랑자의 부적 선택' });
    await expect(panel).toBeVisible();
    await expect(ancientMapCard).toContainText('일반');
    await expect(ancientMapCard).toContainText('이벤트 발생률 15% 증가');
    await expect(charmCard).toContainText('고급');
    await expect(charmCard).toContainText('이벤트 발생률 30% 증가');
    await expect(charmCard).not.toContainText('저비용 옵션');

    const layout = await panel.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const optionBounds = [...node.querySelectorAll<HTMLElement>('[data-testid^="relic-choice-"]')]
            .filter((element) => /^relic-choice-\d+$/.test(element.dataset.testid || ''))
            .map((element) => element.getBoundingClientRect());
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
            minimumTouchHeight: Math.min(...optionBounds.map((option) => option.height)),
        };
    });
    expect(layout).toMatchObject({ viewportWidth: 390, viewportHeight: 844 });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.panelScrollWidth).toBeLessThanOrEqual(layout.panelClientWidth);
    expect(layout.panelScrollHeight).toBeLessThanOrEqual(layout.panelClientHeight);
    expect(layout.panelBounds.left).toBeGreaterThanOrEqual(0);
    expect(layout.panelBounds.top).toBeGreaterThanOrEqual(0);
    expect(layout.panelBounds.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.panelBounds.bottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.minimumTouchHeight).toBeGreaterThanOrEqual(44);

    const before = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalEventChanceRelicChoiceSnapshot?.()
    ));
    expect(before).toMatchObject({
        pendingIds: ['ancient_map', 'wanderer_charm', 'mana_crystal'],
        ownedAncientMapCount: 0,
        ownedWandererCharmCount: 0,
        eventChanceBonus: 0,
    });
    await charmCard.click();
    await expect(panel).toBeHidden();
    const afterCharm = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalEventChanceRelicChoiceSnapshot?.()
    ));
    expect(afterCharm).toMatchObject({
        ownedAncientMapCount: 0,
        ownedWandererCharmCount: 1,
        eventChanceBonus: 0.3,
    });
    expect(await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.injectStackedEventChanceRelicChoice?.()
    ))).toBe(true);
    await expect(panel).toBeVisible();
    await ancientMapCard.click();
    await expect(panel).toBeHidden();
    const afterMap = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalEventChanceRelicChoiceSnapshot?.()
    ));
    expect(afterMap).toMatchObject({
        pendingIds: [],
        ownedAncientMapCount: 1,
        ownedWandererCharmCount: 1,
        eventChanceBonus: 0.45,
    });
    expect(afterMap.ownedRelicCount).toBe(before.ownedRelicCount + 2);
    expect(await readProductionSaves()).toEqual(productionSavesBefore);

    expect(await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.injectEventChanceRelicChoice?.()
    ))).toBe(true);
    await expect(panel).toBeVisible();
    await page.screenshot({
        path: 'docs/evidence/qa/release-complete-core/screenshots/relic-event-chance-390x844.png',
        fullPage: true,
    });
});
