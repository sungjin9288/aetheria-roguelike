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
