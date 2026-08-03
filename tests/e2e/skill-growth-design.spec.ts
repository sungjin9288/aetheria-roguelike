import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('기술 성장 선택 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page, { openStatusConsole: true });

        const skillTab = page.locator('[data-testid$="-tab-skills"]').first();
        await expect(skillTab).toBeVisible({ timeout: 8_000 });
        await skillTab.click();
        await expect(page.getByTestId('skill-tree-preview')).toBeVisible({ timeout: 8_000 });
    });

    test('성장 후보를 눌러도 확정 전에는 선택 화면이 유지된다', async ({ page }) => {
        const stunChoice = page.getByTestId('skill-branch-choice-강타-B');
        const confirm = page.getByTestId('skill-growth-confirm-강타');

        await stunChoice.click();
        await expect(stunChoice).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('skill-growth-pending')).toBeVisible();
        await expect(confirm).toContainText('기절 배시로 성장 확정');
        await expect(page.getByTestId('skill-card-select-강타')).not.toContainText('성장 · 기절 배시');
    });

    test('명시적 확정 뒤 선택 결과가 현재 기술에 반영된다', async ({ page }) => {
        await page.getByTestId('skill-branch-choice-강타-B').click();
        await page.getByTestId('skill-growth-confirm-강타').click();

        await expect(page.getByTestId('skill-growth-pending')).toBeHidden();
        await expect(page.getByTestId('skill-card-select-강타')).toContainText('성장 · 기절 배시');
        await expect(page.getByTestId('skill-growth-change-강타')).toBeVisible();
    });

    test('유료 성장 변경도 미리보기 후 확정할 때만 골드를 사용한다', async ({ page }) => {
        await page.getByTestId('skill-branch-choice-강타-B').click();
        await page.getByTestId('skill-growth-confirm-강타').click();

        const goldBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        await page.getByTestId('skill-growth-change-강타').click();
        await page.getByTestId('skill-branch-choice-강타-A').click();

        await expect(page.getByTestId('skill-card-select-강타')).toContainText('성장 · 기절 배시');
        const goldDuringPreview = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldDuringPreview).toBe(goldBefore);

        await page.getByTestId('skill-growth-confirm-강타').click();
        await expect(page.getByTestId('skill-card-select-강타')).toContainText('성장 · 강화 배시');
        const goldAfter = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player.gold);
        expect(goldAfter).toBe(goldBefore - 50);
    });

    test('390px 화면에서 성장 선택과 다음 계보가 가로로 잘리지 않는다', async ({ page }) => {
        const panel = page.getByTestId('skill-tree-preview');
        const confirm = page.getByTestId('skill-growth-confirm-강타');
        const archiveContent = page.getByTestId('mobile-archive-console-content');

        await page.getByTestId('skill-branch-choice-강타-B').click();
        await archiveContent.evaluate((node) => { node.scrollTop = 0; });
        await page.screenshot({
            path: 'playtest-artifacts/skill-growth-design/mobile-growth-preview.png',
            animations: 'disabled',
            fullPage: false,
        });

        const geometry = await page.evaluate(() => {
            const root = document.querySelector<HTMLElement>('[data-testid="skill-tree-preview"]');
            const action = document.querySelector<HTMLElement>('[data-testid="skill-growth-confirm-강타"]');
            if (!root || !action) throw new Error('Skill growth surface is not ready');
            const bounds = root.getBoundingClientRect();
            return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                rootLeft: bounds.left,
                rootRight: bounds.right,
                actionHeight: action.getBoundingClientRect().height,
            };
        });

        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.rootLeft).toBeGreaterThanOrEqual(-1);
        expect(geometry.rootRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.actionHeight).toBeGreaterThanOrEqual(48);

        await page.getByTestId('skill-growth-confirm-강타').click();
        await page.getByTestId('class-growth-path').scrollIntoViewIfNeeded();
        await expect(page.getByTestId('class-growth-option')).toHaveCount(3);
        await expect(page.getByTestId('class-growth-path')).toContainText('대표 기술');
        await expect(page.getByTestId('class-growth-path')).toContainText('다음 계보');
        await page.screenshot({
            path: 'playtest-artifacts/skill-growth-design/mobile-current-skills-and-path.png',
            animations: 'disabled',
            fullPage: false,
        });
    });
});
