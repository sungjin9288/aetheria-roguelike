# Aetheria 경쟁작 흐름·디자인 개선 계획 V2

Date: 2026-07-22
Scope: Slice 52 이후, 실기기 최종 QA 전에 남은 모바일 정보 위계와 게임 흐름 개선

## 결론

현재 Aetheria는 퀘스트, 지역 해금, 스카우트 선택, 전투 forecast, 장비 비교, 세트 효과, 초반 성장 조절 등 핵심 시스템이 이미 갖춰져 있다. 다음 단계에서 새 시스템을 더 추가하는 것은 우선순위가 아니다.

남은 핵심 문제는 다음 네 가지다.

1. `MAP`이 공간 구조보다 요약 카드 목록처럼 보여 현재 위치와 분기를 한눈에 읽기 어렵다.
2. 전투 중 적, 의도, 대응 행동보다 상태창과 Field Log가 먼저 화면을 점유한다.
3. Quest Board와 마을 화면은 설명과 프레임이 많아 실제 선택지가 첫 viewport 아래로 밀린다.
4. 초반 장비 비교는 정보가 정확해도 세트, 직업 적합도, affinity, 부가 효과가 동시에 보여 학습 비용이 높다.

따라서 수정 순서는 `Map topology -> Combat focus -> Quest/Expedition prep -> Equipment disclosure -> Encounter art`로 고정한다.

## 실행 상태

| Slice | 상태 | 최신 증빙 |
|---|---|---|
| 53 Map Navigator V2 | 완료 | `playtest-artifacts/mobile/08a-map-tab.png`, focused `34/34`, `verify:full`, E2E `26/26` |
| 54 Combat Focus Mode | 완료 | `playtest-artifacts/mobile-combat-focus/05-combat-3.png`, `boss-focus.png`, focused `6/6`, `verify:full`, E2E `29/29` |
| 55 Quest Board / Expedition Prep | 완료 | `playtest-artifacts/mobile-quest-expedition/quest-board-compact.png`, `expedition-prep.png`, focused `52/52`, E2E `31/31` |
| 56 Equipment Disclosure | 완료 | summary/full 공용 판단 모델, focused `22/22`, `verify:full`, E2E `32/32` |
| 57 Encounter / Region Art | 구현 완료 · 실기기 확인 대기 | 23 enemy + 4 region assets, contact sheet, focused `636/636`, `verify:full`, E2E `32/32` |

## 조사한 레퍼런스

| 게임 | 확인한 구조 | Aetheria에 적용할 원칙 |
|---|---|---|
| [Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon) | Android, iOS, Desktop을 함께 지원하는 오픈소스 모바일 roguelike이며 무작위 맵, 적, 다수 아이템이 같은 플레이 화면 안에서 작동한다. | 세계/위치가 화면의 주인공이어야 하고 HUD와 quick action은 이를 둘러싸는 보조 레이어여야 한다. 코드나 asset을 복제하지 않고 공개 구조와 화면 밀도만 참고한다. |
| [Buriedbornes2 이동 도움말](https://sites.google.com/view/bb2-help-en/adventure/move) | 현재 방에서 다음 방을 선택하고, 이동 직전 아이템 사용 여부를 판단하는 짧은 선택 단위를 반복한다. | 이동 화면은 설명보다 `현재 위치 -> 다음 2~3개 선택 -> 위험/보상`을 먼저 보여준다. |
| [Buriedbornes2 v1.5.0 변경 내역](https://steamcommunity.com/app/1581950/allnews/) | 신규 사용자가 복잡한 능력의 장비를 너무 일찍 만나지 않도록 조정하고 기본 난이도를 easy로 변경했다. | 초반에는 장비 기능을 삭제하지 않고 기본 노출량을 줄인다. 상세 정보는 확장 가능하게 유지한다. |
| [Slice & Dice](https://store.steampowered.com/app/1775490/Slice__Dice/) | 단순한 turn-based combat을 매 턴 하나의 mini-puzzle로 만들고, 전투 뒤 level/item 선택을 명확히 분리한다. | 전투 첫 화면에서 적 의도, 현재 위험, 가능한 대응, 행동 버튼이 한 번에 보여야 한다. |
| [Darkest Dungeon](https://www.darkestdungeon.com/darkest-dungeon/) | 영웅 모집·훈련·관리와 원정 전투가 분리된 반복 흐름을 가진다. | 마을은 기능 버튼 모음이 아니라 다음 원정을 준비하고 출발시키는 상태로 읽혀야 한다. |
| [Loop Hero](https://store.steampowered.com/app/1282730/Loop_Hero/) | 원정 경로의 위험을 계획하고 전리품을 회수해 캠프를 강화한 뒤 다음 원정을 준비한다. | 퀘스트 선택, 경로, 준비 상태, 귀환 기준을 하나의 원정 계약으로 연결한다. |

## 현재 화면 진단

확인한 증적:

- `playtest-artifacts/mobile/01-after-start.png`
- `playtest-artifacts/mobile/02c-quest-board-open.png`
- `playtest-artifacts/mobile/05-combat-2.png`
- `playtest-artifacts/mobile/08a-map-tab.png`

### 유지할 것

- `Field Log / Status / Field Actions / Archive`의 기존 mental model
- fantasy pixel character와 장비 art 방향
- 현재 quest 추천, route forecast, boss gauge, scout 3-choice, combat forecast 데이터
- high-contrast/readability mode와 44px touch target
- 초반 누적 성장 속도와 현재 밸런스 계약

### 바꿀 것

- 같은 border, blur, rounded panel을 연속해서 쌓는 화면 구조
- 설명을 먼저 읽어야 행동 버튼을 찾을 수 있는 순서
- 지도 탭의 카드 목록 중심 표현
- 전투 중 긴 로그가 적과 행동보다 먼저 보이는 위계
- 초반 장비 화면의 동시 정보 노출량

## 실행 계획

### Slice 53 - Map Navigator V2

상태: **구현·native 설치 완료, 물리 iPhone launch/체감 확인 대기 (2026-07-22)**

목표: `MAP`을 열면 현재 위치와 갈 수 있는 방향이 즉시 보이는 공간형 node map으로 전환한다.

주요 변경:

- `MAPS`의 연결 정보를 기반으로 현재 지역 중심의 2~3단 topology를 그린다.
- 현재 위치, 추천 경로, 활성 퀘스트 목적지, boss, 잠금 지역을 서로 다른 node state로 표시한다.
- node를 선택하면 화면 하단 detail sheet에서 위험, 보상, 예상 전투, 귀환 조건과 이동 CTA를 보여준다.
- 기존 route list는 접근성 및 텍스트 fallback으로 topology 아래에 유지한다.
- 마을 `MAP` quick surface도 동일 topology의 축약판을 사용해 두 개의 지도 표현이 갈라지지 않게 한다.

대상:

- `src/components/MapNavigator.tsx`
- `src/components/ControlPanel.tsx`
- `src/data/maps.ts`
- `src/utils/adventureGuide.ts`
- `src/index.css`
- `tests/e2e/navigation.spec.ts`
- `scripts/smoke-gameplay.mjs`

완료 기준:

- 390x844 첫 viewport에서 현재 node, 최소 2개 출구, 추천 경로, 활성 퀘스트 또는 boss marker를 scroll 없이 확인한다.
- 현재 위치에서 갈 수 없는 node는 이동 CTA가 활성화되지 않는다.
- blind-map 상태는 숨김 node로 표현하며 기존 정보 제한 규칙을 깨지 않는다.
- route list fallback만 사용해도 같은 이동을 완료할 수 있다.

### Slice 54 - Combat Focus Mode

상태: 완료 (2026-07-22)

목표: 전투가 시작되면 적과 이번 턴의 결정이 첫 viewport를 지배하게 한다.

주요 변경:

- 전투 중 Status를 HP, NRG, level 핵심값 한 줄로 압축한다.
- 적 이름, 적 family art, HP, intent, signature/counter를 하나의 encounter stage로 합친다.
- combat forecast를 `위협 -> 권장 대응 -> 결과 예상` 순서로 단순화한다.
- 공격, 스킬, 아이템, 도주 행동을 첫 viewport에 고정하고 긴 Field Log는 최근 2~3줄과 확장 history로 낮춘다.
- 전투 종료 후에는 기존 Field Log 중심 구조로 복귀한다.

대상:

- `src/components/tabs/CombatPanel.tsx`
- `src/components/StatusBar.tsx`
- `src/components/TerminalView.tsx`
- `src/components/ControlPanel.tsx`
- `src/data/monsters.ts`
- `src/index.css`

완료 기준:

- 390x844에서 적 art, intent, forecast, 주요 행동 버튼이 scroll 없이 동시에 보인다.
- boss signature와 counter hint는 세부 로그를 열지 않아도 읽힌다.
- 전투 중 로그를 확장해도 행동 상태와 scroll 위치가 유실되지 않는다.
- reduced motion, high contrast, 44px touch target 계약을 유지한다.

### Slice 55 - Compact Quest Board and Expedition Prep

상태: 완료 (2026-07-22)

목표: 마을에서 `퀘스트 선택 -> 준비 확인 -> 출발`을 두 단계 이내로 연결한다.

주요 변경:

- Quest Board 기본 화면은 compact mission row 3개를 우선 노출한다.
- 각 row에는 제목, 목적지, 예상 전투/노력, 위험, 핵심 보상, 상태 CTA만 둔다.
- lore, resonance, 세부 plan은 선택한 mission의 detail sheet에서 펼친다.
- 마을 Field Actions 상단에 `원정 준비` strip을 추가해 활성 퀘스트, 목적지, HP/NRG, 장비 경고, 귀환 기준을 한 번에 점검한다.
- 준비가 끝나면 하나의 `출발` CTA가 추천 경로로 연결된다. 상점, 휴식, 전직 등 기존 시설은 secondary action으로 유지한다.

대상:

- `src/components/tabs/QuestBoardPanel.tsx`
- `src/components/ControlPanel.tsx`
- `src/utils/questOperations.ts`
- `src/utils/adventureGuide.ts`
- `src/index.css`
- `tests/e2e/quest-reward.spec.ts`

완료 기준:

- 390x844 Quest Board 첫 화면에서 최소 3개 mission의 핵심 판단 정보가 보인다.
- 추천 mission 수락 후 최대 2번의 tap으로 원정을 시작할 수 있다.
- 진행 중, 보상 수령 가능, 잠금, 포기 확인 상태가 색만으로 구분되지 않는다.
- 기존 스토리 선행 조건, 지역 제한, 보상 계약을 변경하지 않는다.

### Slice 56 - Progressive Equipment Disclosure

상태: **완료 (2026-07-22)**

목표: 장비 시스템의 깊이는 유지하면서 초반 학습 비용을 낮춘다.

주요 변경:

- Lv1~4 기본 화면은 추천 여부, 주 능력치 delta, 장착 가능 여부, 세트 기여도만 먼저 보여준다.
- affinity, 부가 효과, codex 설명, 전체 계산식은 `상세` 확장 영역에 유지한다.
- Lv5 또는 첫 전직 이후에는 상세 비교를 기본 확장하며 설정에서 항상 `자동 / 간단히 / 상세`를 선택할 수 있게 한다.
- loot table을 임의로 약화하거나 기존 아이템을 삭제하지 않는다.
- 이미 완료한 335종 item art와 233종 장비 family 작업은 재구축하지 않고, encounter/map art와의 palette 정렬만 확인한다.

대상:

- `src/components/EquipmentPanel.tsx`
- `src/components/SmartInventory.tsx`
- `src/components/ShopPanel.tsx`
- `src/utils/equipmentUtils.ts`
- `src/utils/jobOutfitAffinity.ts`
- 관련 unit/E2E 계약

완료 기준:

- 신규 플레이어는 상세를 열지 않고도 `현재보다 좋은가`, `장착 가능한가`, `세트가 활성화되는가`를 판단한다.
- 양손무기 2피스와 한손무기+보조장비 규칙은 compact/full 양쪽에서 동일하다.
- 상세 접힘은 정보 접근을 차단하지 않고 한 번의 tap으로 복구된다.

### Slice 57 - Encounter and Region Art Pass

상태: **완료 (2026-07-22)**

목표: 캐릭터/장비에 맞춰 적과 지역도 같은 visual language를 갖게 한다.

주요 변경:

- 기존 9종 generic SVG silhouette coverage를 감사하고 숲 7종, 평원 5종, 폐허 5종, 화염 일반 4종과 boss 2종을 exact art로 교체했다.
- 정예·boss phase 이름은 원형 monster asset을 재사용하고, 미발견 도감과 아직 제작하지 않은 후반 적은 기존 silhouette fallback을 유지한다.
- map node의 4개 지역 marker와 combat enemy portrait를 공용 `monsterVisuals` family key로 연결했다.
- source sheet, crop 좌표, checkerboard 제거, 160px monster와 96px marker 정규화를 재현 가능한 script와 함께 보존했다.

완료 기준:

- 첫 5분 동선에서 generic enemy icon이 노출되지 않는다.
- 적, 캐릭터, 장비가 outline 두께, 명암 단계, 채도 범위에서 한 세트로 읽힌다.
- contact sheet와 390x844 iPhone viewport 캡처의 식별성 검토는 완료했으며, 최신 설치본의 물리 iPhone 캡처와 체감 확인을 이어서 수행한다.

## 검증 기준

각 Slice 공통 자동 검증:

- focused unit tests
- `npm run verify`
- `npm run verify:full`
- 390x844 Playwright screenshot과 geometry assertion
- `npm run mobile:doctor`
- `npm run cap:sync`
- `npm run ios:archive`
- `npm run ios:device:smoke` 또는 설치본 재사용 시 `npm run ios:device:launch-smoke`

최종 물리 iPhone 수동 검증:

1. 새 세이브에서 첫 이야기, 슬라임, 멧돼지, 거미 임무를 순서대로 진행한다.
2. 첫 5분 동안 지도 확인, 퀘스트 선택, 원정 출발, 전투 행동, 장비 교체를 각각 수행한다.
3. Map은 current + 2 exits + objective가 첫 화면에 보여야 한다.
4. Combat은 enemy + intent + action이 첫 화면에 보여야 한다.
5. Quest Board는 mission 3개가 첫 화면에서 비교 가능해야 한다.
6. 초반 누적 레벨은 Slice 52 계약인 `Lv1 -> Lv1 -> Lv2 -> early Lv3` 범위를 유지해야 한다.

## 범위 밖

- 새로운 통화, meta tree, quest type, combat mechanic 추가
- 경쟁작 코드, 이미지, 문구의 복제
- 전체 item art 재생성
- 현재 story progression이나 성장 곡선의 재설계
- TestFlight 업로드 및 Android release signing

## 권장 실행 순서

`Slice 53 - Map Navigator V2`부터 `Slice 57 - Encounter and Region Art Pass`까지 competitor-informed UI/art 구현은 모두 완료했다. grouped Android debug와 iOS archive도 갱신했으며, 최신 archive 설치 후 기기 자동 잠금으로 남은 installed-app launch/60초 hold와 새 세이브 물리 iPhone 동선 QA를 이어서 수행한다.
