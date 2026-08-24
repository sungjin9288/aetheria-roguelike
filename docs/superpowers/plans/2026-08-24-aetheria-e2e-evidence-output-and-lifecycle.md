# Aetheria E2E evidence output and lifecycle plan

## Objective

Keep ordinary, focused, and full Playwright runs isolated from the tracked
release-evidence screenshots. The four release-evidence scenarios must still
use their existing filenames and screenshot options, while an explicitly
requested evidence refresh may write those same filenames into the existing
release evidence directory.

## Scope and constraints

- Add one typed screenshot helper at `tests/e2e/releaseEvidenceScreenshot.ts`.
- Route the default path through Playwright's `testInfo.outputPath(filename)`.
- Route to `docs/evidence/qa/release-complete-core/screenshots/<filename>` only
  when `AETHERIA_REFRESH_RELEASE_EVIDENCE` is exactly `1`.
- Reject unsafe filenames before invoking Playwright. A filename is a single
  `.png` basename containing only ASCII letters, digits, `.`, `_`, and `-`.
- Preserve the four current screenshot filenames and their `fullPage` values.
- Add an explicit `qa:evidence:refresh` script for exactly the four scenarios,
  the `chromium-mobile` project, and one worker. The script is not run as part
  of this implementation Goal.
- Do not change gameplay, Vite, Playwright server behavior, native files,
  existing PNGs, Toss evidence, or local-playtest behavior.

## TDD sequence

1. Write the contract test for default output, exact opt-in output, and unsafe
   filename rejection; run it before creating the helper and capture the RED.
2. Implement the smallest helper that selects the path and forwards all
   screenshot options unchanged.
3. Migrate the four release-evidence callers to pass their existing filename
   and options through the helper, then add the explicit package script.
4. Run the helper contract test, TypeScript, lint, and the four-spec focused
   Playwright suite without the refresh environment variable. Confirm six
   screenshots are produced under `test-results` and the six tracked PNG
   hashes are unchanged.
5. Update the task ledger and completion summary only with checks actually run.

## Acceptance criteria

- Default and exact opt-in routing pass behavior tests.
- Unsafe path-like or non-`.png` names fail closed without calling
  `target.screenshot`.
- The focused four-spec suite passes and produces six test artifacts.
- Existing tracked release-evidence PNG hashes and Toss evidence are byte
  identical after the ordinary focused run.
- No commit, push, signing, archive, install, publish, release, cleanup, or
  explicit release-evidence refresh is performed.

## Rollback

The change is limited to the helper, four E2E callers, one package script, and
the linked plan/ledger/evidence notes. Reverting those files restores the prior
direct screenshot calls; no generated release asset is required for rollback.
