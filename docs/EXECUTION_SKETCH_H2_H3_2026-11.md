# 실행 스케치 — H2 후반 곡선 압축 · H3 장 경계 3택 (2026-11-10)

베이스: `fix/fun-analysis-quick-wins` `fd4ee8fe`(G2 · G3 커밋 뒤).
출처: 재미 분석 `docs/FUN_ANALYSIS_2026-11.md` §6.2 · §7, 장 결산 명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md`.
역할: 계획 · 설계는 이 문서까지다. 실행 모델은 이 문서의 묶음 순서대로 커밋을 만들고, **§0의 결정을 다시 열지 않는다.** 문서와 코드가 다르면 코드를 근거로 삼고 차이를 보고한다.

---

## 0. 정해진 것

| 날짜 | 결정 | 출처 |
|---|---|---|
| 2026-11-10 | Q1 후반 1탭 반복 → **곡선 압축(H2) 먼저**. 연속 탐험(H1)은 사람 플레이테스트 뒤 | 소유자 답 |
| 2026-11-10 | Q2 빌드 다시 열기 → **장 경계 3택(H3)** | 소유자 답 |
| 2026-11-10 | Q3 골드 → 지출처 확장(H6)은 **이번 범위 밖**, H3 뒤 별도 스케치 | 소유자 답 |
| 2026-11-10 | G2 · G3 → 한 커밋(`fd4ee8fe`) | 소유자 답 |
| 2026-11-10 | S1 H2 압축 목표 → **1회차 Lv41-48 비중 약 40%**(Lv40-47 요구량 평평 근처, 측정으로 확정) | 소유자 답 |
| 2026-11-10 | S2 H3 셋째 카드 → **장착 무기 무료 강화 +2** | 소유자 답 |
| 2026-11-10 | S3 H3 받는 장 → **지역 4 · 5 · 7장**(게이트 25 · 35 · 42) | 소유자 답 |

지켜야 하는 기존 원칙(CLAUDE.md): 다시 오르는 시간 = 처음 오르는 시간(원장 §139, 따라잡기 경험 금지) · 탐험 난수(`actionRng`)를 새로 쓰지 않음(Wave 70 · 75) · 보스를 플레이어 화력에 맞춰 키우지 않음(Wave 60) · 반응은 플레이어 몫(Wave 88) · 사망하면 여정이 처음부터(Wave 108) · 새 `GS` 멤버는 세 표를 짚게 함(Wave 20 L1).

## 1. 남은 소유자 질문

없음. 실행 중 새로 생기는 판단(측정이 목표를 못 맞춤 · 원칙 충돌)은 멈추고 보고한다. 기각한 대안(기록용): S2 기술 분기 무료 바꾸기(지금도 50골드로 가능해 가치가 작다) · 세 장 모두 유물, S3 4 · 5 · 6장(Lv31-40에 더 가깝지만 7장이 긴 후반 꼬리 전체를 덮는다).

---

## 2. H2 — 후반 경험 곡선 압축

### 2.1 사실 (2026-11-10 코드 대조)

- 곡선은 레벨 함수가 아니라 **저장된 `nextExp`의 점화식**이다: 레벨업마다 `nextExp = min(floor(nextExp × EXP_SCALE_RATE 1.15), EXP_LEVEL_HARD_CAP 150,000)`, 시작 `START_NEXT_EXP` 200(`constants.ts:65 · 306 · 308`).
- 정본은 `CombatEngine.outcome.ts:37-43`(`applyExpGain`). 같은 식이 따로 있는 곳: `progressionPacing.ts:29-33`(Lv10 이하 임무 보상) · `expeditionLedger.ts:100-103`(원정 결산 경험) · `useGameTestApi.ts:100-109`(QA 시드, 레벨 인덱스형) · 테스트 미러 `tests/combat-engine-core.test.js:18-19 · 63-80`. 지금은 상한 적용까지 모두 같다(갈라짐 없음). 시뮬레이터 · 진단은 이미 `applyExpGain`을 굴린다.
- 적 처치 경험 = `10 + 10 × 레벨 + 4 × 심연 깊이`(`exploreUtils.ts:207`) × 배율들. 레벨 차이 감액은 골드에만 걸린다.
- Lv41 → 48 구간 경험 582,273 = Lv1 → 48 누적의 62%. 상한은 Lv49에서 처음 걸리므로 **Lv41-48이 곡선에서 가장 가파른 무상한 구간**이고 Lv48의 레벨당 처치 286회가 게임 최대다.
- `player.nextExp`는 세이브에 저장되고 불러올 때 다시 계산하지 않는다(`dataMigration.ts`에 없음). 사망 · 계승 · 다시 시작은 200으로 돌아간다.

### 2.2 손잡이 — 요구량 곡선만 바꾼다

적 경험을 올리지 않는다. 적 경험은 계승 정수(`essenceLedger.ts:39-41`, exp ÷ 8) · 전리품 레벨 추정(`CombatEngine.loot.ts:163 · 189`) · 유물의 잔향 정수(`RELIC_ECHO_EXP_*`)에 함께 흘러 Wave 114 정수 천장 · 1회차 후반 성장 · 전리품 곡선을 같이 움직인다. 요구량 곡선은 레벨업 시점만 바꾼다.

후보(기본 적 경험 기준 처치 수, 배율 제외 — 방향 추정용):

| Lv40-47 배율 | Lv48 요구량 | Lv40-48 처치 | Lv1-48 처치 | 상한 첫 도달 |
|---|---|---|---|---|
| 1.15 (현행) | 139,953 | 1,392 (100%) | 2,386 (100%) | Lv49 |
| 1.08 | 84,681 | 1,087 (78%) | 2,080 (87%) | Lv53 |
| 1.06 | 72,918 | 1,013 (73%) | 2,007 (84%) | Lv54 |
| 1.00 (평평) | 45,753 | 약 810 (58%) | 약 1,800 (76%) | Lv57 |

배율만 낮춰서는 Lv40 요구량(45,753)이 이미 커서 많이 줄지 않는다. 목표 40%(S1)는 평평(1.00) 근처다 — 처치 수와 드라이버 시간이 비례한다고 보면 1회차 약 24h → 18 ~ 19h, Lv41-48 비중 약 40%. 측정으로 확정한다.

설계: Lv48 뒤는 1.15로 돌아가 상한에 닿는다(계승을 미루는 플레이어의 Lv49-56도 함께 싸진다 — 시뮬레이터 Lv60 · 75 앵커가 움직이는 것은 의도된 결과로 기록한다). 배율은 `BALANCE.EXP_SCALE_RATE_LATE` + 구간 `BALANCE.EXP_LATE_BAND`(`{ from: 40, to: 48 }` — `as const`, 리터럴에서 타입 도출).

### 2.3 커밋 1 — 곡선 단일화 (결과 바이트 동일)

- 새 `src/systems/expCurve.ts`: `getNextExpRequirement(level, prevRequirement)`(점화식 한 단계 — 레벨 인자를 받아 두는 것은 커밋 2의 구간 배율 자리) · `getLevelExpRequirement(level)`(200부터 굴린 레벨 인덱스형).
- 네 구현을 이 모듈로 옮긴다. `useGameTestApi`의 사본은 지운다. 테스트 미러(`combat-engine-core`)는 모듈을 import하고, **독립 오라클은 `tests/progression-simulator.test.js:156-165` 하나만** 남긴다(곡선이 바뀌면 그쪽이 붉어져야 한다).
- 부재 불변식 테스트(`tests/exp-curve-single-source.test.js`): `EXP_SCALE_RATE` · `EXP_LEVEL_HARD_CAP`을 읽는 src 파일은 `expCurve.ts`뿐(식별자 매칭, CLAUDE.md §7 소스 가드 정책 안).
- 행동 계약: 네 소비처가 같은 입력에 같은 값(정본과 대조, Lv1-99 · 비표준 `nextExp` 픽스처 280,000 포함).
- 결함 주입: 한 소비처에 `× 1.16`을 넣으면 계약이 붉다 · 미러를 정본 import 대신 상수로 되돌리면 부재 불변식이 붉다.
- 확인: `npm run verify` · 자연 플레이 4경로 × 시드 2 HEAD 대비 바이트 동일 · 증빙은 소스 해시만 다시 씀(`npm run progression:diagnostic:write` — 본문 동일 확인).
- `constants.ts:306`의 낡은 주석("Lv50 ~45전투", 실제 약 295처치)을 고친다.

### 2.4 커밋 2 — 구간 배율 + 레벨 인덱스형 전환

- `applyExpGain`의 레벨업이 `nextExp = getLevelExpRequirement(newLevel)`을 쓴다. 이점: 옛 세이브의 계단 어긋남(픽스처 280,000 · 압축 전 큰 요구량)이 레벨업 한 번 뒤 새 곡선에 맞춰진다. **`DATA_VERSION`은 올리지 않는다**(저장 모양 불변). 불러올 때 정규화는 넣지 않는다(골든 74입력 보존).
- 깨지는 테스트 3 ~ 4건(`combat-engine-core.test.js:263-266 · 373-378`, `quest-progression-pacing.test.js:148`)은 비표준 `nextExp` 픽스처를 쓰는 것들이다 — 기대값을 새 정의로 고치고 이유를 커밋 본문에 적는다(검증 약화가 아님).
- 계약 `tests/late-exp-band-contract.test.js`: 구간 밖 요구량은 현행과 같다(Lv1-40 바이트 동일 — `early-growth-tempo` · `early-leveling-deceleration`이 그대로 통과해야 한다) · 구간 안은 `EXP_SCALE_RATE_LATE` · Lv48 뒤 1.15 재개 · 상한 유지 · 사망 재시작이 같은 곡선(처음 = 다시, §139).
- 다시 쓸 것:
  - `tests/progression-simulator.test.js:96` `EXPECTED_BASELINE_REPORT_SHA256`(이력 주석 이어 쓰기).
  - `tests/content-reachability.test.js`의 53.3 하드코딩(:376 · 476 · 579)과 앵커 주석 · `tests/event-chain-cost.test.js:185-198 · 262`. **Lv48은 앵커가 아니라 Lv45 ~ 60 보간이고 그 사이에 상한 꺾임이 있다** — 시뮬레이터 체크포인트에 48을 더해 마왕성 게이트를 앵커로 만든다(보간 오차 제거, 리포트 스키마가 바뀌면 `schemaVersion` 올림).
  - 증빙: `progression:diagnostic:write` · `content-reachability.json`(`scripts/verify-content-reachability.mjs --write`) · `constants.ts`를 고정하는 `equipment-combat-power.json` · 마지막에 `npm run evidence:verify`(pacing 포함).
  - CLAUDE.md: "마왕성 경로 게이트 Lv48 ≈ 53.3 모델시간"과 53.3을 인용한 줄들(§5 · §6 로그라이크 루프 · §7 content-reachability 설명) — 새 값으로, 결정 한 줄(소유자 결정 S1) 추가.

### 2.5 측정 (커밋 2의 통과 기준)

- 드라이버 결과에는 이미 `run.levelAt[level]`(처음 닿은 시각)이 있다. `scripts/natural-play-report.mjs`에 1회차 **Lv41-48 비중** 열을 더한다 = (`levelAt[48]` ?? 회차 끝) − `levelAt[41]`) ÷ 회차 시간. 처음 오르기 · 다시 오르기를 나누려면 드라이버 관찰 필드(레벨업마다 시각)를 더한다 — 결정을 바꾸지 않는 관찰 필드라 `DRIVER_VERSION` 3 유지(Wave 128 `chainSteps` 선례). 추가 전후 기존 출력 바이트 동일을 확인한다.
- 명령: `npm run natural-play:batch -- --out DIR --seeds 1-24 --paths knight,berserker,archmage,warlock,cleric,shaman,assassin,ranger --runs 3 --economy materials` 기준선(커밋 1)과 후보, `npm run natural-play:report -- DIR BASE_DIR`.
- 통과:
  - 1회차 Lv41-48 비중이 S1 목표 ±3%p.
  - 1회차 사망 · 2 · 3회차 사망이 유의하게 늘지 않는다(짝 z < 2). **위험**: 처치가 줄면 1회차 정수 사다리가 낮아진다(후반 성장의 몫) — 계승 시 사다리 단계 · 회차 정수를 함께 보고한다. 넘어가는 몫은 100단계 상한(Wave 114)이라 2회차 영향은 작을 것으로 본다.
  - 다시 오르기 ÷ 처음 오르기 비율이 0.75 ~ 1.24 범위 그대로(§139).
  - 큰 순간 최장 공백이 늘지 않는다(레벨업 자체가 큰 순간이다).
- 후보는 1.00부터 재고, 목표에서 벗어나면 배율을 0.02씩 옮겨 다시 잰다(1.06까지). 잰 후보 모두를 표로 보고한다.

---

## 3. H3 — 장 경계 3택

### 3.1 사실

- B1의 "장"은 **본편 16장이 아니라 지역 경로 게이트로 묶은 11개 장**이다(`src/data/chapters.ts:14-26` `CHAPTER_BANDS`, 명세 §1.1이 본편 장을 기각 — 임무를 받지 않으면 장이 0). 4장 게이트 25 · 5장 35 · 6장 40 · 7장 42.
- 장을 넘는 기록은 `advanceChapterOnEntry`(`chapterRecap.ts:278-305`) 한 곳이고 이동(`moveActions.ts:79`의 `SET_PLAYER` payload)이 부른다. 상태는 `player.stats.currentRun.chapters = { reached, mark, recaps[] }`(여정 범위). 결산 카드는 원정 정리 시트(`ExpeditionDebriefCard`)와 능력치 탭에 보인다.
- 기술 분기 바꾸기는 **이미 있다** — `swapSkillChoice`(`characterActions.ts:232`) · 안전지대 · `SKILL_SWAP_COST` 50골드. 그래서 분기 무료 바꾸기 카드는 가치가 50골드다(S2에서 기각한 이유).
- 일반 장비에는 '각인'이 없다. 가까운 것은 접두어(`itemPrefixUtils.ts:64` `applyItemPrefix` — 무작위 접두어, `prefixed`면 다시 붙이지 않음, 11종 · 2세트 효과 7종 `items.ts:382-403`).
- 칸이 찬 무작위 유물 제안에서 나아지는 카드는 약 3%다(원장 §82) — 등급 하한이 없으면 유물 카드는 대부분 넘기기가 된다.

### 3.2 설계

**받을 권리는 저장하지 않고 도출한다.** `earned = PICK_CHAPTERS ∩ {장 ≤ chapters.reached}`, `pending = earned − chapterPicks`. 넘는 순간(이동)에 새 쓰기가 생기지 않으므로 명세 §1.5 "쓰기 유일"과 B1의 바이트 동일 기대가 그대로다. 3장에서 5장으로 바로 넘어가면 4 · 5 둘 다 받는다.

- 상수: `BALANCE.CHAPTER_PICK_CHAPTERS` = `[4, 5, 7]`(S3).
- 기록: `player.stats.currentRun.chapterPicks: number[]`(`chapters`의 형제 — 사망 · 계승 · 다시 시작에서 자동으로 비워진다). `normalizeCurrentRunProgress`(`runProgress.ts:84`)는 필드를 하나씩 다시 만들므로 **명시적으로 통과시킨다**(명세 :123 경고). `chapters` 안에 넣지 않는다(`chapter-recap-contract.test.js:235` 부재 불변식).
- 패: `src/utils/chapterPick.ts`의 `getChapterPickOffer(player, chapter)` 하나를 화면과 리듀서가 읽는다(Wave 94 패턴). 씨앗 `createDomainRandom(0, 'chapter-pick', chapter, currentRun.countersAtStart.explores, kind)` — **여정 안에서 변하지 않는 값만**(보유 유물 · 장비를 씨앗에 넣으면 장비를 벗어 패를 다시 굴릴 수 있다). 필터(보유 유물 제외 · 접두어 없는 장비)는 뽑을 때 적용. `actionRng` 소비 0.
- 세 카드(구체적 한 장씩 — 카드 안에서 다시 고르는 두 단계 화면을 만들지 않는다):
  1. **유물** — 희귀 이상 풀에서 1개(`pickWeightedRelics`, 칸이 찼으면 `replacing`으로 나아지는 카드 먼저). 약속한 보상이라 칸이 찼으면 유물의 잔향으로 바꾸지 않고 교체 화면(`pendingRelics` = [그 유물] → 기존 `RelicChoicePanel` · `REPLACE_RELIC` · `DECLINE_RELIC`)을 연다. 칸이 남으면 바로 지급(`ADD_RELIC` 경로 — 실효 최대치 내리기 포함).
  2. **접두어 각인** — 장착 무기 · 방어구 중 접두어 없는 칸 하나에 정해진 접두어 하나. `applyItemPrefix`는 무작위라 접두어 id를 받는 변형(`applyItemPrefixById`)을 같은 파일에 더한다. 둘 다 접두어가 있으면 이 카드 대신 대체 카드(유물 하나 더).
  3. **무료 강화**(S2) — 장착 무기 강화 +2(`ENHANCE_MAX` 10 안, 확률 · 골드 · 재료 없음, `equipmentHandlers.ts:166-236`의 강화 적용을 재사용). +9면 +1까지만, 이미 +10이거나 무기가 없으면 이 카드 대신 대체 카드(유물 하나 더). 카드 문구는 실제로 오르는 단계를 말한다.
  - 넘기기: 받지 않고 기록만(보상 없음). 화면을 막지 않기 위해 꼭 있다.
- 전이: `AT.CLAIM_CHAPTER_PICK` payload `{ chapter, cardId }`(`ActionPayloadMap`에 타입). 리듀서는 `pending`에 없는 장 · 패 밖 카드면 **동일 참조**. 수락 시 `chapterPicks`에 장을 넣고 카드 효과를 적용한다(유물 카드의 교체 화면은 `pendingRelics`로 넘기므로 그 뒤 리로드는 Wave 34 경로).
- 화면: **새 `GS` 멤버를 만들지 않는다.** 상태로 띄우는 오버레이 `ChapterPickPanel`, 조건 `pending.length > 0 && gameState === IDLE && !pendingRelics && !postCombatResult`(`GameRoot.tsx:157-164`의 독립 이야기 카드와 같은 모양). 원정 정리 시트 안에 넣지 않는다(명세 §1.6 "단추 없음" · `chapter-recap-contract.test.js:199`). 결과: 장에 들어선 뒤 처음 대기 상태가 되는 순간 뜬다(귀환을 기다리지 않으므로 고르기 전에 죽을 틈이 거의 없다). 사망하면 `reached`가 1로 돌아가 받은 기록도 비워지고, 다시 오르면 다시 받는다(Wave 108과 같은 범위, 의도).
- 카드 그리기: `ui/ChoiceCard` `layout="tile"`(A6 선택 문법). 문구는 MSG, 11px 하한, 조사는 `koreanParticles`, 주 행동 금빛 하나(고른 카드 확정), 넘기기는 고스트. 뒤로가기로 패를 넘기지 않는다 — 기존 `RelicChoicePanel`이 뒤로가기를 다루는 방식과 같게 맞춘다(실행 시 확인).
- 이전 세이브: `chapterPicks`가 없으면 빈 배열이다 — 이미 7장까지 온 세이브는 첫 대기 상태에 세 장을 차례로 받는다. 한 번뿐이고 해롭지 않아 그대로 둔다.

### 3.3 커밋 단위

1. **데이터 · 판정**: `chapterPick.ts`(도출 · 패 · 검증) · 상수 · `currentRun.chapterPicks` 통과 · `AT.CLAIM_CHAPTER_PICK` 리듀서 · `applyItemPrefixById`. 화면 없음. 계약 `tests/chapter-pick-contract.test.js`:
   - 도출: 4 · 5 · 7장 경계 × 건너뛰기(3 → 5) × 사망 재시작 × 계승.
   - 결정론: 같은 여정 · 같은 장 = 같은 패, 리로드 뒤 같은 패, 장비를 벗거나 유물을 바꿔도 같은 패.
   - 검증: 패 밖 카드 · 이미 받은 장 · 받을 권리 없는 장 → 동일 참조.
   - 난수: `explore()` · 이동의 `actionRng` 소비가 기능 전후 같다(결함 주입: 패 생성에 `actionRng`를 쓰면 붉다).
   - 범위: `pickPermanentPlayerState` 뒤 `chapterPicks`가 비어 있다.
   - 결함 주입: `normalizeCurrentRunProgress`가 필드를 떨어뜨리면 붉다 · 칸이 찬 유물 카드를 잔향으로 접으면 붉다.
2. **화면**: `ChapterPickPanel` · GameRoot 조건 · MSG. 렌더 계약(세 카드 · 넘기기 · 칸이 찬 유물 카드의 교체 안내) · `decision-screen-legibility-contract`에 이 화면 추가 · e2e(375 · 390 · 430: 장에 들어서기 → 패 → 고르기 → 리로드 뒤 다시 안 뜸) · `screen-text-clipping.spec.ts` 화면 목록 · `screen-english-words` · `src-reachability`.
3. **드라이버 · 측정**: `scripts/naturalPlay/driver.mjs`에 `--chapter-pick skip|recommended|relic|prefix|enhance`. **기본은 `skip`** — 기존 결과 바이트 동일, `DRIVER_VERSION` 3 유지(기본 정책을 바꾸는 순간 4로 올린다). 계약 `natural-play-driver-contract`에 옵션 결정론 한 줄.
4. **CLAUDE.md** 한 줄(규칙 · 소유자 결정 S2 · S3 · 측정 원장 번호).

### 3.4 측정 (통과 기준)

- H2 커밋 2를 기준선으로 `--chapter-pick skip` 대 `recommended`(그리고 각 단일 정책) 120짝.
- 통과: Lv31-48 빌드 결정 시간당이 0.08 · 0.5 → 1 이상(재미 분석 §2.1과 같은 계측 — `onDispatch` 관찰) · 사망 · 시간 유의 차이 보고(늘면 원인 분해, **수치로 보정하지 않는다** — Wave 53 · 60 원칙) · 세 카드의 선택 비율(한 카드가 90% 넘으면 지배적 선택지 — 재미 분석 §4 Archero 사례).

---

## 4. 순서와 완료

1. H2 커밋 1 (지금 시작 가능).
2. H2 커밋 2 + 측정.
3. H3 커밋 1 ~ 4 + 측정.
4. PR: H2 · H3를 한 PR로 묶지 않는다 — 각자 측정 근거가 다르다. 브랜치는 `main`에서 새로 따거나 현재 브랜치 PR이 머지된 뒤 딴다(실행 전에 소유자에게 확인).

각 커밋의 완료 = `npm run verify` 통과 · 해당 계약의 결함 주입 붉음 확인 · 측정 커밋은 `natural-play:report` 표를 커밋 본문 또는 원장 절에 남김 · `npm run evidence:verify`.

범위 밖: H1 연속 탐험 · H4 행동을 바꾸는 유물 · H5 보스 예고 기믹 · H6 골드 지출처 · H7 이벤트 틀 · H8 오늘의 원정.
