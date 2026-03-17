# Aetheria RPG - Task Board

**Last Updated:** 2026-03-17  
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
- RC-1 기준 iPhone / Android 실기기 QA 완료
- iPhone 실기기 5분 빠른 루틴 수행 및 이슈 수집
- 실기기 수동 QA 결과 반영
- TestFlight 업로드
- Android 실제 release keystore 기준 최종 번들 검증
- Android 실기기 연결 후 5분 루틴 재실행
- Android QA 환경 준비 (`adb` 또는 연결 가능한 실기기 확보)

### 🔄 In Progress
- 새 기능 추가를 멈추고 `RC-1` 고정 기준으로 실기기 QA -> 수정 -> signed build 순서로 전환
- 연결된 `iPhone 14 Pro Max`에 최신 `com.aetheria.roguelike` 설치/실행까지 완료한 상태에서 5분 터치 QA 대기
- 모바일 `Field Log` 확장판과 시체 회수 복구(`grave` 유지/로드/회수) 기준으로 iPhone 실기기 재확인
- 보스 브리핑 / 성향 공명 / 빌드 유도 퀘스트 / 탐험 템포 신호의 실기기 판독성 확인
- 최신 모바일 `Field Log -> Status -> Field Actions` 구조 기준 iPhone 5분 루틴 재실행 및 결과 수집
- `Archive Dock` 상태별 숨김, 4열 액션 그리드의 `RESET` 위치, 카드 내부 `구매` 상점 플로우의 실기기 사용성 확인

### ✅ Completed
- 최신 로그/시체 복구 빌드 iPhone 반영 완료: `npm run cap:sync`, `npm run ios:archive` 후 signed archive를 `iPhone 14 Pro Max`에 재설치하고 `com.aetheria.roguelike` 실행 확인
- 로그/시체 복구 보정 패스 완료: 모바일 `Field Log`를 남는 세로 공간까지 더 길게 쓰도록 `App.jsx`/`TerminalView.jsx` 레이아웃을 재조정하고, 사망 후 `grave`가 `RESET_GAME`/`LOAD_DATA`를 거쳐 유지되도록 복구
- 시체 보상 로직 복구: `CombatEngine.handleDefeat`가 다시 골드 절반 + 비-스타터 장비 1~2개를 `grave.items`로 남기고, `lootGrave`가 다중 아이템/구세이브 단일 `grave.item` 모두 회수하도록 정리
- 회귀 검증 추가: `src/utils/graveUtils.js` 도입 후 `tests/grave-recovery.test.js`로 시체 생성/회수 로직을 고정하고 `test:unit`, `lint`, `build`, `local-playtest` 재통과
- 모바일 밀도 보정 2차 완료: `Status` 장비 표시를 `LEFT / RIGHT / ARMOR` 1행으로 압축, `AUTO EXPLORE` 제거, 전투 정리 오버레이 제거 후 로그 요약화, 상점 카드 높이 축소, signed iPhone 재설치/재실행 확인
- 최신 iPhone QA 준비 완료: `npm run cap:sync`, `npm run ios:archive` 후 signed archive를 연결된 `iPhone 14 Pro Max`에 재설치하고 `com.aetheria.roguelike` 실행 확인
- 구현 계획서 정리 및 코드 정비 패스 완료: `implementation_plan.md` 생성, `recentBattles` 기반 `lowHpWins` 복구, `ControlPanel` 추천 CTA 실행 연결, `Dashboard.jsx -> DashboardPanels/FocusPanel` 분리, `SmartInventory` 성향 공명 배지, `CombatPanel` 보스 브리핑 추가
- RC-1 재검증 완료: `test:unit`, `lint`, `build`, `local-playtest`, `mobile:doctor`, `cap:sync`, `android:debug`, `ios:build:device`, `ios:archive`
- signed iOS archive 재생성 및 실제 iPhone 설치/실행 확인: `build/ios/Aetheria.xcarchive` 기준 `xcrun devicectl` 설치/런치 성공
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
- 모바일 디자인 폴리싱: `Status Core`, `Mission Focus`, `Loadout`, `Field Archive`, `Field Actions`, `Field Log` 계층 재정리 및 모바일 첫 화면 캡처 품질 수정
- 디자인 폴리싱 후 네이티브 재동기화: `cap:sync`, `android:debug`, `ios:build:device` 최신 산출물 재생성
- 모바일 디자인 시스템 패스: `Loadout Snapshot`, `Archive Dock`, 공통 `SignalBadge` 도입으로 첫 화면 구조 재압축 및 추천/공명/업그레이드/주목 신호 통일
- 비주얼 아이덴티티 마감 패스: `AetherMark`, `panel-noise`, 부팅/인트로/필드 로그/오버레이 표면 통일, 모바일 전리품 검토 흐름 정리
- 모바일 전리품 스포트라이트 및 전투 결과 고정 오버레이 스모크 안정화 완료
- 최신 UI 기준 `cap:sync`, `android:debug`, `ios:build:device` 재검증 완료
- 진행상황 복구 패스: 모바일/데스크톱 `Run Progress` 카드 추가로 퀘스트, 성장, 개척, 기록 상태를 상시 노출
- 모바일 밀도 단순화 패스: 첫 화면을 `Status / Progress / Next` 중심으로 재압축하고 장비/추천 안내를 요약형으로 정리
- 스크롤 피로도 저감 패스: 진행 요약을 상태 카드에 통합하고 아카이브/로그를 기본 접힘으로 축소해 첫 화면에 `Field Actions`가 더 빨리 보이도록 조정
- iOS signed archive 및 실제 iPhone 설치/런치 확인: `npm run ios:archive` 성공 후 `xcrun devicectl`로 `com.aetheria.roguelike`를 연결된 iPhone에 설치하고 실행 확인
- 모바일 메인 루프 단순화 패스: 화면 순서를 `Field Log -> Status Strip -> Field Actions`로 재배치하고 `Archive`를 고정 도크 + 바텀시트로 분리, `ShopPanel`을 상단 닫기 가능한 바텀시트 패턴으로 정리
- 모바일 첫 화면 최종 경량화 패스: 빈 퀵슬롯/안내 문구 제거, `Status Strip`의 장비 요약 압축으로 첫 화면에서 액션 도달성을 추가 개선
- 보스전 특수성 강화 1차: 보스 진입 메모, 경고 칩, 첫 클리어 보상 힌트, 초회 토벌 골드 보너스, 전투 결과 보스 캐시 요약 추가
- 성향 시스템 3차: 성향별 보상 초점, 퀘스트 초점, 보스 지시문, 성향 공명 퀘스트 보너스 반영
- 빌드 유도형 퀘스트 추가: `양손 파쇄`, `쌍수 연격`, `방패 요새`, `비전 공명`, `탐험 발견` 퀘스트와 진행도 동기화 로직 추가
- 탐험/이벤트 페이싱 2차: 지역 템포 프로필, `TEMPO` 예보 칩, 보스 전조/변칙 지대 분위기 강화
- 1~5단계 통합 회귀 검증: `test:unit`, `lint`, `build`, `local-playtest`, `cap:sync`, `android:debug`, `ios:build:device`, `ios:archive`, iPhone 재설치/재실행 완료
- 퀘스트/상점 단순화 패스: 미션 터미널 상단 닫기 버튼 추가, 성향 임무 추천 박스 제거, 퀘스트 카드 중복 설명 제거, 모바일 상점을 `선택 -> 하단 구매` 흐름으로 단순화
- 로그 중심 UI 단순화 패스: 상단 `AETHERIA v4` 헤더 제거, 전투 상세 카드 제거, 로그 패널 확장, 모바일 `REST -> RESET` 스택 적용, 상점 카드/문구 압축, 몬스터 세부 정보의 도감 이동
- 로그 중심 UI 단순화 2차: 모바일 `Archive Dock` 상태별 숨김, `Status Strip` 추가 압축, 로그 헤더 축소, 상점 하단 구매 바 제거 및 선택 카드 직접 구매, 액션 패널 리셋 흐름 재정리
- 로그 중심 UI 마감: `docs/PLAYTEST_CHECKLIST.md`를 최신 모바일 구조로 갱신하고, `scripts/smoke-gameplay.mjs`에 첫 화면/도크 숨김/상점 인라인 구매 회귀를 추가한 뒤 `test:unit`, `lint`, `build`, `local-playtest`, `cap:sync`, `mobile:doctor`, `android:debug`, `ios:build:device`까지 재검증 완료
- 출시 후보 운영 문서화: `docs/MOBILE_RELEASE.md`와 `docs/PLAYTEST_CHECKLIST.md`에 `RC-1` 고정 규칙, 실기기 테스트 순서, `P0 / P1 / P2` 분류, Go / No-Go gate 추가
- 모바일 UI 정리 보정: 시작 콜사인 직접 입력, 상태/장비 문구 축약, 4열 액션 그리드, 상점 비교 한 줄화, 모바일 전투 결과 토스트 요약 적용
- `local-playtest` 가시성 보강: 단계 로그와 smoke 체크포인트 로그를 추가하고, serial desktop/mobile smoke가 최종 완료 라인까지 정상 출력되는 것 재확인
- HUD / 상점 압축 보정: 모바일 status 장비 영역을 `RIGHT / LEFT / ARMOR + 아이템명` 3줄로 축소하고, 상점 카드를 `이름 / 1H·2H / 스탯 / 현재 대비 비교` 중심으로 재정리

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
