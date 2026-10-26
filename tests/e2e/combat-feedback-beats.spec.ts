import { expect, test, type Page } from '@playwright/test';
import { startE2ERun } from './testHelpers';

/**
 * 게임 필 감사 GF-02 · 11 — 실제 앱(GameRoot · App 배선)에서 처치 순간을 본다.
 *
 * 마지막 일격은 같은 디스패치 안에서 적을 지우고 결과 카드를 세운다(§8-1). 화면은 그 사이에 쓰러진 적 · 마지막 일격
 * 숫자 · 처치 도장을 먼저 그리고, 결과 카드는 그 박자가 끝난 뒤에 연다. 화면 읽기 프로그램에는 같은 차례를
 * 한 줄로 알린다(`combat-announcer`). 시간 박자 자체(지연 · 길이 · 모션 감소의 정지 표시)는
 * tests/combat-feedback-presentation.test.js가 가짜 시계로 잰다 — 여기서는 앱이 그 훅을 실제로 배선했는지를 본다.
 */

const ENEMY_NAME = '골드 정책 허수아비';

const killInjectedEnemy = async (page: Page) => {
    expect(await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.injectGoldMultiplierCombat?.('gold-magnet-first')
    ))).toBe(true);
    const attack = page.getByTestId('combat-action-attack');
    await expect(attack).toBeVisible();
    expect(await page.evaluate(() => window.__AETHERIA_TEST_API__?.armNextCombatSeed?.(20260813))).toBe(true);
    // 도장 · 카드의 순서를 같은 프레임에서 읽는다 — 클릭과 첫 관찰 사이의 왕복을 없앤다.
    return attack.evaluate((button: HTMLButtonElement) => new Promise<{
        stamp: string | null;
        defeated: string | null;
        enemyNumber: string | null;
        cardDuringBeat: boolean;
        underFinger: string | null;
    }>((resolve) => {
        const rect = button.getBoundingClientRect();
        const finger = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        button.click();
        requestAnimationFrame(() => requestAnimationFrame(() => {
            const status = document.querySelector('[data-testid="enemy-status"]');
            // 공격 단추를 누른 손가락 자리 — 그 아래에는 이미 대기 화면 단추가 그려져 있다.
            const under = document.elementFromPoint(finger.x, finger.y);
            resolve({
                stamp: document.querySelector('[data-testid="enemy-defeated-stamp"]')?.textContent ?? null,
                defeated: status?.getAttribute('data-defeated') ?? null,
                enemyNumber: document.querySelector('[data-testid="enemy-damage-number"]')?.textContent ?? null,
                cardDuringBeat: Boolean(document.querySelector('[data-testid="post-combat-card"]')),
                underFinger: under?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
            });
        }));
    }));
};

test('처치 순간: 쓰러진 적 · 마지막 일격 숫자 · 처치 도장 뒤에 결과 카드가 열리고, 차례를 한 줄로 알린다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const beat = await killInjectedEnemy(page);
    expect(beat.stamp).toBe('처치');
    expect(beat.defeated).toBe('true');
    expect(beat.enemyNumber).toMatch(/-\d+$/);
    expect(beat.cardDuringBeat).toBe(false);
    // 연타한 손가락이 처치 순간 아래 그려진 대기 화면 단추(휴식 · 출발)를 누르지 않는다.
    expect(beat.underFinger).toBe('kill-beat-input-guard');

    await expect(page.getByTestId('combat-announcer')).toContainText(`${ENEMY_NAME} 처치`);
    await expect(page.getByTestId('combat-announcer')).toHaveAttribute('aria-live', 'polite');

    const card = page.getByTestId('post-combat-card');
    await expect(card).toBeVisible({ timeout: 8_000 });
    await expect(page.getByTestId('enemy-defeated-stamp')).toHaveCount(0);
    await expect(page.getByTestId('enemy-status')).toHaveCount(0);
    await expect(page.getByTestId('kill-beat-input-guard')).toHaveCount(0);
    // 내 일반 타격으로 끝난 차례 — 적 강타 · 내 치명타가 없으면 어느 펄스도 켜지지 않는다.
    await expect(page.getByTestId('heavy-hit-pulse')).toHaveCount(0);

    await page.getByTestId('post-combat-close').click();
    await expect(card).toBeHidden({ timeout: 8_000 });
});

test('모션 감소: 처치 순간은 짧게 멈춰 보이고 결과 카드 · 알림은 그대로다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    const beat = await killInjectedEnemy(page);
    expect(beat.stamp).toBe('처치');
    expect(beat.cardDuringBeat).toBe(false);
    expect(beat.underFinger).toBe('kill-beat-input-guard');

    await expect(page.getByTestId('combat-announcer')).toContainText(`${ENEMY_NAME} 처치`);
    const card = page.getByTestId('post-combat-card');
    await expect(card).toBeVisible({ timeout: 8_000 });
    await page.getByTestId('post-combat-close').click();
    await expect(card).toBeHidden({ timeout: 8_000 });
});
