# Aetheria Content Reachability, Exploration Rhythm, and Encounter Depth Design

Date: 2026-08-11 KST

Status: Approved direction; written design awaiting user review

Planning owner: GPT A, GPT-5.6 Sol xhigh

Implementation owner after plan approval: Orca GPT B, GPT-5.6 Luna max

## 1. Goal

Aetheria의 Apps in Toss 절차는 계속 hold한다. 먼저 현재 게임 코어 안에 이미 존재하는 콘텐츠가 실제 플레이 흐름에서 만나지고, 성장 속도가 콘텐츠를 건너뛰지 않으며, 탐험이 선택 화면의 연속이 아니라 이동과 전투 사이에 숨을 쉴 수 있는 경험이 되도록 완성한다.

이번 작업이 닫혀야 하는 플레이 흐름은 다음과 같다.

`탐험 → 전투·발견 → 선택이 필요한 사건 → 성장·장비 판단 → 다음 지역과 직업 계보 → 중후반 콘텐츠`

완료 여부는 콘텐츠 개수나 설정값만으로 판단하지 않는다.

1. 52개 지역, 254종 몬스터, 143개 퀘스트, 18개 직업, 25개 signature와 player-facing 장비가 production 경로에서 도달 가능하거나 명시적인 예외로 분류되어야 한다.
2. 탐험 중 optional decision surface는 연속해서 나타나지 않고, fixed-seed simulation에서 중앙 간격이 대략 4~5회의 탐험이 되도록 한다.
3. 첫 두 playable dungeon인 `고요한 숲`과 `서쪽 평원`에 기존 lore와 state authority만 사용하는 네 개의 encounter family가 들어간다.
4. EXP, loot, event 세 축을 한 번에 바꾸지 않는다. 이번 pacing change는 event axis만 변경하며 기존 원정은 시작 당시 profile을 유지한다.
5. 변경된 candidate는 자동 검증, 실제 UI, mobile viewport, native packaging, 새 human observation을 모두 통과해야 한다.

## 2. Current Evidence and Decision

### 2.1 Why the game feels event-heavy

Production exploration은 다음 순서로 player-facing decision surface를 시도한다.

1. mandatory story chain
2. campfire
3. boss challenge
4. scout
5. general narrative event
6. quiet, relic, anomaly, combat, discovery, nothing

일반 narrative event만 보면 현재 probability는 과도하지 않다. production `getNarrativeEventChance`로 계산한 non-safe map 46개의 fresh 평균은 약 5.62%이며, 네 번 연속 narrative event가 없었던 상태의 평균은 약 8.59%다.

하지만 scout가 25%, campfire가 8%이고 mandatory chain과 boss telegraph가 별도로 앞에 놓여 있다. 그래서 체감상 player decision을 요구하는 화면은 일반 narrative event 수치보다 훨씬 자주 나타난다. 문제의 root cause는 단일 event chance가 아니라 여러 decision surface의 합성 밀도다.

### 2.2 Approved direction

이번 설계는 다음을 함께 적용한다.

- `SCOUT_CHANCE`: `0.25 → 0.15`
- registered progression profile의 `eventMultiplier`: `1.0 → 0.8`
- `CAMPFIRE_CHANCE`: 0.08 유지
- optional decision surface 사이에 최소 한 번의 non-narrative outcome 보장
- mandatory story chain과 boss challenge는 cooldown의 영향을 받지 않음
- bounded encounter는 새로운 발생 확률을 추가하지 않고 accepted general narrative slot을 대체함

16 fixed seeds의 기존 comparison에서 `eventMultiplier 0.8`은 narrative events를 6,556회에서 6,166회로 약 5.95% 줄였고 hard correctness와 target direction gate를 통과했다. 다만 이 수치만으로는 scout와 campfire를 포함한 체감 밀도를 설명하지 못하므로, 구현 뒤에는 모든 decision category를 함께 측정한다.

## 3. Product Boundary

### Included

- canonical content reachability report와 deterministic checksum
- optional exploration decision spacing
- scout frequency reduction
- immutable event-axis progression profile과 expedition snapshot locking
- `고요한 숲`, `서쪽 평원`의 네 encounter family
- existing EventPanel을 통한 선택과 결과 표시
- fixed-seed statistical comparison
- fresh, midgame, endgame representative real-surface play
- mobile viewport, back, lifecycle, save/reload regression
- repository, art, mobile, Capacitor, native gates
- candidate-bound fresh human observations

### Excluded

- 신규 지역, 신규 보스, 신규 통화, 신규 top-level menu
- runtime generative AI content
- EXP나 loot multiplier 조정
- enemy HP와 reward 관계 변경
- Apps in Toss review, upload, publication, ad activation
- IAP와 paid service
- server-authoritative public grave
- 모든 지역에 encounter를 한 번에 추가하는 대량 authoring

## 4. Exploration Rhythm Authority

### 4.1 Surface classification

탐험 결과를 다음 두 종류로 나눈다.

**Mandatory decision surfaces**

- active story chain
- boss challenge and telegraph

이 흐름은 progression을 막지 않도록 spacing gate를 무시한다. 이미 존재하는 narrative outcome commit을 통해 다음 optional surface의 간격은 다시 시작된다.

**Optional decision surfaces**

- campfire
- scout
- general narrative event
- bounded encounter

Optional surface는 직전 player-facing narrative outcome 뒤 최소 한 번의 normal exploration outcome이 있어야 다시 나타날 수 있다. fresh expedition 시작 직후에도 mandatory surface가 아니라면 먼저 한 번의 normal outcome을 경험하게 한다.

### 4.2 Small pure decision helper

새로운 timer나 별도 counter를 만들지 않는다. 이미 `exploreState.sinceNarrativeEvent`가 non-narrative outcome마다 증가하고 `narrative_event`에서 0으로 돌아간다. 이 state를 읽는 작은 pure helper가 optional roll을 시도할 수 있는지만 답한다.

권장 contract:

```ts
export const canOfferOptionalExploreDecision = (
    stats: ExploreStats,
): boolean => stats.exploreState.sinceNarrativeEvent >= 1;
```

실제 type name은 owning source를 따른다. 단일 비교를 감추기 위한 abstraction이 아니라 campfire, scout, general narrative가 같은 rule을 공유하도록 authority를 한 곳에 두는 것이 목적이다.

### 4.3 RNG and ordering

기존 exploration priority와 RNG stream을 보존한다.

- mandatory chain과 boss challenge는 현재 위치에서 평가한다.
- optional gate가 닫혀 있으면 campfire, scout, general narrative의 RNG를 소비하지 않는다.
- optional gate가 열려 있을 때만 current priority대로 각 roll을 수행한다.
- bounded encounter는 general narrative roll이 accepted된 뒤 선택한다.
- eligible bounded encounter가 없으면 현재 fallback event를 같은 RNG authority로 생성한다.
- global `Math.random` patch를 사용하지 않는다.

RNG draw count가 의도적으로 달라지는 지점은 test에 명시한다. 기존 path의 우연한 byte equality를 주장하지 않고, 같은 seed와 같은 state가 같은 결과를 만드는 determinism을 보장한다.

## 5. Progression Profile and Rollback

### 5.1 Candidate profile

새 profile은 immutable registry entry로 추가한다.

```ts
{
    id: 'exploration-rhythm',
    version: 2,
    expMultiplier: 1,
    lootMultiplier: 1,
    eventMultiplier: 0.8,
}
```

이름과 version은 implementation plan에서 live registry convention을 다시 확인한 뒤 확정한다. 중요한 contract는 baseline predecessor 대비 event 축 하나만 바뀌고 비율이 initial safety rail 0.8~1.2 안에 있다는 점이다.

### 5.2 Expedition locking

- 새 원정은 현재 active profile의 full normalized snapshot을 저장한다.
- 이미 시작한 원정은 remote pointer나 default 변경의 영향을 받지 않는다.
- save/reload, HP 변화, boss append, expedition finish를 거쳐도 profile은 유지된다.
- unknown profile ref는 baseline으로 fail closed한다.

### 5.3 Rollback

Rollback은 새로운 counter-profile을 만들지 않는다. active pointer를 이전 immutable `baseline@1`로 되돌린다.

- 진행 중 원정은 candidate snapshot을 끝까지 유지한다.
- rollback 뒤 시작한 다음 원정부터 baseline을 사용한다.
- candidate evidence와 save field를 삭제하지 않는다.
- bounded encounter data는 별도 enable boundary로 끌 수 있으나 이미 기록된 receipt는 보존한다.

## 6. Canonical Content Reachability

Reachability report는 “한 캐릭터가 한 run에서 모든 콘텐츠를 소비한다”는 주장이 아니다. canonical catalog 각 항목이 production rule로 도달 가능한지 검증하는 deterministic audit다.

### 6.1 Map and monster graph

- `START_LOCATION`에서 시작해 모든 52개 map node가 연결되는지 확인한다.
- safe, field, dungeon, boss category를 명시해 누락을 숨기지 않는다.
- 각 map의 monster profile이 canonical monster를 참조하는지 확인한다.
- 254종 monster가 적어도 하나의 production spawn route 또는 명시적인 boss/event route를 갖는지 확인한다.
- quest-only, boss-only, narrative-only route는 일반 spawn과 구분해 보고한다.

### 6.2 Quest graph

- 143개 quest의 location이 reachable해야 한다.
- prerequisite graph는 cycle이 없어야 한다.
- monster target은 해당 location에서 실제로 만날 수 있어야 한다.
- item, gold, EXP reward reference는 canonical해야 한다.
- level gate가 `MAX_LEVEL` 밖으로 나가지 않아야 한다.

이미 있는 quest/monster tests를 복제하지 않는다. owning validators를 재사용해 한 개의 release-oriented report로 합친다.

### 6.3 Job and build routes

- 18개 job 모두 `모험가`에서 canonical transition graph로 reachable해야 한다.
- unusual requirement level과 same-tier transition을 실제 class data로 처리한다.
- 8개 terminal lineage의 representative path를 보고한다.
- Lv2, 5, 10, 20, 45, 60, 75에서 유효한 job snapshot을 만든다.
- malformed tier, requirement, branch, job reference는 fail closed한다.

### 6.4 Equipment and signature acquisition

- 25개 signature identity는 canonical acquisition route를 가져야 한다.
- 229개 player-facing equipment artwork identity를 catalog item과 대조한다.
- 22개 family exemplar artwork는 item count에 섞지 않는다.
- drop table, guaranteed boss reward, quest/event reward, shop 또는 다른 production route를 구분한다.
- route가 없는 항목은 “rare”로 포장하지 않고 blocker 또는 evidence-backed exception으로 기록한다.
- tier requirement보다 이른 equip은 0이어야 한다.

### 6.5 Report contract

Report는 stable ordering으로 생성하며 다음을 포함한다.

- schema and generator version
- source catalog counts
- reachable, missing, malformed, exception arrays
- acquisition route type counts
- 8 lineage and 18 job coverage
- fixed checkpoint summary
- SHA-256 of canonical JSON projection

Report generation은 data를 변경하지 않는다. missing/malformed가 하나라도 있으면 nonzero exit다.

## 7. First Bounded Encounter Pack

### 7.1 Region decision

기존 계획의 “fresh observation으로 상위 두 지역을 먼저 고른다”는 규칙은 콘텐츠 authoring entry gate에서 제거한다. 첫 시간의 actual production route와 현재 lore authority를 기준으로 다음 두 지역을 확정한다.

- `고요한 숲`
- `서쪽 평원`

Human observation 5회는 여전히 release acceptance gate다. 기존 candidate의 1회 observation은 기록으로 보존하지만 behavior가 달라진 새 candidate의 5회에 합산하지 않는다.

### 7.2 Content rules

각 지역에 두 family를 둔다. 각 encounter는 다음 순서로 읽힌다.

`상황 → 선택 → 예상 trade-off → 결과`

Content는 기존 state만 사용한다.

- HP and MP
- gold
- canonical item
- existing buff or event-chain state
- lineage
- HP band
- discovered signature
- previous boss record

새 currency, hidden meter, top-level menu, region, monster, boss, item은 추가하지 않는다.

### 7.3 Four families

#### 고요한 숲: 돌기둥의 속삭임

숲 곳곳의 오래된 돌기둥과 먼저 지나간 사람의 흔적을 사용한다. 한 선택은 MP나 시간을 들여 안전한 정보와 방어적 이점을 얻고, 다른 선택은 HP risk를 감수해 즉시 쓸 수 있는 gold 또는 canonical material을 얻는다.

이 family는 unconditional이어야 한다. early player가 eligibility 조합 때문에 encounter pack 전체를 보지 못하는 상황을 막는다.

#### 고요한 숲: 변이된 숲길

변이된 식생과 상처 입은 숲의 존재를 다룬다. HP band 또는 lineage로 copy와 선택의 의미가 달라질 수 있지만, 결과는 기존 potion, HP/MP, buff, gold 안에서 끝난다.

한 variant는 현재 HP에 따라 실제 risk가 달라져야 하며 단순 문구 변경으로 끝나지 않는다.

#### 서쪽 평원: 버려진 보급 수레

옛 곡창 지대와 방치된 보급 흔적을 사용한다. 수레를 수리해 안정적인 보급을 얻거나, 빠르게 뒤져 위험을 감수하고 즉시 아이템 또는 gold를 얻거나, 손대지 않고 이동하는 선택을 제공한다.

이 family도 unconditional이어야 한다.

#### 서쪽 평원: 도적단의 낡은 깃발

평원의 도적과 멀리 보이는 불의 협곡 징후를 연결한다. lineage, signature discovery, previous boss 중 하나를 이용해 build history가 선택 문맥에 영향을 주게 한다.

조건이 충족되지 않아도 지역의 다른 unconditional family가 항상 남는다. unavailable boss나 아직 도달할 수 없는 signature를 pack 전체의 필수 조건으로 사용하지 않는다.

### 7.4 Settlement authority

- encounter selection은 pure seeded function이다.
- 모든 canonical reference와 cost는 selection 전에 validate한다.
- inventory가 가득 차면 item outcome은 cost를 지불하기 전에 거부한다.
- HP cost는 player를 1 미만으로 만들 수 없다.
- state result와 receipt를 reducer-owned single transaction으로 확정한다.
- 같은 receipt replay는 object-equivalent no-op이다.
- malformed encounter는 ineligible이며 current fallback event를 막지 않는다.
- pack disabled 상태는 기존 narrative fallback behavior를 유지한다.

## 8. UI and Player Copy

새 화면을 만들지 않는다. 기존 EventPanel이 상황, 선택 label, 예상 trade-off, 결과를 표시한다.

- trade-off는 click 전에 보인다.
- system term보다 player vocabulary를 쓴다.
- choice label만 읽어도 행동이 분명해야 한다.
- 결과 copy는 실제 state change와 일치한다.
- primary choice target은 최소 44px이다.
- 375x667, 390x844, 430x932에서 local/document overflow가 없어야 한다.
- nearest reversible surface가 system back을 먼저 소비한다.
- reduced motion, safe area, screen reader label을 기존 shell contract에 맞춘다.

## 9. TDD and Verification Contract

각 slice는 다음 순서로 닫는다.

`RED → GREEN → focused integration → full gate → real surface → independent review`

### 9.1 Reachability tests

- exact catalog counts
- missing map/monster/quest/job/item route mutation
- prerequisite cycle
- malformed class/equipment gate
- deterministic report hash
- report no-write

### 9.2 Rhythm tests

- optional surface가 back-to-back으로 발생하지 않음
- fresh exploration에서 먼저 normal outcome 발생
- mandatory chain과 boss challenge는 즉시 나타날 수 있음
- scout 15%, campfire 8%, event profile 0.8가 owning source에만 존재
- same seed and state produces same outcome
- global `Math.random` mutation 없음
- save/reload와 active expedition profile locking
- rollback applies only to next expedition

### 9.3 Encounter tests

- exactly two canonical regions and four families
- at least one unconditional family per region
- canonical reference validation
- lineage, HP band, signature, previous boss eligibility
- fixed-seed selection
- cost, full inventory, HP floor
- reducer replay exact no-op
- malformed data fallback
- pack disabled current-path characterization

### 9.4 Statistical report

Decision category를 다음처럼 분리한다.

- mandatory story
- boss challenge
- campfire
- scout
- general narrative
- bounded encounter
- combat
- discovery/relic/anomaly
- nothing

Fixed ordered seeds로 다음을 보고한다.

- optional decision gap p10/p50/p90
- optional back-to-back count
- category counts and rates
- event-axis predecessor/candidate comparison
- checkpoint reach rate
- combat truncation and invalid numeric count

Acceptance target:

- optional back-to-back count: 0
- optional decision gap p50: 4~5 explores
- hard correctness: true
- combat matrix truncated count: 0
- invalid numeric: 0
- target metric direction: matched
- EXP and loot aggregate: unchanged within deterministic contract

처음에는 modeled time을 report-only로 둔다. production telemetry와 simulator가 같은 문제를 가리키기 전에는 플레이 시간 수치를 release hard gate로 사용하지 않는다.

### 9.5 Repository and real-surface gates

```bash
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
npm run android:debug
npm run ios:build:device
git diff --check
git status --short -- android ios
```

Native signing, device connectivity, keystore처럼 환경에 의존하는 실패는 app regression과 분리한다. Browser proof를 physical device acceptance로 승격하지 않는다.

### 9.6 Human observations

최종 behavior commit에 묶인 새 candidate로 fresh observation을 다시 시작한다.

- 최소 5회
- candidate and artifact identity exact match
- first screen and first action timing
- optional event rhythm perception
- first combat, first safe return, save/reload
- P0 0, blocking P1 0

이전 candidate의 1회 observation은 historical evidence로만 남긴다.

## 10. Delivery Order

### Slice 1: Reachability and measurement

- canonical content reachability auditor
- deterministic report and mutation tests
- exploration category measurement
- baseline evidence before behavior change

### Slice 2: Exploration rhythm

- optional decision gate
- scout chance reduction
- event-axis profile registration and activation boundary
- save/reload/rollback contract
- statistical comparison

### Slice 3: Encounter depth

- four encounter families
- production exploration integration
- EventPanel presentation
- receipt and replay settlement
- real-surface screenshots and journey test

### Slice 4: Final evidence

- full/mobile/native gates
- five fresh observations
- independent Sol xhigh review
- task ledger and release evidence synchronization
- one final grouped push after all approved commits are green

## 11. Model and Work Ownership

GPT A owns architecture, contract, approval boundary, diff review, verification, evidence audit, and final decision.

Orca GPT B receives one bounded Goal Manifest and uses GPT-5.6 Luna max for implementation. It does not receive the full conversation history and does not edit before this design and its implementation plan are approved.

Model changes are evidence-driven.

- Luna max: ordinary TDD implementation and UI connection
- Sol high/xhigh: architecture gap, complex deterministic bug, migration or high-risk review
- Terra max: mechanically bounded manifest, fixture, report, or documentation synchronization

If implementation reveals an architecture decision not settled here, the affected path stops and returns to a Sol xhigh planning pass. GPT A and GPT B never edit overlapping writable paths concurrently.

Code should read like a direct explanation of the game rule. Prefer short pure functions, descriptive names, natural control flow, and existing authorities. Do not introduce speculative adapters, configurable frameworks, generic engines, or comments that restate the code. Validation, receipts, evidence, and history remain explicit.

## 12. Commit and Push Boundaries

Planning is committed separately because it is the reviewed execution contract.

Implementation uses three cohesive commits rather than one commit per small edit.

1. content reachability audit and pacing measurement
2. exploration decision rhythm and event profile
3. encounter families, UI integration, evidence, and ledger

Each commit contains its coupled tests and documentation. Push is performed once after full gates and independent review, unless recovery requires an explicitly approved exception.

Never stage or commit:

- `build/`
- generated native drift
- secret, console credential, device identifier
- raw observation export
- historical Toss release evidence unrelated to this candidate

## 13. Superseded Decisions

This design changes two parts of `2026-08-11-aetheria-bounded-depth-final-gate.md`.

1. Five observations no longer choose the first authoring regions. `고요한 숲` and `서쪽 평원` are fixed as the first-hour design slice. Five new candidate-bound observations remain a release acceptance requirement.
2. Global event frequency is no longer required to remain byte-identical. The event axis is intentionally reduced through the approved one-axis profile and optional decision spacing. Bounded encounter integration itself still adds no independent occurrence roll.

All permanent-state, endgame, public-grave, True Ending, evidence, and Toss HOLD decisions from the release-complete core design remain in force.

## 14. Completion Gate

This work is complete only when all of the following are true.

- canonical reachability report has no unexplained missing or malformed entries
- all 18 jobs and 8 terminal lineages are covered
- all 25 signatures and player-facing equipment have a route or explicit reviewed exception
- optional decision back-to-back count is zero
- optional decision median gap is 4~5 explores
- event candidate changes only the event axis and has rollback evidence
- four bounded encounter families are playable through the production UI
- encounter replay, full inventory, malformed content, and disabled-pack tests are green
- fresh, midgame, endgame representative routes remain reachable
- repository, art, mobile, Capacitor, and applicable native gates are green
- five fresh observations on the final candidate have P0 0 and blocking P1 0
- independent Sol xhigh review reports Important 0
- evidence and task ledger match the exact candidate bytes
- Apps in Toss remains HOLD until separately approved
