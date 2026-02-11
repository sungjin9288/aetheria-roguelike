# Aetheria RPG - Lessons Learned

**Engineer:** Aetheria Staff Engineer  
**Purpose:** 예기치 못한 에러나 수정 사항을 기록하고, 동일한 실수를 반복하지 않기 위한 규칙을 정의합니다.

---

## 📚 Lessons Log

| Date | Issue | Root Cause | New Rule |
|------|-------|------------|----------|
| 2026-02-05 | (초기화) | N/A | 시스템 구축 완료 |

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
