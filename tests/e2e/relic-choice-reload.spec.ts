import { test, expect } from '@playwright/test';

/**
 * E2E: 유물 선택 중 리로드 (2026-09 Wave 34, 원장 §27.6 잔여 → §34).
 *
 * `pendingRelics`가 세이브 봉투 밖이던 동안 선택 화면에서 리로드하면 제안이 사라졌다(제안을 만든 사건은 이미 저장돼
 * 다시 오지 않는다). device-QA 시나리오는 실제 로컬 저장 → migrateData → LOAD_DATA 경로를 타므로 그대로 쓴다.
 */

const SAVE_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';

test('유물 선택 화면에서 리로드해도 같은 제안이 다시 뜬다', async ({ page }) => {
    await page.goto('/?e2e=1&deviceQa=system-settings');
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.level), { timeout: 20_000 }).toBe(18);

    // 실제 유물 3개(불멸 · 피의 계약 · 쌍검)를 제안한다 — 로드는 id를 `RELICS` 정의로만 되살리므로 테스트용 가짜 유물은 쓰지 않는다.
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectUndyingRelicChoice?.());
    await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 8_000 });
    const pendingNames = () => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').pendingRelics);
    const offered = await pendingNames();
    expect(offered).toHaveLength(3);

    // 자동 저장(디바운스)이 제안을 실은 봉투를 쓸 때까지 기다린다.
    await expect.poll(() => page.evaluate((key) => (
        JSON.parse(localStorage.getItem(key) || '{}').pendingRelics?.length ?? 0
    ), SAVE_KEY)).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 20_000 });
    expect(await pendingNames()).toEqual(offered);
    for (const name of offered) await expect(page.getByTestId('relic-choice-options')).toContainText(name);
});
