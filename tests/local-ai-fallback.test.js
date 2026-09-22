import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const withRuntime = async (proxyEnabled, run, releaseId = 'qa-fallback') => {
    const server = await createServer({ configFile: false, envFile: false, logLevel: 'silent',
        server: { middlewareMode: true, watch: null, hmr: false },
        define: { 'import.meta.env.VITE_RELEASE_ID': JSON.stringify(releaseId),
            'import.meta.env.VITE_USE_AI_PROXY': JSON.stringify(String(proxyEnabled)),
            'import.meta.env.VITE_ENABLE_TEST_API': JSON.stringify('1') } });
    const originals = Object.fromEntries(['localStorage', 'window', 'fetch'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const values = new Map();
    globalThis.localStorage = { getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    try {
        const { AI_SERVICE } = await server.ssrLoadModule('/src/services/aiService.ts');
        const { readProductEvents, clearProductEvents } = await server.ssrLoadModule('/src/platform/localProductEventStore.ts');
        const { TokenQuotaManager } = await server.ssrLoadModule('/src/systems/TokenQuotaManager.ts');
        const { getRuntimeProductEventCoordinator } = await server.ssrLoadModule('/src/platform/productEventCoordinator.ts');
        await run({ AI_SERVICE, readProductEvents, clearProductEvents, TokenQuotaManager, values, getRuntimeProductEventCoordinator });
    } finally {
        for (const [key, descriptor] of Object.entries(originals)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
        await server.close();
    }
};
const context = { playerSnapshot: { level: 5, maxHp: 200, maxMp: 100 }, mapSnapshot: { level: 3 } };
const payload = { desc: '고대 유적에서 신비로운 빛이 흘러나옵니다.', choices: ['다가간다', '관찰한다'] };

test('AI 서비스의 실제 폴백 분기마다 폐쇄형 사유를 정확히 한 번 기록한다', async () => {
    await withRuntime(true, async ({ AI_SERVICE, readProductEvents, clearProductEvents, TokenQuotaManager, values }) => {
        for (const reason of ['mock-runtime', 'quota', 'proxy-unavailable', 'proxy-rejected', 'malformed-response', 'recent-duplicate']) {
            for (const kind of reason === 'recent-duplicate' ? ['event'] : ['event', 'story']) {
                values.clear();
                globalThis.window = { location: { search: reason === 'mock-runtime' ? '?e2e=1' : '' } };
                if (reason === 'quota') TokenQuotaManager.canMakeAICall = () => false;
                else TokenQuotaManager.canMakeAICall = () => true;
                globalThis.fetch = async () => ({ ok: reason !== 'proxy-unavailable', json: async () => (
                    reason === 'proxy-rejected' ? { success: false } : { success: true, data: reason === 'malformed-response' ? {} : payload }
                ) });
                const history = reason === 'recent-duplicate' ? [{ desc: payload.desc }] : [];
                if (kind === 'event') await AI_SERVICE.generateEvent('잊혀진 폐허', history, 'PRIVATE-UID', context, () => 0.5);
                else await AI_SERVICE.generateStory('victory', { name: 'PRIVATE-NAME' }, 'PRIVATE-UID');
                const events = readProductEvents().events;
                assert.equal(events.length, 1, `${kind}/${reason}`);
                assert.equal(events[0].reason, reason);
                assert.equal(events[0].requestKind, kind);
                assert.equal(Object.keys(events[0]).length, 7);
                assert.doesNotMatch(JSON.stringify(events), /PRIVATE|신비로운|playerSnapshot/);
                assert.equal(clearProductEvents(), true);
            }
        }
    });
});

test('프록시 비활성은 두 호출 종류 모두 로컬 사유만 기록하고 fetch하지 않는다', async () => {
    await withRuntime(false, async ({ AI_SERVICE, readProductEvents }) => {
        let calls = 0;
        globalThis.fetch = async () => { calls++; throw Error('Unexpected network'); };
        await AI_SERVICE.generateEvent('잊혀진 폐허', [], null, context, () => 0.5);
        await AI_SERVICE.generateStory('victory', { name: '고블린' }, null);
        assert.equal(calls, 0);
        assert.deepEqual(readProductEvents().events.map(({ requestKind, reason }) => ({ requestKind, reason })), [
            { requestKind: 'event', reason: 'proxy-disabled' }, { requestKind: 'story', reason: 'proxy-disabled' },
        ]);
    });
});


test('AI 폴백도 릴리스 ID가 없으면 보관하지 않는다', async () => {
    await withRuntime(false, async ({ AI_SERVICE, readProductEvents }) => {
        await AI_SERVICE.generateEvent('잊혀진 폐허', [], null, context, () => 0.5);
        await AI_SERVICE.generateStory('victory', { name: '고블린' }, null);
        assert.deepEqual(readProductEvents().events, []);
    }, '');
});


test('기본 coordinator는 sink 주입 없이 보관하고 같은 receipt는 한 번만 남긴다', async () => {
    await withRuntime(false, async ({ getRuntimeProductEventCoordinator, readProductEvents }) => {
        const emission = { receipt: 'qa:boot', name: 'boot', fields: { job: 'unknown', level: 1, outcome: 'ready' } };
        getRuntimeProductEventCoordinator().trackAll([emission, emission]);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const events = readProductEvents().events;
        assert.equal(events.length, 1);
        assert.equal(events[0].name, 'boot');
        assert.equal(events[0].releaseId, 'qa-fallback');
    });
});
