import { test, expect, type Locator } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => (
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    ));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [{ text: element.textContent?.trim() || '', fontSize }] : [];
}));

test.describe('Expedition return debrief', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionDebriefScenario?.());
    });

    test('첫 귀환 요약을 읽고 닫은 뒤 마을에서 다시 연다', async ({ page }) => {
        const debrief = page.getByTestId('expedition-debrief-card');
        await expect(debrief).toBeVisible({ timeout: 8_000 });
        await expect(debrief).toContainText('원정 귀환');
        await expect(debrief).toContainText('고요한 숲 · 11분');
        await expect(debrief).toContainText('전투');
        await expect(debrief).toContainText('4회');
        await expect(debrief).toContainText('+185');
        await expect(page.getByTestId('expedition-debrief-items')).toContainText('초급 회복 물약 x2');
        await expect(page.getByTestId('expedition-debrief-quests')).toContainText('첫 숲길 조사');
        await expect(page.getByTestId('expedition-debrief-story')).toContainText('돌아오는 것도 모험이다');

        const recommendation = page.getByTestId('expedition-return-recommendation');
        await expect(recommendation).toContainText('이어서 할 일');
        await expect(recommendation).toContainText('[스토리] 첫 번째 여정의 보상이 기다리고 있습니다.');

        const primaryAction = page.getByTestId('expedition-debrief-primary-action');
        await expect(primaryAction).toHaveAttribute('data-return-action', 'claim_quest');
        await expect(primaryAction).toContainText('임무 보상 받기');

        const bounds = await debrief.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

        const widths = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
        }));
        expect(widths.document).toBeLessThanOrEqual(widths.viewport);
        expect(await findUndersizedText(debrief)).toEqual([]);

        await page.screenshot({
            path: 'playtest-artifacts/expedition-return-flow/mobile-return-action.png',
            fullPage: false,
        });

        await primaryAction.click();
        await expect(debrief).toBeHidden();

        const stateAfterClaim = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(stateAfterClaim.player.claimedQuestIds).toContain(80);
        expect(stateAfterClaim.player.storyMilestones.seen).toContain('first_safe_return');
        expect(stateAfterClaim.player.storyMilestones.pending).not.toContain('first_safe_return');

        const history = page.getByTestId('control-last-expedition');
        await expect(history).toBeVisible();
        await expect(history).toContainText('지난 원정 · 고요한 숲');
        await expect(history).toContainText('전투 4 · 탐험 6 · +185 EXP');
        expect(await findUndersizedText(history)).toEqual([]);

        await history.click();
        await expect(debrief).toBeVisible();
        await expect(page.getByTestId('expedition-debrief-story')).toHaveCount(0);
        await expect(page.getByTestId('expedition-debrief-primary-action')).toHaveAttribute('data-return-action', 'open_quest_board');
    });

    test('전직 milestone 이야기를 한 번만 보여 준다', async ({ page }) => {
        await page.getByTestId('expedition-debrief-close-icon').click();
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedMilestoneStoryScenario?.());

        const story = page.getByTestId('milestone-story-card');
        await expect(story).toBeVisible();
        await expect(story).toHaveAttribute('data-story-id', 'first_job_change');
        await expect(story).toContainText('싸우는 방식에 이름이 생겼다');
        expect(await findUndersizedText(story)).toEqual([]);
        await page.waitForTimeout(350);

        await page.screenshot({
            path: 'playtest-artifacts/expedition-return-flow/mobile-job-change-story.png',
            fullPage: false,
        });

        await page.getByTestId('milestone-story-close').click();
        await expect(story).toBeHidden();

        const stateAfterClose = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(stateAfterClose.player.storyMilestones.seen).toContain('first_job_change');
        expect(stateAfterClose.player.storyMilestones.pending).not.toContain('first_job_change');
    });

    test('첫 패배 이야기를 확인한 뒤 다시 시작해도 완료 기록을 보존한다', async ({ page }) => {
        await page.getByTestId('expedition-debrief-close-icon').click();
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedFirstDeathStoryScenario?.());

        const story = page.getByTestId('run-summary-milestone-story');
        await expect(story).toBeVisible();
        await expect(story).toHaveAttribute('data-story-id', 'first_death');
        await expect(story).toContainText('끝난 자리에도 무언가는 남는다');
        expect(await findUndersizedText(story)).toEqual([]);

        await story.scrollIntoViewIfNeeded();
        await page.waitForTimeout(550);
        await page.screenshot({
            path: 'playtest-artifacts/expedition-return-flow/mobile-first-death-story.png',
            fullPage: false,
        });

        await page.getByTestId('run-summary-restart').click();
        await expect(page.getByTestId('intro-start-button')).toBeVisible();

        const stateAfterRestart = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(stateAfterRestart.player.storyMilestones.seen).toContain('first_death');
        expect(stateAfterRestart.player.storyMilestones.pending).not.toContain('first_death');
    });
});
