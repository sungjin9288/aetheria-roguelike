import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 2026-11 H1 연속 탐험(docs/EXECUTION_SKETCH_H1_2026-11.md §3) — 화면 쪽 계약.
 *   - 첫 전직 전에는 토글이 없고(Q2 (b)), 전직 뒤 사냥 지역 대기에서는 원정 도크 아래에 그려지고 켤 수 있다.
 *   - 토글 줄도 홈 표시줄 위에 있고 화면이 넘치지 않는다(field-dock-fit과 같은 기기 값 — Chromium에는 안전 영역이 없다).
 *   - 켜면 수동 탭과 같은 액션으로 걷고(걸음 수가 오르거나 판단할 거리에서 스스로 멈춘다), 멈추기 단추로 멈추면 이유 한 줄이 기록에 남는다.
 *   - 설정의 생명 멈춤 문턱은 30 · 50 · 70% 중 하나이고 기본 50%다.
 *   다음 걸음 · 멈춤 판정 자체는 tests/auto-explore-step-contract.test.js가 순수 함수로 잰다.
 */

const DEVICES = [
    { label: 'iPhone mini', width: 375, height: 812, top: 50, bottom: 34 },
    { label: 'iPhone 14', width: 390, height: 844, top: 47, bottom: 34 },
    { label: 'iPhone Pro Max', width: 430, height: 932, top: 62, bottom: 34 },
] as const;

// 고요한 숲의 다음 탐험이 전투가 아닌 결과로 끝나는 씨앗(field-dock-fit과 같다).
const QUIET_EXPLORE_SEED = 7;

const readGame = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const seedAutoExplore = async (page: Page) => {
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAutoExploreScenario?.())).toBe(true);
    await expect(page.getByTestId('control-field-actions')).toBeVisible({ timeout: 8_000 });
};

test('첫 전직 전에는 연속 탐험 토글이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await page.getByTestId('control-expedition-start').click();
    await expect(page.getByTestId('control-field-actions')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('auto-explore-start')).toHaveCount(0);
});

for (const device of DEVICES) {
    test(`${device.label} ${device.width}×${device.height}: 토글이 홈 표시줄 위에 있고 화면이 넘치지 않는다`, async ({ page }) => {
        await page.setViewportSize({ width: device.width, height: device.height });
        await startE2ERun(page);
        await page.evaluate(({ top, bottom }) => {
            document.documentElement.style.setProperty('--aether-safe-area-top', `${top}px`);
            document.documentElement.style.setProperty('--aether-safe-area-bottom', `${bottom}px`);
        }, device);
        // 가장 높은 조작판 — 임무 추적 줄이 있는 원정(field-dock-fit의 첫 시나리오) 위에 토글을 더한다.
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionMissionLoadoutScenario?.());
        await seedAutoExplore(page);
        await expect(page.getByTestId('control-mission-tracker')).toBeVisible({ timeout: 8_000 });
        const start = page.getByTestId('auto-explore-start');
        await expect(start).toBeVisible();
        await expect(start).toBeEnabled();
        const geometry = await page.evaluate(() => {
            const shell = document.querySelector<HTMLElement>('[data-app-shell]')!;
            const toggle = document.querySelector('[data-testid="auto-explore-start"]')!;
            const rect = toggle.getBoundingClientRect();
            return { bottom: rect.bottom, height: rect.height, shellOverflow: shell.scrollHeight - shell.clientHeight };
        });
        expect(geometry.height, '터치 하한 44px').toBeGreaterThanOrEqual(44);
        expect(geometry.bottom, '토글이 홈 표시줄 위에 있다').toBeLessThanOrEqual(device.height - device.bottom);
        expect(geometry.shellOverflow, '화면이 넘치지 않는다').toBeLessThanOrEqual(0);
    });
}

test('켜면 걷고, 멈추기를 누르면 멈춘 이유가 기록에 남는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await seedAutoExplore(page);
    expect(await page.evaluate((seed) => window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(seed), QUIET_EXPLORE_SEED)).toBe(true);
    const before = await readGame(page);

    await page.getByTestId('auto-explore-start').click();
    const running = page.getByTestId('auto-explore-running');
    await expect(running).toBeVisible({ timeout: 4_000 });
    // 걷는 동안 탐험 단추는 쉰다 — 같은 걸음을 두 번 보내지 않는다.
    await expect(page.getByTestId('control-explore')).toBeDisabled();

    // 수동 탭과 같은 액션이 실제로 일어난다 — 탐험 수가 오른다(전투 · 사건으로 넘어가 스스로 멈춰도 같다).
    await expect.poll(async () => (await readGame(page)).player?.explores ?? 0, { timeout: 10_000 })
        .toBeGreaterThan(before.player?.explores ?? 0);

    if (await running.isVisible()) {
        await page.getByTestId('auto-explore-stop').click();
    }
    await expect(running).toBeHidden({ timeout: 8_000 });
    await expect.poll(async () => (await readGame(page)).logTail.some((log: { text: string }) => /연속 탐험.*멈췄습니다/.test(log.text)), { timeout: 8_000 })
        .toBe(true);
});

test('설정의 생명 멈춤 문턱은 기본 50%이고 30 · 50 · 70% 중에서 고른다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page, { openStatusConsole: true });
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSystemSettingsScenario?.());
    await expect(page.getByTestId('system-tab')).toBeVisible({ timeout: 8_000 });
    const section = page.getByTestId('auto-explore-settings');
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole('button')).toHaveCount(3);
    await expect(page.getByTestId('auto-explore-hp-50')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('auto-explore-hp-70').click();
    await expect(page.getByTestId('auto-explore-hp-70')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await readGame(page)).player?.autoExploreHpStop).toBe(0.7);
});
