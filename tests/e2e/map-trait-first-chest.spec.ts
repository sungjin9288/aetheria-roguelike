import { test, expect, type Locator, type Page } from '@playwright/test';
import { startE2ERun, stepField, walkFieldTo } from './testHelpers';

/**
 * E2E: 지도 갈래 · 첫 여정의 첫 상자(2026-11, docs/PRE_PLAYTEST_FEATURES_2026-11.md §1 · §2).
 *   클리어한 지역의 새 지도 → 카드 2 ~ 3장(기본 선택 없음) → 고르고 확정 → 그 지도의 상자 수 · 리로드 유지 / 고르지 않기 → 보통 지도.
 *   계정 첫 여정의 첫 상자 → 유물 3장 → 리로드해도 같은 제안 → 고르면 지도로 돌아오고 둘째 상자는 보통 상자다.
 *   판정의 정본은 tests/field-map-trait-contract.test.js · first-chest-relic-contract.test.js다. 여기서는 화면 경로와 세 폭의 배치를 본다.
 */

const SAVE_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';
const SIZES = [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }];

const readState = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
const seed = async (page: Page, kind: 'trait' | 'firstChest') => {
    expect(await page.evaluate((value) => window.__AETHERIA_TEST_API__?.seedFieldMapScenario?.(value), kind)).toBe(true);
};

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [{ text: element.textContent?.trim() || '', fontSize }] : [];
}));

const findClippedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    // 화면 낭독기 전용 글(sr-only)은 의도된 1px라 뺀다.
    if (!(element instanceof HTMLElement) || element.offsetParent === null || element.closest('.sr-only')) return [];
    const hasOwnText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
    if (!hasOwnText) return [];
    const style = getComputedStyle(element);
    const clipsX = element.scrollWidth > element.clientWidth + 1 && style.overflowX !== 'visible';
    const clipsY = element.scrollHeight > element.clientHeight + 1 && style.overflowY !== 'visible';
    const ellipsis = style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1;
    return clipsX || clipsY || ellipsis ? [element.textContent?.trim() || ''] : [];
}));

const expectPanelLayout = async (page: Page, panel: Locator, width: number) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, '가로 넘침 없음').toBeLessThanOrEqual(0);
    expect(await findUndersizedText(panel)).toEqual([]);
    expect(await findClippedText(panel)).toEqual([]);
    for (const button of await panel.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box, '단추가 그려진다').not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
};

/** 바로 옆 칸의 열지 않은 상자와 그 방향 */
const adjacentChest = async (page: Page) => {
    const { player } = await readState(page);
    const { width, chests } = player.fieldLayout;
    const pos = player.fieldMap.pos;
    const dirs = { up: -width, down: width, left: -1, right: 1 } as const;
    for (const [direction, delta] of Object.entries(dirs) as Array<[keyof typeof dirs, number]>) {
        const hit = chests.find((chest: { id: number; index: number }) => chest.index === pos + delta && !player.fieldMap.openedChests.includes(chest.id));
        if (hit) return { direction, chest: hit };
    }
    throw new Error('옆에 열지 않은 상자가 없다');
};

for (const { width, height } of SIZES) {
    test.describe(`지도 갈래 · 첫 상자 @${width}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width, height });
            await startE2ERun(page);
        });

        test('클리어한 지역의 새 지도 — 카드 셋 · 기본 선택 없음 · 고르면 그 성격의 지도, 카드가 다시 뜨지 않는다', async ({ page }) => {
            await seed(page, 'trait');
            const panel = page.getByTestId('field-trait-panel');
            await expect(panel).toBeVisible({ timeout: 8_000 });
            const before = (await readState(page)).player;
            const cards = page.locator('[data-testid^="field-trait-card-"]');
            await expect(cards).toHaveCount(3);
            await expect(page.getByTestId('field-trait-card-plain')).toBeVisible();
            await expect(page.getByTestId('field-trait-card-elite')).toContainText('정예');
            await expect(panel.locator('[aria-pressed="true"]')).toHaveCount(0);
            await expect(page.getByTestId('field-trait-confirm')).toBeDisabled();
            await expectPanelLayout(page, panel, width);
            await panel.screenshot({ path: `playtest-artifacts/map-trait/map-trait-${width}.png`, animations: 'disabled' });

            await page.getByTestId('field-trait-card-elite').click();
            await expect(page.getByTestId('field-trait-card-elite')).toHaveAttribute('aria-pressed', 'true');
            await expect(page.getByTestId('field-trait-confirm')).toBeEnabled();
            await page.getByTestId('field-trait-confirm').click();
            await expect(panel).toHaveCount(0);
            const after = (await readState(page)).player;
            expect(after.fieldMap.trait).toBe('elite');
            expect(after.fieldMap.seed).toBe(before.fieldMap.seed);
            expect(after.fieldLayout.tiles).toBe(before.fieldLayout.tiles);
            await expect(page.getByTestId('field-map')).toBeVisible();
        });

        test('고르지 않기 · Escape는 보통 지도다 — 걷던 그대로 걷는다', async ({ page }) => {
            await seed(page, 'trait');
            await expect(page.getByTestId('field-trait-panel')).toBeVisible({ timeout: 8_000 });
            await page.getByTestId('field-trait-skip').click();
            await expect(page.getByTestId('field-trait-panel')).toHaveCount(0);
            expect((await readState(page)).player.fieldMap.trait).toBe('plain');
            await seed(page, 'trait');
            await expect(page.getByTestId('field-trait-panel')).toBeVisible({ timeout: 8_000 });
            await page.keyboard.press('Escape');
            await expect(page.getByTestId('field-trait-panel')).toHaveCount(0);
            expect((await readState(page)).player.fieldMap.trait).toBe('plain');
            await expect(page.getByTestId('field-pad-up')).toBeEnabled({ timeout: 8_000 });
        });

        test('첫 여정의 첫 상자 — 유물 셋이 뜨고, 고르면 지도로 돌아와 둘째 상자는 보통 상자다', async ({ page }) => {
            await seed(page, 'firstChest');
            await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
            const before = (await readState(page)).player;
            const { direction, chest } = await adjacentChest(page);
            await stepField(page, direction);
            const panel = page.getByTestId('relic-choice-panel');
            await expect(panel).toBeVisible({ timeout: 8_000 });
            await expect(page.getByTestId('relic-choice-2')).toBeVisible();
            await expectPanelLayout(page, panel, width);
            const opened = (await readState(page)).player;
            expect(opened.fieldMap.openedChests).toContain(chest.id);
            expect(opened.fieldMap.pending).toBeNull();
            expect(opened.gold).toBeGreaterThan(before.gold);
            expect(opened.firstChestRelic).toBe(true);

            await page.getByTestId('relic-choice-0').click();
            await expect(panel).toBeHidden({ timeout: 8_000 });
            await expect(page.getByTestId('field-pad-up')).toBeEnabled({ timeout: 8_000 });

            const next = (await readState(page)).player;
            const other = next.fieldLayout.chests.find((entry: { id: number }) => !next.fieldMap.openedChests.includes(entry.id));
            await walkFieldTo(page, other.index);
            await expect.poll(async () => {
                const state = await readState(page);
                return state.player.fieldMap.openedChests.includes(other.id);
            }).toBe(true);
            await expect(page.getByTestId('relic-choice-panel')).toHaveCount(0);
        });
    });
}

test('첫 상자의 유물 선택 중 리로드해도 같은 제안이 다시 뜨고, 받은 기록이 남는다', async ({ page }) => {
    await page.goto('/?e2e=1&deviceQa=system-settings');
    await expect.poll(async () => (await readState(page)).player?.level, { timeout: 20_000 }).toBe(18);
    await seed(page, 'firstChest');
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
    const { direction } = await adjacentChest(page);
    await stepField(page, direction);
    await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 8_000 });
    const offered = (await readState(page)).pendingRelics;
    expect(offered).toHaveLength(3);
    await expect.poll(() => page.evaluate((key) => {
        const save = JSON.parse(localStorage.getItem(key) || '{}');
        return `${save.pendingRelics?.length ?? 0}|${save.player?.stats?.firstChestRelic ?? false}`;
    }, SAVE_KEY)).toBe('3|true');
    await page.reload();
    await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 20_000 });
    expect((await readState(page)).pendingRelics).toEqual(offered);
    await page.getByTestId('relic-choice-0').click();
    await expect(page.getByTestId('relic-choice-panel')).toBeHidden({ timeout: 8_000 });
    expect((await readState(page)).player.firstChestRelic).toBe(true);
});

test('고른 성격은 저장되어 리로드 뒤에도 그 지도이고 카드가 다시 뜨지 않는다', async ({ page }) => {
    await page.goto('/?e2e=1&deviceQa=system-settings');
    await expect.poll(async () => (await readState(page)).player?.level, { timeout: 20_000 }).toBe(18);
    await seed(page, 'trait');
    await expect(page.getByTestId('field-trait-panel')).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('field-trait-card-elite').click();
    await page.getByTestId('field-trait-confirm').click();
    await expect(page.getByTestId('field-trait-panel')).toHaveCount(0);
    await expect.poll(() => page.evaluate((key) => (
        JSON.parse(localStorage.getItem(key) || '{}').player?.fieldMap?.trait ?? null
    ), SAVE_KEY)).toBe('elite');
    await page.reload();
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    await expect(page.getByTestId('field-trait-panel')).toHaveCount(0);
    expect((await readState(page)).player.fieldMap.trait).toBe('elite');
});
