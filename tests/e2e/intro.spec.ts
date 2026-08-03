import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: Intro 화면 → 캐릭터 시작 flow.
 *
 * ?e2e=1 플래그로 Firebase 익명 인증 스킵 (헤드리스 환경 안정성).
 * cycle 58.
 */
test.describe('Intro flow', () => {
    test('페이지 로드 시 Intro 화면 노출', async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        await expect(introInput).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText('달빛 아래 펼쳐지는 모험', { exact: true })).toBeVisible();
        await expect(page.getByTestId('intro-location')).toHaveText('시작의 마을');
        await expect(page.getByTestId('intro-start-button')).toHaveText('모험 시작');

        const background = page.getByTestId('intro-background');
        await expect(background).toBeVisible();
        await expect.poll(() => background.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

        const layout = await page.evaluate(() => {
            const intro = document.querySelector<HTMLElement>('[data-testid="intro-screen"]');
            const controls = document.querySelector<HTMLElement>('[data-testid="intro-controls"]');
            const startButton = document.querySelector<HTMLElement>('[data-testid="intro-start-button"]');
            if (!intro || !controls || !startButton) throw new Error('Intro layout not ready');

            const introBounds = intro.getBoundingClientRect();
            const controlsBounds = controls.getBoundingClientRect();
            const buttonBounds = startButton.getBoundingClientRect();
            return {
                introHeight: introBounds.height,
                controlsBottom: controlsBounds.bottom,
                buttonHeight: buttonBounds.height,
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            };
        });

        expect(layout.introHeight).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
        expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
        expect(layout.buttonHeight).toBeGreaterThanOrEqual(48);
        expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);

        const challengeSettings = page.getByTestId('intro-challenge-settings');
        await expect(challengeSettings).not.toHaveAttribute('open', '');
        await expect(page.getByTestId('intro-challenge-halfHp')).toBeHidden();
    });

    test('도전 설정은 선택 사항으로 접혀 있고 필요할 때만 펼친다', async ({ page }) => {
        await page.goto('/?e2e=1');

        const challengeSettings = page.getByTestId('intro-challenge-settings');
        await challengeSettings.locator('summary').click();
        await expect(challengeSettings).toHaveAttribute('open', '');

        const halfHp = page.getByTestId('intro-challenge-halfHp');
        await expect(halfHp).toBeVisible();
        await expect(halfHp).toHaveAttribute('aria-pressed', 'false');
        await halfHp.click();
        await expect(halfHp).toHaveAttribute('aria-pressed', 'true');
    });

    test('Intro에서 시작 버튼 클릭 → Dashboard 진입', async ({ page }) => {
        await page.goto('/?e2e=1');

        const introInput = page.getByTestId('intro-name-input');
        await expect(introInput).toBeVisible({ timeout: 15_000 });

        const startButton = page.getByTestId('intro-start-button');
        await expect(startButton).toBeVisible();
        await startButton.click();

        // Intro 입력창 사라지고 게임 진입
        await expect(introInput).toBeHidden({ timeout: 15_000 });
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId('relic-choice-panel')).toBeHidden();
        await expect(page.getByTestId('control-town-primary')).toContainText('고요한 숲으로 첫 출발');
    });

    test('StatusBar에 레벨 표시 (게임 부트 완료)', async ({ page }) => {
        await startE2ERun(page);
        const statusBar = page.getByTestId('persistent-status-bar');
        await expect(statusBar).toContainText(/레벨 \d+/);
    });

    test('첫 출발 전에 첫 스토리 임무가 자동으로 이어진다', async ({ page }) => {
        await startE2ERun(page);

        const preparation = page.getByTestId('control-expedition-prep');
        await expect(preparation).toContainText('고요한 숲에서 탐험 1회 진행');

        const primary = page.getByTestId('control-town-primary');
        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_move');
        await expect(primary).toContainText('고요한 숲으로 첫 출발');

        await primary.getByRole('button').click();
        await expect(page.getByTestId('control-mission-tracker')).toContainText('0/1');

        await page.getByTestId('control-explore').click();
        await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 8_000 });
        await page.getByTestId('event-choice-0').click();
        const completedMission = page.getByTestId('control-mission-tracker');
        await expect(completedMission).toContainText('보상 대기');
        await expect(completedMission).toContainText('마을에서 보상 회수');

        const geometry = await page.evaluate(() => {
            const shell = document.querySelector<HTMLElement>('[data-app-shell]');
            if (!shell) throw new Error('App shell not found');
            const shellBounds = shell.getBoundingClientRect();
            return {
                pageX: window.scrollX,
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                shellLeft: shellBounds.left,
                shellRight: shellBounds.right,
                shellScrollLeft: shell.scrollLeft,
                shellWidth: shell.scrollWidth,
                shellViewport: shell.clientWidth,
            };
        });
        expect(geometry.pageX).toBe(0);
        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.shellLeft).toBeGreaterThanOrEqual(-1);
        expect(geometry.shellRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.shellScrollLeft).toBe(0);
        expect(geometry.shellWidth).toBeLessThanOrEqual(geometry.shellViewport);
    });
});
