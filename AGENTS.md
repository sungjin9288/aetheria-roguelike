# AGENTS.md

## Purpose

- This repository is a mobile-first React + Capacitor roguelike with an active RC-style QA and signed-build loop.
- Treat browser playtesting as a fast feedback layer, but treat native packaging, mobile readability, and device reproducibility as release-critical.

## Codex Operating Rules

- Start non-trivial work with `$repo-intake`.
- Use `$aetheria-roguelike-mobile-qa` as the default project skill for gameplay, UI density, smoke, perf, Capacitor sync, and signed-build work.
- Finish with `$verify-gate` before close-out.
- Because this repo already uses a task board, update `tasks/todo.md` through `$task-ledger-sync` when the active checkpoint, blocker, or completed validation state changes.
- Use `$release-evidence` when refreshing smoke captures, QA summaries, native build outputs, or review-ready artifact notes.

## Source Of Truth

- `tasks/todo.md` is the primary execution ledger for current RC status, blockers, and latest verified checkpoints.
- `package.json` scripts define the canonical verification and native packaging entrypoints.
- Treat the owning source under `src/` and the relevant script under `scripts/` as the code-level source of truth for the touched path.
- If `.claude/launch.json` is missing, do not invent it; rely on the existing repo scripts and task board instead.

## Working Rules

- Treat the current RC and device-validation path as fixed. Do not widen scope with speculative feature work during a QA or release loop.
- Mobile readability, signed build integrity, and device reproducibility take priority over visual polish that has no validation proof.
- Preserve the existing build guard, perf guard, local playtest, smoke loop, and native packaging flow. If one of those regresses after your change, the work is not done.
- Keep gameplay logic aligned across `src/data/*`, `src/hooks/*`, `src/reducers/*`, `src/systems/*`, and the mobile UI shells in `src/components/*`.
- When a blocker is environmental, such as missing device connectivity or signing material, report it explicitly instead of masking it as an app issue.

## Skill And MCP Expansion

- Add `$develop-web-game` when iterating on gameplay loop feel, browser smoke automation, or HUD and action-surface polish.
- Add `$playwright` and Playwright MCP when a real browser pass, screenshot proof, or interaction trace is needed.
- Add `$frontend-skill` only when the task is a meaningful UI or visual composition change, not for routine QA fixes.
- Add `$figma` skills and Figma MCP only when the task includes a Figma handoff, design sync, or component translation request.
- Add `$linear` and Linear MCP only when the work is tied to a tracked issue, milestone, or release coordination flow.

## Verification Expectations

- Run `npx tsc --noEmit` (cycle 59부터 strict: true 활성, cycle 60에서 도메인 타입 정착).
- Run `npm run lint`.
- Run `npm run build:guard`.
- Run `npm run test:unit`.
- Run `npm run test:smoke`.
- Run `npm run test:e2e` when the touched path affects user-facing tabs/panels/flows (cycle 64에서 20개 시나리오 회귀 가드 정착).
- Run `npm run mobile:doctor`.
- Run `npm run cap:sync`.
- Run `npm run android:debug`, `npm run ios:build:device`, or `npm run ios:archive` when the touched path affects native packaging, device delivery, or signed-build readiness.
- If a required verification step cannot run because of local environment limits, state the exact missing dependency or blocker.

### test:smoke 사전 조건

`npm run test:smoke`는 preview 서버가 활성 상태여야 한다 (기본 `http://127.0.0.1:4173/`). preview 서버가 미기동이거나 다른 포트면 cycle 65 phase 5에서 추가한 안내 메시지가 출력되며, 다음 중 하나로 해결한다:

- `npm run preview -- --port 4173 --host 127.0.0.1` (백그라운드)
- `--url http://localhost:5173` 같은 활성 dev/preview URL 인자
- `AETHERIA_SMOKE_URL` 환경변수로 다른 포트 지정

### 통합 검증 — npm run verify / verify:full

- `npm run verify` (cycle 67): `type-check + lint + test:unit + build:guard` 4 gate를 한 번에 실행. preview 서버 불필요.
- `npm run verify:full` (cycle 73): `verify` 통과 후 `local-playtest.sh`를 통해 preview 서버를 자동 기동/정리하면서 smoke desktop + smoke mobile + e2e까지 추가 실행. CI나 RC 체크포인트에서 한 번에 모든 게이트를 검증할 때 사용. 동적 포트로 fallback되면 `PLAYWRIGHT_BASE_URL`이 자동 전달됨.

## Close-Out

- Report the last completed QA checkpoint from `tasks/todo.md`.
- State whether `tasks/todo.md` was updated.
- Name the latest native build, archive, or smoke artifact touched.
- Separate app regressions from environment blockers such as signing, keystore, or device connectivity issues.
