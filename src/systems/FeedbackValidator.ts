// --- FEEDBACK VALIDATION (Client-side pre-validation) ---
export const FeedbackValidator = {
    MIN_LENGTH: 10,
    MAX_LENGTH: 1000,
    RATE_LIMIT_KEY: 'aetheria_feedback_ts',
    RATE_LIMIT_MS: 60000, // 1 minute

    validate(content) {
        if (!content || content.length < this.MIN_LENGTH) {
            return { valid: false, error: `최소 ${this.MIN_LENGTH}자 이상 입력해주세요.` };
        }
        if (content.length > this.MAX_LENGTH) {
            return { valid: false, error: `${this.MAX_LENGTH}자를 초과할 수 없습니다.` };
        }
        // Check rate limit
        const lastTs = localStorage.getItem(this.RATE_LIMIT_KEY);
        if (lastTs && Date.now() - parseInt(lastTs) < this.RATE_LIMIT_MS) {
            const wait = Math.ceil((this.RATE_LIMIT_MS - (Date.now() - parseInt(lastTs))) / 1000);
            return { valid: false, error: `잠시 후 다시 시도해주세요. (${wait}초)` };
        }
        return { valid: true };
    },

    markSubmitted() {
        localStorage.setItem(this.RATE_LIMIT_KEY, Date.now().toString());
    }
};
