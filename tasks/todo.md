# Aetheria RPG - Task Board

**Last Updated:** 2026-03-14  
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
- 실기기 수동 QA 결과 반영
- iOS 배포 서명 및 TestFlight 업로드
- Android 실제 release keystore 기준 최종 번들 검증

### 🔄 In Progress
- 출시 후보 빌드 회귀 검증 및 문서 정리
- iPhone / Android 실기기 5분 빠른 루틴 수행 및 이슈 수집
- 모바일 전용 UI 리팩토링 후 실기기 터치 감각 검증
- 모바일 첫 화면 HUD 밀도와 전투 보상 체감 실기기 기준 튜닝
- 추천 행동 강조와 전리품 업그레이드 힌트의 실기기 체감 확인
- 이동 추천 카드와 월드맵 추천 경로의 실기기 체감 확인
- 성향 공명 상점 정렬과 전리품 공명 힌트의 실기기 가독성 확인
- 상점 오버레이와 전투 결과 카드의 실기기 터치/스크롤 감각 확인
- 전투 보상에서 인벤토리 스포트라이트로 이어지는 검토 흐름의 실기기 체감 확인

### ✅ Completed
- 게임 품질 개선 1차: 클래스 빌드 적합도, 보스 브리핑, 칭호 패시브, 런 진단
- 브라우저 smoke 자동화: `scripts/smoke-gameplay.mjs`, `scripts/local-playtest.sh`
- 네이티브 재검증: `mobile:doctor`, `cap:sync`, `android:debug`, `ios:build:device`
- 모바일 입력창 제거 및 버튼 중심 진행 흐름 적용
- `Run diagnostics` 제거 후 `성향` 기반 패시브/전용 스킬 UI 적용
- 모바일 전투 결과 카드 소형화 및 1H/2H 장비 표기 강화
- 목표 가이드 HUD 추가: 현재 목표, 퀘스트 펄스, 탐험 예보, 추천 행동 바로가기
- 이동 추천 UX 추가: `MOVE` 패널 추천 카드, 월드맵 추천 경로 요약
- 성향 보상 루프 1차: 상점 공명 정렬, 전투 보상 공명 힌트
- 상점/전투 보상 스모크 보강: 시장 오픈 캡처, 모바일 획득 포인트 카드 압축
- 전리품 검토 스포트라이트 추가: 전투 결과에서 인벤토리 하이라이트로 직행, 스모크에서 `review loot -> inventory spotlight` 검증

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
