import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('Combat focus mode', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
        expect(seeded).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
    });

    test('적 판단과 네 가지 주 행동이 첫 viewport에 함께 보인다', async ({ page }) => {
        await expect(page.getByTestId('persistent-status-bar')).toHaveAttribute('data-status-mode', 'combat');
        await expect(page.getByTestId('enemy-status')).toContainText('정예 숲의 정령');
        const enemyArt = page.getByTestId('enemy-portrait').locator('[data-monster-art]');
        await expect(enemyArt).toHaveAttribute('data-monster-art', 'exact');
        await expect(enemyArt).toHaveAttribute('data-region-family', 'forest');
        await expect(enemyArt.locator('img')).toHaveJSProperty('complete', true);
        await expect(page.getByTestId('combat-forecast-strip')).toContainText('위협');
        await expect(page.getByTestId('combat-forecast-strip')).toContainText('권장 대응');
        await expect(page.getByTestId('combat-forecast-strip')).toContainText('예상 흐름');

        const viewport = page.viewportSize();
        expect(viewport).not.toBeNull();
        const terminal = page.getByTestId('terminal-panel');
        const terminalBox = await terminal.boundingBox();
        const attackBox = await page.getByTestId('combat-action-attack').boundingBox();
        expect(terminalBox).not.toBeNull();
        expect(attackBox).not.toBeNull();
        expect(terminalBox!.y + terminalBox!.height).toBeLessThanOrEqual(attackBox!.y + 1);
        expect(terminalBox!.x).toBeGreaterThanOrEqual(0);
        expect(terminalBox!.x + terminalBox!.width).toBeLessThanOrEqual(viewport!.width + 1);
        for (const key of ['attack', 'skill', 'item', 'escape']) {
            const action = page.getByTestId(`combat-action-${key}`);
            await expect(action).toBeVisible();
            const box = await action.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
        }
        await page.screenshot({ path: 'playtest-artifacts/monster-region-art/combat-forest.png' });
    });

    test('아이템과 전투 기록을 펼쳐도 주 행동 상태를 유지한다', async ({ page }) => {
        const attack = page.getByTestId('combat-action-attack');
        const before = await attack.boundingBox();

        const itemAction = page.getByTestId('combat-action-item');
        await itemAction.click();
        await expect(itemAction).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByRole('button', { name: /회복 물약/ })).toBeVisible();
        await itemAction.click();

        const logToggle = page.getByTestId('combat-log-toggle');
        await logToggle.click();
        await expect(logToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(attack).toBeVisible();

        const after = await attack.boundingBox();
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
        expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    });

    test('전투 소모품 연속 입력은 한 번의 아이템 턴만 확정한다', async ({ page }) => {
        const before = await page.evaluate(() => {
            const rendered = JSON.parse(window.render_game_to_text?.() || '{}');
            const testApi = window.__AETHERIA_TEST_API__;
            return {
                hp: rendered.player?.hp,
                maxHp: rendered.player?.maxHp,
                itemCount: testApi?.getAscensionSnapshot?.().inventoryIds
                    .filter((id: string) => id === 'smoke-combat-heal').length,
            };
        });
        expect(before.hp).toBeLessThan(before.maxHp);
        expect(before.itemCount).toBe(1);

        await page.getByTestId('combat-action-item').click();
        const potion = page.getByTestId('combat-consumable-smoke-combat-heal');
        await expect(potion).toBeVisible();

        await potion.evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });

        await expect(potion).toBeHidden();
        await expect.poll(async () => {
            return page.evaluate(() => {
                const rendered = JSON.parse(window.render_game_to_text?.() || '{}');
                const testApi = window.__AETHERIA_TEST_API__;
                return {
                    gameState: rendered.gameState,
                    itemCount: testApi?.getAscensionSnapshot?.().inventoryIds
                        .filter((id: string) => id === 'smoke-combat-heal').length,
                    successLogCount: rendered.logTail.filter((log: { type: string; text: string }) => (
                        log.type === 'success' && log.text === '회복 물약 사용.'
                    )).length,
                    enemyTurnLogCount: rendered.logTail.filter((log: { type: string; text: string }) => (
                        ['warning', 'critical'].includes(log.type)
                        && log.text.includes('정예 숲의 정령')
                    )).length,
                };
            });
        }).toEqual({
            gameState: 'combat',
            itemCount: 0,
            successLogCount: 1,
            enemyTurnLogCount: 1,
        });
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible();
    });

    test('기력이 부족한 기술은 필요한 비용을 보여주고 무반응 입력을 막는다', async ({ page }) => {
        const seeded = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedCombatSkillReadinessScenario?.(2)
        ));
        expect(seeded).toBe(true);

        const readiness = page.getByTestId('combat-skill-readiness');
        const skillAction = page.getByTestId('combat-action-skill');
        await expect(readiness).toHaveAttribute('data-skill-state', 'energy');
        await expect(readiness).toContainText('강타 · 필요 기력 10 · 현재 2');
        await expect(skillAction).toBeDisabled();
        await expect(skillAction).toContainText('기력 부족');
        await page.screenshot({ path: 'playtest-artifacts/mobile-combat-focus/skill-energy-blocked.png' });

        const restored = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedCombatSkillReadinessScenario?.(10)
        ));
        expect(restored).toBe(true);
        await expect(readiness).toHaveAttribute('data-skill-state', 'ready');
        await expect(skillAction).toBeEnabled();
        await expect(skillAction).toContainText('기술');
    });

    test('보스 기믹과 대응도 행동을 밀어내지 않는다', async ({ page }) => {
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(true));
        expect(seeded).toBe(true);

        await expect(page.getByTestId('enemy-status')).toContainText('고대 호수의 수호신');
        await expect(page.getByTestId('combat-boss-signature')).toContainText('보스 기믹');
        await expect(page.getByTestId('combat-boss-counter')).toContainText('권장 대응');
        await page.locator('[data-app-shell]').evaluate((shell) => { shell.scrollTop = 0; });

        const viewport = page.viewportSize();
        const escape = await page.getByTestId('combat-action-escape').boundingBox();
        expect(viewport).not.toBeNull();
        expect(escape).not.toBeNull();
        expect(escape!.y + escape!.height).toBeLessThanOrEqual(viewport!.height + 1);
        await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
        await page.screenshot({ path: 'playtest-artifacts/mobile-combat-focus/boss-focus.png' });
    });
});
