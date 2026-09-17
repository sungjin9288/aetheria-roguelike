# Sky and storm corrections — built-in prompts

## Background-extraction attempt — rejected, preserved

Input: masters/storm-siren-compact.png. Built-in output exec-22582c29-0935-429c-956e-acbc939b7bea.png copied unchanged to masters/storm-siren-extraction-rejected.png. It introduced a glow/background and changed framing; not selected. The compact RGB source is instead processed non-destructively by prepare.py using reviewed neutral-region flood seeds, not generative redesign.

```text
Use case: background-extraction. Edit target: the attached compact storm siren pixel-art sprite. Remove ONLY the baked gray and white checkerboard background and output a genuinely transparent RGBA PNG with alpha zero outside the creature, including enclosed gaps between hair, wings, arms and feathers. Preserve the entire existing creature: same face, silver hair, pale feather highlights, clothing, pose, two wings, two arms and bird feet. Do not erase white or pale pixels belonging to the creature. Keep complete wing tips and the existing empty margins. Do not draw a checkerboard, white background, border, ground, shadow, text, extra objects or new effects. Do not redesign or crop the sprite.
```

Eleven confirmed Important cases from monster-sky-general-review-20260907.md. Avian storm siren is an explicit design choice fitting its sky-region context; contextual six remain separate. Preserve generated originals and previous runtime assets. Individual source generation is not canonical adoption.

## Storm siren framing revision

Initial image exec-540df832-ca33-4ca6-9d1e-355acf6b6b6a.png has wing tips cut by the horizontal canvas edges. Preserved as masters/storm-siren-initial.png and not selected for adoption.

```text
Edit only the framing and wing pose of this storm siren. Preserve the same adult humanoid singing face, silver hair, violet-blue feathered clothing, two arms, two feathered back wings, bird feet, colors and pixel-art style. Make the entire creature smaller within the canvas and fold both wings slightly inward so every outer feather tip is visible and there is a clearly empty transparent margin of at least 10 percent on all four sides. Reconstruct any wing tips previously clipped by the left/right borders. Keep the body centered, compact and entirely visible. Genuinely transparent RGBA background. No crop, frame, ground, text, separate particles, additional characters or new props.
```

## 천공 수호조 / sky-guardian-bird

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A vigilant celestial guardian bird, unmistakably avian: strong hooked ivory beak, stern golden eyes, broad white-and-pale-gold feathered wings half-open around a compact upright body, layered feather tail and two visible taloned bird feet. Small worn gold chest guard integrated into the breast. Majestic heavy guardian silhouette, not a small falcon. No bat ears, fur muzzle, membrane wings, flame tail, tree limbs or separate glowing ornaments.
```

## 폭풍 그리핀 / storm-griffin

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A storm griffin in a compact braced battle stance: clearly eagle head with hooked beak, feathered silver-blue wings, eagle front talons, muscular tawny lion hindquarters, lion rear paws and tufted long tail. Four connected limbs, complete animal visible. Navy storm-feather markings integrated into wing tips, alert amber eye. Readable eagle-lion hybrid, not a dragon or plain bird. No reptile head, membrane wings, fire, armor-covered anatomy or detached lightning.
```

## 폭풍 매 / storm-falcon

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A fierce storm falcon in a compact banked-flight battle pose, full bird visible: pointed swept feathered wings, hooked short beak, sharp amber eye with dark falcon cheek marking, slim slate-blue body, banded pale breast, short fanned tail and two small curled talons. Clear aerodynamic bird silhouette, distinct from a broad-winged white guardian bird. No bat ears, fur muzzle, membrane wings, burning tail, crown, weapons or detached lightning.
```

## 폭풍 세이렌 / storm-siren

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A storm siren interpreted as an avian singing creature for a sky region: expressive clearly humanoid face with open singing mouth, wind-swept silver hair, two broad indigo feathered wings attached to upper back, compact modest fully feather-clothed humanoid torso with two arms lifted near chest, feathered lower body and two bird taloned feet. Cool violet-blue storm feathers, pale face is the focal point. Dangerous mythic singer, not a bat, fish or ordinary fairy. No nudity, membrane wings, bat ears, flame tail, musical note symbols, separate effects or extra characters.
```

## 빛결 수정체 / light-crystal

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A hovering living light crystal with no humanoid features: one large upright faceted warm-ivory and pale-gold central prism, several thick shorter translucent crystal spires physically fused to its base and sides, bright golden light confined within the mineral facets. Broad clean planar edges and compact asymmetric mineral cluster silhouette. Clearly crystalline substance even at tiny size, not tree foliage. No face, eyes, hands, legs, leaves, roots, branches, ground pedestal, disconnected shards or external halo.
```

## 광풍의 원소 / gale-elemental

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A fierce gale elemental formed from a substantial dark storm-air cyclone: broad swirling shoulders, two thick curved wind arms, narrow lower tornado funnel and stern luminous pale eyes embedded in its central vortex. Layered slate-violet and silver-gray wind bands with clear curved negative spaces; a muscular aggressive storm silhouette. No solid armored humanoid legs, leaves, branches, horns, fire, ocean foam or detached wind lines. All wind forms join the single cyclone body.
```

## 구름 정령 / cloud-spirit

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A compact buoyant cloud spirit made entirely of several joined rounded cloud masses: large soft lobed pale-gray upper body, small serious blue eyes nestled in the central cloud fold, two stubby cloud arms and a tapering cluster of smaller cloud puffs beneath. Cloud texture rendered as broad stepped pixel shading, pale lavender shadows and ivory highlights. Squat rounded silhouette distinct from a tall tornado. No leaves, antlers, tree trunk, legs, thunderbolts, orange fire, blue ocean waves or separate floating clouds.
```

## 바람 정령 / wind-spirit

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A graceful but alert breeze spirit with an open curved silhouette: slim pale mint and ivory flowing air ribbons form one continuous S-curved body, small masked face near upper curl and two delicate long wind arms trailing back; lower body loops once and ends in a taper. Main ribbons broad enough to read at tiny scale, pale teal shadows. Light horizontal-leaning breeze motion, clearly different from a bulky violet tornado or rounded cloud puff. No leaves, branches, plant hair, antlers, insect wings, legs, watery foam, fire or detached decorative swirls.
```

## 번개 정령 / lightning-spirit

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: An angular lightning elemental with a compact jagged humanoid outline: sharp central yellow-white electrical bolt forms head and torso, two branching zigzag arms end in three pointed bolt fingers, lower body a single heavy zigzag taper. Bright gold and pale ivory core with cobalt blue inner shadows, sharp pixel corners not rounded fire tongues. All electrical branches connect to the main body. No tree leaves, wooden antlers, flame, smoke, armor, weapon, detached sparks, electric-symbol icon or background glow.
```

## 성운 감시자 / nebula-watcher

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A mysterious nebula watcher: compact hooded sentinel in deep indigo robes with a single small luminous eye inside a dark face opening; broad silver shoulder plates and a long folded cloak containing subtle violet-blue nebula patterns entirely within the cloth. Holds a short staff with a solid faceted orb head close to the body, one hand raised watchfully. Clear hooded watchman silhouette with cosmic material accents, not a fiery king. No royal crown, orange flames, molten robe, leaf hair, floating stars outside body, giant halo, detached planet rings or typography.
```

## 하늘 정령 / sky-spirit

```text
Use case: stylized-concept
Asset type: Aetheria mobile roguelike enemy portrait source, one isolated full-body pixel-art sprite.
Style: polished dark-fantasy 16-bit JRPG pixel art with coherent blocky pixels, crisp stepped silhouette, limited material palette and broad readable shapes. Design must read when reduced to 46px and 32px; avoid a noisy mass of fine microdetail.
Composition: single centered complete creature filling about 80% of a square canvas, compact three-quarter battle pose, entire body and equipment visible with comfortable empty margins. No scene, ground platform, framing, text, symbols, meters, corner ornaments, watermark, extra characters or separate particle effects. Genuinely transparent RGBA background, not a checkerboard drawing. No outer halo or drop shadow.
Subject: A serene yet imposing sky spirit: a compact levitating humanoid figure made from pale azure air and soft light, smooth faceless mask with two narrow bright eyes, arms open slightly, long flowing blue-white mantle joined to a single upward-curled air tail rather than legs. Two substantial wing-like folds of the same mantle rise beside the shoulders but remain continuous fabric-air, not separate feathered wings. Clear upright luminous airy figure distinct from the small rounded cloud or thin mint breeze. No leaves, branches, antlers, regal crown, flames, armor, detached halo, star icons, background rays or separate particles.
```
