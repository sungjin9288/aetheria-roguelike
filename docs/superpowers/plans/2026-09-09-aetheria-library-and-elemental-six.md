# 다음 품질 보완 — 도서관 보상과 지역·속성 6종

상태: **도서관 Tier5 3종 안은 superseded proposal**. `2026-09-09-aetheria-library-loot-identity.md`의 동일 Tier4 마법 장비8종 특화는 승인 후 local checkpoint를 완료했다. 다음 이미지6종의 현재 설계는 `2026-09-09-aetheria-elemental-six-identity.md`다. 아래 내용과 native/pins는 교정 전 역사이며 현재 runtime/최신 상태로 읽지 않는다.

## 1. 도서관 보상: 확률 대신 보상 구성만 수정

### 확인한 사실

- Production directed access에서 금지된 도서관은 Lv60 도달 불가, Lv62 가능. 따라서 과거 Lv60 진단의 장비0건은 자연 플레이 결함의 직접 증명이 아니다.
- 현재 설명은 여전히 `마법 계열 아이템 드랍률이 높습니다.`지만 도서관 전용5종에는 explicit loot table이 없다. 일반 보너스는 기본6%이며 inferred level>=50이면 Tier6(착용 Lv75)를 고른다.
- 살아있는 마법서·잉크 슬라임만 도서관 전용이다. 나머지3종은 현재 `DB.MAPS`에서 **붕괴된 마법 요새**와 공유된다. 이전 QA 문서의 에테르 관문 공유 표기는 부정확했다.
- Enriched DROP_TABLES 추가는 기존 일반 보너스를 대체한다. Legacy 재료 추가는 기본40%와 추가 RNG 소비를 가져온다. 둘 다 단순한 무영향 보완이 아니다.
- 천벌의 지팡이·세계수의 지팡이는 signature다. 일반6% pool에 포함하지 않는다.

### 권장 계약

대상: `player.loc === '금지된 도서관'`, canonical baseName이 살아있는 마법서 또는 잉크 슬라임, non-boss, Tier5 착용 레벨 이상·Tier6 착용 레벨 미만. 경계값은 기존 BALANCE.TIER_REQ_LEVEL을 사용한다. 자연 진입 가능성은 production 이동 규칙이 계속 맡는다.

이 대상의 **기존 보너스 roll이 성공했을 때만** 현재 Tier6 pool 대신 다음 고정 순서의 Tier5 pool을 사용한다:

1. 성운 지팡이 — 아크메이지·흑마법사
2. 빙하의 지팡이 — 마법사·아크메이지·대마법사·시간술사
3. 현자의 예복 — 아크메이지

모두 기존 item DB와 canEquip으로 Lv62 장착 가능·non-signature를 확인했다. 무강화/무배율 기준6% 성공 뒤 균등선택이므로 개별 기본확률은2%다. 새 roll·추가 아이템·재료·pity·수량·prefix 확률을 만들지 않는다. 기존 relic/profile 배율·capacity settlement는 유지한다. 대상 밖 모든 경로와 Lv75+의 Tier6 pool은 그대로 둔다.

목표는 전용 마법 적에게서 현재 활용할 장비를 얻는 선택지다. 모든 직업 맞춤 드롭이나 상위 성능 보장은 하지 않는다. Tier6 미래 보상을 이 구간에서 포기하는 trade-off를 명시하며, 전체 경제가 동일하다고 주장하지 않는다. 판매가·접두사·기존 보스 희소성 영향을 비교한 뒤 적용한다.

제안 문구: `금지된 마법서들이 가득한 도서관입니다. 레벨 75 전에는 살아있는 마법서와 잉크 슬라임에게서 지팡이와 예복을 노릴 수 있습니다.` 확률 우위 주장을 없애되 실제 보상 연결과 레벨 경계를 함께 밝힌다. 문구만 바꾸고 콘텐츠 문제를 완료 처리하지 않는다.

### 구현·검증 계약

- 작은 data-owned bonus pool 계약을 기존 loot 보너스 branch에서 읽는다. Enriched early-return/legacy 추가/drop rate 상수 수정 금지.
- TDD: 대상2종×60/62/74/75, 다른 지역, 공유3종, boss, 접두어 baseName, 잘못된/누락 location, 실제 canEquip, signature 제외, full/one-slot/replay.
- Non-target은 동일 seed에서 receipt·items·RNG 호출 수·pity/state exact equality. Target은 성공 횟수/최대 수량과 rate unchanged; item/prefix 경로 차이를 실제 결과로 비교하고 RNG 동등성을 추측하지 않는다.
- 64 seeds(20260824부터)×32 attempts, Lv62/74/75의 대상2종과 공유3종을 비교한다. 실제 production reducer receipt로 admitted/blocked를 측정한다. 먼저 controlled forced-roll 회귀를 통과하고 이후 seeded evidence를 만든다.
- 판매가/usable job coverage/signature0/blocked0혹은fixture기대값/기존fallback존재를 보고한다. Canonical v2는 highest-map proxy이므로 이 지역 검증을 대체하지 않는다. v1 bytes 의도치 않은 변화 또는 shared-region 변화 시 중단/re-plan.
- Focused→전체 verify:full→diagnostic frozen write/readonly 순서는 writer와 reader가 겹치지 않도록 조정한다. Evidence를 갱신할 필요가 있으면 **writer 종료 후 full**로 실행한다. 기존 candidate/Toss aggregate 보존.
- 내부390 전투승리·장비확인·귀환·복원 후 full/art/content/doctor/cap 및 debug/unsigned packaging. 자연 장기 밸런스 완료로 확대하지 않는다.

## 2. Retained105 이미지 감사와 다음6종

105개 모두 이전114 records와 현재 manifest/runtime SHA가 일치했다. Owner가 네 시트를 original detail로 다시 보았다. 이미 교정된9개 셀은 현재 증빙에서 제외했다. Static96/32 dark/light 관찰이며 실제 combat/device 검증은 아니다. 아래6은 다음 우선 교정 제안이며 나머지99가 자동 승인된 것은 아니다.

| 대상 / key | 현재 문제 | 제안 몸체·자세·정체성 |
| --- | --- | --- |
| 번개 골렘 / monster-afc1ba2a24bc | 차가운 청색 석상과 입자, 번개 구조 부재 | 검은 절연석 몸체, 갈라진 양 어깨와 번개가 잇는 팔, 백황 균열. 얼음 수정 금지 |
| 부식된 골렘 / monster-3c859cb03bef | 같은 청색 돌 골렘, 기계폐도의 부식·기계 구조 부재 | 녹슨 비대칭 금속판·노출 기어·주저앉은 한쪽 어깨. 순수 돌/얼음 몸체 금지 |
| 얼음 기사 / monster-b7be84912986 | 갈색 후드 망령기사, 냉기 정체성 약함 | 서리 갑주·결빙한 방패·짧은 얼음 검, 다리를 딛고 방어. 후드색 변경만으로 처리 금지 |
| 호수 수호자 / monster-8b0a61414b4b | 같은 갈색 망령기사, 신성한 호수 문맥 부재 | 물에 마모된 수호 갑주·수초 테두리 방패·물결 하체. 해골 얼굴·망령 기사 재사용 금지 |
| 화염 와이번 / monster-09881a8b21ed | 앉은 일반 드래곤, 청록 장식과 종 구분 부족 | 두 뒷다리·큰 날개, 이륙 직전 웅크림, 적갈 비늘·불씨 날개막. 기존 dragon body+색조만 변경 금지 |
| 화염 비룡 / monster-2e2a633653f6 | 같은 앉은 드래곤, 용암 지대의 burn 역할 약함 | 길고 날렵한 몸통·넓게 편 날개·비스듬한 저공 활공, 검붉은 비늘과 주황 목주머니. 와이번과 자세/날개비율 분리 |

이는 시각 제안이며 새 lore/종족/전투 속성으로 간주하지 않는다. Production weakness/resistance/status/name/map/몬스터 수치 불변. 번개 골렘의 resistance는 현재 '빛'이며 그림 때문에 바꾸지 않는다.

승인 후 원화 보존→160RGBA/8px 여백 deterministic export→160/46/32 dark/light→독립 시각 리뷰→exact6 adoption/other248 보존→실제390×844→전체/art/content/native gate. 예상155 authored/99 retained는 성공 전 완료 수치가 아니다. 나머지99는 지역별 반복 가족의 수용/교정 판단을 이어가며 공유 몸체만으로 모두 결함으로 판정하지 않는다.

## 보존과 승인 경계

현재HEAD38a3584/기존 dirty tree 보존. Commit/push/sign/install/publish 및 유료 API fallback은 포함하지 않는다. 최신 완료 패키지는 regional24 그대로다. 전체 게임/기기/S6 완료가 아니다.

Source pins at design: maps `012c1c35e006216b978f154e9966fa0729c5b7958f51497d1e96a07a943e2085`; loot engine `10fe7c4e995a4aa7ed2b2f97f1ecbbad2d5070b41ecb6e33edbad3dcaebcaee7`; monster manifest `e0789dbcf9c662dd236508502cb5d6e097d9839f4029c5aadea7f428c0f55029`; diagnostic `e40c2f170e7ae000a790c1da6808217c283ae9de1e59cdef4d8a10b78197def3`.
