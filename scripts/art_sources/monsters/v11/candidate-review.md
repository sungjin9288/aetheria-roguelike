# 수중·영혼의 강 6종 — 원화와 export 준비

## 최신 canonical 적용 상태

등록6누락 RED(31780 exit1) → exact6 authored/runtime PNG·registry·manifest 적용 → focused12/12 GREEN(15795 exit0). Candidate generator9063 exit0이며 변경 entry6, 나머지248 entry/PNG 불변을 비교했다. 분류·catalog hash·게임 수치·save는 변경하지 않았다. Authored66→72는 전체254종 시각 승인 수가 아니다.

Owner가 `output/playwright/v11-stable-*-390x844.png` 6장을 직접 확인했다. Canonical160px decode/46×46px 렌더/overflow0, 초상화와 공격 버튼 조상 opacity≥.99를 기다렸고, 마지막 페이지 console0errors/0warnings. DOM 이미지 대체나 route mocking은 없다. 실제 map key `심해 회랑`으로 고정한 Lv2/HP134 QA fixture이므로 자연 조우·밸런스·전체 조작 경로 검증은 아니다. Browser closed, dev44808 exit130, 화면 실행20276 exit0.

Art/content/event/equipment power·economy/ESLint PASS. 이전 진단을 previous/에 보존한 뒤 write+verify51617 exit0; report와v1 baseline deep equality PASS. Report hash `ff04ac3dc0cb2dd57ac08fb863a6aabf1ca64bd2be50d0b2c4e3d1c6183f68c2`, manifest source SHA만 `bcac7e78809f85b032d751117b76c7b9ca6183577bd72feb911c6e5a8dbda0de`로 갱신했다.

Full28177 exit0 (`/tmp/aetheria-v11-full.log`): unit4389/4389, E2E59+58, desktop/mobile smoke, typecheck/lint/build PASS. Production/cap/doctor56371, Android debug73756, iOS unsigned77888 모두 exit0. 두 패키지328경로가 public/dist와 byte 일치하고 native tracked drift0이다. 최신 artifact 경로·SHA는 `native-checkpoint.json`에 기록했다. Historical candidate6/Toss38 aggregate도 불변이다. `devicectl` 재확인 결과 iPhone paired/developerMode enabled지만 tunnel unavailable이므로 설치하지 않았다. 기존 archive·설치본은 변경하지 않았다.

Sol xhigh exact6 독립 감사(`/root/v11_review`) 완료: Critical0/Important0/Minor0. Intent/code/preservation-security/evidence PASS, visual PASS with documented small-detail limits. Reviewer가 export sheet와 실제390×8446장, source/preimage/registry/PNG 연쇄를 직접 확인했고 source test2/2도 독립 실행했다. Generated original↔master, export↔authored↔runtime byte 일치, 기존 registry66개·다른248 manifest records·catalogSha256 불변, diagnostic report/v1 불변을 확인했다. 파일/index/HEAD 변경은 없었다. Full/native는 main의 실행 증거로 구분했다.

이 감사는 전체254종 또는 전체 Goal의 승인을 대신하지 않는다. 모든 v11 command와 reviewer는 terminal이다. 추가로 읽기 전용 검수한 하늘·폭풍17종의 Important11/Contextual6은 `docs/evidence/art/monster-sky-general-review-20260907.md`에 기록한 다음 slice다. 아래 preparation 시점 기록은 역사이며 최신 적용 상태는 이 절을 따른다. 새 설치·commit·publication·전체Goal완료 없음.

2026-09-07. `monster-water-general-review-20260907.md`에서 확인된 Important6 교정 후보다. Built-in imagegen으로 개별 원화를 만들었고 정확한 프롬프트는 `prompts.md`에 보존했다. 유료 CLI/API fallback을 사용하지 않았다.

## 현재 완료 범위

- 생성 원본6은 `masters/`, 이전 canonical PNG6와 manifest·correction registry는 `previous/`에 보존했다.
- Owner가 생성 원본6과 `output/playwright/v11-candidates.png`, `v11-exports.png`의96/46/32px 밝은·어두운 배경을 직접 검수했다.
- 나가는 뱀 하체, 크라켄은 연결된 촉수와 두족류 머리, 기도사는 후드·기도서·조개 지팡이, 리바이어던은 긴 수중 몸체·지느러미, 망자는 수의·얼굴·손·유령 하체, 파수꾼은 물의 몸체·삼지창·조개 갑옷을 갖는다. 기존 나무/화염 prototype의 명백한 이름 충돌을 후보에서 교정했다.
- 여섯 원본은1254×1254 RGBA이며 alpha0/255를 포함한다. 미세 alpha가 바깥쪽까지 남아 있어 원본은 그대로 보존하고 복사본에서 alpha128 threshold를 적용했다. 160px canvas/8px margin/151baseline/nearest 축소로 prepared export를 생성했다. 밝은 수의·물결·조개를 배경색으로 지우지 않는다.
- 32px에서는 기도서·눈·비늘·흡반을 각각 선명하게 읽을 수 없다. 전체 몸체 구분은 유지하지만 미세 디테일 완벽성을 주장하지 않는다. 크라켄의 겹친 촉수 개수도 작은 화면의 독립 식별 기준으로 삼지 않는다.

## TDD 및 검증

`tests/aquatic-monster-source.test.js`를 먼저 실행하여 missing preparer로2 RED를 확인했다 (`/tmp/aetheria-v11-source-red.log`). `prepare.py` 구현 후2/2 GREEN (`/tmp/aetheria-v11-source-green.log`). 원본 해시, 비율, binary alpha, export bytes 재현, 기존 출력·source drift 거부를 검사한다. `exports/receipt.json`은 source/export SHA와 preparation 시점 `runtimeAdopted:false`를 기록한다.

Focused command:

```sh
node --import tsx --test tests/aquatic-monster-source.test.js tests/machine-monster-source.test.js tests/volcanic-monster-source.test.js tests/monster-catalog-art.test.js
npx eslint tests/aquatic-monster-source.test.js
git diff --check
```

16/16 PASS, ESLint/diff PASS (19257 exit0, `/tmp/aetheria-v11-focused.log`). 기존 v9/v10 helper는 변경하지 않았다.

## 원본 provenance

Built-in original root: `/Users/sungjin/.codex/generated_images/019fd473-46d1-75e0-a08d-2e13e8e68ce5/`. 아래 원본과 workspace 복사본을 모두 보존한다.

| 이름 / slug | Generated output | SHA-256 |
| --- | --- | --- |
| 망각의 나가 / oblivion-naga | exec-edf3fb78-cb99-482e-a9c2-c12e08b02331.png | 68bfc4e4960c41e6c0e51b71c99be86aa1919cf985c0552814a56bdd3b9d9cac |
| 심연 크라켄 / abyss-kraken | exec-f454e291-6469-44db-8571-0f4d0300762d.png | dc1f21d16d183e2689388bf8a270fab8c63b54b0d90a77978be12f97d7a5d4eb |
| 심해 기도사 / deep-sea-prayer | exec-1d54d82f-8215-4fa5-8980-ac210b899924.png | f9d030ec4c2c951bdb862cbc12a2667dead3c70bc6213d5acc09b0c83e3c5fa7 |
| 어비스 리바이어던 / abyss-leviathan | exec-eefbe7bb-f329-441c-a443-62c651596a4a.png | f4aca3da90b7f3f03242aa91b238710373da84a6ce960f7eebf410730198a423 |
| 한 맺힌 망자 / resentful-dead | exec-fa7adc3f-7c9c-4c3b-8c1c-2b6c46279bb3.png | e7754f6d20e9fa9eab3396f30c437a6f95cabea58190f6f5aa54cf2d7ea3b988 |
| 해류 파수꾼 / current-sentinel | exec-eefe2a4c-94c0-499d-99f1-4b78339ddafc.png | f4e89aa0168ecbfeec9ff60edf87f30e53fc0e48b05924043eb125f8ff52497c |

## 다음 gate

1. Prepared6의 canonical 등록·resolver·PNG 일치 계약을 RED→GREEN으로 고정한다. 기존 classifier는 aquatic/spectral/caster를 이미 올바르게 분류하므로 근거 없는 분류 변경을 하지 않는다.
2. 이전248종 record/PNG 불변을 확인하고 기존 catalog generator로 exact6만 채택한다.
3. 실제390×844 전투에서 이미지와 공격 버튼 조상 opacity가 모두 안정된 후 캡처한다. QA 지역은 실제 map key를 사용한다. DOM 이미지 교체와 자연 성장 증거를 혼동하지 않는다.
4. 이전 진단 증빙을 보존한 뒤 관련 art/content/equipment/event/diagnostic source pin 갱신, report/v1 불변 확인, full gate, production/cap/native328-path 검증을 수행한다.

현재는 runtime·manifest·registry·게임 수치·save를 변경하지 않은 preparation checkpoint다. Authored66은 그대로이며 신규6종이 통합되었다고 주장하지 않는다. 이번 새2테스트는 이전 v10 full4387에 포함되지 않았다. 새 full/native/기기 설치/commit/publication은 수행하지 않았고 latest native는 v10이다. 전체 Goal은 미완료다.
