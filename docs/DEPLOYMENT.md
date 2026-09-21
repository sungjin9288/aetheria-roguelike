# Dev/Prod Environment Separation Strategy

> 웹 배포와 서버 함수는 Cloudflare Pages 및 `functions/api/`를 단일 source of truth로 사용합니다.
> 이전 호스팅 설정과 legacy serverless 사본은 제거됐습니다.
> 클라이언트가 호출하는 상대 경로(`/api/ai-proxy`, `/api/feedback-validate`)는 변경 없음.
> Firebase 프로젝트 분리(dev/prod) 전략 자체는 호스팅 플랫폼과 무관하게 그대로 유지됩니다
> (Firestore/Auth만 해당 — Firebase Hosting은 사용하지 않습니다, Wave 20 L2).
> `.github/workflows/deploy.yml`이 GitHub Actions로 배포하는 것은 **Firestore rules뿐**입니다.
> 배포 절차는 [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) 참고.

## Overview
Aetheria RPG uses separate Firebase projects (Firestore + Auth) for development and production
environments. The web app itself is deployed separately, outside this repository's GitHub Actions,
by Cloudflare Pages' own git integration.

## Environment Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
├─────────────────────────────────────────────────────────────┤
│  Branch: develop              │  Branch: main               │
│  ↓                            │  ↓                          │
│  deploy.yml: deploy-rules     │  deploy.yml: deploy-rules   │
└─────────────────────────────────────────────────────────────┘
         │                                │
         ▼                                ▼
┌─────────────────────┐     ┌─────────────────────┐
│ Firebase Project    │     │ Firebase Project    │
│ aetheria-dev        │     │ aetheria-prod       │
├─────────────────────┤     ├─────────────────────┤
│ • Firestore rules   │     │ • Firestore rules   │
│ • Auth (dev)        │     │ • Auth (prod)       │
└─────────────────────┘     └─────────────────────┘

Web app (Cloudflare Pages, independent of the above):
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages git integration                            │
│  ↓ (own push trigger, not GitHub Actions)                    │
│  Static build + functions/api/ (ai-proxy, feedback-validate) │
└─────────────────────────────────────────────────────────────┘
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

These four are the only secrets `deploy.yml` reads (the `deploy-rules` job — GitHub Actions deploys
Firestore rules only, never the web app):

| Secret Name | Environment | Description |
|-------------|-------------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_DEV` | Development | Service account JSON for dev project |
| `FIREBASE_PROJECT_ID_DEV` | Development | e.g., `aetheria-dev` |
| `FIREBASE_SERVICE_ACCOUNT_PROD` | Production | Service account JSON for prod project |
| `FIREBASE_PROJECT_ID_PROD` | Production | e.g., `aetheria-prod` |

> `GEMINI_API_KEY`, `FIREBASE_WEB_API_KEY`, `ALLOWED_ORIGINS`는 GitHub Actions가 아닌
> **Cloudflare Pages 프로젝트의 Environment variables**에 설정합니다. 서버 전용 값이며
> 클라이언트 빌드에 노출되지 않습니다. 자세한 설정 위치는
> [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) 참고.

### Important: GitHub Environment Setup
To avoid "Value 'development' is not valid" (or 'production') errors in your workflows and IDE:
1. Go to **Settings** > **Environments** in your GitHub repository.
2. Click **New environment**.
3. Create two environments: `development` and `production`.
4. (Optional) Add environment-specific secrets here instead of repository secrets if preferred.

## Deployment Flow

### Firestore rules (this repo's GitHub Actions)

- Development
  1. Push to `develop` branch
  2. `deploy.yml`'s `deploy-rules` job deploys `firestore.rules` to the dev Firebase project
  3. Test new rules against the dev project

- Production
  1. Merge `develop` → `main` via PR
  2. `deploy.yml`'s `deploy-rules` job deploys `firestore.rules` to the prod Firebase project
  3. New client writes are no longer rejected by stale rules (Wave 13 E4 asymmetry: new rules accept
     old clients, old rules reject new clients — rules must land before/with the client that needs them)

### Web app (Cloudflare Pages, separate from GitHub Actions)

Cloudflare Pages' own git integration builds and deploys the static app plus
`functions/api/` on every push, independent of this repository's workflows. See
[QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for the Cloudflare-side setup and rollback via the
Cloudflare dashboard (Pages project → Deployments → "Rollback to this deployment").

## Firestore Rules Separation

Each project has independent Firestore rules:
- Dev: More permissive for testing
- Prod: Strict security rules

## Monitoring

- Dev: Console logs, debug mode enabled
- Prod: Error tracking, performance monitoring, alerts
