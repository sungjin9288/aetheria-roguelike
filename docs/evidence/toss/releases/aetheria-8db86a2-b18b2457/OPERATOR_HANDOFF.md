# Aetheria Apps in Toss candidate handoff

이 문서는 `aetheria-8db86a2-b18b2457` candidate의 console 작업용 bounded handoff다.
로그인 정보, credential, 원본 user key, console authentication 화면은 저장하거나 commit하지 않는다.

## Immutable candidate

- Display name: `Aetheria`
- Preferred immutable `appName`: `aetheria`
- Git commit: `8db86a2354730588c0243d33f7a81f3e76dbb60c`
- SDK: `@apps-in-toss/web-framework@3.0.3`
- Artifact: repository root `aetheria.ait`
- Artifact SHA-256: `b18b245710a3f2fad3c1442415b8cdb6f1429060704194cd4c1417d2dae6aa88`
- Artifact bytes: `72,812,250`
- Dist tree SHA-256: `14d5bfe97bbf0e487858d711d1d17b1c3776412e06d2b529fd311605e5fd4161`
- Dist bytes: `74,055,642`

`aetheria`가 이미 사용 중이면 다른 이름을 만들지 말고 중단한다. Candidate bytes를 다시 만들거나
다른 `.ait`를 업로드하지 않는다.

## Console sequence

1. Apps in Toss console에 개인 Toss Business 계정으로 로그인한다.
2. workspace를 선택하고 `aetheria` availability를 확인한다.
3. 사용 가능할 때만 display name `Aetheria`, game category로 mini app을 등록한다.
4. SDK 3.x non-rollback 조건과 CORS/navigation 설정을 확인한다. SDK 3.0.3의 WebView config에는
   이전 `webViewProps.type: 'game'` 필드가 없고 현재 `.ait` metadata의 `isGame`은 `false`이므로,
   console 분류가 반드시 `game`인지 확인하고 양 플랫폼에서 game navigation bar를 관찰하기 전에는
   `game_navigation` gate를 승인하지 않는다.
5. `앱 출시` 메뉴에 위 SHA의 `aetheria.ait`를 업로드한다.
6. console이 발급한 `deploymentId`, `releaseId`, `uploadedAt`과 artifact SHA가 보이는 redacted receipt를
   `external/deployment-receipt.json` 또는 해시 가능한 screenshot으로 보존한다.
7. `deployment.json`을 exact receipt로 채운 뒤 아래 sandbox gate를 실행한다.

```bash
npm run toss:evidence:verify -- \
  --release-dir docs/evidence/toss/releases/aetheria-8db86a2-b18b2457 \
  --phase sandbox
```

## Prepared console assets

Exact dimensions와 SHA는 `prepared-console-assets.json`에 고정돼 있다.

- `assets/logo-600.png` — 600×600
- `assets/thumbnail-1932x828.png` — 1932×828
- `assets/screenshot-01-town.png` — 636×1048
- `assets/screenshot-02-forest.png` — 636×1048
- `assets/screenshot-03-event.png` — 636×1048
- `assets/screenshot-04-combat.png` — 636×1048

Deployment가 생긴 뒤 `prepared-console-assets.json`의 asset rows에 exact `candidateId`와 새
`releaseId`를 결합해 `console-assets.json`으로 승격한다. Portrait는 production runtime에서 직접
캡처했으며 test API/device-QA marker는 0건이다. `console_assets_review`는 별도 사람 검토 receipt로
남긴다.

## Sandbox acceptance

- exact deployment에서 fresh observation 5개 이상
- iOS와 Android 모두 포함
- first screen / first action 각각 10초 이내
- combat와 safe return 완료
- background/foreground, forced restart restore, back event 검증
- service worker 부재
- P0 0건, blocking issue 0건

Sandbox 앱은 console 계정으로 로그인한 뒤 `intoss://aetheria`로 실행한다. Console의 출시 QR은
`intoss-private://aetheria`를 사용한다. 실제 observation 전 candidate/deployment/artifact ID가 모두
일치하는지 확인한다.

## Approval boundaries

App registration/upload는 deployment evidence 생성까지만 수행한다. Review request, public release,
rewarded-ad activation, IAP, production telemetry credential 입력은 각각 별도 gate이며 이 handoff가
승인하지 않는다.
