import { devices, expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

// 2026-10 제품 통합 수용: 같은 소스의 자연 플레이 스냅숏으로 세 폭을 돌며 찾은 배치 결함 다섯 건의 되돌림을 막는다.
//   ① 전투 결과 카드가 하단 고정이 아니었다(`.panel-noise`가 `fixed`를 덮어 12px 밀리고 오른쪽 4px가 잘렸다) · 8 ~ 10px 글자
//   ② 현재 지역 카드의 "추천" 칩 · 지역 이름이 375 · 390px에서 세로로 한 글자씩 꺾였다
//   ③ 375px 상태바에서 두 글자 이름이 "용…"이 됐다
//   ④ 지도 · 이동 버튼 폭 40px, 전투 기록 펼치기 높이 32px
//   ⑤ 한국어가 낱말 안에서 꺾였다("진/행" · "모닥/불")
// 2026-10 Wave 67: 같은 투어가 남긴 기록 탭 관찰(원장 §67.6)의 되돌림도 막는다.
//   ⑥ 기록 탭 조작이 44px보다 작았다(가방 분류 30 · 빠른 칸 24 · 사용 · 강화 보기 38 · 장비 강화 보기 31 · 상세 보기 38 · 세트 목록 32 · 성장 조언 36 · 임무 게시판 42)
//   ⑦ 375px에서 기술 탭 제목이 "나이트 전투 …", 보조 장비 칸이 "양손 무기가 …", 가방 카드 설명 줄이 "한손 무기 · 공…"으로 잘렸다
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

// 자연 플레이 스냅숏(나이트 Lv44 계승 3단계, 원장 §67.2)에서 기록 탭 화면을 만드는 부분만 옮겼다 —
// 양손 무기(보조 장비 칸을 함께 쓴다) · 장착 못 하는 무기 · 소모품 · 재료 · 무기 기술 선택.
const LATE_KNIGHT = {
    // 마을에서 연다 — 임무 탭의 "임무 게시판 열기"는 안전지대에서만 그린다.
    name: '용사', job: '나이트', level: 44, loc: '시작의 마을', gold: 858275,
    equip: {
        weapon: { name: '빙원의 장창', type: 'weapon', hands: 2, val: 55, tier: 3, price: 1490, elem: '냉기', jobs: ['전사', '나이트'], desc: '북부 설원의 혹한이 응결된 장창.', desc_stat: 'ATK+55(냉) / 2H', id: 'e2e_w67_spear', baseItemName: '빙원의 장창', enhance: 4 },
        armor: { name: '미스릴 갑옷', type: 'armor', val: 35, tier: 3, price: 1100, jobs: ['전사', '나이트', '드래곤 나이트', '팔라딘'], desc: '가볍고 튼튼한 미스릴 갑옷.', desc_stat: 'DEF+35', id: 'e2e_w67_mithril', baseItemName: '미스릴 갑옷', enhance: 3 },
        offhand: null,
    },
    inv: [
        { name: '세계수의 검', type: 'weapon', val: 192, tier: 5, price: 30500, elem: '자연', jobs: ['전사', '나이트', '팔라딘', '드래곤 나이트'], desc: '세계수 숲의 정수가 깃든 성검. 자연과 빛의 힘이 공명한다.', desc_stat: 'ATK+192(자)', id: 'e2e_w67_worldtree', baseItemName: '세계수의 검' },
        { name: '해독제', type: 'cure', effect: 'poison', price: 50, desc: '중독 상태를 치료', desc_stat: '해독', id: 'e2e_w67_antidote' },
        { name: '상급 체력 물약', type: 'hp', val: 300, price: 150, desc: 'HP 300 회복', desc_stat: 'HP+300', id: 'e2e_w67_potion_a' },
        { name: '상급 체력 물약', type: 'hp', val: 300, price: 150, desc: 'HP 300 회복', desc_stat: 'HP+300', id: 'e2e_w67_potion_b' },
        { name: '천공 결정', type: 'mat', price: 520, desc: '천공 정원에서 채집한 마력 결정', desc_stat: '재료', id: 'e2e_w67_crystal' },
    ],
    skillLoadout: { selected: 7, cooldowns: {} },
};

const loadLateKnightFixture = async (page: Page) => {
    await page.goto('/?e2e=1&deviceQa=system-settings', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SETTINGS_KEY), { timeout: 20_000 }).toBe(true);
    const fixture = await page.evaluate(({ key, knight }) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.player = { ...saved.player, ...knight, stats: { ...saved.player.stats, lastSeenAt: Date.now() } };
        saved.gameState = 'idle';
        saved.enemy = null;
        saved.currentEvent = null;
        return JSON.stringify(saved);
    }, { key: SETTINGS_KEY, knight: LATE_KNIGHT });
    await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot), { key: SETTINGS_KEY, snapshot: fixture });
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.job)).toBe('나이트');
    for (const id of ['return-briefing-close', 'milestone-story-close']) {
        const close = page.getByTestId(id);
        if (await close.isVisible().catch(() => false)) await close.click();
    }
};

const openArchiveTab = async (page: Page, tab: string) => {
    const content = page.getByTestId('mobile-archive-console-content');
    if (!(await content.isVisible().catch(() => false))) {
        const consoleButton = page.getByTestId('mobile-console-open-archive');
        if (await consoleButton.isVisible().catch(() => false)) await consoleButton.click();
        else await page.getByTestId('status-character-chip').click();
    }
    await page.getByTestId(`archive-tab-${tab}`).click();
    await expect(content).toBeVisible();
    return content;
};

// 상세 보기를 켠 상태로 맞춘다(강화 보기 · 세트 목록은 상세 보기에서만 그린다).
const showDetails = async (toggle: Locator) => {
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

// 화면에 보이는 버튼 중 44px보다 작은 것.
const findUndersizedButtons = (root: Locator) => root.locator('button').evaluateAll((buttons, min) => buttons.flatMap((button) => {
    if (!(button instanceof HTMLElement) || button.offsetParent === null) return [];
    const bounds = button.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return [];
    return bounds.width < min || bounds.height < min
        ? [`${button.dataset.testid || button.textContent?.trim().slice(0, 24)} ${Math.round(bounds.width)}x${Math.round(bounds.height)}`]
        : [];
}), TOUCH_MIN);

// 글자가 자기 칸 밖으로 넘치면(말줄임 · 잘림) 잘린 것이다.
const isClipped = (target: Locator) => target.evaluate((element) => (
    element.scrollWidth > element.clientWidth + 0.5 || element.scrollHeight > element.clientHeight + 0.5
));

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

    test(`${viewport.width}px 후반 기록 탭의 조작은 44px이고 제목 · 칸 이름 · 설명 줄이 잘리지 않는다`, async ({ browser, baseURL }) => {
        const { context, page } = await newMobilePage(browser, baseURL, viewport);
        try {
            await loadLateKnightFixture(page);

            // 장비: 상세 보기 · 강화 보기 · 세트 목록이 44px이고, 양손 무기가 쓰는 보조 장비 칸 이름이 잘리지 않는다.
            let content = await openArchiveTab(page, 'equipment');
            await showDetails(page.getByTestId('equipment-detail-toggle'));
            await expect(page.getByTestId('equipment-enhance-weapon')).toBeVisible();
            await expect(page.getByTestId('job-set-catalog-toggle')).toBeVisible();
            expect(await findUndersizedButtons(content)).toEqual([]);
            const twoHandSlot = page.getByTestId('equipment-panel').getByText('양손 무기가 함께 사용', { exact: true });
            await expect(twoHandSlot).toBeVisible();
            expect(await isClipped(twoHandSlot)).toBe(false);
            expect(await countMidWordBreaks(twoHandSlot)).toBe(0);

            // 가방: 분류 · 빠른 칸 · 사용 · 강화 보기가 44px이고, 무기 설명 줄이 잘리지 않는다.
            content = await openArchiveTab(page, 'inventory');
            await showDetails(page.getByTestId('inventory-detail-toggle'));
            await expect(page.getByTestId('quick-slot-assign-0').first()).toBeVisible();
            await expect(page.getByTestId('inventory-enhance-e2e_w67_worldtree')).toBeVisible();
            expect(await findUndersizedButtons(content)).toEqual([]);
            const statLine = content.getByText(/^한손 무기 · 공격력/).first();
            await expect(statLine).toBeVisible();
            expect(await isClipped(statLine)).toBe(false);

            // 기술: 제목 "나이트 전투 기술"이 잘리지 않는다(길면 "현재 선택"이 다음 줄로 내려간다).
            await openArchiveTab(page, 'skills');
            const skillTitle = page.getByTestId('skill-tree-preview').locator('h2').first();
            await expect(skillTitle).toHaveText('나이트 전투 기술');
            expect(await isClipped(skillTitle)).toBe(false);

            // 임무 · 지도: 임무 게시판 열기 · 성장 조언을 포함한 모든 조작이 44px이다.
            content = await openArchiveTab(page, 'quest');
            await expect(page.getByTestId('quest-tab-open-board')).toBeVisible();
            expect(await findUndersizedButtons(content)).toEqual([]);
            content = await openArchiveTab(page, 'map');
            await expect(content.getByRole('button', { name: /성장 조언/ })).toBeVisible();
            expect(await findUndersizedButtons(content)).toEqual([]);
        } finally {
            await context.close();
        }
    });
}
