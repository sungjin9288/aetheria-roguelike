---
name: aetheria-openspace-playtest
description: Run Aetheria Roguelike verification loops around smoke, perf, and mobile packaging. Use when validating gameplay, UI density, or Capacitor delivery changes before signoff.
---

# Aetheria OpenSpace Playtest

## Verification Order

1. `npm run lint`
2. `npm run build:guard`
3. `npm run test:unit`
4. `npm run test:smoke`
5. `./scripts/local-playtest.sh` for player-facing loop changes
6. `npm run mobile:doctor`
7. `npm run cap:sync` when native shells need refreshing

## Escalation Rules

- Only run `android:debug`, `ios:build:device`, or `ios:archive` if the touched area changes native packaging, assets, or final RC delivery.
- If a device or signing blocker exists, record it in `tasks/todo.md` rather than widening scope.

## Close-Out

- Report the last successful guard.
- Name any native command that was intentionally skipped.
- Record newly discovered QA rules in `tasks/lessons.md`.
