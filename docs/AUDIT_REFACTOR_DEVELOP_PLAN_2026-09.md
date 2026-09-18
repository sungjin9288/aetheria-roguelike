# Aetheria Roguelike — 1차 개발 완료 후 점검·리팩토링·디밸롭 계획 (2026-09)

> 작성일: 2026-09-16 · 근거: 2026-09-15~16 병렬 감사 3종 (아키텍처/타입 부채 · 게임플레이 깊이 · 테스트/인프라/문서) + 감사 주장 직접 재검증
> 전제: `docs/ROADMAP_2026-07_BEST_IN_GENRE.md`의 PR #12~#20은 **전부 출시 완료**. 이번 트랙은 "출시된 시스템의 깊이 회복 + 타입 경계 복원 + 문서 진실성"이다.
> 실행 규약: 기획은 Fable, 구현은 Opus/Sonnet 서브에이전트. 각 PR 단위는 `npm run verify` 그린 후 머지.

---

## 0. 베이스라인 (실측)

| 게이트 | 결과 | 비고 |
|---|---|---|
| `tsc --noEmit` | 0 err | strict |
| `eslint .` | 0 err | `no-explicit-any` off, `exhaustive-deps` warn |
| `test:unit` | 3724 / 3837 | 113 실패 전부 아트 파이프라인. Pillow 설치 후 105 통과, **8건 잔여 = LANCZOS 픽셀 재현성(Pillow 버전 미고정)** |
| `build:guard` | ok | 메인 청크 474KB / 한도 600KB |
| 소스 | 269 파일 / 48k LOC | `: any` 1,494 · `as any` 100 |
| 테스트 | 208 파일 / 3,776 케이스 | 62 파일은 소스 텍스트 정규식 가드(실행 없음) |

---

## 1. 감사 결과 — 판정표

### 1.1 확정 (코드로 재검증 완료)

| # | 항목 | 증거 | 심각도 |
|---|---|---|---|
| G1 | **`spawnEnemy`가 `statusOnHit`·`phase3`를 복사하지 않음** | `exploreUtils.ts:235-247`은 10개 필드만 복사. 리더는 `enemyAI.ts:66`(phase3), `:239`(statusOnHit)에 이미 존재. 27몬스터 상태 정체성·**마왕 포함 7보스 3페이즈**가 영구 미발동 | **HIGH** — 저작된 콘텐츠 사장 |
| G2 | **거울 구매가 rank 사다리를 잠식** | `outcome.ts:163` `rank = floor(essence/150)`이 *잔여* 정수 기준. `premiumHandlers.ts:132`가 차감 → 500정수 노드 = 영구 스탯 3.3 rank 지연, 미리보기에 미표시 | HIGH — 숨은 비용 |
| G3 | **거울 트리 총액 2,570 정수** = Lv30 지역 ~68킬 | `mirror.ts:27-77`. 한 회차 내 완주 → 이후 정수 소비처 0 (로드맵 #15가 닫으려던 갭 재개방) | HIGH — 메타 훅 소멸 |
| G4 | **장비 비교식 3중 구현, 2개 오답** | `equipmentUtils.ts:315`(강화 반영 ✓) vs `ShopPanel.tsx:45`, `_helpers.ts:31`(강화 무시, 상수 inline) → 강화 장비 보유 시 상점/루팅 힌트가 업그레이드 과대 표시 | HIGH — 플레이어 가시 |
| G5 | **런타임 에러 리포터 영구 no-op** | `installRuntimeErrorReporter` 호출처 0. `main.tsx`·`FatalErrorBoundary`가 void로 캡처 | MED — 크래시 데이터 100% 유실 (백엔드 sink 없음) |
| G6 | **희귀도 표현 5원천** | `titles.ts:450`이 Tailwind 맵을 hex 맵과 같은 이름 `RARITY_COLORS`로 재수출. `RARITY_LABEL` 복사본 3개, 1개 이미 드리프트 | MED — 함정 |
| G7 | **타입 경계 붕괴** | `src/types/*` 인덱스 시그니처 28개. `Player`가 `[key:string]: any`로 닫혀 `player.오타`도 통과. `PlayerStats`에 43회 참조 필드 5개 미선언 | MED — 타입 안전성 명목뿐 |
| G8 | **유물 희귀도 곡선** | epic+legendary 32종(48%)이 가중치 7.9%. 시너지 20개 중 12개가 1/1015 legendary 의존 | MED — 저작 콘텐츠 사장 |
| G9 | **결정 밀도**: 탐험 전 0, 전투 후 0 | `buildScoutEvent`가 player/map 인자 무시(확장 지점 주석). `PostCombatCard`는 단일 버튼 | MED — 장르 핵심 |
| G10 | **보스 게이지 HUD 없음, 심연 데일리 다이브 UI 0건** | `bossGauge` TSX 3줄(선택 카드 한정), `abyssDailyDive` TSX 0 | LOW-MED |
| G11 | 문서 드리프트 | CLAUDE.md §8.1 `pendingEnemyTurn` 식별자 부재(전투는 reducer 소유·seeded), 테스트 117→208, 디렉토리 트리 3개 누락, `verify`/`verify:full` 미기재, `implementation_plan.md` `.jsx` 참조 | LOW |

### 1.2 반증 (감사 주장이 틀림 — 재조사 금지)

- **"부트 이후 클라우드 자동저장이 멈춘다"** → 거짓. reducer 핸들러 40여 곳이 상태 변경마다 `syncStatus: 'syncing'` 설정. 단 `useFirebaseSync` 실행 테스트 0건은 사실.
- **BALANCE 미사용 키** → 0건. **유물 effect id 미처리** → 0건. **CHALLENGE_MODIFIERS·체인 보상·도감 보상** → 전부 소비처 존재.
- `pendingEnemyTurn` 누수 클래스 → 소멸(적 턴이 reducer 내부 동기 해석).

---

## 2. 판단 기준

**핵심**: 콘텐츠를 새로 쓰지 않고 *이미 저작된 것이 실제로 발동하게* 만드는 변경이 라인당 가치가 가장 높다. 타입은 "any 개수"가 아니라 "오타가 컴파일에 잡히는가"로 판정한다.

| 선택지 | 얻는 것 | 잃는 것 | 실패 시나리오 |
|---|---|---|---|
| **A. 이미 있는 리더에 데이터 연결** (G1, G8) | 2~20줄로 보스 3페이즈·27몬스터 정체성·유물 32종 부활 | 초반 난이도 미세 상승 (statusOnHit 발동) | 밸런스 계약 테스트(`early-growth`, `mid-game-ttk`) 깨지면 확률/데미지 재조정 필요 |
| **B. 경제 재설계** (G2, G3) | 메타 훅 복원, 정수 소비처 3회차까지 유지 | 저장 스키마 변경(`DATA_VERSION` bump + migrate) | 마이그레이션 오류 시 기존 유저 rank 손실 → migrate에 정확 역산(구매 이력 = mirror 레벨 × 비용) 필수 |
| **C. 타입 코어** (G7) | 오타·드리프트 컴파일 차단 | 실제 에러 수십 건 표면화, 정적 가드 테스트 갱신 | 인덱스 시그니처를 한 번에 다 닫으면 tsc 폭발 → `PlayerStats`부터 단계적 |
| **D. 결정 밀도** (G9) | 탐험 전/전투 후 push-your-luck 비트 | UI 표면 추가, e2e 갱신 | 선택이 "항상 정답"이면 결정이 아님 → 비용(골드/게이지/HP)이 실제로 아파야 함 |

**우선순위 규칙**: A > B > 중복 제거(G4, G6) > D > C > 문서. C는 A·B·D가 머지된 뒤 실행(파일 충돌 최소화).

---

## 3. 실행 계획

### Wave 1 — 병렬 2트랙 (worktree 격리, 파일 집합 분리)

**Track A · 버그·중복 제거** (Opus)
| PR | 내용 | 파일 | 검증 |
|---|---|---|---|
| A1 | `spawnEnemy` `statusOnHit`/`phase3` 전파 + 심연/진보스 경로 정합 | `utils/exploreUtils.ts` | 신규 테스트: 슬라임 spawn에 `statusOnHit`, 마왕 spawn에 `phase3`; 기존 밸런스 계약 그린 |
| A2 | 장비 비교 단일 원천: `getEquipmentDecision` 재사용, `getLootUpgradeHint`/`getComparisonMeta` 위임, `BALANCE.SELL_PRICE_RATIO` + `getSellPrice`, `pickBestEquippable` 통일, 델타 라벨 `MSG`화 | `utils/equipmentUtils.ts`, `components/ShopPanel.tsx`, `hooks/combatActions/_helpers.ts`, `components/SmartInventory.tsx`, `reducers/handlers/economyHandlers.ts`, `data/constants.ts`, `data/messages.ts` | 강화 +N 장비 보유 시 상점/루팅/인벤 3표면 동일 델타 테스트 |
| A3 | 희귀도 단일 모듈: `titles.ts:450` 별칭 제거, `RARITY_LABEL` 복사본 3개 → `MSG`, Tailwind 맵 → `RARITY_CLASSES` | `data/titles.ts`, `components/{BuildAdvicePanel,RelicChoicePanel,CraftingPanel}.tsx` | 정적 가드 테스트 갱신 |

**Track C · 메타 경제·결정 밀도** (Opus)
| PR | 내용 | 파일 | 검증 |
|---|---|---|---|
| C1 | 정수 경제: `meta.essenceLifetime` 도입, rank는 lifetime 기준, `DATA_VERSION 5.0→5.1` + migrate(역산: `essence + Σ mirror 레벨 비용`), 거울 트리 확장(총액 목표 12k~15k, 초반 3구매는 30킬 내), Ascension 화면에 거울 진입 CTA | `data/mirror.ts`, `systems/CombatEngine.outcome.ts`, `reducers/handlers/{helpers,premiumHandlers}.ts`, `types/player.ts`, `utils/dataMigration.ts`, `data/constants.ts`, `components/AscensionScreen.tsx`, `data/messages.ts` | migrate 역산 테스트, rank 불변 테스트, 기존 `essence-mirror`·`mirror-journey` 그린 |
| C2 | 유물 곡선: `RELIC_WEIGHTS` 평탄화(epic+legendary 가중 ≥15%), 시너지 pity를 3피스 세트 2개 미보유까지 확장, `eventActions.ts:73` `owned` 전달 | `data/relics.ts`, `data/constants.ts`, `hooks/gameActions/eventActions.ts` | 가중 분포 통계 테스트, `relics.test.js` 그린 |
| C3 | 보스 게이지 HUD 칩(`StatusBar`/`ControlPanel`) + 지도 행 배지 + 심연 데일리 다이브 안내 | `components/{StatusBar,ControlPanel,MapNavigator}.tsx`, `utils/mapBadges.ts`, `data/messages.ts` | 정적 가드 + 390px 뷰포트 e2e 1건 |

### Wave 2 — 순차 (Wave 1 머지 후)

| PR | 내용 | 모델 | 비고 |
|---|---|---|---|
| B1 | 추론 파괴 `const X: any = 리터럴` 101건 삭제, `questOperations`에 기존 `Quest`/`GameMap` import, 내부 전용 export 6건 un-export, 죽은 fallback(`useCombatActions.ts:19,23`, `combatAttack.ts:15,30`) 삭제, 미사용 `MSG` 키 23개 정리(`CLASS_*` 블록 확인 후) | Sonnet | 기계적, `tsc`가 증명 |
| B2 | `FullStats = ReturnType<typeof calculateFullStats>` + `getActiveRelicSynergies(relics: Relic[])`·`pickWeightedRelics` 타입 → 24파일 `stats: any` 교체 | Opus | ~99 any 제거, 런타임 변경 0 |
| B3 | `PlayerStats` 인덱스 시그니처 제거 + 미선언 5필드 선언(`maxKillStreak/escapes/claimedQuestIds/discoveryChains/syntheses`), `lowHpWins` 제거 검토 → 이후 `Player` 본체 | Opus | 실제 에러 표면화 예상. 단계적 |
| D1 | 플레이어 호출 정찰: "정찰" 버튼(비용: 골드 또는 보스 게이지 1틱) → 기존 `scoutEvents`/`eventActions:182-267` 파이프 재사용, 거울 노드 "정찰 충전" | Opus | 탐험 전 결정 0 → 1 |
| D2 | 전투 후 2택 "밀어붙인다/물러선다": `tempBuff` + `advanceBossGauge` / 부분 회복 + 연속 처치 리셋 | Opus | 전투 후 결정 0 → 1 |
| E1 | 에러 리포터: 로컬 링버퍼(최근 20건, gameStorage) + 제품 텔레메트리 이벤트 + SystemTab "저장과 기기 점검"에 노출. 외부 sink 없음 | Sonnet | 백엔드 없이 데이터 보존 |
| E2 | `useFirebaseSync` 리더보드/live-config 구독 분리 + 자동저장 경로 실행 테스트 1건 | Opus | 4관심사 → 3 |
| F1 | CLAUDE.md 실측 동기화(§3 트리, §4 명령, §7 카운트, §8.1 재작성), `implementation_plan.md` → `docs/archive/`, Pillow 버전 `requirements-art.txt` 고정 | Sonnet | Wave 1·2 머지 후 카운트 재측정 |

### Wave 3 — 후보 (이번 트랙 제외)

- AI 이벤트 outcome 어휘 확장(relic/curse/elite) + HP 클램프 `≥1` 완화 + 후반 풀 6→12
- 첫 방문 보상 31맵·드롭 테이블 105몬스터 저작
- Tier-3 직업 스킬 분기(2택 → 4택)
- 정적 가드 테스트 62파일 → 행동 테스트 전환
- `exploreUtils` dispatch 함수 6개 → `hooks/gameActions/` 이동, 한국어 리터럴 키 468건 → 원소 부분집합부터 `ElementKey`

---

## 4. 검증 게이트 (PR 공통)

1. `npm run type-check && npm run lint && npm run test:unit` — 아트 파이프라인 8건 환경 실패는 허용, **그 외 신규 실패 0**
2. `npm run build:guard`
3. 데이터/밸런스 변경 시 `progression:simulate` 비교 (`scripts/compare-progression.mjs`)
4. UI 변경 시 해당 e2e 스펙 갱신 (390×844)
5. 정적 가드 테스트가 깨지면 **가드를 지우지 말고** 새 구조에 맞게 재작성

---

## 5. 리스크

| 리스크 | 완화 |
|---|---|
| C1 마이그레이션이 기존 유저 rank를 낮춤 | rank는 `max(기존 rank, floor(lifetime/150))`로 단조 보장 |
| A1로 초반 TTD 하락 | `statusOnHit` 발동은 heavy hit 한정(기존 리더 로직 유지). 밸런스 계약 테스트가 회귀 감지 |
| A2로 표시 수치 변경 | 변경은 *오답 2곳을 정답 1곳에 맞추는 것*. 정적 가드 갱신 |
| Wave 1 두 트랙 머지 충돌 | 파일 집합 분리. 공통 파일은 `constants.ts`·`messages.ts`뿐 → append-only 편집 지시 |

---

## 6. 실행 결과 (2026-09-16, branch `claude/funny-rubin-xdv43e`)

| 항목 | 상태 | 비고 |
|---|---|---|
| A1 statusOnHit/phase3 전파 | ✅ | `MONSTER_STATUS_ON_HIT_CHANCE 0.08` 게이트 추가 — 무조건 발동 시 초반 물약 고갈 2.6%→14.6%(플레이어 상태이상이 전투 중 만료되지 않기 때문). 상태이상 duration은 Wave 3 후보 |
| A2 장비 비교 단일 원천 | ✅ | `getEquipmentComparison`/`getSellPrice`/`pickBestEquippable` |
| A3 희귀도 단일 모듈 | ✅ | `titles.ts` 별칭 제거 |
| C1 정수 원장 + 거울 확장 | ✅ | `DATA_VERSION 5.1`. 트리 14,570 정수(정찰 노드 포함). rank 상한 조정 노브는 `ESSENCE_PER_RANK` |
| C2 유물 곡선 + pity | ✅ | epic+legendary 가중 7.9%→17.3% |
| C3 보스 게이지 HUD | ✅ | `expeditionHud.ts` |
| E1 에러 리포터 | ✅ | 로컬 링버퍼. 텔레메트리 enum 확장은 미실시 |
| D1 플레이어 호출 정찰 | ✅ | 거울 노드 `scout_charges` |
| D2 전투 후 2택 | ✅ | `AT.RESOLVE_POST_COMBAT_CHOICE` |
| **D3 전투 결과 카드 프로덕션 연결** | ✅ | 계획에 없던 발견: 카드가 `payload: null`로 QA 주입 전용이었음. smoke desktop/mobile 통과 |
| B1 기계적 any 정리 | ✅ | CombatEngine mixin `this` 패턴 5곳은 의도적 유지 |
| B2 FullStats | ✅ | `stats: any` 잔여 0. 잠재 버그: `StatsPanel.tsx:58` trait null 무가드, `ControlPanel/MapNavigator` 죽은 stats 폴백 |
| B3 Player 인덱스 시그니처 | ✅ | `types/player.ts` 0개. 잠재 버그: `GravePanel.tsx:55` `player.uid` 미기록 → 자기 무덤이 공개 목록에 노출, `quests.ts` `target: 'Level'` 대소문자 |
| E2 useFirebaseSync 분리 | ✅ | 581→501 LOC, 자동저장 실행 테스트 10건 |
| F1 문서 동기화 | ✅ | CLAUDE.md §2/§3/§4/§6/§8.1, `implementation_plan.md` 아카이브 |

**최종 게이트**: type-check 0 · lint 0 · unit 3,976/3,986 (실패 10건 = Pillow 픽셀 재현성 9 + iOS archive exit 127, 전부 환경 의존) · build:guard ok · `: any` 1,494→1,256 · `as any` 100→77.

**환경 메모**: 아트 파이프라인 테스트는 원 생성 환경(Pillow 버전·플랫폼)에 결합돼 있다. Pillow 11.3/12.0/12.3 모두 실패 집합이 다름 → 생성 시 Pillow 버전을 provenance에 기록하고 재현성 테스트를 `AETHERIA_ART_REPRO=1` 같은 opt-in으로 두는 것을 권장(Wave 3).

---

## 7. Wave 3 계획 (2026-09-16 착수)

**핵심**: Wave 1~2가 "저작된 것을 발동시키기"였다면 Wave 3는 "결과가 실제로 아프고 달콤하게" + "테스트가 CI에서 진실을 말하게"다. 콘텐츠 저작은 기존 곡선·어휘에서 파생시켜 밸런스 편차를 시뮬레이터로 고정한다.

| 선택지 | 얻는 것 | 잃는 것 | 실패 시나리오 |
|---|---|---|---|
| **I. AI 이벤트 결과 어휘 확장** | 이벤트가 ±골드가 아니라 유물/상태이상/정예/버프로 분기 → 선택이 의미를 가짐 | outcome 검증 표면 증가(모델 출력 신뢰 불가 → 엄격 화이트리스트 유지) | 이벤트로 죽으면 "부당한 죽음" 규칙 위반 → HP 클램프 ≥1 유지, 위험은 상태이상/정예로만 |
| **J. 콘텐츠 패리티(첫 방문 31맵·드롭 105몬스터)** | 후반 52맵이 저작된 것처럼 느껴짐 | 골드/EXP 인플레 위험 | `progression:compare` 편차 ±10% 초과 시 곡선 재적합 |
| **H. 상태이상 만료 + 리팩토링 잔여** | 한 번 중독 = 전투 끝까지 4%/턴 구조 해소 → `statusOnHit` 게이트를 정직한 값으로 | 밸런스 계약 재검증 | 만료를 넣고 게이트를 올리면 초반 물약 고갈 계약(≤5%) 재위반 → 시뮬로 고정 |
| **K. CI 진실성** | CI unit job이 Pillow 없이 아트 테스트 105건을 실패시키고 있음(ci.yml에 pip 단계 없음) → 그린 복구 | 재현성 테스트 9건을 opt-in으로 낮춤 | 원 생성 환경 Pillow 버전을 모름 → provenance에 기록하는 것부터 |

| 트랙 | 항목 | 모델 | 파일 경계 |
|---|---|---|---|
| **H** | H1 플레이어 상태이상 만료 턴(`PLAYER_STATUS_DURATION_TURNS`) · H2 `settleNonVictory` 중복 제거 · H3 `handleVictory` inline 숫자 8개→BALANCE · H4 엔진/리듀서 한국어 하드코딩→MSG · H5 잠재 버그(GravePanel `uid`, StatsPanel trait null, adventureGuide 죽은 폴백, quests `'Level'`) | Opus | combatHandlers, CombatEngine.{status,actions,outcome}, combatActionTurn, exploreUtils(상단), exploreActions, gameReducer, GravePanel, GameRoot, StatsPanel, ControlPanel, MapNavigator, adventureGuide, quests |
| **I** | I1 `normalizeOutcomes` 어휘 확장(relic/status/elite/buff, 엄격 검증) · I2 절차적 outcome에 위험 선택 특수 결과 확률 · I3 후반 풀 5종 6→12 저작 · I4 `eventActions:104` MSG | Opus | aiEventUtils, eventActions, aiService, 풀 데이터, tests |
| **J** | J1 `FIRST_VISIT_REWARDS` → `data/firstVisitRewards.ts` · J2 31맵 저작(기존 21개 곡선 적합) · J3 105몬스터 드롭(지역 테마·기존 소재명만) · J4 `progression:compare` ±10% | Sonnet | firstVisitRewards(신규), exploreUtils(하단 블록만), dropTables, loot, tests |
| **K** | K1 CI Pillow 설치 + 재현성 9건 `AETHERIA_ART_REPRO=1` opt-in + iOS 도구 부재 skip · K2 `perf:guard` CI job(continue-on-error) · K3 유물 3택 e2e · K4 `FeedbackValidator` 테스트 | Sonnet | ci.yml, requirements-art.txt, 아트/iOS 테스트 skip 가드, tests/e2e/relic-choice.spec.ts, tests/feedback-validator.test.js |
| **L** (H~K 머지 후) | 잔여 인덱스 시그니처 23개(`relic/item/monster/map/quest/class`) + hook/handler `p: any` 로컬 | Opus | types/*, hooks, handlers |

### 7.1 Wave 3 실행 결과 (2026-09-17)

| 항목 | 상태 | 비고 |
|---|---|---|
| H1 상태이상 만료 | ✅ | `PLAYER_STATUS_DURATION_TURNS 3`, `player.statusTurns`(적 모델 미러). 게이트 0.08→0.15에서 물약 고갈 4.8%(≤5% 계약 유지). 이벤트 상태이상 turns도 동일 경로로 연결 |
| H2 `settleNonVictory` | ✅ | 사망/도주 성공·실패/소모품 5경로 필드별 동치 증명 |
| H3 inline 숫자→BALANCE | ✅ | handleVictory 6개 + 이상기후 0.3 |
| H4 엔진/리듀서 MSG화 | ✅ | eventActions 포함 하드코딩 한국어 0건 |
| H5 잠재 버그 | ✅ | **자기 무덤이 공개 침입 목록에 노출**(실제 결함, `uid` 배선), StatsPanel trait null, adventureGuide 죽은 폴백, `'Level'`은 버그 아님(별도 분기 존재) → 소문자 통일 |
| I1 outcome 어휘 | ✅ | relic/status/elite/buff, 화이트리스트 `EVENT_STATUS_IDS` 4종(freeze/stun 제외), HP 클램프 ≥1 유지, 소비 순서 수치→상태/버프→유물→정예 |
| I2 위험 선택 특수 결과 | ✅ | 발생 0.318(목표 0.35), safe/retreat 0건, 저생명 시 elite→status 강등 |
| I3 후반 풀 6→12 | ✅ | 5지역 30종, 지역당 저작 outcome 4종. 풀 데이터 `data/aiEventPools.ts` 분리, `functions/api/ai-proxy.js` 스키마 동기화 |
| J1~J3 콘텐츠 패리티 | ✅ | 첫 방문 21→51 지역(`gold≈86·L^0.53`, `exp≈32·L^0.75`), 드롭 119→247 몬스터(무한 심연 회전 보스 7종 의도적 예외) |
| J4 밸런스 증명 | ✅ | 시뮬레이터는 첫 방문 보상을 모델링하지 않음(해시 불변 실측). 첫 방문 골드/지역 평균 몬스터 골드 비율 [5.56, 8.65] ⊂ 기존 [4.31, 8.93] |
| K1 CI 진실성 | ✅ | `requirements-art.txt`(pillow 12.3.0) + pip 단계, 재현성 9건 opt-in, iOS PlistBuddy 부재 skip → `test:unit` exit 0 |
| K2 perf CI | ✅ | non-blocking job. 부수 발견: `perf-guard.mjs` 번들 chromium fallback 도달 불가 → 수정 |
| K3 유물 3택 e2e | ✅ | chromium으로 3/3 검증(webkit 미설치) |
| K4 FeedbackValidator | ✅ | 9건 |
| L 타입 슬라이스 2 | ✅ | `src/types` 인덱스 시그니처 0, 리터럴 유니온(`RelicEffect` 61 등), `tests/data-shape-types.test.js`가 데이터↔타입 계약 검증. `Relic.val`만 `any` 잔류(131 call-site 변경 필요) |
| L 후속 | ✅ | 현상수배 풀의 시즌 지역 제외를 NaN 우연에서 명시 조건으로 |

**최종 게이트**: type-check 0 · lint 0 · unit 4,074/4,083 (실패 0, skip 9) · build:guard ok · `: any` 1,494→1,220 · `as any` 100→67 · 소스 277파일/51k LOC · 테스트 229파일/3,992케이스.

**남은 후보 (Wave 4)**: `Relic.val` 유니온화(131 call-site), Tier-3 직업 스킬 분기, 정적 가드 62파일 행동 테스트 전환, `exploreUtils` dispatch 함수 6개 이동, `minLv`/`pattern.statusEffect` 죽은 리더 정리, `moveActions`가 첫 방문 item 보상을 소비하지 않는 점(데이터에 item 필드 부재로 현재 무해), 잔여 `: any` 1,220(대부분 `.map/.filter` 콜백 파라미터와 컴포넌트 props).

---

### 7.2 `codex/release-complete-core` 병합 정정 (2026-09-17)

Codex 메인라인을 베이스로 Wave 1~3을 얹으면서 아래 항목은 **Codex 결정을 채택하고 우리 쪽을 철회**했다.

| 항목 | 판정 | 근거 |
|---|---|---|
| J3 드롭 테이블 105종(+보스 24) | **철회** | Codex `normalBonusPool`(CombatEngine.loot)이 같은 105종에 지역 레벨 티어 **일반 장비**를 준다. 이 경로는 `DROP_TABLES` 엔트리가 없을 때만 도달하므로(강화 테이블 분기는 early-return) J3를 남기면 Codex가 저작한 장비 드랍을 105종에 대해 통째로 막는다. 같은 목표의 두 해법 → 베이스 채택 |
| K1 `AETHERIA_ART_REPRO=1` opt-in 9건 | **철회(skip 제거)** | Codex 1a0e2ac(Pillow 12.1.1 고정) + 8c9935f/a2e9bbc(디코드 픽셀 동치 재구성)로 Linux에서 136/136 통과 확인 |
| K1 iOS PlistBuddy skip | **철회(skip 제거)** | Codex 8c9935f가 `ios-archive.sh`를 PlistBuddy → Python `plistlib`로 바꿔 이식성 확보. Linux에서 4/4 통과 |
| C2 유물 가중치 40/30/18/9/3 | **유지** | Codex는 *개별 유물의 등급*(undying uncommon→epic)을, 우리는 *등급별 가중치 곡선*을 바꿨다 — 층위가 달라 양립. Codex 의도(제시 확률 대폭 하락)는 3.2배 감소로 유지되며 `relic-balance-audit` 기대값만 병합 후 실측으로 갱신 |
| I3 EventPackage 허용 목록 | **유지(단, source 권한은 Codex)** | 우리 허용 목록이 Codex의 예약 필드 차단을 포함하는 상위집합. `source`는 호출자 컨텍스트 권한이라는 Codex 결정을 따른다 |
| E2 `createCloudAutosave` 분리 | **유지(본문은 Codex)** | 구조(주입형 분리)는 우리 것, 본문은 Codex `buildCloudPlayerSnapshot` + `archivedHistory` 죽은 배관 제거 |

**병합 후 게이트**: type-check 0 · lint 0 err(경고 3, 병합 전 동일) · build:guard ok · unit 4,716/4,726(실패 10, skip 0) — 실패 10건은 전부 **Codex와 바이트 동일한 테스트 파일**의 환경 의존:
Playwright 크로미움 미설치 9건(`damage-feedback-restore` 4 · `monster-source-preflight` 5, 샌드박스에서 브라우저 다운로드 차단)과
`monster-catalog-art` 1건(생성 PNG 254장 **픽셀 전부 동일**, 인코딩 바이트만 20장 상이 — macOS 생성 자산 대 Linux 인코더 차이. Pillow 12.1.1/12.3.0 모두 동일하게 실패).

---

## 8. Wave 4 계획 (2026-09-17 착수) — "완성" 기준

**핵심**: Wave 1~3는 감사가 지목한 결함을 닫았다. Wave 4는 *다시 벌어지지 않게* 만드는 장치(ratchet·lint 승격·행동 테스트)와, 남은 구조적 부채 2개(계층 역전·`Relic.val`), 엔드게임 빌드 선택지, 그리고 **브랜치 전체를 실브라우저 게이트로 증명**하는 것이다.

| 선택지 | 얻는 것 | 잃는 것 | 실패 시나리오 |
|---|---|---|---|
| **N. `exploreUtils` 계층 정상화** | 탐험 핵심 644 LOC가 dispatch 없이 테스트 가능 | importer 31곳 갱신·정적 가드 재앵커 | 이동 중 함수 하나가 다른 시그니처로 바뀌면 탐험 루프 전체 회귀 → 이동 전후 seeded 동치 테스트 |
| **O. 엔드게임 빌드 선택지** | Tier-3 6직업이 Tier-1(6택)과 같은 빌드 agency | 스킬 저작 7개 | 새 효과 id를 쓰면 엔진이 무시 → `ClassSkillEffect` 30종 안에서만 |
| **M. `Relic.val` 유니온** | 마지막 `any` 타입 필드 제거 | 131 call-site에 `typeof` 분기 | 분기가 값 해석을 바꾸면 유물 효과 회귀 → 순수 accessor 헬퍼로 의미 고정 |
| **P. 회귀 방지 장치** | `any`/인덱스 시그니처/하드코딩 재증가 차단, `exhaustive-deps` error | 정적 가드 10파일 전환 비용 | ratchet 기준값을 올리는 커밋이 들어오면 무의미 → 기준값 인하만 허용한다는 주석 |
| **V. 실브라우저 전체 게이트** | smoke desktop/mobile + e2e 전량 + perf 예산을 브랜치 전체에 대해 증명 | webkit 부재로 chromium 대체 | 엔진 차이 실패 3종(변경 전 동일)을 앱 회귀로 오판 → 기준선 비교 |
| **R. 적대적 diff 리뷰** | 52커밋의 런타임 변경(상태이상 만료·카드 게이팅·마이그레이션·outcome)에 대한 독립 검토 | 리뷰어 토큰 | 확인 안 된 의심을 버그로 보고 → CONFIRMED만 수정 |

| 단계 | 트랙 | 모델 | 파일 경계 |
|---|---|---|---|
| 4a 병렬 | N1 dispatch 함수 6개 → `hooks/gameActions/exploreFlow.ts` · N2 `useGameEngine` actions memo 안정/가변 분리 · N3 죽은 리더(`minLv`, `pattern.statusEffect`) 제거 | Opus | exploreUtils, gameActions/*, useGameEngine, enemyAI, combatForecast, mapTopology, moveActions, MapNavigator, types/{map,monster} |
| 4a 병렬 | O1 Tier 2~3 직업 분기 스킬 ≥2개 · O2 빌드–유물 공명(`pickWeightedRelics` 가중 편향, `RELIC_BUILD_FIT_WEIGHT_MULT`) | Opus | classes/skillBranches 데이터, relics.ts, relicBuildFit, _helpers, characterActions, eventActions |
| 4a 병렬 | P1 ratchet 테스트 · P2 `exhaustive-deps` error · P3 정적 가드 10파일 → `react-dom/server` 행동 테스트 · P4 공용 렌더 헬퍼 | Sonnet | tests/**, eslint.config.js |
| 4b | M `Relic.val` → `number \| RelicVal` + accessor 헬퍼 | Opus | types/relic.ts, CombatEngine.*, statsCalculator, exploreFlow |
| 4c 병렬 | V 전체 게이트 실행·수정 · R 적대적 리뷰·확정 버그 수정 | Opus | 결과에 따름 |

### 8.1 베이스 교정 + Wave 4 실행 결과 (2026-09-17)

**베이스 교정**: 사용자 로컬(Codex) 작업이 `codex/release-complete-core`(main+41)로 푸시된 것을 확인하고, 이 브랜치를 그 위에 재구성했다(merge `45a94ba`, 32파일 충돌 해소, 정책: 의미 충돌은 Codex 우선). 되돌린 것: J3 드롭 테이블(Codex `normalBonusPool`과 목적 중복), 아트 재현성 skip 9건·iOS skip(Codex의 Pillow 12.1.1 고정 + 디코딩 픽셀 비교로 실제 통과). `DATA_VERSION 5.1` 유지, `api/` 삭제 수용.

| 항목 | 상태 | 비고 |
|---|---|---|
| R 적대적 리뷰 | ✅ | 확정 3건 수정: AI 이벤트 패키지가 `...raw`로 모델의 라우팅 플래그(`isScout`/`isBossGaugeChallenge`/`_chainId`)를 통과시킴 → `EventPackage` 허용 목록; 마이그레이션 `null` 가드; 정찰 이중 실행(N1b에서 해결). 반증 목록은 R 보고서 기준 |
| N1 계층 정상화 | ✅ | dispatch 소비 함수 6개 → `hooks/gameActions/exploreFlow.ts`, `exploreUtils.ts` 634→244 LOC·reducer import 0. 이동 전후 seeded dispatch 시퀀스 동치 테스트 18건 |
| N1b 정찰 단일 전이 | ✅ | `AT.RESOLVE_SCOUT` + `handlers/exploreHandlers.ts`, 연타 시 두 번째 dispatch는 동일 state 객체 |
| N2 actions memo 분리 | ✅ | 안정 그룹 deps `[uid]`, `react-hooks/refs` 경고 3건 해소(모듈 스코프 시퀀스) |
| N3 죽은 리더 | ✅ | `GameMap.minLv`(리더 5곳), `MonsterPattern.statusEffect/statusChance` 제거, 데이터 테스트로 0건 고정 |
| O1 엔드게임 분기 | ✅ | Tier 2~3 전 직업 분기 스킬 ≥2, 기존 효과 id만 사용 |
| O2 빌드–유물 공명 | ✅ | `pickWeightedRelics({ buildId })`, `RELIC_BUILD_FIT_WEIGHT_MULT`; 무 buildId 경로 바이트 동일 |
| P1 래칫 | ✅ | any/as any/인덱스 시그니처/한글 리터럴/`Math.random` 상한. 병합 베이스 실측으로 재고정 |
| P2 lint | ✅ | `exhaustive-deps` error, 전체 0 problems |
| P3 정적 가드 전환 | ✅ | signature 10파일 → `react-dom/server` 렌더 단언 33건 |
| M `Relic.val` | ✅ | effect 판별 유니온(34 numeric / 23 dict / 4 valueless), 호출부 수정 0, 증빙 reportHash 불변 |
| V 실브라우저 게이트 | ✅ | smoke desktop/mobile 통과. 초상화 실패는 앱 회귀가 아니라 smoke의 이미지 로드 레이스(베이스에 1.5s 지연 주입 시 동일 실패 재현) → 로드 대기 후 단정. 브랜치 회귀 3건 수정(터치 타깃 36→44/44→48px, e2e 결과 카드 닫기). e2e 119/121(실패 2건은 베이스 동일: 샌드박스 프록시 외부 요청, chromium 서브픽셀). perf 예산 전 항목 통과(수치 V 보고서), 단 이 chromium은 FCP 엔트리를 만들지 않아 정규 `perf:guard`는 베이스도 실행 불가 |

**최종 게이트** (문서 커밋 직전 HEAD `63f…`→ 최종 `dd6f578` 기준, main+118): type-check 0 · lint 0 problems · unit 4,786/4,787(실패 1 = `monster-catalog-art` macOS PNG 바이트) · build:guard ok · smoke desktop/mobile ok · e2e 119/121.

**남은 후보 (Wave 5)**: `natural-exploration-rhythm` e2e의 외부 요청 허용 목록, `system-settings-design:101` 서브픽셀 허용치, `Player.quests/status/history: any[]` 타입화, `low_hp_atk` 숫자 val 레거시 경로 정리, `exp_mult` 스택 정책 통일, 정적 가드 잔여 ~40파일, 잔여 `: any` ~1,290(주입 경계·콜백 파라미터).

### 8.2 PR #31 CI 그린 작업 (2026-09-17)

- `main`(`d8a111e`)의 CI는 이전부터 실패 상태였다(unit job에 브라우저가 없어 Codex의 렌더 검증 테스트 9건이 `chromium.launch()` 실패 + `monster-catalog-art` PNG 바이트 동일성 1건).
- unit job에 `npx playwright install --with-deps chromium` 추가 → 9건 해소.
- `monster-catalog-art` 재현성 판정을 사용자 승인 하에 **디코딩 RGBA 픽셀 동일성**으로 전환(manifest의 파일별 sha256 ↔ 추적 파일 바이트 결합은 그대로 검증, `entries[*].sha256`만 비교에서 제외). 장비/시그니처 아트의 `a2e9bbc` 계약과 동일한 방식.
- **E2E 첫 CI 실행(head `e0a487a`, Linux headless WebKit) 판정** — 121건 중 2건 실패, 둘 다 브랜치 회귀가 아니다.
  - `natural-exploration-rhythm` (3/3): CI는 더미 Firebase config(`apiKey: "e2e-key"`)로 빌드하는데, `?e2e=1` mock 모드여도 `firebase/auth` 초기화가 `getProjectConfig` 1회를 실제 googleapis.com으로 보내 400 → 스펙의 콘솔/응답 오류 수집기에 그대로 잡혔다(오프라인 러너에선 같은 요청이 `requestfailed`). 앱 표면 오류가 아니므로 Firebase/Google 인프라 호스트(googleapis.com·firebaseapp.com·firebaseio.com·apis.google.com·gstatic.com)만 수집에서 제외(`56a5cf5`). 앱 origin 4xx·pageerror·AI proxy 미호출 검사는 유지.
  - `progression-acceptance:56` (3/3): "성장 변경" 클릭으로 `AnimatePresence`/`Motion.div`가 마운트된 직후, 분기 카드 클릭이 "waiting for element to be visible, enabled and stable"에서 30s 무로그 hang. Playwright 1.59의 안정성 검사는 rect가 두 rAF 사이에 달라지면 즉시 `not stable` 로그 + 재시도하므로(`_checkElementIsStable`), 로그 부재 = **WebKit에서 rAF 콜백이 멈춘 것**(스크린샷·ARIA 스냅샷은 정상 캡처 → 메인 스레드는 살아 있음). 같은 빌드를 chromium(iPhone 12 에뮬레이션)에서 4/4 통과, `SkillTreePreview.tsx`는 이 브랜치에서 무변경. 업스트림 열린 결함 microsoft/playwright#33057(Ubuntu 24.04 headless WebKit click hang, `upstream` 라벨, 22.04에선 통과)과 증상 일치. `ubuntu-22.04` 러너는 2026-09-17부터 deprecation·brownout이라 회피 불가.
  - **결정**: e2e 프로젝트의 엔진을 이름 그대로 `chromium`으로 고정(`defaultBrowserType: 'chromium'`, CI에서 webkit 설치 제거). 게이트는 결정적이어야 하고 Linux WPE WebKit은 어차피 iOS WebKit이 아니다 — WebKit 실기기 검증은 `device-qa/`·`ios:build:device`가 맡는다. chromium DPR3 분수 레이아웃으로 `system-settings-design:101`이 0.09px 넘치던 단정은 레포의 다른 overflow 검사와 같은 1px 허용치로 정렬. 대안으로 검토한 `xvfb-run` headed WebKit은 원인 미상의 업스트림 결함 우회라 flaky 재발 위험이 남아 채택하지 않음.
  - CI의 Playwright 실패 아티팩트 업로드가 `playwright-report/`(reporter가 `list`뿐이라 생성 안 됨)만 가리켜 아무것도 보존하지 못하던 dead step → `test-results/`(스크린샷·error-context·trace) 추가(`8975117`).
  - **non-blocking perf guard 노이즈**: 앱 변경 없는 세 head(`e0a487a` 통과 → `8975117` desktop 실패 → `f6dc87f` mobile 실패)에서 `page.waitForFunction: Timeout 10000ms` 로만 갈렸다. 통과 실측은 boot-ready 87ms·FCP 572ms라 앱 마크가 늦는 게 아니라 `first-contentful-paint` 엔트리가 러너에서 늦거나 안 오는 쪽이 유력하지만, 세 조건을 한 대기에 묶고 무엇이 빠졌는지 남기지 않아 확정 불가였다 → 대기를 앱 마크(10s)·FCP(10s)로 분리하고 타임아웃 시 paint 엔트리·마크·visibilityState 를 출력(`e4de7c3`). 진단 결과(`e4de7c3` desktop): `first-paint@336`, boot-ready 162ms, intro-visible 162ms, visibility `visible`인데 `first-contentful-paint`만 10s 부재 — **Chromium 은 `opacity: 0` 서브트리의 페인트를 FCP 로 집계하지 않고 compositor 전용 opacity 애니메이션은 paint timing 을 만들지 않는다**(`IntroScreen` `initial={{ opacity: 0 }}` 0.35s fade-in). 통과 실행은 부팅 뒤 우연한 main-thread repaint 가 FCP 를 기록한 경우다. 회귀가 아니라 측정 공백이므로 guard 는 first-paint·앱 마크·visible 이 모두 갖춰진 경우에 한해 FCP 예산만 이 실행에서 제외하고(`metrics.fcpMeasurementGap` 기록, 경고 출력) 나머지 9개 예산은 그대로 검증한다. 예산 수치는 변경 없음.
  - **Wave 5 후보(제품)**: 인트로/루트 fade-in 은 실사용자 FCP·LCP 도 같은 이유로 늦게 잡히거나 누락되게 만든다(체감 첫 페인트 +0.35s). opacity 대신 측정에 잡히는 reveal(예: 배경만 fade, 텍스트는 즉시)로 바꾸면 FCP 예산을 다시 무조건 검증할 수 있다.

---

## 9. Wave 5 계획 (2026-09-17 착수, 베이스 `main` = `0205301` = PR #31 merge commit)

**핵심**: Wave 1~4로 "저작된 콘텐츠가 발동하지 않는" 결함(G1~G11)은 닫혔다. 남은 것은 (a) 측정 불가능한 것을 측정 가능하게, (b) 타입 경계의 마지막 구멍(`Player`의 `any[]` 3개), (c) 리팩토링 때마다 깨지는 정적 가드를 행동 테스트로, (d) `: any` 밀집 구역 한 슬라이스다. 신규 콘텐츠는 넣지 않는다 — 판정표(§2) 기준 A(연결)·B(경제)는 소진됐고, 이번 Wave는 C(타입)·테스트 진실성·측정이다.

**재검증으로 탈락한 후보**: `low_hp_atk` "미소비" — 오판. 61개 `RelicEffect`·28개 `ClassSkillEffect` 전부 systems/hooks/utils 소비처가 있다(`statsCalculator.ts:357 lowHpAtkMult`). 심연 데일리 다이브 HUD — Wave 4에서 `getAbyssDiveChip`로 이미 노출.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **W1 인트로 reveal** | `IntroScreen` 루트 `initial={{ opacity: 0 }}` 제거 — 배경 이미지만 fade, 텍스트·입력·버튼은 첫 프레임부터 그린다 | Chromium/Safari 모두 FCP·LCP가 실제 첫 콘텐츠에 잡힘, 체감 첫 페인트 −0.35s, perf guard FCP 예산 무조건 검증 복귀 | 인트로 연출 미세 변화(배경만 서서히) | 루트가 아닌 자식 컨테이너에 opacity 0을 옮기면 같은 문제 재발 — 텍스트 조상 어디에도 opacity 0 금지 | sonnet |
| **W2 `Player` any[] 3개** | `quests?: PlayerQuestProgress[]`(`{id, progress, startExploreCount?}`), `history?: PlayerEventHistoryEntry[]`(`{event, choice, outcome}`), `status?: StatusId[]`(상태이상 id 닫힌 집합) | `player.quests[i].오타`·history 필드 드리프트가 컴파일 에러, AI 이벤트 컨텍스트 계약 고정 | tsc 표면화 오류 수십 건 정리, 세이브 호환은 유지(형태 불변) | 레거시 세이브의 `status`가 배열이 아닌 문자열인 경로(`consumableEffect.ts:127`)를 타입으로 없애면 런타임 깨짐 → migrate에서 정규화하고 타입은 배열로 | opus |
| **W3 정적 가드 → 행동 테스트** | 순수 소스 텍스트 정규식 가드 40파일 중 UI/행동 성격 ~18파일을 `tests/helpers/render.ts` 렌더 단언 또는 순수 함수 호출로 전환. 구조 불변식(dead plumbing 부재 등)은 유지하고 사유 기록 | 리팩토링(클래스명·마크업 변경)에 깨지지 않고 실제 회귀만 잡음 | 테스트 저작, 일부는 `data-testid` 추가 | 원래 가드가 지키던 계약을 놓치면 회귀가 통과 — 파일마다 "원 계약 → 새 단언" 대응표 필수 | sonnet ×2 |
| **W4 `exp_mult` 일관성** | `CombatEngine.outcome.ts:98` `relics.find`(첫 번째) → `getStrongestNumericRelicValue`(gold_mult와 동일 정책) + 테스트 + 증빙 JSON 재생성 | 유물 순서에 따라 EXP 배율이 달라지는 비결정 제거 | 증빙 2건 재생성 | 스택(합산)으로 바꾸면 gold와 정책 불일치 — 최강값 1개 정책으로 통일 | 직접 |
| **W5 `: any` utils 슬라이스** | W2 머지 후. `aiEventUtils`(35)·`questOperations`(27)·`graveUtils`(25)·`gameUtils`(24)·`adventureGuide`(22)·`expeditionMissionFocus`(18)·`expeditionLedger`(17)·`equipmentUtils`(17) ≈ 185건을 도메인 타입으로 | 퀘스트·무덤·상점 로직(실제 버그가 났던 영역)의 오타 컴파일 차단 | 기계적 작업, 래칫 재고정 | `as any`로 우회하면 무의미 — `as any` 신규 0 규칙, 래칫 `AS_ANY_BASELINE`은 내리기만 | sonnet ×2 |
| **W6 문서** | CLAUDE.md 수치, `tasks/todo.md` 원장(PR #31 그린·머지·Wave 5), 이 문서 §9.1 결과 | — | — | — | 직접 |

**순서**: W1·W2·W3·W4 병렬(파일 집합 분리: 컴포넌트 1개 / types+소비처 / tests / engine) → W2 머지 후 W5 → 전체 `npm run verify` + e2e(chromium) → W6 → PR.

**게이트**: type-check 0 · lint 0 · unit 전량(skip 0) · `tests/debt-ratchet.test.js` 기준선 하향 재고정 · e2e 121/121 · perf guard FCP 실측(측정 공백 경고 0회가 W1의 완료 조건).

### 9.1 Wave 5 실행 결과 (2026-09-17, branch `claude/funny-rubin-xdv43e`, 최종 head 아래 표 참조)

| 트랙 | 상태 | 결과 |
|---|---|---|
| W1 인트로 reveal | ✅ | 루트 `Motion.section` → 평범한 `<section>`(첫 프레임 opacity 1), 배경 `<img>`만 0.35s fade. perf guard desktop/mobile 각 3회 FCP 실측(552~684ms), 측정 공백 경고 0회. e2e intro 5/5. `intro-visual-contract`에 "루트 opacity 0 금지" 회귀 단언 추가. 콘텐츠 블록 transform 진입은 e2e 레이아웃 단정(`controlsBottom ≤ viewport+1`)과 경합할 수 있어 보류 |
| W2 `Player` any[] 3개 | ✅ | `QuestProgressState`(카탈로그 진행 + 현상수배 전용 optional 필드) · `StatusId` 8종 리터럴 유니온(단일 정의 테이블이 없어 monsters `statusEffect`/`statusOnHit` + `BALANCE.EVENT_STATUS_IDS` + exploreFlow 이상기후의 합집합으로 도출, 라벨 테이블 3곳과 일치) · `EventHistoryEntry`. tsc 표면화 9건 정리(`MSG.QUEST_DONE` 등 3개 시그니처를 `string \| undefined`로 — 기존 `QUEST_ACCEPTED` 선례). 레거시 스칼라 `status`는 `migrateData`가 배열로 정규화(부재 시 무접촉 → `DATA_VERSION` 불변). **실제 dead-read 버그 3건 수정**: `Dashboard` 수령 가능 퀘스트 배지가 존재하지 않는 `done/claimed` 필드를 읽어 영구 false, `DashboardMobileSummary` "퀘스트 0/N" 고정, AI 이벤트 컨텍스트 `activeQuests`가 `[undefined, …]`(카탈로그 퀘스트 상태엔 title이 없음) |
| W3 정적 가드 → 행동 테스트 | ✅ | 18파일(A 9 + B 9) → `renderStatic` 렌더 단언·순수 함수 호출로 전환(142 케이스), `src/` 무변경. 구조 불변식(dead plumbing 부재, `useMemo` deps, 포털 컴포넌트, DOM 게이트 effect, 셸/빌드 스크립트)은 "구조 불변식(소스 텍스트)" 라벨로 유지·사유 기록. 변이 테스트 4건(터치 타깃 44→36px, `status: []` 제거, 시그니처 배지 조건, testid 개명)으로 새 단언이 실제 회귀를 잡는 것 확인 |
| W4 `exp_mult` | ✅ | `getStrongestNumericRelicValue` 정책, 순서 무관·합산 아님 테스트, 증빙 재생성 |
| W5 utils 8파일 | ✅ | 8파일 모두 `: any`/`as any` 0 (185건 → 0). stale 캐스트 4건 제거(`Player.maxInv`·`seasonPass.tier`·`stats.explores/visitedMaps/escapes`·`PREMIUM_SHOP.cosmeticTitles` — 전부 이미 선언된 필드). `mapData.level >= 20`의 타입-런타임 불일치 1건을 `Number()`로 정정(의미 동일). 교차 tsc 오류 1건(`combatActionTurn` skill.name) 통합 시 정리. `toArray<T = any>`(gameUtils)는 `deps: any` 호출부 ~30곳을 위한 경계 기본값 — 리터럴 `: any`가 아니며 다음 슬라이스(hooks `deps`)에서 사라진다 |
| 래칫 | ✅ | `: any` 1,581 → 1,301, `as any` 99 → 83 (하락만 허용 유지) |

**최종 게이트** (head `76953b8e` 기준, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 problems · unit **4,813 / 4,813**(skip 0) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(13.0분) · perf guard desktop/mobile ok — FCP 실측(측정 공백 경고 0회). 교훈 하나: 게이트를 병렬로 돌릴 때 `build:guard`가 자체 `npm run build`로 `dist/`를 덮어써 e2e 중반부터 테스트 API 없는 번들이 서빙됐다(51건 실패로 위장) — dist 를 공유하는 작업은 직렬로.

**남은 후보 (Wave 6)**: hooks `deps: any` 주입 경계(`createXxxActions(deps: any)` → 명시 인터페이스, `toArray<T = any>` 기본값 제거), 컴포넌트 props `any`(`ShopPanel`·`QuestBoardPanel`·`ControlPanel` 등 ~350건), systems 한글 리터럴 260건 중 데이터 키(상태이상·원소) → `StatusId`/`ElementKey` 유니온, 순수 정적 가드 잔여 22파일(아트/네이티브/Toss 증빙 계약 — 전환 가치 낮음, 유지).

---

## 10. Wave 6 계획 (2026-09-17 착수, 베이스 `main` = `911d0172` = PR #32 merge commit)

**핵심**: 남은 `: any` 1,301건 중 730건이 세 구역(hooks 272 · components 352 · reducers 104)에 몰려 있고, 셋 다 "주입 경계(`deps: any`, `actions?: any`, `payload: any`)"가 원인이다. 경계에 인터페이스를 세우면 그 아래 콜백 파라미터 `any`는 추론으로 사라진다. 동시에 systems 한글 리터럴 260건(대부분 로그 문구 + 상태이상 라벨 테이블 7중 복제, `poison`이 '독'/'중독'으로 드리프트)은 CLAUDE.md §5 MSG 규칙 위반이므로 소유권을 옮긴다.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **X1 hooks deps 경계** | `useGameEngine`이 조립하는 deps 객체(player/gameState/uid/grave/currentEvent/isAiThinking/enemy/liveConfig/dispatch/addLog/addStoryLog/getFullStats + combat 확장)를 `GameActionDeps`/`CombatActionDeps`/`InventoryActionDeps`로 선언, 13개 팩토리·`makeSharedHelpers`·`buildClassVitals` 시그니처 교체, `GameActions` 타입 export, `toArray<T = any>` 기본값 제거 | 액션 팩토리 내부 `(p: any)` 콜백이 추론으로 소멸, 컴포넌트 `actions?: any`를 닫을 타입이 생김 | tsc 표면화 다수(실제 필드 드리프트가 드러날 수 있음 — Wave 5 W2에서 3건) | deps 타입을 `Record<string, any>`로 느슨하게 세우면 무의미 — 각 필드는 `GameState`의 실제 타입 또는 명시 인터페이스 | opus |
| **X2 systems 한글 → MSG** | `src/systems/**` 로그 문구를 `MSG`로 이관(append-only), 상태이상 라벨 7중 테이블을 `MSG.STATUS_LABELS`/`MSG.DOT_LABELS`(`Record<StatusId, string>`)로 단일화 — 사용자 가시 문자열은 바이트 동일 유지(테스트가 문구를 고정) | 엔진 순수성(문구 소유는 데이터), 라벨 드리프트 컴파일 차단 | MSG 키 증가, 증빙 재생성 | 라벨 통일하며 '독'→'중독'처럼 문구를 바꾸면 e2e/유닛 문구 단정이 깨진다 — 이번 트랙은 이동만, 문구 변경 0 | sonnet |
| **X4 reducers any** | 핸들러 8파일 104건: `state.player.inv.find((entry: any)…)` 류를 `Item`/`Player`/`Quest`로, 핸들러별 payload 인터페이스 — `GameAction.payload: any`는 전역 유지(전면 유니온화는 별도 wave) | 인벤/경제/장비 핸들러(실제 버그 이력 영역)의 오타 컴파일 차단 | — | payload 유니온을 이번에 강행하면 dispatch 호출부 수백 곳이 흔들림 — 경계 안쪽만 | sonnet |
| **X3 components props** | X1 뒤. `QuestBoardPanel`(26)·`ShopPanel`(22)·`QuestTab`(19)·`ControlPanel`(18)·`RelicChoicePanel`(15)·`LegendaryCodex`(14)·`GravePanel`(14)·`EquipmentPanel`(14) = 142건을 `GameActions`·`Item`·`Player`·`Quest`로 | 렌더 경계의 오타 차단, props 계약 문서화 | — | `actions?: any`를 `Partial<GameActions>`로만 닫으면 호출부 `actions.x?.()` 체인이 그대로 — 필요한 액션만 Pick | sonnet ×2 |
| **X5 문서·래칫** | CLAUDE.md 수치, 래칫 재고정(`: any`·`as any`·systems 한글), todo 원장, §10.1 | — | — | — | 직접 |

**순서**: X1·X2·X4 병렬(파일 집합: hooks / systems+messages+라벨 소비 컴포넌트 2개 / reducers) → X3(X1 머지 후) → 증빙 일괄 재생성 → verify + e2e(chromium) → X5 → PR.

### 10.1 Wave 6 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `911d0172`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| X1 hooks deps 경계 | ✅ | `src/hooks/actionDeps.ts` 신설(타입 전용): `GameActionDeps`/`CombatActionDeps`/`InventoryActionDeps`/`InventoryActionCtx`/`AddLog`/`AddStoryLog`/`GetFullStats`/`EngineStableActions`/`EngineOwnedActions`/**`GameActions`**. `useGameEngine`의 actions 리터럴은 `satisfies GameActions`로 고정. 세션 타입(`LogEntry`/`GameEvent`/`LiveConfig`/`LeaderboardEntry`)은 `src/types/session.ts`로 분리, `GameState`가 이를 참조. 13개 액션 팩토리 + `makeSharedHelpers`/`buildClassVitals` + 나머지 훅 5개 시그니처 교체. hooks `: any` 272 → 56(그중 54는 `useGameTestApi` QA 시드 API — 프로덕션 tree-shaken, 별도 슬라이스) |
| X2 systems 한글 → MSG | ✅ | 로그 문구 이관 + 상태이상 라벨 7중 테이블 → `MSG.STATUS_LABELS`/`MSG.DOT_LABELS`(`Record<StatusId, string>`) 단일화. MSG 키 +94(append-only, `// Wave 6 X2` 구획). 가시 문자열 바이트 동일(poison '독'/'중독' 드리프트는 기록만, 문구 변경 0). systems 한글 리터럴 253 → 122 |
| X4 reducers any | ✅ | 핸들러 8파일 `: any` 104 → 9. `GameState` 필드 타입화(`logs: LogEntry[]`, `enemy: Monster \| null`, `currentEvent: GameEvent \| null`, `grave`, `shopItems: Item[]`, `leaderboard`, `liveConfig`, `quickSlots`, `pendingRelics`, `runSummary`). `GameAction.payload: any`는 계획대로 유지(유니온화는 별도 wave) |
| X3 컴포넌트 props | ✅ | 8파일 142건 → **0**: `actions?: any` → `Pick<GameActions, …>`(필요 액션만) 또는 `GameActions`(ControlPanel — 6개 자식에 통째 전달). 퀘스트/유물/버튼 행 타입은 producer의 `ReturnType`/indexed access로 도출(중복 선언 0). 부수: `signatureDropSources`·`shopRotation`·`protocolCycle`·`controlPanelConfig` 반환형 정리. 소스 텍스트를 고정하던 정규식 가드 5건은 새 시그니처/동작 단언으로 갱신 |
| X3b+ 잠복 불일치 | ✅ | X3-B가 드러냄: `seededShuffle`의 `any[]`가 `getCanonicalShopOffer` 유니온 전체를 `any`로 흡수해 `economyHandlers`의 `offer.item.jobs.includes(state.player.job)`(`job: string \| undefined`) 타입 오류를 가리고 있었다. 제네릭화 + reducer의 job 미보유 분기 명시(`includes(undefined) === false` 진리표 유지) + 할인 계산 `item.price ?? 0`(풀 243종 전부 price 보유 — 런타임 동일). 이것이 Wave 6의 논지("경계에 타입을 세우면 그 아래가 드러난다")의 실증 |
| 통합 | ✅ | X1↔X4 `gameReducer.ts` 충돌은 X4의 타입된 `GameState` 채택 + X1 중복 제거로 해소. 교차 tsc 오류 3건(`unknown[]`→`EventOutcome[]` 헬퍼, story `data: Record<string, unknown>`, `stats: FullStats`). 생산자 없는 `Monster.id?` 제거. 증빙 JSON 6건 재생성 |
| 래칫 | ✅ | `: any` 1,301 → **819**, `as any` 83 → **80**, systems 한글 260 → 122, reducers 한글 26, index signature 0, systems `Math.random` 0 (전부 하락만 허용) |

**최종 게이트** (head `1b6ad862` 기준, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 problems · unit **4,813 / 4,813**(skip 0) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(61 + 60, 13.1분) · perf guard desktop ok(FCP 572ms) / mobile ok(FCP 436ms) · 증빙 verify 7종 ok. 첫 unit 실행의 1건 실패는 X3가 바꾼 소스를 해시하는 progression 증빙이 stale해진 것 → `progression:diagnostic:write` 후 그 reportHash를 바인딩하는 exploration-rhythm 증빙까지 연쇄 재생성(`--seed-start 20260810 --seed-count 64`). 교훈: 증빙은 소스 해시뿐 아니라 **다른 증빙의 해시**도 바인딩하므로 재생성 순서가 있다(progression → pacing)

**남은 후보 (Wave 7)**: `BalanceConfig`의 `[key: string]: any` 인덱스 시그니처(`constants.ts` — `BALANCE.X` 미선언 키가 전부 `any`로 새어 나가 `protocolCycle`에 로컬 캐스트를 남겼다; 선언 필드로 닫기), `GameAction.payload: any` → 핸들러별 payload 유니온(dispatch 호출부 수백 곳 — 핸들러 그룹 단위로), utils 잔여 `: any` 248건(`exploreUtils`·`combatView`·`runProfileUtils` 상위), systems 162건(`CombatEngine` mixin 경계), `useGameTestApi` 54건(QA 시드 API — 프로덕션 영향 0, 마지막), components 잔여 173건(`CraftingPanel`·`WeaponCodex`·`TerminalView`·`SmartInventory` 상위).

---

## 11. Wave 7 계획 (2026-09-18 착수, 베이스 `main` = `e6df10fd` = PR #33 merge commit)

**핵심**: Wave 6가 세 구역의 주입 경계를 닫고 나니, 남은 `any`의 최대 단일 원천은 **데이터 경계**다. `BalanceConfig`는 64개 필드만 선언하고 `[key: string]: any`로 나머지를 받는데, 실제 `BALANCE` 리터럴은 209키·소비 키 208개 중 **145개가 미선언** → 전부 `any`로 새어 나가 `protocolCycle`의 로컬 캐스트 같은 땜질을 만든다. 두 번째 원천은 `GameAction.payload: any`(dispatch 262곳 · AT 63종)로, Wave 6가 의도적으로 남긴 경계다. 셋째는 잔여 파일 내부 `any`(utils 248 · systems 162 · components 173)로, 이건 경계가 아니라 관성이다.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **Y1 데이터 경계** | `BALANCE`/`CONSTANTS` 타입을 선언 인터페이스가 아니라 **리터럴에서 도출**(`export const BALANCE = {…} as const` 계열 + `export type BalanceConfig = typeof BALANCE`), `[key: string]: any` 2곳 제거. tsc가 드러내는 소비처 오류(미선언 키의 실제 모양 ↔ 소비 코드 가정 불일치)를 정리, `protocolCycle` 로컬 캐스트 제거 | `BALANCE.오타` 컴파일 에러, 145키의 실제 모양이 타입으로 문서화, 배열/객체 상수의 요소 타입 추론 | tsc 표면화 다수(소비처 30~80곳 예상). `as const`의 readonly 배열은 `.push`/mutable 시그니처와 충돌 | 리터럴 도출 대신 145개 필드를 손으로 선언하면 드리프트가 다시 생긴다 — 도출만 허용. readonly 충돌을 `as any`로 풀면 래칫 역행 — `readonly T[]` 파라미터로 받거나 spread 복사 | opus |
| **Y2 action payload 유니온** | `ActionPayloadMap`(AT 키 → payload 타입)에서 `GameAction`을 판별 유니온으로 도출. 핸들러는 `action.payload`가 좁혀진 타입으로 들어오고, dispatch 호출부 262곳이 컴파일 검증된다. X4가 만든 핸들러별 payload 인터페이스를 맵으로 승격. 함수형 payload(`SET_PLAYER`의 `(p) => Player`)는 유니온 멤버로 표현 | reducer 경계의 마지막 `any` 제거, 잘못된 payload 모양 dispatch가 컴파일 에러 | 가장 큰 변경. hooks/components 전반의 dispatch 호출부를 건드리므로 **Y1·Y3·Y4 통합 후 단독 실행** | AT 63종 전부를 한 번에 맵으로 강제하면 미분류 액션의 payload가 `never`로 떨어져 통합이 막힌다 — 미분류는 `unknown`이 아니라 **명시 타입이 확정된 키만 맵에 넣고 나머지는 `payload?: any` 폴백 멤버로 남겨** 슬라이스 가능하게(래칫은 하락만 확인) | opus |
| **Y3 utils·systems 잔여** | utils 상위(`synthesisUtils`·`runProfile`·`signatureSetBonus`·`equipmentArt`·`dataMigration`·`townActionPresentation`·`questProgress`·`avatarEquipmentPreview` = 92) + systems 상위(`consumableEffect`·`CombatEngine.actions`·`equipmentCombatPowerAudit`·`CombatEngine`·`DifficultyManager`·`CombatEngine.relics` = 84) | 전투 수식 경계(`CombatEngine.*`)의 `Player`/`Monster`/`FullStats` 명시 | `dataMigration`은 레거시 save 모양을 다루므로 `unknown` + 좁히기가 정답(도메인 타입 강제 금지) | `CombatEngine.ts` 함수 시그니처 변경은 CLAUDE.md §8 금지 — 파라미터 타입 주석만 추가(호출 호환 유지) | sonnet |
| **Y4 components 잔여** | `CraftingPanel`·`WeaponCodex`·`TerminalView`·`SmartInventory`·`SystemTab`·`CombatPanel`·`QuickSlot`·`RecipeCodex`·`MapNavigator`·`Dashboard` = 91 | Wave 6 X3 규칙(`Pick<GameActions,…>`, producer `ReturnType`) 확장 | — | `dispatch: (action: any) => void` prop은 Y2 전이라 `React.Dispatch<GameAction>`으로만 닫는다(유니온화는 Y2) | sonnet |
| **Y5 문서·래칫** | §11.1, CLAUDE.md, todo, 래칫 재고정, 증빙 재생성(progression → pacing 순서) | — | — | — | 직접 |

**순서**: Phase A = Y1 · Y3 · Y4 병렬(파일 집합: constants+표면화 소비처 / utils+systems / components) → 통합(충돌은 Y1 우선) → Phase B = Y2 단독 → 통합 → 증빙 → 직렬 게이트 → Y5 → PR → CI → merge commit.

**판단 포인트**: Y1은 "선언을 늘리는" 방향과 "도출하는" 방향 중 후자만 허용한다. 선언을 손으로 145개 추가하면 오늘은 맞아도 다음 키 추가 때 또 `[key: string]: any`가 유혹한다. `typeof BALANCE`는 리터럴이 진실 원천이라 드리프트가 구조적으로 불가능하다. 비용은 `as const`의 readonly 전파인데, 이건 실제로 상수를 변이하는 코드를 드러내는 것이므로 비용이 아니라 수익이다.

### 11.1 Wave 7 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `e6df10fd`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| Y1 데이터 경계 | ✅ | `BALANCE`/`CONSTANTS`를 `as const` 리터럴 + `typeof` 도출로 전환(기존 `Object.freeze` 유지, 런타임 값·키 순서·frozen 여부 deep-compare 동일). `[key: string]: any` 2곳 제거, 미선언 145키 타입화. 손으로 선언한 필드 0 — 리터럴이 표현 못 하는 곳만 서브 타입(열린 키 도메인 `Record<number, …>` 6곳, 행마다 다른 optional 필드 `MonsterPrefixDef`/`DiscoveryChainDef`). 표면화 25건/16파일: 열린 키 인덱싱 14(constants 쪽 서브 타입으로 해결, 소비처 무편집), readonly 튜플→mutable 6(캐스트 삭제·`readonly T[]`), 리터럴 유니온 `.includes` 4(`.some`으로 의미 동일), 튜플 이질 필드 1. **드리프트 실증**: 같은 `WEEKLY_MISSIONS`를 `protocolCycle`(gold required)과 `protocolHandlers`(gold optional)가 다르게 선언, 같은 `DISCOVERY_CHAINS`를 `QuestTab`(`QuestReward`)과 `exploreFlow`(optional 4필드)가 다르게 선언 — 4개 사본 삭제, 단일 원천화. 유령 키 읽기 0 |
| Y3 utils·systems | ✅ | 14파일 `: any` 225 → 0(래칫 정규식 기준). `dataMigration`은 입력 `unknown` + 좁히기, 깊은 복사 로컬은 `JSON.parse`의 `any`를 암묵 상속(명시하면 `useFirebaseSync` 8곳이 흔들림 — 다음 슬라이스). `CombatEngine*` 시그니처 불변, 파라미터 타입만. 발견: `consumableEffect`의 스칼라 `status` 승격 분기는 `Player.status: StatusId[]`로 닫힌 뒤 타입상 dead(마이그레이션이 로드 시 배열화) — 로직 불변, 기록만. 정규식 가드 8건 갱신 |
| Y4 components | ✅ | 10파일 95 → 0. `Dashboard.runtime`은 `SystemTabRuntime`(export)로, `MobileGameLayout`의 runtime 리터럴은 초과 속성 검사 때문에 로컬 const로 추출. `Codex.dispatch` required 계약은 테스트가 고정 → 호출부 폴백. 정규식 가드 6건 갱신 |
| 교차 정리 | ✅ | Y3가 `getSynthesisGroups`를 `Item[]`로 닫자 Y4의 `player.inv` 호출부·로컬 `SynthesisGroup` 캐스트가 드러남 → `isSynthesizable`을 타입 술어(`item is Item & { type: ItemType }`)로 만들어 그룹 `type`의 `undefined`를 제거, 캐스트 삭제 |
| Y2 payload 유니온 | ✅ | `ActionPayloadMap`(63/63 키, `any` 폴백 0) → `GameAction` 판별 유니온, `ActionOf<K>`, `HandlerMap`(핸들러 맵 17곳 `satisfies`). `AT`에 키를 추가하고 맵에 안 넣으면 컴파일 에러(`AssertNever` 소진 검사). 정직하게 넓힌 모양: `SET_PLAYER: PlayerPatch \| ((p) => PlayerPatch)`(부분 패치 병합이 실제 의미), `UPDATE_EVENT_CHAIN.step: number \| 'failed'`, `BuyShopItemPayload.expectedGold: Player['gold']`(reducer가 raw 비교 — 0 강제 시 골드 부족 경로가 뒤집힘). 유일한 캐스트 1건: `ACTION_MAP[action.type]` 조회(유니온 키 상관 불가). **표면화 12건/6파일 중 실제 버그 8건**: bounded-encounter를 원정 밖에서 해결하면 `expeditionId: undefined` 전송(가드), `_chainStep`/`_chainId` undefined로 `eventChainProgress["undefined"]` 저장 가능(별칭 조건 좁힘으로 해소), id 없는 아이템 판매 시 다른 id-없는 아이템이 매칭될 수 있음(가드), `claimAchievement(string \| number)` dead-wide, `combat(kind: string)` 미좁힘 → 타입 술어. 낙관적 체인 제거 0(비-nullable payload면 `a?.b`와 `a.b`의 타입이 같아 제거 불필요), 캐스트 3건 삭제. 정규식 가드 3건 갱신 |
| 래칫 | ✅ | `: any` 819 → **493**(Phase A 495 → Y2 493), `as any` 80 → **69**. 분포: utils 155 · components 83 · systems 78 · hooks 56(`useGameTestApi` 54) · data 19 · types 12 · reducers 7 · services 6 · platform 1 |

**최종 게이트** (head `86c145bd` 기준, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 problems · unit **4,813 / 4,813**(skip 0) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(61 + 60, 12.7분) · perf guard desktop ok(FCP 544ms) / mobile ok(FCP 476ms) · 증빙 verify 전부 ok(relic 7종·equipment·progression·pacing·content·event-reward). 증빙 재생성 순서는 Wave 6 교훈대로 progression → pacing; 이번엔 pacing의 reportHash가 동일해 파일 무변경

**남은 후보 (Wave 8)**: `GameState.postCombatResult: any`(greyback 카드 — `combatVictory`가 레거시 별칭 필드를 섞어 생산; 생산자 정리 후 `SET_POST_COMBAT_RESULT` 닫기) · `dataMigration`의 깊은 복사 로컬 `any` 상속 + `useFirebaseSync` 8곳(`migrateData` 반환형을 닫으면 함께 흔들림 — 한 슬라이스로) · utils 잔여 155(`performanceMarks`·`anchorPoints`·`eventPresentation`·`equipmentBaseIdentity` 상위) · systems 78(`CombatEngine.outcome`/`.loot`, 감사 3파일) · components 83 · `useGameTestApi` 54(마지막) · `consumableEffect`의 타입상 dead 스칼라 status 분기 제거(로직 변경이라 별도 판단)

