# Aetheria 게임 완성 설계와 실행 계획

작성: 2026-09-05 · 실행 상태: **blocked: 기기 테스트 시간 확인 대기 — local 구현·full/native 완료, 실제 device/lifecycle 미완료** · 기준 HEAD: `38a3584`

최신 완료: perf full55522exit0/unit4508/E2E118/양쪽smoke, readonly69154PASS, 독립 source/test/docs C0/I0. Cap8193/Android19521/unsigned iOS9641exit0/doctorPASS, `output/perf-fix-native-20260910.json`884 선택경로 byte동일/native tracked0. 실제 iPhone 확인은 남았다. 아래 perf 진행중 문단은 종료 전 이력이며 최신 산출물/한계는 `docs/evidence/qa/game-completion-final-audit-20260910.md` 최상단을 따른다.

현재 source는 V27 이후 perf 검증 수정까지 포함한다. 필수 누락 지표 false PASS를 RED→GREEN3으로 고정하고 main.tsx 시작 mark/실제 paint 대기를 보완했다. Desktop/mobile 각10필수지표 PASS, 독립 source/test C0/I0. Diagnostic writer82928 exit0/report·v1불변/main.tsx1pin 갱신 후 readonly69154/full55522 실행 중. 이 후속 source의 native는 아직 재빌드하지 않았으며 아래 V27 full/native는 직전 완료 checkpoint다. 상세 `docs/evidence/qa/game-completion-final-audit-20260910.md`.

## 현재 실행 상태 — 2026-09-10 V27

승인된 잔여69종은 일곱 그룹의 owner/Sol 정적 검수를 통과한 뒤 exact69 runtime에 적용했다. 현재234 authored/20 retained, 총254종이며 이 수량 자체를 품질 증명으로 사용하지 않는다. 다른185 entry/PNG와 기존165 registry, 게임 수치/prototype/역사 증빙을 보존했다. Source·후보·적용 검증은 `scripts/art_sources/monsters/v27/adoption-review.md`, actual39089 결과는 같은 폴더 `ui-receipt.json`에 있다.

- 구현: adoption RED2→GREEN3, 역사 checkpoint 보존 연결 후 focused29 PASS, 독립 Sol/xhigh C0/I0.
- 시각: 승인69 정적 검수 C0/I0; 실제390×844에서69+유지20 모두 표시/공격HP감소/overflowfalse/errors0. Owner는89 portrait와 첫/마지막 전체화면을 확인했고 Sol/xhigh UI 독립감사 C0/I0. 자연 성장 전부/실기기 주장은 하지 않는다.
- 증빙: sole diagnostic writer59500 종료 후 readonly57977 PASS. Report/v1Baseline 불변,330 sources 중 monster manifest 해시1개만 변경. Historical candidate6/Toss38 보존.
- 전체검증: `verify:full`15775 exit0. Unit4505/4505, E2E118/118, desktop/mobile smoke 및 type/lint/build PASS. Art/content/mobile doctor/equipment power/economy/event/pacing PASS.
- 최신 완료 native는 V27 unsigned/uninstalled App.app 및 debug APK다. 이미지841+JS43=884 선택 경로 package byte동일/native tracked0. 현재 iPhone 설치/화면/lifecycle은 미검증이며 서명·설치·공개는 자동 승인되지 않는다.

최신 완료(위 진행중 bullet을 대체): full15775 exit0, unit4505/E2E118/desktop·mobile smoke/type/lint/build PASS. Sol/xhigh 구현 및89 UI C0/I0. Cap sync 완료 로그 확인, Android4246/unsigned iOS68038 exit0. `output/v27-native-20260910.json`의841images+43JS=884 byte동일/native tracked0. 최신 iOS `/tmp/aetheria-v27-ios.0NPI5i/Build/Products/Release-iphoneos/App.app`, 설치하지 않았다. 기타 gate와 APK hash는 V27 adoption-review 최상단 참조.

다음 순서: 전체 요구별 최종 감사 → 실제 device/lifecycle의 미완료 조건과 필요한 사용자 행동 명시. 전체 Goal은 유지하며 검증되지 않은 완성을 주장하지 않는다.

## 이전 checkpoint 요약 — 아래 상태는 2026-09-09 당시 이력

잔여89의 현재 source-pinned 정적 triage 완료: 유지후보20/교정제안69. 이름별69 설계와7군 실행은 `2026-09-09-aetheria-remaining-monster-art-closure.md`, exact JSON은 `docs/evidence/art/retained89-disposition-20260909.json`을 따른다. 새 원화 제작·교체 승인 전이며20도 최종수용 아님. 전체 goal 및 실제device/lifecycle/S6는 유지한다. 이 단계에서 runtime/source/native 변경이나 full 반복은 없다.

최신 retained26 exact10 local checkpoint 완료: focused29/full4481unit·118E2E/양쪽smoke/type/lint/build, actual390 열 종 공격·초상화·overflow/console, art/content/doctor, diagnostic readonly/report·v1불변, Sol visual/implementation C0/I0. Cap39885/Android82804/iOS5086 exit0,884선택경로 source/dist/APK/iOS 동일. 최신 unsigned/uninstalled iOS `/tmp/aetheria-retained26-ios.Wox2Yq/Build/Products/Release-iphoneos/App.app`, APK SHA `74dc41491d849c1d43354a4376e7db48fc580ebebcfb7862ce301e5572018450`. 상세 v26/candidate-review.md 및 output/retained26-native-20260909.json. 기존 원본·거부본·other244·prototype·수치·저장·historical evidence 보존. 아래 진행중/blocked/이전 native 표기는 당시 이력이다.

Retained10 설계 승인으로 기존 Goal을 재개했다. v26 원화11회/선택10/거부1 보존, 추적자 dark32 교정 후 Sol visual C0/I0. Exact10만 채택하고 other244/prototype/수치 보존 focused29 PASS. 실제390×844 전투10종 owner 검수·공격 후 HP감소·overflowfalse/errors0. Diagnostic writer 종료→readonly PASS, report/v1Baseline 동일, source330 중 manifest1pin만 변경. 첫 full4479/4481의 과거 checkpoint 참조2곳을 보존 preimage로 연결한 뒤 full94987 재실행 중. 최신 완료 native는 아직 elemental25, retained26 native 및 최종 감사 미완료. 아래 blocked 설명은 승인 전 이력이다.

2026-09-09 승인 elemental6 local 구현·검증 완료. v25 원본/거부3/preimage 보존, exact6 채택/other248불변, focused26/Sol C0I0/full4475unit·118E2E/실제390/native884경로 PASS. 상세 `scripts/art_sources/monsters/v25/candidate-review.md`. 후속 retained99 검수는 제안10/미수용89로 구분했다. Exact10 설계 승인 미수신이 세 자동 continuation에 걸쳐 유지되어 Goal은 blocked로 전환하며 전체 objective는 유지한다. 승인 후 같은 Goal을 재개한다. 나머지89 수용·기기/lifecycle/S6는 미완료이며 기존 변경과 산출물을 보존한다.

승인 전 이력: elemental6 승인 대기에서 Goal blocked로 반복을 중단했고, 당시 최신 완료는 library local이었다. 현재는 승인6종을 구현·검증했으며 아래 오래된 승인 대기/blocked/native 경로는 당시 이력이다. Normal-loot/library 완료 증거도 그대로 유지한다.

| 요구 영역 | 현재 증거와 판정 | 남은 조건 |
| --- | --- | --- |
| 세트·장비·전투·탐험·이야기·성장 | S1/S1b/S2/S2b 및 후속 story/topology/normal-loot/library의 구현·회귀 증거 존재 | 전체 자연 성장/모든 조합 실플레이로 확대하지 않음; 최종 source 전반 감사 필요 |
| 캐릭터·지역·장비 디자인 | 개별 교정과 사용 크기/직접 화면 증거는 S3와 기존 art evidence에 기록 | 개수·해시만으로 시각 완성 판정 금지 |
| 몬스터254 |165 authored/89 retained; retained26 승인10 교정 완료 | 나머지89의 수용/교정 판단. 전체254 시각완료 아님 |
| full·직접 UI | retained26 full94987 exit0: unit4481/E2E118/양쪽smoke/type/lint/build. 직접390 새10종 portrait·공격·overflow/console PASS | 새 production 변경 뒤에는 해당 범위 재검증; library 획득/장착/복원 증거는 이전 checkpoint에 보존 |
| native package | cap39885/Android82804/iOS5086 exit0;841images+43JS=884선택경로 byte일치 | 미설치 unsigned iOS이며 실제foreground/lifecycle 증거 아님 |
| 저장·실기기 | S5의 offline/reset/capacity 증거와 기존 설치본 survival 관찰은 각각 제한된 범위에서 유효 | 실제 visible→hidden→visible·저장 보존, 최신 설치본 식별·화면 관찰 미완료 |
| 최종 handoff | 개별 독립 Sol C0I0, library 증빙 I1 해소 | 잔여 디자인·기기 gate와 모든 명시 요구 충족 전 S6/전체Goal 완료 불가 |

다음 순서:

2026-09-09 retained99 추가 triage: 최신99 source-pinned4시트 직접검수 후 contextual4+암흑시전자3+화염도마뱀3의 exact10 설계를 제안했다. `2026-09-09-aetheria-retained-ten-identity.md` 승인 후 구현하며,99=교정제안10+최종수용미완료89로 다음 판정 범위를 갱신한다. 아래4+95는 이전 우선순위 이력이다. Source/runtime/native 미변경.

1. `2026-09-09-aetheria-elemental-six-identity.md` 승인 exact6 교정 완료. 관련 원본·실패/교정 이력과 검증 증거를 유지한다.
2. 나머지 retained99의 정적 재검수에서 전류 추적자/변이 실험체/에테르 잔류체·흡수체4종을 추가 contextual 후보로 기록했다(`docs/evidence/art/retained-identity-followup-20260909.md`). 나머지95는 자동승인하지 않으며 기존 검수 결과와 현재 source를 대조해 개별 수용을 판단한다. 여섯 개 교정으로 전체시각완료를 대신하지 않는다.
3. 모든 기능·디자인 구현 이후 사용자와 조율된 실기기 검증. 이전 Playwright hidden 미관측3회를 반복하거나 synthetic 이벤트로 대체하지 않는다.
4. 최신 source에 대한 S6 requirement-by-requirement 감사와 최종 증빙 정합성 확인. Commit/설치/서명/공개를 이 Goal continuation으로 자동 승인하지 않는다.

최신 unsigned/uninstalled iOS `/tmp/aetheria-elemental25-ios.jZdTdp/Build/Products/Release-iphoneos/App.app`; APK SHA `2c32c4a36cce7cdadce132687f016f280496e06a3c1a12e0c69579d153d3c430`. 과거 candidate/Toss·save·원본·dirty tree 보존. 승인6 구현과 local/native 검증 완료이며 기기 설치·서명·공개 증거가 아니다.

## 실행 이력 — 아래 상태·경로는 당시 기록

현재 Goal blocked: 보상/이미지의 구체적 변경 승인이 설계 제시와 후속 continuation들에서 해결되지 않았다. Read-only 감사 진척은 보존하고 같은 분석·빌드를 반복하지 않는다. 재개는 normal-loot-tier 계약 또는 별도 elemental-six 계약 승인부터이며 전체목표는 축소/완료하지 않는다. 이번 상태 재검증은 no progress, 실행 중 검증 없음. 아래 active는 과거 상태다.

일반 bonus tier의 구체적 제안은 `2026-09-09-aetheria-normal-loot-tier-contract.md`다. Actual enemy level/ordinary pool, 기존 eligibility·확률과 제외경로 보존, 판매가·signature 획득 변화 및 legacy eligibility 잔존을 명시했다. Production mirror-test 한계와 Tier5 signature23/45 집계가 설계 근거다. Balance 승인 전 미활성; 도서관-only override는 보류하고 이미지6은 별도 승인 범위다.

다음 우선순위 수정: 도서관-only reward 제안은 보류한다. Production spawn EXP10×level과 bonus inferred level의 /5 불일치가 Lv45 여러 reachable no-table 지역에도 미래 Tier6 장비를 주는 경로로 재현됐다. `docs/evidence/qa/loot-level-authority-audit-20260909.md`의 강제roll 표본·범위한계를 기준으로 normal reward level/tier 계약부터 재설계한다. Global divisor/chance를 임의 수정하지 않는다. Native Goal active, 전체목표 유지; 이미지6 승인대기/기기 gate 별도.

최신 완료 regional24 local: 승인6종 구현·원본/other248보존·실제390·SolC0I0·focused24 PASS. Full56316 exit0(unit4452/E2E118/양쪽smoke/type/lint/build), art/content/doctor·cap92413·Android73419·iOS26746 PASS,329선택경로/package 동일/native tracked0. 최신 unsigned 미설치 iOS `/tmp/aetheria-regional24-ios.gldQLh/Build/Products/Release-iphoneos/App.app`. 세부 `v24/candidate-review.md`. 다음은 도서관 보상 계약·retained105 품질판단·기기/S6이며 전체Goal은 완료하지 않는다. 아래 실행 중 상태는 이력이다.

2026-09-09 regional6 승인 후 exact6 이미지 교정 구현:149 authored/105 retained, other248·게임 수치·save 불변. Focused24/24, Sol/xhigh C0/I0,390 전투6종, art/content PASS. Full56316 unit4452/4452 통과 후 browser gate 진행 중; 최종 native는 이후 실행한다. 증빙은 `scripts/art_sources/monsters/v24/candidate-review.md`. Native Goal 상태는 blocked로 남아 있지만 사용자 승인된 구현을 직접 진행하며 전체목표/도서관 보상/retained105 판단/기기·S6는 유지한다. 아래 승인대기는 이전 이력이다.

2026-09-09 현재 Goal blocked: retained6 구체적 디자인 승인 조건이 세 연속 턴에 유지되어 자동 반복을 중단한다. 마지막 완료 checkpoint는 topology local이며 전체목표는 축소/완료하지 않는다. `2026-09-09-aetheria-regional-six-design.md` 승인 후 구현을 재개하고 도서관 보상·기기/S6를 계속 보존한다. 아래 active 상태는 이전 이력이다.

2026-09-09 다음 디자인 계약: `2026-09-09-aetheria-regional-six-design.md`의 retained6 교정 설계 승인 후 원화·보존 export·exact6 adoption·실제390/전체gate로 진행한다. 도서관 보상은 별도 계약으로 유지한다. 실제 processLoot 메모리 probe에서 legacy 재료추가는 기존 보너스 경로를 유지하고 enriched는 대체함을 확인했으나, 확률·장비경험을 아직 수용하지 않았다. 증빙은 game-quality-followup-20260909.md. 디자인 작성은 이미지 구현완료가 아니며 전체Goal은 active다.

Topology local checkpoint 완료: shared access/directed highest map 구현, full71089 unit4447/E2E118/양쪽smoke/type/lint/build PASS. Test-only 감사보완 후 최종unit87593 4448/4448 및 focused27/독립Sol C0I0/실제390 이동·복원·귀환 PASS. Evidence write71887/readonly70054, content/doctor, cap62607/Android5917/iOS64914 PASS;329선택경로/package byte일치/native tracked0. 최신 unsigned iOS `/tmp/aetheria-topology-ios.63XliI/Build/Products/Release-iphoneos/App.app` 미설치. 초기 동시writer 검증실패와 최종해소는 game-quality-followup-20260909.md에 보존. Goal active; 다음 도서관 localized 보상/retained 이미지6/기기/S6는 미완료이고 아래blocked는 역사다.

현재 native Goal은 blocked(설계 승인 대기). 동일 조건이 세 연속 Goal 턴에 유지되어 반복 실행을 멈췄다. 직전 retained111 감사 진척은 보존하며, 재개는 production 이동 eligibility 공유·시작마을 directed topology 기반 진단기 수정 승인 후 TDD부터다. 기존 게임 수치/v1/저장 보존; 도서관 보상 적합성·이미지6·실기기 조건은 완료되지 않았다. 아래 active 기록은 당시 상태이며 원래 전체목표는 축소/삭제하지 않는다.

S3 continuation: 현재 retained111 SHA와 기존4 review sheets 일치 확인. 자연3(뿌리 포식자·세계수 수호자·꽃잎 슬라임), 화산/바람3(화산재 골렘·뇌운 와이번·바람 드레이크)이 다음 시각적 우선순위다. Source/지역/그림 근거는 quality-followup evidence에 있다. 신규교정 미승인/미적용, 다른105 blanket완료 아님. 도서관 설명만 낮춰 지역보상 경험의 완료를 대체하지 않는다. 전체objective 및 S3/S5/S6 미완료 유지.

최신 quality23 local 완료: full61321(unit4444/E2E118/양쪽smoke/type/lint/build), art/content/diagnostic verification, cap95591·Android23105·unsigned iOS44173와329 inspected package paths PASS. 최신 source/설치본은 구분하며 미설치다. 다음은 level-only diagnostic map선택과 도서관 전리품 설명 정합성의 Important2건, retained-art 잔여판정 및 실제device/lifecycle. 상세 `game-quality-followup-20260909.md`; 아래 full 진행 중 기록은 이 결과 이전 상태다. 전체Goal/S6는 미완료.

2026-09-09 품질 보완 승인: 이전 bounded 구현 완료 이후 story/retained114/balance 보완을 다시 열었다. `docs/evidence/qa/game-quality-followup-20260909.md`의 구체적 발견과 순서를 따른다. 신규3 이미지 exact adoption/실제390검수, quest87 explicit claim/continue/계승 guard와 narrative location 수정 및 독립C0I0 완료. 현재 quality23 full61321 검증 중이며 balance 후속 판단과 실기기 검증은 남아 있다. 기존 C0I0/전체검증 기록은 당시 scope의 증거로 보존하며 새 발견을 덮지 않는다. 실제 장기 재미나 전체 자연 퀘스트 완료로 확대하지 않는다.

최신 native 갱신(09-09): iOS99757 exit0 및 Android/iOS329검사경로 source/dist byte일치. V22 `native-verification.md`가 최신 local package 증빙이다. 초기 Xcode 대기 원인은 미확정이나 직접 clang 성공·동일빌드1회재실행 PASS; 설치본은 아직 갱신하지 않았다. 다음은 최신 iPhone 설치 및 실제 lifecycle 테스트이며 아래 중단상태는 역사다.

2026-09-09 최신: v22 승인 보스7 구현/독립감사 C0I0 및 최종 full58171 PASS(4434unit/117E2E/양쪽smoke). 현재 scoped source audit에서 남은 Critical/Important 구현 지적 없음. cap/Android PASS; iOS compiler-info write 대기10분 이상으로 소유 xcodebuild에 TERM을 보냈고 최신 unsigned/package 검증은 미완료. 다음은 Xcode 빌드 문제 해소와 최신 패키지 확인 후 사용자 지시대로 실기기 테스트다. 전체 Goal은 active이며 구현 완료와 device 완료를 구분한다. 아래 이전 진행 표시는 역사다.

V22 현재 exact7 교정 연결/other247보존, 최종후보 C0I0·관련12PASS·실제390portrait7장 검수 완료. Diagnostic sourcepin1개 외 전체불변, artPASS. Full18106 진행 중이며 같은 handle을 poll한다. 사후독립감사/관련·native gate는 미완료, 최신완료 native는 Kingdom이다. 실기기 테스트는 사용자 지시에 따라 모든 구현 이후 진행한다. 상세 v22/candidate-review.md/tasks 최신절; 아래 source-only 상태는 역사다.

2026-09-09 사용자 승인으로 보스7 교정을 같은 Goal에서 재개했다. v22 개별 원화7개와 framing 교정2개를 보존했으며 export TDD/작은 크기 검수부터 이어간다. `scripts/art_sources/monsters/v22/candidate-review.md`가 현재 준비 상태다. 실기기 테스트는 사용자 지시에 따라 전체 기능·디자인 구현 이후 진행한다. 아래 blocked/기기 시간 요청은 이전 기록이며 현재 runtime은 아직 Kingdom 그대로다.

2026-09-09 현재 Goal **blocked**: 보스7 설계 승인 또는 사용자와 조율된 기기 테스트 시간이 필요하다. 세 연속 턴 동안 조건이 유지됐으며 로컬 검증·증빙 정리는 완료했다. 전체 범위는 유지하고 승인 이후 같은 Goal을 재개한다. 아래 active 기록은 이전 상태다.

2026-09-09 device 상태 갱신: 실제 iPhone 미러링 연결은 확인됐지만 사용자 조작과 겹쳐 관찰을 중단했다. 기존 인증 대기 대신 테스트 시간 조율 후 설치본 식별·lifecycle 관찰이 다음 행동이다. 상세 lifecycle evidence와 tasks 최신절을 따른다. 보스7 설계 승인 및 S6는 미완료이고 최신 Kingdom unsigned 빌드는 미설치다.

2026-09-09 Kingdom local checkpoint 완료: full71487 exit0(4430unit/117E2E/양쪽smoke), 관련gate/독립Sol C0I0/실제390조사·전투·복원·탈출, cap/Android/iOSunsigned 및329paths/package 일치. 최신 iOS `/tmp/aetheria-kingdom-ios.JKuvHO/Build/Products/Release-iphoneos/App.app` 미설치. 상세 kingdom-investigation-20260909.md/tasks 최신절. Kingdom 접근성은 해소됐고 나머지boss-source7 디자인/device/lifecycle/S6는 유지한다. 전체Goal active이며 아래 full진행/Kingdom설계대기는 이전 상태다.

2026-09-09 황금 왕국 도시 조사 승인 구현: 공유 접근 조건/UI/도달성 보완, TDD·292focused·실제390 클릭/공격/전투복원/탈출·독립C0/I0 PASS. 최종 full71487 unit4430·양쪽smoke PASS/E2E 진행 중. 관련 gates와 diagnostic source-only 갱신 완료. tasks/todo.md 및 `docs/evidence/qa/kingdom-investigation-20260909.md`를 재개 권위로 삼고 같은 full handle을 확인한다. Full 완료 후 cap/mobile/native 검증; 새 설치/서명/commit 없음. 아래 Kingdom 설계대기는 승인 전 기록이며 전체Goal active다.

Next8 local 완료: exact8/other246보존·실제390·독립C0/I0·full4427unit/117E2E/양쪽smoke·related gates·cap/doctor·Android/iOSunsigned·329paths/package 일치. 최신 iOS `/tmp/aetheria-boss21-ios.KdxC2u/Build/Products/Release-iphoneos/App.app`(미설치). 승인된 일반body 파생17종 교정은 닫았고, 다음은 별도boss-source7 수용/교정 설계 및 Kingdom 접근성 설계, 실제device/lifecycle, S6다. FullGoal 미완료/active이며 증빙은 v21/candidate-review.md. 아래 pending상태는 역사.

Next8 현재: 후보 독립C0/I0 뒤 exact8 연결/other246보존, related16PASS, 실제390 portrait8장 PASS. Diagnostic sourcepin1개만 갱신. Full83518 진행 중이며 종료 뒤 native329paths 및 사후감사로 닫는다. V20 historical/current successor 보존 테스트 경계 교정은 v21증빙에 기록했다. WholeGoal active, 후속7/Kingdom/device/S6 유지.

Next8 설계 사용자 승인 후 기존 Goal active로 재개. v21 원화8개와 old8/preimage 보존, source TDD2RED→관련4GREEN, 작은크기 sheet3장 owner검수. 독립 후보 감사 후 adoption2RED를 GREEN으로 만들고 비대상246 보존→실제390→source-only evidence/full/native 순으로 닫는다. 아래 blocked는 과거이며 새 승인 필요 없음(이8종 내 교정). 별도7/Kingdom/device/S6 범위는 유지한다.

현재 Goal 상태 **blocked**(next8 조형 승인 대기 세 연속 턴). Objective 축소·완료·삭제 없이 보존한다. 승인 후 동일 Goal에서 next8 원화/검증을 재개하며 Kingdom/device/lifecycle/S6 미완료를 유지한다. 아래 active 기록은 이전 시점이다.

Next8 source 감사 완료: MONSTERS profile/phase·MAPS 문맥·manifest8개와 PNG SHA 일치 확인. Bounded 조형 방향은 대화에서 승인받고 이후 기존 first9 처리/검증 경로를 재사용한다. 하수도 humanoid·거인 construct·봄 seasonOnly 보존, 승인 전 이미지 생성/교체 없음. First9를 포함한 비대상246종 보존 검증이 다음 adoption의 기준이다. 이번 docs-only 턴은 기존 full/native 결과를 새 실행으로 주장하지 않는다.

First9 local checkpoint 완료: full4423 unit/117 E2E/양쪽smoke, related gates, cap/doctor, Android debug/iOS unsigned 및329paths/package 비교 PASS. 사후 독립C0/I0. 최신 unsigned iOS `/tmp/aetheria-boss20-ios.ANk5DZ/Build/Products/Release-iphoneos/App.app`; 기존 설치본 불변. 승인9종만 교정했고 source-only diagnostic pin 외 gameplay 수치 불변. 다음8종은 production 문맥별 조형 설계·승인 후 구현한다. 별도boss-source7/Kingdom/device/lifecycle/S6 미완료, 전체Goal active. 아래 중간 상태는 역사이며 first9 상세증빙은 v20/candidate-review.md에 있다.

현재 first9: 수정 후보 독립C0/I0 후 exact9 adoption, 관련21/21, other245 원본bytes 보존, 실제390 portrait9장 owner검수 완료. Diagnostic sourcepin1개 외 전체내용 불변. Full72064 실행 중; 종료 후 cap/native 패키지 검증 및 독립 사후 감사로 이번 slice를 닫는다. 후속8종 설계와 Kingdom/device/lifecycle/S6는 별도 미완료, 전체Goal active. 아래 미반영/승인대기는 역사다.

사용자가 first9 보스 교정 설계를 승인하여 구현을 재개했다. v20에 선택 원화9종/이전PNG9/manifest·registry·진단 preimage와 rejected 후보를 보존했고 처리기 TDD RED2→관련4/4GREEN, owner160/46/32검수·focusedlint·diff PASS. 현재254runtime SHA 불변이며 독립 Sol/xhigh 후보 검토 후에만 exact9 연결한다. Source 후보 준비를 S3완료로 세지 않는다. 최신 실제 Goal 상태는 active로 확인했다; 아래 승인 대기는 과거다.

Boss-source7 후속 분류 완료: 일반-body17종과 같은 literal 위반으로 세지 않는다. 실제46/32px에서 5종의 body/eye 반복과 마왕·dragon의 원형 재사용 한계는 남아 고유 디자인 최종 승인으로 처리하지 않았다. Current46 SHA 재검증과 sheets2/3/4 owner검수는 retained-monster evidence에 기록했다. First9 설계 승인 전 생성/교체를 하지 않으며 추가7종 조형은 별도 계약 없이 임의 확대하지 않는다.

Story identity local checkpoint 확정: full/cap/doctor/Android debug/iOS unsigned 모두 exit0, unit4419/E2E117/양쪽smoke, package329paths 일치. 최신 iOS `/tmp/aetheria-story-ios.V8SWG9/Build/Products/Release-iphoneos/App.app`; 설치하지 않았다. Protected historical hash와 native tracked paths 불변. 이후 순서는 아래 Astra 계획 및 승인 경계대로 유지한다. 전체Goal은 미완료다.

최신 실행 기준: Astra가 계획·구조를 담당하며 필요할 때 Sol, Terra(high/xhigh만), Luna(max만)를 사용한다. 기존 Goal/범위는 유지한다. Story fix full24360 exit0(unit4419/E2E117/양쪽smoke), cap/doctor PASS; Android38884/iOS17923 local packaging 후 bytes를 검증한다. Map12·character8 current-byte 사후 독립 감사 C0/I0. 이후 boss9 설계 승인에 따른 S3 교정 → 남은 device/lifecycle 증명 → S6 종합 감사 순서이며 미승인 디자인·설치·출시를 진행하지 않는다. 아래 full/독립 감사 진행 중 표시는 과거다.

Fresh 원정/임무 관찰 추가 완료: 최초 자연 레벨업의 정상 귀환과 다음 원정의 슬라임3/3→마을 보상40EXP/100gold→reload 완료 기록 보존을 실제UI로 확인했다. 현재 townLv2EXP69/229HP199/209MP49/69gold619. 아래 임무 미완료/원정 진행 중 표시는 과거 상태다. 전체full24360 두 번째 E2E 실행 중이며 native gate는 종료 후 진행한다. Map12/character8 교정의 current-byte 독립 사후 감사도 실행 중이다. Boss9 설계 승인과 실제device/lifecycle 경계는 그대로다.

최신 우선 gate: 자연 첫 Lv2 도달 과정에서 story timestamp collision을 발견하여 순번 기반 ID로 교정했다. Focused11/독립C0I0/고정시각 실제390 검증 PASS. Progression source pin1개만 갱신했고 full24360 진행 중; terminal PASS 후 관련/native 검증을 닫는다. `story-log-identity-20260908.md` 참조. Natural 현재 숲 Lv2EXP13HP89/209MP17gold560/임무2/3이며 reload 확인; 아래 첫 레벨업 미관측 기록은 과거다. Boss9 설계의 망령 정체성2행 보완은 독립 재검토 통과했지만 사용자 승인 대기다.

재감사 확정: 보스 일반-body 파생17종 Important1, 기존boss-body 파생7종은 별도 수용 판정 미완료. 첫 유령기사 계열9종의 조형·보존·검증 설계를 `2026-09-08-aetheria-boss-body-correction.md`에 작성했으며 승인 전 생성/교체하지 않는다. Fresh는 자연 유물 선택과 슬라임 처치로 임무1/3, 현재 숲 Lv1EXP126/200HP150/187MP57/57gold425(네 번째 원정 진행 중). 아래 EXP114/마을 상태는 이전 기록이다.

우선 판정: retained46의 static 검수는 완료됐지만 파생 보스24종은 아래 S3의 체격·자세·주요 형태 구분 요구와 다시 대조한다. Semantic C0/I0를 디자인 완료로 사용하지 않는다. Exact family partition과 재감사 경계는 `retained-monster-small-size-review-20260908.md`에 기록했다. 확인된 요구 불충족은 기존 원본/게임 수치를 보존하는 교정 대상으로 삼고, 단순 contextual 일반 몬스터까지 자동 확대하지 않는다.

현재 추가 증거: retained monster exact46의 manifest SHA/160×160 RGBA를 확인하고 160/46/32px dark/light sheet4장을 original detail로 owner 검수했다. 반복 body의 contextual 수용 여부는 독립 감사 중이며 S3 완료로 확대하지 않는다. Fresh에서는 추천 슬라임 임무 수락→reload→진행0/3 보존까지 확인했다. 기존 장비 선택과 대표 midlate 직접 검증도 완료됐으므로 아래의 해당 미관측 표시는 과거 상태다. 남은 자연 관찰은 첫 레벨업/수락 임무 진행이며 실제 lifecycle/device와 S6 최종 감사는 미완료다. 상세 `retained-monster-small-size-review-20260908.md`, `game-completion-fresh-v19-20260908.md` 참조. Production 변경 없음, 최신 native는 아래 dark checkpoint 그대로다.

최종 대검 local checkpoint 완료: full26974 unit4416/E2E117, cap87969/Android83772/iOS9221 PASS, 패키지329paths 일치, 독립C0I0. 최신 iOS unsigned `/tmp/aetheria-dark-ios.JVheQz/Build/Products/Release-iphoneos/App.app`; 설치하지 않음. Signature25 원본22장 보충 검수 완료(`equipment-signature-source-review-20260908.md`). 다음은 S3 요구사항별 실제 coverage 정리 → 남은 S5 자연 성장/중후반/기기 → S6 최종 감사이며 wholeGoal은 active다. 아래 full/native 진행 중 상태는 이 최종 결과로 대체한다.

추가 확인: 최종 대검 adoption Sol/xhigh C0/I0. Full26974는 unit4416/양쪽 smoke/첫 E2E59 PASS 후 두 번째 묶음 진행 중. Fresh는 동일 save에서 Scout 자연 선택과 정상 귀환(전투2/탐험2, 최저HP59)을 확인했고 reload 후 이전 debriefHP127도 실제 화면으로 확인했다. 현재 Lv1 EXP114/200으로 첫 레벨업/새 장비 판단은 아직 미관측이다. Native는 전체 full terminal 결과 후 진행한다.

최신: 대검 canonical 1종 반영과228 runtime 보존 완료, source/기본 pipeline111PASS, actual390×844 장착/저장/reload 확인. Processor 독립 Sol C0/I0. Diagnostic은 manifest source pin만 갱신하고 report/v1 불변 확인. Full26974(`/tmp/aetheria-dark-full-final.log`) 완료 확인 → 관련 gates/native packaging → 최종 adoption 감사가 다음 순서다. 세부 범위/실패 교정 기록은 `docs/evidence/art/dark-greatsword-adoption-20260908.md`. 아래 미반영 상태는 이전 checkpoint 이력이다.

현재: 일반 processor의 명시적 replacement safety contract 구현 완료, 기본 거부/old output drift/identity/source collision/history 보존 테스트 통과. 최종 focused suite와 독립 감사 후 원본 보존 방식으로 대검 1종을 반영한다. Candidate visual은 Sol/xhigh 승인, runtime/장비 slot/full/native는 아직 미완료다. Astra가 계획과 구조를 담당하며 필요 시 Sol, Terra high/xhigh, Luna max로 한정해 역할을 배치한다. 기존 Goal과 승인 경계를 유지한다.

암흑대검후보 actualItemIcon32/46/96 미리보기완료(route1개candidate표시, runtime미적용), source3개drift거부 포함focused3PASS. 다음 일반processor가finalizedbatch교체를거부하는현재계약과signature --replace-existing를비교해 안전한최소확장을TDD로진행한다. 기존generationReview/다른5cell·23runtime을보존하며hash검증우회금지. 독립후보/architecture감사진행중. 상세dark-greatsword README.

Staff24의 원본4/actualItemIcon72/390×8446화면 검수 완료. 일반무기101 supplemental검수는 수행했지만 **암흑의 대검 Important1 교정이 남았다**. 다음 기존 source와 나머지5cell·다른23검runtime을 보존하는 형상교정→provenance/evidence TDD→actual32/46/96 및 장비화면→필요full/native 순서. 수치/hands/job/save는 바꾸지 않는다. Staff검수증거는 equipment-staff-review 문서다. 전체Goal은 계속미완료다.

활/창/낫/채찍23 원본·ItemIcon69 검수 완료. 다음 **staff24 검수 → 암흑의 대검 Important1 교정**으로 진행한다. 암흑대검은 독립Sol/xhigh에서 대검 body mass가 없는 needle silhouette로확정; 기존 source/다른cell/다른runtime/hands/numeric 보존이 교정조건이다. 이1종을 해결하기 전 모든장비시각완료로판정하지않는다. 원거리23 상세는 equipment-ranged-review, 교정계약은 equipment-sword-review 문서에 있다.

검24 원본/실제크기 검수 수행. **암흑의 대검1종은 가는 날과 작은 화면 가독성 문제 후보로 승인 보류**하고 독립Sol/xhigh에severity/최소교정 검토를 요청했다. `equipment-sword-review-20260908.md` 참조. 따라서 다음 미검수는 원거리마법47이지만, 검24를 전부 시각승인으로 세지 않는다. 필요교정은 기존원본·numeric/hands/save를 보존한다.

단검19 원본4장·실제57크기/390×844 5화면 검수 완료, `equipment-dagger-review-20260908.md`에 범위/한계 기록. 다음 supplemental source/runtime 검수는 **검24 → 원거리·마법47**로 좁혀졌다. 기존 '근접43'은 단검 검수 전 상태다. Production/native 미변경이므로 full gate를 반복하지 않는다.

장비 gap 정리: 독립 Sol/xhigh는 cohort union229와 현재 이름집합을 대조해 supplemental source/runtime 미검수를 근접54·원거리마법47로 분리했다. 이어 main이 근접 heavy11의 원본2장/ItemIcon33/390×844 3장을 확인했다(`equipment-heavy-review-20260908.md`). 따라서 다음은 **근접 나머지43 → 원거리·마법47**이다. 기존 armor82/offhand21/signature25의 증거 범위를 유지하며, 자연 장착/device 검수와 혼동하지 않는다. `output/equipment-catalog.json`은 오래된 분류가 있으므로 현재 batch/provenance/manifest를 권위로 사용한다.

장비 시각검수 추가: offhand-headgear의 일반book5+shield13+headgear3=21종에 대해 원본과 실제ItemIcon32/46/96 검수를 완료했다. 관련 book/offhand-headgear review 문서에 정확한 범위·작은 세부/표현 한계를 남겼다. 다른cohort/실제장착/device까지 완료로 확대하지 않는다. Production미변경이므로 완료된 vitals full/native는 재실행하지 않는다.

최저 HP 교정 local checkpoint 완료: full89080 exit0(4409unit/117E2E/bothsmoke), 독립 C0/I0, cap/doctor9051·Android30755·iOS31060 exit0,328 package경로 일치/protected 불변. `docs/evidence/qa/game-completion-vitals-native-20260908.md`가 최신 native 권위다. 설치/전체Goal완료아님. 일반 book5종 원본+실제15크기 검수도 `equipment-book-review-20260908.md`에 추가했다. 다음 S3 남은 장비 cohort와 S5/S6를 진행하며 아래 native진행중 메모는 과거다.

최저 HP 교정 진척: 두 non-victory reducer 경로에 기존 tracker 연결, RED 2건→focused36 PASS, 독립 Sol/xhigh C0/I0·28 PASS. 같은 fresh save의 두 번째 자연 전투에서 HP127→회복→HP160 귀환 후 실제390×844 debrief 및 저장에 최저127/71% 보존 확인. `game-completion-fresh-v19-20260908.md` 참조. Source-bound evidence 두 개는 report 불변/source pin만 갱신했다. Full89080은 unit4409 PASS 후 E2E 진행 중이며, 종료 확인 후 production/cap/doctor→native debug/unsigned→package 비교를 진행한다. 아래 RED부터 시작 메모는 과거 상태다. S3/S5/S6와 황금왕국 승인 경계는 유지한다.

새 우선순위: freshv19 실제플레이에서 HP138→회복→귀환했으나lowestHp160으로기록됨. `game-completion-fresh-v19-20260908.md`에소스와저장증거. 전투continue/item결과의vitals추적누락에대한 RED→최소수정→focused/full/evidence 검증을먼저진행한다. 숫자밸런스조정은없다. 현재v19native는이수정전검증본이며전체완료가아니다.

v19 local gate 완료: full8060(unit4407/E2E117/bothsmoke), production/cap/doctor81343·Android2795·iOS63692 exit0. 두패키지328경로 byte일치/native drift0/protected6·38불변. 최신패키지는 `scripts/art_sources/monsters/v19/native-checkpoint.json`; 설치/전체Goal완료아님. 잔여S3시각감사·S5자연성장/복원경로와 황금왕국승인게이트를 유지한다.

S5 장비 직접 검증 일부 완료: `docs/evidence/qa/game-completion-equipment-direct-20260908.md`에390×844 1H/shield·2H/set·가방 실제교체·reload 증빙과 fixture/초상 한계를 구분했다. 자연획득/전체장비품질/S3·S5 전체 완료로 확장하지 않는다.

우선순위 갱신: v19 full53034 실패의 idle-only restore readiness를 별도30회 관측으로 분리했다. Production 저장 변경 없이 E2E ready 대기/저장값 검증 보완, focused9/9 PASS. Full8060 결과 확인→PASS시에 v19 native→S3/S5 잔여 검증 순서다. 상세 `docs/evidence/qa/game-completion-new-game-plus-restore-readiness-20260908.md`. 기존 전체 목표와 황금왕국 별도 설계 승인 경계는 유지한다.

기기 갱신: 기존QA설치본 freshqa1.1.0/build2는잠금해제상태에서강제종료없이실행,같은PID32039가initial→110초이상후에도유지됐다. `game-completion-installed-ios-survival-20260908.md` 참조. 과거즉시종료는이번에미재현이며원인확정/최신source설치/foreground검수완료아님. 기존잠금blocker는현재사실이아니다. v19독립감사C0/I0/Minor0완료, full53034/native후최신기기gate를진행한다. 황금왕국UI수정은bounded설계승인전이며다른검증과분리한다.

현재 v19 exact2 적용/authored116/other252불변,source2TDD와focused12/ESLint/diff,실제390×844두화면검수,evidence33793 PASS. Report/v1/seed/protected불변. Full53034 진행 중(`/tmp/aetheria-v19-full.log`), 다음독립감사(균열체dark슬롯대비포함)→native328경로검증. Full종료전dist/native재빌드금지. 아래v19미적용은과거. 이후황금왕국UI접근성최소설계·수정과contextual잔여/S5/S6를진행한다. 전체Goal미완료.

최신 v18 local 완료: full25564exit0(unit4405/E2E117/bothsmoke), Sol/xhigh C0/I0/Minor0, production57776/Android92449/iOS47645exit0,328 package 경로 일치/native drift0/protected불변. v18/native-checkpoint.json이 최신권위다. 아래running은과거. 다음 v19 endpoint2 source-pinned export TDD와실제화면/통합검증을진행한다. 별도로 황금 왕국5종의 모바일조우경로 부재를390×844로 확인했으므로 Important 수정 설계가 필요하다. Command parser는있지만실제input/탐험버튼이없으며UI완료로볼수없다. 안전지역·원정/귀환계약을보존하는최소수정으로분리하고임의map type/확률변경은하지않는다. S3/contextual,S5,S6 및전체Goal은미완료. 설치없음.

v19 endpoint2 원화와 SHA pins·축소 양배경 검수 준비 완료, 아직 export/adoption 없음. v18 full25564/독립감사는 진행 중이며 검증 입력은 유지한다. `game-completion-kingdom-access-audit-20260908.md`는 safe-map5종의 catalog-only reachability 한계를 분리한다. 다음 직접 모바일 idle→command/explore 조우 검증 후 필요 시 별도 최소 TDD 수정; safe를 dungeon으로 바꾸거나 수치를 조정하지 않는다.

현재 v18 exact5 적용/authored114, source/export TDD2 및focused12/ESLint/diff PASS, 최종390×844 5장 owner 검수와evidence56029 완료. Report/v1/seed/protected 불변. Full25564 진행 중(`/tmp/aetheria-v18-full.log`), 다음 독립감사와native328경로검증. Native 재빌드는full종료후만 진행한다. `v18/candidate-review.md`가 현재 상세 권위다. 이어서 endpoint2 디자인, contextual 잔여 및 황금 왕국 safe-map 몬스터의 실제 출현 경로, S5/S6를 확인한다. 아래v18 source-only 표시는 과거다.

최신 v17 local 완료: full36146 exit0(unit4403/E2E117/both smoke), Sol/xhigh C0/I0/Minor0. Production96278/Android12776/iOS37914 exit0,328경로 package 일치/native drift0/protected 불변. 최신 증빙 `v17/native-checkpoint.json`; 설치 없음. 아래 running 상태는 과거다. 다음 v18 왕국·신전5 원화의 축소 식별성 검수와 export TDD 후 exact5 통합을 진행한다. 원본5 보존 완료/runtime 미적용. Astra 설계·구조화, Sol 정합성/감사, Terra high 또는 xhigh, Luna max 제약을 유지한다. 기존 Goal을 재사용하며 전체 완료로 표시하지 않는다.

v17 최신: 실제stable390×844 six portraits 및evidence72296exit0완료. Report/v1/seed·protected불변. Full36146/독립v12_review감사중이며full종료전dist/native재빌드금지. 다음native328path검증. 아래실제화면/evidence미완료메모는과거이고 상세v17candidate-review가권위다.

현재v17 exact6 적용/authored109/other248불변, sourceTDD2와focused12/ESLint/diffPASS. Export owner검수완료지만 실제390×844(서리정령대비포함), evidence/full/독립감사/native는남았다. Latestverifiednative v16, 과거증빙을최신으로주장하지않는다. v17candidate-review를따라재개한다.

최신v16 local완료: full86103/production40697/Android44602/iOS78228 exit0,4401unit/117E2E/bothsmoke/328package경로일치/native drift0. 독립감사C0/I0/Minor0, protected불변. Latest v16native receipt; 설치없음. 다음v17원화6의export TDD→contrast/실제전투검수→integration순서. 아래running기록은이결과이전이다.

현재v16 full4401unit/117E2E/bothsmoke 및독립감사C0/I0/Minor0완료. Native builds44602/78228 후328경로대조가남았다. 후속v17얼음6 source준비·원본보존·양배경검수완료, runtime미적용. v17candidate-review의contrast조건을포함한export TDD부터이어간다. 아래v16 full진행중표시는과거다.

v16 현재검증: 실제stable390×844 7장완료, evidence35135 exit0(관련gate PASS), full86103 실행중. 같은handle확인후 Sol독립감사와 native gate를닫는다. 진단report/v1/seed와protected6/38불변, manifest source SHA만갱신. 자세한현재상태는tasks/v16candidate-review. Full종료전dist/native rebuild금지. WholeGoal미완료.

현재 v16 runtime exact7 적용 완료/other247 불변/authored103. Source2 TDD와 adoption focused12 PASS; source/export 시각검수완료. 실제390×844→관련 evidence refresh→full/독립감사/native는 아직 남았다. Latest native v15, runtime evidence 미갱신 상태를 구분한다. 자세한 재개 지점은 v16/candidate-review.md. 아래 source-only 기록은 과거다.

v16 최신: 원화7/7과 원본 보존·full/96/46/32 양배경검수 완료. Export TDD와 actual160→46px 검증은 아직 남았다. `v16/source-metadata.json` 및 candidate-review를 기준으로 재개한다. 아래1/7 기록은 과거이며 runtime은 계속v15다.

재개 checkpoint: v16 exact7 source-only 준비 중, 공허의 파편1/7 생성·원본 보존, 나머지6 미생성. Runtime은 v15 그대로. `v16/candidate-review.md`가 source 선택/한계 권위다. 별도 text-name audit에서 누락된3종은 실제 검수 후 문서화했으나 문서 언급 수를 전체 품질 승인 수로 사용하지 않는다.

최신 실행 결과: 아래 1번 v15 마감은 완료했다. Full4399unit/117E2E/bothsmoke, Sol/xhigh C0/I0/Minor0, production/cap/doctor·Android debug·iOS unsigned 및328경로 비교 PASS. Native receipt는 v15/native-checkpoint.json이며 설치하지 않았다. 2번 endpoint8 시각 감사도 완료, Important2는 `monster-endpoint-general-review-20260908.md`에 기록했다. 이제 감사 문서의 exact-name coverage를 대조하고 아래3번 교정을 진행한다. 세 기존 묶음7/6/5 뒤에 endpoint2를 추가하며 gameplay 수치를 바꾸지 않는다.

기존 Goal과 보존 경계를 유지한다. 아래 순서는 과거 준비 메모보다 우선하며, 서로 다른 batch의 미완료 gate를 섞지 않는다.

1. **v15 마감:** 실행 중인 full1389의 종료 결과를 확보한다. 독립 감사의 문구 지적을 닫고, full이 끝난 뒤 production build → Capacitor sync/doctor → Android debug·iOS unsigned build → 328-path package byte 비교를 수행한다. 설치와 배포는 이 결과에 포함하지 않는다.
2. **남은 몬스터 감사 완료:** 아직 확인하지 않은 에테르 관문·차원 균열·종말 전장 8종을 확인한다. 기존 감사 문서와 canonical 이름을 대조하여 누락·중복을 구분한다. Contextual은 Important 수정 완료 수에 포함하지 않는다.
3. **명백한 디자인 결함 수정:** 공허·혼돈 7종 → 후반 얼음 6종 → 왕국·신전 5종 순서로 독립 묶음을 만든다. 마지막 8종 감사에서 추가 결함이 확인되면 먼저 범위를 기록한다. 각 묶음은 원본·preimage 보존 → source-pinned export TDD → 실제 46px 전투 화면 → manifest/evidence 정합성 → full/독립 감사 순서다. 다른 몬스터와 gameplay 수치는 바꾸지 않는다.
4. **기능과 선택의 직접 검증:** 390×844에서 장비 비교·한손/양손·offhand·세트 도달성, 직업 성장, 중후반 전투/탐험/퀘스트, 저장·offline·복귀를 시나리오별로 검증한다. 고정 fixture와 자연 플레이는 별도로 기록한다. 실제 결함만 TDD로 수정하며 새 balance 변경을 자동 도입하지 않는다.
5. **완성 판정과 native 인계:** S3 시각 감사, S5 플레이 경로, S6 최종 감사의 미완료 항목을 대조한다. 최종 변경본 전체 gate와 native package 검증 후 iPhone 인증·설치·실행 여부를 별도 증명한다. 이 조건이 충족되기 전에는 게임 전체 완료나 앱인토스 준비 완료로 표시하지 않는다.

모델 기준: Astra 계획·구조화, Sol 복잡한 정합성 검토·독립 감사, Terra는 high/xhigh의 범위가 고정된 작업, Luna는 max 구현에만 사용한다. 모델을 실제로 사용한 경우에만 사용했다고 기록한다. 현재 task의 단일 writer를 유지하고 불필요한 재검증·위임을 만들지 않는다.

### 현재 실행 단계 — 2026-09-08 v14 local 완료 / v15 source 준비

Latest v15 integration: exact7/other247보존/authored96;focused13·실제390×844전투7장·관련evidence PASS. Report/v1/seed 및 protected6/38불변. Full1389진행중, independent/native가남았다. v15/candidate-review.md와tasks의현재checkpoint를따라재개하며아래source/export단계는과거다. 전체Goal미완료.

v15진행: vampire dark대비개선 및RGB배경비파괴분리완료, 원본8보존/7exports준비. TDD3 RED→GREEN, focused13·ESLint/diff PASS,96/46/32양배경owner검수. 다음은exact7 canonical adoption/다른247불변→실제전투/evidence/full/독립감사/native. Source/export receipt와한계는v15/candidate-review.md. Runtime은아직v14이며전체Goal미완료.

v14 full32344exit0(4396unit/117E2E/bothsmoke), production/cap/doctor5069·Android28054·iOS73480exit0,328package경로일치/native drift0. 독립감사 C0/I0/Minor0. Latest v14/native-checkpoint.json, 설치없음. v15 exact7 원본은준비됐지만 vampire dark32대비개선이필요해 export/adoption 미시작이다. v15/candidate-review.md의순서로재개하며 아래v14진행중표시는역사다. 전체Goal미완료.

후속 감사 범위 고정: undead12와 dungeon/labyrinth/sewer13을160/32px 양배경으로 확인했고, 확정교정7종(리치·뱀파이어·해골 마법사·유령 군단·독 지네·부식된 기계병·하수도 악어)을 두 owner-review 문서에기록했다. 이들은 v14 변경에포함하지않고 다음batch로묶는다. 현재 iPhone 연결은복구됐지만 passcodeRequired=true로실행gate미완료이며 crash원인으로단정하지않는다. 기존S3/S5/S6전체범위는유지한다.

Exact3 적용·다른251불변/authored89. Focused12와실제390×844전투3장·관련evidence PASS. Diagnostic report/v1/seed 및 protected6/38불변. Full32344 실행 중, 독립감사 v12_review 요청; native는full후. 상세 v14/candidate-review.md 및tasks가재개권위다. 아래 candidate-export 메모는 이전단계이며 전체Goal은미완료다.

마법계 확정 불일치3종의 원본 보존·원화 생성·96/46/32px 양배경 검수와 source-pinned export TDD2/ESLint/diff를 완료했다. Runtime adoption은 아직 하지 않았다. `scripts/art_sources/monsters/v14/candidate-review.md`의 exact3 integration→실제390×844→evidence/full/독립감사/native 순서로 진행한다. 현재 canonical/authored86 및 최신 v13 native는 유지된다. Whole S3/S5/S6 완료를 의미하지 않는다.

모델 배치 요청: Astra가 계획·구조를 맡고, 필요에 따라 Sol, Terra high/xhigh, Luna max만 사용한다. 기존 보존·검증·승인 경계는 유지한다.

### 최신 실행 상태 — 2026-09-07 v13 local complete

v13 full18098 exit0(4394unit/117E2E/bothsmoke), production96304/Android49395/iOS96603 exit0,328경로package byte일치/native drift0/protected불변. Sol xhigh C0/I0/Minor0. v13/native-checkpoint.json이최신local패키지권위이며설치없음. 별도실제fresh첫귀환과reload검증은 game-completion-fresh-v13-20260907.md에기록: localproxy404·첫귀환levelup/장비없음을포함하며S5전체통과아님. 다음magic3시각교정및남은장비판단/중후반/복원경로검증을계속한다. 아래live메모는과거기록이다.

v13exact3 canonical적용·다른251불변, source2TDD/adoptionfocused12/실제390×844전투3장PASS. Evidence33083exit0/report·v1불변·manifestpin만갱신, protected불변. Full18098 LIVE4394unitPASS/smoke, Sol xhigh v13독립감사중(reusedv12_review). Native는full이후이고latestcompleted는v12. 상세tasks/v13candidate-review를따라재개한다. Magic12읽기전용감사의Important3은별도후속이며현재slice에섞지않는다. 아래v12/v13준비상태는역사기록이다.

v12 full62180 exit0:4392unit/117E2E/bothsmokePASS; production12610/Android19931/iOS71987 exit0, package328경로byte일치/native tracked drift0. Sol xhigh exact11 감사 C0/I0/Minor0. `v12/native-checkpoint.json`이최신native권위; 설치없고Goal미완료. 다음nature3는원본보존과작은크기검수까지준비됐으며v13/candidate-review.md를따라TDD export/integration을진행한다. 아래진행중메모는역사기록이다.

현재v12 integration 완료/전체gate 진행 중: exact11 적용·다른243불변, focused13PASS, stable390×844전투11장owner검수. Evidence26461/art-report54853 exit0, report/v1불변·manifest sourcepin만갱신. Full62180은4392unit/bothsmokePASS 후E2E 진행, Sol xhigh v12_review pending. Native는full후실행하며 최신완료패키지는v11 그대로다. tasks/todo.md의handle상태를재확인후이어갈것. 대기중nature9읽기전용감사의확정교정3건은별도후속이며v12에섞지않는다.

v12 export11 완료: 세이렌4영역 비파괴 alpha 처리, 원본13장 보존, TDD3 RED→GREEN/focused15/15/ESLint/diff PASS. 두 export sheet96/46/32 dark/light owner 검수. Runtime미적용이며 다음 gate는 exact11 canonical adoption TDD→390×844 전투→full/native. 원본/export pin 및 제한은 v12/candidate-review.md와 exports/receipt.json을 따른다. 아래 원화 준비 메모는 과거 상태다.

Important11 원화12장과 이전11 PNG 보존, 전체 원화·96/46/32 양배경 검수 및 원본 copy SHA 검증 완료. 세이렌 compact RGB 체크무늬로 adoption 보류; alpha 교정과 source-pinned export TDD가 다음 gate다. Runtime/manifest/registry는 v11 그대로다. 상세 `scripts/art_sources/monsters/v12/candidate-review.md`; 아래 v11은 최신 완료 checkpoint다.

v11 local 검증 완료: exact6 적용과 안정된390×844 전투6장 검수, focused12/12·art/content/event/equipment/diagnostic PASS. Full28177 exit0(unit4389/4389, E2E117, desktop/mobile smoke), production/cap/doctor56371·Android73756·iOS77888 exit0. 두 패키지328경로 byte 일치, native tracked drift0, protected candidate6/Toss38 불변. 최신 artifact/SHA는 `scripts/art_sources/monsters/v11/native-checkpoint.json`. iPhone은 tunnel unavailable로 설치하지 않았다. Sol xhigh exact6 독립 감사는 C0/I0/Minor0으로 완료했고 모든 실행은 종료했다. 전체Goal은 미완료다. 다음은 하늘·폭풍17종 감사에서 확인한 Important11 교정; Contextual6은 별도 검토다. 상세 `v11/candidate-review.md`와 `docs/evidence/art/monster-sky-general-review-20260907.md`를 따른다.

수중·영혼의 강 Important6의 원본보존·개별원화·160px export 준비를 완료했다. 실제크기 양배경 검수와 TDD2/16focused/ESLint/diff PASS. `v11/candidate-review.md`의 다음 gate는 canonical6 adoption → 안정된390×844 전투 → evidence/full/native다. 현재runtime미적용이며 새full4389 또는 설치 완료를 주장하지 않는다. Tasks ledger가 상세 재개 권위이고 전체 Goal은 진행 중이다.

v10 완료 checkpoint: 기계·연구실·피라미드 몬스터 9종을 원본 보존 조건으로 교정했다. TDD 후 focused12/12, 안정된 canonical 390×844 전투 화면9장, art/content/event/equipment/diagnostic gate를 통과했다. Full4075 exit0: unit4387/4387, E2E117, desktop/mobile smoke, typecheck/lint/build PASS. Production/cap/doctor24335와 Android1394/iOS30149도 exit0이며 두 패키지328경로 byte 일치, native tracked drift0을 확인했다. 최신 패키지 경로·SHA는 `scripts/art_sources/monsters/v10/native-checkpoint.json`에 기록했다. 초기 QA 지역명 오류와 전환 중 캡처는 보존했고, 올바른 지역·안정된 화면으로 별도 검증했다. 원본9·다른245종·historical candidate6/Toss38 불변, 진단 report/v1 불변이다. 모든 v10 실행은 종료했다. 기기 설치·archive 변경·commit·publication은 하지 않았다.

다음은 수중·영혼의 강 감사에서 확인한 6종의 이름·몸체 불일치 교정이다. `docs/evidence/art/monster-water-general-review-20260907.md`에 검수한12종·Important6·Contextual4·SHA를 기록했다. Authored66/254는 전체 디자인 승인 수가 아니며, 나머지 시각 감사와 전체 Goal은 계속 진행 중이다. 아래 준비 메모는 역사 기록이다.

v10기계/lab/pyramid9원화 source준비·원본보존·full/96·46·32양배경검수완료. Runtime미적용, `v10/candidate-review.md`의9SHA와비정사각형/작은세부한계에따라exportTDD→canonical전투→전체/native검증으로진행한다. 최신완료는v9이며전체Goal은진행중.

v9화산10 full39428exit0(4385unit/117E2E/smoke), production/cap/doctor/Android debug/iOS unsigned PASS,328경로/package byte일치와protected aggregate불변. 최신 `v9/native-checkpoint.json`. v9핸들은모두terminal이며아래LIVE는역사기록. 다음v10기계9중5source준비완료/나머지4생성후exportTDD와통합검증. iPhone설치없음, 전체Goal미완료.

Full39428 대기와독립적인v10기계source5준비·원본보존·크기별검수완료(미적용). `v10/candidate-review.md`의나머지4→TDD export를후속으로둔다. v9full은unit4385통과/E2E진행중이며runtime변경은보류한다.

최종 갱신: diagnostic write+verify26521은 exit0으로 완료했다. 아래26521 LIVE 표기는 이전 상태다. 현재 남은 실행은 full39428이며 종료 전 재실행하지 않는다.

v9 canonical10종 적용+용암거인art분류 RED→GREEN, focused12/12/canonical390×84410장검수/art/content/event/equipment power·economy PASS. Other244불변, authored57은전체시각승인아님. Diagnosticreport/v1불변/manifest sourceSHA갱신, write+verify26521 LIVE; full39428 LIVE `/tmp/aetheria-v9-full.log` exactpoll필수. 이후production/cap/native328path. `v9/candidate-review.md` latest section이재개권위이며아래준비메모는역사다. 전체Goal미완료.

v9 preparation완료: 원본10pin/비율/alpha/재실행/변조·덮어쓰기거부 TDD2 RED→GREEN, 실제160px export10종의96/46/32px 양배경owner검수, focused15/15·ESLint/diff PASS. Runtime미적용이다. `v9/candidate-review.md` latest checkpoint에따라 actual390×844→canonical integration TDD→evidence/full/native를진행하고machine9로이어간다. 아래source준비대기문구는역사기록이다.

다음slice v9 source준비: fire Important10전체 원화생성·원본보존·full/96·46·32px 양배경검수. 실제RGBA이나 외곽alpha잔여/분리방울, 작은무늬손실을기록했고runtime미적용이다. Lava-spirit비정사각형의비율보존도필수. `scripts/art_sources/monsters/v9/candidate-review.md`의 exact10SHA/prompt→TDD export→integration후machine9를 따른다. 기존v8 full/native가 최신 검증이다. 새generation호출모두terminal, 전체Goal계속진행.

Full대기 중 추가source감사33종: fire17에서Important10, machine/lab/vault/pyramid16에서Important9. 각각 `monster-fire-general-review-20260907.md`, `monster-machine-lab-vault-review-20260907.md`에SHA/원본160px/32px증거와contextual분리를기록했다. 새19건은후속교정이며v8runtime검증에섞지않는다. 전체시각완성은미달이다.

최신v8 완료:9종 exact 적용+설원거인 art분류만warrior로교정, 다른245종불변. Canonical390×8449장 owner검수/13focused/art/content/event/diagnostic PASS, 진단report/v1불변. 초기routing캡처 실패는보존·통과제외. Full로그 최종완료4383unit/117E2E/smoke, production/cap/doctor/Android debug/iOS unsigned PASS,328경로/package byte일치. Full54204 마지막tool출력이 잘려 exit code는 단정하지 않으며 handle은소멸했다. 최신 `v8/native-checkpoint.json`, 상세 `v8/candidate-review.md`. Protected aggregate/native tracked drift불변. 다음은 추가감사에서확인된19종교정과나머지시각감사. iPhone미연결/미설치, 전체Goal미완료. 아래 preparation 메모들은 역사기록이다.

최신v8 preparation: source-pinned9 export/TDD3 RED→GREEN, 실제opaque2 alpha교정·원본보존, extraction11/11·catalog/source13/13·ESLint/diff PASS. Prepared9 actual-size 양배경 owner검수 완료. 아직actual combat/runtime integration 전이며 다음gate는 `v8/candidate-review.md`. 기존 full4380/native328 기록에 새3테스트나9몬스터가 포함됐다고 주장하지 않는다.

후속v8 source 준비: 확인된 cave/snow9종 원화와 compact elf revision1개 생성·원본보존,10SHA와9runtime/registry/manifest불변 확인, full-source/96·46·32px 양배경 검수 완료. 초기elf는 가늘고 어두워 제외; compact elf 검은배경/mineral centipede 격자 모두opaque이므로 아직runtime채택 안함. `scripts/art_sources/monsters/v8/candidate-review.md`의 TDD extraction/export→actual combat9→cohesive integration/full/native를 다음으로 진행한다. 마지막 완성 checkpoint는 아래 캐릭터8이며 전체Goal미완료.

최신 캐릭터 gate 완료: 실제390×844 portrait8 검수, 새full80148 exit0(4380unit/117E2E/smoke), production/cap/doctor, Android debug/iOS unsigned328경로 byte검증 PASS. Native tracked drift0. Full89516의 절전3timeout 실패와 focused3PASS는 원본 기록으로 보존한다. `character_alpha_v1/native-checkpoint.json`, `character-art-full-sleep-20260907.md`와tasks/todo.md를 따른다. 다음은 확인된 몬스터9종 교정과 남은 전체 시각 감사다. iPhone disconnected는 별도 환경gate이고 전체Goal완료는 아니다.

캐릭터8종 aperture 교정 runtime 적용: 원본·이전runtime/evidence 보존, mask/흰 디테일 regression과adoption RED→GREEN, focused24/24·art·renderer replay18·other10불변 확인. Full89516 진행 중. 실제390×844 portrait와최신native gate는 남아 있다. character_alpha_v1/README.md와tasks/todo.md가 현재 재개 지점이며 아래2종준비 메모는 과거 상태다.

캐릭터 alpha slice: ranger/hunt-lord2종 후보를 원본 보존 조건으로 준비했다. Source-specific mask/기존768px renderer 재사용, TDD2개와 focused22/22 PASS,96/64px 비교 완료. Runtime미적용이며 나머지6종 mask→전체portrait검수→cohesive adoption/full/native가 남았다. 상세 character_alpha_v1/README.md; 전체8종 완료로 해석하지 않는다.

ART-LOCATION-01 최종 checkpoint:12종 교정의 full exit0(unit4376,E2E117,desktop/mobile smoke), 실제390×844 지도 선택검수, production/native310경로 byte동일, tracked drift0까지 완료했다. `location-medallions/boundary-v1/native-checkpoint.json`과 `location-owner-review-20260907.md` 참조. 다음은 캐릭터8종 alpha correction이며 ranger/hunt-lord aperture와 제외할 화살 장식 후보를 원본 확대검수로 구분했다. 아래 진행 중 메모는 이전 시점이고, 전체S3/S5/S6 완료는 아니다.

후속 ART-LOCATION-01: 문제의12종 source-cell 경계를 교정하고 runtime에 반영했다. 실제 source 회귀 RED→GREEN, focused27/27와 art PASS,96/28px 양배경 검수 완료. 원본과 이전53exports 보존, 나머지41files byte불변. Full handle66048 진행 중이며 실제390×844 지도·production/native 검증은 다음 gate다. 이 항목은 아래 “다음 작업”을 진행한 현재 상태이고, 상세 재개 지점은 tasks/todo.md를 따른다.

지역 몬스터 5종 교정과 직접 390×844 전투 검수를 완료했다. 원본·이전 파일과 나머지249종은 보존했다. Full gate는 unit4375/4375, smoke desktop/mobile, E2E117/117 PASS이며, production Android debug/iOS unsigned package의257경로 byte 일치와 tracked drift0도 확인했다. `scripts/art_sources/monsters/v7/small-size-review.md`와 `native-checkpoint.json`이 이 묶음의 상세 증거다. 설치·배포 또는 전체254종 시각 완료를 의미하지 않는다.

다음 작업은 ART-LOCATION-01의 지역12종 source-cell 경계 교정이다. 승인된 Python/Pillow 처리를 원본 복사본에만 적용하고 나머지40종 bytes를 보존한다. RED→GREEN, 작은 화면 검수, 관련 art/full/native gate 순으로 닫는다. 캐릭터 alpha8종, 동굴/설원 몬스터9종과 나머지 전체 감사는 계속 열린 상태다. 최신 ledger는 `tasks/todo.md`; 아래의 픽셀 처리 승인 대기 문구는 과거 상태이며 현재는 원본 보존 조건으로 승인되었다.

현재 v5(2026-09-07): contextual5는 Void32px I1 보완 후C0/I0, runtime반영·focused40/40·390×844통제전투5종·진단결과불변 확인. Full exit0(unit4360/4360,E2E59+57), cap/Androiddebug/iOSunsigned PASS, 실제 두 패키지의 productionJS+authored30 PNG31/31 일치. 추가client 최초 timeout은 보존하며 재검사 exit0. v5/native-checkpoint.json은 로컬패키지 증거이지 설치 증거가 아니다. Character8 enclosed-checker defect와 S3/S5/S6는 미완료이며 픽셀마스크 방식은 별도 승인 대기. 상세 상태는 progress.md 최상단을 따른다.

최근 진행(2026-09-07): Required-five boss art는 독립 C0/I0 후5종 runtime 반영, focused40/40·full4360/4360·E2E59+57·390×8445종·Androiddebug/iOSunsigned package26/26byte 검증까지 완료했다. 다른249종 record/PNG 불변. v4/native-checkpoint.json은 로컬패키지 증거이며 설치 증거가 아니다. 다음 contextual5 교정 기준은 monster-contextual-six-review-20260907.md; S3 전체와 S5/S6는 여전히 미완료다. 최신 재개 지점은 progress.md 최상단을 따른다.

2026-09-07 EXPEDITION-HP-01: 신규 start/return에 production 최대 HP 적용, 과거 snapshot 분모 보존. TDD RED→GREEN, 원정/Class Journey/cloud focused integration95/95와 tsc/lint PASS. 화면 재검증·full/native는 아직 미완료다.

## 1. 목적과 완료 경계

2026-09-07 OFFLINE-RETURN-01 수정: GameRoot의 귀환 카드만 eager import. 실제UI offline 첫귀환 RED→GREEN, 저장없는 e2e모드의 reload 실패를 isolated toss-first-five snapshot 대기로 교정. 순차80012 buildguard/E2E5/5, unit13/13, tsc/lint/diffcheckPASS. 최종390×844 캡처 owner검수. offline-return-20260907.md에 실패/한계 모두기록; 실제 cloud offline복구 전체 증거 아님. 이전116E2E는 수정전이며 새 progression source/full/native는 미완료. Art4건/이미지승인대기 유지, 모든 handleterminal, Goalactive.

2026-09-07 latest: browser regression69777 exit0, buildguard/desktop+mobile smoke/E2E59+57 PASS, /tmp/aetheria-post-hp-browser-0907.log. Desktop close timeout 보존. 별도 actual offline-sep7에서 Important OFFLINE-RETURN-01 재현: 첫 안전귀환시 lazy ExpeditionDebriefCard chunk 실패로 전역오류, online reload는 숲 상태 복원. Owner 두 캡처 확인, docs/evidence/qa/offline-return-20260907.md. 기본suite가 이 경로를 커버하지 않음. 다음 core return chunk 의존성 TDD 수정과 같은 offline 재검사. Browser close, wrapper EXIT cleanup 완료;69777재실행 금지. Full/art/native 및 Goal전체 미완료.

2026-09-07 post-save/HP regression: 전체 unit31919 exit1, 4364개 중4359PASS/5FAIL (art registry/answer-key 결합4건, progression source evidence1건). 로그 /tmp/aetheria-post-save-hp-unit-0907.log. 이어서 diagnostic write98365/readonly verify12225 모두exit0, SHA c03ebd7ac25a155adca4baaef7d7de7a8a4e2a02f9190803e62379680624b184. 이전 report/v1 byte projection 불변, focused64/comparison1000, hardErrors0; source4개(signatureRegistry/useFirebaseSync/cloudPlayerSnapshot/expeditionLedger)만 새 hash. Art4건은 미해결이며 전체unit 재실행/full/native PASS로 주장하지 않는다. quota local rule/path/limit 일치만 확인했고 deployed permission은 미검증. 이미지 Python보정 범위 승인을 다시 비동기로 요청, 답변 없이 실행하지 않는다. 모든 이 turn process terminal, Goal active.

2026-09-07 HP修正 real-surface checkpoint: 실제 fresh UI 생성/자연 전투/귀환 후113/178→63% 확인. 동일 세션 reload 후 HP·MP·골드321·EXP39·전리품2개·원정1전투/2탐험 유지. Owner가 hp-fixed-{return,restored}-390x844.png 두 장 직접 검수, overflow0. 상세 fresh-combat-owner-20260907.md. Browser close 및 검증 완료 후 dev60691 종료. Local AI404×2/quota warning은 별개이며 full/native·전체S3/S5/S6는 미완료. 다음 남은 기능 감사와 전체 검증; Goal active.

앱인토스 제출보다 게임의 구성·기능·디자인 완성을 먼저 한다. 기존 React/Capacitor 코어를 유지하며, 지금 있는 콘텐츠가 실제로 동작하고 플레이어에게 제대로 보이는지를 검증한다. 새 지역이나 통화를 늘려 결함을 덮지 않는다.

이번 native Goal은 이 계획의 구현과 local 검증을 담당한다. 기존 dirty changes, save, historical candidate, worktree를 보존한다. Orca recovery나 다른 repository 작업을 재개하지 않는다. Commit/push/merge, 유료 서비스, 공개 배포, 앱인토스 업로드·심사·출시, IAP 활성화는 포함하지 않는다. 물리 Android는 사용자 요청대로 제외한다.

**게임 완성 판정**은 아래 기능 계약의 Critical/Important 결함 0, full gate, 디자인 의미 검수, 직접 플레이 증빙이 모두 있을 때만 한다. 파일 존재·unique hash·unit PASS는 각각 coverage·byte 차이·테스트 결과일 뿐 완성의 대체 증거가 아니다. 설치·실기기·공개 검증은 별도 상태로 표시한다.

## 2. 플레이 경험 설계

게임의 중심은 위험을 읽고 다음 행동을 고르는 원정이다. 짧은 플레이에서도 이동, 전투, 보상 선택, 귀환이 이어지고, 장기적으로 직업과 장비 조합을 바꿔 다시 도전할 이유가 있어야 한다.

- 첫 세션: 캐릭터 생성 → 출정 → 전투와 optional 선택 → 장비 판단 → 정상 귀환. 진행 버튼과 설명만으로 다음 행동을 찾을 수 있어야 한다.
- 원정: HP·기력·가방·보스 준비 상태를 보고 더 갈지 돌아갈지 결정한다. 강제 modal이나 과도한 이벤트가 판단을 대신하지 않는다.
- 빌드: 18개 직업의 허용 장비, 한손/양손/보조 슬롯, 세트와 유물의 효과·단점·지속 기간이 설명과 일치해야 한다.
- 장기 성장: 기존 52개 지역, 254종 몬스터, 143개 퀘스트, 전직·Class Journey·도감·endgame·프레스티지를 연결한다. 콘텐츠 개수만으로 도달 가능성을 주장하지 않는다.
- 실패와 복구: 죽음·도주·귀환·재시작·background·재실행에서 자원/보상이 중복되지 않고 저장 상태가 보존되어야 한다.

EXP/drop/pity/event/적 HP는 한 release에서 한 변수군만 조정한다. 이번 결함 수정에 전반적인 pacing 조정을 섞지 않는다. 별도 balance 변경은 production simulator와 fresh-session observation이 같은 문제를 보여줄 때 열고 rollback 가능한 profile로 제한한다.

## 3. 영역별 계약과 source owner

| 영역 | 고정할 계약 | 주요 source와 검증 |
| --- | --- | --- |
| 캐릭터/전직 | 18개 직업 art·능력·해금·장비 제한과 안내 일치 | `src/data/classes.ts`, progression/content 진단, 전직 UI |
| 장비/세트 | 229개 장비의 1H/2H/armor/shield 규칙, capacity-safe 교환, 실제 장착으로 세트 tier 도달 | `equipmentValidation.ts`, `equipmentHandlers.ts`, `signatureSetBonus.ts`, reducer 경로 테스트 |
| 전투/유물 | 공격·기술·아이템·DOT settlement 공통, 효과 지속 기간/캡/replay 일치 | `CombatEngine.*`, `exploreUtils.ts`, `statsCalculator.ts`, 연속 전투/귀환 테스트 |
| 탐험/퀘스트 | 위험·선택·예상 trade-off·결과가 연결되고 보상/발견 중복 0 | exploration, quest, Class Journey source; content/pacing/event evidence |
| 장기 성장 | 주요 level checkpoint, 장비 획득, boss/endgame unlock이 실제 경로에서 연결 | Progression Simulator v2, content reachability, late-game UI scenario |
| 저장/복구 | restart·restore·offline·quota·background에서 데이터 손실/보상 중복 없음 | persistence/reducer tests, 실제 browser/native 복귀 |
| 디자인/UI | 이름·직업·생태·무기 hands가 그림과 맞고 작은 크기에서도 식별됨 | art manifest + 원본/32px contact sheet + 390×844 실제 화면 |
| 설치/실기기 | 설치된 bundle과 실행 PID를 정확히 식별; foreground는 화면으로 별도 증명 | iOS device smoke, native build, Android emulator (물리 기기 제외) |

## 4. 현재 감사에서 확인한 결함

추가 첫전투 감사(2026-09-07): **EXPEDITION-HP-01 / Important** — 귀환위험표시HP134가89%지만실제전투max178기준75%다. expeditionLedger가rawmax150을기록한다. 신규원정시작/귀환은production stats최대HP를사용하도록TDD수정하고,과거snapshot분모는추측해변경하지않는다. `docs/evidence/qa/fresh-combat-owner-20260907.md`.

추가 fresh-play 감사(2026-09-07): **SAVE-01 / Important** — 신규생성 뒤cloud autosave가player.deferredEventChainSteps=undefined로거부됐다. 원정relic필드도동일위험. Cloudprojection만null로변환하여Firestoremerge의과거값정리까지보장했고focused51/51,tsc/lint 및실제UI→서버read5/7/9revision으로검증했다. `docs/evidence/qa/cloud-player-optional-fields-20260907.md`. 전체full/native와S5첫전투는아직미완료.

추가 장비 감사(2026-09-07): **ART-GEAR-01 / Important** — 대지의 심판은 production에서2H대검인데 item/overlay가망치다. 두runtime 원본과229+25 provenance 일치를 확인했으며 관련22/22 PASS가 이 시각 의미 결함을 검출하지 못한다. Gameplay 계약을 유지하며 대검 원화2장을 교정한다. `docs/evidence/art/equipment-owner-review-20260907.md` 참조.

추가 owner 감사(2026-09-07): **ART-LOCATION-01 / Important** — 지역52종 중12종에 인접 셀 테두리 잔상이 있고 본체도 축소·왼쪽 정렬된다. 4열 균등 crop의 세 번째 열 경계 문제를 원본과 read-only 픽셀 분석으로 확인했다. 기존6/6 테스트 및 독립C0/I0는 이 결함을 검출하지 못했다. `docs/evidence/art/location-owner-review-20260907.md`를 따른다. Source extraction 교정·재검수 전 지역 디자인 완료 아님.

이 목록은 현재 source 감사 결과이며, 과거 PASS 기록은 당시 결과로 보존한다.

1. **SET-01 / Important**: 천공의 성좌는 armor가 없고 2H가 offhand를 막는다. 기존 3세트 도달성 테스트는 불가능한 `성스러운 창 + 천공 성전` 객체를 직접 만들었다. 실제 player action으로 증명되지 않은 완료 주장이다.
2. **RELIC-01 / Important**: 허공의 왕좌의 처치 ATK 누적이 승리 후 생기지만 다음 전투 시작 때 0으로 초기화된다. 단일 적 전투에서 효과를 사용할 수 없다.
3. **RELIC-02 / Important**: 세계 포식자 설명은 전투 중 증가인데 source는 base maxHp를 영구 증가시킨다. 무제한 성장과 설명 불일치를 해결할 지속 기간 설계가 필요하다.
4. **ART-01 / Important**: 254 unique monster exports는 23개 기존 prototype의 변형이며 독립적인 254종 원화가 아니다. `눈보라 정령`의 눈을 eyeball로 해석, `머맨`·`스핑크스`의 생태/몸체 불일치가 직접 확인됐다.
5. **DEVICE-01 / Important**: iOS smoke가 generic `App.app/App` 또는 Aetheria 문자열을 인정하여 다른 앱으로 survival PASS할 수 있다. launch receipt와 exact process를 연결해야 한다.
6. **EVIDENCE-01**: PID 11857 부재와 `passcodeRequired:true`의 동시 관찰만으로 auto-lock이 종료 원인이라고 할 수 없다. 현재 원인은 **unknown**이며 crash/termination 증거와 화면 상태를 추가로 확인한다. UDID 사용 성공도 USB 전송으로 단정하지 않는다.
7. **SET-02 / Important**: 천공 성전과 차원 방패 이지스는 standalone 장비로 사용할 수 있지만, 현재 장착품을 유지하는 signature 완성 경로가 없다. 직업 제한과 2H 충돌을 무시한 “1개 더 장착” 약속을 실제 가능한 교체 안내와 구분해야 한다.
8. **GEAR-01 / Important**: 직접 390×844 검수 중 양손 지팡이를 든 상태에서 가방의 천공 성전이 “장착 가능”으로 표시됐다. reducer는 올바르게 거부하지만 `getEquipmentDecision`은 직업만 검사한다. UI와 production validation의 불일치다.
9. **GEAR-02 / Important**: 직업 세트 1피스에서 다음 2피스 단계까지 1개가 필요한데 “2개 더”라고 안내한다. 목표 tier와 남은 기여도 계산을 맞춘다.
10. **COMBAT-01 / Important**: 적 턴의 반사·반격으로 적 HP가 0이 되어도 `isEnemyDead`가 없어 정산이 다음 입력까지 지연됐다. S2에서 공통 enemyAttack 결과를 수정하고 동시 사망은 패배로 보존했다.
11. **STORY-01 / Important**: 이야기의 “무시한다”가 진행도를 유지한 채 같은 원정에서 매 탐험 재노출된다. 직접 390×844 화면에서 3회 재현했고 production harness도 같은 결과다. 일반 이벤트 확률보다 앞선 chain 강제 분기이며, 8개 chain의 14개 `nothing` 선택을 S2b에서 별도로 수정한다.

## 5. 실행 순서

각 slice는 `RED → GREEN → focused integration → evidence/ledger → review`로 닫는다. 같은 작업을 묶어 full gate를 한 번 수행하고, commit은 별도 승인 후 cohesive checkpoint로 한다.

### S0 — 설계와 현황 고정

- [x] 현재 Git/dirty state와 repository source/기존 QA 이력 확인
- [x] independent read-only 감사와 실행 Goal 생성
- [x] 이 문서에 범위·계약·발견 결함·완료 조건 기록
- [x] signature 외 18개 직업 세트와 7개 prefix 세트의 production action 도달성 추가 감사; 개별 signature member/안내 결함은 S1b로 분리

### S1 — 실제 장착 가능한 세트

- [x] canonical 18 jobs, 실제 inventory action을 사용하는 세트 도달성 RED 테스트
- [x] 실제로 불가능한 천공 3세트 안내/definition 제거; 유효한 2세트 수치는 보존
- [x] 2H+offhand를 합법적 도달성 증빙처럼 사용하는 fixture 제거
- [x] 모든 광고된 tier에 실제 장착 witness, UI progress/계산 동일성, swap/replay/capacity 회귀

선택 이유: 새 armor의 소속이나 장비 규칙을 임의로 바꾸지 않고 잘못된 보상 약속만 제거한다. 유효하게 도달하던 build의 수치는 바꾸지 않는다. 세트 확장은 별도 콘텐츠 설계가 필요하다.

### S1b — 실제 가능한 장비 선택 안내

- [x] `getEquipmentDecision`과 실제 `canEquip`의 level/job/2H 결과를 같은 source of truth로 통일. 미보유 장비의 가정 비교와 “지금 장착 가능”을 분리하고 이유를 표시
- [x] Signature 진행도는 해당 직업·현재 착용 멤버를 유지하는 legal completion path만 추가 장착으로 안내. 불가능하면 standalone 능력과 장비 교체 필요성을 명시하고 허위 missing-member 보상 약속을 숨김
- [x] 직업 세트의 남은 수량은 `다음 tier의 requiredCount - 현재 기여도`; 1→2는 1, 2→3은 1
- [x] RED는 천공 성전/차원 방패, 양손→보조 차단, 저레벨/직업 제한, 합법적 dual-wield/2H+armor, 1·2·3피스의 UI copy를 포함
- [x] Focused integration와 390×844 실제 가방/장비 화면 재검사. stat/장비 소속/jobs/가격은 변경하지 않음

이 단계는 S1 후 실제 사용과 추가 감사로 발견한 범위다. 모든 tier에 하나의 witness가 있다는 사실은 각 아이템·직업에서 같은 tier가 가능하다는 의미가 아니다.

S1b 감사에서 연결된 제작/합성 preview와 추천 장착도 함께 수정했다. 제작/구매 가능 여부는 착용 가능 여부와 별도 계약으로 유지한다. 추천 장착은 처음부터 착용 가능한 positive upgrade만 후보로 선택한다. 전직 후 남은 이전 직업 장비는 자동 해제하지 않고, 현재 직업의 일반적인 완성 경로와 구분해 설명한다.

### S2 — 유물의 지속 기간과 실제 효능

- [x] 전투 시작→처치→다음 전투→귀환/사망/복구의 실제 경로로 RELIC-01/02 RED 재현
- [x] 기존 run/expedition state와 reset owner를 확인한 뒤 수명·cap·save 계약을 이 절에 구체화
- [x] 단일 적 combat에서도 유용하되 영구 누적으로 탈출하지 않는 최소 설계 적용
- [x] 설명/로그/시너지/stats/restore를 함께 수정하고 중복 callback과 기존 저장 회귀 검증
- [x] 현재 source의 full gate와 직접 화면 증빙 closeout: unit 4328/4328, E2E 59/59 + 56/56, desktop/mobile smoke, 직접 390×844 승리·복원·귀환 PASS. 로그 `/tmp/aetheria-relic-full.log`

임의로 "전투 중"을 "영구"로 해석하지 않는다. 현 자료만으로 최대 HP 새 cap 수치를 정하지 않는다. 호환성이나 balance를 크게 바꾸어야 하면 그 근거와 대안을 제시하고 범위를 다시 확정한다.

#### S2 구현 전 lifetime 설계 (2026-09-05)

- 허공의 왕좌: 기존 처치당 `0.05`, cap `0.5`를 유지하고 **현재 원정 동안** 누적한다. 다음 전투·위험 지역 이동·복원에서는 유지하고 안전 귀환·사망·재시작·계승에서 해제한다. 전투마다 생성되는 `combatFlags`에 장기 누적을 두지 않는다.
- 세계 포식자: 기존 `enemy.maxHp × 0.1`을 유지하되 **마지막 승리에서 얻은 양을 다음 전투 한 번에만 적용**한다. 원정 내 합산도 무제한 성장 경로이므로 사용하지 않는다. 새 수치 cap을 발명하지 않고, 한 번의 승리량으로 교체하는 비누적 계약으로 제한한다.
- 포식 상태는 optional pending/active phase와 실제 적용량을 구분한다. 전투 진입에서 pending→active는 한 번만 실행한다. 승리·성공한 도주·강제 도주·사망에서 active를 해제하고, 승리만 새 pending 보상을 만든다. continue/실패한 도주는 active를 유지한다. 안전 귀환·재시작·계승은 pending도 해제한다.
- HP 원복은 새 구현이 실제 부여했다고 기록한 양만 대상으로 한다. 기존 저장의 base maxHp를 추측해서 깎지 않는다. 레벨업/전직/장비 HP 변화와 분리하고, 중복 activation/cleanup/restore가 추가 회복·차감을 일으키지 않아야 한다. battle-start cost/heal은 활성화 후 fullStats와 맞춘다.
- 저장에는 optional additive normalization만 적용한다. `combatFlags`는 migration에서 재생성되고 `activeExpedition`은 명시 필드만 복원되므로, 두 기존 객체에 임의 필드를 끼워 넣지 않는다. 기존 `tempBuff`도 여러 이벤트가 덮어쓰는 ATK/DEF/turn 계약이어서 포식 HP에 재사용하지 않는다.
- 연관 설명 오류도 같은 slice에서 닫는다. 절멸자/공허의 용은 source의 기본 `5% + 7%/8%` 합산을 “추가”로 명시하고, 무한 포식의 `0.15`는 최대 생명 증가가 아니라 처치 시 HP 회복으로 설명한다. 이 수치들은 변경하지 않는다.
- 기존 save의 소유 유물은 `relic.desc`도 저장하므로 registry 문구만 고치면 이전 설명이 남는다. 해당 두 유물의 표시 설명을 실제 적용 lifetime과 값에 맞추는 좁은 migration/표시 경로를 함께 검증한다. 무관한 유물 값이나 출처를 알 수 없는 기존 HP를 재작성하지 않는다.

RED는 연속 세 전투의 비누적 HP, 누적 ATK cap, attack/skill/item/DOT 승리 공통 계약, 성공/실패 도주, 안전/위험 이동, 사망/계승/재시작, level-up/job-change, pending/active save roundtrip, malformed/legacy save, replay와 RNG 불변을 포함한다. 실제 전투 진입·정산 owner를 사용하는 focused integration으로 닫은 뒤 evidence/full gate를 다시 source에 묶는다.

S2 구현은 `player.adventureRelicBonuses`의 optional `killStackAtk`와 `devour:{phase,amount}`를 사용한다. 저장 정규화/설명은 data-only leaf, HP activation/cleanup은 runtime helper로 분리해 migration에서 stats/reducer를 역수입하지 않는다. 포식량은 **기본 최대 HP** 증가량이며 기존 HP multiplier는 그대로 적용된다. 따라서 설명도 “기본 최대 생명과 현재 생명”으로 구분한다. 출처 없는 legacy HP는 보존하고, 기록된 active만 제거한 뒤 장비·직업을 포함한 effective maxHp로 clamp한다.

### S2b — 이야기의 ‘이번에는 무시’ 선택을 실제로 존중

S2는 full gate와 local 검증을 완료했다. 다음 cohesive slice에서 진행한다. 이것은 EXP/drop/일반 event multiplier 조정이 아니라 선택 결과와 재노출 상태의 결함 수정이다.

- [x] 8개 chain·14개 `nothing` 선택의 progress/reward 불변을 유지하는 RED. 거절한 step을 다음 탐험에서 다시 강제하지 않고 일반 탐험·전투·Scout/보스 경로에 도달
- [x] `chainId + step`의 원정 한정 deferral만 optional player state에 기록. 실패(-1)나 자동 advance로 변환하지 않으며 다른 chain·step을 막지 않음
- [x] 같은 원정의 저장·복원·위험 지역 이동은 deferral 보존. 안전 귀환·사망·RESET/ASCEND는 해제해 다음 원정에서 다시 선택 가능
- [x] 잘못된/오래된 deferral은 canonical chain/step 기준으로 정규화. 기존 terminal failure 7개와 완료 보상/replay 계약 보존
- [x] 해당 chain의 `nothing` 안내는 “이번 원정에서 미룸”과 실제 결과를 일치시킴. 새 메뉴·modal·통화·전역 확률 수치는 추가하지 않음
- [x] focused/full gate, 필요한 evidence refresh, 같은 390×844 Explore→무시→다음 Explore 직접 재검사

S2b 구현은 `player.deferredEventChainSteps`와 reducer 소유 `DEFER_CHAIN_EVENT`를 사용한다. Hook은 identity만 전달하고 reducer가 canonical event·보상 없는 outcome·현재 progress와 노출 당시 `expectedExploreCount`를 확인한 뒤 미루기/로그/창 닫기를 한 번에 정산한다. 탐험 횟수는 RESET/ASCEND에서도 보존되므로 다음 원정에 다시 열린 같은 step을 과거 callback이 닫지 못한다. Gold-choice의 기존 exact 3-key 계약은 변경하지 않는다. 초기 RED와 stale 재현 뒤 focused 61/61, related integration 132/132, 독립 재감사 Critical/Important 0(51/51)까지 통과했다.

**S2b 완료 증빙 (2026-09-05):** `npm run verify:full` PASS(`/tmp/aetheria-chain-full-closed.log`): unit 4352/4352, desktop/mobile smoke, E2E 59/59 + 56/56. 최초 full gate의 유일한 실패는 cycle596의 기존 2-argument source regex였으며, 정확히 deferral 인자까지 검사하는 3-argument 계약으로 갱신하고 재감사했다(기존 legacy call/default 검사는 유지). Desktop smoke의 알려진 비차단 browser-close timeout은 별도 기록한다. Direct 390×844에서 미루기→복원→전투→안전 귀환→재제안→다시 미루기와 seed112596 전투를 확인했다. 초기 global-RNG fixture의 duplicate-key 경고는 폐기된 통제 run으로 남기고, native Math.random과 per-Explore seed만 사용한 재검사는 console error 0, width/scroll 390/390이다. 관련 이미지는 `output/playwright/completion-20260905/chain-{reoffered,seeded-restore-combat,safe-return}-390x844.png`이며 모두 직접 검수했다.

Progression evidence write→verify SHA `b190163cb13fb1da8b03ac199591b3c217dfb6656c9c939346f5fe4323c19055`, source 323개 drift 0, focused64/comparison1000, hardErrors 0. Progression/v1/DOT/event-chance report hash는 불변이며 세 evidence의 source seal만 갱신했다. Art/content/pacing/event-reward/relic/equipment/mobile doctor와 cap sync PASS. 최신 web/Android/iOS main entry는 `assets/index-BxdTbq3y.js`, 동일 SHA `e2f9ff17886fedcda250613ce2af15282544b2a25ebf6fa565a51974d20432a7`; native tracked drift 0. 기존 candidate6/Toss38 aggregate는 불변, HEAD `38a3584`, index 비어 있음. 새 native archive/설치/실기기 PASS는 주장하지 않는다. **다음 단계는 S3이며 Goal은 유지한다.**

### S3 — 디자인의 의미와 완성도

2026-09-09 implementation acceptance: current character18/map52/equipment229 review records and monster v1–v22 corrections/retained review cover the scoped catalog. Final authored140/retained114 is a routing split, not254 separately authored originals. All final7 source/export/actual390 portraits passed owner and independent C0/I0 review. Existing fixed job portraits and fallback-only overlays are retained as designed. References: art/character-alpha-review-20260907.md, location-owner-review-20260907.md, equipment-owner-review-20260907.md and family follow-ups, equipment-signature-source-review-20260908.md, retained-monster-small-size-review-20260908.md with v20/v21/v22 successors. Full58171 passes4434unit/117E2E/bothsmoke; device acceptance remains S5, not part of these local checks. The early pending batch notes below are historical.

2026-09-07 진행 증빙: Earth Verdict의 잘못된 hammer를 실제2Hgreatsword item/overlay로 교체하고 paired-source/provenance/실제390px 검수를 완료했다(`docs/evidence/art/earth-verdict-adoption-20260907.md`). 이후 일반 몬스터 고블린·코볼트·초록슬라임3종을 원본 보존 alpha 처리와 authored 경로로 교체했다(`scripts/art_sources/monsters/v6/source-review.md`). 다른251종 bytes 보존, actual46px 전투/32px 양배경검수, focused36/36 및 verify4373/4373 PASS. 이는 S3의 일부 완료이며 남은 일반 몬스터·character alpha·map cell 결함과 최종 통합/mobile gate를 대체하지 않는다.

- 기본 방향: 기존 캐릭터와 어울리는 투명 배경 pixel-fantasy, 작은 화면에서 먼저 읽히는 몸체/무기 실루엣, 지역·속성을 보조하는 색. Boss는 왕관만 얹은 일반 몬스터가 아니라 체격·자세·주요 형태로 구분한다.
- 이름별 형태를 먼저 정한다. 눈보라 정령은 눈/얼음의 소용돌이형, 머맨은 지느러미·비늘을 가진 수중 humanoid, 스핑크스는 사자 몸체와 인간형 머리의 수호수다. 생태(body/species)와 역할(caster/warrior), 속성/지역은 서로 대체하지 않는다.
- 검수 순서: 확정 오류 3종 → boss 47종 → 지역별 일반 몬스터 → 캐릭터/장비/맵 조화. 한 batch는 8–16종으로 제한하여 이름 일치·몸체/역할·crop·32px 식별성을 실제 이미지에서 확인한다. 미검수는 pending으로 남기고 unique hash를 승인으로 사용하지 않는다.
- 원화 생성/편집이 필요한 경우 사용 가능한 image-generation 경로를 사용하되 외부 유료 API를 새로 연결하지 않는다. 기존 승인 원본은 보존하며, 색 변경과 임의 장식만으로 다른 생물을 제작했다고 주장하지 않는다.
- [x] character/map/monster/equipment를 원본 크기와 실제 사용 크기로 분류 검수
  - [x] boss47 의미 inventory 1차 감사: authored4종은 해당 배치 검수, 나머지43종은 Sol xhigh 실제 PNG/production brief 대조. Required11 / semantic-match26 / contextual6으로 exact partition과 SHA를 `docs/evidence/art/monster-boss-semantic-review-20260907.md`에 기록했다. Semantic-match는 이름/역할의 명확한 모순이 없다는 뜻이며, 고유 silhouette·최종 polish·device acceptance 완료가 아니다.
- [x] monster의 정확한 이름별 형태 예외를 목록화; 눈(snow/eye) 등 substring 오분류 방지
  - 2026-09-07 cave/snow 일반12종: Important9/contextual3, exact preimage와 교정 기준은 `docs/evidence/art/monster-cave-snow-review-20260907.md`. 이로써 일반3개감사에서 확정미해결17종이며, source후보 준비를 runtime해결로 세지 않는다.
  - 2026-09-07 mine/lake/highland 신규8종 원본감사: Important5, contextual2, 원본모순미발견1. 이미authored4종은 중복검수에서제외. Exact preimages 및 교정계약은 `docs/evidence/art/monster-mine-lake-highland-review-20260907.md`. 기존초반3종과 함께 교정 후 실제크기/전투 검수 필요.
  - 2026-09-07 초반 일반17종(8+9 batch) 원본 의미 감사: 고블린/초록슬라임/코볼트 Important3 교정 필요. 다른14종의 작은 화면 및 전체 최종 승인은 미완료. Exact preimage와 교정 계약은 `docs/evidence/art/monster-early-general-review-20260907.md`; runtime 변경 없음.
- [x] ART-01 사례부터 실제 형태가 맞는 시각 자산 보완, base 재사용/새 원화/검수 완료 상태 분리
  - [x] 첫 3종 눈보라 정령/머맨/스핑크스: built-in 원화 3개와 이전 runtime 3개 보존, 160px export와 exact name/path/SHA pin, generator byte-copy 경로, TDD RED2→GREEN9 및 독립 C0/I0. 251종 기타 metadata/bytes 불변을 적용 전에 검사했다. 원화/32px/160px/390×844 전투 portrait 직접 확인. 전체 S3 승인으로 확대하지 않는다.
  - [x] 후속8종 원화·production 연결·focused/직접 검수(2026-09-07): `scripts/art_sources/monsters/v2/`에 masters/exports/previous/prompts/provenance/preimage 보존. 네 이름의 coarse archetype만 교정, RED2→GREEN10 및 related40/40, 독립 Sol xhigh10/10·C0/I0. 나머지246 metadata/bytes 불변. 160/32/46px 비교와 settled390×844 전투8장 검수, final clean run errors0/overflow0. 전체 gate·native는 아래 진행 상태와 구분한다.
  - [x] 후속8종 full/native closeout: 최초 stale progression seal 실패를 보존하고 source evidence write→verify `b518d71d…21f167`, report/v1 불변을 확인했다. 최종 session51684 exit0(unit4360/4360, smoke desktop/mobile, E2E59/59+57/57). Art548 exports·equipment/event/mobile doctor·Toss web80719937bytes<80MiB·cap sync·Android debug·iOS unsigned build PASS. 실제 APK/App의 JS `index-B9BRPLKS.js` SHA `659c2cf6…e10cdf` 및 교정 PNG11개가 dist와 일치; native tracked drift0. App `/tmp/aetheria-body8-ios.LRAn0R/Build/Products/Release-iphoneos/App.app`. provenance 초기 오류 출력을 교정하고 JSON/8개 해시를 검증했다. 실기기 설치·전체 S3 완료와는 구분한다.
- [x] 1H/2H, shield/focus, 세트 장비 슬롯의 실루엣·색·crop와 직업 초상을 장비 화면에서 확인. 현재 canonical 초상은 직업 고정이며 착용 합성을 하지 않는다. Overlay는 이미지 실패 fallback 경로로 별도 검수하고 정상 착용 합성 완료로 주장하지 않는다.
  - [x] 09-08 대표5종1H/2H/shield/focus/robe의실제primary실패→fallback15크기검수14789 PASS. `equipment-fallback-review-20260908.md`에작은크기/previewcrop한계구분. 모든229조합검수는아님.
- [x] catalog completeness, safe path, alpha/크기/digest, 실제 화면 clipping/contrast/touch targets 검증

모든 monster가 고유 PNG라는 사실을 수작업 원화나 의미 검수 완료로 표현하지 않는다. 새 자산은 기존 그림을 보존한 상태에서 만든다. 외부 유료 API/구독 구매는 하지 않는다.

S3 준비 감사에서 추가된 우선 body 목록(2026-09-05):

| 대상 | 교정할 몸체 | 검수 상태 |
| --- | --- | --- |
| 스노우 울프 | 눈밭의 네발 늑대 | 교정·시각·full/native 검증 완료 |
| 살아있는 마법서 | 표지·책장이 몸체인 마법서 | 교정·시각·full/native 검증 완료 |
| 미믹 | 입·이빨이 있는 상자형 괴물 | 교정·시각·full/native 검증 완료 |
| 프로토타입 제로 | 관절·동력부가 있는 기계 병기 | 교정·시각·full/native 검증 완료 |
| 천둥새 제피로스 | 부리·깃털 중심 천둥새 | 교정·시각·full/native 검증 완료 |
| 아누비스 수호자 | 자칼 머리 수호자 | 교정·시각·full/native 검증 완료 |
| 성스러운 물고기 | 지느러미·꼬리가 분명한 물고기 | 교정·시각·full/native 검증 완료 |
| 거대 거북 | 등껍질 중심 거북 | 교정·시각·full/native 검증 완료 |
| 마력 결정체 | 부유하는 결정·광물체 | 09-07 owner PNG 검수: 고블린 몸체 오류 확정, 교정 대기 |
| 거대 지렁이 | 다리 없는 길고 분절된 몸체 | 09-07 owner PNG 검수: 여러 거미 몸체 오류 확정, 교정 대기 |
| 고원 그리핀 | 독수리 머리·날개와 사자 몸체 | 09-07 owner PNG 검수: 붉은 드래곤 몸체 오류 확정, 교정 대기 |

분류명이 맞아도 실제 선택된 prototype이 틀릴 수 있다. `avian→dragon`, `aquatic→spirit`를 단순 enum 수정만으로 해결했다고 기록하지 않는다. 이 목록은 제한 감사 결과이며 나머지 이미지의 품질 승인이 아니다.

09-07 후속 boss 의미 감사: authored boss4종을 제외한43종 중12종을 Sol xhigh가 실제 PNG로 검사했다. Owner도 아래 우선6종의 PNG를 확인했다. 다음 교정 배치는 이6종과 위 일반3종을 합친9종이며, 현재 body8 full/native closeout 이후 실행한다.

| 보스 | 현재 확인된 문제 | 다음 원화의 최소 형태 계약 |
| --- | --- | --- |
| 심연의 크라켄 | 왕관 장식의 불꽃 도마뱀; 두족류 몸체 없음 | 커다란 두족류 머리·여러 굵은 촉수, 육상 도마뱀/불꽃 배제 |
| 묘지기 네크론 | 단검을 든 인간 도적; 망자 소환 역할 없음 | 묘지기/necromancer의 의복과 소환 도구, 단검 도적과 구분 |
| 혈월의 뱀파이어 로드 | 웅크린 부패 구울; 귀족 vampire 역할 없음 | 직립 vampire lord, 망토·귀족 복식·송곳니와 절제한 혈월색 |
| 기계 장군 | 해골 얼굴·해진 유령 기사 | 관절/기계 동력부/지휘관 장갑; 해골/유령 몸체 배제 |
| 빙결의 마녀 | 주황 불꽃의 화염 군주 | 얼음 마법을 쓰는 witch, 냉기색·명확한 의복/마법 도구 |
| 아이스 드래곤 | 붉은 용과 불붙은 꼬리 | 용 몸체 유지, 얼음 비늘/능선·냉기색; 불꽃 꼬리 배제 |

기존 generator는 `weakness || resistance`를 accent 출처로 사용하므로 화염 약점인 냉기 몬스터의 색도 역전될 수 있다. 이번8종은 authored byte-copy로 이 변형을 우회했다. 이 관찰만으로 나머지243종을 일괄 재색칠하거나 구현 완료로 판단하지 않는다. 후속31종도 읽기 전용 감사를 완료했다. 추가 Required5는 서리 군주/원시의 신/차원 파쇄자/차원 포식자/타락한 세계수 수호자이며, 이전 Required6 이후 교정한다. 총43종의 판정·이름·runtime path·SHA 및 contextual6의 판단 이유는 위 boss inventory에 보존했다.

### S4 — 증빙과 모바일 실행 검사

Required5 원화 진행: v4 source-only 배치 시작.4후보 파일/160px alpha·margin은 확인했으나 서리 군주 왕관 framing과 원시의 신 clipped/opaque 실패를 해결해야 한다. 후보 파일 존재를5종 교정 완료로 세지 않으며 아직 runtime 변경 없음.

후속9종 최종 closeout(09-07): focused40/40, owner32/46/160 및 실제390×8449장, 독립C0I0, full4360·E2E59+57, art/content/equipment/event/budget, cap sync 및 Androiddebug/iOSunsigned 모두 PASS. 실제 패키지 mainJS+교정20PNG가 dist와 일치. v3/native-checkpoint.json 참조. 아래 중간 진행표시는 역사 기록이며9종은 완료; 남은 Required5/contextual6/전체S3/S5/S6/device는 미완료다.

09-07 후속9종 추가 검증: 실제390×844 전투 이미지9장 owner 확인, console error0, Sol xhigh 독립 C0/I0(문서 과거/현재 구분 수정 포함). Diagnostic write/verify와 report/v1 불변 확인 완료. Full28312 진행 중이며 이9종의 native build/device 전달은 아직 미완료다.

S3 후속9종 진행(09-07): 위 보스6종과 결정체/지렁이/그리핀의 개별 원화·이전PNG를 `scripts/art_sources/monsters/v3/`에 보존했다. 원본/160/46/32px owner 검수·alpha/margin 검증 후 runtime 연결, RED2→related40/40 PASS. 정확히9 entries/PNG 변경과 나머지245 불변 확인. Art/content PASS, progression evidence는 source seal 불일치로 갱신·결과 불변 비교 중이다. 독립/실제 전투/full/native 검증은 미완료이며 S3 전체 완료로 세지 않는다.

- [x] iOS smoke를 structured launch receipt의 exact PID/실행 경로로 고정
- [x] 다른 앱·PID 변경·missing/malformed receipt·lock/trust 실패의 TDD 검사
- [x] 과거 종료 원인 인과단정을 ledger에서 정정하고 원본 관찰 보존
- [x] S3a 현재 소스로 browser/Capacitor 및 Android debug/iOS unsigned 빌드: 기존 archive 보존, 새 app `/tmp/aetheria-art-ios-device.4xu6J8/Build/Products/Release-iphoneos/App.app`; 실제 APK/App 안 JS·교정 PNG3개와 web bytes 일치. 최종 S5 source/device 검증은 별도다.

### S5 — 플레이와 전체 회귀

- [x] fresh 390×844: 생성/출정/optional 선택/attack/skill/item/승리/장비 판단/귀환/저장 복원. 동일 save의 실제 상점 구매→한손 조합→모험가3/3→첫 자연 Lv2→슬라임 임무3/3→마을 명시적 보상→reload까지 `game-completion-fresh-v19-20260908.md`의 최신 두 절에 기록했다. 모든143개 임무·장기 자연 성장·첫 세션 소요 시간의 증거로 확대하지 않는다.
- [x] 중후반 대표 fixture: 전직·세트·보스 telegraph·퀘스트·endgame 접근. `game-completion-midlate-direct-20260908.md`에 현재 E2E/실제 화면·명시적 New Game+/저장/reload와 통제 범위를 기록했다. Seeded/1HP 보스 fixture이며 자연 성장·난이도 승리를 주장하지 않는다.
- [ ] offline/quota, full inventory, restart cancel/confirm, background/foreground를 직접 재검사
  - [ ] 09-08 headed browser 실제탭전환3시도에서hidden 미관측. `game-completion-lifecycle-observation-20260908.md`에 실패보존; bridge8/8은synthetic계약만증명. 실제visibility전환을관측할수있는기기/브라우저에서재검사필요.
  - [x] 09-08 quota소진 actualbrowser service(mockfalse) fallback/선택지3/저장불변/외부요청0 확인 및 focused18/18. `game-completion-quota-browser-20260908.md`; 게임화면/실서버동기화가아닌 service경계검증.
  - [x] 09-08 가방20/20 상태의 실제공격→전리품3개차단안내→가방보존/idle 복귀,390×844검수30827 PASS. `game-completion-capacity-direct-20260908.md`에seededfixture와migration비교한계구분.
  - [x] 09-08 isolated390×844 offline 탐험/귀환/저장 및 online reload, restart취소/확정·rank/essence보존 직접검증. `game-completion-offline-reset-direct-20260908.md` 참조. 나머지경로는미완료이며coldoffline/Firebase복원으로확대하지않는다.
  - S3 복원에서 실제 공격 없이 `-53` 피격 피드백 관찰. 원인은 BootScreen보다 먼저 mount한 `useDamageFlash`가 LOAD_DATA의 HP 교체를 피해로 판정한 것이다. 비저장 `presentationEpoch`를 LOAD_DATA마다 증가시키고 engine→App→hook으로 전달하여 baseline/flash/amount/기존 timer를 초기화했다. Render 단계에서도 이전 epoch 연출을 숨긴다. 초기150→97, ready→ready, 같은 snapshot 반복, 연출 중 복원, 이후 실제 피해·회복은 RED→GREEN 및 focused57/57로 확인했다. 2026-09-07 직접 390×844에서 복원 HP97/피해 표시 없음과 실제 공격 후 HP82/피해15를 확인했고 width/scroll390/390, epoch 저장 없음이다. 증빙은 `output/playwright/completion-20260907/feedback-{restored,real-damage}-390x844.png`; 실제 공격 결과 캡처는 연출 종료 후이며 transient -15는 DOM observer로 확인했다. 새 savedAt 저장을 기다리는 E2E도 현재 full gate에서 PASS; full/native 종료는 아직 별도 확인 중이다. 이 fixture 검증을 전체 fresh 성장·cloud/device 복원 증거로 확대하지 않는다. 별도 잘못 입력한 fixture 지역 `호수 신전` 오류와 canonical `호수의 신전` clean rerun은 구분하여 기록했다.
- [x] 최신 V27 `npm run verify:full`15775 exit0(unit4505/E2E118/양쪽smoke/type/lint/build), art/content/doctor/equipment power/economy/event/pacing PASS. `scripts/art_sources/monsters/v27/adoption-review.md`에 초기 실패·교정과 report/v1 불변을 기록했다. 이전 gate 증거는 각 checkpoint에 보존한다. 후속 production 변경 시 재검증한다.
- [x] 최신 V27 cap sync 완료 로그, Androiddebug4246/iOSunsigned68038 exit0, tracked drift0/package884선택경로 일치. `output/v27-native-20260910.json` 및 v27 검증 문서의 artifact/SHA를 따른다. 이전 iOS 산출물은 보존하며 설치·서명검증은 별도다.
- [ ] iPhone 설치 상태와 exact PID survival 확인 후 화면으로 foreground/디자인 확인
  - 09-08 기존 설치본 PID survival 증빙은 `game-completion-installed-ios-survival-20260908.md`. 09-09 CUA에서 실제 미러링 연결을 확인했으나 사용자 조작과 겹쳐 중단했다. 테스트 시간을 조율한 뒤 설치본 식별·foreground/lifecycle을 확인한다. 최신 Kingdom 설치 증거는 없고 이전3회 Playwright hidden 미관측을 PASS로 바꾸지 않는다. 상세 `game-completion-lifecycle-observation-20260908.md`.

S5 restore feedback 하위 수정 검증 완료(2026-09-07): `verify:full` exit0, unit4359/4359, smoke desktop/mobile, E2E59/59+57/57; focused57/57 및 독립 C0/I0. Art/content/equipment/event/progression·mobile doctor·cap sync PASS. Android debug와 iOS unsigned build exit0, 실제 APK/App의 JS `assets/index-DYrguYkB.js` SHA `1d9d64623cc3c703ab581840751aeff47ac0fcd7c9690192a040b8c5475e4de2` 및 교정 PNG3개가 웹과 동일하다. Native tracked drift0, historical candidate/Toss aggregate 불변. 이 결과는 위 설명의 당시 full/native 대기 상태를 대체하며, 전체 S5와 기기 설치 완료를 의미하지 않는다. 다음은 S3 body8종 교정이다.

기기 잠금/인증이 필요하면 우회하지 않고 그 gate만 미완료로 기록한다. local 검증을 먼저 끝내며 사용자에게 같은 인증을 반복 요청하는 작업으로 게임 개발을 대체하지 않는다.

### S6 — 최종 감사와 handoff

현재 감사 경계(2026-09-10): V27 exact69와 유지20까지 local visual/implementation 독립감사 C0/I0, full/native 완료. 아래 진행중 단락은 역사 기록이다. 전체 요구별 최종 source/evidence 재감사 진행 중이며 실제 iPhone 설치본 식별·화면·background/foreground/저장 보존은 아직 증명되지 않았다.

2026-09-10 V27 actual39089 UI 완료: owner89 portraits/first-last fullscreens,89 HP감소·errors0·overflowfalse, exact screenshot hashes receipt. Readonly57977 PASS·Sol 구현C0I0. Full15775 unit4505/4505·첫E2E59 PASS/두번째 묶음 진행 중. UI 독립감사·native·device/lifecycle/S6 미완료. 상세 v27/adoption-review.md 최신절.

2026-09-10 V27 latest verification: initialunit4498/4505 실패 원인 보존(역사경로6·writer와겹친readonly1), 경로보완후focused29 PASS. Writer59500 종료/report·v1불변/source330 중manifest1변경. Readonly57977·finalfull15775 진행 중, art/content/doctor19511 PASS. 실제39089/native/최종감사 미완료; 재개는 v27/adoption-review.md 최신절을 따른다.

2026-09-10 V27 exact69 runtime 채택: new adoption RED2→GREEN3, other185/기존165/수치/protected44 보존 및 역사 fixture 연결 후 focused27 PASS. Unit94252·diagnostic writer59500 진행 중, Sol 구현감사/read-only/full/browser89/native는 미완료. 상세 `v27/adoption-review.md`. Static69 수용에서 실제 runtime 검증으로 넘어간 상태이며 전체 Goal/device/lifecycle/S6 미완료.

2026-09-10 V27 group7 완료: named-presence6 원화7/선택6/거부1 보존, 사도 dark32 교정 후 owner/Sol C0/I0. 최종7군 integration21 PASS와 exact69 unique 승인 이름/source/export 해시 PASS. 누적69/69 정적 후보 수용이며 runtime 미채택, 전체게임 완료 아님. 다음 exact69 채택/other185 보존→역사 fixture 연결→source freeze/diagnostic write·readonly→통합 full/art/content/doctor/browser89/native/독립감사. Runtime/보호증빙/retained26 native 불변, device/lifecycle/S6는 열린 상태다.

2026-09-10 V27 group6 완료: dimensional-form16 원화17/선택16/거부1 보존, 사령관 source 상단 잘림 교정 후 owner/Sol C0/I0. TDD RED3→GREEN3/integration18 PASS, 누적6군63 unique 승인 이름/source/export 해시 PASS. 누적63/69 후보 수용, 잔여 named-presence6 미제작. Runtime/보호증빙/native 불변. 전체69 안정 후 exact69 채택→통합 full/browser89/native와 device/lifecycle/S6를 진행한다. 전체 Goal 미완료.

2026-09-10 V27 group5 완료: caster-role7 원화8/선택7/거부1 보존, 사기꾼 dark32 하반신 교정 후 owner/Sol C0/I0. TDD RED3→GREEN3/integration15 PASS, 누적5군47 unique 승인 이름·source/export 해시 PASS. 누적47/69 후보 수용, 잔여22 미제작; 다음 차원·붕괴16. Runtime/보호증빙/native 불변. 전체69 채택 후 통합 full/browser89/native 및 device/lifecycle/S6 완료 여부를 따로 판정한다.

2026-09-10 V27 group4 완료: knight-form11 원화14/선택11/거부3 보존, 데스나이트 명암·용사 파손검 교정 후 owner/Sol C0/I0. TDD RED3→GREEN3/integration12 PASS, other9/기존runtime69/protected44 불변. 누적40/69 후보 수용, 잔여29 제작 전. 다음 승인된 마법사·의식7; 전체69 안정 후 통합 채택·full/browser89/native와 실제 device/lifecycle/S6를 마친다. 아직 전체 게임 완료가 아니며 최신 native는 retained26이다.

2026-09-09 V27 group3 완료: guard-duty12 원화/후보 보존, owner/Sol C0/I0, TDD RED3→GREEN3/integration9 PASS. 누적29/69 후보 수용, 잔여40 미제작. 다음 승인된 기사·무장11; 전체69 안정→runtime 채택→통합 full/browser89/native 순서를 유지한다. Runtime/기존 증빙/retained26 native 불변, 전체 Goal/device/lifecycle/S6는 열린 상태다.

2026-09-09 V27 group2 완료: occupation11 원화12/선택11/어부거부1 보존, 어부 dark32 교정 후 owner/Sol C0/I0, TDD RED3→GREEN3/integration6 PASS. 누적17/69 후보 검수 완료, 잔여52 제작 전이며 runtime 채택 전이다. 다음은 승인된 경비·수호12; 전체69 안정 후 통합 full/browser89/native와 S6를 수행한다. 최신 실제 native 산출물은 retained26 그대로다.

2026-09-09 새69 설계 승인 수신: 기존 Goal active로 재개했다. V27 preflight current89/diagnostic330/prototype/protected6+38 PASS, exact69 PNG+3 snapshots 보존. 첫 석재6 원화/160 export/32·46 color 및 grayscale owner/Sol C0/I0, TDD RED3→GREEN3/기존10 integration6 PASS. Runtime 채택 전, 다음은 직업·도구11이다. 전체69 후보 안정→exact69 채택→source freeze/full/89 browser/native/S6 순서로 진행한다. 이전 승인 대기 blocked는 아래 역사 기록이다.

2026-09-09 현재 재개 경계: retained26 및 unchanged20 검수 완료 후 새69 시각 설계 승인을 기다린다. 세 연속 Goal 턴 동안 승인 경계가 유지되어 Goal은 blocked로 전환하며 objective는 유지한다. 추가 안전 검수는 완료했다. 기기 목록 available/paired와 달리 exact freshqa 앱 정보 조회68347은 exit1(CoreDevice4000, connection reset by peer)이므로 현재 설치본 확인도 미완료다. 앱 조작·설치·재시도 없음. 아래 전체 감사 완료 조건은 그대로 유지한다.

- [ ] 최신 보완까지 independent review의 Critical/Important 0 및 알려진 결함 회귀 테스트. Story/quality23/topology/regional24/normal-loot/library/elemental25/retained26/V27 각 scoped 완료 증거는 관련 QA·task ledger에 보존한다. V27 포함89 수용과 full/native는 완료했으며 전체 요구별 재감사 및 실제 device/lifecycle은 열린 상태이므로 전체 감사 완료로 표시하지 않는다.
- [ ] 이 문서와 `tasks/todo.md`, `progress.md`, 관련 specification/evidence가 최신 source와 일치
- [ ] 기능 완료/시각 검수/설치/실기기/공개 상태를 분리한 최종 결과와 재현 명령 제공
- [ ] 해당 조건을 실제 충족한 뒤 native Goal 완료; 외부 gate는 별도 승인/후속 작업으로 명시

## 6. 검증 운영

세트 focused: `node --import tsx --test tests/signature-set-reachability.test.js tests/signature-set-two-hand.test.js tests/equipment-transaction-authority.test.js tests/signature-set-bonus.test.js tests/equipment-disclosure.test.js tests/equipment-utils.test.js`.

iOS script focused: `node --import tsx --test tests/ios-device-smoke-guidance.test.js` 및 `bash -n scripts/ios-device-smoke.sh`.

Full: `npm run verify:full`. 이 명령이 type-check/lint/unit/build와 preview desktop/mobile smoke/E2E를 포함하므로 같은 변경에서 개별 gate를 불필요하게 반복하지 않는다. 별도로 art/content/pacing/event/equipment/progression manifest에 영향을 준 항목만 deterministic refresh 후 verify한다. 기존 historical candidate/Toss evidence는 갱신하지 않는다.

최종 `git diff --check`, changed path review, Android/iOS tracked drift, 직접 본 화면과 로그를 기록한다. Hash가 바뀌면 원인이 source manifest인지 gameplay report인지 구분한다. 테스트가 틀린 production 동작을 기대하면 assertion을 약화하지 말고 계약과 재현을 먼저 정정한다.

## 7. 진행 기록

- 2026-09-05: Goal 활성화. 전체 영역 감사에서 위 6개 지적을 분리하고 S1 구현 시작. S4 iOS 검사 수정은 gameplay와 독립적인 exact-three-path subtask로 분리했다. 아직 게임 완성, 새 원화 완성, iPhone 안정성 완료를 주장하지 않는다.
- 2026-09-05 S1: RED 2/2 → focused GREEN 70/70. 독립 감사 Critical/Important 0 (S1 한정). 직접 390×844 `celestial-set-390x844.png`에서 2세트 완료·3세트 약속 없음·가로 overflow 없음·console error 0 확인. QA snapshot은 기존 production save와 분리했다. 추가 UI 결함 3건은 S1b에서 먼저 닫는다.
- 2026-09-05 S4: 기존 generic-process false PASS를 RED 27건 및 stale metadata 1건으로 재현, JSON receipt 검증 GREEN 35/35, shell syntax·diff check PASS. 실제 device probe는 unavailable여서 수정된 script의 실기기 PASS를 주장하지 않는다.
- 2026-09-05 evidence: equipment combat-power `8c40aa98b6dbf638d1911c97d0a31c1dfa4e4f661c7ce277ae7f0706468e9c64`, progression diagnostic `b98507c379e3b481c162d00f69465ed157251dbd328767788c5e569577080c34` write→verify PASS. 두 reportHash와 v1 baseline은 변경 전과 동일; source seal만 변경.
- 2026-09-05 현재 수정분 full gate PASS: unit 4292/4292, type-check/lint/build, desktop/mobile smoke, E2E 59/59 + 56/56. Desktop smoke 종료 시 알려진 비차단 `browser.close timeout` 1건을 별도 기록. Art/content verify, mobile doctor, cap sync PASS; Android/iOS tracked drift 0. Android debug와 iOS unsigned generic-device build 성공. APK `221991742` bytes / SHA-256 `27606bd17c65e2413a518e218af87b58f86fad6c3fade3439f56e0ef772f31c2`; 두 native output의 `assets/index-D153aeLF.js`가 web SHA-256 `926db8f35de8bd6d27da6f5051605c43fd314be1291cd8071e7bf85201e57eec`와 일치했다. 재설치·실기기 hold는 수행하지 않았으며 기존 named archive와 save를 보존했다.
- 다음 실행: S1b → S2 → S3 → 전체 S5/S6. 현재의 command-level PASS가 남은 의미/기능 결함을 해소하지는 않는다. 새 변경 이후 full gate/evidence는 다시 해당 source에 묶는다. Goal은 active이며 commit/push/publish 없음.
- 2026-09-05 S1b 완료: 초기 RED 8건과 추가 추천 CTA RED를 수정해 focused 87/87, SSR surface 및 390×844 실제 장비·가방·제작 검증 PASS. 독립 감사 Critical/Important 0. Full gate 중 잘못된 Lv2→Tier2 착용 기대값을 발견해 E2E를 실제 제한/제작 권한 계약으로 강화했으며, focused E2E 2/2와 독립 재검토 후 전체를 다시 실행했다. 최종 `npm run verify:full` exit 0(unit 4303, smoke desktop/mobile, E2E 59+56); 비차단 desktop close timeout 1건. Art/content, mobile doctor/cap sync PASS, Android/iOS tracked drift 0. Equipment SHA `36cc7263b3b2a1cd964b9adf34901a6e77664f0d336467be8831f2f43854fcbe`, progression SHA `06c36b4130be4760e031b8240d15ad25b390d5b9437e3b402aaa8a377c26f1ad`; 두 reportHash와 v1 baseline 불변, 321 source drift 0. 아직 새 native archive/실기기 설치는 수행하지 않았다. 다음 구현은 이 문서의 S2 lifetime 계약이며 S3 body 교정 후보도 별도로 기록했다.
