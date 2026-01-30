// Serverless Feedback Validation Function
// Handles spam prevention and content validation
// Deploy to: Netlify Functions, Vercel Functions, or similar

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (server-side)
if (!getApps().length) {
    initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
    });
}

const db = getFirestore();

// Rate limit: 1 feedback per 60 seconds per user
const RATE_LIMIT_MS = 60000;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 1000;

// Simple spam patterns
const SPAM_PATTERNS = [
    /https?:\/\//i,           // URLs
    /\b(buy|sell|cheap|free|click|subscribe)\b/i,
    /(.)\1{5,}/,              // Repeated characters
];

export default async function handler(req, res) {
    // CORS
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
        const { userId, content, type } = req.body;

        // Validate required fields
        if (!userId || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Content length validation
        if (content.length < MIN_CONTENT_LENGTH) {
            return res.status(400).json({ error: `피드백은 최소 ${MIN_CONTENT_LENGTH}자 이상이어야 합니다.` });
        }

        if (content.length > MAX_CONTENT_LENGTH) {
            return res.status(400).json({ error: `피드백은 ${MAX_CONTENT_LENGTH}자를 초과할 수 없습니다.` });
        }

        // Spam pattern check
        for (const pattern of SPAM_PATTERNS) {
            if (pattern.test(content)) {
                return res.status(400).json({ error: '유효하지 않은 내용입니다.' });
            }
        }

        // Rate limiting check
        const rateLimitRef = db.collection('feedback_rate_limits').doc(userId);
        const rateLimitDoc = await rateLimitRef.get();

        if (rateLimitDoc.exists) {
            const lastSubmission = rateLimitDoc.data().lastSubmission?.toMillis() || 0;
            const now = Date.now();

            if (now - lastSubmission < RATE_LIMIT_MS) {
                const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastSubmission)) / 1000);
                return res.status(429).json({
                    error: `잠시 후 다시 시도해주세요. (${waitTime}초 후)`
                });
            }
        }

        // Update rate limit timestamp
        await rateLimitRef.set({
            lastSubmission: new Date(),
            userId,
        }, { merge: true });

        // Store validated feedback
        await db.collection('feedback').add({
            userId,
            content: content.trim(),
            type: type || 'general',
            createdAt: new Date(),
            validated: true,
        });

        return res.status(200).json({ success: true, message: '피드백이 제출되었습니다.' });

    } catch (error) {
        console.error('Feedback validation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
