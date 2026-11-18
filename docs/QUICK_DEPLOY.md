# 웹 배포 (Cloudflare Pages)

공개 웹 주소는 `https://aetheria-roguelike.pages.dev`다. 서버 쪽 코드는 `functions/api/`의 Cloudflare Pages Functions이고, 의견 보내기는 별도 함수 없이 클라이언트가 Firestore에 직접 쓴다(rules가 검증한다).

> **이 Pages 프로젝트는 GitHub와 연결돼 있지 않다**(2026-10-29 확인 — 그 뒤 배포는 모두 손으로 했다). `main`에 머지해도 공개 주소는 바뀌지 않는다 — 공개 주소는 **마지막으로 손으로 올린 빌드**다. `main` 머지로 도는 `Deploy Aetheria RPG` 워크플로는 빌드 확인과 Firestore 규칙 배포뿐이다([근거](legal/PRIVACY_POLICY_EVIDENCE.md)).
>
> 그래서 테스터에게 공개 주소를 줄 때는 지금 어느 커밋이 올라가 있는지 먼저 확인한다(아래 "올라간 빌드 확인"). 머지 뒤 다시 올리지 않았다면 옛 빌드를 시험하게 된다. 소유자 플레이테스트는 공개 주소가 아니라 로컬 저장 빌드로 한다([플레이테스트 자료](qa/HUMAN_PLAYTEST_KIT_2026-11.md) §2).

## 1. 프로덕션에 올리기 (지금 쓰는 방법)

공개 주소 · 미리보기 주소 모두 소유자 승인 뒤에 올린다.

```bash
# 1. main 최신으로 맞추고 빌드한다. 출시 범위에서는 AI 이벤트를 끈다 —
#    로컬 .env가 켜 둘 수 있으므로 명령에서 끈다(Vite는 이미 있는 환경 변수를 .env보다 앞에 둔다).
git switch main && git pull --ff-only
VITE_USE_AI_PROXY=false npm run build

# 2. 올린다. --branch=main이어야 프로덕션이다(다른 이름이면 미리보기 주소가 된다).
npx wrangler@4.162.0 pages deploy dist --project-name=aetheria-roguelike --branch=main --commit-hash="$(git rev-parse HEAD)"
```

- 처음 실행하면 Cloudflare 로그인(브라우저 인증)을 요구한다.
- `--commit-hash`를 붙여야 대시보드의 배포 목록에서 어느 커밋인지 보인다.
- 처리방침(`public/privacy/`)도 이 빌드에 들어간다. 처리방침을 고쳤으면 같은 절차로 다시 올린다([토스 런북](qa/APPS_IN_TOSS_SANDBOX_RUNBOOK.md) 표 7번 줄).

**배포 기록.** 첫 프로덕션 배포 2026-10-29(소스 `d023df7`). 가장 최근은 2026-11-18 `main` `988ab2a1`(PR #235 마을 무대 · 지도 큰 칸까지, 배포 `33655c02`)이고, 그 직전은 2026-11-17 `ab198691`(PR #230 미믹 고위험 고보상까지, 배포 `6dc5ad8a`)다. 올릴 때마다 원장이나 PR 설명에 커밋 · 배포 id를 남긴다.

## 2. 올라간 빌드 확인

머지됐다고 웹에 나간 것이 아니다. 공개 번들을 직접 본다.

```bash
npx wrangler@4.162.0 pages deployment list --project-name=aetheria-roguelike
```

프로덕션 줄의 커밋이 의도한 커밋인지 본다. 화면으로 확인하려면 공개 주소를 열어 이번에 넣은 기능의 문구가 있는지 본다.

## 3. 미리보기 주소 (테스트용)

`--branch`를 `main`이 아닌 이름으로 주면 `https://<이름>.aetheria-roguelike.pages.dev` 미리보기 주소가 생기고 프로덕션은 그대로다. 미리보기도 같은 Firebase 프로젝트를 쓰므로 클라우드 저장 · 순위표가 운영 데이터에 섞인다 — 섞이면 안 되는 테스트는 로컬 저장 빌드를 올린다([플레이테스트 자료](qa/HUMAN_PLAYTEST_KIT_2026-11.md) §2의 안 A).

## 4. AI 이벤트를 켜려면 (지금은 끈다)

출시 범위에서는 AI 이벤트를 끈다(소유자 결정 2026-10-29). 켜려면 먼저 [근거 문서](legal/PRIVACY_POLICY_EVIDENCE.md) §2-3을 닫고 처리방침의 AI 항목을 되살린다([토스 런북](qa/APPS_IN_TOSS_SANDBOX_RUNBOOK.md) 표 9번 줄). 그 뒤 빌드를 `VITE_USE_AI_PROXY=true`로 하고, 대시보드의 **Settings → Environment variables**에 서버 변수를 넣는다.

| 변수명 | 설명 |
|--------|------|
| `GEMINI_API_KEY` | Gemini API 키 (서버 전용) |
| `FIREBASE_WEB_API_KEY` | Firebase Web API Key (ID 토큰 검증용, 서버 전용) |
| `ALLOWED_ORIGINS` | (선택) CORS 허용 origin 목록, 콤마로 구분. 없으면 전체 허용 |

클라이언트 변수(`VITE_USE_AI_PROXY` · `VITE_AI_PROXY_URL` · `VITE_FIREBASE_CONFIG`)는 빌드할 때 읽히므로 대시보드가 아니라 빌드 명령의 환경에 둔다 — 손으로 올리는 배포에서는 대시보드의 빌드 변수가 쓰이지 않는다.

## 5. 로컬에서 Pages Functions 시험

`functions/api/*.js`는 `npm run dev`(Vite)에서 돌지 않는다. Functions까지 보려면:

```bash
npm run build
npx wrangler@4.162.0 pages dev dist --compatibility-date=2026-01-01
```

환경 변수는 `--binding` 플래그나 `.dev.vars` 파일(`GEMINI_API_KEY=...`)로 준다.

## 6. GitHub 연결 (하지 않았다)

Cloudflare 대시보드의 **Connect to Git**으로 연결하면 머지마다 자동으로 올라간다. 지금 연결하지 않은 이유는 두 가지다: 머지가 곧 공개가 되면 소유자가 공개 시점을 고를 수 없고, 빌드 명령에서 AI를 끄는 것을 대시보드 빌드 설정이 대신 지켜야 한다. 연결하려면 소유자 결정이 필요하고, 연결한 뒤에는 이 문서의 1 ~ 2절과 [플레이테스트 자료](qa/HUMAN_PLAYTEST_KIT_2026-11.md) §2를 함께 고친다.
