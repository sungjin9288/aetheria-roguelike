import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as aiProxy from '../functions/api/ai-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

test('hosting: Cloudflare is the only active web function surface', () => {
    assert.equal(existsSync(path.join(repoRoot, 'vercel.json')), false);
    assert.equal(existsSync(path.join(repoRoot, 'api', 'ai-proxy.js')), false);
    assert.equal(existsSync(path.join(repoRoot, 'api', 'feedback-validate.js')), false);

    // Wave 21 M1 — `functions/api/feedback-validate.js`는 삭제됐다(부재 불변식).
    // 피드백 쓰기는 `SystemTab.tsx`가 `addDoc`으로 직접 하고 검증은 firestore.rules가
    // 소유한다 — 클라이언트 참조가 0인 함수는 배포되면 공격 표면일 뿐이다.
    assert.equal(existsSync(path.join(repoRoot, 'functions', 'api', 'feedback-validate.js')), false);

    const packageJson = readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
    const workflow = readFileSync(path.join(repoRoot, '.github', 'workflows', 'deploy.yml'), 'utf8');

    assert.doesNotMatch(packageJson, /\bvercel\b/i);
    assert.doesNotMatch(workflow, /\bvercel\b/i);

    // Wave 20 L2 — Firebase Hosting job(deploy-dev/deploy-prod)은 삭제됐다. 실제
    // 프로덕션 웹 호스트는 Cloudflare Pages뿐이라는 이 계약의 제목을 워크플로/설정
    // 수준에서도 고정한다: `deploy.yml`은 hosting 배포 액션을 다시 부르지 않고,
    // `firebase.json`은 `hosting` 키를 다시 갖지 않는다(둘 다 부재 불변식 — 식별자
    // 매칭이라 워크플로 포맷 변경에는 안 걸리고 되돌리기에만 걸린다).
    assert.doesNotMatch(workflow, /\baction-hosting-deploy\b/);

    const firebaseJson = JSON.parse(readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
    assert.equal('hosting' in firebaseJson, false);
});

// Cloudflare Pages Functions의 handler contract(onRequestPost/onRequestOptions 존재,
// Web Request/Response 사용,
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

// ── Wave 21 M1: AI 프록시 입력 상한 ─────────────────────────────────────────
// 익명 인증 토큰은 방문자 누구나 받으므로, 인증을 통과한 요청이 "건당 얼마나 큰 입력을
// Gemini에 태울 수 있는가"가 남아 있던 유일한 비용 축이다 — 서버의 유일한 한도인
// 40req/60s 레이트리밋은 건당 크기를 보지 않고, 클라이언트의 일일 미터(TokenQuotaManager)는
// 브라우저 안에 있다. 아래 네 건은 실제 `onRequestPost`를 호출하고 fetch를 스텁해
// (a) Gemini 호출이 일어났는지 (b) 실제로 전송된 프롬프트 길이가 얼마인지를 관측한다.

const GEMINI_HOST = 'generativelanguage.googleapis.com';
const PROXY_ENV = { FIREBASE_WEB_API_KEY: 'test-key', GEMINI_API_KEY: 'test-key' };
const EVENT_GEMINI_JSON = {
    desc: '낡은 제단이 희미하게 빛난다.',
    choices: ['조사한다', '지나친다'],
    outcomes: [
        { choiceIndex: 0, log: '작은 보석을 발견했다.', gold: 10 },
        { choiceIndex: 1, log: '아무 일도 없었다.', gold: 0 }
    ]
};

const runProxy = async ({ body, uid = 'uid-clamp', geminiStatus = 200, geminiErrorText = '', geminiJson = EVENT_GEMINI_JSON }) => {
    const seen = { geminiCalls: 0, prompt: null };
    const response = await withMockedFetch(
        async (url, init) => {
            const urlStr = String(url);
            if (urlStr.includes('identitytoolkit.googleapis.com')) {
                return new Response(JSON.stringify({ users: [{ localId: uid }] }), { status: 200 });
            }
            if (urlStr.includes(GEMINI_HOST)) {
                seen.geminiCalls += 1;
                seen.prompt = JSON.parse(init.body).contents[0].parts[0].text;
                if (geminiStatus !== 200) {
                    return new Response(geminiErrorText, { status: geminiStatus });
                }
                return new Response(JSON.stringify({
                    candidates: [{ content: { parts: [{ text: JSON.stringify(geminiJson) }] } }]
                }), { status: 200 });
            }
            throw new Error(`Unexpected fetch call: ${urlStr}`);
        },
        async () => aiProxy.onRequestPost({
            request: makeRequest({ headers: { authorization: 'Bearer valid-token' }, body }),
            env: PROXY_ENV
        })
    );
    return { response, ...seen, bodyBytes: Buffer.byteLength(JSON.stringify(body), 'utf8') };
};

test('ai-proxy: 1MB 본문은 413이고 Gemini fetch는 0건 (Wave 21 M1)', async () => {
    const oversized = 'A'.repeat(1_000_000);
    const { response, geminiCalls, bodyBytes } = await runProxy({
        uid: 'uid-oversized',
        body: {
            type: 'event',
            data: {
                location: '고요한 숲',
                history: [],
                playerSnapshot: { name: oversized, job: '모험가', level: 3 },
                mapSnapshot: {}
            }
        }
    });

    assert.ok(bodyBytes > 1_000_000, `본문이 실제로 1MB를 넘어야 한다 (실측 ${bodyBytes}B)`);
    // 판별자는 상태 코드가 아니라 fetch 카운터다 — 비용(= 일일 쿼터가 세는 대상)은
    // Gemini 호출에서만 발생하므로, 0건이면 쿼터도 무관하다.
    assert.equal(geminiCalls, 0, '상한을 넘은 본문은 Gemini에 전달되지 않는다');
    assert.equal(response.status, 413);
    const json = await response.json();
    assert.equal(json.success, undefined);
});

test('ai-proxy: 상한 안의 본문이라도 보간 문자열은 잘린다 (Wave 21 M1)', async () => {
    const name = 'A'.repeat(5_000);
    const { response, geminiCalls, prompt, bodyBytes } = await runProxy({
        uid: 'uid-clamp-fields',
        body: {
            type: 'event',
            data: {
                location: '고요한 숲',
                history: [],
                playerSnapshot: {
                    name,
                    job: '모험가',
                    level: 3,
                    relics: Array.from({ length: 50 }, () => ({ name: 'R'.repeat(100) })),
                    buildProfile: Array.from({ length: 50 }, () => 'B'.repeat(100))
                },
                mapSnapshot: {}
            }
        }
    });

    assert.ok(bodyBytes < 16_384, `본문 상한 안이어야 한다 (실측 ${bodyBytes}B)`);
    assert.equal(response.status, 200);
    assert.equal(geminiCalls, 1);
    assert.ok(prompt.length < 2_500, `프롬프트 길이 ${prompt.length}자`);
    // 33번째 문자부터는 프롬프트에 없다(= name은 32자에서 잘린다).
    assert.ok(!prompt.includes(name.slice(32)), 'name의 33번째 문자 이후가 프롬프트에 없다');
    assert.ok(prompt.includes('A'.repeat(32)), 'name의 앞 32자는 남는다');
    assert.ok(!prompt.includes('A'.repeat(33)), 'name은 정확히 32자에서 잘린다');
    assert.ok(!prompt.includes('R'.repeat(25)), '유물 이름은 24자에서 잘린다');
    assert.ok(!prompt.includes('B'.repeat(25)), '빌드 태그는 24자에서 잘린다');
});

test('ai-proxy: story 경로의 context도 잘린다 (Wave 21 M1)', async () => {
    const context = 'C'.repeat(5_000);
    const { response, geminiCalls, prompt } = await runProxy({
        uid: 'uid-clamp-story',
        geminiJson: { narrative: '바람이 불었다.' },
        body: {
            type: 'story',
            data: { storyType: 'victory', context, history: [], playerSnapshot: {} }
        }
    });

    assert.equal(response.status, 200);
    assert.equal(geminiCalls, 1);
    assert.ok(prompt.length < 1_500, `프롬프트 길이 ${prompt.length}자`);
    assert.ok(!prompt.includes('C'.repeat(301)), 'context는 300자에서 잘린다');
});

test('ai-proxy: Gemini 5xx는 500으로 접히고 상류 오류 본문을 노출하지 않는다 (Wave 21 M1)', async () => {
    const upstreamSecret = 'API key AIzaSyUPSTREAM-LEAK invalid for project 12345';
    const { response } = await runProxy({
        uid: 'uid-upstream-5xx',
        geminiStatus: 503,
        geminiErrorText: upstreamSecret,
        body: {
            type: 'event',
            data: { location: '고요한 숲', history: [], playerSnapshot: { name: '용사' }, mapSnapshot: {} }
        }
    });

    assert.equal(response.status, 500);
    const raw = await response.text();
    assert.ok(!raw.includes('AIzaSy'), '상류 오류 원문이 클라이언트로 새지 않는다');
    const json = JSON.parse(raw);
    assert.equal('details' in json, false, '500 응답에 details 키가 없다');
    assert.equal(json.error, 'Internal server error');
});
