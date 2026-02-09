const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 1. Authenticate (Only Admins)
        const authHeader = event.headers.Authorization || event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }
        const idToken = authHeader.split('Bearer ')[1];
        const _decodedToken = await admin.auth().verifyIdToken(idToken);

        // Check custom claim for admin (Optional enhancement)
        // if (!decodedToken.admin) return { statusCode: 403, body: 'Forbidden' };

        // 2. Perform Heavy Analytics (Hybrid Strategy)
        // Fetch all player stats - efficient in server environment with stronger network/CPU
        const snapshot = await db.collection('player_stats').get();

        let totalUsers = 0;
        let totalLevel = 0;
        const jobDist = {};
        const deathCauses = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            totalUsers++;
            totalLevel += (data.level || 1);

            const job = data.job || 'Unknown';
            jobDist[job] = (jobDist[job] || 0) + 1;

            if (data.lastDeathCause) {
                deathCauses[data.lastDeathCause] = (deathCauses[data.lastDeathCause] || 0) + 1;
            }
        });

        const analyticsData = {
            totalUsers,
            avgLevel: totalUsers > 0 ? (totalLevel / totalUsers).toFixed(1) : 0,
            jobDistribution: jobDist,
            deathCauses: deathCauses,
            generatedAt: new Date().toISOString()
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: analyticsData })
        };

    } catch (error) {
        console.error('Analytics Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
