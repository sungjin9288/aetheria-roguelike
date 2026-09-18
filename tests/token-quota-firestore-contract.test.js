import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.ts';
import { TokenQuotaManager } from '../src/systems/TokenQuotaManager.ts';

const makeLocalStorageStub = (entries = {}) => {
    const store = new Map(Object.entries(entries));
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

const withLocalStorage = async (localStorage, fn) => {
    const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
    const original = globalThis.localStorage;
    globalThis.localStorage = localStorage;
    try {
        return await fn();
    } finally {
        if (hadOwn) globalThis.localStorage = original;
        else delete globalThis.localStorage;
    }
};

const makeOperations = ({ onDoc, onSetDoc, onServerTimestamp, onGetDoc } = {}) => ({
    doc: (...args) => {
        if (onDoc) onDoc(args);
        return { path: args.slice(1) };
    },
    setDoc: async (...args) => {
        if (onSetDoc) return onSetDoc(args);
        return undefined;
    },
    serverTimestamp: () => {
        if (onServerTimestamp) return onServerTimestamp();
        return { __type: 'serverTimestamp' };
    },
    // The production method must never consume a cloud read operation.
    getDoc: (...args) => {
        if (onGetDoc) return onGetDoc(args);
        throw new Error('unexpected cloud read');
    },
});

test('syncToFirestore runtime writes the exact quota document and preserves local authority', async () => {
    const today = new Date().toDateString();
    const localStorage = makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({ date: today, used: 7 }),
    });
    const calls = { doc: [], setDoc: [], serverTimestamp: 0, getDoc: 0 };
    const sentinel = { __sentinel: 'serverTimestamp' };
    const operations = makeOperations({
        onDoc: (args) => calls.doc.push(args),
        onSetDoc: (args) => calls.setDoc.push(args),
        onServerTimestamp: () => {
            calls.serverTimestamp += 1;
            return sentinel;
        },
        onGetDoc: () => {
            calls.getDoc += 1;
            throw new Error('quota sync must not read cloud state');
        },
    });

    await withLocalStorage(localStorage, async () => {
        const before = localStorage.getItem(TokenQuotaManager.QUOTA_KEY);
        await TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations);
        assert.equal(localStorage.getItem(TokenQuotaManager.QUOTA_KEY), before);
    });

    assert.deepEqual(calls.doc, [[
        { firestore: true },
        'artifacts', 'aetheria-rpg', 'users', 'user-123', 'quota', 'daily-ai',
    ]]);
    assert.equal(calls.serverTimestamp, 1);
    assert.equal(calls.getDoc, 0);
    assert.equal(calls.setDoc.length, 1);

    const [reference, payload, options] = calls.setDoc[0];
    assert.deepEqual(reference.path, ['artifacts', 'aetheria-rpg', 'users', 'user-123', 'quota', 'daily-ai']);
    assert.deepEqual(Object.keys(payload).sort(), ['date', 'limit', 'updatedAt', 'used']);
    assert.equal(payload.date, today);
    assert.equal(payload.used, 7);
    assert.equal(payload.limit, BALANCE.DAILY_AI_LIMIT);
    assert.equal(payload.limit, TokenQuotaManager.DAILY_LIMIT);
    assert.equal(payload.updatedAt, sentinel);
    assert.deepEqual(options, { merge: true });
});

test('syncToFirestore runtime rolls stale local quota to today with zero usage without rewriting local bytes', async () => {
    const staleBytes = JSON.stringify({ date: 'Mon Jan 01 2001', used: 49 });
    const localStorage = makeLocalStorageStub({ [TokenQuotaManager.QUOTA_KEY]: staleBytes });
    let payload;
    const operations = makeOperations({
        onSetDoc: (args) => {
            payload = args[1];
        },
    });

    await withLocalStorage(localStorage, async () => {
        await TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations);
        assert.equal(localStorage.getItem(TokenQuotaManager.QUOTA_KEY), staleBytes);
    });

    assert.equal(payload.date, new Date().toDateString());
    assert.equal(payload.used, 0);
    assert.equal(payload.limit, TokenQuotaManager.DAILY_LIMIT);
});

test('syncToFirestore runtime skips missing uid or db without constructing a write', async () => {
    const localStorage = makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({ date: new Date().toDateString(), used: 1 }),
    });
    let writes = 0;
    const operations = makeOperations({ onSetDoc: () => { writes += 1; } });

    await withLocalStorage(localStorage, async () => {
        await TokenQuotaManager.syncToFirestore('', { firestore: true }, operations);
        await TokenQuotaManager.syncToFirestore('user-123', null, operations);
    });

    assert.equal(writes, 0);
});

test('syncToFirestore runtime keeps a rejected Firestore write non-blocking and local bytes unchanged', async () => {
    const today = new Date().toDateString();
    const localStorage = makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({ date: today, used: 3 }),
    });
    const operations = makeOperations({
        onSetDoc: async () => {
            throw new Error('network unavailable');
        },
    });
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args);
    try {
        await withLocalStorage(localStorage, async () => {
            const before = localStorage.getItem(TokenQuotaManager.QUOTA_KEY);
            await assert.doesNotReject(() => TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations));
            assert.equal(localStorage.getItem(TokenQuotaManager.QUOTA_KEY), before);
        });
    } finally {
        console.warn = originalWarn;
    }
    assert.equal(warnings.length, 1);
});

test('Firestore quota rules contract is scoped and deterministic (no emulator claim)', async () => {
    const source = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    const start = source.indexOf('match /users/{uid}/quota/daily-ai');
    const end = source.indexOf('// ── 공개 설정', start);
    assert.ok(start >= 0, 'quota document match must exist');
    assert.ok(end > start, 'quota rule block must close before public settings');
    const block = source.slice(start, end);

    assert.match(block, /match \/users\/\{uid\}\/quota\/daily-ai/);
    assert.match(block, /allow read: if false;/);
    assert.match(block, /allow delete: if false;/);
    assert.doesNotMatch(block, /allow write:/);
    assert.match(block, /allow create: if isSelf\(uid\)/);
    assert.match(block, /allow update: if isSelf\(uid\)/);
    assert.match(block, /keys\(\)\.hasAll\(\['date', 'used', 'limit', 'updatedAt'\]\)/);
    assert.match(block, /keys\(\)\.hasOnly\(\['date', 'used', 'limit', 'updatedAt'\]\)/);
    assert.match(block, /request\.resource\.data\.date is string/);
    assert.match(block, /request\.resource\.data\.used is int/);
    assert.match(block, /request\.resource\.data\.used >= 0/);
    assert.match(block, /request\.resource\.data\.used <= 50/);
    assert.match(block, /request\.resource\.data\.limit == 50/);
    assert.match(block, /request\.resource\.data\.updatedAt == request\.time/);
    assert.match(block, /request\.resource\.data\.date == resource\.data\.date/);
    assert.match(block, /request\.resource\.data\.used >= resource\.data\.used/);
    assert.match(block, /request\.resource\.data\.used == 0/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Wave 12 D3 — 쿼터는 "디스패치" 미터다: 무엇을 세고, 나갔지만 채택되지 않은 호출이
//   어디에서 숫자가 되는가. `used`는 프록시로 나간 요청 수이고, `outcomes`는 그 호출들이
//   어떻게 끝났는지다(같은 레코드 = 진실 원천 1곳).
// ─────────────────────────────────────────────────────────────────────────────

const LEDGER_TABLE = [
    // 라벨, 기록 시퀀스(dispatch=null / 그 외 정산 결과), 기대 요약
    ['호출 0건', [], { dispatched: 0, adopted: 0, unadopted: 0, unsettled: 0 }],
    ['디스패치 1 + 채택 1', [null, 'adopted'], { dispatched: 1, adopted: 1, unadopted: 0, unsettled: 0 }],
    ['디스패치 1 + 응답 불통', [null, 'proxy-unavailable'], { dispatched: 1, adopted: 0, unadopted: 1, unsettled: 0 }],
    ['디스패치 1 + 프록시 거절', [null, 'proxy-rejected'], { dispatched: 1, adopted: 0, unadopted: 1, unsettled: 0 }],
    ['디스패치 1 + 패키지 실패', [null, 'malformed-response'], { dispatched: 1, adopted: 0, unadopted: 1, unsettled: 0 }],
    ['디스패치 1 + 최근 중복', [null, 'recent-duplicate'], { dispatched: 1, adopted: 0, unadopted: 1, unsettled: 0 }],
    [
        '디스패치 5 = 채택 2 + 미채택 3',
        [null, 'adopted', null, 'malformed-response', null, 'recent-duplicate', null, 'adopted', null, 'proxy-unavailable'],
        { dispatched: 5, adopted: 2, unadopted: 3, unsettled: 0 },
    ],
    ['정산 기록 없는 디스패치(진행 중/유실)', [null, null], { dispatched: 2, adopted: 0, unadopted: 0, unsettled: 2 }],
];

test(`AI 호출 원장 ${LEDGER_TABLE.length}행 — 디스패치 = 채택 + 미채택 + 미정산`, async () => {
    for (const [label, sequence, expected] of LEDGER_TABLE) {
        await withLocalStorage(makeLocalStorageStub(), async () => {
            for (const step of sequence) {
                if (step === null) TokenQuotaManager.recordCall();
                else TokenQuotaManager.recordOutcome(step);
            }
            const ledger = TokenQuotaManager.getCallLedger();
            assert.equal(ledger.dispatched, expected.dispatched, `${label}: dispatched`);
            assert.equal(ledger.adopted, expected.adopted, `${label}: adopted`);
            assert.equal(ledger.unadopted, expected.unadopted, `${label}: unadopted`);
            assert.equal(ledger.unsettled, expected.unsettled, `${label}: unsettled`);
            assert.equal(
                ledger.dispatched,
                ledger.adopted + ledger.unadopted + ledger.unsettled,
                `${label}: 회계 항등식`,
            );
        });
    }
});

test('한도 게이트가 세는 값은 디스패치다 — 정산은 한도를 소모하지 않는다', async () => {
    await withLocalStorage(makeLocalStorageStub(), async () => {
        for (let i = 0; i < TokenQuotaManager.DAILY_LIMIT; i += 1) {
            TokenQuotaManager.recordCall();
            // 전부 채택 실패로 끝나도 한도는 이미 소모됐다 — 이것이 "비용 미터"의 의미다.
            TokenQuotaManager.recordOutcome('malformed-response');
        }
        assert.equal(TokenQuotaManager.canMakeAICall(), false, `디스패치 ${TokenQuotaManager.DAILY_LIMIT}건에서 게이트가 닫힌다`);
        assert.equal(TokenQuotaManager.getCallLedger().adopted, 0);
        assert.equal(TokenQuotaManager.getCallLedger().unadopted, TokenQuotaManager.DAILY_LIMIT);

        // 정산만 더 적어도 한도는 움직이지 않는다(used는 recordCall만 올린다).
        const before = TokenQuotaManager.getQuotaData().used;
        TokenQuotaManager.recordOutcome('adopted');
        assert.equal(TokenQuotaManager.getQuotaData().used, before);
    });
});

test('한도 소진 안내는 채택되지 않은 호출이 있을 때만 정산 수치를 싣는다', async () => {
    // 전부 채택된 하루 — 기본 문구.
    await withLocalStorage(makeLocalStorageStub(), async () => {
        TokenQuotaManager.recordCall();
        TokenQuotaManager.recordOutcome('adopted');
        assert.equal(TokenQuotaManager.getExhaustedMessage(), MSG.AI_QUOTA_EXHAUSTED);
    });

    // 정산이 하나도 기록되지 않은 하루(구형 레코드/진행 중) — 기본 문구.
    await withLocalStorage(makeLocalStorageStub(), async () => {
        TokenQuotaManager.recordCall();
        assert.equal(TokenQuotaManager.getExhaustedMessage(), MSG.AI_QUOTA_EXHAUSTED);
    });

    // 미채택이 하나라도 있으면 "몇 번 보냈고 몇 번이 이야기가 됐는지"를 말한다.
    await withLocalStorage(makeLocalStorageStub(), async () => {
        for (const outcome of ['adopted', 'malformed-response', 'recent-duplicate']) {
            TokenQuotaManager.recordCall();
            TokenQuotaManager.recordOutcome(outcome);
        }
        assert.equal(TokenQuotaManager.getExhaustedMessage(), MSG.AI_QUOTA_EXHAUSTED_LEDGER(1, 3));
        assert.notEqual(TokenQuotaManager.getExhaustedMessage(), MSG.AI_QUOTA_EXHAUSTED);
    });
});

test('원장 읽기가 불가능하면(localStorage 없음) 안내는 기본 문구로 접히고 던지지 않는다', () => {
    assert.equal(TokenQuotaManager.getCallLedger(), null);
    assert.equal(TokenQuotaManager.getExhaustedMessage(), MSG.AI_QUOTA_EXHAUSTED);
});

test('구형 레코드(outcomes 없음)와 깨진 카운터를 마이그레이션 없이 읽는다', async () => {
    const today = new Date().toDateString();
    // 구형: {date, used}만 — DATA_VERSION과 무관한 파생 카운터라 기본값으로 이어붙인다.
    await withLocalStorage(makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({ date: today, used: 4 }),
    }), async () => {
        const ledger = TokenQuotaManager.getCallLedger();
        assert.equal(ledger.dispatched, 4);
        assert.equal(ledger.adopted, 0);
        assert.equal(ledger.unadopted, 0);
        assert.equal(ledger.unsettled, 4, '구형 레코드의 디스패치는 전부 미정산으로 보인다');

        TokenQuotaManager.recordCall();
        TokenQuotaManager.recordOutcome('adopted');
        assert.equal(TokenQuotaManager.getCallLedger().dispatched, 5);
        assert.equal(TokenQuotaManager.getCallLedger().adopted, 1);
    });

    // 깨진 값(문자열/음수/NaN)은 0으로 접힌다 — 원장 산술이 NaN으로 오염되지 않는다.
    await withLocalStorage(makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({ date: today, used: 'NaN', outcomes: { adopted: -3, bogus: 'x' } }),
    }), async () => {
        const ledger = TokenQuotaManager.getCallLedger();
        assert.equal(ledger.dispatched, 0);
        assert.equal(ledger.adopted, 0);
        assert.equal(ledger.unadopted, 0);
        assert.deepEqual(ledger.byOutcome, {});
    });
});

test('날짜가 바뀌면 디스패치와 정산이 함께 롤오버된다', async () => {
    await withLocalStorage(makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({
            date: 'Mon Jan 01 2001', used: 49, outcomes: { adopted: 20, 'recent-duplicate': 29 },
        }),
    }), async () => {
        const ledger = TokenQuotaManager.getCallLedger();
        assert.equal(ledger.date, new Date().toDateString());
        assert.equal(ledger.dispatched, 0);
        assert.equal(ledger.adopted, 0);
        assert.deepEqual(ledger.byOutcome, {});
    });
});

test('Firestore 페이로드는 4키 그대로다 — 정산 내역은 firestore.rules의 hasOnly 때문에 올리지 않는다', async () => {
    const today = new Date().toDateString();
    const localStorage = makeLocalStorageStub({
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify({
            date: today, used: 9, outcomes: { adopted: 3, 'malformed-response': 6 },
        }),
    });
    let payload;
    const operations = makeOperations({ onSetDoc: (args) => { payload = args[1]; } });

    await withLocalStorage(localStorage, async () => {
        await TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations);
    });

    assert.deepEqual(Object.keys(payload).sort(), ['date', 'limit', 'updatedAt', 'used']);
    assert.equal(payload.used, 9, '클라우드로 올라가는 used는 디스패치 수와 일치한다');
    assert.equal(payload.outcomes, undefined);
});

test('TokenQuotaManager production contract keeps firebase doc/setDoc/serverTimestamp defaults and two required arguments', async () => {
    const source = await readFile(new URL('../src/systems/TokenQuotaManager.ts', import.meta.url), 'utf8');

    assert.match(source, /import \{ setDoc, doc, serverTimestamp \} from 'firebase\/firestore'/);
    assert.match(source, /syncToFirestore\(uid: string, db: Firestore \| null, firestoreOperations/);
    assert.match(source, /firestoreOperations\.doc \|\| doc/);
    assert.match(source, /firestoreOperations\.setDoc \|\| setDoc/);
    assert.match(source, /firestoreOperations\.serverTimestamp \|\| serverTimestamp/);
});
