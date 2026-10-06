import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * E2E: 다른 차원의 묘비 (2026-10 Wave 70, 소유자 결정 "이벤트식으로 발생 · 망령과 실제 전투 · 실제 플레이어 묘비만").
 *
 * 시드: seedDimensionGraveScenario() — 풀에 다른 플레이어의 묘비 하나(유품 수치는 위조)를 넣고, 지금 던전에서 다음 탐험이
 * 선택 이벤트를 받을 수 있게 탐험 기록을 맞춘다. 탐험 시드 1은 모닥불을 비껴가고(0.627) 묘비 확률 안(0.003)이다.
 * 판정의 정본은 tests/dimension-grave-event-contract.test.js(실제 explore · 리듀서)다. 여기서는 화면 경로를 확인한다:
 * 탐험 → 이벤트 카드(묘비 주인 · 유품) → 침공 → 망령 전투 → 승리 → 가방의 유품은 카탈로그 수치.
 */

const TRIGGER_SEED = 1;

test.describe('다른 차원의 묘비', () => {
    test('탐험 중 다른 플레이어의 묘비가 나타나고, 망령을 이기면 유품을 카탈로그 수치로 받는다', async ({ page }) => {
        await startE2ERun(page);
        await page.getByTestId('control-town-primary').getByRole('button').first().click();
        await expect(page.getByTestId('control-explore')).toBeVisible({ timeout: 8_000 });

        const seed = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedDimensionGraveScenario?.());
        expect(seed).toBeTruthy();
        const { playerName, itemName, catalogVal, forgedVal } = seed as { playerName: string; itemName: string; catalogVal: number; forgedVal: number };
        expect(forgedVal).not.toBe(catalogVal);

        await page.evaluate((value) => window.__AETHERIA_TEST_API__?.armNextExploreSeed?.(value), TRIGGER_SEED);
        await page.getByTestId('control-explore').click();

        const panel = page.getByTestId('event-panel');
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(panel).toContainText(playerName);
        await expect(panel).toContainText(itemName);
        await expect(page.getByTestId('event-choice-0')).toContainText('침공');
        await expect(page.getByTestId('event-choice-1')).toContainText('기도');
        await expect(page.getByTestId('event-choice-2')).toContainText('지나친다');

        await page.getByTestId('event-choice-0').click();
        await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 8_000 });
        const inCombat = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(inCombat.gameState).toBe('combat');
        expect(inCombat.enemy?.name).toBe(`${playerName}의 망령`);

        for (let turn = 0; turn < 6; turn += 1) {
            const state = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
            if (state.gameState !== 'combat') break;
            await page.getByTestId('combat-action-attack').click();
            await page.waitForTimeout(400);
        }
        await expect.poll(async () => (await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'))).gameState, { timeout: 8_000 })
            .not.toBe('combat');

        const snapshot = await page.evaluate((name) => window.__AETHERIA_TEST_API__?.getDimensionGraveSnapshot?.(name), itemName);
        expect(snapshot?.rewardVals).toEqual([catalogVal]);
        expect(snapshot?.metToday).toBe(1);
        expect(snapshot?.metUids).toEqual(['qa-dimension-grave']);
    });
});
