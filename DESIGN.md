# Aetheria Roguelike Design Direction

## Product Intent

Aetheria Roguelike should feel like a playable field terminal for a cyber-fantasy expedition. The interface should read as a tactical run console, not a glossy launcher. Every screen should support long-session play, fast scanning, and quick thumb access on mobile.

## Visual Direction

- Preserve the dark terminal base, but avoid flat black slabs. Use layered charcoal, deep indigo, oxidized teal, and restrained magenta or amber signals.
- Typography should feel operator-grade and game-native: dense, readable, and a little severe. Avoid rounded toy-like UI.
- Glows and gradients should be purposeful status signals, not ambient decoration.

## Layout Rules

- The log is the primary narrative surface. Layout decisions should protect visible log rows first.
- Mobile uses a single focus stage for panel-heavy states. Do not stack multiple competing surfaces in the same vertical space.
- Desktop can show archive and action rails, but they must feel secondary to the current run feed.
- Buttons must support quick repeated play. Large hit targets, short labels, and clear active/inactive states matter more than visual flourish.

## Component Guidance

- `Field Log`: highest contrast, most legible, minimal padding waste.
- `Status / Snapshot`: dense summaries, never decorative stat walls.
- `Field Actions`: clear priority ordering, danger actions visually distinct, no overloaded grid labels.
- `Archive`: compact review rail for gear, quests, jobs, and lore; avoid making it dominate the viewport.
- Event, shop, and crafting states should feel like in-run overlays or stations, not separate app pages.

## Motion and Feedback

- Prefer short response cues over cinematic transitions.
- Combat, loot, and danger states should change tone immediately through color and hierarchy.
- Mobile transitions should optimize clarity and stability over spectacle.

## Anti-Goals

- Do not drift toward generic dashboard SaaS styling.
- Do not add bright neon everywhere.
- Do not sacrifice run readability for world-building chrome.
