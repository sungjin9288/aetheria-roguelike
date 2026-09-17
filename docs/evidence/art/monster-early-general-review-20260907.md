# Early general monster semantic review

Status: source-size visual audit only; runtime adoption and small-screen approval remain pending.

## Scope and evidence

Selected all 17 non-boss entries with manifest regionKey forest, plains or ruins. Reviewed in two batches (8 + 9), opening each current runtime PNG with view_image. A previous eight-image response was truncated and was not counted; all images were reopened in groups of two or three and actually viewed.

Read `src/utils/monsterVisuals.ts`: exact-name entries resolve to the manifest runtimePath. Cross-checked production names and map membership in `src/data/monsters.ts` and `src/data/maps.ts`. A read-only Node SHA-256 check confirmed all 17 runtime files match their manifest digests; this proves identity of reviewed bytes, not artistic quality.

## Findings

| Priority | Name | Observed mismatch | Correction contract |
| --- | --- | --- | --- |
| Important | 고블린 | Crowned orange fire lord with flaming hands; sourceRuntimePath is fire/fire-lord.png. Production uses a normal goblin with fire weakness, not a flame boss. | A recognizable small goblin body and scavenged equipment; remove fire-lord crown/flame body. Do not change gameplay weakness or stats to justify the image. |
| Important | 초록슬라임 | Dominant blue body despite explicit green name; derived from forest/slime.png. | Preserve slime identity, make the body visibly green on dark and light surfaces. Color correction is sufficient here because the species is already correct. |
| Important | 코볼트 | Human face, wrapped cap and rogue body nearly identical to 평원 도적; both derive from plains/plains-bandit.png. | Distinct nonhuman kobold silhouette, separate from the human bandit. Production does not prescribe a specific reptile/canine anatomy; choose a consistent project species design before generation. |

Exact affected preimages under `public/assets/monsters/catalog/`:

| Name | File | SHA-256 |
| --- | --- | --- |
| 고블린 | goblin.png | 59062df88c796c28177f130eed8b0e4018e43ec0ed1654f838aa11f9167c13ce |
| 초록슬라임 | green-slime.png | e7e9b853557838ddca23e1429a506188c808c229d86ccee73c8b1bdaabfba179 |
| 코볼트 | kobold.png | 0ab9d2c1d6555123e7f04c6f87123f5296a7ae6080f5b79c9a90c82f315aa98d |

## Remaining inspected entries

No obvious name/body contradiction was found at original size in these 14 images:

- 거대 사슴벌레: stag-beetle, prominent mandibles and insect body.
- 거미떼: spider-swarm, multiple spiders rather than a lone insect.
- 늑대: wolf, quadruped canine.
- 독버섯: poison-mushroom, mushroom body; poison readability is not proved by red cap color alone.
- 들개: wild-dog, canine with a different posture from wolf.
- 멧돼지: boar, snout, tusks and stocky boar body.
- 석상 가디언: stone-guardian, articulated stone construct.
- 숲 요정: forest-fairy, small winged humanoid.
- 숲의 정령: forest-spirit, leaf and branch body.
- 슬라임: slime, gelatinous blob.
- 유령 기사: ghost-knight, spectral armored knight.
- 평원 도적: plains-bandit, human rogue; preserve while correcting kobold.
- 폐허 구울: ruins-ghoul, hunched decayed humanoid.
- 해골 병사: skeleton-soldier, armed skeletal soldier.

This is not a 14-item final visual PASS. Small detached colored corner marks are visible in several catalog images; assess them at actual UI sizes before treating them as intentional or harmless. No 32/46px, dark/light browser, combat interaction or device acceptance was performed in this audit.

## Next action and limits

Source preparation update: built-in image_gen candidates for goblin, kobold and green slime are preserved in `scripts/art_sources/monsters/v6/masters/`, with exact prompts and read-only pixel measurements in that directory. Full-size forms/colors were reviewed, but faint exterior alpha remnants reach canvas edges. No runtime adoption; three findings remain open. Small-size review and transparency/export correction are next.

Prepare corrected source artwork for the three findings using the approved built-in image-generation route, preserve originals and prompts, then use the existing authored export and TDD contracts for adoption. If a non-imagegen pixel-processing step is needed, obtain explicit method authorization first. Do not refresh approval metadata to certify the existing wrong bodies.

Only documentation changed in this checkpoint. No PNG, manifest, gameplay, save, packaging, historical candidate or Toss evidence changed. Full software/native gates were not rerun for this docs-only audit; `git diff --check` and the exact 17-file digest check are the performed checks. S3 and the overall Goal remain incomplete.
