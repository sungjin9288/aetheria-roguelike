# Monster body corrections — S3 first three, 2026-09-05

This document preserves the first-batch checkpoint. On2026-09-07 a second eight-body batch was added in `../v2/`; the version-1 correction registry now contains eleven authored exports. The historical counts below describe this first batch, not the current remaining prototype count243.

These are three individually generated, visually reviewed corrections, not approval of all 254 monsters. Built-in `image_gen` was used; no CLI image API, paid API key, or subscription was added. `masters/` preserves each original 1254×1254 RGBA result; `previous/` preserves the three replaced prototype-derived runtime PNGs.

| Name | Key | Required body | Master SHA-256 |
| --- | --- | --- | --- |
| 눈보라 정령 | monster-adbbab114586 | Snow/ice vortex and ice shards; no cyclops or vegetation | ece47a103a59458148b60ae1b4429a1b5ee128b1452254488185ebd9dabe27cc |
| 머맨 | monster-6a26c6325796 | Scaled humanoid torso, gills, fins and fish tail; no flame/tentacles | 9db375db2ef4847f0b0e0e38363559898cec684452651946c702295e9f690f49 |
| 스핑크스 | monster-1a287740b890 | Human head and four-legged lion body, paws and tail; no fairy | 4fa28e496ee8fd7f7515b23cde373d82cdef4f3be949d3576c44e3566fda9021 |

The prompt set is in `prompts.md`. `corrections.json` pins the accepted, size-only exports under `public/assets/monsters/authored/v1/`. The normalizer fits the unaltered master into 144×144 on a transparent 160×160 canvas with nearest-neighbor sampling. It refuses to overwrite an existing destination. This is an export step, not procedural replacement artwork.

```sh
node scripts/normalize-monster-source.mjs scripts/art_sources/monsters/v1/masters/monster-adbbab114586.png /tmp/new-blizzard-export.png
node --import tsx --test tests/monster-catalog-art.test.js
npm run art:monsters:verify
```

Re-generation is not the acceptance gate for new designs. Review the body and actual thumbnail first, then update the exact canonical-name/path/hash pin. A different Chromium version may encode the size-only export differently: do not silently repin it. The accepted PNG bytes, not the browser encoder version, are the reproducible production input. The catalog generator copies these bytes without recoloring, mirroring, crowns or aura; its legacy path remains unchanged for the other 251 names. A new correction version must preserve prior masters and exports.

Reviewed by owner and independent agent at original/160px; owner also inspected the 32px comparison on dark/light backgrounds and actual 46px combat portraits in a 390×844 viewport. Captures are in `output/playwright/completion-20260905/art-{blizzard,merman,sphinx}-combat-390x844.png` and `art-corrections-32-160.png`. The comparison sheet is a visual review surface, not a gameplay screenshot. Combat fixtures used an isolated offline `deviceQa=item-investment` save; they do not prove natural spawn or combat balance.

An initial fixture used the nonexistent location `호수 신전` and hit the error boundary. It was corrected to canonical `호수의 신전`; the three-case rerun had zero new console/page errors and width/scrollWidth 390/390. This fixture failure is excluded from clean-run claims. Startup HP-difference feedback was visible during restore; it is a separate follow-up for the S5 restoration UX audit, not damage caused by these assets.

Prior runtime SHA-256 (still reproducible from the preserved prototype sources):

- 눈보라 정령: `6e2d5bd751ce65de8f9ba70762be4349eab13db2ae603aa15e1d6eb4aa37de8f`
- 머맨: `f0b724d26dfd0a5918dbe94606ac7c7cd7704ff193a293e7b1936aa4647e57a6`
- 스핑크스: `d0a5dbbb9baff83936f2d505f338b639726801e31350d41aa5d49b51d04c7d24`
