# Aetheria 경쟁작 원정·리텐션 흐름 개선 계획

Date: 2026-07-23
Scope: 첫 세션 연결 이후, 실기기 RC 검증과 병행할 다음 gameplay development 후보

## 결론

기존 경쟁작 계획의 `Map -> Combat -> Quest -> Equipment -> Encounter Art`와 후속 원정·귀환·가독성·아이템 투자 흐름은 Slice 53~66에서 구현됐다. 현재 Aetheria의 다음 checkpoint는 새 메뉴나 통화를 늘리는 것이 아니라, 최신 설치본이 실제 iPhone에서 첫 원정과 귀환 정비까지 자연스럽게 이어지는지 확정하는 것이다.

권장 순서는 다음과 같다.

1. 최신 Slice 66 설치본의 launch와 60초 foreground hold를 물리 iPhone에서 확정한다.
2. `첫 출발 -> 집중 임무 -> Map -> 전투 -> 정상 귀환` 5분 route를 실제 터치로 확인한다.
3. 귀환 정비에서 강화 decision의 취소·확정과 제작·합성 결과 비교가 흐름을 막지 않는지 기록한다.
4. 실제 사용자가 milestone 이야기를 다시 보고 싶어 하는 evidence가 있을 때만 Slice 67 Chronicle을 검토한다.
5. 난이도·EXP·Map 수치는 최신 실기기 체감에서 구체적인 문제가 재현될 때만 조정한다.

## 현재 코드 기준 진단

### 이미 유지할 것

- 첫 화면의 단일 primary action과 접힌 마을 시설
- 공간형 Map topology와 shortest-path mission marker
- 적 의도와 행동을 먼저 보여 주는 Combat focus
- Quest Board 3개 비교, 원정 준비, 귀환 기준
- 보스 접근 게이지, 스카우트 선택, 캠프파이어, 유물 3지선다
- 사망 Run Summary, 첫 사망 영구 보너스, 에테르 거울, 프레스티지
- 장비 summary/full disclosure와 양손무기 2피스 세트 규칙

### 확인된 구조적 격차

1. `bossGauge`는 지역 보스 접근만 기록하며 마을 출발부터 귀환까지의 원정 시작값·획득량·소모량·완료 이유는 저장하지 않는다.
2. `RunSummaryCard`는 사망한 전체 run만 정리한다. 정상 귀환은 이동과 임시 상태 정리로 끝나 전리품과 성장을 체감할 회수 순간이 없다.
3. 활성 임무는 제한 없이 누적될 수 있고 tracker는 그중 하나를 점수로 선택한다. 플레이어가 이번 출발의 임무 묶음을 직접 확정하는 단계는 없다.
4. 마을은 다음 주 행동을 잘 추천하지만, 귀환 직후 무엇이 달라졌고 그 결과 어떤 시설을 써야 하는지는 하나의 흐름으로 연결되지 않는다.
5. 첫 사망은 수치 보너스와 종료 분석을 제공하지만, 반복 플레이의 서사가 마을 변화로 이어지는 빈도는 낮다.

## 추가 디자인·플랫폼 감사

2026-07-23에 공개 GitHub와 공식 자료를 다시 비교한 결과, 다음 feature보다 먼저 처리할 가독성 부채가 확인됐다.

- [Shattered Pixel Dungeon GitHub](https://github.com/00-Evan/shattered-pixel-dungeon)는 `ui`, `windows`, `scenes`를 분리하고 화면 크기에 따라 journal·window·toolbar 배치를 달리한다. 공식 소개도 large/small screen용 interface mode를 명시한다.
- Shattered의 [Journal Overhaul](https://shatteredpixel.com/blog/coming-soon-to-shattered-a-journal-overhaul.html)은 비슷한 모양의 긴 list가 한눈에 읽히지 않는 문제를 compact visual grid와 선택 후 detail로 바꿨다. Aetheria도 한 화면에 모든 설명을 축소해 넣기보다 `요약 -> 선택 -> 상세` 순서를 써야 한다.
- [Apple Typography HIG](https://developer.apple.com/design/human-interface-guidelines/typography)는 iOS 기본 17pt, 최소 11pt를 권고하고 game text를 실제 platform마다 검증하라고 안내한다. 현재 `aether-label`은 10px이고 `ControlPanel`, `MapNavigator`, `QuestBoardPanel`, `CombatPanel`, `ExpeditionDebriefCard`에 명시적인 8~10px class가 56곳 남아 있다.
- [Apple Designing for Games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games/)는 자주 쓰는 iOS control 44x44pt, 보조 control 최소 28x28pt와 화면 비율별 adaptive menu를 권고한다. [WCAG 2.2 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)의 web 최소 기준은 24x24 CSS px다.
- 현재 `high readability`는 대비와 장식을 조절하지만 typography 크기는 바꾸지 않는다. 이름과 실제 동작이 어긋나므로 전체 색상을 다시 칠하는 것보다 semantic type scale과 responsive density를 먼저 정착시켜야 한다.

## 경쟁작에서 가져올 원칙

| 레퍼런스 | 확인한 구조 | Aetheria 적용 판단 |
|---|---|---|
| [Shattered Pixel Dungeon GitHub](https://github.com/00-Evan/shattered-pixel-dungeon) | Android·iOS·Desktop을 지원하며 무작위 레벨, 적, 수백 개 아이템을 한 run 안에서 운용한다. | `KEEP`: 모바일 정보 밀도와 아이템 깊이는 유지한다. 코드·asset은 복제하지 않는다. |
| [Buriedbornes2 Contracts](https://sites.google.com/view/bb2-help-en/world-map/start-adventure/contracts) | 모험 시작 시 최대 5개 contract를 선택해 해당 모험의 제작 선택을 바꾼다. | `ADAPT`: 수락 임무를 hard cap하지 않고 이번 원정 집중 임무를 3개 이하로 고정한다. |
| [Loop Hero](https://store.steampowered.com/app/1282730/Loop_Hero/) | 출발 전 class/deck을 고르고, 원정 중 loot을 얻고, 회수한 자원으로 camp를 강화한다. | `ADAPT`: 출발·원정·귀환·재투자의 경계를 명확히 하되 새 camp economy는 만들지 않는다. |
| [Moonlighter](https://store.steampowered.com/app/606150/Moonlighter/) | dungeon loot을 제한된 가방으로 회수한 뒤 마을의 판매·제작·강화로 변환한다. | `ADAPT`: 귀환 정산에서 획득 장비와 기존 상점·제작·장비 action을 직접 연결한다. |
| [Darkest Dungeon Expeditions](https://darkestdungeon.wiki.gg/wiki/Expeditions) | 원정 전 목표와 준비를 확정하고, 더 탐험할 보상과 철수 위험을 계속 비교한다. | `ADAPT`: HP·가방·임무 완료를 실제 귀환 판단으로 만들고 정상 철수도 성취로 표현한다. |
| [Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/) | run마다 조합과 도전이 달라지고, 실패 뒤에도 영구 성장과 캐릭터 이야기가 이어진다. | `ADAPT`: 첫 사망·첫 보스 같은 milestone 귀환에만 deterministic story beat를 추가한다. |

## 제품 결정

### KEEP

- 현재 성장 곡선과 Slice 52의 `Lv1 -> Lv1 -> Lv2 -> early Lv3` 계약
- 모든 기존 퀘스트 진행, 전리품, 장비, 지도, 프레스티지 데이터
- 자유 이동과 언제든 안전지대로 돌아갈 수 있는 구조
- single primary action, 44px 주요 action, safe-area 처리와 high-contrast palette
- browser smoke를 빠른 피드백으로, native 실기기를 release evidence로 쓰는 검증 경계

### ADAPT

- 정상 귀환도 하나의 성공적인 expedition outcome으로 기록한다.
- quest acceptance와 expedition focus를 분리한다.
- 귀환 화면은 숫자 나열보다 `이번 성과 -> 손실/위험 -> 다음 한 행동` 순서로 구성한다.
- 서사는 모든 귀환에 강제하지 않고 최초 milestone에서만 짧게 노출한다.
- 핵심 UI는 11px를 최소선으로 삼고 label/body/title semantic token을 사용한다.
- 좁은 화면에서 4열 micro-cell을 2x2 또는 요약 row로 바꾸고, 상세 정보는 선택 후 연다.
- `high readability`가 대비뿐 아니라 글자 크기와 line-height도 한 단계 높이도록 만든다.

### DEFER

- 마을 건물 업그레이드, 주민 roster, 상점 운영 simulation
- 새로운 통화나 별도 camp resource
- 대규모 NPC 대화 시스템과 생성형 AI 의존 서사
- 일일 접속 보상, streak loss, 강제 광고 같은 retention mechanic

### REJECT

- 경쟁작 코드, 문구, 이미지, 수치의 복제
- 기존 활성 퀘스트를 삭제하거나 hard cap해 구세이브 진행을 잃는 방식
- 모든 귀환마다 modal을 강제해 짧은 플레이를 느리게 만드는 방식
- 난이도를 숨겨서 낮추거나 초반 EXP를 다시 빠르게 만드는 보정
- 정보를 유지한다는 이유로 8~10px 글자와 4열 축약 cell을 핵심 동선에 남기는 방식

## 실행 계획

### Slice 61 - First Story Continuity

상태: 구현·browser/native 전달 완료, 최신 설치본 launch 및 수동 체감 확인 대기

- 새 run 시작과 동시에 `[스토리] 첫 번째 여정`을 0/1 상태로 배정한다.
- 첫 마을 화면은 Quest Board 재방문 없이 `고요한 숲으로 첫 출발`을 유지한다.
- 이미 활성 또는 완료한 세이브에는 중복 배정하지 않는다.
- 첫 숲 탐험이 실제 임무 진행으로 즉시 연결되는 E2E를 유지한다.

### Slice 62 - Expedition Ledger and Return Debrief

상태: 구현·browser/native 전달 완료, 최신 설치본 launch 및 수동 체감 확인 대기

목표: 정상 귀환을 측정 가능한 플레이 단위와 보상 회수 순간으로 만든다.

구현 방향:

- 안전지대에서 위험 지역으로 이동할 때 `activeExpedition` snapshot을 시작한다.
- snapshot은 시작 위치·시간·레벨·EXP·골드·HP·가방 item identity·kills·explores·활성 quest checkpoint만 저장한다.
- 전투·탐험마다 별도 카운터를 중복 갱신하지 않고, 귀환 시 현재 player와 시작 snapshot의 delta로 결과를 계산한다.
- 안전지대 귀환 시 `lastExpeditionSummary`를 한 번 생성하고 active snapshot을 종료한다.
- 요약은 지역, 경과 시간, 전투/탐험, 골드/EXP, 새 장비, 완료 임무, 최저 HP, 귀환 이유를 보여 준다.
- modal 강제 대신 첫 귀환은 자동 노출하고 이후에는 축약 strip과 다시 보기 action을 사용한다.

대상 후보:

- `src/types/player.ts`
- `src/utils/expeditionLedger.ts`
- `src/hooks/gameActions/moveActions.ts`
- `src/hooks/combatActions/*`
- `src/components/ExpeditionDebriefCard.tsx`
- save migration, unit, E2E, smoke contracts

완료 기준:

- 새 세이브와 구세이브 모두 위험 지역 진입·앱 재실행·마을 귀환을 안전하게 처리한다.
- 같은 원정 요약이 재실행이나 safe-to-safe 이동으로 중복 생성되지 않는다.
- 첫 원정에서 얻은 EXP·골드·아이템·임무 진행이 실제 player delta와 일치한다.
- 귀환 UI가 390x844 첫 viewport에서 성과와 다음 action을 함께 보여 준다.
- 기존 성장 수치, loot 확률, quest reward는 변경하지 않는다.

구현 결과(2026-07-23):

- `activeExpedition`과 `lastExpeditionSummary`를 Player save 경계에 추가하고 구세이브·손상 데이터 migration을 적용했다.
- 안전지대 출발과 귀환 이동을 start/end 경계로 사용하며, delta 계산으로 전투·탐험·EXP·골드·가방·임무 성과를 한 번만 확정한다.
- 첫 귀환 overlay와 마을 `지난 원정` 다시 보기를 추가하고 390x844 geometry 및 가로 overflow를 E2E로 고정했다.
- `npm run verify:full` 기준 unit `3372/3372`, desktop/mobile smoke, E2E `39/39`, native sync·Android debug·iOS archive가 통과했다.
- 추가 감사에서 발견한 typography 기준을 현재 debrief부터 적용해 의미 있는 text를 computed 11px 이상으로 높였고, focused E2E `1/1`과 최종 `npm run verify`의 unit `3372/3372`를 재통과했다.
- 최종 source 기준 APK는 `2026-07-23 01:01:13 KST`, iOS archive는 `01:01:33 KST`에 재생성했다. 최신 iPhone 설치와 `1.1.0 (2)` metadata 확인은 완료됐지만 launch/60초 hold는 기기 `Locked`로 남아 있어 앱 회귀와 분리한다.

### Slice 63 - Mobile Legibility Baseline

목표: 첫 세션과 반복 원정의 핵심 정보를 iPhone에서 확대 없이 읽고 누를 수 있게 한다.

상태: browser와 native packaging 구현·검증 완료. 물리 iPhone 최신 archive 설치·launch만 CoreDevice timeout으로 대기한다.

구현 방향:

- `label`, `meta`, `body`, `title`, `metric` semantic typography token을 만들고 핵심 surface의 arbitrary 8~10px class를 치환한다.
- standard mode의 의미 있는 text는 11px 미만을 허용하지 않고, 주요 안내와 action은 12~14px를 사용한다.
- 기존 `readabilityMode: high`는 type size와 line-height를 한 단계 높인다. global transform/zoom은 사용하지 않는다.
- `MissionTrackerStrip`, `ExpeditionPrepStrip`, `MapNavigator`, `Quest Board`, `Combat`, `ExpeditionDebrief`의 4열 micro-cell을 390px 이하에서 2x2 또는 요약 row로 재배치한다.
- Shattered journal처럼 목록은 이름·상태·핵심 수치만 먼저 보여 주고 설명은 선택·확장 후 표시한다.
- 자주 쓰는 action은 44px target을 유지하고 icon-only secondary action도 28px 아래로 내려가지 않게 한다.

완료 기준:

- 375x667, 390x844, 430x932에서 핵심 동선의 computed font size가 11px 미만으로 내려가지 않는다.
- high readability가 standard보다 실제로 큰 type scale을 사용하며, 같은 핵심 정보가 잘리거나 겹치지 않는다.
- 첫 출발, Map 이동, Quest 비교, Combat 선택, 귀환 debrief에 horizontal overflow와 incoherent overlap이 없다.
- E2E가 font floor, 주요 44px target, viewport geometry를 검증하고 screenshot evidence를 남긴다.
- gameplay 수치, 보상, save contract는 변경하지 않는다.

구현 결과(2026-07-23):

- `label / meta / body / title / metric` semantic type token을 추가하고 원정 준비·Mission Tracker·Map·Quest Board·Combat·Expedition Debrief의 핵심 문구를 standard mode computed 11px 이상으로 통일했다.
- high readability는 transform/zoom 없이 실제 font size와 line-height를 높이며, 390px 이하의 mission·route·quest summary와 map branch를 2x2 또는 전체 폭 summary row로 재배치했다.
- MainLayout 장식 레이어가 scroll container를 64px 넓혀 Quest focus 시 게임 전체를 왼쪽으로 미는 결함을 overflow containment와 flex `min-w-0`으로 수정했다.
- 새 `mobile-legibility.spec.ts`가 375x667·390x844·430x932에서 font floor, 44px action, 28px icon, responsive column, map branch, app-shell horizontal scroll, high mode scale을 검증하고 `playtest-artifacts/mobile-legibility/`에 8개 PNG를 남긴다.
- 최종 `npm run verify:full`은 type-check, lint, unit `3372/3372`, build guard, desktop/mobile smoke, E2E `43/43`을 통과했다. `mobile:doctor`, `cap:sync`, Android debug, Apple Development signed iOS archive도 통과했다.
- 최신 APK는 `2026-07-23 01:50:54 KST`의 199432737 bytes, iOS archive는 `01:51:05 KST`의 201M·`1.1.0 (2)`다. iPhone metadata와 install이 각각 120초 timeout으로 종료돼 device delivery와 60초 hold는 환경 blocker로 분리한다.

### Slice 64 - Expedition Mission Loadout

목표: 활성 임무가 많아져도 이번 원정의 목적을 최대 3개로 유지한다.

상태: browser와 native packaging 구현·검증 완료. 물리 iPhone은 CoreDevice 기준 offline이라 최신 archive 설치·launch를 대기한다.

구현 방향:

- 기존 `player.quests`는 그대로 유지하고, 마을 편성안은 `player.expeditionFocusQuestIds`, 출발 시점의 변경 불가 snapshot은 `activeExpedition.focusQuestIds`에 최대 3개로 저장한다.
- 기본 선택은 `보상 대기 > 스토리 > 현재 목적지와 같은 지역 > 진행률 높은 임무` 순서다.
- 별도 출발 modal을 만들지 않고 기존 원정 준비와 Quest Board에서 한 번에 교체하며, 필드에서는 읽기 전용으로 표시한다.
- tracker와 hunt encounter focus는 선택된 임무를 우선한다.
- 선택되지 않은 임무도 기존 규칙대로 진행되며 보상과 완료 ledger를 잃지 않는다.

완료 기준:

- 구세이브의 다수 활성 임무가 삭제되거나 초기화되지 않는다.
- tracker, Map mission marker, encounter focus가 같은 focus list를 사용한다.
- 첫 세션은 자동 배정된 이야기 임무 하나로 추가 설정 없이 출발한다.
- 3개를 넘는 선택은 UI와 reducer/action 경계 양쪽에서 거부한다.

구현 결과(2026-07-23):

- Quest Board에서 활성 임무를 최대 3개까지 추가·제외하며, 출정 준비·필드 Mission Tracker·Map mission marker·encounter focus가 같은 편성 결과를 사용한다.
- 출발 전에는 편성안을 바꿀 수 있지만 출발 후에는 `activeExpedition.focusQuestIds` snapshot을 읽기 전용으로 유지해 원정 중 목적이 흔들리지 않는다.
- 첫 이야기 자동 편성, 보상 대기·스토리·목적지·진행률 순 기본 ranking, 빈 편성·중복·존재하지 않는 임무·3개 초과 reducer 거부, 구세이브 fallback을 pure contract로 고정했다.
- 집중하지 않은 활성 임무도 기존 quest sync를 통해 계속 진행되며 완료·보상·귀환 ledger에서 제거되지 않는다.
- `npm run verify:full`은 type-check, lint, unit `3379/3379`, build guard, desktop/mobile smoke, E2E `44/44`을 통과했다. 390x844 증빙은 `playtest-artifacts/expedition-mission-loadout/`의 Quest Board, 원정 준비, 필드 tracker, Map 4개 PNG다.
- `mobile:doctor`, `cap:sync`, Android debug, Apple Development signed iOS archive가 통과했다. 최신 APK는 `2026-07-23 02:28:10 KST`의 199434013 bytes, archive는 `02:28:26 KST`의 201M·`1.1.0 (2)`다. `xctrace` 기준 iPhone과 iPad가 offline이므로 device install·launch·60초 hold는 환경 blocker로 분리한다.

### Slice 65 - Return Action and Milestone Story Beat

목표: 귀환 결과가 마을 정비와 다음 이야기로 이어지게 한다.

상태: 구현·browser/native packaging·최신 iPhone 설치 완료. 기기 잠금으로 launch·60초 foreground hold·수동 5분 체감 확인만 대기한다.

구현 방향:

- debrief 결과에서 `보상 받기 > 생명 회복 > 추천 장비 확인 > 가방 정리 > 제작 > 다음 임무` 중 하나만 primary action으로 계산한다.
- 기존 Quest, Rest, Inventory, Shop, Craft action을 재사용하고 새 facility를 만들지 않는다.
- 첫 정상 귀환, 첫 사망, 첫 구역 보스, 첫 전직 등 소수 milestone에 deterministic story beat를 연결한다.
- story beat는 완료 ledger를 가져 중복되지 않으며 skip해도 gameplay reward가 유실되지 않는다.

완료 기준:

- 귀환 후 최대 한 번의 tap으로 권장 정비 action을 연다.
- 같은 milestone은 reset/prestige 정책에 맞게 한 번만 노출된다.
- 이야기 skip, 오프라인 저장, 앱 재실행 후에도 reward와 진행은 동일하다.
- 기존 AI service 실패가 귀환 흐름을 막지 않는다.

구현 결과(2026-07-23):

- 귀환 결과에서 `보상 받기 > 생명 회복 > 추천 장비 확인 > 가방 정리 > 제작 > 다음 임무` 우선순위로 한 행동만 계산하고, 기존 Quest·Rest·Inventory·Shop·Craft·Equipment 경로를 그대로 연다.
- 권장 action을 먼저 실행한 뒤 debrief를 확인 처리하도록 순서를 고쳐, quest 보상 수령의 closure state가 닫힌 debrief를 다시 여는 stale-state 회귀를 방지했다.
- `첫 안전 귀환 / 첫 사망 / 첫 구역 보스 / 첫 전직`을 `meta.storyMilestones.seen/pending` ledger로 기록하고 reset·죽음·승천·구세이브 migration 뒤에도 한 번만 노출한다.
- 첫 사망 이야기를 Run Summary에서 확인하고 `다시 시작` 뒤에도 seen ledger가 유지되는 E2E를 추가했으며, Run Summary의 9~10px legacy label과 `RUN READOUT`을 11px semantic typography와 `이번 모험 분석`으로 정리했다.
- focused pure contract `26/26`, focused mobile E2E `3/3`, `npm run verify:full`의 type-check·lint·unit `3395/3395`·build guard·desktop/mobile smoke·E2E `46/46`이 통과했다. 시각 증빙은 `playtest-artifacts/expedition-return-flow/`의 귀환 action·첫 전직·첫 사망 3개 PNG다.
- `mobile:doctor`, `cap:sync`, Android debug, Apple Development signed iOS archive가 통과했다. 최신 APK는 `2026-07-23 02:56:22 KST`의 199435877 bytes, archive는 `02:56:35 KST`의 201M·`1.1.0 (2)`다. 최신 iPhone 설치와 metadata 재확인까지 성공했지만 launch는 기기 `Locked`로 차단돼 앱 회귀와 분리한다.

## 4차 GitHub·웹 조사 결론

2026-07-23 현재 공개 저장소와 공식 제품 자료를 Slice 65 이후 코드에 다시 대조했다.

- [Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon)은 모바일·데스크톱을 함께 지원하면서 많은 아이템과 run 정보를 시각적으로 분류한다. 공식 [Journal Overhaul](https://shatteredpixel.com/blog/coming-soon-to-shattered-a-journal-overhaul.html)은 비슷한 목록을 compact visual grid와 선택 상세로 바꾸고, 업그레이드 소비 전에 대상 효과를 명확히 보여 준다.
- [Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/)와 [Hades II FAQ](https://www.supergiantgames.com/blog/hades2-faq/)는 반복 실패·성공 뒤 영구 성장과 인물 이야기가 이어지되 서사 확인은 플레이어 흐름을 막지 않는 구조를 설명한다. Slice 65의 milestone ledger와 선택적 story card가 이 원칙을 이미 충족한다.
- [Moonlighter](https://moonlighterthegame.com/)는 원정 loot을 마을의 제작·강화로 전환하는 판단을 핵심 루프로 삼고, [Loop Hero](https://store.steampowered.com/app/1282730/Loop_Hero/)는 출발 준비·원정 획득·camp 재투자의 경계를 명확히 한다. Aetheria도 귀환 action까지는 연결됐지만 실제 투자 결과를 누르기 전에 비교하기 어렵다.
- [Buriedbornes2 Contracts](https://sites.google.com/view/bb2-help-en/world-map/start-adventure/contracts)는 모험 전 제한된 contract 선택으로 한 run의 목적을 고정한다. Aetheria의 최대 3개 집중 임무 snapshot이 같은 역할을 이미 수행한다.

코드 감사에서는 다음 격차만 후속 구현 가치가 높은 것으로 판단했다.

1. `SmartInventory`의 강화 action은 비용과 짧은 hint만 보여 주며, `BALANCE.ENHANCE_RATES`의 실제 성공률·현재/다음 단계 수치·실패 손실을 최종 실행 전에 한 화면에서 비교하지 못한다.
2. `CraftingPanel` recipe row는 이름·비용·재료 중심이라 완성 아이템의 icon·tier/type·주요 stat·현재 장비 대비를 판단하기 어렵다.
3. 합성은 성공률과 후보 이름은 제공하지만 결과 후보의 시각적 identity와 stat 변화가 약하다.
4. 반대로 초반 EXP, 전투 난이도, Map, 임무 편성, 귀환 흐름은 이미 회귀 계약이 있고 최신 실기기 체감 증거가 없다. 이 수치를 다시 바꾸면 검증된 학습 구간을 추측으로 흔들게 된다.

따라서 Slice 66은 새 economy나 balance 조정이 아니라 기존 소비 action의 의사결정 가시화로 제한한다. Slice 67은 실기기 피드백 뒤에만 검토한다.

### Slice 66 - Item Investment Preview

목표: 강화·제작·합성 전에 결과와 위험을 읽고 납득한 뒤 확정하게 한다.

상태: 구현·browser/native packaging·최신 iPhone 설치 완료. 기기 잠금으로 최신 설치본 launch·60초 foreground hold·수동 정비 흐름 확인만 대기한다.

구현 방향:

- 공용 pure preview model에서 대상 item의 현재 단계, 다음 강화 단계, 주요 stat delta, 성공률, gold/material 비용, 실패 시 손실을 계산한다.
- 강화 첫 tap은 상세 decision surface를 열고, 실제 소비는 명시적인 `강화 시도` action에서만 수행한다.
- 제작 row에 기존 `ItemIcon`, tier/type, 주요 stat, 현재 장비 대비, 착용 가능 조건, material/cost를 표시한다.
- 합성은 기존 성공률과 후보 규칙을 유지하면서 후보 icon과 핵심 stat을 함께 보여 준다.
- 기존 강화율·가격·재료·아이템 데이터·save schema는 바꾸지 않는다. 다만 preview에서 실제 비용을 소비하고도 능력치가 `+0`인 저수치 장비를 확인하면 무효 투자를 없애는 최소 보정은 허용한다.

완료 기준:

- 강화 실행 전 표시된 성공률·비용·다음 stat이 실제 reducer 결과와 같은 source of truth를 사용한다.
- 취소·panel close·앱 background에서는 재화나 재료가 소비되지 않는다.
- 390x844에서 대상, 결과, 위험, 최종 action이 확대 없이 읽히고 가로 overflow가 없다.
- pure contract가 preview와 실제 실행의 rate/cost/stat parity 및 재료 부족·최대 강화·착용 불가 edge를 검증한다.
- focused mobile E2E와 screenshot 증빙 뒤 `verify:full`, native packaging, 실기기 확인 순서로 닫는다.

구현 결과(2026-07-23):

- `getEnhancePreview`가 현재/다음 강화 단계, 실제 주 능력치, 성공률, 골드·재료, 부족 사유, 실패 손실을 계산하고 Equipment·Inventory의 decision modal과 실제 강화 action, `statsCalculator`가 같은 계산 source를 사용한다.
- 첫 tap은 portal 기반 `EnhanceDecisionCard`만 열며 취소 시 재화가 유지되고, 명시적인 `강화 시도`에서만 비용을 소비한다. modal을 root stacking context로 올려 전투 damage number가 decision surface 위에 겹치던 시각 회귀도 제거했다.
- 제작 60개 recipe는 실제 결과 `ItemIcon`, tier/type, 주 능력치, 현재 장비 대비, 착용 가능 여부, 보유/필요 재료를 표시한다. 합성은 골드가 부족해도 성공률·비용·실패 손실·실제 보호 자산·결과 후보 icon/stat/delta를 숨기지 않는다.
- 공용 preview를 전체 장비에 적용하는 과정에서 저수치 장비 강화가 골드와 재료를 쓰고도 `+0`이 되는 no-op을 발견했다. 기존 비율 scaling은 유지하되 강화 단계마다 주 능력치가 최소 `+1` 오르도록 보정하고 전 장비·최대 강화 단계 contract로 고정했다.
- focused pure contract `27/27`, focused mobile E2E `2/2`, 최종 type-check·lint·unit `3401/3401`·build guard·desktop/mobile smoke·E2E `48/48`이 통과했다. 시각 증빙은 `playtest-artifacts/item-investment-preview/`의 강화 decision, 제작 결과, 합성 후보 3개 PNG다.
- `mobile:doctor`, `cap:sync`, Android debug, Apple Development signed iOS archive가 통과했다. 최신 APK는 `2026-07-23 03:48:56 KST`의 199437873 bytes, archive는 `03:49:03 KST`의 201M·`1.1.0 (2)`다. 최신 archive는 iPhone에 재설치되고 metadata까지 확인됐지만 launch 시점 기기 `Locked`로 차단됐으며, 직전 기존 설치본 launch는 성공했으나 60초 foreground process 유지에는 실패했다. 같은 시각의 Aetheria crash report는 없어 device 상태 blocker와 앱 crash를 구분한다.

### Slice 67 - Adventure Chronicle

목표: 이미 본 milestone 이야기를 강제 modal 없이 다시 확인할 수 있게 한다.

구현 방향:

- 새 top-level 메뉴를 만들지 않고 기존 Archive/Codex에 seen milestone story와 최근 원정 결과를 연결한다.
- unseen story를 반복 강제하지 않고, 확인한 기록만 시간·지역·결과와 함께 읽기 전용으로 제공한다.
- 생성형 AI, 새 보상, 새 save economy는 추가하지 않는다.

착수 조건:

- Slice 66 최신 설치본의 60초 hold와 fresh-save 5분 루트가 완료되고, 실제 사용자가 이야기 재확인을 원한다는 evidence가 있을 것.
- Slice 66의 item decision surface가 실기기에서 귀환 후 정비 흐름을 방해하지 않을 것.

## 검증 순서

1. pure unit: expedition start/delta/end, old-save fallback, focus ranking, milestone duplicate prevention, item preview/execution parity
2. cumulative route: 첫 출발 -> 숲 탐험/전투 -> 마을 귀환 -> 보상/장비 action -> 강화·제작 decision preview
3. persistence: field background/relaunch와 return debrief one-shot
4. `npm run verify:full`
5. 390x844 screenshot과 geometry assertion
6. `mobile:doctor -> cap:sync -> android:debug -> ios:archive`
7. 물리 iPhone 60초 hold와 5분 fresh-save route

## 다음 결정점

Slice 66은 browser와 native packaging, 최신 iPhone 설치까지 통과했다. 먼저 기기를 잠금 해제하고 화면을 켠 상태에서 `npm run ios:device:launch-smoke`의 60초 foreground hold를 다시 실행한다. 이어서 새 세이브 첫 5분에서 집중 임무, Map marker, 전투, 정상 귀환의 단일 정비 action, 강화 decision과 취소·확정, 제작·합성 결과 비교, milestone story, standard/high readability를 실제 터치로 확인한다. 이 evidence에서 정비 흐름을 방해하는 회귀가 없고 이야기 재확인 수요가 확인될 때만 Slice 67 Adventure Chronicle을 검토하며, 난이도·EXP·Map 재조정은 실기기 피드백 전에는 착수하지 않는다.
