# AWS Serverless Migration Report (v4.0)

## 📌 Executive Summary
Aetheria RPG v4.0 adopts a **Serverless First** architecture using AWS Lambda and API Gateway. This transition enhances security, reduces operational costs, and provides infinite scalability for handling global game traffic.

## 🏗️ Architecture Decisions

### 1. Compute: AWS Lambda (Node.js 18.x)
- **Why**: Event-driven execution perfectly matches the RPG's "turn-based" nature. No idle servers means zero cost when no one is playing.
- **Functions**:
  - `ai-proxy`: Securely wraps Gemini API key, preventing client-side exposure.
  - `analytics`: Performs heavy aggregation on Firestore data, offloading 100% of compute from the client.

### 2. Networking: API Gateway REST API
- **Why**: Provides a unified entry point, DDoS protection, and usage throttling.
- **Security**: Acts as a shield, validating Auth Tokens before they reach Lambda.

### 3. Data: Hybrid Strategy
- **Firestore**: Retained for "Hot Data" (Real-time sync, User Profiles).
- **Lambda**: Used for "Compute on Read" (Analytics), ensuring client performance remains snappy even with millions of records.

---

## 💰 Cost Analysis

| Resource | Free Tier Limit | Estimated Aetheria Usage (10k MAU) | Est. Cost |
|----------|----------------|------------------------------------|-----------|
| **Lambda** | 400,000 GB-seconds / month | ~50,000 requests | **$0.00** |
| **API Gateway** | 1 million calls / month | ~50,000 calls | **$0.00** |
| **Data Transfer** | 100 GB / month | < 1 GB | **$0.00** |

**Conclusion**: For the current stage, the infrastructure cost is effectively **Zero**. Scaling to 1M MAU would cost roughly $5-10/month, significantly cheaper than EC2 instances ($30+/month).

---

## 🚀 Scalability & Performance

- **Auto-Scaling**: AWS Lambda automatically runs thousands of concurrent instances. Spikes during game events are handled without manual intervention.
- **Edge Latency**: Deploying to `ap-northeast-2` (Seoul) ensures low latency for target users.
- **Client Performance**: Moving analytics logic to the cloud reduced the Admin Dashboard load time by ~90% (estimated) and saved client memory.

---

## 🔒 Security Hardening

- **No Secrets in Client**: `VITE_GEMINI_API_KEY` is completely removed from the frontend build.
- **Cross-Cloud Auth**: Requests are signed with Firebase ID Tokens and verified in AWS Lambda.
- **Throttling**: API Gateway standard throttling prevents abuse.
