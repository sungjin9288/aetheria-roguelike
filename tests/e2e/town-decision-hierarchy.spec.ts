import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

// 2026-10 통합 감사(town-nav UX-01 · CL-02): 마을 시설 여섯 개 — 펼치면 모두 화면 안으로 들어와야 한다.
// 소유자 결정 2026-10-26 D2(UX-04): 에테르 교환소도 마을 시설이다(세 열 격자의 셋째 줄).
const FACILITY_TEST_IDS = ['control-rest', 'control-quests', 'control-market', 'control-class', 'control-craft', 'control-mirror', 'control-crystal-exchange'];
// 작은 폰(SE · 12 mini급)에서는 펼친 시설 칸이 화면 아래에 그려졌다(390x664 · 375x667에서 보이는 시설 0개).
const FACILITY_VIEWPORTS = [
    { width: 375, height: 667 },
    { width: 390, height: 664 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

test.describe('Town decision hierarchy', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
    });

    test('첫 화면은 원정 준비와 실제 결과가 있는 마을 행동만 먼저 보인다', async ({ page }) => {
        const primary = page.getByTestId('control-town-primary');
        const quickActions = page.getByTestId('control-town-quick-actions').locator('button');
        const facilities = page.getByTestId('control-town-facilities');

        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_move');
        await expect(primary.getByRole('button')).toContainText('고요한 숲으로 첫 출발');
        await expect(quickActions).toHaveCount(1);
        await expect(page.getByTestId('control-explore')).toHaveCount(0);
        await expect(page.getByTestId('control-move')).toBeVisible();
        await expect(page.getByTestId('mobile-console-open-archive')).toBeVisible();
        await expect(facilities).not.toHaveAttribute('open', '');
        await expect(page.getByTestId('control-market')).toBeHidden();

        const primaryBounds = await primary.boundingBox();
        expect(primaryBounds).not.toBeNull();
        expect(primaryBounds!.y).toBeGreaterThanOrEqual(0);
        expect(primaryBounds!.y + primaryBounds!.height).toBeLessThanOrEqual(844);

        const archive = page.getByTestId('mobile-console-open-archive');
        const readiness = page.getByTestId('control-expedition-prep').getByText('출발 가능', { exact: true });
        const [archiveBounds, readinessBounds] = await Promise.all([
            archive.boundingBox(),
            readiness.boundingBox(),
        ]);
        expect(archiveBounds).not.toBeNull();
        expect(readinessBounds).not.toBeNull();
        expect(Math.abs(archiveBounds!.y - readinessBounds!.y)).toBeLessThan(16);
        expect(await archive.evaluate((node) => node.closest('[data-testid="control-expedition-prep"]') !== null)).toBe(true);

        // 2026-11 마을 무대(소유자 결정 "마을+지도 함께 또한 글자의 나열을 최소로"): 마을의 위쪽은 기록 창이 아니라 마을 무대다 —
        //   시작의 마을은 전경 그림 위에 주인공이 서고, 기록은 그 아래 띠다(필드 무대와 같은 칸). 지역 그림은 화면에 하나다.
        const stage = page.getByTestId('town-stage');
        await expect(stage).toBeVisible();
        await expect(page.getByTestId('terminal-location-visual')).toHaveCount(0);
        const panorama = page.getByTestId('town-stage-panorama');
        await expect.poll(() => panorama.evaluate((image) => (
            image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
        ))).toBe(true);
        const [stageBounds, terminalBounds] = await Promise.all([
            stage.boundingBox(),
            page.getByTestId('terminal-panel').boundingBox(),
        ]);
        expect(stageBounds).not.toBeNull();
        expect(terminalBounds).not.toBeNull();
        expect(stageBounds!.height).toBeGreaterThanOrEqual(88);
        expect(terminalBounds!.y).toBeGreaterThanOrEqual(stageBounds!.y + stageBounds!.height);
        expect(terminalBounds!.y + terminalBounds!.height).toBeLessThanOrEqual(primaryBounds!.y);
        const locationVisual = page.getByTestId('terminal-location-visual');

        const pageWidth = await page.evaluate(() => ({
            viewport: window.innerWidth,
            document: document.documentElement.scrollWidth,
        }));
        expect(pageWidth.document).toBeLessThanOrEqual(pageWidth.viewport);

        await page.screenshot({
            path: 'playtest-artifacts/mobile-town-hierarchy/first-town.png',
            fullPage: false,
        });

        await page.getByTestId('control-expedition-start').click();
        // 2026-11 A2: 필드에서는 지역 그림을 기록 창 머리가 아니라 위쪽 필드 무대가 그린다(그림은 화면에 하나).
        //   2026-11 지역 지도 걷기: 지도 지역(고요한 숲)의 위쪽 무대는 걷는 지도다.
        await expect(locationVisual).toHaveCount(0);
        await expect(page.getByTestId('field-map')).toBeVisible();
        await expect(page.getByTestId('field-stage-backdrop')).toHaveCount(0);
    });

    test('접힌 마을 시설을 열면 기존 기능을 모두 사용할 수 있다', async ({ page }) => {
        await openTownFacilities(page);

        // 2026-10 통합 감사(town-nav CL-02): 계승 정수의 소비처인 에테르 거울도 마을 시설이다 — 누르면 거울이 열린다.
        for (const testId of FACILITY_TEST_IDS) {
            await expect(page.getByTestId(testId)).toBeVisible();
        }
        await expect(page.getByTestId('control-mirror')).toBeEnabled();
        await expect(page.getByTestId('control-crystal-exchange')).toBeEnabled();
        await page.getByTestId('control-crystal-exchange').click();
        await expect(page.getByTestId('premium-shop')).toBeVisible();
        await page.getByTestId('premium-shop-close').click();
        await expect(page.getByTestId('premium-shop')).toHaveCount(0);

        await page.screenshot({
            path: 'playtest-artifacts/mobile-town-hierarchy/facilities-open.png',
            fullPage: false,
        });
    });

    for (const viewport of FACILITY_VIEWPORTS) {
        test(`${viewport.width}x${viewport.height} 마을 시설을 펼치면 시설 단추가 모두 화면 안에 들어오고 에테르 거울이 열린다`, async ({ page }) => {
            await page.setViewportSize({ ...viewport });
            await openTownFacilities(page);

            for (const testId of FACILITY_TEST_IDS) {
                const button = page.getByTestId(testId);
                await expect.poll(async () => {
                    const bounds = await button.boundingBox();
                    return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 0.5);
                }, { message: `${testId} 단추가 ${viewport.width}x${viewport.height} 화면 안에 있다` }).toBe(true);
            }

            await page.getByTestId('control-mirror').click();
            await expect(page.getByTestId('mirror-panel-close')).toBeVisible();
            await expect(page.getByTestId('mirror-panel-close')).toHaveAccessibleName('에테르 거울 닫기');
            await page.getByTestId('mirror-panel-close').click();
            await expect(page.getByTestId('mirror-panel-close')).toHaveCount(0);
        });
    }

    test('전투 중에는 지역 장식보다 교전 정보가 우선한다', async ({ page }) => {
        const seeded = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
        expect(seeded).toBe(true);
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('terminal-location-visual')).toHaveCount(0);
    });

    test('회복이 필요한 임무 복귀자는 휴식 후 곧바로 재출발 흐름으로 돌아간다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedTownRecoveryScenario?.());

        const primary = page.getByTestId('control-town-primary');
        await expect(primary).toHaveAttribute('data-town-primary-kind', 'rest');
        await expect(page.getByTestId('control-rest')).toContainText('휴식하고 준비');
        await page.getByTestId('control-rest').click();

        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_move');
        await expect(page.getByTestId('control-expedition-start')).toContainText('고요한 숲으로 출발');
    });

    test('진행 중인 임무가 없으면 게시판이 주 행동이 된다', async ({ page }) => {
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());

        const primary = page.getByTestId('control-town-primary');
        await expect(primary).toHaveAttribute('data-town-primary-kind', 'open_quest_board');
        await page.getByTestId('control-quests').click();
        await expect(page.getByTestId('quest-board-panel')).toBeVisible();
    });
});
