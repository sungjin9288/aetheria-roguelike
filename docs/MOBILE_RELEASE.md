# Mobile Release Guide

스토어 배포 직전 단계에서 반복 실행할 수 있는 릴리즈 절차를 정리한 문서입니다.

Xcode, TestFlight, Play Console 화면 기준의 상세 순서는 `docs/STORE_SUBMISSION_GUIDE.md`를 참고합니다.

## 0. RC-1 고정 운영

현재 저장소 상태는 기능 개발을 더 늘리는 단계가 아니라 `RC-1` 후보를 고정하고 실기기 QA 결과만 반영하는 단계로 봅니다.

원칙:

- 새 기능 추가 금지
- UI 구조 변경 금지
- 실기기 QA에서 나온 `P0 / P1`만 수정
- 수정 후에는 브라우저 + 네이티브 검증을 다시 실행

### 0-1. RC-1 기준 검증

실기기 투입 전 아래 검증이 모두 통과해야 합니다.

```bash
npm run verify:full
npm run cap:sync
npm run mobile:doctor
npm run android:debug
npm run android:device:smoke
AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES=1 npm run ios:archive
npm run ios:device:smoke
```

`ios:device:smoke`는 archive를 설치한 뒤 실행하고, 기본 120초의 CoreDevice 단계 제한과 60초 foreground hold로 설치·실행 생존을 확인합니다. 잠금은 설치 전 metadata 확인, 설치, 설치 후 확인, 실행 어느 단계에서도 발생할 수 있습니다. `Locked`가 감지되면 iPhone 또는 iPad 잠금을 해제하고 화면을 켠 채 앱을 foreground에 둔 다음 같은 명령을 다시 실행합니다. 스크립트가 잠금과 개발자 프로필 신뢰를 구분하고, 실패한 단계와 필요한 조치를 바로 출력합니다. 더 느린 연결에서만 `AETHERIA_DEVICECTL_TIMEOUT_SECONDS`를 명시해 제한을 늘립니다.

### 0-2. 실기기 QA 실행 순서

1. iPhone에서 `docs/PLAYTEST_CHECKLIST.md`의 5분 루틴 수행
2. Android 실기기 연결 후 같은 체크리스트 수행
3. 이슈를 `P0 / P1 / P2`로 분류
4. `P0 / P1`만 수정
5. 위 기준 검증을 다시 실행
6. signed build를 생성하고 내부 배포(TestFlight / Internal testing) 진행

Android 에뮬레이터는 실기기 투입 전 보조 확인에만 사용합니다. Apple Silicon의 headless AVD에서는 SwiftShader가 blur surface를 중복 합성할 수 있으므로 아래처럼 host GPU로 실행하고, 통과 결과가 Android 실기기 5분 루틴을 대신하지 않도록 구분합니다.

```bash
"$ANDROID_HOME/emulator/emulator" -avd <AVD_NAME> \
  -no-window -no-audio -no-boot-anim -gpu host -no-snapshot-save
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

이슈 분류 기준:

- `P0`: 크래시, 저장 꼬임, 버튼 미동작, 오버레이 겹침, 제출 차단 이슈
- `P1`: 가독성, hit area, 스크롤 튐, 작은 레이아웃 어긋남
- `P2`: 출시 후 처리 가능한 연출/톤 조정

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

### 2-4. 실기기 smoke

USB debugging을 승인한 물리 Android를 연결한 뒤 debug APK의 설치, 실행, foreground 60초 유지를 확인합니다.

```bash
npm run android:debug
npm run android:device:smoke
```

기기가 여러 대면 `AETHERIA_ANDROID_DEVICE_SERIAL`로 하나를 지정합니다. 기본 동작은 물리 기기만 허용하며, 에뮬레이터 보조 검증은 release acceptance와 섞이지 않도록 명시적으로 허용해야 합니다.

```bash
AETHERIA_ANDROID_DEVICE_SERIAL=<SERIAL> npm run android:device:smoke
AETHERIA_ANDROID_ALLOW_EMULATOR=1 AETHERIA_ANDROID_PROCESS_HOLD_SECONDS=10 npm run android:device:smoke
```

기본 APK 외의 서명된 APK를 검증할 때는 `AETHERIA_ANDROID_APK_PATH`를 지정합니다. smoke는 기존 세이브를 보존하도록 `install -r`만 사용하며, 서명 충돌 시 앱 삭제를 자동으로 수행하지 않습니다.

## 3. iOS 릴리즈

### 3-1. 서명 준비

- Xcode에서 `App` 타깃의 Signing & Capabilities를 설정합니다.
- Apple Developer Team ID를 확인합니다. 이미 프로젝트에 설정돼 있으면 `ios:archive`는 그 값을 그대로 사용합니다.
- 다른 Apple Developer Team을 사용한다면 `ios/ExportOptions/AppStore.plist.example`의 Team ID를 바꿔 별도 파일로 준비합니다.

### 3-2. unsigned sanity build

코드 서명 전에도 디바이스 대상 릴리즈 빌드는 확인할 수 있습니다.

```bash
npm run ios:build:device
```

### 3-3. archive / export

외부 업로드 없이 App Store용 IPA를 먼저 export합니다.

```bash
AETHERIA_IOS_EXPORT_OPTIONS_PLIST=ios/ExportOptions/AppStore.plist \
npm run ios:archive
```

`ios/ExportOptions.plist`는 App Store Connect에 바로 업로드하는 설정입니다. 실기기 QA와 업로드 승인이 끝난 뒤에만 아래처럼 명시적으로 허용합니다.

```bash
AETHERIA_IOS_ALLOW_UPLOAD=1 \
AETHERIA_IOS_EXPORT_OPTIONS_PLIST=ios/ExportOptions.plist \
npm run ios:archive
```

선택 환경변수:

- `AETHERIA_IOS_ALLOW_PROVISIONING_UPDATES`
- `AETHERIA_IOS_ALLOW_UPLOAD`
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

## 5. Go / No-Go Gate

아래 항목이 모두 충족되면 출시 진행, 하나라도 빠지면 `No-Go`입니다.

- iPhone 실기기 5분 루틴 통과
- Android 실기기 5분 루틴 통과
- `P0` 이슈 0건
- `P1` 이슈 반영 후 재검증 완료
- iOS signed archive 성공
- Android signed AAB 성공
- TestFlight 업로드 성공
- Play Console internal testing 업로드 성공
- 스토어 메타데이터, 스크린샷, 개인정보 처리방침 URL 입력 완료
