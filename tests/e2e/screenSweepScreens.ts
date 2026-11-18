import { expect, type Page } from '@playwright/test';
import { startE2ERun, stepField, waitForModeTransition } from './testHelpers';

/**
 * 화면 전수 점검(screen-text-clipping · screen-english-words)이 같이 쓰는 2026-11 신규 화면 순회 —
 * 오버월드 지도 · 보스 문 도전 카드 · 자동 걷기 멈춤 · 강화 갈래 카드 · 장 보스 규칙 전투 · 충전 강타 예고.
 * 각 화면에 도착할 때마다 `check(화면 이름)`을 부른다. 시드 · 경로는 오버월드 3단계 · H5 · H6 · B5 스펙과 같다.
 */
type Direction = 'up' | 'down' | 'left' | 'right';
type Check = (screen: string) => Promise<void>;

const readState = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const seedField = async (page: Page, kind: 'biome' | 'door' | 'walkChest') => {
    const ok = await page.evaluate((value) => window.__AETHERIA_TEST_API__?.seedFieldMapScenario?.(value), kind);
    expect(ok, `${kind} 씨앗`).toBe(true);
    await expect(page.getByTestId('field-map')).toBeVisible({ timeout: 8_000 });
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

export const visitNewScreens = async (page: Page, check: Check) => {
    await startE2ERun(page, { name: '용사' });

    // 오버월드 지도(숲이 아닌 바이옴) + 일일 자동 탐험 단추(있을 때).
    await seedField(page, 'biome');
    await check('오버월드 지도');
    if (await page.getByTestId('field-auto-start').count()) await check('오버월드 지도 · 자동 탐험 단추');

    // 보스 문 → 구역 보스 도전 카드 → 전투.
    await seedField(page, 'door');
    await expect(page.getByTestId('field-door-chip')).toBeVisible();
    await check('오버월드 지도 · 보스 문');
    const state = await readState(page);
    const { layout, pos } = { layout: state.player.fieldLayout, pos: state.player.fieldMap.pos };
    await stepField(page, directionToward(layout.width, pos, layout.door));
    await expect(page.getByTestId('event-panel')).toBeVisible({ timeout: 8_000 });
    await check('구역 보스 도전 카드');
    await page.getByTestId('event-choice-0').click();
    await expect(page.getByTestId('combat-action-attack')).toBeVisible({ timeout: 8_000 });
    await check('보스 문 전투');

    // 자동 걷기가 열지 않은 상자 앞에서 멈춘 상태(멈춘 이유 줄은 기록에 남는다).
    await seedField(page, 'walkChest');
    await expect(page.getByTestId('field-walk-start')).toBeEnabled();
    await check('자동 걷기 전');
    await page.getByTestId('field-walk-start').click();
    await expect.poll(async () => (await readState(page)).logTail.some((log: { text: string }) => /자동 걷기를 멈췄습니다/.test(log.text)), { timeout: 8_000 }).toBe(true);
    await expect(page.getByTestId('field-walk-start')).toBeVisible({ timeout: 8_000 });
    await check('자동 걷기 멈춤');

    // 강화 갈래 카드(+3) — 새 부팅에서 상태 콘솔을 열고 시작한다(강화 스펙과 같은 경로).
    await startE2ERun(page, { openStatusConsole: true });
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedEnhanceScenario?.({ gold: 100_000, materialCount: 3, weaponEnhance: 2 }));
    const panel = page.getByTestId('equipment-panel');
    await expect(panel).toBeVisible();
    if ((await panel.getAttribute('data-equipment-view')) === 'summary') await page.getByTestId('equipment-detail-toggle').click();
    await page.getByTestId('equipment-enhance-weapon').click();
    await expect(page.getByTestId('enhance-branch-stage-3')).toBeVisible();
    await check('강화 갈래 카드');

    // 장 보스 규칙 칩 전투 · 충전 강타 예고.
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedChapterBossRuleScenario?.('마왕', '마왕성'))).toBe(true);
    await expect(page.getByTestId('combat-chapter-rule-chip')).toBeVisible({ timeout: 8_000 });
    await waitForModeTransition(page);
    await check('장 보스 규칙 전투');
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedBossChargeScenario?.('고대 호수의 수호신', '신성한 호수', 100))).toBe(true);
    await expect(page.getByTestId('enemy-intent')).toHaveAttribute('data-intent-kind', 'charge', { timeout: 8_000 });
    await check('보스 충전 강타 예고');
};
