# ⚡ 친구들에게 3분 만에 무료 배포하기 (Cloudflare Pages)

Aetheria RPG를 친구들이 인터넷으로 접속해서 할 수 있도록 가장 쉽고 빠른 배포 방법을 안내합니다.

> **2026-07 업데이트**: 배포 플랫폼이 Vercel에서 **Cloudflare Pages**로 이전되었습니다.
> 클라이언트 코드는 변경 없이 `/api/ai-proxy`, `/api/feedback-validate` 상대 경로를 그대로 호출하며,
> 서버 로직은 `functions/api/`의 Cloudflare Pages Functions가 담당합니다.

## 준비물
- GitHub 계정 (또는 Cloudflare 계정)
- 현재 프로젝트 코드

## 방법 1: Cloudflare 대시보드에서 GitHub 연동 (추천)

1. [Cloudflare 대시보드](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. GitHub 계정을 연결하고 이 저장소(`aetheria-roguelike`)를 선택합니다.
3. 빌드 설정을 아래와 같이 입력합니다.
   - **Framework preset**: `Vite` (또는 None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables (Production)** 섹션에 아래 값을 등록합니다.

   | 변수명 | 설명 |
   |--------|------|
   | `GEMINI_API_KEY` | Google AI Studio에서 발급받은 Gemini API 키 (서버 전용) |
   | `FIREBASE_WEB_API_KEY` | Firebase 프로젝트의 Web API Key (ID 토큰 검증용, 서버 전용) |
   | `ALLOWED_ORIGINS` | (선택) CORS 허용 origin 목록, 콤마로 구분. 미설정 시 전체 허용 |
   | `VITE_USE_AI_PROXY` | `true` — AI 프록시 사용 여부 (클라이언트 빌드 타임) |
   | `VITE_AI_PROXY_URL` | `/api/ai-proxy` (기본값과 동일하므로 생략 가능) |
   | `VITE_FIREBASE_CONFIG` | Firebase 클라이언트 설정 JSON 전체 (따옴표 주의) |

   - *팁: Firebase Config가 복잡하면 로컬 코드에 하드코딩된 상태로 그냥 올려도 테스트엔 문제없습니다.*
5. **Save and Deploy** 클릭!

배포가 끝나면 `https://<project-name>.pages.dev` 주소가 발급됩니다. 이 주소를 친구에게 공유하세요.

## 방법 2: Wrangler CLI로 배포

```bash
# 1. 빌드
npm run build

# 2. Wrangler로 배포 (devDependency 추가 없이 npx로 바로 실행)
npx wrangler pages deploy dist --project-name=aetheria-roguelike
```

최초 실행 시 Cloudflare 로그인(브라우저 인증)을 요구합니다. 이후 환경변수는 대시보드의
**Settings → Environment variables**에서 동일하게 등록해야 `functions/api/*`가 정상 동작합니다.

## 로컬에서 Pages Functions 테스트하기

`functions/api/*.js`는 일반 `npm run dev`(Vite dev server)에서는 실행되지 않습니다
(Vite는 정적 파일만 서빙하며 `/api/*`를 처리하지 않음). Cloudflare Functions까지 포함해
로컬에서 확인하려면:

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2026-01-01
```

`npx`로 실행하므로 별도 devDependency 설치가 필요 없습니다. 환경변수가 필요하면
`--binding` 플래그나 `.dev.vars` 파일(`GEMINI_API_KEY=...` 형태)을 사용하세요.

## ✅ 확인사항

- 친구들이 접속하면 `에테르니아의 마력이 소진되었습니다`가 뜨나요? → 할당량(Quota) 문제일 수 있습니다. (기본 50회)
- AI가 응답을 안 하나요? → Cloudflare Pages 프로젝트의 **Settings → Environment variables**에
  `GEMINI_API_KEY`, `FIREBASE_WEB_API_KEY`가 설정되었는지 확인하세요.
- `/api/ai-proxy` 호출이 404가 나나요? → `functions/api/ai-proxy.js` 파일이 저장소에 커밋되어
  있고, Pages 빌드 로그에 Functions가 감지되었는지 확인하세요.
