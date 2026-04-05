# Aetheria RPG - Task Board

**Last Updated:** 2026-03-31  
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
- `iPhone 14 Pro Max` CoreDevice 연결 복구 후 최신 UI archive 재설치/런치 재확인 (`xcrun devicectl list devices`에서 `No provider was found`, `xcrun xctrace list devices`에서 실기기 `offline` 상태로 확인되어 현재 호스트-디바이스 연결이 blocker)
- Android 실제 release keystore 기준 최종 번들 검증 (`android/key.properties` 또는 `AETHERIA_ANDROID_KEYSTORE_*` 누락으로 현재 blocker)
- Android 실기기 연결 후 5분 루틴 재실행
- Android QA 환경 준비 (`adb` 또는 연결 가능한 실기기 확보)

### 🔄 In Progress
- 새 기능 추가를 멈추고 `RC-1` 고정 기준으로 실기기 QA -> 수정 -> signed build 순서로 전환
- 최신 디자인 패스를 `cap:sync -> android:debug -> ios:build:device -> ios:archive`까지 반영한 상태에서, `iPhone 14 Pro Max`가 현재 `CoreDevice provider missing + xctrace offline device` 상태라 호스트 연결 복구 후 재설치/실행만 남음
- 모바일 `Field Log` 확장판과 시체 회수 복구(`grave` 유지/로드/회수) 기준으로 iPhone 실기기 재확인
- 보스 브리핑 / 성향 공명 / 빌드 유도 퀘스트 / 탐험 템포 신호의 실기기 판독성 확인
- 최신 모바일 `Field Log -> Status -> Field Actions` 구조 기준 iPhone 5분 루틴 재실행 및 결과 수집
- `Archive Dock` 상태별 숨김, 4열 액션 그리드의 `RESET` 위치, 카드 내부 `구매` 상점 플로우의 실기기 사용성 확인

### ✅ Completed
- 모바일 수동 테스트 셋업 갱신 완료: `npm run test:unit`, `npm run lint`, `npm run mobile:doctor`, `./scripts/local-playtest.sh`, `npm run cap:sync`, `npm run android:debug`, `npm run ios:build:device`, `npm run ios:archive`를 순서대로 다시 통과시켜 최신 레이아웃이 Android debug APK와 iOS signed archive에 반영된 상태까지 정리했고, preview는 `4173` 충돌 시 `4174`로 우회해 smoke를 마무리함
- 모바일 포커스 패널 레이아웃 리팩터 완료: `App.jsx`에서 `EVENT / SHOP / QUEST_BOARD / JOB_CHANGE / CRAFTING` 상태를 모바일 focus stage로 분리해 `Field Feed / Snapshot / Archive Dock` 스택과 동시 렌더링되지 않도록 정리하고, `ControlPanel` 및 `EventPanel / ShopPanel / QuestBoardPanel / JobChangePanel / CraftingPanel`이 고정 overlay 대신 인라인 `flex-1` 스테이지로 동작하게 바꾼 뒤 `TerminalView` 모바일 최소 높이도 줄여 세로 낭비를 완화하고 `npm run test:unit`, `npm run lint`, `npm run build:guard`, `./scripts/local-playtest.sh` 검증까지 완료
- 게임 구성 오퍼레이션 큐레이션 패스 완료: `src/utils/questOperations.js`로 스토리/빌드/성장/보스/토벌 축 기반 추천 오퍼레이션 선택 로직을 추가하고, `QuestBoardPanel`이 추천 3개와 백로그를 분리해 보여주도록 정리했으며 `adventureGuide`도 새 임무 없음 상태에서 최우선 추천 작전을 직접 언급하도록 연결한 뒤 `npm run test:unit`, `npm run lint`, `npm run build:guard`, `./scripts/local-playtest.sh` 검증까지 완료
- 디자인 패스 후 네이티브 재패키징 완료: `npm run test:unit`, preview 기반 `npm run test:smoke`, `npm run mobile:doctor`, `npm run cap:sync`, `npm run android:debug`, `npm run ios:build:device`, `npm run ios:archive`를 다시 통과시켜 최신 모바일 UI가 Android debug APK와 iOS signed archive에 반영된 상태까지 확인
- 모바일 비주얼 패스 1안+2안 완료: `StatusBar`, `TerminalView`, `ControlPanel`, `Dashboard` 모바일 요약/도크/시트, `CombatPanel`, `ShopPanel`, `EventPanel`, `QuestBoardPanel`, `QuestTab`, `StatsPanel`, `SmartInventory`, 공통 `aether` surface 계층을 같은 톤으로 재정리해 첫 화면 HUD/액션 그리드부터 상점·이벤트·전투·아카이브까지 트렌디한 밀도와 위계를 맞춘 뒤 `npm run lint`, `npm run build:guard`, `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh` 기준 desktop/mobile smoke + desktop/mobile perf 재검증 완료
- 모바일 상점 smoke guard 안정화 완료: `scripts/smoke-gameplay.mjs`가 모바일 상점에서 비액션 카드 shell 클릭에 의존하지 않고 실제 `구매` CTA 노출/overlay close 경로를 검증하도록 정리해 fixed sheet hit-test 편차로 인한 false negative를 제거
- Android internal signed artifact 검증 완료: 로컬 `~/.android/debug.keystore`를 환경변수로 주입해 `npm run android:release`와 `npm run android:release:apk`를 통과시키고 내부 확인용 산출물 `android/app/build/outputs/bundle/release/app-release.aab`, `android/app/build/outputs/apk/release/app-release.apk` 생성까지 확인
- 인트로 수정 후 RC-1 네이티브 전달 재검증 완료: `./scripts/local-playtest.sh`, `npm run ios:build:device`, `npm run ios:archive`를 다시 통과시키고 `xcrun devicectl`로 연결된 `iPhone 14 Pro Max`(`FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`)에 `build/ios/Aetheria.xcarchive/Products/Applications/App.app`를 재설치/런치해 최신 빌드가 실기기에서 뜨는 것까지 확인
- 모바일 인트로 진입 복구 및 첫인상 보정 완료: `App.jsx` 인트로 래퍼를 `min-h-full` 스크롤 안전 구조로 바꾸고 `IntroScreen.jsx`에서 모바일 카드 shrink/clipping을 제거했으며, 콜사인/시그널/챌린지/CTA 위계를 재정리해 시작 버튼 접근성을 복구한 뒤 `lint`, `build:guard`, `test:unit`, desktop/mobile smoke, desktop/mobile perf, `mobile:doctor`, `cap:sync`, `android:debug`, `ios:archive` 검증 완료
- 데스크톱 웹 로그 중심 단순화 완료: 상단 `Field Briefing` 제거, 우측 정보 카드 스택 제거, 하단 액션 덱을 우측 `Archive / Actions` 컬럼으로 이동, 데스크톱 배경/로그 대비를 장시간 플레이 기준으로 완화
- 전투 중 소모품 사용, 다중 시체 유지/회수, 마을 복귀 시 임시 버프/상태 정리 버그 수정 완료
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
- 크로스플랫폼 디자인 리프레시 완료: `moonlit archive` 테마 기반으로 인트로, 로그, 아카이브, 액션, 전투, 이벤트, 상점, 퀘스트 UI를 재구성하고 모바일 시작 시 `ChevronUp` import 누락으로 발생하던 런타임 크래시를 수정한 뒤 `build`, `lint`, `local-playtest` 재검증 완료
- 상시 상태 표시 패스 완료: `StatusBar`를 공통 상단 HUD로 추가해 닉네임/직업/레벨/골드/HP/NRG/EXP를 모바일/웹 어디서든 바로 보이게 만들고, 모바일 중복 요약을 `Field Snapshot`으로 축소한 뒤 `local-playtest` 재검증 완료
- 상태 정리 2차 완료: 전투 중 적 HP/보스 표시까지 상단 `StatusBar`로 끌어올리고, 데스크톱 아카이브 헤더의 중복 플레이어 상태 칩을 제거해 상단 HUD를 단일 상태 기준축으로 정리한 뒤 `local-playtest` 재검증 완료
- 아카이브 탭 밀도 정리 완료: `SmartInventory`, `QuestTab`, `SystemTab`의 오래된 네온 카드/배너를 공통 카드 언어로 정리하고 요약/버튼/빈 상태를 압축한 뒤 `local-playtest` 재검증 완료
- 아카이브 마감 패스 완료: `StatsPanel`, `MapNavigator`, `Bestiary`, `BuildAdvicePanel`까지 동일한 카드 언어로 정리하고 남아 있던 lint 경고를 제거한 뒤 `local-playtest` 재검증 완료
- 오버레이/모달 마감 패스 완료: `RelicChoicePanel`, `RunSummaryCard`, `PostCombatCard`를 현재 `moonlit archive` 톤으로 재정리하고, 실제 앱에서 빠져 있던 `PostCombatCard`를 `App.jsx`에 다시 연결한 뒤 `local-playtest` 재검증 완료
- 오버레이 QA 훅 보강 완료: `App.jsx` 테스트 API에 `injectRelicChoice`, `injectRunSummary`를 추가해 Playwright에서 전투 결과/유물/런 요약 오버레이를 강제 렌더링하고 시각 검증까지 완료
- 데스크톱 밀도 압축 패스 완료: `StatusBar`를 한 줄 HUD로 축소하고, 우측 `Archive` 폭과 `Actions` 도킹 영역을 더 압축해 로그 폭을 넓혔으며 `lint`, `build`, Playwright 데스크톱 시각 확인까지 완료
- smoke 안정화 완료: `runtimeMode` 기반 `?smoke=1` 분기, `useFirebaseSync` / `AI_SERVICE` smoke fallback, same-origin만 보는 `smoke-gameplay.mjs`, free-port `local-playtest.sh`를 적용한 뒤 최신 `local-playtest`에서 `[smoke:desktop] ok`, `[smoke:mobile] ok` 재확인 완료
- 데스크톱 breakpoint 회귀 완료: `1440 / 1280 / 1024` 폭에서 compact HUD, 우측 `Archive`, 우하단 `Actions` 도크를 확인했고 추가 micro-adjust는 불필요한 상태
- narrow desktop compact rail 완료: `768 ~ 1099px` 구간에서 `App.jsx`가 `Field Log`를 상단 full-width로 유지하고 `Archive + Actions`를 하단 rail로 재배치하도록 분기했으며, `StatusBar` compact desktop 모드로 위치 텍스트를 제거해 HUD 밀도를 더 낮춘 뒤 `lint`, `build`, `local-playtest`, Playwright `820 / 768` 폭 시각 검증까지 완료
- narrow desktop density tightening 완료: `Dashboard.jsx`의 archive 탭을 1줄 horizontal pill rail로 축소하고 `ControlPanel.jsx`에 `compactDesktop` 밀도 경로를 추가해 하단 rail 높이를 더 줄였으며, `App.jsx`의 compact rail 높이/폭까지 함께 축소한 뒤 `lint`, `build`, `local-playtest`, Playwright `960 / 820 / 768` 폭 검증까지 완료
- 데스크톱 세로 로그 복원 완료: 사용자 피드백에 맞춰 `App.jsx`의 데스크톱 레이아웃을 다시 `좌측 tall log / 우측 Archive + Actions` 구조로 통일하고, 데스크톱 `StatusBar`를 전역 compact 모드로 축소해 세로 로그 길이를 확보했으며 `lint`, `build`, `local-playtest`, Playwright `1024 / 1440` 폭 검증까지 완료
- 데스크톱 우측 컬럼 사용성 보정 완료: `StatusBar.jsx`의 데스크톱 HUD를 더 얇게 만들고 `Dashboard.jsx`의 compact desktop 탭을 dense 4열 grid로 바꿔 `1024px`에서도 우측 사이드바 탭 안정성을 높였으며 `lint`, `build`, `local-playtest`, Playwright `1024 / 1440` 재검증까지 완료
- 데스크톱 우측 컬럼 정보 위계 정리 완료: `Dashboard.jsx`에서 `Inventory / Quest / Map`를 1차 탭으로 올리고 나머지 탭은 2차 아이콘 행으로 낮췄으며, `ControlPanel.jsx`는 추천/상황 기반 우선 액션 2개를 먼저 보여주도록 재구성해 `1024px`에서도 오른쪽 레일 스캔 속도를 개선하고 `lint`, `build`, `local-playtest`, Playwright `1024 / 1440` 재검증까지 완료
- 데스크톱 아카이브 탭 내부 compact화 완료: `Dashboard.jsx`가 데스크톱 우측 레일에서 `Inventory / Quest / Map`에 compact 표현을 넘기도록 하고, `SmartInventory`, `QuickSlotAssigner`, `QuestTab`, `MapNavigator`, `BuildAdvicePanel`의 카드/필터/버튼/요약 밀도를 줄여 `1024px`에서도 탭 내용이 덜 답답하게 읽히도록 정리한 뒤 `lint`, `build`, `local-playtest`, Playwright `1024 / 1440` 재검증까지 완료
- 데스크톱 Actions compact grid 완료: `ControlPanel.jsx`에서 우선 액션은 유지하되 보조 액션을 더 작은 3열 그리드와 짧은 라벨로 재구성하고 reset/이동 패널 밀도까지 함께 줄여 우측 하단 패널 높이를 낮춘 뒤 `lint`, `build`, `local-playtest`, Playwright `1024 / 1440` 재검증까지 완료
- 데스크톱 Status strip 압축 완료: `StatusBar.jsx`의 상단 HUD를 `identity strip + inline HP/NRG/EXP meter` 구조로 바꾸고 전투 중 적 HUD와 `App.jsx` 상단 래퍼 패딩까지 함께 줄여 로그 세로 공간을 추가 확보한 뒤 `lint`, `build`, `local-playtest`, Playwright `1024 / 1440` 재검증까지 완료
- 데스크톱 Map 정보량 축소 완료: `MapNavigator.jsx`에서 compact sidebar 기본 상태를 `현재 위치 + 추천 경로 + 우선 지역 6개` 중심으로 줄이고 `+N 더 보기 / 요약 보기` 토글로 전체 맵 접근은 유지해 우측 레일 높이를 낮춘 뒤 `lint`, `build`, `local-playtest`, Playwright `1024 기본/확장 + 1440 기본` 검증까지 완료
- 데스크톱 Inventory / Quest 요약 패스 완료: `SmartInventory.jsx`에서 compact 기본 상태를 우선 보관품 3개 + `+N 더 보기 / 요약 보기` 구조로 바꾸고, `QuestTab.jsx`에서도 compact 미션 스택과 Daily Protocol 요약 경로를 추가해 우측 레일 첫 화면 높이를 더 낮춘 뒤 `lint`, `build`, `local-playtest`, Playwright `1024 인벤 기본/확장 + 퀘스트 기본` 검증까지 완료
- 데스크톱 Stats / System 요약 패스 완료: `StatsPanel.jsx`와 `SystemTab.jsx`에 compact 기본 상태용 요약 카드와 `더 보기 / 요약 보기` 토글을 추가하고, `Dashboard.jsx`에서 compact prop을 연결한 뒤 `1024px`에서 발생하던 System 요약 헤더 overflow까지 보정하고 `lint`, `build`, `local-playtest`, Playwright `1024 통계/시스템 기본` 검증까지 완료
- 데스크톱 Achievements / Skills / Bestiary 요약 패스 완료: `AchievementPanel.jsx`, `SkillTreePreview.jsx`, `Bestiary.jsx`에 summary-first compact 상태와 `더 보기 / 요약 보기` 토글을 추가하고, `Dashboard.jsx`에서 compact prop을 연결하며 `SkillTreePreview`의 선택 스킬 강조도 실제 스킬 이름 기준으로 보정한 뒤 `lint`, `build`, `local-playtest`, Playwright `1024 요약/확장` 검증까지 완료
- 데스크톱 Archive shell / Actions chrome 압축 완료: `Dashboard.jsx`에서 compact 데스크톱 탭 셸을 `Archive + active tab` 1줄 헤더와 `8개 아이콘 2행` dense matrix로 재배열하고, `ControlPanel.jsx`에서는 보조 액션을 더 작은 아이콘 레일로 줄였으며, `App.jsx` 우측 컬럼 폭도 소폭 축소해 `1024px`에서 로그 가시 영역을 더 확보한 뒤 `lint`, `build`, `local-playtest`, `node scripts/smoke-gameplay.mjs --viewport-width 1024 --viewport-height 900` 검증까지 완료
- 데스크톱 Combat / Moving dense rail 패스 완료: `CombatPanel.jsx`에 narrow rail 전용 dense 메타/아이템 렌더링을 추가하고 `ControlPanel.jsx`에서 전투 dense 분기와 `GS.MOVING` 경로 카드 축약을 연결해 `1024px` 우측 레일 높이를 더 줄인 뒤 `lint`, `build`, `local-playtest`, `1024px` 전투/이동 캡처 검증까지 완료
- 데스크톱 Terminal footer 압축 완료: `QuickSlot.jsx`에 dense 퀵슬롯 경로를 추가하고 `TerminalView.jsx` 데스크톱 풋터를 `퀵슬롯 + 입력창` 1줄 구조로 재배열해 로그 세로 공간을 더 확보한 뒤 `lint`, `build`, `local-playtest`, `1024px` 첫 화면 풋터 캡처 검증까지 완료
- 데스크톱 Top chrome 압축 완료: `StatusBar.jsx`의 compact HUD와 적 타깃 strip, `TerminalView.jsx` desktop 헤더, `App.jsx` 상단 wrapper 패딩을 더 줄여 `1024px`에서 로그 시작 지점을 위로 당긴 뒤 `lint`, `build`, desktop smoke, 별도 mobile smoke, `1024px` 상단 캡처 검증까지 완료
- 데스크톱 Log density 패스 완료: `TerminalView.jsx`의 desktop 로그 카드 인셋/stack gap/row padding/line-height/icon/loading row를 더 줄여 본문에서 더 많은 로그 행이 보이게 했고, `lint`, `build`, `local-playtest`, production preview `1024px` multi-row 캡처(`/tmp/log-density-1024-multirows.png`) 검증까지 완료
- 데스크톱 Archive 높이 축소 패스 완료: `Dashboard.jsx`에서 compact archive 셸 padding/헤더/icon matrix를 더 줄이고, `SmartInventory.jsx`에서는 compact 필터 바를 1줄 rail로 바꾸고 summary 카드의 퀵슬롯 제어를 요약 표기로 낮춰 첫 화면 우측 레일 높이를 더 줄인 뒤 `lint`, `build`, `local-playtest`, production preview `1024px` 캡처(`/tmp/archive-height-compact-1024.png`) 검증까지 완료
- 데스크톱 Actions 높이 축소 패스 완료: `ControlPanel.jsx`에서 compact desktop `Actions` 패널의 셸 padding, 헤더 gap, 우선 액션 버튼 높이, 보조 icon grid gap/height, reset 높이를 더 줄여 우하단 고정 높이를 낮춘 뒤 `lint`, `build`, `local-playtest`, production preview `1024px` 캡처(`/tmp/actions-height-compact-1024.png`) 검증까지 완료
- 데스크톱 Map compact 요약 패스 완료: `MapNavigator.jsx`에서 compact 기본 상태의 현재 위치/추천 이동/우선 지역 카드 밀도를 더 낮추고 기본 지역 수를 5개로 줄였으며, `BuildAdvicePanel.jsx`는 compact closed/open 상태를 더 얇은 strip·짧은 요약 중심으로 바꾼 뒤 `local-playtest` 재검증과 `node scripts/smoke-gameplay.mjs --artifact-label desktop-1024-map-compact`로 생성한 `08a-map-tab.png` 시각 확인까지 완료
- 데스크톱 Log 위계 마감 패스 완료: `TerminalView.jsx`에 desktop 전용 타입 배지(`COMBAT / CRIT / SYS / EVENT / WARN / ERROR / GAIN / AI`)를 추가하고 전투·치명·이벤트 대비를 조금 더 높이는 대신 시스템·스토리 로그는 한 단계 낮춰 읽기 흐름을 정리했으며, `scripts/smoke-gameplay.mjs`의 artifact screenshot timeout을 `60000ms`로 늘린 뒤 `lint`, `build`, `local-playtest`, `node scripts/smoke-gameplay.mjs --artifact-label desktop-1024-log-hierarchy` 검증까지 완료
- 빌드 경고 정리 패스 완료: `useGameActions.js`의 `../data/relics` 동적 import를 static import로 통일해 mixed import warning을 제거하고, `vite.config.js`에서 `game-data / archive-panels / game-combat` manual chunk 분리를 적용해 main entry chunk 경고도 없앤 뒤 `lint`, `build`, `local-playtest` 전체 검증까지 완료
- build regression guard 패스 완료: `scripts/build-guard.mjs`를 추가해 `relics.js` mixed import, oversized chunk, manual chunk cycle warning을 다시 감지하면 즉시 실패하도록 만들고, `package.json`의 `build:guard` 및 `scripts/local-playtest.sh` 빌드 단계까지 guard 경로로 연결한 뒤 `lint`, `build:guard`, `local-playtest` 검증까지 완료
- perf guard + playtest 안정화 패스 완료: `scripts/perf-guard.mjs`로 desktop/mobile cold start·첫 상호작용·market open latency를 측정하고 `AETHERIA_RUN_PERF=1` opt-in 경로를 `local-playtest.sh`에 연결했으며, 포트 탐색을 bounded retry로 고치고 `smoke-gameplay.mjs`/`perf-guard.mjs` 종료 경로를 명시적으로 닫아 모바일 smoke hang까지 제거한 뒤 `lint`, `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh` 검증까지 완료
- 앱 내부 성능 마크 패스 완료: `src/utils/performanceMarks.js`를 추가하고 `App.jsx`/`IntroScreen.jsx`에서 `app-mounted`, `boot-ready`, `intro-visible`, `run-ready`, `shop-open` 마크와 measure를 기록하도록 한 뒤, `perf-guard.mjs`가 test-side mark와 app-side measure를 함께 읽어 desktop/mobile perf artifact에 저장하도록 보강하고 `lint`, `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh` 검증까지 완료
- 모바일 market open 최적화 패스 완료: `ShopPanel.jsx`에서 상점 buy-list 정렬용 affordability/equipability/resonance 계산을 memoized view model로 바꾸고, 모바일은 초기 12개만 먼저 렌더한 뒤 `더 보기`로 확장되게 바꿔 첫 오픈 commit 비용을 낮춘 뒤 `lint`, `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh` 검증 기준 mobile `marketOpenMs 1357.6 -> 341.2`, `marketOpenMeasureMs 1336.7 -> 318.4` 개선까지 확인
- start-run prefetch + chunk graph 정리 패스 완료: `App.jsx`에서 lazy `Dashboard`를 intro-ready 시점에 미리 `loadDashboard()` 하도록 바꿔 첫 런 클릭 경로의 cold fetch 비용을 줄이고, 같은 파일에서 `engine.getFullStats()`를 렌더당 1회로 재사용하도록 정리했으며, `vite.config.js`에서는 `archive-panels` manual chunk를 제거해 `Dashboard` lazy chunk 도입 후 다시 생긴 circular chunk warning을 없앤 뒤 `lint`, `build:guard`, desktop/mobile `smoke-gameplay`, desktop/mobile `perf-guard` 검증까지 완료
- market open perf 측정 안정화 패스 완료: `scripts/perf-guard.mjs`에 `markAndDomClick()`를 추가해 `market` 퍼포먼스 마크와 버튼 클릭이 같은 페이지 턴에서 일어나도록 바꿔 Playwright 모바일 탭 오버헤드를 제거했고, `lint` 및 순차 desktop/mobile `perf-guard` 재검증 기준 `marketOpenMs / marketOpenMeasureMs`를 desktop `20.4 / 3.7`, mobile `44.6 / 3.7`로 안정화 확인
- playtest 종료 guard + iPhone 실기기 패스 완료: `scripts/smoke-gameplay.mjs` / `scripts/perf-guard.mjs`에 close-timeout guard를 추가해 `local-playtest` wrapper가 smoke/perf 종료 후 `[local-playtest] done`까지 안정적으로 떨어지도록 정리했고, `AETHERIA_RUN_PERF=1 ./scripts/local-playtest.sh`, `npm run cap:sync`, `npm run mobile:doctor`, fresh DerivedData 기반 `npm run ios:archive`, `xcrun devicectl` install/launch/process 확인까지 완료

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
