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

// extractJsonCandidate 함수 제거 (Structured Output 사용하므로 불필요)

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
        outcomes: outcomes.map((outcome, idx) => ({
            choiceIndex: Number.isFinite(Number(outcome?.choiceIndex)) ? Number(outcome.choiceIndex) : idx,
            log: String(outcome?.log || outcome?.text || '선택의 결과가 반영되었습니다.'),
            gold: Number.isFinite(Number(outcome?.gold)) ? Number(outcome.gold) : 0,
            ...(Number.isFinite(Number(outcome?.exp)) ? { exp: Number(outcome.exp) } : {}),
            ...(Number.isFinite(Number(outcome?.hp)) ? { hp: Number(outcome.hp) } : {}),
            ...(Number.isFinite(Number(outcome?.mp)) ? { mp: Number(outcome.mp) } : {}),
            ...(typeof outcome?.item === 'string' && outcome.item.trim() ? { item: outcome.item.trim() } : {})
        }))
    };
};

const stringifyCompact = (value, limit = 700) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value || {});
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const buildGeminiPayload = (type, data, uid) => {
    let systemInstruction = "";
    let prompt = "";
    let schema = null;

    if (type === 'event') {
        systemInstruction = "당신은 '에테리아(Aetheria)' 판타지 RPG의 게임 마스터입니다. 한국어로 1~2문장 분량의 짧고 선명한 현장 이벤트를 만드세요. 최근 사건과 같은 소재를 반복하지 말고, 선택지는 반드시 서로 다르게 2~3개 제시하세요. 각 선택지에는 즉시 적용 가능한 결과를 붙이세요.";
        prompt = `현재 위치: ${data.location || '알 수 없음'}
지역 정보: ${stringifyCompact(data.mapSnapshot || {}, 500)}
플레이어 정보: ${stringifyCompact(data.playerSnapshot || {}, 500)}
최근 사건 요약: ${stringifyCompact(data.history || [], 900)}
UID: ${uid}
주의사항:
- 최근 사건과 동일한 연출, 동일한 보상 패턴은 피할 것
- 선택지 2~3개는 성격이 달라야 함 (신중/공격적/회피 등)
- outcomes 길이는 choices 길이와 같아야 함
- outcome의 gold/exp/hp/mp는 정수, item은 실제 보상 아이템명일 때만 기입
상황과 선택지, 결과를 생성해주세요.`;

        schema = {
            type: "OBJECT",
            properties: {
                desc: { type: "STRING", description: "이벤트의 흥미로운 묘사 (1~2문장)" },
                choices: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                    description: "유저가 선택할 수 있는 2~3개의 행동 옵션"
                },
                outcomes: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            choiceIndex: { type: "INTEGER", description: "선택지 인덱스 (0부터 시작)" },
                            log: { type: "STRING", description: "해당 선택시 나타날 짧은 결과 메시지" },
                            gold: { type: "INTEGER", description: "획득/잃을 골드량 (없으면 0)" },
                            exp: { type: "INTEGER", description: "획득 경험치 (없으면 0 또는 생략)" },
                            hp: { type: "INTEGER", description: "HP 변화량. 회복은 양수, 피해는 음수" },
                            mp: { type: "INTEGER", description: "MP 변화량. 회복은 양수, 소모/혼란은 음수" },
                            item: { type: "STRING", description: "획득 아이템명. 없으면 생략" }
                        },
                        required: ["choiceIndex", "log", "gold"]
                    }
                }
            },
            required: ["desc", "choices", "outcomes"]
        };
    } else if (type === 'story') {
        const storyTypeLabels = {
            encounter: '조우', victory: '승리', death: '전사',
            levelUp: '레벨업', rest: '휴식',
            bossPhase2: '보스 Phase 2 전환',
            questComplete: '퀴스트 완료',
            ruinRecap: '사망 후회고',
        };
        const label = storyTypeLabels[data.storyType] || data.storyType || '모험';
        const context = data.context || `${data.location || data.loc || '알 수 없음'}에서 ${label}`;

        systemInstruction = "당신은 판타지 RPG 내레이터입니다. 주어진 상황을 한국어 1~2문장으로 묘사하되, 최근 사건과 어조를 반복하지 말고 현장감 있게 서술하세요. 보스 전환은 듀라운, 퀴스트 완료는 성취감, 사망 후회고는 비장미로 서술하세요.";
        prompt = `상황: ${context}
예전 사건 요약: ${stringifyCompact(data.history || [], 700)}
플레이어 정보: ${stringifyCompact(data.playerSnapshot || {}, 400)}
UID: ${uid}`;

        schema = {
            type: "OBJECT",
            properties: {
                narrative: { type: "STRING", description: "상황에 대한 게임 내러티브 묘사" }
            },
            required: ["narrative"]
        };
    }

    if (!prompt) return null;

    return { systemInstruction, prompt, schema };
};

const callGemini = async (payloadConfig, apiKey) => {
    const { systemInstruction, prompt, schema } = payloadConfig;

    const controller = new AbortController();
    // Vercel Serverless 10s 제한 호환: 8.5초 타임아웃
    const timeoutId = setTimeout(() => controller.abort(), 8_500);

    const requestBody = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
            responseSchema: schema
        }
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const geminiData = await response.json();
        const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!textContent) return null;

        return JSON.parse(textContent); // responseMimeType이 application/json이므로 100% JSON 문자열 반환을 신뢰
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

        const payloadConfig = buildGeminiPayload(type, data, authUser.uid);
        if (!payloadConfig) {
            return res.status(400).json({ error: 'Invalid request type' });
        }

        const parsedJson = await callGemini(payloadConfig, apiKey);
        if (!parsedJson) {
            return res.status(502).json({ error: 'Empty AI response' });
        }

        if (type === 'event') {
            const normalizedEvent = normalizeEventData(parsedJson);
            if (!normalizedEvent) {
                return res.status(502).json({ error: 'Invalid AI event response' });
            }
            return res.status(200).json({ success: true, data: normalizedEvent });
        }

        const narrative = parsedJson?.narrative || '신비로운 기운이 느껴집니다.';
        return res.status(200).json({ success: true, data: { narrative } });
    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
