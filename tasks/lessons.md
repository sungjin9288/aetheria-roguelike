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
