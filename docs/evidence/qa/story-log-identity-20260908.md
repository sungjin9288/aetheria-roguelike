# 동시 이야기 로그 식별자 교정

상태: focused/독립 감사/별도 브라우저 재현/전체 검증 및 local native packaging 통과. 실기기 설치는 수행하지 않았다.

최종 native: Android38884와 iOS17923 모두 exit0. 기존 verifier328개와 추가 암흑의 대검1개를 합쳐 **329 paths/package**의 source/dist/APK/iOS bytes 일치를 확인했다. Main `assets/index-Dev0-ixF.js` SHA `8e9bb131f683a4ff07e3f026ec6e0a4ad2cdb4fed8b53be682bb1f999e6774b7`; APK225984933bytes SHA `b4efb4063822d04ae8af5942a3d08a3c132c1e665d9f0c3152c2e2f7c9e313ba`. iOS unsigned app: `/tmp/aetheria-story-ios.V8SWG9/Build/Products/Release-iphoneos/App.app`. Logs `/tmp/aetheria-story-android.log`, `/tmp/aetheria-story-ios.log`. Native tracked drift0/index empty/HEAD38a3584 보존. Repository-relative POSIX path를 문자열 순으로 정렬하고 path+NUL+raw bytes를 누적한 historical hashes는 candidate6 `ac1956ad67087ddeae0cd1af85e57eee7a6bf94d3afb81b00a823f2ceb5ea0dd`, Toss38 `0f870e56774c46dcbd477ceda6e9c6c1f312a4a7dec3f84ad10b3342934d5b5c`로 이전과 같다. 아래 packaging 실행 중 문구는 역사다.

## 최종 full 결과와 packaging — 2026-09-08

`verify:full` session24360 exit0: unit4419, E2E117(59+58), desktop/mobile smoke, type/lint/build PASS. Cap sync와 mobile doctor session93053 exit0. Android release signing 미설정은 환경 한계이며 debug/unsigned 범위와 구분한다. Android debug38884 및 iOS unsigned17923을 시작했으며 iOS output은 `/tmp/aetheria-story-ios.V8SWG9`로 기존 산출물을 보존한다. 아래 full 실행 중 표시는 과거 기록이다. 설치·signing·commit은 수행하지 않았다.

## 자연 플레이에서 발견한 결함

`s5-fresh-v19`의 네 번째 자연 원정에서 거미떼를 처치하며 최초 Lv2에 도달했다. 실제 화면에 승리 이야기가 두 번 나타났고 React가 ID `1788853005362` 중복 오류를 보고했다. 오류 원본은 `.playwright-cli/console-2026-09-08T05-11-22-199Z.log`의12–17행, owner가 확인한 화면은 `output/playwright/s5-fresh-first-levelup-390x844.png`다. Seed/EXP 주입은 없었다.

`useGameEngine.addStoryLog`가 placeholder ID를 `Date.now()`로 만들고, victory/levelUp 이야기를 같은 effect에서 병렬 호출한다. 같은 밀리초면 ID가 같아 `UPDATE_LOG`의 ID match가 두 placeholder를 함께 덮어쓰며 `TerminalView` React key도 충돌한다.

## 최소 수정과 증명

- `allocateStoryLogId`는 timestamp와 hook 수명 동안 유지하는 순번으로 story namespace ID를 만든다. RNG를 소비하지 않으며 비동기 호출 전에 ID를 할당한다.
- `tests/story-log-identity.test.js`: 같은 시간의 두 placeholder와 역순 응답, 정지/역행 시계, RNG 미사용, 실제 hook 연결을 검증했다. 신규3 RED→GREEN; combat receipt 관련 통합 포함11/11 PASS.
- 독립 Sol/xhigh C0/I0, 독립 테스트3/3 PASS. Game balance·save schema·reducer UPDATE_LOG 의미는 그대로다.
- `output/story-identity-direct.ts`는 **별도 임시 browser context**에서 Lv1 EXP199/high attack fixture와 고정 시각으로 victory+levelUp 경로를 재현했다. 자연 플레이로 주장하지 않는다. 최종 로그 `/tmp/aetheria-story-identity-direct-final.log`: story 각각1개, console/page errors0, overflowfalse, Lv2. `output/playwright/story-identity-fixed-390x844.png`를 owner가 열어 두 문장이 다르게 보존됨을 확인했다.
- 첫 browser run은 요약 화면에 숨겨진 로그를 직접 찾으려다 timeout했다(`/tmp/aetheria-story-identity-direct.log`). 전체 로그를 펼치고 실제 `data-log-type=story` 행으로 검사 범위를 고쳐 통과했다. 이 timeout을 앱 결함으로 세지 않는다.

개발 서버에 hook을 추가한 뒤 열려 있던 natural profile은 HMR hook-order 오류가 발생했다(같은 console18행 이후). 수정 전부터 있던 numeric key 오류와 구분한다. 저장된 Lv2 EXP13/HP89/MP17/gold560/슬라임 임무2/3을 읽은 다음 reload하여 boot ready와 실제 같은 HUD를 확인했다. `s5-fresh-levelup-restored-390x844.png`는 owner 검수 완료이며, 새 clean context에서는 hook-order 오류가 없다. 기존 저장과 원정은 보존됐다.

## Gate 진행 상태

재검증 중간 확인: unit4419 PASS, desktop/mobile smoke PASS 후 E2E 진행 중이다. Desktop browser-close timeout은 기존 비차단 경고로 별도 남긴다. Art/content/equipment combat-power/economy 검증도 완료했다(`/tmp/aetheria-story-{art,content,power,economy}.log`). 전체 full terminal PASS나 새 native 완료를 의미하지 않는다. `git diff --check` PASS, index와 tracked Android/iOS 변경 없음.

첫 `verify:full` session39296 exit1: source-bound progression evidence mismatch1건. 정식 writer95457 exit0. 이전 evidence는 `/tmp/aetheria-story-evidence.IPoN31/progression-before.json`에 보존했다. Deep comparison으로 `src/hooks/useGameEngine.ts`의 source pin 하나만 변경됐고 report/v1 baseline 및 나머지 모든 필드가 동일함을 확인했다.

현재 재검증 **session24360**, `/tmp/aetheria-story-identity-full-final.log`. 동일 handle의 terminal 결과를 확인한 뒤 필요한 art/content/equipment, cap/doctor, Android debug/iOS unsigned 및 package-byte 검증을 진행한다. 최신 완료 native는 아직 dark-greatsword checkpoint로 이번 수정 미포함이다. Commit/install/sign/publish 없음. 전체 Goal은 미완료다.
