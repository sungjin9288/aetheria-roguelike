# Frost Lord readability follow-up

Built-in imagegen only. Both previous selections and rejected attempts remain preserved. Neither output is adopted in runtime by this record.

## Same-design edit — rejected opaque checkerboard

Use case: precise-object-edit. Edit target: the attached transparent Frost Lord sprite. Change ONLY composition scale: enlarge this same complete character so the visible crown-to-boots silhouette occupies 87–90% of the square canvas height, centered, with 5–6% empty transparent space above the crown and below the boots. Keep every crown point, gauntlet and cloak edge completely inside the canvas. Preserve the same icy sovereign identity, white hair, silver-blue heavy armor, navy frost-edged cloak, ice crown, snowflake in hand, full-body pose and pixel-art style. Make the broad armor and crown clearly readable as a small game icon. Preserve actual RGBA transparent background; do not render a checkerboard, solid background, ground, shadow, frame, text, or extra objects. This is a tighter full-body framing, not a cropped portrait.

Output: `rejected/frost-readability-opaque.png`. Inspector reports no alpha channel and no transparent pixels; rejected regardless of composition.

## Fresh enlarged silhouette — pending framing review

Create one complete FROST LORD boss sprite for a premium pixel-art fantasy RPG, genuinely transparent RGBA background. Upright ice sovereign, short jagged sapphire ice crown, stern pale face, long white hair, broad silver-blue heavy armored shoulders, dark navy cloak edged with white frost, ice gauntlets, a small snowflake crystal held beside chest, armored boots fully visible. Coarse readable 16-bit pixel clusters, strong indigo outline, restrained silver/blue/white palette, hard three-tone shading. The COMPLETE visible character occupies 88% of a square canvas height and about60%width; only6%clear transparent margin above crown and below boots. Large readable silhouette for32px icons. Entire crown and both boots and cloak ends remain visible with no clipping. No scenery, ground, drop shadow, frame, label, text, fire, orange light or additional characters. Background must be actual alpha transparency, NEVER an opaque checkerboard or colored backdrop.

Output: `masters/monster-34852baa4124-readable.png`; normalized sibling under `exports/`. Not selected: source crown reaches the top boundary. Passing normalized margins do not repair clipped source framing.

## Fresh compact silhouette — candidate

A single full-body pixel-art FROST LORD boss sprite, actual transparent RGBA background. Square canvas. IMPORTANT: Leave the TOP 12% and BOTTOM 12% of the image completely EMPTY TRANSPARENT. The character including crown and boots occupies only the middle 76% height, never touches image edges. Ice king with a LOW broad three-point sapphire crown, white hair, pale stern face, broad silver-blue heavy shoulder armor, dark navy frost-trimmed cloak, armored gauntlets and boots, one small snowflake floating just above his palm. Broad compact imposing silhouette, not tall thin, cloak held close. Clear coarse 16-bit pixel clusters with dark indigo outlines and hard blue/white/silver shading. Entire crown tips and boots clearly visible with large blank alpha gap above and below. No frame, floor, shadow, backdrop, checkerboard, words, logos, fire or scenery. Transparent sprite cutout only.

Output: `masters/monster-34852baa4124-compact.png`, normalized sibling under `exports/`. Complete crown/boots visible in owner original review. Pending 32/46px review and independent acceptance. Total built-in calls for v4: 12. No runtime adoption or paid API call.
