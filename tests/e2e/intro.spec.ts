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
        await expect(page.getByTestId('intro-start-button')).toHaveText('모험 시작');

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
    });

    test('StatusBar에 레벨 표시 (게임 부트 완료)', async ({ page }) => {
        await startE2ERun(page);
        const statusBar = page.getByTestId('persistent-status-bar');
        await expect(statusBar).toContainText(/레벨 \d+/);
    });

    test('첫 출발 전에 첫 스토리 임무가 자동으로 이어진다', async ({ page }) => {
        await startE2ERun(page);

        const preparation = page.getByTestId('control-expedition-prep');
        await expect(preparation).toContainText('[스토리] 첫 번째 여정');
        await expect(preparation).toContainText('0/1');

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
    });
});
