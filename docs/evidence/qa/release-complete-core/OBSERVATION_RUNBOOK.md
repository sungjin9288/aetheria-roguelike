# Release-complete candidate observation runbook

This runbook starts only after the cohesive release-complete commit is approved and
created. It does not authorize a Toss upload, review request, publication, ad
activation, signing operation or Store action.

## 1. Bind one immutable candidate

Use the exact committed source. The working tree must be clean except for explicitly
excluded audit-only evidence.

```bash
candidate_commit="$(git rev-parse HEAD)"
candidate_id="release-core-$(git rev-parse --short=12 HEAD)"
git archive --format=tar HEAD | shasum -a 256
```

Record the full 64-character archive SHA-256 as `sourceTreeSha256`. Every observation
and action row must repeat the same `candidateId` and `sourceTreeSha256`. Any source or
artifact change invalidates the observation set and requires a new candidate.

Do not use a QA/test-marker build for human evidence. Bind any screenshot or bounded
observer note through its SHA-256 only; keep the raw attachment outside the repository.

## 2. Collect five genuinely fresh human sessions

Each `observationId` is an opaque `obs_` plus 32 lowercase hexadecimal characters.
Never derive it from a nickname, user key, email, device serial or session token.

Every session must satisfy all of the following:

- `humanObserved=true`, `freshStateAttested=true`, `testMarker=false`.
- `surface` is exactly `browser`, `ios` or `android`.
- First screen and first accepted action are each reached within `10000 ms`.
- The player reaches combat, returns safely, restores the save after reload and restores
  the current snapshot after a background/foreground transition.
- iOS and Android rows set `backEventApplicable=true` and `backEventPassed=true`.
  Browser rows use `false` and `null` respectively.
- `outcome=pass` and `attachmentSha256` binds one unique redacted attachment.
- The session contributes at least one accepted non-safe-region `move`, `explore` or
  `combat_start` action.

Action sequences start at `1` for each observation and remain contiguous. Safe-region
and rejected actions may be recorded but never contribute to region ranking.

## 3. Record issue metadata without private prose

Issue IDs use `issue_` plus 32 lowercase hexadecimal characters. The tracked summary
stores only:

- `severity`: `P0`, `P1` or `P2`
- `category`: `confusion`, `boredom`, `unfair` or `technical`
- `blocking`: boolean
- the owning opaque observation ID

Do not add descriptions, nicknames, paths, logs, inventory, user keys or device
identifiers to the tracked JSON. Each issue must be linked in both the issue row and
the observation's `issueIds` list.

Any P0 or blocking P1 invalidates the candidate for region activation. Fix it on a new
candidate and restart the five-session set. Nonblocking P1 and P2 rows may remain and
are counted in the generated selection evidence.

## 4. Example shape

```json
{
  "schemaVersion": 2,
  "candidateId": "release-core-0123456789ab",
  "sourceTreeSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "requiredFreshHumanObservations": 5,
  "observations": [
    {
      "observationId": "obs_00000000000000000000000000000001",
      "candidateId": "release-core-0123456789ab",
      "sourceTreeSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "humanObserved": true,
      "freshStateAttested": true,
      "testMarker": false,
      "surface": "browser",
      "startedAt": "2026-08-11T01:00:00.000Z",
      "endedAt": "2026-08-11T01:05:00.000Z",
      "firstScreenMs": 900,
      "firstActionMs": 1800,
      "firstActionAccepted": true,
      "combatReached": true,
      "safeReturnReached": true,
      "saveRestorePassed": true,
      "backgroundRestorePassed": true,
      "backEventApplicable": false,
      "backEventPassed": null,
      "outcome": "pass",
      "attachmentSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "issueIds": []
    }
  ],
  "issues": [],
  "actions": [
    {
      "observationId": "obs_00000000000000000000000000000001",
      "sequence": 1,
      "candidateId": "release-core-0123456789ab",
      "sourceTreeSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "humanObserved": true,
      "freshStateAttested": true,
      "testMarker": false,
      "region": "고요한 숲",
      "kind": "move",
      "accepted": true
    }
  ]
}
```

The real summary needs at least five complete observation objects and corresponding
contiguous action rows.

## 5. Generate selection only after the gate passes

```bash
node scripts/select-bounded-encounter-regions.mjs \
  --input docs/evidence/qa/release-complete-core/observation-summary.json \
  --output docs/evidence/qa/release-complete-core/region-selection.json
```

Expected before completion: nonzero exit and no output. Expected after completion:
schema v2 evidence with exactly two selected regions, input digest, per-region counts,
surface counts and issue counts. The output is write-once; never overwrite or hand-edit
it. Only then may the four bounded encounter families be authored.
