# Aetheria Consumable Balance & Transaction Closure Plan

## Goal

14종 consumable의 회복·버프 수치는 유지하면서, 진행 단계에 맞지 않는 전 품목 Tier 1 노출, 구매보다 손해인 제작식, combat/noncombat 규칙 중복, `noPotion` 우회, Elixir의 `9999` sentinel, 구분하기 어려운 mobile QuickSlot을 하나의 production contract로 닫는다.

난도는 정보에 근거한 보존·사용 타이밍에서 만든다. Full HP/MP, 존재하지 않는 상태이상, 이미 동일하거나 더 강한 buff처럼 효과가 없는 사용은 UI에서 명확히 막고 reducer에서도 fail closed한다. 무효 클릭으로 자원을 잃는 것은 roguelike의 의미 있는 선택으로 보지 않는다. 유효한 combat item은 계속 정확히 한 턴을 소비하고 enemy counter, DoT victory, defeat settlement까지 한 transaction에서 확정한다.

이번 Goal은 consumable data, transaction authority, presentation, deterministic audit/evidence만 변경한다. Drop rate, quest reward, event reward, equipment/relic, native package, Toss release는 바꾸지 않는다.

## Approved catalog

`val`, `effect`, `turn`은 전부 유지한다. Tier와 Hero potion price만 조정한다.

| Item | Effect | Tier | Price | Decision |
| --- | --- | ---: | ---: | --- |
| 하급 체력 물약 | HP +50 | 1 | 30 | starter/early supply |
| 중급 체력 물약 | HP +150 | 2 | 80 | mid supply |
| 상급 체력 물약 | HP +300 | 4 | 150 | late supply |
| 엘릭서 | HP full | 5 | 1500 | `restore: 'full'`, legacy name fallback |
| 하급 마나 물약 | MP +30 | 1 | 40 | starter supply |
| 중급 마나 물약 | MP +80 | 2 | 90 | mid supply |
| 상급 마나 물약 | MP +200 | 4 | 200 | late supply |
| 해독제 | cure poison | 1 | 50 | early cure |
| 치료약 | cure burn | 2 | 50 | mid cure |
| 해빙제 | cure freeze | 3 | 60 | advanced cure |
| 저주해제 주문서 | cure curse | 3 | 100 | advanced cure |
| 분노의 물약 | ATK +30%, 5 turns | 3 | 200 | offensive risk choice |
| 수호의 물약 | DEF +30%, 5 turns | 3 | 200 | defensive risk choice |
| 영웅의 물약 | ATK/DEF +50%, 3 turns | 5 | 3000 | legendary short burst |

`desc`와 `desc_stat`은 위 효과와 exact 일치해야 한다. Elixir의 persisted legacy instance에 `restore`가 없어도 canonical name과 valid hp item shape이면 full heal한다. 새 획득만 새 Tier/price/restore를 가진다. Save migration으로 inventory나 QuickSlot object를 rewrite하지 않는다.

## Approved recipes

Output identity와 수량 schema는 유지하고, replacement cost가 shop output price를 초과하지 않도록 exact input/gold만 조정한다.

| Recipe | Inputs + gold | Replacement / output |
| --- | --- | ---: |
| r5 중급 체력 물약 | 슬라임 젤리×5 + 30G | 55 / 80 |
| r6 해독제 | 독버섯 포자×2 + 20G | 40 / 50 |
| r8 하급 마나 물약 | 박쥐 날개×2 + 5G | 35 / 40 |
| r18 상급 체력 물약 | 트롤의 피×1 + 슬라임 젤리×4 + 40G | 140 / 150 |
| r19 상급 마나 물약 | 마나 결정×1 + 박쥐 날개×2 + 50G | 180 / 200 |
| r20 분노의 물약 | 화염의 결정×1 + 트롤의 피×1 + 10G | 190 / 200 |
| r21 수호의 물약 | 냉기의 결정×1 + 강화 재료×1 + 40G | 180 / 200 |
| r22 영웅의 물약 | 용의 심장×1 + 엘프의 눈물×1 + 500G | 2700 / 3000 |

Material valuation은 canonical item price를 사용한다. Equipment recipe와 synthesis formula는 불변이다.

## Transaction authority

새 pure `consumableEffect` module이 다음을 단일 소유한다.

- `hp | mp | cure | buff` schema validation
- non-finite/negative `val`, invalid `effect`, invalid `turn`, malformed full-restore rejection
- `noPotion` challenge의 네 종류 전체 차단
- effective max HP/MP authority를 사용한 heal/mana cap
- target status가 있는 cure만 적용
- 동일하거나 더 강하고 남은 turn이 더 긴 active buff에 대한 no-effect 판정
- inventory instance 하나 제거와 success log projection
- legacy Elixir full restore compatibility

Combat과 noncombat reducer는 action의 `itemId`로 현재 inventory instance를 다시 찾고 pure resolver를 호출한다. UI payload의 `val/effect/turn`은 신뢰하지 않는다.

- 유효한 noncombat 사용: effect + inventory removal + QuickSlot cleanup + expedition vitals tracking 한 transaction.
- 유효한 combat 사용: item effect 후 tick, enemy counter, DoT victory/defeat, turn/receipt/QuickSlot을 한 transaction.
- 무효/차단/손상 item: reducer exact no-op. Hook/presentation은 player-facing reason을 표시하지만 state authority는 reducer다.
- Replay/stale `expectedTurn`/duplicate rapid click: exact no-op.
- Buff refresh/overwrite는 더 강하거나 남은 duration을 실제로 개선할 때만 허용한다.

## Reachability and compatibility

- Tier는 stock/daily filtering에만 영향을 준다. Existing drop, quest, season, AI/event, bounded encounter, return-supply routes는 그대로 둔다.
- Daily deal의 기존 one-step preview는 유지한다. 이를 없애면 equipment policy까지 변경되므로 별도 re-plan이다.
- `return-supply:<expeditionId>` receipt와 `하급 체력 물약` reward identity는 불변이다.
- `ConsumableItem` type은 실제 runtime discriminator인 `hp | mp | cure | buff`와 optional `restore`를 표현한다.
- QuickSlot은 `HP50/HP150/HP300/HP∞`, `MP30/MP80/MP200`, `해독/화상/해빙/저주`, `ATK/DEF/ALL`로 식별한다. Full name, effect, combat turn cost는 accessible label/title에 남긴다.
- Shop cure copy는 raw token 대신 한국어 상태명을 사용한다.

## Ordered RED → GREEN

1. Catalog RED: 14 exact identities, tier/price/effect/copy, eight recipe economics, first stock/daily reachability를 literal로 고정한다.
2. Data GREEN: `items.ts`와 `ConsumableItem`만 최소 수정하고 drop/quest/event/return source hashes 불변을 증명한다.
3. Authority RED: combat/noncombat shared vectors, `noPotion` bypass, malformed save, Elixir, effectless use, buff overwrite, counter/DoT victory/defeat, replay를 고정한다.
4. Authority GREEN: shared pure resolver를 두 reducer/hook에 연결하고 duplicated effect formula를 제거한다.
5. Presentation RED→GREEN: QuickSlot/cure copy와 390×844 shop/use/block/reload scenario를 production reducer로 검증한다.
6. Evidence: canonical JSON을 atomic `--write` 한 번 생성하고 `--verify` exact-byte read-only로 재확인한다. Mutation/no-write/path/symlink/trailing-byte guard를 포함한다.
7. Owner verification 후에만 ledger와 completion evidence를 동기화한다.

## Writable paths

Production:

- `src/data/items.ts`
- `src/types/item.ts`
- `src/systems/consumableEffect.ts`
- `src/utils/consumablePresentation.ts`
- `src/systems/combatItemTurn.ts`
- `src/reducers/handlers/combatHandlers.ts`
- `src/reducers/handlers/equipmentHandlers.ts`
- `src/hooks/combatActions/combatItem.ts`
- `src/hooks/useInventoryActions.equipment.ts`
- `src/components/QuickSlot.tsx`
- `src/components/ShopPanel.tsx`
- `src/data/messages.ts`

Audit/tests/evidence:

- `src/systems/consumableBalanceAudit.ts`
- `scripts/verify-consumable-balance.mjs`
- `tests/consumable-balance-audit.test.js`
- `tests/consumable-transaction-coherence.test.js`
- `tests/combat-item-transaction-authority.test.js`
- `tests/equipment-transaction-authority.test.js`
- `tests/economy-transaction-authority.test.js`
- `tests/data-migration.test.js`
- `tests/e2e/consumable-balance.spec.ts`
- `package.json`
- `docs/evidence/qa/release-complete-core/consumable-balance.json`
- `docs/evidence/qa/release-complete-core/screenshots/consumable-shop-mobile.png`
- `docs/evidence/qa/release-complete-core/screenshots/consumable-quickslot-mobile.png`

Ledger files are GPT A owner-only after canonical full verification:

- `tasks/todo.md`
- `progress.md`
- `docs/evidence/qa/release-complete-core/completion-summary.md`
- `docs/evidence/qa/release-complete-core/requirement-matrix.md`

## Verification

Focused worker gates:

```bash
node --import tsx --test \
  tests/consumable-balance-audit.test.js \
  tests/consumable-transaction-coherence.test.js \
  tests/combat-item-transaction-authority.test.js \
  tests/equipment-transaction-authority.test.js \
  tests/economy-transaction-authority.test.js \
  tests/data-migration.test.js \
  tests/status-cycle.test.js \
  tests/shop-cycle.test.js \
  tests/drop-cycle.test.js \
  tests/loot-cycle.test.js \
  tests/content-reachability.test.js \
  tests/expedition-return-flow.test.js \
  tests/rewarded-ad-transaction.test.js \
  tests/permanent-progress.test.js

node --import tsx scripts/verify-consumable-balance.mjs \
  --verify docs/evidence/qa/release-complete-core/consumable-balance.json
npx tsc --noEmit
npm run lint -- --quiet
git diff --check
```

Owner canonical gates:

```bash
npm run equipment:combat-power:verify
npm run equipment:economy:verify
npm run relic:verify
npm run content:verify
npm run pacing:verify
npm run art:verify
npm run verify
npm run verify:full
npm run mobile:doctor
npm run cap:sync
git status --short -- android ios
git diff --check
```

Existing verifier drift is a re-plan signal. Evidence를 자동 덮어써 숨기지 않는다.

## Rollback and approval boundaries

- Rollback은 exact writable receipt의 inverse patch만 사용한다. Save migration은 없으므로 persisted inventory를 되돌릴 별도 migration이 없다.
- Isolated worker가 canonical dirty snapshot을 재현하지 못하거나 writable path를 벗어나면 sync하지 않고 re-plan한다.
- `docs/evidence/toss/releases/`, `build/`, `android/`, `ios/`는 수정·stage하지 않는다.
- Commit, push, merge, dependency/runtime installation, signing, device delivery, Toss upload/publication은 별도 승인 없이는 수행하지 않는다.
