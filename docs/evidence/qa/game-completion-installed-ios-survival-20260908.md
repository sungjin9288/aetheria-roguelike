# 기존 iPhone QA 설치본 실행 확인 — 2026-09-08

## 결과와 범위

iPhone14 Pro Max (`FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B`)가 available/paired이며 lockState는 passcodeRequired:false, unlockedSinceBoot:true였다. 설치 목록에는 `com.aetheria.roguelike.freshqa` Aetheria1.1.0/build2가 있었고, `com.aetheria.roguelike` 정확한 bundle 조회는 빈 목록이었다.

기존 QA 설치본을 **설치·재서명·강제 종료 없이** launch했다. Launch receipt는 terminateExistingInstances:false, PID32039를 반환했다. Installed metadata의 App.app 경로와 launch executable의 부모 경로가 일치했고, initial/after-hold process snapshots에서 같은 device·PID·executable을 확인했다.

- launch log: 13:19:23 KST
- initial PID verification: 04:20:03.819 UTC
- after-hold verification: 04:21:54.172 UTC
- 최초 검증 이후110초 이상 같은 PID 유지; 이 실행에서는 즉시 종료 현상을 재현하지 못했다.

Raw receipts are preserved in `/tmp/aetheria-installed-qa-probe.fzCmvX/`: metadata.json, launch.json, process-initial.json, process-after-hold.json and command logs. Sessions70632/29816/87379 all exited0. No cleanup was performed.

## 입증하지 않은 것

버전 문자열1.1.0/build2만으로 최신 소스와의 일치를 확인할 수 없다. 따라서 **v19 설치 완료가 아니며**, 새 native build의 기기 검증으로 대체하지 않는다. Foreground 화면·실제 touch·장기 안정성은 이 process 검증만으로 입증되지 않는다. 과거 종료 원인이 crash였는지 lock이었는지도 소급 확정하지 않는다. 현재 결과는 기존 QA 설치본의 특정 실행에서 즉시 종료가 재현되지 않았다는 제한된 증거다.

기존 archive와 save를 삭제하거나 덮어쓰지 않았고 새 앱을 설치하지 않았다. 현재 실행 중인 QA 앱을 강제 종료하지 않았다. 다음 최신 source-bound 개발 서명 패키지와 실제 화면 검증은 별도 gate로 남는다.
