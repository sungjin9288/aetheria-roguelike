# Task 3 report — canonical character art

Date: 2026-08-09

Base: `00241b5becd64f524b240067e65f0885ad455a63`

Target: `main` → `origin/main`
Status at report snapshot: implementation and all Task 3 verification gates complete; this report is included in the cohesive Task 3 commit, whose final hash and push result are emitted after the snapshot.

## Outcome

- Added one first-and-only canonical runtime candidate for each of the live 18 jobs.
- Added a manifest/design-bible-derived shared prompt and 18 exact role prompts with lineage parent, combat promise, silhouette, primary weapon, palette, and prompt SHA-256.
- Added deterministic import/normalization tooling. Opaque tracked masters fail closed; an opaque working import may use only edge-connected background cleanup before acceptance.
- Produced 18 true-alpha tracked masters and unique normalized `768x768` runtime exports. Every export is centered, bounded to `<=600x630`, and aligned to foot baseline `y=708`.
- Reused `PixelCharacterAvatar` in Job Change and removed Adventurer fallback from every known job candidate list.
- Produced deterministic labeled/anonymous 6x3 contact sheets, preserved the provisional self-review, and closed the independent blind thresholds at exact identity `18/18` and combat-promise match `17/18`.

## TDD evidence

1. Mapping RED: the exact 18-job mapping test failed on legacy multi-candidate/fallback behavior.
2. Processor RED: both opaque-master rejection and checkerboard-import tests failed because the processor did not exist.
3. Processor GREEN: both tests passed; the first Adventurer source/export passed true alpha, bounds, margin, and baseline before further generation started.
4. Prompt GREEN: 18 manifest roles, shared direction/hash, role fields, lineage order, and flat-background fallback passed.
5. Mobile E2E RED: `job-change-selected-avatar` was absent.
6. Mobile E2E GREEN: the selected canonical portrait changed from Warrior to Mage, the adjacent identity changed from `전선을 지키는 용사` to `원소의 학도`, and both remained inside the 390x844 viewport. Temporarily emptying the sentence produced the expected mutation RED before restoration.

## Generation and edit attempts

All raw originals remain outside tracked sources and were not deleted. Built-in imagegen was used; no paid local API key or CLI was used. Image generation repeatedly returned an opaque baked checkerboard despite the flat chroma fallback, so every accepted working output used the narrow, tested edge-connected cleanup before entering `scripts/art_sources/characters/`.

| Role / attempt | Raw SHA-256 | Disposition |
| --- | --- | --- |
| Adventurer first candidate | `4663587a5d45d2cf8ff26c0426357c65459d55cc5f759a5c63cb0705c3599715` | accepted after deterministic cleanup |
| Adventurer background-extraction attempt | `8a9e60e4c4d6d962ffeed0cd923459492eda97f3926646c8638e5c124fe9c6b5` | rejected: still opaque baked checkerboard |
| Warrior | `c373b4d48cc121aa470eac1e8fd75814c8be2445124bafd395fc3d334bdd3023` | accepted after cleanup |
| Knight | `ce063918f104fb24517fa1bf60b5e8ffd89dba9bda24e055b54a635b1b4901d8` | accepted after cleanup |
| Dragon Knight | `a23d366e83b6c103a87dcd1fb17e828e10c420aabed761c505b637dfc81e84ae` | accepted after cleanup |
| Berserker | `44d7df5772e20b3b84ec04eefa949cc5a9c3317309faeebec8903745eabd81f3` | accepted after cleanup |
| Mage | `30a64a3fdab693b2e73d5568e10f39304fac9002c2e66187fce64b85d4960e3a` | accepted after cleanup |
| Archmage | `919e1d813ef911faaab9caa56df4b8e55491f4351f4340a47ca0894e8e572eb9` | accepted after cleanup |
| Grand Mage | `5f94786705ace77319fa08fe1f0613a7e72a026f0dd42d1ffeb9adff69ff46bd` | accepted after cleanup |
| Warlock | `ed244d9827b3ee203398a18cbee414a7267054b8d86b9446c393a04051c6bc58` | accepted after cleanup |
| Cleric | `709575f6cfb10786132a7ec3784e7f96c2398306bf97c8627066f91d36bfd29f` | accepted after cleanup |
| Paladin | `93c9ef5207599390049a33cd71aabf7c26e6f0e60b968f252941abb634d4d14e` | accepted after cleanup |
| Shaman | `b89a4954b7750a1a3daaa09213a9eabf757db6bcdddf4810498a7377d8615d0b` | accepted after cleanup |
| Chronomancer | `f7429f64a7e9790ba7ce38595391ffdea07466436aaa07420e0bdeb6e653bcec` | accepted after cleanup |
| Rogue | `390972c15f2f43027609048fa882299d02111567ca9e173c2fb92ab7a0281ecf` | accepted after cleanup |
| Assassin | `0177119d88e578a2ce58f71e65f10c5a52c8336f44875e5f92d7d3070f9a3b12` | accepted after cleanup |
| Shadow Lord | `184c2672d42643e1013453488d51ff63bb648b1b50fc957c9679e00b161a0665` | accepted after cleanup |
| Ranger | `88af4e13a4cee29276fb14eba6b1126209ca3679d636bef244a07851953cfbd5` | accepted after cleanup |
| Hunt Lord | `8935460c6414a9b32f6fab3840c0390986b5fbc76bed66a857ac24c8f2c5750d` | accepted after cleanup |

## Accepted source and runtime hashes

| Job | Source SHA-256 | Runtime SHA-256 |
| --- | --- | --- |
| 모험가 | `79e39b4f3ffb01cdfafc623b3ed8c672973f8c3424b3795d3b1a692d86185c33` | `be788aaf1b5b18cd152878ad46596a7aa1f4bf75d58c1eb35d858c447416b586` |
| 전사 | `508682d70b55171203c9232494c9f7d85d2e89e5b4a4027c0e809f7cb08e34d6` | `b05581e536bfb1e3ce2519320151b593a5c6ca2d88ba486db02867a395f38d49` |
| 나이트 | `4b85aaa3754aafcc472b7b3e443ecd5a9c7ace2b602ef506279afa607bd5dbb5` | `c79383abb4993c485d17e37d98e7f0a5dd1e9d69fbb15c2348c67397d91cd835` |
| 드래곤 나이트 | `81c06959a2b53d7032f3dc7282c2e25d7a3ac16198540d19ad275992a37eb91a` | `666cc4d7d9350fc76f256bb154ebcb26a01af6911fb038e2995bdf682ff8ea02` |
| 버서커 | `dfada977b9bfe5353e5b9b735142e2e44baba03f5c4c896ecddbcef8fb106167` | `c31138ae52169d0dac27435525e4029714aa845bfa04979f49bff11e1008ebc5` |
| 마법사 | `40960d0e9b9fb3803db60906326509d81357df2260d4d90b3f7b77909c5f01a9` | `c0052602625b3c4e1211b17be234ed872540af4f2cc7087c7e6f643aece5e5b6` |
| 아크메이지 | `380c3eaab7be17e5417f45be1d9a9675be858518e6e357749096a2a2efc66fde` | `65f739cdfa262b58c574e62c3fab6a1587b08c66564c5e452561ef86b6104ed9` |
| 대마법사 | `af8614afe2550fbcbd51697e2a1934e7720d422cbf72aae7ccd8dc03ff1a005e` | `1b9a30ce75fdaac3151d6ce5be4137e234906b6d4ee05ad74cb96d95f5776a7c` |
| 흑마법사 | `bb0896f90f98f361fbb67f056246298d05494984904d3077c8dcc6f34689da3c` | `b7ce61adf7adb20413e0e408aa9acc159e6b1e2c3796d5bc8af5b96e93101a7c` |
| 성직자 | `735134f201e1667e1dc7e07f1fee1a54b45af6f1f0c8dc338e70228f3f861368` | `3c02d238c87dc22b8e7e4d4b7636959360348c059e1ec8a647cb0bedad16efd0` |
| 팔라딘 | `5b271f68b480d744b70bb9df2e89524aae296f99080208ec4762208b6a65f63f` | `19d0a637df0d17637380f0710c3536716cead94fd6fea4d2bb3347d064d2bf77` |
| 무당 | `26d6a4f8e4e9d353dde6aa809a67f6e97df0d34794ef384a3b4ed0916a87bf87` | `59668e025666e3ff94337d17d4d6100e08dfca7a65f6f743f2f33ac54d320611` |
| 시간술사 | `e955f86166786d9c4af813590cea9c3f3f371e91ac072df5444242bc69741a80` | `fe1b1ffe3951f4012eab3cf5b556bd544859107bf6af15df86900db8b17e3362` |
| 도적 | `5cbd88413f2a2578c5cbb1c5e7563afd7fbab5f8b2912d1ae0b2506921ecf855` | `eec955262b355772ab77d2cc0497b322bfb1027a95a30f0ba087177986f0c554` |
| 어쌔신 | `74059528103ca2b8732b17efa11664ebb78897f9458afbe019d6caa13dc14c56` | `b3d36cf41bd13015116612f1a2a713675206a02dba647390f84ed775e1526b94` |
| 그림자 주군 | `e99a4579692f52173c7a41b814a41899722ea0d5d5caeda854aee8b573355708` | `40b44fb8478f5a0fa77ec25d7667399c33391226e43182d5a017b5e7513f0649` |
| 레인저 | `6adaecfe4a7e16a48d4afe802b786050d10ca853a9c8d3b80ca134addd842a8f` | `437ae033c20d404a159b89c12e74b7635ce50240ea0769e853be1836f5789253` |
| 사냥의 군주 | `8afa1b80e71972f81fc2445054f40ff947fc7d584e24d7f76e27be45b31f1e9b` | `6dba952811fc8e73b2d2d41d1be565d2d48c649753a63c06958b3f96e476a804` |

The machine-readable canonical record is `docs/evidence/art/character-provenance.json`.

## Visual review

The labeled and anonymous sheets were both inspected at original resolution. All rows visibly change face detail, primary weapon, and shoulder silhouette rather than palette alone. Rogue's poison-vial cue is the weakest secondary signal at 40px; the twin daggers remain distinct. The original non-blind implementation review is preserved in `docs/evidence/art/character-review-2026-08.md` as provisional history.

The later independent reviewer recorded immutable guesses before seeing the labels/design references and scored exact identity `18/18` and combat-promise match `17/18`, both above the `>=16/18` threshold. Row 16 identified `그림자 주군` exactly but inferred clone-led multi-hit battlefield control; the authoritative correction is darkness-stacking toward guaranteed execution.

## Validation record

- Focused character/unit contract: `42/42` GREEN.
- `npm run art:verify -- --scope characters`: GREEN with 18 exports and zero missing, extra, duplicate, PNG, alpha, bounds, or style errors.
- Focused Playwright Job Change portrait flow: RED for missing identity locator and again for a deliberately emptied identity sentence, then GREEN `1/1` on Chromium Mobile after restoration.
- `npm run verify`: GREEN — type-check, lint, unit `3503/3503`, and production/test-harness build guard.
- Full focused `tests/e2e/job-change-design.spec.ts`: GREEN `4/4` on Chromium Mobile through the repository Playwright harness.
- `git diff --check`: GREEN.
- Provenance integrity probe: `styleVersion 2`, `18` processed entries, `18` unique export hashes, and `18` prompt entries.

## Commit and push status

- Commit subject: `feat: [18개 직업 정체성 완성] canonical character art and mobile job portrait integration`
- Commit scope: one cohesive Task 3 commit; `build/` excluded.
- Push target: `origin/main`.
- Final commit hash and remote update are reported by Git after this report snapshot; no self-referential hash is asserted inside the commit that contains this file.

## Scope and residual risk

- Equipment art is not complete. Tasks 4–8, equipment styleVersion 2, full-surface verifier approval, and `art-contract-report.json` remain open.
- The independent blind character gate is closed at identity `18/18` and combat promise `17/18`; row 16's promise miss remains recorded evidence rather than an open blocker.
- No native package or signed archive was created; the latest native artifact remains unchanged.
- `build/` is explicitly excluded from this Task 3 change and staging scope.
