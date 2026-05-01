import { test, expect } from '@playwright/test';

/**
 * E2E: 핵심 네비게이션 플로우 — Map / Skills / Stats 탭 진입.
 *
 * cycle 58: 4-pack UX 개선 (avatar/skill/map/shop)이 정상 렌더되는지 검증.
 */
test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/?e2e=1');
        const introInput = page.getByTestId('intro-name-input');
        if (await introInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
            await page.getByTestId('intro-start-button').click();
            await expect(introInput).toBeHidden({ timeout: 15_000 });
        }
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 20_000 });
        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await statusChip.click();
        }
    });

    test('MAP 탭 진입 → 지역 카드 노출', async ({ page }) => {
        const mapTab = page.locator('[data-testid$="-tab-map"]').first();
        await expect(mapTab).toBeVisible({ timeout: 8_000 });
        await mapTab.click();
        // tier vertical list (cycle 57)에서 적어도 시작의 마을 또는 다른 지역명 노출
        await expect(page.locator('text=/시작의 마을|World Routes|Atlas/').first()).toBeVisible({ timeout: 5_000 });
    });

    test('SKILL 탭 진입 → 스킬 카드 + 선택 가능 안내', async ({ page }) => {
        const skillTab = page.locator('[data-testid$="-tab-skills"]').first();
        await expect(skillTab).toBeVisible({ timeout: 8_000 });
        await skillTab.click();
        // 스킬 카드 또는 Current Loadout 텍스트 노출
        await expect(page.locator('text=/Current Loadout|스킬|선택/').first()).toBeVisible({ timeout: 5_000 });
    });

    // cycle 61 phase 2: 비-default 탭이 lazy-loading 됨 → 클릭 후 콘텐츠 노출까지
    // Suspense fallback이 잠깐 노출 후 정상 렌더됨을 검증.
    test('STATS 탭 lazy-loading → 콘텐츠 정상 렌더', async ({ page }) => {
        const statsTab = page.locator('[data-testid$="-tab-stats"]').first();
        await expect(statsTab).toBeVisible({ timeout: 8_000 });
        await statsTab.click();
        // StatsPanel 안에 항상 노출되는 텍스트 또는 일반 통계 키워드
        await expect(page.locator('text=/처치|레벨|골드|성향|Stat|Performance/').first()).toBeVisible({ timeout: 8_000 });
    });

    test('CODEX 탭 lazy-loading → 도감 콘텐츠 노출', async ({ page }) => {
        const codexTab = page.locator('[data-testid$="-tab-codex"]').first();
        await expect(codexTab).toBeVisible({ timeout: 8_000 });
        await codexTab.click();
        // Codex 안에는 EQUIP/MONSTER/RECIPE 등 sub tab이 항상 노출
        await expect(page.locator('text=/EQUIP|MONSTER|RECIPE|MATERIAL|LEGEND/').first()).toBeVisible({ timeout: 8_000 });
    });

    // cycle 64.5: 신규 콘텐츠(cycle 63 퀘스트, cycle 61 칭호)가 추가된 만큼
    // QUEST / ACHIEVEMENTS 탭 진입 자체가 회귀 가드 가치가 있음.
    test('QUEST 탭 lazy-loading → 퀘스트 패널 진입', async ({ page }) => {
        const questTab = page.locator('[data-testid$="-tab-quest"]').first();
        await expect(questTab).toBeVisible({ timeout: 8_000 });
        await questTab.click();
        // Quest 패널은 항상 "퀘스트" 또는 "Operations" 텍스트 노출
        await expect(page.locator('text=/퀘스트|Operation|Mission|진행/').first()).toBeVisible({ timeout: 8_000 });
    });

    test('ACHV 탭 lazy-loading → 업적 패널 진입', async ({ page }) => {
        const achvTab = page.locator('[data-testid$="-tab-achievements"]').first();
        await expect(achvTab).toBeVisible({ timeout: 8_000 });
        await achvTab.click();
        // Achievement 패널의 항상 노출되는 키워드
        await expect(page.locator('text=/업적|Achievement|첫|처치|보스/').first()).toBeVisible({ timeout: 8_000 });
    });
});
