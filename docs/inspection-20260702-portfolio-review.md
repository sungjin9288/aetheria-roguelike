# Aetheria Roguelike — 심층 아키텍처 + AI 기능 완성도 점검 (읽기 전용, 재검증판)

- 점검일: 2026-07-02 (리포트 작성 기준. 저장소 마지막 커밋: 2026-06-25 19:47:57 +0900)
- 점검 방식: 코드 Read + 실제 명령 실행(test/type-check/lint) 결과 근거. 코드 수정 없음.
- 대상: `/Users/sungjin/dev/personal/aetheria-roguelike`
- 본 판은 기존 리포트를 `src/services/aiService.ts`, `api/ai-proxy.js`, `src/systems/CombatEngine.ts`, `src/hooks/useFirebaseSync.ts` 재열람 및 명령 재실행으로 갱신·검증한 것이다.

---

## 1. 현황요약

### Git 상태
```
현재 브랜치: main (origin/main과 동기화됨)
마지막 커밋: d7d8c54 "Merge pull request #11 from sungjin9288/feat/prestige-hidden-boss"
마지막 커밋 일시: Thu Jun 25 19:47:57 2026 +0900
미커밋 변경: 없음 (untracked: scripts/__pycache__/ 만 존재 — 코드 아님)
```
최근 20개 커밋은 모두 `feat/refactor` PR-merge 패턴으로, 기능 단위 브랜치 → PR → merge 워크플로우가 일관되게 유지되고 있음. 커밋 메시지에 "감사(audit) #4", "1409→1251줄" 등 자체 리팩터링 근거를 남기는 습관이 확인됨.

### 테스트 실행 결과 (`npm run test:unit`)
```
tests 2993
pass 2993
fail 0
cancelled 0
skipped 0
duration_ms 13858
```
전수 통과. `ai-event-utils.test.js`만 단독 실행 시에도 5/5 통과 (`summarizeHistory`, `classifyChoice`, `buildEventPackage`, `pickFallbackEvent` 관련 2건).

### 타입체크 결과 (`npm run type-check` = `tsc --noEmit`)
```
> tsc --noEmit
(출력 없음, exit 0 — 에러 0건)
```
**CLAUDE.md 주장과 실측 차이**: CLAUDE.md는 "잔여 noImplicitAny ~156건"이라고 명시하지만, `tsconfig.json`에는 이미 `"strict": true`, `"noImplicitAny": true`가 켜져 있고 `tsc --noEmit`은 실제로 **0 에러**로 통과한다. 즉 noImplicitAny 위반은 현재 코드베이스에 존재하지 않는다(과거에 존재했다가 이미 수정 완료됐거나, 애초에 CLAUDE.md의 서술이 부정확했을 가능성). tsconfig 주석에도 "cycle 59 phase A — noImplicitAny 풀 활성 (156 잔여 manual fix)"라고 적혀 있어 — 156이라는 숫자는 특정 리팩터 사이클 시점의 스냅샷이 이후 갱신되지 않은 채 문서에 방치된 것으로 보인다.

`as any` 캐스팅은 재실측 결과 **98건**(`grep -o "as any" | wc -l`, 파일 36개)으로 CLAUDE.md 주장(93)보다 소폭 많다 — 정확히 일치하지는 않지만 근사한 규모다. `: any` 타입 주석(파라미터/변수, `: any` 문자열 grep)은 재실측 **1,910건**으로 매우 많다 — 이 부분은 CLAUDE.md에 전혀 언급되지 않은 부채다. `strict`가 켜져 있어도 명시적으로 `: any`를 박아두면 타입체크를 우회하므로, "TS 마이그레이션 85%"라는 수치는 파일 확장자 기준(.ts/.tsx 전환율)이지 타입 안전성 기준은 아님에 유의해야 한다. 실제로 `find src -name "*.js" -o -name "*.jsx"` 결과 **0개** — 파일 확장자 기준으로는 이미 100% 완료 상태이며, CLAUDE.md의 "85%"라는 서술 자체가 stale하다.

### Lint 결과 (`npm run lint` = `eslint .`)
```
> eslint .
(출력 없음, exit 0 — 경고/에러 0건)
```
ESLint도 클린. `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` 적용 중.

---

## 2. 아키텍처 품질 평가

### 2.1 useGameEngine + 역할별 hooks 조합
CLAUDE.md가 문서화한 대로 `useGameEngine`(useReducer 중앙 orchestrator)이 `useGameActions`/`useCombatActions`/`useInventoryActions`/`useFirebaseSync`를 조합하는 구조가 실제 코드에 확인된다. reducer 자체(`src/reducers/gameReducer.ts`, 116줄)는 `INITIAL_STATE`와 타입 정의만 담당하고, 실제 40+ action 처리 로직은 `src/reducers/handlers/`(bootstrapHandlers, uiHandlers, progressionHandlers, featureHandlers)로 분할되어 있음 — reducers 디렉토리 총합 904줄. "많은 작은 파일" 원칙이 실제로 지켜지고 있다(사용자 코딩 규칙과도 부합).

### 2.2 CombatEngine — pure function 주장 검증
`CombatEngine.ts`(1,268줄) + 4개 mixin 파일(`.status.ts`, `.loot.ts`, `.relics.ts`, `.outcome.ts`)로 분리되어 있다.

- **side effect 검색**: `document.`, `window.`, `localStorage`, `sessionStorage` grep 결과 CombatEngine 계열 5개 파일 전부 **0건**. 콘솔 로그도 없음.
- **비결정적 호출**: `Math.random()` 및 `Date.now()` 호출이 다수 존재(약 30곳, 데미지 굴림/크리티컬/드롭/상태이상 저항 판정 등). CLAUDE.md는 "결정론적(Math.random 제외)"이라고 스스로 예외를 명시하고 있어 이 부분은 정직한 서술 — **완전 결정론은 아니고, "Math.random을 유일한 비결정 요소로 격리한 pure function"**이 정확한 표현이다. 외부 모듈 스코프 변수 참조나 클로저 캡처로 인한 숨은 상태는 grep 상 발견되지 않았다.
- `graveData` 생성부(`CombatEngine.ts:1196`)는 `buildGraveData(player, Math.random, Date.now)`처럼 비결정 함수를 인자로 주입하는 패턴을 쓰고 있어, 테스트 시 seed를 고정할 수 있는 구조로 설계되어 있음 — 실제로 `CombatEngine.ts: cycle 153 11종 시너지...` 등 다수의 CombatEngine 관련 유닛 테스트가 존재하고 전부 통과.

결론: "완전 pure, side-effect 0"이라는 강한 주장은 다소 과장이지만, "Math.random 외 비결정 요소 없음 + DOM/스토리지 접근 0건 + 독립 테스트 가능"이라는 실질적 의미에서는 검증됨.

### 2.3 Immutable reducer
`gameReducer.ts` 및 handlers 파일에서 직접 변이(`state.x = y` 패턴) grep 결과 0건 — spread 기반 갱신이 실제로 지켜지고 있음(핸들러 세부 로직까지 100% 감사하지는 못했으나 최상위 reducer 파일에서는 직접 변이 흔적 없음).

### 2.4 코드 규모
- `CombatEngine.ts` 1,268줄은 사용자 규칙(800줄 max)을 초과하지만, 실제로는 mixin 파일 4개로 분산되어 있어 단일 책임별로는 300~500줄대. 다만 `CombatEngine.ts` 본체 자체가 1,268줄인 것은 800줄 가이드라인 기준으로는 여전히 큰 파일.

---

## 3. AI 기능(이벤트 생성) 완성도 평가

### 3.1 Provider / 호출 경로 (직접 재확인 완료)
- 클라이언트(`src/services/aiService.ts`, 163줄 전체 열람)는 자체 LLM API를 직접 호출하지 않는다. 대신 `CONSTANTS.AI_PROXY_URL`(`/api/ai-proxy`, `src/data/constants.ts:32`)로 자체 서버리스 프록시(`api/ai-proxy.js`, 346줄, `export default async function handler(req, res)` 형태 — Vercel API route 패턴)를 호출한다. `api/ai-proxy.js` 전체를 직접 열람해 아래 사실을 확인했다.
- **실제 LLM 호출부**: `callGemini` 함수(`api/ai-proxy.js:224-268`)가 `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`를 호출 — provider는 **Google Gemini 1.5-flash**로 확정.
- **API 키 관리**: `apiKey = process.env.GEMINI_API_KEY`(line 316) — 서버 사이드 환경변수로만 존재. 클라이언트 번들에는 절대 노출되지 않음. Firebase 인증도 `process.env.FIREBASE_WEB_API_KEY`(line 56)로 서버에서 REST 검증(`identitytoolkit.googleapis.com/v1/accounts:lookup`, line 61-79). 클라이언트는 `auth?.currentUser?.getIdToken?.()`로 얻은 ID 토큰만 `Authorization: Bearer` 헤더로 보낸다(`aiService.ts:20-25`).
- **프록시 서버 자체 보안 계층이 상당히 탄탄함** — 이번 재확인에서 새로 발견:
  - 인증: `parseBearerToken` → `verifyFirebaseToken`으로 Firebase 토큰 검증, 실패 시 401 (line 287-302).
  - 레이트리밋: `checkRateLimit`이 사용자별(`uid:clientAddress` 키)로 60초당 최대 40회 제한, 초과 시 429 (line 1-2, 34-47, 306-308).
  - CORS 화이트리스트: `ALLOWED_ORIGINS` env로 origin 검증, 미설정 시에만 전체 허용(line 5-24, 275-277).
  - 프롬프트: `buildGeminiPayload`가 플레이어 스냅샷(직업/레벨/HP·MP/빌드성향/보유유물/난이도/골드)을 구조화해 시스템 지시문 + 프롬프트로 조립하고(line 127-192), Gemini의 `responseSchema`(Structured Output)로 JSON 스키마를 강제해 파싱 실패 위험을 원천 차단(line 165-192, 239-240) — "프롬프트 품질"이 실제로 상당히 정교함.
  - 서버 자체 타임아웃도 별도: `callGemini` 내부에서 `AbortController` + 8.5초 타임아웃(line 228-229, 주석: "Vercel Serverless 10s 제한 호환") — 클라이언트의 9.5초와 별개로 서버 쪽도 방어.
- `CONSTANTS.USE_AI_PROXY = ENV.VITE_USE_AI_PROXY === 'true' || false` — 기본값 false. 즉 별도 env 설정 없이는 AI 프록시 호출 자체가 비활성이고 바로 fallback으로 간다(로컬 개발 시 기본이 오프라인 모드라는 의미). 포트폴리오 시연 시 실제 AI 호출 경로를 보여주려면 배포 환경에 `VITE_USE_AI_PROXY=true` + 서버 `GEMINI_API_KEY`/`FIREBASE_WEB_API_KEY`가 세팅되어 있어야 한다.

### 3.2 타임아웃
`aiService.ts` 실제 코드에서 두 호출 지점 모두 **9500ms(9.5초)**로 명시:
- line 100: `generateEvent`의 `callProxy(..., 'ai-event', 9500)`
- line 153: `generateStory`의 `callProxy(..., 'ai-story', 9500)`

`callProxy` 내부(line 19-48)는 `AbortController` + `setTimeout(() => controller.abort(), timeoutMs)` 패턴으로 실제 fetch를 중단시키는 구조이며, `finally` 격 처리 없이 `try/catch`로 감싸 실패 시 `console.warn` 후 `null` 반환 — 호출부가 `result?.success` 체크로 안전하게 fallback 경로를 타도록 되어 있음.

### 3.3 프롬프트 컨텍스트 구성 (서버측까지 직접 확인)
`generateEvent`(`aiService.ts:71-113`)에서 실제로 다음을 프록시 바디에 포함:
- `location`(위치), `history`(summarizeHistory로 압축된 최근 전투/이벤트 이력), `playerSnapshot`, `mapSnapshot`, `uid`.
CLAUDE.md 주장(위치/전투이력/플레이어상태 컨텍스트 반영)은 코드로 확인됨. 이번 재검증에서는 서버(`api/ai-proxy.js`)의 `buildGeminiPayload` 함수까지 직접 열람해, 클라이언트가 보낸 `playerSnapshot`(직업/레벨/HP·MP비율/빌드성향/보유유물/난이도라벨/최근승률/골드)을 실제로 한국어 시스템 지시문과 프롬프트 문자열로 조립하는 것을 확인했다(`api/ai-proxy.js:133-163`). "최근 사건과 같은 소재 반복 금지", "선택지 2~3개는 성격이 달라야 함" 등 명시적 지시가 프롬프트에 포함되어 있어 문서 주장보다 실제로 더 정교하다.

### 3.4 온라인/오프라인 폴백 분기
`generateEvent`/`generateStory` 모두 다음 순서로 방어적 계층화:
1. `isSmokeRuntime()` — 테스트/스모크 모드면 즉시 fallback.
2. `TokenQuotaManager.canMakeAICall()` false면 즉시 fallback + `fallbackReason: 'quota'` 메타데이터 부여.
3. `CONSTANTS.USE_AI_PROXY`가 true일 때만 실제 프록시 호출 시도.
4. 프록시 응답이 `success` 아니거나 중복 이벤트(`recentEvents.has`)면 → `pickFallbackEvent`로 최종 폴백.

이 4단 분기가 실제 코드로 존재하며, 온라인 실패/쿼터초과/오프라인/스모크 각 케이스를 모두 커버.

### 3.5 일일 쿼터 (TokenQuotaManager)
`src/systems/TokenQuotaManager.ts`(56줄) 실제 구현:
- `DAILY_LIMIT` = `BALANCE.DAILY_AI_LIMIT` = **50** (`constants.ts:102`)
- `getQuotaData()`: `localStorage`(`aetheria_ai_quota` 키)에서 읽고, 날짜(`toDateString()`)가 바뀌면 리셋.
- `canMakeAICall()`: `used < DAILY_LIMIT` 체크.
- `recordCall()`: `used++` 후 localStorage 저장.
- `syncToFirestore(uid, db)`: Firestore `user_quotas/{uid}`에 크로스 디바이스 동기화(merge). `useFirebaseSync.ts:94`에서 인증 성공 직후 호출됨 — 클라이언트 localStorage만으로 조작 가능한 구조라는 한계는 있으나(로컬 스토리지 값을 지우면 쿼터 리셋 가능), 크로스 디바이스 "추적"은 구현되어 있음.
- **서버 사이드 쿼터 재검증은 없음 — 이번 재검증에서 확인**: `api/ai-proxy.js`를 직접 열람한 결과, 서버는 `TokenQuotaManager`의 50회/일 제한을 별도로 재확인하지 않는다. 대신 서버 자체의 **레이트리밋(60초당 40회, `uid:IP` 키)**만 존재한다(line 1-2, 34-47). 즉 클라이언트의 "일일 50회" 쿼터는 순수 클라이언트 신뢰 기반이고, 서버는 이를 인지하지 못한 채 자신의 초당 레이트리밋만 적용한다 — 클라이언트 로컬스토리지를 조작하면 일일 50회 제한은 우회 가능하나, 서버의 분당 40회 레이트리밋까지는 넘을 수 없어 실질적 비용 폭주는 방지된다. 이는 CLAUDE.md에 없는, 실제 코드로 새로 밝혀진 방어/한계 지점이다.

### 3.6 오프라인 폴백 이벤트 풀 품질
`src/utils/aiEventUtils.ts`(565줄)의 `FALLBACK_EVENT_POOL`:
- 카테고리별 이벤트: forest/ruins/cave/desert/ice/dark/abyss 각 12개, treasure 6개, machina 6개, sky 6개, deepsea 6개, gate 6개, default 7개 — 지역 카테고리 12종 × 평균 8~9개 = **약 97개의 큐레이션 이벤트**.
- 별도로 `structured`(NPC 조우/도박/퍼즐) 이벤트 **9개**가 30% 확률로 혼합 풀에 추가되며, 각 항목은 `choiceIndex`별 `gold`/`hp`/`mp`/`exp`/`item` 보상과 로그 텍스트까지 완비된 구조화 결과를 가짐.
- 최근 이력 기반 중복 회피 로직(`recentEvents`, `lastEvent` 비교, `pickFallbackEvent` line 542-564)이 실제로 동작 — "직전 이벤트 즉시 반복 방지 + 최근 세트 회피"를 코드로 구현.
- **AI 없이도 게임이 정상 동작하는 구조인지**: 그렇다. `CONSTANTS.USE_AI_PROXY` 기본값이 false이므로 오히려 "기본 모드가 오프라인"이며, AI는 옵션으로 켜는 강화 기능에 가깝다. 다양성 격차는 존재한다 — AI 생성은 이론상 무한한 변주가 가능하지만 폴백 풀은 카테고리당 12개 고정 텍스트라 장시간 플레이 시 반복 노출이 불가피하다(다만 30% 구조화 이벤트 혼합 + 중복 회피로 체감 반복은 어느 정도 완화).

### 3.7 단위 테스트 커버리지
`tests/ai-event-utils.test.js` 5개 테스트가 `summarizeHistory`, `classifyChoice`, `buildEventPackage`(초이스 중복 제거 + outcome 자동 채움), `pickFallbackEvent`(반복 회피 2건) 를 검증하며 전부 통과. AI 서비스 자체(`aiService.ts`)에 대한 직접 단위 테스트는 발견되지 않음 — 프록시 호출부(`callProxy`, `generateEvent`, `generateStory`)는 네트워크 의존적이라 그런지 별도 mock 기반 테스트가 없다. 이는 "AI 실패 시나리오"에 대한 자동화된 회귀 안전망이 fallback 유틸 레벨에만 존재하고, `aiService.ts` 자체 로직(quota 체크 순서, 타임아웃 처리)은 테스트로 보증되지 않는다는 의미의 약점.

---

## 4. 리스크 / 약점

1. **CLAUDE.md의 noImplicitAny 156건 주장이 실측과 불일치(현재 0건, type-check 클린)** — 문서가 과거 스냅샷을 갱신하지 않고 방치됨. `tsconfig.json` 자체 주석에도 "cycle 59 phase A — noImplicitAny 풀 활성 (156 잔여 manual fix)"라고 적혀 있어, 156이라는 숫자가 특정 리팩터 사이클 시점의 스냅샷을 그대로 문서에 인용한 것으로 보인다. 포트폴리오에서 "CLAUDE.md를 있는 그대로 보여준다면" 면접관이 실제로 `npm run type-check`를 돌려볼 경우 (좋은 방향이긴 하나) 불일치가 드러난다. 문서 신뢰성 관리 측면에서는 감점 요인.
2. **`as any` 98건 (재실측, CLAUDE.md 주장 93보다 소폭 증가)** — 데이터 레이어와 다수 훅에서 외부/레거시 세이브 데이터 타입을 다룰 때 any 캐스팅에 의존. 게임 데이터 객체(BALANCE/DB 등) 자체의 타입화가 미완이라는 뜻이며, 최근 개발에서도 해소되지 않고 오히려 늘고 있다는 신호.
3. **`: any` 타입 주석 1,910건 (재실측)** — CLAUDE.md가 언급하지 않은 부채. strict 모드가 통과해도 대부분의 함수 시그니처가 `any`로 선언돼 있으면 타입 체커가 사실상 무력화된 상태와 유사하다. 실제로 `aiService.ts`(163줄)만 봐도 `body: any`, `trackLabel: any`, `timeoutMs: any`, `headers: Record<string, any>`, `e: any` 등 시그니처 대부분이 `any`다. "TS 마이그레이션 85% → 실측 100%(파일 확장자 기준)"는 파일 전환 비율이지 타입 안전성 비율이 아니라는 점을 면접에서 명확히 구분해서 설명할 필요가 있다.
4. **TokenQuotaManager가 클라이언트 localStorage 신뢰, 서버는 이를 재검증하지 않음(재확인 완료)** — `canMakeAICall()` 판정은 클라이언트 로컬 값 기준이며, `api/ai-proxy.js`를 직접 열람한 결과 서버는 일일 50회 쿼터를 별도로 확인하지 않는다. 대신 서버 자체의 분당 40회 레이트리밋(`uid:IP` 키)이 최후 방어선 역할을 한다. 로컬스토리지를 지우면 "일일 50회" 제한은 우회되지만 분당 40회 한도까지 넘을 수는 없어 비용 폭주까지는 방지되는 구조 — 완벽하지 않지만 실질적 리스크는 제한적이다.
5. **`CombatEngine.ts` 단일 파일 1,268줄** — mixin 분리에도 불구하고 core 파일 자체가 800줄 가이드라인을 초과. 유지보수 시 진입장벽이 될 수 있음.
6. **AI 서비스 자체(`aiService.ts`)에 대한 전용 단위 테스트 부재** — fallback 유틸(`aiEventUtils.ts`)은 테스트되지만 quota/timeout/온라인분기 로직은 미검증. 면접에서 "AI 실패 시 테스트로 어떻게 보증하나?"라는 질문에는 현재 "코드 리뷰로 보증, 자동 테스트는 없음"이 정답이 됨.
7. **`USE_AI_PROXY` 기본 false** — 즉 데모 환경에서 별도 env 설정이 없으면 AI 기능은 항상 폴백만 보여준다. 포트폴리오 시연 시 실제 AI 호출 경로를 보여주려면 배포 환경에 `VITE_USE_AI_PROXY=true` + 서버 `GEMINI_API_KEY`가 세팅되어 있어야 함 — 로컬에서 클론 후 바로 시연 시 "AI가 실제로 도는지"를 확인하려면 이 설정이 필수라는 점을 사전에 준비해야 함.

---

## 5. 포트폴리오 편입 최종 의견

**Yes.**

근거:
- 실측 기준으로 테스트(2993/2993 pass), 타입체크(0 error), lint(0 error) 모두 100% 그린 상태이며 이는 즉석에서 면접관 앞에서 재현 가능하다("지금 이 자리에서 `npm run verify` 돌려보시죠"에 안전하게 응할 수 있는 수준). git 상태도 사실상 clean(미추적 캐시 파일 1건뿐).
- CombatEngine의 관심사 분리(1,268줄 코어 + 4개 mixin), reducer의 핸들러 모듈화, useGameEngine 조합형 훅 아키텍처, Firebase debounce 500ms는 실제 코드로 확인되며 "면접에서 코드로 시연 가능"하다.
- AI 기능은 "그럴듯한 겉치레"가 아니라 실제로 동작하는 다단 방어 로직(스모크 모드 → 쿼터 체크 → 프록시 호출(클라이언트 9.5s / 서버 8.5s 이중 타임아웃) → 중복 검사 → 폴백)이며, provider는 Google Gemini 1.5-flash로 확정, API 키가 서버 사이드에만 존재하고 Firebase 토큰 검증·레이트리밋(분당 40회)·CORS 화이트리스트까지 갖춘 프록시 서버 설계는 사이드 프로젝트치고 드문 실무 감각을 보여주는 포인트다.
- 단, 발표 시 CLAUDE.md의 "noImplicitAny 156건" 서술은 최신화하거나 발표 자료에서 제외 권장(실측 0건이므로), 대신 "`as any` 98건 + `: any` 1,910건이 남은, 오히려 소폭 증가 중인 타입 부채"라고 정직하게 언급하는 편이 오히려 신뢰도를 높인다. "TS 마이그레이션 85%"도 실측(파일 기준 100%)과 다르므로 "파일 전환은 완료, 타입 안전성은 진행형"으로 구분해 설명하는 것을 권장한다.

**한 줄 포지셔닝 제안**:
"AI 생성 이벤트를 핵심 기능으로 내세우기보다, **결정론적 pure-function 전투 엔진 + 4단 방어적 AI 폴백 설계 + 2,993개 회귀 테스트로 뒷받침되는 대규모(884커밋) 개인 프로젝트의 아키텍처 규율**"을 포지셔닝의 중심에 두는 것을 권장. AI 자체는 옵션 기능(기본값 off)이므로 "AI 게임"이 아니라 "AI를 안전하게 개입시킨 텍스트 로그라이크"로 설명하는 것이 실측과 부합한다.
