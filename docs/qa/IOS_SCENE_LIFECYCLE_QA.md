# iOS scene 생명주기 런타임 QA

Xcode 27 SDK 앱의 UIScene 시작·복귀·저장 지속성을 검사한다. `SceneDelegate`가 연결마다 창과 `CAPBridgeViewController`를 하나 생성하고, Capacitor의 scene proxy에 연결·URL·userActivity를 전달한다. Main storyboard 자동 생성 설정은 제거해 창을 중복 생성하지 않는다. [Capacitor 8.5 전환 지침](https://capacitorjs.com/docs/updating/8-5)을 기준으로 core/ios/cli와 SPM을 8.5.0에 맞췄다.

## 환경과 빌드

macOS, Xcode 27, 부팅한 iOS 26.5/27 simulator, Node 24가 필요하다. Inspector 도구는 앱 의존성이 아니며 임시 경로에 설치한다.

```sh
npm install --prefix /tmp/aetheria-ios-inspector --save-exact appium-ios-simulator@10.1.0 appium-remote-debugger@17.4.3
VITE_ENABLE_TEST_API=1 VITE_DEVICE_QA_SCENARIO=item-investment npm run ios:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/aetheria-ios27-fixed-simulator \
  PRODUCT_BUNDLE_IDENTIFIER=com.aetheria.roguelike.wave23qa \
  CODE_SIGNING_ALLOWED=NO build
```

`xcrun simctl list devices booted`에서 해당 OS의 UDID를 선택한다. 같은 `App.app`을 두 simulator에 설치한다. 운영 bundle 대신 별도 QA bundle만 사용하며, 스크립트는 기존 item-investment fixture를 재설정한다.

```sh
xcrun simctl install "$QA_UDID" /tmp/aetheria-ios27-fixed-simulator/Build/Products/Debug-iphonesimulator/App.app
AETHERIA_IOS_INSPECTOR_DIR=/tmp/aetheria-ios-inspector \
  node scripts/qa/ios-scene-lifecycle.mjs "$QA_UDID" "$QA_IOS_VERSION" \
  com.aetheria.roguelike.wave23qa output/playwright/ios27-lifecycle/ios-runtime.json
```

## 판정

| 항목 | 실행·통과 기준 |
|---|---|
| 시작 | launch PID의 WebView 1개, `capacitor://localhost`, iOS bridge, 실제 QA 화면 |
| 입력·저장 | 제작 버튼의 실제 DOM handler 실행, 골드 5,000→4,900, 제작 수 +1, 일반 저장에 4,900 기록 |
| Background/foreground | `simctl launch … com.apple.Preferences`로 실제 앱 전환, 10초 후 QA 앱 활성화. document `pause→resume`, App `false→true` 각각 정확히 한 쌍 |
| 복귀 입력·생존 | 복귀 버튼으로 제작 패널 닫힘, 60초 뒤 상태 유지, simulator screenshot |
| 강제 재실행 | 프로세스를 종료하고 launch, 골드·장비·인벤토리·위치 snapshot 일치 |

스크립트는 JS로 lifecycle 이벤트를 만들어 보내거나 `flushLocalSave`를 호출하지 않는다. 화면의 DOM handler 호출은 손가락 터치 정확도·초심자 가독성을 검증하지 않는다. 앱 전환은 Home 버튼 조작과 구분한다. `visibilitychange`는 관측값만 보존하며 **일반 저장 지속성 통과를 background 즉시 flush 증거로 확대하지 않는다**. production save/cloud sync·실기기·서명 검증을 대체하지 않는다.

현재 앱에는 custom URL scheme과 Associated Domains가 없어 실제 OS deep/universal-link routing은 해당 없음이다. SceneDelegate proxy 연결의 코드 검토를 실제 URL 수신 통과로 기록하지 않는다.

## 결함 주입

격리한 native 프로젝트 복사본에서 `SceneDelegate.scene(_:willConnectTo:options:)`의 `UIWindow(windowScene:)`·rootViewController 할당·`makeKeyAndVisible()`을 제거하고 빌드한다. manifest에는 storyboard 자동 생성 경로가 없어야 한다. `com.aetheria.roguelike.scene-faultqa` 별도 bundle로 설치해 동일 스크립트를 실행하면 살아 있는 WebView 부재로 실패해야 한다. 창이 없는 채 PID만 살아 있는 경우도 시작 실패다.

이번 실행은 창 생성 코드 추가 직전의 컴파일된 proxy-only SceneDelegate에 최종 manifest를 적용한 별도 bundle을 mutant로 사용했다. 정상·결함 앱에 같은 bundle을 쓰지 않는다. 초기 실험에서는 정상 재설치 뒤에도 검은 화면이 관측됐고, 이후 fault bundle을 분리했다. scene 설정과 inspector 조회 문제가 함께 있어 초기 현상의 단일 원인은 확정하지 않았다. 운영 앱에는 설치·초기화를 하지 않는다. 테스트 후 production asset으로 `npm run cap:sync`하기 전 `npm run build`를 실행한다.

실행 receipt는 `docs/evidence/qa/ios-scene-lifecycle-20260922/`에서 추적한다. 초기 도구 연결·페이지 로딩 오류는 제품 회귀나 결함 주입 성공으로 세지 않는다.
