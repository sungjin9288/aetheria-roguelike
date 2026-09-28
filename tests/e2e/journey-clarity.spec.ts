import { test, expect, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const expectReadableHud = async (page: Page) => {
    const geometry = await page.locator('[data-testid^="status-metric-"]').filter({ has: page.getByTestId('status-metric-label') }).evaluateAll((cells) => cells.map((cell) => {
        const label = cell.querySelector('[data-testid="status-metric-label"]')!;
        const value = cell.querySelector('[data-testid="status-metric-value"]')!;
        const range = document.createRange(); range.selectNodeContents(label);
        return { labelLines: range.getClientRects().length, labelBottom: label.getBoundingClientRect().bottom, valueTop: value.getBoundingClientRect().top, fits: cell.scrollWidth <= cell.clientWidth };
    }));
    expect(geometry).toHaveLength(3);
    for (const metric of geometry) {
        expect(metric.labelLines).toBe(1);
        expect(metric.labelBottom).toBeLessThanOrEqual(metric.valueTop);
        expect(metric.fits).toBe(true);
    }
};

test('좁은 상태바는 지표 이름과 수치를 겹치거나 잘라 표시하지 않는다', async ({ page }) => {
    await startE2ERun(page, { openStatusConsole: true });
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSystemSettingsScenario());
    await expect(page.getByTestId('system-tab')).toBeVisible();
    await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 4_000 });
    for (const mode of ['standard', 'high']) {
        if (mode === 'high') {
            await page.getByTestId('mobile-console-open-archive').click();
            await page.getByTestId('archive-tab-system').click();
            await page.getByTestId('readability-mode-high').click();
        }
        await page.getByTestId('mobile-console-return-log').click();
        for (const width of [375, 390, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await expectReadableHud(page);
            await expect(page.getByTestId('control-expedition-start')).toBeInViewport();
            await page.screenshot({ path: `output/playwright/clarity-20260928/hud-${mode}-${width}.png` });
        }
    }
});

test('첫 출발의 이유를 읽고 탐험하면 시작 안내가 반복되지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await startE2ERun(page);
    const opening = page.getByTestId('first-journey-context');
    await expect(opening).toContainText('마법전쟁');
    await expect(opening).toContainText('고요한 숲');
    await expect(opening).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('control-expedition-start')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: 'output/playwright/clarity-20260928/first-town-375.png' });
    await page.getByTestId('control-expedition-start').click();
    await expect(opening).toHaveCount(0);
    await page.getByTestId('control-explore').click();
    await page.getByTestId('event-choice-0').click();
    await page.getByTestId('control-move').click();
    await page.getByTestId('control-route-option-시작의 마을').click();
    await page.getByTestId('expedition-debrief-close-icon').click();
    await expect(opening).toHaveCount(0);
});

test('계승 화면과 임무 기록은 현재 단계로 마왕성의 다음 행동을 안내한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);
    await expect(page.getByTestId('endgame-journey')).toHaveCount(0);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario());
    const progress = page.getByTestId('endgame-journey');
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toContainText('현재 계승 2단계');
    await expect(progress).toContainText('원시의 파편 0/3');
    await expect(progress).toContainText('50%');
    await expect(progress).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('ascension-confirm')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: 'output/playwright/clarity-20260928/ascension-progress-390.png' });
    await page.getByTestId('ascension-cancel').click();
    await page.getByTestId('status-character-chip').click();
    await page.getByTestId('archive-tab-quest').click();
    await progress.scrollIntoViewIfNeeded();
    await expect(progress).toContainText('현재 계승 2단계');
    await expect(progress).toContainText('원시의 파편 0/3');
    await page.screenshot({ path: 'output/playwright/clarity-20260928/quest-progress-390.png' });
});


test('긴 수치와 저장된 종장 진행은 재실행 뒤에도 읽을 수 있다', async ({ page }) => {
    await page.goto('/?e2e=1&deviceQa=system-settings');
    const key = 'aetheria.device-qa.system-settings.snapshot.v1';
    await expect.poll(() => page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) || '{}').player?.level, key)).toBe(18);
    const fixture = await page.evaluate((saveKey) => {
        const saved = JSON.parse(localStorage.getItem(saveKey)!);
        saved.player = { ...saved.player, name: '새벽을지키는모험가', job: '팔라딘', level: 75, hp: 19000, maxHp: 25000, mp: 1500, maxMp: 2500, exp: 149999, nextExp: 150000, gold: 1234567,
            meta: { ...saved.player.meta, prestigeRank: 3, endgame: { version: 1, primalShards: 2, trueEndingSeen: false, legacyInventoryMigrated: true, lastEndgameReceiptKey: null } } };
        return JSON.stringify(saved);
    }, key);
    await page.addInitScript(({ saveKey, snapshot }) => localStorage.setItem(saveKey, snapshot), { saveKey: key, snapshot: fixture });
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.level)).toBe(75);
    for (const mode of ['standard', 'high']) {
        if (mode === 'high') {
            await page.getByTestId('status-character-chip').click();
            await page.getByTestId('archive-tab-system').click();
            await page.getByTestId('readability-mode-high').click();
            await page.getByTestId('mobile-console-return-log').click();
        }
        for (const width of [375, 390, 430]) {
            await page.setViewportSize({ width, height: 844 });
            await expectReadableHud(page);
            await expect(page.getByTestId('status-metric-exp')).toContainText('149999/150000');
            expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
            await page.screenshot({ path: `output/playwright/clarity-20260928/hud-long-${mode}-${width}.png` });
        }
    }
    await page.getByTestId('status-character-chip').click();
    await page.getByTestId('archive-tab-quest').click();
    await page.getByTestId('endgame-journey').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('endgame-journey')).toContainText('원시의 파편 2/3');
    await expect(page.getByTestId('endgame-journey-action')).toContainText('마지막 파편');
});
