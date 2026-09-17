import { test, expect } from '@playwright/test';

declare global {
    interface Window {
        __restoreDamageNumbers: string[];
    }
}

const SNAPSHOT_KEY = 'aetheria.device-qa.item-investment.snapshot.v1';

test('저장된 생명은 첫 화면부터 피격으로 표시하지 않고 epoch를 저장하지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?deviceQa=item-investment');
    await expect(page.getByTestId('persistent-status-bar')).toBeVisible();
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SNAPSHOT_KEY)).toBe(true);

    const snapshot = await page.evaluate((key) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.savedAt = 1;
        saved.player.hp = 97;
        saved.player.loc = '고요한 숲';
        saved.gameState = 'combat';
        saved.currentEvent = null;
        saved.enemy = {
            name: '숲의 정령', baseName: '숲의 정령', level: 2,
            hp: 500, maxHp: 500, atk: 16, def: 5, exp: 24, gold: 18,
            isBoss: false, pattern: { heavyChance: 0.2, guardChance: 0.1 },
        };
        return saved;
    }, SNAPSHOT_KEY);

    await page.addInitScript(({ key, snapshot }) => {
        localStorage.setItem(key, JSON.stringify(snapshot));
        window.__restoreDamageNumbers = [];
        new MutationObserver(() => {
            const number = document.querySelector('[data-testid="damage-number"]');
            if (number) window.__restoreDamageNumbers.push(number.textContent || '');
        }).observe(document, { subtree: true, childList: true, characterData: true });
    }, { key: SNAPSHOT_KEY, snapshot });

    for (let restore = 0; restore < 2; restore += 1) {
        await page.reload();
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible();
        await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text!()).player.hp)).toBe(97);
        // Observe the early effect window, not just its eventual 1.2s expiry.
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => window.__restoreDamageNumbers)).toEqual([]);
        expect(await page.getByTestId('damage-number').count()).toBe(0);
        await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).savedAt, SNAPSHOT_KEY))
            .toBeGreaterThan(1);
        const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SNAPSHOT_KEY);
        expect(saved).not.toHaveProperty('presentationEpoch');
        expect(saved.player).not.toHaveProperty('presentationEpoch');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    }
});
