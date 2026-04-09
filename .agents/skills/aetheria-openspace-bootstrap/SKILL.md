---
name: aetheria-openspace-bootstrap
description: Bootstrap OpenSpace-assisted work in Aetheria Roguelike. Use when a task needs repo-specific orientation before UI, content, QA, or mobile packaging work.
---

# Aetheria OpenSpace Bootstrap

## Required Read Order

1. `README.md`
2. `tasks/todo.md`
3. `tasks/lessons.md`
4. `.agents/skills/aetheria-roguelike-mobile-qa/SKILL.md`
5. the owning source file under `src/` or script under `scripts/`

## Focus

- Keep the current RC-style mobile QA track intact.
- Treat React/Vite gameplay code and Capacitor packaging as one delivery surface.
- Prefer bounded, verifiable changes over broad redesigns.

## Initial Checklist

- Confirm which gameplay loop or mobile shell is being touched.
- Check whether the change affects web-only UI or also native packaging.
- Reuse existing guard rails: `build:guard`, `test:unit`, `test:smoke`, `mobile:doctor`, local playtest.

## Close-Out

- Report the touched gameplay or mobile surface.
- Name the verification commands actually run.
- Call out whether native sync or archive work was intentionally skipped.
