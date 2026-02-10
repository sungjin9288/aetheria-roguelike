Original prompt: 좋아. 추천사항 전부 다 반영해줘.

Done:
- Rewrote `src/App.jsx` to integrate upgraded CombatEngine flow end-to-end.
- Added skill-slot selection flow (`actions.cycleSkill`) and wired selected-skill execution.
- Applied per-turn state ticking (`CombatEngine.tickCombatState`) before enemy action.
- Updated event handling to support structured `outcomes` payload when provided.
- Improved enemy spawn payload with `baseName` and behavior `pattern`.
- Updated item usage logic for `hp/mp/cure/buff` item types.
- Updated crafting to resolve real item definitions by recipe output name.
- Kept quest and loot logic aligned with prefixed enemy names via baseName-aware flow.

Done (UI/CLI):
- Rewrote `src/components/ControlPanel.jsx` with combat skill display + cooldown and skill cycling button.
- Rewrote `src/utils/commandParser.js` and added `nextskill/skillnext/sn/스킬변경`.

TODO:
- Run Playwright loop with `$WEB_GAME_CLIENT` after local dev server startup to validate full gameplay UX.
