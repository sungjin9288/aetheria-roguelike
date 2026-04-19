Drop externally generated pixel sprite portraits here to override the code fallback avatar.

Expected filenames:

- `adventurer.png`
- `warrior.png`
- `knight.png`
- `berserker.png`
- `rogue.png`
- `assassin.png`
- `ranger.png`
- `mage.png`
- `archmage.png`
- `warlock.png`
- `paladin.png`
- `chronomancer.png`
- `shadow-lord.png`
- `grand-mage.png`

Optional armor-style variants:

- `<slug>-coat.png`
- `<slug>-robe.png`
- `<slug>-plate.png`
- `<slug>-leather.png`

Optional loadout-style variants:

- `<slug>-sword.png`
- `<slug>-heavy.png`
- `<slug>-archer.png`
- `<slug>-caster.png`
- `<slug>-guardian.png`
- `<slug>-dagger.png`
- `<slug>-lancer.png`

Highest-priority combined variants:

- `<slug>-<armorStyle>-<loadoutStyle>.png`

Selection priority:

- `<job>-<armorStyle>-<loadoutStyle>.png`
- `<job>-<loadoutStyle>.png`
- `<job>-<armorStyle>.png`
- `<job>.png`
- `adventurer-<loadoutStyle>.png`
- `adventurer-<armorStyle>.png`
- `adventurer.png`

Guidelines:

- transparent background
- 32x32 or 48x48 source sprite
- cute 2D pixel full-body or bust portrait
- readable at very small sizes
- keep silhouette centered with generous padding
