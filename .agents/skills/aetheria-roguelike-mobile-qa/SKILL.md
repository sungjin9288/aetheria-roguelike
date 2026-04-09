---
name: aetheria-roguelike-mobile-qa
description: Operate Aetheria Roguelike's RC-style mobile QA and signed build workflow. Use when working on mobile UI density, combat and progression logic, smoke and perf guards, Capacitor sync, or Android and iOS validation steps called out in the task board.
---

# Aetheria Roguelike Mobile QA

## Required Read Order

1. `tasks/todo.md`
2. `.claude/launch.json`
3. the owning source file under `src/`
4. the relevant script under `scripts/` when the task touches QA, perf, or native build flow

## Working Rules

- Treat the current RC and device-validation path as fixed. Do not widen scope with new feature work during a QA or release loop.
- Mobile readability, signed build integrity, and device reproducibility take priority over speculative polish.
- Preserve the existing build guard, perf guard, local playtest, and smoke loops. If one of those fails after your change, the work is not done.
- Keep gameplay logic in data, hooks, reducers, and systems aligned with the mobile UI shells that surface it.

## Code Areas

- gameplay and data: `src/data/*`, `src/reducers/*`, `src/hooks/*`
- UI shells: `src/components/*`, `src/main.jsx`
- service integrations: `src/services/*`, `src/pwa/*`
- QA and native scripts: `scripts/*`

## Verification

- Run `npm run lint`.
- Run `npm run build:guard`.
- Run `npm run test:unit`.
- Run `npm run test:smoke`.
- Run `npm run mobile:doctor`.
- Run `npm run cap:sync`.
- Run `npm run android:debug`, `npm run ios:build:device`, or `npm run ios:archive` only when the touched path affects native packaging or device delivery.

## Close-Out

Report the last completed QA checkpoint, the latest native build or archive artifact touched, and any remaining blocker before device signoff.
