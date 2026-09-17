// --- FEEDBACK VALIDATION (Client-side pre-validation) ---
import { MSG } from '../data/messages.js';

export const FeedbackValidator = {
    MIN_LENGTH: 10,
    MAX_LENGTH: 1000,
    RATE_LIMIT_KEY: 'aetheria_feedback_ts',
    RATE_LIMIT_MS: 60000, // 1 minute

    validate(content: any) {
        if (!content || content.length < this.MIN_LENGTH) {
            return { valid: false, error: MSG.FEEDBACK_MIN_LENGTH(this.MIN_LENGTH) };
        }
        if (content.length > this.MAX_LENGTH) {
            return { valid: false, error: MSG.FEEDBACK_MAX_LENGTH(this.MAX_LENGTH) };
        }
        // Check rate limit
        const lastTs = localStorage.getItem(this.RATE_LIMIT_KEY);
        if (lastTs && Date.now() - parseInt(lastTs) < this.RATE_LIMIT_MS) {
            const wait = Math.ceil((this.RATE_LIMIT_MS - (Date.now() - parseInt(lastTs))) / 1000);
            return { valid: false, error: MSG.FEEDBACK_RATE_LIMITED(wait) };
        }
        return { valid: true };
    },

    markSubmitted() {
        localStorage.setItem(this.RATE_LIMIT_KEY, Date.now().toString());
    }
};
