# Firebase 배포 설정 가이드

GitHub Actions를 통해 Firebase Hosting에 자동 배포하려면 Firebase 프로젝트의 자격 증명(Service Account Key)을 GitHub Secrets에 등록해야 합니다.

## 1. Firebase Service Account Key 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속하여 프로젝트를 선택합니다.
2. 왼쪽 사이드바 상단의 **톱니바퀴 아이콘(설정)**을 클릭하고 **프로젝트 설정(Project settings)**으로 이동합니다.
3. **서비스 계정(Service accounts)** 탭을 클릭합니다.
4. 화면 하단의 **새 비공개 키 생성(Generate new private key)** 버튼을 클릭합니다.
5. **키 생성(Generate key)**을 다시 클릭하여 JSON 파일을 다운로드합니다.
    * ⚠️ **주의**: 이 파일에는 민감한 정보가 포함되어 있으므로 절대 공개된 저장소에 업로드하지 마세요. GitHub Secrets에 등록한 후에는 로컬에서 안전하게 보관하거나 삭제하세요.

## 2. GitHub Secrets 등록

1. GitHub 저장소 페이지로 이동합니다.
2. 상단 메뉴에서 **Settings** 탭을 클릭합니다.
3. 왼쪽 메뉴에서 **Secrets and variables** -> **Actions**를 선택합니다.
4. **New repository secret** 버튼을 클릭하여 아래의 두 가지 Secret을 추가합니다.

### Secret 1: FIREBASE_SERVICE_ACCOUNT_PROD

* **Name**: `FIREBASE_SERVICE_ACCOUNT_PROD`
* **Secret**: 다운로드 받은 JSON 파일(서비스 계정 키)을 텍스트 에디터로 열고, **내용 전체를 복사하여 붙여넣습니다**.

### Secret 2: FIREBASE_PROJECT_ID_PROD

* **Name**: `FIREBASE_PROJECT_ID_PROD`
* **Secret**: Firebase Console의 **프로젝트 설정(General 탭)**에서 **프로젝트 ID(Project ID)**를 확인하여 입력합니다. (예: `aetheria-rpg-12345`)

---

## (선택 사항) 개발 환경 설정

`develop` 브랜치를 위한 개발 환경도 동일한 방식으로 배포하려면, 별도의 Firebase 프로젝트(또는 동일 프로젝트)를 생성하고 다음 Secret을 추가하세요:

* `FIREBASE_SERVICE_ACCOUNT_DEV`
* `FIREBASE_PROJECT_ID_DEV`

설정이 완료되면 GitHub Actions 탭에서 실패했던 워크플로를 다시 실행(Re-run jobs)하거나, 새로운 코드를 푸시하면 배포가 자동으로 시작됩니다.
