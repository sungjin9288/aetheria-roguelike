import { expect, test, type Page } from '@playwright/test';
import { releaseEvidenceScreenshot } from './releaseEvidenceScreenshot';
import { startE2ERun } from './testHelpers';

const viewports = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const getBoundedEncounterReceiptKeys = (page: Page) => page.evaluate(() => (
    window.__AETHERIA_TEST_API__?.getBoundedEncounterReceiptKeys?.() || []
));

for (const viewport of viewports) {
    test(`bounded encounter remains readable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        test.setTimeout(60_000);
        await page.setViewportSize(viewport);
        await startE2ERun(page);

        const seeded = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-old-pillars')
        ));
        expect(seeded).toBe(true);

        const panel = page.getByTestId('event-panel');
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(panel).toContainText('돌기둥의 속삭임');
        await expect(panel).toContainText('기력 10을 들여 다음 전투의 방어를 단단히 합니다.');
        await expect(panel).toContainText('생명 8을 감수하고 골드 60을 바로 챙깁니다.');

        const choices = page.getByTestId('event-choice-list').getByRole('button');
        await expect(choices).toHaveCount(2);
        const geometry = await panel.evaluate((element) => ({
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        for (let index = 0; index < 2; index += 1) {
            await choices.nth(index).scrollIntoViewIfNeeded();
            await expect(choices.nth(index)).toHaveCSS('min-height', '72px');
            const bounds = await choices.nth(index).boundingBox();
            expect(bounds?.height).toBeGreaterThanOrEqual(44);
            expect(bounds?.x).toBeGreaterThanOrEqual(0);
            expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(viewport.width);
        }
        const before = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        await choices.nth(1).click();
        await expect(panel).toBeHidden({ timeout: 8_000 });
        const settled = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(settled.gameState).toBe('idle');
        expect(settled.player.hp).toBe(before.player.hp - 8);
        expect(settled.player.gold).toBe(before.player.gold + 60);
        const settledReceiptKeys = await getBoundedEncounterReceiptKeys(page);
        expect(settledReceiptKeys).toEqual([
            `${before.player.activeExpeditionId}:forest-old-pillars:1`,
        ]);
        expect(settled.logTail.filter((entry: { text: string }) => (
            entry.text === '돌 아래 숨겨진 골드 60을 찾아냈습니다.'
        ))).toHaveLength(1);

        await page.evaluate(({ expeditionId }) => {
            window.__AETHERIA_TEST_API__?.resolveBoundedEncounterChoice?.(
                'forest-old-pillars',
                'lift-stone',
                expeditionId,
                1,
            );
        }, { expeditionId: before.player.activeExpeditionId });
        const replayed = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
        expect(replayed.player.hp).toBe(settled.player.hp);
        expect(replayed.player.gold).toBe(settled.player.gold);
        expect(await getBoundedEncounterReceiptKeys(page)).toEqual(settledReceiptKeys);
        expect(replayed.logTail).toEqual(settled.logTail);

        await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-old-pillars')
        ));
        await expect(panel).toBeVisible({ timeout: 8_000 });
        const backHandled = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.triggerPlatformBack?.()
        ));
        expect(backHandled).toBe(true);
        await expect(panel).toBeHidden({ timeout: 8_000 });

        await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-old-pillars')
        ));
        await expect(panel).toBeVisible({ timeout: 8_000 });
        await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
        await releaseEvidenceScreenshot(page, testInfo, `content-pacing-${viewport.width}x${viewport.height}.png`, {
            fullPage: false,
        });
    });
}

test('signature-gated bounded encounter remains readable at 390x844', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const seeded = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-engraved-echo')
    ));
    expect(seeded).toBe(true);

    const panel = page.getByTestId('event-panel');
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await expect(panel).toContainText('각인의 메아리');
    await expect(panel).toContainText('한 번 발견한 고유 장비의 각인이 고요한 숲의 오래된 문양에 반응합니다.');
    await expect(panel).toContainText('기력 10을 들여 다음 전투의 공격과 방어를 함께 다듬습니다.');
    await expect(panel).toContainText('생명 8을 감수하고 강화 재료 1개를 확보합니다.');
    const choices = page.getByTestId('event-choice-list').getByRole('button');
    await expect(choices).toHaveCount(2);
    const geometry = await panel.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    for (let index = 0; index < 2; index += 1) {
        await choices.nth(index).scrollIntoViewIfNeeded();
        await expect(choices.nth(index)).toHaveCSS('min-height', '72px');
        expect((await choices.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    const before = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await panel.evaluate((element) => { element.scrollTop = 0; });
    await releaseEvidenceScreenshot(page, testInfo, 'content-depth-signature-390x844.png', { fullPage: false });

    await choices.nth(0).click();
    await expect(panel).toBeHidden({ timeout: 8_000 });
    const settled = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    expect(settled.player.mp).toBe(before.player.mp - 10);
    expect(await getBoundedEncounterReceiptKeys(page)).toEqual([
        `${before.player.activeExpeditionId}:forest-engraved-echo:1`,
    ]);
    expect(settled.logTail.filter((entry: { text: string }) => (
        entry.text === '각인의 공명이 이어져 다음 전투의 공격과 방어가 함께 강해집니다.'
    ))).toHaveLength(1);

    await page.evaluate(({ expeditionId }) => {
        window.__AETHERIA_TEST_API__?.resolveBoundedEncounterChoice?.(
            'forest-engraved-echo',
            'align-engraving',
            expeditionId,
            1,
        );
    }, { expeditionId: before.player.activeExpeditionId });
    expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'))).toEqual(settled);
});

test('previous-boss bounded encounter remains readable at 390x844', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const seeded = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('서쪽 평원', 'plain-guardian-waterway')
    ));
    expect(seeded).toBe(true);

    const panel = page.getByTestId('event-panel');
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await expect(panel).toContainText('메마른 수로의 잔향');
    await expect(panel).toContainText('고대 호수의 수호신을 넘어선 기억에 메마른 평원의 수로가 잠시 물빛으로 흔들립니다.');
    await expect(panel).toContainText('기력 10을 들여 생명 18을 회복합니다.');
    await expect(panel).toContainText('생명 8을 감수하고 골드 70을 찾아냅니다.');
    const choices = page.getByTestId('event-choice-list').getByRole('button');
    await expect(choices).toHaveCount(2);
    const geometry = await panel.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    for (let index = 0; index < 2; index += 1) {
        await choices.nth(index).scrollIntoViewIfNeeded();
        await expect(choices.nth(index)).toHaveCSS('min-height', '72px');
        expect((await choices.nth(index).boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    const before = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    await expect(page.getByTestId('damage-number')).toBeHidden({ timeout: 4_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await panel.evaluate((element) => { element.scrollTop = 0; });
    await releaseEvidenceScreenshot(page, testInfo, 'content-depth-boss-history-390x844.png', { fullPage: false });

    await choices.nth(1).click();
    await expect(panel).toBeHidden({ timeout: 8_000 });
    const settled = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    expect(settled.player.hp).toBe(before.player.hp - 8);
    expect(settled.player.gold).toBe(before.player.gold + 70);
    expect(await getBoundedEncounterReceiptKeys(page)).toEqual([
        `${before.player.activeExpeditionId}:plain-guardian-waterway:1`,
    ]);
    expect(settled.logTail.filter((entry: { text: string }) => (
        entry.text === '메마른 수로 아래에서 골드 70을 찾아냈습니다.'
    ))).toHaveLength(1);

    await page.evaluate(({ expeditionId }) => {
        window.__AETHERIA_TEST_API__?.resolveBoundedEncounterChoice?.(
            'plain-guardian-waterway',
            'clear-channel-silt',
            expeditionId,
            1,
        );
    }, { expeditionId: before.player.activeExpeditionId });
    expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'))).toEqual(settled);
});

test('canonical equipment builds unlock their regional encounter without persisting build tags', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const panel = page.getByTestId('event-panel');
    const forestSeeded = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('고요한 숲', 'forest-root-resonance')
    ));
    expect(forestSeeded).toBe(true);
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await expect(panel).toContainText('뿌리 아래 공명 결계');
    await expect(panel).toContainText('현재 갖춘 장비와 유물의 공명이 고요한 숲의 굵은 뿌리 아래 잠든 결계를 깨웁니다.');
    await expect(panel).toContainText('기력 10을 들여 다음 전투의 방어를 단단히 합니다.');
    await expect(panel).toContainText('생명 8을 감수하고 강화 재료 1개를 확보합니다.');
    await releaseEvidenceScreenshot(page, testInfo, 'content-depth-build-forest-390x844.png', { fullPage: false });

    const forestBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    expect(JSON.stringify(forestBefore)).not.toContain('buildTags');
    await page.getByTestId('event-choice-list').getByRole('button').nth(0).click();
    await expect(panel).toBeHidden({ timeout: 8_000 });
    const forestSettled = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    expect(forestSettled.player.mp).toBe(forestBefore.player.mp - 10);
    expect(await getBoundedEncounterReceiptKeys(page)).toEqual([
        `${forestBefore.player.activeExpeditionId}:forest-root-resonance:1`,
    ]);

    const plainSeeded = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.('서쪽 평원', 'plain-windpath-stance')
    ));
    expect(plainSeeded).toBe(true);
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await expect(panel).toContainText('바람길의 전투 흔적');
    await expect(panel).toContainText('지금 다듬은 전투 방식이 서쪽 평원을 가로지르는 끊긴 바람길과 맞물립니다.');
    await expect(panel).toContainText('기력 8을 들여 다음 전투의 공격을 끌어올립니다.');
    await expect(panel).toContainText('생명 8을 감수하고 골드 70을 찾아냅니다.');

    const plainBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    await page.getByTestId('event-choice-list').getByRole('button').nth(1).click();
    await expect(panel).toBeHidden({ timeout: 8_000 });
    const plainSettled = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    expect(plainSettled.player.hp).toBe(plainBefore.player.hp - 8);
    expect(plainSettled.player.gold).toBe(plainBefore.player.gold + 70);
    expect(await getBoundedEncounterReceiptKeys(page)).toEqual([
        `${plainBefore.player.activeExpeditionId}:plain-windpath-stance:1`,
    ]);
    expect(JSON.stringify(plainSettled)).not.toContain('buildTags');
});
