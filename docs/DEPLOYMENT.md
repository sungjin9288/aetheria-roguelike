# Dev/Prod Environment Separation Strategy

> **2026-07: 웹 배포 플랫폼이 Vercel → Cloudflare Pages로 이전되었습니다.**
> 아래 문서의 "Vercel" 관련 항목(서버리스 함수, env var 설정 위치)은 참고용으로 남겨두되,
> 실제 서버 함수는 `functions/api/`의 Cloudflare Pages Functions가 담당합니다.
> 클라이언트가 호출하는 상대 경로(`/api/ai-proxy`, `/api/feedback-validate`)는 변경 없음.
> Firebase 프로젝트 분리(dev/prod) 전략 자체는 호스팅 플랫폼과 무관하게 그대로 유지됩니다.
> 배포 절차는 [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) 참고.

## Overview
Aetheria RPG uses separate Firebase projects for development and production environments.

## Environment Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
├─────────────────────────────────────────────────────────────┤
│  Branch: develop              │  Branch: main               │
│  ↓                            │  ↓                          │
│  Deploy to DEV                │  Deploy to PROD             │
└─────────────────────────────────────────────────────────────┘
         │                                │
         ▼                                ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Firebase Project    │     │ Firebase Project    │
│ aetheria-dev        │     │ aetheria-prod       │
├─────────────────────┤     ├─────────────────────┤
│ • Firestore (dev)   │     │ • Firestore (prod)  │
│ • Auth (dev)        │     │ • Auth (prod)       │
│ • Hosting (dev)     │     │ • Hosting (prod)    │
│ • Functions (dev)   │     │ • Functions (prod)  │
└─────────────────────┘     └─────────────────────┘
```

## Firebase Project Setup

### 1. Create Two Firebase Projects
```bash
# Development project
firebase projects:create aetheria-dev

# Production project
firebase projects:create aetheria-prod
```

### 2. Configure Firebase CLI
```bash
# .firebaserc
{
  "projects": {
    "dev": "aetheria-dev",
    "prod": "aetheria-prod"
  }
}
```

### 3. Environment-Specific Configs

#### Development (.env.development)
```env
VITE_FIREBASE_CONFIG={"apiKey":"dev-key","authDomain":"aetheria-dev.firebaseapp.com",...}
VITE_USE_AI_PROXY=false
VITE_REMOTE_CONFIG=false
```

#### Production (.env.production)
```env
VITE_FIREBASE_CONFIG={"apiKey":"prod-key","authDomain":"aetheria-prod.firebaseapp.com",...}
VITE_USE_AI_PROXY=true
VITE_REMOTE_CONFIG=true
VITE_AI_PROXY_URL=/api/ai-proxy
```

## GitHub Secrets Configuration

| Secret Name | Environment | Description |
|-------------|-------------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_DEV` | Development | Service account JSON for dev project |
| `FIREBASE_PROJECT_ID_DEV` | Development | e.g., `aetheria-dev` |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | Production | Service account JSON for prod project |
| `FIREBASE_PROJECT_ID_PROD` | Production | e.g., `aetheria-prod` |
| `GEMINI_API_KEY` | Production | Gemini API key (server-side only) |

> `GEMINI_API_KEY`, `FIREBASE_WEB_API_KEY`, `ALLOWED_ORIGINS`는 GitHub Actions가 아닌
> **Cloudflare Pages 프로젝트의 Environment variables**에 설정합니다 (Vercel 사용 시절과
> 동일하게 서버 전용 값이며 클라이언트 빌드에 노출되지 않습니다). 자세한 설정 위치는
> [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) 참고.

### Important: GitHub Environment Setup
To avoid "Value 'development' is not valid" (or 'production') errors in your workflows and IDE:
1. Go to **Settings** > **Environments** in your GitHub repository.
2. Click **New environment**.
3. Create two environments: `development` and `production`.
4. (Optional) Add environment-specific secrets here instead of repository secrets if preferred.

## Deployment Flow

### Development
1. Push to `develop` branch
2. GitHub Actions triggers build
3. Deploys to `aetheria-dev.web.app`
4. Test new features in isolated environment

### Production
1. Merge `develop` → `main` via PR
2. GitHub Actions triggers build
3. Deploys to `aetheria-prod.web.app` (or custom domain)
4. Production users receive update

## Firestore Rules Separation

Each project has independent Firestore rules:
- Dev: More permissive for testing
- Prod: Strict security rules

## Rollback Strategy

```bash
# List recent deployments
firebase hosting:channel:list --project aetheria-prod

# Rollback to previous version
firebase hosting:rollback --project aetheria-prod
```

## Monitoring

- Dev: Console logs, debug mode enabled
- Prod: Error tracking, performance monitoring, alerts
