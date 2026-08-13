# Aetheria Repository-Owned Game Completion Plan

Date: 2026-08-13 KST

## Outcome

Apps in Toss 작업을 다시 시작하기 전에 저장소 안에서 완성할 수 있는 게임 기능과
밸런스 계약을 끝낸다. 현재 검증된 relic, equipment economy, combat mobile 수정은
먼저 하나의 immutable checkpoint로 고정한다. 이후에는 한 release에서 한 축만
바꾸고, 각 slice를 별도 Native Goal과 writer lease로 실행한다.

물리 기기, signing, store upload, Toss console, 광고 활성화와 공개 출시는 이 계획의
완료 조건이 아니다. 해당 작업은 repository candidate가 완성된 뒤에도 각각 별도
승인을 요구하는 external gate다.

## Current Boundary

현재 branch는 `codex/release-complete-core`, base commit은 `3a2407a`다. 그 위의 dirty
worktree에는 다음 완료 작업이 함께 있다.

- mobile combat log/action ordering과 stale phase banner 제거
- relic rarity Slice 1
- relic `free_skill` coherence Slice 2A
- relic `event_chance` coherence Slice 2B
- equipment identity, migration, price-only correction Slice 3A
- 해당 audit, verifier, tests, screenshots, plans와 ledgers

기존 dispatch-less coordinator Goal은 `failed / goal-owner-closeout`으로 안전하게
종료됐고 repository lease는 `released`다. 다음 writer Goal을 막는 coordinator lease는
없다. 다만 current dirty paths는 isolated worker의 writable paths와 겹치므로, 후속
writer Goal 전에 반드시 검증된 cohesive checkpoint commit으로 고정해야 한다.

`docs/evidence/toss/releases/`, `build/`, generated native output, credential과 signing
material은 checkpoint와 모든 gameplay balance commit에서 제외한다.

## Execution Rules

1. 한 번에 Native Goal 하나와 writer lease 하나만 사용한다.
2. 각 slice는 `characterization RED -> malformed/replay RED -> smallest GREEN -> focused
   integration -> deterministic evidence -> real 390x844 surface -> full gate -> independent
   review -> ledger sync` 순서로 닫는다.
3. numeric change는 한 release에서 한 axis와 한 cohort만 허용한다.
4. audit에서 hard defect가 없으면 숫자를 바꾸지 않고 audit closure로 끝낸다.
5. existing save와 active-run snapshot을 rewrite하지 않는다. Malformed state는 추측하지
   않고 fail closed한다.
6. rollback은 immutable predecessor commit을 선택한다. 반대 수치의 counter-patch를
   만들지 않는다.
7. commit, push, physical-device action, signing, upload와 publication은 각각 별도 승인
   없이는 실행하지 않는다.

## Slice 0 - Current Dirty Checkpoint

### Scope

- 현재 gameplay/source/test behavior는 바꾸지 않는다.
- current file bytes와 evidence hash, artifact hash, Goal/lease 상태, task ledger를 맞춘다.
- balance/content/pacing/art verifier와 full web/mobile/native regression을 다시 실행한다.
- explicit-path review 뒤 승인된 경우에만 cohesive commit을 만든다.

### Acceptance

- current balance verifiers 전부 GREEN
- `npm run verify`, `npm run verify:full`, `npm run art:verify` GREEN
- `npm run mobile:doctor`, `npm run cap:sync`, Android debug와 unsigned iOS device build GREEN
  또는 정확한 environment-only blocker 기록
- evidence와 문서의 SHA-256이 실제 파일과 일치
- staged/commit paths에 Toss evidence, build, Android/iOS generated drift, secrets 0
- commit 후 clean tree와 새 immutable baseHead

## Slices 1-4 - Relic Duplicate Effect Families

### Current production authority found during checkpoint intake

- `gold_mult` is currently first-match in `CombatEngine.handleVictory`.
- `drop_rate` is currently first-match in `processLoot`, including enriched and legacy
  drop paths.
- `dot_mult` is currently first-match in skill status-damage settlement.
- `hp_drain_atk` is split: `calculateFullStats` adds every attack bonus, while turn
  settlement charges only the first matching relic's HP cost and uses a fixed relic
  label. This is an incoherent trade-off pair, not an approved stacking policy.

These observations are characterization inputs, not permission to alter catalog values.
Each Goal must first prove the current mismatch with production-path tests, then move only
that family to the approved policy.

각 effect family를 별도 Goal로 처리한다.

1. `gold_mult`: strongest-only
2. `drop_rate`: strongest-only
3. `dot_mult`: strongest-only
4. `hp_drain_atk`: 선택된 한 relic의 attack bonus와 HP cost를 paired transaction으로 적용

각 Goal은 두 보유 순서의 equality, legacy snapshot preservation, malformed finite-value
rejection, exact threshold, save/reload와 reducer replay를 검증한다. Catalog numeric value는
별도 승인 없이 바꾸지 않는다.

## Slice 5 - Equipment Combat-Power Audit

229개 equipment를 weapon 117, armor 91, shield/focus 21로 exact coverage한다. Effective
ATK/DEF, hands, HP/MP, critical/evasion, element, job breadth와 signature identity를 slot/tier
cohort로 비교한다.

모든 outlier는 `intentional`, `specialized-sidegrade`, `price-only-defect`,
`combat-power-defect` 중 하나로 분류한다. 이 slice에서는 stat을 바꾸지 않는다. 실제
combat-power defect가 확인되면 해당 slot+tier 한 cohort만 새 Sol xhigh re-plan으로 연다.

## Slice 6 - Consumable Decision Authority

14개 consumable을 HP recovery 4, MP recovery 3, status cure 4, combat buff 3으로 exact
coverage한다. Production `USE_COMBAT_ITEM` transaction을 사용해 normal/boss representative
encounter에서 recovery, action cost, inventory pressure, shop price, quick-slot availability와
survival impact를 비교한다.

Replay는 exact no-op이어야 하고 `noPotion`, save compatibility와 inventory cap은 유지한다.
Full heal 또는 `all_up 1.5`가 다른 action을 지우는 hard defect가 확인될 때만 recovery 또는
price 중 한 axis를 별도 candidate로 조정한다.

Checkpoint intake confirmed one hard authority defect: non-combat inventory consumption
rejects `noPotion`, but combat `USE_COMBAT_ITEM` currently accepts the same HP/MP/cure/buff
items. The consumable Goal must start with a reducer-level RED proving combat bypass, then
make both paths share the same challenge restriction without trusting the UI. It must also
prove that a rejected item consumes neither inventory nor combat turn and causes no enemy
counterattack.

## Slice 7 - Optional Event Frequency

현재 production rhythm을 fresh audit한 뒤 scout만 첫 lever로 사용한다. Candidate 기본안은
`SCOUT_CHANCE 0.15 -> 0.08`이며 campfire `0.08`, event profile `0.8`, minimum ordinary gap
`1`, relic bonuses, EXP, loot와 reward bytes는 고정한다.

64 seeds와 1,000 seeds 모두 optional share `15-18%`, p50 gap `5-7`, back-to-back `0`을
만족해야 한다. Mandatory story와 boss priority는 불변이다. 목표를 벗어나면 다른 global
lever를 함께 바꾸지 않고 re-plan한다.

## Slice 8 - Event Reward Coherence

13 chains/39 steps, bounded encounters, campfire, scout와 fallback event를 occurrence class로
분리한다. One-time chain과 repeatable reward를 따로 평가하고 location level, reach cost,
gold, permanent stat, item tier, relic, buff와 choice affordability를 검증한다.

Unknown reward type/item/relic, silent loss와 non-finite value는 0이어야 한다. Frequency bytes는
불변이다. Hard defect가 확인되면 occurrence class 하나와 reward axis 하나만 새 candidate로
수정한다.

## Slice 9 - Final Repository Candidate

최종 candidate는 다음 journey를 production UI와 reducer authority로 증명한다.

- fresh start, first move, exploration, event, combat, safe return
- shop, consumable, equipment decision, job change와 skill branch
- save/reload와 active-run legacy relic/equipment snapshot
- defeat, manual reset, ascension, True Ending와 New Game+
- 390x844 combat log/action order와 phase-banner closure

Required gates:

```bash
npm run relic:verify
npm run relic:free-skill:verify
npm run relic:event-chance:verify
npm run equipment:economy:verify
npm run content:verify
npm run pacing:verify
npm run art:verify
npm run verify
npm run verify:full
npm run mobile:doctor
npm run cap:sync
npm run android:debug
npm run ios:build:device
git diff --check
```

Immutable candidate가 생긴 뒤에만 five fresh human journeys를 시작한다. `5/5`, P0 `0`,
blocking P1 `0`이 되기 전에는 재미, retention 또는 tuning acceptance를 완료로 주장하지
않는다. Repository-owned slices와 이 human gate가 닫힌 뒤에만 Apps in Toss setup을 다시
검토한다.

## External Gates

- physical Android/iOS observation
- Android release keystore와 signed APK/AAB
- Apple Distribution identity, provisioning profile와 signed archive
- TestFlight/App Store/Google Play upload
- Toss Sandbox/QR/appName/CORS/navigation/ad group/review/publication
- GRAC, business, settlement와 store approval

외부 gate가 없다는 이유로 repository work를 완료로 표시하지 않으며, 반대로 외부 gate가
막혔다는 이유로 app regression을 숨기지 않는다.
