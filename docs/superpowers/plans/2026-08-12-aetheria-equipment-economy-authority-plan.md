# Aetheria Equipment Economy Authority — Slice 3A Plan

Date: 2026-08-12 KST

Status: Approved program; active Native Goal implementation plan

Planning owner: GPT A, GPT-5.6 Sol xhigh

Execution owner: Orca GPT B, GPT-5.6 Luna max

## 1. Objective

229개 장비의 가격을 안전하게 조정할 수 있는 canonical base/instance authority를 먼저 만든다. 그 위에서 현재 catalog의 T4/T5 price scale이 끊긴 20개 장비만 economy axis로 교정한다.

이번 slice는 가격과 식별 계약만 바꾼다. 장비 `val`, `hands`, `crit`, `mp`, `mpBonus`, `hpBonus`, `jobs`, `tier`, `elem`, signature identity, drop chance, shop rotation, enhancement formula는 바꾸지 않는다.

## 2. Live constraints

- Canonical equipment는 weapon `117`, armor/offhand `112`, 합계 `229`이며 이름은 모두 고유하다.
- Owned equipment는 canonical row의 full object copy에 runtime `id`, `enhance`, prefix fields가 섞여 저장된다.
- Prefix는 `name`, `val`, `price`, `desc_stat`을 변경하므로 display name만으로 base row를 추측하면 안 된다.
- Shop buy, loot, craft, quest/event reward가 서로 다른 instance creation path를 사용한다.
- Sell은 saved instance의 `price` 절반을 사용한다. Catalog price만 바꾸면 기존 save는 영구적으로 이전 sell value를 유지한다.
- 현재 dirty worktree에는 승인된 relic Slice 1/2A/2B와 combat UI 후속 변경이 있다. Slice 3A는 그 bytes를 보존하고 선언된 writable path 밖을 수정하지 않는다.

## 3. Canonical base identity

### 3.0 Verified predecessor anchor

Current source was re-audited before worker execution. The canonical equipment table is exactly:

- weapon `117`
- armor `91`
- shield/focus `21`
- total `229`, with `229` unique names and no duplicate `type + name` identity

The price discontinuity rule reproduces the declared scope without manual selection:

| Cohort | Rows | Predecessor median | `< 35%` threshold | Declared rows |
|---|---:|---:|---:|---:|
| weapon T4 | 22 | 5,950 | 2,082.5 | 5 |
| weapon T5 | 22 | 29,250 | 10,237.5 | 5 |
| armor T4 | 16 | 4,800 | 1,680 | 5 |
| armor T5 | 21 | 15,000 | 5,250 | 5 |

For the deterministic predecessor anchor, sort rows by UTF-16 code-unit order of
`type + "\\0" + name`, recursively sort object keys by the same order, and hash the
UTF-8 JSON bytes. The full predecessor digest is
`25eac085e5b5f48f44632346fe8b767b50d36b8665166175b3b8fc2fcaf72119`.
Removing only the `price` field from each row yields invariant digest
`9a4bfd472a7ad47c990a00fcf9d949f0c2bab11905d5eb9dd2800170bd2df644`.
The production report may use a narrower explicit field projection, but it must also
retain this complete-row preimage check so a newly added catalog field cannot drift
silently.

### 3.1 Persisted field

`ItemBase`에 optional `baseItemName?: string`을 추가한다. 값은 반드시 prefix가 붙기 전 canonical equipment name이다.

새 equipment instance는 다음 순서로 identity를 가진다.

1. canonical template name을 `baseItemName`으로 복사한다.
2. runtime `id`를 만든다.
3. prefix roll이 성공하면 display `name`, stats, price, copy만 변경한다.
4. `baseItemName`은 바꾸지 않는다.

Consumable과 material에는 이 필드를 추가하지 않는다.

### 3.2 Resolver

새 pure utility `src/utils/equipmentBaseIdentity.ts`가 유일한 base resolver가 된다.

Resolution order:

1. valid `baseItemName`이 있으면 exact canonical equipment name과 type을 대조한다.
2. unprefixed instance는 exact `name + type`으로 대조한다.
3. prefixed legacy instance는 known `prefixName`과 exact `${prefixName} ` prefix를 제거한 이름으로 대조한다.
4. ambiguity, unknown name/type, malformed prefix, unknown prefix는 `unresolved`로 반환한다.

Resolver는 fuzzy match, suffix match, edit distance, first match를 사용하지 않는다. Canonical catalog에 duplicate name/type이 있으면 report 전체가 fail closed한다.

### 3.3 Price-only rebase

이번 slice의 migration은 resolved instance에 다음 두 필드만 적용한다.

- `baseItemName`: canonical base name
- `price`: canonical price, 또는 prefixed instance라면 `floor(canonical price × canonical prefix price multiplier)`

`id`, `name`, `enhance`, `prefixed`, `prefixName`, `val`, secondary stats, description, generated fields와 unknown extension fields는 byte-equivalent value로 보존한다.

Unresolved legacy equipment는 삭제하거나 추측하지 않고 그대로 보존한다. Pure resolver/audit에서는 stable blocker reason을 반환한다. Migration replay는 deep-equal이어야 한다.

## 4. Approved price-only candidate

다음 20개만 변경한다. 숫자는 같은 type/tier cohort의 현재 corridor와 stat ordering을 복원하되 combat power는 바꾸지 않는 보수적 값이다.

| Cohort | Item | Before | Candidate |
|---|---|---:|---:|
| weapon T4 | 암흑 단검 | 1,000 | 4,500 |
| weapon T4 | 빙결 지팡이 | 1,100 | 5,200 |
| weapon T4 | 에테르 검 | 1,200 | 5,500 |
| weapon T4 | 폭풍의 창 | 1,400 | 6,000 |
| weapon T4 | 용암 대검 | 1,500 | 7,000 |
| weapon T5 | 차원절단자 | 2,500 | 22,000 |
| weapon T5 | 빙하의 지팡이 | 2,800 | 24,000 |
| weapon T5 | 파멸의 검 | 3,000 | 24,000 |
| weapon T5 | 성스러운 창 | 3,500 | 23,500 |
| weapon T5 | 용의 화염 | 4,000 | 25,500 |
| armor T4 | 암영 망토 | 900 | 4,000 |
| armor T4 | 상급 폭풍 로브 | 1,000 | 4,500 |
| armor T4 | 빙화 경갑 | 1,100 | 4,500 |
| armor T4 | 에테르 갑옷 | 1,200 | 4,900 |
| armor T4 | 용암 판금갑 | 1,500 | 5,400 |
| armor T5 | 공허의 전투 외투 | 2,000 | 12,000 |
| armor T5 | 차원의 로브 | 2,500 | 13,500 |
| armor T5 | 천상의 갑옷 | 3,000 | 14,500 |
| armor T5 | 별빛 경갑 | 3,500 | 13,500 |
| armor T5 | 용비늘 갑주 | 4,000 | 16,500 |

The candidate must prove:

- exactly 20 canonical `price` fields differ from the predecessor table;
- every other canonical field for all 229 equipment rows is identical;
- T4/T5 weapon and armor cohort price-scale discontinuities fall to zero;
- shield/focus rows and T1–T3/T6 prices are unchanged;
- daily/weekly discounts remain exactly 10%/15% from the new canonical price;
- sell remains exactly 50% of the migrated instance price.

## 5. Deterministic audit

Add `src/systems/equipmentEconomyAudit.ts`, `scripts/verify-equipment-economy.mjs`, and tracked evidence `docs/evidence/qa/release-complete-core/equipment-economy.json`.

The report covers exactly all 229 equipment rows and records:

- name, type, tier, price, hands, primary value and secondary-stat fields;
- job breadth, signature status, shop reachability and artwork route;
- cohort count, min, median, max and price-to-primary-stat corridor;
- the exact 20 predecessor/candidate corrections;
- catalog schema errors and canonical instance-resolution errors;
- an invariant digest excluding `price` and a full candidate digest.

T4/T5 weapon/armor rows below `35%` of their predecessor cohort median are classified as `price_scale_discontinuity`. The predecessor table must yield exactly 20 declared discontinuities. The candidate must yield zero undeclared discontinuities.

The CLI accepts exactly one mode:

- `--write <canonical evidence path>`
- `--verify <canonical evidence path>`

It rejects unknown/duplicate flags, traversal, absolute/backslash/dot paths, symlink ancestors and non-canonical output roots. Verify compares complete bytes and does not write.

## 6. TDD slices

### Step 1 — Catalog and resolver RED → GREEN

Files:

- `src/types/item.ts`
- `src/utils/equipmentBaseIdentity.ts`
- `tests/equipment-economy-authority.test.js`

Contracts:

- exact 229 coverage and unique canonical name/type;
- direct, tagged and legacy prefixed resolution;
- malformed/unknown/ambiguous identity fail closed;
- equipment-only base tagging;
- no mutation of caller objects.

### Step 2 — Instance creation and migration RED → GREEN

Files:

- `src/utils/gameUtils.ts`
- `src/utils/itemPrefixUtils.ts`
- `src/systems/CombatEngine.loot.ts`
- `src/utils/dataMigration.ts`
- `tests/equipment-economy-authority.test.js`
- `tests/data-migration.test.js`

Contracts:

- shop, loot, craft and reward equipment instances receive the same base identity;
- unprefixed, prefixed, enhanced, equipped and inventory instances preserve runtime fields;
- prefixed prices replay the canonical multiplier once, never twice;
- unknown legacy rows survive unchanged with stable unresolved evidence;
- migrate twice equals migrate once.

### Step 3 — Price candidate and audit RED → GREEN

Files:

- `src/data/items.ts`
- `src/systems/equipmentEconomyAudit.ts`
- `scripts/verify-equipment-economy.mjs`
- `tests/equipment-economy-audit.test.js`
- `package.json`
- `docs/evidence/qa/release-complete-core/equipment-economy.json`

Contracts:

- exact 20-price diff and zero combat/catalog field drift;
- no non-finite/negative price, invalid tier/job/type or missing route;
- shop discounts, buy transaction and sell transaction use canonical/migrated authority;
- report and CLI are deterministic and fail closed under mutation.

### Step 4 — Real 390×844 surface

Files:

- `tests/e2e/equipment-economy.spec.ts`
- `docs/evidence/qa/release-complete-core/screenshots/equipment-economy-390x844.png`

Do not add another test API method. Seed a complete legacy player snapshot through the existing isolated `item-investment` device-QA storage namespace before boot. Let production `migrateData`, command handling and reducer transactions open and operate the shop. Production save keys must remain untouched.

The browser pass must prove:

- corrected canonical prices for at least one T4 and one T5 row;
- purchase uses the displayed price exactly once and the new instance has canonical base identity;
- boot exercised the real legacy snapshot migration rather than a post-boot state setter;
- normal next gameplay remains available;
- 390×844 has no document/panel overflow and actionable targets are at least 44 CSS pixels;
- screenshot is captured only after transaction and geometry assertions pass.

## 7. Verification

Run in this order:

```bash
node --import tsx --test tests/equipment-economy-authority.test.js tests/equipment-economy-audit.test.js tests/data-migration.test.js tests/economy-transaction-authority.test.js tests/shop-offer-authority.test.js
npm run equipment:economy:verify
npx playwright test tests/e2e/equipment-economy.spec.ts --reporter=line
npm run relic:verify
npm run relic:free-skill:verify
npm run relic:event-chance:verify
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

If an exact named existing test file does not exist, use the owning current test file and record the substitution; do not invent a pass.

## 8. Acceptance criteria

1. Canonical audit covers `229/229` equipment with no duplicate name/type, invalid numeric, unknown job/type/tier or missing art/shop route.
2. Exactly 20 approved prices change; no combat stat or non-price catalog field changes.
3. New shop/loot/craft/reward equipment receives a canonical base identity.
4. Existing direct, prefixed and enhanced equipment migrates without losing id, enhancement, prefix, stats or extension fields.
5. Existing prefixed sell value uses the corrected canonical base price and the same prefix multiplier exactly once.
6. Unresolved legacy equipment is preserved and reported, never guessed or deleted.
7. Migration and reducer replay are idempotent.
8. Evidence bytes and SHA-256 reproduce exactly and mutation tests fail closed without writing.
9. The real 390×844 shop surface displays and transacts corrected prices without overflow.
10. Full web/mobile/native gates are GREEN or an exact environment-only blocker is reported.
11. Existing relic, event rhythm, content reachability and art evidence remain byte-valid.
12. `build/`, Toss releases, unrelated combat UI files, secrets, commit, push, publish and release remain untouched.

## 9. Rollback

Rollback is the predecessor catalog and migration/audit unit as one cohesive revert. Do not publish a counter-price patch. Because migrated instances retain canonical base identity, a rollback build can deterministically restore predecessor prices through the same resolver.

Commit and push remain separately approval-gated after independent GPT A verification.
