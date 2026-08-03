import { test, expect, type Page } from '@playwright/test';

type InvestmentSnapshot = {
    name: string;
    gold: number;
    weaponEnhance: number;
    crafts: number;
    syntheses: number;
    synthProtects: number;
    inventory: Array<{ id: string; name: string; type: string; tier: number; enhance: number }>;
};

const getSnapshot = (page: Page): Promise<InvestmentSnapshot> => (
    page.evaluate(() => window.__AETHERIA_TEST_API__?.getInvestmentSnapshot?.())
);

test('강화·제작·합성의 소비와 결과가 재실행 뒤에도 유지된다', async ({ page }) => {
    await page.goto('/');

    const craftingPanel = page.getByTestId('crafting-panel');
    await expect(craftingPanel).toBeVisible({ timeout: 20_000 });
    const initial = await getSnapshot(page);
    expect(initial.name).toBe('정비 검증');
    expect(initial.gold).toBe(5_000);

    const recipe = page.getByTestId('crafting-recipe-r1');
    await recipe.scrollIntoViewIfNeeded();
    await page.screenshot({
        path: 'playtest-artifacts/item-investment-device-qa/01-craft-ready.png',
        fullPage: false,
    });
    await recipe.getByTestId('crafting-recipe-action').click();

    const afterCraft = await getSnapshot(page);
    expect(afterCraft.crafts).toBe(initial.crafts + 1);
    expect(afterCraft.gold).toBeLessThan(initial.gold);
    expect(afterCraft.inventory.some((item) => item.name === '강철 롱소드')).toBe(true);

    await page.getByTestId('crafting-mode-synth').click();
    for (let index = 0; index < 3; index += 1) {
        await page.getByTestId(`synthesis-input-investment-synth-${index}`).click();
    }
    await expect(page.getByTestId('synthesis-investment-preview')).toBeVisible();
    await page.screenshot({
        path: 'playtest-artifacts/item-investment-device-qa/02-synthesis-ready.png',
        fullPage: false,
    });

    await page.evaluate(() => {
        Math.random = () => 0;
    });
    await page.getByTestId('crafting-synthesize-action').click();

    const afterSynthesis = await getSnapshot(page);
    expect(afterSynthesis.syntheses).toBe(afterCraft.syntheses + 1);
    expect(afterSynthesis.gold).toBe(afterCraft.gold - 600);
    expect(afterSynthesis.synthProtects).toBe(afterCraft.synthProtects);
    expect(afterSynthesis.inventory.some((item) => item.tier === 3 && item.type === 'weapon')).toBe(true);
    expect(afterSynthesis.inventory.some((item) => item.id.startsWith('investment-synth-'))).toBe(false);

    await page.getByTestId('crafting-close').click();
    await page.getByTestId('mobile-console-open-archive').click();
    await page.locator('[data-testid$="-tab-equipment"]').first().click();

    const equipment = page.getByTestId('equipment-panel');
    await expect(equipment).toBeVisible();
    if (await equipment.getAttribute('data-equipment-view') === 'summary') {
        await page.getByTestId('equipment-detail-toggle').click();
    }

    await page.getByTestId('equipment-enhance-weapon').click();
    const decision = page.getByTestId('enhance-decision-card');
    await expect(decision).toBeVisible();
    const beforeCancel = await getSnapshot(page);
    await page.getByTestId('enhance-decision-cancel').click();
    expect(await getSnapshot(page)).toEqual(beforeCancel);

    await page.getByTestId('equipment-enhance-weapon').click();
    await expect(decision).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
        path: 'playtest-artifacts/item-investment-device-qa/03-enhance-ready.png',
        fullPage: false,
    });
    await page.getByTestId('enhance-decision-confirm').click();
    const afterEnhance = await getSnapshot(page);
    expect(afterEnhance.weaponEnhance).toBe(1);
    expect(afterEnhance.gold).toBe(beforeCancel.gold - 150);
    expect(afterEnhance.inventory.length).toBe(beforeCancel.inventory.length - 1);

    await page.waitForTimeout(900);
    await page.reload();
    await expect(page.getByTestId('persistent-status-bar')).toContainText('정비 검증', { timeout: 20_000 });

    const afterReload = await getSnapshot(page);
    expect(afterReload).toEqual(afterEnhance);
    await page.waitForTimeout(600);
    await page.screenshot({
        path: 'playtest-artifacts/item-investment-device-qa/04-relaunch-persisted.png',
        fullPage: false,
    });
});
