import test from 'node:test';
import assert from 'node:assert/strict';

// 이 파일은 process.env.VITE_USE_AI_PROXY를 건드리지 않는다 — CONSTANTS.USE_AI_PROXY의
// 기본값(false)을 그대로 사용해 "프록시 호출 없이 fallback" 경로를 검증한다.
// (ai-service.test.js는 프록시 ON 시나리오 검증을 위해 process.env.VITE_USE_AI_PROXY='true'를
// 설정하므로, 기본값 검증은 별도 파일 — node --test는 파일 단위로 프로세스를 분리해 격리된다.)
import { AI_SERVICE } from '../src/services/aiService.ts';
import { CONSTANTS } from '../src/data/constants.ts';

const makeLocalStorageStub = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

const withGlobalStub = async (overrides, fn) => {
    const originals = {};
    const hadOwn = {};
    for (const key of Object.keys(overrides)) {
        hadOwn[key] = Object.prototype.hasOwnProperty.call(globalThis, key);
        originals[key] = globalThis[key];
        globalThis[key] = overrides[key];
    }
    try {
        return await fn();
    } finally {
        for (const key of Object.keys(overrides)) {
            if (hadOwn[key]) {
                globalThis[key] = originals[key];
            } else {
                delete globalThis[key];
            }
        }
    }
};

test('CONSTANTS.USE_AI_PROXY 기본값은 false다', () => {
    assert.equal(CONSTANTS.USE_AI_PROXY, false);
});

test('generateEvent: USE_AI_PROXY가 false(기본값)면 fetch를 전혀 호출하지 않고 fallback을 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({ success: true, data: {} }) };
        },
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', {
            playerSnapshot: { level: 5, maxHp: 200, maxMp: 100 },
            mapSnapshot: { level: 3 },
        });

        assert.ok(event);
        assert.equal(event.source, 'fallback');
        assert.equal(fetchCalled, false, 'USE_AI_PROXY=false면 프록시 fetch를 호출하면 안 된다');
    });
});

test('generateStory: USE_AI_PROXY가 false(기본값)면 fetch 없이 getFallback 내러티브를 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({ success: true, data: { narrative: 'AI' } }) };
        },
    }, async () => {
        const story = await AI_SERVICE.generateStory('victory', { name: '고블린' }, 'test-uid');
        assert.equal(story, AI_SERVICE.getFallback('victory', { name: '고블린' }));
        assert.equal(fetchCalled, false);
    });
});
