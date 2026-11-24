import { expect, type Page } from '@playwright/test';
import { openTownFacilities, startE2ERun, stepField, waitForModeTransition } from './testHelpers';

/**
 * 화면 전수 점검(screen-text-clipping · screen-english-words)이 같이 쓰는 2026-11 신규 화면 순회 —
 * 오버월드 지도 · '지난 소식' 시트(지도 · 전투) · 보스 문 도전 카드 · 자동 걷기 멈춤 · 지도 갈래 · 첫 상자 유물 선택 · 강화 갈래 카드 ·
 * 장 보스 규칙 전투 · 충전 강타 예고 · 오늘의 시련(입구 시트 · 걷기 · 나가기 확인 · 결과).
 * 각 화면에 도착할 때마다 `check(화면 이름)`을 부른다. 시드 · 경로는 오버월드 3단계 · H5 · H6 · B5 스펙과 같다.
 */
type Direction = 'up' | 'down' | 'left' | 'right';
type Check = (screen: string) => Promise<void>;

const readState = (page: Page) => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));

const seedField = async (page: Page, kind: 'biome' | 'door' | 'walkChest' | 'trait' | 'firstChest') => {
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

/** 무대 아래 한 줄 소식의 '지난 소식' 단추로 전체 기록 시트를 열어 재고 닫는다(화면 B — 휴대폰 무대 화면에만 있다). */
const checkLogSheet = async (page: Page, check: Check, screen: string) => {
    const open = page.getByTestId('log-sheet-open');
    await expect(open).toBeVisible();
    await open.click();
    const sheet = page.getByTestId('log-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-log-id]').first()).toBeVisible();
    await check(screen);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
};

export const visitNewScreens = async (page: Page, check: Check) => {
    await startE2ERun(page, { name: '용사' });

    // 오버월드 지도(숲이 아닌 바이옴) + 일일 자동 탐험 단추(있을 때).
    await seedField(page, 'biome');
    await check('오버월드 지도');
    if (await page.getByTestId('field-auto-start').count()) await check('오버월드 지도 · 자동 탐험 단추');
    await checkLogSheet(page, check, '지난 소식 시트 · 지도');

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
    await checkLogSheet(page, check, '지난 소식 시트 · 전투');

    // 자동 걷기가 열지 않은 상자 앞에서 멈춘 상태(멈춘 이유 줄은 기록에 남는다).
    await seedField(page, 'walkChest');
    await expect(page.getByTestId('field-walk-start')).toBeEnabled();
    await check('자동 걷기 전');
    await page.getByTestId('field-walk-start').click();
    await expect.poll(async () => (await readState(page)).logTail.some((log: { text: string }) => /자동 걷기를 멈췄습니다/.test(log.text)), { timeout: 8_000 }).toBe(true);
    await expect(page.getByTestId('field-walk-start')).toBeVisible({ timeout: 8_000 });
    await check('자동 걷기 멈춤');

    // 지도 갈래 카드 셋(클리어한 지역의 새 지도) → 고른 지도.
    await seedField(page, 'trait');
    await expect(page.getByTestId('field-trait-panel')).toBeVisible({ timeout: 8_000 });
    await check('지도 갈래');
    await page.getByTestId('field-trait-card-elite').click();
    await check('지도 갈래 · 고른 카드');
    await page.getByTestId('field-trait-confirm').click();
    await expect(page.getByTestId('field-trait-panel')).toHaveCount(0);
    await check('오버월드 지도 · 고른 성격');

    // 첫 여정의 첫 상자 → 유물 선택.
    await seedField(page, 'firstChest');
    const first = await readState(page);
    const beside = { layout: first.player.fieldLayout, pos: first.player.fieldMap.pos };
    const chest = beside.layout.chests.find((entry: { index: number }) => {
        const dx = Math.abs((entry.index % beside.layout.width) - (beside.pos % beside.layout.width));
        const dy = Math.abs(Math.floor(entry.index / beside.layout.width) - Math.floor(beside.pos / beside.layout.width));
        return dx + dy === 1;
    });
    await stepField(page, directionToward(beside.layout.width, beside.pos, chest.index));
    await expect(page.getByTestId('relic-choice-skip')).toBeVisible({ timeout: 8_000 });
    await check('첫 상자 유물 선택');
    await page.getByTestId('relic-choice-skip').click();
    await expect(page.getByTestId('relic-choice-skip')).toHaveCount(0);

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

    // 오늘의 시련 — 안전지대의 입구 시트 → 지도 걷기(시련 줄 · 조작판) → 나가기 확인 → 결과.
    await startE2ERun(page, { name: '용사' });
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedDailyTrialScenario?.('entry'))).toBe(true);
    await openTownFacilities(page);
    await page.getByTestId('control-daily-trial').click();
    await expect(page.getByTestId('daily-trial-sheet')).toBeVisible();
    await check('오늘의 시련 · 입구');
    await page.getByTestId('daily-trial-start').click();
    await expect(page.getByTestId('daily-trial-hud')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('field-map')).toBeVisible();
    await waitForModeTransition(page);
    await check('오늘의 시련 · 지도 걷기');
    await page.getByTestId('daily-trial-leave').click();
    await expect(page.getByTestId('daily-trial-leave-dialog')).toBeVisible();
    await check('오늘의 시련 · 나가기 확인');
    await page.getByTestId('daily-trial-leave-confirm').click();
    await expect(page.getByTestId('daily-trial-result')).toBeVisible();
    await check('오늘의 시련 · 결과');
    await page.getByTestId('daily-trial-return').click();
    await expect(page.getByTestId('daily-trial-hud')).toHaveCount(0);
};
