# Full inventory combat — 2026-09-08

Isolated QA browser390×844 and dev server84885, no production save or gameplay changes. `output/s5-capacity-direct.ts` constructs20 canonical potions, capacity20, a weakened slime and strong player. It finds seed1 via the real reducer and unchanged canonical drop table: rolled3/admitted0/blocked3, signature0/pity0→0. This is a controlled capacity fixture, not natural combat difficulty or EXP/gold evidence.

Actual browser loads the isolated snapshot, uses the real attack button with the same seed and returns to idle. Visible message: `가방이 가득해 전리품 3개를 챙기지 못했습니다.` Existing20-item inventory is deep-equal to the post-restore/pre-combat inventory. Horizontal overflowfalse. Final session30827 exit0, log `/tmp/aetheria-s5-capacity-direct-final.log`. Owner viewed `output/playwright/s5-capacity-victory-390x844.png`; notice and next exploration controls are readable.

The initial run19472 failed its baseline comparison because migration adds `enhance:0` to the input potions. That log remains `/tmp/aetheria-s5-capacity-direct.log`. The final script compares against the actual restored inventory immediately before combat, preserving full deep equality without conflating migration with settlement. No assertion on item count or content was relaxed.

The structured receipt above is from the independent production reducer preflight; the browser evidence is the real notice, persisted inventory and idle transition. It is not claimed as an extracted browser transient receipt. Boss/signature, overflow-existing saves, replay, DOT and pending rewards remain covered by their separate focused tests, not this single visual run.
