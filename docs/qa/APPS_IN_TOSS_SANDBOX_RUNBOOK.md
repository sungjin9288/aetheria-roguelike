# 앱인토스 샌드박스 수용 런북

첫 등록 채널은 앱인토스 소프트 런치다(소유자 결정 2026-10-21). 이 런북은 **새 후보를 만들어 저장소 검증기의 `sandbox` 단계를 통과시키는 순서**다. 그 뒤 단계(private QR → 검수 → 공개)에 필요한 준비물도 함께 적는다.

- **계약은 두 문서가 소유한다.** 증빙 형식과 단계는 [`docs/evidence/toss/README.md`](../evidence/toss/README.md), 1 ~ 6단계 계약은 [`docs/APPS_IN_TOSS_SOFT_LAUNCH.md`](../APPS_IN_TOSS_SOFT_LAUNCH.md)가 정한다. 이 런북은 그것을 지금 실행하는 순서다.
- **예전 후보는 모두 끝났다.** 예전 후보 셋(`aetheria-8db86a2-…` · `aetheria-f45e44b-…` · `aetheria-38a3584-…`)은 대체됐거나 보류다. 그 폴더들은 테스트가 바이트를 고정하므로 고치지 않는다(`tests/remaining-sixtynine-adoption.test.js`). 관찰 순서표는 예전 후보의 `OBSERVATION_RUNBOOK.md`를 이어받았다.
- **실행하지 않는 것:** 업로드 · 검수 요청 · 공개는 이 런북이 하지 않는다. 각각 소유자의 별도 승인이다.

## 0. 출시 전에 정할 것 (소유자)

검증기의 `review` 단계는 외부 게이트 12개가 모두 승인돼야 통과한다(`scripts/tossReleaseEvidence.mjs`의 `REQUIRED_EXTERNAL_GATES`). 기다리는 시간이 긴 것부터 지금 시작한다.

| # | 정할 것 | 지금 상태 | 게이트 |
|---|---|---|---|
| 1 | **표시 이름(한글)** | **결정(2026-10-29): '에테리아 로그라이크'.** 한 줄 소개는 '쓰러지면 처음부터 — 다시 오르는 판타지 로그라이크'([스토어 등록 초안](../store/APPS_IN_TOSS_LISTING_DRAFT.md) §1 · §2). 예전 인계 문서의 'Aetheria'(영어)는 검수 반려 사례가 있어 바꿨다 | `app_name` |
| 2 | **`appName` `aetheria` 사용 가능 여부** | 이미 쓰이고 있으면 멈추고 이름을 다시 정한다. 다른 이름으로 바로 등록하지 않는다 | `app_name` |
| 3 | **게임 카테고리 · 게임 내비게이션** | SDK 3.0.3 `.ait`의 `isGame`이 `false`다. 콘솔 분류가 게임인지 확인하고, 두 플랫폼에서 게임 내비게이션 바를 직접 본다 | `game_navigation` |
| 4 | **SDK 3.x 게시** | **승인(2026-10-29).** 3.x로 게시한 앱은 2.x로 되돌릴 수 없다는 것을 알고 3.x로 게시한다 | `sdk3_nonrollback` |
| 5 | **게임 등급분류** | 게임은 등급 정보가 필수다. 콘솔 '게임 등급분류' 탭에 입력하고(개인은 본인 정보), 게임물관리위원회에 직접 신청하거나 스토어 자체등급분류 결과를 쓴다. 등급 설문에 필요한 사실은 [스토어 등록 초안](../store/APPS_IN_TOSS_LISTING_DRAFT.md) §3에 있다 | `grac_rating` |
| 6 | **사업자 · 정산** | **결정(2026-10-29): 해당 없음.** 인앱 결제 · 정산이 없으면 사업자 없이 출시할 수 있다(공식 안내, 검색 요약). 이번 출시는 결제 · 광고가 없으므로 "해당 없음" 승인 영수증으로 닫는다. 결제 · 광고를 켜는 날 다시 연다 | `business` · `settlement` |
| 7 | **개인정보 처리방침 · 고객 문의** | **결정(2026-10-29):** 공개 주소는 웹 배포(Cloudflare Pages)의 `/privacy/`다. 원본은 [`docs/legal/PRIVACY_POLICY_KO.md`](../legal/PRIVACY_POLICY_KO.md)이고 `node scripts/build-privacy-page.mjs`가 `public/privacy/index.html`을 만든다. 문의는 문의 전용 이메일(소유자가 만든다)과 게임 안 '의견 보내기' 둘이다. 칸은 모두 채웠다(2026-10-29, 시행일 = 공개일). `main` 머지가 곧 공개이고, `tests/privacy-page.test.js`가 공개본에 빈칸이 남으면 붉어진다 | `privacy_policy` · `support_channel` |
| 8 | **반응을 어떻게 볼지** | **결정(2026-10-21): 수집 서버 없이 출시한다.** 반응은 콘솔 통계 · 의견 보내기 · 순위표로 본다. `event_collector`는 "출시 범위에서 쓰지 않음" 승인 영수증으로 닫는다. 부족하면 출시 뒤에 수집 서버를 만든다(1 ~ 6단계 계약의 서버 쪽). **바뀐 결정(2026-10-29): 오류 수집(Sentry)은 출시 전에 붙인다.** 정리된 오류 리포트만 보낸다(`src/platform/sentryErrorReporter.ts` — SDK 없음, 세션 id · 메시지 원문 없음). 후보 빌드 환경에 `VITE_SENTRY_DSN`을 넣는다(`.env.local`, 커밋 금지). Sentry 프로젝트 설정에서 IP 주소 저장을 끈다. `sentry_release` 영수증은 샌드박스에서 일부러 낸 오류가 그 릴리스(배포 id)로 Sentry에 들어온 것을 근거로 남긴다 | `event_collector` · `sentry_release` |
| 9 | **토스 빌드의 Firebase · AI** | **결정(2026-10-21): Firebase를 넣는다.** 클라우드 저장 · 의견 보내기 · 순위표 · 다른 차원의 묘비가 동작한다. 토스 출처(`*.tossmini.com`)가 막혀 있지 않은지 두 곳을 확인한다: Firebase 인증의 승인된 도메인과, 브라우저 API 키의 HTTP 리퍼러 제한(제한을 걸어 두었다면 토스 출처를 더한다). 실제로 막히는지는 샌드박스 관찰이 보여 준다(§3). AI 이벤트(`VITE_USE_AI_PROXY`)는 끄고 출시한다(소유자 결정 2026-10-29 — 처리방침에서 AI 항목을 지웠다). 켜려면 [근거 문서](../legal/PRIVACY_POLICY_EVIDENCE.md) §2-3을 먼저 닫고 처리방침의 AI 항목을 되살린다 | `cors` |
| 10 | **콘솔 자산** | 로고 600×600, 썸네일 1932×828, 실제 플레이 세로 스크린샷 3장 이상. 만드는 법은 [스토어 등록 초안](../store/APPS_IN_TOSS_LISTING_DRAFT.md) §4 | `console_assets_review` |

## 1. 후보 만들기 (소유자 Mac)

검증기는 다음 조건에서만 통과한다(`scripts/verify-toss-release-evidence.mjs`의 `verifyTossReleaseFiles`).

- HEAD가 후보 커밋이고 트리도 같다.
- 추적 파일의 변경이 없다.
- 새 파일은 `aetheria.ait` · `dist-toss` · 후보 폴더에만 있다.

후보를 만든 작업 트리에서 커밋을 하나라도(문서 커밋도) 더하면 후보가 무효가 된다. 그래서 **후보 전용 worktree**를 따로 둔다. 개발은 원래 저장소에서 계속한다.

```sh
git -C <저장소 경로> fetch origin main
git -C <저장소 경로> worktree add --detach ../aetheria-toss-candidate origin/main
cd ../aetheria-toss-candidate
npm ci
npm run toss:build      # build:toss:web + ait build → 루트에 aetheria.ait
```

- **업로드 뒤에는 다시 빌드하지 않는다.** `ait build`는 할 때마다 새 deploymentId를 넣어 다른 `.ait`를 만든다.
- **Firebase 설정을 넣는다(§0-9 결정).** `VITE_FIREBASE_CONFIG`는 셸 환경 변수나 `.env.local`(무시 목록 안)로만 준다. `.env.toss` · `.env.production` 같은 파일은 무시 목록 밖이라 트리를 더럽힌다.
  - 빌드 뒤 `grep -l "<Firebase 프로젝트 ID>" dist-toss/assets/*.js`가 파일 이름을 하나 이상 찍어야 설정이 들어간 것이다. 아무것도 안 나오면 업로드하지 않는다. 설정 없이 만든 빌드에는 프로젝트 ID가 없다(2026-10-21 `5f5a0b72` 빌드로 확인).
- **첨부는 후보 폴더 안에만 둔다.** `build/` 아래도 무시 목록 밖이다.
- **번들 예산의 여유는 3.3MB다.** 2026-10-21 `5f5a0b72` 기준 803개 파일 · 80,565,735바이트로, 80MiB 예산의 96%다. 그림 자산을 더한 뒤에는 `npm run toss:verify`부터 돌린다.

빌드가 끝나면 후보 worktree 루트에서 아래를 그대로 실행한다. 후보 폴더 · 번들 보고서 · `candidate.json`(해시 14칸)을 만든다. 트리가 깨끗하지 않으면 멈춘다.

```sh
test -z "$(git status --porcelain --untracked-files=all)" || { echo "트리가 깨끗하지 않다 — 멈춘다"; exit 1; }
CANDIDATE_ID="aetheria-$(git rev-parse --short=7 HEAD)-$(shasum -a 256 aetheria.ait | cut -c1-8)"
RELEASE_DIR="docs/evidence/toss/releases/$CANDIDATE_ID"
mkdir "$RELEASE_DIR"
node scripts/verify-toss-bundle.mjs > "$RELEASE_DIR/bundle-report.json"
node --input-type=module - "$CANDIDATE_ID" <<'NODE'
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { hashTossReleaseTree } from './scripts/verify-toss-release-evidence.mjs';
const id = process.argv.at(-1);
const dir = `docs/evidence/toss/releases/${id}`;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const ait = await readFile('aetheria.ait');
const dist = await hashTossReleaseTree(process.cwd(), 'dist-toss');
const sdk = JSON.parse(await readFile('node_modules/@apps-in-toss/web-framework/package.json', 'utf8')).version;
const candidate = {
    candidateId: id, gitCommit: git('rev-parse', 'HEAD'), gitTree: git('rev-parse', 'HEAD^{tree}'), cleanTree: true,
    sdkVersion: sdk, aitPath: 'aetheria.ait', aitSha256: sha(ait), aitBytes: ait.length,
    distRoot: 'dist-toss', distTreeSha256: dist.sha256, distBytes: dist.bytes,
    verifierReportPath: `${dir}/bundle-report.json`, verifierReportSha256: sha(await readFile(`${dir}/bundle-report.json`)),
    builtAt: (await stat('aetheria.ait')).mtime.toISOString(),
};
await writeFile(`${dir}/candidate.json`, `${JSON.stringify(candidate, null, 4)}\n`);
console.log(`candidateId=${id}`);
NODE
```

`RELEASE_DIR`은 다음 단계에서도 쓴다. 셸을 새로 열었으면 `RELEASE_DIR=docs/evidence/toss/releases/<candidateId>`를 다시 넣는다.

## 2. 콘솔 등록 · 업로드

1. 앱인토스 콘솔에 개인 토스 비즈니스 계정으로 로그인하고 워크스페이스를 고른다.
2. `aetheria`가 쓸 수 있는 이름인지 확인한다. 쓸 수 있을 때만 §0의 한글 표시 이름과 게임 카테고리로 등록한다.
3. '앱 출시' 메뉴에 **후보 worktree의 그 `aetheria.ait`**를 올린다.
4. 콘솔이 보여 준 deploymentId · releaseId · 업로드 시각으로 아래를 실행한다. `deployment.json`과 그 영수증(`external/console-deployment.json`)을 만든다. ID는 소문자 · 숫자 · `.` `_` `-`만 받는다(검증기 형식). 콘솔 값이 다르게 생겼으면 실행을 멈추고 기록한다.

```sh
DEPLOYMENT_ID="<콘솔 deploymentId>"; RELEASE_ID="<콘솔 releaseId>"; UPLOADED_AT="<콘솔 업로드 시각, ISO-8601>"
node --input-type=module - "$RELEASE_DIR" "$DEPLOYMENT_ID" "$RELEASE_ID" "$UPLOADED_AT" <<'NODE'
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const [dir, deploymentId, releaseId, uploadedAt] = process.argv.slice(-4);
const candidate = JSON.parse(await readFile(`${dir}/candidate.json`, 'utf8'));
const receipt = {
    schemaVersion: 1, kind: 'deployment', candidateId: candidate.candidateId, artifactSha256: candidate.aitSha256,
    deploymentId, releaseId, environment: 'sandbox', uploadedAt,
};
const receiptText = `${JSON.stringify(receipt, null, 4)}\n`;
await mkdir(`${dir}/external`, { recursive: true });
await writeFile(`${dir}/external/console-deployment.json`, receiptText);
const deployment = {
    candidateId: candidate.candidateId, artifactSha256: candidate.aitSha256, appName: 'aetheria', environment: 'sandbox',
    deploymentId, releaseId, uploadedAt, receiptRef: 'external/console-deployment.json',
    receiptSha256: createHash('sha256').update(receiptText).digest('hex'),
};
await writeFile(`${dir}/deployment.json`, `${JSON.stringify(deployment, null, 4)}\n`);
console.log('deployment.json · external/console-deployment.json 작성');
NODE
```

## 3. 샌드박스 관찰 5회

Android 실기기가 없어도 된다. 공식 샌드박스 앱에는 iOS 시뮬레이터용과 Android 에뮬레이터용이 있고, 2026-08에 둘 다 설치한 기록이 있다(예전 후보 폴더의 `sandbox-device-readiness.json`). 새 판이 나왔는지는 콘솔에서 확인한다.

| 회차 | 플랫폼 | 처음 상태 | 경로 |
|---|---|---|---|
| 1 | iOS 시뮬레이터 | `app_data_clear` | 시작 → 캐릭터 만들기 → 첫 행동 → 전투 → 안전지대 귀환 → 백그라운드 · 포그라운드 → 강제 종료 뒤 다시 열어 복원 → 뒤로가기 |
| 2 | Android 에뮬레이터 | `app_data_clear` | 같다 |
| 3 | iOS 시뮬레이터 | `app_data_clear` | 같다 |
| 4 | Android 에뮬레이터 | `app_data_clear` | 같다 |
| 5 | iOS 시뮬레이터 | `app_data_clear` | 같다 |

- **실행:** 샌드박스 앱에 콘솔 계정으로 로그인한 뒤 `intoss://aetheria`를 연다.
- **시간 재기:** 기준은 `intoss://aetheria`를 연 순간이다. 화면 녹화로 첫 화면이 그려진 시각(`firstScreenMs`)과 첫 행동을 한 시각(`firstActionMs`)을 잰다. 각각 10,000 이하여야 한다.
- **첫 행동:** 임무 게시판 열기(`mission_open`) · 이동(`move`) · 탐험(`explore`) 가운데 실제로 한 것이다. 게임의 `first_action` 사건과 같은 정의다.
- **함께 볼 것:**
  - **클라우드 연결(§0-9):** 기록 › 설정 › '저장과 기기 점검'의 '동기화'가 '저장됨'이고, '명예의 전당'이 불러와진다.
    - '연결 안 됨'이면 토스 출처가 막힌 것이다. `issues.jsonl`에 기술 이슈로 남긴다(`cors` 게이트를 닫을 수 없다).
    - '의견 보내기'는 운영 데이터에 실제로 쌓이므로 한 번만 보내고 Firebase 콘솔에서 확인한다.
  - 토스 상단 바 · 홈 인디케이터가 상태 표시줄 · 하단 단추를 가리지 않는다.
  - 뒤로가기는 열린 화면부터 닫는다.
  - 글자가 빠진 곳 · 영어 낱말이 없다.
  - 기준은 [iPhone 런북](IPHONE_ACCEPTANCE_RUNBOOK.md)의 15 · 16 · 19번과 같다. 게임에는 소리가 없어 배경음악 복귀 반려 사례는 해당되지 않는다.

**기록.** 회차마다 아래로 빈 줄을 만든다. 빈 줄은 일부러 실패값(`false` · `fail` · 빈 시각)으로 시작하므로, 채우지 않은 칸이 있으면 검증기가 막는다. 실제 값을 채워 `observations.jsonl`에 한 줄로 붙인다.

```sh
PLATFORM=ios   # ios | android
node --input-type=module - "$RELEASE_DIR" "$PLATFORM" <<'NODE'
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const [dir, platform] = process.argv.slice(-2);
const candidate = JSON.parse(await readFile(`${dir}/candidate.json`, 'utf8'));
const deployment = JSON.parse(await readFile(`${dir}/deployment.json`, 'utf8'));
const obs = () => `obs_${randomBytes(16).toString('hex')}`;
console.log(JSON.stringify({
    observationId: obs(), sessionId: obs(), phase: 'internal', candidateId: candidate.candidateId,
    artifactSha256: candidate.aitSha256, deploymentId: deployment.deploymentId, releaseId: deployment.releaseId,
    runtime: 'sandbox', platform, osMajor: 0, deviceClass: 'phone', testerAlias: 'tester_01', observerAlias: 'observer_01',
    freshStateMethod: 'app_data_clear', freshStateAttested: false, observed: false, startedAt: '', endedAt: '',
    firstScreenMs: 0, firstActionMs: 0, firstActionType: 'mission_open', combatReached: false, safeReturnReached: false,
    saveRestorePassed: false, backgroundForegroundPassed: false, forcedRestartRestorePassed: false,
    backEventApplicable: true, backEventPassed: false, serviceWorkerAbsent: false, outcome: 'fail', issueIds: [], attachments: [],
}));
NODE
```

- **첨부:** 녹화 · 스크린숏을 `$RELEASE_DIR/attachments/`에 공백 없는 이름으로 둔다. `{ "ref": "attachments/<이름>", "sha256": "<shasum -a 256 값>" }`를 회차마다 하나 이상 붙인다. 같은 파일(같은 SHA)을 두 회차에 쓰지 않는다.
- **가릴 것:** 스크린숏에 콘솔 이메일 · 기기 일련번호 · 원본 기록을 넣지 않는다. 별칭은 `tester_01`처럼 실명이 아닌 이름만 쓴다.
- **실패:** 값을 `true`로 고치지 않는다. `outcome: "fail"`로 두고 `issues.jsonl`에 기록한다. P0 · 차단 이슈는 새 후보로만 닫힌다. 이슈 문장은 280자 이하이고 줄바꿈 · `/` · `\` · `@` · 주소를 쓰지 않는다.

## 4. 검증

```sh
node -e 'console.log(JSON.stringify({ evaluatedAt: new Date().toISOString() }))' > "$RELEASE_DIR/evaluation.json"
npm run -s toss:evidence:verify -- --release-dir "$RELEASE_DIR" --phase sandbox
```

`"ok": true`가 아니면 private QR로 넘어가지 않는다.

**이 런북의 명령은 2026-10-21에 리허설했다.** 깨끗한 worktree(`5f5a0b72`)에서 `npm run toss:build` → §1 · §2 · §3 명령을 그대로 실행했다. 업로드 값과 관찰 5회(iOS 3 · Android 2)는 리허설 값이었다.

- 검증기 결과: `sandbox` 통과(`ok: true`, 막힘 0).
- 빈 줄을 하나 더하면 막혔다: `observation_device_invalid` · `observation_time_invalid` · `observation_attachments_invalid`.
- 두 번째 리허설에서 [콘솔 자산](../store/APPS_IN_TOSS_LISTING_DRAFT.md)(§4 명령)까지 후보 폴더에 넣었다.
  - 검증기의 파일 검사(`verifyTossReleaseFiles`)가 통과했다. PNG 디코딩 · 크기 · SHA와 깨끗한 트리 규칙이 맞았다.
  - `review` 단계의 남은 막힘은 private QR 관찰, 외부 게이트 12개, 검수 요청 승인이었다. 자산 쪽 막힘은 사람 검토 영수증(`console_assets_review`) 하나였다.
- 리허설 폴더는 지웠다. 실제 증빙이 아니다.

## 5. 증빙 보관

- **후보 worktree는 공개가 끝날 때까지 지우지 않는다.** 다음 단계도 같은 후보 커밋에서 검증한다.
- **증빙을 저장소에 남길 때는 원래 저장소에서 브랜치를 만든다.** 후보 폴더를 복사해 커밋한다(`.ait` · `dist-toss`는 무시 목록이라 들어가지 않는다).
- **커밋한 브랜치에서는 검증이 통과하지 않는다.** HEAD가 후보 커밋이 아니기 때문이다. 다시 검증할 때는 후보 worktree에서 한다.

## 6. 다음 단계

- **private QR:** 내부 관찰이 끝난 뒤에 시작한 관찰 10회 이상이 필요하고, iOS · Android가 모두 들어가야 한다. 콘솔 출시 QR(`intoss-private://aetheria`)로 실제 토스 앱에서 연다. Android는 테스터의 실제 기기로 채운다. 기록 줄의 `phase`는 `private_qr`, `runtime`은 그대로 `sandbox`다.
- **검수:** 콘솔 자산(§0-10)과 외부 게이트 12개(§0)가 승인돼야 한다. private QR이 끝난 뒤 발급한 검수 요청 승인도 필요하다. 앱인토스 검수는 영업일 2 ~ 3일이 걸린다(검색 요약).
- **공개:** 검수 통과 뒤 별도의 공개 승인을 받는다. 광고는 출시 범위 밖이다(원장 §72.4).
