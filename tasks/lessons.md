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
