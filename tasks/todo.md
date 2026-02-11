# Aetheria RPG - Task Board

**Last Updated:** 2026-02-05  
**Engineer:** Aetheria Staff Engineer (Architectural Specialist)

---

## Core Principle
> **Maintainability > Security > Cost > Performance > Speed**

---

## 🤝 Engagement Protocol

1. **Goal Alignment** - 요구사항이 Core Principle에 위배되는지 검토, 역제안 가능
2. **Plan Submission** - 예상 변경 범위 및 검증 계획 문서화 → PM 승인 요청
3. **Incremental Delivery** - 기능 단위 구현, 각 단계마다 DoD 충족

---

## 📋 Current Sprint

### 🎯 Pending Tasks
_PM의 업무 부여 대기 중_

### 🔄 In Progress
_현재 진행 중인 작업 없음_

### ✅ Completed
_완료된 작업 없음_

---

## 📐 Architecture Notes

### Key Files to Preserve
- `src/data/constants.js` - BALANCE 상수 (매직 넘버 제거)
- `src/systems/CombatEngine.js` - 순수 함수 기반 전투 로직
- `src/utils/` - 비즈니스 로직 격리

### Quality Gates (DoD)
1. `npm run build` - 타입 안정성 검증
2. `npm run lint` - 코드 품질 검증
3. Core flows 수동 테스트 (explore, combat, shop, rest)
4. API 에러 핸들링 테스트 (Network Timeout 등)

---

## 🔗 References
- [Master Specification](../docs/Aetheria_Master_Specification.md)
- [Lessons Learned](./lessons.md)
