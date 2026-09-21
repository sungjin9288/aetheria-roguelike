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

/** `firestore.rules`의 quota 문서 블록만 잘라 온다(함수 정의가 블록 안에 있으므로 함께 온다). */
const readQuotaRulesBlock = async () => {
    const source = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    const start = source.indexOf('match /users/{uid}/quota/daily-ai');
    const end = source.indexOf('// ── 공개 설정', start);
    assert.ok(start >= 0, 'quota document match must exist');
    assert.ok(end > start, 'quota rule block must close before public settings');
    return source.slice(start, end);
};

/** 공백을 지운 형태 — 표현식의 **식별자**를 찾되 줄바꿈/들여쓰기 포맷에는 안 묶인다. */
const squash = (text) => text.replace(/\s+/g, '');

/** rules의 `hasAll([...])` / `hasOnly([...])` 키 목록을 그대로 읽는다. */
const parseKeyList = (block, fnName) => {
    const match = block.match(new RegExp(`${fnName}\\(\\[([^\\]]*)\\]\\)`));
    assert.ok(match, `${fnName}(...) 키 목록이 rules에 있어야 한다`);
    return match[1].split(',').map((key) => key.trim().replace(/^'|'$/g, '')).filter(Boolean);
};

/** 주어진 로컬 레코드로 실제 `syncToFirestore`를 돌려 나간 페이로드들을 잡는다. */
const capturePayloads = async (record, { onSetDoc } = {}) => {
    const localStorage = makeLocalStorageStub(record === undefined ? {} : {
        [TokenQuotaManager.QUOTA_KEY]: JSON.stringify(record),
    });
    const payloads = [];
    const operations = makeOperations({
        onSetDoc: async (args) => {
            payloads.push(args[1]);
            if (onSetDoc) return onSetDoc(args);
            return undefined;
        },
    });
    await withLocalStorage(localStorage, async () => {
        await TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations);
    });
    return payloads;
};

const SETTLEMENT_PAYLOAD_KEYS = ['adopted', 'date', 'limit', 'unadopted', 'updatedAt', 'used'];
const LEGACY_PAYLOAD_KEYS = ['date', 'limit', 'updatedAt', 'used'];

/** rules 거부(배포 창)와 네트워크 실패를 구분하는 신호. */
const rulesRejection = () => Object.assign(
    new Error('Missing or insufficient permissions.'),
    { code: 'permission-denied' },
);

const captureWarnings = async (fn) => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map((arg) => String(arg)).join(' '));
    try {
        await fn();
    } finally {
        console.warn = originalWarn;
    }
    return warnings;
};

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
    assert.deepEqual(Object.keys(payload).sort(), SETTLEMENT_PAYLOAD_KEYS);
    assert.equal(payload.date, today);
    assert.equal(payload.used, 7);
    // 정산이 하나도 기록되지 않은 하루 — 두 카운터는 0이고 `unsettled`(7)는 도출된다.
    assert.equal(payload.adopted, 0);
    assert.equal(payload.unadopted, 0);
    assert.equal(payload.used - payload.adopted - payload.unadopted, 7);
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
    assert.equal(payload.adopted, 0);
    assert.equal(payload.unadopted, 0);
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

test('Firestore quota rules block keeps its shape (텍스트 — 의미는 에뮬레이터가 본다)', async () => {
    const block = await readQuotaRulesBlock();

    assert.match(block, /match \/users\/\{uid\}\/quota\/daily-ai/);
    assert.match(block, /allow read: if false;/);
    assert.match(block, /allow delete: if false;/);
    assert.doesNotMatch(block, /allow write:/);
    assert.match(block, /allow create: if isSelf\(uid\)/);
    assert.match(block, /allow update: if isSelf\(uid\)/);
    assert.match(block, /data\.date is string/);
    assert.match(block, /data\.used is int/);
    assert.match(block, /data\.used >= 0/);
    assert.match(block, /data\.used <= 50/);
    assert.match(block, /data\.limit == 50/);
    assert.match(block, /request\.resource\.data\.updatedAt == request\.time/);
    assert.match(block, /request\.resource\.data\.date == resource\.data\.date/);
    assert.match(block, /request\.resource\.data\.used >= resource\.data\.used/);
    assert.match(block, /request\.resource\.data\.used == 0/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Wave 13 E4 — rules와 클라이언트는 **같은 커밋에서** 넓힌다.
//   아래 계약들은 rules 텍스트를 클라이언트의 **실제 런타임 페이로드에서 도출해**
//   맞춘다 — 두 리터럴 목록을 각자 손으로 적어두고 "같기를 바라는" 형태를 피한다.
//
//   **W14-F3에서 역할이 좁아졌다.** 이 블록은 이제 "rules가 실제로 무엇을 허용/거부하는가"를
//   주장하지 않는다 — 그건 `tests/firestore-rules-semantics.test.js`가 에뮬레이터에서
//   실행으로 본다(쿼터 지점은 `TokenQuotaManager.syncToFirestore`를 그대로 태운다).
//   여기 남는 것은 **텍스트 수준의 커플링**뿐이다: 키 집합이 페이로드에서 도출되는가,
//   `50` 리터럴이 `BALANCE.DAILY_AI_LIMIT`와 같은가, 단조 절이 모든 카운터에 걸렸는가,
//   create/update가 같은 모양 함수를 부르는가. 이것들은 의미 테스트가 잡지 못하는 종류다
//   (예: 단조 절을 한 카운터에서 빼도 그 카운터를 되감는 케이스를 안 쓰면 초록이다).
//   배포는 `deploy.yml`의 `deploy-rules` job이 담당한다(Wave 20 L2 — hosting job은
//   삭제됐고, 웹 배포는 Cloudflare Pages가 별도로 담당한다).
// ─────────────────────────────────────────────────────────────────────────────

test('rules의 키 집합은 클라이언트 페이로드에서 도출된다 — 한쪽만 넓히면 여기가 깨진다', async () => {
    const block = await readQuotaRulesBlock();
    const [payload] = await capturePayloads({
        date: new Date().toDateString(), used: 5, outcomes: { adopted: 2, 'proxy-rejected': 1 },
    });
    const payloadKeys = Object.keys(payload).sort();

    // hasOnly = 클라이언트가 실제로 보내는 키 집합과 **정확히** 같아야 한다.
    // (클라이언트만 넓히면 모든 쓰기가 거부되고, catch가 console.warn이라 조용히 죽는다.)
    assert.deepEqual(parseKeyList(block, 'hasOnly').sort(), payloadKeys);
    assert.deepEqual(payloadKeys, SETTLEMENT_PAYLOAD_KEYS);

    // hasAll(필수)은 그 **부분집합**이고 4키 그대로다 — 정산 키를 필수로 만들면
    // 이미 설치된 구버전 클라이언트(4키만 아는 Capacitor 앱)의 쓰기가 전부 거부된다.
    const required = parseKeyList(block, 'hasAll').sort();
    assert.deepEqual(required, LEGACY_PAYLOAD_KEYS);
    for (const key of required) {
        assert.ok(payloadKeys.includes(key), `${key}: 클라이언트가 항상 보내는 키여야 한다`);
    }
});

test('단조성은 rules에서 모든 카운터 키에 걸린다 — 페이로드에만 카운터를 늘리면 깨진다', async () => {
    const block = squash(await readQuotaRulesBlock());
    const [payload] = await capturePayloads({
        date: new Date().toDateString(), used: 5, outcomes: { adopted: 2, 'proxy-rejected': 1 },
    });
    // 카운터 = 페이로드의 수치 필드에서 상한(limit)을 뺀 것.
    const counters = Object.keys(payload)
        .filter((key) => typeof payload[key] === 'number' && key !== 'limit')
        .sort();
    assert.deepEqual(counters, ['adopted', 'unadopted', 'used']);

    for (const key of counters) {
        // 필수 키는 직접 접근, 선택 키는 `tally(data, key)`(없으면 0)로 읽힌다.
        const forms = [
            { now: `request.resource.data.${key}`, was: `resource.data.${key}` },
            { now: `tally(request.resource.data, '${key}')`, was: `tally(resource.data, '${key}')` },
        ];
        assert.ok(
            forms.some((form) => block.includes(squash(`${form.now} >= ${form.was}`))),
            `${key}: 같은 날짜면 감소 불가(>= 이전 값) 단언이 rules에 있어야 한다`,
        );
        assert.ok(
            forms.some((form) => block.includes(squash(`${form.now} == 0`))),
            `${key}: 날짜가 바뀌면 0으로 리셋되는 단언이 rules에 있어야 한다`,
        );
    }
});

test('정산 카운터는 리터럴이 아니라 used에 묶인다 — 50 커플링 표면이 넓어지지 않는다', async () => {
    const block = await readQuotaRulesBlock();
    const code = block.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

    // rules에 박힌 50 두 개는 BALANCE.DAILY_AI_LIMIT의 사본이다.
    const usedCap = code.match(/data\.used <= (\d+)/);
    const limitPin = code.match(/data\.limit == (\d+)/);
    assert.ok(usedCap && limitPin, 'used 상한과 limit 고정이 rules에 있어야 한다');
    assert.equal(Number(usedCap[1]), BALANCE.DAILY_AI_LIMIT);
    assert.equal(Number(limitPin[1]), BALANCE.DAILY_AI_LIMIT);

    // 정산 합계는 used에 **상대적으로** 묶인다 — 새 리터럴 상한을 만들지 않는다.
    assert.ok(
        squash(code).includes(squash("tally(data, 'adopted') + tally(data, 'unadopted') <= data.used")),
        'adopted + unadopted <= used 가 rules에 있어야 한다(= unsettled >= 0 보장)',
    );
    const literals = code.match(new RegExp(`\\b${BALANCE.DAILY_AI_LIMIT}\\b`, 'g')) || [];
    assert.equal(literals.length, 2, `DAILY_AI_LIMIT 리터럴은 rules에 2곳뿐이다(실제 ${literals.length})`);
});

test('create와 update는 같은 모양 검증을 부른다 — 복제된 rules는 드리프트를 검증할 방법이 없다', async () => {
    const block = squash(await readQuotaRulesBlock());
    assert.ok(block.includes(squash('allow create: if isSelf(uid) && quotaShapeOk(request.resource.data)')),
        'create가 공용 모양 검증을 부른다');
    assert.ok(block.includes(squash('allow update: if isSelf(uid) && quotaShapeOk(request.resource.data)')),
        'update가 같은 공용 모양 검증을 부른다');
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

const MIRROR_TABLE = [
    // 라벨, 로컬 레코드, 기대 페이로드(used/adopted/unadopted)
    ['정상 — 채택 2 + 미채택 3', { used: 5, outcomes: { adopted: 2, 'recent-duplicate': 3 } }, { used: 5, adopted: 2, unadopted: 3 }],
    ['미정산 포함 — 9 중 3만 정산됨', { used: 9, outcomes: { adopted: 3 } }, { used: 9, adopted: 3, unadopted: 0 }],
    ['구형 레코드(outcomes 없음)', { used: 4 }, { used: 4, adopted: 0, unadopted: 0 }],
    // 파손: 정산이 디스패치보다 많다. 클램프하지 않으면 rules의
    // `adopted + unadopted <= used`에 걸려 그 유저의 미러링이 날짜가 바뀔 때까지 전부 거부된다.
    ['파손 — 정산 > 디스패치', { used: 1, outcomes: { adopted: 4, 'proxy-rejected': 4 } }, { used: 1, adopted: 1, unadopted: 0 }],
    ['파손 — 디스패치 0인데 정산만 있음', { used: 0, outcomes: { adopted: 3 } }, { used: 0, adopted: 0, unadopted: 0 }],
];

test(`Firestore 페이로드는 원장의 미러다 — ${MIRROR_TABLE.length}행, 전부 rules 불변식을 만족한다`, async () => {
    const today = new Date().toDateString();
    for (const [label, record, expected] of MIRROR_TABLE) {
        const [payload] = await capturePayloads({ date: today, ...record });
        assert.deepEqual(Object.keys(payload).sort(), SETTLEMENT_PAYLOAD_KEYS, `${label}: 키`);
        assert.equal(payload.used, expected.used, `${label}: used(디스패치)`);
        assert.equal(payload.adopted, expected.adopted, `${label}: adopted`);
        assert.equal(payload.unadopted, expected.unadopted, `${label}: unadopted`);
        // rules가 강제하는 모양 — 이걸 어기면 쓰기가 거부되고 조용히 죽는다.
        assert.ok(payload.adopted >= 0 && payload.unadopted >= 0, `${label}: 음수 없음`);
        assert.ok(payload.adopted + payload.unadopted <= payload.used, `${label}: adopted + unadopted <= used`);
        assert.ok(payload.used <= BALANCE.DAILY_AI_LIMIT, `${label}: used <= 한도`);
        assert.ok(Number.isSafeInteger(payload.used) && Number.isSafeInteger(payload.adopted)
            && Number.isSafeInteger(payload.unadopted), `${label}: is int`);
        // `unsettled`는 싣지 않는다 — 감소하는 값이라 단조 규칙을 걸 수 없다. 소비자가 도출한다.
        assert.equal(payload.unsettled, undefined, `${label}: unsettled는 클라우드로 안 간다`);
        assert.equal(payload.outcomes, undefined, `${label}: byOutcome도 안 간다`);
    }
});

test('rules 거부(배포 창)는 4키로 접고 used 미러링을 살린다 — 상태를 안 들고 있어 저절로 낫는다', async () => {
    const record = { date: new Date().toDateString(), used: 6, outcomes: { adopted: 2, 'malformed-response': 4 } };
    let payloads = [];
    const warnings = await captureWarnings(async () => {
        payloads = await capturePayloads(record, {
            onSetDoc: (args) => {
                // 구버전 rules가 아직 살아 있는 창: 넓힌 키가 있으면 거부한다.
                if ('adopted' in args[1]) throw rulesRejection();
                return undefined;
            },
        });
    });

    assert.equal(payloads.length, 2, '거부되면 같은 호출 안에서 딱 한 번 접는다');
    assert.deepEqual(Object.keys(payloads[0]).sort(), SETTLEMENT_PAYLOAD_KEYS);
    assert.deepEqual(Object.keys(payloads[1]).sort(), LEGACY_PAYLOAD_KEYS);
    assert.equal(payloads[1].used, 6, '정산은 못 올려도 비용(used)은 계속 올라간다');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /firestore\.rules/, '원인을 지목하는 경고여야 한다(일반 실패 문구가 아니라)');

    // 세션 플래그가 없다 — rules가 올라간 순간 다음 동기화가 다시 6키로 간다.
    const next = await capturePayloads(record);
    assert.equal(next.length, 1);
    assert.deepEqual(Object.keys(next[0]).sort(), SETTLEMENT_PAYLOAD_KEYS);
});

test('rules 거부가 아닌 실패는 접지 않는다 — 폴백은 permission-denied에만 반응한다', async () => {
    let payloads = [];
    const warnings = await captureWarnings(async () => {
        payloads = await capturePayloads({ date: new Date().toDateString(), used: 3 }, {
            onSetDoc: () => { throw new Error('network unavailable'); },
        });
    });
    assert.equal(payloads.length, 1, '네트워크 실패에 재시도를 만들지 않는다');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Quota sync failed/);
});

test('접은 4키 쓰기마저 실패해도 비블로킹이다', async () => {
    let payloads = [];
    const warnings = await captureWarnings(async () => {
        await assert.doesNotReject(async () => {
            payloads = await capturePayloads({ date: new Date().toDateString(), used: 2, outcomes: { adopted: 1 } }, {
                onSetDoc: (args) => {
                    if ('adopted' in args[1]) throw rulesRejection();
                    throw new Error('network unavailable');
                },
            });
        });
    });
    assert.equal(payloads.length, 2);
    assert.equal(warnings.length, 2, 'rules 지목 1 + 최종 실패 1');
    assert.match(warnings[1], /Quota sync failed/);
});

test('원장을 못 읽으면 쓰기를 만들지 않는다 — 파생치 실패가 예외로 번지지 않는다', async () => {
    let writes = 0;
    const operations = makeOperations({ onSetDoc: () => { writes += 1; } });
    // localStorage 자체가 없는 런타임(getCallLedger → null).
    await assert.doesNotReject(() => TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations));
    assert.equal(writes, 0);

    // 레코드가 파손된 경우(JSON 파싱 실패)도 같다.
    await withLocalStorage(makeLocalStorageStub({ [TokenQuotaManager.QUOTA_KEY]: '{not json' }), async () => {
        await assert.doesNotReject(() => TokenQuotaManager.syncToFirestore('user-123', { firestore: true }, operations));
    });
    assert.equal(writes, 0);
});

test('TokenQuotaManager production contract keeps firebase doc/setDoc/serverTimestamp defaults and two required arguments', async () => {
    const source = await readFile(new URL('../src/systems/TokenQuotaManager.ts', import.meta.url), 'utf8');

    assert.match(source, /import \{ setDoc, doc, serverTimestamp \} from 'firebase\/firestore'/);
    assert.match(source, /syncToFirestore\(uid: string, db: Firestore \| null, firestoreOperations/);
    assert.match(source, /firestoreOperations\.doc \|\| doc/);
    assert.match(source, /firestoreOperations\.setDoc \|\| setDoc/);
    assert.match(source, /firestoreOperations\.serverTimestamp \|\| serverTimestamp/);
});
