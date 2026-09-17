# Stone-material six — candidate checkpoint

2026-09-09. User approved the remaining69 visual closure design. This is group1/7, not runtime adoption or full-game completion.

## Scope and provenance

감옥 골렘/prison-golem, 광석골렘/ore-golem, 돌 거인/stone-giant, 석상 가디언/statue-guardian, 영겁의 수호신상/eternal-idol, 황금 골렘/gold-golem.

Six individual built-in image calls, six preserved originals and six selected candidates; no CLI/API fallback. Exact prompts and original locations are in `generation-records.json`. Masters are byte-identical to their original generated files. Original RGBA1254×1254 images have positive transparent margins; solid silhouettes do not touch image boundaries. Gold's narrowest original margin is10px, not a clipped arm.

## Tests and owner inspection

- Missing preparer: `node --import tsx --test tests/remaining-stone-six.test.js` RED3.
- Added source-pinned `prepare.py` using the existing v26 export flow: alpha threshold128, nearest scaling to144px bounding size,160×160 canvas,8px margins, exclusive output. All originals checked before output; drift/opaque/empty/overwrite rejected.
- `node --import tsx --test tests/remaining-stone-six.test.js tests/retained-identity-ten.test.js`: GREEN6, including repeat byte-identical exports and master preservation.
- `python3 scripts/art_sources/monsters/v27/stone-material/prepare.py scripts/art_sources/monsters/v27/stone-material/exports`: exit0; receipt pins every source/export.
- `review.py`: exit0, two color sheets and one grayscale comparison. Owner inspected all six full original outputs and all three sheets. Cage chest, asymmetric ore fist, long giant arms, carved shield, ringed layered idol and squat plated gold body remain distinct. Pale statue on light32 has lower contrast than dark but shield/body remain readable.
- Independent Sol/xhigh review: C0/I0, all six color/grayscale silhouettes distinguishable; source/master/export pins and crop/alpha6 PASS. Source preflight and negative/deterministic tests reviewed. `npx eslint tests/remaining-stone-six.test.js` exit0.
- Post-export69 runtime, manifest/registry/diagnostic snapshots, protected candidate6/Toss38 and generated original6 unchanged PASS. `git diff --check` PASS; tracked native drift0, index empty.

## Not claimed

This candidate group passed independent Sol review; none is connected to runtime. Remaining63 are not generated. No new full/native/browser gate has run because production files remain unchanged; those gates follow all69 stable candidates and exact69 adoption. Latest complete native checkpoint remains retained26, unsigned and uninstalled. No install/sign/commit/push/publish.

The first read-only metadata inspection used nonexistent diagnostic `sourceManifest` and failed before writes. The corrected inspection used the actual `sources` array and preflight checked all330 source hashes. No diagnostic evidence was refreshed or relaxed.
