import { test, expect } from '@playwright/test';
import { startE2ERun } from './testHelpers';

const key = 'aetheria.product-events.v1';
const fixture = { name: 'boot', releaseId: 'qa-test', runtime: 'web', os: 'web', sessionId: 'session:qa',
    job: 'unknown', levelBand: '1-4', elapsedBucket: '0-10s', outcome: 'ready' };
const openRecords = async (page: Parameters<typeof startE2ERun>[0]) => {
    await page.evaluate(() => window.__AETHERIA_TEST_API__?.seedSystemSettingsScenario?.());
    const support = page.getByTestId('system-support-tools');
    await support.scrollIntoViewIfNeeded();
    await support.locator('summary').click();
    await page.getByTestId('system-product-events').scrollIntoViewIfNeeded();
};

test('실제 runtime 기본 sink는 릴리스 ID 조건에 따라 기기에만 기록한다', async ({ page }) => {
    await startE2ERun(page, { openStatusConsole: true });
    await openRecords(page);
    const active = Boolean(process.env.VITE_RELEASE_ID);
    await expect(page.getByTestId('system-product-events-mode')).toContainText(active
        ? '이 빌드는 새 활동의 로컬 기록을 지원합니다.' : '새 활동을 기록하지 않습니다.');
    if (active) {
        await expect.poll(async () => page.evaluate((storageKey) => {
            const raw = localStorage.getItem(storageKey);
            return raw ? JSON.parse(raw).events.length : 0;
        }, key)).toBeGreaterThan(0);
        const events = await page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!).events, key);
        expect(events.some((event: { name: string }) => event.name === 'boot')).toBe(true);
        for (const event of events) {
            expect(Object.keys(event)).toHaveLength(event.name === 'ai_fallback' ? 7 : 9);
            expect(event.releaseId).toBe(process.env.VITE_RELEASE_ID);
        }
    } else {
        expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
    }
});

test('별도 내보내기는 최신 9필드만 포함하고 삭제는 게임 저장을 보존한다', async ({ page, context }) => {
    await startE2ERun(page, { openStatusConsole: true });
    await openRecords(page);
    await page.evaluate(({ storageKey, event }) => {
        localStorage.setItem(storageKey, JSON.stringify({ version: 1, events: [{ ...event, nickname: 'PRIVATE', rawSave: 'PRIVATE' }] }));
        localStorage.setItem('qa-unrelated-save', 'keep');
    }, { storageKey: key, event: fixture });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('system-copy-product-events').click();
    expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual({ version: 1, events: [fixture] });
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('system-export-product-events').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream!) chunks.push(chunk);
    const result = JSON.parse(Buffer.concat(chunks).toString());
    expect(result).toEqual({ version: 1, events: [fixture] });
    await page.getByTestId('system-clear-product-events').click();
    await expect(page.getByTestId('system-notice')).toContainText('활동 기록을 지웠습니다.');
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('qa-unrelated-save'))).toBe('keep');
});

test('삭제 권한 실패는 성공으로 표시하지 않고 손상 데이터 내보내기를 거부한다', async ({ page }) => {
    await startE2ERun(page, { openStatusConsole: true });
    await openRecords(page);
    await page.evaluate((storageKey) => {
        localStorage.setItem(storageKey, '{');
        const remove = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (item) {
            if (item === storageKey) throw new Error('QA storage denied');
            return remove.call(this, item);
        };
    }, key);
    await page.getByTestId('system-clear-product-events').click();
    await expect(page.getByTestId('system-notice')).toContainText('활동 기록을 지우지 못했습니다.');
    await expect(page.getByTestId('system-product-events-status')).toContainText('기록을 읽을 수 없습니다.');
    await page.getByTestId('system-export-product-events').click();
    await expect(page.getByTestId('system-notice')).toContainText('활동 기록을 내보내지 못했습니다.');
    await page.getByTestId('system-product-events').screenshot({ path: 'playtest-artifacts/local-product-events-390.png' });
});


test('쓰기 한도 오류가 있어도 게임은 열리고 기록 실패를 표시한다', async ({ page }) => {
    await page.addInitScript((storageKey) => {
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function (item, value) {
            if (item === storageKey) throw new Error('QA quota exceeded');
            return write.call(this, item, value);
        };
    }, key);
    await startE2ERun(page, { openStatusConsole: true });
    await openRecords(page);
    await page.getByTestId('system-export-product-events').focus();
    if (process.env.VITE_RELEASE_ID) {
        await expect(page.getByTestId('system-product-events')).toContainText('최근 활동을 저장하지 못했습니다.');
    } else {
        await expect(page.getByTestId('system-product-events-mode')).toContainText('새 활동을 기록하지 않습니다.');
    }
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
});
