# Aetheria Class Journey Encounter Discovery Design

Date: 2026-08-31 KST
Status: approved in chat; written-spec review pending
Owner and final verifier: GPT A, `gpt-5.6-sol/ultra`

## 1. Goal

Bounded encounter choices should become a durable part of the job journey only after a
safe expedition return. A player who survives an expedition should be able to see which
regional incident the job discovered and which choice was made, without adding a new
menu or changing event frequency, rewards, combat balance, or the existing settlement
authority.

The player-facing outcome is one additional line in the existing Class Journey card:

`사건의 흔적 · 뿌리 아래 공명 결계 · 결계의 흐름을 이어 둔다`

This line appears in the return debrief for the just-completed expedition and in the job
change screen for the job's accumulated journey.

## 2. Product Rules

- `applyBoundedEncounterChoice()` and its receipt remain the only authority for an
  accepted encounter choice.
- A choice is not permanent at settlement time. It becomes a Class Journey discovery
  only when `finishExpedition()` completes a normal safe return.
- Defeat, reset, abandoned expeditions, malformed receipts, rejected choices and replay
  do not add a discovery.
- Repeating the same encounter choice under the same job does not add a second permanent
  discovery. Choosing a different canonical choice is a distinct discovery.
- The same discovery may exist independently under two jobs because Class Journey is a
  job-specific history.
- Class Journey `sequence` continues to count accepted returned expeditions. Encounter
  discoveries never increment it separately.
- The job snapshotted at expedition start owns the discovery even if later state is
  malformed or changes before return.
- No new currency, menu, modal, region, encounter probability, runtime AI, dependency,
  analytics field or native capability is introduced.

## 3. Rejected Alternatives

### Record immediately on choice settlement

This is smaller mechanically, but it records a permanent achievement for a failed or
abandoned run and weakens the roguelike meaning of returning safely. It would also mix
per-choice mutation with the expedition-level Class Journey sequence.

### Derive Class Journey UI directly from the global receipt ledger

This avoids a schema change, but receipts do not own the job relationship. Every UI read
would need to reconstruct expedition ownership from separate ledgers, and future catalog
changes could make old receipts unreadable. The global receipt ledger remains settlement
evidence, not the long-term player-facing history.

### Store only a display string

A single formatted string is easy to render but cannot distinguish the same encounter's
two choices or validate migration. The saved record needs stable canonical identity plus
the historical Korean copy shown to the player.

## 4. Data Contract

Add the following type to `src/types/player.ts`:

```ts
export interface ClassJourneyEncounterDiscovery {
    encounterId: string;
    encounterVersion: number;
    choiceId: string;
    family: string;
    choiceLabel: string;
}
```

Add `encounterDiscoveries: ClassJourneyEncounterDiscovery[]` to both
`ClassJourneyRecord` and `ExpeditionSummary`. `ExpeditionSnapshot` does not gain a field:
the existing receipt key already binds an accepted choice to the active expedition ID.

`ClassJourneyLedger.version` advances from `1` to `2`. This is an additive nested-ledger
migration; the top-level save version does not change. A v1 record migrates to v2 with an
empty discovery list. Existing expedition IDs, branches, signatures, bosses, regions,
representative expedition and timestamp retain their current order and values.

Discovery identity is the tuple:

```text
encounterId + encounterVersion + choiceId
```

`family` and `choiceLabel` are canonical copy captured at safe return. They allow an old
journey to remain readable if a later content version removes or renames the live catalog
entry. They are not used to determine identity or gameplay behavior.

`src/utils/classJourney.ts` exports the shared pure normalizer:

```ts
export const normalizeClassJourneyEncounterDiscoveries = (
    value: unknown,
): ClassJourneyEncounterDiscovery[];
```

Both ledger migration and expedition-summary migration use this function. Encounter and
choice IDs must match `^[a-z0-9][a-z0-9._:-]{0,127}$`; family and choice copy must be
non-empty after trimming. The normalizer returns trimmed copy, preserves first-discovery
order and never consults the current encounter catalog.

## 5. Receipt Projection Boundary

Create `src/utils/boundedEncounterDiscovery.ts` with one production function:

```ts
export const projectBoundedEncounterDiscoveries = (
    eventChainProgress: unknown,
    expeditionId: string,
    encounters?: readonly BoundedEncounter[],
): ClassJourneyEncounterDiscovery[];
```

Production omits the final argument and therefore uses `BOUNDED_ENCOUNTERS`. Tests may
pass a bounded catalog mutation without modifying global data.

The projector follows these rules:

1. A missing or non-object progress value yields an empty array.
2. `boundedEncounterReceipts` must be a plain object. Any other value yields an empty
   array and never blocks safe return.
3. Each candidate receipt must contain string `encounterId` and `choiceId` values.
4. The receipt key must exactly equal
   `buildBoundedEncounterReceiptKey(expeditionId, encounterId, occurrenceSequence)` with
   a positive safe-integer sequence parsed from the final key segment.
5. The encounter ID, version and choice ID must resolve in the supplied canonical pack.
6. Display copy comes from the canonical encounter and choice, never from persisted
   receipt data.
7. Results sort by occurrence sequence, then code-point encounter ID and choice ID.
8. Duplicate discovery identities keep the first accepted occurrence.
9. Malformed, foreign-expedition, unknown and tampered entries are ignored individually.

The projector never calls encounter settlement, consumes RNG, changes receipts, writes a
save, or infers choices from logs.

## 6. Class Journey Normalization

`normalizeClassJourneyLedger()` becomes the only migration and corruption-recovery
authority for the new field.

- It always returns ledger version `2`.
- A missing discovery array becomes `[]`.
- A discovery requires IDs accepted by the exact regex in section 4, a positive
  safe-integer version and non-empty `family` and `choiceLabel` strings.
- Invalid entries are discarded rather than coerced.
- Duplicate identities preserve first-discovery order.
- Merging duplicate normalized job records appends only unseen discovery identities.
- Reserved job keys and global duplicate expedition protection remain unchanged.
- `recordClassJourneyExpedition()` accepts an optional `encounterDiscoveries` array and
  applies the same normalization before append.
- Replaying an already recorded expedition returns the exact original player object,
  even if the replay input contains additional discoveries.

`normalizeExpeditionSummary()` applies the same discovery normalizer so stale or
malformed summary data cannot reach the UI. `permanentProgress`, death, reset, ascension
and ordinary save migration continue to preserve Class Journey through the central
normalizer.

## 7. Safe-Return Transaction

`finishExpedition()` projects discoveries for `snapshot.id` before constructing the
summary. The resulting array is passed to both:

- `summary.encounterDiscoveries`, representing choices made during this expedition;
- `recordClassJourneyExpedition(..., { encounterDiscoveries })`, representing the job's
  accumulated first discoveries.

Both writes occur inside the existing returned-player transition. No separate dispatch
or effect is added. If there is no valid snapshotted job, the summary may retain valid
expedition discoveries but Class Journey remains unchanged, matching the current handling
of other expedition observations.

Receipt projection does not remove or rewrite `eventChainProgress`. Existing replay and
forgery protection therefore remains independently auditable.

## 8. UI Contract

`ClassJourneySummary` selects the display authority in the same way it currently selects
regions, bosses and branches:

- when `latestSummary` exactly matches the representative expedition, use the last
  discovery from that summary;
- otherwise use the last accumulated discovery from the job record.

When a discovery exists, render one additional wrapping body line:

```text
사건의 흔적 · {family} · {choiceLabel}
```

The line uses `data-testid="class-journey-encounter"`. It is omitted when no discovery
exists, preserving the current v1 visual density for legacy players. Raw encounter IDs,
choice IDs, receipt keys and build tags never enter player-visible text or
`render_game_to_text`.

The existing `다음 기록` recommendation keeps its current branch, signature, boss and
region priorities. Once those categories exist but no encounter discovery exists, it
recommends `지역 사건의 선택`; after a discovery it returns to the current broader
exploration recommendation.

No new screen, navigation item, modal, icon asset or animation is added. The return card
remains vertically scrollable and all actions remain reachable at 390x844.

## 9. TDD and Verification

Every implementation task follows `RED -> GREEN -> focused integration -> full gate ->
real surface -> Sol ultra review`.

### Pure projection

- missing and malformed ledgers return an empty array;
- foreign expedition, malformed sequence and receipt-key mismatch are ignored;
- unknown encounter or choice is ignored;
- canonical copy is used instead of receipt-provided copy;
- repeated same choice deduplicates while a different choice remains distinct;
- ordering is deterministic and independent of object insertion order;
- projection does not mutate input or consume RNG.

### Migration and Class Journey

- v1 records become v2 with empty discoveries;
- valid v2 discoveries survive normalization byte-for-byte;
- malformed and duplicate discoveries fail closed;
- duplicate job records merge in first-discovery order;
- one returned expedition increments sequence once regardless of discovery count;
- replay of the same expedition is an exact no-op;
- death, reset and ascension preserve normalized v2 discoveries.

### Expedition integration

- accepted receipt plus safe return records the discovery in summary and job history;
- multiple occurrences of the same choice record once;
- two different choices record twice;
- another expedition's receipt is excluded;
- defeat or an unfinished expedition does not write Class Journey discovery;
- existing branch, signature, boss, region and summary fields remain unchanged.

### Real surface

A 390x844 Playwright journey uses the production test harness to start a real bounded
encounter, settles one canonical choice through the reducer, returns through the normal
movement action and verifies:

- the debrief shows the exact family and choice label;
- the job's Class Journey card shows the same discovery after closing and reopening the
  relevant surface;
- Class Journey sequence changes only once;
- receipt replay does not duplicate the line or sequence;
- the card has no horizontal overflow and the primary action remains reachable.

### Repository gates

```bash
node --import tsx --test \
  tests/bounded-encounter-discovery.test.js \
  tests/class-journey.test.js \
  tests/expedition-ledger.test.js \
  tests/permanent-progress.test.js \
  tests/data-migration.test.js
npx playwright test tests/e2e/expedition-debrief.spec.ts --project=chromium-mobile --workers=1
npx tsc --noEmit
npm run lint
npm run content:verify
npm run pacing:verify
npm run event-reward:verify
npm run progression:diagnostic:verify
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
git status --short -- android ios
git diff --check
```

Event-reward, content, pacing and progression report semantics must remain unchanged.
Progression diagnostic evidence may update only its deterministic source manifest for
new or changed source files. Historical candidate and Toss evidence directories remain
byte-identical and excluded from staging.

## 10. Expected File Boundary

Implementation is expected to touch only the coupled subset of:

- `src/types/player.ts`
- `src/utils/boundedEncounterDiscovery.ts`
- `src/utils/classJourney.ts`
- `src/utils/expeditionLedger.ts`
- `src/components/ClassJourneySummary.tsx`
- `src/hooks/useGameTestApi.ts`
- `tests/bounded-encounter-discovery.test.js`
- `tests/class-journey.test.js`
- `tests/expedition-ledger.test.js`
- `tests/permanent-progress.test.js`
- `tests/data-migration.test.js`
- `tests/e2e/expedition-debrief.spec.ts`
- deterministic evidence files whose declared source manifests change
- `docs/evidence/qa/release-complete-core/completion-summary.md`
- `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- `tasks/todo.md`
- `progress.md`

Material need for a new reducer action, event probability change, top-level save-version
bump, runtime analytics field, new UI surface or broader content refactor is a plan gap.
Implementation stops and returns to Sol ultra re-planning instead of expanding scope.

## 11. Delivery and Approval Boundaries

- The design document, implementation and evidence are separate cohesive checkpoints.
- Commit, push, candidate seal, signing, physical-device acceptance, Apps in Toss work
  and publication each remain separately approved actions.
- A new native Goal starts only after the written spec and implementation plan are
  reviewed against the then-current clean tracked HEAD.
- One implementation writer owns one isolated worktree. Canonical sync requires worker
  evidence, exact-path review and owner verification.
- Human observation remains necessary for release acceptance but does not block local
  implementation or automated verification.
