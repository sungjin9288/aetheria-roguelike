import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('Event choice location continuity', () => {
    test('첫 이야기 선택 결과가 짧은 기록에서도 화면 안에 이어진다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.getByTestId('control-expedition-start').click();
        await page.getByTestId('control-explore').click();
        await page.getByTestId('event-choice-0').click();
        const result = page.getByTestId('terminal-panel').locator('[data-log-type]').filter({ hasText: '마법사의 것으로 보이는 단서를 발견했습니다. 수정 동굴 방향으로 이어집니다.' });
        await expect(result).toBeInViewport({ ratio: 1 });
    });

    test('첫 이야기 보상 수령은 고유한 서사와 다시 읽을 기록으로 이어진다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.getByTestId('control-expedition-start').click();
        await page.getByTestId('control-explore').click();
        await page.getByTestId('event-choice-0').click();
        await page.getByTestId('control-move').click();
        await page.getByTestId('control-route-option-시작의 마을').click();
        await page.getByTestId('expedition-debrief-close-icon').click();
        const claim = page.getByTestId('control-claim-quest-reward');
        await expect(claim).toBeEnabled();
        await claim.evaluate((button) => { (button as HTMLElement).click(); (button as HTMLElement).click(); });
        const story = page.getByTestId('terminal-panel').locator('[data-log-type="story"]').filter({ hasText: '마법전쟁이 남긴 변이' });
        await expect(story).toHaveCount(1);
        await expect(story).toBeInViewport({ ratio: 1 });
        await page.getByTestId('mobile-console-open-archive').click();
        await page.getByTestId('archive-tab-quest').click();
        const journal = page.getByTestId('story-journal');
        await expect(journal).toContainText('고요한 숲');
        await expect(journal).toContainText('폐허의 진실');
        await expect(journal).toContainText('수락 조건 레벨 5');
        await expect(journal).not.toContainText('제국 연구자들의 봉인 기록을 찾아냈다');
        await expect(page.getByTestId('story-journal-latest')).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: 'output/playwright/product-20260928/05-story-journal.png' });
    });

    test('저장된 이야기 기록은 재실행 후에도 유지되고 좁은 화면에서 읽을 수 있다', async ({ page }) => {
        await page.goto('/?e2e=1&deviceQa=system-settings');
        await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.level), { timeout: 20_000 }).toBe(18);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario());
        const saveKey = 'aetheria.device-qa.system-settings.snapshot.v1';
        await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').player?.stats?.claimedQuestIds, saveKey)).toEqual([80]);
        await page.reload();
        await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.claimedQuestIds)).toEqual([80]);
        if (await page.getByTestId('mobile-console-return-log').isVisible()) await page.getByTestId('mobile-console-return-log').click();
        await page.getByTestId('mobile-console-open-archive').click();
        await page.getByTestId('archive-tab-quest').click();
        for (const width of [375, 390, 430]) {
            await page.setViewportSize({ width, height: 844 });
            const latest = page.getByTestId('story-journal-latest');
            await latest.scrollIntoViewIfNeeded();
            await expect(latest).toBeInViewport({ ratio: 1 });
            await expect(latest).toContainText('첫 탐험의 흔적을 기록하며');
            await expect(page.getByTestId('story-journal')).not.toContainText('제국 연구자들의 봉인 기록을 찾아냈다');
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
            expect(overflow).toBe(false);
            await page.screenshot({ path: `output/playwright/product-20260928/story-reload-${width}.png` });
        }
    });

    test('선택지를 밀지 않고 현재 지역 일러스트를 남는 공간에 보여 준다', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);

        await page.getByTestId('control-expedition-start').click();
        await expect(page.getByTestId('terminal-location-visual')).toHaveAttribute(
            'data-location-visual',
            'quiet-forest',
        );

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectEvent?.());
        const panel = page.getByTestId('event-panel');
        const visual = page.getByTestId('event-location-visual');
        const firstChoice = page.getByTestId('event-choice-0');

        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(visual).toHaveAttribute('data-location-visual', 'quiet-forest');
        await expect.poll(() => visual.locator('img').evaluate((image) => (
            image instanceof HTMLImageElement
            && image.complete
            && image.naturalWidth === 96
            && image.naturalHeight === 96
        ))).toBe(true);

        const [panelBounds, visualBounds, choiceBounds] = await Promise.all([
            panel.boundingBox(),
            visual.boundingBox(),
            firstChoice.boundingBox(),
        ]);
        expect(panelBounds).not.toBeNull();
        expect(visualBounds).not.toBeNull();
        expect(choiceBounds).not.toBeNull();
        expect(choiceBounds!.height).toBeGreaterThanOrEqual(72);
        expect(choiceBounds!.y + choiceBounds!.height).toBeLessThanOrEqual(844);
        expect(visualBounds!.x).toBeGreaterThanOrEqual(panelBounds!.x);
        expect(visualBounds!.x + visualBounds!.width).toBeLessThanOrEqual(panelBounds!.x + panelBounds!.width);
        expect(visualBounds!.y).toBeGreaterThanOrEqual(choiceBounds!.y + choiceBounds!.height);
        await expect.poll(async () => {
            const [settledPanel, settledVisual] = await Promise.all([
                panel.boundingBox(),
                visual.boundingBox(),
            ]);
            if (!settledPanel || !settledVisual) return false;
            return settledVisual.y + settledVisual.height <= settledPanel.y + settledPanel.height + 0.5;
        }).toBe(true);

        await page.evaluate(() => document.fonts.ready);
        await expect.poll(() => panel.evaluate((viewport) => ({
            hasVerticalOverflow: viewport.scrollHeight > viewport.clientHeight + 1,
            overflowX: getComputedStyle(viewport).overflowX,
        }))).toEqual({
            hasVerticalOverflow: false,
            overflowX: 'hidden',
        });

        await page.screenshot({
            path: 'playtest-artifacts/mobile-event-choice/event-location-390x844.png',
            fullPage: false,
        });
    });
});
