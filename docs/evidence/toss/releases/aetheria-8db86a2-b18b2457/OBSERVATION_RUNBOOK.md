# Sandbox internal observation runbook

이 runbook은 deployment가 생성된 뒤 exact candidate에 대해 실행한다. 현재 설치 확인 화면은 candidate
observation이 아니며 `observations.jsonl`에 넣지 않는다.

## Required matrix

| Run | Platform | Fresh state | Required path |
| --- | --- | --- | --- |
| 1 | iOS Simulator | `app_data_clear` | boot → create → move → combat → safe return → background/foreground → restore → back |
| 2 | Android Emulator | `app_data_clear` | same path |
| 3 | iOS Simulator | `app_data_clear` | same path |
| 4 | Android Emulator | `app_data_clear` | same path |
| 5 | iOS Simulator | `app_data_clear` | same path |

모든 run은 exact deployment 선택 후 시작한다. 한 run의 attachment는 다른 run과 동일한 SHA를 재사용하지
않는다. Screenshot에는 nickname, console email, user key, device serial, inventory detail, raw log를 넣지
않는다.

## Timing and acceptance

- first screen: 10,000ms 이하
- first accepted action: 10,000ms 이하, `move | explore | mission_open`
- combat reached: true
- safe return reached: true
- save/restore, background/foreground, forced restart restore: 모두 true
- back event: iOS/Android 모두 applicable=true, passed=true
- service worker absent: true
- outcome: `pass`
- P0와 blocking issue: 0

## Opaque IDs

각 run마다 새 ID를 만든다.

```bash
printf 'observationId=obs_%s\n' "$(openssl rand -hex 16)"
printf 'sessionId=obs_%s\n' "$(openssl rand -hex 16)"
```

Alias는 `tester_01`, `observer_01` 같은 safe pseudonym만 사용한다. 실제 이름이나 계정 ID를 쓰지 않는다.

## JSONL row template

아래 placeholder를 실제 deployment/candidate/timing/attachment 값으로 교체하고 한 줄 JSON으로
`observations.jsonl`에 추가한다. `runtime`은 `sandbox`, phase는 `internal`이다.

```json
{
  "observationId": "obs_<32 hex>",
  "sessionId": "obs_<32 hex>",
  "phase": "internal",
  "candidateId": "aetheria-8db86a2-b18b2457",
  "artifactSha256": "b18b245710a3f2fad3c1442415b8cdb6f1429060704194cd4c1417d2dae6aa88",
  "deploymentId": "<console deploymentId>",
  "releaseId": "<console releaseId>",
  "runtime": "sandbox",
  "platform": "ios",
  "osMajor": 26,
  "deviceClass": "phone",
  "testerAlias": "tester_01",
  "observerAlias": "observer_01",
  "freshStateMethod": "app_data_clear",
  "freshStateAttested": true,
  "observed": true,
  "startedAt": "<ISO-8601>",
  "endedAt": "<ISO-8601>",
  "firstScreenMs": 0,
  "firstActionMs": 0,
  "firstActionType": "move",
  "combatReached": true,
  "safeReturnReached": true,
  "saveRestorePassed": true,
  "backgroundForegroundPassed": true,
  "forcedRestartRestorePassed": true,
  "backEventApplicable": true,
  "backEventPassed": true,
  "serviceWorkerAbsent": true,
  "outcome": "pass",
  "issueIds": [],
  "attachments": [
    {
      "ref": "attachments/<safe filename>.png",
      "sha256": "<64 hex>"
    }
  ]
}
```

Android row는 `platform`, `osMajor`, `deviceClass`만 실제 환경에 맞게 바꾼다. Observation이 하나라도
실패하면 값을 true로 고치지 말고 `outcome: fail`과 bounded issue를 기록한다.

## Gate

다섯 run과 attachment가 준비된 뒤 실행한다.

```bash
npm run toss:evidence:verify -- \
  --release-dir docs/evidence/toss/releases/aetheria-8db86a2-b18b2457 \
  --phase sandbox
```

`ok: true`가 아니면 private QR로 넘어가지 않는다.
