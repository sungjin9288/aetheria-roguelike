// Cloudflare Pages Functions 버전 (api/feedback-validate.js에서 포팅, 2026-07)
// 파일 기반 라우팅: functions/api/feedback-validate.js → /api/feedback-validate
//
// 2026-07 재작성: 원본(Vercel 시절 포함)은 firebase-admin을 import했지만
// 이 패키지는 package.json에 존재한 적이 없어 배포 시 처음부터 동작 불가였고,
// Cloudflare Workers 런타임에서는 firebase-admin(Node 전용)이 어차피 실행 불가.
// ai-proxy.js와 동일한 구성으로 교체:
//   - 인증: Firebase REST 검증 (identitytoolkit accounts:lookup) — 종전에는 토큰
//     검증 없이 클라이언트가 보낸 userId를 그대로 신뢰하던 보안 공백도 함께 해소.
//     userId는 이제 검증된 토큰의 uid에서 유도한다.
//   - 레이트리밋: isolate당 인메모리 Map (ai-proxy와 동일 한계 — 주석 참조).
//   - 저장: Firestore REST API에 사용자 본인 ID 토큰으로 기록 (admin 권한 불필요,
//     보안 규칙은 클라이언트 직접 쓰기와 동일하게 적용됨).

const RATE_LIMIT_MS = 60000; // 1 feedback per 60 seconds per user
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;

// Simple spam patterns
const SPAM_PATTERNS = [
    /https?:\/\//i,           // URLs
    /\b(buy|sell|cheap|free|click|subscribe)\b/i,
    /(.)\1{5,}/,              // Repeated characters
];

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const jsonResponse = (body, status) => {
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(body), { status, headers });
};

// 인메모리 레이트리밋 — isolate 생명주기 동안만 유지 (ai-proxy.js와 동일 한계:
// isolate가 재활용되지 않으면 리셋될 수 있으나, 스팸 방지 목적에는 충분).
const rateLimitMap = new Map();
const checkRateLimit = (uid) => {
    const now = Date.now();
    const last = rateLimitMap.get(uid) || 0;
    if (now - last < RATE_LIMIT_MS) return false;
    rateLimitMap.set(uid, now);
    return true;
};

// Firebase ID 토큰 REST 검증 — functions/api/ai-proxy.js의 verifyFirebaseToken과
// 동일 로직 (Pages Functions 파일 간 공유 모듈 없이 의도적 소량 중복).
const verifyFirebaseToken = async (idToken, env) => {
    const firebaseApiKey = env.FIREBASE_WEB_API_KEY;
    if (!firebaseApiKey) {
        throw new Error('Missing FIREBASE_WEB_API_KEY environment variable');
    }

    const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const user = data?.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId };
};

const parseBearerToken = (request) => {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice('Bearer '.length).trim() || null;
};

// Firestore REST 쓰기 — 클라이언트 SDK와 동일 경로(artifacts/{APP_ID}/public/data/feedback)에
// 사용자 본인 토큰으로 기록. admin 권한이 아니므로 Firestore 보안 규칙이 그대로 적용된다.
const APP_ID = 'aetheria-rpg'; // src/data/constants.ts APP_ID와 동일 값 (functions는 src 미참조)
const storeFeedback = async (env, idToken, { uid, content, type }) => {
    const projectId = env.FIREBASE_PROJECT_ID;
    if (!projectId) {
        throw new Error('Missing FIREBASE_PROJECT_ID environment variable');
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/${APP_ID}/public/data/feedback`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            fields: {
                userId: { stringValue: uid },
                content: { stringValue: content.trim() },
                type: { stringValue: type || 'general' },
                createdAt: { timestampValue: new Date().toISOString() },
                validated: { booleanValue: true },
            }
        })
    });
    return response.ok;
};

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        // 인증 — 토큰 없는 요청은 컨텐츠 검증 전에 차단 (ai-proxy와 동일 순서)
        const idToken = parseBearerToken(request);
        if (!idToken) {
            return jsonResponse({ error: 'Unauthorized: missing bearer token' }, 401);
        }

        let authUser;
        try {
            authUser = await verifyFirebaseToken(idToken, env);
        } catch (error) {
            console.error('Auth config error:', error.message);
            return jsonResponse({ error: 'Auth provider is not configured' }, 500);
        }
        if (!authUser) {
            return jsonResponse({ error: 'Unauthorized: invalid token' }, 401);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid request body' }, 400);
        }

        const { content, type } = body || {};

        if (!content) {
            return jsonResponse({ error: 'Missing required fields' }, 400);
        }

        // Content length validation
        if (content.length < MIN_CONTENT_LENGTH) {
            return jsonResponse({ error: `피드백은 최소 ${MIN_CONTENT_LENGTH}자 이상이어야 합니다.` }, 400);
        }

        if (content.length > MAX_CONTENT_LENGTH) {
            return jsonResponse({ error: `피드백은 ${MAX_CONTENT_LENGTH}자를 초과할 수 없습니다.` }, 400);
        }

        // Spam pattern check
        for (const pattern of SPAM_PATTERNS) {
            if (pattern.test(content)) {
                return jsonResponse({ error: '유효하지 않은 내용입니다.' }, 400);
            }
        }

        // Rate limiting check (검증된 uid 기준 — 클라이언트 제공 값 신뢰하지 않음)
        if (!checkRateLimit(authUser.uid)) {
            return jsonResponse({ error: '잠시 후 다시 시도해주세요.' }, 429);
        }

        const stored = await storeFeedback(env, idToken, {
            uid: authUser.uid,
            content,
            type,
        });
        if (!stored) {
            return jsonResponse({ error: 'Failed to store feedback' }, 502);
        }

        return jsonResponse({ success: true, message: '피드백이 제출되었습니다.' }, 200);

    } catch (error) {
        console.error('Feedback validation error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500);
    }
}

// CORS preflight
export async function onRequestOptions() {
    return new Response(null, { status: 200, headers: new Headers(CORS_HEADERS) });
}

// 그 외 메서드 (GET/PUT/DELETE 등) → 405
export async function onRequest(context) {
    const { request } = context;
    if (request.method === 'POST') return onRequestPost(context);
    if (request.method === 'OPTIONS') return onRequestOptions();
    return jsonResponse({ error: 'Method not allowed' }, 405);
}
