# 지역·속성 몬스터 6종 교정

상태: **2026-09-09 승인 exact6 local 구현·검증 완료**. 원본과 실패후보3을 v25에 보존하고6개만 채택했다. Focused26·Sol visual/implementation C0I0·full4475unit/118E2E·실제390·art/content/doctor·Cap/Android/unsigned iOS PASS,884선택경로 package byte일치. 상세 `scripts/art_sources/monsters/v25/candidate-review.md`. 나머지248·수치/save·보호 evidence 보존; 설치/commit/공개 없음. 아래 preimage와 단계는 실행 전 계약이며155authored/99retained를 전체 시각완료로 해석하지 않는다.

## 현재 확인과 교정 방향

Owner가 현재 runtime PNG6개를 각각 직접 열어 확인했다. 골렘2종은 청색 석상 원형, 기사2종은 갈색 후드 망령 원형, 비룡2종은 앉은 드래곤 원형이 반복된다. 서로 byte가 다르다는 이유로 정체성이 완성됐다고 판정하지 않는다. 아래 변경은 시각 언어이며 새로운 종족 설정이나 전투 속성 추가가 아니다.

| 대상 | 실제 지역 | 교정 형태 | 거부 기준 |
| --- | --- | --- | --- |
| 번개 골렘 | 공중 신전 | 검은 절연석, 분리된 양 어깨와 팔을 잇는 백황 번개 | 청색 수정/돌 원형에 입자만 추가 |
| 부식된 골렘 | 기계 폐도 | 비대칭 녹슨 금속판, 노출 기어, 내려앉은 어깨 | 얼음·순수 석상, 번개 골렘과 같은 몸체 |
| 얼음 기사 | 서리 폭풍 유적 | 서리 갑주, 큰 결빙 방패, 짧은 얼음 검, 단단히 딛는 방어 자세 | 기존 후드 망령의 색만 변경 |
| 호수 수호자 | 신성한 호수 | 물에 마모된 수호 갑주, 수초 방패, 물결 하체 | 해골·망령 얼굴, 얼음 기사의 갑주 재사용 |
| 화염 와이번 | 용의 둥지 | 두 뒷다리, 웅크린 이륙 자세, 적갈 비늘, 불씨 날개막 | 앉은 사족 드래곤 원형, 청록 장식 |
| 화염 비룡 | 용암 지대 | 가늘고 긴 몸통, 넓은 날개, 비스듬한 저공 활공, 주황 목주머니 | 와이번과 동일 자세/날개비율 |

32px에서 두 골렘의 재질과 어깨, 기사 둘의 하체와 방패, 비룡 둘의 날개·자세가 색 없이도 구분되어야 한다. 장식 때문에 실루엣이나 얼굴이 묻히면 채택하지 않는다. 작은 크기의 구분은 실제 축소 검수 전까지 미검증이다.

## 변경·보존 경계

- Exact6 runtime PNG와 연결 manifest/기존 corrections registry, 원본·export·검수 증거, 관련 tests·필요한 source evidence·ledger만 변경한다.
- 나머지248개 manifest entry/runtime bytes, monster names/keys, 지역, weakness/resistance/status/수치, 보스 phase, loot/EXP/event 확률과 save schema를 보존한다.
- 번개 골렘의 현재 resistance는 `빛`, 호수 수호자는 `냉기`, 부식된 골렘은 `화염`이다. 이미지에 맞추려고 이를 수정하지 않는다.
- `scripts/art_sources/monsters/v24`의 source-pinned export 패턴을 사용한다. 새 원화·교체 전6개·manifest·registry·diagnostic preimage를 별도 새 batch에 보존하며 기존 batch를 덮어쓰지 않는다.
- Built-in image generation만 사용한다. 별도 과금 API·dependency 설치·cleanup·commit/push·기기 설치·서명·공개는 제외한다. 원본 보존 Python/Pillow 처리의 기존 승인은 유지한다.

## 실행 순서와 완료 조건

1. 승인 후 수정 직전에 아래 preimage pins를 재확인한다. Drift이면 적용 전에 원인을 확인한다.
2. 여섯 개별 원화 생성·원본 보존. 골렘2→기사2→비룡2 순서로 원형 중복을 비교하고, 실패 후보도 채택본과 구분해 보존한다.
3. TDD RED→source-pinned deterministic 160×160 RGBA export GREEN. 외곽8px 여백, 진짜 투명 배경, 배경 격자·검은 테두리·절단 없음. Source drift/기존 output overwrite를 거부하고 두 fresh export의 bytes가 일치해야 한다.
4. 160/46/32px dark/light 직접 검수 및 Sol 독립 시각 감사. 정확히6개 채택·other248 보존 테스트. 과거 checkpoint tests는 정확한 보존 preimage로 검증하며 assertion을 없애지 않는다.
5. Canonical diagnostic 갱신이 필요하면 writer 종료→report/v1 불변→readonly verify→full gate 순서. 과거 candidate/Toss evidence는 보존한다.
6. `npm run verify:full`, `npm run art:verify`, `npm run content:verify`, `npm run mobile:doctor`; 실제390×844에서6종 전투 portrait·공격 버튼·overflow·console 확인. `npm run cap:sync`, Android debug/unsigned iOS와 image/production JS package 대조, `git diff --check`.
7. `tasks/todo.md`에 exact 결과·실패/교정 이력·원본 및 빌드 경로를 기록한다. 모든 gate 완료 전 authored155/retained99를 달성했다고 쓰지 않는다. 나머지99개 수용 감사와 실기기/lifecycle/S6, 전체 게임 완성은 별개다.

## 2026-09-09 preimage pins

HEAD38a3584, 기존 dirty paths282 보존. 경로는 `public/assets/monsters/catalog/<key>.png`다.

| 대상 / key | SHA256 |
| --- | --- |
| 번개 골렘 / monster-afc1ba2a24bc | 6929a6077fc8ce85c3eaef48f1359142281a8561a9652beea62b63a5b2cdefdf |
| 부식된 골렘 / monster-3c859cb03bef | 7714bc01d8522fb8c0d231d6ae76aa4bc6be803aa1c35b3b113c4be896eda0e7 |
| 얼음 기사 / monster-b7be84912986 | b2b3bdaa62e85bee0f350392a19d3fc21eebd4cd241be01379c95707ec36577d |
| 호수 수호자 / monster-8b0a61414b4b | 48d87f3a22c061a97ada8e64dd3a25ef4c1226667cbf4ccf82f0458776780830 |
| 화염 와이번 / monster-09881a8b21ed | f9fee7dedd8e0c08d3b9500242fab82432fa865d55721f42c757112ff6c77ec0 |
| 화염 비룡 / monster-2e2a633653f6 | 737739f08d33f0e9059026acb0f12928674cd3412a82fae44509b6487b3f516e |

Manifest `e0789dbcf9c662dd236508502cb5d6e097d9839f4029c5aadea7f428c0f55029`; monsters.ts `e278d7b0fb8a4a256a3e07f7fb7500114a5ae945bc08e4892b21e26459fe0d09`; maps.ts `bfa8b82d98a15eff56098a641d59f85a0f6a1bb613c6ac9602cae0689f004a72`; diagnostic `00204ad610b51419c4b2484cca172794f40603b58f9a25bd69bc63e701f16753`.

이번 설계 단계는 source/runtime/build를 변경하지 않는다. 최신 완료는 library local checkpoint, unsigned iOS `/tmp/aetheria-library-loot-ios.eHjSHk/Build/Products/Release-iphoneos/App.app`다.
