# 암흑의 대검 — adopted correction

**Current status:** canonical adoption, 390×844 equipment interaction, full regression and local Android debug/iOS unsigned packaging passed. See `docs/evidence/art/dark-greatsword-adoption-20260908.md`. Not installed or published. The preparation receipt and older "not adopted" notes below remain historical and are not rewritten as adoption evidence.

Latest: Sol/xhigh reviewed candidate at32/46/96 and accepted the corrected broad blade/guard/long grip. Canonical runtime and actual equipment slot remain pending. General processor now has an explicit replacement path under focused verification and independent review; this does not adopt the candidate. Historical notes below describe earlier checkpoints.

Follow-up: owner viewed `output/playwright/dark-greatsword-candidate-390x844.png` with actual ItemIcon32/46/96. An explicit Playwright route supplied only this candidate PNG for the one exact runtime URL; it is candidate preview, not runtime adoption. Images decoded and no horizontal overflow. Separate browser closed; fresh gameplay save preserved. Independent Sol/xhigh post-export review requested.

Additional source-drift regression corrupts each of three pinned originals separately and requires failure before output directory creation. Dark source + Earth Verdict focused3/3 PASS (`/tmp/aetheria-dark-focused-safety.log`).

Implementation gap: `process_equipment_art_batch.py` currently rejects a changed finalized batch in `prepare_next_provenance`; it has no `--replace-existing`. Signature pipeline does expose that path. Compare and extend the existing pattern with TDD before adoption; do not rewrite hashes manually or discard finalized generationReview. No pipeline/runtime mutation yet.

Independent Sol/xhigh identified Important1: canonical2H greatsword was needle-thin at source/runtime/small ItemIcon. See `docs/evidence/art/equipment-sword-review-20260908.md`.

Built-in generated master is preserved in `masters/item.png`; old source sheet/runtime are preserved in `previous/`. Full prompt is in `prompts.md`. Gameplay hands2, stats, job, tier, description and save schema are not changed.

`prepare.py` pins original SHA-256s, alpha-thresholds only a copy, uses existing shared normalization, replaces source sheet bottom-center only, asserts five neighbor cells unchanged, and refuses an existing output directory. The output is candidate-only and does not write production paths. `tests/dark-greatsword-source.test.js` failed before the preparer existed, then passed; two runs compare sheet/icon/receipt bytes and existing-output rejection preserves receipt. Related Earth Verdict test also passed (2/2 focused). Logs `/tmp/aetheria-dark-source-red.log`, `/tmp/aetheria-dark-source-green.log`, `/tmp/aetheria-dark-focused.log`.

Candidate generated at `exports/`; `receipt.json` pins input/output hashes. Owner viewed generated master and160px export: broad continuous blade, guard and long grip are present. Actual32/46/96 production component, equipment slot, independent post-export review, adoption/provenance/manifest tests and full/native gates remain pending. Other source cells are pixel-identical, not a claim that re-encoded whole sheet bytes stay the same.

Next: strengthen source-drift/output-safety regression as needed; validate candidate at actual sizes before adoption; inspect current process_equipment_art_batch contract and preserve all other exports/metadata. Do not adopt by manual hash-only edits. No commit/install/publication.
