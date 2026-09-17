# Aetheria Item, Relic, Consumable, and Event Balance Design

Date: 2026-08-12 KST

Status: Approved by user; Slice 1 is implemented and locally verified, with commit/push and later balance slices still approval-gated

Planning owner: GPT A, GPT-5.6 Sol xhigh

Implementation owner after plan approval: Orca GPT B, GPT-5.6 Luna max

## 1. Goal

Aetheria의 로그라이크 정체성을 강화한다. 플레이어는 매 전투와 탐험에서 실패할 수 있다는 긴장을 느끼되, 결과를 이해하고 다음 run에서 다른 build를 시도할 이유가 있어야 한다. 특정 유물, 장비, 소비품 또는 사건 하나가 생존·성장·경제를 자동으로 해결해서는 안 된다.

이번 설계는 현재 production catalog 전체를 대상으로 한다.

- 유물 67개와 시너지 20개
- 무기 117개, 방어구 91개, 방패·focus 21개
- 소비품 14개
- 지역 52개, 이벤트 체인 13개와 39단계, bounded encounter 4개
- 이 콘텐츠에 연결된 실제 combat, loot, exploration, save 경로

한 번에 모든 숫자를 바꾸지 않는다. 각 release는 한 종류의 원인만 변경하고 predecessor와 candidate를 같은 production authority로 비교한다.

## 2. Approved First Decision

`불사의 의지`는 효과를 유지하고 등급만 올린다.

```ts
{
    id: 'undying',
    rarity: 'epic',
    effect: 'death_save',
    val: 1,
}
```

이 결정은 다음 의미를 가진다.

- 전투마다 한 번 생명이 1 아래로 내려가지 않는 behavior는 유지한다.
- `uncommon` 가중치 30에서 `epic` 가중치 4로 이동한다.
- 현재 67개 catalog에서 3-choice offer 등장 확률은 약 8.88%에서 1.25%로 낮아진다.
- 다섯 번의 독립적인 유물 기회 중 한 번 이상 볼 근사 확률은 약 37.2%에서 6.1%로 낮아진다.
- 시작 유물은 `rare` 이하만 허용하므로 첫 run의 시작 선택지에서 빠진다.
- `불사조의 깃털`과의 시너지 및 reducer-owned fatal protection contract는 변경하지 않는다.

기존 진행 중인 run에 저장된 유물 객체는 run snapshot으로 보존한다. catalog를 새 값으로 다시 덮어쓰지 않는다. 승격은 새로 생성되는 선택지부터 적용되며, 다음 run에서 자연스럽게 완전히 전환된다.

## 3. Current Evidence

### 3.1 Relics

67개 유물은 61개 effect를 사용하며 모든 effect에는 production runtime reference가 있다. 문제는 dead content가 아니라 rarity, access frequency, power curve의 정합성이다.

확인된 우선 감사 대상은 다음과 같다.

- `고대 지도`: common이면서 이벤트 발생률 +60%
- `방랑자의 부적`: uncommon이면서 이벤트 발생률 +30%
- `주문 메아리`: uncommon, 무료 기술 15%
- `시공의 반지`: epic, 무료 기술 15%
- `죽음의 낙인`: rare, DoT 3배
- `저주의 결정`: rare, DoT 1.5배
- `그림자 망토`: uncommon, 첫 enemy action 확정 회피와 방어력 +10%
- `대지의 심장`: epic, 매 턴 최대 생명 5% 회복
- `세계 포식자`: legendary, 처치할 때마다 enemy max HP 기반 최대 생명 증가
- `허공의 눈`: epic, boss spawn 3배와 boss drop +100%

Slice 1 audit 이후 duplicate effect의 runtime policy도 확인했다. `free_skill`, `gold_mult`, `drop_rate`, `dot_mult`는 첫 일치 유물을 읽어 save 배열 순서에 영향을 받고, `event_chance`는 같은 family를 합산한다. `hp_drain_atk`는 공격 보너스는 합산하지만 생명 비용은 첫 일치 유물만 적용한다. 따라서 duplicate family를 한꺼번에 수치 조정하지 않고, family별로 `max`, additive, exclusive, trade-off pair 중 하나의 명시적 policy를 먼저 고정한다.

첫 effect candidate는 `free_skill`이다. `주문 메아리`와 `시공의 반지`는 현재 같은 15%인데 rarity가 다르고, `시공의 반지` 설명은 cooldown을 말하지만 runtime은 MP 무소모로 동작한다. Slice 2A는 uncommon을 8%로 조정하고 epic은 15%를 유지하며, 둘을 함께 보유했을 때 순서와 무관하게 strongest-only 15%를 적용한다. 세부 계획은 `docs/superpowers/plans/2026-08-12-aetheria-free-skill-coherence-plan.md`다.

이 목록은 곧바로 하향한다는 뜻이 아니다. rarity inversion, identical-effect mismatch, failure-rule override, unbounded scaling 여부를 production scenario로 검증할 우선순위다.

### 3.2 Equipment

장비 229개는 모두 player-facing catalog와 artwork route를 가진다. raw `val`만으로는 양손, offhand focus, MP, critical chance, element, job restriction, signature identity를 비교할 수 없다.

명백한 data-quality 이상치는 별도로 다룬다.

- Tier 5 weapon 중앙 가격은 약 29,500G다.
- `성스러운 창`은 3,500G다.
- `용의 화염`은 4,000G다.
- Tier 4와 Tier 5의 일부 item도 동일 tier corridor와 큰 차이가 있다.

가격 오류와 전투 성능은 같은 release에서 함께 바꾸지 않는다. 가격은 economy axis, `val`과 secondary stat은 combat-power axis다.

### 3.3 Consumables

소비품은 HP 50/150/300/full, MP 30/80/200, 상태 해제 4종, 전투 buff 3종으로 구성된다. flat recovery는 초반에는 강하고 후반에는 inventory slot 가치가 급감할 수 있다. 반대로 full heal과 `all_up 1.5`는 특정 boss에서 다른 선택을 지울 수 있다.

소비품은 가격 효율만 맞추지 않는다. 다음을 함께 본다.

- 같은 tier enemy의 한 attack 대비 회복량
- inventory 20칸에서 차지하는 opportunity cost
- combat turn을 소비하는지 여부
- quick slot과 shop availability
- boss 전투에서의 생존율 변화

### 3.4 Events

현재 fixed 64-seed candidate는 262,144번의 exploration opportunity에서 optional decision 55,086회, 약 21.0%를 만든다. back-to-back optional decision은 0이고 중앙 간격은 4회다.

구성은 대략 다음과 같다.

- scout 28,509회, 약 10.9%
- campfire 15,327회, 약 5.8%
- general narrative 11,250회, 약 4.3%

일반 narrative만 낮춰서는 체감 빈도가 충분히 줄지 않는다. mandatory story와 boss challenge는 progression authority이므로 frequency tuning 대상에서 제외한다. 다음 event-axis candidate의 목표는 optional decision 약 15~18%, 중앙 간격 5~7회다. 실제 candidate 값은 production rhythm simulator로 정한다.

Event reward도 occurrence와 분리한다. 13개 chain에는 relic 11회, item 9회, stat bonus 9회, gold reward 17회가 있으며 최고 gold reward는 15,000G다. deep chain의 one-time reward와 반복 가능한 encounter reward를 같은 budget으로 다루지 않는다.

## 4. Balance Principles

### 4.1 Failure remains credible

- common과 uncommon은 사망을 직접 무효화하지 않는다.
- failure-rule override는 최소 epic으로 분류한다.
- legendary 생존 효과도 run-wide인지 combat-wide인지 copy와 runtime이 일치해야 한다.
- 같은 combat에서 복수 revive가 가능한 synergy는 별도 scenario로 검증한다.

### 4.2 Strong choices need a condition or cost

- unconditional multiplier는 같은 rarity의 conditional effect보다 낮아야 한다.
- low-HP, execute, combo, status, dual-wield, abyss 전용 효과는 조건 달성률과 함께 평가한다.
- 생명이나 기력을 지불하는 선택은 실제 effective max HP/MP authority를 사용한다.

### 4.3 Rarity controls access, not only color

- rarity는 weighted offer probability와 시작 유물 포함 여부를 결정한다.
- 같은 effect와 같은 value가 서로 다른 rarity에 있으면 의도와 차이를 명시한다.
- rarity-only release에서는 effect value를 바꾸지 않는다.

### 4.4 Builds remain diverse

- signature는 모든 직업의 보편적 최강 장비가 아니라 특정 build를 여는 선택이어야 한다.
- one-hand, two-hand, dual-wield, focus, shield는 각자의 공격·방어·resource trade-off를 유지한다.
- 어느 직업도 동일 level band에서 구조적으로 항상 더 빠른 성장이나 더 안전한 combat을 얻지 않는다.

### 4.5 Event frequency and reward are separate axes

- optional surface frequency를 낮추는 release에서는 reward를 변경하지 않는다.
- reward를 조정하는 release에서는 event chance와 spacing을 변경하지 않는다.
- mandatory story, boss telegraph, true-ending progress는 optional frequency target에 포함하지 않는다.

## 5. Balance Evidence Architecture

새로운 runtime framework를 만들지 않는다. 기존 catalog와 production functions를 읽는 세 개의 pure report를 추가한다.

### 5.1 Relic balance report

각 유물을 다음 category로 분류한다.

- baseline stat
- conditional offense or defense
- resource and economy
- failure-rule override
- per-combat scaling
- per-run scaling
- exploration pacing
- abyss-only

Report는 rarity, weight, starting-pool eligibility, synergy, runtime owner, duplicate effect/value, cap과 reset scope를 기록한다. Combat scenario는 18 jobs와 representative level bands에서 baseline과 candidate의 death rate, turns, HP remaining, MP use, lethal events prevented를 비교한다.

단일 종합 점수로 자동 판정하지 않는다. 사망 방지와 gold multiplier를 같은 숫자로 환산하면 잘못된 결론을 만들기 때문이다.

### 5.2 Equipment budget report

Equipment budget은 slot별로 계산한다.

- weapon: effective ATK, hands, critical chance, element, job breadth
- armor: effective DEF, HP, evasion, job breadth
- offhand: DEF, MP, critical chance, subtype, weapon pairing
- signature: canonical identity, source, build restriction

각 tier에서 median과 corridor를 만들고 outlier를 `intentional`, `price-only defect`, `combat-power defect`, `specialized sidegrade`로 분류한다. Unknown job, invalid tier, non-finite stat, impossible equip requirement는 fail closed한다.

Equipment stat 변경 전에 instance migration contract를 먼저 만든다. Owned equipment는 full object로 저장되므로 canonical base item을 안전하게 식별하고 prefix, enhance, generated ID 같은 instance field를 보존한 채 새 base balance를 적용할 수 있어야 한다. 식별할 수 없는 legacy item은 삭제하거나 추측하지 않고 blocker로 보고한다.

### 5.3 Event value and rhythm report

기존 exploration rhythm report를 유지하고 reward report를 추가한다.

- optional decision share와 category share
- p10/p50/p90 gap
- back-to-back count
- combat, discovery, nothing 분포
- one-time chain reward와 repeatable encounter reward 구분
- level/location 대비 gold, stat, item tier, relic reward
- choice cost affordability와 result value

Event report는 stored open event를 canonical definition으로 다시 쓰지 않는다. 이미 열린 event는 accepted snapshot으로 끝나며 새 definition은 다음 occurrence부터 적용한다.

## 6. Ordered Release Slices

### Slice 1: Relic rarity coherence

- `불사의 의지`를 epic으로 승격한다.
- 67개 relic report와 exact catalog coverage를 추가한다.
- starting-pool exclusion, weighted choice probability, synergy, save/reload active-run preservation을 검증한다.
- 다른 relic value는 변경하지 않는다.

### Slice 2: Relic effect coherence

- duplicate effect/value와 inverted rarity 후보를 scenario로 비교한다.
- failure override, guaranteed evade, unbounded scaling, economy multiplier를 각각 분리한다.
- 한 candidate에서는 한 effect family만 변경한다.
- Slice 2A는 `free_skill` copy/runtime/order independence를 닫고, Slice 2B는 common `고대 지도 +60%`와 uncommon `방랑자의 부적 +30%`의 역전을 별도 rhythm candidate로 닫는다.

### Slice 3: Equipment authority and economy

- canonical base/instance migration contract를 먼저 닫는다.
- price-only outlier를 수정한다.
- combat stat은 별도 candidate로 slot과 tier cohort 하나씩 조정한다.

### Slice 4: Consumable decisions

- HP/MP recovery, status cure, combat buff를 별도 cohort로 비교한다.
- boss와 normal combat에서 한 consumable이 다른 action을 지우지 않게 한다.
- inventory pressure와 shop price를 함께 보고하되 한 candidate에서는 recovery 또는 price 중 하나만 변경한다.

### Slice 5: Optional event frequency

- mandatory story와 boss challenge는 유지한다.
- scout를 첫 frequency lever로 사용한다. 현재 optional share의 가장 큰 단일 contributor이기 때문이다.
- candidate가 약 15~18% optional share, p50 gap 5~7, back-to-back 0을 만족하는지 64/1,000 seeds로 검증한다.
- EXP, loot, rewards는 불변이어야 한다.

### Slice 6: Event reward coherence

- chain, bounded encounter, fallback event, campfire, scout를 서로 다른 occurrence class로 평가한다.
- 지역 level과 도달 비용에 맞지 않는 gold, permanent stat, item tier를 수정한다.
- 발생 확률은 불변이어야 한다.

## 7. TDD and Verification

각 slice는 다음 순서를 지킨다.

1. current behavior characterization
2. malformed and replay RED
3. smallest production GREEN
4. focused integration
5. deterministic 64-seed report
6. release candidate 1,000-seed report
7. real browser and 390x844 mobile path
8. repository full gate
9. independent review and ledger/evidence sync

필수 commands는 다음을 포함한다.

- focused balance tests
- `npm run progression:compare` 또는 owning comparison command
- `npm run content:verify`
- `npm run pacing:verify`
- `npm run verify`
- `npm run verify:full`
- `npm run art:verify`
- `npm run mobile:doctor`
- `npm run cap:sync`
- `git diff --check`

Native packaging은 player-facing data 또는 bundled assets가 바뀐 cohesive candidate에서 실행한다. signing, device connection, Toss console action은 기존 external approval boundary를 유지한다.

## 8. Fail-Closed Rules

- report가 catalog 전체를 덮지 못하면 candidate를 거부한다.
- non-finite stat, unknown effect, duplicate ID, invalid rarity, unknown job, impossible tier를 거부한다.
- candidate와 predecessor가 둘 이상의 axis에서 다르면 거부한다.
- deterministic report hash가 재현되지 않으면 거부한다.
- hard correctness가 false거나 blocker가 남으면 activation 또는 release claim을 하지 않는다.
- 실제 save를 재수화할 수 없는 equipment change는 적용하지 않는다.
- event frequency 변화가 EXP, loot 또는 reward value를 바꾸면 거부한다.

## 9. Rollback and Commit Boundaries

Balance catalog entry와 evidence는 immutable predecessor/candidate pair로 남긴다. Rollback은 이전 data commit을 선택하며 반대 수치로 새 counter-patch를 만들지 않는다.

관련 변경은 다음 cohesive commit 경계로 나눈다.

1. relic rarity and audit
2. relic effect family
3. equipment migration and price
4. equipment combat cohort
5. consumables
6. event frequency
7. event rewards and evidence

기존 combat UI follow-up, `docs/evidence/toss/releases/`, `build/`, native generated output은 balance commit에 섞지 않는다. Commit, push, release는 각각 명시적 승인 뒤 수행한다.

## 10. Completion Criteria

전체 프로그램은 다음 조건을 모두 만족해야 완료다.

- 67개 relic, 229개 equipment, 14개 consumable이 exact audit coverage에 포함된다.
- 52개 region과 모든 event class가 rhythm/value report에 포함된다.
- `불사의 의지`는 새 offer에서 epic이고 시작 유물에 나타나지 않으며 effect는 그대로다.
- 같은 effect의 rarity/value mismatch는 의도 또는 candidate로 분류된다.
- equipment outlier는 specialized sidegrade 또는 defect로 설명된다.
- optional event frequency는 승인 target 안에 있고 mandatory progression은 유지된다.
- 18 jobs의 representative combat matrix에서 invalid numeric과 truncated run은 0이다.
- save/reload, active run, reset, ascend, replay contract가 깨지지 않는다.
- automated full gate와 실제 mobile surface가 GREEN이다.
- fresh human play evidence 전에는 재미와 retention 개선을 완료로 주장하지 않는다.
