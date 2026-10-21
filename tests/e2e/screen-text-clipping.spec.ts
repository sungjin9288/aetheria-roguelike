import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

/**
 * 출시 전 통합 수용 7차(원장 §149): 실제 화면이 글을 말줄임 · 넘침 숨김으로 자르지 않는다 — 세 폭(375 · 390 · 430).
 *
 * 좁은 칸의 긴 글은 말줄임 대신 줄을 넘긴다는 규칙(Wave 67 · 132 · 133)을 화면마다 재 왔다. 이 스펙은 화면 전수를 한 번에 잰다.
 * - 새 여정: 시작 화면 · 원정 준비 · 기록 탭 11개 · 상점(간단 · 상세 · 판매) · 귀환 브리핑 · 임무 게시판 · 보스 전투 ·
 *   유물 선택 · 전투 결과 카드 · 원정 결산 · 사망 화면.
 * - 후반 상태(나이트 Lv44, 전설 각인 25개 발견): 기록 탭 11개 · 전설 도감 격자 · 이름이 가장 긴 각인의 상세.
 * 처음 재었을 때 잘린 곳은 전설 도감 격자의 이름 둘('신전 도시의 지팡이' · '에테르 거인의 대검', 375 · 390px)뿐이었다.
 * 화면 낭독기 전용 글(`sr-only`)은 의도된 1px라 뺀다. 검사기가 고정 배치 · 말줄임 글을 실제로 잡는지 탐침으로 먼저 확인한다.
 */
const SETTINGS_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';
const ARCHIVE_TABS = ['equipment', 'inventory', 'quest', 'achievements', 'skills', 'map', 'stats', 'codex', 'pass', 'graves', 'system'] as const;
const SIGNATURE_NAMES = Object.keys(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/signatureRegistry.json'), 'utf8')).entries);
const LONGEST_SIGNATURES = [...SIGNATURE_NAMES].sort((a, b) => b.length - a.length).slice(0, 2);

// 자연 플레이 스냅숏 모양의 후반 나이트(원장 §67.2의 기록 탭 픽스처와 같은 모양) — 양손 무기 · 장착 못 하는 무기 · 소모품 · 재료.
const LATE_KNIGHT = {
    name: '용사', job: '나이트', level: 44, loc: '시작의 마을', gold: 858275,
    equip: {
        weapon: { name: '빙원의 장창', type: 'weapon', hands: 2, val: 55, tier: 3, price: 1490, elem: '냉기', jobs: ['전사', '나이트'], desc: '북부 설원의 혹한이 응결된 장창.', desc_stat: 'ATK+55(냉) / 2H', id: 'e2e_clip_spear', baseItemName: '빙원의 장창', enhance: 4 },
        armor: { name: '미스릴 갑옷', type: 'armor', val: 35, tier: 3, price: 1100, jobs: ['전사', '나이트', '드래곤 나이트', '팔라딘'], desc: '가볍고 튼튼한 미스릴 갑옷.', desc_stat: 'DEF+35', id: 'e2e_clip_mithril', baseItemName: '미스릴 갑옷', enhance: 3 },
        offhand: null,
    },
    inv: [
        { name: '세계수의 검', type: 'weapon', val: 192, tier: 5, price: 30500, elem: '자연', jobs: ['전사', '나이트', '팔라딘', '드래곤 나이트'], desc: '세계수 숲의 정수가 깃든 성검. 자연과 빛의 힘이 공명한다.', desc_stat: 'ATK+192(자)', id: 'e2e_clip_worldtree', baseItemName: '세계수의 검' },
        { name: '해독제', type: 'cure', effect: 'poison', price: 50, desc: '중독 상태를 치료', desc_stat: '해독', id: 'e2e_clip_antidote' },
        { name: '상급 체력 물약', type: 'hp', val: 300, price: 150, desc: 'HP 300 회복', desc_stat: 'HP+300', id: 'e2e_clip_potion' },
        { name: '천공 결정', type: 'mat', price: 520, desc: '천공 정원에서 채집한 마력 결정', desc_stat: '재료', id: 'e2e_clip_crystal' },
    ],
    skillLoadout: { selected: 7, cooldowns: {} },
};

/** 보이는 요소 가운데 자기 글이 넘침 숨김 · 말줄임 · 줄 수 제한으로 잘린 것. */
const findClippedText = () => {
    const clipped: string[] = [];
    for (const node of document.body.querySelectorAll('*')) {
        if (!(node instanceof HTMLElement) || node.getClientRects().length === 0 || node.closest('.sr-only')) continue;
        const style = getComputedStyle(node);
        if (style.visibility === 'hidden' || node.getBoundingClientRect().width <= 1) continue;
        const own = [...node.childNodes]
            .filter((child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
            .map((child) => child.textContent!.trim()).join(' ');
        if (!own) continue;
        const hidesX = style.overflowX === 'hidden' || style.textOverflow === 'ellipsis';
        if (hidesX && node.scrollWidth > node.clientWidth + 0.5) clipped.push(`${own.slice(0, 40)} (${node.scrollWidth}/${node.clientWidth}px)`);
        const clampsY = (style.webkitLineClamp && style.webkitLineClamp !== 'none') || style.overflowY === 'hidden';
        if (clampsY && style.whiteSpace !== 'nowrap' && node.scrollHeight > node.clientHeight + 1) clipped.push(`[세로] ${own.slice(0, 40)} (${node.scrollHeight}/${node.clientHeight}px)`);
    }
    return clipped;
};

const expectNoClipping = async (page: Page, screen: string) => {
    expect(await page.evaluate(findClippedText), screen).toEqual([]);
};

const loadLateKnightWithSignatures = async (page: Page) => {
    await page.goto('/?e2e=1&deviceQa=system-settings', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SETTINGS_KEY), { timeout: 20_000 }).toBe(true);
    const fixture = await page.evaluate(({ key, knight, signatures }) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.player = { ...saved.player, ...knight, stats: { ...saved.player.stats, signatureLedger: signatures, lastSeenAt: Date.now() } };
        saved.gameState = 'idle';
        saved.enemy = null;
        saved.currentEvent = null;
        return JSON.stringify(saved);
    }, { key: SETTINGS_KEY, knight: LATE_KNIGHT, signatures: SIGNATURE_NAMES });
    await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot), { key: SETTINGS_KEY, snapshot: fixture });
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.job)).toBe('나이트');
    for (const id of ['return-briefing-close-icon', 'return-briefing-close', 'milestone-story-close']) {
        const close = page.getByTestId(id);
        if (await close.isVisible().catch(() => false)) await close.click();
    }
};

for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`${viewport.width}px: 실제 화면의 글이 말줄임 · 넘침 숨김으로 잘리지 않는다`, async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize(viewport);

        // 판별: 고정 배치 · 말줄임으로 잘린 탐침을 검사기가 잡는다.
        await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('intro-start-button')).toBeVisible({ timeout: 20_000 });
        await page.evaluate(() => {
            const probe = document.createElement('div');
            probe.id = 'clip-probe';
            probe.style.cssText = 'position:fixed;left:0;top:0;width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
            probe.textContent = '아주 긴 탐침 문장이 잘린다';
            document.body.appendChild(probe);
        });
        expect((await page.evaluate(findClippedText)).some((row) => row.startsWith('아주 긴 탐침'))).toBe(true);
        await page.evaluate(() => document.getElementById('clip-probe')?.remove());
        await expectNoClipping(page, '시작 화면');

        await startE2ERun(page, { name: '용사' });
        await expectNoClipping(page, '원정 준비');
        await page.getByTestId('status-character-chip').click();
        for (const tab of ARCHIVE_TABS) {
            await page.getByTestId(`archive-tab-${tab}`).click();
            await expect(page.getByTestId(`archive-tab-${tab}`)).toHaveAttribute('data-active', 'true');
            await expectNoClipping(page, `기록 탭 ${tab}`);
        }
        await page.getByTestId('mobile-console-return-log').click();

        await openTownFacilities(page);
        await page.getByTestId('control-market').click();
        const shop = page.getByTestId('shop-panel');
        await expect(shop).toBeVisible();
        await expectNoClipping(page, '상점');
        await page.getByTestId('shop-equipment-detail-toggle').click();
        await expectNoClipping(page, '상점 상세');
        await shop.getByRole('button', { name: '판매', exact: true }).first().click();
        await expectNoClipping(page, '상점 판매');

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.showReturnBriefingScenario?.());
        await expect(page.getByTestId('return-briefing-card')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '귀환 브리핑');
        await page.getByTestId('return-briefing-close-icon').click();

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedPostFirstStoryScenario?.());
        await page.getByTestId('control-quests').click();
        await expect(page.getByTestId('quest-board-panel')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '임무 게시판');

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(true));
        await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '보스 전투');

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRelicChoice?.());
        await expect(page.getByTestId('relic-choice-panel')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '유물 선택');
        await page.getByTestId('relic-choice-skip').click();

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectPostCombatResult?.());
        await expect(page.getByTestId('post-combat-card')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '전투 결과 카드');

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedExpeditionDebriefScenario?.());
        await expect(page.getByTestId('expedition-debrief-card')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '원정 결산');

        await page.evaluate(() => window.__AETHERIA_TEST_API__?.injectRunSummary?.());
        await expect(page.getByTestId('run-summary-card')).toBeVisible({ timeout: 8_000 });
        await expectNoClipping(page, '사망 화면');

        // 후반 상태 — 긴 장비 이름 · 전설 각인 25개.
        await loadLateKnightWithSignatures(page);
        await page.getByTestId('status-character-chip').click();
        for (const tab of ARCHIVE_TABS) {
            await page.getByTestId(`archive-tab-${tab}`).click();
            await expect(page.getByTestId(`archive-tab-${tab}`)).toHaveAttribute('data-active', 'true');
            await expectNoClipping(page, `후반 기록 탭 ${tab}`);
        }
        await page.getByTestId('archive-tab-codex').click();
        await page.getByTestId('codex-tab-legend').click();
        const collection = page.getByTestId('legendary-codex-collection');
        if (!(await collection.evaluate((element) => (element as HTMLDetailsElement).open))) await collection.locator('summary').click();
        await expect(collection.getByRole('button', { name: LONGEST_SIGNATURES[0], exact: true })).toBeVisible();
        await expectNoClipping(page, '전설 도감 격자');
        for (const name of LONGEST_SIGNATURES) {
            await collection.getByRole('button', { name, exact: true }).click();
            await expect(page.getByTestId('legendary-codex-detail')).toContainText(name);
            await expectNoClipping(page, `전설 도감 상세 ${name}`);
        }
    });
}
