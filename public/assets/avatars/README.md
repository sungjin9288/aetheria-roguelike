# Character avatar assets

`canonical/` contains the only runtime portrait for each of Aetheria's 18 known jobs. The mapping is owned by `src/data/characterArtManifest.json`; a known job must resolve to exactly one `/assets/avatars/canonical/<slug>.png` path and must not fall back to Adventurer.

## Runtime contract

- PNG RGBA with real transparent pixels; a baked checkerboard is invalid.
- Canvas: `768x768`.
- Opaque character bounds: at most `600x630`, centered inside the declared `16px` margin.
- Shared foot baseline: `y=708`.
- Every job export has a unique SHA-256.
- Face, primary weapon, and shoulder silhouette must remain readable at the 40px avatar use case.

The legacy files in this directory remain available only for unknown/corrupt-job fallback and equipment-preview compatibility. They are not candidates for a known canonical job.

## Reproduction

Tracked source masters live in `scripts/art_sources/characters/`. Regenerate prompts and normalized exports with:

```sh
node scripts/generate_job_sprite_prompts.mjs
python3 scripts/process_character_art.py
npm run art:verify -- --scope characters
```

`scripts/process_character_art.py --import-source <slug>=<path>` may clean an opaque working import only through deterministic edge-connected background removal. It never accepts an opaque tracked master.

Provenance and the deterministic labeled/anonymous 6x3 contact sheets are recorded in `docs/evidence/art/`.
