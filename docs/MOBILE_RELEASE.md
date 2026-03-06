# Mobile Release Guide

스토어 배포 직전 단계에서 반복 실행할 수 있는 릴리즈 절차를 정리한 문서입니다.

## 1. 공통 사전 점검

```bash
npm install
npm run cap:sync
npm run mobile:doctor
```

`mobile:doctor`는 다음을 확인합니다.

- iOS bundle identifier / version / build number
- Xcode 설치 여부
- Android SDK 경로 및 Android 36 플랫폼 유무
- Java 설치 여부
- Android release signing 입력 존재 여부

## 2. Android 릴리즈

### 2-1. keystore 생성

```bash
keytool -genkeypair -v \
  -keystore "$HOME/keys/aetheria-release.jks" \
  -alias aetheria \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### 2-2. 서명 정보 설정

예제 파일을 복사해 실제 값으로 채웁니다.

```bash
cp android/key.properties.example android/key.properties
```

```properties
storeFile=/Users/your-user/keys/aetheria-release.jks
storePassword=change-me
keyAlias=aetheria
keyPassword=change-me
```

대안으로 아래 환경변수만 써도 됩니다.

- `AETHERIA_ANDROID_KEYSTORE_PATH`
- `AETHERIA_ANDROID_KEYSTORE_PASSWORD`
- `AETHERIA_ANDROID_KEY_ALIAS`
- `AETHERIA_ANDROID_KEY_PASSWORD`

### 2-3. 버전 지정 후 빌드

```bash
AETHERIA_VERSION_NAME=1.0.0 \
AETHERIA_VERSION_CODE=1 \
npm run android:release
```

릴리즈 AAB 출력:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

APK가 필요하면:

```bash
npm run android:release:apk
```

## 3. iOS 릴리즈

### 3-1. 서명 준비

- Xcode에서 `App` 타깃의 Signing & Capabilities를 설정합니다.
- Apple Developer Team ID를 확인합니다. 이미 프로젝트에 설정돼 있으면 `ios:archive`는 그 값을 그대로 사용합니다.
- 필요하면 `ios/ExportOptions/AppStore.plist.example`를 복사해 실제 값을 채웁니다.

### 3-2. unsigned sanity build

코드 서명 전에도 디바이스 대상 릴리즈 빌드는 확인할 수 있습니다.

```bash
npm run ios:build:device
```

### 3-3. archive / export

```bash
AETHERIA_IOS_EXPORT_OPTIONS_PLIST=ios/ExportOptions/AppStore.plist \
npm run ios:archive
```

선택 환경변수:

- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES`
- `AETHERIA_IOS_TEAM_ID`
- `AETHERIA_IOS_ARCHIVE_PATH`
- `AETHERIA_IOS_EXPORT_PATH`
- `AETHERIA_IOS_CONFIGURATION`
- `AETHERIA_IOS_CODE_SIGN_IDENTITY`
- `AETHERIA_IOS_PROVISIONING_PROFILE_SPECIFIER`

프로비저닝 프로파일을 Xcode가 자동으로 갱신해야 하는 환경이면 아래처럼 실행합니다.

```bash
AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive
```

단, 이 옵션은 Xcode에 Apple Developer 계정이 로그인되어 있어야 동작합니다. 계정이 없으면 `No Accounts` 오류로 중단됩니다.

출력 경로:

```text
build/ios/Aetheria.xcarchive
build/ios/export
```

## 4. 제출 체크리스트

- Android `versionCode` 증가
- iOS `CURRENT_PROJECT_VERSION` 증가
- 스토어 설명/스크린샷/개인정보 문구 최신화
- Firebase/AI 프록시 등 운영 환경 변수 재확인
- 실제 기기에서 세이브/전투/이벤트/앱 재실행 저장 흐름 점검
