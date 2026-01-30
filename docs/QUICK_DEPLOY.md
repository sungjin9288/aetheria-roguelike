# ⚡ 친구들에게 3분 만에 무료 배포하기 (Vercel)

Aetheria RPG를 친구들이 인터넷으로 접속해서 할 수 있도록 가장 쉽고 빠른 배포 방법을 안내합니다.

## 준비물
- GitHub 계정 (또는 Vercel 계정)
- 현재 프로젝트 코드

## 방법 1: Vercel CLI로 바로 배포 (추천)

터미널에서 아래 명령어를 순서대로 입력하세요.

1. **Vercel CLI 설치** (없다면)
   ```bash
   npm i -g vercel
   ```

2. **로그인**
   ```bash
   vercel login
   # GitHub 등으로 로그인 선택
   ```

3. **배포 실행**
   ```bash
   vercel
   ```
   - 질문이 나오면 모두 **Enter** (기본값)를 누르세요.
   - `Want to modify these settings?` -> `N`

4. **환경 변수 설정**
   배포 후 Vercel 대시보드(웹사이트) 또는 CLI로 환경변수를 설정해야 AI가 작동합니다.
   ```bash
   vercel env add GEMINI_API_KEY
   # 값을 입력하라고 하면 API KEY 붙여넣기
   # Target을 물으면 'Production', 'Preview', 'Development' 모두 스페이스바로 선택 후 Enter
   ```

5. **재배포 (환경변수 적용)**
   ```bash
   vercel --prod
   ```

   끝! 출력되는 `https://...` 주소를 친구에게 공유하세요.

## 방법 2: GitHub 연동 (자동 배포)

1. 코드를 GitHub 저장소에 Push합니다.
2. [Vercel 대시보드](https://vercel.com/new)에 접속합니다.
3. GitHub 저장소를 선택하고 `Import`를 클릭합니다.
4. **Environment Variables** 섹션에 다음을 추가합니다:
   - `GEMINI_API_KEY`: (Google AI Studio 키)
   - `VITE_USE_AI_PROXY`: `true`
   - `VITE_AI_PROXY_URL`: `/api/ai-proxy`
   - `VITE_FIREBASE_CONFIG`: (Firebase 설정 JSON 전체, 따옴표 주의)
     - *팁: Firebase Config가 복잡하면 로컬 코드에 하드코딩된 상태로 그냥 올려도 테스트엔 문제없습니다.*
5. **Deploy** 버튼 클릭!

## ✅ 확인사항

- 친구들이 접속하면 `에테르니아의 마력이 소진되었습니다`가 뜨나요? -> 할당량(Quota) 문제일 수 있습니다. (기본 50회)
- AI가 응답을 안 하나요? -> `GEMINI_API_KEY` 환경변수가 Vercel에 설정되었는지 확인하세요.
