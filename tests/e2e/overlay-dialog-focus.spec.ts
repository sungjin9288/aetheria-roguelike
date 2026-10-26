import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 감사 A11Y-01 · 02 — 전체 화면 오버레이는 모달 대화상자다.
 *
 * 유물 선택(필수 선택)을 전투 위에 띄우면 이전에는 Tab이 뒤의 공격 · 도주 단추로 빠져나갔고,
 * 전투 단축키 1이 대화상자 뒤에서 공격을 냈다. 이제 대화상자만 키보드가 닿고(뒤는 `inert`),
 * Tab은 대화상자 안에서 돌며, Escape는 닫는 길이 있는 대화상자(귀환 브리핑)만 닫는다.
 */

const DIALOG = '[data-overlay-dialog="true"]';

const focusInsideDialog = (page: Page) => page.evaluate((selector) => {
    const dialog = document.querySelector(selector);
    return Boolean(dialog && dialog.contains(document.activeElement));
}, DIALOG);

const focusInsideTestId = (page: Page, testId: string) => page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    return Boolean(element && element.closest('[data-overlay-dialog="true"]')?.contains(document.activeElement));
}, testId);

const isInert = (page: Page, testId: string) => page.getByTestId(testId).evaluate((element) => Boolean(element.closest('[inert]')));

const readPlayerHp = (page: Page) => page.evaluate(() => {
    const rendered = JSON.parse(window.render_game_to_text?.() || '{}');
    return { hp: rendered.player?.hp as number, maxHp: rendered.player?.maxHp as number, gameState: rendered.gameState as string };
});

const readCombat = (page: Page) => page.evaluate(() => {
    const rendered = JSON.parse(window.render_game_to_text?.() || '{}');
    return { gameState: rendered.gameState as string, enemyHp: rendered.enemy?.hp as number | undefined };
});

const expectTabStaysInside = async (page: Page, presses: number) => {
    for (let index = 0; index < presses; index += 1) {
        await page.keyboard.press(index % 4 === 3 ? 'Shift+Tab' : 'Tab');
        expect(await focusInsideDialog(page), `Tab ${index + 1}번째에도 대화상자 안`).toBe(true);
    }
};

test.describe('오버레이 대화상자 포커스', () => {
    test('유물 선택은 전투 위에서 키보드를 가두고, 닫히기 전에는 전투 단축키가 나가지 않는다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false))).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRelicChoice?.());
        const panel = page.getByTestId('relic-choice-panel');
        await expect(panel).toBeVisible({ timeout: 8_000 });

        const dialog = page.locator(DIALOG);
        await expect(dialog).toHaveCount(1);
        await expect(dialog).toHaveAttribute('role', 'dialog');
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect(dialog).toHaveAttribute('aria-label', /.+/);
        await expect.poll(() => focusInsideDialog(page), { message: '열리면 포커스가 대화상자로 간다' }).toBe(true);

        // 뒤의 전투 단추는 inert — 포커스 · 클릭 · 보조 기술에서 빠진다.
        const attackInert = () => page.getByTestId('combat-action-attack').evaluate((element) => Boolean(element.closest('[inert]')));
        expect(await attackInert()).toBe(true);
        await expect(page.locator('main#aetheria-main')).toHaveCount(1);

        await expectTabStaysInside(page, 20);

        // 필수 선택: Escape로 닫히지 않는다.
        await page.keyboard.press('Escape');
        await expect(panel).toBeVisible();

        // 대화상자 위의 1(공격)은 무시된다.
        const before = await readCombat(page);
        expect(before.gameState).toBe('combat');
        await page.keyboard.press('Digit1');
        await page.waitForTimeout(400);
        expect(await readCombat(page)).toEqual(before);

        await page.getByTestId('relic-choice-1').click();
        await expect(panel).toBeHidden({ timeout: 5_000 });
        await expect(dialog).toHaveCount(0);
        expect(await attackInert()).toBe(false);
        await expect.poll(() => page.evaluate(() => document.activeElement !== null && document.activeElement !== document.body), {
            message: '닫히면 포커스가 문서 맨 앞으로 떨어지지 않는다',
        }).toBe(true);

        // 대화상자가 닫힌 뒤에는 1이 다시 공격이다.
        await page.keyboard.press('Digit1');
        await expect.poll(async () => (await readCombat(page)).enemyHp ?? 0, { timeout: 5_000 }).toBeLessThan(before.enemyHp ?? 0);
    });

    test('귀환 브리핑은 Escape로 닫히고 Tab은 카드 안에서 돈다', async ({ page }) => {
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.showReturnBriefingScenario?.());

        const card = page.getByTestId('return-briefing-card');
        await expect(card).toBeVisible({ timeout: 8_000 });
        const dialog = page.locator(DIALOG);
        await expect(dialog).toHaveCount(1);
        await expect(dialog).toHaveAttribute('role', 'dialog');
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect.poll(() => focusInsideDialog(page)).toBe(true);

        await expectTabStaysInside(page, 20);

        await page.keyboard.press('Escape');
        await expect(card).toBeHidden({ timeout: 5_000 });
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    });

    test('전투 차례는 화면 낭독기 알림 칸에 기록 줄을 더하지 않고 실린다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false))).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });

        const live = page.getByTestId('combat-live-region');
        await expect(live).toHaveAttribute('aria-live', 'polite');
        await expect(live.locator('p')).toHaveCount(0);

        await page.getByTestId('combat-action-attack').click();
        await expect(live.locator('p').first()).toBeAttached({ timeout: 5_000 });
        await expect(live).toContainText('생명');
        const summary = page.getByTestId('terminal-panel').locator('[data-log-type]');
        expect(await summary.count()).toBeGreaterThan(0);

        // 차례 뒤의 생명 변화(전투가 끝난 뒤 마을 · 휴식)는 생명 줄을 고쳐 쓰지 않는다 — 고쳐 쓰면 다시 읽힌다.
        const hpLine = live.locator('p').last();
        const announced = await hpLine.textContent();
        const lineCount = await live.locator('p').count();
        const before = await readPlayerHp(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedTownRecoveryScenario?.());
        await expect.poll(async () => (await readPlayerHp(page)).gameState).toBe('idle');
        const after = await readPlayerHp(page);
        expect(after.hp, '생명이 실제로 바뀌었다(판별 조건)').not.toBe(before.hp);
        await expect(hpLine).toHaveText(announced ?? '');
        await expect(live.locator('p')).toHaveCount(lineCount);
    });

    test('늦게 열린 아래 대화상자가 위에 보이는 대화상자를 죽이지 않는다(귀환 브리핑 위 · 유물 선택 아래)', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.showReturnBriefingScenario?.());
        const card = page.getByTestId('return-briefing-card');
        await expect(card).toBeVisible({ timeout: 8_000 });
        await expect.poll(() => focusInsideTestId(page, 'return-briefing-card')).toBe(true);

        // 유물 선택(z-50)은 문서에서 브리핑(z-50) 앞이라 아래에 그려진다 — 늦게 읽혀 나중에 열려도 그렇다.
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRelicChoice?.());
        const panel = page.getByTestId('relic-choice-panel');
        await expect(panel).toBeAttached({ timeout: 8_000 });
        await expect(page.locator(DIALOG)).toHaveCount(2);

        await expect.poll(() => isInert(page, 'relic-choice-panel'), { message: '아래 대화상자는 inert' }).toBe(true);
        expect(await isInert(page, 'return-briefing-card'), '위에 보이는 브리핑은 살아 있다').toBe(false);
        expect(await focusInsideTestId(page, 'return-briefing-card'), '포커스는 위 대화상자에 남는다').toBe(true);
        for (let index = 0; index < 8; index += 1) {
            await page.keyboard.press('Tab');
            expect(await focusInsideTestId(page, 'return-briefing-card'), `Tab ${index + 1}번째에도 브리핑 안`).toBe(true);
        }

        // 누른 자리는 위에 보이는 브리핑이 받는다(아래 유물 카드로 빠지지 않는다).
        await page.getByTestId('return-briefing-close-icon').click();
        await expect(card).toBeHidden({ timeout: 5_000 });
        await expect(panel).toBeVisible();
        expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').pendingRelics?.length ?? 0)).toBe(3);
        await expect.poll(() => isInert(page, 'relic-choice-panel')).toBe(false);
        await expect.poll(() => focusInsideTestId(page, 'relic-choice-panel'), { message: '남은 대화상자로 포커스가 간다' }).toBe(true);

        await page.keyboard.press('Escape');
        await expect(panel).toBeVisible();
        await page.getByTestId('relic-choice-1').click();
        await expect(panel).toBeHidden({ timeout: 5_000 });
        await expect.poll(() => page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    });
});
