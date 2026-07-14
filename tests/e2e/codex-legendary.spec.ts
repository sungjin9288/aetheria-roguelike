import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 전설 도감 (LegendaryCodex) 진입 + 빈 상태 educational hint.
 *
 * 새 캐릭터는 signature 발견 0개 상태 → cycle 28에서 정착된
 * "data-testid=legendary-codex-empty-hint" gold banner가 노출되어야 함.
 *
 * cycle 64: 신규 E2E.
 */
test.describe('Legendary Codex empty state', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('Codex → LEGEND sub tab → 신규 캐릭터에 educational hint 노출', async ({ page }) => {
        // 1. Codex 탭 진입
        const codexTab = page.locator('[data-testid$="-tab-codex"]').first();
        await expect(codexTab).toBeVisible({ timeout: 8_000 });
        await codexTab.click();

        // 2. LEGEND sub tab 클릭 (Codex.tsx의 SUB_TABS에 'legend' 항목 존재)
        const legendButton = page.getByTestId('codex-tab-legend');
        await expect(legendButton).toBeVisible({ timeout: 8_000 });
        await legendButton.click();

        // 3. 빈 상태 educational hint
        const emptyHint = page.getByTestId('legendary-codex-empty-hint');
        await expect(emptyHint).toBeVisible({ timeout: 5_000 });

        // 4. hint 안에 핵심 키워드 포함 ("보스" + "전설 각인")
        const hintText = await emptyHint.textContent();
        expect(hintText || '').toMatch(/보스|전설/);
    });

    test('Codex → LEGEND → pity status panel 노출', async ({ page }) => {
        const codexTab = page.locator('[data-testid$="-tab-codex"]').first();
        await codexTab.click();

        const legendButton = page.getByTestId('codex-tab-legend');
        await legendButton.click();

        // pity status는 항상 노출 (cycle 23 anticipation hint)
        const pityStatus = page.getByTestId('legendary-codex-pity-status');
        await expect(pityStatus).toBeVisible({ timeout: 5_000 });
    });
});
