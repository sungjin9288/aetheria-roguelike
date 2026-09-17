# Aetheria Consumable Transaction Authority Plan

## Purpose

Full consumable balance plan의 첫 slice로, 현재 dirty `items.ts`와 `package.json`을 건드리지 않고 combat/noncombat 사용 규칙을 하나의 production authority로 통합한다. Catalog tier, price, recipe, deterministic balance evidence는 후속 Goal에 남긴다.

## Behavior contract

- `hp | mp | cure | buff`만 consumable로 인정한다.
- `noPotion` challenge는 네 종류를 모두 차단한다.
- Full HP/MP, 대상 status가 없는 cure, 기존 buff가 후보를 완전히 지배하는 경우에는 item이나 combat turn을 소비하지 않는다.
- `NaN`, `Infinity`, 0 이하 수치, invalid effect/turn/restore shape는 fail closed한다.
- Reducer는 payload stat을 신뢰하지 않고 현재 inventory의 `itemId` instance를 다시 조회한다.
- 성공 시 같은 ID를 가진 모든 item이 아니라 정확히 한 instance만 제거한다.
- Legacy `엘릭서`는 `type: hp`, canonical name, positive finite legacy `val`이면 persisted object를 rewrite하지 않고 effective max HP까지 회복한다.
- 유효한 combat item만 turn tick과 enemy counter를 진행하고 DoT victory/defeat receipt까지 한 transaction으로 확정한다.
- Invalid/blocked/effectless direct reducer action은 original state object exact no-op이다. Hook은 같은 resolver preview reason을 한 번 표시하고 dispatch하지 않는다.
- Buff는 기존 buff가 candidate의 ATK/DEF 이득을 모두 이상으로 제공하고 duration도 이상일 때만 차단한다. 실제 trade-off 또는 더 강하거나 더 긴 효과는 허용한다.

## Presentation contract

- HP: `HP50`, `HP150`, `HP300`, `HP∞`
- MP: `MP30`, `MP80`, `MP200`
- Cure: `해독`, `화상`, `해빙`, `저주`
- Buff: `ATK`, `DEF`, `ALL`
- Full name, effect, value, combat turn cost는 `title`과 accessible name에 보존한다.
- Shop cure copy는 raw token이 아니라 `독 해제`, `화상 해제`, `빙결 해제`, `저주 해제`를 사용한다.

## TDD order

1. Pure resolver RED: type/schema, malformed vectors, `noPotion`, effectless use, legacy Elixir, buff dominance.
2. Resolver GREEN: effective max vitals, single-instance removal, deterministic success/reason projection.
3. Reducer/hook RED→GREEN: combat/noncombat parity, stale ID, replay, expectedTurn, rejected action에 enemy counter 없음.
4. Combat settlement regression: valid item으로 defeat, DoT victory, receipt와 QuickSlot cleanup을 유지한다.
5. Presentation RED→GREEN: compact labels, Korean cure copy, accessible detail.
6. Real surface: 390×844에서 starter potion assign, full-HP rejection/no-loss, valid use, shop cure copy, touch target와 overflow를 검증한다.

## Writable paths

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
- `tests/consumable-transaction-coherence.test.js`
- `tests/consumable-presentation.test.js`
- `tests/combat-item-transaction-authority.test.js`
- `tests/equipment-transaction-authority.test.js`
- `tests/e2e/consumable-transaction.spec.ts`

`src/data/items.ts`, `package.json`, all ledger/evidence, existing dirty equipment/relic files, `docs/evidence/toss/releases/`, `build/`, `android/`, `ios/` are read-only.

## Verification

```bash
node --import tsx --test \
  tests/consumable-transaction-coherence.test.js \
  tests/consumable-presentation.test.js \
  tests/combat-item-transaction-authority.test.js \
  tests/equipment-transaction-authority.test.js \
  tests/endgame-settlement.test.js \
  tests/player-state-utils.test.js \
  tests/status-cycle.test.js
npx tsc --noEmit
npm run lint -- --quiet
npx playwright test tests/e2e/consumable-transaction.spec.ts --project=chromium-mobile
git diff --check
```

Canonical sync 후 `npm run verify`, `npm run verify:full`, `npm run mobile:doctor`, `npm run cap:sync`, native drift check를 수행한다.

## Handoff and rollback

- 후속 catalog/economy Goal은 현재 dirty `items.ts/package.json`이 cohesive checkpoint로 정리된 뒤에만 시작한다.
- Worker writable receipt 이탈이나 기존 gate drift는 sync하지 않고 re-plan한다.
- Rollback은 이 Goal의 exact 15-path inverse patch만 사용한다.
- Commit, push, signing, device delivery, Toss upload/publication은 승인하지 않는다.
