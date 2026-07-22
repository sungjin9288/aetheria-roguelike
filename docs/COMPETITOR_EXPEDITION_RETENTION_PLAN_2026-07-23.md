# Aetheria 경쟁작 원정·리텐션 흐름 개선 계획

Date: 2026-07-23
Scope: 첫 세션 연결 이후, 실기기 RC 검증과 병행할 다음 gameplay development 후보

## 결론

기존 경쟁작 계획의 `Map -> Combat -> Quest -> Equipment -> Encounter Art`는 Slice 53~57에서 모두 구현됐다. 현재 Aetheria에 필요한 다음 변화는 새 메뉴나 통화를 늘리는 것이 아니라, 이미 존재하는 퀘스트·탐험·전투·전리품·마을 정비를 하나의 반복 가능한 원정으로 묶는 것이다.

권장 순서는 다음과 같다.

1. Slice 61의 첫 이야기 자동 배정과 첫 출발 연결을 실기기에서 확정한다.
2. `마을 출발 -> 탐험 -> 마을 귀환`을 저장 가능한 원정 단위로 기록하고 귀환 정산을 제공한다.
3. 수락한 임무를 삭제하거나 제한하지 않고, 이번 원정에서 집중할 임무만 최대 3개로 선택한다.
4. 귀환 정산에서 보상 수령·장비 교체·휴식·제작 중 가장 중요한 다음 행동 하나를 연결한다.
5. 첫 사망과 첫 보스 귀환처럼 의미 있는 시점에만 짧은 마을 이야기 변화를 추가한다.

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
- browser smoke를 빠른 피드백으로, native 실기기를 release evidence로 쓰는 검증 경계

### ADAPT

- 정상 귀환도 하나의 성공적인 expedition outcome으로 기록한다.
- quest acceptance와 expedition focus를 분리한다.
- 귀환 화면은 숫자 나열보다 `이번 성과 -> 손실/위험 -> 다음 한 행동` 순서로 구성한다.
- 서사는 모든 귀환에 강제하지 않고 최초 milestone에서만 짧게 노출한다.

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

## 실행 계획

### Slice 61 - First Story Continuity

상태: 구현·browser/native 전달 완료, 최신 설치본 launch 및 수동 체감 확인 대기

- 새 run 시작과 동시에 `[스토리] 첫 번째 여정`을 0/1 상태로 배정한다.
- 첫 마을 화면은 Quest Board 재방문 없이 `고요한 숲으로 첫 출발`을 유지한다.
- 이미 활성 또는 완료한 세이브에는 중복 배정하지 않는다.
- 첫 숲 탐험이 실제 임무 진행으로 즉시 연결되는 E2E를 유지한다.

### Slice 62 - Expedition Ledger and Return Debrief

목표: 정상 귀환을 측정 가능한 플레이 단위와 보상 회수 순간으로 만든다.

구현 방향:

- 안전지대에서 위험 지역으로 이동할 때 `activeExpedition` snapshot을 시작한다.
- snapshot은 시작 위치·시간·레벨·EXP·골드·HP/NRG·가방 item identity·kills·explores·focus quest ids만 저장한다.
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

### Slice 63 - Expedition Mission Loadout

목표: 활성 임무가 많아져도 이번 원정의 목적을 최대 3개로 유지한다.

구현 방향:

- 기존 `player.quests`는 그대로 유지하고 `activeExpedition.focusQuestIds`만 최대 3개로 제한한다.
- 기본 선택은 `보상 대기 > 스토리 > 현재 목적지와 같은 지역 > 진행률 높은 임무` 순서다.
- 출발 전 원정 준비에서 한 번에 교체할 수 있고, 필드에서는 읽기 전용으로 표시한다.
- tracker와 hunt encounter focus는 선택된 임무를 우선한다.
- 선택되지 않은 임무도 기존 규칙대로 진행되며 보상과 완료 ledger를 잃지 않는다.

완료 기준:

- 구세이브의 다수 활성 임무가 삭제되거나 초기화되지 않는다.
- tracker, Map mission marker, encounter focus가 같은 focus list를 사용한다.
- 첫 세션은 자동 배정된 이야기 임무 하나로 추가 설정 없이 출발한다.
- 3개를 넘는 선택은 UI와 reducer/action 경계 양쪽에서 거부한다.

### Slice 64 - Return Action and Milestone Story Beat

목표: 귀환 결과가 마을 정비와 다음 이야기로 이어지게 한다.

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

## 검증 순서

1. pure unit: expedition start/delta/end, old-save fallback, focus ranking, duplicate prevention
2. cumulative route: 첫 출발 -> 숲 탐험/전투 -> 마을 귀환 -> 보상/장비 action
3. persistence: field background/relaunch와 return debrief one-shot
4. `npm run verify:full`
5. 390x844 screenshot과 geometry assertion
6. `mobile:doctor -> cap:sync -> android:debug -> ios:archive`
7. 물리 iPhone 60초 hold와 5분 fresh-save route

## 다음 결정점

Slice 61 최신 설치본의 launch와 첫 5분 수동 동선을 먼저 끝낸다. 그 결과에서 신규 앱 회귀가 없으면 Slice 62만 구현해 원정 단위의 가치가 실제로 올라가는지 검증한 뒤, Slice 63과 64는 각각 별도 checkpoint로 진행한다.
