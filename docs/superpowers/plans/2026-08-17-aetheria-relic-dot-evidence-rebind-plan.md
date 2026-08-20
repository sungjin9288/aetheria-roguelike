# Aetheria Relic DOT Evidence Rebind Plan

## Outcome

Rebind the immutable `dot_mult` evidence receipt to the current production
`combatHandlers.ts` bytes after the consumable transaction authority change.
The DOT catalog, strongest-only selector, combat vectors, migration behavior,
replay result, and canonical report hash must remain unchanged.

## Root cause

The consumable transaction slice changed only the combat-item branch in
`src/reducers/handlers/combatHandlers.ts`. The existing DOT evidence correctly
hashes that whole reducer because it participates in skill replay settlement.
`npm run verify` therefore fails closed on one stale source SHA even though the
DOT behavior tests and canonical report remain unchanged.

## Scope

The isolated worker may write exactly one path:

- `docs/evidence/qa/release-complete-core/relic-dot-multiplier.json`

All production source, verifier source, tests, package configuration, ledgers,
other evidence, `build/`, native projects, and Toss release evidence are
read-only or excluded. GPT A updates repository ledgers only after the Goal and
full gates pass.

## Ordered execution

1. Record the current HEAD, dirty fingerprint, evidence preimage, and the eight
   source hashes used by the canonical emitter.
2. Reproduce the direct verifier failure and the two expected focused failures.
   Confirm the remaining DOT behavior vectors still pass.
3. Run only the official emitter:

   ```bash
   node scripts/verify-relic-dot-multiplier.mjs \
     --write docs/evidence/qa/release-complete-core/relic-dot-multiplier.json
   ```

4. Structurally compare the preimage and candidate. The only semantic change
   allowed is
   `sourceHashes["src/reducers/handlers/combatHandlers.ts"]`.
5. Verify the immutable report hash remains
   `b123dee8e47f7b405584470bc03087f6e81fbbb98aecfd0ee1bb10068068a204`,
   the current reducer SHA is recorded, all other source hashes are unchanged,
   and the evidence file is exact canonical JSON with one trailing LF.
6. Run the direct verifier, DOT focused tests, DOT plus consumable integration,
   repository `npm run verify`, and `git diff --check`.

## Acceptance criteria

- The DOT report, report hash, catalog, policy, production vectors, malformed
  vectors, migration result, and replay receipt are byte-equivalent to the
  preimage.
- Only the `combatHandlers.ts` source hash changes in the evidence document.
- `npm run relic:dot-multiplier:verify` passes.
- `tests/relic-dot-multiplier-coherence.test.js` passes 10/10.
- DOT plus consumable focused integration passes.
- `npm run verify` passes with no failed unit test.
- The isolated and canonical diffs modify only the one writable evidence path.
- No test, verifier, gameplay source, dependency, native, Toss, commit, push,
  signing, or publication effect occurs.

## Failure and rollback

If any report value, replay value, non-reducer source hash, or behavior test
changes, stop and return to Sol xhigh re-planning without writing canonical
evidence. On a failed sync, restore only the Goal-owned evidence preimage.
Never weaken the verifier or remove `combatHandlers.ts` from the source set.
