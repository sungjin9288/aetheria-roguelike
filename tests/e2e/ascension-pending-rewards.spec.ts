import { expect, test, type Page } from '@playwright/test';
import type { TrueEndingJourneySnapshot } from '../../src/hooks/useGameTestApi';

const snapshot = (page: Page) => page.evaluate(() => (
    window.__AETHERIA_TEST_API__?.getTrueEndingJourneySnapshot?.()
)) as Promise<TrueEndingJourneySnapshot>;
const flush = (page: Page) => page.evaluate(async () => {
    await window.__AETHERIA_TEST_API__?.flushLocalSave?.();
});

async function winOrdinaryEnding(page: Page, extraQuest = false) {
    await page.goto('/?e2e=1&deviceQa=true-ending-journey');
    await expect(page.getByTestId('combat-action-attack')).toBeVisible();
    await flush(page);
    // 기존 격리 fixture의 계승 단계만 낮춰 실제 마왕 전투가 일반 계승으로 이어지게 한다.
    // 최초 복원 때만 주입하므로 뒤의 reload는 실제 수령/계승 저장을 검증한다.
    await page.addInitScript((extra) => {
        if (sessionStorage.getItem('ordinary-ending-fixture-ready')) return;
        const key = 'aetheria.device-qa.true-ending-journey.snapshot.v1';
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.player.meta.prestigeRank = 0;
        saved.player.meta.endgame.primalShards = 0;
        if (extra) saved.player.quests.push({ id: 1, progress: 3, isBounty: false });
        localStorage.setItem(key, JSON.stringify(saved));
        sessionStorage.setItem('ordinary-ending-fixture-ready', '1');
    }, extraQuest);
    await page.reload();
    await expect.poll(async () => (await snapshot(page))?.prestigeRank).toBe(0);
    await expect(page.getByTestId('combat-action-attack')).toBeVisible();
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.armNextCombatSeed?.(1))).toBe(true);
    await page.getByTestId('combat-action-attack').click();
    await expect(page.getByTestId('ascension-screen')).toBeVisible();
    await expect(page.getByTestId('ascension-claim-quest-87')).toBeVisible();
    await expect(page.getByTestId('ascension-confirm')).toBeDisabled();
}

for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`${viewport.width}: ordinary ending retains pending rewards through reload and one ascension`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await winOrdinaryEnding(page);
        await flush(page);
        await page.reload();
        await expect(page.getByTestId('ascension-claim-quest-87')).toBeVisible();
        await expect(page.getByTestId('ascension-confirm')).toBeDisabled();
        await page.evaluate(() => {
            document.documentElement.style.setProperty('--aether-safe-area-top', '47px');
            document.documentElement.style.setProperty('--aether-safe-area-bottom', '34px');
        });
        for (const id of ['ascension-claim-quest-87', 'ascension-confirm', 'ascension-cancel']) {
            const button = page.getByTestId(id);
            await expect(button).toBeInViewport();
            expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
        await expect(page.getByTestId('ascension-pending-quests')).toContainText('수령 기록은 계승 후에도 남습니다');
        if (process.env.AETHERIA_CAPTURE_ASCENSION) {
            await page.screenshot({ path: `output/playwright/ascension-rewards-20260928/pending-${viewport.width}.png` });
        }
        await page.getByRole('button', { name: '[스토리] 세계의 끝 보상 받기', exact: true }).evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });
        await expect(page.getByTestId('ascension-pending-quests')).toBeHidden();
        await expect(page.getByTestId('ascension-confirm')).toBeEnabled();
        expect((await snapshot(page)).claimedQuestIds.filter((id) => id === 87)).toHaveLength(1);
        await page.getByTestId('ascension-confirm').evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });
        await expect(page.getByTestId('ascension-screen')).toBeHidden();
        await expect.poll(async () => (await snapshot(page))?.prestigeRank).toBe(1);
        await flush(page);
        await page.reload();
        await expect.poll(async () => (await snapshot(page))?.prestigeRank).toBe(1);
        const restored = await snapshot(page);
        expect(restored.gameState).toBe('idle');
        expect(restored.level).toBe(1);
        expect(restored.claimedQuestIds.filter((id) => id === 87)).toHaveLength(1);
        expect(restored.activeQuestIds).not.toContain(87);
    });
}

test('another completed quest keeps ascension blocked and continuing preserves the current journey', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await winOrdinaryEnding(page, true);
    await expect(page.getByTestId('ascension-claim-quest-1')).toBeVisible();
    await page.getByTestId('ascension-claim-quest-87').click();
    await expect(page.getByTestId('ascension-claim-quest-87')).toBeHidden();
    await expect(page.getByTestId('ascension-confirm')).toBeDisabled();
    await expect(page.getByTestId('ascension-cancel')).toBeEnabled();
    await page.getByTestId('ascension-cancel').click();
    await expect(page.getByTestId('ascension-screen')).toBeHidden();
    const continued = await snapshot(page);
    expect(continued.gameState).toBe('idle');
    expect(continued.level).toBeGreaterThan(1);
    expect(continued.prestigeRank).toBe(0);
    expect(continued.claimedQuestIds).toContain(87);
    expect(continued.activeQuestIds).toContain(1);
    await flush(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aetheria.device-qa.true-ending-journey.snapshot.v1')!));
    expect(saved.player.inv.some((item: { name: string }) => item.name === '성검 에테르니아')).toBe(true);
});
