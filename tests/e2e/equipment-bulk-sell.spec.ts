import { devices, expect, test, type Page } from '@playwright/test';
import { openTownFacilities } from './testHelpers';

// 2026-11 재미 분석 G4: 쓰지 않는 장비 한 번에 팔기 — 상점 판매 탭의 띠, 두 번 눌러 확인, 강화 · 경로 안 장비는 남긴다.
const SETTINGS_KEY = 'aetheria.device-qa.system-settings.snapshot.v1';

const LONGSWORD = { name: '롱소드', type: 'weapon', val: 15, tier: 1, price: 150, jobs: ['전사', '모험가', '나이트', '버서커'], desc_stat: 'ATK+15' };
const LEATHER = { name: '가죽 갑옷', type: 'armor', val: 8, tier: 1, price: 120, jobs: ['모험가', '전사', '도적', '어쌔신'], desc_stat: 'DEF+8' };
const DAGGER = { name: '견습생의 단검', type: 'weapon', val: 9, tier: 1, price: 75, jobs: ['도적', '어쌔신'], desc_stat: 'ATK+9' };
const ROBE = { name: '수련복', type: 'armor', val: 5, tier: 1, price: 80, jobs: ['마법사', '모험가', '성직자', '무당'], desc_stat: 'DEF+5' };

const WARRIOR = {
    name: '용사', job: '전사', level: 8, loc: '시작의 마을', gold: 500, challengeModifiers: [],
    equip: {
        weapon: { ...LONGSWORD, id: 'e2e_g4_equipped_sword' },
        armor: { ...LEATHER, id: 'e2e_g4_equipped_armor' },
        offhand: null,
    },
    inv: [
        { ...LEATHER, id: 'e2e_g4_dup_armor' }, // 같은 갑옷 → 판다
        { ...DAGGER, id: 'e2e_g4_dagger' }, // 전사 경로 밖 → 판다
        { ...ROBE, id: 'e2e_g4_robe' }, // 전사 경로 밖 → 판다
        { ...LEATHER, id: 'e2e_g4_enhanced_armor', enhance: 2 }, // 강화 → 남긴다
    ],
};

const loadWarrior = async (page: Page) => {
    await page.goto('/?e2e=1&deviceQa=system-settings', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate((key) => Boolean(localStorage.getItem(key)), SETTINGS_KEY), { timeout: 20_000 }).toBe(true);
    const fixture = await page.evaluate(({ key, warrior }) => {
        const saved = JSON.parse(localStorage.getItem(key)!);
        saved.player = { ...saved.player, ...warrior, stats: { ...saved.player.stats, lastSeenAt: Date.now() } };
        saved.gameState = 'idle';
        saved.enemy = null;
        saved.currentEvent = null;
        return JSON.stringify(saved);
    }, { key: SETTINGS_KEY, warrior: WARRIOR });
    await page.addInitScript(({ key, snapshot }) => localStorage.setItem(key, snapshot), { key: SETTINGS_KEY, snapshot: fixture });
    await page.reload();
    await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.job)).toBe('전사');
    for (const id of ['return-briefing-close', 'milestone-story-close']) {
        const close = page.getByTestId(id);
        if (await close.isVisible().catch(() => false)) await close.click();
    }
};

for (const width of [375, 430]) {
    test(`${width}px 판매 탭의 '모두 판매'는 두 번 눌러 쓰지 않는 장비만 판다`, async ({ browser, baseURL }) => {
        const viewport = { width, height: 844 };
        const context = await browser.newContext({ ...devices['iPhone 12'], baseURL: baseURL || 'http://localhost:4173', viewport, screen: viewport });
        const page = await context.newPage();
        try {
            await loadWarrior(page);
            await openTownFacilities(page);
            await page.getByTestId('control-market').click();
            await page.getByTestId('shop-mode-sell').click();

            const band = page.getByTestId('shop-bulk-sell-equipment');
            await expect(band).toHaveAttribute('data-count', '3');
            // 판매가 합 (120 + 75 + 80) × 0.5 = 137 골드 — 수입 규칙 없음.
            await expect(page.getByTestId('shop-bulk-sell-income')).toHaveText('+137 골드');
            const action = page.getByTestId('shop-bulk-sell-action');
            const bounds = await action.boundingBox();
            expect(bounds!.height).toBeGreaterThanOrEqual(43.5);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

            await action.click();
            await expect(action).toHaveText(/정말 판매/);
            const goldBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.gold);
            await action.click();

            await expect(band).toHaveCount(0);
            await expect.poll(() => page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}').player?.gold)).toBe(goldBefore + 137);
            const names = await page.getByTestId('shop-sell-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-item-name')));
            expect(names).toEqual(['가죽 갑옷']); // 강화한 사본만 남는다
        } finally {
            await context.close();
        }
    });
}
