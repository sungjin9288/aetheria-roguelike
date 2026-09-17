# 도서관 전리품 정체성 — normal-loot 이후 후속 설계

상태: **승인된 구현 local checkpoint 완료**. 이전 Tier5 3종 안을 대체한 exact2/Tier4/8개 pool·설명·eager validation 적용. Focused97/독립 Sol C0I0(추가증빙 I1 해소), 전후49152회씩 비교/replay 및 excluded1344 보존 PASS. Canonical writer41449→readonly/report·v1불변, full92160 exit0(unit4469/E2E118/양쪽smoke/type/lint/build). 실제390 두 종 공격·획득, 2H장착/직업 제한/마을reload PASS. Cap90774/Android8449/iOS52034 exit0, 이미지841+JS43 총884선택경로 package일치/native tracked0/보호6+38보존. 상세 `docs/evidence/qa/library-loot-identity-20260909.md`. 설치/commit/publish와 전체Goal 완료는 포함하지 않는다. 이미지·전역 확률·EXP·저장 schema 불변.

## 현재 증거와 결정

Directed access에서 도서관은 Lv62부터 접근 가능하지만 일반 적의 production level은55다. 승인된 공통 loot 규칙은 player level이 아니라 enemy level에 따라 Tier4를 지급한다. 도서관에만 Tier5를 주거나 Lv75 player에게 Tier6를 주면 방금 고정한 위험도 기반 계약을 다시 깨뜨린다. 접근 레벨, 적 레벨, 착용 요구 레벨은 서로 다른 값이다.

현재 문구 `마법 계열 아이템 드랍률이 높습니다.`는 구현 근거가 없다. 도서관5종 모두 enriched/legacy table 없이 같은 Tier4 ordinary42개 pool을 사용한다. 살아있는 마법서·잉크 슬라임만 도서관 전용이고 나머지3종은 붕괴된 마법 요새와 공유한다. 공유종도 도서관에서55/Tier4, 요새에서62/Tier5이므로 species 이름만으로 보상을 덮어쓰면 안 된다.

**권장:** 도서관 전용2종의 성공한 일반 보너스만 아래 Tier4 마법 장비8종으로 특화한다. 같은 Tier 안에서 획득 목표를 만들고 확률·수량은 보존한다. 모든 직업 맞춤 드롭이나 현재 장비보다 강한 보상은 보장하지 않는다.

대안인 설명만 정정하는 방식은 허위 안내를 없애지만 지역별 획득 목표는 만들지 못한다. 이전 Tier5 특례는 새 공통 위험도 규칙과 충돌하므로 권장하지 않는다.

## Exact 계약

기존 normal bonus eligibility/성공 roll 이후, 현재 helper의 valid positive integer level·canonical map/species·non-boss/non-elite/non-infinite 검증을 통과하고 아래 조건을 모두 만족할 때만 적용한다.

- `player.loc === '금지된 도서관'`.
- `enemy.baseName || enemy.name`이 `살아있는 마법서` 또는 `잉크 슬라임`.
- 일반 bonus resolver가 계산한 tier가4. 향후 적 위험도가 바뀌면 동일 단계 특화 조건에서 벗어나 공통 pool을 사용한다. Player level로 단계·적용 여부를 올리지 않는다.
- 고정 순서: 아크스태프, 혼돈의 지팡이, 세이지 로드, 빙결 지팡이, 차원 균열 지팡이, 대마법사로브, 심연의 마도서, 상급 폭풍 로브.
- 8개 모두 existing canonical item/Tier4/non-signature. 순서가 RNG→item mapping의 일부다. 런타임 이름 검색 규칙이나 직업 맞춤 추천으로 pool을 재구성하지 않는다.
- 기존 item-selection random 한 번으로 균등 선택한다. 기본 보너스 확률6%에서는 각 base item0.75%이나 relic/profile 배율·elite/boss 분기·실제 encounter 비율을 포함한 자연 플레이 확률은 아니다. Prefix는 별도 기존 규칙이다.
- Shared3종, 다른 지역, boss/elite/infinite, malformed/unknown provenance, 다른 tier, enriched/legacy, signature/pity, milestone/endgame 보상은 그대로 둔다.
- 새 RNG draw, 재료, 통화, 장비, menu, save schema, EXP/event/HP 수치 변경 없음. Empty/duplicate/wrong-tier/signature/unknown item은 eager catalog/content 검증에서 거부한다.
- 제안 설명: `금지된 마법서들이 가득한 도서관입니다. 살아있는 마법서와 잉크 슬라임에게서 지팡이·로브·마도서를 노릴 수 있습니다.` 성공 보장이나 전체 마법 drop 확률 우위를 약속하지 않는다.

현재 ordinary42개 DB 가격의 단순 평균5611.90, 제안8개5662.50. 이는 미접두 base catalog 평균이며 실제 판매 수입·강화값·자연 경제 동일성 증거가 아니다. 승인 후 production 판매 transaction으로 전후 비교한다. 다른 직업의 해당2종 보상은 덜 유용해질 수 있으며, 나머지3종과 다른 지역은 공통 pool을 유지한다.

## 구현과 검증 순서

1. Current source/evidence preimages와 보호 candidate/Toss 기록 재확인. 지역 보상 data + 기존 normal bonus helper + map 설명 + tests/증빙/ledger만 수정한다. 새 framework나 별도 loot resolver는 만들지 않는다.
2. TDD RED: exact2종/current Tier4, same species outside library, shared3종, Lv62/74/75 player, enemy tier 경계, prefix baseName, missing/malformed provenance, boss/elite/infinite, catalog 오류.
3. GREEN: 정상 보너스 선택 지점에서만 data-owned8개 pool 참조. Non-target production output/RNG 소비 exact equality; target 성공 횟수와 최대수량 유지. Prefix 차이가 후속 RNG에 미치는 영향도 실측하고 전체 stream 동일을 추정하지 않는다.
4. Production spawn→victory receipt: 도서관5종+요새 shared3종 ×player62/74/75×64seeds(start20260824)×32attempts 전후 비교. Structured admitted/blocked/signature/pity, 실제 `canEquip` 직업별 판단, 실제 판매 transaction, full/one-slot/replay 검사. Forced settlement와 자연 플레이를 구분한다.
5. v1 bytes/hash 보존. 필요한 canonical evidence만 preimage보존→writer 종료→readonly verify. Full gate·독립 Sol 리뷰에서 Critical/Important0 전에는 완료하지 않는다.
6. 390×844 실제 공격·획득·장착 가능/직업 거절·귀환·복원과 full/unit/smoke/E2E, art/content/equipment/doctor, cap/debug Android/unsigned iOS/package 대조. 개인 save와 기존 archive 보존.

승인 경계: 이 구성 변경과 설명을 함께 승인받은 뒤 구현한다. Commit/push/install/sign/publish/유료 API 없음. Elemental6 이미지 교정은 별도 설계이며 이 승인에 포함하지 않는다. 이번 설계는 전체 게임 Goal 완료가 아니다.

## Read-only baseline (2026-09-09)

Runner `output/library-reward-audit.mjs`, report `output/library-reward-audit-20260909.json`. Production `spawnEnemy → RESOLVE_COMBAT_ACTION → lootSettlement`을 사용한다. 24cohorts×2048=49,152회. 두 실행 byte-identical/session66387 exit0. Source player는 아크메이지이며 18jobs는 각 획득 item의 `canEquip` cross-job projection이다. 18직업별 전투를 실행했다고 주장하지 않는다. HP1·고공격·empty inventory·spawn RNG0.5의 일반종 정산 fixture이며 자연 pacing/생존성/장기 리텐션 증거가 아니다.

| Player level | 도서관5종 획득/정산 | Tier | 요새 shared3종 획득/정산 | Tier |
| --- | ---: | --- | ---: | --- |
| 62 | 645/10240 | 4 | 371/6144 | 5 |
| 74 | 597/10240 | 4 | 396/6144 | 5 |
| 75 | 621/10240 | 4 | 352/6144 | 5 |

전체 blocked/signature/pity change0. 현재 도서관 획득 중 제안8개에 해당하는 수는123/130/112이며, 요새의 같은 이름 counter0은 **Tier4 exact-name 목록**을 센 결과일 뿐 요새에 마법 장비가 없다는 뜻이 아니다.

SHA256:

- Runner `eae2da34906a51fbf5c7bfa6161892164efb0111a94f3c2ee6318a01aa7f0b4c`.
- Report `95118aaf8b445c4b6f08a95f18ac24dc0e8b33146f7d6aa7b0ece57e64895c54`.
- maps `012c1c35e006216b978f154e9966fa0729c5b7958f51497d1e96a07a943e2085`.
- loot `5a798683b504a14674f91ab1395df923ecf4cfa35d6aeedc89ebc1a228f543e8`.
- monster manifest `e0789dbcf9c662dd236508502cb5d6e097d9839f4029c5aadea7f428c0f55029`.
- canonical diagnostic `6e9422e0d5c9726d18b5e3189f5821b97a592e9e2d5a24a06c315dc8368c4ae1`.

최신 완료 native는 normal-loot unsigned iOS `/tmp/aetheria-normal-loot-ios.FviZzN/Build/Products/Release-iphoneos/App.app`와 debug APK다. 이번에는 runtime/설치본/build/canonical evidence를 갱신하지 않았다. Focused map-access/normal-loot13/13 및 `git diff --check` PASS; full/native는 runtime 변경이 없어 반복하지 않았다.
