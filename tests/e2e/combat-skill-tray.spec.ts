import { test, expect, type Page } from '@playwright/test';
import { startE2ERun, waitForModeTransition } from './testHelpers';

/**
 * 2026-10 감사 CL-03 · CL-06 · VD-02 · GF-05 — 전투 화면을 실제 폭에서 잰다.
 *
 * 팔라딘(기술 8개 이상)으로 보스와 싸우는 화면: 기술 칸은 모두 44px 이상으로 한 줄에 늘어서고 넘치면 그 줄만 가로로 민다
 * (화면은 가로로 넘치지 않는다). 칸을 누르면 그 기술을 고르고 곧바로 쓴다. 보스 위협 칩 · 내 생명 · 기력 막대가 보이고,
 * 보스 초상은 일반 적과 다른 테두리다. 주 행동 네 개는 375 × 667 보스전에서도 첫 화면 안이다 — 칸을 줄 넘겨 쌓던 첫 구현은
 * 기술 칸이 247px라 '도주'와 기술 칸 전체가 첫 화면 밖이었다.
 */

const VIEWPORTS = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
];

const seedPaladinCombat = async (page: Page, boss: boolean) => {
    const avatar = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedAvatarScenario?.('paladin-plate'));
    expect(avatar).toBe(true);
    const seeded = await page.evaluate((isBoss) => window.__AETHERIA_TEST_API__?.seedCombatFocusScenario?.(isBoss), boss);
    expect(seeded).toBe(true);
    await expect(page.getByTestId('combat-focus-panel')).toBeVisible({ timeout: 8_000 });
};

const readPlayerMp = (page: Page) => page.evaluate(() => {
    const rendered = JSON.parse(window.render_game_to_text?.() || '{}');
    return Number(rendered.player?.mp);
});

for (const viewport of VIEWPORTS) {
    test.describe(`Combat skill tray ${viewport.width}x${viewport.height}`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize(viewport);
            await startE2ERun(page);
        });

        test('보스전: 기술 칸 전부 44px · 한 줄 가로 밀기 · 화면 넘침 없음 · 위협 칩 · 내 생명 막대', async ({ page }) => {
            await seedPaladinCombat(page, true);
            const chips = page.getByTestId('combat-skill-chip');
            await expect(chips.first()).toBeVisible();
            const count = await chips.count();
            expect(count).toBeGreaterThanOrEqual(8);

            const layout = await page.getByTestId('combat-focus-panel').evaluate((panel) => {
                const rail = panel.querySelector('[data-testid="combat-skill-rail"]') as HTMLElement;
                const chipNodes = [...panel.querySelectorAll('[data-testid="combat-skill-chip"]')] as HTMLElement[];
                const panelBox = panel.getBoundingClientRect();
                const railBox = rail.getBoundingClientRect();
                const fontSizes = chipNodes.flatMap((chip) => [...chip.querySelectorAll('span')]
                    .filter((span) => (span.textContent || '').trim())
                    .map((span) => Number.parseFloat(getComputedStyle(span).fontSize)));
                return {
                    panelOverflow: panel.scrollWidth - panel.clientWidth,
                    docOverflow: document.documentElement.scrollWidth - window.innerWidth,
                    railLeft: railBox.left,
                    railRight: railBox.right,
                    railScrolls: rail.scrollWidth > rail.clientWidth,
                    chips: chipNodes.map((chip) => {
                        const box = chip.getBoundingClientRect();
                        const name = chip.querySelector('span') as HTMLElement;
                        return {
                            w: box.width,
                            h: box.height,
                            top: box.top,
                            nameShown: (chip.textContent || '').includes(chip.dataset.skillName || '\u0000'),
                            nameClipped: name.scrollWidth > name.clientWidth + 0.5,
                        };
                    }),
                    panelLeft: panelBox.left,
                    panelRight: panelBox.right,
                    minFont: Math.min(...fontSizes),
                };
            });
            expect(layout.panelOverflow).toBeLessThanOrEqual(1);
            expect(layout.docOverflow).toBeLessThanOrEqual(1);
            expect(layout.railLeft).toBeGreaterThanOrEqual(layout.panelLeft - 1);
            expect(layout.railRight).toBeLessThanOrEqual(layout.panelRight + 1);
            expect(layout.railScrolls, '기술 10개는 이 폭에서 한 줄을 넘친다 — 그 줄만 민다').toBe(true);
            expect(layout.minFont).toBeGreaterThanOrEqual(11);
            for (const chip of layout.chips) {
                expect(chip.h).toBeGreaterThanOrEqual(44);
                expect(chip.w).toBeGreaterThanOrEqual(44);
                expect(Math.abs(chip.top - layout.chips[0].top), '칸은 한 줄이다').toBeLessThanOrEqual(1);
                expect(chip.nameShown).toBe(true);
                expect(chip.nameClipped, '칸 이름은 잘리지 않는다').toBe(false);
            }

            // 마지막 칸까지 그 줄을 밀어 닿는다 — 화면(앱 셸)은 가로로 움직이지 않는다.
            const rail = page.getByTestId('combat-skill-rail');
            await rail.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
            await expect.poll(() => rail.evaluate((node) => {
                const railBox = node.getBoundingClientRect();
                const last = (node.querySelector('[data-testid="combat-skill-chip"]:last-child') as HTMLElement).getBoundingClientRect();
                return last.left >= railBox.left - 1 && last.right <= railBox.right + 1;
            })).toBe(true);
            const after = await page.evaluate(() => ({
                shellScrollLeft: (document.querySelector('[data-app-shell]') as HTMLElement).scrollLeft,
                docOverflow: document.documentElement.scrollWidth - window.innerWidth,
            }));
            expect(after.shellScrollLeft).toBe(0);
            expect(after.docOverflow).toBeLessThanOrEqual(1);
            await expect(chips.last()).toBeVisible();

            // CL-06: 보스와 싸우는 동안 위협 칩 — 추천 문구 없음.
            const bossChip = page.getByTestId('combat-signal-boss-threat');
            await expect(bossChip).toBeVisible();
            await expect(bossChip).toContainText('보스 · 한 방 최대 생명의');
            await expect(bossChip).not.toContainText('권장');
            // CL-09: 보스 카드는 '공략 요령', '권장 대응'은 판단 요약 칸 하나.
            await expect(page.getByTestId('combat-boss-counter')).toContainText('공략 요령');
            await expect(page.getByText('권장 대응', { exact: true })).toHaveCount(1);

            // VD-02: 내 생명 · 기력 막대.
            await expect(page.getByTestId('combat-player-vitals')).toBeVisible();
            await expect(page.getByTestId('combat-player-hp-value')).toHaveText(/^\d+\/\d+$/);

            // VD-02: 보스 초상은 일반 적과 다른 테두리(금빛 2px) · 80px 그림.
            const portrait = await page.getByTestId('enemy-portrait').evaluate((node) => {
                const art = node.querySelector('[data-monster-art]') as HTMLElement | null;
                const img = node.querySelector('img');
                return {
                    rank: (node as HTMLElement).dataset.enemyRank,
                    borderWidth: getComputedStyle(node).borderTopWidth,
                    artWidth: art?.getBoundingClientRect().width ?? 0,
                    rendering: img ? getComputedStyle(img).imageRendering : 'none',
                };
            });
            expect(portrait.rank).toBe('boss');
            expect(portrait.borderWidth).toBe('2px');
            expect(portrait.artWidth).toBe(80);
            expect(portrait.rendering).toBe('pixelated');

            // 주 행동 네 개는 맨 위로 올렸을 때 첫 화면 안이고 기술 칸은 그 바로 아래에서 시작한다. 보스 카드는 처음 한 번
            //   읽는 것이라 그 아래다(375 × 667에서는 첫 화면 밖 — 보스 위협 칩은 위의 신호 줄에 있다).
            await page.locator('[data-app-shell]').evaluate((shell) => { shell.scrollTop = 0; });
            const escape = await page.getByTestId('combat-action-escape').boundingBox();
            const railBox = await page.getByTestId('combat-skill-rail').boundingBox();
            const bossCard = await page.getByTestId('combat-boss-signature').boundingBox();
            expect(escape).not.toBeNull();
            expect(railBox).not.toBeNull();
            expect(bossCard).not.toBeNull();
            expect(escape!.y + escape!.height).toBeLessThanOrEqual(viewport.height + 1);
            // 소유자 결정 D16(2026-10-26): 375 × 667 보스전에서도 기술 칸 전체가 첫 화면 안이다(전에는 약 9px 밀렸다).
            expect(railBox!.y + railBox!.height).toBeLessThanOrEqual(viewport.height + 1);
            expect(bossCard!.y).toBeGreaterThanOrEqual(railBox!.y + railBox!.height);
            await page.screenshot({ path: `playtest-artifacts/mobile-combat-focus/skill-tray-boss-${viewport.width}.png` });
            await page.getByTestId('combat-focus-panel').screenshot({ path: `playtest-artifacts/mobile-combat-focus/skill-tray-boss-panel-${viewport.width}.png` });
        });

        test('칸을 누르면 그 기술을 고르고 곧바로 쓴다 — 기력 부족 칸은 누를 수 없다', async ({ page }) => {
            await seedPaladinCombat(page, false);
            const ready = await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedCombatSkillReadinessScenario?.(60));
            expect(ready).toBe(true);

            // 일반 전투에서는 기술 칸까지 첫 화면 안이다.
            await page.locator('[data-app-shell]').evaluate((shell) => { shell.scrollTop = 0; });
            const railBox = await page.getByTestId('combat-skill-rail').boundingBox();
            expect(railBox).not.toBeNull();
            expect(railBox!.y + railBox!.height).toBeLessThanOrEqual(viewport.height + 1);

            const energyChip = page.locator('[data-testid="combat-skill-chip"][data-skill-state="energy"]').first();
            await expect(energyChip).toBeDisabled();

            const target = page.locator('[data-testid="combat-skill-chip"][data-skill-state="ready"]:not([aria-current])').first();
            await expect(target).toBeEnabled();
            const name = await target.getAttribute('data-skill-name');
            expect(name).toBeTruthy();
            const mpBefore = await readPlayerMp(page);

            await target.click();
            const chosen = page.locator(`[data-testid="combat-skill-chip"][data-skill-name="${name}"]`);
            await expect(chosen).toHaveAttribute('aria-current', 'true');
            await expect(page.locator('[data-testid="combat-skill-chip"][aria-current="true"]')).toHaveCount(1);
            await expect(page.getByTestId('combat-skill-readiness')).toContainText(name!);
            await expect.poll(() => readPlayerMp(page)).toBeLessThan(mpBefore);
        });

        test('고른 기술이 줄 밖이면 칸 줄이 그 칸까지 가로로 옮긴다 — 화면은 세로로 움직이지 않는다', async ({ page }) => {
            await seedPaladinCombat(page, false);
            const chips = page.getByTestId('combat-skill-chip');
            const count = await chips.count();
            expect(count).toBeGreaterThanOrEqual(8);
            const rail = page.getByTestId('combat-skill-rail');
            await expect.poll(() => rail.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
            const shellTop = await page.locator('[data-app-shell]').evaluate((shell) => shell.scrollTop);

            // 명령 처리기(QA)의 다음 기술로 마지막 기술까지 고른다 — 칸을 누르지 않고 고른 기술만 바뀐다.
            const currentIndex = await chips.evaluateAll((nodes) => nodes.findIndex((node) => node.getAttribute('aria-current') === 'true'));
            for (let step = currentIndex; step < count - 1; step += 1) {
                await page.evaluate(() => window.__AETHERIA_TEST_API__?.sendCommand?.('nextskill'));
            }
            await expect(chips.last()).toHaveAttribute('aria-current', 'true');
            await expect.poll(() => rail.evaluate((node) => {
                const railBox = node.getBoundingClientRect();
                const last = (node.querySelector('[data-testid="combat-skill-chip"]:last-child') as HTMLElement).getBoundingClientRect();
                return last.left >= railBox.left - 1 && last.right <= railBox.right + 1;
            })).toBe(true);
            expect(await page.locator('[data-app-shell]').evaluate((shell) => shell.scrollTop)).toBe(shellTop);
        });

        test('적의 반격에 맞으면 내 생명 막대가 번쩍인다', async ({ page }) => {
            await seedPaladinCombat(page, true);
            // 시드가 생명을 바꾼 번쩍임(0.5초)이 끝난 뒤부터 센다.
            await expect(page.getByTestId('combat-player-vitals')).not.toHaveAttribute('data-vitals-flash', /.+/);
            await page.getByTestId('combat-player-vitals').evaluate((node) => {
                const seen: string[] = [];
                (window as unknown as { __vitalsFlashSeen: string[] }).__vitalsFlashSeen = seen;
                new MutationObserver(() => {
                    const value = node.getAttribute('data-vitals-flash');
                    if (value) seen.push(value);
                }).observe(node, { attributes: true, attributeFilter: ['data-vitals-flash'] });
            });
            const hpOf = () => page.evaluate(() => Number(JSON.parse(window.render_game_to_text?.() || '{}').player?.hp));
            const start = await hpOf();
            let hit = false;
            for (let turn = 0; turn < 6 && !hit; turn += 1) {
                const before = await hpOf();
                await page.getByTestId('combat-action-attack').click();
                // 적의 반격은 같은 리듀서 전이에서 해석된다 — 다음 턴 입력이 열릴 때까지만 기다린다.
                await page.waitForTimeout(450);
                hit = (await hpOf()) < before;
            }
            expect(hit, `6턴 안에 한 번은 맞는다 (시작 생명 ${start})`).toBe(true);
            await expect.poll(() => page.evaluate(() => (window as unknown as { __vitalsFlashSeen: string[] }).__vitalsFlashSeen.includes('damage'))).toBe(true);
        });
    });
}

/**
 * 소유자 결정 D16(2026-10-26): 기술 칸(제목 + 칸 줄)은 맨 위에서 스크롤 없이 첫 화면 안이다 — 보스전 · 일반 전투, 네 크기.
 * 375 × 667 보스전은 판단 요약의 긴 값이 같은 폭 세 칸에서 두 줄이 되어 기술 칸이 7 ~ 15px 아래로 밀렸다(높이 700px 이하에서
 * 덱을 조여 고쳤다 — index.css `w3:combat`). 높이가 넉넉한 크기는 그 규칙 밖이라 배치가 그대로다.
 */
const TRAY_VIEWPORTS = [
    { width: 375, height: 667 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
];

for (const viewport of TRAY_VIEWPORTS) {
    for (const boss of [true, false]) {
        test(`D16 기술 칸은 첫 화면 안 ${viewport.width}x${viewport.height} ${boss ? '보스전' : '일반 전투'}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await startE2ERun(page);
            await seedPaladinCombat(page, boss);
            await waitForModeTransition(page);
            await page.locator('[data-app-shell]').evaluate((shell) => { shell.scrollTop = 0; });
            const layout = await page.evaluate(() => {
                const bottom = (testId: string) => document.querySelector(`[data-testid="${testId}"]`)?.getBoundingClientRect().bottom ?? Number.NaN;
                const shell = document.querySelector('[data-app-shell]') as HTMLElement;
                return {
                    tray: bottom('combat-skill-tray'),
                    rail: bottom('combat-skill-rail'),
                    escape: bottom('combat-action-escape'),
                    shellScrollTop: shell.scrollTop,
                    docOverflow: document.documentElement.scrollWidth - window.innerWidth,
                    bossCard: Boolean(document.querySelector('[data-testid="combat-boss-signature"]')),
                };
            });
            expect(layout.bossCard, '보스전이면 보스 카드가 있다').toBe(boss);
            expect(layout.shellScrollTop).toBe(0);
            expect(layout.escape).toBeLessThanOrEqual(viewport.height + 1);
            expect(layout.rail, '기술 칸 줄은 첫 화면 안').toBeLessThanOrEqual(viewport.height + 1);
            expect(layout.tray, '기술 칸(제목 포함)은 첫 화면 안').toBeLessThanOrEqual(viewport.height + 1);
            expect(layout.docOverflow).toBeLessThanOrEqual(1);
        });
    }
}
