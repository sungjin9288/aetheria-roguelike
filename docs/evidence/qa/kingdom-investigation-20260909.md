# 황금 왕국 도시 조사 — 구현 및 검증

## 최종 local checkpoint — 완료

최종 full71487 exit0: unit4430/4430, E2E117/117(59+58), desktop/mobile smoke, typecheck/lint/build guard PASS. 최초 실패와 기존 lint warnings/browser close timeout 경고는 로그에 보존했다. 관련 art/content/equipment power·economy/event PASS, 독립 Sol/xhigh C0/I0 및 독립 focused20PASS. 아래 실행 중 표시는 중간 이력이다.

Mobile doctor/cap22046, Android15499, iOS19379 모두 exit0. 최신 unsigned iOS는 `/tmp/aetheria-kingdom-ios.JKuvHO/Build/Products/Release-iphoneos/App.app`. APK `android/app/build/outputs/apk/debug/app-debug.apk`는226623018bytes/SHA256 `265c8d62500e5d70014bf0576eca018f940f32d376606743ad1e9e4974ce4e18`. Main `assets/index-BRNKByxC.js` SHA256 `865f377c716a9d492f59ea4fe8f0af2294b627dbe67fc1bebb3a862dc9f2e8c3`.

기존 native verifier328paths와 dark greatsword 별도 hash 비교로 총329paths/package의 source-dist-APK-iOS bytes 일치를 확인했다. Android/iOS tracked drift0, index empty, `git diff --check` PASS. Apple Distribution/Android release signing 미준비는 별도 환경 gate이며 debug/unsigned 검증은 통과했다. 기기 설치·서명·archive 변경·commit·push·publish 없음. Owned QA browser/dev와 full/build 실행은 모두 종료했다.

도시 조사 접근성 slice만 완료이며 기존 보스 원형 재사용7종의 최종 디자인 판정, 실제 device/lifecycle와 전체 S6는 미완료다. 전체 Goal을 완료로 처리하지 않는다.

## 승인과 구현 범위

사용자 `황금 왕국 도시 조사 설계 승인`에 따른 bounded 수정이다. `townInvestigation.ts`의 접근 조건을 town presentation과 content reachability가 공유한다. 황금 왕국이며 safe이고 일반 monster 목록이 있을 때만 조사 행동을 노출한다. UI는 기존 `actions.explore()`를 호출하고 `도시 조사 · 전투 가능`으로 위험을 알린다. 일반 지역의 탐험 라벨은 유지한다.

Map type/출구/몬스터 목록, EXP/drop/event 수치, combat reducer, save schema, 원정 시작/귀환과 휴식 비용은 변경하지 않았다. 새로운 원정 모드나 지역은 추가하지 않았다. Canonical content report hash는 `a662637574c9cdd51d4be1aa02e7c9176beff9ad66c618647ac4344b34b4f0e8`로 기존과 동일하다.

## TDD 및 실패 보존

- `/tmp/aetheria-kingdom-red.log`: 실제 town presentation의 버튼 누락, 시작 마을의 등록-only monster를 reachable로 잘못 세는 두 회귀 테스트 RED. 다른18개 통과.
- `/tmp/aetheria-kingdom-green.log`: 관련20/20 PASS. 조우 없는 안전 지역에는 버튼이 없고 왕국의 회복/시설 접근은 보존한다.
- 최초 typecheck: optional `Player.loc`를 helper의 입력 타입에 반영하지 않아 실패. `string | undefined`로 실제 계약을 반영했다.
- 최초 full64174 exit1: cycle423의 기존 탐험 label 계약과 source-bound diagnostic mismatch 두 건. `/tmp/aetheria-kingdom-full.log` 보존. 도시 문구를 town quick-button에만 적용하고 기존 검증은 유지했다.
- `/tmp/aetheria-kingdom-focused.log`: town/content/cycle400 focused292/292 PASS.
- 정식 diagnostic writer89293 exit0. `/tmp/aetheria-kingdom-diagnostic-preimage.json`과 비교하여 sources 외 모든 필드 deep-equal, 변경 source3개와 신규 `townInvestigation.ts`1개뿐임을 확인했다. Source 삭제0, report/seed/schema/v1 불변.
- 최종 full71487 실행 중: `/tmp/aetheria-kingdom-full-final.log`. 완료 전 PASS로 간주하지 않는다.

## 실제 390×844 UI와 복원

격리 Playwright session `kingdom22`, localhost4432, `deviceQa=item-investment`에서 수행했다. 준비 단계는 Lv58/HP3000의 통제 fixture이며 자연 성장·장비 적합성·난이도/최신 설치본 검증이 아니다. 적이나 탐험 RNG는 주입하지 않았다.

첫 준비 시 live 저장과 경쟁해 제작 화면으로 돌아왔으며 `/tmp/aetheria-kingdom-direct.log`에 timeout을 보존했다. `output/kingdom22-direct.js`는 이후 앱 복원 전 단 한 번 fixture를 넣도록 수정했다. 이후 reload에는 재주입하지 않는다.

실제 `도시 조사 · 전투 가능` 클릭 → `거대 사기꾼 마법사`(baseName 사기꾼 마법사) 전투 → 공격 → 저장 enemyHP 기다림 → reload → 같은 전투 복원 → 도망 → 왕국 idle을 확인했다. 공격 후와 복원 후 playerHP2582/enemyHP2348이 동일했다. 시작·복원·도망 후 activeExpeditionId/lastExpeditionSummaryId는 빈값이며 도시 조사를 원정 귀환으로 오집계하지 않았다. Horizontal overflow false, console Errors0/Warnings0.

- `output/playwright/kingdom22-result-390x844.png`: 실제 조우와 전투 조작, owner 검수.
- `output/playwright/kingdom22-return-390x844.png`: 안정된 opacity의 왕국 idle/휴식·이동·도시 조사·시설, owner 검수.
- 초기 idle 캡처는 fade 중이므로 최종 대비 증거에서 제외했다.
- 재현 script `output/kingdom22-restore.js`, logs `/tmp/aetheria-kingdom-direct-init.log`, `/tmp/aetheria-kingdom-restore.log`, `/tmp/aetheria-kingdom-console.log`.

Production `selectEncounterMonster`에 다섯 구간의 입력을 넣어 왕국 수호자/탐욕의 상인/용병 전사/왕국 기사/사기꾼 마법사 모두 선택됨을 확인했다. 이는 selector coverage이고 다섯 종을 전부 실제 UI에서 관측한 증거는 아니다.

## 남은 gate

관련 art/content/equipment combat-power·economy/event gate는 PASS(related8699 exit0)다. 독립 Sol/xhigh C0/I0, focused20/20 및 실제 UI 증거 대조를 완료했다. 최종 full71487은 unit4430/4430와 양쪽smoke를 통과하고 E2E 진행 중이며 cap/mobile doctor와 새 native 확인은 남아 있다. 새 native build/install은 아직 하지 않았고 최신 완료 native는 v21이다. 기존 원화·dirty paths·historical candidate/Toss evidence를 보존한다. Candidate6/Toss38 hash는 v21과 동일하다. Commit/push/publish/서명/유료 요청 없음. 전체 Goal의 boss-source7/device/lifecycle/S6는 별도 미완료다.
