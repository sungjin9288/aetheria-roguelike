# Fire and volcanic general monsters — semantic audit

Owner reviewed17 non-boss, non-authored canonical PNGs, checked all17 SHA values against the current manifest, and inspected original160px plus32px views on three sheets `output/playwright/fire-audit-{1,2,3}.png`. Selection: regionKey fire/lava-zone/fire-temple. Names and cold weakness/fire resistance for the named regional entries were cross-checked in src/data/monsters.ts. This is source-art review, not actual battle progression or final runtime approval.

## Findings

| Decision | Name | Observed body/material and required direction |
| --- | --- | --- |
| Important | 마그마 슬라임 | Blue water-like slime with no molten cue. Keep slime silhouette but establish molten magma material, heat and crust rather than plain blue recolor. |
| Important | 마그마 정령 | Green wood/leaf child with antlers. Requires magma elemental body, not foliage. |
| Important | 용암 정령 | Same wood/leaf body. Requires lava elemental form with readable molten identity. |
| Important | 화산 정령 | Same wood/leaf body. Requires volcanic rock/ash/heat spirit direction, distinct from tree spirit. |
| Important | 화염 정령 | Same wood/leaf body. Requires clear flame elemental form. |
| Important | 용암 거북 | Armored boar with pig snout and no turtle shell/head. Requires turtle anatomy and lava-region material. |
| Important | 용암 거인 | Rounded articulated stone guardian with cyan chest rune, no lava cue. Requires giant-scale body with lava/heat identity; exact flesh-versus-elemental treatment remains a design choice. |
| Important | 용암 골렘 | Ordinary cool stone blocks/cyan rune. Construct silhouette is valid but must convey dominant lava material or molten fissures. |
| Important | 화염 골렘 | Ordinary cool stone blocks/cyan rune. Needs readable fire-golem material/heat, not plain stone tint. |
| Important | 파이어뱃 | Seated dragon with reptilian head, arms, tail and wings. Requires actual bat anatomy; fire affinity alone does not repair species. |
| Contextual | 화산재 골렘 | Gray stone construct could fit a mineral body, but ash identity is weak. Review material direction before selecting a correction; gray alone does not prove ash. |
| Contextual | 화염 감시자 | Hooded goblin with crossbow and no visible fire cue. Guardian species is unspecified; do not reject solely for goblin anatomy. Review fire-role cue and differentiation. |
| No obvious name conflict in this pass | 불꽃 도마뱀 / 화산 도마뱀 / 화염 도마뱀 | Low reptile body and flame tail visible. Three similar sprites still need differentiation/style review; not independent-art approval. |
| No obvious name conflict in this pass | 화염 비룡 | Winged red reptilian body with fire affinity cue. Production name does not independently mandate a strict zoological limb count. |
| No obvious name conflict in this pass | 화염 사제 | Robed, staff-bearing fire caster. Crown/flame face is not by itself prohibited by the name; differentiation from fire-lord art remains a style question. |

Important10/contextual2/no-obvious-name-conflict5. Small cyan corner squares and decorative geometry recur in these prototype-derived images; shared style cleanup remains open independently of the named body/material defects. Do not convert unique PNG hashes or these five non-conflicts into full visual approval.

## Reviewed bytes

| Name | Runtime path | SHA-256 |
| --- | --- | --- |
| 마그마 슬라임 | /assets/monsters/catalog/monster-08a49ce6bd76.png | f9d7892808a243534ad405fe07746def8670e233498d46f784b80958636e5c1f |
| 마그마 정령 | /assets/monsters/catalog/monster-b2498aa058e1.png | e86386ef04889c1024ed1028f669a3ccda976ee6c65213bc87088a5f9c0d079c |
| 불꽃 도마뱀 | /assets/monsters/catalog/monster-02c52111756b.png | e1166168da6677e61fc1b65077ec27165d41ae17704c39ff3a35b4f2e4c169d8 |
| 용암 거북 | /assets/monsters/catalog/monster-7761c9b478d8.png | 48c505b1b13be800ae0aa658f93cddc466055a217c7497c9371c2a819dcda6dc |
| 용암 거인 | /assets/monsters/catalog/monster-7962486e2c30.png | 925f4067bf74a716ccb8d5278ffd6360b954a409a12055ef6618a0395ad25c21 |
| 용암 골렘 | /assets/monsters/catalog/lava-golem.png | 769350ff0d2ba42434194b59f138390aa947a7536693cb9b1f42030303848f60 |
| 용암 정령 | /assets/monsters/catalog/monster-06bde63a8fa5.png | 30b71ef3c95afa501d18d250d60cd4f799cdb4e00ef7762c57453356a52213e8 |
| 파이어뱃 | /assets/monsters/catalog/fire-bat.png | 6ca9496cb3cc8e166a0aa0d9294ccefdf6d07b1eb67bd63b2a11c8477e38bef3 |
| 화산 도마뱀 | /assets/monsters/catalog/monster-fa417fa9f7b8.png | 3b8fc2e628e7fd4e3b1201624f5317a588efbb7e5701cd8fafeeefaa068a3580 |
| 화산 정령 | /assets/monsters/catalog/monster-777be66d21c6.png | 0800730f3cc1185aeb78677f2e086986292754439b29e5a40726e8cf47b36560 |
| 화산재 골렘 | /assets/monsters/catalog/monster-70fff0d39abb.png | f16f7eea8f0d0a9a4d82af889247b64f147b72c7517d96e296a37d49c75ac5a9 |
| 화염 감시자 | /assets/monsters/catalog/monster-c2d37747d557.png | 0a37668149d3165ddb60316ec4d99123204d44563d0b77265e62cfe825e97f9f |
| 화염 골렘 | /assets/monsters/catalog/monster-823db0b2b8eb.png | c5b404d132d3d44a14a7065bfe47dea70ff502e6b6276b0fbf56a6825a8c7fba |
| 화염 도마뱀 | /assets/monsters/catalog/fire-lizard.png | 6ab97985aa55647f2c3dac3f4cc5cfe7c9c74e0097705f3c1e24bc903c41c159 |
| 화염 비룡 | /assets/monsters/catalog/monster-2e2a633653f6.png | 737739f08d33f0e9059026acb0f12928674cd3412a82fae44509b6487b3f516e |
| 화염 사제 | /assets/monsters/catalog/monster-41144233ecc0.png | 0ee51a448d8a50f49f0239076d53b585faeb3ad2464a5dadd0ccbc745d9f7fd4 |
| 화염 정령 | /assets/monsters/catalog/fire-spirit.png | 5df8b4b0a819f132a83167b1cfe8366a862cf81ebc91b304ca73e246c9713094 |

## Follow-up boundary

No game/runtime/image was changed for this audit. v8 cave/snow9 is already integrated and its full54204 is running; do not mix these new10 corrections into that gate. Preserve these preimages before later authored replacement, keep contextual decisions separate, and use actual-size plus actual combat review. This17-monster tranche is not a complete254-monster audit.
