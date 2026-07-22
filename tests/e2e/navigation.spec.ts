import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 핵심 네비게이션 플로우 — Map / Skills / Stats 탭 진입.
 *
 * cycle 58: 4-pack UX 개선 (avatar/skill/map/shop)이 정상 렌더되는지 검증.
 */
test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('MAP 탭 진입 → 현재 위치와 두 갈래 경로가 첫 화면에 노출', async ({ page }) => {
        const mapTab = page.locator('[data-testid$="-tab-map"]').first();
        await expect(mapTab).toBeVisible({ timeout: 8_000 });
        await mapTab.click();
        await expect(page.getByTestId('map-navigator')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByText('세계 지도', { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText('전체 경로', { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-progress-summary')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-topology')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-current-location-card')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-route-overview')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-primary-route')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-topology-route-1')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-primary-route')).toHaveAttribute('data-region-family', 'forest');
        await expect(page.getByTestId('map-topology-route-1')).toHaveAttribute('data-region-family', 'plains');
        await expect(page.getByTestId('map-topology').locator('img.aether-route-region-art')).toHaveCount(2);
        await expect(page.getByTestId('map-selected-detail')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('map-route-forecast')).toContainText('위험');
        await expect(page.getByTestId('map-route-forecast')).toContainText('예상');
        await expect(page.getByTestId('map-route-forecast')).toContainText('보상');
        await expect(page.getByTestId('map-route-forecast')).toContainText('귀환');
        await expect(page.getByTestId('map-move-selected')).toBeEnabled();

        const firstViewport = await page.evaluate(() => {
            const read = (testId: string) => {
                const node = document.querySelector(`[data-testid="${testId}"]`);
                if (!node) return null;
                const rect = node.getBoundingClientRect();
                return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
            };
            return {
                height: window.innerHeight,
                width: window.innerWidth,
                current: read('map-current-location-card'),
                primary: read('map-primary-route'),
                secondary: read('map-topology-route-1'),
            };
        });

        for (const node of [firstViewport.current, firstViewport.primary, firstViewport.secondary]) {
            expect(node).not.toBeNull();
            expect(node!.top).toBeGreaterThanOrEqual(0);
            expect(node!.bottom).toBeLessThanOrEqual(firstViewport.height);
            expect(node!.left).toBeGreaterThanOrEqual(0);
            expect(node!.right).toBeLessThanOrEqual(firstViewport.width);
        }
        await page.screenshot({ path: 'playtest-artifacts/monster-region-art/map-region-markers.png' });

        const destination = (await page.getByTestId('map-primary-route').locator('strong').innerText()).trim();
        await page.getByTestId('map-move-selected').click();
        await expect(page.getByTestId('map-current-location-card')).toContainText(destination, { timeout: 8_000 });

        await expect(page.getByTestId('map-navigator')).toContainText('레벨');
        await expect(page.getByTestId('map-navigator')).not.toContainText('불러오는 중');
    });

    test('SKILL 탭 진입 → 스킬 카드 + 선택 가능 안내', async ({ page }) => {
        const skillTab = page.locator('[data-testid$="-tab-skills"]').first();
        await expect(skillTab).toBeVisible({ timeout: 8_000 });
        await skillTab.click();
        await expect(page.locator('[data-testid="skill-tree-preview"]')).toContainText('현재 기술', { timeout: 5_000 });
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
        // 도감 안에는 장비/몬스터/제작법 등 세부 탭이 항상 노출
        await expect(page.getByTestId('codex-panel')).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('codex-tab-equip')).toContainText('장비');
        await expect(page.getByTestId('codex-tab-monster')).toContainText('몬스터');
    });

    // cycle 64.5: 신규 콘텐츠(cycle 63 퀘스트, cycle 61 칭호)가 추가된 만큼
    // QUEST / ACHIEVEMENTS 탭 진입 자체가 회귀 가드 가치가 있음.
    test('QUEST 탭 lazy-loading → 퀘스트 패널 진입', async ({ page }) => {
        const questTab = page.locator('[data-testid$="-tab-quest"]').first();
        await expect(questTab).toBeVisible({ timeout: 8_000 });
        await questTab.click();
        // Quest 패널은 항상 임무 진행 정보를 노출
        await expect(page.locator('text=/퀘스트|임무|진행/').first()).toBeVisible({ timeout: 8_000 });
    });

    test('ACHV 탭 lazy-loading → 업적 패널 진입', async ({ page }) => {
        const achvTab = page.locator('[data-testid$="-tab-achievements"]').first();
        await expect(achvTab).toBeVisible({ timeout: 8_000 });
        await achvTab.click();
        // Achievement 패널의 항상 노출되는 키워드
        await expect(page.locator('text=/업적|Achievement|첫|처치|보스/').first()).toBeVisible({ timeout: 8_000 });
    });

    test('SYSTEM 탭 readability mode 토글 → app shell contrast mode 전환', async ({ page }) => {
        const systemTab = page.locator('[data-testid$="-tab-system"]').first();
        await expect(systemTab).toBeVisible({ timeout: 8_000 });
        await systemTab.click();

        await expect(page.getByTestId('readability-settings')).toBeVisible({ timeout: 8_000 });
        await page.getByTestId('readability-mode-high').click();
        await expect(page.locator('[data-app-shell]')).toHaveAttribute('data-readability-mode', 'high');
        await expect(page.getByTestId('readability-mode-current')).toHaveText('선명하게');

        await page.getByTestId('readability-mode-standard').click();
        await expect(page.locator('[data-app-shell]')).toHaveAttribute('data-readability-mode', 'standard');
        await expect(page.getByTestId('readability-mode-current')).toHaveText('표준');
    });
});
