// 파일 기반 라우팅: functions/api/ai-proxy.js → /api/ai-proxy
// Web Request/Response와 context.env binding을 사용하는 현행 Cloudflare 구현.

// 인메모리 레이트리밋(Map)은 Cloudflare의 각 isolate(엣지 로케이션/워커 인스턴스)마다
// 별도로 유지된다. 즉 동일 사용자의 요청이 서로 다른 isolate로 라우팅되면 이 카운터를
// 공유하지 않으므로, 전역적으로 정확한 레이트리밋이 아니라 "isolate당 근사치" 한계가 있다.
// 강한 보장이 필요하면 Durable Objects/KV 기반 카운터로 교체가 필요하지만, 여기서는
// 현재 정책은 isolate당 인메모리 카운터를 사용한다.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 40;
const requestBuckets = new Map();

// 2026-09 Wave 21 M1 — 입력 크기 상한.
// 레이트리밋은 "몇 번"만 세고 "건당 얼마나 큰가"를 보지 않는다. 익명 인증 토큰은 방문자
// 누구나 받으므로, 상한이 없으면 인증을 통과한 요청 한 건이 수 MB짜리 플레이어 문자열을
// 그대로 Gemini 프롬프트에 실어 보낼 수 있었다(실측: 1MB `name` → 1,000,739자 프롬프트 · 200 OK).
// 정상 본문은 2~3KB이므로 16KB는 여유가 크다.
const MAX_REQUEST_BODY_BYTES = 16_384;
const bodyTextEncoder = new TextEncoder();

// 프롬프트에 그대로 보간되는 플레이어 제어 문자열의 개별 상한.
// (`history`/`mapSnapshot`/`playerSnapshot` 직렬화는 이미 stringifyCompact가 자른다)
const CLAMP_NAME = 32;
const CLAMP_JOB = 24;
const CLAMP_LOCATION = 40;
const CLAMP_DIFFICULTY_LABEL = 16;
const CLAMP_BUILD_TAG = 24;
const MAX_BUILD_TAGS = 4;
const CLAMP_RELIC_NAME = 24;
const MAX_RELICS = 8;
const CLAMP_STORY_CONTEXT = 300;
const CLAMP_STORY_TYPE = 24;
const MAX_PROMPT_LEVEL = 99;

const clampText = (value, max) => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'string' ? value : String(value);
    return text.length > max ? text.slice(0, max) : text;
};

const clampNumber = (value, min, max, fallback) => (
    typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback
);

const exceedsBodyLimit = (text) => {
    // UTF-8은 문자당 최소 1바이트이므로 문자 수가 상한을 넘으면 바이트 수도 반드시 넘는다.
    // 값싼 선행 검사로 두어 거대한 본문을 통째로 인코딩하지 않는다.
    if (text.length > MAX_REQUEST_BODY_BYTES) return true;
    return bodyTextEncoder.encode(text).length > MAX_REQUEST_BODY_BYTES;
};

const parseAllowedOrigins = (env) => {
    const configured = String(env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return configured.length > 0 ? configured : null;
};

const buildCorsHeaders = (origin, allowedOrigins) => {
    const headers = new Headers();
    if (!allowedOrigins) {
        headers.set('Access-Control-Allow-Origin', origin || '*');
    } else if (origin && allowedOrigins.includes(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        headers.set('Access-Control-Allow-Origin', '*');
    }
    headers.set('Vary', 'Origin');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return headers;
};

const jsonResponse = (body, status, corsHeaders) => {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(body), { status, headers });
};

const getClientAddress = (request) => {
    const cfConnectingIp = request.headers.get('CF-Connecting-IP');
    if (cfConnectingIp) return cfConnectingIp;
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
        return forwardedFor.split(',')[0].trim();
    }
    return 'unknown';
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

const parseBearerToken = (request) => {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim();
};

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
            ...(typeof outcome?.item === 'string' && outcome.item.trim() ? { item: outcome.item.trim() } : {}),
            // 2026-09 Wave 3 I3: 확장 어휘는 형태만 보존해 그대로 넘긴다. 실제 화이트리스트/상한
            // 검증은 클라이언트의 aiEventUtils.normalizeOutcomes가 단독으로 책임진다(프록시는 신뢰 경계 밖).
            ...(outcome?.status && typeof outcome.status === 'object' ? { status: outcome.status } : {}),
            ...(outcome?.elite === true ? { elite: true } : {}),
            ...(outcome?.relic && typeof outcome.relic === 'object' ? { relic: outcome.relic } : {}),
            ...(outcome?.buff && typeof outcome.buff === 'object' ? { buff: outcome.buff } : {})
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
        // 플레이어 스냅샷에서 핵심 컨텍스트 추출
        const ps = data.playerSnapshot || {};
        // buildTags/relicsHeld는 프롬프트에 두 번 보간되므로(본문 + 주의사항) 상한이 두 배로 효과가 있다.
        const buildTags = Array.isArray(ps.buildProfile)
            ? ps.buildProfile.slice(0, MAX_BUILD_TAGS).map((tag) => clampText(tag, CLAMP_BUILD_TAG)).join(', ')
            : (clampText(ps.buildProfile, CLAMP_BUILD_TAG) || '없음');
        const relicsHeld = Array.isArray(ps.relics)
            ? ps.relics.slice(0, MAX_RELICS).map((r) => clampText(r?.name || r, CLAMP_RELIC_NAME)).join(', ')
            : '없음';
        const diffLabel = clampText(ps.difficultyLabel, CLAMP_DIFFICULTY_LABEL) || '균형';
        const recentWinRate = clampNumber(ps.recentWinRate, 0, 100, null);
        const winRate = recentWinRate !== null ? `${recentWinRate}%` : '알 수 없음';
        const hpRatio = Number.isFinite(ps.hp) && Number.isFinite(ps.maxHp) && ps.maxHp > 0
            ? Math.round((Math.min(ps.maxHp, Math.max(0, ps.hp)) / ps.maxHp) * 100)
            : null;
        const playerContext = [
            `이름: ${clampText(ps.name, CLAMP_NAME) || '모험가'} | 직업: ${clampText(ps.job, CLAMP_JOB) || '알 수 없음'} | Lv.${clampNumber(ps.level, 1, MAX_PROMPT_LEVEL, 1)}`,
            `HP: ${hpRatio != null ? hpRatio + '%' : '알 수 없음'} | MP: ${clampNumber(ps.mp, 0, Number.MAX_SAFE_INTEGER, 0)}/${clampNumber(ps.maxMp, 0, Number.MAX_SAFE_INTEGER, 50)}`,
            `빌드 성향: ${buildTags}`,
            `보유 유물: ${relicsHeld}`,
            `전투 난이도: ${diffLabel} (최근 승률 ${winRate})`,
            `보유 골드: ${clampNumber(ps.gold, 0, Number.MAX_SAFE_INTEGER, 0)}G`,
        ].join('\n');

        systemInstruction = "당신은 '에테리아(Aetheria)' 판타지 RPG의 게임 마스터입니다. 한국어로 1~2문장 분량의 짧고 선명한 현장 이벤트를 만드세요. 플레이어의 빌드 성향과 보유 유물, 현재 전투 상황을 반영하여 이벤트와 보상이 해당 빌드에 적합하도록 연출하세요. 최근 사건과 같은 소재를 반복하지 말고, 선택지는 반드시 서로 다르게 2~3개 제시하세요. 각 선택지에는 즉시 적용 가능한 결과를 붙이세요.";
        prompt = `현재 위치: ${clampText(data.location, CLAMP_LOCATION) || '알 수 없음'}
지역 정보: ${stringifyCompact(data.mapSnapshot || {}, 300)}
플레이어 상태:
${playerContext}
최근 사건 요약: ${stringifyCompact(data.history || [], 700)}
UID: ${uid}
주의사항:
- 최근 사건과 동일한 연출, 동일한 보상 패턴은 피할 것
- 선택지 2~3개는 성격이 달라야 함 (신중/공격적/회피 등)
- 플레이어 빌드(${buildTags})와 유물(${relicsHeld})을 고려한 이벤트/보상을 우선할 것
- 전투 난이도가 '위기' 또는 '열세'이면 HP 회복이나 도움이 되는 이벤트를 섞을 것
- outcomes 길이는 choices 길이와 같아야 함
- outcome의 gold/exp/hp/mp는 정수, item은 실제 보상 아이템명일 때만 기입
- 위험한 선택 1개에 한해 다음 특수 결과를 최대 1종만 붙일 수 있음 (없으면 전부 생략)
  · status: { id: 'poison' | 'burn' | 'bleed' | 'curse', turns: 1~3 } — 상태이상
  · elite: true — 즉시 정예 적과 조우
  · relic: { count: 1~2 } — 유물 선택지 개방
  · buff: { atkMult/defMult 1.0~1.3, turns: 1~6 } — 다음 전투 강화
- 위 목록 밖의 id/필드는 게임이 폐기하므로 창작하지 말 것. hp는 절대 즉사시키지 않음
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
                            item: { type: "STRING", description: "획득 아이템명. 없으면 생략" },
                            // 2026-09 Wave 3 I1/I3 — 확장 어휘. 게임 쪽(aiEventUtils.normalizeOutcomes)이
                            // 화이트리스트/상한으로 다시 검증하므로 여기 값은 "요청"일 뿐이다.
                            status: {
                                type: "OBJECT",
                                description: "상태이상. 위험한 선택에만. 없으면 생략",
                                properties: {
                                    id: { type: "STRING", description: "poison | burn | bleed | curse 중 하나" },
                                    turns: { type: "INTEGER", description: "지속 턴 1~3" }
                                }
                            },
                            elite: { type: "BOOLEAN", description: "true면 즉시 정예 조우. 위험한 선택에만. 없으면 생략" },
                            relic: {
                                type: "OBJECT",
                                description: "유물 선택지 개방. 없으면 생략",
                                properties: {
                                    count: { type: "INTEGER", description: "선택지 개수 1~2" }
                                }
                            },
                            buff: {
                                type: "OBJECT",
                                description: "다음 전투 강화. 없으면 생략",
                                properties: {
                                    atkMult: { type: "NUMBER", description: "공격 배율 1.0~1.3" },
                                    defMult: { type: "NUMBER", description: "방어 배율 1.0~1.3" },
                                    turns: { type: "INTEGER", description: "지속 턴 1~6" }
                                }
                            }
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
        const label = storyTypeLabels[data.storyType] || clampText(data.storyType, CLAMP_STORY_TYPE) || '모험';
        const fallbackLoc = clampText(data.location || data.loc, CLAMP_LOCATION) || '알 수 없음';
        const context = clampText(data.context || `${fallbackLoc}에서 ${label}`, CLAMP_STORY_CONTEXT);

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
    // 외부 API 지연이 플레이 흐름을 붙잡지 않도록 8.5초에서 중단한다.
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

// Cloudflare Pages Functions 라우팅: POST /api/ai-proxy
export async function onRequestPost(context) {
    const { request, env } = context;
    const origin = request.headers.get('origin');
    const allowedOrigins = parseAllowedOrigins(env);
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

    if (allowedOrigins && origin && !allowedOrigins.includes(origin)) {
        return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    const token = parseBearerToken(request);
    if (!token) {
        return jsonResponse({ error: 'Unauthorized: missing bearer token' }, 401, corsHeaders);
    }

    let authUser;
    try {
        authUser = await verifyFirebaseToken(token, env);
    } catch (error) {
        console.error('Auth config error:', error.message);
        return jsonResponse({ error: 'Auth provider is not configured' }, 500, corsHeaders);
    }

    if (!authUser) {
        return jsonResponse({ error: 'Unauthorized: invalid token' }, 401, corsHeaders);
    }

    const clientAddress = getClientAddress(request);
    const rateLimitKey = `${authUser.uid}:${clientAddress}`;
    if (!checkRateLimit(rateLimitKey)) {
        return jsonResponse({ error: 'Too many requests' }, 429, corsHeaders);
    }

    try {
        // Wave 21 M1 — CORS/인증/레이트리밋을 통과한 뒤, 값비싼 작업(Gemini 호출) 전에
        // 본문 크기를 먼저 본다. Content-Length는 있을 때만 믿을 수 있으므로(없거나
        // 거짓일 수 있다) 실제로 읽은 텍스트의 바이트 길이도 함께 검사한다.
        const declaredLength = Number(request.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
            return jsonResponse({ error: 'Request body too large' }, 413, corsHeaders);
        }

        let rawBody;
        try {
            rawBody = await request.text();
        } catch {
            return jsonResponse({ error: 'Invalid request body' }, 400, corsHeaders);
        }

        if (exceedsBodyLimit(rawBody)) {
            return jsonResponse({ error: 'Request body too large' }, 413, corsHeaders);
        }

        let body;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return jsonResponse({ error: 'Invalid request body' }, 400, corsHeaders);
        }

        const { type, data } = body || {};
        if (!type || !data) {
            return jsonResponse({ error: 'Invalid request body' }, 400, corsHeaders);
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return jsonResponse({ error: 'API key not configured' }, 500, corsHeaders);
        }

        const payloadConfig = buildGeminiPayload(type, data, authUser.uid);
        if (!payloadConfig) {
            return jsonResponse({ error: 'Invalid request type' }, 400, corsHeaders);
        }

        const parsedJson = await callGemini(payloadConfig, apiKey);
        if (!parsedJson) {
            return jsonResponse({ error: 'Empty AI response' }, 502, corsHeaders);
        }

        if (type === 'event') {
            const normalizedEvent = normalizeEventData(parsedJson);
            if (!normalizedEvent) {
                return jsonResponse({ error: 'Invalid AI event response' }, 502, corsHeaders);
            }
            return jsonResponse({ success: true, data: normalizedEvent }, 200, corsHeaders);
        }

        const narrative = parsedJson?.narrative || '신비로운 기운이 느껴집니다.';
        return jsonResponse({ success: true, data: { narrative } }, 200, corsHeaders);
    } catch (error) {
        // 상류(Gemini) 오류 원문은 서버 로그에만 남긴다 — 응답 본문으로 돌려주면
        // API 키/프로젝트 식별자 같은 내부 정보가 클라이언트로 샌다(Wave 21 M1).
        console.error('Proxy error:', error);
        return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders);
    }
}

// CORS preflight
export async function onRequestOptions(context) {
    const { request, env } = context;
    const origin = request.headers.get('origin');
    const allowedOrigins = parseAllowedOrigins(env);
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);
    return new Response(null, { status: 200, headers: corsHeaders });
}

// 그 외 메서드 (GET/PUT/DELETE 등) → 405
export async function onRequest(context) {
    const { request } = context;
    if (request.method === 'POST') return onRequestPost(context);
    if (request.method === 'OPTIONS') return onRequestOptions(context);

    const origin = request.headers.get('origin');
    const allowedOrigins = parseAllowedOrigins(context.env);
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
}
