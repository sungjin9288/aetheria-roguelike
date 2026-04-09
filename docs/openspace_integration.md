# OpenSpace Integration

This repository is wired to use OpenSpace as a repo-local skill layer for Aetheria Roguelike development. The integration is intended for gameplay/UI/content/QA workflows, not for in-game runtime execution.

## Repo-Local Skills

- `aetheria-openspace-bootstrap`
- `aetheria-openspace-ui`
- `aetheria-openspace-content`
- `aetheria-openspace-playtest`
- `delegate-task`
- `skill-discovery`

Existing repo skill retained:

- `aetheria-roguelike-mobile-qa`

## Recommended Use

- UI density, mobile readability, and focus-stage cleanup
- content and balance tuning in data-driven systems
- smoke, playtest, perf, and Capacitor delivery loops

## Not Recommended

- putting OpenSpace inside gameplay runtime loops
- delegating native signing or device-state assumptions without explicit verification

## Smoke Check

Run:

```bash
python3 scripts/openspace_smoke.py
```

Expected result:

- repo-local bridge skills are present
- local OpenSpace `search_skills` discovers the expected skills
- global Codex MCP config mentions this repo skill directory

`execute_task` may still time out in a plain shell context if host-side LLM auth or session routing is unavailable. Treat that as a host/runtime follow-up, not a repo wiring failure.
