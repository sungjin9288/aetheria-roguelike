// Utility: Exponential Backoff Fetch
export const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`Status: ${res.status} `);
        return res;
    } catch (err) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
};
