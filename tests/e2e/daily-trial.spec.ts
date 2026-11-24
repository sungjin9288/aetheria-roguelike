import { expect, test, type Page } from '@playwright/test';
import { openTownFacilities, readFieldSnapshot, settleFieldInterruption, startE2ERun, stepField, waitForModeTransition } from './testHelpers';

/**
 * E2E: 오늘의 시련(docs/PRE_PLAYTEST_FEATURES_2026-11.md §3). 안전지대의 입구 → 조건 시트 → 시작 → 지도 걷기 · 전투 → 보스 문 → 결과 →
 * 본편 그대로. 세 폭의 배치와 본편 저장 칸이 시련 동안 바뀌지 않는 것을 본다. 판정의 정본은 tests/daily-trial-contract.test.js다.
 *
 * 시련은 날짜가 정하므로 시계를 한 날로 옮겨 놓고(흐르는 시계) 잰다.
 */

const DAY = '2026-12-05';
const SETTINGS_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';
const TRIAL_KEY = 'aetheria.daily-trial.v1';
const ARCHIVE_TABS_IN_TRIAL = ['equipment', 'inventory', 'skills', 'stats'];

const SIZES = [
    { label: '375×812', width: 375, height: 812 },
    { label: '390×844', width: 390, height: 844 },
    { label: '430×932', width: 430, height: 932 },
];

const readState = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

/** 흐르는 시계를 시련 날짜의 낮으로 옮긴다 — 다시 불러와도 같은 날이다. */
const shiftClock = async (page: Page) => {
    const offset = new Date(`${DAY}T12:00:00`).getTime() - Date.now();
    await page.addInitScript((shift) => {
        const Original = Date;
        const now = () => Original.now() + shift;
        class ShiftedDate extends Original {
            constructor(...args: ConstructorParameters<typeof Date> | []) {
                if (args.length === 0) super(now());
                else super(...(args as ConstructorParameters<typeof Date>));
            }

            static now() { return now(); }
        }
        window.Date = ShiftedDate as DateConstructor;
    }, offset);
};

const seedTrial = (page: Page, kind: 'entry' | 'door' | 'doomed') => page.evaluate(
    (value) => window.__AETHERIA_TEST_API__?.seedDailyTrialScenario?.(value), kind,
);

/** 입구가 열린 여정(첫 전직 뒤 시작의 마을) — 바뀐 상태가 선 뒤의 플레이어를 돌려준다. */
const enterTown = async (page: Page) => {
    expect(await seedTrial(page, 'entry')).toBe(true);
    await expect.poll(async () => (await readState(page)).player?.level, { timeout: 8_000 }).toBe(12);
    return (await readState(page)).player;
};

const openEntrance = async (page: Page) => {
    await openTownFacilities(page);
    const entrance = page.getByTestId('control-daily-trial');
    await expect(entrance).toBeVisible();
    await entrance.click();
    await expect(page.getByTestId('daily-trial-sheet')).toBeVisible();
};

const startTrial = async (page: Page) => {
    await openEntrance(page);
    await page.getByTestId('daily-trial-start').click();
    await expect(page.getByTestId('daily-trial-hud')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
};

const leaveTrial = async (page: Page) => {
    await page.getByTestId('daily-trial-leave').click();
    await expect(page.getByTestId('daily-trial-leave-dialog')).toBeVisible();
    await page.getByTestId('daily-trial-leave-confirm').click();
    await expect(page.getByTestId('daily-trial-result')).toBeVisible();
};

/** 뿌리 안의 글자 11px · 단추 44px · 가로 넘침 없음 */
const expectLegible = async (page: Page, testId: string, width: number) => {
    const measured = await page.getByTestId(testId).evaluate((root) => {
        const visible = (node: Element) => node.getClientRects().length > 0 && !node.closest('.sr-only');
        const texts = [...root.querySelectorAll('*'), root].filter((node) => visible(node)
            && [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()));
        const buttons = [...root.querySelectorAll('button')].filter(visible).filter((node) => !node.closest('.ae-dock-pad'));
        return {
            smallest: Math.min(...texts.map((node) => parseFloat(getComputedStyle(node).fontSize))),
            buttons: buttons.map((node) => {
                const box = node.getBoundingClientRect();
                return { id: node.getAttribute('data-testid') ?? node.textContent ?? '', width: box.width, height: box.height, left: box.left, right: box.right };
            }),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
    });
    expect(measured.smallest, `${testId} 글자`).toBeGreaterThanOrEqual(11);
    for (const button of measured.buttons) {
        expect(button.width, `${button.id} 너비`).toBeGreaterThanOrEqual(43.5);
        expect(button.height, `${button.id} 높이`).toBeGreaterThanOrEqual(43.5);
        expect(button.left, `${button.id} 왼쪽`).toBeGreaterThanOrEqual(0);
        expect(button.right, `${button.id} 오른쪽`).toBeLessThanOrEqual(width + 0.5);
    }
    expect(measured.overflow, `${testId} 가로 넘침`).toBeLessThanOrEqual(0);
};

/** 화면 아래를 넘지 않고 눌린다 */
const expectInsideViewport = async (page: Page, testId: string, height: number) => {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box, testId).not.toBeNull();
    expect(box!.y + box!.height, `${testId} 아래`).toBeLessThanOrEqual(height + 0.5);
};

for (const size of SIZES) {
    test(`${size.label}: 입구 시트 · 걷기 · 나가기 · 결과 배치 — 나오면 여정 그대로다`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: size.width, height: size.height });
        await shiftClock(page);
        await startE2ERun(page, { name: '용사' });

        // 첫 전직 전에는 입구가 없다.
        await openTownFacilities(page);
        await expect(page.getByTestId('control-market')).toBeVisible();
        await expect(page.getByTestId('control-daily-trial')).toHaveCount(0);

        const before = await enterTown(page);
        await openEntrance(page);
        await expectLegible(page, 'daily-trial-sheet', size.width);
        await expect(page.getByTestId('daily-trial-history')).toContainText('지난 기록이 없습니다');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('daily-trial-sheet')).toHaveCount(0);

        await startTrial(page);
        await waitForModeTransition(page);
        const walking = (await readState(page)).player;
        expect(walking.trialRun).toEqual({ dayKey: DAY, map: 1 });
        await expectLegible(page, 'daily-trial-hud', size.width);
        await expectLegible(page, 'daily-trial-dock', size.width);
        for (const id of ['field-walk-start', 'control-open-bag']) await expectInsideViewport(page, id, size.height);
        for (const id of ['control-move', 'control-map-open', 'control-scout', 'control-explore', 'field-auto-start']) {
            await expect(page.getByTestId(id), id).toHaveCount(0);
        }

        // 기록은 장비 · 가방 · 기술 · 상태만 연다.
        await page.getByTestId('control-open-bag').click();
        await expect(page.getByTestId('archive-tab-inventory')).toBeVisible();
        const tabs = await page.locator('button[data-testid^="archive-tab-"]:not([data-testid^="archive-tab-rail"])').evaluateAll((nodes) => nodes
            .map((node) => node.getAttribute('data-testid') ?? ''));
        expect(tabs.map((id) => id.replace('archive-tab-', '')).sort()).toEqual([...ARCHIVE_TABS_IN_TRIAL].sort());
        await page.getByTestId('mobile-console-return-log').click();

        await page.getByTestId('daily-trial-leave').click();
        await expectLegible(page, 'daily-trial-leave-dialog', size.width);
        await expect(page.getByTestId('daily-trial-leave-dialog').locator('[data-variant="primary"]')).toHaveCount(1);
        await page.getByTestId('daily-trial-leave-stay').click();
        await expect(page.getByTestId('daily-trial-leave-dialog')).toHaveCount(0);
        await leaveTrial(page);
        await expect(page.getByTestId('daily-trial-result')).toHaveAttribute('data-outcome', 'left');
        await expectLegible(page, 'daily-trial-result', size.width);
        await page.getByTestId('daily-trial-return').click();

        await expect(page.getByTestId('daily-trial-hud')).toHaveCount(0);
        await expect(page.getByTestId('control-town-facilities')).toBeVisible({ timeout: 8_000 });
        const after = (await readState(page)).player;
        expect(after.dailyTrialDays).toEqual([{ day: DAY, tries: 1, best: null }]);
        expect({ ...after, dailyTrialDays: [] }).toEqual({ ...before, dailyTrialDays: [] });
    });
}

test('걷기 → 조우 → 전투 → 셋째 지도의 보스 문 → 완주 → 여정 복귀 · 오늘의 최고가 남는다', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await shiftClock(page);
    await startE2ERun(page, { name: '용사' });
    const before = await enterTown(page);
    await startTrial(page);

    // 조우가 날 때까지 밟지 않은 칸으로 걷는다 — 전투 화면에도 시련 줄이 남는다.
    const deltas = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] } as const;
    for (let step = 0; step < 120; step += 1) {
        const snapshot = await readFieldSnapshot(page);
        if (snapshot.gameState !== 'idle') break;
        const { layout, pos } = snapshot;
        if (!layout || pos === null) throw new Error('시련 지도가 없다');
        const avoid = new Set([...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
        const neighbors = (Object.keys(deltas) as Array<keyof typeof deltas>).map((direction) => ({
            direction,
            index: (Math.floor(pos / layout.width) + deltas[direction][1]) * layout.width + (pos % layout.width) + deltas[direction][0],
        })).filter(({ index }) => layout.tiles[index] !== undefined && layout.tiles[index] !== '#' && !avoid.has(index));
        const next = neighbors.find(({ index }) => !snapshot.visited.includes(index)) ?? neighbors[step % neighbors.length];
        if (snapshot.pending) { await page.waitForTimeout(80); continue; }
        await stepField(page, next.direction).catch(() => undefined);
        await page.waitForTimeout(60);
    }
    await expect.poll(async () => (await readState(page)).gameState, { timeout: 8_000 }).not.toBe('idle');
    await expect(page.getByTestId('daily-trial-hud')).toBeVisible();
    await settleFieldInterruption(page, 60_000);
    await expect(page.getByTestId('daily-trial-hud-text')).toContainText(/행동 [1-9]\d*번/);

    const toward = await seedTrial(page, 'door');
    expect(typeof toward).toBe('string');
    await expect(page.getByTestId('daily-trial-hud-text')).toContainText('지도 3/3');
    await stepField(page, toward as 'up' | 'down' | 'left' | 'right');
    await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('event-choice-0').click();
    for (let turn = 0; turn < 12 && !(await page.getByTestId('daily-trial-result').isVisible()); turn += 1) {
        await page.getByTestId('combat-action-attack').click({ timeout: 4_000 }).catch(() => undefined);
        await page.waitForTimeout(400);
    }
    const result = page.getByTestId('daily-trial-result');
    await expect(result).toHaveAttribute('data-outcome', 'cleared');
    await expect(page.getByTestId('daily-trial-result-maps')).toHaveText('3/3');
    await expect(page.getByTestId('daily-trial-result-best')).toBeVisible();
    await expect(page.getByTestId('post-combat-card')).toHaveCount(0);
    await page.getByTestId('daily-trial-return').click();
    await expect(page.getByTestId('control-town-facilities')).toBeVisible({ timeout: 8_000 });

    const after = (await readState(page)).player;
    expect(after.dailyTrialDays[0]).toMatchObject({ day: DAY, tries: 1, best: { cleared: true, maps: 3 } });
    expect({ ...after, dailyTrialDays: [] }).toEqual({ ...before, dailyTrialDays: [] });
    await openEntrance(page);
    await expect(page.getByTestId('daily-trial-best')).toContainText('완주');
});

test('쓰러지면 시련만 끝난다 — 사망 화면 · 묘비 없이 여정으로 돌아온다', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await shiftClock(page);
    await startE2ERun(page, { name: '용사' });
    const before = await enterTown(page);
    await startTrial(page);
    expect(await seedTrial(page, 'door')).toBeTruthy();
    const toward = await seedTrial(page, 'door');
    await seedTrial(page, 'doomed');
    await stepField(page, toward as 'up' | 'down' | 'left' | 'right');
    await page.getByTestId('event-choice-0').click();
    for (let turn = 0; turn < 12 && !(await page.getByTestId('daily-trial-result').isVisible()); turn += 1) {
        await page.getByTestId('combat-action-attack').click({ timeout: 4_000 }).catch(() => undefined);
        await page.waitForTimeout(400);
    }
    await expect(page.getByTestId('daily-trial-result')).toHaveAttribute('data-outcome', 'dead');
    await expect(page.getByTestId('daily-trial-result-maps')).toHaveText('2/3');
    await expect(page.getByTestId('run-summary-card')).toHaveCount(0);
    await page.getByTestId('daily-trial-return').click();
    await expect(page.getByTestId('control-town-facilities')).toBeVisible({ timeout: 8_000 });
    const after = (await readState(page)).player;
    expect({ ...after, dailyTrialDays: [] }).toEqual({ ...before, dailyTrialDays: [] });
});

test('시련 동안 여정의 저장 칸은 바뀌지 않고, 다시 열면 여정이 그대로 서고 시련은 입구에서 이어진다', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await shiftClock(page);
    await page.goto('/?e2e=1&deviceQa=system-settings', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SETTINGS_KEY), { timeout: 20_000 }).toBe(true);
    for (const id of ['return-briefing-close-icon', 'milestone-story-close', 'expedition-debrief-close']) {
        const close = page.getByTestId(id);
        if (await close.isVisible().catch(() => false)) await close.click();
    }
    await expect.poll(() => seedTrial(page, 'entry'), { timeout: 8_000 }).toBe(true);
    await page.waitForTimeout(1_500);
    for (const id of ['return-briefing-close-icon', 'milestone-story-close', 'mobile-console-return-log']) {
        const close = page.getByTestId(id);
        if (await close.isVisible().catch(() => false)) await close.click();
    }
    await startTrial(page);
    await page.waitForTimeout(1_500);
    const readSave = () => page.evaluate((key) => localStorage.getItem(key), SETTINGS_KEY);
    const mainSave = await readSave();
    expect(JSON.parse(mainSave!).player.trialRun ?? null).toBeNull();

    // 걷고, 백그라운드로 보내고(저장 강제) 기다려도 여정의 칸은 같은 글자다.
    await page.getByTestId('field-walk-start').click();
    await page.waitForTimeout(2_500);
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.flushLocalSave?.());
    await page.waitForTimeout(1_200);
    expect(await readSave()).toBe(mainSave);
    // 자동 걷기를 멈추고(조우에서 이미 멈췄을 수 있다) 마지막 걸음이 저장되기를 기다린다.
    if (await page.getByTestId('field-walk-stop').isVisible().catch(() => false)) await page.getByTestId('field-walk-stop').click();
    await page.waitForTimeout(1_200);
    const trialSave = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), TRIAL_KEY);
    expect(trialSave?.dayKey).toBe(DAY);

    await page.reload();
    await expect.poll(async () => (await readState(page)).player?.job, { timeout: 20_000 }).toBe(JSON.parse(mainSave!).player.job);
    expect((await readState(page)).player.trialRun).toBeNull();
    await expect(page.getByTestId('daily-trial-hud')).toHaveCount(0);
    for (const id of ['return-briefing-close-icon', 'milestone-story-close']) {
        const close = page.getByTestId(id);
        if (await close.isVisible().catch(() => false)) await close.click();
    }
    await openEntrance(page);
    await expect(page.getByTestId('daily-trial-resume-note')).toContainText('지도 1/3');
    await page.getByTestId('daily-trial-start').click();
    await expect(page.getByTestId('daily-trial-hud-text')).toContainText(`행동 ${trialSave.actions}번`, { timeout: 8_000 });
    expect((await readState(page)).player.fieldMap.visited).toEqual(trialSave.state.player.fieldMap.visited);
});
