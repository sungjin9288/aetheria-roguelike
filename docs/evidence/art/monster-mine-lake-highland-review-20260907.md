# Mine, lake and highland general monsters — source review

2026-09-07. Scope: eight previously unreviewed general-monster runtime PNGs in abandoned-mine/lake-temple/wind-highland. The regional query returned12 entries with12 matching manifest hashes; four already-authored creatures (거대 거북, 거대 지렁이, 고원 그리핀, 머맨) were excluded from this new visual batch, not counted as newly inspected.

Owner directly viewed the eight current catalog PNGs in groups3/3/2, then checked names, weaknesses/resistances and map membership in `src/data/monsters.ts` and `src/data/maps.ts`. No runtime changes. These are original-size semantic observations, not final32px or combat acceptance.

## Decisions

| Priority | Name | Visible evidence | Correction contract |
| --- | --- | --- | --- |
| Important | 거대 지네 | Multiple round spiders; source forest/spider-swarm.png | One long segmented centipede with many paired legs and antennae. Do not recolor spiders and label the species corrected. |
| Important | 광풍의 하피 | Full dragon body, tail and batlike wings; source fire/red-dragon.png | Recognizable harpy body combining humanoid upper form with avian wings and talons, wind as secondary cue. Lightning decoration does not change dragon anatomy. |
| Important | 물의 정령 | Green leafy child with tree-branch antlers; source forest/forest-spirit.png | Water-formed spirit with a coherent liquid/wave silhouette; no dominant woody antlers/leaves. Exact humanoid anatomy is not required by source. |
| Important | 암흑 마법사 | Orange crowned fire lord with flames, plus a staff; source fire/fire-lord.png | Dark-robed caster with shadow magic rather than fire-element lord. Production is light-weak/dark-resistant and dark-cave lore explicitly names dark mages. Preserve those mechanics. |
| Important | 코볼트 광부 | Same crowned fire lord, no readable mining identity; source fire/fire-lord.png | Match newly proposed kobold species body and add readable mining tool/gear. Not a human miner or fire creature. The v6 kobold remains a candidate, so species anchor is not runtime-approved yet. |
| Contextual | 광산 박쥐 | Bat anatomy is present, but orange fire-bat body has flame-like tail and large yellow angular effects | Verify cave/darkness readability at actual size; avoid premature semantic PASS solely from wings. Source is fire/fire-bat.png, production light-weak/dark-resistant. |
| Contextual | 수련 님프 | Generic winged forest fairy with flower; no unmistakable water-lily cue | A fairy-like spirit is compatible, but lake/water-lily identity needs an actual-size/context review. Production gives no fixed anatomy; wings alone are not a defect. |
| No obvious source-size contradiction | 광석골렘 | Articulated stone construct | Preserve body for now. Ore distinction, small-size contrast and final polish remain unverified. |

## Exact reviewed preimages

All files under `public/assets/monsters/catalog/`.

| Name | File | SHA-256 |
| --- | --- | --- |
| 거대 지네 | monster-82e2857d4305.png | 6b8c3cb6aeee98d48fdc2014062692d383f9934a11886c8951f0615a4c2540f2 |
| 광풍의 하피 | monster-f70adffeac61.png | ac0aa797545b78d6101f21284ce2ee94153213ff7e6ad372e960c6555cd9ffa6 |
| 물의 정령 | monster-704c2dec5dd8.png | 0b2e4feb0aa22f73df7f746cfb1ef6518330733a99632a3c32332e6f7beb5994 |
| 암흑 마법사 | monster-7a96730f4730.png | c5f1faddc4b990ffed20f0d1265d989ee10456ecadd090e36c894e2a6b3303aa |
| 코볼트 광부 | monster-fbf5a83b3eea.png | b5fe5251b7b65f1ac2cab93f1a03ee3e4742205b33fe70b7e4dc0489c49dea98 |
| 광산 박쥐 | monster-50bf083fb88d.png | 31d78defca7b2b4b6014208ea4d130cdf50c74e0e270fd0f542d3cea486a04df |
| 수련 님프 | monster-70b7adba43b9.png | 0b0e3d1bf8f7fa0562cdeea4c5ac3b3c1205fa0a2a06afb5911a7b18fd051de4 |
| 광석골렘 | monster-b022bd831287.png | 4ed9b0fd96ccc6057cc40f79fd657fa679878916d485041f1498e49d785f01dd |

## Follow-up

Later source update: v7 now also preserves water spirit, dark mage and kobold miner candidates with prompts and hashes. Owner verified full-size semantic direction: liquid body, dark hooded caster, and reptilian miner with pickaxe respectively. Water/dark mage have alpha channels (not yet clean-alpha approval); kobold miner hasAlpha:no with painted checkerboard and is rejected for runtime. All five required names now have source candidates, but none of this v7 batch is adopted. Small-size review, transparency correction and coupled tests remain pending.

Source preparation update: built-in centipede and harpy candidates are preserved in `scripts/art_sources/monsters/v7/masters/` with actual prompts and SHA-256. Owner viewed both: centipede has correct segmented many-legged body; harpy has correct human-bird anatomy but overly fine illustration detail and insufficient wing margin. Harpy is not style-approved and needs simplification. Other three required sources are not prepared. No runtime findings closed by this source preparation.

Five required source replacements join the prior three early-region findings; two contextual decisions need closer review. Reuse the existing source/master/provenance pipeline, preserve current PNGs, and do not change game numbers to fit incorrect artwork. No generated master, authored registry adoption, test change, evidence refresh, native build or device proof was performed in this audit. `git diff --check` is the docs-only gate; full software gate status remains the separately recorded4361/4365 unit result with four Earth Verdict art failures.
