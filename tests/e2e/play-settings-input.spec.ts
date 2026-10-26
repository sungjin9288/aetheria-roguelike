import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 2026-10-26 소유자 결정 — 설정 · 접근성 · 진동.
 *   D3  진동: 기록 탭 설정 '진동'(기본 켬). 웹에서는 navigator.vibrate로 울리고, 끄면 울리지 않는다.
 *   D23 한 글자 단축키: 같은 설정 영역(기본 켬). 끄면 전투 중 1 · 2 · 3이 아무 동작도 하지 않는다.
 *   D24 전설 획득: 초점을 옮기지 않는 상태 알림(role="status") — 대화상자 · inert가 없고 저절로 닫힌다.
 */

declare global {
    interface Window { __vibrateCalls?: unknown[] }
}

const recordVibrate = (page: Page) => page.addInitScript(() => {
    window.__vibrateCalls = [];
    Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: (pattern: unknown) => { window.__vibrateCalls?.push(pattern); return true; },
    });
});

const vibrateCount = (page: Page) => page.evaluate(() => window.__vibrateCalls?.length ?? 0);
// 설정 시드가 레벨을 18로 올린다 — 그 레벨 상승도 실제 계기라 울린다. 전투 측정 전에 기록을 비운다.
const clearVibrate = (page: Page) => page.evaluate(() => { window.__vibrateCalls = []; });

const readCombat = (page: Page) => page.evaluate(() => {
    const rendered = JSON.parse(window.render_game_to_text?.() || '{}');
    return {
        gameState: rendered.gameState as string,
        enemyHp: rendered.enemy?.hp as number | undefined,
        playerHp: rendered.player?.hp as number | undefined,
    };
});

const openSystemSettings = async (page: Page) => {
    await startE2ERun(page, { openStatusConsole: true });
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSystemSettingsScenario?.());
    await expect(page.getByTestId('system-tab')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
};

const enterCombat = async (page: Page) => {
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false))).toBe(true);
    await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
};

/** 적이 반격해 내 생명이 줄 때까지(또는 전투가 끝날 때까지) 공격 단추를 누른다 — 맞음 · 치명타 계기를 만든다. */
const attackUntilHit = async (page: Page) => {
    const start = await readCombat(page);
    for (let turn = 0; turn < 4; turn += 1) {
        const current = await readCombat(page);
        if (current.gameState !== 'combat') return;
        if ((current.playerHp ?? 0) < (start.playerHp ?? 0)) return;
        await page.getByTestId('combat-action-attack').click();
        await expect.poll(async () => (await readCombat(page)).enemyHp, { timeout: 5_000 }).not.toBe(current.enemyHp);
    }
};

test.describe('설정 · 접근성 · 진동', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
    });

    test('진동 · 한 글자 단축키는 기본 켬이고, 켠 채로 전투하면 웹 진동이 울린다', async ({ page }) => {
        await recordVibrate(page);
        await openSystemSettings(page);
        await expect(page.getByTestId('haptics-settings-current')).toHaveText('켜짐');
        await expect(page.getByTestId('haptics-settings-on')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('keyboard-shortcut-settings-current')).toHaveText('켜짐');

        await clearVibrate(page);
        await enterCombat(page);
        expect(await vibrateCount(page), '전투에 들어선 것만으로는 울리지 않는다').toBe(0);
        await attackUntilHit(page);
        await expect.poll(() => vibrateCount(page), { message: '맞거나 치명타면 울린다', timeout: 5_000 }).toBeGreaterThan(0);
    });

    test('진동 · 한 글자 단축키를 끄면 전투에서 울리지 않고 1 · 2 · 3이 아무 동작도 하지 않는다', async ({ page }) => {
        await recordVibrate(page);
        await openSystemSettings(page);

        await page.getByTestId('haptics-settings-off').click();
        await expect(page.getByTestId('haptics-settings-current')).toHaveText('꺼짐');
        await expect(page.getByTestId('haptics-settings-off')).toHaveAttribute('aria-pressed', 'true');
        await page.getByTestId('keyboard-shortcut-settings-off').click();
        await expect(page.getByTestId('keyboard-shortcut-settings-current')).toHaveText('꺼짐');
        await expect(page.getByTestId('system-notice')).toBeVisible();

        await clearVibrate(page);
        await enterCombat(page);
        const before = await readCombat(page);
        expect(before.gameState).toBe('combat');
        for (const key of ['Digit1', 'Digit2', 'Digit3', 'Numpad1']) await page.keyboard.press(key);
        await page.waitForTimeout(400);
        expect(await readCombat(page), '끈 단축키는 전투를 움직이지 않는다').toEqual(before);

        await attackUntilHit(page);
        await page.waitForTimeout(300);
        expect(await vibrateCount(page), '진동을 끄면 울리지 않는다').toBe(0);
    });

    test('전설 획득은 초점을 옮기지 않는 상태 알림이고 저절로 닫힌다', async ({ page }) => {
        await startE2ERun(page);
        const status = page.getByTestId('legendary-drop-status');
        await expect(status).toHaveAttribute('role', 'status');
        await expect(status).toHaveAttribute('aria-live', 'polite');
        await expect(status).toHaveText('');

        // 아무 보이는 단추 하나에 초점을 둔다 — 전설 알림이 그 초점을 옮기지 않는지 본다.
        await page.evaluate(() => {
            const target = Array.from(document.querySelectorAll('main button'))
                .find((node) => (node as HTMLElement).offsetParent !== null && !(node as HTMLButtonElement).disabled);
            target?.setAttribute('data-e2e-focus-anchor', 'true');
        });
        const anchor = page.locator('[data-e2e-focus-anchor="true"]');
        await anchor.focus();
        await expect(anchor).toBeFocused();

        const legendaryName = await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectLegendaryAcquisition?.());
        expect(typeof legendaryName, '전설 각인 무기를 실제 데이터에서 찾았다').toBe('string');
        const overlay = page.getByTestId('legendary-drop-overlay');
        await expect(overlay).toBeVisible({ timeout: 5_000 });
        await expect(status).toContainText(String(legendaryName));
        await expect(overlay).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
        expect(await page.evaluate(() => document.querySelectorAll('[inert]').length), '배경을 inert로 만들지 않는다').toBe(0);
        await expect(anchor, '초점이 옮겨지지 않는다').toBeFocused();

        await expect(overlay).toBeHidden({ timeout: 6_000 });
        await expect(anchor).toBeFocused();
    });
});
