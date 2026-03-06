# Store Submission Guide

2026-03-06 기준으로 이 저장소에서 확인된 상태는 아래와 같습니다.

- Android debug build 성공
- Android signed release AAB 경로 검증 성공
- iOS unsigned device build 성공
- iOS archive는 이 머신의 Xcode에 Apple Developer 계정과 provisioning profile이 없어 실패

즉, 코드/빌드 쪽 준비는 대부분 끝났고, 지금 남은 핵심 작업은 스토어 계정과 서명 자격 증명 연결입니다.

스토어 업로드 전에 실제 플레이 회귀는 `docs/PLAYTEST_CHECKLIST.md` 기준으로 한 번 돌리는 것을 권장합니다.

## 1. 배포 전에 준비할 외부 자산

스토어 콘솔에서 막히지 않으려면 아래 항목을 먼저 확보합니다.

- Apple Developer Program 계정
- Google Play Console 계정
- 앱 설명 한글/영문 초안
- 개인정보 처리방침 URL
- 지원 URL 또는 문의 메일
- 앱 아이콘 원본 1024x1024
- iPhone / Android 스크린샷
- 연령 등급 답변용 콘텐츠 분류 기준

현재 앱 식별자는 아래 값으로 정렬돼 있습니다.

- iOS bundle identifier: `com.aetheria.roguelike`
- Android applicationId: `com.aetheria.roguelike`

## 2. iOS 배포 가이드

### 2-1. Xcode 계정 연결

1. Xcode를 엽니다.
2. `Xcode > Settings > Accounts`로 이동합니다.
3. 좌하단 `+` 버튼으로 Apple ID를 추가합니다.
4. Apple Developer Program에 등록된 계정인지 확인합니다.

이 단계가 빠지면 CLI archive에서 `No Accounts` 오류가 납니다.

### 2-2. 프로젝트 서명 확인

1. `npm run ios:open`으로 Xcode 프로젝트를 엽니다.
2. 좌측에서 `App` 프로젝트를 선택합니다.
3. `TARGETS > App > Signing & Capabilities`로 이동합니다.
4. `Automatically manage signing`이 켜져 있는지 확인합니다.
5. `Team`이 본인 계정 팀으로 선택돼 있는지 확인합니다.
6. `Bundle Identifier`가 `com.aetheria.roguelike`인지 확인합니다.

이미 다른 앱이 같은 식별자를 사용 중이면 여기서 새 bundle id로 바꿔야 합니다.

### 2-3. App Store Connect 앱 생성

1. App Store Connect에 로그인합니다.
2. `My Apps > + > New App`을 선택합니다.
3. 플랫폼은 `iOS`를 선택합니다.
4. 이름은 `Aetheria Roguelike`로 맞춥니다.
5. bundle id는 Xcode와 동일한 값을 선택합니다.
6. SKU를 입력합니다. 예: `aetheria-roguelike-ios`

### 2-4. 로컬 검증 순서

터미널 기준으로는 아래 순서가 가장 안전합니다.

```bash
npm run cap:sync
npm run mobile:doctor
npm run ios:build:device
```

이 세 단계가 모두 통과하면 웹 번들 동기화와 unsigned device build는 정상입니다.

### 2-5. archive 생성

Xcode 계정과 프로비저닝이 연결된 뒤 아래 명령을 실행합니다.

```bash
AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive
```

성공하면 기본 출력 경로는 아래입니다.

```text
build/ios/Aetheria.xcarchive
```

자주 나오는 실패 원인:

- `No Accounts`
  Xcode 계정 미로그인 상태입니다.
- `No profiles for 'com.aetheria.roguelike' were found`
  provisioning profile 생성 또는 자동 서명이 아직 안 붙은 상태입니다.
- bundle id 충돌
  다른 Apple Developer 팀에서 이미 같은 식별자를 쓰고 있을 가능성이 있습니다.

### 2-6. TestFlight 업로드

archive가 생기면 Xcode Organizer에서 진행합니다.

1. Xcode 메뉴에서 `Window > Organizer`
2. 최신 archive 선택
3. `Distribute App`
4. `App Store Connect`
5. `Upload`
6. 기본 옵션으로 진행 후 업로드 완료

업로드가 끝나면 App Store Connect에서 다음 항목을 채웁니다.

- App Information
- Privacy Policy URL
- App Privacy
- Age Rating
- Screenshots
- Description / Keywords / Promotional text
- TestFlight 테스터 그룹

### 2-7. iOS 실제 제출 전 체크

- `Version`과 `Build`가 이전 제출본보다 큰지 확인
- 실제 iPhone에서 저장/불러오기 확인
- Firebase 연결 확인
- AI 프록시 사용 시 운영 URL 확인
- 세로/가로 전환, 백그라운드 복귀, 재실행 저장 확인

## 3. Android 배포 가이드

### 3-1. release keystore 준비

최초 한 번만 생성합니다.

```bash
keytool -genkeypair -v \
  -keystore "$HOME/keys/aetheria-release.jks" \
  -alias aetheria \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

서명 입력은 예제 파일을 복사해서 채웁니다.

```bash
cp android/key.properties.example android/key.properties
```

```properties
storeFile=/Users/your-user/keys/aetheria-release.jks
storePassword=change-me
keyAlias=aetheria
keyPassword=change-me
```

### 3-2. release bundle 생성

```bash
npm run cap:sync
npm run mobile:doctor
AETHERIA_VERSION_NAME=1.0.0 \
AETHERIA_VERSION_CODE=1 \
npm run android:release
```

출력 경로:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

### 3-3. Play Console 앱 생성

1. Google Play Console 로그인
2. `Create app`
3. 앱 이름 입력
4. 기본 언어 선택
5. 앱/게임 여부 선택
6. 유료/무료 여부 선택

### 3-4. Internal testing 업로드

초기 제출은 내부 테스트 트랙부터 가는 편이 안전합니다.

1. `Testing > Internal testing`
2. 새 릴리즈 생성
3. `app-release.aab` 업로드
4. 릴리즈 노트 입력
5. 테스터 메일 추가

### 3-5. Android 실제 제출 전 체크

Play Console에서는 아래 항목이 비어 있으면 제출이 막힙니다.

- App content
- Data safety
- Content rating
- Target audience
- 개인정보 처리방침
- 스토어 설명
- 아이콘 / feature graphic / 스크린샷

### 3-6. Android 버전 관리 규칙

- `versionCode`는 업로드할 때마다 반드시 증가
- `versionName`은 사용자 노출 버전
- 현재 스크립트는 환경변수로 값을 받음

예시:

```bash
AETHERIA_VERSION_NAME=1.0.1 \
AETHERIA_VERSION_CODE=2 \
npm run android:release
```

## 4. 실제 다음 순서

현 상태에서 가장 현실적인 다음 순서는 아래입니다.

1. Xcode에 Apple Developer 계정 로그인
2. `com.aetheria.roguelike`에 대한 자동 서명 확인
3. `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive`
4. Xcode Organizer에서 TestFlight 업로드
5. Android 실제 release keystore로 `npm run android:release`
6. Play Console internal testing 업로드

## 5. 빠른 오류 해석

- `No Accounts`
  Xcode Apple 계정이 없음
- `No profiles found`
  iOS 프로비저닝 미설정
- `Android release signing: no`
  `android/key.properties` 또는 env 누락
- `bundle id already in use`
  iOS bundle identifier 충돌
- `versionCode already used`
  Play Console에 이미 같은 코드 업로드됨
