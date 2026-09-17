import { expect, test, type Page } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

const readRenderedState = (page: Page) => page.evaluate(() => (
    JSON.parse(window.render_game_to_text?.() || '{}')
));

const dismissMilestoneIfPresent = async (page: Page) => {
    const milestone = page.getByTestId('milestone-story-card');
    if (await milestone.isVisible().catch(() => false)) {
        await page.getByTestId('milestone-story-close').click();
    }
};

const winCurrentCombat = async (page: Page) => {
    for (let turn = 0; turn < 16; turn += 1) {
        const before = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getTrueEndingJourneySnapshot?.()
        ));
        if (before?.gameState !== 'combat') break;
        const armed = await page.evaluate((seed) => (
            window.__AETHERIA_TEST_API__?.armNextCombatSeed?.(seed)
        ), turn + 1);
        expect(armed).toBe(true);
        await page.getByTestId('combat-action-attack').click();
        await expect.poll(async () => {
            const after = await page.evaluate(() => (
                window.__AETHERIA_TEST_API__?.getTrueEndingJourneySnapshot?.()
            ));
            return after?.gameState !== 'combat'
                || after?.combatTurn > before.combatTurn
                || after?.enemy?.hp !== before?.enemy?.hp;
        }, { timeout: 5_000 }).toBe(true);
    }
    const finished = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.getTrueEndingJourneySnapshot?.()
    ));
    expect(finished.gameState).not.toBe('combat');
    expect(finished.gameState).not.toBe('dead');
};

const assertNoHorizontalOverflow = async (page: Page, testId: string) => {
    // Motion surfaces enter with a short scale transition. Measure the settled hit area.
    await page.waitForTimeout(400);
    const metrics = await page.getByTestId(testId).evaluate((root) => ({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        localOverflow: root.scrollWidth - root.clientWidth,
        bounds: root.getBoundingClientRect().toJSON(),
        minButtonHeight: Math.min(
            ...[...root.querySelectorAll<HTMLElement>('button')]
                .map((button) => button.getBoundingClientRect().height),
        ),
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.localOverflow).toBeLessThanOrEqual(1);
    expect(metrics.bounds.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.bounds.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.bounds.top).toBeGreaterThanOrEqual(-1);
    expect(metrics.bounds.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.minButtonHeight).toBeGreaterThanOrEqual(44);
};

test.describe('release-complete player journey', () => {
    test('fresh creation performs first expedition, combat, safe return, equipment and job choice through UI', async ({ page }) => {
        test.slow();
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);

        await page.getByTestId('control-town-primary').getByRole('button').click();
        await expect(page.getByTestId('control-explore')).toBeVisible();
        let state = await readRenderedState(page);
        expect(state.player.loc).toBe('고요한 숲');
        expect(state.player.activeExpeditionId).toBeTruthy();

        await page.getByTestId('control-explore').click();
        await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 8_000 });
        await page.getByTestId('event-choice-0').click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });

        const armed = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(112596)
        ));
        expect(armed).toBe(true);
        await page.getByTestId('control-explore').click();
        await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 10_000 });
        await winCurrentCombat(page);
        const postCombat = page.getByTestId('post-combat-card');
        if (await postCombat.isVisible().catch(() => false)) {
            await page.getByTestId('post-combat-continue').click();
        }

        await page.getByTestId('control-move').click();
        await page.getByTestId('control-route-option-시작의 마을').click();
        const debrief = page.getByTestId('expedition-debrief-card');
        await expect(debrief).toBeVisible({ timeout: 8_000 });
        await expect(debrief).toContainText(/전투\s*1회/);
        await expect(debrief).toContainText(/탐험\s*[2-9]회/);
        await assertNoHorizontalOverflow(page, 'expedition-debrief-card');
        state = await readRenderedState(page);
        expect(state.player.loc).toBe('시작의 마을');
        expect(state.player.lastExpeditionSummaryId).toBeTruthy();
        await page.getByTestId('expedition-debrief-close-icon').click();
        await dismissMilestoneIfPresent(page);

        const equipmentSeeded = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('early-gear-choice')
        ));
        expect(equipmentSeeded).toBe(true);
        await page.getByTestId('status-character-chip').click();
        await page.locator('[data-testid$="-tab-inventory"]').first().click();
        const equipmentDecision = page.getByTestId('inventory-equipment-decision-smoke-early-armor');
        await expect(equipmentDecision).toContainText('추천 교체');
        const equipmentCard = equipmentDecision.locator('xpath=../..');
        await equipmentCard.getByRole('button', { name: '장착', exact: true }).click();
        await expect(equipmentDecision).toBeHidden();
        await page.locator('[data-testid$="-tab-equipment"]').first().click();
        await page.getByTestId('equipment-detail-toggle').click();
        await expect(page.getByTestId('equipment-slot-armor')).toContainText('튼튼한 여행복');

        const growthSeeded = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedProgressionAcceptanceScenario?.()
        ));
        expect(growthSeeded).toBe(true);
        await page.getByTestId('mobile-console-return-log').click();
        await openTownFacilities(page);
        await page.getByTestId('control-class').click();
        await page.getByTestId('job-change-option').filter({ hasText: '전사' }).click();
        await page.getByTestId('job-change-confirm').click();
        await expect(page.getByTestId('job-change-panel')).toBeHidden();
        await expect(page.getByTestId('milestone-story-card')).toBeVisible({ timeout: 5_000 });
        await page.getByTestId('milestone-story-close').click();

        await page.getByTestId('mobile-console-open-archive').click();
        await page.getByTestId('archive-tab-skills').click();
        await page.getByTestId('skill-branch-choice-파워배시-B').click();
        await page.getByTestId('skill-growth-confirm-파워배시').click();
        const finalGrowth = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(finalGrowth.job).toBe('전사');
        expect(finalGrowth.skillChoices.파워배시).toBe('B');
    });

    test('ascension cancel and confirm are distinct production transitions', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.());
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });

        const beforeCancel = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()
        ));
        await page.getByTestId('ascension-cancel').click();
        const cancelled = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()
        ));
        expect(cancelled.level).toBe(beforeCancel.level);
        expect(cancelled.prestigeRank).toBe(beforeCancel.prestigeRank);

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.());
        await page.getByTestId('ascension-confirm').click();
        const confirmed = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()
        ));
        expect(confirmed.level).toBe(1);
        expect(confirmed.prestigeRank).toBe(beforeCancel.prestigeRank + 1);
    });
});
