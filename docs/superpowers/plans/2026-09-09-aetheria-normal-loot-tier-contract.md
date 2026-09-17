# 일반 몬스터 보너스 장비 단계 — 설계 제안

상태: **사용자 승인 범위 local checkpoint 완료**. Focused90/독립 Sol C0I0, full(unit4462/E2E118/양쪽smoke), 직접390승리·장착/거절·마을 이동·복원, debug Android/unsigned iOS와 package byte 대조 PASS. 전후358,400회씩 production 정산과 현재 report byte replay, canonical evidence writer→readonly PASS. 결과와 한계는 `docs/evidence/qa/normal-loot-tier-20260909.md`를 따른다. 도서관-only override보다 먼저 진행하며 전역 EXP/drop/event 수치를 동시에 바꾸지 않는다. 근거는 `docs/evidence/qa/loot-level-authority-audit-20260909.md`다. 이미지6은 별도 승인 범위로 유지한다. 전체 게임 Goal 완료·배포 승인을 의미하지 않는다.

## 문제와 추가 감사

Production spawn의 level과 EXP-derived bonus tier가 일치하지 않는다. 일부 `tests/combat-engine-loot.test.js` 검사는 production import가 이미 가능한데도 인라인 `inferLevelAndBonusTier` 복사본에만 assertion을 건다. 이 테스트는 generation→loot→canEquip 계약을 증명하지 않는다.

현재 equipment pool을 직접 집계했다: Tier1 36개, Tier2 43개, Tier3 43개, Tier4 42개, Tier5 45개 중 signature23개, Tier6 20개 중 signature2개. 따라서 단순히 Tier6를 Tier5로 바꾸면 지역별 signature 획득 분포까지 바뀐다. 희귀도 위험을 별도 계약 없이 숨기지 않는다.

## 권장 계약

**보너스가 나오는 횟수는 유지하고, 일반 몬스터 보너스의 장비 단계·pool만 수정한다.**

1. 대상은 non-boss/non-elite이며 valid positive integer `enemy.level`이 있는 일반 전투다. 무한/심연 경로는 제외한다. Unknown map 또는 level 누락·잘못된 구세이브는 기존 동작을 보존하며 의미를 추측하지 않는다. 구체적인 map 범위와 saved enemy provenance는 구현 intake에서 현재 source로 재확인하고 모호하면 중단한다.
2. 기존 enriched table early-return, legacy species item roll, bonus eligibility와6%/배율은 그대로 둔다. EXP-derived eligibility는 이번에 단계 산출과 **명시적으로 분리**한다. 즉 `/5`를 `/10`으로 바꿔 보너스 횟수까지 줄이지 않는다. Eligibility의 역사적 threshold는 별도 검토 과제이지 이번에 완전히 고쳤다고 주장하지 않는다.
3. 보너스 성공 후 `enemy.level` 이하의 착용 요구 레벨을 가진 최고 Tier를 기존 BALANCE.TIER_REQ_LEVEL에서 결정한다. Player level로 보상을 올려 낮은 지역 반복 사냥을 보상하지 않는다. 직업별 맞춤/현재 장비보다 강한 아이템 보장도 없다.

| 적 레벨 | 보너스 성공 시 단계 |
| --- | --- |
| 1–9 | Tier1 |
| 10–27 | Tier2 |
| 28–44 | Tier3 |
| 45–59 | Tier4 |
| 60–74 | Tier5 |
| 75+ | Tier6 |

표는 tier 선택만 정의한다. 기존 eligibility에서 탈락하면 새 보너스가 생기지 않는다. Lv18 전초기지의 기존 성공은 Tier4→Tier2, Lv36 용암 지역은 Tier6→Tier3, Lv55 도서관은 Tier6→Tier4, Lv62 요새는 Tier6→Tier5가 된다. 이는 미래 장비/판매가를 줄이는 명확한 balance 변화다. 도서관 입장이62라고 적 위험55를62로 올리지 않는다. 도서관의 별도 지역 보상 적합성은 여전히 검토가 필요하다.

4. 대상 일반 bonus pool에서 signature registry 항목은 제외한다. 기존 signature 직접 drop table·pity·boss/elite/prestige pool은 변경하지 않는다. Tier5 ordinary22, Tier6 ordinary18을 사용하므로 signature의 일반 fallback 획득 경로는 줄어든다. 이것은 의도된 희귀 획득 경로 정리이며 무영향이라 주장하지 않는다. Source boss/quest/상점 등의 실제 도달성과 set 완성 가능성을 다시 검증한다.
5. Prefix 확률/보너스 수량/legacy 보상/용량 admission/receipt/replay는 유지한다. 새 roll·새 통화·새 아이템·save schema 없음. Empty/invalid pool은 조용한 누락으로 숨기지 않고 content validation에서 거부한다.
6. Elite, boss, prestige-guaranteed, abyss, enriched 경로는 별도 exact baseline 비교로 보존한다. 이 경로의 보상 단계가 타당하다는 승인까지 의미하지 않는다.

## 구현 순서와 검증

1. Source/현재 dirty delta·보호 evidence pins 확인. 새 helper와 production spawn→loot 계약 테스트를 먼저 RED로 만든다. 범위는 loot bonus tier resolver/data, owning loot branch, 관련 테스트/증빙/ledger이며 보스/EXP/profile 변경이 필요하면 재설계한다.
2. 기존 인라인 mirror가 production 정합성을 검증하는 것처럼 보이는 테스트/주석을 교체한다. 경계9/10/27/28/44/45/59/60/74/75와 EXP만 변화시켜도 대상 tier가 같은지 확인한다. 실제 map spawn 사례18/36/55/62를 포함한다.
3. 동일 seeded input에서 대상 밖 전체 loot 결과/RNG 호출 수 exact equality. 대상은 bonus roll 성공 횟수/상한 불변, 결과 pool membership/요구레벨/ordinary 여부를 검사한다. Prefix/item 종류 차이로 후속 RNG가 달라질 수 있으므로 횟수만 보고 전체 stream 동일을 주장하지 않는다.
4. 18 jobs×checkpoint2/5/10/20/45/60/75, 지역별 no-table/legacy 대표, focused64 seeds×32 attempts를 production reducer receipt로 진단한다. 필요한 Lv28/62 경계 cohort를 별도 명시한다. Structured rolled/admitted/blocked와 usable level/job, signature/pity, 가격 분포를 비교한다. 가격은 item DB 값과 실제 판매 산식을 구분한다. 게임 로그 parsing/미러 capacity 금지.
5. Signature set reachability와 기존 enriched/boss 보상 경로를 검증한다. 미래 장비가 줄었다는 이유만으로 모든 성장이 개선됐다고 주장하지 않는다. 자연 플레이/내부 실제 원정과 diagnostic 결과가 같은 문제를 지목하는지 확인한다.
6. Canonical evidence가 변경되면 이전 bytes 보존→writer terminal success→readonly verify→전체 gate. v1 output/hash 변화가 필요하면 숨겨서 갱신하지 말고 기존 v1 보존 계약과 충돌을 보고한다. 후보를 강제 통과시키기 위한 seed축소/출력 누락 금지.
7. Focused integration→verify:full→art/content/equipment gates→390×844 승리·전리품·장착/거절·귀환·복원→cap/debug Android/unsigned iOS 및 패키지 대조. 원래 기기/lifecycle/S6는 별도로 남긴다.

## 승인과 rollback

이 안은 기존 미래 장비·판매가·signature fallback 경험을 바꾸므로 자동 continuation만으로 활성화하지 않는다. 승인 후에도 실패/부작용이 확인되면 현재 source를 기준으로 수정 범위를 다시 제시한다. 기존 profile rollout 원칙과 active expedition 경계까지 확인하기 전 공개 배포하지 않는다. No commit/push/install/sign/publish/유료서비스. 이미지6 설계는 이 보상 변경과 독립적이다.
