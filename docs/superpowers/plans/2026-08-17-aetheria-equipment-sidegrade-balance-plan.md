# Aetheria Equipment Sidegrade Balance Plan

## Goal

229개 canonical 장비의 production combat-power audit가 확인한 네 개의 strict dominance를 제거한다. 단순 ATK/DEF 상향으로 power creep를 만들지 않고, 회피·치명타·MP라는 기존 runtime dimension을 사용해 각 장비가 고유한 선택 이유를 갖게 한다.

이번 단계는 장비 네 개와 그에 결합된 audit/economy evidence만 다룬다. consumable, optional event, event reward, relic, save schema, art asset, native packaging은 바꾸지 않는다.

## Approved balance decisions

| Item | Unchanged primary | Added identity | Player-facing copy |
| --- | ---: | ---: | --- |
| 레인저 외투 | DEF 13 | evasion 0.03 | `DEF+13 / 회피+3%` |
| 독아 채찍 | ATK 47 | crit 0.09 | `ATK+47(독) / CRIT+9%` |
| 성운 지팡이 | ATK 195 | mpBonus 20 | `ATK+195(빛) / MP+20 / 2H` |
| 폭풍 스태프 | ATK 56 | mpBonus 10 | `ATK+56(빛) / MP+10 / 2H` |

Straight primary-stat 대안은 사용하지 않는다. 네 장비가 기존 상위 장비를 다시 지배하지 않으면서 avoidance, burst, resource capacity라는 서로 다른 build choice를 만드는 것이 목표다. `신전 도시의 지팡이`의 signature identity, `val: 188`, celestial set multiplier는 불변이다.

## Architecture and authority

- `src/data/items.ts`가 네 canonical row와 player-facing `desc_stat`의 단일 source다.
- `calculateFullStats`와 enemy evasion runtime을 그대로 사용하며 새 formula를 만들지 않는다.
- `buildEquipmentCombatPowerReport`가 exact production delta와 dominance의 authority다.
- Economy predecessor는 기존 price correction 이전 row에 이번 네 stat까지 섞어 재정의하지 않는다. 네 row의 pre-sidegrade shape를 exact projection으로 복원한 뒤 기존 price predecessor를 계산한다.
- Art identity는 `name/type/tier/elem/family`만 사용하므로 PNG, batch, manifest, provenance는 재생성하지 않는다. `art:verify`만 실행한다.
- Existing active-run item instance를 migration으로 rewrite하지 않는다. 새 획득 canonical item만 새 secondary stat을 갖는다.

## Ordered implementation

### 1. RED: live identity contracts

`tests/equipment-combat-power-audit.test.js`에서 다음을 먼저 실패시킨다.

- 네 primary stat, price, jobs, hands, element는 불변이다.
- 새 secondary stat과 exact Korean copy가 존재한다.
- effective delta는 ranger evasion `0.03`, whip crit `0.05`, nebula MP `62/69`, storm MP `31/36`이다.
- `dominancePairs`, `combatPowerDefects`, `replanCohorts`가 모두 비고 `requiresReplan=false`다.
- final classifications는 `in-corridor 154 / intentional 16 / price-only 9 / specialized-sidegrade 50 / combat-power-defect 0`이다.
- 각 secondary field를 제거하면 정확히 기존 domination pair가 복원된다.
- signature staff effective attack와 signature flag는 바뀌지 않는다.

### 2. GREEN: three bounded gameplay slices

1. 레인저 외투에 `evasion: 0.03`과 copy를 추가한다.
2. 독아 채찍에 `crit: 0.09`와 copy를 추가한다.
3. 성운 지팡이와 폭풍 스태프에 `mpBonus`와 copy를 추가한다.

각 slice 뒤 해당 pair가 사라지고 새 strict dominator가 생기지 않는지 focused test로 확인한다. Combined report가 네 pair를 모두 제거한 뒤에만 evidence를 갱신한다.

### 3. Economy provenance

`equipmentEconomyAudit`에 네 row의 exact pre-sidegrade projection과 candidate projection을 명시한다. predecessor 복원은 추가된 key를 실제로 삭제해 원래 byte shape를 보존한다.

- 기존 20개 price correction과 price migration authority는 불변이다.
- predecessor digest와 pre-sidegrade price-removed invariant는 유지한다.
- candidate digest만 새 canonical row에 맞게 갱신한다.
- 다섯 번째 stat 변경, 잘못된 수치/copy, predecessor key 잔존은 fail closed한다.

### 4. Evidence and verifier

Combat-power verifier는 더 이상 known-defect inventory를 승인하지 않는다.

- expected pairs `[]`
- expected replan cohorts `[]`
- defects `0`
- `requiresReplan=false`
- exact final classification counts

Combat-power와 economy evidence는 atomic write 한 번 뒤 exact-byte verify한다. Tamper, unsafe path, symlink, verify-mode no-write contracts는 유지한다.

### 5. Repository handoff

검증이 끝난 뒤에만 package script, `tasks/todo.md`, `progress.md`, completion summary, requirement matrix를 현재 사실로 맞춘다. 과거 four-defect audit은 history로 보존하되 live gate가 clean임을 분리해 기록한다.

## Verification

```bash
node --import tsx --test \
  tests/equipment-combat-power-audit.test.js \
  tests/equipment-economy-audit.test.js \
  tests/progression-simulator.test.js \
  tests/progression-comparison.test.js

node scripts/verify-equipment-combat-power.mjs \
  --verify docs/evidence/qa/release-complete-core/equipment-combat-power.json
npm run equipment:economy:verify
npm run content:verify
npm run pacing:verify
npm run art:verify
npm run verify
npm run verify:full
npm run mobile:doctor
npm run cap:sync
git diff --check
git status --short -- android ios
```

Unexpected dominance, signature output change, or content/pacing evidence drift is a re-plan signal. Evidence를 자동으로 덮어써 숨기지 않는다.

## Separate prerequisite: art Python runtime

Bare `python3`가 host마다 Python/Pillow version을 다르게 선택해 PNG normalization hash가 달라질 수 있다. 이 문제는 장비 숫자와 독립된 후속 Goal로 처리한다.

- expected Python `3.12.12`
- expected Pillow `12.1.1`
- runtime checker가 asset inspection/write 전에 fail closed
- dependency installation or runtime replacement는 별도 승인 경계

## Rollback and approval boundaries

- Balance rollback은 네 row, 두 verifier/evidence, economy four-row provenance만 이전 byte로 되돌린다. Save migration은 없다.
- `docs/evidence/toss/releases/`, `build/`, `android/`, `ios/`는 수정·stage하지 않는다.
- Commit, push, signing, device delivery, Toss upload/publication은 별도 명시적 승인 없이는 수행하지 않는다.
