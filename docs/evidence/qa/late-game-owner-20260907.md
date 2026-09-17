# 중후반 경로와 화면 검수 — 2026-09-07

## 실행 범위

`npx playwright test tests/e2e/true-ending-new-game-plus.spec.ts tests/e2e/ascension-journey-design.spec.ts tests/e2e/content-pacing-encounters.spec.ts tests/e2e/quest-reward.spec.ts`

19/19 PASS, 1.7분, handle94967exit0. 로그 `/tmp/aetheria-late-game-0907.log`. 현재 checkout의 검증 bundle을 사용했다. 통제 fixture와 deterministic combat seed, 진 보스 HP 약화 helper를 포함한다. 실제 레벨1부터 엔딩까지 플레이한 증거나 난이도/성장 속도 검증이 아니다.

- 계승: 보존/초기화 대상과 영구 성장 표시, 취소 시 상태 유지, 확정 시 새 여정 시작.
- 지역 encounter: 375/390/430px, signature 발견·보스 기록·canonical 장비 build 조건, 선택 비용과 receipt 정산.
- 임무: 보상 수령, 추천·중복 입력, 포기 취소/확정, 게시판·목적지 출발.
- 진엔딩: 마왕→진 보스→엔딩→New Game+, 저장/reload, 중복 확정, 직업 여정·설정 보존, production save sentinel 불변. Platform back은 test bridge이며 물리 기기 back 증거가 아니다.

## Owner 화면 확인과 검증 보강

직접 열어 확인한 캡처:

- `playtest-artifacts/long-term-progression-audit/ascension-journey-390x844.png`: 보존/초기화 및 계승 취소/확정 버튼.
- `test-results/content-pacing-encounters--45c43-remains-readable-at-390x844-chromium-mobile/content-depth-signature-390x844.png`: 두 선택의 MP10/HP8 trade-off.
- `test-results/content-pacing-encounters--1bfc8-remains-readable-at-390x844-chromium-mobile/content-depth-boss-history-390x844.png`: 보스 기록에 따른 수로 사건. 지역 그림 우측 stray border는 기존 map crop 결함이며 해결되지 않았다.
- `test-results/content-pacing-encounters--249cb-thout-persisting-build-tags-chromium-mobile/content-depth-build-forest-390x844.png`: 장비/유물 조건 사건의 비용/결과 안내.
- `playtest-artifacts/mobile-quest-expedition/quest-board-compact.png`: 추천3개, 목적지/보상/잠금 조건.
- `playtest-artifacts/long-term-progression-audit/true-ending-new-game-plus-390x844.png`: 최종 재검사에서 마을 원정 준비/임무/휴식/이동 표시 확인.

`test-results`는 다음 Playwright 실행으로 교체되는 임시 산출물이다. 위 사건3개는 최초19개 실행 시 직접 확인한 기록이며 영구 release evidence로 seal하지 않았다.

최초 New Game+ 캡처는 HUD만 나타났다. 상태가 idle이어도 화면 애니메이션은 준비되지 않았다. 추가 대기에서 처음 지정한 `control-expedition-start`는 이 fixture에 없는 초반 전용 primary action이었다. 실패로그 `/tmp/aetheria-newgame-ready-0907.log`(1FAIL/2PASS)는 보존한다. 실제 이 상태는 임무 고르기/이동이므로 `원정 준비` region과 이동 버튼을 대상으로 교정했다.

교정 후에도 screenshot만 공백이어서 ancestor opacity를 조사했다. Region은 viewport 안(y547..729), 상위 플레이 영역 opacity0.421365, scrollY0이었다. `/tmp/aetheria-newgame-layout-0907.log` 참조. 최종 테스트는 모든 상위 opacity1, region viewport 진입, 이동 enabled를 기다린다. 해당 screenshot의 강제 animation disable도 제거했다. Gameplay 코드는 변경하지 않았다.

최종 `npx playwright test tests/e2e/true-ending-new-game-plus.spec.ts`: **3/3 PASS**,26.6초, handle87169exit0, `/tmp/aetheria-newgame-settled-0907.log`. Owner가 최신 New Game+ 캡처를 다시 열어 마을과 조작 버튼을 확인했다. 기존 state-only 검증보다 화면 준비 조건이 강화됐다.

## 남은 범위

### iPhone 연결 상태 재확인

`xcrun devicectl list devices --json-output /tmp/aetheria-device-readiness-0907.json` exit0. 등록 iPhone의 tunnelState는 `disconnected`, pairingState는 `paired`, developerModeStatus는 `enabled`다. iPad는 `unavailable`이다. 페어링/개발자 모드만으로 현재 연결이나 앱 실행을 증명하지 않는다. 설치·launch·signing·process stop 없이 목록만 읽었다. 현재 iPhone의 설치 버전, exact PID survival, foreground/OS background 검증은 기기 재연결 전까지 미완료다. 로그 `/tmp/aetheria-device-readiness-0907.log`; raw identifier를 문서에 복사하지 않았다.

### Full inventory 전투 직접 확인

후속 별도 `capacity-combat` profile `?e2e=1`에서 UI 신규 생성 후 `seedEnhanceScenario` 재료17개와 `seedCombatFocusScenario(false)`가 추가하는 전투 물약1개로 초기2개를 포함한 가방20/20을 만들었다. 정예 숲의 정령 HP134, 모험가 HP177/178. 기존 per-action seed100..109와 실제 공격 버튼10회로 승리했다. HP84, EXP14, gold200→218, 기존 inventory ID 배열 exact 동일/20개. UI에 “가방이 가득해 전리품 1개를 챙기지 못했습니다.”가 보이며 owner가 `output/playwright/completion-20260907/full-inventory-victory.png`390×844를 직접 확인했다. horizontal overflow0.

같은 profile의 재료를16개로 조정해19/20으로 만들었다. 이후 seed100대/200대 두 전투는 아이템이 나오지 않아19개 그대로였고, 이를 admitted 성공 증거로 세지 않는다. 다음 통제 전투는 매 공격 seed109, 공격8회 후 승리하고 하급 마나 물약1개가 실제 inventory에 추가돼19→20이 됐다. UI 전리품/성향 공명 문구와 owner 확인한 `one-slot-admitted.png`가 일치한다. 최종 HP114/EXP56/gold272. 중간 무드롭 캡처 `one-slot-victory.png`도 남아 있지만 성공 캡처가 아니다.

이 검수는 test fixture, 반복 전투 준비, seed 제어를 사용하며 자연 성장이나 드롭 분포 비교가 아니다. 같은 initial state의 엄밀한 A/B도 아니다(칭호/누적 전투 상태 차이). 실제 공격 UI와 production 정산의 full 차단/one-slot admission을 확인한 것이며, diagnostic API가 로그를 파싱하도록 변경하지 않았다. Boss signature/pity, DOT/전투 아이템, stale callback, full 상태 cloud 저장/복원은 이 화면 검수 범위 밖이다. Browser 및 preview47293 종료, production 파일·PNG·저장 데이터 변경 없음.

### Full inventory 상점 직접 확인

별도 `capacity-ui` browser profile의 `?e2e=1`에서 시작 버튼으로 생성 후 기존 `seedEnhanceScenario({gold:100000,materialCount:0,weaponEnhance:0})`로 예산만 포함한 통제 조건을 설정했다. 최초 가방2/20. 마을 시설→상점에서 하급 체력 물약 구매 버튼을18회 실제 클릭하여20/20, gold99460 확인. 구매 버튼 disabled=true, “가방 가득” 표시. Owner가 `output/playwright/completion-20260907/full-inventory-shop.png`390×844를 직접 확인했으며 horizontal overflow0이다.

판매 모드에서 첫 물약을 선택한 첫 클릭은 “한 번 더 누르면 판매됩니다” 확인 상태로만 전환했고 가방20/20을 유지했다. “정말 판매” 확정 뒤19개/gold99475, 구매 모드 복귀 시 구매enabled=true. 한 개 재구매 후20개/gold99445와 다시disabled=true 확인. 실제 돈·공유 저장·서버 데이터가 아닌 격리된 게임 테스트다. Browser와 owned preview1840 종료, 게임 코드 변경 없음. 이 결과는 full inventory 상점 제약/공간 재확보 경로이며 전투 victory overflow·capacity-safe 장비 교환·save restore의 모바일 검증을 대신하지 않는다.

마지막 정적 검증: `npx tsc --noEmit` 및 `npm run lint` PASS(handle70438exit0), `git diff --check` PASS, Android/iOS tracked drift0. 최신 native build나 archive는 이번에 생성하지 않았다.

전직·보스 telegraph 전체, 자연 성장, full inventory, 실제 OS lifecycle, 최신 full/native와 이미지 교정은 별도 미완료다. 이번 결과로 S5 전체를 완료 처리하지 않는다. Historical candidate/Toss 산출물 갱신, commit/push/install/publish 없음.
