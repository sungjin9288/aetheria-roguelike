const admin = require('firebase-admin');
const { fetch } = require('undici'); // Node 18+ has fetch, but good for compatibility

// Initialize Firebase Admin (Singleton)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(), // Uses AWS Env Vars or default creds
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

const CONSTANTS = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
};

exports.handler = async (event) => {
    // CORS Headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 1. Authenticate Request
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized: Missing token' }) };
        }
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Parse Body
        const body = JSON.parse(event.body);
        const { type, data } = body;

        // 3. Build Prompt (Logic ported from App.jsx/api/ai-proxy.js)
        let prompt = '';
        if (type === 'event') {
            prompt = `
        RPG 게임의 [${data.location}] 지역에서 발생할 수 있는 랜덤 이벤트를 생성하세요.
        플레이어의 최근 기록: ${JSON.stringify(data.history)}
        UID: ${uid}
        JSON 형식으로 답하세요: { "desc": "상황설명(한글)", "choices": ["선택지1(한글)", "선택지2(한글)"] }
      `;
        } else if (type === 'story') {
            const systemPrompt = `당신은 다크 판타지 RPG 게임의 내레이터입니다. 상황을 한국어로 1~2문장으로 짧고 비장하게 묘사하세요.`;
            let userPrompt = "";
            // Simple mapping for brevity - ideally move this logic to a shared lib or keep it here
            if (data.storyType === 'encounter') userPrompt = `상황: [${data.loc}]에서 [${data.name}] 몬스터 조우.`;
            else userPrompt = `상황: ${data.storyType} 발생.`;

            prompt = systemPrompt + "\n" + userPrompt + `\nUID: ${uid}`;
        }

        // 4. Call Gemini API
        const response = await fetch(`${CONSTANTS.GEMINI_URL}?key=${CONSTANTS.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.statusText}`);
        }

        const json = await response.json();
        const textContext = json.candidates?.[0]?.content?.parts?.[0]?.text;

        // Parse result if expecting JSON (for event type)
        let resultData = textContext;
        if (type === 'event') {
            const jsonMatch = textContext.match(/\{[\s\S]*\}/);
            if (jsonMatch) resultData = JSON.parse(jsonMatch[0]);
        } else if (type === 'story') {
            resultData = { narrative: textContext };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: resultData })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
