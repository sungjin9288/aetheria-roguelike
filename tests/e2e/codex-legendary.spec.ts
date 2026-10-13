import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 전설 도감 (LegendaryCodex) 진입 — 발견 0개 화면.
 *
 * 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"): 새 캐릭터의 전설 도감은 어디서 얻는지
 * (보스 · 공명 임계)를 안내하지 않는다. 이전 계약(cycle 28 빈 상태 안내 배너 · cycle 23 공명 카드 상시 노출)은 의도적으로 뒤집었다.
 */
test.describe('Legendary Codex empty state', () => {
    test.beforeEach(async ({ page }) => {
        await startE2ERun(page, { openStatusConsole: true });
    });

    test('Codex → LEGEND sub tab → 신규 캐릭터에 획득처 안내 · 공명 카드가 없다', async ({ page }) => {
        const codexTab = page.locator('[data-testid$="-tab-codex"]').first();
        await expect(codexTab).toBeVisible({ timeout: 8_000 });
        await codexTab.click();

        const legendButton = page.getByTestId('codex-tab-legend');
        await expect(legendButton).toBeVisible({ timeout: 8_000 });
        await legendButton.click();

        await expect(page.getByTestId('codex-legendary')).toBeVisible({ timeout: 5_000 });
        await expect(page.getByTestId('legendary-codex-empty-hint')).toHaveCount(0);
        await expect(page.getByTestId('legendary-codex-pity-status')).toHaveCount(0);
        await expect(page.getByTestId('codex-legendary')).not.toContainText('보스');
    });
});
