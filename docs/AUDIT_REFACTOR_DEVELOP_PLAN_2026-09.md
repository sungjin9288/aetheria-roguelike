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

---

## 12. Wave 8 계획 (2026-09-18 착수, 베이스 `main` = `98e98b6e` = PR #34 merge commit)

**핵심**: 경계(주입·데이터·액션)는 다 닫혔다. 남은 493건은 두 종류다 — (a) **마지막 구조적 `any` 2개**: `GameState.postCombatResult`(greyback 카드, 생산자 `combatVictory`가 20필드 리터럴을 쏘고 소비자 4곳이 각자 모양을 가정)와 `migrateData`의 반환(`JSON.parse`의 `any`를 그대로 흘려 `useFirebaseSync` 6개 호출부가 그 느슨함에 기대는 구조), (b) **관성 `any`** 파일 내부 콜백/로컬 ~430건(utils 155 · components 83 · systems 78 · `useGameTestApi` 54). (a)는 판단이 필요하고 (b)는 손이 필요하다. 이 wave가 끝나면 `: any`는 세 자리 아래(목표 < 100)로 내려가고, 래칫은 "0을 향해 하락만"이 아니라 "0 근처 유지"로 의미가 바뀐다.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **Z1 postCombatResult** | 생산자 리터럴(20필드)에서 `PostCombatResult` 인터페이스 도출 → `GameState.postCombatResult: PostCombatResult \| null`, `ActionPayloadMap[SET_POST_COMBAT_RESULT]` 확정(`Record<string, unknown>` 임시 → 실제 타입), 소비자 `PostCombatCard`(5)·`GameRoot`·`App`·QA 주입(`injectPostCombatResult`)이 같은 타입을 읽음 | 전투 결과 카드의 필드 오타·dead read가 컴파일 에러 | 생산자가 "레거시 별칭 필드"를 섞는다면 소비자별 가정이 갈릴 수 있음 — 그 경우 별칭을 지우지 말고 타입에 optional로 남기고 기록 | 소비자 가정에 맞춰 타입을 넓히면(`[key: string]: unknown`) 아무것도 못 잡는다 — 생산자 리터럴만이 진실 | opus |
| **Z2 migrateData 반환형** | `migrateData(raw: unknown): MigratedSave`(= `Player` + `meta` + 세이브 envelope 필드)로 닫고, 깊은 복사 로컬(`savedData`/`target`)은 `unknown`→좁히기 또는 `Record<string, unknown>`으로, `useFirebaseSync` 호출부 6곳이 드러내는 "possibly null/undefined"를 실제 가드로 정리 | 세이브 로드 경로의 마지막 `any` 제거 — 클라우드/로컬 세이브 병합에서 필드 오타 차단 | `useFirebaseSync`는 실제 데이터 손실이 걸린 코드. 가드 추가는 되지만 **분기 순서·권한 판정(`cloudSaveAuthority`) 변경 금지** | 반환형을 `Player`로만 닫으면 envelope 필드(`revision`/`meta`)를 읽는 호출부가 깨진다 — 실제 반환 모양을 먼저 측정 | opus |
| **Z3 utils 잔여** | `performanceMarks`·`anchorPoints`·`eventPresentation`·`equipmentBaseIdentity`·`relicChoiceDecision`·`nameGenerator`·`expeditionReturnFlow`·`combatForecast`·`outcomeAnalysis`·`itemVisuals`·`itemPrefixUtils`·`combatView`·`avatarSpriteCandidates`·`mapSignatureHints` = 97 | — | — | `combatView`는 `CombatPanel`(Y4에서 로컬 캐스트로 소비) 계약 — 반환형이 닫히면 그 캐스트도 제거 | sonnet |
| **Z4 systems·services·chain** | `eventRewardCoherenceAudit`·`contentReachability`·`CombatEngine.outcome/.loot/.status/.enemyAI`·`relicDotMultiplierAudit`·`combatActionTurn` + `services/aiService`·`reducers/handlers/chainEventHandlers` = 66. `consumableEffect`의 타입상 dead 스칼라 `status` 분기는 **제거**(`Player.status: StatusId[] \| undefined`이므로 `player.status ?? []`가 타입상 동치, 마이그레이션이 로드 시 배열화) | 전투 수식 mixin 전부 `: any` 0 | 감사 3파일은 증빙 해시 바인딩 → 통합 시 재생성 | `combatActionTurn`은 reducer가 호출하는 단일 전이 — 시그니처 불변 | sonnet |
| **Z5 components 잔여** | `PostCombatCard`(Z1 소유) 제외 전부 = 78 | — | — | Wave 6/7 규칙 동일 | sonnet |
| **Z6 useGameTestApi** | Phase B(Z1 통합 후). 54건 — `engineRef`/`fullStatsRef`를 `EngineSnapshot`/`FullStats`로, `sanitizeValue(value: unknown)`, `testApi` 객체를 명시 인터페이스(`AetheriaTestApi`)로 — e2e 스펙(`tests/e2e/**`)이 읽는 필드 계약을 문서화 | QA 시드 API의 모양이 타입으로 고정 → e2e 스펙 드리프트 컴파일 차단 | 프로덕션 tree-shaken이라 런타임 위험 0 | `any`를 `unknown`으로 바꾸고 캐스트로 도망가면 e2e 계약이 문서화되지 않는다 — 명시 인터페이스 | sonnet |
| **Z7 문서·래칫** | §12.1, CLAUDE.md, todo, 래칫 재고정, 증빙 재생성(progression → pacing) | — | — | — | 직접 |

**순서**: Phase A = Z1 · Z2 · Z3 · Z4 · Z5 병렬(파일 집합 분리: combatVictory/PostCombatCard/GameRoot/App/gameReducer·actionTypes 해당 줄 — dataMigration/gameUtils/useFirebaseSync — utils 14 — systems 8+2 — components 나머지) → 통합 → Phase B = Z6 → 통합 → 증빙 → 직렬 게이트 → Z7 → PR → CI → merge commit.

**판단 포인트**: Z2는 이 시리즈에서 처음으로 "데이터 손실이 걸린 경로"를 건드린다. 타입만 바꾸고 분기는 그대로 두는 것이 원칙이고, 가드를 추가할 때는 "이전에 throw/undefined 전파하던 경로가 지금 조기 반환한다"를 한 줄씩 기록해 PR 리스크 절에 올린다. 세이브 병합 순서와 권한 판정은 이 wave의 범위가 아니다.

### 12.1 Wave 8 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `98e98b6e`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| Z1 postCombatResult | ✅ | `src/types/combat.ts`의 `PostCombatResult`(20필드, 생산자 리터럴에서 도출 — `items`는 `Item[]`이 아니라 이름 배열이었음) + 두 번째 생산자 `RESOLVE_POST_COMBAT_CHOICE`의 optional 2필드. `GameState.postCombatResult: PostCombatResult \| null`, `ActionPayloadMap` 엔트리 확정. **dead read 1건 제거**(`PostCombatCard`의 `result.loot` 폴백 — 생산자 없음), QA 시드 전용 별칭 `hpLow/mpLow`는 optional로 기록, `difficultyLabel`은 run-summary 필드라 타입에 넣지 않음 |
| Z2 migrateData 반환형 | ✅ | 실측: 반환은 `Player`가 아니라 **세이브 봉투**(`player?: Partial<Player>` + `quickSlots`(항상 3) + `pendingRelics: null` + envelope 필드) → `MigratedSave \| null`, `hasMigratedPlayer` 술어. 입력은 `unknown`, 깊은 복사는 `Record<string, unknown>` + 값 보존 렌즈(`readFields`/`readItem` …), `Player` 단언은 이름 붙은 렌즈 1곳. `useFirebaseSync` 가드 5곳 — 전부 기존 catch/fallback과 **동일 결과**(이전엔 TypeError → 같은 catch). 권한 판정·분기 순서 불변. 에이전트 자체 차등 하네스 70 입력(레거시 flat/스칼라 슬롯/버전 변종/null 인벤) 출력·throw 동치 70/70 |
| Z3 utils 14파일 | ✅ | 121 → 0(`as any` −9). 파생: `combatView` 반환형이 닫혀 `CombatPanel`의 Y4 로컬 캐스트 4건 제거. `CombatEngine.loot`의 `MSG.X(newItem.name)` 8곳은 `Item.name?`이라 `?? ''`(실데이터 항상 존재) |
| Z4 systems·services·chain | ✅ | 77 → 0(`as any` −5). **발견**: `CombatEngine.outcome/.enemyAI`의 최상위 `: any`가 spread 합성된 `CombatEngine` 객체 전체를 `any`로 오염시키고 있었다 — 둘을 닫자 엔진의 실제 합성 타입이 처음 드러났고, `CombatEngine.actions`의 `ThisType` 단독 주석이 외부로 프로퍼티를 0개 노출하던 문제(`satisfies ThisType`로 교정), `TempBuff.counterChance`/`Player.extraTurnGranted`처럼 런타임에 읽고 쓰지만 타입에 없던 필드 2개가 표면화됐다. `consumableEffect`의 타입상 dead 스칼라 `status` 분기 제거(`player.status ?? []`) |
| Z5 components | ✅ | 78 → 0(`as any` −8). 남은 로컬 캐스트는 전부 `src/data/**`(`BOSS_BRIEFS`/`LOOT_TABLE`/`getCodexProgress`)와 `Item`에 없는 `atk/def`(dead read 보존) 때문 — Wave 9 데이터 타입 후보. `GameRoot`의 `seasonEvent.endsAt` `as any` 2건은 Date/string/number/Timestamp 판별 헬퍼로 대체 |
| 교차 정리 | ✅ | (1) `outcomeAnalysis`의 손으로 쓴 `PostCombatResultLike` → `Partial<PostCombatResult>`, dead `loot` 폴백 2곳 제거; (2) `isSynthesizable`… (Wave 7); (3) `equipmentBaseIdentity` 헬퍼 제네릭을 `T extends Item \| null \| undefined`로(인벤 null 슬롯은 마이그레이션 실측 입력); (4) **`GameEvent.outcomes: unknown[]` → 세션 정본 `EventOutcome[]`** — `eventActions`·`eventPresentation`이 같은 배열을 두 로컬 사본으로 읽던 드리프트 제거, `RunSummaryLike`도 `Partial<RunSummary>`로 도출(`recentWinRate: number \| null` 불일치 표면화) |
| Z6 useGameTestApi | ✅ | `EngineSnapshot = ReturnType<typeof useGameEngine>`, `AetheriaTestApi` 인터페이스 59멤버 + 스냅샷 인터페이스 13종(각 getter가 실제로 만드는 필드에서 도출), `vite-env.d.ts`의 window 전역을 이 타입으로. `: any` 60 → 0. **dispatch가 `GameAction`으로 검사되자 QA 시드의 거짓 픽스처가 드러남**: `injectPostCombatResult`가 필수 11필드 누락, `type: 'accessory'`(존재하지 않는 ItemType), 무기 `atk: 4`(실필드는 `val`), `effect` 판별자 없는 합성 유물 3개, 전설로 위장한 시너지 유물 3개(실제는 epic/epic/uncommon — 실데이터 `RELICS.find`로 교체), `ExpeditionSummary.progressionProfile` 누락. `getTrueEndingJourneySnapshot.combatTurn`은 엔진 표면에 없는 필드라 항상 0이었음(리터럴 0 + 주석). e2e 스펙 13개는 `T \| undefined` 반환에 맞춰 `!`/옵셔널 체인만 추가(단언 무변경) |
| 래칫 | ✅ | `: any` 493 → **140**, `as any` 69 → **46**. 분포: utils 58 · systems 24 · data 19 · types 12 · hooks 2 · components/reducers/services/platform **0**. 상위 파일 전부 ≤5건(`signatureItems`·`artPalette` 5, `questPrerequisites`·`mapProgress`·`exploreUtils`·`boundedEncounterSelector`·`types/player`·`TokenQuotaManager` 4) |

**최종 게이트** (head `daeee978` 기준, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 problems · unit **4,813 / 4,813**(skip 0) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(61 + 60, 12.7분) · perf guard desktop ok(FCP 544ms) / mobile ok(FCP 476ms) · 증빙 verify 전부 ok(relic 7종·equipment·progression·pacing·content·event-reward). 증빙 재생성은 세 번에 나눠 했다(Z2 통합 직후 relic 2건, Phase A 통합 후 systems 바인딩 6건, Z6 통합 후 progression — `useGameTestApi`를 해시하므로) — 이번 wave의 교훈: **어떤 트랙이 어떤 증빙을 stale하게 만드는지는 소스 해시 목록(`sourceSnapshot.files`)으로 미리 알 수 있으니, 다음 wave부터는 트랙 브리프에 그 목록을 넣는다**

**남은 후보 (Wave 9)**: (1) `src/data/**`의 느슨한 테이블 타입 — `BOSS_BRIEFS: Record<string, any>`·`LOOT_TABLE: any`·`getCodexProgress`의 `any[]` 필드·`signatureItems`/`artPalette`(19건) → 리터럴 도출(`as const` + `typeof`, Wave 7 Y1 방식)로 닫으면 `MonsterCodex`/`Codex`/`EquipmentCodexCard`의 마지막 로컬 캐스트가 사라진다; (2) `src/types/player.ts` 4건(`[key]: any`류가 아니라 필드 타입 — 실제 생산자 확인 후 닫기) + `Item`에 없는 `atk/def` dead read 정리; (3) utils 58 · systems 24 잔여(파일당 ≤4 — 한 트랙으로 0); (4) `as any` 46건 전수(대부분 `process.env`·매니페스트 JSON·`ITEMS` flatten) → `unknown` + 좁히기; (5) 래칫 의미 전환: 0 도달 후 `: any`/`as any` 상한을 0으로 고정하고 lint 규칙(`@typescript-eslint/no-explicit-any`)으로 이관.


---

## 13. Wave 9 계획 (2026-09-18 착수, 베이스 `main` = `d69987d4` = PR #35 merge commit)

**핵심**: 래칫 `: any` 140 / `as any` 46 중 실제 코드는 각각 ~126 / 46이다(`: any` 카운터가 주석의 `[key: string]: any` 이력 문구까지 세고 있어 types 12·hooks 2는 전부 주석). 남은 코드 `any`의 마지막 구조적 원천은 `src/data/**`의 느슨한 테이블(`BOSS_BRIEFS: Record<string, any>`·`LOOT_TABLE: any`·`getCodexProgress(codex: any)`·시그니처/팔레트 JSON 소비)이고, 이것이 Wave 8이 컴포넌트에 남긴 로컬 캐스트 3곳의 원인이다. 나머지는 utils 50·systems 24·`as any` 46(대부분 매니페스트 JSON·DOM/Capacitor·`ITEMS` flatten 경계)으로 파일당 ≤4 — 이 wave의 목표는 **코드 `any` 0**과 래칫의 의미 전환(카운터 → lint 규칙)이다.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **A1 데이터 테이블** | `BOSS_BRIEFS`/`LOOT_TABLE`/`CODEX_MILESTONES`를 `as const` + `typeof` 도출(Wave 7 Y1 방식), 열린 키 조회는 타입된 lookup 함수, 시그니처 레지스트리·팔레트는 `resolveJsonModule`이 준 JSON 타입에서 도출, `getCodexProgress`는 `Player['codex']` 계약. `MonsterCodex`/`Codex`/`EquipmentCodexCard`의 로컬 캐스트 제거, `Item`에 없는 `atk/def` dead read 정리 | data `: any` 19 → 0, 컴포넌트 로컬 캐스트 0 | `EquipmentCodexCard`의 dead read 제거가 렌더 텍스트를 바꾸면 중단·보고 | 테이블 타입을 손으로 선언하면 Wave 7이 지운 드리프트가 되돌아온다 — 도출만 | opus |
| **A2 utils 잔여** | 25파일 50건 | utils 0 | — | 주석의 `: any` 이력 문구는 가드 대상이면 유지 | sonnet |
| **A3 systems 잔여** | 11파일 `: any` 24 + 감사/시뮬레이터 `as any` 10; `combatItemTurn`의 `runSummary/graveData/victoryStats: any` 생산자 타입화 | systems 0/0 | 감사 5파일 증빙 재생성 | 감사 report 내용이 바뀌면 캐스트가 실제 불일치를 가리고 있던 것 — 보고 | sonnet |
| **A4 `as any` 경계** | `boundedEncounterSelector`(9)·`errorReporter`(5)·`itemVisuals`(4)·`equipmentValidation`(3)·기타 7 = 28: 매니페스트 JSON은 `typeof` 도출, DOM/Capacitor는 `unknown` + 좁히기, `ITEMS` flatten은 `Item` 유니온 + `type` 판별 | `as any` 46 → ≤18 | — | `as unknown as X`로 바꾸면 같은 탈출구의 개명 — 금지 | sonnet |
| **A5 래칫 → lint** | (통합 후) `: any` 카운터를 주석 제외로 교정·재고정; 코드 `: any`/`as any`가 0이면 `@typescript-eslint/no-explicit-any`를 `error`로 켜고 래칫의 두 카운터는 0 상한으로 유지(이중 가드) | "하락만 허용"에서 "0 유지"로 의미 전환, 새 `any`는 lint에서 즉시 차단 | 0에 못 미치면 `warn`이 아니라 래칫 재고정만 — `warn`은 아무도 안 읽는다 | 규칙을 켜기 전에 `eslint .`이 0 problems인지 실측 | 직접 |

**순서**: A1 · A2 · A3 · A4 병렬(파일 집합 분리 — 브리프에 A4 전용 utils 7파일을 명시) → 통합(교차 tsc) → 증빙(progression → pacing, equipment·relic) → A5 → 직렬 게이트 → §13.1 → PR → CI → merge commit.

**판단 포인트**: 이번 wave가 끝나면 `any` 정리 시리즈(Wave 5~9)는 닫힌다. 다음 wave부터는 "타입 부채"가 아니라 CLAUDE.md §8이 말하는 실제 위험(전투 턴 authority·세이브 호환·Firebase boot race)에 대한 동작 계약 테스트와 성능 예산(perf guard CI 연동)으로 축을 옮긴다.

### 13.1 Wave 9 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `d69987d4`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| A1 데이터 테이블 | ✅ | `BOSS_BRIEFS`/`LOOT_TABLE`은 리터럴을 비공개 상수로 두고 `Readonly<typeof …> & Record<string, T>` 교차 타입 + 타입된 lookup(`getBossBrief`/`getLootTable`) — 다른 트랙 소비처의 `table[name]` 인덱싱을 무편집으로 유지. `as const`는 의도적으로 안 씀(22개 튜플 유니온으로 퇴화해 `.join` 등이 깨짐). codex 마일스톤 타입 6종을 `typeof CODEX_MILESTONES`에서 도출, `codexPresentation`·`WeaponCodex`의 사본 2개 제거. **발견**: `getCodexProgress().unclaimed` 원소는 `reached/claimed`가 없어 `Codex.tsx`의 옛 캐스트가 거짓이었음(반환형이 두 배열을 구분). `EquipmentCodexCard`의 `atk/def` dead read 제거(렌더 무변경 — `val` 행 추가는 UI 변경이라 보류). data `: any` 19 → 0 |
| A2 utils | ✅ | 25파일 62건 → 0. `commandParser`의 `actions`는 컴포넌트 규칙대로 `Pick<GameActions, …>` |
| A3 systems | ✅ | `: any` 24 → 1(문자열 리터럴 안의 회귀 가드 패턴 — 타입 아님), `as any` 10 → 0. `combatItemTurn` 결과 필드를 생산자 타입으로. **발견**: `relicDropRateAudit`의 `as any`가 `Monster`에 없는 `meta.prestigeRank` 픽스처 필드를 가리고 있었음(읽는 곳 없음 — 제거) |
| A4 `as any` 경계 | ✅ | 33 → 0(실측이 계획의 28보다 많았음). 매니페스트 JSON 3건은 캐스트가 애초에 불필요(`resolveJsonModule` 추론이 이미 정확), DOM/Capacitor 6건은 `unknown` + `in`/`typeof` 술어, `ITEMS` flatten 20건은 실제 유니온 + `'x' in entry` 접근자. **발견**: `itemVisuals`의 카탈로그 인덱스가 접두사 항목(`type: 'all'`)까지 아이템으로 끌어들이고 있었음(실충돌은 없었으나 `'all'` 분기가 타입상 dead임을 드러냄) |
| 직접(마지막 13건) | ✅ | `firebase.ts`의 `auth`/`db`를 실제대로 `\| null`로 — 소비처 8곳을 `hasFirebaseConfig`/부트 단계와 동치인 가드로 닫음(런타임 동일). `DROP_TABLES: Record<string, readonly DropTableEntry[]>`(엔트리 타입을 데이터로 이동, loot 엔진의 사본·캐스트 제거). `EventChainProgress`(number \| 'failed') 정본 |
| A5 래칫 교정 | ✅ | 카운터가 주석의 `[key: string]: any` 이력 문구까지 세던 것을 `stripCommentLines`로 교정(한글 카운터와 동일 방식) → 코드 실측 `: any` 124 / `as any` 45에서 출발 |
| A6 다른 any 표기 | ✅ | `Record<string, any>`·`any[]`·`<any>` 66건/28파일 → 0. 로컬 빌드 객체는 `Player`, 조회 테이블은 `Record<Union, string>`/`QuestReward`, 저장·외부 경계는 `Record<string, unknown>` + 술어, 감사 `any[]`는 행 빌더 타입. **발견**: `ActionPayloadMap[UPDATE_CODEX].category`가 `string`으로 실제(`CodexCategory`)보다 넓었음 → 좁힘. `Player.eventChainProgress`는 체인 id 키(`number \| 'failed'`) + 예약 키 `boundedEncounterReceipts`(영수증 레코드)의 의도된 이중 용도 — 유니온으로 정직하게 닫고 `exploreUtils`의 숨은 보스 판정을 `typeof` 가드로(결과 동일) |
| 래칫 → lint | ✅ | src 명시 `any` **0**(코드 실측 `: any` 1은 `relicHpDrainAtkAudit`의 문자열 리터럴 안 회귀 가드 패턴 — 타입 아님, `as any` 0, 다른 표기 0). **`@typescript-eslint/no-explicit-any`를 `error`로 켬**(`eslint .` 0 problems) — 래칫 두 카운터는 1/0 상한 이중 가드로 유지. Wave 5 시작점 1,581 → 0 |

**최종 게이트** (head `0c87cbbf` 기준, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 problems(`no-explicit-any: error` 포함) · unit **4,813 / 4,813**(skip 0) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(61 + 60, 12.7분) · perf guard desktop ok(FCP 560ms) / mobile ok(FCP 508ms) · 증빙 verify 전부 ok(relic 7종·equipment·progression·pacing·content·event-reward). 증빙 재생성은 Wave 8 교훈대로 트랙별 바인딩을 미리 알고 했지만, 통합 중 내 직접 수정(`CombatEngine.loot`·`eventChains`·`monsters`)이 relic-drop-rate·relic-event-chance·아트 채택 해시 핀을 다시 stale하게 만들었다 — **다음부터는 통합자의 직접 수정도 하나의 트랙으로 간주해 마지막에 한 번만 증빙·핀을 갱신한다**

**남은 후보 (Wave 10)**: `any` 시리즈(Wave 5~9) 종료. 축 이동 — (1) CLAUDE.md §8 실제 위험의 동작 계약 테스트: 전투 턴 authority(`combatTurn`/`expectedTurn` replay 거부 시나리오 매트릭스), 세이브 호환(`DATA_VERSION` 5.1 이하 각 버전 픽스처 → `migrateData` 왕복), Firebase boot race(`bootStage` 전이 순서 계약); (2) perf guard CI 연동(현재 non-blocking — 3회 실측 분산으로 예산 보정 후 blocking 전환); (3) 아트 채택 테스트의 소스 바이트 해시 핀(`monsters.ts` 등) → 데이터 값 해시로 전환(타입 주석 변경마다 재고정하는 비용 제거); (4) `Record<string, unknown>` 경계 8곳(gameStorage/localGameSnapshot)의 런타임 스키마 검증 통일


---

## 14. Wave 10 계획 (2026-09-18 착수, 베이스 `main` = `b654f4ab` = PR #36 merge commit)

**핵심**: `any` 시리즈가 닫혔으니 축을 "타입 부채"에서 **CLAUDE.md §8이 실제 위험이라고 적어 둔 것**으로 옮긴다. 실측: 전투 턴 authority(`combatTurn`/`expectedTurn`)를 언급하는 테스트 41파일이 있지만 전이 매트릭스(어떤 입력이 거부되고 어떤 입력이 정확히 한 번만 정산되는가)를 한 곳에서 열거하는 계약 테스트는 없다. 세이브 마이그레이션 픽스처는 `version: 5.0` 20건에 편중(1·2·4.0·9·99는 1~3건)이고 Wave 8 Z2가 만든 70입력 차등 하네스는 커밋되지 않았다. `bootStage` 전이(auth → config → data → ready + 오프라인 폴백)는 `useFirebaseSync` 훅 안에 dispatch 시퀀스로만 존재해 순수 함수로 테스트할 수 없다. perf guard는 CI에서 4회 연속 그린(FCP 544~572ms desktop / 436~508ms mobile, 예산 2,200/2,500ms — 4배 여유)인데 아직 non-blocking이다. 아트 채택 테스트 23파일은 `monsters.ts`(6)·`maps.ts`(3)·`titles.ts`(1)의 **소스 바이트** 해시를 핀해서 타입 주석 한 줄에도 재고정이 필요하다(Wave 9에서 2회).

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **B1 전투 턴 계약 매트릭스** | 기존 41파일의 단언을 인벤토리한 뒤 빠진 셀만 채우는 `tests/combat-turn-authority-matrix.test.js`: (stale `expectedTurn` 거부 · 같은 seed 동일 결과 · 연타 dispatch 2회 중 1회만 정산 · 행동 턴/소모품 턴 교차 · 승리/패배 정산 1회성 · 도주 성공/실패 후 turn 카운터) × (일반/엘리트/보스) | 리듀서 단일 전이의 계약이 한 파일에 열거 — 회귀 시 어떤 셀이 깨졌는지 즉시 보임 | 기존 커버리지 중복 위험 — 인벤토리 먼저, 중복 셀은 기존 파일 참조로 대체 | `Math.random` 우회나 timer로 시나리오를 만들면 결정론이 깨진다 — action seed 스트림만 사용 | opus |
| **B2 세이브 호환 왕복** | `DATA_VERSION` 1·2·2.7·4.0·5·5.0·5.1 픽스처(각 버전 실제 세이브 모양) → `migrateData` 불변식(`quickSlots` 3·`status` 배열·`version` 상향·`essenceLifetime` backfill) + 멱등성(`migrate(migrate(x)) ≡ migrate(x)`) + Z2의 70입력 차등 하네스를 골든 파일로 커밋. `gameStorage`/`localGameSnapshot`의 `Record<string, unknown>` 술어 11곳을 하나의 `isSaveEnvelope` 검증기로 통일 | 세이브 손실 경로의 계약이 픽스처로 고정 — `DATA_VERSION` bump 시 무엇을 더 써야 하는지 테스트가 알려줌 | 골든 파일 유지비 | 픽스처를 현재 `Player` 타입으로 만들면 레거시 모양을 못 재현한다 — 각 버전의 **당시 모양**을 git 이력/마이그레이션 코드에서 복원 | sonnet |
| **B3 부트 상태기계 추출** | `useFirebaseSync`의 dispatch 시퀀스를 `platform/bootStateMachine.ts`의 순수 전이 `nextBootStep(state, event)`로 추출(auth 성공/실패/타임아웃, config 유무, 로컬/원격 권한 판정, 오프라인 폴백) — 훅은 이벤트를 넣고 결과 dispatch만 수행. 전이표 테스트 + "ready 이전 렌더 금지" 계약 | §8-5 race(저장 로드 전 기본값 덮어쓰기)를 순수 함수 수준에서 재현·차단 | 훅 리팩토링 — 동작 동치는 기존 firebase 테스트 42파일 + e2e 부트 스펙으로 증명 | 권한 판정(`cloudSaveAuthority`)을 상태기계에 흡수하면 두 진실 원천 — 판정은 호출만, 결과만 상태로 | opus |
| **B4 perf guard blocking** | CI `perf` job의 non-blocking(`continue-on-error`) 해제. 예산은 현행 유지(4배 여유), 실패 시 아티팩트에 metrics JSON 첨부 | perf 회귀가 머지를 막음 | 러너 노이즈로 가끔 빨강 — 예산이 4배라 FCP 2.2s를 넘는 건 노이즈가 아니라 회귀 | 예산을 "현재 실측 + 10%"로 조이면 첫 노이즈에서 깨진다 — 예산은 사용자 체감 기준(2.2s) 유지 | 직접 |
| **B5 아트 채택 핀 → 데이터 값 해시** | 23파일의 `sha256(src/data/monsters.ts 바이트)` 핀을 `sha256(JSON.stringify(MONSTERS 정렬))` 같은 **값 해시**로 교체(`maps`·`titles` 동일). 값 해시 헬퍼 1개(`tests/helpers/dataHash.ts`) | 타입 주석·주석 변경에 재고정 불필요, "게임플레이 데이터 보존" 의도는 그대로 | 값 해시는 필드 순서에 민감 — 정렬 직렬화 | 값 해시가 함수(몬스터 AI 콜백)를 못 담으면 그 부분은 소스 핀 유지 — 데이터/코드 분리선을 명시 | sonnet |
| **B6 문서** | §14.1, CLAUDE.md §7 테스트 목록에 계약 테스트 3종 추가, todo | — | — | — | 직접 |

**순서**: B1 · B2 · B3 · B5 병렬(파일 집합: tests 신규 / tests+platform 술어 / hooks+platform 상태기계 / tests 아트 23파일) + B4 직접 → 통합 → 증빙(전 소스 바인딩 → progression → pacing) → 직렬 게이트 → B6 → PR → CI(perf blocking 첫 적용) → merge commit.

**판단 포인트**: 이 wave의 산출물은 "테스트 개수"가 아니라 **계약의 열거**다. B1의 매트릭스에서 빈 셀이 나오면 그건 테스트 누락이 아니라 설계가 정하지 않은 동작이고, 그때 CLAUDE.md §8에 규칙을 추가하는 것이 정답이다.

### 14.1 Wave 10 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `b654f4ab`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| B1 전투 턴 계약 매트릭스 | ✅ | `tests/combat-turn-authority-matrix.test.js` 27셀(행 9종 × 적 3종: 일반/정예/보스). 기존 41파일의 커버 범위를 헤더 표로 인벤토리하고 **빠진 셀만** 추가 — 특히 `continue` 분기 replay(기존엔 승리만), 정예 승리 정산, 도주·사망 후 replay 거부. 상태는 실데이터(`spawnEnemy` + `DB.MAPS`)로 dispatch해 만들고, **모든 reducer 호출을 `Math.random` throw 가드 안에서 실행** — 시드 스트림이 완전함을 증명. 0.6~0.9초 |
| B2 세이브 호환 왕복 | ✅ | `DATA_VERSION` 픽스처 7종(v1~v5.1, 각 `_note`에 복원 근거) + 불변식(`quickSlots` 3·`version ≥ 2.7`·`essenceLifetime` 역산값 정확·`LOAD_DATA` 후 `INITIAL_STATE.player` 키 완비) + 멱등성 + **골든 차등 74입력**(`SAVE_GOLDEN_WRITE=1`로 재생성). 세이브 봉투 검증기 `isSaveEnvelope` 1개로 4곳 통일 — 26행 표로 기존 4개 술어가 이미 동치였음을 먼저 증명하고 교체 |
| B3 부트 상태기계 | ✅ | `src/platform/bootStateMachine.ts`(React·firebase 비의존, 이벤트 15종 → 효과 10종 + `BootRestorePlan`), `useFirebaseSync`는 이벤트 입력·효과 실행만. 전이표 테스트 30건 + §8-5 계약 5종 |
| B4 perf guard blocking | ✅ | `continue-on-error` 해제. 4회 연속 CI 그린(desktop FCP 544~572ms / mobile 436~508ms vs 예산 2,200/2,500ms — 약 4배 여유), 예산 수치는 사용자 체감 기준 유지 |
| B5 아트 핀 → 값 해시 | ✅ | `tests/helpers/dataHash.ts`(키 정렬·배열 순서 보존·`undefined` 제거·함수는 arity만·NaN/Infinity 태그·순환 가드) + `hashMonsters`/`hashMaps`/`hashTitles`. 소스 바이트 핀 6건(monsters 3 · maps 3)을 값 해시로 교체. 실측 정정: 브리프의 "monsters 6 · maps 3 · titles 1"은 실제로 **monsters 3 · maps 3 · titles 0**(titles는 이미 타겟 정규식). 실험 (a) 주석 한 줄 추가 → 값 해시 불변, (b) `hpMult` 0.8→0.81 → 3파일 전부 실패 |

**발견 (이 wave의 실제 산출물)**

1. **§8-5 race가 실재했다 (B3)** — `fallbackToOffline`은 `bootResolved`를 await 이전에 세팅하지만 스냅샷 복원 경로는 그 플래그를 보지 않는다. 부트 타임아웃(6s)이 로컬을 읽는 동안 클라우드 복원이 끝나면 **늦게 도착한 폴백이 `LOAD_DATA`를 한 번 더 쏴 실제 세이브를 기본값으로 덮을 수 있었다**. 전이표가 "복원 승인 이후의 폴백 복원"을 거부하도록 고쳤다. 원격 스냅샷 복원(cross-device sync)은 부트 이후에도 허용 — 계약 (a)를 "모든 복원 금지"로 읽으면 라이브 동기화가 죽는다.
2. **cleanup 이후 인증 dispatch (B3)** — `signInAnonymously().then()`이 `authResolved`만 보고 `cancelled`는 보지 않아 언마운트 후에도 `SET_UID`/`SET_BOOT_STAGE`를 쐈다. 전이표가 억제한다.
3. **`expectedTurn` 가드 표면 비대칭 (B1)** — 행동 턴은 `Number(payload.expectedTurn)` 강제변환, 소모품 턴은 `typeof === 'number'` 엄격. `combatTurn === 0`에서 `null`/`''`/`'0'`/`[]`/`false`가 행동 턴에는 통과한다. **정산은 여전히 1회**(턴이 정확히 한 번 증가)라 replay 구멍은 아니고 가드 표면 차이 — 현재 동작을 핀으로 고정하고 `TODO(B1 finding)`으로 기록
4. **마이그레이션 완비성은 `migrateData` 단독으로는 성립하지 않는다 (B2)** — `achievements`/`skillChoices`/`status`/`relics` 등 8필드를 건드리지 않아, `INITIAL_STATE.player` 완비는 `LOAD_DATA`의 병합 이후에만 참이다. `grave.item`(레거시 단수)도 정규화되지 않고 `graveUtils.getGraveItems()` 읽기 시점 호환에만 의존한다. 둘 다 현재 동작으로 고정하고 기록
5. **`migrateData`는 완전 결정론이 아니다 (B2)** — `currentRun` 부재 시 `startedAt`이 `Date.now()`. 골든 비교에서 정규화. `activeExpedition.lowestHp`가 `NaN`이 되는 입력 1건도 별도 테스트로 문서화
6. **최상위 원시값 입력은 throw (B2)** — `migrateData(5)`/`('str')`/`(true)`는 strict-mode ESM에서 `TypeError`. 소스 주석이 이미 예상한 동작이라 골든이 `{threw:true}`로 기록

**최종 게이트** (head `7f50bc75` 기준, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 problems · unit **4,965 / 4,965**(skip 0, Wave 9 대비 +152 — B1 27 · B2 왕복/골든/검증기 · B3 전이표 30) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(61 + 60, 15.2분) · perf guard desktop ok(FCP 672ms) / mobile ok(FCP 572ms) · 증빙 verify 전부 ok. **e2e 121/121이 B3 부트 상태기계 추출의 최종 패리티 증명**이다(부트 스펙이 실브라우저에서 같은 순서를 통과). perf 수치는 Wave 9(560/508ms)보다 올랐지만 예산(2,200/2,500ms) 대비 3배 이상 여유이고 러너 부하 차이 범위다 — blocking 전환 후 첫 실측이므로 다음 wave에서 3회 분산을 본다

**남은 후보 (Wave 11)**: (1) **B3 finding 5 해소** — 복원 payload dispatch 3경로가 아직 훅에 남아 있다. `local-game-snapshot`·`persistence-observability`의 소스 정규식 가드("오프라인 폴백 2곳" 개수 단언 포함)가 그 dispatch 텍스트를 고정하고 있어서인데, 그 가드를 실행 테스트로 바꾸면 dispatch까지 상태기계로 옮길 수 있다(전이표는 이미 `restore` 계획에 source/outcome을 담고 있다); (2) **B1 finding 해소** — 행동 턴 `expectedTurn` 가드를 소모품 턴과 같은 `typeof === 'number'`로 좁히고 매트릭스의 `acceptedByAction` 기대를 뒤집는다; (3) **B2 findings 해소** — `migrateData`의 `startedAt` 비결정론을 주입 가능한 `now`로, `activeExpedition.lowestHp` NaN 입력 정규화, `grave.item` → `items[]` 마이그레이션 시점 정규화 여부 판단(`DATA_VERSION` bump 동반); (4) **AI 이벤트 서비스 계약** — `aiService`의 타임아웃(9.5s)·할당량(50/일)·오프라인 폴백 전이를 B3와 같은 방식의 순수 상태기계로; (5) **남은 소스 정규식 가드** — Wave 11 실측으로 범위 정정(아래 §15 C4 참조): 전수 전환은 잘못된 목표다; (6) perf 예산 재보정 — blocking 3회 실측 분산 확인 후 필요 시 예산 조정.

---

## 15. Wave 11 계획 (2026-09-18 착수, 베이스 `main` = `d3418760` = PR #37 merge commit)

**핵심**: Wave 10이 계약을 열거하며 남긴 **finding 6건을 실제로 닫는다**. 그리고 §14.1이 후보로 적었던 "소스 정규식 가드 전수 마감"은 실측이 반증했다 — `readSrc` 호출 1,745건(`cycle-*` 7파일에 1,081건), 그 위의 단언 ~1,836건 중 다수가 `assert.ok(!/X/.test(source))` 형태의 **부재 불변식**("cycle N이 지운 dead plumbing이 되살아나지 않았다")이다. 부재는 코드를 실행해서 증명할 수 없으므로 행동 테스트로 바꿀 대상이 아니다. 전수 전환을 목표로 잡으면 잡히지도 않고, 잡아도 가드가 약해진다. 따라서 이 wave는 **분류와 정책**을 만들고 실제로 깨지기 쉬운 부류만 전환한다.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **C1 부트 복원 dispatch 이관** | B3 finding 5: `LOAD_DATA` 복원 dispatch 3경로가 아직 훅에 남아 있다(`useFirebaseSync` 227·341·388·454·485). 이를 막던 소스 정규식 가드(`local-game-snapshot`·`persistence-observability`의 "오프라인 폴백 2곳" 개수 단언)를 먼저 행동 단언으로 바꾼 뒤, 전이표가 이미 담고 있는 `restore.source`/`outcome`을 써서 dispatch까지 상태기계로 | 부트 복원의 **순서와 payload 선택**이 한 곳에 — §8-5 계약이 전이표만 읽으면 완결 | 훅 리팩토링 2회차 | 가드를 지우고 dispatch만 옮기면 "폴백 2곳" 같은 중복 방지 불변식이 사라진다 — 전이표 단언으로 **동치 이전** 후 이관 | opus |
| **C2 전투·마이그레이션 finding 마감** | B1: 행동 턴 `expectedTurn` 가드를 소모품 턴과 같은 `typeof === 'number'`로 좁히고 매트릭스의 `acceptedByAction` 기대를 뒤집는다. B2: `createCurrentRunProgress`의 `startedAt` 기본값을 주입 가능한 `now`로(호출부가 이미 `now`를 들고 있는지 확인), `normalizeActiveExpedition`의 `lowestHp` NaN 입력 정규화 | 결정론 완성(골든 정규화 불필요), 가드 표면 통일 | `grave.item` → `items[]` 마이그레이션은 **판단만** 하고 실행은 보류 조건부(`DATA_VERSION` bump 동반이라 별도 결정) | `startedAt`을 주입으로 바꾸며 호출부가 `Date.now()`를 그대로 넘기면 아무것도 안 바뀐다 — 주입 경로에 실제 시각 소유자(reducer payload / 테스트)가 있어야 | opus |
| **C3 aiService 상태기계** | 타임아웃(9.5s)·일일 할당량(50, `TokenQuotaManager`)·오프라인 폴백·`fallbackReason` 선택을 B3와 같은 방식의 순수 전이로 추출(`platform/aiEventPolicy.ts`), `aiService`는 fetch·시각·쿼터 IO만 | AI 이벤트 경로의 폴백 판정이 테스트 가능한 표로 — 현재는 9개 테스트가 서비스 주변만 친다 | 추출 리팩토링 | 쿼터 상태(`TokenQuotaManager`)를 전이표에 흡수하면 두 진실 원천 — 쿼터는 **입력 이벤트**로만 | opus |
| **C4 소스 가드 분류·정책** | `readSrc` 단언 1,745건 전수를 (a) **부재 불변식**(dead plumbing 재발 방지 — 유지, 단 포맷이 아니라 식별자 기준으로 견고화) (b) **행동을 텍스트로 고정**(전환 대상) (c) **stale/공허**(삭제)로 분류하고 결과를 `docs/` 표로. 실제 전환은 **가장 깨지기 쉬운 1파일**(`cycle-500-599`, 332건)만. 분류 기준과 "새 가드는 (a)에만 허용" 정책을 CLAUDE.md §7에 명문화 | Wave 6~9에서 ~20회 발생한 "타입 주석 바꿨더니 가드가 깨짐"의 원인을 부류별로 제거, 다음 wave가 이어받을 지도 | 분류 자체가 큰 작업 | 전수 전환을 시도하면 부재 불변식을 잃는다 — (a)는 전환 금지가 이 트랙의 핵심 규칙 | sonnet |
| **C5 perf 분산·문서** | blocking 전환 후 CI 3회 실측 수집(§14.1은 1회뿐), 분산이 예산의 절반을 넘으면 예산 재검토. §15.1, CLAUDE.md, todo | 예산 근거를 1회 관측이 아닌 분포로 | — | — | 직접 |

**순서**: C1 · C2 · C3 · C4 병렬(파일 집합: hooks+platform 부트 / reducers+utils / services+platform / tests 분류) → 통합 → 증빙 → 직렬 게이트 → C5 → PR → CI → merge commit.

**판단 포인트**: §14.1의 "전수 마감"을 그대로 실행하지 않은 이유를 남긴다 — 계획은 측정 전에 쓰였고 측정이 그것을 반증했다. 계획서의 이전 항목을 지우지 않고 정정 표시하는 이유도 같다: 무엇을 왜 바꿨는지가 다음 wave의 판단 재료다.

### 15.1 Wave 11 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `d3418760`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| C1 부트 복원 dispatch 이관 | ✅ `256a36dc` | 복원 dispatch 4경로(`LOAD_DATA` + `SET_SYNC_STATUS` + 경고 로그)와 복원 텔레메트리 6경로를 `bootStateMachine`으로. 순서가 핵심 — **막고 있던 소스 정규식 가드 6건을 먼저 행동 단언으로 동치 이전하고, 각각이 막던 결함을 실제로 되살려 새 단언이 잡는 것을 확인한 뒤** dispatch를 옮겼다(되돌리기 실험 6종, 실패 건수까지 기록). 훅에는 IO·타이머·로그 id 생성(`Date.now()`/`Math.random()`)·React ref·텔레메트리 전송만 |
| C2 전투·마이그레이션 finding 마감 | ✅ `5316eded` | (a) `RESOLVE_COMBAT_ACTION`의 `Number(payload.expectedTurn)` 강제변환 → `typeof === 'number' && Number.isFinite`(소모품 턴과 동일). 생산자 4곳 전수 확인 후 좁힘. (b) `migrateData(raw, { now })` — 벽시계는 경계 1곳에만, 골든의 `startedAt` 정규화 제거(골든에 박힌 값 자체가 결정론의 증거). (c) `normalizeActiveExpedition`의 `lowestHp` 폴백을 날것 `Number(startHp)`에서 **정규화된** `startHp`로 — 20×20 매트릭스 실측으로 달라지는 30셀이 전부 비유한(NaN 25 / Infinity 5)임을 증명 |
| — `grave.item` 판단 | ✅ `41135b81` | **마이그레이션하지 않는다.** 깨진 reader가 없는 모양을 고치려고 `DATA_VERSION`을 올리는 건 순수 위험이고 writer가 이미 두 모양을 함께 쓴다. 대신 남아 있던 직접 인덱싱 3곳(`resolveInvasion` · `invadeGrave` 가드 · `GravePanel` 공개 목록)을 `getGraveItems()` 경유로 돌려 §8-2를 **코드 불변식**으로 만들고, `tests/grave-item-reader-contract.test.js`로 고정(직접 인덱싱을 되돌리면 실패하는 것 확인) |
| C3 aiService 상태기계 | ✅ `321ba854` | `src/platform/aiEventPolicy.ts` — 호출 여부·`fallbackReason` 선택·응답 채택을 React·firebase·fetch 없는 순수 전이로. `fallbackReason` 7종은 전부 기존 코드에서 도출(신규 0). 쿼터는 정책의 상태가 아니라 **입력**(진실 원천 1곳), 다만 mock 런타임이 쿼터를 읽지 않는 기존 동작 보존을 위해 `readQuota`는 값이 아니라 지연 호출로 전달. 결정표 13건 |
| C4 소스 가드 분류·정책 | ✅ `d44a9727` | 68파일 3,226 assertion 전수 분류(acorn AST 1차 + (b)·(c) 전건 수동 검증): **(a) 부재 불변식 1,321 + (a-support) 57 · (b) 행동-텍스트 1,807 · (c) stale/공허 39 · OUT_OF_SCOPE 2**. 전환은 가장 큰 1파일(`cycle-500-599`, 686건)만 — 405건 행동 전환 · 1건 robustify · 2건 삭제 · 1건 보류(사유 기록). 분류표 `docs/SOURCE_GUARD_CLASSIFICATION_2026-09.md`, 신규 가드 정책 CLAUDE.md §7 |
| C5 perf 분산 | ✅ | 아래 |

**C5 — perf 예산은 유지가 맞다 (실측 3회)**

| CI run | head | desktop FCP | desktop DCL | mobile FCP | mobile DCL |
|---|---|---:|---:|---:|---:|
| #211 (main) | `b654f4ab` | 456ms | 217.6ms | 376ms | 209.7ms |
| #212 (PR) | `ee797b35` | 380ms | 199.0ms | 368ms | 189.2ms |
| #213 (main) | `d3418760` | 324ms | 168.8ms | 292ms | 154.4ms |

동일하거나 근접한 코드에서 러너만 바뀌어도 desktop FCP가 **324~456ms(1.41배)** 흔들린다. §14.1의 로컬 672ms와 ci.yml 주석의 544~572ms까지 합치면 7회 관측 범위가 324~572ms(1.77배)다. §15 C5의 재검토 기준은 "분산이 예산의 절반을 넘으면"이었고 실측 분산 132ms는 절반(1,100ms)의 12%다 — **예산 2,200/2,500ms 유지**.

판단의 요점: 예산을 "현재+10%"(≈360ms)로 잡았다면 #211이 그대로 red였다. blocking 체크의 가치는 "회귀를 잡는 민감도"가 아니라 "red가 뜨면 진짜다"라는 신호 대 잡음비에 있다. 지금 예산은 최악 관측(572ms) 대비 3.8배 여유이므로 **4배 느려지는 부팅 회귀만** 잡는다 — 200ms→600ms 같은 점진적 악화는 놓친다. 그 감도가 필요해지면 예산이 아니라 **분포 기반 회귀 검출**(중앙값 대비 N σ)로 바꿔야 하고, 그건 러너별 baseline 저장이 선행 조건이다.

**발견 (이 wave의 실제 산출물)**

1. **Wave 10의 §8-5 계약 (a)는 공허참이었다 (C1)** — "복원 승인 없는 ready 금지"를 전이표가 단언했지만 dispatch는 여전히 훅이 소유했으므로, 전이표가 무엇을 승인하든 훅은 독립적으로 `LOAD_DATA`를 쏠 수 있었다. dispatch 이관 후 계약을 실제 폭으로 다시 썼다 — "ready 뒤 `LOAD_DATA`는 크로스 디바이스 경로에서만, 폴백·mock/device-QA는 무". **계약 테스트가 초록이라는 것과 계약이 성립한다는 것은 다르다**: 주장하는 쪽이 강제하는 쪽과 같은 모듈이어야 성립한다.
2. **소스 정규식 가드는 개수 단언일 때 가장 약하다 (C1)** — `persistence-observability`의 "폴백 2곳" 개수 단언은 **훅의 호출 지점 2곳**을 셌다. 행동 단언으로 옮기니 같은 불변식이 "폴백을 만들 수 있는 전이 **6종 전부**"를 세게 됐고, 되돌리기 실험에서 2건이 아니라 6건이 실패했다. 텍스트 가드는 구현 위치를 세고 행동 가드는 의미 있는 경우를 센다 — 리팩터가 호출 지점을 합치면 전자는 조용히 약해진다.
3. **전수 전환은 틀린 목표였다 (C4)** — 분류 결과 (a) 부재 불변식이 1,378건(42.7%)이다. "없는 것"은 실행으로 증명할 수 없으므로 행동 테스트로 바꾸면 **가드가 사라진다**. §14.1이 "전수 마감"을 후보로 적은 것은 측정 전이었고 §15가 이를 정정했다. 대신 남은 정책은 비대칭이다 — 기존 (b) 1,807건은 그대로 두고(전환 비용 > 이득), **신규 가드만 (a)에 한정**한다. 부채는 증가를 막는 것이 청산보다 싸다.
4. **전환된 단언이 실제로 무는지 증명했다 (C4)** — `src` 스크래치 복사에 1라인 결함 5종(`incrementStat` +1→+2 · `grantGold` 누적 제거 · 장비 슬롯 main/offhand swap · 일일 프로토콜 임계값 5→50 · `ClassIcon` nullish 폴백 제거)을 주입해 5/5 실패를 확인. **전환의 리스크는 "커버리지를 잃고도 초록"이므로, 전환 작업은 결함 주입 검증 없이는 완료로 볼 수 없다.**
5. **`lowestHp` NaN은 워터마크를 영구히 깨뜨리고 있었다 (C2)** — `Math.min(NaN, hp)`가 항상 `NaN`이라 `trackExpeditionVitals`가 매 호출마다 새 `player`를 만들면서 수렴하지 않았다. 타입은 `number`였으므로 tsc가 잡지 못한다 — **비유한 수는 타입 시스템의 사각지대**다.
6. **쿼터 소모 시점이 이벤트/스토리에서 비대칭 (C3)** — 이벤트는 success 응답만으로 `recordCall`하고 패키지 빌드가 실패해도 되돌리지 않는 반면, 스토리는 narrative가 문자열로 확인된 뒤에만 기록한다. 동작 보존으로 두고 기록(할당량 50/일에서 실패한 이벤트 호출도 1건을 소모한다).

**최종 게이트** (head `f812024d`, 샌드박스 로컬 = CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 · unit **4,990 / 4,990**(skip 0, Wave 10 대비 +25 — C1 전이표/봉투 · C2 expectedTurn·결정론·워터마크 · C3 결정표 13 · 묘비 reader 계약 · C4 net −1) · build:guard ok · e2e(chromium, iPhone 12 에뮬레이션) **121 / 121**(61 + 60) · perf desktop ok(FCP 424ms) / mobile ok(FCP 460ms) · 증빙 11종 verify 전부 ok.

**게이트 운용 교훈** — 1차 실행에서 unit 1건(`equipment-combat-power-audit`의 "무관한 Git HEAD 변경이 증빙 바이트를 바꾸지 않는다")과 e2e 1건(부트 `persistent-status-bar` 20s 미출현)이 실패했고, 둘 다 **게이트와 병행해 돌린 내 명령이 원인**이었다. 전자는 그 테스트가 워킹 트리의 증빙 파일을 실제로 `--write`하는 동안 같은 파일에 `--write`를 건 경합이고, 후자는 CPU 무거운 감사 스크립트 2회와 겹친 부팅 지연이다. 단독 재실행에서 각각 10/10, 해당 spec 9/9(6~8초, 타임아웃 30초), 샤드 1 전체 61/61로 재현되지 않았다. **이 게이트는 읽기 전용이 아니다** — 증빙 파일을 쓰는 테스트를 포함하므로 실행 중에는 저장소에 어떤 명령도 병행하지 않는다(문서 작업 포함).

---

## 16. Wave 12 계획 (2026-09-18 착수, 베이스 `main` = `57123379` = PR #38 merge commit)

**핵심**: 축을 **제품**으로 옮긴다. "리팩토링이 끝났으니 이제 기능"이 아니라 실측이 그렇게 강제했다. 먼저 반대 가설 — "감사가 이미 잡았는데 아무도 손대지 않은 문제가 있을 것" — 을 검증했고 **반증됐다**: `content-reachability`는 맵 52/52 · 몬스터 254/254 · 퀘스트 143/143 · 직업 18/18 · 장비 229/229 · 시그니처 25/25 도달 가능에 `unreachable: []` · `missingRoutes: []` · `invalidPrerequisites: []` · `prematureEquipCount: 0`, `equipment-economy`는 `candidateDiscontinuities: 0`, 감사 전종이 `errors: []`다. 남은 품질 부채도 작다 — class-(c) stale 가드 **39건/7파일**(boss-cycle 5 · cycle-200-299 16 · cycle-300-399 9 · monsters-cycle 3 · player-language-readability 3 · signature-cycle 1 · skills-cycle 2, 전부 "타입 선언이 소스에 존재한다"류로 `tsc --noEmit`이 더 강하게 증명한다. §15.1이 적은 "37 잔여"는 정정 — 분류표 최종 합계가 39이고 전환 파일 `cycle-500-599`는 이미 C 0이다), perf 예산은 §15.1이 3회 실측으로 "유지"를 결론냈고 분포 기반 검출은 러너별 baseline 저장이 선행 조건이라 이번 wave 대상이 아니며, class-(b) 1,807건은 Wave 11 정책대로 손대지 않는다.

그런데 그 green들은 전부 같은 문장을 달고 있다 — `actualPlayClaim: false`. `progression-diagnostic-v2`는 `activationReady: false`에 `unavailableMetrics` 5종(`actual_expedition_count`/`actual_play_time`/`mandatory_story_frequency`/`production_ai_event_frequency`/`retention`)을 명시하고, `observation-summary.json`의 `observations`는 **빈 배열**이다(요구 5, 실측 0). 결정적인 것은 **시간 축이 증빙 밖으로 나온 적이 없다**는 사실이다: `progressionSimulator.ts`는 `MODEL_POLICY.secondsPerAction = 90`(:47)을 두고 체크포인트마다 `modeledSeconds`를 계산하는데(:790, :828), `docs/evidence/qa/release-complete-core/*.json` 14개 전체에서 `modeledSeconds` 문자열은 **0건**이다. 액션 수만 실려 있어 "Lv60 = 5,258액션"은 있어도 "= 131시간"은 아무도 본 적이 없다. 그 축을 복원하면 이 게임의 실제 모양이 보인다 — Lv20은 165액션(4.1h)인데 Lv60은 **131.4h**, Lv75는 **204.5h**다. 그 뒤에 무엇이 있는지 세면: 직업 18종 중 **5종(27.8%)이 `reqLv: 60`**, 장비 229종 중 **65종(28.4%)이 tier5+(Lv60/75)**, 퀘스트 143종 중 **26종(18.2%)이 `minLv ≥ 60`**, 맵 52종 중 8종, 이벤트 체인 39스텝 중 **13스텝(33.3%)이 Lv60↑·심연**이고 종착 13개 중 **5개가 같은 맵 하나(에테르 관문 Lv68)**다. 게다가 승천은 Lv48(마왕성)에서 열리고 `progressionHandlers.ts`의 `ASCEND`는 `...INITIAL_STATE.player`로 리셋하므로, **CLAUDE.md §6이 적은 코어 루프(마왕 격파 → 프레스티지)를 그대로 타는 플레이어는 tier-3 직업 5종을 영원히 보지 못한다.** 한편 이 구간을 메울 유일한 단기 사다리인 시즌 패스는 상한이 6,000 XP(30티어 × `SEASON_TIER_XP` 200)이고 탐험 10 + 처치 5 = 15 XP라 **400액션(10.0h)에 만렙**이며, `seasonId`는 `'S1'` 리터럴이 6파일 7곳에 박혀 회전 메커니즘이 0건이고 `pickPermanentPlayerState`가 환생 너머로 계승한다 — 10시간 뒤 영구히 죽은 탭이다. 이것이 "디밸롭 할 부분"의 구체적 실체다. 다만 **이 wave는 곡선을 만지지 않는다** — 비용 축이 증빙으로 고정되기 전에 밸런스를 조정하면 §15가 기록한 실수(측정 전에 쓴 계획을 그대로 실행)를 반복한다.

**실측 — 접근 비용 축** (p50 `modeledActions` × `secondsPerAction` 90s. Lv48·Lv68은 앵커 간 누적 EXP 기준 보간이며 모델의 직접 산출이 아니다)

| 게이트 | 모델 액션 | 모델 시간 | 그 뒤의 콘텐츠 |
|---|---:|---:|---|
| Lv20 | 165 | 4.1h | 직업 6/18 · 장비 tier1~2 |
| Lv45 | 1,597 | 39.9h | 장비 107/229(46.7%) · 퀘스트 42/143(29.4%) · tier2 직업 완비 |
| Lv48 (마왕 · 승천) | ≈2,152 | ≈53.8h | 코어 루프의 종점 — 여기서 Lv1로 리셋된다 |
| Lv60 | 5,258 | 131.4h | **직업 5/18(27.8%)** · 장비 65/229(28.4%) · 퀘스트 26/143(18.2%) · 맵 8/52 |
| Lv68 | ≈6,816 | ≈170.4h | 이벤트 체인 종착 5/13이 이 한 맵(에테르 관문)에 집중 |
| Lv75 | 8,179 | 204.5h | 장비 tier6 20종 |

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **D1 접근 비용 축** | `contentReachability`의 static 도달성에 **비용 축**을 추가한다 — 맵·퀘스트·장비 tier·직업·이벤트 체인 종착 각각의 게이트 레벨과 그 레벨의 `modeledActions`/`modeledSeconds`(progression 체크포인트 앵커 + 누적 EXP 보간, 보간 규칙을 리포트에 명문화). `progression-diagnostic-v2`의 체크포인트에 `modeledSeconds` 노출. 두 증빙 `schemaVersion` bump | "도달 가능한가"가 아니라 "몇 시간짜리인가"가 핀으로 고정 — Wave 13의 밸런스 판단이 vibes가 아니라 근거를 갖는다 | 증빙 2종 재고정 + 해시를 읽는 테스트 3파일 | **밸런스 값을 하나라도 만지면** 증빙 13종이 동시에 stale해지고, 무엇보다 "얼마나 긴가"의 정본이 없는 상태에서 조정하게 된다 — 이 트랙은 `src/data/**`에 쓰기 금지다. 보간값을 모델 산출처럼 적는 것도 실패다(앵커와 보간을 리포트에서 구분할 것) | opus |
| **D2 시즌 루프 — 완주 기반 회전** | `SEASON_MAX_XP` 6,000에 걸려 400액션에 죽는 사다리를 **완주가 다음 시즌을 여는** 반복 구조로. `seasonId` 리터럴 7곳을 시즌 레지스트리로 승격, 완주 시 `xp`/`tier`/`claimed` 리셋 + 직전 시즌 claimed를 아카이브로 보존, 시즌별 보상 스케일. **회전 트리거는 벽시계가 아니라 완주**다 | 10h~200h 구간에 반복 가능한 단기 보상 루프가 생긴다 — `BALANCE`를 한 글자도 안 건드리므로 D1의 증빙이 그대로 유효하고 Wave 13의 곡선 결정이 막히지 않는다 | 세이브 경계 작업(`dataMigration`·`permanentProgress`·왕복/골든) | 회전을 **벽시계로 만들면** Wave 11 C2가 제거한 비결정론이 되살아나고 진행 중인 플레이어를 자른다. `claimed[]`를 아카이브 없이 비우면 티어 보상으로 얻은 칭호·업적이 퇴행한다. `seasonPass`는 선택 필드 추가로 끝내고 **`DATA_VERSION`을 올리지 않는다**(기본값 있는 추가는 bump 불필요) | opus |
| **D3 AI 쿼터 회계와 폴백 표면** | §15.1 발견 6 마감. `resolveAiEventResponse`는 `success`만 보고 `recordCall: true`라 `buildEventPackage` null(`malformed-response`)이나 `recentDuplicate`로 접혀도 50/일 중 1건이 이미 소모된다. story는 narrative 확인 후에만 기록. **먼저 쿼터의 의미를 확정**하고 두 경로를 그 의미에 맞춘 뒤, "채택되지 않은 호출이 몇 건이었는가"를 관측 가능하게 한다. `fallbackReason` 7종 중 UI로 표면화되는 게 `quota` 하나뿐인 것도 함께 판단 | 헤드라인 기능(AI 동적 내러티브)의 회계가 정직해지고, 폴백을 AI 결과와 구별할 수 없던 표면이 정리된다 | 정책/서비스 리팩토링 1회차 + 결정표 확장 | `recordCall`을 단순히 "채택 이후"로 미루면 **비용 통제가 사라진다** — 프록시가 흔들리는 사용자는 로컬 카운터 0으로 백엔드 토큰을 무제한 태울 수 있다. 쿼터를 정책의 상태로 흡수하는 것도 금지(Wave 11 C3 규칙: 쿼터는 입력, 진실 원천은 `TokenQuotaManager` 하나) | opus |
| **D4 class-(c) 가드 39건 정리 + 통합 후 가드 복구** | 7파일의 class-(c) 39건 삭제(각 건 한 줄 근거). 삭제 기준은 "타입이라서"가 아니라 **`tsc --noEmit`이 실제로 다시 증명하는가** — 살아 있는 소비처를 grep으로 확인한 건만 지우고, 소비처 0인 타입은 삭제 대신 `docs/SOURCE_GUARD_CLASSIFICATION_2026-09.md`에 사유를 남기고 유지. 같은 패스에서 D2/D3가 깨뜨린 (a)/(b) 가드를 복구한다 | Wave 11이 연 분류의 (c) 칸이 0이 되고, 통합 충돌이 한 곳에서 해소된다 | 7파일 편집 | (c)라는 라벨만 믿고 지우면 **소비처 0인 타입에서 커버리지를 잃고도 초록**이다 — Wave 11 C4의 삭제 로그와 같은 수준의 개별 근거(대입 사이트 grep) 없이는 완료가 아니다 | sonnet |
| **D5 문서·게이트·증빙 통합** | §16.1, CLAUDE.md §1의 "사이버펑크 판타지" 표기 정정(실측: `src/data/*.ts`에 사이버·해킹·안드로이드·나노·전자·네트워크 각 0건 — 에테르 232 / 기계 75의 하이 판타지), CLAUDE.md §7 테스트 목록 갱신, todo, 증빙 1회 재생성 | — | — | — | 직접 |

**파일 집합 (중복 0)** — D1: `src/systems/contentReachability.ts` · `src/systems/progressionSimulator.ts` · `scripts/verify-content-reachability.mjs` · `scripts/progression-diagnostic-evidence.mjs` · `tests/content-reachability.test.js` · `tests/progression-simulator.test.js` · `tests/progression-diagnostic.test.js` · `docs/evidence/qa/release-complete-core/{content-reachability,progression-diagnostic-v2}.json`. D2: `src/data/seasonPass.ts` · `src/utils/seasonPassPresentation.ts` · `src/utils/permanentProgress.ts` · `src/utils/dataMigration.ts` · `src/reducers/handlers/{helpers,rewardHandlers}.ts` · `src/components/tabs/SeasonPassPanel.tsx` · `src/types/player.ts` · `tests/{season-journey-design,permanent-progress-copy,data-migration,save-compatibility-roundtrip,save-migration-golden}.test.js` (`SEASON_XP` 적립량과 `src/hooks/**` 적립 지점은 **건드리지 않는다** — D1의 모델 입력 보존). D3: `src/services/aiService.ts` · `src/platform/aiEventPolicy.ts` · `src/systems/TokenQuotaManager.ts` · `src/utils/aiEventUtils.ts` · `tests/{ai-event-policy,ai-service,ai-service-proxy-default,ai-event-utils,event-fallback-transaction,token-quota-firestore-contract}.test.js`. D4: `tests/{boss-cycle,cycle-200-299,cycle-300-399,monsters-cycle,player-language-readability,signature-cycle,skills-cycle}.test.js` · `docs/SOURCE_GUARD_CLASSIFICATION_2026-09.md`. D5: `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md` · `CLAUDE.md` · `tasks/todo.md`.

**순서**: D1 · D2 · D3 **병렬**(worktree 격리, 위 파일 집합은 서로 겹치지 않는다) → 통합 → **D4 직렬**. D4를 마지막에 두는 이유는 실측이다 — `cycle-300-399`는 ai 계열 모듈을 39회, `cycle-200-299`는 ai 계열 18회 + 세이브/시즌 계열 20회 참조하므로 D2/D3와 병렬로 돌리면 같은 파일에서 충돌하고, 통합 후에 돌리면 class-(c) 삭제와 D2/D3가 깨뜨린 (a)/(b) 가드 복구를 한 번에 끝낼 수 있다(D1은 이 7파일에서 참조 0건이라 무관). → 증빙 재생성은 **통합자가 마지막에 한 번만**(§13.1 교훈: 통합자의 직접 수정도 하나의 트랙으로 간주) → 직렬 게이트(증빙 파일을 `--write`하는 테스트를 포함하므로 실행 중 저장소에 어떤 명령도 병행 금지, §15.1 교훈) → D5 → PR → CI → merge commit.

**판단 포인트**: 두 가지를 틀리면 이 wave는 손해다. 첫째, **D1은 측정이지 처방이 아니다.** 131시간이라는 숫자를 보면 EXP 곡선이나 `reqLv`를 바로 고치고 싶어지는데, 그 순간 증빙 13종이 동시에 stale해지고 무엇보다 "얼마나 긴 게 문제인가"의 정본이 없는 상태에서 조정하게 된다. 곡선·`reqLv`·프레스티지 이월은 **Wave 13**이고, 그 판단의 입력이 바로 D1의 산출물이다 — 순서를 뒤집으면 §15가 기록한 실수(측정 전에 쓴 계획을 측정 없이 실행)를 그대로 반복한다. 둘째, **쿼터는 "가치 미터"가 아니라 "비용 미터"다.** 이벤트 경로를 story에 맞춰 "채택 이후 기록"으로 바꾸는 것이 대칭화의 자명한 정답처럼 보이지만, 그러면 프록시가 흔들리는 사용자가 로컬 카운터 0으로 백엔드 토큰을 무제한 태울 수 있다(서버 측 `checkRateLimit`은 uid+IP 버킷일 뿐 일일 한도가 아니다). D3의 산출물은 "어느 쪽으로 맞췄는가"가 아니라 **"쿼터가 무엇을 세는 미터인지 정하고 그 의미에 두 경로를 맞췄다"**여야 하고, 어느 쪽을 택하든 채택되지 않은 호출 건수는 관측 가능해야 한다.

### 16.1 Wave 12 실행 결과 (2026-09-18, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `57123379`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| D1 접근 비용 축 | ✅ `a41e0ae0` | `content-reachability` report `schemaVersion` 1→2에 최상위 `cost`(policy·anchors 8·gates·behind 45행) 신설, `progression-diagnostic-v2` report 2→3에 `costPolicy` + 체크포인트 `modeledSeconds`/`modeledHours`. `basis` 4종(`anchored`/`interpolated`/`beyond-anchors`/`unavailable`)으로 **모델 산출과 보간을 구분**하고, 각 보간 행이 자기 입력(`expFraction` 포함)을 통째로 들어 리포트 밖을 안 보고 재계산된다. 누적 EXP는 곡선을 다시 쓰지 않고 `CombatEngine.applyExpGain`을 굴려 만든다 |
| D2 시즌 루프 회전 | ✅ `33ee8ad8` | 트리거는 **30번째 티어 보상 claim**. `SEASON_REGISTRY`(S1~S6, 이후 `S{n}` 도출), 완주 시 `xp`/`tier`/`claimed` 리셋 + `SeasonArchiveEntry`로 보존, `scale(n) = min(4, 1.35^(n-1))`이고 `scale(1) === 1`이라 시즌 1은 `SEASON_REWARDS`를 **참조 그대로** 반환. `DATA_VERSION` 5.1 불변, 골든 74입력 바이트 불변 |
| D3 AI 쿼터 회계 | ✅ `9d957f30` | 쿼터를 **디스패치 비용 미터**로 확정(`dispatched(day) ≤ 50`). `recordCall`을 두 응답 해석기에서 **하나의 요청 결정**으로 이관 — 서비스의 호출 지점이 1곳이라 두 경로가 불일치할 수 없다. 해석기는 `outcome` 5종을 반환하고 `dispatched = adopted + unadopted + unsettled` 항등식을 테스트가 고정. 폴백 표면은 **넓히지 않고** 기존 표면 하나를 정직하게(50 중 몇 건이 이야기로 돌아왔는지) |
| D4 class-(c) 정리 | ✅ `7b64fb48` | 39건 중 **36건 삭제**(각 건 live consumer grep 근거), 3건은 삭제 대신 **분류 정정** |
| D5 문서·증빙 | ✅ `083bda9d` + 본 커밋 | 증빙 3종 재고정, §16.1, CLAUDE.md |

**발견 (이 wave의 실제 산출물)**

1. **맵의 선언 레벨은 실제 게이트가 아니다 — 52개 중 10개가 다르다 (D1).** 유일한 경로가 더 높은 지역을 지나기 때문이다: 금지된 도서관 55→62 · 황금 왕국 58→62 · 공중 신전 48→52 · 차원의 균열 전초기지 62→68 · 에테르 폐허 65→68 등. 그래서 §16이 "Lv60 뒤 맵 8/52"로 적은 것은 **9/52**가 맞고, "이벤트 체인 13/39 스텝이 Lv60↑"은 경로 기준 **9**다. 콘텐츠 게이트를 선언값으로 세면 틀린다.
2. **`level: 'infinite'`는 잠금이 아니라 잠금 없음이다 (D1).** `mapAccess.ts`의 `level < Number(requiredLevel)`이 `NaN` 비교라 항상 false다(소스 주석이 "unbounded 'infinite' maps"로 의도를 명시하고 있으므로 버그가 아니라 설계다). 실효 진입선은 순전히 경로가 만들고 그 값은 **Lv48**이다 — "심연은 최종 콘텐츠"라는 암묵 가정이 코드상 성립하지 않는다.
3. **승천과 tier-3 해금 사이가 78시간이고 그 구간에 리셋이 있다 (D1).** 승천은 Lv48(≈53.3h)에서 열리고 `ASCEND`는 `...INITIAL_STATE.player`로 리셋하는데 tier-3 직업 5종은 Lv60(131.2h)이다. §16이 문장으로 적은 "코어 루프를 타면 직업 5종을 영원히 못 본다"가 시간으로 정량화됐다.
4. **시즌 회전의 자명한 트리거(XP 상한)는 틀린 답이다 (D2).** claim이 곧 지급이므로 상한 도달 시점의 플레이어는 30티어 보상을 미수령 상태로 들고 있을 수 있고, 거기서 회전하면 이미 번 보상 30개가 삭제된다. 30번째 claim이 플레이어의 마지막 가시 행동이고 멱등이며 상한 도달을 함의한다. **구세이브 처리도 함께 필요했다** — 이미 30티어를 다 받은 세이브는 모든 claim이 거부되어 회전 문이 영영 안 열리므로, `migrateData`가 로드 시 같은 함수를 한 번 호출한다.
5. **칭호 복구 폴백이 리셋 순서를 load-bearing으로 만든다 (D2).** `checkTitles`가 시즌 칭호를 **live `seasonPass.tier`**에서 복구하므로, tier를 0으로 리셋하면 그 칭호들이 영구 복구 불가가 된다. 리셋 직전에 `addNewTitles`를 한 번 돌리고, 리셋 후에는 `checkTitles`가 더 이상 만들어내지 못함을 테스트가 단언한다(순서가 장식이 아님을 증명).
6. **쿼터를 채택 기준으로 세면 유일한 비용 통제가 뚫린다 (D3).** 서버 `functions/api/ai-proxy.js`는 40req/60s 슬라이딩 윈도우일 뿐 **일일 상한이 없고**(`grep -i daily` 0건), 버킷은 Cloudflare isolate별 in-memory다. 게이트(`canMakeAICall`)는 디스패치를 막는데 미터가 그 부분집합만 세면 게이트가 구조적으로 못 문다 — malformed 100%에서 디스패치가 무한이다. 과소 계수는 무한 비용, 과대 계수는 유한 손해(어차피 폴백을 받았을 이벤트, 하루 뒤 리셋)이므로 비대칭이 명확하다.
7. **기본 빌드에서는 모든 이벤트가 폴백이다 (D3).** `CONSTANTS.USE_AI_PROXY` 기본값이 `false`라 출처 표시를 달면 100% 발화한다 — 정보가 아니라 노이즈다. `recent-duplicate` 폴백은 반중복 필터가 제 일을 한 결과라 표시하면 성공을 실패로 보고하게 된다. 그래서 표면을 넓히는 대신 하나를 정직하게 만들었다.
8. **분류 라벨은 근거가 아니다 (D4).** `player-language-readability.test.js`의 class-(c) 3건은 실제로 그 형태가 아니었다 — `readSrc` 단언 77건을 전부 읽으니 전부 렌더 텍스트·testid 검사였다. 목표 숫자(39)를 맞추려고 3건을 만들어내는 대신 분류표를 정정했다. **통합 회귀 검증도 자기 보고를 믿지 않았다** — D2·D3가 각자 "가드 안 깨짐"을 확인했지만 서로의 변경을 못 본 상태였으므로, 7파일의 **삭제 전 원본**을 통합 트리에 되돌려 763/763을 먼저 확인하고 작업했다.

**최종 게이트** (head `083bda9d`, CI 동일 빌드 `VITE_ENABLE_TEST_API=1` + 더미 Firebase config): type-check 0 · lint 0 · unit **5,039 / 5,039**(skip 0, Wave 11 대비 +49) · build:guard ok · e2e **121 / 121**(61 + 60) · perf desktop ok(FCP 632ms) / mobile ok(FCP 468ms) · 증빙 12종 verify 전부 ok. §15.1의 운용 규칙(게이트 실행 중 저장소에 병행 명령 금지)을 지켜 **1차 실행에 전 단계 그린**이다.

**남은 후보 (Wave 13)** — D1이 비용 축을 고정했으므로 이제 곡선을 만질 근거가 있다: (1) **승천–tier3 78시간 간극** — `reqLv: 60` 직업 5종을 승천 전으로 당길지, 프레스티지 이월을 넓힐지, 곡선을 눕힐지. D1의 `cost.behind` 45행이 각 선택의 영향 범위를 준다; (2) **맵 선언 레벨과 경로 게이트의 불일치 10건** — 선언을 경로에 맞추거나 경로를 열거나, 최소한 `mapGateDivergence`를 UI가 읽게; (3) **`checkTitles`의 `seasonTier` 폴백을 lifetime max로**(`gameUtils.ts`, D2 범위 밖 1줄); (4) **시즌 overflow XP 이월** — 현재 상한에서 버려진다. 유효 획득률을 바꾸므로 D1 모델 재측정 동반; (5) **AI 정산 내역의 Firestore 미러링** — `firestore.rules`의 4키 `hasOnly` 제약 때문에 rules + client 동시 PR 필요; (6) **class-(b) 1,807건**은 Wave 11 정책대로 계속 방치(신규만 (a)로 제한).

## 17. Wave 13 계획 (2026-09-19 착수, 베이스 `main` = `56d0a6ef` = PR #39 merge commit)

**핵심**: 레버는 **직업 게이트**다 — `src/data/classes.ts`의 tier-3 5종 `reqLv: 60 → 45`, 다섯 숫자. 곡선도 프레스티지도 아니고, 그 둘을 뺀 것은 취향이 아니라 실측이다. 곡선은 **조준이 안 된다** — `EXP_LEVEL_HARD_CAP` 150,000이 Lv50 승급부터 물리므로 Lv48→Lv60의 1,789,953 EXP 중 1,650,000(92.2%)이 평평한 구간에서 청구되고, `EXP_SCALE_RATE`를 낮추면 꼬리보다 몸통이 더 빨리 줄어 **비율이 되레 벌어진다**(cum(60)/cum(48)은 1.15에서 2.921인데 1.14에서 3.507, 1.13에서 3.937, 1.12에서 3.909다). 오늘의 2.921 아래로 내려가는 첫 값은 1.09이고 그때 마왕까지의 전체 런이 오늘의 13.1%(53.28h → 약 7h)다 — 몸통을 지우지 않고 꼬리만 줄이는 `EXP_SCALE_RATE`는 없다. 프레스티지는 **값을 못 치른다** — `PRESTIGE_ENEMY_REWARD_PER_RANK = 0.08`이 `exploreUtils.ts`에서 적 `exp`에 곱해지므로 Lv60은 5,246/(1+0.08r) 액션이고 승천 예산(Lv48 = 2,131 액션)에 닿는 것은 rank 19다. 거기까지 Σ 2,131/(1+0.08k)(k=0..18) = 25,275 액션 = **631.9h**, 메우려는 간극 77.87h의 8.1배이고, 이 축이 부러진 것을 보는 사람은 rank 0의 첫 런 플레이어라 프레스티지는 그에게 0을 준다. 반대로 게이트 레버는 **곡선 중립이고 그것이 증명 가능하다** — `reqLv` 다섯을 45로 두고 돌린 `simulateProgression()`은 체크포인트 액션이 14/52/82/164/1,575/5,246/8,176로 한 자리도 안 움직였고 `cost.anchors` 8행은 바이트 동일하며, 움직인 것은 `cost.gates.jobs`와 `cost.behind[].jobs`뿐이다. 마지막으로 데이터 자체가 이 편집의 선례이자 모순이다 — tier-3은 5종이 아니라 **6종**이고 시간술사는 `tier: 3, reqLv: 25`(5.23h), 나머지 다섯은 60(131.15h)이라 **같은 선언 티어 안에서 25.1배**가 벌어져 있다. 게다가 성직자는 `tier: 1, reqLv: 5`(1.30h)인데 `next`가 팔라딘 하나뿐이라 그 갈래는 **선택지 0개로 129.85시간**이다. 45를 고르는 것도 실측이다 — 45는 모델 앵커라 직업 게이트 행이 `interpolated`에서 `anchored`로 바뀌고, `TIER_REQ_LEVEL[4] = 45`(tier4 장비 42종)와 같은 박자에 떨어지며, 승천 게이트까지 **13.90h**(53.28 − 39.38)가 남아 tier-3 직업이 해금만 되고 끝나지 않는다(그 여유는 tier-1 구간 전체 6.18h의 2.25배다).

**실측 — 레버 3종** (앵커는 `content-reachability.json` `cost.policy.anchorSeed = 20260810` 단일시드 프레임. §16의 계획 단계 표는 1,000시드 p50 프레임이라 Lv60에서 131.45h로 0.30h 높다 — 이 wave의 기준은 앵커 프레임이다)

| 레버 | 간극에 하는 일 | 모델 액션이 움직이는가 | 증빙 blast radius | 실패하는 지점 |
|---|---|---|---:|---|
| **직업 게이트 `reqLv` 60→45** | 승천(53.28h)보다 13.90h 먼저 tier-3이 열린다 | **아니다** — 14/52/82/164/1,575/5,246/8,176 그대로(실측) | 증빙 3종의 직업 필드 + 핀 3곳 | 45보다 위로 올리면 해금과 리셋이 같은 순간이라 그 직업을 한 번도 안 굴린다 |
| **`EXP_SCALE_RATE` 1.15 → 낮춤** | 비율이 벌어진다(2.921 → 3.937 @1.13) | 전부 움직인다 | 증빙 13종 동시 stale | 1.09 이하로 내려야 비율이 개선되는데 그때 전체 런이 오늘의 13.1% |
| **프레스티지 이월/배율** | rank 19에서 닿음, 도달 비용 631.9h | 전부 움직인다(적 exp 배율) | 증빙 13종 + 세이브 경계 | rank 0 첫 런에는 효과 0 — 부러진 걸 보는 사람을 못 돕는다 |
| *(참고)* **`TIER_REQ_LEVEL[5]` 60→50** | 장비 45종을 당김 | 체크포인트는 불변, `tierEquip` 879/132 → 876/135 | +`equipment-combat-power`·`equipment-economy`·loot tier 테스트 3종 | `CombatEngine.loot.ts`가 같은 테이블로 드롭 티어를 고른다 — 게이트가 아니라 드롭 분포가 바뀐다 |
| *(참고)* **맵 선언 레벨 → 경로 게이트** | 방향이 반대 | **움직인다** — Lv60 5,246→**5,328**(+2.05h), Lv75 8,176→**8,328**(+3.80h) | 증빙 3종 재베이스 | `selectModeledMap`이 선언 `level`로 고르므로 E1의 "앵커 불변" 증명이 사라진다 |

**실측 — 승천 시점에 남는 것** (`cost.behind`의 `level: 49` 행 = 게이트 레벨이 48보다 큰 콘텐츠)

| | 지금 | E1 이후 |
|---|---:|---:|
| 직업 | 5 / 18 (Lv60 = 131.15h) | **0 / 18** |
| 장비 | 65 / 229 (tier5 45 @60, tier6 20 @75) | 65 / 229 (유지 — 승천을 거절한 플레이어의 깊이) |
| 퀘스트 | 39 / 143 | 39 / 143 |
| 맵 | 13 / 52 | 13 / 52 |
| 이벤트 체인 종착 | 5 / 13 (전부 에테르 관문, 경로 Lv68 = 170.23h) | 5 / 13 |

**성공 기준 (재생성된 `cost` 섹션이 보일 값)**: `cost.behind`의 `level: 48`·`49`·`60` 세 행에서 `jobs`가 **5 → 0**. `cost.gates.jobs`는 `[1:1, 5:4, 12:1, 25:1, 30:6, **45:5**]`이고 마지막 행 `basis`가 `anchored`·`modeledHours` 39.38(131.15에서 **−91.77h**). 승천 게이트 − 최심 직업 게이트 = **−77.87h → +13.90h**. **불변**: `cost.anchors` 8행의 `modeledActions` 0/14/52/82/164/1,575/5,246/8,176, `cost.behind` 45행 전부의 `modeledActions`/`modeledSeconds`/`modeledHours`, `cost.gates.{maps,quests,equipmentTiers,eventChainTerminals}`, `cost.mapGateDivergence` 10행, `errors: []`, `tierEquip.prematureEquipCount: 0`, `exploration-rhythm.json` 최상위 `reportHash` `0818fb7a…`. **E1 단독 적용 시 예고 해시(실측)**: `EXPECTED_BASELINE_REPORT_SHA256` `2e4c0726…`→`488c4c01…`, `PROGRESSION_V1_BASELINE_HASH` `d39dce20…`→`98085d39…`, `progressionEvidence.focused.reportHash` `d1c84391…`→`6db954ba…`.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **E1 직업 게이트를 루프 안으로** | `classes.ts`의 tier-3 5종 `reqLv: 60 → 45`. 움직이는 핀 3곳을 **의도된 이동으로 명시 갱신**: `progression-simulator.test.js`의 `EXPECTED_JOB_LEVELS`·`reachableJobCount` [1,5,5,6,**13**,18,18] → [1,5,5,6,**18**,18,18]·`EXPECTED_BASELINE_REPORT_SHA256`, `content-reachability.test.js`의 `gates.jobs`/`behind` 행과 `checkpointSnapshots`, `scripts/progression-diagnostic-evidence.mjs`의 `PROGRESSION_V1_BASELINE_HASH`. 같은 패스에서 **불변식 신설** — "직업 게이트 최대값 ≤ 마왕성 경로 게이트(48)"를 `content-reachability.test.js`가 단언한다. 증빙 JSON은 **쓰지 않고**, 예고값 4개를 커밋 메시지에 기록한다 | 코어 루프가 가리키는 리셋 지점 안에서 직업 사다리가 닫힌다 — 승천 뒤에 남는 직업 5종이 0이 되고, `ClassTree`가 Lv1부터 보여주던 칸이 전부 도달 가능해진다. 곡선을 한 글자도 안 건드려 `cost.anchors`가 증거로 남는다 | 데이터 5줄 + 핀 3파일 + 신규 단언 1개 | `EXP_SCALE_RATE`·`EXP_LEVEL_HARD_CAP`·`TIER_REQ_LEVEL`·`maps.ts`를 **같은 커밋에서 한 글자라도 만지면** 앵커 불변이 깨지고 "무엇이 무엇을 움직였는가"가 영영 분리 불가다. 핀을 "테스트가 빨개서" 고치는 것도 실패다 — 각 핀은 예고값과 일치해야 하고, 다르면 편집이 틀린 것이다. 증빙 JSON을 이 워크트리에서 `--write`하면 통합 후 재현 검증의 판별력이 사라진다 | opus |
| **E2 맵 게이트: 선언이 아니라 경로를 보인다** | 선언 레벨을 고치지 않는다(모델이 +82액션 움직이고 방향이 반대다). `contentReachability.ts`의 `mapRouteGateLevels`를 `src/utils/mapRouteGate.ts`로 **추출**해 리포트와 UI가 같은 authority를 읽게 하고, `MapNavigator.tsx`가 선언값과 경로 게이트가 다른 10건에서 실제 진입 레벨을 보이게 한다(혼돈의 심연은 `'infinite'` 라벨이라 레벨이 아예 없었는데 실효 진입은 Lv48이다). 문구는 `MSG` | 카드가 "레벨 48"이라 말하고 Lv52까지 못 들어가던 거짓말 10건이 사라진다. `level < Number('infinite')`가 NaN 비교라 잠금이 아니라는 사실이 UI에 반영된다 | 추출 1회 + 컴포넌트 1개 + 신규 테스트 1파일 | 추출이 순수하지 않으면 `content-reachability.json`의 `reportHash`가 움직인다 — 이 워크트리에서 `npm run content:verify`가 **초록**인 것이 "표현만 고쳤다"의 유일한 증명이고, 빨개지면 모델로 샌 것이다. 권한 로직(`getMapAccess`)을 경로 게이트로 바꾸는 것도 금지다 — 이 트랙은 표시이지 잠금이 아니다 | opus |
| **E3 시즌 회계 마감** | (1) `gameUtils.checkTitles`의 `seasonTier` 폴백이 live `seasonPass.tier`를 읽어, D2의 회전이 tier를 0으로 되돌린 뒤에는 칭호 3종(val 10/20/30)을 복구 못 한다 → `archive[].tier`를 포함한 **lifetime max**로. (2) `addSeasonXp`가 `SEASON_MAX_XP` 6,000에서 초과분을 버린다 — 30티어를 다 벌고 아직 claim 안 한 플레이어는 그 사이 번 XP가 전부 증발한다 → 회전 시 다음 시즌 `xp`의 시드로 이월. `xp`는 이미 number 필드이고 `getSeasonProgress`가 읽을 때 클램프하므로 **타입·`DATA_VERSION` 변경 없다** | D2가 연 회전 구조에서 "완주했는데 기록이 사라진다" 두 경로가 닫힌다. 시즌 XP는 progression 모델의 입력이 **아니므로**(`src/systems/**`에 `seasonPass` 참조 0건) E1의 측정과 독립이다 | 유틸 3파일 + 테스트 2파일 | 이월을 `SEASON_MAX_XP` 클램프 제거로 구현하면 `getSeasonProgress`의 `completed` 판정과 티어 계산이 상한 밖 값을 보게 된다 — 클램프는 표시 경계에 그대로 두고 **회전 시점에만** 잔여를 넘긴다. 칭호 폴백을 archive만 보게 바꾸면 회전 전 현재 시즌 칭호가 안 나온다(max여야 한다) | sonnet |
| **E4 AI 정산 내역 Firestore 미러링** | `syncToFirestore`의 페이로드를 `getCallLedger()`의 정산(`adopted`/`unadopted`/`unsettled`)까지 싣도록 넓히고, `firestore.rules`의 `hasAll`/`hasOnly` 4키(`date`·`used`·`limit`·`updatedAt`)를 **같은 PR에서** 함께 넓힌다. `update` 분기의 단조성(`같은 날짜면 used >= 이전 used`)과 대칭으로 새 카운터도 단조여야 한다 | D3가 로컬에만 두고 끝낸 "50 중 몇 건이 이야기로 돌아왔는가"가 크로스 디바이스 비용 집계로 올라간다 | rules 1 + systems 1 + 테스트 1 | rules를 안 넓히고 클라이언트만 넓히면 쓰기가 거부되는데 `catch`가 `console.warn`으로 삼키므로 **조용히 미러링이 죽는다**. 단조성을 새 키에 안 걸면 롤백 쓰기로 정산이 되감긴다. `limit == 50`·`used <= 50`이 rules에 리터럴로 박혀 있으므로 `BALANCE.DAILY_AI_LIMIT`를 만지면 rules도 같이 움직여야 한다 | opus |
| **E5 증빙 재고정·문서** | 통합 트리에서 E1의 예고값 4개 재현 확인 → 증빙 3종 재생성(순서 고정) → 12종 `*:verify` → §17.1, CLAUDE.md(§6 코어 루프·§8 직업 게이트 불변식·§7 테스트 목록), `tasks/todo.md` | — | — | — | 직접 |

**파일 집합 (중복 0)** — E1: `src/data/classes.ts` · `tests/progression-simulator.test.js` · `tests/content-reachability.test.js` · `scripts/progression-diagnostic-evidence.mjs`. E2: `src/utils/mapRouteGate.ts`(신규) · `src/systems/contentReachability.ts` · `src/components/MapNavigator.tsx` · `src/data/messages.ts` · `tests/map-route-gate.test.js`(신규) · `tests/map-badges.test.js`. E3: `src/utils/gameUtils.ts` · `src/utils/seasonPassPresentation.ts` · `src/reducers/handlers/helpers.ts` · `tests/check-titles.test.js` · `tests/season-journey-design.test.js`. E4: `firestore.rules` · `src/systems/TokenQuotaManager.ts` · `tests/token-quota-firestore-contract.test.js`. E5: `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md` · `CLAUDE.md` · `tasks/todo.md` · `docs/evidence/qa/release-complete-core/{content-reachability,progression-diagnostic-v2,exploration-rhythm}.json`. (E2가 `contentReachability.ts`를, E1이 그 **테스트**를 갖는 것은 의도다 — 추출은 리포트 값을 안 바꾸고 E1은 소스를 안 만진다.)

**순서**: E1 · E2 · E3 · E4 **병렬**(worktree 격리, 위 파일 집합은 서로 겹치지 않는다) → 통합 → **통합 트리에서 E1 예고값 4개 재현 확인**(여기서 어긋나면 증빙을 만들기 전에 멈춘다) → **증빙 재고정은 통합자가 마지막에 한 번만, 순서 고정**: ① `PROGRESSION_V1_BASELINE_HASH` 리터럴이 갱신돼 있는지 확인(안 되어 있으면 writer가 `PROGRESSION_SCHEMA_V1_BASELINE_DRIFT`로 **쓰기 자체를 거부**한다) → ② `verify-content-reachability.mjs --write`(0.85s) → ③ `compare-exploration-rhythm.mjs --seed-start 20260810 --seed-count 64 --write`(4m30s) → ④ `npm run progression:diagnostic:write`(1m59s, `src/**` + 고정 14경로 = **345개 소스 해시**를 굽고 실행 전후로 다시 읽어 `SOURCE_MANIFEST_CHANGED_DURING_DIAGNOSTIC`을 던지므로 **맨 마지막**이고 실행 중 저장소에 어떤 명령도 병행 금지, §15.1 규칙) → 12종 `*:verify` 재확인 → 직렬 게이트 → E5 → PR → CI → merge commit.

**판단 포인트**: 두 가지를 틀리면 이 wave는 측정을 쓰지 못하고 측정만 망친다. 첫째, **E1은 `reqLv` 다섯 개만 만진다.** 131시간을 보면 `EXP_SCALE_RATE`나 `TIER_REQ_LEVEL`이나 맵 선언 레벨을 같이 고치고 싶어지는데, 이 트랙의 가치 전부가 "곡선이 안 움직였다는 것을 증빙이 증명한다"에 있다. 곡선 상수는 세 증빙의 모든 `modeledActions`를 움직이고, `TIER_REQ_LEVEL[5]`는 체크포인트는 남기되 `CombatEngine.loot.ts`의 드롭 티어 조회를 바꿔 증빙 4종을 더 끌고 들어오며, 맵 선언 레벨은 `selectModeledMap`을 통해 Lv60을 5,246→5,328로 **밀어 올린다**(방향이 반대다). 하나라도 섞이면 `cost.anchors` 바이트 동일이라는 문장을 쓸 수 없고, 그 문장이 없으면 Wave 14는 다시 측정 없는 상태에서 판단하게 된다. 둘째, **예고값이 재현되지 않으면 통합이 틀린 것이지 예고값이 틀린 게 아니다.** E1이 자기 워크트리에서 기록한 네 값은 통합 트리에서 그대로 나와야 한다. 다르면 E2·E3·E4 중 하나가 모델로 샌 것이고, 범인은 "각 워크트리에서 `npm run content:verify`가 초록이었는가"(0.85s)로 즉시 좁혀진다. 참고로 유닛 테스트는 증빙 바이트를 검증하지 않으므로 E1 워크트리의 `npm run verify`는 초록이고 `content:verify`/`pacing:verify`/`progression:diagnostic:verify`가 빨간 것이 **정상 상태**다. 그 셋이 초록이면 E1이 증빙을 먼저 덮어쓴 것이다.

### 17.1 Wave 13 실행 결과 (2026-09-19, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `56d0a6ef`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| E1 직업 게이트 60→45 | ✅ `d248fbd7` | 핀 5개 전부 **예고값과 정확히 일치**(불일치 0). E1이 깨끗한 트리에서 before 해시도 먼저 측정해 전후 양쪽을 고정했다 — "테스트가 빨개서 고친" 핀이 하나도 없다. 신규 불변식: 최심 직업 게이트 ≤ 마왕성 **경로** 게이트(48, 리터럴이 아니라 리포트에서 읽는다) |
| E2 맵 경로 게이트 표시 | ✅ `355859f5` | `content:verify`가 베이스라인과 **같은 해시**(`8d9ec598…`)로 그린 — 추출이 리포트 값을 안 움직였다는 증명. 칩 숫자는 그대로 두고 갈라지는 10곳에만 배지를 덧붙였다(숫자를 바꿔 쓰면 화면과 권한이 어긋나 **새 거짓말**이 생긴다). 혼돈의 심연은 `declaredIsLocked: false`로 구분해 다른 문구 |
| E3 시즌 회계 마감 | ✅ `3ebd1368` | 칭호 폴백을 `max(live, archive[].tier)`로, 상한 초과분을 회전 시 다음 시즌 시드로. `DATA_VERSION` 5.1 불변, 골든 바이트 불변 |
| E4 AI 정산 미러링 | ✅ `dac6e918` | rules + 클라이언트 같은 커밋. 페이로드 6키(`unsettled`는 **저장하지 않고** `used − adopted − unadopted`로 도출) |
| 통합 수정 | ✅ `4773afc4` | `ADD_SEASON_XP` 위임 + 퀘스트 101 문구 정정 |
| 증빙 재고정 | ✅ `0b038940` | 3종이 아니라 **4종** |

**성공 기준 — 전부 달성**

| | 이전 | 이후 |
|---|---:|---:|
| 최심 직업 게이트 | Lv60 = 131.15h (`interpolated` 아님, anchored) | **Lv45 = 39.38h** (`anchored`) |
| 승천(53.28h) − 최심 직업 게이트 | **−77.87h** | **+13.90h** |
| `cost.behind` jobs @48·49·60 | 5 | **0** |
| `cost.gates.jobs` | …, 60:5 | …, **45:5** |
| `cost.anchors` 8행 | `0/14/52/82/164/1575/5246/8176` | **바이트 동일** |
| `exploration-rhythm` 최상위 `reportHash` | `0818fb7a…` | **불변** |

**발견 (이 wave의 실제 산출물)**

1. **지배적 XP 경로가 E3의 수정을 못 받고 있었다 (통합 단계 발견).** E3가 자기 파일 집합 밖이라 보고만 하고 넘긴 것이 실은 가장 큰 구멍이었다 — `rewardHandlers.ts`의 `ADD_SEASON_XP`가 `helpers.addSeasonXp`와 같은 계산을 **독립 구현**하고 있었고, 전투 승리(kill/bossKill)·탐험·전설 드롭이 전부 그 경로다. 즉 이월 수정이 **퀘스트 보상에만** 적용되고 지배적 경로는 그대로 XP를 버리고 있었다. 위임으로 클램프의 자리를 한 곳으로 통일했다. **같은 계산의 두 번째 구현은 "중복"이 아니라 "절반만 고쳐지는 버그"다.**
2. **곡선 완화는 이 데이터에서 간극을 넓힌다 (계획 단계 실측).** `EXP_LEVEL_HARD_CAP` 150,000이 Lv50부터 물려 Lv48→60의 92.2%가 평평하므로, `EXP_SCALE_RATE`를 낮추면 상한에 안 걸린 몸통이 걸린 꼬리보다 빨리 줄어 cum(60)/cum(48)이 2.921 → 3.937(@1.13)로 **벌어진다**. 오늘보다 나아지는 첫 값 1.09에서 전체 런이 오늘의 13.1%로 무너진다. 직관("곡선을 완화하면 뒤쪽이 가까워진다")이 거짓인 구간이 있고, 그걸 아는 방법은 계산뿐이다.
3. **프레스티지는 문제를 겪는 사람에게 0을 준다.** 적 exp 배율 0.08/rank이므로 Lv60이 승천 예산에 닿는 것은 rank 19, 도달 비용 631.9h로 간극 77.87h의 8.1배다. 그리고 이 축이 부러진 것을 보는 사람은 **rank 0의 첫 런 플레이어**다. "장기적으로 해결된다"는 답이 단기에 겪는 사람을 못 돕는 전형이다.
4. **§17의 게이트 상태 서술이 틀렸다 — E1·E2·E3·E4가 독립적으로 확인.** "유닛 테스트는 증빙 바이트를 검증하지 않으므로 E1 워크트리의 `npm run verify`는 초록"이라고 썼는데 거짓이다. `tests/progression-diagnostic-cli.test.js`는 `tests/*.test.js` glob에 잡히는 유닛 테스트이고 CLI로 증빙을 검증하며, 그 증빙은 `src/**` **파일 목록의 sha256**을 봉투에 박는다. 그래서 모델 값을 안 건드리는 **순수 추출조차** 이 테스트를 빨갛게 만든다(파일 수 345→346). 올바른 서술: `verify`는 **이 테스트 하나만** 빨갛고, 범인 좁히기의 판별자는 계획대로 `content:verify`(0.85s)뿐이다.
5. **증빙은 3종이 아니라 4종이 움직인다.** `equipment-combat-power.json`이 `authority.classesHash`로 `classes.ts`를 묶는다. 게다가 `tests/equipment-combat-power-audit.test.js`는 정상 `test:unit` 중에 그 파일을 `--write`로 덮어써서 워크트리를 더럽힌다 — 통합자는 이 파일이 수정된 채로 나타나는 것을 예상해야 한다.
6. **rules는 어떤 파이프라인도 배포하지 않는다 (E4).** `deploy.yml`의 `action-hosting-deploy`는 **호스팅만** 올린다. 그래서 "rules와 클라이언트를 같은 커밋에" 규칙은 필요조건이지 충분조건이 아니고, 배포 창이 무기한일 수 있다. E4가 `permission-denied` 시 4키로 1회 폴백하는 무상태 경로를 추가했다(rules가 올라가면 다음 동기화부터 자동 복구). **Firestore rules는 수동 배포가 필요하다.**
7. **E4가 지시를 근거 있게 거부했다.** 계획은 `hasAll`/`hasOnly` 둘 다 넓히라고 했는데, Capacitor 앱이라 구버전 설치본이 영구히 4키를 보낸다 — `hasAll`을 넓히면 **갱신 불가능한 집단의 쓰기가 영구 거부**된다(계획이 경고한 바로 그 조용한 죽음). `hasOnly`만 넓혀 "새 rules는 구 클라이언트를 받고, 구 rules는 새 클라이언트를 거부"하는 비대칭을 만들었고, 그래서 배포 순서가 **rules 먼저**로 확정된다.
8. **원장의 네 숫자는 자유도가 셋이다 (E4).** `unsettled = max(0, used − settled)`는 정산할 때마다 **감소**하므로 단조성을 걸 수도, 안 걸 수도 없다. 저장하지 않고 `adopted + adopted ≤ used`(= `unsettled ≥ 0`)만 rules에 걸어 항등식을 한 필드 적게 보존했다. 단조성 절을 실제로 써 보기 전에는 안 보이는 종류의 사실이다.
9. **퀘스트 101이 거짓말이 됐고, 문구만 고쳤다.** `'전직의 자격 (3차) / 레벨 60 달성하여 3차 전직'`인데 3차 전직은 이제 Lv45다. `goal`/`minLv`를 45로 맞추면 `cost.gates.quests`가 움직여 E1의 불변 증명을 해치므로 문구만 바꾸고(`'극의 증명' / '레벨 60 달성'`), 모델 불변을 실측 확인했다. 게이트 정렬은 Wave 14 후보.

**최종 게이트** (head `0b038940`, CI 동일 빌드): type-check 0 · lint 0 · unit **5,086 / 5,086**(skip 0, Wave 12 대비 +47) · build:guard ok · e2e **121 / 121**(61 + 60) · perf desktop ok(FCP 584ms) / mobile ok(FCP 324ms) · 증빙 12종 verify 전부 ok. 1차 실행 전 단계 그린.

**남은 후보 (Wave 14)**: (1) **퀘스트 게이트 정렬** — 퀘스트 101의 `goal`/`minLv`를 45로 맞춘다. `cost.gates.quests`가 한 버킷 움직이므로 예고값을 먼저 기록하고 들어갈 것; (2) **tier-3 안의 25배 격차** — 시간술사 `reqLv: 25` vs 나머지 45. 같은 선언 티어가 서로 다른 시간대에 있다; (3) **성직자 갈래의 선택지 0개 구간** — `next`가 팔라딘 하나뿐이라 Lv5~45가 분기 없는 외길이다; (4) **`firestore.rules` 배포 자동화 + 에뮬레이터 검증** — 지금은 수동 배포에 semantics를 검증하는 것이 아무것도 없다(`@firebase/rules-unit-testing` + CI job, `package.json`·CI 수정 동반); (5) **`equipment-combat-power-audit` 테스트의 증빙 쓰기 부작용** — 정상 테스트 실행이 트래킹 파일을 덮어쓴다; (6) class-(b) 1,807건은 Wave 11 정책대로 계속 방치.
