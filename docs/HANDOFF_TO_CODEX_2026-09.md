# Claude → Codex 인수인계 (2026-09-21, `main` = `0bcea0f0`)

> 이 문서는 **영구 이관**용이다. 2026-09-17~21의 Claude 세션(Waves 1~21.1)이 무엇을 했고, 무엇이 코드에 규칙으로 박혔고, 무엇이 남았는지를 Codex가 **이 문서 하나로** 이어받을 수 있게 적는다. 이후 개발은 Codex에서만 진행한다.
> 세부 근거는 전부 `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md`(이하 "원장")의 §번호로 가리킨다 — 이 문서는 지도이고, 원장이 증거다.

---

## 0. 읽는 순서 (첫 세션에서 코드를 만지기 전에)

1. 이 문서 전체.
2. `CLAUDE.md` 전체 — §5(DO/DON'T) · §6(설계 원칙) · §7(계약 테스트) · §8(주의사항 1~11). **전부 실측에서 나온 규칙이고 테스트가 되돌리기를 잡는다.**
3. 원장 §25.1(마지막 재감사 결과 + 소유자 항목 Q4~Q8 + Wave 22 후보) → §25.2(테스트 rng 규칙) → §24.1 "L4 정적 검증".
4. `docs/qa/CODEX_K3_BACK_BUTTON_QA.md` — 첫 작업의 실행 브리프.
5. `tasks/todo.md` 끝의 Wave 5~21.1 요약 줄 17개(각 wave 한 줄) · `tasks/lessons.md`(R1~R27, Codex 시대의 규칙 — 여전히 유효).

---

## 1. 현재 상태 (한 눈에)

| 항목 | 값 | 근거 |
|---|---|---|
| `main` | `0bcea0f0` (PR #50 머지, 2026-09-21 13:53 UTC) | GitHub |
| 열린 PR / 진행 중 브랜치 | 0 / `claude/funny-rubin-xdv43e` = `main`과 동일(더 이상 쓰지 않는다) | — |
| 언어 | TypeScript strict, `src` 명시 `any` 0, `src/types` 인덱스 시그니처 0 | CLAUDE.md §2 |
| 유닛 | 351파일 / **5,170** 케이스 / skip 0 (`npm run test:unit`, ~5분) | 원장 §25.2 게이트 |
| e2e | Playwright 44 스펙 / 121 테스트, chromium 고정, CI 2 shard | `tests/e2e/` |
| CI | `ci.yml` 4 job(Lint+Type-check+Unit · E2E · Perf guard · Firestore rules) 전부 초록 | run 35605861589 |
| 배포 워크플로 | `deploy.yml` = `build` + `deploy-rules`(main push 시 Firestore rules 배포). run 353부터 초록 | CLAUDE.md §8-8 |
| 웹 프로덕션 | Cloudflare Pages(정적) + `functions/api/ai-proxy.js`(Gemini 프록시). **프로덕션에 Functions가 배포돼 있는지는 미확인(Q7)** | `docs/QUICK_DEPLOY.md` |
| 모바일 | Capacitor 8. Android debug APK/iOS unsigned 빌드는 통과 이력 있음. **실기기 QA·서명·스토어 업로드는 미완료** | `docs/MOBILE_RELEASE.md` §5 |
| 세이브 | `DATA_VERSION 5.1`, 봉투 6필드, 복원 불가 모드 폴드 | CLAUDE.md §6·§8-6 |

---

## 2. Claude가 한 일 — wave 지도

원장은 §N = 계획, §N.1 = 실행 결과다. 아래는 주제별 요약이고, 각 줄의 § 안에 실측·결정·정정이 있다.

| 구간 | 주제 | 대표 결과 | 원장 |
|---|---|---|---|
| 1차 감사 + Wave 1~2 | 감사 판정표 G1~G11(확정 11 · 반증 3) 마감 | `spawnEnemy` statusOnHit/phase3 전파, 장비 비교 단일 원천, 희귀도 단일 모듈, 정수 원장 + 거울 확장(`DATA_VERSION 5.1`), 유물 곡선 + pity, 보스 게이지 HUD, 전투 후 2택, **전투 결과 카드가 QA 전용이던 것을 프로덕션 연결**, `useFirebaseSync` 분리 | §1~§6 |
| Wave 3~4 | 타입 슬라이스 2, Tier 2+ 직업 분기 스킬, 베이스 재통합 | `codex/release-complete-core`(main+41)를 베이스로 재구성(merge `45a94ba`), PR #31을 초록으로 | §7~§8, todo "베이스 교정" |
| Wave 5~9 | **타입 닫기** | `any` 1,494→0, 인덱스 시그니처 0, `BALANCE`/`CONSTANTS` 리터럴 도출, `GameAction` = `ActionPayloadMap` 판별 유니온, 데이터 테이블 타입 도출, 래칫→lint 규칙 | §9~§13 |
| Wave 10~11 | **동작 계약** | 전투 턴 authority 매트릭스(27셀), 세이브 왕복 + 골든(74입력), 부트 상태기계(복원 dispatch까지), perf guard CI blocking, 아트 값 해시, AI 폴백 정책 추출(`aiEventPolicy.ts`), 소스 정규식 가드 분류·정책 | §14~§15 |
| Wave 12~15 | **제품 축(접근 비용·시즌·쿼터·rules)** | 접근 비용 리포트(`content-reachability`, schema 4), 시즌 회전=완주 트리거, AI 쿼터=디스패치 미터, 직업 게이트 60→45, 맵 경로 게이트, 체인 완주 게이트 + 승천 이월, rules 에뮬레이터 실행 검증, Lv68 종착 루프, 공개 묘비 gold 클램프, rules 배포 자동화 | §16~§19 |
| Wave 16~18 | **입력 표면·복원 결함** | safe 지역 탐험 3겹 계약(이름 없는 적 스폰 제거), 터미널 명령 = 액션 호출만, 복원 불가 모드 폴드(dead/combat/event) | §20~§22 |
| Wave 19~20 | **AI 이벤트 상태기계·GS 유니온·배포 정리** | `GS.EVENT_PENDING` + 리듀서 정산, `openArchive` 게이트, Capacitor 하드웨어 back(정적 검증까지), `GameMode` 유니온(`GS` 멤버 추가 = 컴파일 에러 3곳), Firebase Hosting job 삭제, 한국어 AST 래칫(JSX 텍스트 포함) | §23~§24 |
| Wave 21 | **재감사(5축 실행 측정)** | 결함 2: AI 프록시 입력 상한(16,384B + 필드 clamp) · `ASCEND`가 묘비를 버리던 것. "없음"이 측정된 축 3 | §25~§25.1 |
| Wave 21.1 | **flaky 경화** | 엔진 rng 미주입 A/B 비교(0.433%/run) 수정, 미시드 128곳 전수 분류 | §25.2 |

**감사 축은 소진됐다**(§25.1). 첫 감사 축(타입·계약·상태 기계·복원·배포)과 재감사 축(플레이어 흐름·관측성·보안 경계·수치 부채·성능) 모두 실행으로 쟀고, 남은 결함은 없다고 **측정**됐다. 다음 결함의 입력은 정적 감사가 아니라 **기기 QA 결과** 또는 **플레이 데이터**다 — 세 번째 정적 감사는 돌리지 말 것.

---

## 3. 코드에 박힌 규칙 — 테스트가 지킨다

CLAUDE.md §5·§7·§8이 정본이다. Codex가 처음 부딪힐 것들만 추린다:

- **수치는 `BALANCE`, 한국어는 `MSG`, 액션은 `AT`, 상태는 `GS`.** 한국어 하드코딩은 `tests/debt-ratchet.test.js` (f)가 디렉터리별 상한(AST, JSX 텍스트 포함)으로 잡는다 — 상한은 하락만 허용.
- **전투 턴은 리듀서 소유**(`combatActionTurn.ts`, seeded). hook에서 `SET_PLAYER`/`SET_ENEMY`를 여러 번 쏘지 말 것. `Math.random` 직접 호출 금지.
- **AI 이벤트 경로는 `BEGIN_AI_EVENT`/`RESOLVE_AI_EVENT`가 소유**(`GS.EVENT_PENDING`). hook이 응답 전에 `SET_GAME_STATE(EVENT)`를 세우면 라이브 벽돌 — `tests/ai-event-pending-contract.test.js`.
- **터미널 명령은 액션 호출만**, 게이트는 액션이 소유 — `tests/command-surface-contract.test.js`. 컴포넌트에서 `setSideTab`+`setGameState` 쌍 금지 — `tests/archive-open-contract.test.js`.
- **복원 불가 모드는 복원하지 않는다**(`restorableMode`, `GameMode` 전수 `switch`/`never`) — `tests/restorable-mode-contract.test.js`. 새 `GS` 멤버는 컴파일러가 3표를 짚지만 **`tests/**`는 `checkJs: false`라 grep 의무가 남는다.**
- **묘비 아이템 읽기는 `getGraveItems()` 경유만**(구형 `item`/신형 `items[]` 두 모양, 마이그레이션으로 정규화 금지) — §8-2.
- **안전지대는 이름이 아니라 `type === 'safe'`**, 그 가드는 체인 트리거 **뒤**에 — §8-3.
- **`CLASSES[*].tier`는 만지지 말 것** — 아트 카탈로그 identity 해시에 묶여 1,065파일이 핀(§8-9). 비용 게이트는 `reqLv`.
- **테스트에서 엔진을 부를 때는 `rng`를 주입** — CLAUDE.md §7, 원장 §25.2.
- **소스 정규식 가드는 부재 불변식에만** 신규 허용. 동작은 실제 모듈을 import해서 단언 — §7 "소스 정규식 가드 정책".
- **데이터↔타입 계약은 런타임 검증**(`tests/data-shape-types.test.js`), 데이터 보존은 값 해시(`tests/helpers/dataHash.ts`).

---

## 4. 결과를 낸 작업 방법 (그대로 쓰면 된다)

Waves 10~21.1이 결함을 찾고 회귀 0으로 닫은 절차다. 순서를 바꾸면 어디가 깨지는지 §에 적혀 있다.

1. **계획을 실행으로 검증한 뒤 착수한다.** "코드를 읽어보니 그럴 것"은 근거가 아니다 — 리듀서를 직접 돌리고(§25 실측 A `scratchpad/flow-driver*.mjs` 패턴), 함수를 직접 호출하고, 빌드 산출물을 grep한다. Wave 19는 후보 4개 중 2개의 전제가 실행에서 틀렸고(§23.1), Wave 20은 착수 전 in-memory `tsc`로 결함 주입 4/4를 증명했다(§24.1).
2. **계약 테스트는 결함 주입으로 red를 먼저 본다.** 공허참 사례: `enemy` 단독 단언(§23.1 K2), 가짜 모양 픽스처(§22), 조기 `return state` 5경로 앞의 deepEqual(§25.1 M2 — `notEqual(ascended, base)` 가드 필요).
3. **트랙은 파일 교차 0으로 나눠 병렬**(Claude는 worktree 서브에이전트 3개까지). 통합자가 cherry-pick → 통합 검사 → 증빙 재생성 → 게이트 → 문서.
4. **증빙 재생성은 순서 고정**: `content --write` → `event-reward --write` → `equipment:combat-power --write` → `pacing:verify`(쓰기 없음) → `progression:diagnostic:write`(마지막) → tracked verify 15종(`art:monsters art content equipment:combat-power equipment:economy event-reward pacing progression:diagnostic relic:dot-multiplier relic:drop-rate relic:event-chance relic:free-skill relic:gold-multiplier relic:hp-drain-atk relic`, 각 `:verify`). **예고 델타**를 먼저 적고 실측과 맞춘다: 보통 `progression-diagnostic-v2.json`의 `sources` sha256만 움직이고 `reportHash`/`v1Baseline`은 불변이어야 한다. 그 밖이 움직이면 멈추고 원인을 적는다.
5. **바이트 핀 파일은 편집 금지**(편집하면 증빙 재고정 = 역사 재작성): `eventActions.ts` · `exploreActions.ts` · `combatHandlers.ts` · `dataMigration.ts` · `_shared.ts` · `constants.ts` · `classes.ts` · `CombatEngine*.ts` · `progressionSimulator.ts` · `progressionDiagnostic.ts`. 밸런스를 바꿔야 하면 그건 **별도 wave**이고 §14~§16의 재고정 절차를 따른다.
6. **게이트**: 기본 `npm run verify`(type-check·lint·unit·build:guard, ~6분). 코드 변경이 있는 wave는 `verify:full`급(e2e 121 + perf desktop/mobile)까지 로컬에서 직렬로 돌린 뒤 PR. **게이트 실행 중 저장소를 건드리는 다른 명령을 병렬로 돌리지 말 것**(증빙 파일 경합).
7. **문서 3곳을 같은 커밋 묶음에서 갱신**: 원장 §N.1(실측·정정·다음 후보) · CLAUDE.md(규칙이 됐으면 해당 §) · `tasks/todo.md` 끝에 wave 한 줄. CLAUDE.md §3의 테스트 수(파일/케이스)는 게이트 결과로 갱신.
8. **PR → CI 초록 → merge commit**(squash/rebase 금지, 이력 전부 merge commit). 머지 뒤 작업 브랜치는 `origin/main`에서 재시작. 커밋 메시지·PR·주석에 모델명 금지.

---

## 5. 함정 목록 (전부 실제로 밟은 것)

- **CI만 붉고 로컬은 초록이면 flaky를 먼저 의심**하되 "flake"를 원인으로 적지 말 것 — 실패 테스트를 찾아 확률을 **잰다**(§25.2: 20만 회 시뮬레이션). CI 로그는 TAP이라 실패가 중간에 묻힌다: `not ok`를 grep(200줄 tail에는 없었다, 6,000줄에 있었다).
- **`android:debug`는 gradlew만 돈다.** 새 플러그인·새 클론 뒤에는 `android:sync` → `android:debug`. sync 없이 빌드하면 `@capacitor/app`이 등록되지 않아 뒤로가기가 조용히 '앱 종료'로 되돌아간다(CLAUDE.md §4).
- **`deploy-rules`가 붉으면 코드가 아니라 IAM/시크릿이다.** SA는 `firebase-adminsdk-fbsvc@aetheria-rpg-90a2f.iam.gserviceaccount.com`이고 `Service Usage Consumer` + `Firebase Rules Admin` 두 역할이 함께 필요하다(§8-8). `deploy.yml`의 시크릿 선택은 셸 분기 — 식 안의 `A && B || C`로 바꾸지 말 것(PROD가 비면 조용히 DEV로 배포된다).
- **세이브 봉투 밖 상태를 화면 조건으로 쓰는 모드**는 복원하면 영구 벽돌(§8-6). 새 모드를 만들면 `restorableMode`에 줄을 추가해야 컴파일된다.
- **grep 출현 횟수 ≠ 호출 수.** 인자 개수로 세어야 시드된 호출을 뺀다(§25.2 — "80곳"이 실제 128곳).
- **`isAiThinking`을 렌더 조건으로 쓰지 말 것** — 생산자가 둘이라 무관한 카드를 9.5초 덮는다(§6).
- **evidence 자기치유 없음**(Wave 14 F1): verify 스크립트는 파일을 고치지 않는다. 붉으면 원인을 찾는 것이지 `--write`를 다시 돌리는 게 아니다.
- **Pillow 버전이 아트 재현성 테스트 결과를 바꾼다**(§6 환경 메모). CI는 `Setup Python art runtime` 스텝의 버전을 쓴다 — 로컬에서 아트 테스트가 붉으면 버전을 먼저 본다.
- **worktree 서브에이전트는 `origin/main`에서 분기한다** — 로컬 커밋(계획 문서 등)이 안 보인다. 경로를 프롬프트로 넘긴다. worktree에는 `node_modules`가 없다(심볼릭 링크).

---

## 6. 인프라·소유 사실 (값은 저장소 밖, 이름만 적는다)

| 것 | 사실 |
|---|---|
| Firebase 프로젝트 | `aetheria-rpg-90a2f` (Auth 익명 + Firestore). rules는 `firestore.rules`, 배포는 `deploy.yml` `deploy-rules`(main push) |
| GitHub secrets | `FIREBASE_PROJECT_ID_DEV/PROD`, `FIREBASE_SERVICE_ACCOUNT_DEV/PROD`. prod SA는 콘솔 "새 비공개 키 생성"이 발급한 `firebase-adminsdk-…` |
| 웹 호스트 | Cloudflare Pages(`docs/QUICK_DEPLOY.md`). Functions env: `GEMINI_API_KEY`, `FIREBASE_WEB_API_KEY`, `ALLOWED_ORIGINS`. 클라이언트 빌드 타임 `VITE_USE_AI_PROXY`(기본 false → `proxy-disabled` 폴백) |
| 레거시 | Firebase Hosting 사이트 `aetheria-rpg-90a2f.web.app`는 2026-07-15 빌드를 계속 서빙(job은 삭제됨, 사이트는 살아 있음 — Q4). `aws/`(Lambda SAM 템플릿)와 `docs/AWS_REPORT.md`는 Vercel 시대 잔재로 보이나 **활성 여부 미확인** — 삭제 전에 계정에서 확인 |
| 모바일 | Capacitor 8.1 · iOS SPM(`ios/App/CapApp-SPM/Package.swift`) · Android `android/`. 서명: Android keystore(`android/key.properties` 또는 `AETHERIA_ANDROID_KEYSTORE_*`) **없음**, iOS `Apple Distribution` identity **없음** — 둘 다 소유자가 준비해야 하는 릴리스 blocker(`tasks/todo.md` Pending) |
| Apps in Toss | `docs/APPS_IN_TOSS_SOFT_LAUNCH.md`(Phase A~F 계약). `toss:*` 스크립트 · `docs/evidence/toss/` |
| 텔레메트리 | 제품 이벤트 18종·AI 폴백 사유 7종 전부 **NOOP sink**(설계, §25.1 E1). 목적지는 Q6 |

---

## 7. 남은 일 — "개발 완료"까지의 순서

"완료"의 정의는 저장소 안에 이미 있다: **`docs/MOBILE_RELEASE.md` §5 Go/No-Go 게이트**(iPhone·Android 실기기 5분 루틴 통과 · P0 0 · P1 반영 · signed archive/AAB · TestFlight/Play internal 업로드 · 스토어 메타데이터). 코드 쪽 백로그는 소진됐고, 남은 것은 **기기 검증 · 소유자 결정 · 서명/제출**이다. 순서는 의존성 순이다.

### A. 기기 검증 (Codex가 시뮬레이터/에뮬레이터로 — 첫 작업)
1. `docs/qa/CODEX_K3_BACK_BUTTON_QA.md` 그대로: APK의 `capacitor.plugins.json`에 `AppPlugin` 확인 + 하드웨어 뒤로가기 8행 표. 결과는 `docs/PLAYTEST_CHECKLIST.md` §11 `### Android` · 원장 §24.1 끝 "L4 런타임 검증 (Codex, 날짜)" · `tasks/todo.md`에 기록. **표와 다르게 동작해도 `src/**`를 고치지 말고 관측을 기록** — 수정은 그 관측을 입력으로 한 다음 wave.
2. macOS가 있으면 `npm run ios:sync` 델타(`Package.swift` +2줄 기대) 커밋. `project.pbxproj`가 움직이면 커밋하지 말고 보고.
3. `docs/PLAYTEST_CHECKLIST.md` §11 신규 세이브 5분 루틴 + 재료 보유 2분 루틴을 에뮬레이터에서 수행하고 P0/P1/P2를 적는다. 실기기는 소유자 시간이 잡히면 같은 루틴.

### B. 소유자 결정 (각 답이 트랙을 열거나 닫는다 — 원장 §25.1 표)
| Q | 질문 | 답에 따라 |
|---|---|---|
| Q4 | Firebase Hosting 사이트 끌 것인가 | (a) `npx firebase hosting:disable --project aetheria-rpg-90a2f` 1회 — **소유자 명시 승인 후에만** (b) 방치 |
| Q6 | 텔레메트리 목적지 | (a) 현행 NOOP (b) 로컬 링버퍼 + SystemTab 내보내기 (c) Cloudflare Function `/api/events` + KV/D1 → `productFunnel.mjs` 소비. (b)/(c)면 트랙 1개 |
| Q7 | 프로덕션 Pages에 `/api/ai-proxy`가 배포돼 있는가 | GET 405 / POST 401·403 JSON = 배포됨, 404 또는 HTML = 미배포. 답은 M1의 문구·우선순위만 정한다. **토큰·키·헤더 값을 로그·보고서에 남기지 말 것** |
| Q8 | 카탈로그 퀘스트 계정당 1회(승천 뒤 2회차 퀘스트 수입 0) | (a) 유지 (b) `ASCEND`에서만 `claimedQuestIds` 리셋 (c) `prestigeRank`별 원장(`DATA_VERSION` bump). (b)/(c)면 트랙 1개 + 승천 보상 경제 재검토 |

### C. 코드 잔여 (작다, 단독 wave 아님 — 다른 PR에 끼운다)
1. `ai-proxy.js` 숫자형 보간 4곳(`level`/`mp`/`gold`/`recentWinRate`) clamp — `tests/cf-functions.test.js`에 red-first.
2. `combat-engine-core.test.js`의 `calculateDamage` 12건은 엔진이 아니라 파일 안 미러 구현 → 실제 엔진 호출(`rng` 주입)로 교체.
3. 원장 §25.2 관찰 1~3(전역 `Math.random` 스텁 뒤의 부등식 3곳 · `effectChance` 분기 5개 · `handleDefeat` 21곳)은 **규칙으로 닫혔다** — 새 테스트를 쓸 때만 해당.

### D. 콘텐츠 판단 — V27 완료 근거 확인 (2026-09-23 정정)
- 현재 몬스터 아트 254 = authored 234 / retained 20. 기존 retained89 중69 교정·20 유지 판단과 runtime 채택은 이미 V27에서 완료했다. `docs/superpowers/plans/2026-09-05-aetheria-game-completion.md`의 2026-09-09 설계 승인 기록, `scripts/art_sources/monsters/v27/adoption-review.md`의 최종 절, `docs/evidence/qa/game-completion-final-audit-20260910.md`의 Monster254 항목을 따른다.
- `docs/evidence/art/retained89-disposition-20260909.json`은 교정 전 판단 이력이며 덮어쓰지 않는다. 기존 165/89 숫자와 승인 대기 문장은 이후 V27 완료 기록으로 대체됐다. 새로운 이미지 제작·추가 교정 승인을 뜻하지 않는다.
- V27 `ui-receipt.json`은 390×844의 canonical spawn fixture89종, HP 감소89건·overflow/error0을 기록한다. 범위별 구현/화면 검수이며 자연 성장 전체 플레이·실기기·사용자의 최종 제품 수용 증거로 확대하지 않는다.
- D의 문서 정합성은 원장 §26.7에서 마감한다. 실제 device/lifecycle 및 출시 전체 완료는 A의 최신 기기 결과와 E의 Go/No-Go 조건을 별도로 따른다.

### E. 릴리스 (소유자 자산이 먼저)
`docs/MOBILE_RELEASE.md` §1~§5와 `docs/STORE_SUBMISSION_GUIDE.md` 순서대로. 코드로 못 푸는 blocker 셋: Android release keystore · iOS `Apple Distribution` identity · TestFlight/Play 업로드 승인. 이 셋이 오기 전까지 RC-1 원칙(새 기능 금지, UI 구조 변경 금지, 실기기 P0/P1만 수정)을 유지한다.

---

## 8. 닫힌 결정 — 다시 열지 말 것 (근거 §)

- AI 쿼터 **재시도**·**디스패치 거부** — 둘 다 실패 사례로 비교해 현행 유지(§24 관찰 A/B, CLAUDE.md §6). 잔여 상한 "세션당 미계량 디스패치 ≤1"은 의도된 저하.
- `useFirebaseSync` 폴드 중복 — 종결(§24.1).
- `grave` 마이그레이션 정규화 — 금지, reader 불변식으로 대체(§8-2).
- `tier` 정렬(`성직자` 1건 괴리) — 아트 identity 해시 때문에 불가(§8-9, `class-tier-depth.test.js`).
- Firebase Hosting job — 삭제 확정(Q2 = a). 사이트 비활성화는 별개(Q4).
- `functions/api/feedback-validate.js` — 삭제(클라이언트 참조 0, §25.1 M1). 부재 불변식이 지킨다.
- 500 응답의 상류 오류 원문(`details`) — 제거 확정(§25.1 M1 정정 ①).
- flaky (3)-B(2.79e-9)·(3)-C(16σ) — 시드화가 더 취약해 **미수정 확정**(§25.2).
- 세 번째 정적 감사 — 입력 없이는 수확 체감(§25.1 Wave 22 후보 4).

---

## 9. 문서 지도 (무엇이 무엇의 정본인가)

| 질문 | 정본 |
|---|---|
| 코드 규칙·주의사항 | `CLAUDE.md` |
| 왜 그렇게 결정했나(실측·정정·대안의 실패 사례) | 원장 `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md` §N/§N.1 |
| wave별 한 줄 이력 | `tasks/todo.md` 끝 |
| Codex 시대 규칙 R1~R27 | `tasks/lessons.md` |
| 소스 정규식 가드 3,226건 분류 | `docs/SOURCE_GUARD_CLASSIFICATION_2026-09.md` |
| 기기 QA 절차·기록 위치 | `docs/PLAYTEST_CHECKLIST.md`, `docs/qa/CODEX_K3_BACK_BUTTON_QA.md` |
| 릴리스·스토어 | `docs/MOBILE_RELEASE.md`, `docs/STORE_SUBMISSION_GUIDE.md`, `docs/APPS_IN_TOSS_SOFT_LAUNCH.md` |
| 배포·환경 | `docs/QUICK_DEPLOY.md`(Cloudflare), `docs/DEPLOYMENT.md`·`docs/FIREBASE_SETUP.md`(Firebase/시크릿) |
| 게임 완성 Goal(콘텐츠·아트) | `docs/superpowers/plans/2026-09-05-aetheria-game-completion.md` + `docs/evidence/qa/game-completion-final-audit-20260910.md` |
| 증빙 JSON | `docs/evidence/{qa,art,toss}/` — 값은 `*:verify` 스크립트가 판정 |
| 오래된 문서 | `tasks/PROJECT_OVERVIEW.md`(2026-02, `.jsx`·10직업·18맵 시대 — 트리와 수치는 CLAUDE.md §3이 정본) · `docs/archive/` |

---

## 10. Codex 킥오프 프롬프트 (그대로 붙여 넣는다)

```
너는 `sungjin9288/aetheria-roguelike`의 개발을 이어받는다. 이전 개발(Waves 1~21.1)은 Claude 세션이 했고 전부 `main`(= `0bcea0f0`)에 머지돼 있다. 앞으로는 너만 개발한다.

먼저 `docs/HANDOFF_TO_CODEX_2026-09.md`를 전부 읽고, 그 문서 §0의 읽기 순서를 따라라. 규칙은 `CLAUDE.md`, 근거는 `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md`다.

첫 작업은 인수인계 문서 §7-A(기기 검증)다:
1. `git fetch origin main && git checkout -B codex/wave22-device-qa origin/main`
2. `docs/qa/CODEX_K3_BACK_BUTTON_QA.md`를 그대로 실행한다 — `npm run android:sync` → `npm run android:debug` → APK의 `capacitor.plugins.json`에 `AppPlugin` 확인 → 에뮬레이터에서 하드웨어 뒤로가기 8행 표. 표와 다르게 동작해도 `src/**`를 고치지 말고 관측을 기록한다.
3. macOS가 있으면 `npm run ios:sync` 델타(`Package.swift` +2줄)만 커밋.
4. 기록 3곳: `docs/PLAYTEST_CHECKLIST.md` §11 `### Android` · 원장 §24.1 끝 "**L4 런타임 검증 (Codex, 날짜)**" · `tasks/todo.md`.
5. 인수인계 §7-B의 Q7을 읽기 전용으로 확인한다(PROD_URL은 소유자가 준다; 토큰·키·헤더 값은 어디에도 남기지 않는다). Q4는 소유자가 "실행해"라고 명시하기 전에는 실행하지 않는다.
6. `npm run verify` 초록 → PR → CI 초록 → merge commit으로 머지. PR 본문에는 인수인계 §7-A/§7-B 결과 표를 그대로 넣는다.

지켜야 할 것: 인수인계 §4(작업 방법)·§5(함정)·§8(닫힌 결정). 검증은 실행으로 한다. 계약 테스트는 결함 주입으로 red를 먼저 본다. 바이트 핀 파일은 편집하지 않는다. 커밋 메시지·PR·주석에 모델명을 쓰지 않는다. "아마 될 것"이라는 문장은 보고서에 넣지 않는다.

보고는 인수인계 §7-A/§7-B의 표 형식으로, 불일치·미실행을 그대로 적는다.
```
