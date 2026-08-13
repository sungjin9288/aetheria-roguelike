import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test('390x844 free-skill relic progression is readable, contained, and grants through the real reducer', async ({ page }) => {
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
        window.__AETHERIA_TEST_API__?.injectFreeSkillRelicChoice?.();
    });

    const panel = page.getByTestId('relic-choice-panel');
    const spellEchoCard = page.getByRole('button', { name: '주문 메아리 선택' });
    const timeRingCard = page.getByRole('button', { name: '시공의 반지 선택' });
    await expect(panel).toBeVisible();
    await expect(spellEchoCard).toContainText('고급');
    await expect(spellEchoCard).toContainText('8% 확률로 기력을 소모하지 않음');
    await expect(timeRingCard).toContainText('영웅');
    await expect(timeRingCard).toContainText('15% 확률로 기력을 소모하지 않음');
    await expect(timeRingCard).not.toContainText('재사용 대기');

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
    expect(layout.minimumTouchHeight).toBeGreaterThanOrEqual(44);

    const before = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalFreeSkillRelicChoiceSnapshot?.()
    ));
    expect(before.pendingIds).toEqual(['spell_echo', 'time_ring', 'mana_crystal']);
    await spellEchoCard.click();
    await expect(panel).toBeHidden();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getCanonicalFreeSkillRelicChoiceSnapshot?.()
    ));
    expect(after.pendingIds).toEqual([]);
    expect(after.ownedSpellEchoCount).toBe(before.ownedSpellEchoCount + 1);
    expect(after.ownedRelicCount).toBe(before.ownedRelicCount + 1);
    expect(await readProductionSaves()).toEqual(productionSavesBefore);
});
