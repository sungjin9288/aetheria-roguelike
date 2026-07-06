import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as aiProxy from '../functions/api/ai-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vercel(api/*.js)에서 Cloudflare Pages Functions(functions/api/*.js)로 포팅한 뒤
// 시그니처 변환(onRequestPost/onRequestOptions 존재, Web Request/Response 사용,
// context.env 바인딩)이 실제로 성립하는지 검증하는 스모크 테스트.
// 실 Gemini/Firebase 호출은 하지 않는다 (fetch를 mock으로 대체).

const withMockedFetch = async (impl, run) => {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    try {
        return await run();
    } finally {
        globalThis.fetch = original;
    }
};

const makeRequest = ({ method = 'POST', headers = {}, body } = {}) => {
    const init = { method, headers };
    if (body !== undefined) {
        init.body = JSON.stringify(body);
        init.headers = { 'Content-Type': 'application/json', ...headers };
    }
    return new Request('https://example.pages.dev/api/ai-proxy', init);
};

test('ai-proxy: onRequestPost / onRequestOptions / onRequest are exported', () => {
    assert.equal(typeof aiProxy.onRequestPost, 'function');
    assert.equal(typeof aiProxy.onRequestOptions, 'function');
    assert.equal(typeof aiProxy.onRequest, 'function');
});

test('ai-proxy: OPTIONS preflight returns 200 with CORS headers', async () => {
    const request = makeRequest({ method: 'OPTIONS', headers: { origin: 'https://example.com' } });
    const response = await aiProxy.onRequestOptions({ request, env: {} });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.com');
});

test('ai-proxy: missing bearer token returns 401', async () => {
    const request = makeRequest({ body: { type: 'event', data: {} } });
    const response = await aiProxy.onRequestPost({
        request,
        env: { FIREBASE_WEB_API_KEY: 'unused', GEMINI_API_KEY: 'unused' }
    });

    assert.equal(response.status, 401);
    const json = await response.json();
    assert.match(json.error, /missing bearer token/);
});

test('ai-proxy: invalid Firebase token returns 401 (auth verified via mocked fetch)', async () => {
    await withMockedFetch(
        async (url) => {
            assert.match(String(url), /identitytoolkit\.googleapis\.com/);
            return new Response(JSON.stringify({ users: [] }), { status: 200 });
        },
        async () => {
            const request = makeRequest({
                headers: { authorization: 'Bearer fake-token' },
                body: { type: 'event', data: {} }
            });
            const response = await aiProxy.onRequestPost({
                request,
                env: { FIREBASE_WEB_API_KEY: 'test-key', GEMINI_API_KEY: 'test-key' }
            });

            assert.equal(response.status, 401);
            const json = await response.json();
            assert.match(json.error, /invalid token/);
        }
    );
});

test('ai-proxy: valid token + Gemini success returns normalized event (200)', async () => {
    await withMockedFetch(
        async (url) => {
            const urlStr = String(url);
            if (urlStr.includes('identitytoolkit.googleapis.com')) {
                return new Response(JSON.stringify({ users: [{ localId: 'uid-123', email: 'a@b.com' }] }), { status: 200 });
            }
            if (urlStr.includes('generativelanguage.googleapis.com')) {
                const geminiPayload = {
                    desc: '고대 유적에서 신비로운 빛이 새어나온다.',
                    choices: ['조사한다', '무시하고 지나간다'],
                    outcomes: [
                        { choiceIndex: 0, log: '작은 보석을 발견했다.', gold: 10 },
                        { choiceIndex: 1, log: '아무 일도 없었다.', gold: 0 }
                    ]
                };
                return new Response(JSON.stringify({
                    candidates: [{ content: { parts: [{ text: JSON.stringify(geminiPayload) }] } }]
                }), { status: 200 });
            }
            throw new Error(`Unexpected fetch call: ${urlStr}`);
        },
        async () => {
            const request = makeRequest({
                headers: { authorization: 'Bearer valid-token' },
                body: { type: 'event', data: { location: '잊혀진 폐허', playerSnapshot: {} } }
            });
            const response = await aiProxy.onRequestPost({
                request,
                env: { FIREBASE_WEB_API_KEY: 'test-key', GEMINI_API_KEY: 'test-key' }
            });

            assert.equal(response.status, 200);
            const json = await response.json();
            assert.equal(json.success, true);
            assert.equal(json.data.desc, '고대 유적에서 신비로운 빛이 새어나온다.');
            assert.equal(json.data.outcomes.length, 2);
        }
    );
});

test('ai-proxy: onRequest routes GET to 405 Method not allowed', async () => {
    const request = makeRequest({ method: 'GET' });
    const response = await aiProxy.onRequest({ request, env: {} });
    assert.equal(response.status, 405);
});

test('ai-proxy: Origin not in ALLOWED_ORIGINS is rejected with 403', async () => {
    const request = makeRequest({
        headers: { origin: 'https://evil.example', authorization: 'Bearer x' },
        body: { type: 'event', data: {} }
    });
    const response = await aiProxy.onRequestPost({
        request,
        env: { ALLOWED_ORIGINS: 'https://example.com', GEMINI_API_KEY: 'k', FIREBASE_WEB_API_KEY: 'k' }
    });
    assert.equal(response.status, 403);
});

// feedback-validate.js는 firebase-admin(devDependencies에 미포함, 이번 마이그레이션에서도
// 신규 의존성 추가 금지 조건 하에 그대로 유지)을 정적 import 하므로, 패키지가 설치되지
// 않은 환경에서는 동적 import 자체가 실패한다. 이는 Vercel 버전(api/feedback-validate.js)
// 에서도 동일했던 기존 상태로, 이번 포팅이 새로 만든 문제가 아니다.
// 따라서 여기서는 소스 코드 정적 검사로 시그니처 변환(onRequestPost/onRequestOptions export,
// Web Request/Response 사용, context.env 사용)만 확인한다.
test('feedback-validate: source exports Cloudflare Pages Functions handlers', () => {
    const source = readFileSync(
        path.join(__dirname, '..', 'functions', 'api', 'feedback-validate.js'),
        'utf-8'
    );

    assert.match(source, /export async function onRequestPost\(context\)/);
    assert.match(source, /export async function onRequestOptions/);
    assert.match(source, /export async function onRequest\(context\)/);
    assert.match(source, /new Response\(/);
    assert.match(source, /context;/); // { request, env } = context 구조분해 패턴
    assert.doesNotMatch(source, /\breq\.body\b/);
    assert.doesNotMatch(source, /\bres\.status\(/);
});

test('feedback-validate: attempting to import without firebase-admin fails fast (documents known limitation)', async () => {
    await assert.rejects(
        () => import('../functions/api/feedback-validate.js'),
        (error) => {
            assert.match(String(error?.message || error), /firebase-admin/);
            return true;
        }
    );
});
