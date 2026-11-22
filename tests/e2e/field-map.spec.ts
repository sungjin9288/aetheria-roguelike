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
// 상태 요약(render_game_to_text)에는 가방이 없다 — 가방은 QA 테스트 API의 투자 스냅숏으로 읽는다.
const readInventory = (page: Page) => page.evaluate(() => window.__AETHERIA_TEST_API__?.getInvestmentSnapshot?.().inventory ?? []);

const seed = async (page: Page, kind: 'walk' | 'mimic' | 'opened' | 'cleared' | 'paid') => {
    const ok = await page.evaluate((value) => window.__AETHERIA_TEST_API__?.seedFieldMapScenario?.(value), kind);
    expect(ok).toBe(true);
};

const expectFieldLayout = async (page: Page, width: number) => {
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('control-explore')).toHaveCount(0);
    // 2026-11 화면 B안: 휴대폰은 칸을 눌러 걷는다 — 방향 패드는 화면에서 빠지고 키보드 · 화면 낭독기 차례에만 남는다.
    //   누르는 것은 지도 칸과 한 줄 행동 막대(이동 · 지도 · 정찰 · 가방)다.
    await expect(page.getByTestId('field-pad').getByRole('button'), '방향 패드는 키보드 차례에 남는다').toHaveCount(4);
    for (const id of ['control-move', 'control-map-open', 'control-scout', 'control-open-bag']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, id).not.toBeNull();
        expect(box!.width, `${id} 너비`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${id} 높이`).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width, `${id} 화면 안`).toBeLessThanOrEqual(width);
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

        test('칸을 누르면 그 칸까지 걷고, 도착하면 목표가 지워진다 — 기록은 한 줄 소식 · 시트다', async ({ page }) => {
            await seed(page, 'walk');
            const map = page.getByTestId('field-map');
            await expect(map).toBeVisible({ timeout: 8_000 });
            await expect(page.getByTestId('field-map-tap-hint')).toBeVisible();
            const state = await readState(page);
            const layout = state.player.fieldLayout;
            const pos: number = state.player.fieldMap.pos;
            // 주인공 바로 위 칸 — 시드 지도의 입구에서 위로 한 칸은 언제나 밝혀진 길이다(입구는 아래 가장자리).
            const target = pos - layout.width;
            expect(layout.tiles[target], '위 칸은 걸을 수 있다').not.toBe('#');
            const canvas = page.getByTestId('field-map-canvas');
            const box = (await canvas.boundingBox())!;
            const tile = await canvas.evaluate((node, cols) => Math.min(56, Math.max(38, Math.floor(node.clientWidth / cols))), 8);
            await canvas.click({ position: { x: box.width / 2, y: box.height / 2 - tile } });
            await expect(map).toHaveAttribute('data-field-pos', String(target), { timeout: 5_000 });
            await expect(map).not.toHaveAttribute('data-field-target', /.+/);
            await expect(page.getByTestId('field-map-tap-hint')).toHaveCount(0);

            await expect(page.getByTestId('log-ticker')).toBeVisible();
            await page.getByTestId('log-sheet-open').click();
            const sheet = page.getByTestId('log-sheet');
            await expect(sheet).toBeVisible();
            await expect(sheet).toHaveAttribute('aria-modal', 'true');
            // 시트가 열린 동안 방향 키는 시트의 것이다 — 그 뒤에서 주인공이 걷지 않는다(어긋남 점검 결함 3).
            //   아래 칸은 방금 걸어온 칸이라 언제나 걸을 수 있다 — 막지 않으면 위치가 바뀐다(방향을 섞으면 서로 지워져 공허하다).
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(400);
            await expect(map).toHaveAttribute('data-field-pos', String(target));
            await page.keyboard.press('Escape');
            await expect(sheet).toHaveCount(0);
            await expect(page.getByTestId('log-sheet-open')).toBeFocused();
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

        test('미믹이 깨어나면 전투가 되고, 이기면 골드 · 강화 재료 2개 · 장비를 확정으로 받는다', async ({ page }) => {
            await seed(page, 'mimic');
            await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 8_000 });
            const combat = await readState(page);
            expect(combat.gameState).toBe('combat');
            expect(combat.enemy.name).toContain('미믹');
            const goldBefore = combat.player.gold;
            const countMaterials = (inv: Array<{ name?: string }>) => inv.filter((item) => item.name === '강화 재료').length;
            const invBefore = await readInventory(page);
            await settleFieldInterruption(page);
            const won = await readState(page);
            const invAfter = await readInventory(page);
            expect(won.player.gold).toBeGreaterThan(goldBefore);
            // 고위험 고보상(2026-11-17): 강화 재료 2개와 이 직업 장비 하나는 확정이다.
            expect(countMaterials(invAfter) - countMaterials(invBefore)).toBe(2);
            expect(invAfter.length).toBeGreaterThanOrEqual(invBefore.length + 3);
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
            await expect(auto).toContainText('5/5');
            await auto.click();
            await expect(page.getByTestId('field-auto-stop')).toBeVisible({ timeout: 5_000 });

            // 자동 탐험은 조우 전투(한 번에 쓰러지는 적)도 대신 싸운다. 멈추면(판단할 일) 정리하고 이어 간다.
            // 끝났는지는 정지 단추를 먼저 보고 상태를 나중에 읽어 판정한다 — 상태를 먼저 읽으면 그 사이에 자동 탐험이 끝났을 때
            //   '멈췄다'로 읽고 끝난 지도에서 새 자동 탐험(횟수 1)을 시작한다(부하가 걸린 전체 실행에서 실제로 일어났다).
            const isFinished = async () => {
                const running = await page.getByTestId('field-auto-stop').isVisible();
                const state = await readState(page);
                const layout = state.player.fieldLayout;
                return {
                    running,
                    done: !running
                        && state.player.fieldMap?.openedChests.length === layout?.chests.length
                        && state.player.fieldMap?.pos === layout?.entrance,
                };
            };
            const deadline = Date.now() + 90_000;
            for (;;) {
                const { running, done } = await isFinished();
                if (done) break;
                if (Date.now() > deadline) throw new Error('자동 탐험이 끝나지 않았다');
                if (!running) {
                    // 자동 탐험이 멈췄다(이벤트 · 결과 카드 · 판단할 전투) — 무엇이 끼어들었든 정리하고 이어 간다.
                    await settleFieldInterruption(page);
                    if ((await isFinished()).done) break;
                    const start = page.getByTestId('field-auto-start');
                    if ((await start.count()) > 0 && await start.isEnabled()) await start.click();
                }
                await page.waitForTimeout(200);
            }
            const finished = await readState(page);
            expect(finished.player.fieldAutoRuns.used, '이어 가기는 횟수를 쓰지 않는다').toBe(1);
            await expect(page.getByTestId('field-auto-start')).toContainText('4/5');
            await expectFieldLayout(page, size.width);
        });

        test('무료 자동 탐험을 다 쓰면 단추가 다음 한 번의 값을 말하고, 누르면 그 골드를 내고 시작한다', async ({ page }) => {
            await seed(page, 'paid');
            const auto = page.getByTestId('field-auto-start');
            // 씨앗 레벨 10 × 200
            await expect(auto).toContainText('골드 2000');
            await expect(auto).toBeEnabled();
            await expectFieldLayout(page, size.width);
            const box = await auto.boundingBox();
            expect(box!.x + box!.width, '값 단추 화면 안').toBeLessThanOrEqual(size.width);
            const before = await readState(page);
            await auto.click();
            await expect(page.getByTestId('field-auto-stop')).toBeVisible({ timeout: 5_000 });
            const after = await readState(page);
            expect(after.player.gold, '골드 2000을 낸다').toBe(before.player.gold - 2000);
            expect(after.player.fieldAutoRuns.used).toBe(before.player.fieldAutoRuns.used + 1);
        });
    });
}
