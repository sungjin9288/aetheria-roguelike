const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 40;
const requestBuckets = new Map();

const parseAllowedOrigins = () => {
    const configured = String(process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return configured.length > 0 ? configured : null;
};

const setCorsHeaders = (res, origin, allowedOrigins) => {
    if (!allowedOrigins) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const getClientAddress = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
};

const checkRateLimit = (key) => {
    const now = Date.now();
    const bucket = requestBuckets.get(key) || [];
    const fresh = bucket.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

    if (fresh.length >= RATE_LIMIT_MAX_REQUESTS) {
        requestBuckets.set(key, fresh);
        return false;
    }

    fresh.push(now);
    requestBuckets.set(key, fresh);
    return true;
};

const parseBearerToken = (req) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim();
};

const verifyFirebaseToken = async (idToken) => {
    const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY;
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

    return {
        uid: user.localId,
        email: user.email || null
    };
};

const extractJsonCandidate = (text) => {
    if (typeof text !== 'string') return null;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
};

const normalizeEventData = (raw) => {
    if (!raw || typeof raw !== 'object') return null;

    const desc = raw.desc || raw.text || raw.event || raw.message;
    if (!desc) return null;

    const choices = Array.isArray(raw.choices)
        ? raw.choices.map((choice, idx) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`))
        : [];

    const outcomes = Array.isArray(raw.outcomes)
        ? raw.outcomes
        : Array.isArray(raw.choices)
            ? raw.choices
                .map((choice, idx) => {
                    if (typeof choice === 'object' && choice?.effect) {
                        return { choiceIndex: idx, log: choice.effect };
                    }
                    return null;
                })
                .filter(Boolean)
            : [];

    return {
        desc,
        choices: choices.slice(0, 3),
        outcomes
    };
};

const buildPrompt = (type, data, uid) => {
    if (type === 'event') {
        return `당신은 '에테리아(Aetheria)' 판타지 RPG의 게임 마스터입니다.
아래 위치와 플레이 히스토리를 참고해 짧은 랜덤 이벤트를 한국어로 생성하세요.
- 분량: 1~2문장
- 선택지: 2~3개
- JSON만 출력

현재 위치: ${data.location || '알 수 없음'}
플레이 기록: ${JSON.stringify(data.history || []).slice(0, 800)}
UID: ${uid}

반드시 아래 형식만 사용:
{"desc":"상황 설명","choices":["선택지1","선택지2","선택지3"],"outcomes":[{"choiceIndex":0,"log":"결과 로그","gold":10}]}`;
    }

    if (type === 'story') {
        const context = data.storyType === 'encounter'
            ? `${data.loc}에서 ${data.name} 몬스터와 조우`
            : (data.storyType || data.context || '모험');

        return `당신은 판타지 RPG 내레이터입니다.
아래 상황을 한국어 1~2문장으로 묘사하세요.
JSON만 출력하세요.

상황: ${context}
UID: ${uid}

형식: {"narrative":"내러티브 텍스트"}`;
    }

    return null;
};

const callGemini = async (prompt, apiKey) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const geminiData = await response.json();
        return geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } finally {
        clearTimeout(timeoutId);
    }
};

export default async function handler(req, res) {
    const origin = req.headers.origin;
    const allowedOrigins = parseAllowedOrigins();
    setCorsHeaders(res, origin, allowedOrigins);

    if (allowedOrigins && origin && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = parseBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: missing bearer token' });
    }

    let authUser;
    try {
        authUser = await verifyFirebaseToken(token);
    } catch (error) {
        console.error('Auth config error:', error.message);
        return res.status(500).json({ error: 'Auth provider is not configured' });
    }

    if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized: invalid token' });
    }

    const clientAddress = getClientAddress(req);
    const rateLimitKey = `${authUser.uid}:${clientAddress}`;
    if (!checkRateLimit(rateLimitKey)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    try {
        const { type, data } = req.body || {};
        if (!type || !data) {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const prompt = buildPrompt(type, data, authUser.uid);
        if (!prompt) {
            return res.status(400).json({ error: 'Invalid request type' });
        }

        const textContent = await callGemini(prompt, apiKey);
        const parsed = extractJsonCandidate(textContent);

        if (type === 'event') {
            const normalizedEvent = normalizeEventData(parsed || { desc: textContent, choices: [] });
            if (!normalizedEvent) {
                return res.status(502).json({ error: 'Invalid AI event response' });
            }
            return res.status(200).json({ success: true, data: normalizedEvent });
        }

        const narrative = parsed?.narrative || textContent;
        return res.status(200).json({ success: true, data: { narrative } });
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
