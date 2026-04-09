---
name: aetheria-openspace-ui
description: Shape Aetheria Roguelike UI and mobile presentation with the repo's terminal-cyberpunk structure preserved. Use for HUD, log density, focus-stage panels, or mobile readability work.
---

# Aetheria OpenSpace UI

## Scope

- `src/components/*`
- `src/App.jsx`
- `src/main.jsx`

## Working Rules

- Preserve the terminal-log-first identity. Do not turn the game into a card dashboard.
- Mobile readability beats ornamental chrome.
- Respect the existing `Field Log / Status / Field Actions / Archive` mental model.
- If a panel-heavy state gets denser, verify it does not regress the mobile focus-stage behavior captured in `tasks/lessons.md`.

## Verification

- `npm run lint`
- `npm run build:guard`
- `npm run test:smoke`
- `./scripts/local-playtest.sh` when the touched area changes player-facing layout or interaction density
