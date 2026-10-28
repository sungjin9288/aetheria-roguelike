# 개인정보 처리방침 — 근거와 공개 전 확인 (내부 문서)

이 문서는 **공개하지 않는다.** [처리방침 초안](PRIVACY_POLICY_KO.md)의 각 항목이 코드의 어디에서 나오는지, 그리고 공개 전에 닫아야 할 결정 · 확인을 적는다. 기준은 2026-10-21 `main` `5f5a0b72`이다. 코드가 바뀌면 이 표부터 다시 대조한다.

## 1. 항목별 근거

| 처리방침 위치 | 사실 | 근거 |
|---|---|---|
| 제2조 계정 | Firebase **익명** 인증만 쓴다. 다른 로그인 · 토스 로그인 · 토스 이용자 키 · 기기 식별자는 없다 | `src/hooks/useFirebaseSync.ts`(`signInAnonymously`), `src/firebase.ts`, `apps-in-toss.config.ts`(`permissions: []`) |
| 제2조 게임 저장 | `artifacts/aetheria-rpg/users/{uid}`에 player 전체(이름은 16자까지)와 세이브 봉투를 `merge`로 쓴다. 보안 규칙상 본인만 읽고 쓴다 | `src/hooks/createCloudAutosave.ts`, `firestore.rules`(users 블록) |
| 제2조 다른 이용자 이름 | 다른 차원의 묘비에서 만난 묘비의 uid · 이름이 내 저장에 남는다 | `src/utils/dimensionGrave.ts`(`currentEvent.dimensionGrave`, `stats.invadedGraveUids`) |
| 제2조 순위표 | nickname · totalKills · prestigeRank · activeTitle · level · bossKills · job · uid · updatedAt. 이름이 있고 처치 1회 이상일 때 자동 저장마다. **로그인 없이 누구나 읽는다**(`allow read: if true`) | `src/hooks/createCloudAutosave.ts`, `firestore.rules`(leaderboard 블록), 표시 `src/components/tabs/SystemTab.tsx` |
| 제2조 다른 차원의 묘비 | playerName · level · loc · items(카탈로그 이름 · 종류, 최대 3) · gold(상한) · guardPower · uid · createdAt. 사망할 때 쓰고, 인증된 이용자(익명 포함)가 최근 20건을 10분마다 읽는다. 앱의 삭제는 규칙이 막는다 | `src/utils/publicGraveDoc.ts`(`buildPublicGraveDoc`), `src/platform/publicGraveFirestore.ts`, `src/hooks/useDimensionGravePool.ts`, `firestore.rules`(graves 블록) |
| 제2조 의견 보내기 | uid · nickname · message(10 ~ 1,000자) · statsSummary{level, job, kills} · timestamp. 앱에서는 아무도 읽지 못한다(read · update · delete 모두 false). 60초 간격 제한 | `src/components/tabs/SystemTab.tsx`(`addDoc`), `src/systems/FeedbackValidator.ts`, `firestore.rules`(feedback 블록) |
| 제2조 AI 사용 횟수 | `users/{uid}/quota/daily-ai`에 날짜별 요청 수. 인증 직후 부팅당 한 번 쓴다 | `src/systems/TokenQuotaManager.ts` |
| 제2조 〔AI〕 AI 이벤트 | 요청 본문에 이름 · 직업 · 레벨 · 생명 · 기력 · 골드 · 칭호 · 진행 임무 · 빌드 성향 · 최근 사건 · 지역 · uid가 들어간다. 프록시는 항목별 길이를 자르고 uid를 뺀 프롬프트를 Gemini(`gemini-3.5-flash-lite`)로 보낸다(2026-10-28 — 그 전에는 프롬프트에 `UID:` 줄이 있었다). uid는 요청 수 제한에만 쓰고, 그 키(`uid:IP`)는 서버 메모리 Map에 둔다. **기본은 꺼짐**(`CONSTANTS.USE_AI_PROXY = VITE_USE_AI_PROXY === 'true'`) | `src/services/aiService.ts`, `functions/api/ai-proxy.js`, `src/data/constants.ts` |
| 제2조 ④ 기기 안 기록 | 활동 기록(최근 200건 · 128KiB)과 오류 기록(최근 20건)은 localStorage에만 둔다. 네트워크 전송 구현이 없다(싱크는 NOOP · LOCAL 두 가지). 설정 화면에서 지우고 내보낸다 | `src/platform/localProductEventStore.ts`, `src/platform/localErrorReportStore.ts`, `src/platform/productEventSink.ts`, `src/components/tabs/SystemTab.tsx` |
| 제2조 ② 수집하지 않는 것 | Android 권한은 INTERNET 하나다. src에 위치 · 카메라 · 주소록 API가 없고, 클립보드는 이용자가 누를 때 쓰기만 한다(공유 문구 · 기록 복사). 공유 문구에 캐릭터 이름은 없다 | `android/app/src/main/AndroidManifest.xml`, `src/utils/runShareText.ts` |
| 제5조 외부 글꼴 | 없다. 2026-10 디자인 기반에서 Rajdhani(`fonts.googleapis.com`)를 지웠다 — 글꼴은 저장소의 Fira Code와 기기 글꼴뿐이다 | `index.html`, `src/index.css`, `tests/design-token-absence-contract.test.js` |
| 제8조 접근 통제 | 위 보안 규칙. 공개 문서의 필드 · 크기 상한은 rules가 검사한다 | `firestore.rules`, `tests/firestore-rules-semantics.test.js` |
| 제9조 쿠키 | src · `index.html`에 `document.cookie`가 없다 | — |
| 삭제 기능 | src에 `deleteDoc` · `deleteUser`가 없다. Firestore TTL 설정도 없다 | `firebase.json`(rules만) |

## 2. 공개 전에 닫을 것

1. **운영자 정보:** 운영자 이름, 개인정보 보호책임자, 연락 이메일(제10조), 수탁자 연락처(제5조).
2. **토스 빌드에 Firebase를 넣는다 — 결정(2026-10-21).** 처리방침은 지금 초안 그대로다(`VITE_FIREBASE_CONFIG`). 아래는 결정 근거로 남긴다.
   - 넣으면 클라우드 저장 · 순위표 · 다른 차원의 묘비 · 의견이 동작한다. 출시 검수 게이트 `cors`(토스 출처 `*.tossmini.com` 허용)를 확인해야 한다(런북 §0-9 · §3).
   - 빼면 저장은 기기에만 남는다. 앱을 지우거나 기기를 바꾸면 진행이 사라진다. 제2조 표의 계정 · 게임 저장 · 순위표 · 묘비 · 의견 · AI 사용 횟수 행과 제5조 Firebase 행을 지운다. 삭제 요청 경로(의견 보내기)도 사라지므로 연락처 경로를 적는다.
3. **AI 이벤트를 켤지 정한다(`VITE_USE_AI_PROXY`).** 끄면 〔AI〕 줄과 Cloudflare · Gemini 행을 지운다. 켜면 다음 넷을 먼저 닫는다.
   - ~~모델 `gemini-1.5-flash`가 지금도 응답하는지 확인한다.~~ 닫음(2026-10-28): 1.5 계열은 Google의 모델 목록 · 종료 표에 없다. `gemini-3.5-flash-lite`(안정판, 종료 일정 없음)로 바꿨다. 실제 키로 부른 적은 아직 없다 — 켜기 전에 한 번 불러 본다.
   - 토스 웹뷰에서 상대 주소 `/api/ai-proxy`는 토스 출처로 풀린다. 절대 주소(`VITE_AI_PROXY_URL`)와 프록시의 `ALLOWED_ORIGINS`가 필요하다.
   - ~~프롬프트에 계정 식별자 원문이 들어간다.~~ 닫음(2026-10-28): 두 곳 모두 뺐다. `tests/cf-functions.test.js`가 Gemini 요청 본문 전체에 uid가 없음을 확인한다.
   - Gemini 요금제의 데이터 사용 조건을 확인한다(무료 등급은 서비스 개선에 쓰일 수 있다).
4. **Firestore 데이터 위치:** Firebase 콘솔 › Firestore › 위치. 제5조 처리 국가 칸에 적는다.
5. **삭제 요청 처리 절차(운영자):** 의견 보내기로 받은 요청은 의견 문서의 uid로 처리한다.
   - 지울 문서: `users/{uid}`(하위 `quota` 포함), `public/data/leaderboard/{uid}`, `public/data/graves/{uid}`, Firebase Authentication의 익명 계정.
   - 보안 규칙이 앱의 삭제를 막으므로 콘솔에서 지운다. 기한은 10일이다.
   - 연락처로 받는 요청은 지금 본인 확인을 할 수 없다. 게임 화면 어디에도 계정 식별자가 나오지 않는다. 설정 화면에 표시하거나 '내 데이터 삭제'를 만드는 일은 화면 변경이라 기기 수용 뒤에 한다.
6. **보유 기간:** 지금은 자동 삭제가 없다. 정하기 전에는 "삭제 요청 · 서비스 종료 시까지"가 사실이다. 기간을 정하면 Firestore TTL 정책이나 정리 작업을 함께 만든다.
7. **순위표 공개 범위:** `allow read: if true`다. 그대로면 "누구나" 문구가 맞다. 로그인한 이용자로 좁히려면 rules를 바꾸고 rules 시맨틱 테스트를 함께 고친다.
8. **Google Fonts — 닫음(2026-10 디자인 기반).** Rajdhani 외부 요청을 지웠다(표제는 본문 한글 글꼴 굵기 800). 제5조 Google Fonts 행을 지웠다. 기기 수용에서 표제 글꼴이 기기 글꼴로 보이는지만 확인한다.
9. **토스 저장소:** SDK `Storage`가 기기 안 저장인지 토스 서버 동기화인지 토스 문서로 확인한다. 결과에 따라 제5조 비바리퍼블리카 행을 지우거나 채운다.
10. **만 14세 미만:** 게임은 나이를 받지 않는다. 앱인토스에는 틴즈(만 14세 이상) 노출 정책이 있다(검색 요약). 콘솔의 이용 연령과 함께 제6조 ④를 정한다.
11. **처리방침 위치(URL):** 웹 배포(Cloudflare Pages)에 정적 페이지로 둔다.
    - `public/`에 두면 웹 `dist/`에만 들어가고 토스 번들 검증에는 영향이 없다. 토스 빌드는 허용 목록만 담는다(`scripts/tossAssetCatalog.mjs`).
    - 웹 빌드도 `public/assets` 안은 런타임 그림 목록만 담는다(`scripts/webPublicAssets.mjs`). 처리방침 페이지는 `public/assets` 밖(예: `public/privacy/`)에 둔다 — 밖의 파일은 그대로 담긴다.
    - 토스 번들 안에 넣으려면 허용 목록과 번들 고정값 테스트(`tests/toss-asset-build.test.js`)를 함께 바꿔야 한다. 번들 여유도 3.3MB뿐이다.
    - 콘솔과 게임 설정에는 그 주소를 적는다.
12. **출시 검수 게이트:** 저장소 검증기의 `review` 단계는 `privacy_policy` · `support_channel` 외부 게이트 영수증을 요구한다(`scripts/tossReleaseEvidence.mjs`). 공개 주소가 생기면 영수증을 남긴다. 절차는 [앱인토스 샌드박스 런북](../qa/APPS_IN_TOSS_SANDBOX_RUNBOOK.md)을 따른다.

## 3. 범위 밖 관찰 (처리방침 문구에는 영향 없음)

- 보안 규칙은 `users/{uid}/history`를 허용하지만 클라이언트는 쓰지 않는다.
- 공개 묘비 `guardPower`는 읽는 곳이 없지만 rules 필수 키라 올라간다(원장 §66.8). 처리방침 제2조에는 "공격력 값"으로 공개했다.
- `docs/APPS_IN_TOSS_SOFT_LAUNCH.md`의 "기본 전송과 오류 보고는 아무것도 하지 않는다(no-op)"는 네트워크 전송 이야기다. 지금은 기기 안 기록(localStorage)에 남긴다. 어느 쪽이든 서버로 보내지 않는다.
