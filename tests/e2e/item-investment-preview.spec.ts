import { test, expect, type Locator } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => (
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    ));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [{ text: element.textContent?.trim() || '', fontSize }] : [];
}));

test.describe('Item investment preview', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
    });

    test('강화 비용을 소비하기 전에 결과와 실패 손실을 확인한다', async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedEnhanceScenario?.({
            gold: 500,
            materialCount: 1,
            weaponEnhance: 0,
        }));

        const panel = page.getByTestId('equipment-panel');
        await expect(panel).toBeVisible();
        if (await panel.getAttribute('data-equipment-view') === 'summary') {
            await page.getByTestId('equipment-detail-toggle').click();
        }

        const openDecision = page.getByTestId('equipment-enhance-weapon');
        await expect(openDecision).toBeEnabled();
        await openDecision.click();

        const decision = page.getByTestId('enhance-decision-card');
        await expect(decision).toBeVisible();
        await expect(decision).toContainText('+0');
        await expect(decision).toContainText('+1');
        await expect(page.getByTestId('enhance-success-rate')).toHaveText('100%');
        await expect(page.getByTestId('enhance-stat-change')).toContainText('→');
        await expect(page.getByTestId('enhance-failure-consequence')).toContainText('강화 단계는 유지');
        await expect(page.getByTestId('enhance-failure-consequence')).toContainText('골드와 강화 재료는 소모');
        expect(await findUndersizedText(decision)).toEqual([]);
        await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 2_500 });
        await page.waitForTimeout(300);
        await page.screenshot({
            path: 'playtest-artifacts/item-investment-preview/mobile-enhance-decision.png',
            fullPage: false,
        });

        const goldBeforeCancel = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        await page.getByTestId('enhance-decision-cancel').click();
        await expect(decision).toBeHidden();
        const goldAfterCancel = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldAfterCancel).toBe(goldBeforeCancel);

        await openDecision.click();
        await page.getByTestId('enhance-decision-confirm').click();
        await expect(decision).toBeHidden();
        await expect(page.getByTestId('equipment-slot-weapon')).toContainText('+1');
        const goldAfterEnhance = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldAfterEnhance).toBe(350);
    });

    test('제작과 합성 결과를 아이콘·수치·현재 장비 대비로 비교한다', async ({ page }) => {
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedItemInvestmentScenario?.());

        const craftingPanel = page.getByTestId('crafting-panel');
        await expect(craftingPanel).toBeVisible();

        const recipe = page.getByTestId('crafting-recipe-r1');
        const output = page.getByTestId('crafting-output-r1');
        await expect(recipe).toBeVisible();
        await expect(output).toContainText('강철 롱소드');
        await expect(output).toContainText('2단계 · 무기');
        await expect(output).toContainText('공격력');
        await expect(output).toContainText('장착 가능');
        await expect(recipe.locator('[data-item-icon-style]')).toHaveCount(1);
        expect(await findUndersizedText(recipe)).toEqual([]);
        await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 2_500 });
        await recipe.scrollIntoViewIfNeeded();
        const craftGeometry = await page.locator('[data-app-shell]').evaluate((shell) => ({
            clientWidth: shell.clientWidth,
            scrollWidth: shell.scrollWidth,
            scrollLeft: shell.scrollLeft,
        }));
        expect(craftGeometry.scrollWidth).toBeLessThanOrEqual(craftGeometry.clientWidth);
        expect(craftGeometry.scrollLeft).toBe(0);
        await page.screenshot({
            path: 'playtest-artifacts/item-investment-preview/mobile-craft-preview.png',
            fullPage: false,
        });

        await page.getByTestId('crafting-mode-synth').click();
        for (let index = 0; index < 3; index += 1) {
            await page.getByTestId(`synthesis-input-investment-synth-${index}`).click();
        }

        const synthesisPreview = page.getByTestId('synthesis-investment-preview');
        await expect(synthesisPreview).toBeVisible();
        await expect(synthesisPreview).toContainText('성공률');
        await expect(synthesisPreview).toContainText('3단계 결과 후보');
        await expect(page.getByTestId('synthesis-protection-toggle')).toContainText('보호권 1개 · 보유 1개');
        await expect(page.getByTestId('synthesis-failure-consequence')).toContainText('3개 중 1개만 돌아오며 골드는 소모');

        const firstCandidate = page.getByTestId('synthesis-output-candidate').first();
        await expect(firstCandidate).toBeVisible();
        await expect(firstCandidate.locator('[data-item-icon-style]')).toHaveCount(1);
        await expect(firstCandidate).toContainText(/공격력|방어력/);
        expect(await findUndersizedText(synthesisPreview)).toEqual([]);

        const geometry = await page.evaluate(() => ({
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
        }));
        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await synthesisPreview.scrollIntoViewIfNeeded();
        await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 2_500 });
        await page.waitForTimeout(300);
        await page.screenshot({
            path: 'playtest-artifacts/item-investment-preview/mobile-craft-synthesis-preview.png',
            fullPage: false,
        });
    });
});
