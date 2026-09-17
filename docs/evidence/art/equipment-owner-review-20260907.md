# 장비 owner 검수 — 대지의 심판 교정 필요

## 현재 증거

### 실제 캐릭터 표시 계약 재확인

후속 초상 공백 진단 완료: 동일 검증 bundle의 별도 browser profile에서 390×844로 실제 시작 버튼→상태→장비 진입 후 `img.decode()`를 기다렸다. canonical adventurer 이미지는 complete=true/naturalWidth768, img rect92.755×92.755, parent89.1875×89.1875, frame111.1875×111.1875였다. 로딩 후 초상이 정상 표시되어 레이아웃 결함은 재현되지 않았다. Owner가 `output/playwright/completion-20260907/portrait-settled.png`를 직접 확인했고 viewport/scrollWidth390/390이다. 기존 screenshot의 image-ready 대기 누락을 확인했으므로 production 레이아웃을 변경하지 않았다.

`tests/e2e/equipment.spec.ts`의 기존 캡처 앞에 이미지 decode·visible·naturalWidth·양수 표시 영역 검증을 추가했다. 재검사3/3 PASS(26.2s), `/tmp/aetheria-portrait-readiness-0907.log`, handle7909exit0. 초상 이미지 로딩 실패 또는 zero-area는 이제 해당 검사를 실패시킨다. 이 결과는 모험가 장비 요약 화면에 한정하며 모든 직업·장비·fallback의 시각 완료가 아니다. Browser와 owned preview79345를 종료했다.

`PixelCharacterAvatar.tsx`와 `avatarSpriteCandidates.ts`의 현재 production 경로는 직업별 canonical 그림 한 장을 표시한다. 장비 교체로 캐릭터 의상을 합성하는 기능이 아니다. 기존 `avatar-sprite-priority.test.js` 역시 직업 정체성을 유지하도록 이를 고정한다. `AvatarEquipmentOverlay`는 정상 장비 화면의 캐릭터가 아니라 `ItemIcon` 이미지 로드 실패 시의 `EquipmentAvatarPreview` fallback에 사용된다. 따라서 앞선 “실제 avatar 착용 합성 검수”는 정상 경로에 합성이 있다는 잘못된 가정이었다. 정상 직업 초상, 장비 슬롯, 실패 fallback의 시각 검수를 구분하며, 새 착용 외형 시스템을 임의 도입하지 않는다.

장비 패널의 접근성 이름이 고정 그림을 “장비 외형 미리보기”라고 설명하던 문제를 “직업 초상”으로 교정했다. 실제 SSR 접근성 출력 RED→GREEN 및 기존 sprite 계약 포함 focused18/18, tsc/lint PASS. 로그 `/tmp/aetheria-job-portrait-0907.log`, `/tmp/aetheria-job-portrait-lint-0907.log`. Sprite·장착 규칙·능력치는 변경하지 않았다. 이 수정 후 full/native 및 source evidence는 아직 갱신 전이다.

`npx playwright test tests/e2e/equipment.spec.ts`는 exit0,3/3 PASS(24.6s), 로그 `/tmp/aetheria-job-portrait-e2e-0907.log`. Owner가 생성된 `playtest-artifacts/mobile-equipment-disclosure/equipment-summary.png`를 직접 열었으나 장비 패널 초상이 비어 보였다(상단 HUD 초상은 보임). 이 테스트는 이미지 decode나 표시 크기를 기다리지 않으므로 로딩 순간과 실제 렌더 결함을 아직 분리하지 못했다. 다음 진단은 같은 화면의 img.complete/naturalWidth/bounding rect와 안정된 후 캡처다. E2E 성공을 초상 시각 PASS로 확대하지 않는다. 테스트 소유 preview 종료 확인, native tracked drift0.

### 방어구 82종 작은 크기 검수 — 2026-09-07 후속

저대비 후보5종의 실제 component 검수: `output/playwright/completion-20260907/armor-panel-review.html`은 production EquipmentPanel/ItemIcon/CSS/ITEMS/calculateFullStats/canEquip을 그대로 사용한다. 새 테스트용 전투·저장 로직은 없으며, level75와 각 장비의 첫 허용 직업으로 canEquip을 통과한 통제 fixture다. 실제 게임에서 획득/장착한 세션이 아니다. 첫 harness의 Vite prebundle 직접 import 오류는 bare React import로 교정했고 production 파일은 수정하지 않았다.

Owner가 `armor-panel-1.png`부터 `armor-panel-5.png`까지 각각390×844로 직접 확인했다. 어둠 감옥 갑주/어둠의 왕 갑주/용암 판금갑/상급 폭풍 로브/암흑 로브 모두 이름과 방어력, 해당 시 속성, 재료 부족 설명이 보이며 viewport와 scrollWidth가390으로 일치했다. 40px 슬롯의 그림은 어둡지만 이름과 함께 장비를 구분할 수 있었다. 원본32px 아이콘 단독의 미세 문양 식별을 승인하거나 자동 대비 보정을 수행하지 않았다.

같은 암흑 로브 fixture에서 `/assets/equipment-exact/**` 요청만 의도적으로 abort했다. EquipmentAvatarPreview fallback1개, legacy `/assets/avatars/warlock-robe.png`, width40 확인. Owner가 `armor-panel-fallback.png`를 직접 확인했으며 이름/방어력/장비 정보가 유지됐다. 이 모습은 정상 장비 그림이 아니라 실패 대체 표시다. 모든 avatar/overlay 동시 실패나 Toss 패키지에서의 fallback availability는 이 검사로 검증되지 않았다. Owned browser와 dev48347 종료. Runtime PNG/게임 코드/저장 변경 없음.

`output/playwright/completion-20260907/armor-small-review.html`은 기존 runtime PNG를 CSS 64px/32px로 어두운 배경(`#111827`)과 밝은 배경(`#fafafa`)에 표시한다. 원본 픽셀은 변경하지 않았다. `armor-small-1.png`부터 `armor-small-7.png`까지 총 7장(12종씩 6장, 마지막 10종)을 owner가 직접 확인했다. 앞선 출력에서 잘렸던 4–7장은 다시 개별 확인했으며 잘린 출력을 검수 증거로 사용하지 않았다.

명백한 cell 침범이나 잘림, 이름과 큰 형태의 모순은 발견하지 않았다. 판금/가죽/로브의 전체 길이와 소매·견갑 구분은 보이지만, 32px에서는 재질과 문양의 많은 부분이 사라진다. 특히 어둠 감옥 갑주, 어둠의 왕 갑주, 용암 판금갑, 상급 폭풍 로브, 암흑 로브는 어두운 배경에서 가장자리 또는 속성 표현이 약하다. 이들을 아이콘 단독으로 충분히 식별 가능하다고 승인하지 않는다. 실제 장비 UI의 이름·배경·선택 상태와 함께 확인한 뒤 대비 보정 필요 여부를 결정한다. 밝은 배경에서 보이는 형태를 실제 dark UI의 가독성 증거로 대신하지 않는다.

이 검수는 독립 아이콘의 두 크기/두 배경 비교다. 실제 avatar 착용 overlay 정렬, 모든 장비229종의 작은 크기 식별성, 게임 전체 디자인 완성의 증거가 아니다. Console 오류 1건은 `/favicon.ico` 404이며 검수 PNG 로딩 실패가 아니다. 다음은 위 저대비 항목의 실제 UI 확인과 착용 합성 검수다.

Production catalog는 weapon-core54, weapon-ranged-magic47, offhand-headgear21, armor82, signature-mythic25로 총229종이다. 기존 provenance의 exportSha256과 현재 runtime 파일을 직접 비교하여 일반204개와 signature item25+overlay25, 총254파일 일치를 확인했다. 이것은 byte provenance이지 시각 완성 증거가 아니다.

Owner는 각 cohort의 기존 contact sheet 다섯 장을 확인했다. 무기·보조구·signature의 큰 형체를 비교했고, armor82는 축소된 전체 sheet로 1차 확인만 했다. Armor 세부/작은 크기와 캐릭터 위 실제 overlay 정렬은 이 검수로 승인하지 않는다. 한손·양손 장착 적합성은 그림의 크기로 추론하지 않고 production hands와 validation을 따른다.

`node --import tsx --test tests/equipment-signature-art.test.js tests/signature-set-reachability.test.js tests/signature-set-two-hand.test.js`: **22/22 PASS**, 로그 `/tmp/aetheria-equipment-owner-review-0907.log`. 이 결과는 아래 의미 불일치를 검출하지 못한다.

## ART-GEAR-01 / Important

### 방어구 원본 8종 owner 세부 검수 (2026-09-07)

`armor-plate-06.png`의 판금갑옷/화염 방어복, `armor-robe-04.png`의 화염 사원 로브/화염술사 로브, `armor-leather-02.png`의 별빛 경갑/빙화 경갑/암살자 장갑/암살자의 야복을600×400 원본3장으로 직접 확인했다. 각 batch JSON의 row-major identity와 대조했다.

판금의 흉갑·견갑·금속 이음선, 화염 방어복의 붉은 금속/발광 균열, 두 로브의 소매/긴 옷자락, 빛/냉기 경갑의 색과 문양, 장갑 한 쌍, 야복의 가죽 끈이 이름과 부합한다. 이8종에서는 명백한 형태 모순이나 원본 cell 잘림을 발견하지 않았다. 원본·runtime 수정 없음. 작은 크기·착용 overlay 승인 및 나머지74종 원본 세부 검수는 아직 미완료다.

후속으로 나머지14개 원본 시트를 각각 열었다: boots-01, cloak-01/02, coat-01/02, leather-01, plate-01/02/03/04/05, robe-01/02/03 (`scripts/art_sources/equipment/v2/armor/armor-*.png`). 이제17시트82종 전체에 대해 batch JSON의 row-major 이름과 원본 큰 형태를 대조했다. 장화는 한 쌍, 잠수복은 밀폐 소매와 호흡 장치, 수련복/도복은 단순 천, 뼈 갑옷은 갈비뼈/해골, 세계수 갑주는 목질/가지, 사슬 갑옷은 고리, 용비늘 갑주 둘은 비늘판, 종교 예복은 긴 천과 금빛 장식으로 표현된다. 명백한 이름/몸체 모순이나 다른 cell 침범을 발견하지 않았다.

이는 원본 수준 의미/프레이밍 검수만 완료한 것이다. 망토/로브 일부는 비슷한 실루엣과 색으로 구분되어 작은 크기 식별성과 실제 avatar 위 합성 검수는 여전히 필요하다. 용암 판금갑의 절제된 붉은 이음선 등 속성 표현의 충분함도 작은 크기에서 판단한다. 이82종에 대해 새 그림이나 gameplay 변경은 하지 않았다. 위의 “나머지74종 원본 미완료” 상태는 이 후속 검수로 해소되지만 장비229종 전체 완료로 확대하지 않는다.

### 한손·양손 계약 전수 비교

현재 signature25종 중 무기16종은 production `getWeaponHands`와 artNote의1H/2H 선언을 전수 비교했다. 한손5/양손11, 불일치0. 나머지9종은 무기가 아니므로 이 집계에서 제외했다. `hands` 생략은 production helper가1로 해석하며 임의로 missing/error로 간주하지 않았다.

실제 `canEquip`으로 천공 성전·차원 방패 이지스·에테르 그리모어를 각각 허용 직업/레벨99에서 확인했다. 빈 weapon slot은3/3허용, 대지의 심판(2H)을 든 상태는3/3 `two_hand_shield` 거부. Fixture 함수 검사이므로 reducer transaction·UI·실제 플레이 전체 증거로 확대하지 않는다.

별도 재확인 대상: 그림자 절단기의 runtime shape는dagger인데 artNote는곡선falchion이다. 현재 이미지는짧은곡선날이며 production설명에 길이나 형태가 명시되지 않아 즉시 Important로 확정하지 않는다. 원형단검/외날단검 의미와 실제avatar표시를 확인한 뒤 판단한다. 대지의 심판의 명시적 대검/망치 모순과 구분한다.

`대지의 심판`의 아이콘과 착용 overlay가 망치다. Owner가 contact sheet뿐 아니라 두 runtime PNG도 각각 직접 확인했다.

- `src/data/items.ts`: `hands:2`, Tier5, ATK185, 대지 속성, 전사/나이트, 설명 `대지의 분노를 담은 대검.`
- `src/utils/itemVisuals.ts`: descriptionOnlySword 대상으로 명시되어 `greatsword`로 분류한다.
- catalog family는 `weapon-sword`다.
- item: `public/assets/equipment-exact/signature-weapon-earth-verdict.png`, SHA `c721c88c45fd864a398bb975d7b82097438d469ed2dbfc67988297bf6bf4d9ea`.
- overlay: `public/assets/equipment-wearable-exact/signature-weapon-earth-verdict.png`, SHA `4a6665f3e02c764aea8bbed70477205cfc06f08b221f1b5729a59ba105936bd7`.

원인은 현재 source/provenance에 승인된 망치 형체가 생산 데이터의 대검 계약과 불일치한다는 것이다. 이후 byte pin과 file-existence 검증이 이 그림을 정확히 재현하더라도 의미는 교정되지 않는다.

교정 계약: 대지/석재/황금 계열 정체성을 유지한 양손 대검의 item·overlay 두 원화를 built-in imagegen으로 제작한다. 긴 양손 손잡이와 명확한 검날을 갖추고 망치 머리는 제거한다. Gameplay 수치·직업·hands·drop·세트 계약을 그림에 맞추어 변경하지 않는다. 원본과 기존 provenance를 보존하고, 새 source와 두 runtime 이미지 및 연관 provenance/contact sheet를 일관되게 갱신한다. RED→GREEN hash/provenance contract, 작은 크기와 실제 avatar 검수, 관련 full/art/native gate 뒤에만 교정 완료로 판정한다.

후속 조사: `signatureRegistry.json`의 artNote 자체가 `2H warhammer · 네모 대형 헤드 + 대지 룬 + 중앙 코어`로 되어 있어 production 대검과 불일치한다. V2 batch/test가 이 지시를 그대로 보존하므로 PNG만 교체해서는 재발을 막을 수 없다.

후속 후보: built-in imagegen2회로 대검 item/overlay 원본을 `scripts/art_sources/equipment/v3/earth-verdict/masters/`에 보존했다. 원본 직접검수 및 실제alpha/투명/8pxmargin2/2 확인. 기존hammer2장은 previous/에 보존했고 runtime/artNote는 아직 변경하지 않았다. 나머지228종 전체가 완벽하다는 판정이 아니며 armor 세부와 실제 착용 조합 검수는 남아 있다.
