// --- LATENCY TRACKER (v3.5) ---
// Monitors AI response times and alerts on slow responses.
//
// cycle 308: getStats / getAverageLatency / recordLatency / recentLatencies /
//   MAX_HISTORY 5 dead surface 제거 — getStats 외부 0건, getAverageLatency는
//   getStats 내부 1회만, recordLatency는 getStats가 읽지 않을 array 채우기만.
//   활성 surface는 trackCall (slow-response console.warn + custom event) 하나뿐.
export const LatencyTracker: any = {
    THRESHOLD_MS: 3000, // 3 seconds threshold

    async trackCall(asyncFn: any, callType: any = 'ai') {
        const startTime = performance.now();
        const result = await asyncFn();
        const latency = performance.now() - startTime;

        // Alert if over threshold
        if (latency > this.THRESHOLD_MS) {
            console.warn(`⚠️ Slow ${callType} response: ${(latency / 1000).toFixed(2)}s (threshold: ${this.THRESHOLD_MS / 1000}s)`);
            this.onSlowResponse(callType, latency);
        }

        return result;
    },

    onSlowResponse(type: any, latency: any) {
        // Hook for custom alerting (can integrate with monitoring systems)
        // For now, just dispatch a custom event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aetheria:slow-response', {
                detail: { type, latency, threshold: this.THRESHOLD_MS }
            }));
        }
    },
};
