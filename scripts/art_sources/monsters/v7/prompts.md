# Mine/lake/highland replacements — source candidates

Built-in image_gen only. Originals copied unchanged; no runtime adoption.

## Giant centipede

Use case: stylized-concept. Asset type: Aetheria mobile JRPG monster sprite. Create one giant centipede, NOT a spider or a swarm. One long low segmented chitin body curling into a compact S-shaped silhouette seen in three-quarter overhead view, copper-brown shell plates, many clearly paired short legs along BOTH sides of its body, small antennae and mandibles at a distinct head. Humble dangerous mine insect, no humanoid body. Crisp deliberate pixel art, chunky square pixel clusters, dark plum outlines, earthy amber highlights from upper left, limited palette. Whole creature including antennae and legs centered on square canvas with generous12% fully transparent margin. Genuine RGBA transparent backdrop, no scenery/floor/shadow, no loose floating pixels, no corner markers/text/border, no flames or magical aura. Readable as a long many-legged segmented arthropod at32px. Single sprite, not sheet.

Generator output: `exec-8c064839-bdfb-4abb-9110-fe1f2d47e69f.png`.
Workspace: `masters/centipede.png`.
Full-size owner observation: one segmented body, antennae, mandibles and many paired legs; no spider-swarm identity. Actual-size readability and clean alpha are not yet verified.

## Wind harpy — detailed candidate, not accepted for runtime

Use case: stylized-concept. Asset type: Aetheria mobile JRPG monster sprite. ONE adult harpy wind predator, full body in a compact hovering battle pose. Human feminine head with stern face and long swept hair, modest feather-covered upper torso, two broad feathered bird wings in place of arms, scaled bird legs ending in sharp talons. No human hands, no dragon muzzle, no dragon body or reptile tail, no bat wing membranes. Gray-blue and muted ivory feathers, dark slate accents, wind-swept feathers as the wind cue rather than floating graphics. Crisp deliberate pixel art with chunky square clusters, dark plum outline, upper-left light, compact JRPG bestiary style. Entire wings, hair and talons centered in square canvas,12% clear margin on all sides. Genuinely transparent RGBA backdrop, no scenery/floor/shadow, no text/border/corner marks or detached particle debris. Readable human-bird hybrid silhouette at32px. Single sprite not sheet.

Generator output: `exec-80e75728-63ee-4ac6-98a9-3e8f3f2a29fd.png`.
Workspace: `masters/harpy-detailed-candidate.png`.
Full-size owner observation: humanoid head/torso, feathered wing-arms and bird talons replace the dragon identity. However, the generator produced fine illustrative feather/hair detail and almost edge-to-edge wings instead of the requested compact coarse sprite with12% margin. Preserve as a design candidate; do not approve runtime style or crop. Next use the candidate as a reference for a compact low-detail sprite and verify actual sizes before export.

Initial preparation covered only centipede and harpy. The following later entries add the other three source candidates, not runtime acceptance. Existing runtime preimages are in `docs/evidence/art/monster-mine-lake-highland-review-20260907.md`.

## Water spirit

Create a single WATER ELEMENTAL sprite for Aetheria, a compact mobile pixel-art JRPG. It is a small living cresting wave: curled translucent blue water body with a simple face, two foamy wave arms and a swirling liquid base, no legs required. Clearly formed from flowing water, NOT leaves, wood, antlers, tree, fairy, ice golem or flame. Deliberate chunky pixel art like a64x64 sprite, bold dark navy/plum outline, cyan and blue body, a few ivory foam highlights, limited color clusters and upper-left light. One strong curved silhouette readable at32px. Entire sprite centered within the central70% of a square canvas, generous empty margin, true transparent RGBA background including internal gaps. No painted checkerboard, no scenery/floor/shadow/text/ornaments/corner pixels, no floating droplets outside the main silhouette. One sprite only.

Output `exec-bb31e5f3-47e6-4c6e-98e2-3cfc9d7b4925.png` copied unchanged to `masters/water-spirit.png`. Owner observed one blue curling water body and foam arms, no tree/leaves/antlers. Full-size semantic direction matches; small-size and alpha-cleanliness remain unverified.

## Dark mage

Create ONE compact pixel-art dark mage enemy for Aetheria mobile JRPG. Full-body adult mysterious humanoid caster in a deep indigo hood and short layered charcoal robe. Pale partially shaded face under hood, one plain crooked staff with a small violet crystal, free hand holding a compact purple shadow wisp attached to the hand. Clear silhouette, practical modest garments, not royal. NO fire, orange flames, crown, flame body or fire lord appearance. Deliberate chunky square pixel clusters as a64x64 game sprite, strong dark plum outline with restrained violet highlights so robe remains visible on a dark UI, upper-left light, limited palette. Whole staff/hood/feet centered within central70% of square canvas. Genuine RGBA transparent background and gaps, no checkerboard, no floor/shadow/scenery/text/loose corner markers. Readable hood and staff at32px. One sprite, not sheet.

Output `exec-f10c47db-5c00-4bbe-bbe7-ed8c0235fefe.png` copied unchanged to `masters/dark-mage.png`. Owner observed indigo hood, staff and purple shadow effects rather than fire lord. Fine robe detail and dark-background contrast need actual-size review; loose magic particles appeared despite prompt restrictions, so no final export approval.

## Kobold miner

Edit this kobold into a KOBOLD MINER for the same Aetheria pixel-art JRPG. Preserve russet reptilian species, short snout, amber eye, little horns, curved tail, compact body proportions, pixel-cluster style and earthy palette. Replace spear with a clear metal mining pickaxe held across one shoulder, add a simple worn leather miner cap and small ore satchel. Keep face and horns visible, nonhuman identity unmistakable. No human face, fire, crown, magical effects or weapon spear. Full body including tail, pickaxe and feet inside central70% of a square canvas, generous clear margins. Genuinely transparent RGBA background and gaps, no checkerboard, floor, scene, shadow, text or corner markers. One compact sprite readable at32px, not illustration sheet.

Reference/edit input `scripts/art_sources/monsters/v6/masters/kobold.png` was viewed before editing. Output `exec-7d2d46cf-3dc4-4d3c-bef2-677c33554f01.png` copied unchanged to `masters/kobold-miner.png`. Owner observed same russet reptilian species direction with pickaxe, cap and ore satchel. Painted checkerboard background is visible; not runtime-approved. Do not repeat the already-failed harpy extraction strategy unchanged.

## Harpy compact revision — transparency rejected

Edit target: the provided harpy concept. Redraw the SAME human-bird identity as a SIMPLE COMPACT low-resolution JRPG pixel sprite, not a detailed illustration. Preserve adult human head, feather-covered modest torso, wing-arms, bird legs and talons, slate blue/ivory palette. Make head larger relative to body; shorten wings into compact folded-up V silhouette; simplify each wing to just 5 broad feather clusters, hair to 3 chunky strands; no tiny feather filigree or smooth shading. Deliberate large square pixels as if designed on a64x64 grid. Place the whole sprite in the central65% of a square canvas, leaving a broad empty transparent border on every side. True RGBA transparency everywhere outside the creature and in gaps, alpha zero background with no stray dust. No dragon muzzle, reptile tail, scenery, floor, shadow, aura, lettering, checkerboard pattern or corner marks. Single complete sprite. Main purpose: readable face, wing-arms and talons at32px.

Input: `masters/harpy-detailed-candidate.png`.
Output: `exec-5519d52e-92af-4a05-b017-9c05fe4977ca.png`, preserved as `masters/harpy-compact-candidate.png`, SHA `3e9679a9ebfafea9483223dec3a4fa5c12636c90923ca0dfeb09e13fb5ec7620`.
Owner observed improved compact proportions and wing margin, but visible painted checkerboard. sips confirmed hasAlpha:no (1254×1254). Not runtime-approved.

One targeted extraction follow-up:

Remove the painted gray-and-white checkerboard background completely. Return the exact same compact pixel harpy as a clean cutout with a REAL TRANSPARENT ALPHA CHANNEL, not a checkerboard image. Also remove the checkerboard visible in gaps between hair, wing feathers and legs. Preserve the sprite pixels, colors, shape and position; do not redraw the character. All background pixels must be transparent, including corners and generous margins. No white backdrop, no black backdrop, no shadow.

Input: `masters/harpy-compact-candidate.png`.
Output: `exec-afb09b6a-2dcc-4152-ab5a-f1581523c8e0.png`, preserved as `masters/harpy-alpha-attempt.png`.
Owner again observed a painted checkerboard. Do not repeat this unchanged built-in extraction loop. Preserve both failed-transparency candidates; deterministic extraction requires explicit method authorization. No CLI/API fallback or pixel-processing script was used.

Follow-up sips: hasAlpha:no. SHA-256: `1bfac587ae7e115af363c74cead3b99cc92dea6536416a22a00ea4810e5595d0`. This confirms failed transparency, not a display-only checkerboard.

## Original candidate file identity

## Dark mage readability revision

Generate one compact DARK MAGE monster sprite for a mobile pixel JRPG, deliberately designed to be readable at32px on a near-black background. Adult hooded humanoid, large recognizable pale face in hood, compact squat proportions, short broad indigo robe ending above visible boots, one thick crooked staff with a simple violet crystal. Robe main planes are MEDIUM slate violet, not black; broad lavender shoulder and hood-edge highlights form a clear readable silhouette while deep-purple shadows retain dark-magic identity. Simplify robe into3 broad folds, no buckles/chains/filigree, no detached particles or separate magic-hand effect. Coarse intentional square pixel clusters as a48x48 sprite, dark-plum outline, limited palette, no soft gradients. Full body/staff centered, occupy central70% square canvas, all extremities comfortably inside. Genuine transparent RGBA background, no checkerboard/floor/shadow/scene/text/frame/corner marks. No fire/crown/orange flames. SINGLE sprite, not sheet. Priority: bright face, distinct hood and staff and readable broad robe at32px, not a detailed character illustration.

Built-in output `exec-3ccd97a6-19b7-48b0-9965-4e0507119c8f.png` copied unchanged to `masters/dark-mage-readable.png`. SHA-256 `a772ed3b8aca55d014e04369c4d0c92f27e4ab0ee43313f15b6dfee08d301b4a`, sips hasAlpha:yes. Original dark-mage.png preserved. Owner compared both at CSS160/46/32px on dark/light: broader violet planes and hood highlights improve visible shape at32px. This selects the revised candidate for subsequent alpha/export/combat checks, not final runtime approval.

Later three sources: all1254×1254; sips reports hasAlpha:yes for water spirit/dark mage, no for kobold miner. An alpha channel alone is not clean-transparency acceptance.

- water-spirit.png: `e64573d614293c2a94f8011fe260e884ff1015a52a7a13da8a090150722482f0`
- dark-mage.png: `f78a2d1ccb80786f8295b14c805c7f31df1ebb0c762c6bc4484faa13d1041eb3`
- kobold-miner.png: `c04ea1e1e9fe64d43880c118b0dcae221f9bf22efaf732628318f1fd5c8aec0c`

Both files are1254×1254 with an alpha channel (sips); this is not proof of clean transparent margins. SHA-256:

- centipede.png: `e1854ec9593eb9d145e7cad1ca20736bd90d26b462bfde4a0e967b50f11ba9e1`
- harpy-detailed-candidate.png: `c478d4edf599fc248df676c1a95d03e5696773a5d7288173b25fe3e055a1ac35`
