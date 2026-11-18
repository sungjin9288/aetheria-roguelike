import { test, expect, type Page } from '@playwright/test';
import { exploreOnce, readFieldSnapshot, settleFieldInterruption, startE2ERun, stepField } from './testHelpers';

/**
 * E2E: 오버월드 3단계(docs/OVERWORLD_WALK_DESIGN_2026-11.md §5 · §7 · §11, 소유자 결정 2026-11-16) — 화면 경로와 세 폭의 배치.
 *   1. 숲이 아닌 바이옴의 지도를 걷는다 — 조우 = 탐험 1회, 지도 그림은 그 바이옴이다.
 *   2. 보스 문을 밟으면 탐험의 도전 카드와 같은 카드가 열리고, 도전하면 그 구역 보스와 싸운다.
 *   3. 자동 걷기(전직 뒤)는 열지 않은 상자 앞에서 멈추고 상자를 열지 않는다 — 멈춘 이유가 기록에 남는다.
 * 판정의 정본은 tests/overworld-phase3-contract.test.js다. 안전 영역은 기기 값을 변수로 넣어 잰다(field-dock-fit과 같은 방법).
 */

const DEVICES = [
    { label: 'iPhone mini', width: 375, height: 812, top: 50, bottom: 34 },
    { label: 'iPhone 14', width: 390, height: 844, top: 47, bottom: 34 },
    { label: 'iPhone Pro Max', width: 430, height: 932, top: 62, bottom: 34 },
] as const;

type Device = (typeof DEVICES)[number];
type Direction = 'up' | 'down' | 'left' | 'right';

const readState = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const seed = async (page: Page, kind: 'biome' | 'door' | 'walkChest') => {
    const ok = await page.evaluate((value) => window.__AETHERIA_TEST_API__?.seedFieldMapScenario?.(value), kind);
    expect(ok, `${kind} 씨앗`).toBe(true);
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
};

/** 행동 막대 · 지도 단추 44px, 마지막 줄이 홈 표시줄 위(D14), 가로 넘침 없음, 지도 위 글자 11px 이상 */
const expectFieldFits = async (page: Page, device: Device, step: string) => {
    const geometry = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>('[data-app-shell]')!;
        // 2026-11 화면 B안: 휴대폰 방향 패드는 화면에서 빠진다(키보드 차례에만) — 누르는 단추는 행동 막대 · 자동 단추다.
        const controls = [...document.querySelectorAll<HTMLElement>('[data-testid="control-field-actions"] > button, [data-testid^="field-auto-"], [data-testid^="field-walk-"]')]
            .filter((node) => node.tagName === 'BUTTON');
        const rects = controls.map((node) => node.getBoundingClientRect());
        const map = document.querySelector('[data-testid="field-map"]')!;
        const sizes = [...map.querySelectorAll('*')]
            .filter((node) => (node.textContent || '').trim().length > 0 && node.children.length === 0)
            .map((node) => parseFloat(getComputedStyle(node).fontSize));
        return {
            count: rects.length,
            minWidth: Math.min(...rects.map((rect) => rect.width)),
            minHeight: Math.min(...rects.map((rect) => rect.height)),
            lowest: Math.max(...rects.map((rect) => rect.bottom)),
            rightmost: Math.max(...rects.map((rect) => rect.right)),
            smallestText: Math.min(...sizes),
            shellOverflow: shell.scrollHeight - shell.clientHeight,
            pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
    });
    expect(geometry.count, `${step}: 행동 막대 · 지도 단추`).toBeGreaterThanOrEqual(5);
    expect(geometry.minWidth, `${step}: 너비 44px`).toBeGreaterThanOrEqual(44);
    expect(geometry.minHeight, `${step}: 높이 44px`).toBeGreaterThanOrEqual(44);
    expect(geometry.lowest, `${step}: 마지막 줄이 홈 표시줄 위에 있다`).toBeLessThanOrEqual(device.height - device.bottom);
    expect(geometry.rightmost, `${step}: 화면 안`).toBeLessThanOrEqual(device.width);
    expect(geometry.smallestText, `${step}: 지도 위 글자 11px 이상`).toBeGreaterThanOrEqual(11);
    expect(geometry.shellOverflow, `${step}: 화면이 넘치지 않는다`).toBeLessThanOrEqual(0);
    expect(geometry.pageOverflow, `${step}: 가로 넘침 없음`).toBeLessThanOrEqual(0);
};

const directionToward = (width: number, from: number, to: number): Direction => {
    const dx = (to % width) - (from % width);
    const dy = Math.floor(to / width) - Math.floor(from / width);
    if (dx === 1 && dy === 0) return 'right';
    if (dx === -1 && dy === 0) return 'left';
    if (dx === 0 && dy === 1) return 'down';
    if (dx === 0 && dy === -1) return 'up';
    throw new Error(`이웃 칸이 아니다: ${from} → ${to}`);
};

for (const device of DEVICES) {
    test.describe(`오버월드 3단계 · ${device.label} ${device.width}×${device.height}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: device.width, height: device.height });
            await startE2ERun(page);
            await page.evaluate(({ top, bottom }) => {
                document.documentElement.style.setProperty('--aether-safe-area-top', `${top}px`);
                document.documentElement.style.setProperty('--aether-safe-area-bottom', `${bottom}px`);
            }, device);
        });

        test('숲이 아닌 바이옴의 지도를 걷는다 — 조우는 탐험 1회이고 지도로 돌아온다', async ({ page }) => {
            test.setTimeout(90_000);
            await seed(page, 'biome');
            const map = page.getByTestId('field-map');
            const biome = await map.getAttribute('data-field-biome');
            expect(biome, '바이옴').not.toBeNull();
            expect(biome).not.toBe('forest');
            expect((await readState(page)).player.fieldLayout.biome).toBe(biome);
            await expectFieldFits(page, device, '걷기 전');

            const before = await readState(page);
            await exploreOnce(page);
            const after = await readState(page);
            expect(after.player.explores, '조우 = 탐험 1회').toBe(before.player.explores + 1);
            await settleFieldInterruption(page);
            await expect(map).toHaveAttribute('data-field-biome', biome!);
            await expectFieldFits(page, device, '조우 뒤');
        });

        test('보스 문을 밟으면 도전 카드가 열리고, 도전하면 그 구역 보스와 싸운다', async ({ page }) => {
            await seed(page, 'door');
            const chip = page.getByTestId('field-door-chip');
            await expect(chip).toBeVisible();
            const chipText = (await chip.textContent()) ?? '';
            await expectFieldFits(page, device, '문 앞');

            const state = await readState(page);
            const { layout, pos } = { layout: state.player.fieldLayout, pos: state.player.fieldMap.pos };
            expect(layout.door, '문이 열려 있다').not.toBeNull();
            await expect(page.getByTestId('field-map')).toHaveAttribute('data-field-door', String(layout.door));
            await stepField(page, directionToward(layout.width, pos, layout.door));

            await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 8_000 });
            const card = await readState(page);
            expect(card.player.fieldMap.pos, '문 칸에 섰다').toBe(layout.door);
            await page.getByTestId('event-choice-0').click();
            await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 8_000 });
            const combat = await readState(page);
            expect(combat.gameState).toBe('combat');
            expect(chipText, '칩이 말한 보스와 싸운다').toContain(combat.enemy.baseName ?? combat.enemy.name);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            expect(overflow, '전투 화면 가로 넘침 없음').toBeLessThanOrEqual(0);
        });

        test('자동 걷기는 열지 않은 상자 앞에서 멈추고 상자를 열지 않는다', async ({ page }) => {
            await seed(page, 'walkChest');
            const start = page.getByTestId('field-walk-start');
            await expect(start).toBeEnabled();
            await expectFieldFits(page, device, '자동 걷기 전');
            const before = await readFieldSnapshot(page);

            await start.click();
            // 걷기 → 멈춤 — 멈춘 이유 한 줄이 기록에 남는다(한 걸음이라 멈추기 단추는 잠깐만 보인다).
            await expect.poll(async () => (await readState(page)).logTail.some((log: { text: string }) => /보물상자 앞이라 자동 걷기를 멈췄습니다/.test(log.text)), { timeout: 8_000 })
                .toBe(true);
            await expect(page.getByTestId('field-walk-start')).toBeVisible({ timeout: 8_000 });
            const after = await readFieldSnapshot(page);
            expect(after.pos, '걸었다').not.toBe(before.pos);
            expect(after.opened, '상자는 열지 않는다').toEqual(before.opened);
            const width = after.layout!.width;
            const besideChest = after.layout!.chests.some((chest) => !after.opened.includes(chest.id)
                && Math.abs((chest.index % width) - (after.pos! % width)) + Math.abs(Math.floor(chest.index / width) - Math.floor(after.pos! / width)) === 1);
            expect(besideChest, '열지 않은 상자 바로 옆이다').toBe(true);
            await expectFieldFits(page, device, '자동 걷기 뒤');
        });
    });
}
