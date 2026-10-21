import { expect, test, type Page } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

/**
 * 2026-10 Wave 134(원장 §147): 실제 화면이 그리는 글자와 화면 문구 속성(aria-label · title · alt · placeholder)에 영어 낱말이 없다.
 *
 * 단위 계약(`screen-english-word-contract`)은 코드 · MSG의 문자열을 읽지만, 변수로 건너오는 값은 보지 못한다 — 전설 각인 화면이
 * 레지스트리의 그림 생성 지시문("plate · 가시 숄더 + 혼돈 Z-crack")을, 각인 배지가 데이터 키를 이은 aria-label
 * ("Signature · legendary · unique-weapon")을 그렸다. 이 스펙은 첫 화면부터 기록 탭 11개 · 상점 · 임무 게시판 · 전투 · 원정 결산 ·
 * 유물 선택 · 사망 화면까지 실제 화면을 읽는다. 게임 제목 로고(AETHERIA)만 예외다.
 */
const ARCHIVE_TABS = ['equipment', 'inventory', 'quest', 'achievements', 'skills', 'map', 'stats', 'codex', 'pass', 'graves', 'system'] as const;
const ALLOWED = new Set(['AETHERIA']);

const readEnglish = (page: Page) => page.evaluate(() => {
    const rows: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style')) continue;
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const text = (node.textContent || '').trim();
        if (text) rows.push(text);
    }
    for (const element of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
        for (const name of ['aria-label', 'title', 'alt', 'placeholder']) {
            const value = element.getAttribute(name);
            if (value) rows.push(value);
        }
    }
    return rows.flatMap((row) => (row.match(/[A-Za-z]{2,}/g) || []).map((word) => `${word} ← ${row.slice(0, 80)}`));
});

const expectKoreanOnly = async (page: Page, screen: string) => {
    const words = (await readEnglish(page)).filter((entry) => !ALLOWED.has(entry.split(' ← ')[0]));
    expect(words, screen).toEqual([]);
};

test('실제 화면의 글자 · 화면 문구 속성에 영어 낱말이 없다 — 게임 제목 로고만 예외', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('intro-start-button')).toBeVisible({ timeout: 20_000 });
    await expectKoreanOnly(page, '시작 화면');

    await startE2ERun(page);
    await expectKoreanOnly(page, '원정 준비');

    await page.getByTestId('status-character-chip').click();
    for (const tab of ARCHIVE_TABS) {
        await page.getByTestId(`archive-tab-${tab}`).click();
        await expect(page.getByTestId(`archive-tab-${tab}`)).toHaveAttribute('data-active', 'true');
        await expectKoreanOnly(page, `기록 탭 ${tab}`);
    }
    await page.getByTestId('mobile-console-return-log').click();

    await openTownFacilities(page);
    await page.getByTestId('control-market').click();
    const shop = page.getByTestId('shop-panel');
    await expect(shop).toBeVisible();
    await expectKoreanOnly(page, '상점');
    await page.getByTestId('shop-equipment-detail-toggle').click();
    await expectKoreanOnly(page, '상점 상세');
    await shop.getByRole('button', { name: '판매', exact: true }).first().click();
    await expectKoreanOnly(page, '상점 판매');

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.showReturnBriefingScenario?.());
    await expect(page.getByTestId('return-briefing-card')).toBeVisible({ timeout: 8_000 });
    await expectKoreanOnly(page, '귀환 브리핑');
    await page.getByTestId('return-briefing-close-icon').click();

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());
    await page.getByTestId('control-quests').click();
    await expect(page.getByTestId('quest-board-panel')).toBeVisible({ timeout: 8_000 });
    await expectKoreanOnly(page, '임무 게시판');

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(false));
    await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
    await expectKoreanOnly(page, '전투');

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRelicChoice?.());
    await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 8_000 });
    await expectKoreanOnly(page, '유물 선택');
    await page.getByTestId('relic-choice-skip').click();

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionDebriefScenario?.());
    await expect(page.getByTestId('expedition-debrief-card')).toBeVisible({ timeout: 8_000 });
    await expectKoreanOnly(page, '원정 결산');

    await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRunSummary?.());
    await expect(page.getByTestId('run-summary-card')).toBeVisible({ timeout: 8_000 });
    await expectKoreanOnly(page, '사망 화면');
});
