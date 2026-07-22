import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const VIEWPORTS = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => (
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    ));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];

    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11
        ? [{ text: element.textContent?.trim() || '', fontSize }]
        : [];
}));

const expectNoHorizontalOverflow = async (page: Page, root: Locator) => {
    const appShell = page.locator('[data-app-shell]');

    await expect.poll(async () => root.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= -1 && bounds.right <= window.innerWidth + 1;
    }), { timeout: 4_000 }).toBe(true);

    const geometry = await root.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
            left: bounds.left,
            right: bounds.right,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            viewportWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
        };
    });
    const shellGeometry = await appShell.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
    }));

    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(shellGeometry.scrollLeft).toBe(0);
    expect(shellGeometry.scrollWidth).toBeLessThanOrEqual(shellGeometry.clientWidth);
};

const expectReadableSurface = async (page: Page, root: Locator) => {
    await expect(root).toBeVisible({ timeout: 8_000 });
    expect(await findUndersizedText(root)).toEqual([]);
    await expectNoHorizontalOverflow(page, root);
};

const expectTouchTarget = async (target: Locator, minimum = 44) => {
    await expect(target).toBeVisible();
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(minimum);
    expect(bounds!.width).toBeGreaterThanOrEqual(minimum);
};

const columnCount = (grid: Locator) => grid.evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
));

const expectTransientEffectsSettled = async (page: Page) => {
    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
    await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
};

const expectRouteBranchesWithinMap = async (map: Locator) => {
    const geometry = await map.getByTestId('map-topology').evaluate((topology) => {
        const bounds = topology.getBoundingClientRect();
        const branches = [...topology.querySelectorAll('.aether-route-topology-branch')].map((branch) => {
            const branchBounds = branch.getBoundingClientRect();
            return { left: branchBounds.left, right: branchBounds.right };
        });
        return { left: bounds.left, right: bounds.right, branches };
    });

    for (const branch of geometry.branches) {
        expect(branch.left).toBeGreaterThanOrEqual(geometry.left - 1);
        expect(branch.right).toBeLessThanOrEqual(geometry.right + 1);
    }
};

for (const viewport of VIEWPORTS) {
    test(`${viewport.width}x${viewport.height} 핵심 원정 화면이 읽기 크기와 폭을 지킨다`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({
            ...devices['iPhone 12'],
            baseURL: baseURL || 'http://localhost:4173',
            viewport: { ...viewport },
            screen: { ...viewport },
        });
        const page = await context.newPage();

        try {
            await startE2ERun(page);
            await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());

            const preparation = page.getByTestId('control-expedition-prep');
            await expectReadableSurface(page, preparation);
            await expectTouchTarget(page.getByTestId('control-town-primary').locator('button'));

            await page.getByTestId('control-quests').click();
            const questBoard = page.getByTestId('quest-board-panel');
            await expectReadableSurface(page, questBoard);
            await expectTouchTarget(page.getByTestId('quest-board-start-operation').first());
            await expectTransientEffectsSettled(page);
            if (viewport.width === 390) {
                await page.screenshot({ path: 'playtest-artifacts/mobile-legibility/quest-board-390x844.png' });
            }

            const firstMission = page.getByTestId('quest-featured-list').getByTestId('quest-decision-row').first();
            await firstMission.getByTestId('quest-board-start-operation').click();
            await expectReadableSurface(page, preparation);
            if (viewport.width === 390) {
                await page.screenshot({ path: 'playtest-artifacts/mobile-legibility/expedition-prep-390x844.png' });
            }

            const startExpedition = page.getByTestId('control-expedition-start');
            await expectTouchTarget(startExpedition);
            await startExpedition.click();

            const missionTracker = page.getByTestId('control-mission-tracker');
            await expectReadableSurface(page, missionTracker);
            const missionGrid = missionTracker.locator('.grid').last();
            expect(await columnCount(missionGrid)).toBe(viewport.width <= 390 ? 2 : 4);
            if (viewport.width === 390) {
                await page.screenshot({ path: 'playtest-artifacts/mobile-legibility/mission-tracker-390x844.png' });
            }

            await page.getByTestId('control-map-open').click();
            const map = page.getByTestId('map-navigator');
            await expectReadableSurface(page, map);
            await expectTouchTarget(page.getByTestId('map-move-selected'));
            expect(await columnCount(page.getByTestId('map-route-forecast'))).toBe(viewport.width <= 390 ? 2 : 4);
            await expectRouteBranchesWithinMap(map);
            if (viewport.width === 390) {
                await page.screenshot({ path: 'playtest-artifacts/mobile-legibility/map-390x844.png' });
            }

            await page.getByTestId('mobile-console-return-log').click();
            await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
            const combat = page.getByTestId('combat-focus-panel');
            await expectReadableSurface(page, combat);
            for (const action of ['attack', 'skill', 'item', 'escape']) {
                await expectTouchTarget(page.getByTestId(`combat-action-${action}`));
            }
            const combatIcon = combat.locator('.aether-combat-action-icon').first();
            const iconBounds = await combatIcon.boundingBox();
            expect(iconBounds).not.toBeNull();
            expect(iconBounds!.width).toBeGreaterThanOrEqual(28);
            expect(iconBounds!.height).toBeGreaterThanOrEqual(28);
            if (viewport.width === 390) {
                await page.screenshot({ path: 'playtest-artifacts/mobile-legibility/combat-390x844.png' });
            }

            await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionDebriefScenario?.());
            const debrief = page.getByTestId('expedition-debrief-card');
            await expectReadableSurface(page, debrief);
            await expectTouchTarget(page.getByTestId('expedition-debrief-primary-action'));
            await expect(debrief).toHaveCSS('opacity', '1');
            await expect(debrief.locator('..')).toHaveCSS('opacity', '1');

            await page.screenshot({
                path: `playtest-artifacts/mobile-legibility/${viewport.width}x${viewport.height}.png`,
                fullPage: false,
            });
        } finally {
            await context.close();
        }
    });
}

test('선명하게 모드는 확대 변형 없이 본문 크기와 행간을 높인다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const bodyText = page.getByTestId('control-expedition-prep').locator('.aether-type-body').first();
    const standard = await bodyText.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
        };
    });

    await page.getByTestId('status-character-chip').click();
    await page.locator('[data-testid$="-tab-system"]').first().click();
    await page.getByTestId('readability-mode-high').click();
    await expect(page.locator('[data-app-shell]')).toHaveAttribute('data-readability-mode', 'high');
    await page.getByTestId('mobile-console-return-log').click();

    const high = await bodyText.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
            transform: style.transform,
        };
    });

    expect(high.fontSize).toBeGreaterThan(standard.fontSize);
    expect(high.lineHeight).toBeGreaterThan(standard.lineHeight);
    expect(high.transform).toBe('none');
    await expectReadableSurface(page, page.getByTestId('control-expedition-prep'));
});
