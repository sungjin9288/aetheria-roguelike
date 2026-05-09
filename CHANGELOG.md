# Changelog

> Aetheria Roguelike의 사이클별 변경 이력. 최신이 위.
>
> 분류 — `시스템 / 성능 / 콘텐츠 / UX / 인프라 / 보안 / 문서`. 자세한 항목은
> 각 사이클 commit 메시지를 참조.

---

## Cycle 430 🎯 — CHANGELOG에 cycles 421-429 history 일괄 추가

- 마일스톤: cycle 420 batch 이후 9 사이클 미반영 batch 정리. 24번째 batch.
  cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 /
  300 / 320 / 340 / 350 / 360 / 370 / 380 / 390 / 400 / 410 / 420에 이은 24번째.
- 누적 마일스톤: cycle 420(unit 1995) → 429(unit 2038, +43). silent dead config
  시리즈 cycle 222→429 189번째 도달.
- 시리즈 정체성 — silent UI 결손 회귀 batch: 9 사이클 중 2 사이클(426/427)
  silent UI regression fix, 7 사이클은 다양 lens 정리. cycle 396/398 lens가
  cycle 426/427에서 두 번 회귀하며 schema 미스매치가 살아있는 패턴임을 재확인.
- 본 batch 핵심 패턴: **silent UI 결손 lens가 cycle 348/413 잘못된 cleanup
  되돌리기로 두 번 회귀**. cycle 426은 cycle 348의 false dead 판정 정정,
  cycle 427은 cycle 413 paired completion의 누락분 보강.

검증: tsc 0 / unit 2038 / lint clean / build-guard ok.

---

## Cycle 421-429 — Lens 다변화 (unreachable/duplicate/output-dead/silent-UI/redundant-default 5종)

cycle 419 (호출 사이트 분석) 회귀 → duplicate detection (cycle 385 변형) →
output dead (cycle 333-356 시리즈) → defensive fallback redundancy (cycle 373-388
시리즈) → unreachable code path (cycle 357 paired) → **silent UI 결손 2연속** →
redundant default annotation paired completion으로 5 lens 다변화.

### 호출 사이트 + 데이터 정합성 unreachable (cycle 421, 1사이클)

- 421: SkillTypeIcon TYPE_PATHS / TYPE_COLORS '번개' — classes.ts skill.type 10종
  (물리/화염/냉기/자연/대지/빛/어둠/buff/debuff/escape)에 thunder type 0건.
  '썬더볼트' 등 thunder 스킬도 type='빛'으로 정의. monsters.ts weakness/
  resistance 9종에도 0건. cycle 419 호출 사이트 분석 lens 회귀.

### Duplicate detection (cycle 422, 1사이클)

- 422: MonsterIcon getMonsterType `name.includes('골렘') || name.includes('골렘')`
  — short-circuit `||`에서 동일 문자열 includes 2회. 두 번째 호출은 절대 추가
  매치 0건이라 의미 있는 분기 0건. cycle 385 변형 — 중복 키 → 중복 함수 호출.

### Output dead (cycle 423, 1사이클)

- 423: ControlPanel coreButtons sidebarLabel 2 entries — renderActionButton
  destructure가 `{key, testId, icon, label, mobileLabel, onClick, className,
  disabled}`만 포함. button.sidebarLabel read 0건. cycle 333-356 시리즈 회귀
  (cycle 416 ACTION_BUTTONS tag/detail batch와 동일 lens).

### Defensive fallback redundancy (cycle 424, 1사이클)

- 424: EXACT_ICON_CATEGORY_BY_TYPE `undefined: 'misc'` — JS 브래킷 룩업
  `obj[undefined]`은 'undefined' 문자열 키로 coerce → 엔트리 'misc' 반환. 엔트리
  제거 시 lookup undefined → `|| 'misc'` fallback 동일 'misc' 산출. 양쪽 path
  동일 결과 → 엔트리 기능적 잉여. cycle 373-388 시리즈 회귀.

### Unreachable code path (cycle 425, 1사이클)

- 425: pickFallbackEvent `explicit = FALLBACK_EVENT_POOL[loc]` lookup —
  cycle 357 이후 FALLBACK_EVENT_POOL은 English category 키만 (forest/ruins/
  cave/...). loc 파라미터는 항상 Korean 지명이라 직접 매칭 0건.
  `explicit` 항상 falsy → `explicit ? loc` / `explicit ||` short-circuit 분기
  unreachable. cycle 357 paired completion (Korean key 제거 후 잔존 dead
  branch 정리).

### Silent UI 결손 — cycle 348/413 잘못된 cleanup 정정 (cycle 426-427, 2사이클)

- 426: signatureSetBonus.activeSet atkMult/defMult/hpMult 복원 — cycle 348가
  '부모 return에 동일 필드'라며 제거했으나 StatsPanel.tsx (line 220/228/236)이
  `activeSignatureSet.atkMult`/`.defMult`/`.hpMult`를 직접 read해서
  formatMultDelta로 표시. 2-set 착용 시 ATK/DEF/HP delta가 모두 '—'로 silently
  표시되던 회귀. 부모 fields는 statsCalculator의 stat 합산용 별도 path.
- 427: SignatureBadge TONE_COLORS rust 추가 — signatureRegistry.json은 8 tone
  emit (rust 포함, '광기의 갑주' 아이템). 다른 surface (LegendaryDropOverlay/
  LegendaryCodex/ItemIcon) 모두 rust 보유. 그러나 SignatureBadge만 7 tone —
  cycle 413 cleanup 시 paired completion 누락. rust signature 획득 시 badge가
  holy gold fallback으로 silently 표시되던 정합 결손.

### Redundant default annotation paired (cycle 428-429, 2사이클)

- 428: QuestBoardPanel RewardChips default `accent = 'blue'` — 4 호출자 모두
  명시 전달이라 default 도달 불가.
- 429: QuestTab QuestRewardChips 동일 패턴 paired completion — 1 호출자 ternary
  로 명시 전달. 두 컴포넌트가 거의 동일 형태(formatRewardParts + accent ternary)
  였으므로 paired cleanup이 자연.

### 신규 lens 의의

- **silent UI 결손 lens 회귀 (cycle 426-427)** — cycle 396/398 이후 cycle 426/427
  에서 두 번 더 발견. 패턴: "cleanup 시점에 producer-consumer schema 동시 검증
  부족 → 한 쪽만 정리되어 silent UI gap 형성". 가드: paired completion 시
  반드시 모든 surface 동기 + 모든 read site의 schema 시뮬레이션.
- cycle 348(false dead)와 cycle 413(누락분) 두 종류 회귀 모두 발견 — cleanup
  의 두 가지 위험 패턴 (잘못된 dead 판정 vs paired completion 불완전).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 420 🎯 — CHANGELOG에 cycles 411-419 history 일괄 추가

- 마일스톤: cycle 410 batch 이후 9 사이클 미반영 batch 정리. 23번째 batch.
  cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 /
  300 / 320 / 340 / 350 / 360 / 370 / 380 / 390 / 400 / 410에 이은 23번째.
- 누적 마일스톤: cycle 410(unit 1954) → 419(unit 1995, +41). silent dead config
  시리즈 cycle 222→419 180번째 도달.
- 시리즈 정체성 — unreachable lens 메가 시리즈: 9 사이클 중 6 사이클(411/412/413/
  414/418/419) unreachable lens 정리. 데이터 정합성 + 호출 사이트 분석 두
  계열로 다양화.
- 본 batch 핵심 패턴: **데이터 정합성 vs 호출 사이트 두 unreachable lens 동시
  발견**. 시그니처 tone 정합성(411-413), 컴포넌트 size 호출 분석(418-419)으로
  각각 발견.

검증: tsc 0 / unit 1995 / lint clean / build-guard ok.

---

## Cycle 411-419 — Unreachable lens 메가 시리즈 (6사이클) + 출력 dead 다양화

cycle 358 (steel tone) paired completion 시작 → 시그니처 tone 정합성 unreachable
3사이클 → ICON_PATHS equipment-style 16 unreachable batch → output dead /
cascade imports / SIZE_MAP 호출 사이트 unreachable로 연계 다양화.

### 시그니처 tone 정합성 unreachable (cycle 411-413, 3사이클)

- 411: SIG_SET_TONE.frost / arcane (StatsPanel + EquipmentPanel batch) —
  signatureSets.json은 fire/holy/nature/shadow 4 tone만 emit. cycle 358 lens.
- 412: ItemIcon SIGNATURE_TONE_RING.steel — signatureRegistry.json 8 tone에
  steel 0건. cycle 358 paired completion.
- 413: SignatureBadge TONE_COLORS.steel — 동일 lens 마무리 (4 컴포넌트 paired
  completion 완성: TONE_GLOW + TONE_ACCENT + SIGNATURE_TONE_RING + TONE_COLORS).

### ICON_PATHS 큰 batch (cycle 414, 1사이클)

- 414: ItemIcon ICON_PATHS equipment-style 16 unreachable 일괄 — SVG 분기는
  `!isEquipmentItem` 케이스만 진입 (equipment는 EquipmentAvatarPreview takeover).
  sword/greatsword/dagger/staff/bow/axe/hammer/spear/scythe/whip/armor/robe/
  cloak/boots/shield/book 16 키. 12 키 (material + 비-equipment fallback) 보존.

### 출력 dead 다양화 (cycle 415-417, 3사이클)

- 415: getWeeklySpecial isWeeklySpecial 출력 dead 마커 — cycle 355는
  isDailyDeal을 회귀 가드로 보존했으나 isWeeklySpecial은 누락분 정리.
- 416: CombatPanel ACTION_BUTTONS 4 entry × 2 fields = 8 dead (tag/detail).
  렌더는 icon/key/className/mobileLabel/label만 read.
- 417: EquipmentPanel SLOT_CONFIG icon 3 dead + cascade lucide-react Sword/
  Shield 미사용 import 정리. Sparkles는 다른 JSX에서 활성 보존.

### 호출 사이트 unreachable (cycle 418-419, 2사이클)

- 418: AetherMark SIZE_MAP.sm — IntroScreen / BootScreen은 md/lg만 사용.
- 419: SignalBadge SIZE_CLASS md/lg — 73 호출 사이트 모두 size="sm" 명시.
  default param + fallback도 sm 기준으로 갱신.

### 신규 lens 의의

- "호출 사이트 분석 기반 unreachable" lens는 cycle 411-413의 데이터 정합성
  unreachable과 보완 — 데이터/생산자가 정의되지 않은 케이스 vs 소비자가 절대
  사용하지 않는 케이스. 두 계열 모두 동일 결과(lookup 절대 hit 안 됨).
- 73 호출 사이트 분석은 시리즈 사상 가장 상세한 호출 traceability 확인.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 410 🎯 — CHANGELOG에 cycles 401-409 history 일괄 추가

- 마일스톤: cycle 400 batch 이후 9 사이클 미반영 batch 정리. 22번째 batch.
  cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 /
  300 / 320 / 340 / 350 / 360 / 370 / 380 / 390 / 400에 이은 22번째.
- 누적 마일스톤: cycle 400(unit 1907) → 409(unit 1954, +47). silent dead config
  시리즈 cycle 222→409 171번째 도달.
- 시리즈 정체성 — interface dead lens 메가 시리즈: 9사이클 중 5사이클(401-405)
  연속 interface dead, 1사이클(406) function output dead로 자연 전환,
  2사이클(407+409) function dead 회귀, 1사이클(408) export → private downgrade.
- 본 batch 핵심 패턴: **컴포넌트 props interface dead가 7개 컴포넌트째 발견** —
  Dashboard / PostCombatCard / IntroScreen / CraftingPanel / JobChangePanel /
  TerminalView / Codex 모두 동일 패턴으로 cleanup.

검증: tsc 0 / unit 1954 / lint clean / build-guard ok.

---

## Cycle 401-409 — Interface dead lens 5사이클 + function output dead lens 회귀

cycle 396-398에서 silent UI 결손 lens (schema 미스매치)를 발견한 후 자연
확장 — interface props 정의는 있지만 본체 destructure 미사용 + 외부 prop pass
silent dropped 패턴이 5사이클 연속 7 컴포넌트에서 발견. 그 후 function output
dead / unreachable / private downgrade lens로 다변화.

### Interface dead 5사이클 (cycle 401-405) — 7 컴포넌트 paired remove

- 401: DashboardProps `mobile?: boolean;` — 본체 destructure 미사용 + 변수 read
  0건. MobileGameLayout이 prop pass했으나 silent dropped.
- 402: PostCombatCard + IntroScreen 동일 lens batch — 컴포넌트 2개 묶음.
  `<PostCombatCard mobile={true}>` / `<IntroScreen mobile />` 둘 다 silent dropped.
- 403: CraftingPanel + JobChangePanel `mobileFocused` 동일 lens batch — 컴포넌트
  2개. ControlPanel이 prop pass했으나 본체 destructure 미사용.
  비교: EventPanel/QuestBoardPanel/ShopPanel은 활성 보존.
- 404: TerminalView `stats?: any;` — 본체 destructure 미사용. MobileGameLayout이
  `stats={fullStats}` 전달했으나 silent dropped. fullStats 변수 자체는 다른
  컴포넌트(Dashboard 등)에서 사용 보존.
- 405: Codex `compact?: boolean;` — 본체 destructure 미사용. Dashboard가
  `compact={desktopArchiveCompact}` 전달했으나 silent dropped.
  비교: AchievementPanel/StatsPanel/EquipmentPanel/MapNavigator 등 8개 패널은
  활성 보존.

### Lens 다변화 (cycle 406-409, 4사이클)

- 406: useGameEngine `actions.setAiThinking` dead method — setter 정의만 있고
  src/, tests/ 호출 0건. AT.SET_AI_THINKING reducer handler는 다른 dispatch
  path 의존으로 보존.
- 407: formatRewardParts `essence` / `relicShard` 분기 unreachable —
  AchievementPanel/QuestTab/QuestBoardPanel은 quest/achievement reward만
  전달하지만 quests.ts/achievements 데이터에 essence/relicShard 0건.
  daily protocol은 별도 formatDailyProtocolReward 처리.
- 408: HEADGEAR_PLACEMENTS + BODY_PLACEMENTS export → private downgrade batch
  — cycle 312 WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS paired completion.
- 409: getTraitItemResonance.reasons 출력 dead — 외부 read 0건. 내부 reasons
  배열은 summary 계산용 로컬 변수로 유지. score/label/summary 활성 보존.

### 신규 lens 의의

- "interface dead" lens는 cycle 396/398의 silent UI 결손 lens 직계 후속 —
  schema mismatch가 외부 dispatch path까지 확장된 형태. parent가 prop pass하지만
  child가 destructure 안 하는 paired remove 케이스를 발견하기 시작했음.
- 5사이클 연속 발견은 시리즈 사상 두 번째 longest lens 회귀 (cycle 373-388
  fallback redundancy 16사이클 다음).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 400 🎯 — CHANGELOG에 cycles 391-399 history 일괄 추가

- 마일스톤: cycle 390 batch 이후 9 사이클 미반영 batch 정리. 21번째 batch.
  cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 /
  300 / 320 / 340 / 350 / 360 / 370 / 380 / 390에 이은 21번째.
- 누적 마일스톤: cycle 390(unit 1867) → 399(unit 1907, +40). silent dead config
  시리즈 cycle 222→399 162번째 도달. **400 사이클 milestone — total 178 cycles
  cleanup since cycle 222 base**.
- 시리즈 정체성 다양화: 9 사이클 중 lens 5종 — private downgrade(391), unreachable
  (392/395/397), data-config-dead(393/394/399), silent UI 결손(396/398).
  migrateData fallback redundancy lens 종료 후 자연스러운 lens 다변화.
- 본 batch 핵심 패턴 신규: **silent UI 결손 lens** — schema 미스매치로 read field가
  항상 undefined → 가드 false → UI dispatch 영원히 dormant. cycle 396/398 발견 사례.

검증: tsc 0 / unit 1907 / lint clean / build-guard ok.

---

## Cycle 391-399 — Lens 다변화 (private/unreachable/data-config/silent-UI 5종)

cycle 373-388 16사이클 fallback redundancy lens 종료 후 자연 분기. 9사이클 중 lens
5종 — 단일 lens 회귀가 아닌 **다양한 dead config 형태 동시 정리**.

### Export → private downgrade (cycle 391, 1사이클)

- 391: DEFAULT_COMBAT_FLAGS — playerStateUtils 내부 2회 사용만, 외부 0건.
  CombatEngine.DEFAULT_COMBAT_FLAGS는 별개 property로 무관. cycle 317 paired
  test 가드 정정 (잘못된 active export list).

### Unreachable lookup/data (cycle 392/395/397, 3사이클)

- 392: ACTION_KIND_TO_BUTTON `open_shop` — adventureGuide producer 0건이라 lookup
  절대 hit 안 됨.
- 395: WEAPONLESS_ADVENTURER_SPRITES Set 정의 dead + JOB_SPRITE_SLUG_MAP
  `'그림자 주군'` (공백 포함) normalize-bypass 키. resolveAppearanceKeys가 항상
  공백 strip 후 lookup해 with-space 키 unreachable.
- 397: THEME_BY_TARGET `abyssFloor` — DB.ACHIEVEMENTS 6 abyss target은 모두
  abyssRecord. abyssFloor 키 lookup 절대 hit 안 됨.

### Data-config dead (cycle 393/394/399, 3사이클)

- 393: PREMIUM_SHOP entry category/repeatable 10 dead — invExpand/synthProtect/
  revive 3 entry × 2 + cosmeticTitles 4 entry × 1. PremiumShop 컴포넌트 spread 후
  사용 0건. 단일 batch 10 dead 필드.
- 394: RELIC_SYNERGIES `id` 출력 20 dead — 매칭은 항상 bonus.effect 기반.
  syn.id read는 src/, tests/ 어디에도 0건. cycle 365 (eventChain chainId 70)
  data-config-dead 변형.
- 399: QuickSlotProps interface `onAssign` / `onUnassign` 2 필드 dead — 본체
  destructure 미사용 + 외부 pass 0건. interface dead 변형.

### Silent UI 결손 (cycle 396/398, 2사이클 — 신규 lens 발견)

- 396: StatsPanel `syn.name` → `syn.label` schema 미스매치 fix —
  RELIC_SYNERGIES entry는 `label` 필드. 기존 `syn.name`은 항상 undefined로
  React key 충돌 + 시너지 이름 UI 빈 칸 silent 결손.
- 398: DashboardMobileSummary `trait.label` → `trait.title` schema 미스매치 fix —
  TRAIT_DEFINITIONS entry는 `title` 필드. `if (trait?.label)` 가드 항상 false →
  trait pill 영원히 silent 결손.

### 신규 lens 발견 의의

- "silent UI 결손" lens는 cycle 193 (SEASON_XP.codexDiscover dispatch 0건) /
  cycle 218 (victory 사운드) silent dispatch lens의 schema 미스매치 변형.
- 정의된 read 사이트는 활성이지만 schema mismatch로 producer 0건과 동일 결과 —
  UI가 silent로 dormant. 이런 형태는 grep만으로 발견 어려움 (read 사이트 자체는
  존재하므로). 후속 사이클에서 schema cross-check 패턴으로 추적 가능.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 390 🎯 — CHANGELOG에 cycles 381-389 history 일괄 추가

- 마일스톤: cycle 380 batch 이후 9 사이클 미반영 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300 / 320 / 340 / 350 / 360 / 370 / 380에 이은 20번째 batch.
- 누적 마일스톤: cycle 380(unit 1829) → 389(unit 1867, +38). silent dead config 시리즈 cycle 222→389 153번째 도달. 20번째 batch 안착 — milestone 시리즈도 200사이클 누적.
- 시리즈 정체성: 9 사이클 중 8(cycle 381-388)는 migrateData defensive fallback redundancy 연속 — cycle 373부터 통산 16사이클 연속, **시리즈 사상 최장 동일 lens**. cycle 389는 internal helper 출력 dead로 lens 전환.
- 본 batch 핵심 통찰: "migrateData fallback redundancy lens가 자연 종료" — 회귀 가드(cycle 120/131/189/260/298)에 보호되거나 직접 property access (visitedMaps/exploreState)에 필요한 fallback만 잔존.

검증: tsc 0 / unit 1867 / lint clean / build-guard ok.

---

## Cycle 381-389 — migrateData defensive fallback redundancy 8사이클 연속 + helper output dead

cycle 373-380 lens가 cycle 381-388 8사이클 더 연속 — 누적 16사이클 연속 동일 lens (시리즈 사상 최장). cycle 389에서 internal helper 출력 dead lens로 자연 전환.

### migrateData defensive fallback redundancy (cycle 381-388, 8사이클 연속)

- 381: status / skillLoadout.selected normalizations 2회 — 모든 consumer Array.isArray + `|| []` fallback. skillLoadout.cooldowns 직접 dispatch는 보존.
- 382: target.relics / target.titles normalizations 2회 — 모든 consumer (statsCalculator/checkTitles/migrateData 후속 forEach) Array.isArray + `|| []` fallback.
- 383: codexClaimed normalization 1회 — 모든 consumer Array.isArray 또는 `|| []` 처리. cosmeticTitles는 cycle 189 회귀 가드로 보존.
- 384: areaBossDefeated / deathSaveUsedCount fallback 2회 — exploreUtils optional chain / combatVictory `|| {}` / CombatEngine `|| 0` 처리.
- 385: discoveryChains normalization 중복 1회 — 동일 함수 내 두 군데 중복, 두 번째 라인 noop. 첫 번째는 cycle 120/131 회귀 가드로 보존.
- 386: dailyInvadeCount / lastInvadeDate fallback 2회 — useRoguelikeInvasion `|| 0` 또는 직접 비교.
- 387: skillChoices / challengeModifiers normalizations 2회 — 모든 consumer Array.isArray 또는 `|| []` fallback.
- 388: killStreak normalization 1회 (3-line if 블록) — statsCalculator/StatusBar 모두 `player.killStreak || 0` fallback.

### Internal helper output dead (cycle 389, lens 전환)

- 389: computeKillStreakBonus.tierIdx 출력 1 dead 필드 — 유일 consumer (calculateFullStats)는 streak.atkBonus/critBonus만 read. tierIdx는 함수 내부 lookup index로만 사용. 16사이클 fallback redundancy lens 자연 종료 후 function output dead lens로 회귀.

### 보존된 fallback (회귀 가드 정합)

- cycle 120/131: escapes / syntheses / maxKillStreak / discoveryChains.
- cycle 189: cosmeticTitles.
- cycle 260: claimedQuestIds.
- 직접 access: visitedMaps (.includes/.push) / exploreState (spread) / skillLoadout.cooldowns / reviveTokens / synthProtects (Math.max 음수 clamp).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 380 🎯 — CHANGELOG에 cycles 371-379 history 일괄 추가

- 마일스톤: cycle 370 batch 이후 9 사이클 미반영 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300 / 320 / 340 / 350 / 360 / 370에 이은 19번째 batch.
- 누적 마일스톤: cycle 370(unit 1791) → 379(unit 1829, +38). silent dead config 시리즈 cycle 222→379 144번째 도달. unit count 1800+ 도달.
- 시리즈 정체성: 9 사이클 중 2(cycle 371-372)는 maps redundant defaults, 7(cycle 373-379)는 migrateData defensive fallback redundancy — **최장 7사이클 연속 동일 lens**.
- 본 batch 핵심 통찰: "consumer-level fallback이 이미 보호하는 영역의 migrate-level normalization은 redundant" — 32+ 누적 fallback 정리.

검증: tsc 0 / unit 1829 / lint clean / build-guard ok.

---

## Cycle 371-379 — Maps redundant defaults + migrateData defensive fallback 7사이클 lens

cycle 367 maps redundant pattern 후속으로 maps 추가 정리(371-372), 그 후 cycle 373부터 7사이클 연속 migrateData defensive fallback redundancy 정리. 본 시리즈 가장 긴 동일 lens 연속.

### Maps redundant default annotations (cycle 371-372, 2사이클)

- 371: maps safe-zone `eventChance: 0` 5회 — `mapData.eventChance || 0` fallback + `type === 'safe'` early return으로 명시 불필요. 황금 왕국 (eventChance: 0.28) 보존.
- 372: maps safe-zone `monsters: []` 5회 — 모든 consumer가 `|| []` fallback. 황금 왕국 monsters 배열 보존.

### migrateData defensive fallback redundancy (cycle 373-379, 7사이클 — 최장 lens)

- 373: meta sub-field fallback 5회 (essence/rank/bonusAtk/bonusHp/bonusMp) — 모든 consumer `|| 0` 또는 CombatEngine DEFAULT_META 병합으로 안전.
- 374: tempBuff sub-field fallback 3회 (atk/def/turn) — statsCalculator `|| 0` + playerStateUtils EMPTY_TEMP_BUFF 병합.
- 375: activeTitle fallback 1회 — 모든 consumer truthy 체크 또는 `|| null`.
- 376: bountyDate / Boolean(bountyIssued) 2회 — strict equality + truthy 체크로 undefined 안전.
- 377: stats.rests / bountiesCompleted 2회 — 모든 consumer `|| 0` fallback. ascensionActions 직접 read도 checkTitles fallback.
- 378: 8 sub-field 일괄 (prestigeRank/relicCount/crafts/buildWins/abyssFloor/abyssRecord/demonKingSlain/dailyProtocol) — 본 시리즈 가장 큰 단일 batch.
- 379: claimedAchievements normalization 1회 — claimedQuestIds는 cycle 260 회귀 가드로 보존.

### 보존된 fallback (회귀 가드)

- escapes / syntheses / maxKillStreak / discoveryChains: cycle 120/131 migrate output 명시 검증.
- claimedQuestIds: cycle 260 migrate output 명시 검증.
- visitedMaps: 직후 `.includes()` / `.push()` 직접 호출 의존.
- exploreState: spread 패턴으로 객체 보장 필요.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 370 🎯 — CHANGELOG에 cycles 361-369 history 일괄 추가

- 마일스톤: cycle 360 batch 이후 9 사이클 미반영 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300 / 320 / 340 / 350 / 360에 이은 18번째 batch.
- 누적 마일스톤: cycle 360(unit 1752) → 369(unit 1791, +39). silent dead config 시리즈 cycle 222→369 135번째 도달.
- 시리즈 정체성 변화: cycle 357-359 (3사이클) unreachable lens 도입 후, cycle 361-368 (8사이클) unreachable + redundant default annotation 일괄 — 9사이클 중 8사이클이 새 lens. cycle 369는 private downgrade로 회귀.
- 본 batch 핵심 패턴: "fallback default와 동일 값을 명시한 redundant config" — cycle 364부터 cycle 368까지 5사이클 연속.

검증: tsc 0 / unit 1791 / lint clean / build-guard ok.

---

## Cycle 361-369 — Unreachable + Redundant default annotation lens 8사이클 + private downgrade 회귀

cycle 357-359 unreachable lens에 이어 8사이클 — 데이터 파일에서 fallback default와 동일 값을 명시한 redundant config 정리. cycle 369는 type export private downgrade로 cycle 295/298/312/316 lens 회귀.

### Unreachable lookup duplicate (cycle 361-363, 3사이클)

- 361: JOB_AFFINITY_NAMES `'그림자주군'` (공백 제거) 중복 키 — buildAffinityLabel은 player.job (`'그림자 주군'` 정식 표기)을 normalize 없이 직접 lookup. JOB_SPRITE_SLUG_MAP과 패턴 비대칭.
- 362: JOB_STYLE_MAP / DEFAULT_JOB_STYLE hairStyle 15회 — cycle 342에서 deriveCharacterAppearance 출력 hairStyle 제거 cascade. 정의만 잔존, read 0건.
- 363: AVATAR_ANCHORS shoulder_l/shoulder_r 2 anchors — placement 함수에서 anchor로 사용 0건. tests도 7 anchor (shoulder 제외)만 검증.

### Redundant default annotation (cycle 364-368, 5사이클)

- 364: eventChain reward itemType (4회) / tier (3회) — eventActions는 reward.name만 read하고 addItemByName이 DB.ITEMS에서 type/tier lookup.
- 365: eventChain outcome chainId 70개 — 13 chain의 모든 outcome에 parent chain.id mirror, eventActions는 currentEvent._chainId만 read. 가장 큰 단일 정리.
- 366: monster phase2/phase3 threshold default 7회 — phase2 0.5 (BOSS_PHASE2_THRESHOLD 동일) × 2, phase3 0.25 (CombatEngine fallback 동일) × 5. 다른 값(0.2)인 phase3는 보존.
- 367: maps boss: false 4회 — 모든 boss 사용 사이트가 falsy 체크라 명시 불필요.
- 368: relic prophecy_stone (threshold: 0.25) + quest 62 (threshold: 0.2) 2회 — 각각 CombatEngine.executeAtkRelic / questProgress.questData fallback과 동일.

### Private downgrade 회귀 (cycle 369)

- 369: ItemBase type export → private — 외부 import 0건. 동일 파일 Item 유니온 / EquipSlots 필드 internal reference로만 사용. cycle 298 lens 회귀 (ConsumableItem은 cycle 298 회귀 가드로 보존).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 360 🎯 — CHANGELOG에 cycles 351-359 history 일괄 추가

- 마일스톤: cycle 350 batch 이후 9 사이클 미반영 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300 / 320 / 340 / 350에 이은 17번째 batch.
- 누적 마일스톤: cycle 350(unit 1718) → 359(unit 1752, +34). silent dead config 시리즈 cycle 222→359 126번째 도달.
- 시리즈 정체성 변화: 9 사이클 중 351-356은 cycle 333 시작 function output cleanup 연속 (총 cycle 333-356 24사이클), 357-359는 새 lens — unreachable code path / lookup table cleanup.
- 새로운 lens (cycle 357 도입): "정의됐지만 호출 사이트에 도달할 수 있는 입력 값이 0건"인 unreachable config. function output dead field 시리즈 24사이클 후 자연스럽게 등장.

검증: tsc 0 / unit 1752 / lint clean / build-guard ok.

---

## Cycle 351-359 — Function output cleanup 마무리 + Unreachable code path 신규 lens

cycle 333-350 시리즈에 이어 6사이클 더 동일 lens(function output dead) 진행 후, 357부터 새 lens — unreachable lookup table / code path 정리.

### Function output cleanup 마무리 (cycle 351-356, 24사이클 시리즈 마감)

- 351: getTraitProfile 3 redundant overrides (rewardFocus/questFocus/bossDirective) — `...definition` spread가 이미 노출하던 dead duplicate.
- 352: getLootUpgradeHint score 출력 dead — 내부 비교용 bestScore 변수로 분리, 외부 노출 strip.
- 353: getSelectedSkill index/total 2 출력 dead — `{ skill: skills[index] }`만 노출. combatAttack randomSkill 재할당 shape 동기화.
- 354: getTraitLootHint score/label/traitName 3 출력 dead — name/summary만 PostCombatCard / addCombatDigestLogs read.
- 355: getDailyDeals discount 1 출력 dead — 0.9 multiplier는 item.price에 이미 적용 완료, 별도 비율 노출 redundant.
- 356: OPERATION_META summary 5회 dead — 5 lane (story/build/growth/boss/hunt) 모두에서 일괄 제거. label/emphasis만 QuestBoardPanel read.

### Unreachable code path 신규 lens (cycle 357-359, 3사이클)

- 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events unreachable — exploreActions가 START_LOCATION에서 조기 반환, AI_SERVICE.generateEvent 진입 자체 차단. 마을은 type='safe' / eventChance=0인 안전지대.
- 358: TONE_GLOW.steel + TONE_ACCENT.steel 2 unreachable — signatureRegistry.json / signatureSets.json 어디에도 tone='steel' 0건. 활성 8 tone (holy/fire/frost/shadow/arcane/nature/earth/rust)만 사용.
- 359: ELEMENT_FILTERS 불/얼음/화염속성 3 unreachable aliases — items.ts elem은 화염/냉기/빛/자연/대지/어둠/에테르/바람/물리 9종만 사용 (cycle 223 '얼음' → '냉기' 통일 후).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 350 🎯 — CHANGELOG에 cycles 341-349 history 일괄 추가

- 마일스톤: cycle 340 batch 이후 9 사이클 미반영 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300 / 320 / 340에 이은 16번째 batch.
- 누적 마일스톤: cycle 340(unit 1684) → 349(unit 1718, +34). silent dead config 시리즈 cycle 222→349 117번째 도달.
- 시리즈 정체성: 9 사이클 모두 cleanup lens — function output dead field cleanup. cycle 333 시작된 "외부 read 0건이지만 함수 반환에 노출된 필드" 정리 시리즈가 9 cycle 더 진행 (총 cycle 333-349 17사이클).

검증: tsc 0 / unit 1718 / lint clean / build-guard ok.

---

## Cycle 341-349 — Function output dead field cleanup 9사이클 시리즈

cycle 333-340 시리즈에 이어 9사이클 더 — utility/system 함수의 출력 필드 중 외부 read 0건인 dead fields 정리. 같은 lens.

- 341: getEquipmentArtProfile 3 dead 출력 필드 (itemName/subtype/hands) — slot/key/toneKey/palette/headgearStyle/bodyStyle/isHeadgearOnly/style 활성 보존.
- 342: deriveCharacterAppearance 6 dead 출력 + cascade — top-level level/hairStyle, weapon/offhand/armor sub-objects의 item/iconKey/hands/equipped 정리. getItemIconAssetKey import도 cascade dead.
- 343: applyDynamicDifficulty 3 dead diff metadata — diffLabel return + scaled mStats의 _diffLabel/_diffScore 모두 read 0건.
- 344: buildRunSummary buildTags 출력 dead — RunSummaryCard / runShareText / outcomeAnalysis 어디에서도 read 0건. cycle 268의 useGameEngine buildProfile.tags AI snapshot dispatch는 별개로 보존.
- 345: scoreTag desc 매개변수 + 출력 dead — 8 호출 사이트의 한국어 desc 문자열 인자도 일괄 제거. tag.id/name/score/reasons 4 활성 필드 보존.
- 346: getJobOutfitAffinity totalSlots 출력 dead — OutfitAffinity interface에서도 제거. matchCount/bonus/label/tier/slots 보존.
- 347: scoreQuest score → _sortKey internal — 정렬용으로만 사용, 외부 read 0건 (cycle 333 _sortKey 패턴).
- 348: computeSignatureSetBonus activeSet 내부 atkMult/defMult/hpMult 3 duplicate dead — 부모 return에 이미 동일 필드 노출.
- 349: getSignatureSetProgress members/equippedMembers 2 출력 dead — 내부 const 변수는 totalMembers/missingMembers 계산용으로 유지.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 340 🎯 — CHANGELOG에 cycles 321-339 history 일괄 추가

- 마일스톤: cycle 320 batch 이후 19 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300 / 320에 이은 15번째 batch.
- 누적 마일스톤: cycle 320(unit 1606) → 330(unit 1642) → 339(unit 1680, +74 from cycle 320). silent dead config 시리즈 cycle 222→339 108번째 도달.
- 시리즈 정체성: 19 사이클 모두 cleanup lens — silent dead config 제거. 본 batch 핵심 lens 분기:
  · cycle 321-323: import 표면 batch cleanup (8+55+3 files).
  · cycle 324-329: dead module/method 제거.
  · cycle 330-339: cycle 310 FocusPanel 제거 cascade — adventureGuide 5+ 출력 필드 + 의존 surface 정리.

검증: tsc 0 / unit 1680 / lint clean / build-guard ok.

---

## Cycle 333-339 — Function output field dead cleanup 시리즈 7사이클 (cycle 310 cascade)

cycle 310 (FocusPanel orphan 제거) 이후 adventureGuide / outcomeAnalysis / synthesisUtils / enhancementUtils 등 helper 함수의 출력 필드가 외부 read 0건으로 cascade dead. 7 사이클 연속 정리.

- 333: getMoveRecommendations 4 출력 필드 (score/isSafeTarget/isVisited/isBoss) — score는 _sortKey internal로 변경. 활성: name/badge/reason/levelLabel/chips/undiscoveredSignatureCount/isRecommended.
- 334: getQuestTracker.detail (claimable + active 분기 모두) + getExplorationForecast.description (4 분기) — read 0건 메타데이터.
- 335: getMapPacingProfile.note 5회 (safe/boss/volatile/hostile/frontier 분기) — pacing 메모 노출되지만 read 0건.
- 336: getPostCombatAnalysis hpRatio / mpRatio 출력 — 내부 grade/notes/actions 분기 계산용으로만 사용, 외부 read 0건.
- 337: getEnhanceAvailability materialCount 5회 출력 — material 부족 분기 내부 계산용 const는 유지, 출력 필드만 제거.
- 338: validateSynthesis 성공 분기 type 출력 — read 0건. CraftingPanel은 outputs/goldCost/successRate/tier만 사용.
- 339: getSynthesisGroups rarity 출력 필드 + getItemRarity cascade import 정리 — group.rarity read 0건이라 그 import도 cascade dead.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 330-332 — getAdventureGuidance cascade dead 시리즈 3사이클 (cycle 310 paired)

cycle 310 FocusPanel 제거의 직접 cascade로 adventureGuide 메타 surface 일괄 정리.

- 330: SignalBadge 'signature' tone class — cycle 23 시점 FocusPanel `'확률 증폭'` emphasis surface용으로 도입했지만 cycle 310 cascade dead.
- 331: getAdventureGuidance emphasis 11회 (진행 우선 / 즉시 이득 / 성장 분기 / 안정 우선 / 정화 우선 / 정리 권장 / 확률 증폭 / 목표 설정 / 위험 / 현상수배|임무 진행 / 다음 지역|전진) — read 0건 일괄 cleanup.
- 332: getAdventureGuidance secondaryAction 11회 + mpRatio 변수 cascade dead — secondaryAction read 0건 + mpRatio는 'MP도 회복' 분기 외 read 0건.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 324-329 — Dead module / method / field cleanup 시리즈 6사이클

다양한 곳의 dead surface batch 정리.

- 324: firebase.ts `app` dead export 제거 — import 0건. auth/db/hasFirebaseConfig만 active.
- 325: SoundManager 'hover' case dead branch 제거 — sound dispatch 0건이던 case + cycle 134/220 lock test 동기 갱신.
- 326: TokenQuotaManager.getRemainingCalls dead method — 외부/내부 호출 0건.
- 327: JOB_TYPICAL_LOADOUT dead data export + paired test cleanup — cycle 43-46 outfit affinity 표시용 13 직업 매핑 데이터, dispatch 미구현.
- 328: BossPhase type private downgrade — phase2/phase3 필드 타입으로만 사용, 외부 import 0건.
- 329: useGameTestApi 3 dead methods (getState / clearPostCombat / injectAscensionPreview) — scripts/, tests/, docs 어디에서도 호출 0건.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 321-323 — Import 표면 batch cleanup 시리즈 3사이클

unused import 일괄 정리. 단일 cycle 최대 파일 갯수 (cycle 322 55 files) 포함.

- 321: 8 files 10 unused imports 일괄 cleanup — equipmentUtils Player, Codex BALANCE+MSG, CombatEngine LOOT_TABLE+DROP_TABLES, messages.ts DB, MonsterCodex Lock, CodexDiscoveryOverlay MSG, EquipmentCodexCard BALANCE, WeaponCodex BALANCE.
- 322: **55 files unused React default import** 일괄 정리 (단일 cycle 최대 파일 갯수). tsconfig "jsx": "react-jsx" automatic runtime 덕분에 React.X 사용 0건이면 default import 불필요.
- 323: 3 leftover unused imports (cycle 321/322 paired) — exploreUtils Monster, SkillTreePreview RefreshCw, Codex Shield 잔존.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 320 🎯 — CHANGELOG에 cycles 301-319 history 일괄 추가

- 마일스톤: cycle 300 batch 이후 19 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276 / 300에 이은 14번째 batch.
- 누적 마일스톤: cycle 300(unit 1527) → 310(unit 1560) → 319(unit 1600, +73 from cycle 300). unit test 1600 milestone 도달.
- 시리즈 정체성: 19 사이클 모두 cleanup lens — silent dead config 제거 (cycle 222 시작 시리즈 89번째까지 도달). 본 batch 가장 큰 lines 감소: cycle 310 (511 lines), cycle 309 (41 lines RemoteConfigLoader), cycle 311 (47 lines adventureGuideActions cascade) 합 ~600 lines 정리.

검증: tsc 0 / unit 1600 / lint clean / build-guard ok.

---

## Cycle 315-319 — Hooks/types unused dep & import cleanup 시리즈 5사이클

hook factory 파라미터, util private downgrade, type import 정리. 표면 축소 위주.

- 315: moveActions / ascensionActions 미사용 _shared 2nd 파라미터 제거 — 두 factory 모두 shared 헬퍼 미사용. useGameActions 호출 사이트도 1-arg로 갱신 (TS strict).
- 316: addItemToInventory export → private (addItemByName 내부 1회 사용만).
- 317: EMPTY_TEMP_BUFF export → private (playerStateUtils 내부 2회 사용만).
- 318: getPoolKeyByLocation export → private (aiEventUtils 내부 3회 사용만). cycle 292 active-list 가드도 갱신.
- 319: 2 unused type imports cleanup — runProfileUtils (Monster/Player 미사용 barrel) + types/player.ts (ConsumableItem 미사용).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 311-314 — Cascade orphan & component-internal export cleanup 4사이클

cycle 310 paired completion + 작은 표면 정리.

- 311: adventureGuideActions.ts cascade orphan 제거 (47 lines) — cycle 310의 FocusPanel 제거로 유일 consumer 사라진 module.
- 312: anchorPoints WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS export → private (helpers 내부 사용만).
- 313: QuestRewardChips export → private (QuestTab 내부 1회 JSX render만).
- 314: moveActions 미사용 addStoryLog dependency 제거 + `void addStoryLog;` 자가-suppress 정리.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 308-310 — System / orphaned module 대량 cleanup 시리즈 3사이클

가장 큰 단일 cycle lines 감소 시리즈. 600+ lines 정리.

- 308: LatencyTracker 5 dead surface cascade cleanup — getStats 외부 0건이라 chain (getAverageLatency / recordLatency / recentLatencies / MAX_HISTORY) 모두 cascade dead. 활성 surface는 trackCall (slow-response 경고 + custom event)만 보존.
- 309: RemoteConfigLoader dead module 제거 (41 lines) + REMOTE_CONFIG_ENABLED 상수 cascade cleanup. fully-orphaned Firestore 게임 config loader.
- 310: 2 orphaned components 511 lines 제거 (단일 cycle 최대): Bestiary.tsx (307 lines, mount 0건) + dashboard/FocusPanel.tsx (204 lines, mount 0건). 빈 dashboard/ 디렉토리 제거. obsolete 테스트 3건 cleanup.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 304-307 — DB / state / return surface dead cleanup 시리즈 4사이클

reducer state field, DB wrapper key, hook return 표면의 dead 정리.

- 304: DB wrapper 2 dead keys (LOOT_TABLE / DROP_TABLES) — 모든 consumer가 data/loot.js / data/dropTables.js 직접 import. cycle 181 lock test 8→6 keys 갱신.
- 305: publicGraves dead state 제거 — INITIAL_STATE [] 외 SET 0건, INVADE_GRAVE filter는 항상 [] no-op.
- 306: state.version dead 제거 — Firebase sync는 매 save마다 CONSTANTS.DATA_VERSION 직접 기록 (state.version 의존 없음).
- 307: useGameEngine top-level leaderboard return dead 제거 — actions.leaderboard channel만 SystemTab에서 사용.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 301-303 — Reducer type alias / component dead surface cleanup 3사이클

- 301: 2 reducer type aliases 제거 — actionTypes.ActionType / gameStates.GameState (state shape gameReducer.GameState와 명칭 충돌 해소).
- 302: ACTION_PRESENTATION (controlPanelConfig) dead + TYPE_COLORS (SkillTypeIcon) re-export 제거.
- 303: isE2ERuntime / measurePerf private downgrade — 동일 파일 내부 1회 사용만.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 300 🎯 — CHANGELOG에 cycles 277-299 history 일괄 추가

- 마일스톤: cycle 276 batch 이후 23 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259 / 276에 이은 13번째 batch.
- 누적 마일스톤: cycle 276(unit 1423) → 290(unit 1489) → 299(unit 1527, +104 from cycle 276).
- 시리즈 정체성: 23 사이클 모두 cleanup lens — silent dead config (정의되어 있으나 dispatch / 사용 0건) 제거. cycle 222 시작된 silent dead config 시리즈가 70번째 (cycle 299)까지 도달.

검증: tsc 0 / unit 1527 / lint clean / build-guard ok.

---

## Cycle 295-299 — Type/util private downgrade 시리즈 5사이클 (export 표면 축소)

타입/유틸 정의가 export 되어 있지만 외부 import 0건인 dead surface 5사이클 연속 정리. 동일 파일 내부 union 구성/내부 호출만 사용하는 이중 노출 표면 cleanup.

- 295: jobOutfitAffinity 4 type exports → private (AffinityTier / AffinityBonus / OutfitAffinity / ItemLike — 모두 동일 파일 내부 union 구성용).
- 296: getSynthesisOutputs export → private (validateSynthesis / performSynthesis 내부 2회 사용만).
- 297: getExploreState export → private (explorationPacing 내부 4회 사용만 — getNarrativeEventChance / getQuietExplorationChance / getDiscoveryOdds / advanceExploreState).
- 298: 5 type exports → private (item.ts WeaponItem / ArmorItem / ShieldItem / EquipmentItem + monster.ts BossMonster — Item / Monster union 구성 전용).
- 299: player.ts 8 sub-interface exports → private (PlayerStats / PlayerCodex / SkillLoadout / TempBuff / PlayerMeta / CombatFlags / SeasonPassState / WeeklyProtocol — Player composition 전용). 4 기존 테스트 regex `(?:export )?` 패턴으로 호환 갱신.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 290-294 — Util export private downgrade 시리즈 5사이클 (cleanup lens 연속)

util 함수/상수가 export 되어 있지만 외부 사용 0건인 dead surface 정리. 함수 시그니처 단순화도 포함.

- 290: applyItemPrefix options 매개변수 dead 정리 — chance / force 분기 정의돼 있지만 호출 사이트 (CombatEngine.loot.ts × 3) 모두 인자 1개. options 파라미터 제거 + BALANCE.ITEM_PREFIX_CHANCE 직접 사용.
- 291: 2 util private downgrade — updateStats (incrementStat 내부 사용만) / getWeaponEquipScore (getEquipmentProfile 내부 사용만).
- 292: normalizeText export → private (aiEventUtils 내부 14회 사용만).
- 293: getAllItems export → private (findItemByName 내부 1회 사용만).
- 294: itemVisuals 3 exports → private (getMaterialVisualKey / IMAGEGEN_ITEM_PNG_KEYS / getItemIconAssetExtension — 모두 동일 파일 내부 1회 사용만).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 285-289 — Data dead export 제거 시리즈 5사이클 (대량 cleanup 포함)

data/ 정의 중 dispatch 0건이거나 cycle 271 dispatch cleanup 후 잔존한 dead data를 5사이클 연속 정리. 가장 큰 단일 cleanup인 cycle 289 포함.

- 285: PREMIUM_FREE_SOURCES + RELIC_WEIGHTS dead/private cleanup — premium shop / relic pool 가중치 데이터.
- 286: CODEX_MILESTONES export downgrade — private const (consumer 내부 사용만).
- 287: INITIAL_SEASON_PASS dead export 제거 — gameReducer.ts:52에 inline 정의되어 있어 dead duplicate.
- 288: artPalette.ts 6 dead exports cleanup (대량) — ART_GRID / LIGHT_DIRECTION / OUTLINE_POLICY / SILHOUETTE_RULES / REFERENCE_ACCENTS 5 dead + DEFAULT_TONE_KEY private downgrade. art direction 메타정보 — 문서 커멘트로 충분.
- 289: CLASS_BUILD_IDENTITIES dead data 제거 (~145 lines, cycle 271 paired) — 18 직업의 빌드 정체성 매핑이 cycle 271에서 4 consumer 함수 cleanup 이후 잔존하던 가장 큰 단일 dead 데이터 블록. 파일 292 → 146 lines (50% 감소).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 280-284 — Type cleanup 시리즈 5사이클 (player/monster/item types)

types/ 디렉토리의 dead 필드/타입 별칭 5사이클 연속 정리. cycle 277/278/279 runtime cleanup의 paired completion + types alias dead.

- 280: PlayerStats 타입의 2 dead 필드 cleanup — comboCount / discoveries (CombatFlags의 active comboCount는 별개 — set/read 분리). cycle 83/84 deprecated된 discoveries는 visitedMaps.length로 통일.
- 281: PlayerMeta 타입의 totalPrestige 3 dead 필드 cleanup (cycle 277 paired) — totalPrestigeAtk/Hp/Mp runtime cleanup paired completion.
- 282: Player.signaturePity / SignaturePity interface dead cleanup — top-level 필드 access 0건. active dispatch는 player.stats.signaturePity (nested, number).
- 283: Monster 타입의 9 dead 필드 cleanup (3 interfaces) — MonsterBase: elem/dropTable/prefix/signatureDrops, BossPhase: atkMult/defMult/skills, BossMonster: phases (array)/onDeath. 활성은 phase2/phase3 singular.
- 284: types/item.ts ItemType + types/map.ts MapType / isSignatureZone dead — type aliases 0 import + map 필드 0 read.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 277-279 — Stats output dead 필드 cleanup 시리즈 3사이클

stats / meta 출력 필드 중 dispatch 또는 read 0건인 dead 필드 3사이클 연속 정리. UI/runtime 단순화.

- 277: meta.totalPrestige 3 dead 필드 cleanup — totalPrestigeAtk/Hp/Mp runtime read 0건 (saved 데이터 잔존이지만 access 안 함).
- 278: stats.killStreakTier dead 필드 cleanup — 계산되지만 어디서도 read 0건 (display 안 함).
- 279: stats 출력에서 3 dead 필드 cleanup — weaponHands / traitBonus / titlePassive (statsCalculator computeFullStats 출력하지만 consumer 0건).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 276 🎯 — CHANGELOG에 cycles 260-275 history 일괄 추가

- 마일스톤: cycle 259 batch 이후 16 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240 / 259에 이은 12번째 batch.
- 누적 마일스톤: cycle 259(unit 1348) → 270(unit 1398) → 275(unit 1423, +75 from cycle 259).

검증: tsc 0 / unit 1423 / lint clean / build-guard ok.

---

## Cycle 272-275 — Story 템플릿 dispatch 시리즈 4사이클 마무리

aiService.getFallback의 8 스토리 템플릿 중 4종(levelUp / bossPhase2 / questComplete / ruinRecap)이 dispatch 0건이던 silent narrative gap. 4사이클로 모두 활성화 — 8 템플릿 전부 dispatch 보장.

- 272: 'questComplete' dispatch — completeQuest에 addStoryLog 추가. createInventoryActions deps에 addStoryLog 추출.
- 273: 'bossPhase2' dispatch — combatAttack가 phase2Triggered transition 감지 (prev false → new true) 후 호출.
- 274: 'levelUp' dispatch — combatVictory가 victoryResult.leveledUp boolean 감지 후 호출.
- 275: 'ruinRecap' dispatch — 사망 3 경로 (combatAttack 사망 / combatAttack 도주실패 사망 / combatItem 사망) 모두에 'death' 직후 추가. 시리즈 마무리.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 267-271 — Cleanup lens 시리즈 5사이클 (대량 dead 코드 제거)

이전 사이클들이 dispatch 누락 fix 위주였다면, 이 시리즈는 반대 방향 — 정의되었지만 dispatch 0건인 dead 필드/함수 제거. 코드베이스 단순화.

- 267: getTraitProfile의 skillLabel 필드 제거 (dispatch 0건, 컴포넌트는 trait.skill 직접 접근).
- 268: getRunBuildProfile의 secondary 필드 제거 (ranked.slice(1, 3) 계산되지만 consume 0건).
- 269: CombatPanel 보스 signature/counterHint UI dispatch — getEnemyTacticalProfile 14+ 필드 중 dispatch 0건이던 in-combat 핵심 정보 추가.
- 270: getEnemyTacticalProfile의 12 dead 필드 cleanup — role/tier/guardChance/heavyChance/estimatedHit/estimatedHeavy/weakness/resistance/rewardHint/warningChips/recommendedBuilds/phaseTriggered. 사용 5종(hint/entryHint/phaseHint/signature/counterHint)만 보존.
- 271: 4 dead exports + 부수 imports cleanup — getClassBuildIdentity / getClassBuildCompatibility / getClassBuildBonus / getRunDiagnostics (미완성 diagnostics 기능, ~70 lines + 2 dead tests). 파일 순감소 49 lines.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 264-266 — Equipment / liveConfig 시리즈 3사이클

- 264: 방패 강화(enhance) DEF 기여 누락 — ENHANCE_ITEM이 offhand shield enhance 카운터 +1 처리하지만 statsCalculator computeEnhanceBonus가 offhand 무기로 가정하고 atk × 0.5만 dispatch. 방패 빌드(나이트/팔라딘)가 강화해도 def +0이고 부정확한 atk 가산만 받던 회귀. isShield 분기 처리.
- 265: liveConfig.seasonEvent / eventMultiplier 보너스 dispatch 누락 — **가장 큰 player-facing UX 회귀**. GameRoot 배너에 "골드+30% XP+50%" 광고하지만 src/ 어디에도 dispatch 0건. SystemTab admin eventMultiplier 슬라이더도 dead. handleVictory에 4번째 liveConfig 인자 추가, 3 call sites threading.
- 266: liveConfig.announcement UI dispatch — admin이 SystemTab에서 prompt로 설정 가능하지만 src/ 어디에도 render 안 됨이라 admin 도구 dead. GameRoot에 announcement 배너 추가 (cycle 265 paired completion).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 260-263 — META preserve / fallback chain 시리즈 4사이클

cycle 199/201 prestigeRank/seasonTier checkTitles fallback 시리즈의 paired completion으로 explicit-grant 칭호 4종 모두 복구 보호 lock. 추가로 sensory cue gap 마무리.

- 260: questReward title fallback (cycle 199/201 paired) — 5종 quest reward 칭호 (152/153/154/201/202)가 player.titles 손실 시 영구 복구 불가던 회귀. stats.claimedQuestIds 영구 ledger 도입 + checkTitles handler. 5-file refactor (INITIAL_STATE / completeQuest / checkTitles / migrateData / ASCEND+RESET_GAME preserve).
- 261: claim 액션 sensory cue paired completion (cycle 122-123 패턴) — claimWeeklyMission sound 0건, SeasonPassPanel claimReward addLog/sound 모두 0건이던 UX dead path. claimSeasonReward 신규 action + Dashboard wiring.
- 262: cosmetic title fallback (cycle 199/201/260 시리즈 마무리) — 4 cosmetic titles의 영문 ↔ Korean id 매핑 + stats.cosmeticTitles ledger 검증. checkTitles fallback 시리즈 4종 explicit-grant 칭호 모두 보호 완료.
- 263: 'critical' 로그 타입 sensory cue 누락 — useGameEngine lastLog 사운드 매핑이 5종만 처리, 'critical' 누락이라 크리티컬 hit이 무음. 일반 공격은 attack 사운드 vs 강화된 hit이 약화된 hit처럼 들리던 회귀. 'critical' → 'attack' 매핑 추가.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 259 🎯 — CHANGELOG에 cycles 241-258 history 일괄 추가

- 마일스톤: cycle 240 batch 이후 18 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221 / 240에 이은 11번째 batch.
- 누적 마일스톤: cycle 240(unit 1245) → 250(unit 1302) → 258(unit 1348, +103 from cycle 240).

검증: tsc 0 / unit 1348 / lint clean / build-guard ok.

---

## Cycle 256-258 — Weapon skill preset coverage + drain ratio 정합 시리즈 3사이클

- 256: WEAPON_SKILL_BY_ELEM의 '바람' / '에테르' preset 누락 dead config — 폭풍의 창(바람) / 에테르 검·차원절단자(에테르)가 fallback '아케인 볼트'에 떨어져 element 정체성 dispatch 0이던 회귀. '게일 컷' / '디멘션 리프트' preset 추가.
- 257: skill drain effect의 drainRatio dispatch + 데이터 정합 dead config — '혼의 흡수' (desc 30%) / '흡혈의 낫' (desc 35%)이 hardcoded 25% 흡수율 적용되던 desc-data 모순 fix. CombatEngine에 skill.drainRatio 우선 read 추가 + 2건 데이터 정합.
- 258: '강화 흡수' branch drainRatio 누락 (cycle 257 paired) — desc "데미지 및 흡수량 +30%" 광고하지만 mult만 +30%이고 drainRatio default 0.25 그대로던 회귀. branch override drainRatio: 0.325 추가.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 251-255 — Monster element typo 시리즈 5사이클 마무리

cycle 223 (items elem '얼음' → '냉기') 패턴 monsters 측 audit. items.ts elem과 매칭 안 되던 monster weakness/resistance 13건 element 표준 통일 — getElementMultiplier 매칭 실패로 ELEMENT_WEAK_MULT / ELEMENT_RESIST_MULT 영원히 미적용이던 silent 회귀.

- 251: weakness '불꽃' → '화염' 6 monsters (구름 정령 / 익사한 기사 / 살아있는 마법서 / 잉크 슬라임 / 책의 정령 / 독 지네).
- 252: resistance '불꽃' → '화염' 2 monsters (분노한 마구스 / 사기꾼 마법사) — paired completion.
- 253: resistance '독' → '자연' (독 지네) + '비전' → '에테르' (차원 분열자 boss) 2건.
- 254: resistance '물' → '냉기' 2 monsters (강의 요괴 / 저주받은 어부) — water-themed → ice/cold thematic.
- 255: '번개' → '빛' 5건 + '마법' → '에테르' 2건 (시리즈 마무리).

monsters.ts 내 weakness/resistance 모든 값이 items elem과 정합 보장.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 250 — stats.activeSet (prefix-based items 세트) UI dispatch dead config

items.ts sets[] 7종 prefix-based 2세트 보너스 ('불타는' 화염의 결속 ATK +10% 등)가 statsCalculator에서 stats.activeSet에 합산되지만 components 검색 시 read 0건 — 'activeSignatureSet'만 StatsPanel에 render되고 일반 prefix 세트는 영원히 UI invisible이던 silent 회귀. cycle 245 패턴 동일 (data → util → struct → UI 4단계 중 마지막 surface 끊김).

수정: StatsPanel.tsx에 activeSet block 추가 (Sparkles + prefix 이름 + desc, amber-300 톤). 미정의 시 미표시 (silence over noise).

검증: tsc 0 / unit 1302 / lint clean / build-guard ok.

## Cycle 248-249 — TITLES vs TITLE_PASSIVES 정합 11건 누락 dead config

cycle 209 한글-id quest reward TITLES 등록 후 TITLE_PASSIVES 미반영이던 paired data follow-up.

- 248: abyss endgame 3종 (void_conqueror floor 100, abyss_legend 200, void_sovereign 300) — 가장 어려운 endgame 활성화 시 0 stat이던 보상 fake. 점진 강화 ATK +3/+5/+7 추가.
- 249: 시즌 패스 3종 (시즌 선구자/정복자/마스터, tier 10/20/30) + quest reward 5종 (에테르 탐험가 / 공허의 방랑자 / 종말의 정복자 / 지도 제작자 / 전설의 기록자) 패시브 추가. 한글-id는 영문-id (cartographer, legend_chronicler) 미러.

cosmetic 4종 ('별을 보는 자' 등)은 의도된 0 보너스 유지 (premium 구매 cosmetic).

검증: tsc 0 / unit 1296 / lint clean / build-guard ok.

## Cycle 245-247 — UI dispatch / 데이터 정합 시리즈 3사이클

- 245: BOSS_BRIEFS warningChips/recommendedBuilds UI dispatch — ~25 보스에 정의된 위협 키워드/추천 빌드가 runProfile struct까지 흐르지만 Bestiary/MonsterCodex가 signature/counterHint/phaseHint만 render하고 두 필드는 UI 0건이던 silent UX 회귀. 두 컴포넌트에 칩 그룹 2개 추가.
- 246: MAPS graveDropBonus 필드 dead config — '영혼의 강' 지역만 graveDropBonus 2.0 정의 (lore: "묘비 아이템이 자주 발견됩니다")하지만 buildGraveData가 read 0건이던 회귀. graveUtils에 MAPS import + dropBonus 적용 (gold/dropCount 양쪽).
- 247: skill branch override desc-data 정합 2건 — 무당 '지속 저주' (curseTurn 3 = default와 동일이라 +0 효과) → 5로 변경, 아크메이지 '심판의 천벌' (effect 'purify' 미포함이라 stunTurn 미적용) → effect 'stun' 추가.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 241-244 — Skill branch override 키 시리즈 4사이클

cycle 238/239 fix 연속 — skill branch override가 정의했지만 dispatch 0건이던 키 추가 audit.

- 241: skill.stunTurn dispatch — 마법사 '마비 번개' (stunTurn 2)가 desc "기절 2턴" 광고하지만 hardcoded 1턴만 적용되던 회귀. effect 'stun'/'freeze' 부여 시 stunnedTurns max 처리.
- 242: stats.critChance dispatch + skill.crit branch override — **시리즈에서 가장 큰 영향**. statsCalculator finalCritChance가 equipment/relic/심연/칭호/시너지/킬스트릭 critBonus 모두 합산 → SystemTab에 표시만 되고 실제 attack/skill에는 dispatch 0건. 도적 '치명 특화' (crit 0.7) / 어쌔신 '치명 암살' (crit 0.95) branch도 미적용. 모든 crit 보너스 fake → 진짜 적용.
- 243: skill.mpRestore branch override — 시간술사 '시간 충전' branch (mpRestore 30)가 ATK 페널티 없이 추가 행동만 부여되던 OP 상태 fix.
- 244: skill.curseTurn override — '지속 저주' branch 의도 dispatch.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 240 🎯 — CHANGELOG에 cycles 222-239 history 일괄 추가

- 마일스톤: cycle 221 batch 이후 18 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200 / 221에 이은 10번째 batch.
- 누적 마일스톤: cycle 220(unit 1162) → 230(unit 1208) → 239(unit 1245, +83 from cycle 220).

검증: tsc 0 / unit 1245 / lint clean / build-guard ok.

---

## Cycle 236-239 — Synergy bonus / skill branch override silent dead config 시리즈 4사이클

- 236: 2 synergy bonus keys dead config — entropy_god의 fixedDmg(매 턴 15% maxHp 고정 피해)와 annihilator/void_dragon의 killStack(처치 시 누적 가속)이 dispatch 0건이던 회귀. applyEntropyTick + handleVictory 양쪽 확장.
- 237: primordial_wrath 시너지 critChance 0.25 dead config — 마지막 unhandled synergy bonus key. applySynergyBonuses + finalCritChance 합산.
- 238: skill branch override 'defBonus' 키 dead config — '분노의 방패' / '철벽 배시' branch가 DEF +20% 광고하지만 코드가 read 안 해 0이던 silent 회귀.
- 239: skill branch override 'effectChance' 키 dead config — '기절 배시' (20% 확률) / '혼란 찌르기' (40% 확률) branches가 100% status 부여하던 OP 회귀. Math.random() 게이트.

cycle 222-229 silent dead config 시리즈와 같은 lens, 12-15사이클 연속 silent dead config / orphan content fix 마무리.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 233-234 — Class weapon / armor coverage orphan content fix

- 233: 8 classes의 weapon 사용 가능 baseline 5+로 확장. 3 zero-weapon classes(성직자/드래곤 나이트/무당)가 '맨손' 외 무기 장착 불가하던 player-facing 회귀 fix. 11개 weapons의 jobs[] 확장.
- 234: 8 classes의 armor 사용 가능 baseline 5+로 확장 (cycle 233 follow-up). 4 zero-armor classes(성직자/드래곤 나이트/무당/시간술사)가 천옷 외 armor 장착 불가하던 회귀. 16개 armors의 jobs[] 확장.

cycle 231 unreachable T3 classes 후속 회귀 정합성 lock — 18 classes 모두 weapon/armor 5+ playable 보장.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 230-232, 235 — Test determinism + dead reward chain fix

- 230: cycle 156 absolute_reflect 테스트 RNG flake — enemy.pattern 미설정 시 default guardChance 0.2가 20% 확률로 reflect 분기 차단하던 RNG 흔들림 결정론화.
- 231: 3 T3 classes (드래곤 나이트 / 대마법사 / 그림자 주군) 도달 불가 회귀 — 5 T2 부모(나이트/버서커/아크메이지/흑마법사/어쌔신)의 next: []이라 jobChange 영원히 unlock 불가. T2 → T3 progression 5건 추가.
- 232: relicShards 5/5 conversion 메커니즘 — UI에 'X/5 조각' 표시되지만 5개 도달 시 변환 코드 0건이던 dead reward chain. applyDailyProtocolProgress 5+ shards 시 1 random 유물 자동 변환 (cap 도달 시 보존).
- 235: cycle 229 spell_stack 테스트 RNG 분산 flake — DAMAGE_VARIANCE ±10%가 +20% bonus를 깨버리던 흔들림. max stack(+60%) vs stack 0 비교 + 50회 sampling으로 안정화.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 227-229 — Monster / phase / relic effect dead config 3사이클

- 227: 27 monsters의 statusOnHit dead config — 슬라임/화염 비룡/서리 마법사 등이 정의한 statusOnHit (poison/curse/burn/freeze)이 dispatch 0건. heavy hit 시 발동하도록 추가 + status_resist relic 가드.
- 228: 8 phase3 bosses의 defBonus dead config — 종말의 마왕/절대 공허 등 8개 phase3 보스가 defBonus 10-40 정의했지만 enemyAttack의 phase3 전환에서 atkBonus만 적용되던 'last stand' 강화 의도 절반만 발현 회귀.
- 229: 'spell_stack' relic effect dead config — spell_weaver legendary가 스킬 연속 사용 시 +60% 데미지 누적 메커니즘이 영원히 0이던 회귀. cycle 148 baseline 0 달성 lock.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 222-226 — Item field silent dead config 5사이클

- 222: Sprint 21 신규 무기 5종(세계수의 검 / 신전 도시의 지팡이 / 균열의 날 / 세계수 절멸창 / 시간 파편 소드) armors 버킷 오배치 — WeaponCodex weapons 카테고리에서 영원히 미발견되던 회귀. 정확한 weapons 버킷으로 이동.
- 223: 3 cold-themed items의 elem '얼음' → '냉기' 표준 통일 — 39 monsters의 weakness='냉기'와 비매칭이라 ELEMENT_WEAK_MULT 적용 0이던 silent gameplay 회귀.
- 224: 4 mage items의 mpBonus 필드 dead config — 빙결 지팡이 / 빙하의 지팡이 / 상급 폭풍 로브 / 차원의 로브가 desc_stat에 'MP+N'을 표시하지만 equipmentUtils가 mp 필드만 read해 합계 +150 MP 누락. getItemMpContribution 헬퍼 추가.
- 225: 2 armors의 hpBonus 필드 dead config — 용암 판금갑 / 용비늘 갑주가 desc_stat에 'HP+80'/'HP+150'을 표시하지만 실제 maxHp 변화 없던 silent 회귀. getItemHpContribution + statsCalculator 합산.
- 226: 2 armors의 evasion 필드 dead config — 도적/어쌔신용 armor 2종이 desc_stat '회피+8%/12%'를 표시하지만 dispatch path 0건이던 silent 회피 패시브 회귀. CombatEngine.enemyAttack에 회피 roll 추가 (stealth 후순위).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 221 🎯 — CHANGELOG에 cycles 201-220 history 일괄 추가

- 마일스톤: cycle 200 batch 이후 20 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190 / 200에 이은 9번째 batch.
- 누적 마일스톤: cycle 188(unit 1000+) → 200(누적 200 사이클) → **220(unit 1162, +115)**.

검증: tsc 0 / unit 1162 / lint clean / build-guard ok.

---

## Cycle 217-220 — Sensory cue 시리즈 (defined-but-undispatched sound 4건 보강)

- 217: 레벨업 sensory cue — applyExpGain이 visualEffect='levelUp' set하지만 MainLayout(shake만 처리) + log type mismatch로 audio/visual 둘 다 dead path. useGameEngine에 visualEffect-watching useEffect 추가 → soundManager.play('levelUp').
- 218: 사망 / 보스 처치 sensory cue — death sound (descending 400→100Hz) + victory sound (5-tone arpeggio) 정의 있으나 dispatch 0건. combatAttack/combatItem GS.DEAD path + combatVictory isBossKill 분기에 dispatch 추가.
- 219: 스킬 / 휴식 sensory cue — skill sound (sweep tone) + heal sound (ascending arpeggio) 정의 있으나 dispatch 0건. combatAttack performSkill 성공 후 + characterActions rest 성공 후 dispatch.
- 220: 탐험 sensory cue — explore sound (sine arc, subtle tick 0.16s gain 0.04) 정의 있으나 dispatch 0건. exploreActions validation 통과 후 dispatch. 잔여 dead sound는 'hover' 1건만 (button hover 빈도 너무 높아 의도적 보류).

cycle 117/118/122/123 sensory cue 시리즈 8번째 합류 — SoundManager 16종 중 dispatch path 존재 = 15종.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 211-216 — META preserve series (paired ledger 정합성 + exploit fix)

- 211: codexBonus 3종(Atk/Def/Hp)이 ASCEND/RESET_GAME 시 wipe되어 codexClaimed 재청구 차단과 paired ledger inconsistency → silent permanent stat 손실. 양 분기에 명시 보존.
- 212: signaturePity mercy 카운터가 handleDefeat은 보존하지만 ASCEND/RESET 시 wipe되어 cycle 75 anti-frustration 설계 무력화. 양 분기 보존으로 정합성 lock (3개 분기 정합).
- 213: 일일 bounty (bountyDate / bountyIssued) + dailyProtocol이 ASCEND/RESET 시 wipe → mid-day ASCEND로 일일 1회 제한 우회 (재발급 exploit). 양 분기 보존.
- 214: weeklyProtocol(주간 미션 진행/claimed ledger)이 ASCEND/RESET/handleDefeat 모두에서 wipe → 같은 주 재청구 + 진행도 손실. 3개 분기 모두 명시 보존 (cycle 191 누락분 보강).
- 216: dailyInvadeCount / lastInvadeDate(grave 일일 5회 제한 ledger)가 ASCEND/RESET 시 wipe → mid-day ASCEND로 5회 추가 침략 가능. 양 분기 보존.

cycle 119 / 188 / 191 / 202-205 / 211-216 META preserve 시리즈 — RUN-bound vs multi-run 분리 정합성 lock.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 208-210 — Dead config / dead grant fix series

- 208: useLegendaryDropDetector가 SEASON_XP.codexDiscover 미적립 — 4 quest reward + 4 event chain reward로 들어오는 signature가 시즌 XP 0건이던 dead config. codex prop 기반 alreadyInCodex 가드로 combatVictory 중복 award 방지하며 dispatch. cycle 193/196 패턴 마지막 path.
- 209: 5 quest reward.title이 완전 dead grant — cycle 192가 TITLES 등록만 하고 grant 경로(claimQuestReward) 미수리. claimQuestReward에 reward.title push 추가 + 누락 2 entry('지도 제작자' / '전설의 기록자') Korean-id 정식 등록.
- 210: dead duplicate GS / GameStateValue export from actionTypes.ts 제거 — 정식 source는 gameStates.ts. cycle 195/206/207 dead cleanup 패턴 5번째.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 215 — claimAchievement premiumCurrency dead reward fix (300 💎 회귀)

- 215: 5 영구 업적(ach_abyss_200/300, ach_sig_20/sig_set_all, ach_chain_all)이 합계 300 💎 premiumCurrency 보상을 silently drop. claimAchievement는 reward.gold/item만 처리하고 premiumCurrency 미처리 → 영원히 청구 불가하던 dead reward. cycle 209 quest reward.title 누락 패턴과 동일 lens.

검증: tsc 0 / unit 1134 / lint clean / build-guard ok.

## Cycle 202-207 — META preserve 초반 시리즈 + dead cleanup

- 202: claimedAchievements 영구 ledger 보존 — ASCEND가 claimedAchievements를 wipe하면서 kills/bossKills 등 unlock 카운터는 보존해 ASCEND마다 모든 업적 재청구 가능 exploit (gold/item/칭호 무한 획득).
- 203: ASCEND가 explores/rests/killRegistry/buildWins 4 영구 카운터 보존 — cycle 119 누락분. Bestiary/MonsterCodex/'방랑자'·'길잡이' title 진행도 wipe 회귀.
- 204: RESET_GAME META preserve — 사망 후 '다시 시작' 클릭이 cycle 191 META 보존을 즉시 wipe해 cycle 191이 사실상 dead-on-arrival이던 nullify 회귀. RUN 진행도만 reset, META 명시 보존.
- 205: handleDefeat가 areaBossDefeated를 per-RUN flag로 reset — ...prevStats spread로 보존되어 같은 area의 signature 영구 봉인되던 회귀. exploreUtils 주석 '이번 런 미처치 시 보장'과 정합.
- 206: dead meta.trueEndingFragments init 제거 — 진 엔딩 파편 메커니즘은 inv 기반으로 별도 구현. wire-up 안 된 v5.0 schema 잔해.
- 207: dead GS.FORMATION 제거 — 미구현 placeholder, 0건 참조.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 201 — checkTitles seasonTier handler

- 201: 시즌 패스 보상 칭호 3종(시즌 선구자/정복자/마스터)이 cond.type='seasonTier'로 cycle 175 등록되었지만 checkTitles에 'seasonTier' 분기 미구현. CLAIM_SEASON_REWARD 직접 grant는 정상이나 복구 케이스(저장 손실/migration) fallback 안전망 없음. cycle 199 'prestigeRank' 동일 패턴.

검증: tsc 0 / unit 1053 / lint clean / build-guard ok.

---

## Cycle 200 🎯 — CHANGELOG에 cycles 191-199 history 일괄 추가

- 마일스톤: 200 사이클 누적 도달. cycle 190 batch 이후 9 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170 / 190에 이은 8번째 batch.
- 누적 마일스톤: cycle 100(lint clean) → 145(quest item baseline 0) → 159(relic effect baseline 0) → 169(map monster baseline 0) → 188(unit 1000+) → **200(누적 200 사이클)**.

검증: tsc 0 / unit 1047 / lint clean / build-guard ok.

---

## Cycle 197-199 — PRESTIGE_TITLES 정합성 정리 시리즈

- 197: PRESTIGE_TITLES 10종(각성자~에테르의 신)이 ASCEND로 player.titles에 push되지만 TITLES 미등록 → getTitleDefinition undefined → 모든 prestige 칭호가 default 'text-cyber-purple'로 표시되던 visual UX 회귀. 10 Korean id 정식 등록(cond.type='prestigeRank') + 색상 차별화 (cyan→emerald progression). cycle 175(시즌)/cycle 185(cosmetic)/cycle 192(quest reward)와 동일 컨벤션 — 모든 specific cond.type 정식 TITLES 등록 완성 (총 20 신규 entries).
- 198: hasTemporaryAdventureState가 voidHeart 플래그를 'temporary'로 카운트해 cycle 187 clear preserve 변경 후 안전 맵 이동마다 무한 재호출 회귀. clear가 보존하는 플래그는 has도 미카운트로 일관성 lock.
- 199: checkTitles에 'prestigeRank' cond.type 핸들러 추가 — ASCEND newTitle 직접 grant 정상 케이스 외에도 복구 케이스(저장 손실/migration) fallback 안전망.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 193-196 — SEASON_XP.codexDiscover dead config 활성

- 193: SEASON_XP.codexDiscover (8 XP) 정의됐으나 dispatch 0건이던 dead config. countNewCodexEntries 헬퍼 추가 + combatVictory에서 신규 codex 등록 수만큼 dispatch.
- 194: abyss 'prestige_points' reward type이 dead currency. ABYSS_MILESTONE_REWARDS의 floor 75/200/500을 relic_choice/legendary_item으로 교체. combatBossHandlers 분기 + MSG.ABYSS_PRESTIGE_POINTS 제거.
- 195: dead BALANCE/CONSTANTS 키 6종 정리 (MILESTONE_KILLS / EXP_LEVEL_CAP_50 / RARITY_TIERS / RARITY_SELL_MULT / COSMETIC_TITLE_COST / SAVE_KEY) + 양방향 회귀 가드 (BALANCE.X / (BALANCE as any).X 패턴 모두).
- 196: codexDiscover dispatch를 useInventoryActions의 3 paths(shopBuy/craft/synth)로 확장. cycle 193 partial fix 완성.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 191-192 — Death/META 진행도 보존 + quest title 정식 등록

- 191: handleDefeat가 RUN 진행도(gold/inv/skillLoadout)는 reset해야 하지만 META 진행도(titles/activeTitle/premiumCurrency/reviveTokens/maxInv/seasonPass) 6종은 보존되어야 함 — INITIAL_PLAYER spread로 모든 자산 reset되던 잠복 회귀. cycle 119(6 영구 카운터)/cycle 188(ASCEND premium preserve) 패턴과 정합.
- 192: quest 152/153/154의 reward.title 3종(에테르 탐험가/공허의 방랑자/종말의 정복자)이 TITLES 미등록 → SystemTab default 색상 fallback. 정식 등록 + cycle 175/185 컨벤션 (Korean id, cond.type='questReward').

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 190 — CHANGELOG에 cycles 171-189 history 일괄 추가

- 문서: cycle 170 batch 이후 19 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160 / 170에 이은 7번째 batch. unit test 1000+ 마일스톤 (cycle 188에서 1002 달성).

검증: tsc 0 / unit 1005 / lint clean / build-guard ok.

---

## Cycle 185-189 — PremiumShop UX 회귀 정리 5사이클 시리즈

- UX/시스템: PremiumShop 4종(invExpand / synthProtect / revive / cosmeticTitles) 구매 흐름 전체에 걸친 잠복 회귀를 5 사이클 chain으로 정리.
- 185: cosmetic title 4종(별을 보는 자 / 공허를 걷는 자 / 에테르의 아이 / 세계의 끝)을 TITLES 정식 등록 + purchaseCosmeticTitle이 player.titles에 push 추가. 기존엔 stats.cosmeticTitles만 저장돼 SystemTab 디스플레이에서 invisible이던 "구매했지만 못 쓰는" UX 회귀.
- 186: reviveTokens / synthProtects 토큰 소비 로직 추가. reviveTokens는 applyFatalProtection death save chain에 새 fallback (void_heart 다음, phoenix_revive 전). synthProtects는 synthesize 함수에서 토큰 우선 소비. 기존엔 둘 다 dead purchase였음.
- 187: clearTemporaryAdventureState가 voidHeart run-wide 플래그 보존. 기존엔 안전 맵 이동만으로 voidHeartUsed가 false로 풀려 death save '런당 1회' spec 위반. applyBattleStartRelics와 일관성.
- 188: ASCEND가 premium 구매 자산 4종(stats.cosmeticTitles, stats.synthProtects, reviveTokens, maxInv) 보존. cycle 119 6 영구 카운터 패턴 확장. 환생 시 premium 구매 자산이 사라지던 회귀.
- 189: migrateData가 4 premium 자산 default 처리(reviveTokens / synthProtects 음수 정규화 + cosmeticTitles array 정합 + maxInv 음수 가드). 옛 save 호환.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 184 — quest target 도달 가능성 6건 batch + 가드 (cycle 164 follow-up)

- 콘텐츠: cycle 164가 quest target → MONSTERS keys 정합성 가드. 그러나 monster가 MONSTERS에 정의만 있고 spawn pool(monsters[] / bossMonsters[] / boss / ABYSS_BOSS_NAMES) 미참여면 spawn 안 함 → 진행도 영원히 0이던 잠복 회귀 6건 발견.
- 수정: 6 quest target 매핑 (105/106/107/108/109/150) — 에테르 방랑자→에테르 잔류체 / 차원의 포식자→차원 포식자 / 공허의 감시자→공허 감시병 / 허무의 기사→허무 집행관 / 에테르 심판자→에테르 드래곤 / 공허의 대행자→공허 집행관.
- 가드: spawn pool 도달성 lock — cycle 164(정의 존재) → cycle 184(spawn 도달) 두 단계 정합성.

검증: tsc 0 / unit 984 / lint clean / build-guard ok.

## Cycle 183 — 시즌 보스 2종 drop table 추가 (cycle 173 follow-up)

- 콘텐츠: cycle 173에서 추가된 봄의 여왕 / 서리 군주 보스가 dropTables.ts에 미등록 — cycle 171 보너스 드랍(25% tier 5/6 random)만 발동하던 큐레이션 부재.
- 수정: 자연 테마(봄의 여왕) / 얼음 테마(서리 군주) drop table 4 entry씩 추가. legendary tier 5 무기는 cycle 177 발견 체인 보상과 동일 매핑 reuse.

검증: tsc 0 / unit 982 / lint clean / build-guard ok.

## Cycle 181-182 — DB shape 가드 + 인벤토리 cap 정합 (cycle 179/180 lessons learned)

- 181: cycle 179/180 잠복 회귀(DB.ITEMS shape 가정 오류) 재발 영구 차단. DB shape lock 5 가드 — DB.ITEMS keys 정확히 7개, 각 array, src/ 화이트리스트(unknown 키 access 금지), DB.QUESTS/ACHIEVEMENTS array, DB.MAPS/MONSTERS/CLASSES keyed object.
- 182: 인벤토리 cap 검사가 player.maxInv (PremiumShop 확장 슬롯) 존중. exploreUtils chain reward + adventureGuide hint가 BALANCE.INV_MAX_SIZE만 사용해 확장 인벤(25)에서도 20에서 reward skip / 18에서 잘못된 경고 발동하던 회귀.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 179-180 — DB.ITEMS shape 잠복 critical 버그 2건 fix

- 179: combatBossHandlers.ts:92 '(DB.ITEMS).flat()' TypeError로 abyss 50/100/300층 milestone 처리 crash. DB.ITEMS는 object — '.flat()' 호출 불가. abyss 50층 이후 진행 끊기던 critical regression. 'Object.values(DB.ITEMS).flat()' 패턴으로 fix.
- 180: exploreUtils.ts:357 'DB.ITEMS?.allItems?.find()' silent miss. allItems는 미존재 필드 → 항상 undefined → cycle 177이 매핑한 DISCOVERY_CHAINS reward.item이 inv에 안 들어가던 회귀. findItemByName(getAllItems()) 사용으로 fix.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 175-178 — 데이터 정합성 잠복 회귀 4건

- 175: 시즌 패스 보상 칭호 3종(시즌 선구자 / 정복자 / 마스터)을 TITLES 정식 등록. SEASON_REWARDS에서 참조하지만 TITLES 미등록이라 cosmetic 라벨로만 보이던 inconsistency.
- 176: 'blindMap' challenge modifier 활성. 6종 modifier 중 5종은 핸들러 보유, blindMap만 silent no-op이던 dead modifier. StatusBar에 '???' 표시 분기 추가 + 모든 modifier 핸들러 가드.
- 177: DISCOVERY_CHAINS reward.item 3건(용의 숨결 / 영원의 빙결정 / 마왕의 인장) items.ts 미등록 → 기존 items로 매핑(용의 화염 / 빙결의 왕관검 / 마왕의 대낫). 정합성 가드.
- 178: eventChains 'info' reward type 핸들러 추가. ancient_prophecy chain의 reward.text 정보가 silent 누락이던 회귀.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 171-174 — baseline 시스템 후 발견된 잠복 회귀 4건

- 171: processLoot early-return 버그 fix. 'if (!lootList) return' 이 보너스 드랍 로직(고레벨 enemy tier 4-6 random)을 차단해 drop/loot 미등록 non-boss 104종이 빈손 회귀였음. early return 제거.
- 172: 'counter' 스킬 효과 추가 ('반격 자세' 마지막 dead skill effect). performSkill buff 분기 + enemyAttack 반격 발동 분기.
- 173: cycle 165 baseline의 boss/bossMonsters 누락 검출 보강 + 봄의 여왕 / 서리 군주 2 보스 추가. baseline 가드가 monsters[]만 검사해 잠복 회귀 발생.
- 174: QUESTS 중복 id 2건(99 / 95) fix. 두 번째 중복은 lookup find로 접근 불가하던 dead content. id 205 / 206 재할당. id 유일성 회귀 가드.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 170 — CHANGELOG에 cycles 161-169 history 일괄 추가

- 문서: cycle 160 batch 이후 9 사이클 미반영 상태 batch 정리. cycle 98 / 114 / 132 / 146 / 160에 이은 6번째 batch.

검증: tsc 0 / unit 934 / lint clean / build-guard ok.

---

## Cycle 165-169 — map.monsters[] → MONSTERS 정합성 baseline 42 → 0 달성 🎯

- 콘텐츠: maps.ts의 monsters[] 배열에 monsters.ts MONSTERS 객체 미등록 이름 42건 발견. spawnEnemy의 DB.MONSTERS[baseName] lookup이 미존재 시 weakness/resistance/multiplier/pattern/phase2 모두 미적용 — generic stat-blank 회귀. 게임은 진행되지만 속성 약점/저항 메커니즘이 작동 안 해 전투 깊이 축소.
- 165: KNOWN_MISSING_MAP_MONSTERS Set(42) baseline lock + 양방향 가드 + 화염/얼음 8종 batch (-8). cycle 141/148/164 baseline pattern 시리즈에 4번째 합류.
- 166: 언데드 5(망자의 사제 / 묘지 구울 / 유령 군단 / 해골 마법사 / 저주받은 기사) + 폭풍 3(뇌운 와이번 / 번개 정령 / 폭풍 그리핀) batch (-8).
- 167: 자연/꽃 4(봄의 정령 / 정원 요정 / 꽃 골렘 / 꽃잎 슬라임) + 공허 3(공허 감시병 / 공허 마법사 / 공허의 파편) + 동굴 박쥐 batch (-8).
- 168: 부패/타락 5(붕괴한 / 실험실 / 최후의 / 타락한 / 파멸의 수호자/용사/기사) + 실험실 3(생체 병기 / 오염된 연구원 / 폭주 자동인형) batch (-8).
- 169 🎯: 잔존 10종(바람 2 / 심연 1 / 에테르 2 / 종말 2 / 허무/혼돈 2 / 차원 1) final batch (-10). baseline = new Set([]) lock 달성.
- 결과: 모든 maps.ts spawn pool monster가 MONSTERS profile 보유. 속성 약점/저항/패턴/statusOnHit 메커니즘이 모든 enemy에 정확히 적용. 회귀 영구 차단.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 164 — quest/ach target → MONSTERS 정합성 10건 일괄 정리 + baseline 0 가드

- 콘텐츠: quests.ts target 필드에 monsters.ts MONSTERS 객체에 없는 이름 10건 사용 중 발견. 해당 퀘스트는 처치 진행도가 영원히 0 (target 이름이 실제 spawn enemy name과 매칭되지 않아). 가장 명백: '사막 도적' (공백) vs '사막도적' (실재 키, 공백 없음).
- 수정: 10건 batch perl 매핑 — 사막 도적 → 사막도적 / 가고일 → 유령 기사 / 고대 골렘 → 황금 골렘 / 그림자 암살자 → 다크 엘프 / 보물고 수호자 → 황금 골렘 / 빙결 정령 → 서리 정령 / 심해 대사 → 심연의 파수꾼 / 에테르 골렘 → 에테르 거인 / 죽음의 기사 → 타락 기사 / 차원 보행자 → 차원 보병.
- baseline 가드: cycle 141/148 양방향 가드 패턴 재사용 — 비-system target이 모두 MONSTERS keys 존재. SYSTEM_TARGETS whitelist 회귀 가드 동봉.

검증: tsc 0 / unit 912 / lint clean / build-guard ok.

## Cycle 161-163 — per-turn / 잔존 secondary 메커니즘 정리 (cycles 149-158 TODO)

- 시스템: cycle 148 baseline 0(cycle 159) 달성 후 effect string은 baseline 통과했지만 실제 동작이 부분적이던 잔존 메커니즘 정리.
- 161: tickCombatState에 3종 — 'genesis' healPerTurn 0.02 (창세의 핵 매 턴 회복) / 'eternal_fortress' regenPerTurn 0.08 (영원의 요새 시너지 매 턴 재생) / 'hp_drain_atk' hpCost (혈맹의 반지 / 심연의 계약 매 턴 HP 소모, hell_reaper 시너지가 cost 직접 대체).
- 162: applyFatalProtection / enemyAttack — 'phoenix_revive' atkBuff/duration tempBuff (불사조 부활 후 ATK +50% 3턴) / 'titan' critReduce 0.5 (타이탄 강타 -50%).
- 163: performSkill — 'cooldown_reduce' firstFree (시간 군주 첫 스킬 MP 무소비). combatFlags.firstSkillUsed 추적 + applyBattleStartRelics 매 전투 false 리셋.
- 결과: 의도된 빌드 path 활성 — 혈맹 ATK 35% / 심연 ATK 60%가 페널티 없이 지급되던 밸런스 누락 fix. hell_reaper "HP 소모 3% 감소" desc가 실제 동작. 영원의 요새 매 턴 +80 HP 재생으로 탱킹 빌드 가능.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

---

## Cycle 160 — CHANGELOG에 cycles 147-159 history 일괄 추가

- 문서: cycle 146 batch 이후 13 사이클 미반영 상태 batch 정리 (cycle 98 / 114 / 132 / 146에 이은 5번째 batch).

검증: tsc 0 / unit 895 / lint clean / build-guard ok.

---

## Cycle 148-159 — relic.effect 핸들러 baseline 34 → 0 달성 🎯

- 콘텐츠/시스템: 81종 unique relic effect 중 34종이 src/ 어디에서도 핸들러 등록 0건 발견. 신화/창세 tier 다수 포함된 큰 콘텐츠 갭. cycle 141 quest baseline pattern을 재활용해 12 사이클 점진 정리.
- 148: KNOWN_MISSING_RELIC_EFFECTS Set(34종) baseline lock + 양방향 가드(NEW dead 즉시 실패 / baseline 좁히기 강제). cycle 134(SoundManager) / 138(CONSTANTS·BALANCE) / 141(quest item) 회귀 가드 패턴 재사용.
- 149-152: 단순 passive multiplier 정리 — titan / genesis / hp_drain_atk / first_turn_evade / cooldown_reduce / elem_boost / on_hit_freeze / reflect_crit. statsCalculator.computeRelicBonuses 1-line 추가 패턴.
- 153 batch: 시너지 11종 effect-name dispatch — vampire_lord / arcane_surge / unbreakable / time_master / death_oracle / immortal_warrior / eternal_life / infinite_devour / absolute_immortal / blood_immortal / primordial_wrath. bonus-key fallback 보존.
- 154: defMult / chaosAtk / critDmg 시너지 — eternal_fortress / entropy_god / void_dragon. applySynergyBonuses 시그니처 확장 + finalDef 곱 인자.
- 155: time_dominator / arcane_singularity — 기존 cooldown_reduce / free_skill 유물 분기에 합산 합류. cycle 153 timeMasterSyn extraTurnChance 하드코딩 latent bug 동시 fix.
- 156: hell_reaper / annihilator / absolute_reflect — 기존 vampire_lord / execute_bonus / reflect 분기에 합산 합류.
- 157: phoenix_revive / devour_hp — applyFatalProtection void_heart fallback + handleVictory maxHp 영구 증가.
- 158: battle_start_buff / kill_stack_atk — applyBattleStartRelics tempBuff 적용 + combatFlags.killStackAtkBonus per-combat 누적. phoenixUsed 매 전투 리셋(런 1회 발동 버그 fix).
- 159 🎯: entropy_tick / entropy_brand — 신규 헬퍼 applyEntropyTick으로 turn-based DOT 통합. attack/performSkill 끝부분 호출. baseline 0 달성.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 147 — dead AT(action type) 6건 + 핸들러 일괄 정리 + 회귀 가드

- 정리: actionTypes.ts에 선언만 되고 dispatch 호출이 0건인 AT 키 6건 발견 (RESET_RUNTIME_UI / CLEAR_LOGS / SYNTHESIZE_ITEMS / SET_PREMIUM_CURRENCY / SET_CHALLENGE_MODIFIERS / SET_PUBLIC_GRAVES). uiHandlers / rewardHandlers / multiplayerHandlers의 핸들러도 dead 상태였음. 일괄 제거.
- 가드: 양방향 회귀 가드 — 모든 AT.X가 src/ 어딘가에서 dispatch되어야 함, 핸들러 등록 키도 AT 정의에 존재해야 함 (string typo 가드). cycle 134(SoundManager) / 138(CONSTANTS·BALANCE) / 141(quest reward.item) / 148(relic.effect) 회귀 가드 패턴 시리즈에 합류.
- 부수: uiHandlers.ts에서 더 이상 GS import 불필요해 제거.

검증: tsc 0 / unit 845 / lint clean / build-guard ok.

---

## Cycle 146 — CHANGELOG에 cycles 132-145 history 일괄 추가

- 문서: cycle 132 batch 이후 14 사이클 미반영 상태 batch 정리 (cycle 98 / 114 / 132에 이은 4번째 batch).

검증: tsc 0 / unit 843 / lint clean / build-guard ok.

---

## Cycle 141-145 — quest/ach 보상 missing item baseline 0 달성 🎯

- 콘텐츠: cycle 140 이벤트 체인 7건 fix 후 같은 패턴 검증 결과 quest / achievement reward.item이 75종 unique missing — 모든 보상이 silent no-op (플레이어가 챕터/업적 완수해도 인벤토리에 안 들어감) 발견.
- 141: KNOWN_MISSING_REWARD_ITEMS Set + 양방향 가드 도입 (NEW missing 즉시 실패 / baseline 좁히기 강제). cycle 140 EVENT_CHAINS 회귀 가드 동봉.
- 142(-7) / 143(-7) / 144(-15) / 145(-46) 점진 정리. cycle 145는 Perl batch script로 44종 unique missing item을 theme-based 매핑(망토 / 갑옷 / 마나 결정 / 영웅의 물약 / 잊혀진 열쇠 / 기계 코어 / 강화 재료 등)으로 한 번에 교체.
- 결과: 모든 quest/achievement/event chain 보상이 실재 items.ts 항목 참조. addItemByName silent no-op 회귀 영구 차단.

검증: 각 사이클 tsc 0 / unit 843 / lint clean / build-guard ok.

## Cycle 140 — 이벤트 체인 7건 missing item 콘텐츠 정합

- 콘텐츠: cycle 139 핸들러 인프라 추가 후 검증 결과 EVENT_CHAINS 전반에 items.ts 미등록 item.name reward 7건 발견. lost_wizard / last_hero / shadow_guild / machine_uprising / world_tree_corruption / divine_apostle_trial / rift_secret 7개 chain의 보상이 처음으로 정상 작동.
- 매핑: 전설의 마법서→천벌의 지팡이 / 기사의 유검→심판자의 검 / 그림자 단검→그림자 절단기 / 기계 코어 갑옷→천상의갑주 / 세계수의 이슬→세계수의 지팡이 / 신전의 성광석→성스러운 창 / 균열 봉인석→균열 차단 방패. outcome log 텍스트도 새 이름과 일치하도록 갱신.

검증: tsc 0 / unit 840 / lint clean / build-guard ok.

## Cycle 139 — 이벤트 체인 legendary_item reward 핸들러 누락 회귀

- 시스템: eventActions.handleEventChoice가 gold/item/relic/combat_bonus/stat_bonus 5개 reward 타입만 처리하고 legendary_item 분기 누락. lost_wizard chain의 전설 보상이 silently 누락되던 회귀.
- 수정: rwd.type === 'legendary_item' 분기 추가 — 'item'과 동일하게 addItemByName + MSG.LOOT_GET. cycle 122/135 quest_complete 사운드는 외곽 if (rwd) 블록에서 자동 트리거.

검증: tsc 0 / unit 838 / lint clean / build-guard ok.

## Cycle 138 — CONSTANTS/BALANCE namespace 정합성 회귀 가드

- 테스트: cycle 137에서 발견된 2건의 잠복 버그(CONSTANTS.PRIMAL_SHARD_DROP_CHANCE / CONSTANTS.DAILY_INVADE_LIMIT — 둘 다 BALANCE 키를 CONSTANTS로 잘못 참조해 undefined 평가, 게임 핵심 메커니즘 비활성)가 재발 안 하도록 자동화 가드.
- 메커니즘: src/**/*.{ts,tsx} glob 스캔, BALANCE.X / CONSTANTS.X 참조를 추출해 각 키가 해당 객체에 존재하는지 검증.

검증: tsc 0 / unit 835 / lint clean / build-guard ok.

## Cycle 137 — CONSTANTS/BALANCE 참조 mismatch 2건 + PRIMAL_SHARD_REQUIRED 활성

- 시스템: combatBossHandlers의 CONSTANTS.PRIMAL_SHARD_DROP_CHANCE 참조가 undefined → 마왕 격파 후 primal shard가 영원히 안 떨어져 진엔딩 잠금. useInventoryActions의 CONSTANTS.DAILY_INVADE_LIMIT도 undefined → 일일 침공 제한이 사실상 비활성. 둘 다 BALANCE 객체에서 가져오도록 수정.
- 부수: shardCount < BALANCE.PRIMAL_SHARD_REQUIRED 게이트 신규 도입 — required 만큼 모이면 추가 드랍 차단. 기존 magic number 3 제거.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 136 — killStreak 시간 기반 감쇠 활성

- 시스템: BALANCE.KILL_STREAK_DECAY_MS 상수가 선언만 돼 있고 호출 0건 — dead constant. combatVictory에서 lastKillAt timestamp 추적 + 다음 kill 시 경과 시간이 KILL_STREAK_DECAY_MS 초과면 streak 0 reset.
- 결과: 장시간 휴식/이동 후 streak가 자연스럽게 끊어져 콤보 ramping이 의도대로 동작.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 135 — 이벤트 체인 보상 사운드 큐

- UX: eventActions.handleEventChoice의 reward 처리 끝에서 if (rwd) soundManager.play('quest_complete') 호출 추가. cycle 122 / 123 / 133에서 정착시킨 quest_complete 사운드(E major 4음) 재사용 — 챕터 보상 수령에 동일한 victory 톤.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 134 — SoundManager 사운드 키 등록·호출 정합성 회귀 가드

- 테스트: SoundManager.play(key) 호출 콜사이트(grep)와 SoundManager 내부 case 분기를 양방향 비교. 등록 안 된 키 호출(silent fallthrough) / 호출 0건 dead case 둘 다 catch.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 133 — 도감 milestone 수령 사운드 큐

- UX: claimCodexMilestone 액션에서 quest_complete 사운드 재사용. cycle 122(퀘스트) / 123(업적) 라인 통일 — 모든 milestone 수령 모먼트가 동일 sensory cue.

검증: tsc 0 / unit 832 / lint clean / build-guard ok.

## Cycle 132 — CHANGELOG에 cycles 114-131 history 일괄 추가

- 문서: cycle 114 batch 이후 18 사이클(115-131) 미반영 상태 batch 정리. cycle 98 / 114에 이은 3번째 batch.

---

## Cycle 131 — save → migrate → ASCEND 통합 흐름 회귀 가드

- 테스트: cycle 119(ASCEND preserve) + 120(migrate default) + 121(INITIAL_STATE declaration) end-to-end 통합 회귀 가드. 3개 시나리오(legacy save / 신규 플레이어 / 연속 환생).

검증: tsc 0 / unit 812 / lint clean.

## Cycle 125-130 — testid 인프라 sweep 6 사이클

- UX: 핵심 surface 6개에 stable testid 추가 — smoke/e2e 자동화 확보. 합 19개 신규 testid.
  - 125 AchievementPanel (4): panel / card-${id} / claim-${id} / toggle-show-all
  - 126 EventPanel (3): event-panel / event-choice-${idx} / event-dismiss
  - 127 PremiumShop (4): premium-shop / buy-${id} / title-buy-${id} / close
  - 128 QuickSlot (3): quick-slot-${i} / assign-${i} / unassign
  - 129 TrueEndingScreen (2): true-ending-screen / confirm
  - 130 Codex (3): codex-panel / tab-${id} / claim-${id}

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 124 — 데드 stats 필드 정리 (comboCount, lowHpWins)

- 정리: INITIAL_STATE에 선언됐지만 사실상 dead인 stats.comboCount / stats.lowHpWins 제거. activate combo는 combatFlags.comboCount(별도 필드), countLowHpWins은 fallback 안전.

검증: tsc 0 / unit 790 / lint clean.

## Cycle 121-123 — discoveryChains INITIAL_STATE + 사운드 시리즈

- 121: INITIAL_STATE에 discoveryChains: [] 선언 (cycle 102/119/120 declarative 마무리).
- 122: 퀘스트 완료 사운드 추가 (E major 4음 — completeQuest 액션).
- 123: 업적 청구도 같은 quest_complete 사운드 재사용 (claimAchievement).

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 119-120 — Ascension 영구 카운터 보존 + migrate default 정리

- 119: progressionHandlers.ASCEND가 6종 영구 카운터(escapes/syntheses/maxKillStreak/visitedMaps/discoveryChains/abyssRecord) 누락 → 환생 시 multi-run achievement 회귀. 6종 모두 preserve 추가.
- 120: migrateData에 신규 카운터 default 추가 + dead `discoveries` migrate 라인 제거 (cycle 84 후속).

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 117-118 — 사운드 큐 시리즈 (discovery_chain / new_area)

- 117: SoundManager case 'discovery_chain' (G major 4음) — cycle 102/103 chain 보상 sensory cue. exploreUtils.checkDiscoveryChains에서 직접 호출.
- 118: SoundManager case 'new_area' (D major 3음 짧음) — moveActions firstVisit 분기에서 호출. 6종 음악적 색채 정리(victory C / legendary C+B6 / levelUp C / discovery_chain G / new_area D).

검증: 각 사이클 tsc 0 / lint clean / unit pass.

## Cycle 116 — 미사용 MSG 키 37종 정리

- 정리: src/data/messages.ts에서 호출 0건인 MSG 키 37종 제거 — MILESTONE/BOSS_ENCOUNTER/GM/UI/CODEX/REST_FULL/SKILL_CURSE_AMPLIFY 등 7개 그룹.
- Firebase save에 영향 없음 (MSG는 코드 정의만).

검증: tsc 0 / unit 756 / lint clean.

## Cycle 115 — AdventureGuide 디버프 정화 hint (cycle 112 actionable)

- UX: safe + player.status.length>0이면 "디버프 정화 권장" hint. cycle 112 rest가 status 클리어하므로 정합. cycle 111 매핑 8종 한국어 라벨 재사용.
- 우선순위: claimable quest / 모험가 전직 / hpRatio rest 다음.

검증: tsc 0 / unit 754 / lint clean.

## Cycle 114 — CHANGELOG에 cycles 98-113 history 일괄 추가

- 문서: cycle 98 batch 이후 16 사이클 미반영 상태 batch 정리.

---

## Cycle 113 — CombatPanel 적 debuff chip (cycle 111 player chip의 symmetry)

- UX: CombatPanel에 적 debuff chip(stunnedTurns/cursedTurns/blindTurns/fearTurns/dots). emerald 톤 — cycle 111 rose(player) 위험과 대비.
- 결과: 플레이어가 부여한 status가 실시간 시각 노출.

검증: tsc 0 / unit 749 / lint clean.

## Cycle 112 — rest 시 player.status 정리 (status 시리즈 후속 UX 안전망)

- UX: characterActions.rest에 status: [] 초기화 추가. cure 아이템이 없는 status(bleed/blind/fear/stun)에 대한 안전망 — 안전지대 휴식으로 모든 디버프 해소.
- 영향: 영구 디버프 트랩 시나리오 차단.

검증: tsc 0 / unit 744 / lint clean.

## Cycle 111 — StatusBar active debuff chip (cycle 106-110 status 시각 노출)

- UX: StatusBar에 player.status가 length>0이면 debuff chip 노출. rose-200 톤(위험), aria-label에 전체 debuff 한국어 리스트(8종 매핑).
- testid: `status-debuff-chip` + `data-debuff-count`.

검증: tsc 0 / unit 741 / lint clean.

## Cycle 106-110 — Player status 시스템 5종 복구 시리즈

- 시스템: 보스 phase 2/3가 부여하는 5종 status가 player에 효과 없던 비대칭 회귀를 5 사이클에 걸쳐 복구.
  - cycle 106: bleed → DoT 매 턴 maxHp 4% (DOT_STATUSES에 추가, MSG.STATUS_DOT 출혈 라벨).
  - cycle 107: freeze/stun → 1턴 스킵 (attack/performSkill 시작 시 체크, status 제거).
  - cycle 108: curse → 받는 피해 +30% (BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT, enemyAttack 적용).
  - cycle 109: blind → 30% miss 확률 (BALANCE.BLIND_PLAYER_MISS_CHANCE, status 유지).
  - cycle 110: fear → 25% flinch 확률 (BALANCE.FEAR_PLAYER_FLINCH_CHANCE).
- 영향: 보스 후반 페이즈 위험 시그널 5종 모두 의도대로 작동.

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 105 — AchievementPanel THEME_BY_TARGET에 maxKillStreak / discoveryChains 추가

- UX: cycle 95/102에서 추가된 신규 target들이 cycle 79 정착 매핑에 누락되어 default kills 톤(붉은 Swords)으로 표시되던 surface 일관성 회복.
  - maxKillStreak: Flame red. discoveryChains: Link2 indigo.

검증: tsc 0 / unit 711 / lint clean.

## Cycle 104 — StatsPanel CHAINS row (discoveryChains 진행도 가시화)

- UX: cycle 80/82/96 패턴 그대로 — 카운터 시스템마다 ach + 칭호 + StatsPanel row 한 짝의 일관 구조 유지.
  Link2 / indigo-300 톤 (chain_master 칭호 색과 매치).

검증: tsc 0 / unit 705 / lint clean.

## Cycle 103 — '세계의 길잡이'(chain_master) 칭호 + discoveryChains cond.type

- 콘텐츠: title `chain_master`(세계의 길잡이) cond `discoveryChains >= 5` ATK+1 · DEF+1 · MP+15 (탐험+전투 균형형).
- 시스템: gameUtils.checkTitles에 `type === 'discoveryChains'` 분기.

검증: tsc 0 / unit 702 / lint clean.

## Cycle 102 — 발견 체인(discovery chains) 완료 achievement 3종

- 콘텐츠: ach_chain_1/3/all (BALANCE.DISCOVERY_CHAINS 5개 시스템 reflection). exploreUtils가 즉시 보상은 부여했지만 영구 reflection이 비어있던 자리 채움.
- 시스템: getAchievementCurrentValue 'discoveryChains' 핸들러 추가.

검증: tsc 0 / unit 697 / lint clean.

## Cycle 101 — relicCount achievement 진행도 double-counting 회귀

- 시스템: getAchievementCurrentValue('relicCount')가 `relics.length + stats.relicCount`로 계산되어 ADD_RELIC handler가 둘 다 증분하던 게 double count → ach_relic_5("유물 5개")가 실제 3개에서 풀리던 부풀림 fix.
- 단일 source of truth(stats.relicCount)로 통일. checkTitles와 정합. cycle 83 'discoveries' 시맨틱 통일과 동일 패턴.

검증: tsc 0 / unit 691 / lint clean.

## Cycle 100 — 잔존 lint warnings 4종 명시 disable (lint 100% clean) 🎯

- 인프라: App.tsx ref-mutate-in-render(3종, 테스트 harness 의도) + GravePanel set-state-in-effect(1종, mount-once fetch) 명시 disable + 사유 주석.
- 결과: npm run verify 풀 파이프 type-check 0 / lint 0 errors 0 warnings / unit 686 / build-guard ok 완전 통과.

## Cycle 99 — quest Level 진행도 player.level undefined 안전 처리 (TS 회귀)

- 시스템: cycle 94 latch refactor 이후 잔존하던 TS2345 에러 fix — `Math.max(N, undefined) = NaN` 위험 차단.
- 발견 경로: cycle 78-98 동안 npm run verify type-check를 매번 안 돌려 잠복.

검증: tsc 0 / unit 686 / lint clean.

## Cycle 98 — CHANGELOG에 cycles 78-97 history 일괄 추가

- 문서: cycle 67 phase 종료 이후 20 사이클의 작업이 CHANGELOG에 미반영 상태였음. 단일 batch로 정리.

---

## Cycle 97 — maxKillStreak reflection 마무리 (RunSummaryCard chip + focus advice)

- UX: RunSummaryCard run-summary-extras에 streak chip(red Flame). extras 섹션 트리거 조건에 `OR maxKillStreak > 0` 추가.
- 시스템: getRunSummaryAnalysis focus advice 2종 — `>=10` 공격형 칭찬, `<3 && level >= 10` streak 활용 권장.
- 결과: maxKillStreak feedback chain 8개 surface 완성.

검증: tsc 0 / unit 683 / lint clean.

## Cycle 96 — maxKillStreak feedback chain 표면 통합 (StatsPanel/RunSummary/share)

- UX: StatsPanel MAX STREAK row(Flame red-400) 추가.
- 시스템: buildRunSummary에 maxKillStreak 필드, buildRunShareText에 "🔥 최대 N연속 처치" silence-over-noise 라인.

검증: tsc 0 / unit 677 / lint clean.

## Cycle 95 — maxKillStreak 누적 + 보상 통합 (achievement 3종 + berserker 칭호)

- 콘텐츠: ach_streak_5/10/20 (BALANCE.KILL_STREAK_TIERS 정렬) + 신규 칭호 'berserker'(광전사) cond `maxKillStreak >= 20` ATK+3 · CRIT+2%.
- 시스템: INITIAL_STATE.player.stats.maxKillStreak = 0. combatVictory에서 매 처치 후 max(prev, newStreak) 누적. gameUtils 핸들러 2개 추가.
- 디자인 의도: 휘발성 killStreak를 영구 보상으로 연결.

검증: tsc 0 / unit 671 / lint clean.

## Cycle 94 — 퀘스트 진행도 latch (윈도우 기반 카운터 회귀 방지)

- 시스템: syncQuestProgress의 모든 stat-based 분기에 `Math.max(quest.progress, computed)` latch 헬퍼 적용.
- 영향: survive_low_hp가 stats.recentBattles(50개 윈도우)를 읽어 옛 저-HP 승리가 윈도우 밖으로 밀려날 때 progress 회귀 → 청구 영구 차단되던 회귀 수정. 단조 카운터에는 무해.

검증: tsc 0 / unit 663 / lint clean.

## Cycle 90-93 — 데드코드 정리 4 사이클 (~1649 lines)

- cycle 90: OnboardingGuide 컴포넌트 + 관련 state plumbing(action / handler / Firebase save / migrate) 8개 파일 정리.
- cycle 91: EquipmentSpriteGlyph(941L) + DashboardPanels(332L) — 단일 사이클 최대 cleanup.
- cycle 92: AdminDashboard / analyticsService / animationConfig (~280L).
- cycle 93: utils 단위 dead exports 4종 — IMAGEGEN_OVERLAY_KEYS / getEquipmentOverlayAssetKey / getOutfitAffinityTone / getMaterialShop (~80L).

검증: 각 사이클 tsc 0 / unit pass / lint clean / build-guard ok.

## Cycle 89 — 도주 스킬(escape_100) 코드 패스를 escape feedback chain에 합류

- 시스템: combatAttack의 forceEscape 분기가 cycle 74-88에서 쌓아온 stats.escapes 증분 / recentBattles record / escape 사운드 큐를 모두 누락. '공허의 문'(시간술사) / '순간 이동'(차원술사) 사용자가 보상 체인의 1급 시민이 아니던 회귀 수정.

검증: tsc 0 / unit 634 / lint clean.

## Cycle 88 — 도주 성공 사운드 큐 (escape feedback chain 마지막 sensory cue)

- 시스템: SoundManager case 'escape' (1100→600Hz 하강 sine 0.18s). combatAttack 도주 성공 분기에서 직접 호출.
- 디자인 의도: victory 5음 상승의 정반대인 retreat tone — error의 sawtooth와 달리 부드러운 sine으로 안도감.
- 결과: escape feedback chain 9 surface 완성.

검증: tsc 0 / unit 629 / lint clean.

## Cycle 87 — RunSummary focus advice에 escape/discovery 시그널 통합

- 시스템: getRunSummaryAnalysis focus advice 3종(silence-over-noise) — `escapes>=10 && bossKills<=1` 빌드 강화 권장, `discoveries<=4 && level>=12` 탐험 권장, `discoveries>=15` 탐험 칭찬.

검증: tsc 0 / unit 625 / lint clean.

## Cycle 86 — RunSummaryCard에 도주/지도 발견 시각 reflection

- UX: 신규 mini-section run-summary-extras(signatures highlight cycle 18 패턴). 도주 chip(Footprints sky-300) + 지도 발견 chip(Compass emerald-300). 둘 다 0이면 silent.

검증: tsc 0 / unit 620 / lint clean.

## Cycle 85 — 연금술사(alchemist) 칭호 + synths cond.type 핸들러

- 콘텐츠: title `alchemist`(연금술사) cond `synths >= 20` MP+15 · ATK+1. crafter(장인)와 짝을 이루는 제작 계열 보상 라인.
- 시스템: gameUtils.checkTitles에 `type === 'synths'` 분기 추가.

검증: tsc 0 / unit 615 / lint clean.

## Cycle 84 — discoveries dead write 정리 + RunSummary/share 맵 발견 라인

- 정리: cycle 83 시맨틱 통일 후속 — _shared.ts의 stats.discoveries 누적(이제 dead write) 제거, INITIAL_STATE.discoveries 선언 제거.
- UX: buildRunSummary discoveries 필드, buildRunShareText "🗺️ 지도 발견 N곳" silence-over-noise.

검증: tsc 0 / unit 610 / lint clean.

## Cycle 83 — 'discoveries' 시맨틱 통일 (visitedMaps.length 기준)

- 시스템: questProgress / checkTitles / StatsPanel이 stats.discoveries(이벤트 카운터)를 잘못 읽던 회귀 수정. 모두 visitedMaps.length로 통일 — achievement(이미 visitedMaps 사용)와 정합.
- 영향: cartographer("지도 제작자") 칭호가 10번의 이벤트만으로 풀리고 quest 201("15곳 발견")이 의도보다 훨씬 빨리 진행되던 부풀림 fix.

검증: tsc 0 / unit 603 / lint clean.

## Cycle 82 — StatsPanel CRAFTS / SYNTHESES 노출 + syntheses 선언적 일관성

- UX: StatsPanel CRAFTS row(Hammer orange-300) + SYNTHESES row(FlaskConical amber-300).
- 시스템: INITIAL_STATE.player.stats.syntheses = 0 default — crafts는 있었으나 syntheses 누락 갭 정리.

검증: tsc 0 / unit 599 / lint clean.

## Cycle 81 — 모바일 smoke testid 회귀 (archive-tab-* primary tabs)

- 인프라: scripts/smoke-gameplay.mjs verifyMobileArchiveConsole이 primary tabs(equipment/stats)에 dashboard-tab-* 잘못 매칭하던 회귀 수정. cycle 73 verify:full 통합 스크립트로 모바일 모드까지 돌리며 발견.

검증: tsc 0 / unit 595 / lint clean.

## Cycle 80 — StatsPanel ESCAPES 통계 라인 + sky 톤 일관성

- UX: StatsPanel ESCAPES row(Footprints sky-300) — cycle 74-78 도주 카운터를 stats panel에도 노출.

검증: tsc 0 / unit 594 / lint clean.

## Cycle 79 — AchievementPanel THEME_BY_TARGET 14종 시각 톤 추가

- UX: AchievementPanel에 escapes/explores/discoveries/relicCount/crafts/rests/bountiesCompleted/abyssRecord/abyssFloor/demonKingSlain/prestige/signaturesDiscovered/signatureSetsCompleted/synths 14종 테마 추가.

검증: tsc 0 / unit 593 / lint clean.

## Cycle 78 — RunSummary + RunShareText에 도주 카운트 reflection

- UX: buildRunSummary에 escapes 필드, buildRunShareText에 "🏃 도주 N회 — 위험 회피 운영" silence-over-noise.

검증: tsc 0 / unit 593 / lint clean.

## Cycle 77 — 도주/생존 칭호 2종 + escapes cond.type

- 콘텐츠: 신규 칭호 2종 (`cautious_explorer` HP+20·DEF+1 / `survivor_instinct` HP+40·DEF+2·MP+10).
- 시스템: `gameUtils.checkTitles`에 `type === 'escapes'` 분기 추가.
- 디자인 의도: ironman(공격적 무사망)과 짝을 이루는 보수적 위험 회피 운영 축.

검증: tsc 0 / unit 592 / lint clean.

## Cycle 76 — escape_count 퀘스트 2종 + questProgress 핸들러

- 콘텐츠: 신규 퀘스트 2종 (id 203 「신중한 모험」 escapes 5 Lv5+ / id 204 「생존의 기술」 escapes 20 Lv15+ + 엘릭서).
- 시스템: `questProgress`에 `type === 'escape_count' && target === 'escapes'` 분기 추가.
- 결과: 도주 카운터가 ACHIEVEMENTS(74)+QUESTS(76)+TITLES(77) 3 시스템에서 1급 시민이 됨.

검증: tsc 0 / unit 589 / lint clean.

## Cycle 75 — signaturesDiscovered 카운트 정확도 (codex 합 → REGISTRY 교집합)

- 시스템: `checkTitles`의 `signaturesDiscovered` 분기와 `questProgress`의 `signature_collect` 분기가 모두 codex 합집합 크기로 근사하던 것을 `countDiscoveredSignatures(player)` 정확 카운트로 교체.
- 영향: cycle 61의 `legend_seeker` (5종) / `legend_chronicler` (15종) 칭호와 cycle 63의 quest 202가 의도보다 일찍 풀리던 부풀림 회귀 수정.
- 테스트 갱신: 실제 SIGNATURE_REGISTRY 등록 이름(성검 에테르니아 / 마왕의 대낫 / 라그나로크 등)으로 픽스처 교체.

검증: tsc 0 / unit 587 / lint clean.

## Cycle 74 — stats.escapes 카운터 + 도주 성공 achievement 3종

- 시스템: 도주 성공 시 `stats.escapes += 1` 누적 (기존엔 recentBattles 50개 윈도우에만 푸시되어 윈도우 밖에서 사라짐).
- INITIAL_STATE.player.stats.escapes = 0 default 추가.
- 콘텐츠: ACHIEVEMENTS 3종 (`ach_escape_5/20/50` — 신중한 모험가 / 생존의 본능 / 회피의 달인).

검증: tsc 0 / unit 587 / lint clean.

## Cycle 73 — verify:full 통합 + Playwright dynamic baseURL

- 인프라: `npm run verify:full` 신규 (verify 통과 → preview 자동 기동 → smoke desktop+mobile + e2e). `local-playtest.sh` `AETHERIA_RUN_E2E=1` 옵트인 추가.
- 인프라: `playwright.config.ts` baseURL이 `process.env.PLAYWRIGHT_BASE_URL` 우선 (동적 포트 fallback 호환).
- 문서: AGENTS.md "통합 검증" 섹션 추가.

## Cycle 72 — TS/TSX 파일 lint coverage 갭 메우기

- 시스템: cycle 58 TS 마이그레이션 이후 src/는 `.ts/.tsx`만 남았으나 eslint config가 `.js/.jsx`만 매칭하던 인프라 갭 발견. `typescript-eslint` 8.x 도입 + `src/**/*.{ts,tsx}` lint block 신설.
- 코드 위생 자동 수정: `prefer-const` 2건 (exploreUtils / gameUtils).
- 추가 정리 (phase 2): SmartInventory의 `[(player.inv || [])]` 의존성을 `[player.inv]`로 교체 (매 렌더 새 배열 생성 → useMemo 무력화 잠재 회귀 4 사이트 수정). GameRoot retroactive title useEffect는 narrowed deps 의도된 패턴으로 명시.
- react-hooks 7+ 신규 strict 규칙(`refs` / `set-state-in-effect`)은 testing harness 패턴 등 기존 의도된 코드와 충돌해 warning으로 완화.
- 결과: 0 errors / 4 warnings.

## Cycle 71 — hidden boss spawn 트리거 버그 수정

- 시스템: `exploreUtils.spawnEnemy`의 `hiddenBossChecks` 루프가 `mapData.name === loc`로 비교했으나, mapData는 DB.MAPS[player.loc]로 가져와지며 `.name` 필드가 설정된 적이 없어 항상 undefined. 결과: 시간의 파수꾼(시간술사 Lv40+ 공중 신전), 원한의 용사(last_hero 체인 3단계 + 지하 미궁), 공허의 군주(abyssFloor 100+ 금지된 도서관) 3종 hidden boss가 영원히 spawn되지 않던 잠재 회귀.
- 수정: `mapData.name === loc` → `player.loc === loc`. 회귀 가드 +3개 (스폰 / 직업 미달 / 위치 미달).

## Cycle 70 — Bestiary / MonsterCodex / Codex의 boss-only 누락 버그 수정

- 시스템: 3개 컴포넌트가 `map.monsters`만 보고 `map.boss` / `map.bossMonsters`는 무시 → boss-only 몬스터(예: 고대 호수의 수호신, 하수도의 여왕)가 도감 진행 % / 위치 표시에서 사라짐. `collectMapEncounters(map)` inline helper로 합집합. `boss: true/false` legendary 플래그는 string 필터에서 silently 제외.
- 회귀 가드: 모든 MAPS의 boss 타입 + 신성한 호수 boss 인식 +5개.

## Cycle 69 — signature drop 연결 + mapSignatureHints boss 필드 버그 수정

- 콘텐츠: 고대 호수의 수호신 드롭 풀에 `심해의 수호복` rate 0.03 추가 (심연 크라켄 Lv50+ 0.06이 주 경로, mid-game 보조 경로 노출). cycle 11-29 anticipate→drop 체인을 mid-game에서도 재현.
- 시스템: `mapSignatureHints.buildMapIndex`가 `map.monsters`만 보고 `map.boss/bossMonsters`는 무시하던 버그 수정. MapNavigator의 ✦N 칩과 미발견 안내가 정확해짐.

## Cycle 68 — 신규 mid-game 보스 "고대 호수의 수호신" 완전 통합

- 콘텐츠: 신성한 호수(Lv7) mid-game 보스 신규. 5개 데이터 소스 일괄 등록 — MONSTERS(isBoss + phase2 빙결) / BOSS_BRIEFS 7개 키 / BOSS_MONSTERS 자동 derive / MAPS.boss 필드 / DROP_TABLES (5개 드롭).
- 진행 곡선: 기존 mid-game 보스(하수도의 여왕 Lv10, 전초기지 사령관 Lv18) 사이의 Lv7 구간 첫 보스 경험 제공.

검증: tsc 0 / unit 570 / smoke 통과.

## Cycle 67 — 의존성 + 안내 메시지 + 통합 검증 + 문서 동기화

- 콘텐츠: 탐색/유틸 유물 3종 (`방랑자의 부적` uncommon · `상인의 인장` rare · `운명의 결정` rare). 기존 `event_chance / gold_mult / drop_rate` 핸들러 재사용으로 CombatEngine 영향 없음.
- 인프라: `npm run verify` 통합 스크립트 (`type-check && lint && test:unit && build:guard`). 1줄로 4 gate 검증.
- 인프라: PWA `manifest.webmanifest` 한국어 description + `lang/scope/categories` 보강.
- 의존성: `npm update` patch/minor wanted 갱신 (84 deps). Capacitor 8.1→8.3, firebase 12.8→12.12, framer-motion 12.34→12.38, react 19.2.3→19.2.5 등. major(eslint 9→10 / vite 7→8 / tailwind 3→4 / lucide 0→1)는 별도 사이클로 미룸.
- 문서: AGENTS.md verification 섹션에 `tsc --noEmit` + `test:e2e` + smoke 사전조건 추가. README에 cycle 60–67 누적 6행 요약 테이블 추가. tasks/todo.md ✅ Completed에 cycle 60–64 시스템 시계열 한 항목 요약.

검증: tsc 0 / unit 565 / e2e 20 / lint clean / build:guard ok / smoke desktop 통과.

## Cycle 66 — 신규 이벤트 체인 "물의 사도"

- 콘텐츠: 호수의 신전(Lv5) → 사막 오아시스(Lv25) → 피라미드(Lv30) 3단계 체인. 보상 흐름은 `chain_advance / combat_bonus 1.2× ATK 6턴 / 엘릭서 또는 전설 유물`. cycle 62의 `forgotten_commander`(중후반)와 함께 초중반 진행 곡선을 보강.
- 테스트: `tests/water-apostle-chain.test.js` +5개.

검증: tsc 0 / unit 560 / lint clean / build:guard ok.

## Cycle 65 — CombatEngine Player typing + 보안 + ShopPanel + RunShareText + smoke 안내

- 시스템: CombatEngine 잔여 9개 메서드(`applyCritMpRestore / applyFatalProtection / tickCombatState / attack / performSkill / enemyAttack / applyExpGain / handleVictory / handleDefeat`)에 `player: Player` 적용. 내부 `let updatedPlayer: any = ...`로 strict literal inference 회피.
- 시스템: ShopPanel `player: any` → `Player` (cycle 60 batch 6에서 보류했던 nullable 가드 7곳 정리).
- 보안: `npm audit fix` 12 vulns(1 critical / 7 high / 4 moderate) → 0. vite path traversal / xmldom DoS / yaml stack overflow / brace-expansion DoS 등.
- UX: `RunShareText`에 `🎯 빌드 / 📊 난이도` 라인 추가 (`silence over noise`).
- 인프라: `smoke-gameplay.mjs` 연결 실패 시 안내 메시지 + 해결 옵션 3가지.

검증: tsc 0 / unit 555 / lint clean / build:guard ok / smoke 통과.

## Cycle 64 — E2E 회귀 가드 확장 + SW 캐시 v3

- 인프라: E2E 14 → 20개. STATS / CODEX / QUEST / ACHV 탭 lazy-loading + LegendaryCodex 빈 상태 educational hint(보스/전설 키워드) + pity status panel.
- 인프라: PWA `aetheria-rpg-v2` → `aetheria-rpg-v3` 캐시 갱신 (cycle 60–63 대규모 변경 후 stale chunk 방지).

검증: tsc 0 / unit 552 / e2e 20 / lint clean / build:guard ok.

## Cycle 63 — 챌린지 퀘스트 3개 + signature_collect 핸들러

- 콘텐츠: `대륙의 발자취 (explores 50)`, `지도 완성가 (discoveries 15, 칭호 보상)`, `전설 기록자 (signaturesDiscovered 15, 칭호 보상)`.
- 시스템: `signature_collect` quest type 핸들러 (`questProgress.ts`) — codex 합집합 크기로 진행도 산출.
- 테스트: signature_collect 매핑 + goal cap 동작 +2개.

검증: tsc 0 / unit 552 / lint clean / build:guard ok.

## Cycle 62 — forgotten_commander 체인 + UX polish + retroactive titles

- 콘텐츠: 이벤트 체인 "잊혀진 사령관" 3단계 (잊혀진 폐허 → 몰락한 전초기지 → 마왕성). 보상은 `chain_advance / combat_bonus 1.25× ATK 8턴 / 기사의 흉갑 또는 전설 유물`.
- 시스템: eventActions `stat_bonus` reward 핸들러 정상화 (기존 `rift_secret` 체인이 사용 중이었지만 silently 무시되던 보상).
- UX: 5개 풀스크린 모달 safe-area 패딩 + 8개 컴포넌트 `100vh → 100dvh`.
- 시스템: GameRoot bootStage ready 시 retroactive `checkTitles` (기존 save가 신규 칭호 조건 충족 상태로 로드돼도 즉시 부여).

검증: tsc 0 / unit 548 / lint clean / build:guard ok / smoke 통과.

## Cycle 61 — 성능 최적화 + 신규 칭호 5종

- 성능: 메인 index 387 → 265 KB (-32%). Dashboard 174 → 51 KB (-71%). 초기 로드 JS 561 → 316 KB (-44%).
- 성능: vite manualChunks 정리 + `game-equipment` / `game-combat` 청크 분리. Dashboard 비-default 탭 10개 React.lazy + Suspense fallback. Firebase 청크 `firestore / auth / core` 3개 분리.
- 콘텐츠: 신규 칭호 5종(`wanderer / pathfinder / cartographer / legend_seeker / legend_chronicler`) + 신규 cond.type(`explores / discoveries / signaturesDiscovered`).

검증: tsc 0 / unit 542 / lint clean / build:guard ok.

## Cycle 60 — TypeScript 도메인 타입 정착 (12 batch)

- 시스템: `src/types/`에 `Player / Item / Monster / GameMap / GameState / GameAction / Relic / EquipSlots` 도메인 타입 정의. `[key: string]: any` 인덱스 시그니처로 런타임 동적 필드 호환.
- 시스템: gameReducer / handlers/* / utils/* / hooks/* / components/* 전반에 단계적 적용 (12 batch). CombatEngine은 `getCombatFlags / getEffectiveMaxMp / updateQuestProgress` 3개 simple 메서드까지 적용 (heavy 메서드는 cycle 65에서 마무리).
- 시스템: `EquipSlots`를 ItemBase 슬롯 + 인덱스 시그니처로 완화 (런타임 동적 슬롯 호환).
- 시스템: `Relic` 도메인 타입 신규 — effect-기반 다형 데이터를 permissive 인터페이스로.

검증: tsc strict 0 errors / unit 536→542 / lint clean / build:guard ok.

---

## 이전 사이클 (–v4.0 / cycle 1–58)

- README의 `최근 수정 (Hotfixes)` 표를 참조. 주요 마일스톤은 cycle 58 (TS 인프라 + Playwright E2E + ts-nocheck 100% 제거), cycle 59 (strict: true 활성), cycle 56–57 (premium avatar / equipment family).
