# Early general monster correction — v6

Built-in image_gen only; no external API or paid-service connection. Masters are candidates, not runtime-approved artwork. Preserve prior catalog PNGs on adoption.

## Goblin

Use case: stylized-concept. Asset type: Aetheria mobile roguelike monster sprite. Create ONE small green goblin scavenger, full body, three-quarter view, large pointed ears, angular hooked nose, squat wiry nonhuman proportions, alert mischievous expression, patched brown leather vest and a single crude short dagger. Clear readable silhouette at 32px. Pixel art with deliberate coarse square pixel clusters, dark plum outline, restrained earthy palette and upper-left highlights, matching a polished compact JRPG bestiary. Centered square canvas, complete ears/feet/dagger inside generous 10% clear margins. Genuinely transparent RGBA background, including all gaps between arms and torso. No scenery, no floor, no shadow, no text, no corner markers, no ornaments, no crown, no fire, no magical aura. This is a humble early-game enemy, NOT a fire lord or boss. Render a single sprite, not a sheet.

Generated source: `exec-22a33246-1886-4954-82db-65eb1fdca1c7.png`, copied unchanged to `masters/goblin.png`.
Owner inspected generated full-size image: goblin body, ears, dagger and feet visible, no fire-lord crown/body. Alpha, runtime sizing, small-screen style and integration remain separate gates.

## Kobold

Use case: stylized-concept. Asset type: Aetheria mobile roguelike monster sprite. ONE small kobold scavenger, full body three-quarter view. Distinct nonhuman reptilian body: short blunt lizard snout, warm russet scales, large alert amber eye, small horns, thin visible curved tail, digitigrade feet. Patched brown leather shoulder vest, plain belt, one crude short spear. Humble early enemy not dragon boss, not human bandit, no human face or wrapped cap. Crisp JRPG pixel art, dark plum outline, chunky deliberate square pixel clusters, restrained earthy palette, upper-left lighting. Compact clear silhouette readable at32px; character centered on a square canvas with10% transparent margin around complete spear/tail/feet. Genuinely transparent RGBA background and gaps. No scene, floor, shadow, magic, flames, text, watermark, border or corner marks. Single sprite, no sheet.

Generated source: `exec-2ad7c100-01ca-4e1f-b721-bc84b147f6a9.png`, copied unchanged to `masters/kobold.png`. Full-size owner review: nonhuman snout, scales, tail and spear visible; project-level reptilian design choice, not a preexisting anatomical source requirement.

## Green slime

Use case: precise-object-edit. Edit target: provided Aetheria green-slime.png. Correct this explicitly GREEN SLIME whose body is currently blue. Change only the blue body palette to clear leaf/emerald green, retaining the exact rounded jelly silhouette, two dark eyes, small smile, pixel art grid and pale highlights. Remove the isolated decorative orange corner diamonds/dots: they are not part of the creature. Keep full body in frame, centered, on a genuinely transparent RGBA background; preserve transparency in all exterior areas, no checkerboard painting, no floor or shadow. No additional props, no text, no new anatomy. The green body must read immediately at32px on both dark and light UI. This is one sprite, not a sheet.

Input: `public/assets/monsters/catalog/green-slime.png`, inspected before edit.
Generated source: `exec-a369b7e6-b85e-4908-ba4b-d112a72d92e0.png`, copied unchanged to `masters/green-slime.png`. Owner review: green body and face visible, corner ornaments absent. Generated image is not a byte-exact recolor: highlights/body proportions must be reviewed before acceptance.
