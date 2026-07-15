# Aetheria RPG - Lessons Learned

**Engineer:** Aetheria Staff Engineer  
**Purpose:** 예기치 못한 에러나 수정 사항을 기록하고, 동일한 실수를 반복하지 않기 위한 규칙을 정의합니다.

---

## 📚 Lessons Log

| Date | Issue | Root Cause | New Rule |
|------|-------|------------|----------|
| 2026-02-05 | (초기화) | N/A | 시스템 구축 완료 |
| 2026-03-12 | Android debug build failed with missing `metadata.bin` under `/tmp/aetheria-gradle` | Shared temporary Gradle cache became inconsistent after interrupted/reused runs | Android Gradle wrapper scripts must retry once with a fresh `GRADLE_USER_HOME` before treating the build as failed |
| 2026-03-13 | 새 게임 시작 시 HP가 실효 최대치보다 낮게 보임 | 런타임 파생 보너스가 저장 기본 HP/MP와 분리되어 UI에만 추가 적용됨 | 시작 스탯과 런타임 스탯은 같은 기준을 공유해야 하며, 숨은 파생 보너스는 플레이어가 읽는 시스템으로만 노출한다 |
| 2026-03-31 | 모바일 인트로에서 시작 버튼이 화면 아래로 잘려 접근 불가 | `100dvh` 셸 안에서 `h-full` 래퍼와 shrink 가능한 인트로 카드가 함께 작동해 카드 내부 콘텐츠가 클리핑되고 실제 scroll height가 늘지 않았음 | 모바일 첫 진입 화면은 `min-h-full` 기반 스크롤 컨테이너를 쓰고, CTA를 포함한 핵심 카드에는 shrink/clipping이 생기지 않도록 높이 제약을 명시적으로 점검한다 |
| 2026-03-31 | 모바일 상점 smoke가 카드 클릭에서 반복적으로 false negative 발생 | fixed overlay + glass surface 조합에서는 비액션 카드 shell hit-test가 환경에 따라 흔들리고 실제 사용자 액션과도 어긋났음 | 모바일 overlay smoke는 장식 카드가 아니라 실제 CTA/button을 기준으로 검증하고, open/close/CTA 노출 여부를 핵심 성공 조건으로 삼는다 |
| 2026-03-31 | 모바일 focus 패널이 `Field Feed / Snapshot / Archive Dock`와 겹쳐 상점·이벤트·미션 화면이 답답하게 누적됨 | `App`이 모바일에서도 기본 로그/요약 스택을 계속 렌더한 상태에서 `SHOP / EVENT / QUEST_BOARD / JOB_CHANGE / CRAFTING` 패널을 fixed overlay로만 얹어, 공간을 두 번 쓰고 z-index 충돌까지 만들었음 | 모바일에서 panel-heavy 상태는 일반 본문 스택과 분리한 단일 focus stage로 렌더하고, 같은 상태에서는 fixed overlay보다 `min-h-0 flex-1` 인라인 패널 구성을 우선한다 |
| 2026-04-08 | OpenSpace 게임 통합 시 repo wiring과 host execution 상태가 혼동되기 쉬움 | repo-local skill dir, Codex MCP config, local `search_skills`는 정상이어도 plain shell `execute_task`는 host-side auth/session/timeout에 막힐 수 있음 | 게임 repo OpenSpace smoke는 bridge skill 존재, local search discovery, MCP config 반영 여부를 우선 성공 기준으로 삼고, `execute_task` timeout은 host follow-up으로 분리 기록한다 |
| 2026-06-01 | 모바일 visual smoke에서 Quest/Combat 패널이 실제보다 어둡게 캡처됨 | focus panel entrance animation의 initial opacity가 smoke screenshot timing과 겹쳐 첫 프레임 가독성을 떨어뜨렸음 | 실기기 acceptance 대상 패널은 첫 render부터 readable state여야 하며, QA 캡처 대상 surface에는 `initial={false}` 또는 동등한 immediate-visible contract를 적용한다 |
| 2026-06-01 | 모바일 archive reset CTA가 하단 control panel에 pointer hit-test를 빼앗김 | archive console이 열린 상태에서도 bottom `ControlPanel`이 동시에 렌더되어 overlay CTA 아래 z-layer에서 pointer event를 가로챘음 | 모바일에서 modal/console CTA가 활성화되면 동일 영역의 underlying controls를 조건부 suppress하고, reachability source guard로 겹침 회귀를 고정한다 |
| 2026-07-14 | 통합 Playwright가 Aetheria preview 대신 같은 포트의 다른 로컬 앱을 열어 연속 타임아웃 | preview는 `127.0.0.1`에 기동했지만 Playwright 기본 URL은 `localhost`여서 환경에 따라 서로 다른 loopback 서버로 해석됨 | preview를 기동한 스크립트는 실제 준비 확인에 사용한 정확한 URL을 모든 후속 smoke, perf, E2E 명령에 명시적으로 전달한다 |
| 2026-07-14 | iOS archive 설치 후 launch 보안 오류가 서명 손상과 기기 신뢰 승인 대기를 한 문장으로 함께 보고함 | CoreDevice의 보안 오류가 invalid signature, entitlement, untrusted profile 가능성을 합쳐 반환해 원인 경계가 불명확했음 | launch 보안 오류가 나면 archive 서명, entitlement, profile 만료·UDID, Developer Mode를 먼저 검증하고 모두 정상이면 기기 profile 신뢰 승인으로 분리해 정확한 설정 경로를 안내한다 |
| 2026-07-14 | 실기기 체크리스트가 `Field Log`, `Archive Dock`, `QA READOUT`처럼 더 이상 화면에 없는 용어를 요구함 | UI 문구 변경과 수동 QA 문서가 별도 흐름으로 관리되어 실제 플레이 경험 대신 과거 식별자를 확인하는 절차로 남았음 | 플레이어 노출 문구를 바꿀 때 source/e2e 가드와 시간대별 실기기 루틴을 함께 갱신하고, 체크리스트는 내부 key가 아니라 현재 화면의 표현과 체감 기준을 사용한다 |
| 2026-07-14 | 브라우저 smoke는 통과했지만 네이티브 신규 시작 화면에서 고급 도전 규칙과 영문 판단 라벨이 첫 선택보다 먼저 보임 | 기존 smoke가 게임 시작 후 핵심 루프를 중심으로 검증해 시작 CTA 직전과 다음 필수 선택의 정보 위계를 직접 보지 않았음 | 첫 세션 UI를 바꾸면 네이티브 시뮬레이터에서 시작 CTA와 그 다음 필수 화면까지 연속 확인하고, 선택 사항은 기본 접힘이며 판단 라벨은 플레이어 언어인지 검증한다 |
| 2026-07-14 | 주요 판단 화면은 한글인데 부트, 상태바, 로그 배지, 상태 명령에는 내부 단계명과 영문 지표 약어가 반복 노출됨 | 기능별 UI를 따로 다듬어 첫 5분 전체에서 반복되는 공통 어휘 계약을 검증하지 않았음 | 첫 세션 가독성 작업은 부트, 상시 HUD, 교전 대상, 플레이 기록, 성장 피드백을 한 묶음으로 확인하고 내부 key는 data attribute에만 남긴다 |
| 2026-07-14 | archive smoke가 탭 상태만 바꿔 성공했지만 실제 Stats와 Codex 패널 화면은 열리지 않은 과거 캡처가 증적으로 남음 | 상태 전환 성공과 사용자가 보는 패널의 render·문구·레이아웃 검증을 같은 것으로 취급했음 | 보조 패널 smoke는 실제 open action과 panel test id를 확인한 뒤 캡처하고, 제목·행동·빈 상태·수치 단위를 하나의 플레이어 어휘 계약으로 검사한다 |
| 2026-07-14 | 지도 smoke 캡처가 실제 지도 대신 lazy loading 화면을 담고도 탭 전환 성공으로 처리됨 | 지도 상태 변경과 실제 `MapNavigator` render 완료를 분리하지 않았고, 긴 element 전체 캡처가 첫 화면 가독성 증빙으로 사용됐음 | 지도 acceptance는 실제 map root, 첫 viewport의 현재 위치·추천 경로, transient overlay 종료를 함께 확인하고 loading fallback이나 전체 element 길이만으로 통과시키지 않는다 |
| 2026-07-14 | 새 캐릭터의 첫 기록에 이전 초기화 안내와 `EXP / Gold / HP / MP`, 잘못된 장소 조사가 섞여 첫 여정이 시스템 로그처럼 보임 | 초기화·시작·이동·보상·회고 화면을 각각 검증해 실제 첫 세션의 연속 기록과 reset 경계를 끝까지 읽지 않았음 | 첫 세션 문구는 reset 이후 시작, 첫 이동, 첫 방문, 첫 승리, 전투 후 판단, 모험 종료까지 하나의 연속 계약으로 검증하고 내부 약어·조사 오류·이전 상태 누출을 함께 거부한다 |
| 2026-07-14 | 상점과 장비 화면에서 `CR / 골드`, `G`, `ATK / DEF / HP / MP`, `1H / 2H`가 섞이고 390px 장비 요약 카드가 여러 줄로 갈라짐 | 화폐·능력치·장비 분류를 화면별로 따로 축약했고 실제 작은 화면에서 상점 구매부터 장비 확인까지 연속 비교하지 않았음 | 거래와 장비 화면은 같은 플레이어 어휘를 사용하고, 390px 첫 화면에서 가격·비교 변화·장착 슬롯을 함께 읽은 뒤 legacy 약어와 좁은 고정 열을 회귀 가드로 막는다 |
| 2026-07-14 | 이벤트 본문은 한글인데 선택 화면의 영문 구조 라벨과 결과 단서 부재 때문에 이야기보다 시스템 해석이 먼저 필요했음 | 이벤트 내용, 선택 버튼, 결과 기록을 각각 다뤄 실제 판단 흐름 전체의 정보 위계와 공통 어휘를 검증하지 않았음 | 이벤트 판단 화면은 `상황 → 선택 → 예상 결과 → 결과 기록`을 하나의 계약으로 검증하고, 일반 이벤트의 비밀은 유지하되 공개된 규칙과 위험 범주는 선택 전에 플레이어 언어로 알려 준다 |
| 2026-07-14 | 첫 필수 유물 선택의 추천 요약이 좁은 3열에 압축되고 `치명 MP` 같은 약어와 동일한 비공명 안내가 반복되어 후보 차이가 흐려졌음 | 추천 계산만 검증하고 유물 원본 설명, 구세이브 문구, 선택·성장 조언·보유 목록·활성 조합의 공통 표시 언어를 함께 보지 않았음 | 유물은 원본 데이터와 구세이브 표시를 같은 플레이어 어휘로 맞추고, 선택 화면은 추천 유물 전체 이름 뒤에 이유와 성장 방향을 분리해 보여 준 다음 실제 추천 카드 선택까지 smoke로 검증한다 |
| 2026-07-14 | 이동 직후 390px 증적에서 상시 HUD의 아바타와 일부 지표가 비어 있고 이름·직업·레벨·지역·재화가 한 줄에 몰려 작은 글씨와 잘림 위험이 남았음 | 상태 값과 문구만 검증하고 보이는 이미지·폰트의 준비 완료, 정보 행 분리, 실제 글자 크기와 가로 overflow를 증적 계약에 포함하지 않았음 | 상시 HUD는 정체성, 현재 지역, 핵심 지표를 별도 행으로 나누고, smoke는 보이는 이미지와 폰트가 준비된 뒤 최소 글자 크기·가로 overflow·아바타 decode를 확인하고 캡처한다 |
| 2026-07-14 | 보상을 받은 정적 퀘스트가 즉시 재노출·재수락됨 | `claimedQuestIds`를 게시판 선별과 수락 경계에서 검사하지 않았음 | 일회성 정적 content는 표시 필터와 action guard 양쪽에서 같은 완료 ledger를 검사한다 |
| 2026-07-14 | 전투 단계 배너가 전투 종료 후에도 모든 패널을 가림 | enemy 업데이트 effect cleanup이 배너 해제 timer를 반복 취소함 | transient UI의 상태 감지와 수명 timer를 별도 effect로 분리한다 |
| 2026-07-14 | 인증 지연 오프라인 모드에서 앱 재실행 시 전체 런이 초기화됨 | 오프라인 플레이를 허용하면서 저장은 Firestore에만 의존함 | 모바일 오프라인 플레이는 versioned local snapshot을 함께 유지하고, cloud 실패 때만 migration 후 복원하며 reset에서 제거한다 |
| 2026-07-15 | Android headless 에뮬레이터에서 패널과 글자가 중복·누락되어 앱 레이아웃 회귀처럼 보임 | SwiftShader가 다수의 blur surface를 잘못 합성했으며 같은 APK를 host GPU로 실행하면 안정 프레임이 정상 렌더링됨 | Android 에뮬레이터 시각 QA는 host GPU로 재현성을 먼저 확인하고, 소프트웨어 렌더러 한정 증상은 실기기 회귀와 분리한다 |
| 2026-07-15 | iOS device smoke가 잠긴 iPad의 install 전 DDI mount 실패를 긴 CoreDevice 원문으로만 종료함 | 잠금 handoff가 archive 설치 뒤 launch 실패에만 연결되어 metadata와 install 단계의 같은 오류를 분류하지 않았음 | 필수 device command는 단계와 무관하게 같은 진단 파일과 잠금·신뢰 분류를 사용하고, install 전 잠금이면 중복 install을 시도하지 않는다 |
| 2026-07-15 | Android APK 설치 실패가 서명 충돌 가능성만 안내해 실제 AVD 저장 공간 부족을 바로 판단하기 어려웠음 | 수동 설치 절차와 generic error guidance만 있고 `adb install` 실패 유형을 release evidence로 분류하는 공통 경계가 없었음 | Android device smoke는 저장 공간 부족과 서명 충돌을 구분하고, 세이브를 보존하기 위해 앱 삭제나 data clear를 자동 수행하지 않는다 |
| 2026-07-15 | iOS local export 안내는 존재하지 않는 파일을 가리키고 실제 설정은 승인 없이 App Store Connect upload를 요청할 수 있었음 | archive 생성, 로컬 IPA export, 외부 upload를 한 환경변수 경로로 처리하면서 destination과 provisioning 동작을 실행 전에 구분하지 않았음 | iOS 배포는 local export와 upload 설정을 분리하고, upload는 명시적 opt-in 없이는 archive 전에 차단하며 provisioning 갱신 옵션을 archive와 export에 동일하게 적용한다 |

---

## 🛡️ Established Rules

### R1: No Magic Numbers
- **Rule:** 모든 숫자 상수는 `BALANCE` 또는 `CONSTANTS` 객체에 정의
- **Rationale:** 유지보수성 향상, 일관성 보장

### R2: Pure Function First
- **Rule:** 상태 변경 로직은 순수 함수로 작성 후 reducer에서 호출
- **Rationale:** 테스트 용이성, 예측 가능한 동작

### R3: Error Boundary
- **Rule:** 모든 외부 API 호출에 try-catch 및 fallback 구현
- **Rationale:** 사용자 경험 보호, 네트워크 불안정성 대응

### R4: Build Before Commit
- **Rule:** 모든 수정 후 `npm run build` 성공 확인 필수
- **Rationale:** 타입 안정성 및 런타임 에러 사전 방지

### R5: Retry Corrupted Temp Caches
- **Rule:** `/tmp` 기반 캐시를 쓰는 빌드 스크립트는 1회 자동 재시도를 지원
- **Rationale:** 임시 캐시 손상 때문에 실제 코드 문제를 빌드 실패로 오인하지 않기 위함

### R6: Visible Runtime Stats Only
- **Rule:** 전투/상태창에 적용되는 HP/MP/ATK/DEF 보너스는 플레이어가 읽을 수 있는 시스템(장비, 칭호, 성향 등)으로만 반영
- **Rationale:** 저장 기본값과 표시 수치가 어긋나면 시작 상태와 회복 계산이 혼란스러워짐

### R7: Scroll-Safe Mobile Entry
- **Rule:** 모바일 첫 진입/온보딩/인트로 화면은 `100dvh` 셸 내부에서 `h-full` 고정 래퍼 + shrink 가능한 카드 조합을 피하고, CTA가 화면 아래로 밀릴 경우 실제 scroll height가 증가하는지 확인한다
- **Rationale:** 첫 화면 CTA 접근 불가 문제는 기능 버그와 동일한 수준으로 게임 시작 자체를 막기 때문

### R8: Smoke Actual CTA
- **Rule:** 모바일 overlay/바텀시트 smoke는 카드 shell 같은 비액션 surface를 클릭하지 말고, 실제 구매/닫기/선택 CTA를 기준으로 검증한다
- **Rationale:** fixed sheet와 blur surface가 섞인 환경에서는 hit-test가 카드 배경에서 흔들릴 수 있어 false negative가 늘고, 실제 사용자 흐름 검증에도 도움이 덜 된다

### R9: Mobile Focus Stage
- **Rule:** 모바일 `SHOP / EVENT / QUEST_BOARD / JOB_CHANGE / CRAFTING` 같은 panel-heavy 상태는 `Field Feed / Snapshot / Archive Dock`와 동시에 쌓지 말고, 단일 `focus stage`에서 `min-h-0 flex-1` 인라인 패널로 렌더한다
- **Rationale:** 기본 스택 위에 fixed overlay를 얹는 방식은 같은 세로 공간을 중복 소비하고, 상태바/도크와 z-index 충돌을 일으켜 겹침과 빈 공간을 동시에 만든다

### R10: Separate OpenSpace Wiring From Host Runtime
- **Rule:** OpenSpace 통합 검증은 `repo skill dirs present + local search discovery + MCP config wiring`을 우선 확인하고, plain shell `execute_task` timeout이나 auth 실패는 repo 회귀와 분리해 기록한다
- **Rationale:** repo wiring은 이미 정상인데 host-side session/auth 문제 때문에 통합 자체가 실패한 것처럼 오판하는 일을 줄여야 한다

### R11: Immediate-Readable QA Panels
- **Rule:** 모바일 smoke / 실기기 acceptance에서 직접 캡처되는 focus, combat, reset, quest 계열 패널은 첫 render부터 readable opacity와 contrast를 가져야 하며, entrance animation이 필수라면 캡처 지점과 분리한다
- **Rationale:** 실제 UI는 곧 밝아져도 QA 캡처가 첫 프레임을 잡으면 어두운 화면이 acceptance evidence로 남아 잘못된 회귀 판단을 만들 수 있다

### R12: Suppress Underlying Controls Under Mobile Consoles
- **Rule:** 모바일 modal, archive console, reset confirmation처럼 CTA가 있는 상위 surface가 열려 있으면 같은 터치 영역의 bottom controls를 렌더하지 않거나 pointer target에서 제거한다
- **Rationale:** 시각적으로는 위에 보이는 CTA라도 아래 control surface가 pointer event를 가로채면 실기기에서는 진행 불가 버그가 된다

### R13: Reuse The Exact Verified Preview URL
- **Rule:** preview를 직접 기동하는 검증 스크립트는 준비 상태를 확인한 동일한 URL을 smoke, perf, Playwright E2E에 항상 전달한다
- **Rationale:** `localhost`와 `127.0.0.1`은 같은 포트에서도 서로 다른 loopback 서버로 연결될 수 있으므로 기본 URL 추정은 다른 로컬 앱을 검증하는 false positive와 timeout을 만든다

### R14: Diagnose iOS Trust Before Blaming The Archive
- **Rule:** iOS launch가 security reason으로 거부되면 `codesign`, entitlement, embedded profile 만료·기기 UDID, Developer Mode를 확인하고, 조건이 정상이면 app regression이나 invalid archive가 아니라 device profile trust handoff로 기록한다
- **Rationale:** CoreDevice는 서로 다른 보안 원인을 같은 오류 문장에 묶어 반환하므로 검증 없이 archive를 다시 만들면 원인을 해결하지 못한 채 signed build 이력만 반복하게 된다

### R15: Keep Device QA In The Player's Vocabulary
- **Rule:** 플레이어 노출 문구를 변경할 때 관련 source/e2e assertion과 시간대별 실기기 체크리스트를 같은 변경에서 갱신하고, 수동 QA는 현재 화면의 표현과 체감 acceptance를 기준으로 수행한다
- **Rationale:** 과거 내부 용어가 문서에 남으면 정상 화면을 실패로 오판하고, 다음 행동 탐색이나 성장 속도 같은 실제 플레이 문제를 놓치게 된다

### R16: Verify The First Native Decision Sequence
- **Rule:** 신규 플레이 흐름을 바꿀 때 네이티브 시뮬레이터에서 시작 CTA와 바로 다음 필수 선택 화면을 연속 확인하고, 고급 선택은 기본 접힘인지와 판단 정보가 플레이어 언어로 읽히는지를 검증한다
- **Rationale:** 게임 시작 후 smoke만으로는 첫 화면의 정보 과부하나 WebView에서만 드러나는 필수 선택의 언어 혼용을 놓칠 수 있다

### R17: Keep One Vocabulary Across The First Five Minutes
- **Rule:** 부트, 상시 HUD, 교전 대상, 플레이 기록, 상태 명령, 성장 배너는 같은 플레이어 어휘를 사용하고 내부 stage와 약어는 안정적인 key나 data attribute로만 보존한다
- **Rationale:** 개별 화면이 읽혀도 반복 영역마다 `HP`, `생명`, `Lv`, `레벨`이 섞이면 플레이어가 같은 정보를 다시 해석해야 하고 게임이 개발 도구처럼 보인다

### R18: Prove Secondary Panels Are Actually Rendered
- **Rule:** 임무, 제작, 능력치, 도감 같은 보조 패널 smoke는 실제 open action과 panel test id를 확인한 뒤 캡처하고, 제목·행동·빈 상태·수치 단위를 같은 플레이어 어휘로 검증한다
- **Rationale:** 내부 탭 상태만 바뀐 캡처는 사용자가 보는 패널의 가독성이나 레이아웃을 증명하지 못하며, 화면별 용어 혼용도 놓치기 쉽다

### R19: Prove The Map In Its First Viewport
- **Rule:** 지도 smoke는 실제 `MapNavigator` root가 렌더되고 transient level/phase overlay가 사라진 뒤, 첫 viewport에서 현재 위치와 추천 경로를 함께 확인하며 loading fallback과 legacy label을 거부한다
- **Rationale:** 탭 상태나 긴 element 전체 캡처만으로는 플레이어가 지도를 열었을 때 경로를 즉시 이해할 수 있는지 증명할 수 없다

### R20: Verify First-Session Language As One Continuous Record
- **Rule:** 신규 세션 문구를 바꾸면 reset 이후 시작, 첫 이동, 첫 방문, 첫 승리, 전투 후 판단, 모험 종료 기록을 순서대로 검증하고 이전 상태 누출, 영문 약어, 잘못된 조사, 괄호·아이콘 의존 문구를 거부한다
- **Rationale:** 패널별 문구가 자연스러워도 실제 플레이 기록에 이전 reset 안내나 기계적 보상 표기가 하나만 남으면 첫 여정 전체가 개발 로그처럼 느껴진다

### R21: Keep Commerce And Equipment In One Vocabulary
- **Rule:** 상점, 장비, 가방은 `골드 / 등급 / 공격력 / 방어력 / 치명타 / 생명 / 기력 / 한손 무기 / 양손 무기`를 공통으로 사용하고, 실제 390px 화면에서 가격·교체 변화·장착 슬롯이 잘리지 않는지 함께 검증한다
- **Rationale:** 같은 구매 판단 안에서 화폐 단위와 능력치 이름이 달라지거나 작은 요약 카드가 줄바꿈되면 플레이어는 장비의 가치를 비교하기 전에 표기 체계부터 다시 해석해야 한다

### R22: Protect One-Time Content At Both Boundaries
- **Rule:** 일회성 정적 콘텐츠는 목록 노출과 직접 action 양쪽에서 완료 ledger를 검사한다
- **Rationale:** UI 필터만으로는 stale 화면이나 직접 호출을 막지 못하고, action guard만으로는 실행 불가능한 콘텐츠를 플레이어에게 노출한다

### R23: Separate Transient Detection From Lifetime
- **Rule:** entity 변화 감지 effect와 banner·toast 해제 timer effect를 분리하고, timer는 transient state 자체만 dependency로 삼는다
- **Rationale:** 매 턴 변하는 domain entity에 timer cleanup을 묶으면 해제가 영원히 연기될 수 있다

### R24: Persist Every Supported Offline Run
- **Rule:** 오프라인 게임 시작을 정상 흐름으로 제공하면 cloud payload와 호환되는 versioned local snapshot을 유지하고 reset에서 함께 제거한다
- **Rationale:** 모바일의 앱 전환·종료는 일상적인 lifecycle이므로, 접속 실패를 허용하면서 재실행 시 런을 잃는 동작은 저장 계약의 모순이다

### R25: Simulate The Actual Combat Resource Loop
- **Rule:** 초반 전투 밸런스 회귀 테스트는 평균 피해량이나 처치 턴 공식만 비교하지 말고, 실제 전투 엔진의 페이즈 전환, 행동 확률, 상태이상, 기력 제한, 소모품 사용 후 적 행동을 결정론적 seed로 반복 검증한다
- **Rationale:** 평균상 승리 가능한 전투도 운 나쁜 분기에서 시작 자원을 모두 고갈시키면 첫 세션 흥미를 해치며, 단순 TTK 계산은 이 꼬리 위험을 드러내지 못한다

### R26: Explain Persistent Progress Signals
- **Rule:** 상시 HUD의 진행 수치와 장착 보너스는 아이콘이나 비율만 보여 주지 말고 `장비 조화 2/3`, `전설 각인 1`처럼 대상과 의미를 플레이어 언어로 함께 표시한다
- **Rationale:** 설명 없는 아이콘과 숫자는 임무 진행, 전투 상태, 장비 효과를 구분하기 어렵게 만들며 매 화면에서 의미를 다시 추측하게 한다

### R27: Keep Visual Fixtures Physically Valid
- **Rule:** 직업·장비·외형을 교체하는 UI fixture는 파생 최대 생명·기력을 다시 계산하고 현재 수치를 그 범위 안에 유지하며, 강화 배지는 `강화 +1`처럼 대상이 드러나는 플레이어 언어로 표시한다
- **Rationale:** 최대치를 넘는 생명·기력과 설명 없는 `+N`은 정상 아트도 깨진 상태처럼 보이게 만들고, 해당 캡처를 acceptance evidence로 신뢰할 수 없게 한다

### R28: Keep Navigation Inside Its Own Scroll Boundary
- **Rule:** 모바일 보조 기록 화면은 선택 본문을 첫 viewport에 우선 배치하고, 가로 탭 자동 정렬은 해당 레일의 `scrollLeft`만 변경한다. 마을 행동은 주 행동 화면에 두며 문서 전체에 영향을 주는 `scrollIntoView`와 중복 메뉴를 사용하지 않는다
- **Rationale:** 반복 탐색과 중복 행동이 본문을 아래로 밀면 기록 화면을 열 때마다 목적을 다시 찾아야 하며, 문서 전체 스크롤은 실제 터치 프레이밍과 QA 캡처를 함께 깨뜨린다

### R29: Separate Emulator Renderer Artifacts From App Regressions
- **Rule:** Android headless 에뮬레이터의 패널 중복, 글자 누락, 검은 영역은 같은 APK를 `-gpu host`로 재실행해 안정 프레임을 비교한 뒤 앱 회귀로 분류한다. 에뮬레이터 통과는 물리 Android의 터치·성능·아트 QA를 대체하지 않는다
- **Rationale:** SwiftShader의 WebView blur 합성 결함은 정상 DOM과 앱 프로세스를 유지한 채 화면만 깨뜨릴 수 있어, 즉시 CSS를 바꾸면 실제 기기 품질을 낮추고 원인을 숨길 수 있다

### R30: Diagnose Device State At Every Native Step
- **Rule:** iOS 실기기 smoke는 metadata, install, post-install 확인, launch를 같은 오류 분류 경계로 실행하고, install 전 잠금이 확인되면 뒤 단계를 반복하지 않고 기기 잠금 해제 handoff로 종료한다
- **Rationale:** CoreDevice는 Developer Disk Image를 요구하는 첫 명령부터 잠금으로 실패할 수 있으므로 launch만 진단하면 사용자가 같은 원인의 긴 로그와 실패를 여러 번 겪게 된다

### R31: Keep Android Delivery Physical-First And Save-Preserving
- **Rule:** Android release acceptance smoke는 승인된 물리 기기를 기본으로 선택하고 에뮬레이터는 명시적 preflight opt-in으로만 허용한다. 설치는 `adb install -r`로 세이브를 보존하며 실패 시 저장 공간과 서명 원인을 구분한 뒤 앱 삭제 결정은 사용자에게 남긴다
- **Rationale:** 에뮬레이터 성공을 물리 기기 완료로 오인하거나 자동 재설치 과정에서 플레이어 세이브를 잃는 일을 막으면서, install·launch·foreground hold를 동일한 재현 경로로 검증해야 한다

### R32: Separate Local Export From External Upload
- **Rule:** iOS archive, App Store용 local export, App Store Connect upload를 서로 다른 승인 경계로 다룬다. `destination=upload`는 명시적 opt-in 없이는 실행하지 않고, signing 및 provisioning 옵션은 archive와 export 양쪽에서 같은 의미를 유지한다
- **Rationale:** 로컬 산출물 검증 명령이 외부 배포로 이어지거나 archive는 성공했는데 export만 다른 signing 조건으로 실패하는 일을 막고, 사람의 승인 시점을 명확하게 남겨야 한다

---

## 📝 Post-Mortem Template

```markdown
### [YYYY-MM-DD] Issue Title

**Symptom:** 
**Root Cause:** 
**Fix Applied:** 
**New Rule:** 
**Prevention:** 
```
