import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

// 2026-10 감사 UX-10: 전투 결과 카드의 '계속 탐험'은 카드만 닫아서 승리할 때마다 닫기 · 탐험을 따로 눌러야 했다.
//   이제 탐험할 수 있는 곳(대기 · 안전지대 밖)에서는 카드를 닫고 탐험을 바로 부르고, 안전지대에서는 그 단추를 그리지 않는다.
//   카드가 나타난 직후 잠깐은 주 행동을 받지 않는다(전투를 끝낸 연타가 탐험 · 가방을 누르지 않게).
const SETTINGS_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';
const FIELD = '어둠의 지하 감옥';

const readGame = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const loadFieldFixture = async (page: Page) => {
    await page.goto('/?e2e=1&deviceQa=system-settings', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SETTINGS_KEY), { timeout: 20_000 }).toBe(true);
    const fixture = await page.evaluate(({ key, loc }) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.player = { ...saved.player, name: '용사', loc };
        saved.gameState = 'idle';
        saved.enemy = null;
        saved.currentEvent = null;
        return JSON.stringify(saved);
    }, { key: SETTINGS_KEY, loc: FIELD });
    await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot), { key: SETTINGS_KEY, snapshot: fixture });
    await page.reload();
    await expect.poll(async () => (await readGame(page)).player?.loc).toBe(FIELD);
};

test('사냥 지역의 승리 카드: 계속 탐험은 카드를 닫고 탐험을 실제로 부른다', async ({ page }) => {
    await loadFieldFixture(page);
    await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectPostCombatResult?.());
    const card = page.getByTestId('post-combat-card');
    await expect(card).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('post-combat-primary-action')).toHaveAttribute('data-primary-kind', 'inventory');
    const continueButton = page.getByTestId('post-combat-continue');
    await expect(continueButton).toBeVisible();
    await expect(card).toHaveAttribute('data-input-ready', 'true', { timeout: 4_000 });
    await expect(card).toHaveAttribute('data-reveal-stage', 'done', { timeout: 4_000 });

    const before = await readGame(page);
    expect(before.gameState).toBe('idle');
    await continueButton.click();
    await expect(card).toBeHidden({ timeout: 8_000 });
    // 탐험이 실제로 일어났다 — 기록이 늘거나(조용한 탐험 · 발견) 전투 · 사건 화면으로 넘어간다.
    await expect.poll(async () => {
        const after = await readGame(page);
        return after.gameState !== 'idle' || JSON.stringify(after.logTail) !== JSON.stringify(before.logTail);
    }, { timeout: 10_000 }).toBe(true);
});

test('안전지대의 승리 카드: 탐험을 약속하는 단추가 없고 닫기 아이콘으로 닫힌다', async ({ page }) => {
    await startE2ERun(page);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectPostCombatResult?.());
    const card = page.getByTestId('post-combat-card');
    await expect(card).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('post-combat-primary-action')).toHaveAttribute('data-primary-kind', 'inventory');
    await expect(page.getByTestId('post-combat-continue')).toHaveCount(0);
    await page.getByTestId('post-combat-close').click();
    await expect(card).toBeHidden({ timeout: 8_000 });
});
