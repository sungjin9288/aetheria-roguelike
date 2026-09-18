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
const { BALANCE } = await import('../src/data/constants.ts');
const { MSG } = await import('../src/data/messages.ts');

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

test('generateEvent: e2e mock runtime이면 proxy 설정과 무관하게 fetch 없이 fallback을 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        window: { location: { search: '?e2e=1' } },
        localStorage: makeLocalStorageStub(),
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

test('generateStory: e2e mock runtime이면 proxy 설정과 무관하게 fetch 없이 fallback을 반환한다', async () => {
    let fetchCalled = false;
    await withGlobalStub({
        window: { location: { search: '?e2e=1' } },
        localStorage: makeLocalStorageStub(),
        fetch: async () => {
            fetchCalled = true;
            return { ok: true, json: async () => ({ success: true, data: { narrative: 'AI 내러티브' } }) };
        },
    }, async () => {
        const story = await AI_SERVICE.generateStory('victory', { name: '고블린' }, 'test-uid');
        assert.equal(story, AI_SERVICE.getFallback('victory', { name: '고블린' }));
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

// ── 2026-09 Wave 3 I1: 모델 출력의 확장 어휘는 화이트리스트를 통과한 것만 살아남는다 ──

test('generateEvent: 모델이 보낸 relic/status/elite/buff는 검증 후에만 이벤트 패키지에 실린다', async () => {
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => ({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    desc: '관문 너머에서 낯선 손짓이 이어집니다.',
                    choices: ['손을 잡는다', '거리를 둔다'],
                    outcomes: [
                        {
                            choiceIndex: 0,
                            log: '손을 잡자 기운이 스며든다.',
                            gold: 30,
                            relic: { count: 5 },                       // 상한으로 잘림
                            status: { id: 'poison', turns: 99 },       // 상한으로 잘림
                            buff: { atkMult: 9, turns: 99 },           // 상한으로 잘림
                        },
                        {
                            choiceIndex: 1,
                            log: '거리를 두자 기척이 사라진다.',
                            status: { id: 'instant_death' },           // 화이트리스트 밖 → 드롭
                            elite: 'yes',                              // 불리언 아님 → 드롭
                            teleport: '마왕성',                         // 미지원 어휘 → 드롭
                            hp: -10,
                        },
                    ],
                },
            }),
        }),
    }, async () => {
        const event = await AI_SERVICE.generateEvent('에테르 관문', [], 'test-uid', basePlayerContext);
        assert.equal(event.source, 'ai');

        const [first, second] = event.outcomes;
        assert.equal(first.relic.count, BALANCE.EVENT_RELIC_MAX_COUNT);
        assert.equal(first.status.turns, BALANCE.EVENT_STATUS_MAX_TURNS);
        assert.equal(first.buff.atkMult, BALANCE.EVENT_BUFF_MAX_MULT);
        assert.equal(first.buff.turns, BALANCE.EVENT_BUFF_MAX_TURNS);

        assert.equal(second.status, undefined);
        assert.equal(second.elite, undefined);
        assert.equal(second.teleport, undefined);
        assert.equal(second.hp, -10, '수치 어휘는 기존대로 통과');
    });
});

test('generateStory: canonical location이 questComplete outgoing context에 포함되고 undefined를 남기지 않는다', async () => {
    let requestBody = null;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({ success: true, data: { narrative: '퀘스트를 완수했다.' } }),
            };
        },
    }, async () => {
        const story = await AI_SERVICE.generateStory('questComplete', {
            questTitle: '황금 왕국의 문을 열다',
            location: '황금 왕국',
            history: [],
        }, 'test-uid');

        assert.equal(story, '퀘스트를 완수했다.');
    });

    assert.equal(requestBody.type, 'story');
    assert.equal(requestBody.data.location, '황금 왕국');
    assert.match(requestBody.data.context, /황금 왕국/);
    assert.doesNotMatch(requestBody.data.context, /undefined/);
});

test('generateStory: legacy loc caller는 canonical narrative context로 계속 처리한다', async () => {
    let requestBody = null;
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({ success: true, data: { narrative: '숲의 기록이 이어졌다.' } }),
            };
        },
    }, async () => {
        const story = await AI_SERVICE.generateStory('rest', {
            loc: '고요한 숲',
            history: [],
        }, 'test-uid');

        assert.equal(story, '숲의 기록이 이어졌다.');
    });

    assert.equal(requestBody.data.loc, '고요한 숲');
    assert.match(requestBody.data.context, /고요한 숲/);
    assert.doesNotMatch(requestBody.data.context, /undefined/);
});

test('narrative location: canonical priority and invalid input fallback agree at proxy and offline boundaries', async () => {
    const cases = [
        { input: { location: '황금 왕국', loc: '고요한 숲' }, expected: '황금 왕국' },
        { input: { location: '  ', loc: '고요한 숲' }, expected: '고요한 숲' },
        { input: {}, expected: '알 수 없음' },
        { input: { location: '  ', loc: '' }, expected: '알 수 없음' },
        { input: { location: 42, loc: null }, expected: '알 수 없음' },
    ];
    for (const { input, expected } of cases) {
        let requestBody;
        await withGlobalStub({
            localStorage: makeLocalStorageStub(),
            fetch: async (_url, options) => {
                requestBody = JSON.parse(options.body);
                return { ok: true, json: async () => ({ success: true, data: { narrative: '휴식을 마쳤다.' } }) };
            },
        }, async () => {
            await AI_SERVICE.generateStory('rest', input, 'test-uid');
        });
        assert.equal(requestBody.data.context, `${expected}에서 휴식`);
        assert.equal(AI_SERVICE.getFallback('rest', input), `${expected}에서 편안히 쉬며 생명을 회복했습니다.`);
        assert.equal(AI_SERVICE.getFallback('encounter', { ...input, name: '슬라임' }), `${expected}의 어둠 속에서 슬라임의 기척이 나타났습니다.`);
    }
});

// ── 2026-09 Wave 12 D3: 쿼터 회계 — 두 경로가 같은 미터를 같은 방식으로 움직인다 ──

/**
 * 미터의 의미: **디스패치 1건 = 쿼터 1건**. 프록시로 나간 요청은 응답이 오지 않아도,
 * 패키지가 깨져도, 최근 본 이야기와 겹쳐 버려져도 한 건을 쓴다. 채택 여부는 한도가 아니라
 * `outcomes` 원장에 남고, 그래서 "나갔지만 채택되지 않은 호출"이 처음으로 숫자가 된다.
 *
 * 각 행: 라벨 · 프록시 fetch 스텁 · 호출 실행 · 기대 정산.
 */
const ACCOUNTING_TABLE = [
    [
        'event 채택: AI 이벤트가 그대로 실린다',
        async () => ({ ok: true, json: async () => ({ success: true, data: { desc: '유적이 낮게 웅웅거린다.', choices: ['다가간다', '물러선다'] } }) }),
        () => AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext),
        { dispatched: 1, outcome: 'adopted' },
    ],
    [
        'event 미채택(malformed): desc가 없어 패키지가 만들어지지 않는다',
        async () => ({ ok: true, json: async () => ({ success: true, data: { choices: ['가', '나'] } }) }),
        () => AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext),
        { dispatched: 1, outcome: 'malformed-response' },
    ],
    [
        'event 미채택(recent-duplicate): 최근에 본 이야기와 같다',
        async () => ({ ok: true, json: async () => ({ success: true, data: { desc: '유적이 낮게 웅웅거린다.', choices: ['다가간다', '물러선다'] } }) }),
        () => AI_SERVICE.generateEvent('잊혀진 폐허', [{ event: '유적이 낮게 웅웅거린다.' }], 'test-uid', basePlayerContext),
        { dispatched: 1, outcome: 'recent-duplicate' },
    ],
    [
        'event 미채택(proxy-unavailable): 응답이 오지 않았다',
        async () => { throw new Error('network down'); },
        () => AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext),
        { dispatched: 1, outcome: 'proxy-unavailable' },
    ],
    [
        'event 미채택(proxy-rejected): success:false',
        async () => ({ ok: true, json: async () => ({ success: false }) }),
        () => AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext),
        { dispatched: 1, outcome: 'proxy-rejected' },
    ],
    [
        'story 채택: narrative 문자열',
        async () => ({ ok: true, json: async () => ({ success: true, data: { narrative: '용사가 결정타를 날렸다!' } }) }),
        () => AI_SERVICE.generateStory('victory', { name: '고블린', history: [] }, 'test-uid'),
        { dispatched: 1, outcome: 'adopted' },
    ],
    [
        'story 미채택(malformed): narrative가 문자열이 아니다',
        async () => ({ ok: true, json: async () => ({ success: true, data: { narrative: 7 } }) }),
        () => AI_SERVICE.generateStory('victory', { name: '고블린', history: [] }, 'test-uid'),
        { dispatched: 1, outcome: 'malformed-response' },
    ],
    [
        'story 미채택(proxy-unavailable): 응답이 오지 않았다',
        async () => { throw new Error('network down'); },
        () => AI_SERVICE.generateStory('victory', { name: '고블린', history: [] }, 'test-uid'),
        { dispatched: 1, outcome: 'proxy-unavailable' },
    ],
    [
        'story 미채택(proxy-rejected): success:false',
        async () => ({ ok: true, json: async () => ({ success: false }) }),
        () => AI_SERVICE.generateStory('victory', { name: '고블린', history: [] }, 'test-uid'),
        { dispatched: 1, outcome: 'proxy-rejected' },
    ],
];

test(`쿼터 회계표 ${ACCOUNTING_TABLE.length}행 — 나간 요청은 채택되지 않아도 1건을 쓰고, 그 결과가 원장에 남는다`, async () => {
    for (const [label, fetchStub, run, expected] of ACCOUNTING_TABLE) {
        await withGlobalStub({ localStorage: makeLocalStorageStub(), fetch: fetchStub }, async () => {
            await run();
            const ledger = TokenQuotaManager.getCallLedger();
            assert.equal(ledger.dispatched, expected.dispatched, `${label}: 디스패치`);
            assert.deepEqual(ledger.byOutcome, { [expected.outcome]: 1 }, `${label}: 정산`);
            assert.equal(ledger.unsettled, 0, `${label}: 미정산 0`);
            assert.equal(
                ledger.adopted + ledger.unadopted,
                ledger.dispatched,
                `${label}: 디스패치는 전부 정산된다`,
            );
        });
    }
});

test('쿼터 회계 대칭: 같은 프록시 봉투에 이벤트/스토리가 같은 미터 움직임을 낸다', async () => {
    // W11 발견 6의 그 봉투 — 예전에는 이벤트만 1건을 쓰고 스토리는 0건이었다.
    const envelopes = [
        ['응답 없음', async () => { throw new Error('network down'); }],
        ['success:false', async () => ({ ok: true, json: async () => ({ success: false }) })],
        ['success:true + 빈 data', async () => ({ ok: true, json: async () => ({ success: true, data: {} }) })],
    ];

    for (const [label, fetchStub] of envelopes) {
        const readLedger = async (run) => {
            let ledger;
            await withGlobalStub({ localStorage: makeLocalStorageStub(), fetch: fetchStub }, async () => {
                await run();
                ledger = TokenQuotaManager.getCallLedger();
            });
            return ledger;
        };

        const eventLedger = await readLedger(() => AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext));
        const storyLedger = await readLedger(() => AI_SERVICE.generateStory('victory', { name: '고블린', history: [] }, 'test-uid'));

        assert.equal(eventLedger.dispatched, 1, `${label}: event 디스패치 1`);
        assert.equal(storyLedger.dispatched, 1, `${label}: story 디스패치 1`);
        assert.equal(eventLedger.adopted, storyLedger.adopted, `${label}: 채택 수 일치`);
        assert.equal(eventLedger.unadopted, storyLedger.unadopted, `${label}: 미채택 수 일치`);
        assert.deepEqual(eventLedger.byOutcome, storyLedger.byOutcome, `${label}: 정산 어휘 일치`);
    }
});

test('디스패치 전 폴백 3종은 미터를 전혀 움직이지 않는다 (mock 런타임 / 쿼터 소진 / 프록시 비활성)', async () => {
    // mock 런타임: localStorage를 아예 주지 않아도 통과해야 한다(쿼터를 읽지 않는다).
    await withGlobalStub({
        window: { location: { search: '?e2e=1' } },
        fetch: async () => { throw new Error('mock 런타임은 프록시를 부르지 않는다'); },
    }, async () => {
        const event = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.equal(event.source, 'fallback');
    });

    // 쿼터 소진: 이미 50건을 썼으므로 51번째 디스패치는 없다.
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => { throw new Error('쿼터 소진 시 프록시를 부르면 안 된다'); },
    }, async () => {
        for (let i = 0; i < TokenQuotaManager.DAILY_LIMIT; i += 1) TokenQuotaManager.recordCall();
        await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        await AI_SERVICE.generateStory('victory', { name: '고블린', history: [] }, 'test-uid');
        assert.equal(TokenQuotaManager.getCallLedger().dispatched, TokenQuotaManager.DAILY_LIMIT, '한도를 넘겨 세지 않는다');
    });
});

test('한도 소진 안내가 "몇 번 보냈고 몇 번이 이야기가 됐는지"를 실어 폴백 이벤트에 붙는다', async () => {
    await withGlobalStub({
        localStorage: makeLocalStorageStub(),
        fetch: async () => ({ ok: true, json: async () => ({ success: true, data: { choices: ['가', '나'] } }) }),
    }, async () => {
        // 한도 직전까지 미채택으로 태운 뒤, 마지막 1건으로 한도를 닫는다.
        for (let i = 0; i < TokenQuotaManager.DAILY_LIMIT - 1; i += 1) {
            TokenQuotaManager.recordCall();
            TokenQuotaManager.recordOutcome('proxy-unavailable');
        }
        const burned = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.equal(burned.source, 'fallback', '패키지가 깨졌으므로 폴백');
        assert.equal(TokenQuotaManager.canMakeAICall(), false);

        const exhausted = await AI_SERVICE.generateEvent('잊혀진 폐허', [], 'test-uid', basePlayerContext);
        assert.equal(exhausted.fallbackReason, 'quota');
        assert.equal(exhausted.fallbackMessage, MSG.AI_QUOTA_EXHAUSTED_LEDGER(0, TokenQuotaManager.DAILY_LIMIT));
        assert.notEqual(exhausted.fallbackMessage, MSG.AI_QUOTA_EXHAUSTED,
            '채택 0건인 하루에 기본 문구만 보여주면 안내가 거짓이 된다');
    });
});

test('getFallback: 지원 타입 각각 고정 템플릿 문자열을 반환하고, 미지원 타입은 기본 문구로 대체된다', () => {
    assert.match(AI_SERVICE.getFallback('levelUp', { level: 9 }), /레벨 9/);
    assert.match(AI_SERVICE.getFallback('rest', { loc: '숲' }), /숲/);
    assert.equal(AI_SERVICE.getFallback('unknown_type', {}), '운명의 수레바퀴가 돌기 시작합니다.');
});
