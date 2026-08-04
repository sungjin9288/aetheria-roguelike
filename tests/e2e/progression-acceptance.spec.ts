import { test, expect } from '@playwright/test';
import { openTownFacilities, startE2ERun } from './testHelpers';

const seedProgressionAcceptance = async (page: any) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page, { openStatusConsole: true });
    const seeded = await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedProgressionAcceptanceScenario?.()
    ));
    expect(seeded).toBe(true);
};

test.describe('물리 성장 acceptance 시나리오', () => {
    test('긴 세트와 유물 조합을 읽고 도감 보상을 한 번만 받는다', async ({ page }) => {
        await seedProgressionAcceptance(page);

        const signatureSet = page.getByTestId('stats-active-signature-set');
        const synergies = page.getByTestId('stats-active-synergies');
        await expect(signatureSet).toContainText('암흑 군주의 계약');
        await expect(signatureSet).toContainText('3세트 활성');
        await expect(signatureSet).toContainText('완전한 타락');
        await expect(synergies).toContainText('원초의 분노');
        await expect(synergies).toContainText('치명타 확률 25% 증가');

        const overflow = await page.evaluate(() => (
            ['stats-active-signature-set', 'stats-active-synergies'].map((testId) => {
                const root = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
                if (!root) throw new Error(`${testId} is missing`);
                return root.scrollWidth - root.clientWidth;
            })
        ));
        expect(overflow.every((value) => value <= 1)).toBe(true);

        await page.getByTestId('archive-tab-codex').click();
        const claim = page.getByTestId('codex-claim-weapons_5');
        await expect(claim).toBeVisible();

        const before = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(before.codexBonusAtk).toBe(0);
        expect(before.codexClaimed).toEqual([]);

        await claim.click();
        await expect(claim).toBeHidden();
        const after = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(after.codexBonusAtk).toBe(2);
        expect(after.codexClaimed).toEqual(['weapons_5']);
    });

    test('전직과 기술 성장은 후보 선택이 아니라 확정할 때만 적용된다', async ({ page }) => {
        await seedProgressionAcceptance(page);
        await page.getByTestId('mobile-console-return-log').click();
        await openTownFacilities(page);
        await page.getByTestId('control-class').click();
        await expect(page.getByTestId('job-change-panel')).toBeVisible();
        await expect(page.getByTestId('level-up-banner')).toBeHidden({ timeout: 8_000 });

        const magician = page.getByTestId('job-change-option').filter({ hasText: '마법사' });
        await magician.click();
        const afterCandidate = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(afterCandidate.job).toBe('모험가');

        const warrior = page.getByTestId('job-change-option').filter({ hasText: '전사' });
        await warrior.click();
        await page.getByTestId('job-change-confirm').click();
        const afterJobChange = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(afterJobChange.job).toBe('전사');
        expect(afterJobChange.hp).toBe(afterJobChange.maxHp);
        expect(afterJobChange.mp).toBe(afterJobChange.maxMp);

        const milestone = page.getByTestId('milestone-story-card');
        const storyOpened = await milestone.waitFor({ state: 'visible', timeout: 3_000 })
            .then(() => true)
            .catch(() => false);
        if (storyOpened) await page.getByTestId('milestone-story-close').click();

        await page.getByTestId('mobile-console-open-archive').click();
        await page.getByTestId('archive-tab-skills').click();
        await page.getByTestId('skill-branch-choice-파워배시-B').click();

        const freePreview = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(freePreview.gold).toBe(400);
        expect(freePreview.skillChoices).toEqual({});

        await page.getByTestId('skill-growth-confirm-파워배시').click();
        const freeConfirmed = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(freeConfirmed.gold).toBe(400);
        expect(freeConfirmed.skillChoices.파워배시).toBe('B');

        await page.getByTestId('skill-growth-change-파워배시').click();
        await page.getByTestId('skill-branch-choice-파워배시-A').click();
        const paidPreview = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(paidPreview.gold).toBe(400);
        expect(paidPreview.skillChoices.파워배시).toBe('B');

        await page.getByTestId('skill-growth-confirm-파워배시').click();
        const paidConfirmed = await page.evaluate(() => (
            window.__AETHERIA_TEST_API__?.getProgressionAcceptanceSnapshot?.()
        ));
        expect(paidConfirmed.gold).toBe(350);
        expect(paidConfirmed.skillChoices.파워배시).toBe('A');
    });
});
