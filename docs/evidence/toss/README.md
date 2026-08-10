# Apps in Toss release evidence

이 디렉터리는 live 출시를 주장하는 곳이 아니다. 하나의 immutable candidate, `.ait`,
`dist-toss`, console deployment, 관찰 결과, 외부 승인을 content hash로 묶는 fail-closed
계약이다. `public` gate 통과는 **공개 실행 가능 상태**일 뿐 실제 publication 증거가 아니다.
Upload, review request, public release, ad activation은 각각 별도 수동 승인 후 실행한다.

Raw ProductEvent export, 진단 export, nickname, 원본 user/session key, device serial, inventory,
log, credential, console authentication 자료는 commit하지 않는다. Soft Launch 원본과 생성
report는 Git에서 제외된 `build/toss-soft-launch/` 또는 별도 sealed storage에만 둔다.

## Candidate release directory

실제 candidate는 반드시 다음 고정 경로를 사용한다.

```text
docs/evidence/toss/releases/<candidateId>/
├── candidate.json
├── deployment.json
├── evaluation.json
├── observations.jsonl
├── issues.jsonl
├── console-assets.json
├── external-gates.json
├── bundle-report.json
├── external/*.json
└── assets/*.png
```

- `candidate.json`: exact Git commit/tree, clean-tree attestation, SDK, repository-root
  `aetheria.ait`, canonical `dist-toss`, bundle report의 full SHA-256/bytes.
- `deployment.json`: candidate artifact SHA와 console deployment/release ID를 묶은 scoped receipt.
- `observations.jsonl`: `obs_<32 hex>` session ID가 서로 다른 fresh internal/private QR run.
  모든 attachment는 safe relative path와 실제 SHA로 묶는다.
- `issues.jsonl`: P0/P1/P2와 confusion/boredom/unfair/technical 분류. Blocking issue는 prior
  candidate discovery receipt, current candidate fix time, 그 이후의 bound retest가 필요하다.
- `console-assets.json`: decodable PNG logo 600×600, thumbnail 1932×828, 서로 다른 portrait
  original-play screenshot 3장 이상. `console_assets_review` receipt가 원본 화면/test-marker
  부재를 별도로 승인한다.
- `external-gates.json`: candidate/release-scoped receipt, SHA, verification time, optional expiry,
  approver role을 기록한다. Credentials나 실제 group ID/DSN은 기록하지 않는다.

`candidate.json`의 artifact 경로는 임의 변경할 수 없다. `.ait`는 `AITBUNDL` header와
`sources/*` digest가 `dist-toss`의 모든 file과 일치해야 한다. Bundle report의 file/byte
count, error arrays, 80 MiB working budget도 live bytes에서 다시 검증한다. `.ait` 자체는
100 MiB를 넘을 수 없다. Untracked source/config가 하나라도 있으면 clean candidate가 아니다.

## Ordered release gates

```text
sandbox → private-qr → review → public → ad-activation
```

- `sandbox`: exact deployment의 fresh observation 5개 이상, iOS/Android 모두 포함.
- `private-qr`: internal 완료 이후 시작한 fresh observation 10개 이상, iOS/Android 포함.
- `review`: private QR 완료 후 발급된 review-request approval, console assets, appName, SDK3
  non-rollback, CORS/navigation, business/settlement, GRAC, privacy/support, collector/Sentry gate.
- `public`: review acceptance 이후 별도 public-release approval.
- `ad-activation`: public readiness와 독립적으로 verified ad-group receipt 및 별도 activation
  approval. Public release는 광고를 켜지 않고도 가능하다.

각 observation은 10초 이내 first screen/action, combat와 safe return, save/restart,
background/foreground, applicable back event, service-worker 부재, P0 0/blocking issue 0을
증명해야 한다. Changed candidate/artifact는 이전 count를 재사용할 수 없다.

```bash
npm run toss:evidence:verify -- \
  --release-dir docs/evidence/toss/releases/<candidateId> \
  --phase sandbox

# phase: private-qr | review | public | ad-activation
```

`templates/not-ready/`는 placeholder schema 예시일 뿐 evidence가 아니다. `UNSET`, empty
observations, `unverified` receipts를 유지하므로 아래 명령은 의도적으로 status 1이다.

```bash
npm run toss:evidence:verify -- \
  --release-dir docs/evidence/toss/templates/not-ready \
  --phase sandbox
```

## Soft Launch report

Server export의 각 row는 exact release/deployment, opaque `c_<32 hex>` cohort와
`s_<32 hex>` session, canonical event/outcome, receive time, unique server sequence만 가진다.
Accepted boot 이후의 accepted progression만 funnel에 포함한다. D1/D7은 later accepted boot와
별도 session을 요구하고 각각 `[24h,48h)`, `[168h,192h)`의 matured cohort만 denominator가 된다.

Authority JSON은 candidate/artifact/release/deployment/cutoff, exact input SHA/row count/sequence
range를 소유한다. Crash-free, durable ad transaction, open-P0 receipt 파일은 같은 authority
scope와 digest를 가져야 한다. JS fatal telemetry만으로 crash-free를, client `ad_reward`만으로
durable transaction을 주장할 수 없다. Server transaction authority가 없으면 KPI는
`unavailable`이다.

```bash
npm run toss:soft-launch:report -- \
  --events build/toss-soft-launch/<releaseId>/events.jsonl \
  --authority build/toss-soft-launch/<releaseId>/authority.json \
  --out build/toss-soft-launch/<releaseId>/report.json

npm run toss:soft-launch:verify -- \
  --report build/toss-soft-launch/<releaseId>/report.json \
  --events build/toss-soft-launch/<releaseId>/events.jsonl \
  --authority build/toss-soft-launch/<releaseId>/authority.json
```

Generator는 ignored root 밖, symlink ancestor, 기존 output overwrite를 거부한다. Report는
independent authority와 원본 events로 다시 생성했을 때만 통과한다. 7일 또는 100명은
reviewable 조건이며, 100명 미만 D1/D7은 `directional_only`; immature metric은 `pending`,
authority가 없는 metric은 `unavailable`다.

저장소에는 upload/review/publication command를 두지 않는다. 실제 receipt가 없으면 local
proof일 뿐이고, console·Sandbox·QR·public completion으로 표현하지 않는다.
