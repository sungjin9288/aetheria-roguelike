import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 2026-11 디자인 고도화 A5 — 설정 '전투 속도'. 빠르게(×2)는 연출 시간만 절반이다.
 *   - 설정 칸이 고른 값을 aria-pressed · 알림으로 보이고, 앱 셸이 `data-combat-speed="fast"` · `--ae-combat-time: 0.5`를 든다.
 *   - 처치 박자(`kill-beat-input-guard`가 남아 있는 시간)가 실제로 짧아진다 — 보통은 `KILL_BEAT_MS`(600) 이상,
 *     빠르게는 그 절반(300) 근처다. 타이머는 일찍 울리지 않으므로 보통 쪽 하한은 안정적이고, 빠르게 쪽은 여유를 둔 상한이다.
 *   박자 수치 자체는 tests/combat-speed-contract.test.js가 순수 함수로 잰다.
 */

const KILL_BEAT_NORMAL_MS = 600;
const KILL_BEAT_FAST_UPPER_MS = 500;

const openSystemSettings = async (page: Page) => {
    await startE2ERun(page, { openStatusConsole: true });
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSystemSettingsScenario?.());
    await expect(page.getByTestId('system-tab')).toBeVisible({ timeout: 8_000 });
};

/** 공격 한 번으로 허수아비를 쓰러뜨리고, 처치 박자 입력 보호막이 사라질 때까지의 시간을 같은 페이지 시계로 잰다. */
const measureKillBeat = async (page: Page) => {
    expect(await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.injectGoldMultiplierCombat?.('gold-magnet-first')
    ))).toBe(true);
    const attack = page.getByTestId('combat-action-attack');
    await expect(attack).toBeAttached({ timeout: 8_000 });
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.armNextCombatSeed?.(20260813))).toBe(true);
    return attack.evaluate((button: HTMLButtonElement) => new Promise<{ sawGuard: boolean; beatMs: number }>((resolve, reject) => {
        const guard = () => document.querySelector('[data-testid="kill-beat-input-guard"]');
        const startedAt = performance.now();
        let sawGuard = false;
        button.click();
        const tick = () => {
            const elapsed = performance.now() - startedAt;
            if (guard()) sawGuard = true;
            else if (sawGuard) { resolve({ sawGuard, beatMs: elapsed }); return; }
            if (elapsed > 5_000) { reject(new Error(`kill beat did not end (sawGuard=${sawGuard})`)); return; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }));
};

test.describe('전투 속도', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
    });

    test('기본은 보통이고, 빠르게를 고르면 앱 셸의 연출 시간 변수가 절반이 된다', async ({ page }) => {
        await openSystemSettings(page);
        const shell = page.locator('[data-app-shell]');
        await expect(page.getByTestId('combat-speed-normal')).toHaveAttribute('aria-pressed', 'true');
        await expect(shell).toHaveAttribute('data-combat-speed', 'normal');

        await page.getByTestId('combat-speed-fast').click();
        await expect(page.getByTestId('combat-speed-fast')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('combat-speed-normal')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.getByTestId('system-notice')).toContainText('빠르게 ×2로 바꿨습니다');
        await expect(shell).toHaveAttribute('data-combat-speed', 'fast');
        // 빌드 압축기가 `0.5`를 `.5`로 쓴다 — 글자가 아니라 수로 비교한다.
        expect(Number(await shell.evaluate((node) => getComputedStyle(node).getPropertyValue('--ae-combat-time').trim()))).toBe(0.5);

        await page.getByTestId('combat-speed-normal').click();
        await expect(shell).toHaveAttribute('data-combat-speed', 'normal');
        expect(await shell.evaluate((node) => getComputedStyle(node).getPropertyValue('--ae-combat-time').trim())).toBe('');
    });

    test('보통의 처치 박자는 600ms 이상이다', async ({ page }) => {
        await startE2ERun(page);
        const beat = await measureKillBeat(page);
        expect(beat.sawGuard).toBe(true);
        expect(beat.beatMs).toBeGreaterThanOrEqual(KILL_BEAT_NORMAL_MS - 20);
        await expect(page.getByTestId('post-combat-card')).toBeVisible({ timeout: 8_000 });
    });

    test('빠르게의 처치 박자는 절반 근처로 짧아지고 결과 카드는 그대로 열린다', async ({ page }) => {
        await openSystemSettings(page);
        await page.getByTestId('combat-speed-fast').click();
        await expect(page.locator('[data-app-shell]')).toHaveAttribute('data-combat-speed', 'fast');

        const beat = await measureKillBeat(page);
        expect(beat.sawGuard).toBe(true);
        expect(beat.beatMs).toBeLessThan(KILL_BEAT_FAST_UPPER_MS);
        await expect(page.getByTestId('post-combat-card')).toBeVisible({ timeout: 8_000 });
    });
});
