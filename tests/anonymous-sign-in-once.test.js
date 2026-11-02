import test from 'node:test';
import assert from 'node:assert/strict';

import { signInAnonymouslyOnce } from '../src/platform/anonymousSignIn.ts';

/**
 * 2026-11 출시 전 점검: 개발 모드 StrictMode가 부트 이펙트를 두 번 돌려 익명 사용자가 둘 생겼고, 앱 uid와 `auth.currentUser`가
 * 달라 자기 문서 읽기 · 쓰기가 모두 거부됐다. 한 Auth에는 익명 로그인 요청이 하나만 나간다.
 */
const makeAuth = () => ({ currentUser: null });
const makeSignIn = (uids) => {
    let calls = 0;
    const signIn = (auth) => {
        const uid = uids[calls++];
        return Promise.resolve().then(() => {
            auth.currentUser = { uid };
            return { user: { uid } };
        });
    };
    return { signIn, calls: () => calls };
};

test('동시에 두 번 부트해도 익명 로그인은 한 번이고 같은 uid를 받는다', async () => {
    const auth = makeAuth();
    const { signIn, calls } = makeSignIn(['first', 'second']);
    const [a, b] = await Promise.all([signInAnonymouslyOnce(auth, signIn), signInAnonymouslyOnce(auth, signIn)]);
    assert.equal(calls(), 1);
    assert.equal(a, 'first');
    assert.equal(b, 'first');
    assert.equal(auth.currentUser.uid, a, '앱 uid가 실제 로그인한 사용자다');
});

test('이미 로그인한 사용자가 있으면 새로 만들지 않는다', async () => {
    const auth = { currentUser: { uid: 'existing' } };
    const { signIn, calls } = makeSignIn(['new']);
    assert.equal(await signInAnonymouslyOnce(auth, signIn), 'existing');
    assert.equal(calls(), 0);
});

test('실패하면 다음 부트가 다시 시도한다', async () => {
    const auth = makeAuth();
    let calls = 0;
    const failing = () => { calls += 1; return Promise.reject(new Error('network')); };
    await assert.rejects(signInAnonymouslyOnce(auth, failing));
    await assert.rejects(signInAnonymouslyOnce(auth, failing));
    assert.equal(calls, 2);
});
