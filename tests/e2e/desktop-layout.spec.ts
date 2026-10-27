import { devices, expect, test, type Locator, type Page } from '@playwright/test';
import { openTownFacilities, startE2ERun, waitForModeTransition } from './testHelpers';

/**
 * 2026-10 데스크톱 배치(VD-04 · UX-12): 화면 폭 1024px 이상은 세 칸 — 왼쪽 캐릭터 · 가운데 무대 · 오른쪽 모험 기록.
 *   ① 세 칸이 모두 화면 안에 보이고 가로 넘침이 없다.
 *   ② 탐험 → 전투 → 결과 카드 → 대기로 돌아온다. 전투 중에는 모험 기록이 잠기고 적 상태는 왼쪽 칸에 있다.
 *   ③ 모험 기록의 탭 열한 개에 모두 닿는다(기록은 늘 열려 있다 — 여는 단추를 누르지 않는다).
 *   ④ 글자는 11px 이상, 단추는 44px 이상이다.
 * 모바일 배치(1024px 미만)는 다른 스펙이 지킨다 — 이 스펙은 마우스 · 넓은 화면만 잰다.
 */

const VIEWPORTS = [
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
] as const;

const ARCHIVE_TABS = ['equipment', 'inventory', 'quest', 'achievements', 'skills', 'map', 'stats', 'codex', 'pass', 'graves', 'system'] as const;
const COLUMNS = ['desktop-character-column', 'desktop-stage-column', 'desktop-archive-column'] as const;
// 첫 사냥 지역(고요한 숲)의 첫 탐험이 전투가 되는 씨앗 — 결과가 바뀌면 이 스펙이 먼저 알린다.
const COMBAT_EXPLORE_SEED = 2;
// 44px 최소 폭은 배치 계산에서 43.99997px로 읽힐 수 있다 — 반 픽셀 아래까지는 같은 크기로 본다.
const TOUCH_MIN = 44 - 0.5;

const readGame = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => (
        node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
    ));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [`${element.textContent?.trim().slice(0, 24)} ${fontSize}px`] : [];
}));

const findUndersizedButtons = (root: Locator) => root.locator('button').evaluateAll((buttons, min) => buttons.flatMap((button) => {
    if (!(button instanceof HTMLElement) || button.offsetParent === null) return [];
    const bounds = button.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return [];
    return bounds.width < min || bounds.height < min
        ? [`${button.dataset.testid || button.textContent?.trim().slice(0, 24)} ${Math.round(bounds.width)}x${Math.round(bounds.height)}`]
        : [];
}), TOUCH_MIN);

const expectNoHorizontalOverflow = async (page: Page) => {
    const geometry = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('[data-app-shell]');
        return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            pageX: window.scrollX,
            shellScrollWidth: shell?.scrollWidth ?? 0,
            shellClientWidth: shell?.clientWidth ?? 0,
        };
    });
    expect(geometry.pageX).toBe(0);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.shellScrollWidth).toBeLessThanOrEqual(geometry.shellClientWidth);
};

const expectThreeColumnsVisible = async (page: Page) => {
    const viewport = page.viewportSize()!;
    const boxes = [];
    for (const id of COLUMNS) {
        const column = page.getByTestId(id);
        await expect(column).toBeVisible();
        const box = await column.boundingBox();
        expect(box, id).not.toBeNull();
        expect(box!.width, `${id} 폭`).toBeGreaterThan(200);
        expect(box!.x, `${id} 왼쪽`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${id} 오른쪽`).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.y, `${id} 위`).toBeLessThan(viewport.height);
        boxes.push(box!);
    }
    // 왼쪽 → 가운데 → 오른쪽 순서로 겹치지 않는다.
    expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(boxes[1].x + 1);
    expect(boxes[1].x + boxes[1].width).toBeLessThanOrEqual(boxes[2].x + 1);
};

const expectReadableAndTouchable = async (root: Locator) => {
    expect(await findUndersizedText(root)).toEqual([]);
    expect(await findUndersizedButtons(root)).toEqual([]);
};

for (const viewport of VIEWPORTS) {
    test.describe(`데스크톱 ${viewport.width}x${viewport.height}`, () => {
        test.use({
            userAgent: devices['Desktop Chrome'].userAgent,
            deviceScaleFactor: 1,
            viewport: { ...viewport },
            isMobile: false,
            hasTouch: false,
        });

        test('세 칸 · 탐험 → 전투 → 복귀 · 모험 기록 탭 열한 개 · 읽기 크기와 44px', async ({ page }) => {
            test.setTimeout(90_000);
            await startE2ERun(page);

            const layout = page.getByTestId('desktop-game-layout');
            await expect(layout).toBeVisible();
            await expect(page.getByTestId('desktop-character-column').getByTestId('persistent-status-bar'))
                .toHaveAttribute('data-status-placement', 'column');
            await expectThreeColumnsVisible(page);
            await expectNoHorizontalOverflow(page);
            await expectReadableAndTouchable(layout);

            // 모험 기록은 늘 열려 있다 — 탭 열한 개에 모두 닿고, 각 탭 화면도 읽기 크기와 44px를 지킨다.
            const archive = page.getByTestId('desktop-archive-column');
            await expect(archive).toHaveAttribute('data-archive-available', 'true');
            for (const tab of ARCHIVE_TABS) {
                const button = archive.getByTestId(`archive-tab-${tab}`);
                await button.scrollIntoViewIfNeeded();
                await button.click();
                await expect(button).toHaveAttribute('data-active', 'true');
                await expectReadableAndTouchable(archive);
                await expectNoHorizontalOverflow(page);
            }
            // 데스크톱에는 '기록으로 돌아가기'가 없다(기록 창이 옆에 그대로 있다).
            await expect(page.getByTestId('mobile-console-return-log')).toBeHidden();
            // 소유자 결정 2026-10-26 D6: 기록 열의 탭은 내용 왼쪽의 세로 목록이고, 원정 준비의 '모험 기록' 단추는 없다(열과 같은 일을 한다).
            const tabBoxes = [];
            for (const tab of ARCHIVE_TABS) tabBoxes.push((await archive.getByTestId(`archive-tab-${tab}`).boundingBox())!);
            for (let index = 1; index < tabBoxes.length; index += 1) {
                expect(Math.abs(tabBoxes[index].x - tabBoxes[0].x), `${ARCHIVE_TABS[index]} 같은 열`).toBeLessThanOrEqual(1);
                expect(tabBoxes[index].y, `${ARCHIVE_TABS[index]} 아래로`).toBeGreaterThan(tabBoxes[index - 1].y);
            }
            const contentBox = (await archive.getByTestId('mobile-archive-console-content').boundingBox())!;
            expect(contentBox.x, '내용은 목록 오른쪽이다').toBeGreaterThanOrEqual(tabBoxes[0].x + tabBoxes[0].width);
            await expect(page.getByTestId('mobile-console-open-archive')).toHaveCount(0);
            await expect(page.getByTestId('control-expedition-start')).toBeVisible();
            // 소유자 결정 2026-10-26 D2: 데스크톱도 마을 시설에서 에테르 교환소를 연다.
            await openTownFacilities(page);
            await page.getByTestId('control-crystal-exchange').click();
            await expect(page.getByTestId('premium-shop')).toBeVisible();
            await page.getByTestId('premium-shop-close').click();
            await expect(page.getByTestId('premium-shop')).toHaveCount(0);

            // 탐험 → 전투
            await page.getByTestId('control-expedition-start').click();
            await expect(page.getByTestId('control-explore')).toBeVisible();
            await page.evaluate((seed) => window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(seed), COMBAT_EXPLORE_SEED);
            await page.getByTestId('control-explore').click();
            await expect.poll(async () => (await readGame(page)).gameState, { timeout: 10_000 }).toBe('combat');
            await expect(page.getByTestId('combat-focus-panel')).toBeVisible();
            await waitForModeTransition(page);

            const characterColumn = page.getByTestId('desktop-character-column');
            await expect(characterColumn.getByTestId('persistent-status-bar')).toHaveAttribute('data-status-mode', 'combat');
            await expect(characterColumn.getByTestId('enemy-status')).toBeVisible();
            await expect(page.getByTestId('desktop-stage-column').getByTestId('combat-focus-panel')).toBeVisible();
            await expect(archive).toHaveAttribute('data-archive-available', 'false');
            await expect(page.getByTestId('desktop-archive-locked')).toBeVisible();
            await expectThreeColumnsVisible(page);
            await expectNoHorizontalOverflow(page);
            await expectReadableAndTouchable(layout);
            for (const key of ['attack', 'skill', 'item', 'escape']) {
                await expect(page.getByTestId(`combat-action-${key}`)).toBeInViewport();
            }

            // 전투 → 결과 카드 → 대기
            const card = page.getByTestId('post-combat-card');
            for (let turn = 0; turn < 30; turn += 1) {
                if ((await readGame(page)).gameState !== 'combat') break;
                const attack = page.getByTestId('combat-action-attack');
                if (await attack.isEnabled().catch(() => false)) await attack.click();
                await page.waitForTimeout(250);
            }
            await expect(card).toBeVisible({ timeout: 10_000 });
            await expect(card).toHaveAttribute('data-input-ready', 'true', { timeout: 4_000 });
            await page.getByTestId('post-combat-close').click();
            await expect(card).toBeHidden({ timeout: 8_000 });
            await expect.poll(async () => (await readGame(page)).gameState, { timeout: 8_000 }).toBe('idle');
            await expect(archive).toHaveAttribute('data-archive-available', 'true');
            await expect(characterColumn.getByTestId('enemy-status')).toHaveCount(0);
            await expectThreeColumnsVisible(page);
            await expectNoHorizontalOverflow(page);
        });
    });
}
