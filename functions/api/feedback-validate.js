// Cloudflare Pages Functions 버전 (api/feedback-validate.js에서 포팅, 2026-07)
// 파일 기반 라우팅: functions/api/feedback-validate.js → /api/feedback-validate
// Vercel (req,res) 스타일 → Web Request/Response 스타일로 변환.
//
// Serverless Feedback Validation Function
// Handles spam prevention and content validation

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Rate limit: 1 feedback per 60 seconds per user
const RATE_LIMIT_MS = 60000;
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
    'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (body, status) => {
    const headers = new Headers(CORS_HEADERS);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(body), { status, headers });
};

// Firebase Admin은 요청마다 초기화 여부를 확인 (Cloudflare isolate 재사용 시 중복 초기화 방지)
const getDb = (env) => {
    if (!getApps().length) {
        initializeApp({
            projectId: env.FIREBASE_PROJECT_ID,
        });
    }
    return getFirestore();
};

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid request body' }, 400);
        }

        const { userId, content, type } = body || {};

        // Validate required fields
        if (!userId || !content) {
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

        const db = getDb(env);

        // Rate limiting check
        const rateLimitRef = db.collection('feedback_rate_limits').doc(userId);
        const rateLimitDoc = await rateLimitRef.get();

        if (rateLimitDoc.exists) {
            const lastSubmission = rateLimitDoc.data().lastSubmission?.toMillis() || 0;
            const now = Date.now();

            if (now - lastSubmission < RATE_LIMIT_MS) {
                const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastSubmission)) / 1000);
                return jsonResponse({
                    error: `잠시 후 다시 시도해주세요. (${waitTime}초 후)`
                }, 429);
            }
        }

        // Update rate limit timestamp
        await rateLimitRef.set({
            lastSubmission: new Date(),
            userId,
        }, { merge: true });

        // Store validated feedback
        await db.collection('feedback').add({
            userId,
            content: content.trim(),
            type: type || 'general',
            createdAt: new Date(),
            validated: true,
        });

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
