import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BALANCE } from '../src/data/constants.js';
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

test('TokenQuotaManager production contract keeps firebase doc/setDoc/serverTimestamp defaults and two required arguments', async () => {
    const source = await readFile(new URL('../src/systems/TokenQuotaManager.ts', import.meta.url), 'utf8');

    assert.match(source, /import \{ setDoc, doc, serverTimestamp \} from 'firebase\/firestore'/);
    assert.match(source, /syncToFirestore\(uid: string, db: Firestore \| null, firestoreOperations/);
    assert.match(source, /firestoreOperations\.doc \|\| doc/);
    assert.match(source, /firestoreOperations\.setDoc \|\| setDoc/);
    assert.match(source, /firestoreOperations\.serverTimestamp \|\| serverTimestamp/);
});
