// --- LATENCY TRACKER (v3.5) ---
// Monitors AI response times and alerts on slow responses
export const LatencyTracker = {
    THRESHOLD_MS: 3000, // 3 seconds threshold
    recentLatencies: [],
    MAX_HISTORY: 20,

    async trackCall(asyncFn, callType = 'ai') {
        const startTime = performance.now();

        try {
            const result = await asyncFn();
            const latency = performance.now() - startTime;

            this.recordLatency(callType, latency);

            // Alert if over threshold
            if (latency > this.THRESHOLD_MS) {
                console.warn(`⚠️ Slow ${callType} response: ${(latency / 1000).toFixed(2)}s (threshold: ${this.THRESHOLD_MS / 1000}s)`);
                this.onSlowResponse(callType, latency);
            }

            return result;
        } catch (e) {
            const latency = performance.now() - startTime;
            this.recordLatency(callType, latency, true);
            throw e;
        }
    },

    recordLatency(type, latency, isError = false) {
        this.recentLatencies.unshift({
            type,
            latency,
            isError,
            timestamp: Date.now()
        });

        // Keep only recent history
        if (this.recentLatencies.length > this.MAX_HISTORY) {
            this.recentLatencies.pop();
        }
    },

    getAverageLatency(type = null) {
        const filtered = type
            ? this.recentLatencies.filter(l => l.type === type && !l.isError)
            : this.recentLatencies.filter(l => !l.isError);

        if (filtered.length === 0) return 0;
        return filtered.reduce((sum, l) => sum + l.latency, 0) / filtered.length;
    },

    onSlowResponse(type, latency) {
        // Hook for custom alerting (can integrate with monitoring systems)
        // For now, just dispatch a custom event
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('aetheria:slow-response', {
                detail: { type, latency, threshold: this.THRESHOLD_MS }
            }));
        }
    },

    getStats() {
        return {
            avgLatency: this.getAverageLatency(),
            callCount: this.recentLatencies.length,
            errorCount: this.recentLatencies.filter(l => l.isError).length,
            slowCount: this.recentLatencies.filter(l => l.latency > this.THRESHOLD_MS).length
        };
    }
};
