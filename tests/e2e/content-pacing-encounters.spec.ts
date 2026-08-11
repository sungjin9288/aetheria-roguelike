import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const viewports = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

for (const viewport of viewports) {
    test(`bounded encounter remains readable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize(viewport);
        await startE2ERun(page);

        const seeded = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-old-pillars')
        ));
        expect(seeded).toBe(true);

        const panel = page.getByTestId('event-panel');
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(panel).toContainText('돌기둥의 속삭임');
        await expect(panel).toContainText('기력 10을 들여 다음 전투의 방어를 단단히 합니다.');
        await expect(panel).toContainText('생명 8을 감수하고 골드 60을 바로 챙깁니다.');

        const choices = page.getByTestId('event-choice-list').getByRole('button');
        await expect(choices).toHaveCount(2);
        const geometry = await panel.evaluate((element) => ({
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        for (let index = 0; index < 2; index += 1) {
            await choices.nth(index).scrollIntoViewIfNeeded();
            await expect(choices.nth(index)).toHaveCSS('min-height', '72px');
            const bounds = await choices.nth(index).boundingBox();
            expect(bounds?.height).toBeGreaterThanOrEqual(44);
            expect(bounds?.x).toBeGreaterThanOrEqual(0);
            expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(viewport.width);
        }
        const before = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        await choices.nth(1).click();
        await expect(panel).toBeHidden({ timeout: 8_000 });
        const settled = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(settled.gameState).toBe('idle');
        expect(settled.player.hp).toBe(before.player.hp - 8);
        expect(settled.player.gold).toBe(before.player.gold + 60);
        expect(settled.player.boundedEncounterReceiptKeys).toEqual([
            `${before.player.activeExpeditionId}:forest-old-pillars:1`,
        ]);
        expect(settled.logTail.filter((entry: { text: string }) => (
            entry.text === '돌 아래 숨겨진 골드 60을 찾아냈습니다.'
        ))).toHaveLength(1);

        await page.evaluate(({ expeditionId }) => {
            window.__AETHERIA_TEST_API__?.resolveBoundedEncounterChoice?.(
                'forest-old-pillars',
                'lift-stone',
                expeditionId,
                1,
            );
        }, { expeditionId: before.player.activeExpeditionId });
        const replayed = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(replayed.player.hp).toBe(settled.player.hp);
        expect(replayed.player.gold).toBe(settled.player.gold);
        expect(replayed.player.boundedEncounterReceiptKeys).toEqual(settled.player.boundedEncounterReceiptKeys);
        expect(replayed.logTail).toEqual(settled.logTail);

        await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-old-pillars')
        ));
        await expect(panel).toBeVisible({ timeout: 8_000 });
        const backHandled = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.triggerPlatformBack?.()
        ));
        expect(backHandled).toBe(true);
        await expect(panel).toBeHidden({ timeout: 8_000 });

        await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-old-pillars')
        ));
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
        await page.screenshot({
            path: `docs/evidence/qa/release-complete-core/screenshots/content-pacing-${viewport.width}x${viewport.height}.png`,
            fullPage: false,
        });
    });
}
