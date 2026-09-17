# Contextual-six boss artwork review

Classification: current-source visual/semantic audit, not gameplay balance or device proof.
Owner inspected all six160px runtime PNGs and production phase/brief sources; independent Sol reviewed actual images and32px readability. Critical0 / Important5. Existing runtime files remain unchanged by this review.

| Decision | Monster | Required visual correction / source contract |
| --- | --- | --- |
| Important | 공허의 신 | Replace generic ghost knight/shield with a monumental void-deity silhouette. Existence-devouring and absolute void phases are explicit (`src/data/monsters.ts:608`); a specific anatomy is not required. |
| Important | 시간의 파수꾼 | Replace plain skeleton-soldier reading with an armored sentinel carrying one strong temporal split/dial/echo cue. Past/future attacks and time fracture are explicit (`src/data/monsters.ts:341`, `:870`). |
| Important | 영겁의 수문장 | Remove unrelated orange flame-mascot body. Use an integrated gate/lock/shackle/time-barrier silhouette consistent with time restraints and attrition (`src/data/monsters.ts:122`, `:852`). |
| Important | 타락한 세계수 영혼 | Preserve spectral/tree identity but make corruption dominant through black sap, ruptured bark or poisoned core. Healthy childlike forest spirit does not convey polluted world tree (`src/data/monsters.ts:481`, `src/data/maps.ts:307`). |
| Important | 고대 호수의 수호신 | Replace reused forest spirit with a sacred water guardian and integrated wave/moonlit-water cue. Deep-water slumber, waves and freeze are explicit (`src/data/maps.ts:24`, `src/data/monsters.ts:760`). No fixed aquatic anatomy is required. |
| Accept | 화염 군주 이프리트 | Crowned fire lord, flaming hands and lava palette match lava-heart release/burn. No source contract requires djinn anatomy (`src/data/monsters.ts:697`, `:924`). Preserve current art. |

## Exact runtime preimages

All paths are under `public/assets/monsters/catalog/`; all six are160×160 RGBA and match their current manifest hash.

| Monster | PNG | SHA-256 |
| --- | --- | --- |
| 고대 호수의 수호신 | monster-7a1b900ab404.png | f420dafe1a6ba6711e0e8dc1a7782ff0f64ae8793cbfe5c278f6a78dab4a3b32 |
| 화염 군주 이프리트 | monster-4c526ed462f8.png | 585ce5366334be2a8b3904cc40d47b9cfb1415fdbc901f75232710adcea165ee |
| 공허의 신 | monster-4c0a057e31f9.png | 4ccd555bb46b1c207c81e649d14893e7080bfe6cb9adcc0185fb5bb9371b2201 |
| 시간의 파수꾼 | monster-687373df58bf.png | 33361416482764e8c352ff96d1f015003cb86523a56e1e23e9e18b23f45eb287 |
| 영겁의 수문장 | monster-6efd5aa36605.png | fba53fc50a554224c4ae8485175688688bc177b435d479a71fdf4ae6e403d466 |
| 타락한 세계수 영혼 | monster-c6ec225b8f23.png | c5d3872b170d12b6fd00624c49b43e0f875724164a9f3df1148699a3ebaab4be |

## Next coherent slice

After required-five v4 verification closes, prepare five transparent source sprites without gameplay numeric changes. Preserve originals/prompts/preimages, inspect full framing and32/46px identity, independently review, then TDD-pin only accepted exports through the existing authored registry. Keep Ifrit and the other249 runtime records/bytes unchanged. A boss ornament or unique file hash is not a substitute for a readable identity.
