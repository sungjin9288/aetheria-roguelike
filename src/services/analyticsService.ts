export const fetchAnalyticsData = async (token) => {
    const proxyUrl = import.meta.env.VITE_AI_PROXY_URL || '';
    const baseUrl = proxyUrl.includes('/game/story')
        ? proxyUrl.split('/game/story')[0]
        : '';
    const url = `${baseUrl}/admin/analytics`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Analytics API Error: ${response.status}`);
        }

        const json = await response.json();
        return json.success ? json.data : null;
    } catch (e) {
        console.error('Analytics fetch error:', e);
        return null;
    }
};
