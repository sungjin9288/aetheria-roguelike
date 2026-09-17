# Equipment direct surface — 2026-09-08

## Scope

Existing QA dev server session44777, localhost4422, `VITE_ENABLE_TEST_API=1`, isolated item-investment save namespace; browser `s5-gear`,390×844. No production source or normal save mutation. Existing avatar fixtures supply equipment; they are not natural acquisition, canonical eligibility or balance evidence. No claim that all229 designs or every set have been visually approved.

## Owner-observed results

- `ranger-coat`: visible bow/coat, offhand occupied by two-handed weapon,3/3 full-set explanation and two-piece accounting. Opened the set-catalog control. Loaded portrait/bow/coat images and document overflowfalse verified. Screenshot `output/playwright/s5-ranger-two-hand-390x844.png`.
- `paladin-plate`: one-handed sword, shield and plate listed in separate slots. Stable screenshot `output/playwright/s5-paladin-one-hand-shield-stable-390x844.png`; earlier screenshot without `stable` contains transient level-up toast and is not final readability proof. Fixture lacks canonical job-match metadata, shows0/3; this does not establish canonical paladin set failure.
- `early-gear-choice`: opened bag through UI. Bow showed attack+17, equipable, set+2 before selection. Clicked its actual `장착` button, then equipment tab. Bow equipped, two-hand occupancy/full-set explanation shown. Flushed isolated snapshot: hands2, offhandnull, inventory contains old dagger/armor/potion, not equipped bow. Reloaded and opened equipment console through UI: ready state, bow/occupancy/full-set persisted. No item loss observed in this scoped replacement.
- Screenshots before/after/reload: `output/playwright/s5-early-bow-choice-before-390x844.png`, `s5-early-bow-equipped-390x844.png`, `s5-early-bow-restored-390x844.png`; all owner opened. Screenshot paths are in the same output/playwright directory.
- Console query:3 messages total,0 errors/0 warnings. Final equipment receipt overflowfalse at390×844. Raw scoped receipts: `/tmp/aetheria-s5-equip-receipt.log`, `/tmp/aetheria-s5-equip-reload-state.log`, `/tmp/aetheria-s5-reloaded-gear.log`, `/tmp/aetheria-s5-console.log`.

## Limits and remaining work

### Canonical focus follow-up

`output/s5-canonical-focus.ts` uses source DB items, level75 archmage and `canEquip` to prove the initial Sage Rod/Worldtree Robe/Celestial Scripture slots are legal. Isolated browser then clicks bag equip for the canonical two-hand Temple City Staff. Result: staff equipped, offhandnull, old rod and scripture both returned to inventory; scripture decision shows two-hand rejection and disabled restriction button. Final run87397 exit0, `/tmp/aetheria-s5-canonical-focus-final.log`, overflowfalse. No production mutation. Owner opened `output/playwright/s5-canonical-focus-390x844.png` and `s5-canonical-focus-blocked-final-390x844.png`; book silhouette/gold scripture art and disabled reason are readable. Earlier blocked captures caught list transition or legendary notification and remain excluded from final readability proof. The final run explicitly dismissed the overlay through UI. The QA fixture begins with pre-owned legendary gear but does not initialize its discovery ledger, so this popup is not claimed as a production reacquisition defect.

This supplies canonical focus eligibility/2H replacement checks missing from the earlier avatar-only cases; it does not establish natural drop timing or every equipment art family.

The adventurer portrait remains the job illustration holding sword/shield despite equipped bow; this is not dynamic equipped-weapon artwork proof. The archmage QA preset includes both a two-handed staff and focus, so it was deliberately not used as proof of legal loadout. Real canonical focus eligibility, broader slot transitions and natural equipment acquisition remain separate checks. This closes only the listed direct surface observations, not S3/S5 or the whole Goal.
