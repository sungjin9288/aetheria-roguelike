import { devices, expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

// 2026-10 제품 통합 수용: 같은 소스의 자연 플레이 스냅숏으로 세 폭을 돌며 찾은 배치 결함 다섯 건의 되돌림을 막는다.
//   ① 전투 결과 카드가 하단 고정이 아니었다(`.panel-noise`가 `fixed`를 덮어 12px 밀리고 오른쪽 4px가 잘렸다) · 8 ~ 10px 글자
//   ② 현재 지역 카드의 "추천" 칩 · 지역 이름이 375 · 390px에서 세로로 한 글자씩 꺾였다
//   ③ 375px 상태바에서 두 글자 이름이 "용…"이 됐다
//   ④ 지도 · 이동 버튼 폭 40px, 전투 기록 펼치기 높이 32px
//   ⑤ 한국어가 낱말 안에서 꺾였다("진/행" · "모닥/불")
const VIEWPORTS = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const SETTINGS_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';

const newMobilePage = async (browser: Browser, baseURL: string | undefined, viewport: { width: number; height: number }) => {
    const context = await browser.newContext({
        ...devices['iPhone 12'],
        baseURL: baseURL || 'http://localhost:4173',
        viewport: { ...viewport },
        screen: { ...viewport },
    });
    return { context, page: await context.newPage() };
};

// 자연 플레이 후반 상태의 모양(두 글자 이름 · 긴 지역 이름 · 6자리 골드)을 격리된 QA 저장소로 불러온다.
const loadLateFieldFixture = async (page: Page) => {
    await page.goto('/?e2e=1&deviceQa=system-settings', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SETTINGS_KEY), { timeout: 20_000 }).toBe(true);
    const fixture = await page.evaluate((key) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.player = { ...saved.player, name: '용사', loc: '어둠의 지하 감옥', gold: 858275 };
        saved.gameState = 'idle';
        saved.enemy = null;
        saved.currentEvent = null;
        return JSON.stringify(saved);
    }, SETTINGS_KEY);
    await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot), { key: SETTINGS_KEY, snapshot: fixture });
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.loc)).toBe('어둠의 지하 감옥');
};

// 줄이 바뀐 자리의 앞뒤가 둘 다 한글이면 낱말 안에서 꺾인 것이다.
const countMidWordBreaks = (root: Locator) => root.evaluate((element) => {
    const isHangul = (ch: string) => /[가-힣]/u.test(ch);
    let breaks = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent || '';
        let prevTop: number | null = null;
        for (let i = 0; i < text.length; i += 1) {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const rect = range.getClientRects()[0];
            if (!rect) continue;
            if (prevTop !== null && rect.top > prevTop + 2 && isHangul(text[i - 1] || '') && isHangul(text[i])) breaks += 1;
            prevTop = rect.top;
        }
    }
    return breaks;
});

const findUndersizedText = (root: Locator) => root.locator('*').evaluateAll((elements) => elements.flatMap((element) => {
    const hasOwnText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
    if (!hasOwnText || !(element instanceof HTMLElement) || element.offsetParent === null) return [];
    const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
    return fontSize < 11 ? [{ text: element.textContent?.trim() || '', fontSize }] : [];
}));

// 44px 최소 폭은 배치 계산에서 43.99997px로 읽힐 수 있다 — 반 픽셀 아래까지는 같은 크기로 본다(40px 회귀는 잡는다).
const TOUCH_MIN = 44 - 0.5;

const expectTouchTarget = async (target: Locator) => {
    await expect(target).toBeVisible();
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(bounds!.height).toBeGreaterThanOrEqual(TOUCH_MIN);
};

for (const viewport of VIEWPORTS) {
    test(`${viewport.width}px 첫 원정 준비의 목표는 낱말 단위로 줄바꿈한다`, async ({ browser, baseURL }) => {
        const { context, page } = await newMobilePage(browser, baseURL, viewport);
        try {
            await startE2ERun(page);
            const prep = page.getByTestId('control-expedition-prep');
            await expect(prep).toBeVisible();
            expect(await page.evaluate(() => {
                const style = getComputedStyle(document.body);
                return [style.wordBreak, style.overflowWrap];
            })).toEqual(['keep-all', 'anywhere']);
            expect(await countMidWordBreaks(prep)).toBe(0);
        } finally {
            await context.close();
        }
    });

    test(`${viewport.width}px 후반 상태의 상태바 · 현재 지역 · 전투 결과 카드가 폭과 읽기 크기를 지킨다`, async ({ browser, baseURL }) => {
        const { context, page } = await newMobilePage(browser, baseURL, viewport);
        try {
            await loadLateFieldFixture(page);

            // ③ 두 글자 이름은 잘리지 않는다 — 좁을 때는 지역이 줄어든다.
            const name = page.getByTestId('status-player-summary').locator('span').first();
            await expect(name).toHaveText('용사');
            expect(await name.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

            // ② "추천" 칩과 추천 지역 이름이 낱말 안에서 꺾이지 않는다.
            const routeStrip = page.getByTestId('control-map-signal');
            await expect(routeStrip).toBeVisible();
            expect(await countMidWordBreaks(routeStrip)).toBe(0);
            // ④ 지도 · 이동 버튼은 44px 터치 영역이다.
            await expectTouchTarget(page.getByTestId('control-map-open'));
            await expectTouchTarget(page.getByTestId('control-route-open'));

            // ① 전투 결과 카드는 화면 하단에 고정된, 가운데 정렬된 오버레이다.
            await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectPostCombatResult?.());
            const card = page.getByTestId('post-combat-card');
            await expect(card).toBeVisible({ timeout: 8_000 });
            await expect(card).toHaveCSS('transform', 'none', { timeout: 4_000 });
            const geometry = await card.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    position: getComputedStyle(element).position,
                    leftGap: bounds.left,
                    rightGap: window.innerWidth - bounds.right,
                    bottomGap: window.innerHeight - bounds.bottom,
                    top: bounds.top,
                };
            });
            expect(geometry.position).toBe('fixed');
            expect(geometry.leftGap).toBeGreaterThanOrEqual(0);
            expect(geometry.rightGap).toBeGreaterThanOrEqual(0);
            expect(Math.abs(geometry.leftGap - geometry.rightGap)).toBeLessThanOrEqual(1);
            expect(geometry.bottomGap).toBeGreaterThanOrEqual(0);
            expect(geometry.top).toBeGreaterThanOrEqual(0);
            expect(await findUndersizedText(card)).toEqual([]);
            expect(await countMidWordBreaks(card)).toBe(0);
            for (const choice of ['post-combat-choice-push', 'post-combat-choice-breather']) {
                await expectTouchTarget(page.getByTestId(choice));
            }
            await page.getByTestId('post-combat-close').click();
            await expect(card).toBeHidden({ timeout: 8_000 });

            // ④ 전투 기록 펼치기도 44px 높이다.
            await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
            const logToggle = page.getByTestId('combat-log-toggle');
            await expect(logToggle).toBeVisible({ timeout: 8_000 });
            const toggleBounds = await logToggle.boundingBox();
            expect(toggleBounds!.height).toBeGreaterThanOrEqual(TOUCH_MIN);
        } finally {
            await context.close();
        }
    });
}
