import { expect, test } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

test.describe('에테르 거울 영구 성장', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedMirrorJourneyScenario?.());
        await openTownFacilities(page);
        await page.getByTestId('control-mirror').click();
        await expect(page.getByTestId('mirror-panel')).toBeVisible();
    });

    test('다섯 성장 경로와 투자 전후 효과를 작은 화면에서 읽을 수 있다', async ({ page }) => {
        const panel = page.getByTestId('mirror-panel');

        await expect(panel).toContainText('새 여정에도 남는 성장');
        // 2026-09 G3: 거울 트리 재설계로 총 단계가 13 → 28 (data/mirror.ts MIRROR_NODES,
        //   기존 7노드 26단계 + 신규 scout_charges 2단계). 시드는 2단계 투자 상태 그대로다.
        await expect(page.getByTestId('mirror-completion')).toHaveText('2/28 단계');
        // 2026-10 Wave 96: 다섯째 경로는 끝없는 단계 — 거울 8가지 성장을 다 채우기 전에는 잠긴 채 보인다.
        for (const pathId of ['departure', 'exploration', 'survival', 'legacy', 'endless']) {
            await expect(page.getByTestId(`mirror-path-${pathId}`)).toBeVisible();
        }
        await expect(page.getByTestId('mirror-current-effect')).toHaveText('시작 골드 +100');
        await expect(page.getByTestId('mirror-next-effect')).toHaveText('시작 골드 +200');
        await expect(page.getByTestId('mirror-confirm')).toContainText('유산의 금고 2단계 투자');

        const geometry = await panel.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const buttons = [...root.querySelectorAll<HTMLElement>('button')];
            const footer = root.querySelector<HTMLElement>('[data-testid="mirror-action-footer"]');

            return {
                bounds: root.getBoundingClientRect().toJSON(),
                minFont: Math.min(...leaves.map((node) => parseFloat(getComputedStyle(node).fontSize))),
                minButtonHeight: Math.min(...buttons.map((node) => node.getBoundingClientRect().height)),
                footerBottom: footer?.getBoundingClientRect().bottom || 0,
                horizontalOverflow: root.scrollWidth - root.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        expect(geometry.bounds.top).toBe(0);
        expect(geometry.bounds.bottom).toBeGreaterThanOrEqual(843);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.footerBottom).toBeLessThanOrEqual(844);
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/mirror-journey-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('성장 선택은 미리보기만 바꾸고 고정 버튼을 눌러야 정수가 사용된다', async ({ page }) => {
        const before = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getMirrorSnapshot?.());

        await page.getByTestId('mirror-node-select-start_boot_extra').click();
        await expect(page.getByTestId('mirror-next-effect')).toHaveText('첫 유물 선택 +1');
        const afterSelection = await page.evaluate(() => window.__AETHERIA_TEST_API__?.getMirrorSnapshot?.());
        expect(afterSelection).toEqual(before);

        await page.getByTestId('mirror-node-select-start_gold').click();
        await page.getByTestId('mirror-confirm').evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });

        await expect(page.getByTestId('mirror-current-effect')).toHaveText('시작 골드 +200');
        await expect(page.getByTestId('mirror-confirm')).toContainText('계승 정수 140 부족');
        const afterPurchase = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getMirrorSnapshot?.()))!;
        expect(afterPurchase.essence).toBe(100);
        expect(afterPurchase.mirror.start_gold).toBe(2);
        expect(afterPurchase.mirror.campfire_rate).toBe(1);
        const renderSnapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(renderSnapshot.logTail.filter((log: { text: string }) => log.text.includes('유산의 금고 2단계')).length).toBe(1);
    });
});

// 2026-10 Wave 96: 끝없는 거울 — 8가지 성장을 다 채우면 비용이 오르는 작은 영구 능력치를 산다(390px).
test.describe('에테르 거울 — 끝없는 단계', () => {
    const openMirror = async (page: import('@playwright/test').Page, fullTree: boolean) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate((full) => window.__AETHERIA_TEST_API__?.seedMirrorJourneyScenario?.(full), fullTree);
        await openTownFacilities(page);
        await page.getByTestId('control-mirror').click();
        await expect(page.getByTestId('mirror-panel')).toBeVisible();
        await page.getByTestId('mirror-path-endless').click();
    };

    test('8가지 성장을 다 채우기 전에는 잠겨 있다', async ({ page }) => {
        await openMirror(page, false);
        await expect(page.getByTestId('mirror-node-select-endless_atk')).toBeVisible();
        await expect(page.getByTestId('mirror-confirm')).toBeDisabled();
        await expect(page.getByTestId('mirror-confirm')).toHaveText('거울 8가지 성장을 모두 채우면 열립니다');
    });

    test('다 채우면 영구 공격력을 한 단계씩 사고, 다음 단계는 더 비싸다', async ({ page }) => {
        await openMirror(page, true);
        const before = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;
        await expect(page.getByTestId('mirror-node-select-endless_atk')).toContainText('0/60단계');
        await expect(page.getByTestId('mirror-current-effect')).toHaveText('거울로 새긴 영구 공격력 없음');
        await expect(page.getByTestId('mirror-next-effect')).toHaveText('거울로 새긴 영구 공격력 +1');
        await expect(page.getByTestId('mirror-investment-preview')).toContainText('필요 2000');
        await page.getByTestId('mirror-confirm').click();

        await expect(page.getByTestId('mirror-current-effect')).toHaveText('거울로 새긴 영구 공격력 +1');
        await expect(page.getByTestId('mirror-investment-preview')).toContainText('필요 2500');
        await expect(page.getByTestId('mirror-node-select-endless_atk')).toContainText('1/60단계');
        const after = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;
        expect(after.essence).toBe(before.essence - 2000);
        expect(after.bonusAtk).toBe(before.bonusAtk + 1);
        expect(after.bonusHp).toBe(before.bonusHp);

        const geometry = await page.getByTestId('mirror-panel').evaluate((root) => ({
            minButtonHeight: Math.min(...[...root.querySelectorAll<HTMLElement>('button')].map((node) => node.getBoundingClientRect().height)),
            horizontalOverflow: root.scrollWidth - root.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        }));
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(44);
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    });
});
