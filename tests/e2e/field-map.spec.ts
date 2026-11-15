import { test, expect, type Page } from '@playwright/test';
import { exploreOnce, readFieldSnapshot, settleFieldInterruption, startE2ERun, walkFieldTo } from './testHelpers';

/**
 * E2E: 지역 지도 걷기 시제품(docs/OVERWORLD_WALK_DESIGN_2026-11.md §10). 고요한 숲은 탐험 단추 대신 지도와 방향 패드다.
 * 걷기 → 조우(= 탐험 1회) → 전투 → 지도로 돌아옴 → 상자 → 미믹(QA 씨앗) → 상자를 다 열고 나가면 클리어 → 다시 들어와 자동 탐험.
 * 판정의 정본은 tests/field-map-contract.test.js · field-map-reducer-contract.test.js다. 여기서는 화면 경로와 세 폭의 배치를 본다.
 */

const SIZES = [
    { label: 'iPhone mini 375×812', width: 375, height: 812 },
    { label: 'iPhone 14 390×844', width: 390, height: 844 },
    { label: 'iPhone Pro Max 430×932', width: 430, height: 932 },
];

const readState = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const seed = async (page: Page, kind: 'walk' | 'mimic' | 'opened' | 'cleared') => {
    const ok = await page.evaluate((value) => window.__AETHERIA_TEST_API__?.seedFieldMapScenario?.(value), kind);
    expect(ok).toBe(true);
};

const expectFieldLayout = async (page: Page, width: number) => {
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('control-explore')).toHaveCount(0);
    for (const direction of ['up', 'down', 'left', 'right']) {
        const box = await page.getByTestId(`field-pad-${direction}`).boundingBox();
        expect(box, direction).not.toBeNull();
        expect(box!.width, `${direction} 너비`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${direction} 높이`).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width, `${direction} 화면 안`).toBeLessThanOrEqual(width);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, '가로 넘침 없음').toBeLessThanOrEqual(0);
    const smallest = await page.getByTestId('field-map').evaluate((root) => Math.min(
        ...[...root.querySelectorAll('*')]
            .filter((node) => (node.textContent || '').trim().length > 0 && node.children.length === 0)
            .map((node) => parseFloat(getComputedStyle(node).fontSize)),
    ));
    expect(smallest, '지도 위 글자 11px 이상').toBeGreaterThanOrEqual(11);
};

for (const size of SIZES) {
    test.describe(`지역 지도 걷기 · ${size.label}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: size.width, height: size.height });
            await startE2ERun(page);
        });

        test('걷기 → 조우는 탐험 1회 → 전투 뒤 지도로 돌아오고, 상자를 연다', async ({ page }) => {
            test.setTimeout(90_000);
            await seed(page, 'walk');
            await expectFieldLayout(page, size.width);

            const before = await readState(page);
            await exploreOnce(page);
            const after = await readState(page);
            expect(after.player.explores, '조우 = 탐험 1회').toBe(before.player.explores + 1);
            await settleFieldInterruption(page);
            await expectFieldLayout(page, size.width);

            // 상자 — 보통 상자면 골드가 늘고, 미믹이면 싸운 뒤 보상을 받는다. 어느 쪽이든 그 상자는 열린다.
            const snapshot = await readFieldSnapshot(page);
            const chest = snapshot.layout!.chests.find((entry) => !snapshot.opened.includes(entry.id))!;
            const goldBefore = (await readState(page)).player.gold;
            await walkFieldTo(page, chest.index);
            await settleFieldInterruption(page);
            const opened = await readState(page);
            expect(opened.player.fieldMap.openedChests).toContain(chest.id);
            expect(opened.player.gold).toBeGreaterThan(goldBefore);
            await expect(page.getByTestId('field-map')).toHaveAttribute('data-field-chests', new RegExp(`^${opened.player.fieldMap.openedChests.length}/`));
        });

        test('미믹이 깨어나면 전투가 되고, 이기면 골드 2배 상자 보상을 받는다', async ({ page }) => {
            await seed(page, 'mimic');
            await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 8_000 });
            const combat = await readState(page);
            expect(combat.gameState).toBe('combat');
            expect(combat.enemy.name).toContain('미믹');
            const goldBefore = combat.player.gold;
            await settleFieldInterruption(page);
            const won = await readState(page);
            expect(won.player.gold).toBeGreaterThan(goldBefore);
            expect(won.player.fieldMap.pending).toBeNull();
            await expectFieldLayout(page, size.width);
        });

        test('상자를 다 열고 나가면 클리어 — 다시 들어오면 자동 탐험이 상자를 열고 입구로 돌아온다', async ({ page }) => {
            test.setTimeout(120_000);
            await seed(page, 'opened');
            const auto = page.getByTestId('field-auto-start');
            await expect(auto).toBeDisabled();
            await expect(page.getByTestId('field-auto-lock')).toBeVisible();

            const snapshot = await readFieldSnapshot(page);
            const exit = snapshot.layout!.exits.find((entry) => entry.to === '시작의 마을')!;
            await walkFieldTo(page, exit.index);
            await expect.poll(async () => (await readState(page)).player.loc, { timeout: 8_000 }).toBe('시작의 마을');
            const cleared = await readState(page);
            expect(cleared.player.fieldClearedRegions).toContain('고요한 숲');

            // 마을의 주 행동은 임무 보상 수령일 수 있다 — 이동 단추로 숲에 다시 들어간다.
            const debrief = page.getByTestId('expedition-debrief-close-icon');
            if (await debrief.isVisible()) await debrief.click();
            await page.getByTestId('control-move').click();
            await page.getByTestId('control-route-option-고요한 숲').click();
            await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
            await expect(auto).toBeEnabled({ timeout: 8_000 });
            await expect(auto).toContainText('3/3');
            await auto.click();
            await expect(page.getByTestId('field-auto-stop')).toBeVisible({ timeout: 5_000 });

            // 자동 탐험은 조우 전투(한 번에 쓰러지는 적)도 대신 싸운다. 멈추면(판단할 일) 정리하고 이어 간다.
            const deadline = Date.now() + 90_000;
            for (;;) {
                const state = await readState(page);
                const layout = state.player.fieldLayout;
                const done = state.player.fieldMap?.openedChests.length === layout?.chests.length
                    && state.player.fieldMap?.pos === layout?.entrance
                    && !(await page.getByTestId('field-auto-stop').isVisible());
                if (done) break;
                if (Date.now() > deadline) throw new Error('자동 탐험이 끝나지 않았다');
                if (!(await page.getByTestId('field-auto-stop').isVisible())) {
                    // 자동 탐험이 멈췄다(이벤트 · 결과 카드 · 판단할 전투) — 무엇이 끼어들었든 정리하고 이어 간다.
                    await settleFieldInterruption(page);
                    const start = page.getByTestId('field-auto-start');
                    if ((await start.count()) > 0 && await start.isEnabled()) await start.click();
                }
                await page.waitForTimeout(200);
            }
            const finished = await readState(page);
            expect(finished.player.fieldAutoRuns.used, '이어 가기는 횟수를 쓰지 않는다').toBe(1);
            await expect(page.getByTestId('field-auto-start')).toContainText('2/3');
            await expectFieldLayout(page, size.width);
        });
    });
}
