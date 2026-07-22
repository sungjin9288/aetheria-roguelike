# Monster and Region Art Sources

These five sheets are the retained generation sources for the first four visual families used by the map and combat UI.

- Generated: 2026-07-22 with OpenAI image generation
- Style reference: `public/assets/avatars/adventurer.png`
- Direction: readable chibi pixel art, dark outline, controlled saturation, transparent-ready isolated subjects
- Runtime outputs: `public/assets/monsters/**` and `public/assets/regions/**`
- Evidence output: `playtest-artifacts/monster-region-art/contact-sheet.png`

The source generator returned RGB images with a baked checkerboard. `scripts/process_monster_region_art.py` removes only the bright low-chroma checkerboard area connected to each crop edge, preserving enclosed pale details such as bone, steel, eyes, and highlights.

Regenerate all crops and the review contact sheet with:

```bash
python3 scripts/process_monster_region_art.py
```

Every crop coordinate is declared beside its output key in the script so the asset history can be reproduced and reviewed without hidden manual editing.
