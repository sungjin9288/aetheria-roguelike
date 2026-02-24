# iOS 앱 빌드 가이드 (Capacitor)

이 프로젝트는 `React + Vite` 웹앱을 `Capacitor`로 감싸 iOS 앱으로 배포합니다.

## 1) 처음 한 번만 할 작업

```bash
npm i
npm run ios:sync
```

## 2) 배포 전 점검

1. `package.json`의 앱 로직이 production 빌드에서 정상 동작하는지 확인
2. Firebase/AI 프록시 등 필수 환경변수를 production 기준으로 점검
3. 앱 아이콘(1024x1024) 준비
4. 개인정보 처리방침 URL 준비 (App Store Connect 입력용)

## 3) iOS 프로젝트 열기

```bash
npm run ios:open
```

또는 Xcode에서 직접 `ios/App/App.xcworkspace` 열기

## 4) Xcode 필수 설정 (최초 1회)

1. `App` 타깃 선택
2. `Signing & Capabilities`에서 Team 선택
3. Bundle Identifier를 본인 소유 도메인 규칙으로 변경  
   예: `com.yourcompany.aetheria`
4. `General > Identity`에서 Version/Build 값 확인
5. 실제 iPhone 기기 연결 후 `Run` 테스트

## 5) 코드 변경 후 iOS 반영

웹 코드 수정 시 아래 명령으로 다시 동기화합니다.

```bash
npm run ios:sync
```

## 6) TestFlight / App Store 배포

1. Xcode에서 대상 기기를 `Any iOS Device (arm64)`로 선택
2. 메뉴 `Product > Archive`
3. Organizer에서 최신 아카이브 선택 후 `Distribute App`
4. `App Store Connect > Upload` 경로로 업로드
5. App Store Connect에서 빌드 연결 후 아래 항목 입력
   - 앱 설명, 키워드, 카테고리
   - 연령 등급
   - 앱 스크린샷(iPhone 규격)
   - App Privacy 답변
   - 개인정보 처리방침 URL
6. TestFlight 내부 테스터 배포 후 실제 플레이 검증
7. 문제 없으면 App Store 심사 제출

## 7) 배포 반복 루틴

1. 코드 수정
2. `npm run ios:sync`
3. Xcode에서 Build 번호(`Build`) +1
4. `Product > Archive`
5. 업로드

## 참고

- `capacitor.config.json`의 `webDir`는 `dist`
- 네이티브 플랫폼(iOS/Android)에서는 서비스워커를 등록하지 않도록 처리됨
