import { expect, test, type Page } from '@playwright/test';
import { startE2ERun, waitForModeTransition } from './testHelpers';

/**
 * 소유자 결정 2026-10-26 D14: 390×844(iPhone 14 · 안전 영역 47/34)에서 원정 조작판(필드 독)의 둘째 줄
 *   (이동 · 지도 · 정찰 · 가방)이 화면 밖으로 밀렸다 — 기록 창 최소 높이 240 위에 임무 추적 · 신호 줄 · 독 두 줄이 쌓여
 *   출발 직후 8px, 탐험 한 번 뒤 67px 넘쳤다(마을은 넘치지 않는다). 필드에서는 기록 창이 96px까지 양보한다.
 *   Chromium에는 안전 영역이 없으므로 기기 값을 변수로 넣어 잰다(town-facilities-design.spec.ts와 같은 방법).
 */

const DEVICES = [
    { label: 'iPhone mini', width: 375, height: 812, top: 50, bottom: 34 },
    { label: 'iPhone 14', width: 390, height: 844, top: 47, bottom: 34 },
    { label: 'iPhone Pro Max', width: 430, height: 932, top: 62, bottom: 34 },
] as const;

// 고요한 숲의 다음 탐험이 전투가 아닌 결과로 끝나는 씨앗 — 탐험 뒤에도 원정 조작판이 그대로인 상태를 잰다.
const QUIET_EXPLORE_SEED = 7;

const SCENARIOS = [
    { label: '임무 추적 · 장비 신호가 있는 원정', seed: 'seedExpeditionMissionLoadoutScenario' },
    { label: '묘비 회수가 있는 원정', seed: 'seedGraveRecoveryScenario' },
] as const;

const measureDock = (page: Page) => page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-app-shell]')!;
    const dock = document.querySelector('[data-testid="control-field-actions"]');
    const buttons = dock ? [...dock.querySelectorAll('button')] : [];
    return {
        buttons: buttons.length,
        lowestBottom: Math.max(...buttons.map((button) => button.getBoundingClientRect().bottom)),
        shellOverflow: shell.scrollHeight - shell.clientHeight,
    };
});

const expectDockFits = async (page: Page, device: (typeof DEVICES)[number], step: string) => {
    await expect(page.getByTestId('control-field-actions')).toBeVisible({ timeout: 8_000 });
    await waitForModeTransition(page);
    const geometry = await measureDock(page);
    expect(geometry.buttons, `${step}: 독 단추`).toBeGreaterThanOrEqual(5);
    expect(geometry.lowestBottom, `${step}: 독 마지막 줄이 홈 표시줄 위에 있다`).toBeLessThanOrEqual(device.height - device.bottom);
    expect(geometry.shellOverflow, `${step}: 화면이 넘치지 않는다`).toBeLessThanOrEqual(0);
};

test.describe('원정 조작판 · 스크롤 없이 한 화면', () => {
    for (const device of DEVICES) {
        for (const scenario of SCENARIOS) {
            test(`${device.label} ${device.width}×${device.height}: ${scenario.label}`, async ({ page }) => {
                await page.setViewportSize({ width: device.width, height: device.height });
                await startE2ERun(page);
                await page.evaluate(({ top, bottom }) => {
                    document.documentElement.style.setProperty('--aether-safe-area-top', `${top}px`);
                    document.documentElement.style.setProperty('--aether-safe-area-bottom', `${bottom}px`);
                }, device);
                await page.evaluate((seed) => (window.__AETHERIA_TEST_API__ as unknown as Record<string, () => unknown>)?.[seed]?.(), scenario.seed);

                await page.getByTestId('control-expedition-start').click();
                await expectDockFits(page, device, '출발 직후');

                await page.evaluate((seed) => window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(seed), QUIET_EXPLORE_SEED);
                await page.getByTestId('control-explore').click();
                await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').gameState)).toBe('idle');
                await expectDockFits(page, device, '탐험 한 번 뒤');
            });
        }
    }
});
