import { expect, test } from '@playwright/test';
import { startE2ERun } from './testHelpers';

test.describe('계승과 다음 여정 화면', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.());
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });
    });

    test('영구 성장과 다음 세계의 변화를 결정 버튼과 함께 보여준다', async ({ page }) => {
        const screen = page.getByTestId('ascension-screen');

        await expect(screen).toContainText('다음 여정으로 계승');
        await expect(screen).toContainText('심연의 탐험가');
        await expect(page.getByTestId('ascension-current-unlock')).toContainText('심연의 메아리');
        await expect(page.getByTestId('ascension-permanent-growth')).toContainText('+180');
        // 2026-10 Wave 58: 계승 보상 정수에도 계승 단계 배율(2단계 +10%)이 곱해진다 — 180 + 220.
        await expect(page.getByTestId('ascension-permanent-growth')).toContainText('+400');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+10%');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+15%');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+16%');
        await expect(page.getByTestId('ascension-enemy-scaling')).toContainText('+24%');
        await expect(page.getByTestId('ascension-preserved-summary')).toContainText('도감');
        await expect(page.getByTestId('ascension-reset-summary')).toContainText('장비와 가방');
        await expect(page.getByTestId('ascension-cancel')).toBeVisible();
        await expect(page.getByTestId('ascension-confirm')).toBeVisible();
        // 2026-10 Wave 58: 계승 7단계 "도전 조건을 하나 더"를 고를 곳 — 인트로와 같은 선택기가 계승 화면에도 있다.
        await expect(page.getByTestId('ascension-challenge-settings')).toBeVisible();
        await expect(page.getByTestId('ascension-challenge-settings')).toContainText('도전 규칙');

        const geometry = await screen.evaluate((root) => {
            const scrollRegion = root.querySelector<HTMLElement>('[data-testid="ascension-scroll-region"]');
            const leaves = [...root.querySelectorAll<HTMLElement>('*')]
                .filter((node) => node.children.length === 0 && (node.textContent || '').trim());
            const fontSizes = leaves.map((node) => parseFloat(getComputedStyle(node).fontSize));
            // 닫힌 <details>(도전 규칙 선택 — Wave 58) 안의 버튼은 펼치기 전까지 보이지 않는다. 보이는 버튼만 잰다.
            const buttons = [...root.querySelectorAll<HTMLElement>('button')].filter((node) => !node.closest('details:not([open])'));
            const buttonHeights = buttons.map((node) => node.getBoundingClientRect().height);
            // 2026-10 Wave 94: 회차 규칙 카드는 스크롤 영역 안이다(스크롤로 닿는다) — 첫 화면에 있어야 하는 것은 영역 밖의 결정 버튼이고,
            //   영역 안 버튼은 영역 폭 안에 있어야 한다.
            const visibleButtons = buttons.filter((node) => !scrollRegion?.contains(node)).every((node) => {
                const bounds = node.getBoundingClientRect();
                return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
            });
            const regionBounds = scrollRegion?.getBoundingClientRect();
            const scrollButtonsInside = buttons.filter((node) => scrollRegion?.contains(node)).every((node) => {
                const bounds = node.getBoundingClientRect();
                return Boolean(regionBounds) && bounds.left >= regionBounds!.left - 1 && bounds.right <= regionBounds!.right + 1;
            });

            return {
                bounds: root.getBoundingClientRect().toJSON(),
                minFont: Math.min(...fontSizes),
                minButtonHeight: Math.min(...buttonHeights),
                visibleButtons,
                scrollButtonsInside,
                scrollOverflow: scrollRegion ? getComputedStyle(scrollRegion).overflowY : null,
                horizontalOverflow: root.scrollWidth - root.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });

        expect(geometry.bounds.top).toBe(0);
        expect(geometry.bounds.bottom).toBeGreaterThanOrEqual(843);
        expect(geometry.bounds.bottom).toBeLessThanOrEqual(844);
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButtonHeight).toBeGreaterThanOrEqual(48);
        expect(geometry.visibleButtons).toBe(true);
        expect(geometry.scrollButtonsInside).toBe(true);
        expect(geometry.scrollOverflow).toBe('auto');
        expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.screenshot({
            path: 'playtest-artifacts/long-term-progression-audit/ascension-journey-390x844.png',
            animations: 'disabled',
            fullPage: false,
        });
    });

    test('계승을 미루면 현재 여정과 성장 상태를 그대로 유지한다', async ({ page }) => {
        // W8-Z6: AetheriaTestApi 도입 후 getAscensionSnapshot()의 반환은 `| undefined`
        //   (옵셔널 체이닝) — e2e 실행 중엔 항상 존재하므로 non-null로 좁혀 받는다.
        const before = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;

        await page.getByTestId('ascension-cancel').click();
        await expect(page.getByTestId('ascension-screen')).toBeHidden();

        const after = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;
        expect(after.gameState).toBe('idle');
        expect(after.level).toBe(before.level);
        expect(after.prestigeRank).toBe(before.prestigeRank);
        expect(after.essence).toBe(before.essence);
        expect(after.inventoryCount).toBe(before.inventoryCount);
        expect(after.relicCount).toBe(before.relicCount);
    });

    test('계승을 확정하면 표시된 영구 성장만 남기고 새 여정을 시작한다', async ({ page }) => {
        await page.getByTestId('ascension-confirm').click();
        await expect(page.getByTestId('ascension-screen')).toBeHidden();

        const after = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;
        expect(after.gameState).toBe('idle');
        expect(after.name).toBe('리베아');
        expect(after.level).toBe(1);
        expect(after.prestigeRank).toBe(3);
        expect(after.essence).toBe(400);
        expect(after.bonusAtk).toBe(15);
        expect(after.bonusHp).toBe(75);
        expect(after.bonusMp).toBe(45);
        expect(after.relicCount).toBe(0);
        expect(after.inventoryIds).not.toContain('ascension-smoke-blade');
        expect(after.inventoryIds).not.toContain('ascension-smoke-potion');
    });
});

// 2026-10 Wave 92 · 94: 계승 화면은 회차 규칙 카드 3장을 보이고, 선택형 규칙(뒤엉킨 전설)을 고르면 받아들임 · 거절의 측정 차이를
//   두 줄로 보이며 고른 쪽을 밝힌다. 이 시드(2단계 → 3단계, 영수증 없음)의 패는 길 잃은 순례 · 암흑의 군단 · 뒤엉킨 전설이다.
test.describe('계승 화면 — 회차 규칙 카드 · 선택형 규칙 미리보기', () => {
    test('카드를 고르면 그 규칙의 측정 차이를 보이고 거절하면 강조가 넘어간다 (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.(2));
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });

        const offer = page.getByTestId('ascension-rule-offer');
        await offer.scrollIntoViewIfNeeded();
        await expect(page.getByTestId('ascension-rule-card-lost_pilgrimage')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('ascension-ascension-rule-outlook')).toHaveCount(0);
        await page.getByTestId('ascension-rule-card-tangled_legends').click();
        await expect(page.getByTestId('ascension-rule-card-tangled_legends')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('ascension-rule-card-lost_pilgrimage')).toHaveAttribute('aria-pressed', 'false');

        const outlook = page.getByTestId('ascension-ascension-rule-outlook');
        const accepted = page.getByTestId('ascension-ascension-rule-outlook-accepted');
        const declined = page.getByTestId('ascension-ascension-rule-outlook-declined');
        await outlook.scrollIntoViewIfNeeded();
        await expect(accepted).toContainText('3.6');
        await expect(declined).toContainText('1.7');
        await expect(accepted).toHaveClass(/text-orange-100/);

        await page.getByTestId('ascension-ascension-rule-toggle').click();
        await expect(declined).toHaveClass(/text-orange-100/);
        await expect(accepted).toHaveClass(/text-slate-400/);

        const offerGeometry = await offer.evaluate((root) => ({
            minFont: Math.min(...[...root.querySelectorAll<HTMLElement>('*')].filter((node) => (node.textContent || '').trim())
                .map((node) => parseFloat(getComputedStyle(node).fontSize))),
            minButton: Math.min(...[...root.querySelectorAll<HTMLElement>('button')].map((node) => node.getBoundingClientRect().height)),
            overflow: root.scrollWidth - root.clientWidth,
        }));
        expect(offerGeometry.minFont).toBeGreaterThanOrEqual(11);
        expect(offerGeometry.minButton).toBeGreaterThanOrEqual(44);
        expect(offerGeometry.overflow).toBeLessThanOrEqual(1);

        const geometry = await outlook.evaluate((root) => {
            const leaves = [...root.querySelectorAll<HTMLElement>('*')].filter((node) => (node.textContent || '').trim());
            const screen = document.querySelector<HTMLElement>('[data-testid="ascension-screen"]')!;
            return {
                minFont: Math.min(...leaves.map((node) => parseFloat(getComputedStyle(node).fontSize))),
                overflow: root.scrollWidth - root.clientWidth,
                screenOverflow: screen.scrollWidth - screen.clientWidth,
                pageWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            };
        });
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.screenOverflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    });
});

// 2026-10 Wave 105: 기본 여섯 규칙을 모두 정복한 뒤의 계승 — 패는 겹친 규칙뿐이고, 고른 카드의 두 비틀기가 잠긴 칸이 되어 새 여정에 강제된다.
test.describe('계승 화면 — 겹친 회차 규칙', () => {
    test('2순환 패는 겹친 카드이고 두 비틀기를 함께 보이며, 계승하면 두 비틀기가 새 여정에 걸린다 (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.(6, 'e2e-stacked', false, true));
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });

        const offer = page.getByTestId('ascension-rule-offer');
        await offer.scrollIntoViewIfNeeded();
        const cards = offer.locator('[data-testid^="ascension-rule-card-"]');
        await expect(cards).toHaveCount(3);
        const ids = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
        for (const id of ids) expect(id).toMatch(/^ascension-rule-card-stacked_/);
        await expect(offer).toContainText(' + ');

        const locked = page.locator('[data-testid^="ascension-challenge-"][aria-disabled="true"]');
        await expect(locked).toHaveCount(2);

        const geometry = await offer.evaluate((root) => ({
            minFont: Math.min(...[...root.querySelectorAll<HTMLElement>('*')].filter((node) => (node.textContent || '').trim())
                .map((node) => parseFloat(getComputedStyle(node).fontSize))),
            minButton: Math.min(...[...root.querySelectorAll<HTMLElement>('button')].map((node) => node.getBoundingClientRect().height)),
            overflow: root.scrollWidth - root.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        }));
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButton).toBeGreaterThanOrEqual(44);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        const lockedIds = await locked.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')!.replace('ascension-challenge-', '')));
        await page.getByTestId('ascension-confirm').click();
        await expect(page.getByTestId('ascension-screen')).toBeHidden();
        const after = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;
        expect(after.prestigeRank).toBe(7);
        expect(after.ascensionRuleId).toMatch(/^stacked_/);
        expect(after.ascensionSecondModifier).not.toBeNull();
        expect(after.challengeModifiers.slice(0, 2).sort()).toEqual([...lockedIds].sort());
    });
});

// 2026-10 Wave 95: 회차 규칙 패 다시 뽑기 — 첫 번째는 무료이고 처음 패로 돌아갈 수 없으며, 그 뒤는 넘어가는 정수 사다리를 내려놓는다.
//   이 시드(2단계 → 3단계, 영수증 e2e-reroll, 사다리 400단계)의 패: 처음 = dry_dragon_road · shadow_legion · lost_pilgrimage,
//   첫 다시 뽑기 = shadow_legion · fading_dimension · empty_crusade(덱 전체에서 다시 무작위), 둘째 = fading_dimension · lost_pilgrimage · shadow_legion.
test.describe('계승 화면 — 회차 규칙 패 다시 뽑기', () => {
    test('무료로 한 번 다시 뽑고, 대가를 치러 다시 뽑으면 넘어가는 사다리가 줄어든 채 계승한다 (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.(2, 'e2e-reroll'));
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });

        const reroll = page.getByTestId('ascension-rule-reroll');
        await reroll.scrollIntoViewIfNeeded();
        await expect(page.getByTestId('ascension-rule-card-dry_dragon_road')).toBeVisible();
        await expect(reroll).toHaveText('다시 뽑기 · 무료');
        await expect(page.getByTestId('ascension-rule-reroll-count')).toHaveText('다시 뽑음 0/3');
        const box = await reroll.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);

        await reroll.click();
        for (const id of ['shadow_legion', 'fading_dimension', 'empty_crusade']) {
            await expect(page.getByTestId(`ascension-rule-card-${id}`)).toBeVisible();
        }
        await expect(page.getByTestId('ascension-rule-card-dry_dragon_road')).toHaveCount(0);
        await expect(page.getByTestId('ascension-rule-card-empty_crusade')).toHaveAttribute('aria-pressed', 'true');
        await expect(reroll).toHaveText('다시 뽑기 · 넘어가는 정수 사다리 40 → 20단계');
        await expect(page.getByTestId('ascension-ladder-reroll-cost')).toHaveCount(0);

        await reroll.click();
        await expect(page.getByTestId('ascension-rule-card-empty_crusade')).toHaveCount(0);
        await expect(page.getByTestId('ascension-rule-card-lost_pilgrimage')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId('ascension-rule-reroll-count')).toHaveText('다시 뽑음 2/3');
        await expect(page.getByTestId('ascension-ladder-reroll-cost')).toHaveCount(1);
        await expect(page.getByTestId('ascension-ladder-carry')).toContainText('400단계 중 20단계(5%, 최대 70단계)');

        const geometry = await page.getByTestId('ascension-rule-offer').evaluate((root) => ({
            minFont: Math.min(...[...root.querySelectorAll<HTMLElement>('*')].filter((node) => (node.textContent || '').trim())
                .map((node) => parseFloat(getComputedStyle(node).fontSize))),
            minButton: Math.min(...[...root.querySelectorAll<HTMLElement>('button')].map((node) => node.getBoundingClientRect().height)),
            overflow: root.scrollWidth - root.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        }));
        expect(geometry.minFont).toBeGreaterThanOrEqual(11);
        expect(geometry.minButton).toBeGreaterThanOrEqual(44);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.getByTestId('ascension-confirm').click();
        await expect(page.getByTestId('ascension-screen')).toBeHidden();
        const after = (await page.evaluate(() => window.__AETHERIA_TEST_API__?.getAscensionSnapshot?.()))!;
        expect(after.gameState).toBe('idle');
        expect(after.prestigeRank).toBe(3);
        expect(after.ascensionRuleId).toBe('lost_pilgrimage');
        expect(after.ladderRank).toBe(20);
    });
});

// 2026-10 Wave 98: 끝없는 거울이 열렸으면 계승 화면이 계승 뒤 정수로 살 수 있는 단계 수를 알린다(표시만).
//   이 시드(2단계, 거울 8노드 완성, 정수 9,000)는 계승 보상(2단계 × 에센스 공명 배율) 330을 더해 9,330 — 2,000 × 3 + 2,500 = 8,500까지 4단계다.
test.describe('계승 화면 — 끝없는 거울 안내', () => {
    test('계승 뒤 정수로 살 수 있는 단계 수와 이번 회차에 새긴 단계를 보이고, 거울에서 한 단계 사면 둘 다 바뀐다 (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await startE2ERun(page);
        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAscensionJourneyScenario?.(2, undefined, true));
        await expect(page.getByTestId('ascension-screen')).toBeVisible({ timeout: 8_000 });

        const guide = page.getByTestId('ascension-mirror-endless');
        const cycle = page.getByTestId('ascension-cycle-mirror');
        await guide.scrollIntoViewIfNeeded();
        // 2026-10 Wave 100: 이번 회차 요약 — 이 시드는 회차 기준점이 없는 계승 단계라 각인 · 정예 줄을 지어내지 않는다.
        await expect(page.getByTestId('ascension-cycle-summary')).toBeVisible();
        await expect(page.getByTestId('ascension-cycle-rule')).toContainText('아직 정복하지 못함');
        await expect(page.getByTestId('ascension-cycle-signatures')).toHaveCount(0);
        await expect(page.getByTestId('ascension-cycle-elite')).toHaveCount(0);
        // 2026-10 Wave 99: 이번 회차에 새긴 끝없는 거울 — 시드는 아직 새긴 것이 없다.
        await expect(cycle).toHaveText('이번 회차에는 끝없는 거울을 새기지 않았습니다.');
        await expect(guide).toHaveText('계승 뒤 정수 9,330: 끝없는 거울을 4단계 더 새길 수 있습니다. 단계마다 공격력 +1 · 생명 +5 · 기력 +3 중 하나, 다음 단계 비용 정수 2,000.');

        const geometry = await page.getByTestId('ascension-permanent-growth').evaluate((root) => ({
            guideFont: parseFloat(getComputedStyle(root.querySelector<HTMLElement>('[data-testid="ascension-mirror-endless"]')!).fontSize),
            overflow: root.scrollWidth - root.clientWidth,
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        }));
        expect(geometry.guideFont).toBeGreaterThanOrEqual(11);
        expect(geometry.overflow).toBeLessThanOrEqual(1);
        expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);

        await page.getByTestId('ascension-open-mirror').click();
        await expect(page.getByTestId('mirror-panel')).toBeVisible();
        await page.getByTestId('mirror-path-endless').click();
        await page.getByTestId('mirror-confirm').click();
        await expect(page.getByTestId('mirror-current-effect')).toHaveText('거울로 새긴 영구 공격력 +1');
        await page.getByRole('button', { name: '에테르 거울 닫기' }).click();
        await expect(page.getByTestId('mirror-panel')).toBeHidden();

        await expect(cycle).toHaveText('이번 회차에 새긴 끝없는 거울 1단계: 영구 공격력 +1 · 생명 +0 · 기력 +0');
        await expect(guide).toHaveText('계승 뒤 정수 7,330: 끝없는 거울을 3단계 더 새길 수 있습니다. 단계마다 공격력 +1 · 생명 +5 · 기력 +3 중 하나, 다음 단계 비용 정수 2,000.');
    });
});
