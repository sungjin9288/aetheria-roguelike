# Readability Trend Research

Date: 2026-05-28
Scope: mobile-first readability and visual trend pass for Aetheria Roguelike before additional device QA.

## Current Diagnosis

The game loop and progression structure are in a good place. The weaker part is not content depth; it is the screen-reading cost.

Evidence checked:
- `playtest-artifacts/mobile/01-after-start.png`
- `playtest-artifacts/mobile/02a-shop-open.png`
- `playtest-artifacts/mobile/02c-quest-board-open.png`
- `src/index.css`
- `src/components/ControlPanel.tsx`
- `src/components/StatusBar.tsx`
- `src/components/TerminalView.tsx`
- `src/components/DashboardMobileSummary.tsx`

Observed readability issues:
- Too many surfaces have the same visual weight: rounded panel, border, shadow, glass blur, and noise are repeated at almost every level.
- The palette reads as one dark slate/cyan/amber family. It is cohesive, but not very current; important state and ambient decoration compete.
- Korean body text is often paired with `font-fira`, high uppercase spacing, or very small labels. This works for sci-fi flavor but hurts scanning.
- The Quest Board screenshot shows low perceived contrast: the header, copy, and first quest card sit under a dark translucent layer and feel disabled even when actionable.
- Shop rows are clearer than the Quest Board, but list cards still use heavy rounded frames and similar borders for sale, disabled, special, and regular states.
- The status header is attractive but occupies a large part of the first mobile viewport before the player reaches the actual task.

## Reference Lessons

### Balatro

Sources:
- https://www.playbalatro.com/press-kit
- https://www.playbalatro.com/faq

Relevant lesson:
- Balatro makes the run structure legible through large numbers, simple round goals, strongly separated card states, and immediate score feedback. The official FAQ describes a run as small blind, big blind, and boss blind, and the press kit exposes multiple UI screenshots as core media assets.

Apply to Aetheria:
- Promote `next objective`, `risk`, `reward`, and `return` into a small high-contrast run strip instead of burying them in panels.
- Make key numbers bigger than labels: HP, NRG, gold, quest progress, enemy intent, item price delta.
- Use color for semantic state only: actionable, blocked, danger, reward, selected.

### Diablo IV

Source:
- https://news.blizzard.com/en-gb/diablo4/23954932/combatting-demons-with-accessibility-in-diablo-iv

Relevant lesson:
- Diablo IV treats readability as configurable, not merely decorative. Blizzard documents text scaling, subtitle background opacity, item/player highlighting, screen reader support, and high-contrast cursor/highlight options.

Apply to Aetheria:
- Add a `Readability Mode` setting before new visual polish: standard / high-contrast.
- High-contrast mode should increase text opacity, reduce background blur/noise, simplify borders, and highlight actionable objects.
- Do not make the default more decorative until high-readability constraints are in place.

### Slay the Spire

Source:
- https://store.steampowered.com/app/646570/Slay_the_Spire/

Relevant lesson:
- Slay the Spire is an older reference, but it remains strong because each decision screen has one dominant job: choose a card, choose a path, choose a relic, or fight. The Steam page describes dynamic deck building, changing paths, and relic decisions as the core loop.

Apply to Aetheria:
- Each overlay should have one active decision. For example, Quest Board should prioritize `accept one quest`, not present the mission terminal as a broad dashboard.
- Collapse secondary lore/explanation into smaller rows after the player sees `Objective -> Reward -> Route -> Accept`.

### Hades II

Source:
- https://store.steampowered.com/app/1145350/Hades_II/

Relevant lesson:
- Hades II combines strong art direction with clear action readability. The Steam page positions it as an action roguelike / RPG with a story-rich, hand-drawn identity. It is visually rich, but moment-to-moment UI does not let decorative chrome overpower combat decisions.

Apply to Aetheria:
- Keep the fantasy pixel character art as the emotional anchor, but reduce chrome around routine UI.
- Use stronger portrait/art moments only at state changes: level up, relic, boss, quest reward. Routine panels should be calmer.

### Into the Breach

Source:
- https://store.steampowered.com/app/590380/Into_the_Breach/

Relevant lesson:
- Into the Breach is a tactical roguelite where the turn state and threat forecast are the interface. Its Steam page frames each attempt as a generated challenge, and the useful UI pattern is forecast-first decision support.

Apply to Aetheria:
- Convert mission and combat hints into forecast rows: `Next`, `Threat`, `Reward`, `Exit`.
- In combat, show enemy intent and recommended response in one scan line before secondary details.

### Backpack Hero

Source:
- https://store.steampowered.com/app/1970580/Backpack_Hero/

Relevant lesson:
- Backpack Hero turns inventory organization into the core gameplay. The Steam page describes the backpack layout and item placement as the strategy itself.

Apply to Aetheria:
- Inventory and shop should feel spatial and comparable, not just list-like.
- Use compact item rows with clear slot/type/stat deltas first, and move flavor text below or behind expansion.

## Visual Thesis

`Arcane field console`: high-contrast dark fantasy UI, fewer glass layers, stronger readable typography, and state colors used only when they communicate a decision.

## Content Plan

Primary screen:
- Status: compact identity + HP/NRG/EXP/gold.
- Current objective: always-visible `Next / Route / Reward / Return`.
- Field log: recent events with high-contrast row types.
- Field actions: icon-led buttons with one recommended action state.

Overlays:
- Quest Board: `Objective -> Route -> Reward -> Risk -> Accept`.
- Shop: `Item -> delta -> eligibility -> price -> action`.
- Inventory: `equipped / upgrade / usable / blocked` groups before full item history.
- System: QA/readout remains accessible but visually quieter.

## Interaction Thesis

- Use one clear entrance motion per overlay: slide up + fade, no long dim layer.
- Use selection transitions to move focus, not decorate. A selected quest/item should visibly lift and expose details.
- Use short pulse only for the recommended next action; avoid ambient pulsing on passive decoration.

## Development Plan

### Slice 1: Readability Foundation

Goal:
- Make the current UI easier to scan without changing game logic.

Changes:
- Add readability design tokens in `src/index.css`:
  - solid panel backgrounds
  - reduced blur/noise variants
  - high-contrast text variables
  - semantic state colors
- Add a Korean-friendly readable font stack for body copy:
  - `ui-sans-serif`, `-apple-system`, `BlinkMacSystemFont`, `Apple SD Gothic Neo`, `Noto Sans KR`, `sans-serif`
- Keep `Rajdhani` for short English HUD labels and `Fira Code` for numeric/command text only.
- Reduce heavy letter spacing for Korean text and long labels.

Expected files:
- `src/index.css`
- `tailwind.config.js`
- `src/components/SignalBadge.tsx`
- `src/components/StatusBar.tsx`

Validation:
- `npm run verify`
- `./scripts/local-playtest.sh`
- mobile screenshot review: start, shop, quest board, inventory/system

### Slice 2: First Viewport Recomposition

Goal:
- Make the first mobile screen feel current and readable in one glance.

Changes:
- Compress `StatusBar` height and move detailed stat meters into a tighter row.
- Make `Field Log` use larger body text, stronger row type markers, and less empty dark space.
- Turn `control-mission-tracker` into a true run objective strip: `NEXT / ROUTE / REWARD / RETURN`.
- Simplify action buttons: less border glow, clearer recommended state, consistent 44px+ tap targets.

Expected files:
- `src/components/StatusBar.tsx`
- `src/components/TerminalView.tsx`
- `src/components/ControlPanel.tsx`
- `src/components/DashboardMobileSummary.tsx`

Validation:
- `npm run verify`
- `AETHERIA_RUN_E2E=1 ./scripts/local-playtest.sh`
- visual check of `playtest-artifacts/mobile/01-after-start.png`

### Slice 3: Quest Board and Shop Modernization

Goal:
- Make choice surfaces feel closer to modern roguelike decision UI.

Changes:
- Quest cards become decision rows:
  - title
  - one-line objective
  - route/risk/reward chips
  - accept button
- Remove the heavy dimmed terminal feel from active quest board content.
- Shop rows use stronger comparison hierarchy:
  - item art
  - name/type
  - stat delta
  - eligibility
  - price/action
- Use disabled opacity sparingly; blocked items should still be readable.

Expected files:
- `src/components/tabs/QuestBoardPanel.tsx`
- `src/components/ShopPanel.tsx`
- `src/components/icons/ItemIcon.tsx`

Validation:
- targeted quest/shop unit tests
- `npm run verify`
- mobile screenshot review: `02a-shop-open`, `02c-quest-board-open`

### Slice 4: Readability Mode

Goal:
- Make readability a product feature, not a one-off style tweak.

Changes:
- Add a system setting for `Readability Mode`.
- High-readability mode:
  - disables heavy panel noise
  - increases body text opacity
  - raises panel contrast
  - reduces decorative glow
  - uses stronger focus rings on actionable controls
- Persist setting in existing save/settings flow.

Expected files:
- `src/components/tabs/SystemTab.tsx`
- settings/save utility files
- `src/index.css`

Validation:
- unit coverage for setting persistence
- e2e path through system tab
- mobile screenshots for standard/high-readable mode

## Design Constraints

- Do not add new production dependencies for typography unless explicitly approved.
- Do not replace the game identity with generic SaaS cards.
- Do not make the UI dominated by a single dark slate/cyan palette; reserve cyan/amber for semantic states.
- Avoid cards inside cards. Use rows, dividers, and full-width sections for routine information.
- Keep mobile tap targets at least 44px where possible.
- Keep text within parent bounds on mobile screenshots.

## Implementation Checkpoint

Completed after this research note:
- Slice 1/2: readability foundation, first viewport map signal, compact status/log/action surfaces.
- Slice 3: Quest Board and Shop decision rows.
- Slice 4: persisted Readability Mode with high-readability surface overrides.
- Slice 5: 전투 판단 스트립 `적의 행동 / 대응 / 기회`.
- Slice 6: 전투 결과 스트립 `상태 / 보상 / 다음 행동`.
- Slice 7: 유물 선택 스트립 `추천 / 이유 / 성장 방향`.
- Slice 8: 모험 종료 스트립 `결과 / 배운 점 / 다음 시도`.
- Slice 9: Mobile Overlay CTA Reachability Sweep with viewport, hit target, and scroll recovery guards.
- Slice 10: Mobile Focus Panel Contrast and Disabled-State Readability.
- Slice 11 preflight: refreshed the browser/mobile smoke baseline and Capacitor web asset sync on 2026-05-31; 2026-06-01 device-gate retry later recovered `xcdevice` availability for the target iPhone, but `devicectl` still failed because the device was locked at the Developer Disk Image mount step. Android device/signing blockers remain.
- Slice 22: Core HUD Player Language. The first-five-minute loop now uses one vocabulary across native boot, persistent status, enemy target, field-log badges, status command, level-up feedback, boss phases, and equipment upgrade hints. Internal stage names and stable test keys remain available to automation without appearing as player copy.
- Slice 23: Secondary Gameplay Surface Language. Quest Board, Crafting, detailed Stats, and Codex now share direct Korean headings, actions, empty states, stat names, and reward units. Browser smoke opens and verifies the real panels before taking 390px evidence instead of treating an internal tab-state change as visual proof.

## Recommended Next Step

Run the timed iPhone 5-minute manual loop on the latest installed archive.
- Automated iPhone delivery now passes archive install, foreground launch, and the 60-second process hold. The remaining iPhone signal is player perception and touch behavior, not packaging.
- Record action discovery time, first-combat turn count, progression pacing, reward comprehension, and visual cohesion using `docs/PLAYTEST_CHECKLIST.md`.
- Review Quest Board, Crafting, detailed Stats, and Codex during the manual loop to confirm the verified browser vocabulary still reads naturally on the native device.
- Prepare Android separately by connecting a physical device and providing release signing input (`android/key.properties` or `AETHERIA_ANDROID_KEYSTORE_*`).
