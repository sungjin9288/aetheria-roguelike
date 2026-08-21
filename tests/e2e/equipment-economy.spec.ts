import { expect, test, type Page } from '@playwright/test';

const DEVICE_QA_SNAPSHOT_KEY = 'aetheria.device-qa.item-investment.snapshot.v1';
const SCREENSHOT_PATH = 'docs/evidence/qa/release-complete-core/screenshots/equipment-economy-390x844.png';

const legacyItem = (item: Record<string, unknown>, id: string) => ({ ...item, id, enhance: 0 });

const legacySnapshot = {
    version: 6,
    savedAt: 0,
    gameState: 'idle',
    enemy: null,
    grave: null,
    currentEvent: null,
    quickSlots: [null, null, null],
    player: {
        name: '경제 검증자',
        job: '모험가',
        gender: 'male',
        level: 60,
        hp: 600,
        maxHp: 600,
        mp: 240,
        maxMp: 240,
        atk: 140,
        def: 110,
        exp: 0,
        nextExp: 9_999,
        gold: 100_000,
        loc: '황금 왕국',
        maxInv: 40,
        inv: [
            legacyItem({
                name: '에테르 검', type: 'weapon', val: 85, tier: 4, price: 1200, elem: '에테르',
                jobs: ['전사', '나이트', '모험가'], desc: '에테르 에너지가 응축된 검.', desc_stat: 'ATK+85(에)',
                legacyExtension: { source: 'device-qa' },
            }, 'legacy-t4-weapon'),
            legacyItem({
                name: '차원절단자', type: 'weapon', val: 120, tier: 5, price: 2500, elem: '에테르',
                jobs: ['도적', '어쌔신', '모험가'], desc: '차원을 절단하는 검.', desc_stat: 'ATK+120(에)',
                legacyExtension: { source: 'device-qa' },
            }, 'legacy-t5-weapon'),
        ],
        equip: {
            weapon: legacyItem({
                name: '에테르 검', type: 'weapon', val: 85, tier: 4, price: 1200, elem: '에테르',
                jobs: ['전사', '나이트', '모험가'], desc: '에테르 에너지가 응축된 검.', desc_stat: 'ATK+85(에)',
            }, 'legacy-equipped-weapon'),
            armor: legacyItem({
                name: '에테르 갑옷', type: 'armor', val: 55, tier: 4, price: 1200,
                jobs: ['전사', '나이트', '모험가'], desc: '에테르 에너지로 강화된 갑옷.', desc_stat: 'DEF+55',
            }, 'legacy-equipped-armor'),
            offhand: legacyItem({
                name: '목재 방패', type: 'shield', val: 7, tier: 1, price: 90,
                jobs: ['전사', '나이트', '모험가'], desc: '간단한 나무 방패.', desc_stat: 'DEF+7',
            }, 'legacy-equipped-offhand'),
        },
        quests: [],
        achievements: [],
        expeditionFocusQuestIds: [],
        stats: {
            kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0,
            bountyDate: null, bountyIssued: false, bountiesCompleted: 0, relicCount: 0,
            crafts: 0, syntheses: 0, maxKillStreak: 0, abyssFloor: 0, abyssRecord: 0,
            demonKingSlain: 0, dailyProtocol: null, claimedAchievements: [], claimedQuestIds: [],
            explores: 0, exploresByLocation: {}, escapes: 0, buildWins: {}, discoveryChains: [],
            visitedMaps: ['황금 왕국'], currentRun: null, exploreState: {},
            codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} },
            codexClaimed: [], lastSeenAt: null, abyssDailyDive: null,
        },
        premiumCurrency: 0,
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
        weeklyProtocol: { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] },
        skillChoices: {},
        challengeModifiers: [],
        tempBuff: { atk: 0, def: 0, turn: 0, name: null },
        status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        settings: { readabilityMode: 'standard', equipmentDetailMode: 'summary' },
        meta: {
            essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 0,
            mirror: {}, storyMilestones: { seen: [], pending: [] },
            endgame: {
                version: 1, primalShards: 0, legacyInventoryMigrated: true,
                lastEndgameReceiptKey: null, trueEndingSeen: false,
            },
        },
        relics: [], titles: [], activeTitle: null,
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        killStreak: 0,
        history: [],
        eventChainProgress: {},
        activeExpedition: null,
        lastExpeditionSummary: null,
        expeditionSequence: 0,
        returnSupplyRewards: { version: 1, receipts: {} },
    },
};

const readDeviceQaSnapshot = (page: Page) => (
    page.evaluate((key: string) => JSON.parse(localStorage.getItem(key) || '{}'), DEVICE_QA_SNAPSHOT_KEY)
);

test.describe('Equipment economy at 390x844', () => {
    test('migrates the device-QA legacy snapshot and purchases the corrected T4 stock offer once', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(({ key, snapshot }) => {
            localStorage.setItem(key, JSON.stringify(snapshot));
        }, { key: DEVICE_QA_SNAPSHOT_KEY, snapshot: legacySnapshot });

        // The device-QA scenario is intentionally selected before boot.  This never
        // touches the production save key and exercises the production boot reducer.
        await page.goto('/?deviceQa=item-investment', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('persistent-status-bar')).toBeVisible({ timeout: 20_000 });

        await expect.poll(async () => readDeviceQaSnapshot(page)).toMatchObject({
            player: {
                inv: expect.arrayContaining([
                    expect.objectContaining({ id: 'legacy-t4-weapon', name: '에테르 검', price: 5500, baseItemName: '에테르 검' }),
                    expect.objectContaining({ id: 'legacy-t5-weapon', name: '차원절단자', price: 22000, baseItemName: '차원절단자' }),
                ]),
                equip: {
                    weapon: expect.objectContaining({ id: 'legacy-equipped-weapon', price: 5500, baseItemName: '에테르 검' }),
                    armor: expect.objectContaining({ id: 'legacy-equipped-armor', price: 4900, baseItemName: '에테르 갑옷' }),
                    offhand: expect.objectContaining({ id: 'legacy-equipped-offhand', price: 90, baseItemName: '목재 방패' }),
                },
            },
        });

        const facilities = page.getByTestId('control-town-facilities');
        await expect(facilities).toBeVisible();
        if (await facilities.getAttribute('open') === null) await facilities.locator('summary').click();
        await page.getByTestId('control-market').click();
        await expect(page.getByTestId('shop-panel')).toBeVisible();
        await page.getByRole('button', { name: /더 보기/ }).click();

        const t4Row = page.getByTestId('shop-buy-item').filter({ hasText: '에테르 검' });
        const t5Row = page.getByTestId('shop-buy-item').filter({ hasText: '차원절단자' });
        await expect(t4Row).toContainText('5,500 골드');
        await expect(t5Row).toContainText('22,000 골드');

        const geometry = await page.evaluate(() => {
            const panel = document.querySelector<HTMLElement>('[data-testid="shop-panel"]');
            if (!panel) return null;
            const button = panel.querySelector<HTMLElement>('[data-testid="shop-buy-inline"]');
            if (!button) return null;
            const panelRect = panel.getBoundingClientRect();
            const targetRect = button.getBoundingClientRect();
            return {
                documentOverflowX: document.documentElement.scrollWidth - window.innerWidth,
                panelOverflowX: panel.scrollWidth - panel.clientWidth,
                panelVisible: panelRect.left >= 0 && panelRect.right <= window.innerWidth,
                actionWidth: targetRect.width,
                actionHeight: targetRect.height,
            };
        });
        expect(geometry).not.toBeNull();
        expect(geometry).toMatchObject({ documentOverflowX: 0, panelOverflowX: 0, panelVisible: true });
        expect(geometry?.actionWidth).toBeGreaterThanOrEqual(44);
        expect(geometry?.actionHeight).toBeGreaterThanOrEqual(44);

        const before = await readDeviceQaSnapshot(page);
        const buyButton = t4Row.getByTestId('shop-buy-inline');
        await buyButton.evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
        });
        await expect(page.getByText('구매 완료 · 에테르 검')).toHaveCount(1);

        await expect.poll(async () => readDeviceQaSnapshot(page)).toMatchObject({
            player: {
                gold: before.player.gold - 5500,
                inv: expect.arrayContaining([
                    expect.objectContaining({ name: '에테르 검', price: 5500, baseItemName: '에테르 검' }),
                ]),
            },
        });
        const after = await readDeviceQaSnapshot(page);
        expect(after.player.inv).toHaveLength(before.player.inv.length + 1);
        expect(after.player.inv.filter((item: { name: string }) => item.name === '에테르 검')).toHaveLength(2);

        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
    });
});
