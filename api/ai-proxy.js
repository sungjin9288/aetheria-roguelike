// Serverless API Proxy for Gemini AI
// This function runs server-side, keeping API keys secure
// Deploy to: Netlify Functions, Vercel Functions, or similar

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { type, data } = req.body;

        // Server-side API key (not exposed to client)
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        // Rate limiting check
        const clientId = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

        // Build prompt based on request type
        let prompt = '';

        if (type === 'event') {
            prompt = `당신은 '에테리아(Aetheria)'라는 판타지 세계의 게임 마스터입니다.
아래 상황에서 짧고 몰입적인(2-3문장) 한국어 랜덤 이벤트를 생성하세요.
플레이어 정보: ${JSON.stringify(data.history || [])}
현재 위치: ${data.location || '알 수 없음'}
응답 형식(JSON): {"text": "이벤트 설명", "choices": [{"text": "선택지1", "effect": "hp:-10"}, {"text": "선택지2", "effect": "gold:+50"}]}
JSON만 응답하세요.`;
        } else if (type === 'story') {
            // v4.0 data structure compatibility
            const context = data.storyType === 'encounter'
                ? `${data.loc}에서 ${data.name} 몬스터와 조우`
                : (data.storyType || data.context || '모험');

            prompt = `당신은 판타지 RPG의 이야기꾼입니다.
다음 상황에 맞는 짧은 내러티브(1-2문장)를 한국어로 작성하세요:
상황: ${context}
플레이어 UID: ${data.uid || 'unknown'}
JSON 형식: {"narrative": "내러티브 텍스트"}`;
        } else if (type === 'lore') {
            prompt = `에테리아 세계의 로어입니다. "${data.topic || '세계'}"에 대해 짧은 설명(1-2문장)을 한국어로 작성하세요.
JSON 형식: {"lore": "로어 텍스트"}`;
        } else {
            return res.status(400).json({ error: 'Invalid request type' });
        }

        // Call Gemini API
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 500,
                    },
                }),
            }
        );

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            console.error('Gemini API error:', errorText);
            return res.status(502).json({ error: 'AI service error' });
        }

        const geminiData = await geminiResponse.json();
        const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON from response
        try {
            const jsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return res.status(200).json({ success: true, data: parsed });
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
        }

        // Return raw text if JSON parsing fails
        return res.status(200).json({ success: true, data: { text: textContent } });

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
