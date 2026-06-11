Drop externally generated pixel item icons here to override the fallback SVG silhouettes.

Current shared family keys:

- `sword.png`
- `greatsword.png`
- `dagger.png`
- `staff.png`
- `wand.png`
- `bow.png`
- `axe.png`
- `hammer.png`
- `spear.png`
- `scythe.png`
- `whip.png`
- `armor.png`
- `robe.png`
- `cloak.png`
- `boots.png`
- `shield.png`
- `book.png`
- `potion.png`
- `material.png`
- `ore.png`
- `crystal.png`
- `scale.png`
- `fang.png`
- `bone.png`
- `core.png`
- `relic.png`
- `herb.png`
- `pouch.png`
- `key.png`

Named gear keys:

- `named-weapon-01.png` ... `named-weapon-31.png`
- `named-armor-01.png` ... `named-armor-29.png`
- `named-shield-01.png` ... `named-shield-05.png`

Exact item-name keys:

- `item-weapon-001.svg` ...
- `item-armor-001.svg` ...
- `item-shield-001.svg` ...
- `item-consumable-001.svg` ...
- `item-material-001.svg` ...
- `item-key-001.svg` ...
- `item-relic-001.svg` ...
- `item-misc-001.svg` ...

The repository keeps exact-name art coverage for compatibility and generation history, but the default in-game item surface now prioritizes cohesive family art.
The generated exact-name set covers 245 non-signature unique names, while 65 tier 5~6 signature items continue to use dedicated premium keys.

Selection rule:

1. `ItemIcon` first checks dedicated signature gear art (`/assets/equipment-exact/signature-*.png`).
2. Non-signature equipment resolves to `/assets/equipment-family/items/<family>.png`.
3. Non-equipment play items resolve to shared `/assets/items/<family>.png` buckets (`potion`, `ore`, `crystal`, `relic`, `key`, etc.).
4. Exact per-name catalog icons (`item-*`) remain asset-backed for generation compatibility and fallback paths, but they are not the default cohesive item surface.
5. If a routed asset is missing or fails to load, the legacy inline SVG silhouette is used.

Style target:

- premium fantasy JRPG pixel icon
- transparent background
- centered single-item silhouette
- readable at 18px to 32px
- one asset per item name, with material/element/rank reflected in the silhouette and palette
