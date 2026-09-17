# Release-complete candidate observation runbook

This runbook starts only after the cohesive release-complete commit is approved and
created. It does not authorize a Toss upload, review request, publication, ad
activation, signing operation or Store action.

The root `observation-summary.json` is historical audit evidence and must never be
reused or automatically repointed for a new candidate. The root
`region-selection.json` is not a valid output location. New evidence always uses the
candidate-specific paths under `candidates/${candidate_id}/` below.

## 1. Bind one immutable candidate

Use the exact committed source. The working tree must be clean except for explicitly
excluded audit-only evidence. Keep the source candidate commit separate from any
later audit-evidence commit: the former defines the playable bytes, while the latter
may record the evidence lifecycle without changing that source identity.

```bash
source_candidate_commit="$(git rev-parse HEAD)"
candidate_id="release-core-$(git rev-parse --short=12 "$source_candidate_commit")"
candidate_root="docs/evidence/qa/release-complete-core/candidates/${candidate_id}"
observation_summary="$candidate_root/observation-summary.json"
region_selection="$candidate_root/region-selection.json"
archive_sha_1="$(git archive --format=tar "$source_candidate_commit" | shasum -a 256 | awk '{print $1}')"
archive_sha_2="$(git archive --format=tar "$source_candidate_commit" | shasum -a 256 | awk '{print $1}')"
test "$archive_sha_1" = "$archive_sha_2"
printf 'candidate_id=%s\nsourceTreeSha256=%s\n' "$candidate_id" "$archive_sha_1"
```

Record the full 64-character archive SHA-256 as `sourceTreeSha256`. The candidate ID
is always `release-core-<HEAD12>` from the source candidate commit. Every observation
and action row must repeat the same `candidateId` and `sourceTreeSha256`. Any source or
artifact change invalidates the observation set and requires a new candidate. Re-run
the archive command after the source commit and compare both outputs before accepting
the candidate seal.

At candidate-seal time, prepare the candidate-specific directory before creating an
empty summary or selection record. This command is documented for that later step and
is not executed during this planning checkpoint:

```bash
mkdir -p "$candidate_root"
```

An empty `0/5` candidate summary is Goal-owned, untracked audit evidence. Do not
commit it. It is useful for proving that the selector is still gated, but it does not
advance the human-observation count.

Do not use a QA/test-marker build for human evidence. Bind any screenshot or bounded
observer note through its SHA-256 only; keep the raw attachment outside the repository.
Automation, smoke, Playwright and test-harness sessions never increase the human
`0/5` count.

## 2. Prove the observation host is production-equivalent

Do not count a session that runs production client bytes against an incomplete static
host. In particular, `vite preview` serves the SPA but does not serve the Cloudflare
Pages Functions under `functions/api/`. When a candidate build has
`VITE_USE_AI_PROXY=true`, verify the exact candidate deployment before opening the
first human session:

```bash
npm run observation:host:verify -- --url https://<candidate-deployment-host>
```

The verifier requires all three externally visible contracts:

- the root document is HTTP 200 HTML;
- `OPTIONS /api/ai-proxy` is HTTP 200 and allows `POST`;
- an unauthenticated `POST /api/ai-proxy` is HTTP 401 JSON.

`AI_PROXY_ROUTE_MISSING` means the SPA is being served without its serverless route.
`AI_PROXY_ORIGIN_REJECTED` means the route exists but its `ALLOWED_ORIGINS` deployment
configuration does not admit the candidate origin. Neither host may be used for human
evidence. Do not hide these failures by allowing broad 404 responses or by changing
production AI behavior to accommodate a local static server.

This preflight proves route and origin wiring only. It does not claim a successful AI
provider call, deployed Firestore rules, Firebase emulator coverage, signing or
publication. The quota snapshot remains local-authoritative and non-blocking; its
deployed-rule validation is a separate external gate.

## 3. Collect five genuinely fresh human sessions

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

## 4. Record issue metadata without private prose

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

## 5. Example shape

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

## 6. Generate selection only after the gate passes

```bash
node scripts/select-bounded-encounter-regions.mjs \
  --input "$observation_summary" \
  --output "$region_selection"
```

Before five complete fresh human observations, the selector must stop with
`INSUFFICIENT_FRESH_OBSERVATIONS`, exit nonzero and leave `region_selection` absent.
It must never write the root `region-selection.json`. After completion, the candidate-
specific output is write-once schema-v2 evidence with exactly two selected regions,
input digest, per-region counts, surface counts and issue counts. Never overwrite or
hand-edit it. Only then may the four bounded encounter families be authored.
