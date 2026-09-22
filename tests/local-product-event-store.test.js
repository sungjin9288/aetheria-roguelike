import assert from 'node:assert/strict';
import test from 'node:test';
import {
    appendProductEvent, readProductEvents, clearProductEvents,
    PRODUCT_EVENT_STORAGE_KEY, PRODUCT_EVENT_LIMIT, PRODUCT_EVENT_MAX_BYTES, didProductEventWriteFail,
} from '../src/platform/localProductEventStore.ts';

const event = (i = 0) => ({ name: 'boot', releaseId: 'qa-release', runtime: 'web', os: 'web',
    sessionId: `session:${i}`, job: 'unknown', levelBand: '1-4', elapsedBucket: '0-10s', outcome: 'ready' });
const memory = () => {
    const values = new Map();
    return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
};

test('local ring retains newest bounded events and never exports extra fields', () => {
    const storage = memory();
    for (let i = 0; i < PRODUCT_EVENT_LIMIT + 3; i++) {
        assert.equal(appendProductEvent({ ...event(i), nickname: 'PRIVATE', token: 'PRIVATE' }, storage), true);
    }
    const result = readProductEvents(storage);
    assert.equal(result.status, 'ready');
    assert.equal(result.events.length, PRODUCT_EVENT_LIMIT);
    assert.deepEqual(result.events[0], event(3));
    assert.deepEqual(result.events.at(-1), event(PRODUCT_EVENT_LIMIT + 2));
    assert.doesNotMatch(storage.getItem(PRODUCT_EVENT_STORAGE_KEY), /PRIVATE|nickname|token/);
    assert.ok(new TextEncoder().encode(storage.getItem(PRODUCT_EVENT_STORAGE_KEY)).length <= PRODUCT_EVENT_MAX_BYTES);
});

test('reading untrusted storage projects fields and rejects invalid schema values', () => {
    const storage = memory();
    const invalid = [
        { name: '__proto__' }, { outcome: 'private text' }, { releaseId: 'local' },
        { sessionId: 'secret/email@host' }, { runtime: 'bad' }, { os: 'bad' },
        { job: 'private name' }, { levelBand: '1234' }, { elapsedBucket: '1234' },
    ].map((patch) => ({ ...event(), ...patch }));
    storage.setItem(PRODUCT_EVENT_STORAGE_KEY, JSON.stringify({ version: 1, events: [{ ...event(), rawSave: 'PRIVATE' }, ...invalid] }));
    assert.deepEqual(readProductEvents(storage).events, [event()]);
    for (const value of invalid) assert.equal(appendProductEvent(value, storage), false);
});

test('corrupt, wrong-version and oversized storage cannot reach export', () => {
    const storage = memory();
    for (const raw of ['{', '{}', JSON.stringify({ version: 2, events: [event()] }), ' '.repeat(PRODUCT_EVENT_MAX_BYTES + 1)]) {
        storage.setItem(PRODUCT_EVENT_STORAGE_KEY, raw);
        assert.deepEqual(readProductEvents(storage), { status: 'invalid', events: [] });
    }
    assert.equal(clearProductEvents(storage), true);
    assert.deepEqual(readProductEvents(storage), { status: 'ready', events: [] });
});

test('storage failures stay observable and do not erase unrelated game storage', () => {
    const storage = memory();
    storage.setItem('game-save', 'keep');
    appendProductEvent(event(), storage);
    assert.equal(clearProductEvents(storage), true);
    assert.equal(storage.getItem('game-save'), 'keep');
    const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('denied'); } };
    assert.deepEqual(readProductEvents(denied), { status: 'unavailable', events: [] });
    assert.equal(appendProductEvent(event(), denied), false);
    assert.equal(appendProductEvent(event(), { ...storage, setItem: denied.setItem }), false);
    assert.equal(clearProductEvents(denied), false);
    assert.equal(clearProductEvents(null), false);
});

test('array values cannot masquerade as scalar enum fields', () => {
    for (const field of ['runtime', 'os', 'levelBand', 'elapsedBucket']) {
        assert.equal(appendProductEvent({ ...event(), [field]: [event()[field]] }, memory()), false);
    }
});


test('AI 사유는 7필드로 제한하고 제품 이벤트와 같은 용량을 공유한다', () => {
    const storage = memory();
    const { releaseId, runtime, os, sessionId } = event();
    const fallback = { name: 'ai_fallback', releaseId, runtime, os, sessionId, requestKind: 'event', reason: 'quota' };
    assert.equal(appendProductEvent({ ...fallback, uid: 'PRIVATE' }, storage), true);
    assert.deepEqual(readProductEvents(storage).events, [fallback]);
    assert.equal(appendProductEvent({ ...fallback, reason: 'PRIVATE' }, storage), false);
    assert.equal(appendProductEvent({ ...fallback, requestKind: 'PRIVATE' }, storage), false);
    for (let i = 0; i < PRODUCT_EVENT_LIMIT; i++) appendProductEvent(event(i), storage);
    assert.equal(readProductEvents(storage).events.length, PRODUCT_EVENT_LIMIT);
    assert.equal(readProductEvents(storage).events[0].name, 'boot');
});

test('최근 쓰기 실패는 성공 쓰기 전까지 관측할 수 있다', () => {
    const storage = memory();
    appendProductEvent(event(), storage);
    assert.equal(didProductEventWriteFail(), false);
    appendProductEvent(event(), { ...storage, setItem() { throw Error('quota'); } });
    assert.equal(readProductEvents(storage).status, 'ready');
    assert.equal(didProductEventWriteFail(), true);
    appendProductEvent(event(), storage);
    assert.equal(didProductEventWriteFail(), false);
});
