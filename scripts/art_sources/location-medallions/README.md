# Location Medallion Sources

These five retained source images contain the complete location artwork set used by the world map.

- Generated: 2026-08-03 with OpenAI image generation
- Style references: `public/assets/avatars/adventurer.png` and the original region medallions
- Direction: chibi pixel-art landscape, dark octagonal frame, controlled saturation, readable at 48px
- Coverage: all 52 entries in `src/data/maps.ts`, plus one unknown-route fallback
- Runtime outputs: `public/assets/locations/*.png`
- Evidence output: `playtest-artifacts/location-medallions/contact-sheet.png`

The order of every source cell and its runtime key is declared in `scripts/process_location_medallions.py`. Regenerate the transparent 96px assets and contact sheet with:

```bash
python3 scripts/process_location_medallions.py
```

The source sheets are retained so every runtime crop can be reproduced and reviewed without hidden manual editing.
