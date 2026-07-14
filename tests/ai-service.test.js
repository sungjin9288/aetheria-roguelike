import test from 'node:test';
import assert from 'node:assert/strict';

// aiService.ts는 모듈 로드 시점에 CONSTANTS.USE_AI_PROXY를 굳힌다(Object.freeze된 CONSTANTS).
// import.meta.env.VITE_USE_AI_PROXY는 Vite 빌드 타임에만 채워지므로, plain Node 테스트
// 환경에서 프록시 경로를 켜려면 constants.ts가 process.env로 폴백하는 지점을 이용해
// 동적 import 전에 process.env.VITE_USE_AI_PROXY를 지정해야 한다. 이 값은 이 파일에서
// 정적 import된 모듈 그래프 전체가 공유하므로, 프록시 OFF(기본값) 시나리오는 별도
// 자식 프로세스(node --test는 파일 단위로 프로세스를 분리)에서 검증할 수 없어
// 이 파일 안에서는 "프록시 ON" 전제로 fetch 성공/실패/타임아웃을 검증하고, 기본값(false)
// 검증은 별도 파일(ai-service-proxy-default.test.js)에서 process.env 오염 없이 수행한다.
process.env.VITE_USE_AI_PROXY = 'true';

const { AI_SERVICE } = await import('../src/services/aiService.ts');
const { TokenQuotaManager } = await import('../src/systems/TokenQuotaManager.ts');

/** localStorage 간이 스텁 — TokenQuotaManager가 사용하는 getItem/setItem만 구현. */
const makeLocalStorageStub = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

/** globalThis에 stub을 주입하고, 콜백 실행 후 원래 상태로 반드시 복원한다. */
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

const basePlayerContext = { playerSnapshot: { level: 5, maxHp: 200, maxMp: 100 }, mapSnapshot: { level: 3 } };

test('generateEvent: fetch 성공 + success 응답 → AI 이벤트를 반환한다', async () => {
    let calledUrl = null;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async (url) => {
            calledUrl = url;
            return {
                ok: true,
                json: async () => ({
                    success: true,
                    data: { desc: '고대 유적에서 신비로운 빛이 흘러나옵니다.', choices: ['다가간다', '관찰한다'] },
                }),
            };
        },
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.ok(event);
        assert.equal(event.source, 'ai');
        assert.equal(event.desc, '고대 유적에서 신비로운 빛이 흘러나옵니다.');
        assert.ok(event.choices.length >= 2);
        assert.ok(calledUrl, 'fetch가 프록시 URL로 호출되어야 한다');
    });
});

test('generateEvent: fetch가 reject되면 오프라인 fallback 이벤트로 대체된다', async () => {
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            throw new Error('network down');
        },
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.ok(event);
        assert.equal(event.source, 'fallback');
        assert.ok(event.choices.length >= 2);
    });
});

test('generateEvent: fetch가 AbortError를 던지면(타임아웃 대체 시나리오) fallback으로 대체된다', async () => {
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            throw abortError;
        },
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.ok(event);
        assert.equal(event.source, 'fallback');
    });
});

test('generateEvent: 프록시 응답이 success:false면 fallback으로 대체된다', async () => {
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => ({ ok: true, json: async () => ({ success: false }) }),
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.ok(event);
        assert.equal(event.source, 'fallback');
    });
});

test('generateEvent: TokenQuotaManager 할당량 소진 시 즉시 fallback + fallbackReason:"quota"를 부여하고 fetch를 호출하지 않는다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({ success: true, data: {} }) };
        },
    }, async () => {
        for (let i = 0; i < TokenQuotaManager.DAILY_LIMIT; i += 1) {
            TokenQuotaManager.recordCall();
        }

        assert.equal(TokenQuotaManager.canMakeAICall(), false);

        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.ok(event);
        assert.equal(event.fallbackReason, 'quota');
        assert.equal(event.fallbackMessage, TokenQuotaManager.getExhaustedMessage());
        assert.equal(fetchCalled, false, '할당량 소진 시 프록시 fetch를 호출하면 안 된다');
    });
});

test('generateStory: TokenQuotaManager 할당량 소진 시 getFallback 내러티브를 즉시 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({ success: true, data: { narrative: 'AI 내러티브' } }) };
        },
    }, async () => {
        for (let i = 0; i < TokenQuotaManager.DAILY_LIMIT; i += 1) {
            TokenQuotaManager.recordCall();
        }

        const story = await AI_SERVICE.generateStory('levelUp', { level: 7 }, 'test-uid');
        assert.equal(story, AI_SERVICE.getFallback('levelUp', { level: 7 }));
        assert.equal(fetchCalled, false);
    });
});

test('generateEvent: isSmokeRuntime()이 true면(smoke=1) fetch를 호출하지 않고 즉시 fallback을 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        window: { location: { search: '?smoke=1' } },
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({}) };
        },
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.ok(event);
        assert.equal(event.source, 'fallback');
        assert.equal(fetchCalled, false);
    });
});

test('generateStory: isSmokeRuntime()이 true면 fetch 없이 getFallback 내러티브를 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        window: { location: { search: '?smoke=1' } },
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({}) };
        },
    }, async () => {
        const story = await AI_SERVICE.generateStory('rest', { loc: '시작의 마을' }, 'test-uid');
        assert.equal(story, AI_SERVICE.getFallback('rest', { loc: '시작의 마을' }));
        assert.equal(fetchCalled, false);
    });
});

test('generateStory: fetch 성공 + narrative 응답 → AI 내러티브 문자열을 반환한다', async () => {
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => ({
            ok: true,
            json: async () => ({ success: true, data: { narrative: '용사가 결정타를 날렸다!' } }),
        }),
    }, async () => {
        const story = await AI_SERVICE.generateStory('victory', { name: '고블린' }, 'test-uid');
        assert.equal(story, '용사가 결정타를 날렸다!');
    });
});

test('getFallback: 지원 타입 각각 고정 템플릿 문자열을 반환하고, 미지원 타입은 기본 문구로 대체된다', () => {
    assert.match(AI_SERVICE.getFallback('levelUp', { level: 9 }), /레벨 9/);
    assert.match(AI_SERVICE.getFallback('rest', { loc: '숲' }), /숲/);
    assert.equal(AI_SERVICE.getFallback('unknown_type', {}), '운명의 수레바퀴가 돌기 시작합니다.');
});
