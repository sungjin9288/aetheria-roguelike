---
name: aetheria-openspace-content
description: Evolve Aetheria Roguelike gameplay content and balance data without breaking the reducer and combat-engine contract. Use for relics, jobs, encounters, progression tuning, and text output changes.
---

# Aetheria OpenSpace Content

## Scope

- `src/data/*`
- `src/reducers/*`
- `src/hooks/*`
- `src/systems/*`
- `src/utils/*`

## Working Rules

- Keep combat and balance logic data-driven.
- Follow `No Magic Numbers` and `Pure Function First` from `tasks/lessons.md`.
- If stats or progression change, keep player-visible values aligned with runtime values.
- Treat Korean gameplay copy as production content, not placeholder text.

## Verification

- `npm run test:unit`
- `npm run lint`
- `npm run build:guard`
- `npm run test:smoke` when balance or encounter sequencing changes can surface in play
