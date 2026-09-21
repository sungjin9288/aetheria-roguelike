# Codex 실행 브리프 — K3 Capacitor 뒤로가기 런타임 검증 + iOS SPM sync

> 대상: 시뮬레이터/에뮬레이터를 쓸 수 있는 에이전트(Codex). 이 저장소에는 Android 실기기가 없다.
> 배경: Wave 19 K3(`5be25d21`)가 `@capacitor/app`을 넣고 `src/platform/lifecycleBridge.ts`에 `'capacitor'` 분기를 배선했다.
> 단위 테스트(`tests/toss-lifecycle-bridge.test.js`)는 주입한 브릿지의 호출 횟수만 본다 — **실제 `backButton` 이벤트가 오는지는 런타임만 안다.**
> 정적 검증(코드 4단)은 끝났다(계획서 §24.1 "L4 정적 검증"). 남은 것은 아래 두 가지뿐이다.

## 검증할 것 (딱 두 가지)

1. 빌드된 APK의 `assets/capacitor.plugins.json`에 `AppPlugin`이 들어 있는가 — **빌드 절차**의 검증
2. 하드웨어 뒤로가기가 상태별로 아래 표대로 동작하는가 — **이벤트 도달**의 검증

## Android (에뮬레이터)

```bash
npm run android:sync          # 필수. gradlew만 도는 android:debug는 capacitor.plugins.json을 만들지 않는다
npm run android:debug
unzip -p android/app/build/outputs/apk/debug/app-debug.apk assets/capacitor.plugins.json   # "AppPlugin" 포함 확인 → 1번 닫힘
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell input keyevent KEYCODE_BACK   # 각 상태에서 1회
```

상태 진입은 자연 플레이로 한다(시작의 마을 → 상점 버튼 / 탐험 → 이벤트 카드 / 전투). 시드가 필요하면 `VITE_ENABLE_TEST_API=1 npm run android:sync`로 빌드하고 `window.__AETHERIA_TEST_API__`(`src/hooks/useGameTestApi.ts`, e2e 스펙이 쓰는 계약)를 WebView 콘솔에서 쓴다.

| # | 상태 | 진입 | 뒤로가기 기대 | 근거 |
|---|---|---|---|---|
| 1 | idle(시작의 마을) | 부팅 직후 | **앱 종료**(확인 대화 없음) | `MODE_BACK_ACTION.idle = close-app` → `App.exitApp()` |
| 2 | shop | 상점 버튼 | 상점 닫힘, idle | `close-focus-panel` |
| 3 | quest_board / job_change / crafting | 각 패널 버튼 | 패널 닫힘, idle | `close-focus-panel` |
| 4 | event(카드 열림) | 탐험 → 이벤트 | 카드 dismiss, idle | `dismiss-event` |
| 5 | PostCombatCard 열림 | 전투 승리 직후 | 카드 닫힘(앱 유지) | `usePlatformBackHandler` 소비 |
| 6 | PremiumShop / MirrorPanel 열림 | 각 오버레이 | 오버레이 닫힘 | `close-premium` / `close-mirror` |
| 7 | combat(카드 없음) | 탐험 → 전투 | **앱 종료** — 도주 판정이 아니다(오늘 설계, `combat = close-app`) | 종료가 맞다. 도주로 바꾸고 싶으면 별도 결정 |
| 8 | ReturnBriefingCard / TrueEndingScreen | 6h+ 뒤 재진입 / 진엔딩 | 카드가 back을 소비(종료 아님) | 두 컴포넌트 다 `usePlatformBackHandler` 등록 |

첫 back이 **무동작**이면 리스너 등록(동적 `import('@capacitor/app')` + `addListener`)이 아직 안 끝난 것이다 — 1초 뒤 재시도. 부팅 후 계속 무동작이면 1번(플러그인 미등록)을 의심하라: 플러그인이 없으면 AndroidX 기본 동작(종료)이고, 플러그인은 있는데 JS 리스너가 없으면 `AppPlugin.java:49-52`가 `goBack()` 또는 무동작이다.

## iOS (macOS 필요)

```bash
npm run ios:sync
git status --short ios/      # 기대: ios/App/CapApp-SPM/Package.swift 1파일, +2줄(.package(name: "CapacitorApp", …) / .product(name: "CapacitorApp", …))
```
- 그 델타뿐이면 커밋: `chore(W19 K3): iOS SPM — CapacitorApp`. `Package.resolved`는 path 패키지라 불변이어야 한다.
- `project.pbxproj`가 움직이면 **커밋하지 말고** 델타를 보고하라.
- iOS는 하드웨어 back이 없다 — 시뮬레이터에서는 부팅 + 콘솔에 플러그인 에러 없음만 확인.

## 기록 (결과가 무엇이든)

1. `docs/PLAYTEST_CHECKLIST.md` §11 Android에 위 8행 표를 관측 결과 열과 함께 붙인다(P0/P1/P2 분류는 그 문서 규칙).
2. `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md` §24.1 끝에 `**L4 런타임 검증 (Codex, 날짜)**` 단락 — 표 8행 결과 + `capacitor.plugins.json` 확인 결과 + iOS 델타.
3. `tasks/todo.md`의 Wave 20 항목 끝 "Q5 iOS `ios:sync` + Android 실기"를 결과로 바꾼다.

## 하지 말 것

- 표와 다르게 동작해도 `src/**`를 고치지 말 것 — 관측을 기록하고 끝낸다. 수정은 계획서 §24.1의 다음 wave 입력이다.
- `android/app/src/main/assets/**`(생성물)와 `ios/App/App/public`은 gitignore다 — 커밋 대상이 아니다.
- 커밋 메시지에 모델명을 쓰지 말 것.
