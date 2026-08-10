import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

test.describe('전직 선택 흐름', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('adventurer-travel-tunic'));
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedClassJourneyScenario?.());
        await openTownFacilities(page);
        await page.getByTestId('control-class').click();
        await expect(page.getByTestId('job-change-panel')).toBeVisible();
        await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 8_000 });
    });

    test('레벨이 부족해도 앞으로 열릴 직업은 미리 살펴볼 수 있다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('early-gear-choice'));
        await expect(page.getByTestId('job-change-current')).toContainText('레벨 1');

        const magician = page.getByTestId('job-change-option').filter({ hasText: '마법사' });
        await expect(magician).toHaveAttribute('data-locked', 'true');
        await magician.click();
        await expect(magician).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('job-change-decision')).toContainText('원소의 학도');
        await expect(page.getByTestId('job-change-confirm')).toBeDisabled();
        await expect(page.getByTestId('job-change-confirm')).toContainText('레벨 5에 전직 가능');

        const state = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(state.player.job).toBe('모험가');
    });

    test('세 후보를 한번에 비교하고 선택한 직업을 따로 확정한다', async ({ page }) => {
        const options = page.getByTestId('job-change-option');
        await expect(options).toHaveCount(3);
        await expect(page.getByTestId('job-change-current')).toContainText('모험가');
        await expect(page.getByTestId('job-change-decision')).toContainText('다음 계보');

        const magician = options.filter({ hasText: '마법사' });
        await magician.click();
        await expect(magician).toHaveAttribute('data-selected', 'true');
        await expect(page.getByTestId('job-change-decision')).toContainText('아크메이지 또는 흑마법사 또는 성직자 또는 무당');

        const stateBeforeConfirm = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(stateBeforeConfirm.player.job).toBe('모험가');

        const confirm = page.getByTestId('job-change-confirm');
        await expect(confirm).toBeEnabled();
        await expect(confirm).toContainText('마법사로 전직');
        await confirm.click();
        await expect(page.getByTestId('job-change-panel')).toBeHidden();

        const stateAfterConfirm = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(stateAfterConfirm.player.job).toBe('마법사');
    });

    test('선택한 직업의 지난 발견과 첫 여정 안내를 같은 자리에서 읽는다', async ({ page }) => {
        const journey = page.getByTestId('class-journey-summary');
        await expect(journey).toContainText('이 직업으로 남긴 것');
        await expect(journey).toContainText('전사');
        await expect(journey).toContainText('기절 배시');
        await expect(journey).toContainText('성검 에테르니아');
        await expect(journey).toContainText('고대 호수의 수호신');
        await expect(journey).toContainText('신성한 호수');

        await page.getByTestId('job-change-option').filter({ hasText: '마법사' }).click();
        await expect(journey).toContainText('마법사');
        await expect(journey).toContainText('첫 원정을 떠나 이 직업의 여정을 남겨보세요.');

        const sequence = await page.evaluate(() => (
            JSON.parse(window.render_game_to_text?.() || '{}').player.classJourneySequence
        ));
        expect(sequence).toBe(7);
    });

    test('선택지와 확정 버튼은 모바일 화면 폭을 벗어나지 않는다', async ({ page }) => {
        const panel = page.getByTestId('job-change-panel');
        const confirm = page.getByTestId('job-change-confirm');

        await panel.evaluate((node) => {
            const scroller = node.querySelector<HTMLElement>('.custom-scrollbar');
            if (scroller) scroller.scrollTop = 0;
        });
        await panel.screenshot({
            path: 'playtest-artifacts/job-change-design/mobile-job-change-overview.png',
            animations: 'disabled',
        });

        await confirm.scrollIntoViewIfNeeded();
        await expect(confirm).toBeInViewport();

        const geometry = await page.evaluate(() => {
            const root = document.querySelector<HTMLElement>('[data-testid="job-change-panel"]');
            const button = document.querySelector<HTMLElement>('[data-testid="job-change-confirm"]');
            const journey = document.querySelector<HTMLElement>('[data-testid="class-journey-summary"]');
            if (!root || !button || !journey) throw new Error('Job change decision is not ready');
            const rootBounds = root.getBoundingClientRect();
            const buttonBounds = button.getBoundingClientRect();
            return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                rootLeft: rootBounds.left,
                rootRight: rootBounds.right,
                buttonHeight: buttonBounds.height,
                buttonTop: buttonBounds.top,
                buttonBottom: buttonBounds.bottom,
                journeyClientWidth: journey.clientWidth,
                journeyScrollWidth: journey.scrollWidth,
            };
        });

        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.rootLeft).toBeGreaterThanOrEqual(-1);
        expect(geometry.rootRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.buttonHeight).toBeGreaterThanOrEqual(48);
        expect(geometry.buttonTop).toBeGreaterThanOrEqual(0);
        expect(geometry.buttonBottom).toBeLessThanOrEqual(844);
        expect(geometry.journeyScrollWidth).toBeLessThanOrEqual(geometry.journeyClientWidth);

        await panel.screenshot({
            path: 'playtest-artifacts/job-change-design/mobile-job-change-decision.png',
            animations: 'disabled',
        });
    });

    test('선택한 직업의 canonical portrait가 직업별로 바뀌고 모바일 안에 머문다', async ({ page }) => {
        const portrait = page.getByTestId('job-change-selected-avatar');
        const portraitImage = portrait.locator('img');
        const identitySentence = page.getByTestId('job-change-selected-identity');

        await expect(portrait).toBeVisible();
        await expect(portraitImage).toHaveAttribute('src', /\/assets\/avatars\/canonical\/warrior\.png$/);
        await expect(identitySentence).toHaveText('전선을 지키는 용사');

        await page.getByTestId('job-change-option').filter({ hasText: '마법사' }).click();
        await expect(portraitImage).toHaveAttribute('src', /\/assets\/avatars\/canonical\/mage\.png$/);
        await expect(identitySentence).toHaveText('원소의 학도');

        const geometry = await portrait.evaluate((node) => {
            const bounds = node.getBoundingClientRect();
            return {
                left: bounds.left,
                right: bounds.right,
                top: bounds.top,
                bottom: bounds.bottom,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
            };
        });

        expect(geometry.left).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.top).toBeGreaterThanOrEqual(0);
        expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
    });
});
