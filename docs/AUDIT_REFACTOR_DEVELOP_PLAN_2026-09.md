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

## 18. Wave 14 계획 (2026-09-19 착수, 베이스 `main` = `636fc273` = PR #40 merge commit)

**핵심**: Wave 13이 직업 게이트를 45로 내려 승천 앞에 13.90h 여유를 만들고 나니, 같은 리포트의 `cost.behind`가 **더 깊은 간극**을 가리킨다 — `level: 49` 행에서 `jobs`는 0이 됐지만 `eventChainTerminalSteps`는 여전히 **5 / 13**이고 그 다섯은 전부 에테르 관문(경로 Lv68 = 170.23h)이다. 승천 게이트(53.28h)와의 차는 **−116.95h**로 Wave 13이 닫은 −77.87h의 **1.50배**다. 그런데 이게 장비 65종·퀘스트 39개·맵 13개와 **같은 종류가 아니라는 것**이 이번 wave의 근거다: 그 셋은 §17이 "승천을 거절한 플레이어의 깊이"로 분류한, 애초에 **열리지 않는** 콘텐츠다. 체인은 **열렸다가 닫히지 않는다** — 실측으로 4개가 승천 이전에 열린다(`ancient_prophecy` 어둠의 동굴 Lv10 = 2.05h · `dragon_legacy` 화염의 협곡 Lv15 = 2.73h · `forgotten_god` 고대 마법 탑 Lv25 = 5.23h · `world_tree_corruption` 세계수 숲 Lv40 = 21.08h) 그리고 완주는 전부 170.23h다. 그 사이에 리셋이 있고, **`pickPermanentPlayerState`에 `eventChainProgress`가 없어서** `ASCEND`가 `...INITIAL_STATE.player`로 지운다 — `stats.discoveryChains`·`stats.visitedMaps`·`stats.codex`·`titles`가 전부 계승되는 **지식 축에서 이것 하나만** 리셋된다. 플레이어는 그걸 본다: `QuestTab`이 `buildChainJournal(player.eventChainProgress)`로 "진행 중" 목록을 그리고 `returnBriefing`이 `activeChainCount`를 센다. 게다가 **리포트가 그 게이트를 틀리게 매기고 있다** — `contentReachability.ts`의 `eventChainTerminalSteps()`가 `chain.steps.at(-1).loc` 하나만 보는데 `forgotten_god`은 고대 마법 탑(25) → **에테르 관문(68)** → 혼돈의 심연(48)로 스텝이 역전돼 있고 `chainEventHandlers.ts:99`가 스텝 순서를 강제하므로, 오늘의 `cost`는 이 체인을 48(53.28h)에 적으며 **116.95h 과소 계상**한다. Wave 12가 "맵 선언 레벨은 실제 게이트가 아니다"로 잡은 것과 같은 오류가 체인 축에 그대로 남아 있었다. 한편 §17.1이 남긴 나머지 후보들은 실측하면 크기가 달라진다 — tier 3 안의 격차는 25배가 아니라 **7.53배**(39.38h / 5.23h)이고, `tier`를 읽는 프로덕션 지점은 `ClassIcon`의 `TIER_COLORS[tier]`(색) **한 곳**뿐이며 `cost.gates.jobs`는 `reqLv`만 읽는다. 그래서 직업 사다리 후보 셋은 "tier를 비용 밴드로 만드는" 일이 아니라 **라벨이 자기가 가리키는 것과 어긋난 세 자리를 맞추는** 하나의 작은 트랙이다. 마지막으로, 이 wave는 계측기 자체의 구멍 둘을 함께 닫는다: `equipment-combat-power-audit.test.js`는 저장소에서 **유일하게** 정상 `test:unit` 중 tracked 증빙에 `--write` 성공을 실행하는 테스트이고, `firestore.rules`는 의미 검증이 0이라 **모든 플레이어에게 열린 기능 하나가 rules에 없는 경로로 쓰고 있다**.

**실측 — 승천(Lv48 = 53.28h) 이후에 남는 것** (`cost.behind`의 `level: 49` 행)

| | 남는 수 | 가장 깊은 게이트 | 승천 이전에 **열리는가** |
|---|---:|---|---|
| 직업 | **0 / 18** | — | — (Wave 13 E1이 닫음) |
| 장비 | 65 / 229 | Lv75 = 204.40h | 아니다 — 열리지 않는다 |
| 퀘스트 | 39 / 143 | Lv79 = **비용 없음**(`beyond-anchors`) | 아니다 |
| 맵 | 13 / 52 | Lv75 = 204.40h | 아니다 |
| **이벤트 체인 종착** | **5 / 13** | 경로 Lv68 = 170.23h | **4개가 2.05h~21.08h에 열린다** |

**실측 — 체인 13개의 열림 / 완주 게이트** (경로 게이트 기준, `src/utils/mapRouteGate.ts` authority)

| 체인 | 열림 | 완주(전 스텝 max) | 간격 | 오늘 리포트가 적는 값 |
|---|---:|---:|---:|---|
| `ancient_prophecy` | Lv10 = 2.05h | Lv68 = 170.23h | **168.18h** | 68 (맞음) |
| `dragon_legacy` | Lv15 = 2.73h | Lv68 = 170.23h | **167.50h** | 68 (맞음) |
| `forgotten_god` | Lv25 = 5.23h | Lv68 = 170.23h | **165.00h** | **48 — 116.95h 과소** |
| `world_tree_corruption` | Lv40 = 21.08h | Lv68 = 170.23h | **149.15h** | 68 (맞음) |
| `divine_apostle_trial` | Lv50 = 65.90h | Lv68 = 170.23h | 104.33h | 68 (맞음, 승천 뒤에 열린다) |
| `rift_secret` | Lv68 = 170.23h | Lv68 = 170.23h | 0h | 68 (맞음) |
| 나머지 7종 | Lv1~Lv48 | Lv23~Lv48 | — | 맞음 — 전부 루프 안에서 닫힌다 |

**실측 — 직업 사다리의 세 라벨** (`tier` / 그래프 깊이 / `reqLv`)

| | 실측 |
|---|---|
| `tier` == `모험가`로부터의 BFS 깊이 | **18개 중 17개 일치**. 유일한 불일치는 **성직자**(tier 1, 깊이 2 — `모험가→마법사→성직자`) |
| `tier`를 읽는 곳 | 프로덕션 1곳(`ClassIcon`의 `TIER_COLORS[tier]` = 색), 테스트 1곳(`skill-branch-parity.test.js`의 `tier ≥ 2 ⇒ 분기 스킬 2개 이상`). `classSchemaErrors`는 0~3 **범위**만 본다 |
| `cost.gates.jobs`가 읽는 것 | **`reqLv`뿐** — `tier`는 비용 축의 입력이 아니다 |
| Lv5(1.30h)에 열려 있는 후속 직업 수 | 전사 **0** · 도적 **0** · 마법사 **1**(성직자, reqLv 5) |
| 그 1을 집었을 때 | 되돌릴 수 없다(`characterActions.jobChange`는 `current.next.includes`만 본다). 무당(12)·아크메이지(30)·흑마법사(30)가 영구히 닫히고 capstone이 **5.23h(시간술사) → 39.38h(팔라딘)**, 7.53배. 성직자의 `next`는 팔라딘 하나뿐이라 그 뒤 **38.08h 동안 선택지 0개** |

**실측 — 검증되지 않는 표면** (`firestore.rules` 11 match · 17 allow 중 Wave 13 E4의 텍스트 가드가 덮는 건 quota 블록 하나다)

| 클라이언트 쓰기 지점 | 경로 | rules 판정 |
|---|---|---|
| `createCloudAutosave.ts:117` | `artifacts/aetheria-rpg/users/{uid}` | 통과(미검증) |
| `createCloudAutosave.ts:122` | `…/public/data/leaderboard/{uid}` | 통과(미검증) |
| `useFirebaseSync.ts:585` | `…/public/data/graves/{uid}` | 통과(미검증 — `gold ≤ 9,999,999` 상한을 클라이언트가 보장하지 않는다) |
| `TokenQuotaManager.ts:211` | `…/users/{uid}/quota/daily-ai` | 통과(Wave 13 E4의 **텍스트** 가드만) |
| `SystemTab.tsx:309` | `…/public/data` | **무조건 거부**(의도 — Console 전용) |
| `SystemTab.tsx:370` | `…/public/data/feedback` | **무조건 거부** — rules에 `feedback` 0건, 앱 블록의 `match /{document=**} { allow read,write: if false }`가 받는다. UI는 게이트 없이 모든 플레이어에게 열려 있고 실패는 "의견을 보내지 못했습니다."로 삼켜진다 |

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **F1 증빙 베이스라인의 자기치유 제거** | `tests/equipment-combat-power-audit.test.js`는 저장소에서 **유일하게** 정상 실행 중 tracked 증빙에 `--write` 성공을 때린다(4곳). 형제 11종은 `--write <tracked>`를 **거부 목록에서만** 쓰고, `exploration-rhythm.test.js`는 실행 전후 바이트 동일까지 단언한다. 둘 중 하나의 선례를 따른다 — temp `cwd` + `node_modules` 심볼릭 링크로 CLI를 돌리거나, 쓰기 전후 바이트를 tracked와 **동일하다고 단언하고 finally에서 복원**하거나. **예고 증빙 델타: 없음** | `classes.ts`가 움직이는 순간 이 증빙이 **스스로 재베이스라인되고 `equipment:combat-power:verify`가 그 위에서 초록이 되는** 구멍이 닫힌다 | 테스트 1파일 | `--write` 호출을 그냥 지우면 **writer 경로의 커버리지가 사라진다** — 이번 wave의 증빙 재고정이 검증되지 않은 코드로 실행된다. 바이트 동일 단언 없이 temp로만 옮기는 것도 실패다 | sonnet |
| **F2 체인 완주 게이트와 승천의 지우개** | (1) `eventChainTerminalSteps()`를 **전 스텝 max**로 — 완주 게이트는 종착 스텝의 게이트가 아니다. `cost.eventChainSpans` 13행 신설, `report.schemaVersion` 2→3 + `EXPECTED_SCHEMA_VERSION`. (2) `forgotten_god` 스텝 1의 `loc`을 경로 게이트 ≤48인 지역으로 — **역전 교정**이다(13개 중 완주 게이트가 종착 게이트보다 높은 유일한 체인). (3) `pickPermanentPlayerState`가 `eventChainProgress`의 **체인 id 키만** 이월. **예고 델타**: (i) 측정만 고쳤을 때 `gates.eventChainTerminals` **48:4→3 · 68:5→6**, `behind`의 체인 열 **5→6** @ 49·50·52·55·59·60·62·65·68. (ii) 스텝 이동 뒤 **48:4 / 68:5로 복귀**. `event-reward-coherence.json`은 `chain:forgotten_god:1:0`·`1:1` **2행만** 움직이고 `errors`·3개 카운트 불변. **불변**: `cost.anchors` 8행, `gates.{maps,quests,equipmentTiers,jobs}`, `mapGateDivergence` 10행 | 서사 축의 비용이 처음으로 정직해지고, 2.05h에 시작한 이야기가 승천마다 0으로 돌아가던 것이 멈춘다 | systems 1 + data 1 + utils 1 + 테스트 3(신규 1) + 스크립트 1 | `eventChainProgress`를 **통째로** 이월하면 실패다 — 이 필드는 용도가 둘이라 `boundedEncounterReceipts` 키가 원정 조우 영수증 레저를 겸한다. 통째로 넘기면 영수증이 승천을 넘어가 재획득을 막는다. 종착 3개(Lv68)를 이 트랙에서 같이 옮기는 것도 실패다 | opus |
| **F3 `firestore.rules`를 실행해서 검증한다** | 에뮬레이터(`firebase.json`에 `emulators` 블록) + `@firebase/rules-unit-testing` + CI job. 테스트는 **rules가 아니라 클라이언트 쓰기 지점 6곳에서 쓴다** — 각 지점의 실제 페이로드를 그대로 태워 통과/거부를 실행으로 본다. 그 결과 강제되는 결정 하나: `…/public/data/feedback`에 match를 추가할지, 기능을 걷어낼지. **예고 델타**: `progression-diagnostic-v2.json`의 `sources`에 **`package.json`·`package-lock.json`이 있으므로** 게임 코드를 한 줄도 안 건드려도 이 증빙이 움직인다. `sources` 길이는 346 유지. 나머지 증빙 12종 불변 | 저장소의 보안 표면 전체(11 match · 17 allow)가 실행 가능해진다. 지금은 **모든 플레이어에게 열린 기능 하나가 100% 거부**되는데 저장소의 어떤 게이트도 그걸 못 본다 | `package.json`(+lock) · CI job 1 · rules 1 · 테스트 1 — **어떤 트랙도 건드린 적 없는 두 파일** | **rules에서 유도한 테스트를 쓰면 실패다** — 의견 보내기를 막는 오늘의 rules 위에서도 초록이다. 반드시 클라이언트 쓰기 지점에서 유도할 것. 에뮬레이터가 JDK를 요구한다(CI 러너의 JDK 유무는 첫 실행으로 확인하고 없으면 setup-java). `hasAll`을 넓히는 것은 여전히 금지(§17.1 발견 7) | opus |
| **F4 직업·퀘스트 라벨 정렬** | 셋 다 "선언한 라벨이 자기가 가리키는 것과 어긋난다"의 같은 형태다. (1) `성직자` `tier: 1 → 2`(깊이와 일치). (2) `성직자` `reqLv: 5 → 12` — **기준은 "첫 되돌릴 수 없는 분기는 세 뿌리에서 같은 모양이어야 한다"**: 지금 Lv5에 열린 후속은 전사 0 / 도적 0 / 마법사 1이고, 그 1을 집으면 5.23h capstone이 영구히 닫힌다. (3) 퀘스트 101 `goal 60/minLv 59 → 45/44`, 문구를 `'전직의 자격 (3차)' / '레벨 45 달성하여 3차 전직'`로 되돌린다(100번과 같은 `minLv = goal − 1` 규칙). (4) 신규 불변식 `tier === 모험가로부터의 BFS 깊이`(18/18). **예고 델타**: `gates.jobs` → `[1:1, **5:3**, **12:2**, 25:1, 30:6, 45:5]`. `gates.quests` **`59:1` 소멸**, `44` 1→2. `behind` **45행 → 44행**, `jobs` +1 @ 6·7·8·10·12, `quests` −1 @ 45·48·49·50·52·55. `progression-simulator.test.js`의 `EXPECTED_JOB_LEVELS[10]` 5→12, `reachableJobCount` → `[1,4,4,6,18,18,18]`. `equipment-combat-power.json`은 `authority.classesHash`와 `sourceSnapshot` 한 줄만 — **`reportHash` 불변**. **불변**: `cost.anchors` 8행(모델 플레이어는 끝까지 `모험가`다) | 라벨 셋이 자기가 가리키는 것과 일치하고, Wave 13이 45로 내린 3차 전직에 **그 보상이 따라온다**. 첫 분기의 숨은 함정이 사라진다 | 데이터 2파일 + 핀 3파일 + 신규 테스트 1 | 핀 3종을 **전후 양쪽 깨끗한 트리에서 먼저 실측**해 기록할 것 — "테스트가 빨개서 고친" 핀이 하나라도 있으면 E1이 세운 기준을 잃는다. 시간술사를 45로 같이 올리는 것도 실패다(아래 기각 1). 골든 바이트 불변 확인할 것 | opus |
| **F5 증빙 재고정·문서** | 통합 트리에서 F2·F4의 예고값 재현 확인 → 증빙 **5종** 재생성(순서 고정) → **13종** `*:verify` → §18.1, CLAUDE.md, `tasks/todo.md` | — | — | — | 직접 |

**파일 집합** — F1: `tests/equipment-combat-power-audit.test.js`. F2: `src/systems/contentReachability.ts` · `src/data/eventChains.ts` · `src/utils/permanentProgress.ts` · `scripts/verify-content-reachability.mjs` · `tests/content-reachability.test.js` · `tests/permanent-progress-copy.test.js` · `tests/event-chain-cost.test.js`(신규). F3: `firestore.rules` · `firebase.json` · `package.json` · `package-lock.json` · `.github/workflows/ci.yml` · `tests/firestore-rules-semantics.test.js`(신규) · `tests/token-quota-firestore-contract.test.js` (+ 피드백 결정이 "기능 제거"면 `src/components/tabs/SystemTab.tsx`). F4: `src/data/classes.ts` · `src/data/quests.ts` · `tests/progression-simulator.test.js` · `tests/class-tier-depth.test.js`(신규) · `scripts/progression-diagnostic-evidence.mjs` · **`tests/content-reachability.test.js`(F2와 공유 — 이 wave의 유일한 교차)**. F5: `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md` · `CLAUDE.md` · `tasks/todo.md` · 증빙 5종.

**순서**: **F1 직렬 선행 — 나머지 세 트랙은 F1 커밋에서 분기한다.** 이유는 실측이다: F1 이전 트리에서 `src/data/classes.ts`를 만지는 F4의 워크트리는 `npm run test:unit` **한 번**에 `equipment-combat-power.json`을 스스로 새 `classesHash`로 덮어쓰고, 그러면 §17이 E1에 건 "워크트리에서 증빙을 `--write`하지 않는다"가 이 파일에 대해서만 강제 불가다 → **F2 · F3 병렬**(파일 집합 무교차) → 통합 → **F4 직렬**(F2가 `tests/content-reachability.test.js`를 다시 쓰므로) → **통합 트리에서 F2·F4의 예고값 재현 확인**(어긋나면 증빙을 만들기 전에 멈춘다) → **증빙 재고정은 통합자가 마지막에 한 번만, 순서 고정**: ① `PROGRESSION_V1_BASELINE_HASH` 갱신 확인 → ② content(`--write`) → ③ event-reward-coherence(`--write`) → ④ equipment-combat-power(`--write`) — **이번 wave부터 수동 단계다**(F1이 테스트의 자동 쓰기를 없앴다) → ⑤ pacing(`--write`, 4m30s) → ⑥ `progression:diagnostic:write`(1m59s, **346개 해시**를 실행 전후로 다시 읽으므로 **맨 마지막**이고 병행 명령 금지) → **13종** `*:verify` → 직렬 게이트 → F5 → PR → CI → merge commit.

**판단 포인트**: 셋을 틀리면 이 wave는 측정을 쓰지 못하고 측정만 망친다. 첫째, **F2는 측정을 고치는 트랙이지 콘텐츠를 옮기는 트랙이 아니다 — 예외는 하나뿐이고 그건 취향이 아니다.** `forgotten_god`은 스텝 순서가 강제되는데 중간 스텝의 게이트(68)가 종착(48)보다 높다. 그런 체인은 13개 중 하나뿐이고, 그것만 고친다. 나머지 셋의 Lv68 종착을 같이 옮기고 싶어지는데, 그 순간 `eventRewardCoherenceAudit`의 tier 바닥과 장비 경제가 함께 움직이고, 무엇보다 **교정되지 않은 측정 위에서 콘텐츠를 옮기게 된다** — Wave 12→13의 순서를 뒤집는 것이다. 둘째, **rules 테스트는 rules에서 쓰면 안 되고 클라이언트 쓰기 지점에서 써야 한다.** rules 텍스트를 재현한 테스트는 의견 보내기를 막는 오늘의 rules 위에서도 초록이다. F3의 산출물은 "rules를 테스트로 옮겼다"가 아니라 **"6개 쓰기 지점의 실제 페이로드를 태워 통과/거부를 실행으로 봤다"**여야 하고, 거부가 정답인 지점(admin `public/data`)도 거부로 고정해야 한다. 셋째, **§17이 게이트 상태를 틀리게 적었다 — 정정한다.** `tests/progression-diagnostic-cli.test.js`는 `tests/*.test.js` glob에 잡히는 유닛 테스트이고 증빙 CLI를 `--verify`로 실행하며, 그 봉투는 `src/**` 332개 + 고정 14경로 = **346개 파일의 sha256**을 박는다. 그래서 `src/**`를 **한 글자라도** 고치면 `npm run verify`가 정확히 이 테스트 하나로 빨개지고, 그게 **정상 상태**다. 범인 좁히기의 유일한 판별자는 `content:verify`다. 그리고 §16·§17이 적은 "증빙 12종"은 **13종**이 맞다(JSON 14개 중 `observation-summary.json`만 verify가 없다).

**하지 않기로 한 것** (나중 wave가 다시 논의하지 않도록 사유와 함께 남긴다)

1. **`tier`를 비용 밴드로 만들기**(시간술사 `reqLv` 25→45, 무당 12→30). `tier`를 읽는 곳은 실측 두 곳뿐이고 둘 다 비용이 아니다. `cost.gates.jobs`는 `reqLv`만 읽는다. tier 3 안의 격차는 25배가 아니라 **7.53배**다(25.1배는 Wave 13 이전 값이고 §17.1의 후보 목록이 그 값을 들고 있었다). 시간술사를 45로 올리면 **40시간 미만의 유일한 capstone이 사라진다** — Wave 13이 만든 여유와 정반대 방향이다. `tier`는 앞으로도 **위상 라벨**이고 F4가 그것을 불변식으로 못 박는다.
2. **Lv68 종착 3개를 루프 안으로 이동.** Wave 15. 교정된 측정(F2의 `cost.eventChainSpans`)이 입력이고, 이동은 `CHAIN_ITEM_TIER_TOO_LOW` 바닥과 장비 경제를 함께 끌고 들어온다.
3. **성직자에게 두 번째 후속 직업 주기.** 콘텐츠 추가이고, F4의 `reqLv 5→12`가 "Lv5의 숨은 함정"이라는 실제 문제를 데이터 한 줄로 제거한다. 38.08h 외길 자체는 깊이-2 직업 전부가 `next` 1개인 구조와 같다.
4. **곡선(`EXP_SCALE_RATE`)·프레스티지 이월.** §17이 실측으로 기각했다. 재측정 없이 다시 꺼내지 말 것.
5. **맵 선언 레벨을 경로 게이트에 맞추기.** §17 실측: 방향이 반대다. E2가 "표시"로 해결했고 그게 맞는 형태다.
6. **퀘스트 104(minLv 79)의 `beyond-anchors` 공백 메우기.** 앵커를 Lv80까지 늘리면 `cost.anchors`가 8행에서 9행이 되어 Wave 13이 남긴 "바이트 동일" 기준선이 사라진다. 값이 `null`인 것이 정직한 상태다.
7. **`SystemTab`의 admin 도구를 동작하게 만들기.** `public/data` 쓰기를 rules가 막는 것은 의도다. F3은 "항상 거부된다"를 실행 테스트로 고정만 한다.
8. **class-(b) 소스 가드 1,807건.** Wave 11 C4 정책대로 계속 방치.

### 18.1 Wave 14 실행 결과 (2026-09-19, branch `claude/funny-rubin-xdv43e`, 베이스 `main` = `636fc273`)

| 트랙 | 상태 | 결과 |
|---|---|---|
| F1 증빙 자기치유 제거 | ✅ `ac8ab3e6` | 바이트 동일 + `finally` 복원 선례를 택했다(temp-cwd 불가 — writer가 자식 프로세스를 띄우고 그 자식이 `./src/...`를 **자기 cwd 기준으로** 해석한다. 형제 `equipment-economy-audit`이 temp-cwd로 되는 건 그쪽 CLI가 리포트 빌더를 모듈 로드 시점에 정적 import하기 때문). 기존 `finally`의 미묘한 버그도 잡았다 — `baseline`을 **첫 `--write` 이후에** 캡처해 self-heal된 값으로 "복원"하고 있었다 |
| F2 체인 완주 게이트 + 승천 이월 | ✅ stage i `f0d20a7a` / stage ii `2e25d8e5` | 완주 게이트를 `steps.at(-1)` → **전 스텝 max**로, `cost.eventChainSpans` 13행 신설, `schemaVersion` 2→3. 이월은 키를 **제외**하는 대신 `EVENT_CHAINS`를 순회해 **끌어와** 예약 키가 구조적으로 도달 불가능하다. stage ii(`forgotten_god` 역전 교정)는 F2가 파일 경계에서 멈추고 통합자가 마무리 |
| F3 rules 실행 검증 | ✅ `5f1a50e2` | 에뮬레이터 + `@firebase/rules-unit-testing` + CI job. 쓰기 지점 6곳의 **실제 페이로드**로 17/17, 그리고 **네거티브 컨트롤** — 변경 전 rules에 같은 스위트를 돌려 정확히 피드백 수용 3건만 빨개짐을 확인(스위트가 공허하지 않다는 증명) |
| F4 라벨 정렬 | ✅ `abd3bb80` | `성직자` `reqLv 5→12`, 퀘스트 101 `goal/minLv 45/44` + 문구 복원, `tier === BFS 깊이` 불변식. **`tier 1→2`는 보류** — 사유 아래 |
| 증빙 재고정 | ✅ `65c21fad` | 예상 3종이 아니라 **5종** |

**성공 기준 — 달성**

| | 이전 | 이후 |
|---|---:|---:|
| `test:unit` 후 `docs/evidence/` 더티 | 매번 1파일 | **깨끗** |
| `firestore.rules` 실행 검증 | 0건 | **17/17** (쓰기 지점 6곳) |
| 의견 보내기 | rules에 경로 없음 → 100% 거부 | **통과**(rules 수동 배포 후 실제 동작) |
| `forgotten_god` 완주 게이트 | 48로 적힘(실제 68, 116.95h 과소) | **48이 참이 됨**(역전 교정) |
| 승천 걸친 체인 | 4개, 진행도 리셋 | **3개, 진행도 이월** |
| Lv5 후속 직업(전사/도적/마법사) | 0 / 0 / **1** | **0 / 0 / 0** (Lv12에서 2택) |
| `cost.anchors` 8행 | — | **바이트 동일** |

**발견 (이 wave의 실제 산출물)**

1. **§18의 `tier` reader census가 틀렸다 — 2곳이 아니라 4곳이고, 하나가 1,065개 파일에 핀돼 있다 (F4).** `scripts/artCatalog.mjs`의 `normalizeClasses`가 `{name, tier}`를 **아트 카탈로그 identity 해시**에 넣는다(실측: `tier` 변경 시 `catalogSha256` `c15c4e6f…`→`2ef481ad…`, `reqLv` 변경 시 불변). `c15c4e6f`를 핀하는 파일이 **1,065개**이고 그중 **65개가 `scripts/art_sources/**`의 아트 생산 provenance 기록**이다 — 그 기록은 "이 아트는 카탈로그 X에 대해 생산됐다"는 **역사**이고, 아트 스위트는 비활성 `catalogSha256`을 가진 기록이 **거부되는지**를 일부러 테스트한다. 덮어쓰는 건 증빙 재생성이 아니라 가드가 지키려는 역사를 다시 쓰는 것이다. 네 번째 reader는 `progressionSimulator`의 `jobSnapshots[].tier`(골든 해시에 들어간다). **census가 "한 곳"이라는 전제 아래 이 편집이 한 글자로 보였고, 그게 아니었다.**
2. **`tier`를 아트 identity에서 빼는 "진짜 수리"도 공짜가 아니다 (통합 시 확인).** identity **모양**이 바뀌므로 같은 1,065개가 무효화된다. 즉 Wave 15의 질문은 "빼면 되나"가 아니라 **"provenance 역사를 재핀할 수 있나"**이고, 답이 아니라면 스키마 버전이나 문서화된 예외가 형태다. F4가 출하한 상태(괴리 집합 = 정확히 `['성직자']`, 늘어날 수 없음)는 그 결정까지 안정적으로 버티는 상태다.
3. **Firestore rules의 `size()`는 바이트가 아니라 문자를 센다 (F3, 실행해야만 알 수 있다).** 한국어 500자는 UTF-8 1,500바이트다. 바이트였다면 `≤1000` 규칙이 **한국어 UI에서만** 거부를 일으켰을 것이고, 텍스트 가드로는 절대 못 잡는다.
4. **이웃 블록의 패턴을 복제하지 않은 것이 F3의 핵심 판단이다.** `graves`가 `gold ≤ 9,999,999`를 클라이언트 보장 없이 캡하는데 그게 §18이 지적한 **조용히 거부되는 절벽**이다. 새 `feedback` 블록에 같은 패턴을 복제하면 이 트랙이 없애려는 버그 클래스를 새로 만든다 — `level`만 캡했고(`CONSTANTS.MAX_LEVEL`이 실제로 보장), `message` 한도는 `FeedbackValidator`에서 **도출**했다.
5. **`firebase-tools`를 devDependency로 넣지 않았다 (F3).** 넣으면 락파일에 **566 패키지 / 약 265MB**가 들어가고 네 job의 `npm ci`가 전부 그 비용을 내며 무관한 전이 핀 2개가 움직인다. 버전 고정 `npx --yes firebase-tools@15.30.2`로 옮겨 락파일 증분이 **1 패키지**다.
6. **F2가 파일 경계에서 멈춘 것이 옳았다.** `forgotten_god` 이동이 `tests/event-chain-failure.test.js`(자기 집합도, §18 F2 목록도 아님)를 깬다. 진행했으면 `verify`가 **두 개** 테스트로 빨개져 "정확히 하나만 빨간 것이 정상"이라는 판별 기준을 잃었다. 필요한 편집 4개를 열거해 넘겼고 통합자가 마무리했다.
7. **위치를 옮기면 문구도 옮겨야 한다 (F2).** step 1 텍스트가 "관문 앞에서", "관문을 봉인한다"로 장소를 전제했다 — `loc`만 바꾸면 이 wave가 없애려는 "장소와 텍스트가 어긋난다"를 새로 만든다. 문구 4곳(title·desc·choice·log)을 함께 옮겼다. `지하 미궁`을 고른 근거는 로어다: *"원시의 신이 봉인되기 전 만들어진 미궁"*이고 step 2의 무대 `혼돈의 심연`의 보스가 **원시의 신**이다. 후보 4곳 모두 max 48이라 비용 델타는 동일하고 선택은 순전히 서사였다.
8. **아트 스위트는 타겟 재실행이 거짓 초록을 준다 (F4).** `tier` 변경으로 실패한 70건을 파일 단위로 **단독 실행하면 통과한다** — 전체 스위트만 바뀐 `catalogSha256` 경로를 본다. 이 실패를 타겟 재실행으로 triage하면 잘못된 결론에 도달한다.
9. **F1의 예고 델타 "없음"은 절반만 맞았다 (F1·F3 독립 확인).** F1은 증빙 바이트를 바꾸지 않지만 self-heal 마스킹을 제거해서 **기존 stale이 보이게** 만든다 — `equipment:combat-power:verify`가 F1 커밋 직후부터 빨갛고, F5의 재생성이 그걸 닫는다.
10. **`package.json`에 선언만 하고 로컬 설치를 안 하면 테스트가 import 단계에서 죽는다 (통합 시).** F3가 graceful degradation(에뮬레이터 없으면 러너 존재를 단언)을 설계했지만 top-level import는 그보다 앞선다. CI는 `npm ci`로 설치하므로 무해하고, 로컬은 `npm install` 한 번으로 맞춰진다 — 다만 "degradation이 설계됐다"는 것과 "모든 부재 상황에서 degradation한다"는 다르다.

**최종 게이트** (head `65c21fad` + 로컬 devDependency 설치, CI 동일 빌드): type-check 0 · lint 0 · unit **5,104 / 5,104**(skip 0, Wave 13 대비 +18) · build:guard ok · e2e **121 / 121**(61 + 60) · perf desktop ok(FCP 492ms) / mobile ok(FCP 396ms) · `release-complete-core` 증빙 **13종** verify 전부 ok · `test:unit` 후 `docs/evidence/` **깨끗**(F1의 산출물). 게이트 1차 실행의 unit 1건 실패는 `@firebase/rules-unit-testing` 로컬 미설치였고 설치 후 재현되지 않는다. `toss:evidence:verify`·`observation:host:verify`는 `main`에서도 빨갛다(이 세트 밖, 기존 실패).

**남은 후보 (Wave 15)**: (1) **`tier`를 아트 identity에서 분리** — 발견 1·2. 빼는 것도 1,065개를 무효화하므로 "provenance 역사를 재핀할 수 있나"가 선행 질문이다. 그 답이 나오면 `성직자 tier 1→2`와 `KNOWN_TIER_DEPTH_DIVERGENCE` 비우기가 한 커밋이다(F4가 측정한 후속 핀: `EXPECTED_BASELINE_REPORT_SHA256 = 9da28843…`, `PROGRESSION_V1_BASELINE_HASH = 4a888aa0…`, pacing focused 해시는 양쪽 동일); (2) **Lv68 종착 3개를 루프 안으로** — 교정된 측정(`cost.eventChainSpans`)이 입력이고 `CHAIN_ITEM_TIER_TOO_LOW` 바닥·장비 경제를 함께 끌고 온다; (3) **`graves`의 `gold` 캡 절벽** — rules가 `≤ 9,999,999`를 캡하는데 클라이언트가 보장하지 않고 `.catch(console.warn)`이 삼킨다. F3가 새 블록에서 복제를 거부했으니 기존 블록도 같은 기준으로; (4) **`deploy.yml`의 rules 배포 자동화** — 지금은 수동이라 의견 보내기가 배포까지 안 열린다; (5) **`summary.eventChainTerminalSteps` 이름 정정** — 이제 체인 수를 세고 버킷은 완주 게이트다(F2가 스키마 churn을 피해 보류); (6) class-(b) 1,807건은 Wave 11 C4 정책대로 방치.

## 19. Wave 15 계획 (2026-09-20 착수, 베이스 `main` = `56d30895` = PR #41 merge commit)

**핵심**: Wave 14가 고친 것은 자였고, 이번 wave는 그 자가 가리킨 값을 쓴다. `cost.eventChainSpans` 13행 중 **3개가 승천 게이트를 걸친다** — `ancient_prophecy` 2.05h→170.23h · `dragon_legacy` 2.73h→170.23h · `world_tree_corruption` 21.08h→170.23h이고, 그 사이에 마왕성 경로 게이트(Lv48 = 53.28h)가 있다. Wave 14 F2가 진행도를 이월해 "매번 0으로 돌아간다"는 막았지만 **자기 런 안에서 끝나는 이야기는 여전히 0개**다: 세 체인의 span 합은 484.83h이고 승천 예산은 53.28h다. 그런데 §18이 이 이동의 블로커로 적은 둘은 실측하면 실체가 없다 — `eventRewardCoherenceAudit`의 `CHAIN_ITEM_TIER_TOO_LOW`는 `max(1, highestAvailableTier(map.level) − 1)`의 **바닥**이라 목적지를 낮추면 구조적으로 발동하지 않고(세계수의 지팡이 T5 @ 세계수 숲 38 → MIN_T2), "tier5가 얕은 맵에 떨어진다"는 이미 출시된 관행이다(`lost_wizard:2:0` T5 @ 천공 정원 40 · `machine_uprising:2:0` T5 @ 북부 요새 32 · `last_hero:1:0` T4 @ 화염의 협곡 15). 결정적으로 종착 셋 중 **둘은 보상이 relic뿐이라 아이템 티어 축과 접점이 0**이고, 나머지 하나가 주는 `세계수의 지팡이`는 퀘스트 142(minLv 38)의 보상이자 `수련 님프`(Lv5·7) 3% / `봄의 여왕`(Lv[5,15]) 5% 드롭이다 — 이동 후 위치가 그 아이템의 **기존 출처와 같은 레벨대**가 된다. `equipment-economy`는 카탈로그(가격·코호트) 감사라 체인 위치를 입력으로 받지 않고, `tierEquip.prematureEquipCount`는 시뮬레이터의 전투 드롭 경로만 센다. 대신 진짜 제약은 두 개이고 둘 다 실측으로만 보인다: (1) **종착 스텝이 곧 max**여야 한다(Wave 14가 `forgotten_god`에서 "완주 게이트 ≠ 종착 게이트"를 데이터 입력 오류로 판정하고 `event-chain-cost.test.js`에 `gateChanging === []`로 못 박았다) — 즉 목적지는 `남은 스텝의 max ≤ 목적지 ≤ 48` 구간이다. (2) **안전지대에는 탐험 버튼이 없다** — `canInvestigateTown`은 황금 왕국에서만 true이고 `adventureGuide`는 `safe`에서 `kind: 'explore'`를 반환하지 않는다. 그래서 `machine_uprising`의 종착(북부 요새)과 `water_apostle` 스텝 1(사막 오아시스)은 오늘도 `explore`/`look`/`탐색`을 **타이핑해야만** 진행된다. 그리고 §18의 "Lv68 종착 3개"라는 표현은 `world_tree_corruption`에서 틀렸다 — 그 체인은 스텝 1이 `고대 신전 도시`(경로 **50** = 65.90h)라 종착만 내려도 완주가 승천보다 12.62h 뒤에 남는다. 이 wave가 만지는 것은 종착 3개가 아니라 **스텝 4개**다. 한편 같은 형태의 결함 둘을 함께 닫는다: `graves`의 `gold ≤ 9,999,999`는 rules가 선언하고 클라이언트가 보장하지 않는 유일한 상한이고(나머지 다섯 필드는 실측으로 보장된다), `firestore.rules`는 의견 보내기를 연 지 한 wave가 지나도록 **사람이 배포해야** 열린다. 마지막으로 이 wave의 델타를 적는 이름 자체가 틀려 있다 — `cost.summary.eventChainTerminalSteps`는 종착 **스텝**이 아니라 체인 수를 세고(그래서 종착 스텝이 넷 움직여도 13에서 안 움직인다), `cost.gates.eventChainTerminals`의 버킷 키는 종착이 아니라 **완주** 게이트다.

**실측 — 걸치는 체인 3개와 목적지** (선정 기준 3개: ① 경로 게이트 ≤ 48 ② 남은 스텝의 max 이상(= 종착이 곧 max) ③ `type !== 'safe'`. 셋을 만족하는 후보는 비용이 동일하므로 그 안에서 **로어로** 고른다 — Wave 14 F2 stage(ii)의 선례)

| 체인 | 옮기는 스텝 | 오늘 | 목적지(경로 게이트 · type) | 완주 게이트 | span | 문구 |
|---|---|---|---|---:|---:|---:|
| `ancient_prophecy` | 스텝 2 | 에테르 관문(68) | **마왕성**(48 · dungeon) — 스텝 1이 *"파편 3개를 모아 마왕을 세 번 이상 쓰러뜨리면 진짜가 나타난다"*고 말한다. 조건을 말한 장소에 문이 있다 | **48 = 53.28h** | 168.18h → **51.23h** | 1곳 |
| `dragon_legacy` | 스텝 2 | 에테르 관문(68) | **천공 정원**(40 · dungeon) — 스텝 1에서 드래곤이 내려앉은 그 자리다 | **40 = 21.08h** | 167.50h → **18.35h** | 1곳 |
| `world_tree_corruption` | 스텝 1·2 | 고대 신전 도시(50) · 에테르 관문(68) | **천공 정원**(40, 보스가 *타락한 세계수 수호자*다 — 봉인 의식 기록의 주인) · **세계수 숲**(40, 정화는 나무에서 끝난다) | **40 = 21.08h** | 149.15h → **0h** | 11곳 |

**실측 — 종착 스텝의 보상** (이동이 아이템 경제를 끌고 오는지 여부는 여기서 결정된다)

| 체인:스텝:선택 | 보상 | 아이템 티어 축과의 접점 |
|---|---|---|
| `ancient_prophecy:2:0/2:1` | `relic` / `relic` | **없다** |
| `dragon_legacy:2:0/2:1` | `relic` / `relic` | **없다** |
| `world_tree_corruption:2:0` | `item: 세계수의 지팡이`(T5, 착용 Lv60) | 있다 — 다만 같은 아이템이 퀘스트 142(minLv 38) 보상이고 `수련 님프`(호수의 신전 5 / 신성한 호수 7) 3%, `봄의 여왕`(봄의 정원 [5,15]) 5% 드롭이다. 이동 후 위치(세계수 숲 38)는 그 출처들과 같은 레벨대이고, 바닥 규칙은 MIN_T2라 발동하지 않는다 |
| `world_tree_corruption:2:1` | `relic` | 없다 |

**실측 — 묘비 공개 문서(`public/data/graves/{uid}`)의 상한 6종**

| 필드 | rules | 클라이언트 보장 | 근거 | 도달 가능 |
|---|---|---|---|---|
| `level` | ≤ 99 | **그렇다** | `CombatEngine.outcome.ts`가 `CONSTANTS.MAX_LEVEL`에서 멈춘다 | 아니다 |
| `playerName` | 1~20자 | **그렇다** | 유일 입력 `IntroScreen`의 `maxLength={16}` + 쓰기 지점의 `'무명 용사'` 폴백 | 아니다 |
| `loc` | 1~30자 | **그렇다(데이터로)** | 맵 이름 최장 11자, 폴백 8자 | 아니다 |
| `items` | ≤ 5 | **그렇다** | 쓰기 지점 `.slice(0, 3)` | 아니다 |
| `guardPower` | ≤ 9,999 | 아니다 | `player.atk`는 승천 시 리셋되고 한 런 최대 = 12 + 3×98 + 4×9 + 체인 `stat_bonus` 125 = **467** | 아니다 — 21.4배 여유 |
| **`gold`** | ≤ 9,999,999 | **아니다** | `Σ floor(player.gold/2 × dropBonus)`, `MAX_GOLD` 0건, 묘비 개수 상한 없음, `영혼의 강`은 `graveDropBonus: 2`라 **전액** 업로드 | **그렇다** — 무한 심연 골드 배율 `1 + 0.1×(층−1)`은 상한이 없다(100층 10.9배). 모델 런은 Lv75(204.40h)에 1,141,375G = 상한의 5.7% |

거부되는 것은 숫자가 아니라 **문서 전체**다 — `gold` 하나가 넘치면 `guardPower`(침공 성공률의 입력)와 `items`(침공 보상)까지 같이 사라지고 `.catch(console.warn)`이 삼킨다. 정작 `gold` 자체는 보상에 안 쓰인다(`resolveInvasion`은 아이템만 준다). **기능을 지탱하는 필드는 안전하고, 장식용 필드가 문서를 죽인다.**

**실측 — rules 배포에 필요한 것** (`.github/workflows/deploy.yml`의 `action-hosting-deploy`는 hosting만 올린다 — §17.1 발견 6)

| | 실측 |
|---|---|
| 저장소가 이미 갖춘 것 | `firebase.json`에 `"firestore": { "rules": "firestore.rules" }` 존재 · CI `firestore-rules` job이 node **22** + `setup-java@v4`(temurin 21) + `npx --yes firebase-tools@15.30.2`로 확립한 실행 경로 |
| CLI가 지원하는 것 | `--only firestore:rules`는 실제 서브타겟이다(`lib/deploy/firestore/prepare.js:95-103`) · `--project`/`--non-interactive`/`--dry-run` 존재 · **`--token`은 DEPRECATED** → 서비스 계정 JSON + `GOOGLE_APPLICATION_CREDENTIALS`가 지원되는 인증 경로 |
| 저장소 안에서 **확인 불가능** | ① `FIREBASE_SERVICE_ACCOUNT_*`/`FIREBASE_PROJECT_ID_*` 시크릿의 존재 — GitHub 시크릿은 write-only이고 이 환경에 `gh` CLI가 없다 ② 그 서비스 계정의 `firebaserules.releases.update` 권한 — **hosting 배포용으로 발급된 계정이면 rules는 `PERMISSION_DENIED`다** ③ prod 프로젝트에 Firestore 데이터베이스가 있는지 ④ 시크릿과 projectId가 같은 프로젝트인지. `--dry-run`도 헬프가 *"may still enable APIs on the target project"*라고 적으므로 부작용 0이 아니다 |

**예고 증빙 델타** (§17이 E1에, §18이 F4에 한 것과 같은 방식으로 **먼저** 적는다. 움직이는 증빙은 지난 두 wave의 4종·5종이 아니라 **4종**이고, 다섯 번째가 바이트 동일한 것이 이번 wave가 모델을 안 건드렸다는 증명이다)

| 증빙 | 예고 |
|---|---|
| `content-reachability.json` (`79baa2b1…`) | **움직인다.** `gates.eventChainTerminals` **40: 1 → 3**(`dragon_legacy`·`lost_wizard`·`world_tree_corruption`) · **48: 4 → 5**(+`ancient_prophecy`) · **68: 5 → 2**(`divine_apostle_trial`·`rift_secret`만). 23·32·35 불변, 버킷 수 6 유지. `eventChainSpans`는 **3행의 completion만** 68(170.23h) → 48(53.28h)/40(21.08h)/40(21.08h)이고 **`openCost` 13행은 전부 불변**. `behind` 44행은 **체인 열만** — L42·44·45·48 **9 → 7**, L49·50·52·55·60·62·65·68 **5 → 2**. **불변**: `cost.anchors` 8행(0/14/52/82/164/1,575/5,246/8,176), `gates.{maps,quests,equipmentTiers,jobs}`, `mapGateDivergence` 10행, `summary`(13/39/13 — G4가 고칠 바로 그 무감각), `errors`·`unresolvedEventChainTerminals`·`malformedGates` `[]` |
| `event-reward-coherence.json` (`82513d3b…`) | **움직인다.** 108행 중 **8행의 `location`/`mapLevel`만**. `catalog` 8키(13/39/84/8/16/3/2/3)·`frequency`·`errors: []` 불변, `itemTier: 5` 유지 |
| `equipment-combat-power.json` (`reportHash 3c9d7959…`) | **`reportHash` 불변.** G2가 `constants.ts`를 건드리므로 `authority.tierHash`(`dbef84ec…`)와 `sourceSnapshot`의 그 한 줄만 움직인다 — Wave 14 F4의 `classesHash` 사례와 같은 모양 |
| `progression-diagnostic-v2.json` (`f21dcf81…`) | **`reportHash` 불변, `v1Baseline` `2573fa0f…` 불변, `sources` 346개 유지.** 편집한 경로들의 sha256만(`eventChains.ts` `89d55648…` 외) |
| `exploration-rhythm.json` (`0818fb7a…`) | **바이트 동일이어야 한다.** `explorationRhythmSimulator`·`progressionSimulator`에 `EVENT_CHAINS` 참조가 0건이고 이번 wave는 모델 상수를 안 바꾼다. `pacing:verify` 초록이 그 증명이고, 빨가면 어떤 트랙이 모델로 샌 것이다 |
| 모델 핀 | `EXPECTED_BASELINE_REPORT_SHA256 = ac79428c…`, `PROGRESSION_V1_BASELINE_HASH = 2573fa0f…` **둘 다 불변**. 이 wave에는 "예고값이 바뀐다"가 아니라 **"예고값이 안 바뀐다"가 성공 기준**이다 |
| G4의 델타 | `report.schemaVersion` **3 → 4**, `gates.eventChainTerminals` → `gates.eventChainCompletions`, `behind[].eventChainTerminalSteps` → `behind[].eventChains`, `unresolvedEventChainTerminals` → `unresolvedEventChainCompletions`, `summary.eventChainTerminalSteps` **삭제**(실측: `terminals.length`는 언제나 `EVENT_CHAINS.length`라 `summary.eventChains`와 같은 13이다 — 같은 수를 두 이름으로 싣는 키다). **값은 한 자리도 안 움직인다** |

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **G1 체인 종착을 루프 안으로** | 스텝 **4개**의 `loc`을 옮긴다: `ancient_prophecy:2` → 마왕성(48) · `dragon_legacy:2` → 천공 정원(40) · `world_tree_corruption:1` → 천공 정원(40) · `:2` → 세계수 숲(40). 목적지는 세 기준(≤48 · 남은 스텝 max 이상 · `type !== 'safe'`)을 통과한 후보 중 로어로 골랐고, 같은 기준을 만족하는 대안(`혼돈의 심연` 48 · `지하 미궁` 44 · `폭풍의 고원` 40)은 **비용이 동일**하다. 장소 전제 문구 13곳을 함께 옮긴다(Wave 14 발견 7). 보상은 **건드리지 않는다** — `세계수의 지팡이` T5는 퀘스트 142(minLv 38)와 Lv5~15 드롭이 이미 같은 아이템을 그 레벨대에 주고 있다. 증빙 JSON은 **쓰지 않고** 위 예고값을 커밋 메시지에 기록한다 | 승천 게이트를 걸치는 체인 **3 → 0**. 13개 체인 전부가 "자기 런 안에서 닫히거나(11개), 애초에 승천 뒤에 열린다(2개)"로 갈리고, 체인 축이 드디어 장비·퀘스트·맵과 **같은 종류**가 된다(§17이 분류한 "승천을 거절한 플레이어의 깊이"). span 합 484.83h → 69.58h | data 1파일(4 loc + 문구 13) + 테스트 3 | 목적지를 로어로만 고르면 `허공의 섬`(42)처럼 **`type: 'safe'`** 맵을 집는다 — 거기엔 탐험 버튼이 없어 체인이 타이핑으로만 진행된다(`machine_uprising` 종착과 `water_apostle:1`이 이미 그 상태다). 목적지를 남은 스텝의 max **아래**로 내리는 것도 실패다 — `gateChanging === []`(Wave 14가 데이터 입력 오류로 판정한 그 조건)이 깨진다. `world_tree_corruption`의 스텝 1을 안 옮기고 종착만 옮기면 완주가 **50(65.90h)** 으로 남아 이 트랙이 아무것도 안 한 것이 된다. 문구를 두고 `loc`만 바꾸면 "장소와 텍스트가 어긋난다"를 새로 만든다 | opus |
| **G2 묘비 gold 절벽** | 상한을 **클라이언트가 보장하게** 한다 — `CONSTANTS.MAX_PUBLIC_GRAVE_GOLD = 9_999_999`(`MAX_LEVEL` 옆, rules 리터럴의 사본)을 두고 `useFirebaseSync`의 업로드 페이로드에서 `Math.min`으로 클램프한다. **`firestore.rules`는 건드리지 않는다** — 완화는 공개 문서의 유일한 위조 경계를 없애고 G3의 배포에 의존한다. 플레이어가 보는 것: 침공 화면의 골드 표시가 9,999,999에서 멈춘다(그 숫자는 보상이 아니라 표시다 — `resolveInvasion`은 아이템만 준다). **회수용 로컬 묘비는 안 건드린다** — 그쪽 값이 진짜다. 같은 패스에서 `firestore-rules-semantics.test.js`의 `GRAVE_UNGUARANTEED_CAPS` 3종을 실측대로 정리한다: `level`(`CONSTANTS.MAX_LEVEL`이 보장)과 `gold`(이제 상수가 보장)는 **네거티브 컨트롤**로 이름을 바꾸고, 남는 진짜 미보장은 `guardPower` 하나다(그리고 그건 한 런 최대 467로 도달 불가임을 주석으로 못 박는다) | 도달 가능한 유일한 절벽이 닫힌다. 골드가 넘친 플레이어의 묘비가 **통째로** 안 올라가던 것(= 침공 대상에서 영구 소멸)이 사라지고, Wave 14 F3이 새 블록에서 거부한 패턴을 기존 블록에서도 없앤다 | 상수 1 + 훅 1 + 테스트 2 | 로컬 회수 묘비까지 클램프하면 **플레이어 자기 골드가 사라진다** — 클램프는 업로드 페이로드에만 건다. rules를 완화하는 방향으로 풀면 G3 배포 전까지 아무것도 안 고쳐지고, 공개 문서의 상한이 사라진다. 상수를 `BALANCE`/`CONSTANTS` 어느 쪽에 두든 **소비처 없이 선언만 하면** `cycle-100-199`의 dead-key 가드가 잡는다(그게 이 가드의 용도다) | sonnet |
| **G3 rules 배포 자동화** | `deploy.yml`에 `deploy-rules` job을 넣는다: node **22**(CI `firestore-rules` job이 실측으로 고정한 런타임 — 20은 firebase-tools 15.x 전이 의존 17개에서 EBADENGINE), 시크릿 JSON을 `${{ runner.temp }}`에 쓰고 `GOOGLE_APPLICATION_CREDENTIALS`로 넘긴 뒤 `npm run rules:deploy -- --project "$PROJECT_ID"`. 버전 리터럴은 `package.json`의 `rules:deploy`(`npx --yes firebase-tools@15.30.2 deploy --only firestore:rules --non-interactive`) **한 곳**에 두어 `test:rules`와 같은 버전을 쓴다. 순서: `deploy-prod`가 `needs: [build, deploy-rules]` — **rules가 hosting보다 먼저**여야 한다(§17.1 발견 7의 비대칭: 새 rules는 구 클라이언트를 받고, 구 rules는 새 클라이언트를 거부한다). PR에는 배포를 걸지 않는다 | 의견 보내기(Wave 14 F3)가 사람 손 없이 열리고, "rules와 클라이언트를 같은 커밋에"가 **충분조건**이 된다. CLAUDE.md §8-6의 "수동 배포다"가 문서에서 사라질 수 있는 첫 wave | workflow 1 + `package.json` 1 | 시크릿의 서비스 계정이 **hosting 전용 역할**이면 `firebaserules.releases.update`에서 `PERMISSION_DENIED`로 죽는다 — 저장소 안에서 확인 불가능하므로 **develop에서 먼저** 돌리고, 첫 실패를 설계 실패로 읽지 말 것. hosting 뒤에 두면 배포 순서가 뒤집혀 구 rules가 새 클라이언트를 거부하는 창이 생긴다. `--only firestore`(콜론 없이)로 쓰면 선언도 안 한 indexes까지 대상이 된다. `firebase-tools`를 devDependency로 올리는 것도 실패다(락파일 +566 패키지 / 약 265MB — Wave 14 F3 발견 5) | opus |
| **G4 증빙 필드 이름 정정** | `gates.eventChainTerminals` → `gates.eventChainCompletions`(버킷 키가 완주 게이트다), `behind[].eventChainTerminalSteps` → `behind[].eventChains`(형제 열이 `maps`/`quests`/`jobs`다), `unresolvedEventChainTerminals` → `unresolvedEventChainCompletions`, `summary.eventChainTerminalSteps` **삭제**(`summary.eventChains`와 항상 같은 값이다). `report.schemaVersion` **3 → 4**와 CLI의 `EXPECTED_SCHEMA_VERSION`을 함께 올린다. 소비처는 실측 4파일뿐이다(systems 1 · scripts 1 · tests 2) — **UI/런타임 소비처 0** | 증빙의 키가 자기가 세는 것을 말한다. G1에서 종착 스텝이 넷 움직여도 `summary`의 그 숫자가 13에 붙박여 있는 것이 이 이름이 거짓말이라는 증거다 | systems 1 + scripts 1 + 테스트 2 | **G1보다 먼저 하면 실패다** — G1의 예고 델타가 옛 이름으로 적혀 있어 재현 확인이 불가능해진다. 값을 같이 만지는 것도 실패다: 이 트랙에서 움직여야 하는 건 키 집합과 `schemaVersion`뿐이고, 숫자가 한 자리라도 움직이면 rename이 아니라 재측정이 된 것이다 | sonnet |
| **G5 증빙 재고정·문서** | 통합 트리에서 G1의 예고값 재현 확인 → 증빙 **4종** 재생성(순서 고정) + `exploration-rhythm` 바이트 동일 확인 → **13종** `*:verify` → §19.1, CLAUDE.md(§6 코어 루프의 체인 문단 · §7 테스트 목록 · §8-6 배포 문단), `tasks/todo.md` | — | — | — | 직접 |

**파일 집합** — G1: `src/data/eventChains.ts` · `tests/event-chain-cost.test.js` · `tests/content-reachability.test.js` · `tests/permanent-progress-copy.test.js`(주석의 "완주는 전부 그보다 깊다"가 거짓이 된다). G2: `src/data/constants.ts` · `src/hooks/useFirebaseSync.ts` · `tests/firestore-rules-semantics.test.js` · `tests/grave-recovery.test.js`. G3: `.github/workflows/deploy.yml` · `package.json`. G4: `src/systems/contentReachability.ts` · `scripts/verify-content-reachability.mjs` · **`tests/content-reachability.test.js`·`tests/event-chain-cost.test.js`(G1과 공유 — 이 wave의 유일한 교차, 그래서 직렬)**. G5: `docs/AUDIT_REFACTOR_DEVELOP_PLAN_2026-09.md` · `CLAUDE.md` · `tasks/todo.md` · 증빙 4종(`content-reachability`·`event-reward-coherence`·`equipment-combat-power`·`progression-diagnostic-v2`). `firestore.rules`는 **어느 트랙도 건드리지 않는다** — G2가 클라이언트 쪽에서 닫고, G3은 이미 있는 파일을 배포만 한다.

**순서**: **G1 · G2 · G3 병렬**(worktree 격리, 위 파일 집합 무교차) → 통합 → **G4 직렬**(G1의 테스트 2파일을 다시 쓴다) → **통합 트리에서 G1 예고값 재현 확인**(어긋나면 증빙을 만들기 전에 멈춘다) → **증빙 재고정은 통합자가 마지막에 한 번만, 순서 고정**: ① **모델 핀 불변 확인** — `EXPECTED_BASELINE_REPORT_SHA256 = ac79428c…` · `PROGRESSION_V1_BASELINE_HASH = 2573fa0f…`(이번 wave는 모델 입력을 안 건드리므로 **갱신이 아니라 불변**이 통과 조건이다. 움직여 있으면 writer가 `PROGRESSION_SCHEMA_V1_BASELINE_DRIFT`로 막기 전에 사람이 멈춰야 한다) → ② `content:verify --write`(0.85s) → ③ `event-reward:verify --write` → ④ `equipment:combat-power:verify --write` — **Wave 14 F1 이후 수동 단계다**(테스트가 더 이상 스스로 쓰지 않는다. G2가 `constants.ts`를 건드리는 순간 `authority.tierHash` 한 줄로 stale이 되고, 이 단계가 그걸 닫는다) → ⑤ `pacing:verify`를 **`--write` 없이** 실행해 `0818fb7a…` 바이트 동일 확인(4m30s. 여기서 빨가면 모델이 움직인 것이므로 재생성하지 말고 멈춘다) → ⑥ `npm run progression:diagnostic:write`(1m59s, **346개 해시**를 실행 전후로 다시 읽어 `SOURCE_MANIFEST_CHANGED_DURING_DIAGNOSTIC`을 던지므로 **맨 마지막**이고 실행 중 저장소에 어떤 명령도 병행 금지, §15.1) → **13종** `*:verify` 재확인 → 직렬 게이트 → G5 → PR → CI → merge commit. 참고: 지난 두 wave의 재고정은 **Wave 13 = 4종 · Wave 14 = 5종**이었고(§17.1·§18.1), 이번 예고는 **4종**이다.

**판단 포인트**: 셋을 틀리면 이 wave는 측정을 쓰지 못하고 측정만 망친다. 첫째, **G1의 목적지는 취향이 아니라 세 기준의 교집합이다.** ≤48 · 남은 스텝의 max 이상 · `type !== 'safe'` — 셋 중 마지막이 로어로만 고를 때 빠지는 함정이다. `canInvestigateTown`은 **황금 왕국에서만** true이고 `adventureGuide`는 `safe`에서 `kind: 'explore'`를 절대 반환하지 않으므로, 안전지대에 놓인 체인 스텝은 터미널에 `explore`/`look`/`탐색`을 타이핑해야만 진행된다 — `machine_uprising`의 종착(북부 요새)과 `water_apostle` 스텝 1(사막 오아시스)이 이미 그 상태이고, 이 wave에서 그걸 세 개 더 만들면 "열렸다가 안 닫힌다"를 고치면서 "보이지 않는다"를 새로 만드는 것이다. 그리고 두 번째 기준(종착이 곧 max)은 Wave 14가 `forgotten_god`에서 **데이터 입력 오류**로 판정하고 테스트에 `gateChanging === []`로 못 박은 조건이다 — 종착을 남은 스텝보다 얕은 곳에 두면(예: `dragon_legacy:2` → 용의 둥지 25) 비용은 같아 보여도 그 불변식이 깨진다. 둘째, **`world_tree_corruption`은 스텝 두 개를 옮겨야 한다 — 이걸 놓치면 트랙이 자기 목표를 못 이루고 그 사실이 증빙에 안 보인다.** 그 체인의 스텝 1은 `고대 신전 도시`(경로 50 = 65.90h)라 종착만 48 아래로 내리면 완주가 50에 남고, `cost.gates.eventChainCompletions`에 **50 버킷이 새로 생기며**(오늘은 없다) 승천보다 12.62h 뒤라는 사실은 그대로다. §18이 이 작업을 "Lv68 종착 3개"라고 적은 것은 교정된 자가 나오기 전의 표현이고, 실제로는 **스텝 4개 · 문구 13곳**이다. 셋째, **이 wave의 성공 기준은 "예고값이 바뀐다"가 아니라 "모델 핀 셋이 안 바뀐다"이다.** `EXPECTED_BASELINE_REPORT_SHA256`(`ac79428c…`)·`PROGRESSION_V1_BASELINE_HASH`(`2573fa0f…`)·`exploration-rhythm`의 최상위 `reportHash`(`0818fb7a…`) 셋은 체인 위치·묘비 클램프·CI를 입력으로 받지 않는다(`explorationRhythmSimulator`·`progressionSimulator`에 `EVENT_CHAINS` 참조 0건, `constants.ts`에 **소비되는** 새 키 하나는 모델 값을 안 바꾼다). 하나라도 움직이면 어떤 트랙이 모델로 샌 것이고, 그때의 판별자는 `content:verify`가 아니라 이 세 해시다. 마지막으로 게이트 상태를 다시 적는다(§18이 §17을 정정한 그대로, 이번 wave에 한 가지가 더해진다): `tests/progression-diagnostic-cli.test.js`는 `tests/*.test.js` glob에 잡히는 유닛 테스트이고 증빙 CLI를 `--verify`로 돌리며, 그 봉투는 `src/**` 332개 + 고정 14경로 = **346개**의 sha256을 박는다. 그래서 `npm run verify`는 **정확히 이 테스트 하나**로 빨개지는 것이 정상이고 — **이번 wave에는 `src/**`를 안 건드리는 G3도 같은 이유로 빨개진다**(고정 14경로에 `package.json`이 있다). 범인 좁히기의 판별자는 `content:verify`(0.85s)이고, `release-complete-core`를 가리키는 `*:verify`는 **13종**이다(`toss:evidence:verify`·`observation:host:verify`는 이 세트 밖이고 인자를 요구해 `main`에서도 빨갛다 — 실행으로 재확인했다).

**하지 않기로 한 것** (나중 wave가 다시 논의하지 않도록 사유와 함께 남긴다)

1. **`tier`를 아트 카탈로그 identity에서 분리하기 — 이 wave는 계획조차 하지 않는다.** §18.1 발견 1·2가 이미 측정을 끝냈다: `scripts/artCatalog.mjs`의 `normalizeClasses`가 `{name, tier}`를 identity 해시에 넣고, 그 해시는 `scripts/art_sources/**`의 아트 생산 provenance **65개**를 포함해 **1,065개** 파일에 핀돼 있으며, 아트 스위트는 비활성 `catalogSha256`을 가진 기록이 **거부되는지**를 일부러 테스트한다. `tier`를 **빼는 것**도 identity의 모양을 바꾸므로 같은 1,065개를 무효화한다 — 즉 남은 질문은 기술이 아니라 **"아트 생산 provenance 역사를 다시 핀해도 되는가"**이고, 그건 저장소가 답할 수 없는 소유자의 정책 판단이다. 답이 "된다"로 나오면 `성직자 tier 1→2`와 `KNOWN_TIER_DEPTH_DIVERGENCE` 비우기가 한 커밋이고 후속 핀 둘은 F4가 이미 실측해 뒀다(`EXPECTED_BASELINE_REPORT_SHA256 = 9da28843…`, `PROGRESSION_V1_BASELINE_HASH = 4a888aa0…`, pacing focused 해시는 양쪽 동일). 그때까지 F4가 출하한 상태(괴리 집합 = 정확히 `['성직자']`, 늘어날 수 없음)가 안정적으로 버틴다. **미결로 남는다 — 측정이 없어서가 아니라 결정이 없어서다.**
2. **`divine_apostle_trial`(열림 50 = 65.90h)과 `rift_secret`(열림 68 = 170.23h)을 옮기기.** 둘은 승천 **뒤에** 열리므로 걸치지 않는다. §17이 분류한 "승천을 거절한 플레이어의 깊이"이고, 옮기면 그 깊이가 사라진다. G1 뒤에 68 버킷에 남는 2가 **정확히 이 둘**인 것이 정상 상태다.
3. **`world_tree_corruption:2:0`의 보상(`세계수의 지팡이` T5)을 티어 낮추기 / 골드로 바꾸기.** tier 4 자연 계열 무기는 **0개**라 티어를 낮추면 속성이 바뀌고, 골드로 바꾸면 3스텝 체인의 유일한 아이템 보상이 사라진다. 그리고 같은 아이템을 퀘스트 142(minLv 38)와 `수련 님프`(Lv5·7) 3% / `봄의 여왕`(Lv[5,15]) 5%가 이미 그 레벨대에 준다 — 이동 후 위치가 기존 출처와 정합적이다.
4. **`firestore.rules`의 `gold` 상한을 완화하기.** 공개 문서이고 읽기는 인증 유저 전부다. 상한은 위조 클라이언트에 대한 유일한 경계이고, 완화는 G3의 배포가 끝나야 효력이 생긴다. 클라이언트 보장이 더 싸고(배포 무관·에뮬레이터로 검증 가능) Wave 14 F3이 새 블록에서 세운 기준("상한은 클라이언트가 실제로 보장하는 값만 건다")과 같은 방향이다.
5. **묘비 업로드 실패를 UI 오류로 승격하기.** 실패 시 플레이어가 할 수 있는 일이 없다. G2가 도달 가능한 원인을 없애고, 남는 미보장(`guardPower`)은 한 런 최대 467로 상한의 4.7%다.
6. **`equipment-combat-power` 재생성을 다시 자동화하기.** Wave 14 F1이 자기치유를 없앤 직후다 — 수동 단계가 그 산출물의 증명이고, 자동화는 그걸 되돌린다.
7. **곡선(`EXP_SCALE_RATE`)·프레스티지 이월·맵 선언 레벨.** §17이 실측으로 기각했다(곡선은 간극을 **넓히고**, 프레스티지는 rank 19·631.9h, 맵은 방향이 반대다). 재측정 없이 다시 꺼내지 말 것.
8. **퀘스트 104(minLv 79)의 `beyond-anchors` 공백.** 앵커를 Lv80까지 늘리면 `cost.anchors` 8행이 9행이 되어 Wave 13이 남긴 "바이트 동일" 기준선이 사라진다. `null`이 정직한 상태다.
9. **class-(b) 소스 가드 1,807건.** Wave 11 C4 정책대로 계속 방치.

### 19.1 Wave 15 실행 결과 (2026-09-20, base `main` = `56d30895`)

**요약**: 계획한 5트랙을 전부 출하했다. G1이 승천 지점을 걸치던 체인 3개를 **0개**로 만들었고(스텝 4개 이동 + 문구 13곳), G2가 도달 가능한 유일한 묘비 상한 절벽을 클라이언트에서 닫았으며, G3이 `firestore.rules` 배포를 사람 손에서 파이프라인으로 옮겼고, G4가 증빙 필드 이름을 자기가 세는 것과 맞췄다(`schemaVersion` 3 → 4). **이번 wave의 성공 기준은 "예고값이 바뀐다"가 아니라 "모델 핀 3종이 안 바뀐다"였고, 셋 다 불변이다.**

| 트랙 | 결과 | 커밋 |
|---|---|---|
| G1 체인 종착을 루프 안으로 | 스텝 4개 `loc` 이동 + 문구 13곳. 걸치는 체인 **3 → 0** | `893ef8e1` |
| G2 묘비 gold 절벽 | `CONSTANTS.MAX_PUBLIC_GRAVE_GOLD` + `clampPublicGraveGold`(업로드 페이로드 전용). rules 불변 | `11376197` |
| G3 rules 배포 자동화 | `deploy-rules` job(hosting 앞), 버전 리터럴 1곳, 시크릿 셸 분기 | `eb53e6b0` |
| G4 증빙 필드 이름 정정 | 3키 rename + 1키 삭제 + `schemaVersion` 3 → 4. **값 이동 0** | `6a34a57c` |
| G5 증빙·문서 | 증빙 4종 재고정, 13종 verify, §19.1 · CLAUDE.md · `tasks/todo.md` | `45512de9` 외 |

**예고 대비 실제 — 한 자리도 어긋나지 않았다** (§19의 "예고 증빙 델타" 표와 대조)

| 예고 | 실제 |
|---|---|
| `gates.eventChainCompletions` 40: 1 → 3 · 48: 4 → 5 · 68: 5 → 2, 버킷 6 유지 | **그대로**. 40 = `dragon_legacy`·`lost_wizard`·`world_tree_corruption`, 68 = `divine_apostle_trial`·`rift_secret` |
| `eventChainSpans` 3행의 completion만 68(170.23h) → 48(53.28h)/40(21.08h)/40(21.08h), `openCost` 13행 불변 | **그대로** |
| `behind` 44행의 체인 열만 — L42·44·45·48 9 → 7, L49~68 5 → 2 | **그대로**. 다른 열·`modeledActions`·`modeledHours` 바이트 동일 |
| `cost.anchors` 8행 · `gates.{maps,quests,equipmentTiers,jobs}` · `mapGateDivergence` 10행 불변 | **그대로** |
| `event-reward-coherence` 108행 중 8행의 `location`/`mapLevel`만 | **그대로**(`catalog` 8키·`frequency`·`errors: []` 불변, `itemTier: 5` 유지) |
| `equipment-combat-power`의 `reportHash` 불변, `authority.tierHash`만 이동 | **그대로**: `3c9d7959…` 불변, `tierHash` `dbef84ec…` → `20999b0f…` 한 줄 |
| `progression-diagnostic-v2` `reportHash`·`v1Baseline` 불변, `sources` 346 유지 | **그대로**: `f21dcf81…` / `2573fa0f…` / 346 |
| 모델 핀 3종 불변 | **그대로**: `EXPECTED_BASELINE_REPORT_SHA256 ac79428c…`(테스트 12/12 초록) · `PROGRESSION_V1_BASELINE_HASH 2573fa0f…` · `exploration-rhythm 0818fb7a…`(`pacing:verify`를 `--write` 없이 돌려 확인) |

예고를 먼저 적고 통합 트리에서 재현을 확인하는 이 규율은 Wave 13 E1 → Wave 14 F4 → Wave 15 G1으로 세 wave째다. **핀이 "테스트가 빨개져서" 바뀌면 그 기준은 사라진다** — 이번에는 다섯 번째 증빙(`exploration-rhythm`)이 바이트 동일한 것이 "모델을 안 건드렸다"의 증명 역할을 했다.

**발견**

1. **`world_tree_corruption`은 종착만 옮기면 아무것도 안 한 것이 된다.** 스텝 1이 `고대 신전 도시`(경로 게이트 **50** = 65.90h)라 종착을 48 아래로 내려도 완주는 50에 남고, `gates`에 **오늘 없는 50 버킷이 새로 생긴다**. §18이 이 작업을 "Lv68 종착 3개"로 적은 것은 교정된 자(완주 = 전 스텝 max)가 나오기 전의 표현이다. 실제 작업은 **스텝 4개 + 문구 13곳**이었다. 자를 고치는 wave와 그 자를 쓰는 wave를 나눈 값이 여기서 나온다 — 같은 wave였으면 이 오차를 못 봤다.
2. **안전지대(`type: 'safe'`)에는 탐험 버튼이 없고, 거기에 체인 스텝이 이미 둘 있다.** `canInvestigateTown`은 황금 왕국에서만 true이고 `adventureGuide`는 `safe`에서 `kind: 'explore'`를 반환하지 않는다. `machine_uprising`의 **종착**(북부 요새)과 `water_apostle` 스텝 1(사막 오아시스)은 터미널에 `explore`/`look`/`탐색`을 **타이핑해야만** 진행된다. 목적지를 로어로만 골랐으면 `허공의 섬`(42 · safe)을 집어 "열렸다가 안 닫힌다"를 고치면서 "보이지 않는다"를 셋 새로 만들었을 것이다. 그래서 선정 기준에 `type !== 'safe'`가 들어갔다.
3. **§18이 경고한 두 블로커는 실체가 없었다.** `CHAIN_ITEM_TIER_TOO_LOW`는 `max(1, highestAvailableTier(map.level) − 1)`의 **바닥**이라 목적지를 낮추면 구조적으로 발동하지 않는다(세계수의 지팡이 T5 @ 세계수 숲 38 → MIN_T2). "tier5가 얕은 맵에 떨어진다"는 이미 출시된 관행이다(`lost_wizard:2:0` T5 @ 천공 정원 40 · `machine_uprising:2:0` T5 @ 북부 요새 32). 게다가 종착 셋 중 **둘은 보상이 relic뿐**이라 아이템 티어 축과 접점이 0이고, 나머지 하나의 `세계수의 지팡이`는 퀘스트 142(minLv 38) 보상이자 `수련 님프`(Lv5·7) 3% / `봄의 여왕`(Lv[5,15]) 5% 드롭이라 이동 후 위치가 **기존 출처와 같은 레벨대**가 된다.
4. **묘비에서 거부되는 것은 숫자가 아니라 문서 전체이고, 죽이는 쪽은 장식용 필드다.** 공개 문서의 상한 6개 중 다섯은 클라이언트가 보장한다(`level`은 `CONSTANTS.MAX_LEVEL`, `playerName`은 `maxLength={16}`, `loc`은 맵 이름 최장 11자, `items`는 `.slice(0, 3)`, `guardPower`는 한 런 최대 467 = 상한의 4.7%). `gold` 하나만 미보장이면서 도달 가능한데 — `resolveInvasion`은 골드를 주지 않는다. 즉 **침공 성공률의 입력(`guardPower`)과 보상(`items`)이 보상에 안 쓰이는 필드 때문에 같이 사라지고** `.catch(console.warn)`이 그걸 삼킨다. 그래서 고치는 쪽은 rules 완화가 아니라 클라이언트 클램프다(완화는 공개 문서의 유일한 위조 경계를 없애고, 효력도 배포에 달려 있다).
5. **워크플로의 조용한 실패는 `continue-on-error`가 아니라 시크릿 삼항에서 나온다.** `${{ ref == 'main' && secrets.X_PROD || secrets.X_DEV }}`는 PROD가 비면 **DEV로 떨어져 prod 푸시가 dev 프로젝트에 배포되고 run이 초록으로 끝난다**. G3은 네 시크릿을 모두 env로 받아 셸에서 분기하고 고른 쪽이 비면 `::error` + `exit 1`이며, 그 6케이스를 스텝 스크립트를 추출해 **실제로 실행**해 고정했다(`main인데 PROD만 비었을 때 rc=1, dev 낙하 없음` 포함). 그리고 `needs`(순서)와 `if`(실행 여부)가 분리돼 있으므로 "rules가 hosting보다 먼저"와 "rules가 죽어도 릴리스는 안 막힌다"를 **동시에** 가질 수 있다 — 대가는 명시했다: 실패 시 순서 보장은 성공 경로에만 남는다.
6. **`summary.eventChainTerminalSteps`는 측정이 아니라 중복이었다.** 그 값은 `terminals.length`이고 `terminals = eventChainStepLocations()`는 체인당 한 행을 내므로 **구조적으로** `summary.eventChains`와 항상 같다. G1이 종착 스텝을 넷 옮겨도 둘 다 13에 붙박여 있던 것이 그 증거다. 소비처는 4파일뿐이고(systems 1 · scripts 1 · tests 2) **UI·런타임 소비처는 0**이라 rename은 스키마 churn 외의 비용이 없었다.
7. **운영 — 병렬 트랙 둘이 주간 API 한도로 동시에 죽었고, 작업은 워크트리에 남아 있었다.** G1(opus)·G2(sonnet)이 같은 순간 `429 weekly limit`로 종료됐는데 둘 다 **편집은 끝내고 커밋만 못 한 상태**였다. 워크트리에서 `git diff HEAD`로 패치를 떠 본 체크아웃에 적용하고, 검증(type-check · lint · 영향 테스트)과 커밋을 통합자가 직접 했다. 교훈: **서브에이전트의 산출물은 커밋이 아니라 워크트리의 작업 트리에 있다** — 에이전트가 실패로 끝나도 회수 가능하므로 재실행 전에 워크트리를 먼저 볼 것.

**최종 게이트** (head `45512de9`, CI 동일 빌드): type-check 0 · lint 0 · unit **5,105 / 5,105**(skip 0, Wave 14 대비 +1) · build:guard ok · CI-env build ok(test-api 마커 확인) · e2e **121 / 121**(61 + 60) · perf desktop ok(FCP 452ms) / mobile ok(FCP 564ms) · `release-complete-core` 증빙 **13종** verify 전부 ok. 게이트 실행 중 저장소에 병행 명령 없음(§15.1). `toss:evidence:verify`·`observation:host:verify`는 이 세트 밖이고 `main`에서도 빨갛다(기존 실패).

**남은 후보 (Wave 16)**

1. **`tier`를 아트 identity에서 분리** — §18.1 발견 1·2 + §19 "하지 않기로 한 것" 1. 여전히 **미결이고, 측정이 없어서가 아니라 결정이 없어서다**: 빼는 것도 identity의 모양을 바꿔 같은 1,065개(아트 생산 provenance 65개 포함)를 무효화하므로 선행 질문은 **"아트 생산 provenance 역사를 다시 핀해도 되는가"**라는 소유자의 정책 판단이다. 답이 "된다"면 `성직자 tier 1→2`와 `KNOWN_TIER_DEPTH_DIVERGENCE` 비우기가 한 커밋이고, 후속 핀은 F4가 이미 실측해 뒀다(`EXPECTED_BASELINE_REPORT_SHA256 = 9da28843…`, `PROGRESSION_V1_BASELINE_HASH = 4a888aa0…`).
2. **`firestore.rules` 배포의 첫 실행 결과를 읽기** — G3의 설계가 흡수할 수 없는 단 하나는 서비스 계정의 `firebaserules.releases.update` 권한이고, 그건 저장소 밖에서만 답이 나온다. develop이 먼저 도므로 prod 이전에 같은 실패가 드러난다. **첫 실패를 "설계가 틀렸다"로 읽지 말 것 — "IAM 역할이 hosting 전용이다"로 읽어야 한다.** 성공이 확인되면 CLAUDE.md §8-6에서 "충분조건이 아니다" 단서를 좁힐 수 있다.
3. **안전지대에 놓인 체인 스텝 2개**(`machine_uprising` 종착 = 북부 요새 · `water_apostle:1` = 사막 오아시스) — 오늘도 터미널 타이핑으로만 진행된다. G1은 새로 만들지 않는 것까지만 했고 **기존 둘은 손대지 않았다**. 고치는 방법은 둘이다: 목적지를 dungeon으로 옮기거나(문구 동반), `safe`에서도 체인 스텝이 보이도록 `adventureGuide`를 여는 것. 후자가 범위가 넓으므로 먼저 측정할 것.
4. **퀘스트 104(minLv 79)의 `beyond-anchors` 공백** — §19에서 기각한 그대로. 앵커를 Lv80까지 늘리면 `cost.anchors` 8행이 9행이 되어 Wave 13이 남긴 "바이트 동일" 기준선이 사라진다. `null`이 정직한 상태다.
5. **class-(b) 소스 가드 1,807건** — Wave 11 C4 정책대로 계속 방치.

---

## 20. Wave 16 (2026-09-20, 베이스 `main` = `5db9b325` = PR #42 merge commit)

**핵심**: Wave 15는 "안전지대에는 탐험 버튼이 없다"를 체인 목적지 선정 기준 ③으로 썼다. 그 전제를 **실행으로** 확인하다 실제 플레이어가 도달할 수 있는 결함을 찾았다 — safe 맵 6곳 중 시작의 마을을 뺀 4곳에서 터미널에 `탐색`을 치면 **`'undefined 등장!'`과 함께 실제 스탯의 적이 스폰되고 전투가 시작된다**(허공의 섬 기준 HP 1,357 / ATK 175). 즉 이 wave의 입력은 측정이 아니라 **전제 검증의 부산물**이다. 계획서가 근거로 삼은 문장을 실행해 보는 것이 그 자체로 감사였다.

**실측 — safe 맵 6곳의 오늘 동작** (`createExploreActions(...).explore()`를 직접 호출해 관측)

| 지역 | type | `monsters` | 경로 게이트 | 탐험 결과(수정 전) |
|---|---|---:|---:|---|
| 시작의 마을 | safe | 0 | 1 | `마을 주변은 평화롭습니다.` (유일하게 정상) |
| 여행자의 쉼터 | safe | 0 | 15 | **`undefined 등장!`** HP 528 / ATK 72 |
| 사막 오아시스 | safe | 0 | 23 | **`undefined 등장!`** HP 773 / ATK 102 |
| 북부 요새 | safe | 0 | 32 | **`undefined 등장!`** HP 1,050 / ATK 137 |
| 허공의 섬 | safe | 0 | 42 | **`undefined 등장!`** HP 1,357 / ATK 175 |
| 황금 왕국 | safe | 5 | 62 | `용병 전사 등장!` (설계된 조사 — `canInvestigateTown`) |

**원인이 둘 겹쳐 있었다.** (a) `selectEncounterMonster`가 빈 풀에서 `pool[Math.floor(rng() * 0)]` = `pool[0]` = `undefined`를 돌려주고, `spawnEnemy`가 그 `undefined`를 이름으로 삼아 실제 HP/ATK를 가진 적을 만들었다 — **빈 테이블에서 fail-closed가 아니었다**. (b) 평화 가드가 `player.loc === CONSTANTS.START_LOCATION`, 즉 **지역 종류가 아니라 하드코딩된 한 이름**이었다. 둘 중 하나만 있었으면 증상이 안 났다: (a)만 있으면 safe 맵이 애초에 막혔을 것이고, (b)만 있으면 빈 풀에서 조우가 없었을 것이다. `commandParser`의 `'탐색'` → `actions.explore()`에는 지역 종류 가드가 없으므로 도달 경로는 터미널 한 줄이다.

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 |
|---|---|---|---|---|
| **H1** 빈 풀 fail-closed | `spawnEnemy`가 `{ mStats: null, baseName: null }`을 반환한다. **타입으로 강제**했더니 컴파일러가 호출처 10곳을 전부 짚었다 — 게임 4곳은 `MSG.EXPLORE_QUIET`로 끝내고, 모델 6곳은 명시적 throw로 불변식을 적는다 | 이름 없는 적이 **어느 맵에서도** 만들어질 수 없다(safe 전용 수리가 아니라 클래스 수리) | `SpawnedMonster \| null` 전파 | 정산 outcome을 새로 만들면(`'quiet'` 같은) `advanceExploreState`의 `default`가 그걸 **전투로 취급해 `quietStreak`를 리셋**한다 — 기존 `'nothing'`을 써야 페이싱이 안 틀어진다. 모델 쪽을 `!`로 눌러 막으면 불변식이 침묵한다 |
| **H2** 평화 가드의 권한 이전 | `loc === START_LOCATION` → `type === 'safe' && !canInvestigateTown(...)`. 권한은 이미 있던 `canInvestigateTown`이 갖는다. **체인 트리거 뒤에 둔다** | safe 맵이 이름이 아니라 종류로 판정된다 — 새 safe 지역을 추가해도 자동으로 덮인다 | 가드 1줄 + 순서 | 체인 트리거 **앞에** 두면 safe 지역의 대기 체인 스텝이 영원히 안 뜬다(오늘 북부 요새·사막 오아시스 둘이 거기 있다). 황금 왕국까지 막으면 설계된 도시 조사가 죽는다 |
| **H3** 대기 체인 스텝의 UI 노출 | safe 지역에 대기 스텝이 있으면 explore를 마을 행동으로 노출한다. 라벨 소유권은 `townActionPresentation.exploreIntent`(`'investigate' \| 'chain' \| null`), 문구는 MSG | §19.1 Wave 16 후보 3이 닫힌다 — 두 스텝이 터미널 타이핑 없이 진행된다 | presentation 1 + MSG 2키 + 컴포넌트 1 | 라벨을 컴포넌트가 계속 하드코딩하면(오늘 `'도시 조사 · 전투 가능'`이 그랬다) 두 의도를 구분할 수 없고 CLAUDE.md §5 위반이 남는다 |

**증빙 델타** — 이 wave는 모델 입력을 건드리지 않는다. `progressionSimulator`의 `MODELED_MAPS`와 `progressionDiagnostic`의 맵 목록이 **둘 다 이미 `type !== 'safe' && monsters.length > 0`으로 거르므로**, H1의 빈-풀 분기를 구조적으로 탈 수 없다. 그래서 예고는 "값이 바뀐다"가 아니라 **"모델 핀 3종이 안 바뀐다"**였고 셋 다 불변이다(`ac79428c…` · `2573fa0f…` · `exploration-rhythm 0818fb7a…`를 `--write` 없이 확인). `progression-diagnostic-v2`는 `reportHash`·`v1Baseline` 불변, `sources` 346 유지, 편집 경로의 sha256만 이동.

**예고하지 않은 델타 1건 — 그리고 그게 왜 양성인가**: `relic-event-chance`가 stale이었다. 확인 결과 `report`는 **바이트 동일**, `reportHash` `424909de…`도 불변이고 `authorityHashes.eventReward`(= `src/hooks/gameActions/eventActions.ts`의 **소스 바이트** 핀) 하나만 움직였다 — H1의 null 가드가 그 파일을 건드렸기 때문이다. 유물 이벤트 확률의 의미는 바뀌지 않았다. 교훈: **소스 바이트 authority 핀은 의미가 안 바뀌어도 움직이므로 예고 표에 "편집한 파일을 핀하는 증빙"을 함께 적어야 한다** — 값 해시(`tests/helpers/dataHash.ts`)로 옮긴 데이터 가드와 달리 이쪽은 의도적으로 바이트 핀이다.

**테스트**: `tests/safe-zone-explore-contract.test.js` 9건. 전부 실제 모듈을 import해 호출하는 **행동 테스트**다(CLAUDE.md §7 Wave 11 C4 정책 — 소스 정규식 금지). 결함 주입 2종으로 커버리지를 증명했다: H1을 되돌리면 `spawnEnemy` 계약이, H2를 되돌리면 탐험 경로가 **각각 하나씩** 깨진다 — 두 겹이 서로를 가리지 않는다는 뜻이다. 테스트가 "safe 지역에 체인 스텝이 존재한다"를 전제로 단언하는 덕에 `DB.EVENT_CHAINS`가 없다는 내 잘못된 가정이 **빈 목록 위 공허참으로 통과하지 않고** 드러났다.

**하지 않기로 한 것**
1. **safe 맵에 `monsters`를 채워 진짜 사냥터로 만들기.** 안전지대는 회복·정비 지점이라는 루프 역할이 있고, 채우면 원정 리듬(출발 → 소모 → 귀환)의 귀환 지점이 사라진다.
2. **`탐색` 명령을 safe 맵에서 파싱 단계에서 거부하기.** 명령은 되는데 결과가 "평화롭다"인 것이 정상이다 — 파서에서 막으면 체인 스텝도 함께 막힌다(H2의 실패 시나리오와 같은 형태).
3. **`spawnEnemy`를 throw로 바꾸기.** 게임 루프 한가운데서 던지면 조용한 스폰 대신 크래시가 된다. 모델 경로에서만 throw가 옳다(그쪽은 불가능 상태라 크래시가 정답이다).

---

## 21. Wave 17 (2026-09-20, 베이스 `main` = `a8bb48db` = PR #43 merge commit)

**핵심**: Wave 16의 성과는 "문서 주장을 확인했다"가 아니라 **"한 행동을 호출할 수 있는 입력 표면을 전부 세었다"**였다. UI는 막았는데 터미널은 안 막았던 것이 결함이었다. 이번 wave는 그 방법을 **명령 전체로** 확장한다.

**먼저 한 일 — 방법을 잘못 고를 뻔했다.** 처음에는 "CLAUDE.md의 사실 주장을 전수 검증"으로 잡고 숫자 19종을 실측했다: `BALANCE` 8개(`CRIT_CHANCE` 0.1 · `ESCAPE_CHANCE` 0.5 · `EXP_SCALE_RATE` 1.15 · `RELIC_FIND_CHANCE` 0.08 · `BOSS_PHASE2_THRESHOLD` 0.5 · `TWO_HAND_ATK_BONUS` 1.55 · `EVENT_CHANCE_NOTHING` 0.2 · `STATUS_DOT_RATIO` 0.04), `DAILY_AI_LIMIT` 50, `DATA_VERSION` 5.1, `MAX_LEVEL` 99, 맵 52 · 직업 18 · 유물 67 · 시너지 20 · 체인 13(전부 3스텝) · 퀘스트 143 · 업적 73 — **19/19 참**이다. 즉 드리프트는 숫자에 없다. `manualChunks`도 파고들다 접었다: 청크 이름이 문서와 달랐지만(`vendor-firebase` 하나가 아니라 `-firestore`/`-auth`/`-core` 셋이고 `vendor-charts`는 문서에 없다) **결과(FCP/DCL)는 `perf:guard`가 이미 blocking으로 재고 있어** 수익이 낮았다. 문서만 실측값으로 고치고 축을 되돌렸다.

**실측 — 명령 18종 × 상태 9종 행렬**. 파서는 `idle`과 `combat`을 **구분하지 않는다**(둘 다 `blockedStateMessages`에 없다). 그런데도 대부분의 칸이 무해한 이유는 액션이 각자 가드를 들고 있기 때문이다.

| 명령 | 가드 소유자 | 가드 |
|---|---|---|
| `explore` | `exploreActions` | `gameState !== GS.IDLE` (+ Wave 16의 safe 가드) |
| `move` | `moveActions` | `['idle','moving']` 아니면 차단, 그리고 **레벨 잠금은 `getMapAccess`가 따로 건다** |
| `rest` | `characterActions` | `gameState !== 'idle'` |
| `attack`/`skill`/`escape` | `combatAttack` | `gameState !== GS.COMBAT \|\| !enemy` |
| **`shop`** | **없었다** | 파서가 직접 `setShopItems` + `setGameState('shop')`, 검사는 `type === 'safe'` 하나 |

**유일한 누수가 `shop`이었고 이유는 구조적이다 — 파서가 액션을 경유하지 않는 유일한 명령이었다.** 그리고 전투가 가능한 안전지대가 실제로 존재한다: `황금 왕국`은 `type: 'safe'`인데 `monsters` 5종을 갖는 유일한 지역이고(Wave 16 실측), `canInvestigateTown`이 true인 설계된 "도시 조사" 구역이며 경로 게이트 62로 **가장 깊은 안전지대**다. 거기서 전투 중 `shop`을 치면 `gameState`가 'shop'으로 넘어가고, `ShopPanel`의 뒤로가기가 `setGameState('idle')`이므로 **도주 판정(`ESCAPE_CHANCE` 0.5) 없이 전투를 버릴 수 있었다.** `SET_GAME_STATE`는 `enemy`를 지우지 않으므로 버려진 적이 상태에 남은 채 idle로 돌아간다. 정규 도주는 50% 실패 시 적의 반격을 받는데, 이 경로는 비용이 0이다.

덤으로 같은 3줄을 `GameRoot`의 `'open_shop'`도 복제하고 있었다 — **입력 표면이 둘인데 가드는 어느 쪽에도 온전히 없었다.**

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 |
|---|---|---|---|---|
| **I1** 상점 진입 소유권 이전 | `characterActions.openShop` 신설(상태 가드 + 안전지대 가드 + 목록 적재 + 진입 로그). 파서와 `GameRoot` 둘 다 이 액션만 부른다. 파서의 한국어 문자열 2개는 MSG로 | 무료 이탈이 닫히고, **입력 표면이 하나의 가드를 공유한다** | 액션 1 + 소비처 2 + MSG 3키 | 파서의 `blockedStateMessages`에 `'combat'`을 추가하는 방식은 **틀렸다** — `attack`이 `readOnlyCommands`에 없으므로 전투 명령 전체가 막힌다(실행으로 확인했다). 가드를 파서에 두면 `GameRoot` 경로가 여전히 맨몸이다 |
| **I2** 계약 테스트 | 구조 계약(파서는 상태를 직접 전이하지 않는다 — 18 × 9 전수) + 게이트 계약(`openShop`의 세 분기) | 이 결함의 **클래스**가 막힌다. 새 명령이 상태를 직접 만지면 전수 루프가 잡는다 | 테스트 1파일 9건 | 게이트 계약만 쓰면 다음에 다른 명령이 같은 짓을 해도 못 잡는다 — 구조 계약이 본체다 |
| **I3** 문서 드리프트 | 테스트 규모(파일 347 · 케이스 5,123 · e2e **44**, 문서는 ~335/~4,810/31이었다), 청크 목록 실측 정정, CLAUDE.md §5에 "파서에 상태 전이 금지" 규칙 | 문서가 다시 사실이 된다 | 문서 3곳 | — |

**예고 증빙 델타 — Wave 16의 교훈을 처음 적용했고 맞았다.** §20이 남긴 규칙은 "**편집한 파일을 바이트로 핀하는 증빙**을 함께 예고할 것"이었다. 이번에 편집한 파일(`characterActions.ts`·`commandParser.ts`·`GameRoot.tsx`·`messages.ts`·`actionDeps.ts`) 중 authority 바이트 핀에 걸린 것은 **없다** — `relic-event-chance`가 핀하는 넷은 `CombatEngine.outcome.ts`·`CombatEngine.loot.ts`·`eventActions.ts`·`progressionProfiles.ts`이고 전부 미수정이다. 그래서 예고는 "**`progression-diagnostic-v2`의 sources만 움직인다**"였고, 13종 중 정확히 그 하나만 stale이었다. 재생성 후 `reportHash` `f21dcf81…` 불변, `v1Baseline` `2573fa0f…` 불변, `sources` 346 유지, 모델 핀 `ac79428c…`도 불변.

**하지 않기로 한 것**
1. **파서의 `blockedStateMessages`에 `'combat'` 추가.** 실행으로 기각했다 — `attack`/`skill`/`escape`가 `readOnlyCommands`에 없어 전투 명령 전체가 차단된다. "상태를 한 곳에서 막자"는 직관이 이 표에서는 틀린다.
2. **`manualChunks` 구성 고정 가드 추가.** 결과(FCP/DCL)는 `perf:guard`가 이미 blocking으로 잰다. 구성을 고정하면 리팩터가 의미를 안 바꿔도 깨지고(§7 class-(b)의 실패 모드), 예산은 실측 FCP 452~580ms로 2,200ms의 21~26%다.
3. **`SET_GAME_STATE`에서 `enemy` 정리 추가.** 전이 하나에 정리 책임을 얹으면 다른 전이와 비대칭이 된다. 무료 이탈 자체를 막았으므로 버려진 적이 생기는 경로가 사라진다 — 원인을 닫는 쪽이 싸다.
4. **`tier`/아트 identity(§18.1) · `deploy-rules` 첫 실행(§20).** 각각 소유자 결정과 외부 사건 대기로 이번 wave에서도 손대지 않는다.

**머지 전 적대적 감사 — 내 주장 하나가 거짓이었다.** PR #44가 CI 그린이 된 뒤, 머지 전에 입력 표면을 5개 렌즈(터미널 파서 재감사 · QA 시드 API · 컴포넌트 직접 전이 · 네이티브 브릿지 · reducer 핸들러)로 독립 탐색하고 각 발견을 3관점(correctness/reachability/severity)으로 반증 시도했다. 결과:

- **`ControlPanel`의 상점 버튼이 세 번째 표면이었다**(`ControlPanel.tsx:528`). 나는 커밋에 "파서와 `GameRoot` 둘 다 이 액션만 부른다"고 적었고 그 문장 자체는 참이지만, **표면이 셋인데 둘만 셌다.** 놓친 이유가 중요하다 — **구조 계약이 파서만 검사하고 있었다.** 그래서 이 PR에 (a) 그 버튼을 `openShop` 경유로 돌리고 (b) 계약을 "표면 열거"에서 **"`src/**` 어디에도 상점 진입 시퀀스를 복제하는 곳이 0곳"**(부재 불변식 — §7이 소스 정규식을 허용하는 범주)으로 바꿨다. 주입으로 확인: 되돌리면 새 계약이 그 파일을 지목한다. 현재는 `gameState === GS.COMBAT` 조기 반환이 상태 가드를 대신하지만 **그건 렌더 조건에 얹힌 가드**고, 실측하면 그 조기 반환 목록에 `dead`/`ascension`/`true_ending`이 없다.
- **긍정 확인**: QA 시드 API는 프로덕션에서 닫혀 있다 — `isTestHarnessBuild()`가 상수 false로 접히고, 클린 프로덕션 빌드 + Playwright로 `?smoke=1`/`?e2e=1`/`?deviceQa=…` 5종을 실제로 띄워 `window.__AETHERIA_TEST_API__`가 전부 `undefined`임을 확인했다(대조군으로 하네스 빌드에서는 등장). 시드 API 등록 조건과 클라우드 쓰기 차단 조건이 **같은 술어(`isMockRuntime()`)**라 어긋날 수 없다. 플랫폼 뒤로가기도 `FOCUS_PANEL_STATES`에 `combat`이 없어 Wave 17식 이탈이 재현되지 않는다.
- **Wave 18로 넘기는 발견 4건**(이 PR의 범위 밖, 전부 선재 결함): ① `gameState: 'dead'`로 복원되면 `ControlPanel`에 `dead` 조기 반환이 없어 이동 버튼이 렌더되고 `RESET_GAME` 없이 런이 계속된다(사망 페널티 우회) ② `lootGrave`(`questActions.ts:18`)에 `gameState` 가드가 0건이고 사망 상태에서 `control-recover`가 렌더돼 죽은 자리에서 자기 묘비를 즉시 회수한다(골드 복제) ③ `ReturnBriefingCard`가 전투 중에도 렌더되고 그 버튼이 `setGameState(IDLE)`로 **도주 판정 없이 전투를 버린다** — Wave 17이 shop에서 고친 것과 **정확히 같은 결함이 다른 표면에** 있다 ④ Capacitor(Android/iOS) 빌드에서 `platformBack` 배선이 Toss/sandbox 전용이라 뒤로가기 핸들러 9개가 전부 도달 불가. ①②③는 공통 전제가 "`dead`/`combat` 상태가 세이브로 영속되고 복원된다"이므로 **상태별 렌더 게이트를 한 축으로 묶어** 다루는 것이 맞다.

**이 감사가 남기는 판단 기준**: 계약이 검사하는 **범위**가 주장의 범위보다 좁으면, 그 계약은 초록인데 주장은 거짓일 수 있다. 표면을 열거하는 계약은 열거한 것만 지킨다 — **부재 불변식으로 쓰면 범위가 `src/**` 전체가 된다.**

**최종 게이트** (head `8008a4cd`, CI 동일 빌드): type-check 0 · lint 0 · unit **5,123 / 5,123**(skip 0, Wave 16 대비 +9) · build:guard ok · CI-env build ok · e2e **121 / 121**(61 + 60) · perf desktop ok(FCP 564ms) / mobile ok(FCP 436ms) · `release-complete-core` 증빙 **13종** verify 전부 ok.

**남은 후보 (Wave 18)**: (1) **`tier`/아트 identity** — §18.1 발견 1·2, 여전히 소유자 정책 대기(“provenance 역사 1,065개 파일을 재핀해도 되는가”); (2) **`deploy-rules` 첫 실전 실행 결과** — §20 G3, develop 푸시라는 외부 사건 대기. 첫 실패는 “설계가 틀렸다”가 아니라 “IAM 역할이 hosting 전용이다”로 읽을 것; (3) **입력 표면 축의 나머지** — 이번 wave는 터미널만 전수했다. QA 시드 API(`useGameTestApi`)·네이티브 브릿지(`platformBack`/`lifecycleBridge`)·`GameRoot`의 다른 `open_*` 직접 전이가 같은 검사를 아직 안 받았다; (4) 퀘스트 104 `beyond-anchors` 공백(§19에서 기각, 재측정 없이 재논의 금지); (5) class-(b) 소스 가드 1,807건 — Wave 11 C4 정책대로 방치하되 **깨질 때 이관**이 실효 전략임이 Wave 16에서 확인됐다.

---

## 22. Wave 18 (2026-09-21, 베이스 `main` = `4d049ff6` = PR #44 merge commit)

**핵심**: 이 wave는 **내가 틀린 것을 기록으로 남기는 wave**다. 착수 시 내가 보고한 결함("골드 100,000으로 죽으면 복원 후 150,000이 되어 죽는 것이 이득")은 **사실이 아니었고**, 그 오류를 쫓는 과정에서 더 심각한 진짜 결함(`event` 영구 벽돌)이 드러났다.

### 정정 — 내가 합성한 상태로 결론을 냈다

착수 근거는 이랬다: `LOAD_DATA`에 골드 100,000을 가진 player + `gameState: 'dead'`를 넣고 복원한 뒤 `lootGrave()`를 부르면 150,000이 된다. **실행했고 그 숫자가 나왔다.** 그런데 그 상태를 **프로덕션이 만들 수 있는지**를 확인하지 않았다.

진짜 전투 사망 경로를 리듀서로 돌린 결과:

| | 사망 직전 | 사망 **같은 전이** 직후 |
|---|---:|---:|
| `player.gold` | 100,000 | **200** (`CONSTANTS.START_GOLD`) |
| `player.name` | `'용사'` | **`''`** |
| `player.level` | 20 | 1 |
| `player.loc` | 고요한 숲 | 시작의 마을 |
| 묘비 | — | 50,000 |

`CombatEngine.handleDefeat`(`CombatEngine.ts:272-331`)가 `dead`를 세우는 **바로 그 전이에서** 페널티를 전부 적용한다. 세이브에 들어가는 값은 200이고, 정상 흐름(사망→리셋→회수 = 50,200)과 "버그" 흐름(사망→저장→복원→회수 = 50,200)의 **차이는 0**이다. 골드 복제는 없다. `name === ''`이라 복원 직후 렌더는 `App.tsx:184`의 IntroScreen이지 ControlPanel도 아니다.

프로덕션의 `GS.DEAD` 생산자는 `combatHandlers.ts:248` **하나뿐**이고 항상 player를 함께 리셋한다. 리셋 없이 `dead`를 만드는 곳은 `useGameTestApi`의 QA 시드 둘뿐이다(프로덕션에서 tree-shaken — Wave 17 감사가 빌드 산출물로 확인). **즉 내가 본 150,000은 도달 불가능한 합성 상태다.**

이 오류의 이름은 이 문서에 이미 있다 — §21이 "UI가 막는다는 관찰은 경로가 막힌다는 증명이 아니다"라고 적었고, Wave 16·17이 모두 "도달 가능성을 실행으로 확인"을 규율로 세웠다. **나는 그 규율을 남의 작업에 적용하면서 내 작업에는 적용하지 않았다.** `LOAD_DATA`를 직접 호출해 상태를 만든 것은 `useGameTestApi`가 하는 일과 같고, 그건 플레이어 경로가 아니다.

### 드러난 진짜 결함 — `event` 영구 벽돌 (웹/iOS)

| 단계 | 실측 |
|---|---|
| `explore()`가 AI 호출 **전에** `GS.EVENT`를 세운다 | `exploreActions.ts:87`, AI 타임아웃 9.5s(`aiService.ts:64`) |
| 저장 디바운스 500ms(`BALANCE.DEBOUNCE_SAVE_MS`), 봉투 6필드에 `isAiThinking` **없음** | `{player, gameState, enemy, grave, currentEvent, quickSlots}` |
| 그 ~9초 창에서 찍힌 세이브를 복원 | `{gameState: 'event', currentEvent: null, isAiThinking: false, syncStatus: 'synced'}` |
| 화면 | `ControlPanel:480` → `<EventPanel currentEvent={null}>` → `EventPanel:25` `if (!currentEvent) return null` — **아무것도 안 그린다** |
| 탈출구 | `MobileGameLayout:74`의 `{!isPanelFocusState && …}`가 `event`에서 TerminalView를 **마운트하지 않아** 터미널 `1`(handleEventChoice)에 도달 불가. explore/move/rest는 각자 액션 가드. `syncStatus: 'synced'`라 재저장도 없다 |

**웹/iOS에서 영구 벽돌**이다. 유일한 탈출구인 안드로이드 `platformBack`은 — Wave 18에서 따로 실측한 바 — **Capacitor 빌드에서 배선조차 없다**(`lifecycleBridge.ts:91`이 `toss`/`sandbox`에서만 `subscribeBack`을 걸고, `@capacitor/app` 의존이 없으며, 네이티브 `onBackPressed` 오버라이드도 0건). 즉 Toss 런타임만 빠져나온다.

같은 모양이 `dead`에도 있다: `runSummary`는 전투 패배 순간에만 만들어지고 저장되지 않는데 `App.tsx:162`의 사망 화면 조건이 `GS.DEAD && runSummary`다. 게다가 `characterActions.start`는 `gameState`를 건드리지 않아 새 캐릭터를 만들어도 `dead`로 남는다(explore/shop/rest/quests가 전부 에러 로그를 내고 이동 버튼만 우연히 치유한다).

### 수정 — 이미 있던 한 줄을 일반 규칙으로

`LOAD_DATA`에는 `combat && !enemy → idle`이 이미 있었다. 그게 이 결함 종류의 **첫 사례**였다. 일반화한다:

```
restorableMode(mode):
  combat → enemy 필요
  event  → currentEvent 필요
  dead   → 언제나 불가 (runSummary가 봉투에 없다)
```

봉투도 `DATA_VERSION`도 안 건드린다. 확인: 픽스처 7종은 전부 `gameState: 'idle'`, `migrateData`는 `gameState`를 읽지도 쓰지도 않고(타입 선언 1건이 전부), `save-compatibility-roundtrip`은 `state.gameState`를 단언하지 않는다.

**두 조건이 서로 다른 값을 읽는다 — 의도가 다르고, 실측으로 갈랐다.**

| 조건 | 읽는 값 | 이유 (실측) |
|---|---|---|
| 모험 유물 정리 | `requestedMode` | 폴드된 `gameState`로 읽으면 사망 세이브의 정리가 건너뛰어져 `adventureRelicBonuses: {killStackAtk: 0.5}`가 **남는다** |
| 포식 보너스 종료 | `gameState`(폴드됨) | `requestedMode`로 바꾸면 `adventure-relic-lifetime.test.js`의 "불완전 전투 정리" 한 칸이 **깨진다** |

### 내 테스트 하나가 공허참이었다

결함 주입 3종 중 세 번째("첫 조건을 `gameState`로 되돌리기")가 **안 걸렸다**. 원인: 내 픽스처가 `adventureRelicBonuses: {maxHp, sources}`였는데 실제 모양은 `{devour: {phase, amount}, killStackAtk}`라(`adventureRelicBonuses.ts:4-31`) `normalizeAdventureRelicBonuses`가 이미 `undefined`로 만들어 양쪽이 같은 값을 보고 있었다. 진짜 모양으로 바꾸니 판별된다.

**이것도 이 문서에 이름이 있다** — Wave 10의 §8-5 계약이 "공허참"이었고 Wave 11 C1이 그걸 찾았다. 공허한 단언은 초록이라서 눈에 안 띈다. **주입이 안 걸리면 그건 코드가 옳다는 뜻이 아니라 테스트가 안 보고 있다는 뜻이다** — 주입을 세 번 다 돌린 것이 그걸 잡았다.

### 남은 것 (Wave 19 후보)

1. **`GS.EVENT`를 AI 호출 전에 세우는 설계 자체.** 이번 수정은 복원 경계에서 접는 것이라 **증상을 막지만 창 자체는 남는다**(그 9초 동안 다른 저장/동기화가 무엇을 보는지는 별개 질문). `isAiThinking`을 봉투에 넣을지, 아니면 이벤트 준비 상태를 `GS.EVENT`가 아닌 별도 모드로 뺄지가 설계 선택이다.
2. **J3 `ReturnBriefingCard` 전투 이탈** — 머지 전 감사가 보고했으나 이번 wave에서 **실측으로 확인하지 못했다**(워크플로의 해당 probe 에이전트가 세션 한도로 실패). 확인 전에는 결함으로 취급하지 않는다.
3. **J4 Capacitor 뒤로가기 배선** — 실측 완료(위). 수리에 `@capacitor/app` **새 의존**이 필요하고 락파일·청크 검토가 따라온다. 의존 추가 여부가 설계 결정이다.
4. `tier`/아트 identity(§18.1) · `deploy-rules` 첫 실행(§20) — 각각 소유자 결정·외부 사건 대기로 여전히 미결.

**최종 게이트** (head `a8f43394`, CI 동일 빌드): type-check 0 · lint 0 · unit **5,130 / 5,130**(skip 0, Wave 17 대비 +7) · build:guard ok · CI-env build ok · e2e **121 / 121**(61 + 60) · perf desktop ok(FCP 540ms) / mobile ok(FCP 408ms) · `release-complete-core` 증빙 **13종** verify 전부 ok.

## 23. Wave 19 계획 (2026-09-21 착수, 베이스 `main` = `450bb2a0` = PR #45 merge commit)

**핵심**: §22가 남긴 후보 4개를 **전부 실행으로 다시 쟀다**. 그 결과 넷 중 둘의 전제가 틀려 있었다. (1) "J3는 미확인"이었는데 — 리듀서로 돌리면 **재현된다**(세 출구 중 하나). (2) "`deploy-rules` 첫 실행은 외부 사건 대기"였는데 — **이미 네 번 돌았고 네 번 다 죽었다**. 그리고 그 옆에서 아무도 안 본 것이 하나 더 있다: `deploy-prod`(Firebase Hosting)는 **2026-08-04(run 259)부터 관측 가능한 40건 연속 failure**다. 마지막으로 후보 1("`GS.EVENT`를 AI 호출 전에 세우는 설계")은 §22가 적은 "9초 창"보다 더 나쁜 형태가 하나 있다 — `exploreActions.ts:89`의 `try`에 **`catch`가 없어서**, `generateEvent`가 reject하면 **재시작 없이 그 자리에서** `{event, currentEvent: null, isAiThinking: false}`가 된다. Wave 18의 폴드는 `LOAD_DATA`에만 있으므로 이 경로를 못 잡는다. 그리고 그 reject는 주입이 아니라 프로덕션 코드로 도달된다(아래 K1 실측).

**이 wave의 입력은 후보가 아니라 실측이다.** §22의 규율("합성한 상태로 결론 내지 말 것")을 이번에는 착수 단계에 적용했다 — 각 전제를 `npx tsx`/`node --test`/GitHub Actions API로 실행해 확인한 뒤에야 트랙이 됐다.

### 실측 1 — 후보 1: `GS.EVENT` 선행 세팅의 실제 위험 세 가지

| # | 실측 | 근거 |
|---|---|---|
| 1-a | `explore()`는 `SET_GAME_STATE event` → `SET_AI_THINKING true` → `await generateEvent` 순서다. 9,500ms는 `AI_PROXY_TRACKS`의 리터럴 | `exploreActions.ts:87-88, 109` · `aiService.ts:64-71` |
| 1-b | 그 `try`에 **`catch`가 없다** — `finally`가 `isAiThinking`만 되돌린다 | `exploreActions.ts:89-137` |
| 1-c | **주입 실행**: `AI_SERVICE.generateEvent`를 reject로 바꾸고 `createExploreActions(...).explore()`를 호출하면 dispatch가 `SET_GAME_STATE=event \| SET_AI_THINKING=true \| SET_AI_THINKING=false`로 끝나고 `explore()` 자체가 reject한다. `IDLE`도 `SET_EVENT`도 없다 = `EventPanel`이 `return null`인 **라이브 벽돌** | `node --import tsx` 인라인 실행. 대조군(`→ null`)은 `COMMIT=nothing \| SET_GAME_STATE=idle`, (`→ event`)는 `COMMIT=narrative_event \| SET_EVENT` |
| 1-d | **프로덕션 도달 경로**: `generateEvent` → `decideRequest` → `readQuota` → `TokenQuotaManager.getQuotaData` → `JSON.parse(localStorage.getItem(...))`에 try/catch가 없다. `localStorage`에 JSON이 아닌 값을 넣고 실행하면 `canMakeAICall()`이 `SyntaxError`를 던지고 **`AI_SERVICE.generateEvent`가 reject**한다(`USE_AI_PROXY=false`에서도 — 정책이 폴백 사유를 가리려고 쿼터를 읽는다). `writeQuota`의 `setItem`도 무방비(Safari 쿠키 차단 = `SecurityError`, 사설 모드 = `QuotaExceededError`) | `TokenQuotaManager.ts:113-124, 150-152` · `aiService.ts:84-87` · 실행으로 확인 |
| 1-e | 봉투 6필드 + `lastSeenAt` 스탬프, 디바운스 500ms, 클라우드 업로드는 `gameState`를 **그대로** 올린다 | `useFirebaseSync.ts:145-160, 530-532, 566` · `constants.ts:227` |
| 1-f | `isAiThinking`의 생산자는 **둘**이다 — `explore()`와 `addStoryLog`(전투/퀘스트 내러티브, 9.5s). `ControlPanel:468`은 `EVENT && isAiThinking`으로 "준비 중" 패널을 고르므로, 내러티브 생성 중에 체인/캠프파이어 이벤트가 열리면 카드 대신 "준비 중"이 최대 9.5초 뜬다 | `useGameEngine.ts:131-162` · `ControlPanel.tsx:468-482` |
| 1-g | `gameState`는 **`string`**이다. `GS`에 멤버를 추가해도 컴파일러가 소비처를 짚지 않는다 — CLAUDE.md §8-3의 `'quiet'` 니어미스와 같은 모양이고, 그래서 아래 파급 전수는 grep 결과지 추정이 아니다 | `gameReducer.ts:37` · `actionTypes.ts:288` |

### 실측 2 — 후보 2(J3): 재현됐다, 세 출구 중 하나에서

| 단계 | 실측 |
|---|---|
| 카드 게이트 | `GameRoot.tsx:437` — `bootStage === 'ready' && player && !debrief && !story`. **`gameState` 조건 없음** |
| 브리핑 조건 | `lastSeenAt`으로부터 `RETURN_BRIEFING_HOURS`(6h) 경과. `lastSeenAt`은 **모든 로컬 저장**이 찍는다(`useFirebaseSync.ts:151`) — 전투 중 저장도 찍는다 |
| 출구 3개 | ① X 아이콘 → `onClose` = 로컬 `setBriefing(null)` **무해** ② 보상 없을 때 primary → `onClose` **무해** ③ **`claimableRewardCount > 0`일 때 primary → `onOpenGoals` → `handleOpenArchiveTab('quest')` = `setSideTab` + `setGameState(GS.IDLE)`** (`GameRoot.tsx:231-235`, `ReturnBriefingCard.tsx:20-26`) |
| 실행 | `LOAD_DATA {combat, enemy}` 복원(Wave 18이 고정한 정상 복원) → `buildReturnBriefing(player, now)` = `{awayHours: 7, claimableRewardCount: 2}` → primary의 두 dispatch 적용 → **`gameState: idle`, `enemy: 숲 늑대` 잔존, `combatReceipt: null`, HP 그대로**. 도주 판정 없는 전투 이탈 — Wave 17 I1과 같은 결함 클래스 |
| 같은 시퀀스의 복제 | `setSideTab` + `setGameState(IDLE)` 3줄이 `GameRoot.tsx:231-235`와 `MobileGameLayout.tsx:59-66` **두 곳**에 있다(Wave 17의 "3줄이 두 곳" 모양). 전투 중 도달 가능한 표면은 ReturnBriefingCard 하나뿐 — `ControlPanel`의 `openMap`은 `COMBAT` 조기 반환(455) 뒤의 idle 트리(751)에만 있고, `handleOpenEquipment`는 `GameRoot:319`가 전투에서 `null`로 막는다 |

감사가 보고한 문장("그 버튼이 `setGameState(IDLE)`로 전투를 버린다")은 **버튼 셋 중 하나에서 참**이었다. 재현 없이 받았으면 셋 다 고쳤을 것이고, 재현 없이 버렸으면 하나를 놓쳤을 것이다.

### 실측 3 — 후보 3: Capacitor Android는 "핸들러 9개가 죽은" 것이 아니라 "뒤로가기 = 앱 종료"다

| 실측 | 근거 |
|---|---|
| `bindLifecycleBridge`는 `toss`/`sandbox`에서만 `subscribeBack` | `lifecycleBridge.ts:92` (`RuntimeEnvironment`에 `'capacitor'`가 **있다** — `runtimeEnvironment.ts:4`) |
| `@capacitor/app` 미설치 — `node_modules/@capacitor` = android/cli/core/ios, 락파일 0건, `capacitor.build.gradle` dependencies 빈 블록 | 실측 |
| `MainActivity extends BridgeActivity {}` — 오버라이드 0 | `MainActivity.java:5` |
| **Capacitor Android 8.3.1 코어(`com/getcapacitor/*.java`)에 back 처리가 0건** — `onBackPressed`/`OnBackPressedCallback`/`KEYCODE_BACK` 전부 없음. `CapacitorWebView.dispatchKeyEvent`는 `ACTION_MULTIPLE`만 가로챈다 | `BridgeActivity.java` 218줄 전수 · `CapacitorWebView.java:50-56` |
| 따라서 하드웨어 뒤로가기 = AndroidX 기본(액티비티 종료). 상점 안이든 전투 중이든 **앱이 닫힌다**. `usePlatformBackHandler` 9파일 + `handlePlatformBack`의 7분기가 전부 도달 불가 | `App.tsx:69-104` |
| `@capacitor/app@8.1.1`: 73KB, peer는 `@capacitor/core >=8`뿐. 락파일 델타 = 패키지 1 | `npm view` |
| iOS는 SPM(`ios/App/CapApp-SPM/Package.swift` 추적됨, Podfile 없음). `cap sync ios`는 macOS에서만 — **Linux에서 확인 불가**(Wave 15 G3의 "저장소 안에서 확인 불가능" 모양) | 실측 |

### 실측 4 — 후보 4: 외부 사건은 이미 일어났고, 옆에 더 큰 것이 있었다

| 실측 | 근거 |
|---|---|
| `deploy.yml`은 `main`/`develop` push에 돈다. `deploy-rules`는 PR #42·#43·#44·#45 머지에서 **4회 실행, 4회 failure** | GitHub Actions API |
| #45(run 35563662111)의 실패 스텝 "Deploy firestore.rules": `Request to https://serviceusage.googleapis.com/v1/projects/***/services/firestore.googleapis.com had HTTP Error: 403, Permission denied to get service [firestore.googleapis.com]` — firebase-tools가 rules 배포 **전에** API 활성 여부를 조회하는데 서비스 계정에 `serviceusage.services.get`이 없다. **§19 G3이 예고한 그 실패 모드(IAM)**이고, 설계 실패가 아니다. "Resolve credentials"는 success — 시크릿 4종은 존재한다 | job 106221360675 로그 |
| **같은 run의 `deploy-prod`도 failure**: `429 RESOURCE_EXHAUSTED — You have exceeded the Hosting storage quota for your Firebase project`. 그리고 이 job은 `deploy-rules`가 생기기 **전인** #36~#41에서도 failure였고, 페이지를 넘기면 run 259(2026-08-04)~288까지 30건 전부 failure다 — **최소 40건 연속** | job 106221476936 로그 · run 목록 2페이지 |
| 실제 프로덕션 웹은 Firebase Hosting이 아니다 — `docs/QUICK_DEPLOY.md:44` `wrangler pages deploy`, `functions/api/`(Cloudflare Pages Functions), `tasks/todo.md`의 `*.pages.dev`. 즉 `deploy-prod`는 **7주째 빨간 잔재**이고, 그동안 §19~§22의 "CI 그린"은 `ci.yml`이었지 이 워크플로가 아니었다 | 실측 |
| `tier`: `KNOWN_TIER_DEPTH_DIVERGENCE = ['성직자']` 유지. 새 정보 없음 | `class-tier-depth.test.js:43` |

### K1 파급 전수 — `GS`에 멤버를 추가하면 읽는 곳 (grep, 주석 제외)

`GS.EVENT` 참조 21곳 + 문자열 리터럴 `'event'` 2곳 + `FOCUS_PANEL_STATES` 1곳 = **24곳**. 각 소비처가 미지의 상태 `event_pending`을 만났을 때의 else-동작:

| 소비처 | 오늘 | `event_pending`에서 (수정 없을 때) | K1 조치 |
|---|---|---|---|
| `exploreActions.ts:87` | EVENT 세팅 | — | **생산자 교체** → `BEGIN_AI_EVENT` |
| `exploreActions.ts:128` `SET_EVENT` | 이미 EVENT라 상태 안 세움 | 상태가 pending인 채 `currentEvent`만 채워짐 | `RESOLVE_AI_EVENT`로 교체 |
| `exploreActions.ts:132` null 경로 → IDLE | — | — | `RESOLVE_AI_EVENT null` |
| `exploreActions.ts:81,163,212,229,241` (bounded/체인/캠프파이어/보스/스카우트) | 같은 tick에 EVENT + SET_EVENT | 창이 없다 | **불변** |
| `ControlPanel.tsx:468` `EVENT && isAiThinking` | 준비 중 패널 | **idle 버튼으로 낙하** → "이동" 버튼이 `setGameState(MOVING)` → AI 응답이 MOVING 위에 떨어진다 | `=== EVENT_PENDING`으로; 475의 하드코딩 한국어는 MSG로 |
| `ControlPanel.tsx:480` | EventPanel | — | `=== EVENT`만 |
| `App.tsx:38` `FOCUS_PANEL_STATES` | EVENT 포함 → TerminalView 언마운트 | pending은 미포함 → 터미널 마운트. 명령은 각 액션 가드가 막지만(explore≠idle · move∉[idle,moving] · rest≠idle · shop≠idle) 문구가 제각각 | pending 추가(오늘 UX 유지) |
| `App.tsx:146` 아카이브 독 | 숨김 | 숨김(동일) | 불변 |
| `platformBack.ts:25-27` | `'event'` → dismiss-event | **`close-app`** → Toss에서 뒤로가기가 준비 중에 **앱을 닫는다** | `event_pending → dismiss-event` |
| `commandParser.ts:18-26` `blockedStateMessages` | event 키 있음 | 키 없음 → 명령이 액션 가드로 흘러감 | pending 키 추가(MSG) |
| `commandParser.ts:42` `1/2/3` | 이벤트 선택 | 미매칭 → 알 수 없는 명령 | 불변(선택지가 없다) |
| `commandSuggestions.ts:38` | 1/2/3 제안 | 제안 없음 | 불변 |
| `TerminalView.tsx:163` bgClass | — | 기본 배경 | 불변(장식) |
| `useProductTelemetry.ts:130` explore outcome | `hasEvent \|\| EVENT` | commit·resolve가 같은 continuation에서 배치되므로 렌더 시점엔 EVENT | 불변 |
| `chainEventHandlers.ts:94,126` · `boundedEncounterHandlers.ts:54` · `fallbackEventHandlers.ts:74` | `!== EVENT → state` | pending에 이벤트가 없으니 no-op이 맞다 | 불변 |
| `exploreHandlers.ts:83` `RESOLVE_SCOUT` | EVENT | — | 불변 |
| `bootstrapHandlers.ts:57-63` `restorableMode` | event → currentEvent 필요 | **pending으로 복원 → "준비 중" 패널이 영원히** — 스피너 달린 같은 벽돌 | `event_pending → 언제나 idle`(진행 중 promise는 리로드를 못 넘는다) |
| `useFirebaseSync.ts:92,113,365,384,417` combat 폴드 ×5 | combat만 | 리듀서가 접는다 | 불변 |
| `useGameTestApi.ts:1961,1988,2081` QA 시드 | EVENT + 이벤트 | — | 불변 |
| `QuickSlot.tsx:29` | COMBAT/IDLE만 사용 가능 | 불가(오늘 EVENT와 동일) | 불변 |
| `moveActions.ts:25` `isAiThinking` 가드 | — | 상태 가드가 먼저 막는다 | 불변 |
| `tests/command-surface-contract.test.js:55` | **STATES 9종 하드코딩**(`GS`는 11종 — `moving`·`true_ending`이 빠져 있다) | 새 상태가 행렬 밖 | `event_pending` 추가(+ 빠진 둘도) |
| `progressionSimulator`/`progressionDiagnostic`/`endgameSettlement` | `'combat'`/`'dead'` 리터럴 | 모델은 AI를 안 부른다 | 불변 → 모델 핀 불변의 근거 |

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **K1 AI 이벤트 준비를 별도 모드로 + 리듀서 소유 정산** | `GS.EVENT_PENDING` 신설. `AT.BEGIN_AI_EVENT`(→ `{gameState: EVENT_PENDING, isAiThinking: true, currentEvent: null}`)와 `AT.RESOLVE_AI_EVENT {event \| null}`(**`state.gameState === EVENT_PENDING`일 때만** 적용 — 이벤트면 `EVENT`+`currentEvent`, null이면 `IDLE`; 아니면 `state` 그대로) 두 전이를 `ActionPayloadMap`에 넣는다(N1b `RESOLVE_SCOUT` 선례). `explore()`는 `BEGIN` → `await` → `RESOLVE`이고 **`catch`가 `RESOLVE null` + `MSG` 에러 로그**를 낸다. `restorableMode`에 `event_pending → 불가` 한 줄. `platformBack`·`commandParser`·`App.FOCUS_PANEL_STATES`·`ControlPanel` 위 표대로. 그리고 `TokenQuotaManager.getQuotaData`/`writeQuota`를 **fail-closed**로(읽기 실패 = 오늘 한도 소진으로 취급 → 폴백 풀. 미터가 유일한 일일 비용 통제이므로 못 세면 안 보낸다 — §6 D3) | ① 라이브 벽돌(1-c/1-d)이 닫힌다 ② 준비 중에 dismiss/리로드된 뒤 도착한 응답이 **리듀서에서 무시**된다(오늘은 `SET_EVENT`가 idle 위에 떨어져 `currentEvent` 고아가 남는다 — `useGameEngine.ts:221-224` `dismissEvent` 뒤) ③ 렌더 조건에서 `isAiThinking`이 빠져 1-f의 이중 생산자 결합이 풀린다 ④ 복원 폴드가 "동반 상태 유무"가 아니라 **구조적**(pending은 동반 상태 자체가 없다) | `gameStates` 1 · `actionTypes` 2키 · 핸들러 1파일 · `exploreActions` · `ControlPanel` · `App.tsx` · `platformBack` · `commandParser` · `bootstrapHandlers` · `messages` · `TokenQuotaManager` · 테스트 5 | 위 표의 24곳 중 하나를 빼먹으면 **컴파일러가 침묵한다**(`gameState: string`). 특히 `restorableMode`를 빼면 스피너 달린 영구 벽돌, `platformBack`을 빼면 Toss 뒤로가기가 앱을 닫는다. `RESOLVE`의 상태 검사를 빼면 dismiss 뒤 응답이 idle을 EVENT로 되돌린다. `_shared.ts`(`commitExploreOutcome`)·`eventActions.ts`를 건드리면 바이트 핀 증빙 2종이 움직인다 — **건드릴 이유가 없고 건드리면 안 된다** | opus |
| **K2 아카이브 진입 소유권 이전 (J3)** | `characterActions.openArchive(tab)` 신설: 허용 상태 = `{idle, moving, shop, job_change, quest_board, crafting}`(포커스 패널이 `onOpenArchiveConsole`로 정상 진입한다), 거부 = `{combat, event, event_pending, dead, ascension, true_ending}` → `MSG` 에러 로그 + `false`. 수락 시 `SET_SIDE_TAB` + `SET_GAME_STATE idle`. `GameRoot.handleOpenArchiveTab`과 `MobileGameLayout.openArchiveConsole`은 **이 액션만 부르고** 수락됐을 때만 `setMobileConsoleMode('archive')`. ReturnBriefingCard는 손대지 않는다 | 도주 판정 없는 전투 이탈 표면이 0이 된다. 3줄 복제 두 곳이 한 액션이 된다(Wave 17 I1의 정확한 반복) | 액션 1 + `actionDeps` + 소비처 2 + MSG 1 + 테스트 1파일 | **카드를 전투에서 안 띄우는 방식은 틀렸다** — `lastSeenAt`은 모든 저장이 찍으므로 전투가 끝나고 게이트가 다시 마운트되면 브리핑은 이미 `null`이다(보상 안내가 영구 소실). 가드는 카드가 아니라 액션에 둔다. 허용 집합에서 포커스 4종을 빼면 상점/퀘스트보드의 "아카이브" 버튼이 죽는다 | sonnet |
| **K3 Capacitor 뒤로가기 배선** | `@capacitor/app@8.1.1` 추가. `lifecycleBridge`에 `environment === 'capacitor'` 분기 — `tossBridge`와 같은 DI 모양의 `capacitorBridge { subscribeBack, exitApp }`(기본 구현은 `App.addListener('backButton', …)` / `App.exitApp()`), `onBack`이 false면 `exitApp`. **정적 import 금지** — web/toss 빌드에 플러그인 프록시가 실리지 않도록 기본 브릿지는 lazy `import('@capacitor/app')`. `npm run build` 후 `npx cap sync android`로 `capacitor.build.gradle`·`capacitor.settings.gradle` 델타 커밋 | Android에서 뒤로가기가 앱 종료가 아니라 카드/패널 닫기가 된다. 죽어 있던 9핸들러 + 7분기가 산다 | 의존 1(+73KB, 락파일 +1) · `lifecycleBridge` · 네이티브 생성물 2 · 테스트 1 · `perf:guard` 재측정 | iOS `Package.swift`는 **macOS에서만** 갱신된다 — 이 wave에서는 "Linux에서 확인 불가"로 적고 소유자가 `npm run ios:sync` 후 커밋. 정적 import로 쓰면 `toss-lifecycle-bridge.test.js`의 web 케이스("Toss 브릿지를 만지지 않는다")와 같은 이유로 web 번들에 플러그인이 실린다. `manualChunks`는 `@capacitor/*`를 안 잡으므로 index로 간다 — 결과는 `perf:guard`가 잰다(§8-10) | sonnet |
| **K4 배포 파이프라인 실측 기록 + 소유자 질문** | (a) CLAUDE.md §8-8을 실측으로 갱신: "첫 실행 결과 = `serviceusage.services.get` 403 (IAM)". (b) `deploy-prod` 40건 연속 failure와 실제 호스트(Cloudflare Pages)를 §23에 적는다. (c) 소유자 결정 2건을 아래 "질문"으로 넘긴다. **워크플로 파일은 이 wave에서 안 만진다** | 다음 wave가 "외부 사건 대기"를 다시 적지 않는다 | 문서 2 | 결정을 대신하면 실패다 — IAM과 호스팅은 저장소 밖이다 | 직접 |
| **K5 증빙·문서** | 통합 트리에서 `progression:diagnostic:write`(맨 마지막, 병행 금지) → 13종 verify → CLAUDE.md(§5 DON'T에 "아카이브 진입은 `openArchive`" · §6 AI 이벤트에 pending 모드 · §7 테스트 목록 · §8-6 폴드 표에 `event_pending` 행 · §8-8) · `tasks/todo.md` | — | — | — | 직접 |

**계약 테스트와 결함 주입** (Wave 18이 공허참을 출하한 뒤라, 주입이 안 걸리면 코드가 옳은 게 아니라 테스트가 안 보는 것이다)

| 테스트 | 고정하는 것 | 주입 → 걸려야 하는 것 |
|---|---|---|
| `tests/ai-event-pending-contract.test.js` (신규) | ① `explore()` AI 경로 dispatch 열: `BEGIN_AI_EVENT` → (`generateEvent`→event) `RESOLVE_AI_EVENT {event}` / (→null) `RESOLVE null` / (→**reject**) `RESOLVE null` + error 로그, `explore()`는 reject하지 않는다. 열에 **`SET_GAME_STATE=event`가 없음**을 함께 단언 ② 리듀서: `RESOLVE_AI_EVENT`는 `EVENT_PENDING`에서만 적용 — `IDLE`/`EVENT`에서 dispatch하면 `state` 동일 참조 ③ `TokenQuotaManager`: `getItem`이 `'{corrupt'`/throw일 때 `canMakeAICall() === false`이고 `generateEvent`가 **resolve**(폴백)한다 | ①에서 `catch` 제거 → reject 케이스 red. 생산자를 `SET_GAME_STATE EVENT`로 되돌림 → "없음" 단언 red. ②에서 상태 검사 제거 → idle 케이스 red. ③에서 try/catch 제거 → throw |
| `tests/restorable-mode-contract.test.js` (행 추가) | `[EVENT_PENDING, {}, IDLE]` + `[EVENT_PENDING, {currentEvent: EVENT}, IDLE]`(동반 상태가 있어도 접는다) | `restorableMode`의 pending 줄 제거 → red |
| `tests/toss-lifecycle-bridge.test.js` (케이스 추가) 또는 `tests/platform-back-*.test.js` | `resolvePlatformBackAction({gameState: 'event_pending'}) === 'dismiss-event'`; `environment: 'capacitor'`에서 주입한 `capacitorBridge.subscribeBack`이 구독되고 `onBack` false면 `exitApp` 1회, true면 0회; `web`/`toss` 케이스는 capacitor 브릿지를 **만지지 않는다**(기존 web 케이스의 throw 스텁 패턴) | K3 분기 제거 → capacitor 케이스 red. web에서 capacitor 구독 → web 케이스 throw |
| `tests/command-surface-contract.test.js:55` STATES | `event_pending`·`moving`·`true_ending` 추가 (11종 전수) | — (전수 루프의 범위 정정) |
| `tests/archive-open-contract.test.js` (신규, K2) | ① `openArchive('quest')`를 `combat`(+enemy)에서 → `SET_GAME_STATE` 0건, error 로그 1건, 반환 false; `idle`·`shop`에서 → `SET_SIDE_TAB` + `SET_GAME_STATE idle` ② **J3 재현 고정**: `LOAD_DATA {combat, enemy, player.stats.lastSeenAt = now−7h, 완료 미수령 퀘스트}` → `buildReturnBriefing(...).claimableRewardCount > 0` → `openArchive('quest')` → `gameState === 'combat'`, `enemy` 동일 ③ 부재 불변식(§7 허용 범주): `src/components/**`에서 `setSideTab(` 호출과 `setGameState(` 호출이 **같은 파일에** 공존하는 곳 0(오늘 2파일 — 식별자 매칭, 포맷 무관) | ①에서 combat 거부 제거 → red ②는 ①의 주입과 **다른** 방식으로 죽어야 한다: 액션이 거부 대신 idle로 접도록 바꾸면 `enemy` 단언만 red(픽스처의 `enemy`가 진짜 모양인지 — Wave 18의 교훈 — `restorable-mode-contract`의 `ENEMY`를 재사용) ③ `GameRoot`에 3줄 되돌림 → red |
| `tests/control-panel-*.test.js` (renderStatic, 추가) | `gameState: 'event_pending'` → MSG의 준비 중 문구; `'event'` + 이벤트 → EventPanel; `'event_pending'`에서 `control-explore`/`control-move` **미렌더** | `ControlPanel:468` 조건을 되돌림 → 미렌더 단언 red(idle 버튼 낙하) |

**증빙 델타 (먼저 적는다)** — 이 wave는 모델 입력(`data/*`, `progressionSimulator`, `explorationPacing`, `exploreFlow`, `_shared`)을 **한 파일도 안 건드린다**. 성공 기준은 Wave 15~18과 같다: **모델 핀 3종 불변**(`EXPECTED_BASELINE_REPORT_SHA256 = ac79428c…` · `PROGRESSION_V1_BASELINE_HASH = 2573fa0f…` · `exploration-rhythm 0818fb7a…`).

| 증빙 | 예고 |
|---|---|
| `progression-diagnostic-v2` | **움직인다** — `sources` 346 유지, 편집 경로의 sha256만. K3의 `package.json`/`package-lock.json`은 고정 14경로에 있으므로 K3만 통합돼도 `tests/progression-diagnostic-cli.test.js`는 red다(§19의 G3 사례와 같다). `reportHash` `f21dcf81…`·`v1Baseline` 불변 |
| `relic-event-chance` (`eventActions.ts` 바이트 핀) | **불변이어야 한다** — K1은 `dismissEvent`가 `useGameEngine.ts`에 있으므로 `eventActions.ts`를 건드릴 이유가 없다. 움직였으면 K1이 범위를 넘은 것 |
| `equipment-combat-power` (`_shared.ts`·`constants.ts`·`classes.ts`·`CombatEngine.*` 핀) | **불변이어야 한다** — `commitExploreOutcome`은 그대로 쓴다. K1이 상수를 추가하면 `tierHash`가 아니라 `sourceSnapshot` 한 줄이 움직이므로 상수는 추가하지 않는다(타임아웃 9,500은 이미 `aiService`가 소유) |
| `content-reachability`·`event-reward-coherence`·나머지 | 바이트 동일 |
| `perf:guard` | K3로 index 청크가 +수십 KB. 예산 2,200ms 대비 실측 FCP 408~564ms — 재측정만 |

**순서**: **K1 ∥ K2 ∥ K3** (worktree 격리 — 파일 집합 교차는 `messages.ts` 키 추가뿐이라 통합자가 푼다; `App.tsx`는 K1만, `characterActions`/`GameRoot`/`MobileGameLayout`은 K2만, `lifecycleBridge`/`package*`는 K3만) → 통합 → 직렬 게이트(type-check · lint · unit · build:guard) → K3의 `cap sync android` 델타 확인 → `progression:diagnostic:write` **맨 마지막**(§15.1: 실행 중 병행 명령 금지) → 13종 verify → `perf:guard` → K4·K5 → PR → CI → merge. K1은 상태 기계라 **내부적으로 직렬**(생산자 교체 → 소비처 24곳 → 폴드 → 테스트 순)이고 다른 트랙과는 병렬이다.

**판단 포인트** — 후보 1의 설계 선택지 네 개를 이 코드베이스의 실패 사례로 비교했다. 골랐다: **B**.

| 선택지 | 얻는 것 | 비용 | 이 코드베이스에서 깨지는 것 |
|---|---|---|---|
| A. AI 응답 **뒤에** `GS.EVENT` (그동안 `IDLE` + `isAiThinking`) | 새 상태 없음 | IDLE 가드를 가진 액션 전부에 `isAiThinking` 가드 추가 | `explore` 가드는 `!== IDLE`뿐(152)이라 호출 중 **두 번째 탐험**이 가능하고 그게 전투를 열면 응답이 `COMBAT` 위에 떨어진다. 막으려면 `isAiThinking`을 가드로 써야 하는데 그 플래그의 **두 번째 생산자가 `addStoryLog`**(1-f)라 전투 승리 내러티브 9.5초 동안 탐험·휴식·상점이 전부 막힌다 — 새 회귀. `commandParser`는 `isAiThinking`을 입력으로 받지 않으므로 시그니처 변경 없이는 터미널이 못 막는다. `platformBack`은 idle을 `close-app`으로 풀어 Toss 뒤로가기가 호출 중 앱을 닫는다 |
| **B. `GS.EVENT_PENDING` + 리듀서 정산** (채택) | 위 표의 ①~④ | 소비처 24곳 수동 전수(컴파일러 무보조) | 빼먹은 한 곳이 조용히 else로 떨어진다 — 그래서 전수를 표로 적고 주입 테스트를 소비처별로 둔다 |
| C. `isAiThinking`을 봉투에 | — | `DATA_VERSION` 5.1→5.2 + `migrateData` + 픽스처 7 + 골든 재생성 | **복원된 `isAiThinking: true`에는 뜻이 없다** — 진행 중 promise는 리로드를 못 넘으므로 복원은 어차피 idle로 접어야 하고, 그 판정은 `!currentEvent`가 이미 한다. 스키마 변경만 남는 순비용 |
| D. 쓰기 쪽 폴드(저장 시 `{event, null}`을 idle로) | 구 클라이언트 보호 | writer 2곳 + 술어 추출 | 보호 대상은 "새 writer + 구 reader" 쌍인데, 오늘 배포된 산출물(웹 09-10 · iPhone 09-14 · APK 09-10 local-only)은 **전부 구 클라이언트**라 그 쌍이 아직 없다. 새 빌드가 나가는 순간 같은 계정의 구 빌드를 대체한다. 라이브 벽돌(1-c)은 어차피 못 막는다 |

둘째, **K2는 카드가 아니라 액션을 고친다** — 이유는 `lastSeenAt`이 모든 저장에 찍힌다는 실측 하나다. 셋째, **K3의 iOS 절반은 이 환경에서 끝나지 않는다** — 그걸 완료로 적으면 §22의 실수를 반복하는 것이다.

**하지 않기로 한 것**
1. **선택지 A·C·D** — 위 표.
2. **`SET_GAME_STATE`에서 `enemy` 정리** — §21이 기각한 그대로. K2가 원인을 닫는다.
3. **`ReturnBriefingGate`에 `gameState !== COMBAT` 조건** — 브리핑이 영구 소실된다(위).
4. **동기 producer 5곳(체인/캠프파이어/보스/스카우트/bounded)까지 `EVENT_PENDING` 경유** — 창이 0이다. 바꾸면 소비처만 늘고 얻는 게 없다.
5. **`useFirebaseSync`의 `combat && !enemy` 폴드 5중복 정리** — 리듀서가 이미 접으므로 죽은 중복이지만, 이번 wave의 상태 기계 변경과 같은 파일에 리팩터를 얹지 않는다. 관찰로만 남긴다.
6. **`deploy.yml` 수정** — `deploy-prod` 40연속 failure의 처분(호스팅 잔재 삭제 / 스토리지 정리 / 방치)은 소유자 결정이다. 아래 질문.
7. **`tier`/아트 identity** — 여전히 결정 대기. 핀은 F4가 재 둔 그대로(`9da28843…`/`4a888aa0…`).
8. **퀘스트 104 `beyond-anchors` · class-(b) 가드 1,807건** — 이월.
9. **`@capacitor/app`의 다른 기능**(`appStateChange`로 `visibilitychange` 대체 등) — 뒤로가기만.

**소유자에게 넘기는 질문 (저장소가 답할 수 없는 것)**

| 질문 | 선택지 | 비용 |
|---|---|---|
| Q1. `deploy-rules` 서비스 계정 IAM | (a) SA에 `roles/serviceusage.serviceUsageConsumer` + `roles/firebaserules.admin` 부여 (b) 방치 | (a) 콘솔 작업 1회, 이후 push마다 rules가 자동 배포되고 §8-8의 "충분조건이 아니다" 단서를 좁힐 수 있다 (b) 의견 보내기 등 새 경로가 계속 구 rules에 거부되고 job은 계속 빨갛다 |
| Q2. Firebase Hosting `deploy-prod`/`deploy-dev` | (a) 두 job 삭제, `deploy-rules`만 남김(실제 호스트가 Cloudflare Pages이므로) (b) Hosting 스토리지 릴리스 보존 개수 설정으로 429 해소 (c) 방치 | (a) 워크플로 1 — `needs: [build, deploy-rules]`의 순서 보장 문장도 함께 지운다 (b) 콘솔 작업이지만 두 호스트를 계속 유지하는 비용 (c) 매 push마다 빨간 run — 7주째 그랬고 아무도 안 봤다 |
| Q3. `tier` provenance 재핀 | §19 "하지 않기로 한 것" 1 그대로 | 변동 없음 |

**게이트 베이스라인** (착수 시): unit 348파일 / 5,130 케이스(§22), e2e 121, 13종 verify ok. 이 wave의 성공 기준: 모델 핀 3종 불변 + 주입 테스트 전부 red→green 확인 + `deploy.yml`은 손대지 않았으므로 여전히 빨갛다(그건 Q1·Q2의 답이 정한다).

### 23.1 Wave 19 실행 결과 (2026-09-21)

**커밋**: `a0ad5da7` §23 계획 · `a30156f5` K4 §8-8 실측 · `5be25d21` K3 · `3b1ee925` K2 · `1eaf200d` K1 · `17321609` 증빙 재생성. 트랙 3개는 worktree 병렬(K1 opus / K2·K3 sonnet), 충돌은 `messages.ts` 끝 블록 하나(둘 다 유지).

**예고 델타 적중**: 이동은 `progression-diagnostic-v2.json` 하나, 바뀐 키는 `sources`뿐(편집 경로 17 + 고정 경로 `package.json`/`package-lock.json`), 346 → 346, `reportHash`·`v1Baseline` 불변. `content d2d37207…` · `exploration-rhythm 0818fb7a…` 불변, `relic-event-chance`·`equipment-combat-power` 바이트 동일 — K1이 금지 파일 5종을 한 바이트도 안 건드렸다는 증명. 모델 핀 3종 불변. `tests/progression-simulator.test.js`도 sources에 있다 — 25번째 소비처 수정이 핀에 잡혔다.

**계획과 실측이 갈린 곳 — 셋, 전부 실행이 잡았다**

| # | §23의 예측 | 실측 | 결론 |
|---|---|---|---|
| 1 | K1 소비처 24곳(`src/**` grep) | **25곳** — `tests/progression-simulator.test.js:376`이 AI 경로 카드를 `AT.SET_EVENT`에서 읽고 있었다. 전 suite를 돌려 잡았다 | 표는 `src/**`만 봤으니 구조적으로 못 보는 종류. `GS` 멤버 추가 시 `tests/**`도 grep(CLAUDE.md §5 DON'T에 적음) |
| 2 | K1 "렌더 조건에서 `isAiThinking` 제거" → `finally { SET_AI_THINKING false }`도 불필요 | **`finally` 유지가 맞다.** 리듀서가 늦은 응답을 버릴 때(`!== EVENT_PENDING` → 동일 참조) `isAiThinking`이 true로 굳고, 그 플래그는 `moveActions`의 첫 가드라 **이동이 영구 차단**된다. 렌더는 모드만 보므로 한 번 더 내리는 것은 무해 | AI 경로 dispatch 열은 3개: `BEGIN_AI_EVENT \| RESOLVE_AI_EVENT \| SET_AI_THINKING(false)` |
| 3 | K2 주입 2(거부 대신 idle 폴드) → "`enemy` 단언**만** red" | `accepted`·`gameState`가 먼저 red, **`enemy`는 red가 아니다** — `SET_GAME_STATE` 핸들러가 `...state`만 하고 `enemy`를 안 건드리므로 dispatch만 하는 결함에서는 `enemy` 동일성이 항상 유지된다 | `enemy` 단독 단언이었으면 **Wave 18의 공허참을 재현**했을 것이다. 테스트는 셋을 함께 단언한다 |

**K1 결정 하나 더**: `TokenQuotaManager`의 쓰기 실패 플래그(`quotaWriteHealthy`)는 모듈 스코프이고 성공한 쓰기로만 풀리는데, 쓰기는 `recordCall`(호출 **뒤**)에서만 일어나므로 저장소가 깨진 세션은 리로드까지 AI 호출 0(폴백 풀만). D3 "미터를 못 세면 안 보낸다"의 의도된 저하이고 벽돌이 아니다 — `getCallLedger()`는 읽기 실패 시 `null`(기존 계약 — `syncToFirestore`가 "못 읽으면 쓰지 않는다"에 의존; 빈 레코드를 돌려줬으면 `used: 0` 문서를 올렸을 것이다).

**K3 실측**: 패키지 **1개** 추가(락파일 +10줄), `cap sync android` 델타는 gradle 2파일 3줄, 플러그인은 자체 lazy chunk(~1KB × 2)로 분리되고 `index` 청크 델타 **+0.61KB**(배선 코드뿐) → `manualChunks` 규칙 불필요. 테스트의 "미접촉" 단언은 `doesNotThrow`가 아니라 **호출 카운터**다 — 브릿지 호출이 전부 try/catch로 감싸져 있어 throw만으로는 판별이 안 된다(에이전트가 스스로 잡음). **iOS는 이 환경에서 끝나지 않았다**: SPM(`Package.swift`)은 macOS에서만 sync된다 — 소유자가 `npm run ios:sync` 후 델타 커밋. 완료로 적지 않는다(§22 반복 금지).

**K4**: CLAUDE.md §8-8에 실측 붙임. `deploy-rules` 실패 지점은 예고(`firebaserules.releases.update`)보다 **한 단계 앞**(`serviceusage.services.get` 403)이라 IAM은 두 역할을 함께 줘야 한다. `deploy-prod`는 run 259(2026-08-04)부터 연속 failure이고 실제 호스트는 Cloudflare Pages. Q1·Q2는 소유자 결정 대기 — `deploy.yml` 미접촉.

**운영 발견**: worktree에는 `node_modules`가 없어(부모에서 해석) `tests/equipment-economy-audit.test.js`의 심링크 케이스가 worktree에서만 `ERR_MODULE_NOT_FOUND`로 죽고 `build:guard`(`vite` ENOENT)도 못 돈다 — 통합 트리에서는 둘 다 통과. 그리고 worktree 베이스는 로컬 HEAD가 아니라 `origin/main`이라 계획 커밋(§23)이 worktree에 없었다 — 계획 파일을 스크래치패드 경로로 따로 넘겼다. 다음 wave부터 트랙 프롬프트에 **계획 파일 경로를 직접** 넣을 것.

**Wave 20 후보**
1. `gameState: string` → `typeof GS[keyof typeof GS]`로 닫기 — 이번 wave가 24+1 소비처를 손으로 센 이유가 이것이다. `platformBack.ts:25`·`commandParser.ts:42`의 리터럴 `'event'`처럼 `GS` 밖 문자열 비교가 몇 곳인지가 선행 실측.
2. Q1/Q2 결정 반영(`deploy.yml` 정리 + `docs/DEPLOYMENT.md` 101~107·120~123행의 Hosting 잔재).
3. K3 iOS 델타(소유자 `ios:sync`) + Android 실기 뒤로가기 확인 — 단위 테스트가 못 보는 층.
4. `tier`/아트 identity — 변동 없음(§19).


**게이트** (head `bddcb078` 코드 동일, 직렬 실행 07:38~07:58): type-check 0 · lint 0 · unit **5,157 / 5,157**(350파일, skip 0, Wave 18 대비 +27) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **121 / 121**(61 + 60, chromium-mobile) · perf desktop FCP 504ms / mobile FCP 504ms · tracked 증빙 verify 15종 ok.

**Q1 해소 (2026-09-21 08:23 UTC, run 351)**: IAM 실측 — 프로젝트의 SA는 `firebase-adminsdk-fbsvc` 하나뿐이었고(`github-action-…` 없음), run 349 로그에 project_id 불일치 경고가 없어 secret이 그 SA의 키임을 확정했다. `Service Usage Consumer` + `Firebase Rules Admin` 부여 → #46 머지 푸시의 `deploy-rules`가 `released rules firestore.rules to cloud.firestore`. **G3 도입 후 첫 성공.** `deploy-prod`는 같은 run에서 여전히 429 — Q2 대기.

## 24. Wave 20 계획 (2026-09-21 착수, 베이스 `main` = `49defbc9` = PR #46 merge commit)

**핵심**: §23.1의 후보 4개와 Wave 19 보고서의 관찰 3개를 **전부 실행으로 다시 쟀다**. 결과: 후보 1(`gameState: string` 닫기)은 §23.1이 기대한 것보다 **작고 정확하다** — 실제 타입을 in-memory로 좁혀 `tsc`를 돌리면(컴파일러 API로 파일을 안 건드리고) 오늘의 코드는 설계 전체를 적용해도 **에러 0**이고, 결함 4종을 주입하면 **4종 전부** 잡힌다. 다만 §23.1이 이 후보의 동기로 적은 "25번째 소비처가 `tests/`에 있었다"는 이 후보로 **닫히지 않는다** — `tsconfig.json`이 `tests/**/*`를 include하지만 `checkJs: false`라 `.test.js`는 애초에 타입 검사 대상이 아니다(실측 1-a). 즉 L1이 사는 것은 `src/**`의 미래 오타·누락(컴파일 시점)이지 테스트의 grep 의무가 아니다 — §5 DON'T의 "`tests/**`도 grep" 문장은 그대로 남는다. Q2는 착수 중 소유자가 **(a)로 결정**했고 콘솔 실측(Hosting은 기본 도메인 2개뿐, 현재 릴리스 `ec5cb6` = **2026-07-15 14:34** — §23이 Actions 목록에서 볼 수 있던 run 259/08-04보다 3주 앞선 시점부터 낡은 빌드를 서빙)이 §23의 "잔재" 판정을 확정했다. 관찰 3개 중 **둘은 트랙이 아니다**(`useFirebaseSync` 폴드 5중복 · `TokenQuotaManager` 재시도 — 둘 다 실행/추적으로 "얻는 것 0 또는 음수"), 하나는 **래칫만**이다(한국어 하드코딩 — `src/data` 밖 AST 기준 **3,802** 노드, 그중 컴포넌트 JSX 텍스트 549는 기존 래칫 정규식이 **구조적으로 0으로 센다**).

### 실측 1 — 후보 1: `gameState: string`을 `GS` 리터럴 유니온으로 닫으면 실제로 무엇이 일어나는가

| # | 실측 | 근거 |
|---|---|---|
| 1-a | **테스트는 컴파일러 밖이다.** `tsconfig.json`: `include: ["src/**/*", "tests/**/*"]`, `allowJs: true`, **`checkJs: false`** → `tests/*.test.js`는 프로그램에 들어가지만 진단이 안 난다. `tests/e2e/*.spec.ts`(TS)만 검사 대상이고 그 12곳의 `gameState` 읽기는 전부 `toBe('idle'/'combat'/'true_ending')`라 유니온 안이다. **§23.1 후보 1의 동기("tests의 25번째")는 이 후보로 안 닫힌다** | `tsconfig.json:9-10, 33` · grep `tests/e2e` |
| 1-b | `gameState` 언급: `src/**` **227줄 / 48파일**, `tests/**` **413줄 / 96파일**. `string`으로 선언된 자리는 src에 **17곳**: `gameReducer.ts:37`(원천) · `actionTypes.ts:202`(`LoadDataPayload`) · `:303`(`SET_GAME_STATE` payload) · `dataMigration.ts:115`(`MigratedSave`) · `useProductTelemetry.ts:17` · `endgameSettlement.ts:10` · `platformBack.ts:15` · `commandParser.ts:12` · `commandSuggestions.ts:9` · `useGameTestApi.ts:143,182,268` · `ControlPanel.tsx:56` · `TerminalView.tsx:102` · `CommandAutocomplete.tsx:6` · `SystemTab.tsx:122` · `QuickSlot.tsx:22`. 함수형 `setGameState` 선언 **8곳**: `actionDeps.ts:135` · `useGameEngine.ts:193` · `ShopPanel.tsx:35` · `JobChangePanel.tsx:24` · `QuestBoardPanel.tsx:232` · `CraftingPanel.tsx:27` · `ControlPanel.tsx:60,249` | grep |
| 1-c | `GS` 밖 **문자열 리터럴 비교**는 src에 **19줄**: `useFirebaseSync.ts:92,113,365,384,417`(combat 폴드 5) `:580`(`!== 'dead'`) · `useInventoryActions.economy.ts:26` · `characterActions.ts:160,198,225` · `platformBack.ts:27` · `progressionDiagnostic.ts:947,976,980` · `progressionSimulator.ts:705,725,730` · `bootstrapHandlers.ts:81` · `commandParser.ts:46`. 객체 리터럴 대입 10곳(`endgameSettlement.ts:84,120,130,167,184,201` · `progressionDiagnostic.ts:373,939` · `progressionSimulator.ts:699` · `gameReducer.ts:134`). **값은 8종 전부 `GS` 멤버다**(`ascension`·`combat`·`dead`·`event`·`event_pending`·`idle`·`shop`·`true_ending`) — 즉 오늘의 코드에 오타는 0이고, 타입을 닫아도 이 29곳은 **하나도 에러가 안 난다**(리터럴은 유니온 안이라 contextual typing으로 통과). 컴파일러의 이득은 전부 **미래형**이다 | grep + 1-g |
| 1-d | 테스트의 리터럴은 10종이고 그중 **2종이 `GS` 밖**: `'IDLE'`(`readability-map-signal.test.js:137` · `core-hud-language-readability.test.js:130,148`, `TerminalView` 렌더 픽스처 — 단언이 모드와 무관) · `'intro'`(`cycle-500-599.test.js:3944,3971`, `createCharacterActions.start`의 deps — `start`는 `gameState`를 안 읽는다). 둘 다 `LOAD_DATA`를 안 지나므로 L1의 경계 술어(1-h)가 결과를 바꾸지 않는다 | 실행으로 확인(픽스처 경로 추적) |
| 1-e | **V1** — `GameState.gameState`만 `GameMode`로: 진단 **5** — `gameReducer.ts:196`(satisfies 연쇄) · `bootstrapHandlers.ts:32`(`LOAD_DATA`가 `gameState: string`을 반환) · `combatHandlers.ts:112`(중첩 `SET_GAME_STATE` payload가 string) · `:181`(`endgameResult.gameState: string`) · `uiHandlers.ts:14`(`SET_GAME_STATE` payload). 즉 `string`은 **세 입구**로 들어온다: `SET_GAME_STATE` payload, `LOAD_DATA` payload, `EndgameSettlementResult` | TS compiler API in-memory 오버라이드(파일 무변경) |
| 1-f | **V2** — + `ActionPayloadMap[SET_GAME_STATE]: GameMode`: 진단 **4**, `combatHandlers.ts:112` 소멸(payload가 좁혀져 핸들러가 저절로 맞는다). **V3** — + 1-b의 시그니처 전부: `combatHandlers.ts:181`도 소멸(`endgameSettlement`가 좁혀지면). **`combatHandlers.ts`는 편집이 필요 없다** — 이 파일은 `relic-dot-multiplier`가 바이트 핀한다(1-k) | 같은 방법 |
| 1-g | **V4** — + `useGameEngine.ts:193`/`actionDeps.ts:135`의 `setGameState: (val: GameMode)` + `LOAD_DATA` 경계 술어(1-h): 진단 **2**, 둘 다 `MobileGameLayout.tsx:112,127` — `(val: GameMode) => void`를 `(state: string) => void` prop에 넘기는 **반변성** 에러. 6개 컴포넌트 prop 선언(1-b)을 좁히면 **V4b = 0**. 설계 전체가 오늘 코드 위에서 컴파일된다는 뜻 | 같은 방법 |
| 1-h | 경계: `LoadDataPayload.gameState?: string`(`actionTypes.ts:202`)은 `migrateData`의 `MigratedSave.gameState?: string`(`dataMigration.ts:115`)에서 오고 그건 `JSON.parse`(localStorage/Firestore)의 결과다 — **신뢰 밖**. 모든 복원 경로가 `LOAD_DATA` 한 곳으로 모인다: `bootStateMachine.ts:281,401,410,428,437` + QA 시드 `useGameTestApi.ts:1168`. 오늘 `bootstrapHandlers.ts:41,62-69`는 미지의 문자열(`'formation'`)을 **그대로 복원**한다(`restorableMode`가 else에서 `true`) | 코드 추적 |
| 1-i | **V5** — V4b 위에 결함 4종 주입: `platformBack.ts` `=== 'evnt'` → **TS2367**(no overlap) · `QuickSlot.tsx` `=== 'combat '` → **TS2367** · `dispatch({SET_GAME_STATE, payload: 'formation'})` → **TS2345** · `commandParser`의 `blockedStateMessages`를 `Record<GameMode, string \| null>`로 바꾸고 키 하나 누락 → **TS2741**(`'true_ending' is missing`). **4/4 검출**. 이것이 L1이 사는 것의 전부이고 정확한 목록이다 | 같은 방법 |
| 1-j | `useProductTelemetry.ts:53`은 `String(state?.gameState \|\| '')`로 **의도적으로** string이다(아웃바운드 텔레메트리 모양). V3에서 이 필드까지 좁히면 진단 1이 **잡음**으로 남는다 → 좁히지 않는다. 같은 이유로 `AetheriaTestApi`의 3필드(`useGameTestApi.ts:143,182,268`)는 좁혀도 되고(V3에서 에러 0, e2e `toBe`는 유니온 안) 좁힌다 — e2e 스펙은 TS라 오타가 잡힌다 | 실행 |
| 1-k | 바이트 핀 대조(verify 스크립트에서 경로를 추출): `relic-event-chance` = `progressionProfiles.ts`·`eventActions.ts`·**`exploreActions.ts`**·`CombatEngine.loot.ts`·`CombatEngine.outcome.ts` / `relic-dot-multiplier` = `relics.ts`·**`combatHandlers.ts`**·`CombatEngine.actions.ts`·`relicDotMultiplierAudit.ts`·**`dataMigration.ts`**·`tests/relic-dot-multiplier-coherence.test.js` / `relic-gold-multiplier` = `relics.ts`·`CombatEngine.actions.ts`·`CombatEngine.outcome.ts` / `relic-hp-drain-atk` = `relics.ts`·`CombatEngine.ts`·`relicHpDrainAtkAudit.ts`·`hpDrainAtkRelic.ts`·`statsCalculator.ts`·`tests/relic-hp-drain-atk-coherence.test.js` / `equipment-combat-power` = `classes.ts`·`constants.ts`·`signatureRegistry.json`·`signatureSets.json`·`_shared.ts`·`CombatEngine.enemyAI.ts`·`equipmentCombatPowerAudit.ts`·`equipmentUtils.ts`·`equipmentValidation.ts`·`signatureSetBonus.ts`·`statsCalculator.ts`·`tests/equipment-combat-power-audit.test.js` / `relic-drop-rate` = `CombatEngine.loot.ts`·`relicDropRateAudit.ts`·`tests/combat-engine-loot.test.js`·`tests/relic-drop-rate-coherence.test.js`. **L1의 편집 집합(아래 표) ∩ 이 목록 = ∅** — `combatHandlers`·`dataMigration`·`exploreActions` 셋은 "편집이 필요 없다"가 아니라 **"편집하면 안 된다"**로 적는다 | `scripts/verify-*.mjs` 6종 |

**L1 파급 전수 — 편집하는 파일과 이유** (1-e~1-g의 컴파일러가 짚은 것 + 전수화 3곳)

| 파일 | 오늘 | L1 뒤 | 근거 |
|---|---|---|---|
| `src/reducers/gameStates.ts` | `GS` 객체만 | `export type GameMode = typeof GS[keyof typeof GS]` + `isGameMode(value: string): value is GameMode`(`new Set<string>(Object.values(GS))`) | 유일한 정본(파일 주석 "cycle 301: GameState alias 제거 — 명칭 충돌"이라 이름은 `GameMode`, §8-6의 "모드" 어휘와 일치) |
| `gameReducer.ts:37` | `string` | `GameMode` | 원천 |
| `actionTypes.ts:303` | `[AT.SET_GAME_STATE]: string` | `GameMode` | 1-e 입구 ①. **`:202` `LoadDataPayload.gameState?: string`은 그대로**(경계) |
| `handlers/bootstrapHandlers.ts:41,62-69` | `requestedMode = payload.gameState \|\| 'idle'`, `restorableMode(mode: string)` else-`true` | 아래 설계 — 술어로 좁히고 `switch`를 `never`로 닫는다 | 1-e 입구 ②, 1-h |
| `hooks/useGameEngine.ts:193` · `hooks/actionDeps.ts:135` | `(val: string)` | `(val: GameMode)` | 1-g |
| `ShopPanel:35` · `tabs/JobChangePanel:24` · `tabs/QuestBoardPanel:232` · `tabs/CraftingPanel:27` · `ControlPanel:56,60,249` | `(state: string) => void` / `gameState?: string` | `GameMode` | 1-g 반변성 — 빠뜨리면 `MobileGameLayout`이 2건 red |
| `TerminalView:102` · `CommandAutocomplete:6` · `tabs/SystemTab:122` · `QuickSlot:22` · `platformBack.ts:15` · `commandParser.ts:12` · `commandSuggestions.ts:9` · `useGameTestApi.ts:143,182,268` · `endgameSettlement.ts:10` | `string` | `GameMode` | 1-b. `endgameSettlement`를 안 좁히면 `combatHandlers:181`이 red가 되고 그 파일은 못 건드린다(1-k) |
| `platform/platformBack.ts:18,27-28` | `FOCUS_PANEL_STATES` Set + if 두 줄 | `const MODE_BACK_ACTION: Record<GameMode, PlatformBackAction>` 12행(event/event_pending→`dismiss-event`, shop/job_change/quest_board/crafting→`close-focus-panel`, 나머지 6→`close-app`), `return state.gameState ? MODE_BACK_ACTION[state.gameState] : 'close-app'` | K1 표의 "빠뜨리면 Toss 뒤로가기가 앱을 닫는다"가 **TS2741**이 된다. 11모드 결과 동일(테스트가 고정) |
| `utils/commandParser.ts:19-30` | `Record<string, string>` 7키, 한국어 7 | `Record<GameMode, string \| null>` 12키(idle/combat/moving/true_ending = `null`), 값은 `MSG.CMD_BLOCKED_*` | K1 표의 "키 없음 → 액션 가드로 흘러감"이 **TS2741**이 된다. 같은 파일의 나머지 한국어 7자리(`:92` 스킬 전환 · `:114/121/127/133` 상태·인벤·퀘스트·지도 템플릿 · `:139` help · `:150` 알 수 없는 명령)도 `MSG.CMD_*`로 — **14자리**, 어떤 테스트도 그 문자열을 단언하지 않는다(grep 0) |
| `data/messages.ts` | 끝 블록 = Wave 19 K1 | 끝에 `// Wave 20 L1` 블록 `CMD_BLOCKED_EVENT`… `CMD_UNKNOWN(command)` | Wave 19 규약(트랙별 끝 블록). 이번 wave에 MSG를 만지는 트랙은 L1뿐이라 충돌 없음 |
| **편집 금지** | `combatHandlers.ts` · `dataMigration.ts` · `exploreActions.ts` · `useFirebaseSync.ts` · `progressionSimulator.ts` · `progressionDiagnostic.ts` · `App.tsx` | 그대로 | 앞 셋은 바이트 핀(1-k). 뒤 셋은 리터럴이 유니온 안이라 컴파일이 통과하고(1-c), 모델 둘은 핀 3종의 입력이다. `App.tsx:41`은 `new Set<string>`이라 통과 |

**L1 봉투 경계 설계** (`as` 0 — `unknown`/`string` + 술어, CLAUDE.md §2):

```ts
// bootstrapHandlers.ts LOAD_DATA
const requestedRaw = action.payload.gameState || GS.IDLE;          // string — 봉투는 신뢰 밖
const requestedMode: GameMode = isGameMode(requestedRaw) ? requestedRaw : GS.IDLE;
const restorableMode = (mode: GameMode): boolean => {
    switch (mode) {
        case GS.COMBAT:        return Boolean(enemy);
        case GS.EVENT:         return Boolean(action.payload.currentEvent);
        case GS.EVENT_PENDING: return false;
        case GS.DEAD:          return false;
        case GS.IDLE: case GS.MOVING: case GS.SHOP: case GS.JOB_CHANGE:
        case GS.QUEST_BOARD: case GS.CRAFTING: case GS.ASCENSION: case GS.TRUE_ENDING:
            return true;                                            // 오늘의 else-true를 모드별로 명시 — 행동 동일
        default: { const exhaustive: never = mode; return exhaustive; }  // 새 GS 멤버 = 컴파일 에러
    }
};
const gameState: GameMode = restorableMode(requestedMode) ? requestedMode : GS.IDLE;
```

행동 변화는 정확히 하나다: **미지의 문자열이 `idle`로 접힌다**(오늘은 그대로 복원 — UI가 어느 트리도 못 그리는 상태). `requestedMode === 'dead'`(정리 분기, `:78`)와 폴드된 `gameState`(`:81`)의 이중 읽기는 §8-6 그대로 유지. `assertNever` 헬퍼 파일은 만들지 않는다(src에 없다 — 새 파일은 `progression-diagnostic-v2`의 sources 346을 347로 만든다).

### 실측 2 — 후보 2: Q2, 결정됨 = (a) Hosting job 삭제

| 실측 | 근거 |
|---|---|
| **소유자 콘솔**: Firebase Hosting 도메인은 기본 2개뿐(`aetheria-rpg-90a2f.web.app` / `.firebaseapp.com`, 커스텀 없음). 현재 릴리스 `ec5cb6` = **2026-07-15 14:34**, 배포자 `firebase-adminsdk-fbsvc@…`, 직전 3건도 같은 날(13:47 · 13:54 · 14:23). 즉 Hosting은 **약 10주째 2026-07-15 빌드**를 서빙 중이고, §23이 Actions 목록에서 관측한 "run 259 / 2026-08-04부터 실패"보다 **3주 앞서** 이미 멈춰 있었다 | 소유자 보고(2026-09-21) |
| `deploy-prod`/`deploy-dev`를 참조하는 곳은 **`deploy.yml` 자신뿐**(`:197`, `:225`, 각각 `needs: [build, deploy-rules]`). 다른 워크플로·스크립트·테스트에 0건. `dist` 아티팩트(`:45-49` Upload)의 소비자도 그 두 job뿐 → 업로드 스텝도 죽은 코드가 된다 | 저장소 전수 grep(단, `.claude/worktrees/**` 20개 사본이 grep에 잡힌다 — 아래 운영) |
| `firebase.json:2-14` `hosting` 블록 — `rules:deploy`(`--only firestore:rules`)는 안 읽는다. 저장소 안 유일한 독자는 `tests/firestore-rules-semantics.test.js:662`이고 **`emulators` 키만** 읽는다 | 코드 |
| `tests/cf-functions.test.js:12-23` "Cloudflare is the only active web function surface" — `vercel.json` 부재 + `deploy.yml`에 `vercel` 부재. **Hosting에 대해서는 침묵** — 되돌리기를 잡는 계약이 없다 | 코드 |
| 문서 드리프트: `docs/DEPLOYMENT.md:3`은 Cloudflare Pages를 단일 source of truth로 선언하면서 `:14-33` 다이어그램(Deploy to DEV/PROD, Hosting·Functions 행) · `:82` `GEMINI_API_KEY`를 GitHub Secret 표에(`:84`가 바로 "Cloudflare 환경변수"라고 반박) · `:96-108` `*.web.app` 배포 흐름 · `:116-124` `firebase hosting:rollback`. `docs/FIREBASE_SETUP.md:3` "Firebase Hosting에 자동 배포하려면". CLAUDE.md `:357` "hosting 앞에 돌고(`deploy-prod`가 needs…)" · "빨갛게 죽지만 hosting은 나간다" · `:359` "남은 것은 `deploy-prod`뿐" | 읽음 |
| **주석 드리프트 4곳** — "deploy.yml은 hosting만 올린다": `src/systems/TokenQuotaManager.ts:240` · `firestore.rules:59` · `firestore.rules:195`("hosting 전용") · `tests/token-quota-firestore-contract.test.js:254`. Wave 15 G3 이후 이미 거짓이었고 L2 뒤에는 정반대(rules**만** 올린다)가 된다 | grep |

### 실측 3 — 후보 3: K3 iOS 델타 + Android 실기

| 실측 | 근거 |
|---|---|
| `ios/App/CapApp-SPM/Package.swift`에 `CapacitorApp` **없음** — 의존은 `capacitor-swift-pm` 하나. iOS 절반은 §23.1대로 미완 | 파일 |
| 예상 델타는 **정확히 2줄**: CLI 템플릿(`@capacitor/cli/dist/util/spm.js:121,133`)이 플러그인의 `Package.swift` product 이름(`node_modules/@capacitor/app/Package.swift` → `"CapacitorApp"`)으로 `dependencies`에 `.package(name: "CapacitorApp", path: "../../../node_modules/@capacitor/app")`, target에 `.product(name: "CapacitorApp", package: "CapacitorApp")`을 쓴다. `Package.resolved`는 path 패키지를 안 담으므로 **불변**이어야 한다. `App/App/public`·`capacitor.config.json`은 `ios/.gitignore` — 커밋은 **1파일**이 정상. `project.pbxproj`가 움직이면 멈추고 보고 | CLI 소스 · `ios/.gitignore` · tracked 23파일 |
| Android 쪽은 K3가 이미 커밋: `capacitor.build.gradle` `implementation project(':capacitor-app')`, `capacitor.settings.gradle` `include ':capacitor-app'`(`5be25d21`) | git |
| 실기가 봐야 할 층: `App.tsx:72-104` `handlePlatformBack`의 **7분기**(`close-premium`·`close-mirror`·`close-debrief`·`close-post-combat`·`dismiss-event`·`close-focus-panel`·`close-app`) + `platformBackRegistry.handleBack()`이 먼저 소비하는 **9개 `usePlatformBackHandler` 표면**(`EnhanceDecisionCard`·`ExpeditionDebriefCard`·`MilestoneStoryCard`·`MirrorPanel`·`PostCombatCard`·`PremiumShop`·`ReturnBriefingCard`·`TrueEndingScreen`·`GameRoot`) + `lifecycleBridge.ts:165-177`의 "false면 `exitApp`". 단위 테스트(`toss-lifecycle-bridge.test.js:134`)는 주입 브릿지로 카운터만 본다 — `@capacitor/app`의 실제 `backButton` 이벤트가 오는지는 기기만 안다 | 코드 |
| 기록 위치의 선례: `docs/PLAYTEST_CHECKLIST.md §11`(iPhone/Android 5분 루틴, P0/P1/P2 분류) · `docs/MOBILE_RELEASE.md §0-2`. `docs/evidence/qa/release-complete-core/OBSERVATION_RUNBOOK.md`는 릴리스 후보 봉인용이라 이 용도가 아니다 | 문서 |

### 실측 4 — 후보 4(tier) + Wave 19 관찰 3건

| 항목 | 실측 | 결론 |
|---|---|---|
| `tier`/아트 identity | `tests/class-tier-depth.test.js:43` `KNOWN_TIER_DEPTH_DIVERGENCE = ['성직자']` 불변, 새 정보 0 | §19 결정 유지, **제외** |
| `useFirebaseSync` combat 폴드 ×5 | 다섯 곳(`:92` 오프라인 로컬 · `:113` device-QA · `:365` local-record 복원 · `:384` 원격 · `:417` 재임포트)의 산출물은 전부 `applyBoot(...)` → `bootStateMachine.ts:281/401/410/428/437`의 **`LOAD_DATA`**로 끝나고 거기서 `restorableMode`가 같은 술어를 다시 건다. `persistenceTelemetry.ts`·`bootStateMachine.ts`·`cloudSaveAuthority.ts`의 `gameState` 읽기 **0건**. 훅을 import하는 테스트 **0건**(`from '../src/hooks/useFirebaseSync'` grep 0 — 언급 10파일은 주석/문자열). 유일한 관측 가능 차이: `:384`의 폴드는 `importCloudRecordAuthority`(`:396-408`)가 **로컬에 쓰는 payload**의 모양을 바꾼다(`{combat, enemy:null}` vs `{idle, enemy:null}`) — 다음 `LOAD_DATA`가 같은 `idle`로 접으므로 게임에서는 구별 불가 | 죽은 중복이 맞고, 제거해도 **어떤 테스트도 못 본다**(커버리지 0) — 즉 "실행으로 보여 줄 깨짐"이 없다. 얻는 것 5줄, 잃는 것은 단위 커버리지 0인 IO 훅을 만진다는 사실. **트랙 아님** |
| 한국어 하드코딩 | AST 스캔(TS compiler API, 주석 제외, StringLiteral + NoSubstitutionTemplate + TemplateHead/Middle/Tail + **JsxText**): `src/**` **11,646** 노드, `src/data/**` 7,844, **밖 3,802** = components **1,319**(JsxText **549** · 문자열 616 · 템플릿 조각 154) / utils **2,001** / hooks **285**(`useGameTestApi.ts` 236) / systems 120 / services 32 / reducers 29 / types 16 / platform **0**. 기존 래칫 `tests/debt-ratchet.test.js:74-92` `countKoreanStringLiterals`는 **따옴표 리터럴 정규식**이라 같은 디렉터리를 components 725 / hooks 279 / utils 1,923 / services 19로 센다 — **JSX 텍스트 549개를 0으로** 센다. §5가 금지하는 것("컴포넌트 JSX 안에 한국어 직접 입력")이 정확히 그 549다 | 전수 스윕은 불가(3,802 — 대부분 `itemVisuals`·`nameGenerator`·`regionTheme` 같은 표현 테이블과 데이터 키). **AST 래칫**만 트랙(L3). `commandParser`의 14자리는 L1이 같은 객체를 다시 타이핑하므로 L1에 붙인다(K1이 `ControlPanel:475`를 그렇게 했다) |
| `TokenQuotaManager` 쓰기 실패 플래그 | `quotaWriteHealthy`(`:134`)는 `writeQuota`(`:184-191`) 성공으로만 `true`, `canMakeAICall`(`:157-161`)이 `false`면 닫는다. 쓰기는 `recordCall`(`:166-169`)에서만, `recordCall`은 `aiService.ts:100-101` `dispatchProxyCall`이 호출하고 **반환값을 안 본다** → 저장소가 깨진 세션에서 **첫 호출 1건은 미터 없이 나간다**(쓰기 실패 → 플래그 false → 그래도 fetch), 그 뒤 리로드까지 0 | 아래 판단 |

**TokenQuotaManager 판단** — 세 선택지를 실패 사례로 비교했다. 골랐다: **C(현행 유지)**.

| 선택지 | 얻는 것 | 비용 | 실패 시나리오 |
|---|---|---|---|
| A. `canMakeAICall`에서 `!quotaWriteHealthy`면 현재 레코드를 **재기록 시도**(멱등)하고 성공 시 플래그 해제 | 리로드 없이 회복 | 읽기 안에 쓰기 부수효과 + 테스트 2 | 회복이 일어나는 유일한 경우는 저장소가 **간헐적으로** 실패할 때인데, 그때 "프로브 성공 → 게이트 열림 → `recordCall` 실패 → 미터 없는 디스패치 1 → 플래그 false → 다음 프로브 성공 → …"이 **반복**된다. 오늘은 세션당 ≤1인 미계량 디스패치가 **호출 빈도만큼** 열린다 — D3("미터를 못 세면 안 보낸다")를 정확히 위반하는 방향. 지속 실패(`SecurityError` 쿠키 차단·사설 모드 `QuotaExceededError`)에서는 어차피 회복이 없어 얻는 게 0 |
| B. `recordCall(): boolean` + `dispatchProxyCall`이 false면 폴백 | 미계량 디스패치 **0** | `aiService`+`TokenQuotaManager`+`ai-event-pending-contract` ③ 확장 | "호출할지"는 `aiEventPolicy`(C3)가 소유한다 — IO 계층이 정책의 `kind: 'call'` 결정을 뒤집으면 진실 원천이 둘이 된다. 정책이 쓰기 결과를 입력으로 받게 고치면(`readQuota`가 예약을 겸함) C3 재구조화 — "싸다"가 아니다 |
| **C. 현행** | — | — | 세션당 미계량 디스패치 **≤1**(깨짐 사건당). 서버 창(40req/60s)이 그 1건을 받는다. 이 상한을 §6에 **숫자로** 적는다(L5) |

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **L1 `gameState`를 `GameMode`로 닫기 + 봉투 경계 술어 + 소비처 3곳 전수화** | 위 "파급 전수" 표 그대로: `GameMode`/`isGameMode`(gameStates) → 원천·payload·시그니처 21파일 → `LOAD_DATA` 술어 + `restorableMode` `switch`/`never` → `platformBack` `Record<GameMode, PlatformBackAction>` → `commandParser` `Record<GameMode, string \| null>` + 한국어 14자리 `MSG.CMD_*` → 테스트(아래 표). **내부 직렬**(타입 → 경계 → 시그니처 → 전수화 → MSG → 테스트). 편집 금지 7파일 준수 | ① 미래의 오타 비교·잘못된 payload가 **컴파일 에러**(1-i, 4/4) ② K1이 손으로 채운 세 표(`platformBack`·`commandParser`·`restorableMode`)가 **새 `GS` 멤버에서 자동 red**(TS2741/never) ③ 미지 문자열 세이브가 `idle`로 접힌다(오늘은 그대로 복원) | src 21 + messages 1 + 테스트 3(신규 1) | (a) `combatHandlers`/`dataMigration`/`exploreActions`를 "정리" 명목으로 만지면 `relic-dot-multiplier`·`relic-event-chance`가 stale — 값은 안 바뀌어도 red다(§20의 교훈) (b) `LoadDataPayload.gameState`를 `GameMode`로 선언하면 캐스트 없는 거짓말 — `JSON.parse` 결과에 유니온을 붙이는 것이라 `as`와 같다 (c) 6개 컴포넌트 prop을 빠뜨리면 `MobileGameLayout` 2건 red(1-g) (d) `useProductTelemetry:53`을 좁히면 잡음 1(1-j) (e) 새 헬퍼 파일을 만들면 sources 347 — 예고와 어긋난다 | opus |
| **L2 Q2(a) — Firebase Hosting job 삭제 + 문서/주석 드리프트 + 부재 계약** | `.github/workflows/deploy.yml`: `deploy-dev`(`:196-222`)·`deploy-prod`(`:224-250`) 삭제, `build`의 `Upload Build Artifacts`(`:45-49`) 삭제(소비자 0), `on:`·`build`·`deploy-rules`(+`if:`, `environment:`) **유지**. 주석 재작성: `:1-2` 헤더, `:51-68`(hosting 순서 근거 → "실패는 명시적, `continue-on-error` 없음"만 남김), `:73-81`(environment 문장), `:182-188` Report(“hosting은 이어서 배포되므로” 삭제), `:252-267` REQUIRED SECRETS(`GEMINI_API_KEY` 줄 삭제 — Cloudflare 변수, `:264-267` 재작성). `firebase.json` `hosting` 블록 삭제. `tests/cf-functions.test.js` 부재 계약 확장: `deploy.yml` ∌ `action-hosting-deploy`, `firebase.json` ∌ `"hosting"`. `docs/DEPLOYMENT.md` `:14-33`·`:82`·`:96-108`·`:116-124`, `docs/FIREBASE_SETUP.md:3`, CLAUDE.md §8-8(`:357` "hosting 앞에" 문장·"빨갛게 죽지만 hosting은 나간다"·`:359` 마지막 문장 → "해소 2: Hosting job 삭제(Wave 20), Hosting 마지막 릴리스 2026-07-15 `ec5cb6`"), 주석 4곳(`TokenQuotaManager.ts:240`·`firestore.rules:59,195`·`token-quota-firestore-contract.test.js:254`) | `deploy.yml`이 도입 이래 **처음으로 초록**이 될 수 있다(성공 기준). 문서가 다시 사실이 된다. 되돌리기를 테스트가 잡는다 | 워크플로 1 · `firebase.json` · 문서 3 · CLAUDE.md §8-8 · 주석 4 · 테스트 1 | `build` job까지 지우면 PR의 lint/build가 `ci.yml`에만 남는다(중복이지만 유지 — 소유자 지시). `deploy-rules`의 `environment:`를 지우면 environment 스코프 시크릿이 안 보인다. `firebase.json`에서 `emulators`까지 지우면 `test:rules`가 죽는다. **워크플로는 Linux 단위 테스트가 못 검증한다** — 머지 push의 run이 검증이다 | sonnet |
| **L3 한국어 하드코딩 AST 래칫** | `tests/debt-ratchet.test.js`에 **(f)** 추가: `typescript` compiler API(이미 devDependency — 의존 추가 금지)로 StringLiteral·NoSubstitutionTemplate·TemplateHead/Middle/Tail·**JsxText** 중 한글 포함 노드를 세고 디렉터리별 상한 고정 — `src/components` **1,319** · `src/hooks` **285** · `src/utils` **2,001** · `src/services` **32** · `src/platform` **0**. 기존 (d)의 정규식 카운터·기준선(systems 122 / reducers 26)은 **손대지 않는다**(방법을 바꾸면 재고정이지 하락이 아니다). 통합 후 L5가 재측정해 **낮춘다**(L1이 `commandParser` 14자리를 옮기므로 utils가 내려간다) | 3,802가 **늘지 못한다**. 특히 JSX 텍스트 549가 처음으로 계약 안에 들어온다 — §7의 부재·상한 가드 범주 | 테스트 1파일(+1 import) | 정규식으로 쓰면 JSX 텍스트가 0으로 세어져 §5의 본문이 빠진다(실측 4). 기준선을 "여유 있게" 올려 잡으면 래칫이 아니다 — 실측값 그대로. `useGameTestApi.ts`(236)를 제외하면 hooks 상한이 49가 되지만 그 파일이 늘어나도 못 잡는다 — **포함**한다 | sonnet |
| **L4 K3 마무리 기록 (소유자 측)** | (a) macOS: `npm run ios:sync` → 델타가 `Package.swift` **+2줄, 1파일**인지 확인(실측 3) → 커밋 `chore(W19 K3): iOS SPM — CapacitorApp`. (b) Android 실기: `docs/PLAYTEST_CHECKLIST.md §11`에 "뒤로가기 루틴(Android)" 추가 — 표 8행: idle(→ 앱 종료 확인 대화 없이 종료 = `close-app`/`exitApp`) · shop/quest_board/job_change/crafting(→ 패널 닫힘) · event(→ dismiss) · PostCombatCard 열림(→ 카드 닫힘) · PremiumShop/Mirror 열림(→ 닫힘) · 전투 중(→ 앱 종료 — **도주 판정이 아님**, 오늘 설계) — 각 행에 P0/P1/P2와 관측 결과. 결과는 §24.1 + `tasks/todo.md` | 단위 테스트가 못 보는 층(실제 `backButton` 이벤트 도달)을 **기록**으로 닫는다 | 소유자 시간 | 완료로 적지 말 것 — Wave 19가 §22의 실수를 반복하지 않은 이유다. `Package.swift` 외 파일이 움직이면(`pbxproj`) 커밋하지 말고 보고 | 직접 |
| **L5 증빙·문서·정리 (통합자)** | 통합 트리에서 직렬 게이트 → `progression:diagnostic:write` **맨 마지막** → 15종 verify → `perf:guard` → L3 기준선 재측정·하향 → CLAUDE.md §2(`gameState`는 `GameMode`; `LoadDataPayload.gameState`는 `string`이고 `isGameMode`로 좁힌다) · §5 DON'T(“`GS` 멤버 추가 시 컴파일러가 `platformBack`/`commandParser`/`restorableMode`를 짚는다 — 단 `tests/**`는 `checkJs:false`라 여전히 grep”) · §6 AI 이벤트(TokenQuotaManager 상한 “세션당 ≤1”) · §7 테스트 목록(`game-mode-contract` · debt-ratchet (f)) · §8-6(술어 문장) · `tasks/todo.md` · §24.1 | — | — | `.claude/worktrees/` **20개** 잔존 워크트리(`git worktree list`)를 새 트랙 생성 **전에** `git worktree remove --force`로 정리하지 않으면 grep이 사본을 세고 디스크가 찬다(이번 실측의 Q2 grep이 실제로 잡혔다) | 직접 |

**계약 테스트와 결함 주입** — 주입마다 "어느 단언이 왜 red인가"를 코드가 실제로 바꾸는 값으로 적었다(§23.1 #3: `SET_GAME_STATE`가 `enemy`를 안 건드려 `enemy` 단언이 공허했던 일).

| 테스트 | 고정하는 것 | 주입 → 걸려야 하는 것 (red가 되는 단언과 이유) |
|---|---|---|
| `tests/game-mode-contract.test.js` (신규, L1) ① | `isGameMode`: `Object.values(GS)` 11종 → true; `'IDLE'`·`'intro'`·`'formation'`·`''` → false | 술어를 `=> true`로 → false 4행 red. 공허하지 않은 이유: 오늘 술어가 없으므로 RED가 먼저 확인된다(신규 함수라 "구현 전 red"가 곧 판별) |
| `tests/restorable-mode-contract.test.js` (행 추가, L1) ② | `restore({gameState: 'formation'})` → `gameState === GS.IDLE`; `restore({gameState: 'formation', enemy: ENEMY})` → `IDLE`(동반 상태가 있어도 미지 모드는 접는다) | `requestedMode`를 raw로 되돌림 → **`gameState` 단언이 `'formation'`으로 red**. 오늘 핸들러(`:62-69`)는 else에서 `true`를 돌려 raw를 그대로 넣는다 — 실측(1-h)으로 확인했으니 `enemy`가 아니라 `gameState`가 판별자다 |
| `tests/game-mode-contract.test.js` ③ | `resolvePlatformBackAction({gameState})` 11모드 표(오버레이 플래그 전부 false): event·event_pending→`dismiss-event`, shop·job_change·quest_board·crafting→`close-focus-panel`, idle·combat·moving·dead·ascension·true_ending→`close-app` | `MODE_BACK_ACTION.event_pending`을 `close-app`으로 → 그 1행 red(K1의 결함 모양). **컴파일 주입**: `GS`에 `FOO: 'foo'` 추가 → `platformBack` TS2741 · `commandParser` TS2741 · `restorableMode` `never` 대입 에러 — 트랙이 `tsc`로 한 번 보여 주고 되돌린다 |
| `tests/game-mode-contract.test.js` ④ | `parseCommand('explore', mode, player, spy)`: 문자열 엔트리 모드(event·event_pending·shop·job_change·quest_board·crafting·ascension·dead)는 그 `MSG.CMD_BLOCKED_*`를 반환하고 `explore` **미호출**; `null` 엔트리(idle·combat·moving·true_ending)는 파서가 막지 않고 `explore` 호출 | `shop: null`로 → shop 행에서 `explore`가 호출돼 red(호출 카운터 — §23.1 K3의 "throw가 아니라 카운터" 교훈). 기존 `command-surface-contract.test.js`는 `setGameState` 누수만 보므로 겹치지 않는다 |
| `tests/game-mode-contract.test.js` ⑤ 부재 불변식(§7 허용 범주) | `src/**`에서 `gameState\??:\s*string` 식별자 매칭 = 허용 목록 3파일(`actionTypes.ts` LoadDataPayload · `dataMigration.ts` MigratedSave · `useProductTelemetry.ts` 와이어)에서만 | `platformBack.ts:15`를 `string`으로 되돌림 → red. 컴파일러가 못 잡는 회귀 종류(새 `string` prop을 만들고 거기서 오타 비교)를 막는다 |
| `tests/cf-functions.test.js` (확장, L2) | `deploy.yml` ∌ `FirebaseExtended/action-hosting-deploy`, `firebase.json` ∌ `hosting` 키(JSON 파싱 후 `'hosting' in json === false`) | hosting job 한 개 되살림 → 첫 단언 red; `firebase.json`에 `hosting` 복원 → 둘째 red. 텍스트 매칭이 계약인 특수 케이스(워크플로) — 액션 **식별자**를 매칭하므로 포맷 무관 |
| `tests/debt-ratchet.test.js` (f) (L3) | 5 디렉터리 AST 상한 | 컴포넌트 하나에 `<span>한국어</span>` 추가 → components 1,320 > 1,319 red. **정규식 (d) 방식이었으면 이 주입은 초록**이다 — 트랙이 두 방식 모두로 돌려 그 차이를 §24.1에 적는다 |

**증빙 델타 (먼저 적는다)** — 모델 입력(`data/*`·`progressionSimulator`·`progressionDiagnostic`·`explorationPacing`·`exploreFlow`·`_shared`)은 **한 파일도 안 건드린다**. 의존 추가 0(`typescript`는 이미 있다).

| 증빙 | 예고 |
|---|---|
| `progression-diagnostic-v2` | **움직인다** — `sources` **346 유지**(332 src + 9 tests + 5 고정), 편집 경로의 sha256만: L1의 src 21 + `messages.ts` + L2의 `TokenQuotaManager.ts`(주석) = **23 엔트리**. L1의 테스트 3파일·L3의 `debt-ratchet`·L2의 `cf-functions`는 manifest 밖(9개 tests 엔트리는 loot/progression 계열뿐). `package.json`/`package-lock.json` **불변** — 움직이면 누군가 의존을 추가한 것. `reportHash f21dcf81…`·`v1Baseline 2573fa0f…` 불변 |
| `relic-dot-multiplier` | **바이트 동일이어야 한다** — `combatHandlers.ts`·`dataMigration.ts` 미편집(1-f가 증명: 편집 없이 컴파일된다). 움직였으면 L1이 금지 파일을 건드린 것 |
| `relic-event-chance` | **바이트 동일** — `exploreActions.ts`·`eventActions.ts`·`CombatEngine.loot/outcome`·`progressionProfiles` 미편집 |
| `equipment-combat-power`·`relic-gold-multiplier`·`relic-hp-drain-atk`·`relic-drop-rate`·`content-reachability`·`event-reward-coherence`·`exploration-rhythm 0818fb7a…` | 바이트 동일 |
| 모델 핀 3종 `ac79428c…`(progression-simulator test) · `2573fa0f…` · `0818fb7a…` | **불변** — L1이 만지는 `endgameSettlement.ts`는 타입 주석 1줄이고 리포트 값은 안 바뀐다. `tests/progression-simulator.test.js`가 증명한다 |
| `perf:guard` | 타입은 지워지고 MSG 14자리가 `commandParser`(index)에서 `messages.ts`(game-data 청크)로 옮겨간다 — 청크 간 수백 바이트 이동. FCP 504ms/2,200ms — 재측정만 |

**재생성 순서**: L1 ∥ L2 ∥ L3 통합 → `type-check · lint · unit · build:guard`(직렬) → `progression:diagnostic:write` **맨 마지막, 병행 명령 금지**(§15.1) → 15종 verify → `perf:guard` → L3 기준선 재측정·하향(L5) → CLAUDE.md/§24.1 → PR → CI → merge → **머지 push의 `deploy.yml` run 확인**(초록이어야 한다 — L2의 유일한 실전 검증).

**순서·병렬성**: **L1 ∥ L2 ∥ L3** — 파일 교차 **0**. `messages.ts`는 L1만(끝 블록 `// Wave 20 L1`), `TokenQuotaManager.ts`는 L2만(주석), `tests/debt-ratchet.test.js`는 L3만, `CLAUDE.md`는 L2가 §8-8만 만지고 나머지 절은 L5가 통합 뒤 직렬로. L1은 내부 직렬(위). L4는 저장소 밖(소유자)이고 어느 트랙과도 독립.

**트랙 프롬프트에 반드시 넣을 것**(§23.1 운영 발견): ① 계획 파일 경로 `/tmp/claude-0/-home-user-aetheria-roguelike/a8415c1b-4925-539c-8646-13225e01f454/scratchpad/wave20-plan.md` — 워크트리는 `origin/main`에서 갈라지므로 §24 커밋이 체크아웃에 **없다** ② 워크트리에는 `node_modules`가 없어 `tests/equipment-economy-audit.test.js`의 심링크 케이스가 `ERR_MODULE_NOT_FOUND`로, `build:guard`가 `vite` ENOENT로 죽는다 — **예상된 실패**, 통합자가 통합 트리에서 다시 돌린다 ③ 각 트랙의 편집 금지 목록(1-k) ④ 주입 테스트는 코드 수정 **전에** red를 먼저 찍고 기록할 것(§22 공허참).

**판단 포인트** — L1의 설계 선택지 넷을 실행 결과(1-e~1-i)로 비교했다. 골랐다: **B**.

| 선택지 | 얻는 것 | 비용 | 이 코드베이스에서 깨지는 것 |
|---|---|---|---|
| A. `GameState.gameState`만 좁힌다(V1) | 원천 1줄 | 진단 5(1-e) | 그 5개를 없애는 가장 짧은 길이 `as GameMode` 캐스트라 §2 위반이고, payload가 `string`인 채로 남아 잘못된 dispatch(1-i의 TS2345)를 못 잡는다 — 닫힌 척하는 타입 |
| **B. 원천 + `SET_GAME_STATE` payload + 시그니처 전부 + `LOAD_DATA` 술어 + 전수 표 3곳**(채택) | 1-i의 4/4, K1 표 3곳의 자동 red | src 21파일 | 1-k 금지 파일을 안 건드려야 한다 — 그래서 목록을 트랙 프롬프트에 넣는다 |
| C. B + `LoadDataPayload`/`MigratedSave`의 `gameState`도 `GameMode` | 술어 없이 "깨끗" | 선언 2줄 | `JSON.parse` 결과에 유니온을 선언하는 것은 `as`와 같다 — 구세이브·손상 세이브의 `'formation'`이 `GameMode`로 흘러 `restorableMode`의 `never`가 **런타임에** 거짓이 된다. §2 "경계는 `unknown` + 좁히기"의 정확한 반례 |
| D. `enum`/브랜드 타입 | 명목 타입 | `GS` 소비 전면 교체 | `GS`는 `as const` 동결 객체이고 `BALANCE`/`AT`와 같은 리터럴 도출 패턴(§2)이다. 세이브 봉투에 값이 그대로 들어가므로 런타임 모양을 바꿀 이유가 0 |

둘째, **L2는 소유자 결정을 실행하는 트랙이지 결정하는 트랙이 아니다** — (b)/(c)는 착수 중 소유자가 닫았다. 셋째, **L3는 정규식이 아니라 AST**여야 한다 — 실측 4의 549가 이유이고 그 하나로 충분하다.

**하지 않기로 한 것**
1. **`useFirebaseSync`의 combat 폴드 5중복 제거** — 실측 4: 커버리지 0, 게임에서 구별 불가, 얻는 것 5줄. §23 #5의 "관찰로만"을 **종결**로 바꾼다(다시 후보에 올리지 말 것).
2. **`TokenQuotaManager` 재시도(A)·디스패치 거부(B)** — 위 판단표. 잔여 상한 "세션당 ≤1 미계량 디스패치"를 §6에 숫자로 적는다.
3. **한국어 전수 스윕** — 3,802 중 대부분이 표현 테이블·데이터 키. 래칫만.
4. **`tests/**`의 `'IDLE'`·`'intro'` 5곳 정리** — 행동 무관 픽스처(1-d). 고치면 좋지만 이 wave의 어떤 계약도 안 바뀐다 — 이월.
5. **`ControlPanel`의 렌더 if-체인 전수화** — 700줄 컴포넌트를 `switch`로 바꾸는 리팩터. K1의 `=== EVENT_PENDING` 분기는 이미 명시적이고, 렌더 조건은 `never`로 닫히지 않는다.
6. **`LoadDataPayload`·`MigratedSave`·`ProductTelemetrySnapshot`의 `gameState` 좁히기** — 선택지 C / 1-j.
7. **모델 파일·`exploreActions`·`combatHandlers`·`dataMigration`·`useFirebaseSync`의 `'combat'` 리터럴을 `GS.COMBAT`로 바꾸기** — §5 DO에는 맞지만 바이트 핀 3종이 움직이고 컴파일러는 이미 통과한다(1-c). 의미 없는 핀 이동.
8. **`deploy.yml`의 `build` job 삭제 / `ci.yml`과의 중복 해소** — 소유자 지시로 유지.
9. **Firebase Hosting 사이트 자체 비활성화** — CLI/콘솔 작업(저장소 밖) — 아래 Q4.
10. **`tier`/아트 identity** — §19 그대로. **퀘스트 104 `beyond-anchors` · class-(b) 가드 1,807건** — 이월.

**소유자에게 넘기는 질문 (저장소가 답할 수 없는 것)**

| 질문 | 선택지 | 비용 |
|---|---|---|
| ~~Q2~~ | **해소 — (a)**. L2가 실행한다 | — |
| Q4. Hosting **사이트**는 2026-07-15 빌드를 계속 서빙한다 — job을 지워도 `aetheria-rpg-90a2f.web.app`은 살아 있다 | (a) `firebase hosting:disable --project <prod>`(콘솔 "사이트 사용 중지"와 같다) (b) 방치 | (a) 명령 1회 — 낡은 클라이언트가 현재 Firestore 프로젝트에 계속 쓰는 경로가 닫힌다(새 rules는 구 클라이언트를 **받아 주므로** 지금은 열려 있다) (b) URL을 아는 누구나 7월 빌드로 같은 계정 데이터에 쓴다 — `migrateData`가 앞으로는 올리지만 7월 빌드가 9월 세이브를 읽는 방향은 보장이 없다 |
| Q5. L4 (a) iOS `ios:sync` 델타 커밋 · (b) Android 뒤로가기 실기 표 | 실측 3의 2줄/8행 | 소유자 시간. 델타가 1파일이 아니면 커밋 전에 보고 |
| Q3. `tier` provenance 재핀 | §19 그대로 | 변동 없음 |

**게이트 베이스라인** (착수 시, head `a8589b22` = `49defbc9` + 문서 1): `tsc --noEmit` 0(exit 0) · unit **5,157 / 5,157**(350파일, skip 0, 직렬 410.5s) · e2e 121 · 15종 verify ok(§23.1). **이 wave의 성공 기준**: 모델 핀 3종 불변 + `relic-dot-multiplier`·`relic-event-chance` 바이트 동일(= L1이 금지 파일을 안 건드렸다는 증명) + 주입 전부 red→green(컴파일 주입 3종 포함, 되돌린 뒤 `tsc` 0) + L3의 "정규식이면 초록, AST면 red" 대조 기록 + **머지 push의 `deploy.yml` run이 도입 이래 처음으로 초록**.

---

**통합자 조정 2건(착수 시)**: ① L2의 `firebase.json`은 `hosting` 키**만** 삭제 — `firestore`·`emulators`는 `test:rules`·`firestore-rules-semantics.test.js:662`가 읽는다. ② L3의 AST 래칫 (f)는 계획의 5개 디렉터리가 아니라 `src/data` 밖 **모든** 최상위 디렉터리(`systems`·`reducers`·`types` 포함)를 센다 — 기존 정규식 (d)와 이중 가드가 되며 기준선은 실측값 그대로.

### 24.1 Wave 20 실행 결과 (2026-09-21)

**커밋**: `3d437013` §24 계획 · `fad18cb5` L3 · `194252b0` L2 · `3d297e20` §6/§7 문서 · `1d0c0613` L1 · `55cfc192` 래칫 하향 · `c28d7b52` 증빙. 트랙 3개 worktree 병렬(L1 opus / L2·L3 sonnet), 파일 교차 0 — 충돌은 CLAUDE.md §8-8 하나였고 그건 L2의 worktree 베이스(`origin/main` = `49defbc9`)에 제가 그 뒤 붙인 "해소" 단락(`a8589b22`)이 없어서였다(두 단락 다 살림).

**예고 델타 적중**: 이동은 `progression-diagnostic-v2` 하나, 바뀐 키 `sources`뿐, 346 → 346, 이동 **22 = L1 src 21 + L2 `TokenQuotaManager.ts`(주석)**. `package.json`/락파일·`reportHash`·`v1Baseline` 불변, `content d2d37207…`·`exploration-rhythm 0818fb7a…` 불변, `relic-dot-multiplier`·`relic-event-chance` 바이트 동일 — L1이 `combatHandlers`/`dataMigration`/`exploreActions`를 한 바이트도 안 건드렸다는 증명(계획 1-f/1-k가 in-memory `tsc`로 예측한 그대로).

**계획이 실측과 갈린 곳 — 셋, 전부 트랙이 잡았다**

| # | §24의 기술 | 실측 | 결론 |
|---|---|---|---|
| 1 | 계약 테스트 ①·③ "11종/11모드" | `Object.values(GS).length === 12`(계획 표의 나열 자체가 2+4+6=12) | 계수 착오. 테스트가 `Object.keys(EXPECTED).sort() === [...GS].sort()`로 전수성을 스스로 단언한다 |
| 2 | "`commandParser`의 14자리를 단언하는 테스트 grep 0" | `tests/command-surface-contract.test.js:183`이 status 응답의 `[상태]` 접두사를 읽는다 | `MSG.CMD_STATUS`가 접두사를 유지, `messages.ts`에 "바꾸지 말 것" 주석 |
| 3 | `MSG.CMD_STATUS`/`CMD_MAP`를 함수로 | 원본 템플릿이 `Player`의 선택 필드를 그대로 보간 → 함수 인자에 `\| undefined` 필요(`COMBAT_ENEMY_HIT` 관례) | 출력 바이트 동일 유지(`undefined`가 찍히던 경우 포함) |

L3의 실측은 계획과 **정확히 일치**(8 디렉터리 합 3,802; `assets`·`pwa` 0도 상한 추가). L2는 이탈 0(`deploy-dev`/`deploy-prod`/`action-hosting-deploy`의 저장소 내 소비자 0 확인).

**주입 판별 — 이번 wave의 핵심 증거 둘**
- **컴파일 주입**(L1): `GS`에 `FOO: 'foo'` → `platformBack.ts` TS2741 · `commandParser.ts` TS2741 · `bootstrapHandlers.ts` TS2322(`never`) **셋 전부**; `=== 'evnt'` → TS2367; `payload: 'formation'` → TS2345. 되돌린 뒤 `tsc` 0. K1이 손으로 채우던 표 3곳이 컴파일러 의무가 됐다.
- **방법 대조**(L3): 같은 `<span>한국어</span>` 주입에 (f) AST는 `1320 > 1319` red, (d) 정규식은 **725 그대로** — JSX 텍스트 549개가 정규식에 보이지 않는다는 실증. `utils` 기준선은 L1이 14자리(22노드)를 옮겨 **2,001 → 1,979로 하향** 고정.

**행동 변화는 정확히 하나**: 미지의 `gameState` 문자열이 든 세이브(구 `'formation'` 등)가 `idle`로 접힌다 — 그 전에는 그대로 복원돼 어느 렌더 트리도 못 그렸다(`restorable-mode-contract` ②가 고정, 주입 시 판별자는 `enemy`가 아니라 `gameState` — §23.1 #3의 교훈 적용).

**운영**: Plan 에이전트는 read-only라 계획 파일을 못 쓴다 — transcript JSONL에서 `## 24.` 블록을 스크립트로 추출해 파일로 만들었다(41.6KB, 재타이핑 0). 잔존 worktree 19개를 트랙 생성 **전에** 제거(계획이 grep 오염을 실측). 각 트랙 프롬프트에 계획 경로·금지 파일·worktree `node_modules` 부재를 직접 넣어 Wave 19의 §23 누락을 반복하지 않았다.

**소유자 항목**: Q1 해소(§23.1) · Q2 (a) 실행 완료 · **Q4 열림** — Hosting 사이트는 job을 지워도 2026-07-15 `ec5cb6` 빌드를 기본 도메인 2개로 계속 서빙한다. 옛 클라이언트가 같은 Firestore에 쓰는 경로를 닫으려면 `npx firebase hosting:disable --project aetheria-rpg-90a2f`(무료, 되돌리기는 재배포 1회) · Q5 K3 마무리 — macOS `npm run ios:sync`(예상 델타 `Package.swift` +2줄 1파일; `pbxproj`가 움직이면 커밋 말고 보고) + Android 실기 뒤로가기 8행 표(`docs/PLAYTEST_CHECKLIST.md §11`).

**Wave 21 후보**
1. `tests/**`의 `GS` 밖 리터럴 5곳(`'IDLE'` 3 · `'intro'` 2) 정리 — 행동 무관 픽스처, 이월.
2. 퀘스트 104 `beyond-anchors` · class-(b) 소스 정규식 가드 1,807건 — 이월(§19).
3. **머지 push의 `deploy.yml` run이 도입 이래 처음 초록인지** — L2의 유일한 실전 검증. 빨가면 그게 Wave 21의 첫 실측.
4. 종결 항목(다시 올리지 말 것): `useFirebaseSync` combat 폴드 5중복(커버리지 0·게임에서 구별 불가) · `TokenQuotaManager` 재시도/거부(§24 판단표) · `ControlPanel` 렌더 if-체인 전수화 · `tier`/아트 identity(§19).


**게이트** (head `4c23161e` 코드 동일, 직렬 실행 09:53~10:12): type-check 0 · lint 0 · unit **5,168 / 5,168**(351파일, skip 0, Wave 19 대비 +11 = L1 10 + L3 1) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **121 / 121**(61 + 60) · perf desktop FCP 596ms / mobile FCP 484ms · tracked 증빙 verify 15종 ok.

**L2 실전 검증 (2026-09-21 10:38 UTC, run 353 = PR #47 머지 push)**: `deploy.yml` 전체 **conclusion: success** — `build`(lint+build 50s) · `deploy-rules`(`Deploy firestore.rules` 22s) 둘 다 초록. 도입 이래(관측 가능한 run 259 이후 40건+ 연속 failure) **첫 초록 run**. Wave 21 후보 3은 이것으로 닫힌다.

**L4 정적 검증 (2026-09-21, Android 실기기 부재)**: 소유자에게 Android 기기가 없어 실기 뒤로가기 검증은 **에뮬레이터**(Android Studio AVD + `adb shell input keyevent KEYCODE_BACK` — 하드웨어 back은 KeyEvent라 기기와 동일 경로)로 대체하거나 미검증으로 남긴다. 기기 없이 확인한 층 4단: ① `runtimeEnvironment.ts:39` `Capacitor.isNativePlatform()` → `'capacitor'` ② `App.tsx:111` `bindLifecycleBridge({environment: getRuntimeEnvironment()})` ③ `@capacitor/app` `AppPlugin.java:46-62` — 코어가 아니라 **플러그인이** AndroidX `OnBackPressedCallback`을 dispatcher에 등록한다(§23 K3의 "코어에 back 처리 0건"의 답). JS 리스너가 있으면 `backButton` 이벤트 + `document` `backbutton`, 없으면 `webView.goBack()` 또는 무동작(**종료가 아니다**); `exitApp` → `activity.finish()` ④ gradle 2파일 등록. **미검증으로 남는 것**: 빌드된 APK의 `capacitor.plugins.json`에 `AppPlugin`이 실제로 들어 있는지(= 빌드 절차), 첫 back 전에 `App.addListener`가 resolve하는지(동적 import + 비동기 등록 — 수십 ms). **운영 함정**: `scripts/android-gradle.sh`는 `gradlew`만 돌리고 `cap sync`를 하지 않는다 — `capacitor.plugins.json`은 gitignore된 생성물이라 sync 없이 빌드하면 플러그인이 컴파일만 되고 등록되지 않아 뒤로가기가 **조용히 앱 종료로 되돌아간다**. CLAUDE.md §4에 순서(`android:sync` → `android:debug`)를 박았다. 실기/에뮬레이터 결과가 오기 전까지 K3는 "정적 검증 완료 · 런타임 미검증"이다.


**L4 런타임 검증 (Codex, 2026-09-22)**

`android:sync` → `android:debug` 후 APK AppPlugin 등록 및 Android 16/API 36의 native back을 확인했다. production APK SHA-256 `36c15e4cc250aa345c150e356eceb05e6f91f336eaf934d866c11514c0789649`, 신규 여정 QA `947484e4713a8099b664840c03cecfcca2c2ac0c26ddb005d1a1ddb41ecb4b66`, 재료 QA `07910aa6333d0607ac39593290879a1982f516ce080eb81017b4817bdc6928e0`.

| # | 상태 | 진입 | 뒤로가기 기대 | 근거 | 관측 결과 (2026-09-22) |
|---|---|---|---|---|---|
| 1 | idle(시작의 마을) | 자연 플레이 후 마을 | 앱 종료, 확인 대화 없음 | `MODE_BACK_ACTION.idle = close-app` → `App.exitApp()` | 일치. Launcher로 이동, 재실행 시 캐릭터·골드·수령 원장 복원 |
| 2 | shop | 상점 버튼 | 상점 닫힘, idle | `close-focus-panel` | 일치. shop → idle, 앱 유지 |
| 3 | quest_board / job_change / crafting | 각 패널 버튼 | 패널 닫힘, idle | `close-focus-panel` | 세 패널 모두 일치. 각각 → idle |
| 4 | event(카드 열림) | 자연 탐험 → 마법의 흔적 | 카드 dismiss, idle | `dismiss-event` | 일치. event → idle, 앱 유지 |
| 5 | PostCombatCard 열림 | 자연 첫 전투 승리 | 카드 닫힘, 앱 유지 | `usePlatformBackHandler` 소비 | 일치. 결과 카드 닫힘, idle 유지 |
| 6 | PremiumShop / MirrorPanel 열림 | 설정의 각 버튼 | 오버레이 닫힘 | `close-premium` / `close-mirror` | 두 오버레이 모두 일치. 설정 화면·앱 유지 |
| 7 | combat(카드 없음) | 자연 탐험 → 숲의 정령 | 앱 종료, 도주 아님 | `combat = close-app` | 일치. Launcher로 이동. 재실행 시 동일 적 생명 96·전투 상태 복원 |
| 8 | ReturnBriefingCard / TrueEndingScreen | 기존 test API fixture로 진입 | back 소비, 앱 유지 | 각 컴포넌트 `usePlatformBackHandler` 등록 | 둘 다 일치. 복귀 카드 닫힘; 진엔딩 화면과 true_ending 상태 유지 |

iOS `ios:sync` 결과는 `Package.swift`의 CapacitorApp dependency/product 순증2줄(+4/-2), `project.pbxproj`·`Package.resolved` 변경 없음. unsigned device 및 simulator build는 성공했다. iOS 26.5 QA bundle 부팅·60초 이상 생존, 수집 로그에 플러그인 오류 일치 항목 0. 같은 빌드는 iOS 27.0에서 `UIScene life cycle is required for apps built with this SDK` + SIGTRAP으로 종료(**P0**). UIKit/XPC/WebP 진단은 플러그인 오류와 구분했으며 WebP 자산 경로는 미확인이다.

신규 여정에서 귀환/설정 영문 표기 **P1 1건**, 첫 전투7턴·조사 `이(가)` **P2 2건**을 기록했다. 재료 취소 무소비, 강화150/제작100/합성600골드 소비와 재실행 복원, 운영 세이브3키 해시 불변. 5분/2분 인간 시간 수용·기력 부족·자연 드롭 spotlight·물리 기기는 미검증. `src/**`와 바이트 핀은 그대로다. 상세는 PLAYTEST_CHECKLIST §11 Android 및 [증빙 JSON](evidence/qa/wave22-device-qa-20260922.json). K3 Android 런타임은 통과했고, iOS 27 부팅 P0는 다음 수정 입력이며 릴리스는 No-Go다.


## 25. Wave 21 계획 (2026-09-21 착수, 베이스 `main` = `8be7eacd` = PR #47 merge commit)

**핵심**: 첫 감사의 축(타입·계약·상태 기계·복원·배포)은 §24.1이 적은 대로 소진됐다 — 후보 3은 run 353 초록으로 닫혔고 후보 1은 `fac8f5eb`로 끝났다. 그래서 이번에는 **다섯 축을 전부 실행으로 다시 쟀다**(리듀서 드라이버 · `onRequestPost` 직접 호출 · 프로덕션 빌드 산출물 grep · 유닛 5,168 재실행 · 증빙 JSON 파싱). 결과는 **wave급 결함 2건 + 문서/죽은 코드 정리 1건**이고, 나머지 축은 "없다"가 측정으로 증명된다. (1) **AI 프록시는 플레이어 문자열을 상한 없이 Gemini 프롬프트에 넣는다** — 1MB `name` 하나가 1,000,739자 프롬프트로 **200 OK**, `relics`+`buildProfile`은 프롬프트에 **두 번** 보간돼 2MB 본문이 4,001,518자가 된다(실행 실측). 익명 인증 토큰은 방문자 누구나 받으므로 이건 "인증된 남용"이고, 서버의 유일한 한도 40req/60s는 건당 크기를 안 본다. (2) **`ASCEND`는 묘비를 버린다** — `{...INITIAL_STATE}`에 `grave: state.grave`가 없다. 같은 리셋인 `RESET_GAME`(사망)은 보존한다. 실행으로 확인: 승천 전 `[{고요한 숲, 5000G}]` → 승천 후 `null`, 반면 `RESET_GAME`은 그대로. 공개 침공 문서는 rules `delete: false`라 남으므로 "남들은 내 묘비를 털 수 있는데 나는 회수할 수 없다"가 된다. (3) `functions/api/feedback-validate.js`(187줄, 테스트 6건)는 **클라이언트 참조 0건**인데 문서 세 곳이 "클라이언트가 호출한다"고 적고 있다 — `SystemTab.tsx:371`은 `addDoc`으로 Firestore에 직접 쓴다.

첫 감사가 안 본 축 중 **텔레메트리는 파이프가 통째로 NOOP**이다(제품 이벤트 18종 전부 `NOOP_PRODUCT_EVENT_SINK`로, 구현체 0개). 이건 결함이 아니라 계획서 §… E1이 "외부 sink 없음"으로 적은 설계이고, 백엔드·프라이버시 결정이라 **소유자 질문**으로 넘긴다(Q6). 성능 예산은 실측의 1~27%라 회귀 검출기가 아니라 **벽돌 검출기**이고, 유지가 답이다.

### 실측 A — 플레이어 흐름 (리듀서·액션 팩토리 직접 구동, `scratchpad/flow-driver2.mjs`·`flow-driver3.mjs`)

| # | 구동 | 실측 | 판정 |
|---|---|---|---|
| A-1 | `start('용사','male','모험가',[])` → `ACCEPT_QUEST 1` → `openShop()` → `market('buy', 하급 체력 물약)` | Lv1 골드 200, 가장 싼 소모품 30G(`하급 체력 물약`) · 장비 30G(`짚 모자`) — 구매 성공(200→170, inv 3). 퀘스트 보드 Lv1 가용 = `1`·`110`·`80`(스토리) | 첫 상점 막힘 없음 |
| A-2 | `move('고요한 숲')` | 첫 방문 보상 +100G/+25EXP 지급, `lost_wizard` 체인 스텝이 첫 탐험에 뜨고 `handleEventChoice(0)`로 `{lost_wizard:1}` 진행 | 지급됨 |
| A-3 | 공격만·휴식/물약 없이 연속 탐험(rng 0.99 최악 / 0.5 중앙값) | 두 경우 모두 **4~5번째 전투에서 사망**(kills 3~4, Lv1 유지) | 벽돌 아님 — `rest`(`characterActions.ts:197`)·시작 물약 2개가 있고 `progression-diagnostic-v2`의 `attack-only` 코호트도 defeats를 기록한다(Lv44 cohort defeats 7). 모델 앵커 Lv2 = 14액션은 휴식 정책 포함 |
| A-4 | 사망 → `RESET_GAME` → `start()` → `move` → `lootGrave()` | 사망 전이에서 골드 200·이름 `''`·`runSummary` 생성·묘비 `[{고요한 숲, 171G, 물약+젤리}]`; `RESET_GAME` 묘비 보존; 재시작 시 `deaths=2`·시작 유물 선택(`pendingRelics`) 제시; 회수 **+171G + 아이템 2** | 지급됨 (§22 정정 그대로) |
| A-5 | `ASCEND`(ASCENSION 상태, 묘비 있음) vs `RESET_GAME` | **`ASCEND` → `grave: null`**, `RESET_GAME` → 보존 (`progressionHandlers.ts:91-127` vs `:30-48`) | **결함 → M2** |
| A-6 | 퀘스트 원장 | `claimedQuestIds`는 영구(`permanentProgress.ts:122`); `ACCEPT_QUEST`는 `QUEST_ALREADY_COMPLETED`(`questHandlers.ts:74-79`); 보드는 숨김(`questOperations.ts:426-435`). 승천 뒤 2회차는 **카탈로그 퀘스트 재수행 불가**(현상수배만) | 설계이지 결함 아님 — 의도 확인은 Q8 |
| A-7 | 시즌 claim → 회전 · 승천 이월 | `season-journey-design.test.js`·`permanent-progress-copy.test.js`가 고정, 오늘 5,168 그린. 회전은 `isPremium`을 `...(season\|\|{})`로 이월(`seasonPassPresentation.ts:211`) | 이미 핀됨 |
| A-8 | `content-reachability.json` | `errors []`·`unresolvedEventChainCompletions []`·`quests.unreachableTargets []`. `beyond-anchors` 행은 **정확히 하나**: 퀘스트 104(`minLv 79`, `cost.gates.quests[39]`·`behind[43]`), 최상 앵커 75 = 204.4h. 누적 EXP 60→75 기울기로 외삽하면 Lv79 ≈ **223.9h**(정책상 금지 — 참고값). 체크포인트 80 추가는 모델 핀 3종 + 1000시드 진단을 움직인다 | 라벨이 맞다 — **트랙 아님** |

### 실측 B — 관측성·실패 표면

| 항목 | 실측 | 판정 |
|---|---|---|
| 제품 텔레메트리 목적지 | `getRuntimeProductEventCoordinator()`는 `useProductTelemetry.ts:187`·`FatalErrorBoundary.tsx:59` 두 곳 다 **sink 인자 없이** 호출 → 기본값 `NOOP_PRODUCT_EVENT_SINK`(`productEventCoordinator.ts:36`, `productEventSink.ts:13`). `ProductEventSink` 구현체는 platform 밖 **0개**. 18종 이벤트가 전부 버려진다. `scripts/productFunnel.mjs`는 `receivedAt`/`serverSequence`가 있는 서버 모양을 기대한다 — 그 서버는 없다 | 설계(E1 "외부 sink 없음") — **Q6** |
| 크래시 리포트 | `main.tsx:22` `installRuntimeErrorReporter(createLocalErrorReporter())` → localStorage 링버퍼 20건(`BALANCE.ERROR_REPORT_RING_SIZE`, `constants.ts:530`), `SystemTab`에서 열람/삭제. `sanitizeFilename`은 알려진 스크립트 파일명만 통과, 쿼리/해시 제거 | 커버됨 |
| AI 폴백 사유 7종 | UI 표면화 `quota` 하나(`exploreActions.ts:126`). `useProductTelemetry:128-132`의 `explore` outcome은 **상태에서 유도**되므로 사유가 실리지 않는다. Firestore 쿼터 문서엔 `adopted/unadopted` **건수만**. `LatencyTracker`는 `console.warn`뿐(`LatencyTracker.ts:7,18`) | 관측 불가가 맞다 — 목적지가 없으니 사유를 실을 곳도 없다(Q6 종속) |
| 429/5xx를 클라이언트가 보는 방식 | `callProxy`가 `!ok`에서 `null`(`aiService.ts:139-140`) → `resolveAiEventResponse(null)` = `proxy-unavailable`, `{success:false}` = `proxy-rejected`(실행 확인) → 큐레이션 폴백, 안내 없음, **쿼터 1건 소모**(디스패치=비용, `:101`) | 플레이어에게 벽돌 없음 — 트랙 아님 |
| 서버 오류 본문 | `ai-proxy.js:401` 500 응답에 `details: error.message`(Gemini 오류 원문 포함) | M1에 포함 |

### 실측 C — 보안 경계 (F3/G2 밖)

| 항목 | 실측 | 판정 |
|---|---|---|
| rules vs 클라이언트 쓰기 지점 | `setDoc/addDoc/updateDoc/writeBatch/runTransaction/deleteDoc` 호출 = `createCloudAutosave.ts:117,122` · `useFirebaseSync.ts:589` · `TokenQuotaManager.ts:252` · `SystemTab.tsx:310(관리자 live config — rules test site 5가 "거부가 정답"으로 고정)` · `SystemTab.tsx:371` = **6곳, F3와 동일**. Waves 15~20에 새 쓰기 지점 0 | 변동 없음 |
| rules가 믿는 다른 클라이언트 필드 | 리더보드 `totalKills ≤ 100,000`: kills ≤ 모델 액션 8,176(Lv75, 204.4h) → 상한은 지평의 ~12배 밖. `nickname ≤ 20`: 클라이언트 16. 묘비 6상한은 G2 | 절벽 없음 |
| **AI 프록시 입력 크기** (`scratchpad/proxy-abuse.mjs`, `onRequestPost` 직접 호출 + fetch 스텁) | 기준 프롬프트 741자. **`name` 1MB → 1,000,739자 · 200** / `location` 1MB → 1,000,735자 / `history` 1MB → 1,435자(`stringifyCompact` 700이 산다) / `relics` 100×10k + `buildProfile` 100×10k(본문 2,001,648B) → **4,001,518자**(`:159-160`과 `:183`에 각각 두 번 보간). `request.json()`(`:364`)에 크기 검사 없음, story 경로의 `data.context`(`:259`)도 무상한. 클라이언트는 `name` 16자(`IntroScreen.tsx:127`, `characterActions.ts:68`)·`buildProfile` 4개로 자르지만 프록시는 본문을 신뢰한다. 토큰은 익명 인증으로 누구나 받는다 | **결함 → M1** |
| 프롬프트 인젝션 | `history`/`name`/`location`이 프롬프트에 그대로 들어가지만 Structured Output + 클라이언트 `normalizeOutcomes` 화이트리스트로 효과가 자기 게임에 갇힌다 | 트랙 아님 |
| `feedback-validate.js` | `src/**`에 `feedback-validate` 참조 **0** — 피드백은 `addDoc` 직접(`SystemTab.tsx:371`), rules F3가 길이/모양 검증. 문서 3곳(`docs/DEPLOYMENT.md:5,40`·`docs/QUICK_DEPLOY.md:6`)이 "호출한다"고 적음. 함수는 배포되면 호출 가능한 표면이지만 사용자 토큰으로 rules 아래 쓴다(권한 상승 없음). 클라이언트 `FeedbackValidator`에 60s 쿨다운·길이 검사 있음 | 죽은 표면 → M1에 삭제 포함 |
| `useGameTestApi` tree-shaking | `npm run build`(12.0s, `VITE_ENABLE_TEST_API` 미설정) 뒤 `dist/assets/*.js`에서 build-guard의 식별자 15종(`__AETHERIA_TEST_API__`·`seed*Scenario`·`armNext*Seed`·`*-smoke`) **0건**, `useGameTestApi`/`AetheriaTestApi` 문자열 0건 | 주장 참 |

### 실측 D — 숫자 있는 잔여 부채

| 항목 | 실측 | 판정 |
|---|---|---|
| class-(b) 소스 정규식 가드 | 기준 1,807/3,190(§C4). 오늘 `readSrc(` 파일 69(+`game-mode-contract`, (a)), 호출 1,730(−15). 저장소에 분류기(acorn 스캐너)가 없어 재분류 불가 — 델타는 Wave 16 이관 −1 | 정책 유지("깨질 때 이관") — 트랙 아님 |
| `any` | 주석 제거 후 `: any` 1(=상한, 문자열 리터럴), `as any` 0. `actionTypes.ts`에 `any` 0 — **CLAUDE.md:34 "`GameAction.payload: any`만 경계로 남음"은 거짓**(`:47`이 스스로 반박). `actionDeps.ts:62` "(현재 any)"도 거짓(`GameState.currentEvent: GameEvent \| null`) | 문서 드리프트 → M3 |
| debt-ratchet 상한 | AST (f) 10 디렉터리 **전부 실측 = 상한**(slack 0). 정규식 (d) `systems` 실측 120 vs 상한 122 — **slack 2**, `reducers` 26 tight | (d) systems 122→120 하향 → M3 |
| e2e × `GameMode` 12 | 스펙 44 / 케이스 121. 키워드 도달: idle·combat 전부 · event 8 · quest_board 5 · job_change 4 · moving 4 · shop 2 · ascension 2 · dead 2 · crafting 1 · true_ending 1 · **event_pending 0** | pending은 e2e에서 구조적으로 관측 불가(mock 런타임에서도 promise 한 틱) — 유닛 계약 7주입이 덮는다. 트랙 아님 |
| CLAUDE.md 숫자 재검증 | 맵 52·직업 18·퀘스트 143·업적 73·유물 67·시너지 20·체인 13·GS **12**·`DATA_VERSION` 5.1·`DAILY_AI_LIMIT` 50·`MAX_LEVEL` 99·유닛 351/5,168·e2e 44 스펙·청크(KiB) game-data 479.5·index 464.8·vendor-react 188.0·firestore 178.8 — **전부 참** | 드리프트는 위 두 문장 + §3 트리에 `functions/api/` 부재 + 문서 3곳의 `feedback-validate` |

### 실측 E — 성능 실체

| 항목 | 실측 | 판정 |
|---|---|---|
| `perf:guard` 10예산 (`playtest-artifacts/perf-*/perf-summary.json`, 2026-09-21 10:11 UTC) | desktop: DCL 347/2000(17%) · FCP 596/2200(27%) · bootReady 113/2500(5%) · introVisible 113(5%) · introReady 466(19%) · startRun 276(11%) · firstInteraction 10/1400(1%) · marketOpen 37(3%). mobile: FCP 484/2500(19%), 나머지 1~16% | 예산은 4~100배 여유 — **벽돌 검출기**다. 하향은 "한 번도 없었던 회귀"의 검출과 러너 편차 빨강(FCP withheld 공백이 이미 문서화)을 맞바꾼다. 유지 |
| 번들 상위 | game-data 491kB · index 476kB · vendor-react 192kB · firestore 183kB · motion 126kB(vite kB). §8-10과 반올림 내 일치 | 드리프트 없음 |
| 유닛 벽시계 | 로컬 **310s**(4코어, 파일 병렬), CPU 합 627.8s. 단일 최대 **131.8s = `progression-diagnostic-cli.test.js`**(346소스 봉투 `--verify` = 1000시드 재생) = CPU의 21%; 아트 증빙 테스트 11~24s × 8; 파일당 tsx 부트 0.43~0.69s × 351. CI 410s는 느린 vCPU로 설명 | 지배 파일은 증빙 계약 자체(§19의 tripwire). 트랙 아님 |

| 트랙 | 내용 | 얻는 것 | 비용 | 실패 시나리오 | 모델 |
|---|---|---|---|---|---|
| **M1 AI 프록시 입력 상한 + 죽은 함수 삭제** | `functions/api/ai-proxy.js`: ① `onRequestPost`에서 `Content-Length`와 `text()` 길이로 본문 ≤ **16,384B**(초과 413, Gemini fetch 0) ② `buildGeminiPayload`에 `clampText`: `name` 32 · `job` 24 · `location` 40 · `difficultyLabel` 16 · `buildProfile` ≤4개×24자 · `relics` ≤8개×24자 · story `context` 300 · `storyType` 24 ③ `:401`의 `details: error.message` 삭제(안정 코드만). `functions/api/feedback-validate.js` 삭제 + `tests/cf-functions.test.js:172-280` 6건 삭제 + 새 테스트(아래 표) | 익명 토큰 하나로 건당 4M자 입력 토큰을 태우던 비용 남용이 닫힌다(40req/60s는 크기를 안 본다). 배포 표면 1개 감소 | 함수 1 + 삭제 1 + 테스트 1파일 | `history`/`mapSnapshot`의 `stringifyCompact`를 건드리면 정상 컨텍스트가 잘린다 — 새 상한은 **보간되는 원시 문자열에만**. 본문 상한을 4KB처럼 잡으면 정상 요청(요약 700 + 스냅샷 + 지도 300)이 413 — 실측 정상 본문은 ~2~3KB이므로 16KB. `x-forwarded-for` 폴백·레이트리밋 키는 손대지 않는다(isolate 한계는 문서화된 설계) | opus |
| **M2 `ASCEND` 묘비 보존** | `progressionHandlers.ts:117-123` 반환에 `grave: state.grave` 1줄(`RESET_GAME :33`과 대칭). `TRUE_ENDING` 경유 `ASCEND`도 같은 핸들러 | 승천이 회수 못 한 골드/아이템을 지우지 않는다. 공개 침공 문서(영구)와 로컬 묘비가 다시 같은 세계를 가리킨다 | 리듀서 1줄 + 테스트 행 2 | 반대 방향(승천 시 공개 문서까지 삭제)은 rules `delete: false`라 클라이언트가 못 한다 — 그래서 "지운다"는 선택지가 애초에 반쪽이다. `INITIAL_STATE` 대신 `state` 스프레드로 바꾸면 `enemy`/`currentEvent`까지 이월돼 §8-6 폴드가 깨진다 — **한 필드만** | opus |
| **M3 문서 드리프트 + 래칫 하향** | CLAUDE.md `:34` 문장 삭제("`GameAction.payload: any`만 경계") · §3 트리에 `functions/api/ai-proxy.js` · §6 AI 이벤트에 "프록시 입력 상한(본문 16KB·필드별)" 1줄 · `docs/DEPLOYMENT.md:5,40`·`docs/QUICK_DEPLOY.md:6`에서 `feedback-validate` 제거 · `src/hooks/actionDeps.ts:62` "(현재 any)" → `GameEvent \| null` · `tests/debt-ratchet.test.js:179` `SYSTEMS_KOREAN_STRING_BASELINE` 122→**120** · `tasks/todo.md`·§25.1 | 문서가 다시 사실이 된다, 래칫 slack 0 | 문서 3 + 주석 1 + 테스트 상수 1 | 래칫을 "여유 있게" 두면 래칫이 아니다 — 실측값 그대로. §6 문장은 M1 머지 뒤 통합자가 실제 상한 숫자와 대조 | sonnet |

**계약 테스트와 결함 주입** (주입이 안 걸리면 코드가 옳은 게 아니라 테스트가 안 보는 것이다 — §22)

| 테스트 | 고정하는 것 | 주입 → red가 되는 단언과 이유 |
|---|---|---|
| `tests/cf-functions.test.js` (M1, 신규 4건) | ① 본문 1MB(`name` 1MB) → **413**, Gemini fetch 카운터 **0**, 쿼터 무관 ② 본문 < 16KB이되 `name` 5,000자·`relics` 50×100자·`buildProfile` 50×100자 → 캡처한 Gemini 프롬프트 길이 **< 2,500자**이고 `name`의 33번째 문자부터의 부분열이 프롬프트에 **없다** ③ story `context` 5,000자 → 프롬프트 < 1,500자 ④ Gemini 5xx 스텁 → 500 본문에 `details` 키 **없음** | ①에서 본문 검사 제거 → 오늘처럼 200 + fetch 1 → red. ②에서 `clampText` 제거 → 오늘 실측 프롬프트 = 본문 + ~740자라 5,000자 name만으로 5,740자 > 2,500 → red(공허하지 않은 이유: **오늘 코드가 1,000,739자를 200으로 통과시켰다**). ④ `details` 복원 → 키 존재 red. 기존 8건(ai-proxy)은 그대로 초록이어야 한다(정상 본문 127B는 상한 안) |
| `tests/permanent-progress-copy.test.js` (M2, 행 추가) | `ASCEND`(ASCENSION, `grave: [{고요한 숲, 5000}]`) → `after.grave` deepEqual `before.grave`; `RESET_GAME` 같은 픽스처 → deepEqual(대칭 행); `TRUE_ENDING` 경유 `ASCEND`도 동일. 픽스처는 `graveUtils.buildGraveData` 모양(`loc/gold/items/timestamp`) — 가짜 모양 금지(§22) | `grave: state.grave` 줄 제거 → `after.grave === null` → deepEqual red. 오늘 실측이 정확히 `null`이므로 판별자는 `grave`이지 `gameState`가 아니다(`ASCEND`는 idle로 간다 — 그 단언은 공허) |
| `tests/debt-ratchet.test.js` (M3) | (d) systems 상한 120 | `src/systems`에 한글 리터럴 1개 추가 → 121 > 120 red(오늘 상한 122면 초록 — 그 2건 slack이 하향 근거) |

**증빙 델타 (먼저 적는다)** — 모델 입력(`data/*`·`progressionSimulator`·`explorationPacing`·`exploreFlow`·`_shared`)은 한 파일도 안 건드린다. `ASCEND`는 모델 경로에 없다(`endgameSettlement.ts:198`은 로그 문구뿐, `progressionSimulator`에 `ASCEND`/`pickPermanentPlayerState` 참조 0).

| 증빙 | 예고 |
|---|---|
| `progression-diagnostic-v2` | **움직인다** — `sources` **346 유지**, sha 이동 정확히 **2**: `src/reducers/handlers/progressionHandlers.ts`(M2) · `src/hooks/actionDeps.ts`(M3 주석). `functions/**`·`tests/cf-functions.test.js`·`tests/permanent-progress-copy.test.js`·`tests/debt-ratchet.test.js`는 manifest 밖(9개 tests 엔트리는 loot/progression 계열 — 실측 목록 확인). `package.json`/락파일 불변(의존 추가 0). `reportHash f21dcf81…`·`v1Baseline 2573fa0f…` 불변 |
| `relic-dot-multiplier`·`relic-event-chance`·`equipment-combat-power`·`relic-gold-multiplier`·`relic-hp-drain-atk`·`relic-drop-rate`·`content-reachability`·`event-reward-coherence`·`exploration-rhythm` | **바이트 동일** — 편집 집합 ∩ 바이트 핀 목록(§24 1-k) = ∅. `verify-observation-host.mjs`는 `/api/ai-proxy` **URL 문자열**만 쓰고 파일을 핀하지 않는다(실측) |
| 모델 핀 3종 `ac79428c…`·`2573fa0f…`·`0818fb7a…` | **불변** |
| `perf:guard` | 프로덕션 번들 무변경(M1은 `functions/`, M2는 리듀서 1줄) — 재측정만 |
| 프로덕션 dist test-api 마커 | 0 유지(build:guard) |

**순서·병렬성**: **M1 ∥ M2 ∥ M3** — 파일 교차 **0**(M1 = `functions/api/*` + `tests/cf-functions.test.js`, M2 = `progressionHandlers.ts` + `permanent-progress-copy.test.js`, M3 = CLAUDE.md·docs 2·`actionDeps.ts` 주석·`debt-ratchet.test.js`·todo). 통합 → `type-check · lint · unit · build:guard`(직렬) → `progression:diagnostic:write` **맨 마지막, 병행 금지**(§15.1) → 15종 verify → `perf:guard` → M3의 §6 문장을 M1 실제 상한과 대조 → §25.1 → PR → CI → merge. **트랙 프롬프트 필수 항목**: ① 계획 파일 경로 `/tmp/claude-0/-home-user-aetheria-roguelike/a8415c1b-4925-539c-8646-13225e01f454/scratchpad/wave21-plan.md` — 워크트리는 `origin/main`(`8be7eacd`)에서 갈라지므로 브랜치의 3커밋(`882d06ec`·`b2bafc23`·`fac8f5eb`, PR #48)이 **없다** ② 워크트리엔 `node_modules`가 없어 `tests/equipment-economy-audit.test.js` 심링크 케이스와 `build:guard`(`vite` ENOENT)가 죽는다 — 예상된 실패 ③ 편집 금지: §24 1-k 바이트 핀 목록 전부 + 모델 파일 ④ 주입은 코드 수정 **전에** red를 먼저 찍고 기록 ⑤ 잔존 worktree 3개(`git worktree list`)를 트랙 생성 전에 `remove --force`.

**하지 않기로 한 것**
1. **텔레메트리 sink 구현** — 목적지·프라이버시·비용은 저장소 밖 결정(Q6). 로컬 링버퍼 sink는 탐험마다 localStorage 쓰기를 추가한다.
2. **perf 예산 하향** — 실측 1~27%. §15.1이 3회 실측으로 "유지"를 냈고, 이번에 10예산 전부를 다시 재도 같은 답이다. 예산은 벽돌 검출기로 둔다.
3. **유닛 벽시계** — 131.8s 테스트는 증빙 계약 그 자체(346소스 봉투 검증). 유닛에서 빼면 `npm run verify`의 tripwire(§19)가 사라진다.
4. **퀘스트 104 체크포인트 80** — 모델 핀 3종 + 1000시드 진단 재생성으로 "올바르게 라벨된 행" 하나를 산다. `beyond-anchors`는 결함이 아니라 정책이다.
5. **class-(b) 1,807 재분류** — 분류기가 저장소에 없다. 정책 그대로.
6. **e2e `event_pending`** — 관측 불가.
7. **리더보드 `totalKills` 상한** — 지평의 12배 밖.
8. **프록시 레이트리밋을 Durable Objects/KV로** — isolate 근사는 문서화된 설계, M1의 크기 상한이 비용 축을 닫는다.
9. **승천 시 공개 묘비 문서 삭제** — rules `delete: false`, Admin SDK 필요.
10. **관리자 live config 쓰기(SystemTab:310) 살리기** — rules test site 5가 "거부가 정답"으로 고정(§18 기각). 다시 올리지 말 것.
11. 종결 항목 유지: `useFirebaseSync` 폴드 5중복 · `TokenQuotaManager` 재시도/거부 · `ControlPanel` if-체인 · `tier`/아트 identity · Hosting job · `GS.EVENT` 선행 세팅.

**소유자에게 넘기는 질문**

| 질문 | 선택지 | 비용 |
|---|---|---|
| Q6. 제품 텔레메트리 18종·AI 폴백 사유 7종의 **목적지** — 오늘은 전부 NOOP | (a) 현행 유지(기기 안 크래시 링버퍼만) (b) 로컬 링버퍼 sink + SystemTab 내보내기(백엔드 없음) (c) Cloudflare Function `/api/events` + KV/D1 → `productFunnel.mjs`가 읽는 서버 모양 | (a) 0 — "플레이어가 어디서 막혔나"를 운영이 볼 수 없다 (b) 트랙 1(sonnet) + 탐험마다 localStorage 쓰기 (c) 함수 1 + 스토리지 + 개인정보 고지 문구 검토 |
| Q7. 프로덕션 Pages 프로젝트에 `/api/ai-proxy`가 `GEMINI_API_KEY`와 함께 **배포돼 있는가**, 클라이언트 `VITE_USE_AI_PROXY`는 무엇인가(`tasks/todo.md`의 09-10 공유본은 "AI proxy false · Functions 없는 정적 배포") | (a) 배포됨 → M1은 **비용 사고 방지** (b) 미배포 → M1은 **배포 전 하드닝** | M1은 답과 무관하게 진행한다. 답은 우선순위와 §25.1의 문구만 정한다 |
| Q8. 카탈로그 퀘스트가 **계정당 1회**(승천 뒤 2회차에 퀘스트 수입 0, 현상수배만) | (a) 유지(계정 사다리) (b) `ASCEND`에서만 `claimedQuestIds` 리셋(사망은 유지) (c) `prestigeRank`별 원장 | (a) 0 (b) `permanentProgress` 분기 1 + 테스트, 승천 보상 경제 재검토 (c) 타입·마이그레이션(`DATA_VERSION`) |
| Q4. Hosting 사이트 비활성화 · Q5. iOS `ios:sync` + Android 에뮬레이터 뒤로가기 8행(Codex 브리프 `docs/qa/CODEX_K3_BACK_BUTTON_QA.md`로 위임) | §24.1 그대로 | 변동 없음 |

**게이트 베이스라인** (착수 시, head `fac8f5eb` = `8be7eacd` + 문서/픽스처 3): unit **5,168 / 5,168**(351파일, skip 0, 오늘 재실행 pass, 로컬 4코어 310s) · e2e 121(44 스펙) · 15종 verify ok · `npm run build` 12.0s, 프로덕션 dist test-api 마커 **0** · perf 10예산 전부 1~27%. **이 wave의 성공 기준**: 모델 핀 3종 불변 + 바이트 핀 9종 동일 + `progression-diagnostic-v2` sources 이동 정확히 2 + 주입 4종 전부 red→green(①은 fetch 카운터, ②는 프롬프트 길이, M2는 `grave`, M3는 121>120) + `feedback-validate` 참조가 `src/**`·`docs/**`·`functions/**`에서 0.

### 25.1 Wave 21 실행 결과 (2026-09-21)

**커밋**: `cad6aae8` §25 계획 · `cc2efd57` M3 · `907289ef` M1 · `7363e1cb` M2 · `8a118968` 증빙. 트랙 3개 worktree 병렬(M1·M2 opus / M3 sonnet), 파일 교차 0, 충돌 0(M3의 CLAUDE.md §2/§3/§6과 PR #48의 §4/§8-8은 영역이 다르다).

**예고 델타 적중**: `progression-diagnostic-v2`만, 바뀐 키 `sources`뿐, 346 → 346, 이동 **정확히 2**(`progressionHandlers.ts`·`actionDeps.ts`). `reportHash`·`v1Baseline`·`package.json`/락파일 불변, 바이트 핀 9종 동일(M1은 `functions/`라 핀 밖). 모델 핀 3종 불변.

**M1 실측 (통합 뒤 확인)**: 본문 상한은 바이트 정밀 — **16,384B → 200 · 16,385B → 413**, Gemini fetch 0. 실측 본문은 정상 145B · 실전 컨텍스트(히스토리 8·유물 6·빌드 4·지도) 1,095B — 상한은 실사용의 15배. 프롬프트 길이: 정상 745자, 테스트 ②(name 5,000 + 50×100 ×2 = 본문 15,917B) **1,383자**, ③(story context 5,000) 341자 — 수정 전에는 각각 26,137·5,050자였다. 주입 A(상한 제거)는 fetch 카운터로, B(`clampText` 항등)는 8,185·5,050자로, C(`details` 복원)는 키 존재로 각자 자기 테스트만 red. **정정 두 가지**: ① 주입 ④ red 문구의 `AIzaSy…`는 테스트 스텁이 상류 오류에 넣은 키 모양 문자열이다 — 실제 코드는 상류 **응답 본문**(`callGemini:314`)을 그대로 `details`로 전달했고 Gemini 오류 본문에 키 값이 실린다는 증거는 없다. 결함은 "상류 원문 무검열 전달"이고 테스트 ④가 그 클래스를 막는다 ② `details` 제거의 클라이언트 영향은 **0** — `aiService.callProxy`는 non-ok 응답의 본문을 읽지 않는다(`!ok → null` → `proxy-unavailable` 폴백). 413도 같은 경로로 폴백되며 쿼터 1건은 디스패치 시점에 이미 소모(D3, 불변). 부수 견고화: `relics`의 `null` 원소가 `r.name || r`에서 throw → 500이던 것이 `''`. **남긴 것(계획대로)**: `level`/`mp`/`gold`/`recentWinRate` 숫자형 보간은 원시 그대로 — 적대적 호출자에게는 문자열이지만 16KB 본문 상한이 묶는다(프롬프트 최악 ≈ 16~33KB). 필드 clamp 한 줄씩이면 닫히나 이 wave 범위 밖.

**M2 실측**: 픽스처는 `buildGraveData(player, () => 0.9, () => 12_345)`가 낸 진짜 모양(`{loc, gold: 5000, item, items[2], timestamp}` — `item === items[0]`, §8-2의 두 모양 동시 기록)이고 다섯 번째 행이 그 모양 자체를 핀한다. **비공허 가드**: `ASCEND`에는 조기 `return state` 경로가 **5개**라 `assert.notEqual(ascended, base)` + `level === 1` 없이는 승천이 거부돼도 `grave` deepEqual이 공짜로 통과한다 — 계획에 없던 가드, 트랙이 넣었다. 수정 전 red는 예측대로 `+ null / - [{gold: 5000, …}]`(`RESET_GAME` 대칭 행은 수정 전에도 green — 결함을 판별하지 하네스를 판별하지 않는다). 계획 줄번호 오차(117-123 → 실제 119-125).

**M3 실측**: CLAUDE.md:34 거짓 문장 교체 · §3 트리에 `functions/api/` · §6 프록시 상한 1줄 · `docs/DEPLOYMENT.md`·`QUICK_DEPLOY.md`의 `feedback-validate` 제거 · `actionDeps.ts:62` 주석 · 래칫 systems 122→120(주입 121 > 120 red). 추가 발견 `tasks/PROJECT_OVERVIEW.md:99`(같은 잔재) — 통합자가 제거. `tasks/todo.md:659`의 2026-09-04 Vercel 시대 기록은 역사라 그대로.

**재감사 방법론 기록**: 첫 감사 축(타입·계약·상태 기계·복원·배포)이 소진된 뒤 다섯 축(플레이어 흐름·관측성·보안 경계·수치 부채·성능)을 실행으로 쟀고, 셋에서 "없음"이 측정으로 나왔다(흐름 벽돌 0 · rules 쓰기 지점 6 = F3 · tree-shaking 마커 0 · 문서 수치 16종 참 · perf 예산 1~27% · 유닛 지배 파일 = 증빙 계약). 결함 2건은 둘 다 **경계**(서버 입력 경계 · 리셋 두 경로의 비대칭)에서 나왔다 — 다음 감사도 "같은 일을 하는 두 경로가 같은 필드를 다루는가"(`RESET_GAME` vs `ASCEND` 류)와 "클라이언트가 자르는 값을 서버도 자르는가"(name 16 vs 프록시 무제한 류)를 먼저 볼 것.

**소유자 항목**: Q4(Hosting 사이트 비활성화) · Q5(Codex 브리프 `docs/qa/CODEX_K3_BACK_BUTTON_QA.md`) · **Q6** 텔레메트리 목적지(18종 전부 NOOP) · **Q7** 프로덕션 Pages의 `/api/ai-proxy` 배포 여부(M1의 문구를 정한다) · **Q8** 카탈로그 퀘스트 계정당 1회.

**Wave 22 후보**
1. 프록시 숫자형 보간 4곳 clamp — 한 줄씩. 다음에 `ai-proxy.js`를 만질 때 끼운다(단독 wave 아님).
2. Q6이 (b)/(c)면 텔레메트리 sink 트랙 · Q8이 (b)/(c)면 퀘스트 원장 트랙 — 소유자 답 종속.
3. Codex 실기/시뮬레이터 결과가 오면 K3 런타임 검증 마감(§24.1) — 결과에 따라 트랙.
4. 감사 축은 이제 둘 다 소진 — 다음 감사는 **플레이 데이터**(Q6 sink가 생기면)나 **기기 QA 결과**가 입력이어야 한다. 입력 없이 세 번째 정적 감사는 수확 체감.


**게이트** (head `74730aa2`, 직렬 실행 12:09~12:29): type-check 0 · lint 0 · unit **5,170 / 5,170**(351파일, skip 0, Wave 20 대비 +2 = M1 −6+4 · M2 +4) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **121 / 121**(61 + 60) · perf desktop FCP 576ms / mobile FCP 556ms · tracked 증빙 verify 15종 ok.

### 25.2 Wave 21.1 — flaky 테스트 경화 (2026-09-21, 베이스 `main` = `e742bc26` = PR #49 merge)

**계기**: PR #49 CI run 35599900179 attempt 1 — 유닛 5,170 중 **1 실패**, `tests/skill-branch-parity.test.js:203` `A 피해(1432)가 B(1446)보다 커야 함`. 로컬 게이트는 같은 코드에서 5,170/5,170이었다. 로그는 프록시가 blob URL을 막아 `get_job_logs` 6,000줄 tail을 파일로 받아 `not ok` 1건을 찾았다 — 200줄 tail에는 없었다(TAP은 파일 완료 순이라 실패가 중간에 묻힌다. 다음에 CI만 붉으면 tail을 키워 `not ok`를 grep할 것).

**원인**: `runSkill`이 `performSkill(player, enemy, stats, skill)`의 5번째 `rng`를 비워 `Math.random`이 들어갔다. 피해 = `atk × (DAMAGE_BASE_RATIO 0.9 + rng × DAMAGE_VARIANCE 0.2) × mult`(`CombatEngine.ts:74`)이고 A/B 배율비 13.2/11.0 = **1.2 < 분산비 최댓값 1.1/0.9 = 1.222**. 해석 0.417%(∫₀^(1/12)(0.1 − 1.2a)da) · 엔진 직접 200,000회 866 = **0.433%/run** · 고정 rng 0.5에서 A 1,584 / B 1,320.

**수정**: `f0afd4cd` — `FIXED_RNG = () => 0.5`를 `runSkill` 옵션 기본값으로 넣고 5번째 인자로 전달. 단언은 불변. 허용된 재실행 1회는 초록이었고 그 head로 #49를 머지했다 — flake 수정을 #49에 얹지 않은 이유: CI 15분 재소모 + §25.1 게이트 기록과 "Wave 21 = 재감사 결함 2건"이라는 범위가 흐려진다. 분리 비용은 머지 사이클 하나.

**같은 클래스 전수(worktree 에이전트, 통합자 재검산)**: `rng?`를 받는 엔진 진입점 8종(`attack`/`performSkill`/`enemyAttack`/`attemptEscape`/`processLoot`/`handleDefeat`/`calculateDamage`/`applyItemPrefix`)의 호출을 **최상위 인자 개수**로 세어 미시드만 뽑았다 — grep 출현 횟수는 시드된 호출까지 세므로 계획의 "11파일 80곳"은 틀렸다(`relic-dot-multiplier-coherence`·`relic-free-skill-coherence`는 이미 `sequenceRng`/`() => roll`을 넘긴다). **미시드 128곳 = (1) rng 무관 79 · (2) 구성상 결정론 46 · (3) rng 의존 3**.
- (1)의 근거는 추측이 아니라 엔진 경로다: freeze/stun/blind/fear 조기 반환은 draw 전에 `return` · `calculateDamage`와 `mitigateByEnemyDef`의 `Math.max(1, …)`로 피해는 항상 ≥1 · `guardChance: 0, heavyChance: 0`이면 `roll < 0` 불가 · MP/쿨다운/tempBuff/phase/`spellStackCount`는 rng가 안 건드린다 · `handleDefeat` 21곳의 rng는 `buildGraveData` 안에서만 쓰이고 묘비 내용을 단언하는 테스트가 0건.
- (2) 46곳: `random() < 1.0`은 항상 참, `random() < 0`은 항상 거짓(`effectChance` 0/1.0 · `evasion` 1.0 · `critChance` 0/1.0 · `freeSkillChance` 1) 또는 기존 전역 `Math.random` 스텁(`() => 0.99` · `seededRandom(seed)`)으로 결정론.
- (3)-A `skill-branch-parity:216` 0.433% → **수정**(위).
- (3)-B `cycle-200-299:1989` 미시드 `attack` 1,000회의 crit 수 50~170 — 엔진 실측 crit율 0.09925(`BALANCE.CRIT_CHANCE` 0.1), 이항 정확 꼬리 **2.79e-9/run**(P(X<50) 2.787e-9 + P(X>170) 3.955e-12; 통합자 재계산 2.791e-9 일치) → **미수정**.
- (3)-C `relics:1323` 50샘플 합 비교 `stack3 > stack0 × 1.3` — 평균비 1.5994, 경험분포 200,000 trial 실패 0, 최저 관측 1.5184, 임계까지 ≈16σ → **미수정**.
- B·C를 안 고친 이유: 둘 다 루프(1,000회·50회)라 상수 rng로는 못 고치고 시드 PRNG가 필요한데, **시드 고정본은 엔진이 draw를 하나 더 넣는 순간 수열이 밀려 무관한 변경에 깨진다** — 현행 `Math.random` 판은 안 깨진다. 2.79e-9는 5,170 스위트 3.6억 회당 1회. 고치는 쪽이 취약성을 늘린다.
- 교차 실증(스크래치, 커밋 안 함): `Math.random`을 시드 PRNG로 바꾸는 프리로드로 10파일 × 120시드 = **1,200회 실패 0** · 상수 rng(0/0.9999/0.5)에서 깨지는 건 B(분포 테스트)뿐 — "보통의 `Math.random` 결과에 기대어 통과"하는 테스트는 없다 · 부등식 단언 13종 각 200,000회 반복 실패 0(하네스는 `critChance 0.5` 주입으로 99,644/200,000 검출 확인 — 공허 아님).

**잠복 관찰 4건(수정 안 함 — 깨지지 않은 것은 손대지 않는다, 규칙으로 남긴다)**:
1. `enemy-def-mitigation.test.js:75-76` · `cycle-100-199.test.js:385-386, 400-401`은 #49와 **같은 모양**(두 피해의 부등식)인데 전역 `Math.random = () => 0.99` 스텁 덕에 결정론이다 — 스텁을 걷으면 되살아난다. 새 테스트는 전역 변이 대신 `rng` 인자로 같은 값을 넣을 것.
2. `classes.ts`의 `effectChance` 0.2~0.4 분기 override 5개(기절 배시 ×2 · 혼란 찌르기 · 기절의 빛 · 표식의 화살비)는 미시드로 proc를 단언하면 60~80% flaky다. `FIXED_RNG 0.5`는 이 5개를 **결정론적으로 실패**시키므로 커버리지를 추가할 때는 시퀀스 rng(분산 0.5 → proc 0.0)를 쓸 것.
3. `handleDefeat` 미시드 21곳은 `buildGraveData`의 묘비 개수 동전던지기(`graveUtils.ts:60`, `random() < 0.5 ? 1 : 2`)와 셔플을 돌린다 — 안전한 유일한 이유는 묘비 내용을 단언하는 테스트가 0건이라서다. `grave.items.length`를 단언하는 순간 50% flaky.
4. `combat-engine-core.test.js`의 `calculateDamage` 12건은 엔진이 아니라 파일 안의 결정론 미러 구현을 호출한다 — 진짜 `CombatEngine.calculateDamage` 회귀를 못 잡는다(범위 밖, Wave 22 후보 5).

**엔진 rng 결정 지점(기록)**: `CombatEngine.ts:74` 분산 · `:75` 크리 · `:279` `handleDefeat` 폴백 `buildGraveData(…, Math.random, Date.now)` / `CombatEngine.actions.ts:103·115·323·335` blind/fear · `:135·419` `calculateDamage` 2 draw · `:270` `on_hit_freeze` · `:405` `free_skill` · `:493·506` effect/secondEffect 게이트 · `:657` 추가 행동 / `CombatEngine.enemyAI.ts:99` 회피 · `:142~175` phase statusEffect/저항 + phase2 임계 지터(`:155`) · `:200` 패턴 roll · `:214` `crit_block` · `:232` `absolute_reflect` · `:303~304` `statusOnHit` · `:327` 반격 · `:344~345` 히트 문구 선택 · `:352` 도주 / `CombatEngine.loot.ts:135~215` 드롭·접두사. `outcome`/`relics`/`status`/`combatItemTurn`은 `Math.random` 0건. 리듀서 경로는 `combatHandlers.ts:316/365`가 `Number.isFinite(seed)`가 아니면 state를 그대로 돌려주므로 테스트가 리듀서로 `Math.random`에 닿는 길은 없다.

**Wave 22 후보 추가**: 5. `combat-engine-core.test.js`의 미러 12건을 실제 엔진 호출로 교체(`rng` 주입) — 관찰 4.

**게이트** (head `cc69f5f9`, 코드 = `f0afd4cd`): type-check 0 · lint 0 · unit **5,170 / 5,170**(351파일, skip 0, 케이스 수 불변 — 수정은 단언이 아니라 rng 주입) · build:guard ok(`npm run verify`, 13:21~13:27 직렬; e2e/perf는 코드 변경이 테스트 1파일뿐이라 CI에 맡긴다).


## 26. 인수 이후 실행 계획 (2026-09-22, 베이스 `main` = `b98bdeec`)

인수인계 §0 순서와 현재 문서·Git 상태를 대조했다. 첫 브랜치는 `codex/wave22-device-qa`이며 기존 untracked `.claude/skills/`는 범위 밖이다. 세 번째 정적 감사를 열지 않고 기기 관측을 다음 수정의 입력으로 사용한다.

| 단계 | 범위 | 검증·종료 조건 |
|---|---|---|
| A / Wave 22 | Android sync → debug → APK AppPlugin → 뒤로가기 8행의 하위 상태 12개, 신규 5분·재료 2분 루틴; iOS sync | 관측 3곳 기록, src 변경 없음, 기본 verify와 관련 smoke/native 검증 → PR CI → merge commit. 불일치는 후속 수정 입력으로 보존 |
| B | Q4·Q6·Q7·Q8의 답과 실제 확인 결과 | Q4 명시 실행 지시 전 미실행. Q7 소유자 제공 PROD_URL에서 무인증 판정만. Q6/Q8 변경 선택은 구현 범위 확정 후 진행 |
| C | 기기에서 확인한 결함 및 관련 프록시 숫자 보간 4곳·엔진 미러 테스트 12건 | 계약은 결함 주입 red부터. rng 명시, 바이트 핀 불변. 코드 변경은 e2e와 desktop/mobile perf 포함 |
| D | 최신 아트 정본과 수용 범위 정합성 | 최신 V27은 총 254 = authored 234 / retained 20. 이전 retained89 triage를 신규 미승인89로 다시 열지 않는다. 신규 생산은 별도 승인 종속 |
| E | 양 플랫폼 물리 기기, release 서명, 내부 업로드, 스토어 입력 | MOBILE_RELEASE §5 전 항목 충족 전 No-Go. unsigned·emulator·merge를 출시 완료로 대체하지 않는다 |

**예고 델타**: A의 tracked native 변경은 `ios/App/CapApp-SPM/Package.swift`의 CapacitorApp dependency/product 순증 2줄이다. `project.pbxproj`가 움직이면 커밋하지 않는다. `src/**`, 바이트 핀, 증빙 baseline은 편집·재생성하지 않는다. 결과 문서는 PLAYTEST_CHECKLIST §11 Android, 본 원장 §24.1, todo를 함께 갱신한다.

**검증 실행 주의**: `verify:full`은 perf를 자동 활성화하지 않으므로 코드 변경 단계는 `AETHERIA_RUN_PERF=1 npm run verify:full` 또는 별도 양 viewport perf를 사용한다. 증빙 writer·빌드·게이트는 직렬 실행한다. 네이티브 back 검증은 `adb KEYCODE_BACK`이며 테스트 API의 synthetic back으로 대신하지 않는다.

**착수 확인**: 원격 main 일치, 열린 PR 0. Android API 36 AVD와 Xcode 27 사용 가능. `mobile:doctor`는 Android release signing=no, iOS Distribution identity=no를 보고했다. Q6/Q8/PROD_URL은 소유자 응답 대기다.

### 26.1 Wave 22 실행 결과

**인수인계 §7-A 결과**

| 항목 | 결과 | 근거·미완료 |
|---|---|---|
| Android sync → debug → APK AppPlugin | 통과 | production·신규 여정 QA·재료 QA APK 모두 `com.capacitorjs.plugins.app.AppPlugin` 등록 확인 |
| 하드웨어 뒤로가기 8행 | 통과 | Android 16/API 36 에뮬레이터, 하위 상태 12개에서 실제 `KEYCODE_BACK`; 기대 동작과 불일치 0 |
| 신규 세이브 5분 루틴 | 실행·부분 미검증 | 자연 시작·임무·탐험 4회·첫 전투·귀환·보상·휴식·4탭·진단 복사·Home 10초·재실행 수행. 첫 전투 7턴(P2), 영문 표기(P1). 캡처와 back QA를 병행해 시간 제한/초심자 3초 판단은 미검증 |
| 재료 보유 2분 루틴 | 관측 항목 통과 | 취소 무소비; 강화 150골드/재료1, 제작 100골드/철광석5, 합성 600골드/장비3. 5,000 → 4,850 → 4,750 → 4,150골드. 강제 종료 후 강화+1·아이템·재화 일치, 운영 세이브 3키 해시 불변. 초심자 시간 수용은 미검증 |
| iOS sync | 통과 | `Package.swift` dependency/product 순증2줄; `project.pbxproj`·`Package.resolved` 불변 |
| iOS build·시뮬레이터 부팅 | 일부 실패 | unsigned device/simulator build 성공. 같은 QA 앱이 iOS 26.5에서 부팅·60초 이상 생존, 수집 로그의 플러그인 오류 일치 항목 0. iOS 27.0은 UIScene lifecycle 요구로 시작 직후 SIGTRAP(P0) |
| 실기기·서명·스토어 | 미실행 / No-Go | 양 플랫폼 실기기 루틴, Android release keystore, Apple Distribution identity, 내부 업로드·스토어 입력 미완료 |

**인수인계 §7-B 결과**

| Q | 결과 | 다음 조건 |
|---|---|---|
| Q4 Firebase Hosting 비활성화 | 미실행 | 소유자의 명시적 실행 지시 없음 |
| Q6 텔레메트리 목적지 | 결정 대기 | NOOP 유지 / 로컬 링버퍼+내보내기 / Cloudflare events+KV·D1 중 소유자 선택 |
| Q7 프로덕션 ai-proxy | 미실행 | 소유자 PROD_URL 미제공. 토큰·키·헤더 값을 사용하거나 기록하지 않음 |
| Q8 퀘스트 보상 원장 | 결정 대기 | 계정당 1회 유지 / ASCEND 리셋 / prestigeRank별 원장 중 소유자 선택 |

**로컬 검증 (2026-09-22)**: `npm run verify` 통과(type-check/lint 오류0, unit5,170/5,170·skip0, build:guard ok), `test:device-qa:item-investment` 1/1, `bash scripts/local-playtest.sh` desktop/mobile smoke 통과. desktop 종료 단계의 `browser.close timeout` 경고는 기존 runner가 처리했으며 통과와 함께 보존한다. `android:device:smoke`는 material QA APK와 emulator 명시 옵션으로 install/launch/동일PID 60초 foreground를 확인했다. `mobile:doctor`, production `cap:sync`, unsigned `ios:build:device` 통과. 변경된 체크리스트를 읽는 관련 문서/기기 가드46/46 통과. 로컬 전체 e2e/perf는 src 무변경이므로 미실행이며 PR CI가 수행한다. 이는 iOS27 부팅 P0와 실기기/서명 gate를 대신하지 않는다.

**원격 추적**: [PR #52](https://github.com/sungjin9288/aetheria-roguelike/pull/52). 위 검증은 로컬 실행 결과이며 head별 CI와 실제 merge 상태는 해당 PR의 checks/merge 기록을 정본으로 확인한다.


### 26.2 B 단계 준비 (2026-09-22, base `78fa259d`)

PR #52는 merge commit `78fa259d2fc560ea73c58c8d7b3c5f0236d26db2`로 통합됐다. 해당 main revision의 [CI](https://github.com/sungjin9288/aetheria-roguelike/actions/runs/35674634798) 및 [Deploy workflow](https://github.com/sungjin9288/aetheria-roguelike/actions/runs/35674634997)는 모두 success이고 후자의 build·deploy-rules가 각각 success다. 이것은 Cloudflare Pages 배포 여부(Q7)의 증거가 아니다.

다음 브랜치는 `codex/wave23-owner-decisions`다. Q6/Q8 선택과 Q7 URL을 요청했으며 아직 답은 없다. 아래 권고는 결정으로 취급하지 않는다. Q4는 명시 실행 지시가 없으므로 미실행한다.

| Q | 현재 상태 | 검토 가능한 권고·구현 조건 |
|---|---|---|
| Q4 | 미실행 | 기존 Hosting 종료 명령은 명시 실행 지시 이후에만 수행 |
| Q6 | 답변 대기 | 로컬 링버퍼+설정 내보내기 권고. 기존 `ProductEventSink`와 coordinator의 단일 초기화 경로에 연결하고, release ID 부재 시 수집하지 않는 계약을 보존·노출한다. 이름·원문 로그·세이브를 혼합하지 않는 허용 필드, 저장 크기 상한, 손상/용량 초과 격리, 사용자 내보내기/지우기를 검증한다 |
| Q7 | 소유자 PROD_URL 대기 | 해당 origin의 `/api/ai-proxy`를 무인증 GET/POST로 확인해 상태 코드와 JSON/HTML 판정만 기록. 인증값·응답 헤더 원문·토큰을 기록하지 않음 |
| Q8 | 답변 대기 | 이번 RC는 계정당 1회 유지 권고. 리셋/랭크별 원장을 선택하면 ASCEND의 반복 보상 경제·저장 호환 검증을 별도 포함 |

**Q6 현재 코드 근거**: `productEventCoordinator.ts`는 첫 runtime coordinator를 캐시하므로 뒤늦게 sink를 주입하면 적용되지 않는다. `productEventContext.ts`는 유효한 release ID가 없으면 null이며, `productEvents.ts`의 기존 18종 구조는 캐릭터 이름·원문 이벤트를 담지 않는다. `localErrorReportStore.ts`는 저장소 오류를 게임과 격리하는 기존 패턴이다. SystemTab의 기존 QA export는 플레이어 이름·상태도 담으므로 새 이벤트 export와 무조건 합치지 않는다. `scripts/productFunnel.mjs`는 cohortId/receivedAt/serverSequence를 요구하므로 로컬 링버퍼를 서버 유지율·순서 authority의 증거로 사용하지 않는다.

**C의 iOS27 후속 범위**: 앞서 확인한 공식 Capacitor 8.5 UIScene 이관 경로를 우선 검토한다. 설치된 iOS 8.3.1에는 SceneDelegateProxy가 없으므로 의존성 없이 새 template만 복사하지 않는다. package/lock·SPM·AppDelegate/Info.plist·SceneDelegate·Xcode Sources 등록이 예상 대상이며 `src/**` 및 지정 바이트 핀은 유지 가능한 범위다. 기존 SIGTRAP 재현을 시작점으로 27.0/26.5 부팅, Home10초·저장복원·강제 종료/재실행, cold/warm URL·적용되는 universal link, safe area와 native/full/perf를 검증한다. B 결정 전에 의존성·native source는 수정하지 않았다.

**현재 검증**: main revision과 두 workflow 상태를 API로 조회했고, 위 코드 경로를 읽기 전용으로 대조했다. 이번 변경은 원장2곳의 상태·계획뿐이며 `git diff --check`로 확인한다. 실행 코드·APK·archive 변경 및 검증 재실행은 없다. B 답변이 들어오면 해당 선택을 구현/검증한 뒤 하나의 B PR로 마감하며, 현재 문서만으로 B 완료 PR을 만들지 않는다.

**후속 로컬 실행 (2026-09-22):** 위 B 준비 이후, 정책 선택과 독립적인 iOS27 P0를 별도 worktree `/Users/sungjin/.codex/worktrees/aetheria-ios27-lifecycle/aetheria-roguelike`에서 수정·검증해 commit `3acff734798af6f3173bd7b97ac4598795323053`으로 보존했다. 이 원본 worktree에는 실행 코드를 적용하지 않았다. 해당 commit의 원장 §26.3·`docs/qa/IOS_SCENE_LIFECYCLE_QA.md`가 상세 근거다. iOS26.5/27 각6checks·window mutant red·Android back3경로, tracked verify15종·unit5,170·E2E121·양쪽 smoke/perf 및 문서 가드46 통과. 실제 background는 Settings 앱 전환이며 Home 버튼 검증과 구분하고 URL 미등록으로 실제 routing은 해당 없음이다. Q6/Q8/PROD_URL 미입력·Q4 미실행, PR/CI/merge 미실행. B→C 원격 통합 순서는 유지한다.

**P1 후속 로컬 실행 (2026-09-22):** 같은 별도 worktree의 `codex/device-language-qa`, commit `25d66b85`에 W22-P1-01 표시 수정을 보존했다. 귀환 레벨/경험/생명·칭호 효과 한글화, 원본 수치 불변. baseline4red·결함 주입2종red→green 및 Android QA 캡처 검수 통과, tracked15·full gate(unit5,174·E2E121·양쪽 smoke/perf)·최종 문서 가드46 통과. 해당 commit 원장 §26.4와 `docs/evidence/qa/device-language-20260922/`가 상세 근거다. 이 원본 worktree에는 실행 코드를 적용하지 않았다. Q6/Q8/PROD_URL 답변 대기, Q4·PR·CI·merge 미실행 유지.


### 26.5 B 결정 적용 — 로컬 활동 기록 (2026-09-22)

직전 Q6(b)·Q8(a) 권고 뒤 소유자의 “좋아 이어서 다음 스텝 진행하자” 지시에 따라 구현한다. Q4 실행 지시는 없고 Q7 PROD_URL도 제공되지 않았다. §26.2의 답변 대기는 이 지시 전의 이력이다.

| Q | 결과 | 구현·검증 경계 |
|---|---|---|
| Q4 | 미실행 | Hosting disable 명시 실행 지시 없음 |
| Q6 | 로컬 링버퍼+설정 내보내기 로컬 검증 통과 | 제품18종의 기존9필드와 AI 폴백7사유의 전용7필드만 저장. 최근200건·128KiB 공통 상한, 버전/모양/값 검증, release ID 부재 시 수집 안 함. 다운로드 요청·클립보드 복사·삭제는 기존 세이브/플레이 기록 export와 분리. 원문·uid·토큰·세이브 제외, 외부 전송 없음 |
| Q7 | 미실행 | 소유자 PROD_URL 미제공. 과거 공유 URL을 추정하지 않음 |
| Q8 | 계정당1회 유지 | 퀘스트/승천/저장 schema·보상 수치 변경 없음 |

**증빙 예고 델타:** 소스4곳(SystemTab·messages·productEventCoordinator·aiService) 변경과 새2곳(localProductEventStore·localAiFallback) 추가에 따라 progression v2의 sources만 갱신한다. report/reportHash/v1Baseline 및 나머지 tracked 증빙은 불변 예상이다. content→event-reward→equipment combat-power→pacing verify→progression writer→tracked15를 직렬 실행한다. 바이트 핀은 편집하지 않았다.

**집중 검증:** 저장소/AI service/기존 관측 계약45tests 통과. VITE_RELEASE_ID=wave23-qa 브라우저4경로(실제 기본 sink, 최신 JSON 다운로드/clipboard, 삭제 실패/손상 거부, 쓰기 실패 격리) 통과. 초기 release 없는 브라우저3경로 통과, AI release 부재도 unit 실행. 결함 주입8종은 각각 exit1 확인 후 복원했다(허용 필드 유출, 보관 상한 제거, 잘못된 삭제 성공, NOOP 연결, release gate 제거, AI 연결 제거, UI 삭제 성공 오표시, 쓰기 실패 은폐). 정적 타입/집중 lint 초기 통과. 전체 gate·native·원격 검사는 다음 실행 결과로 갱신한다.


**최종 로컬 검증:** `VITE_RELEASE_ID=wave23-qa AETHERIA_RUN_PERF=1 npm run verify:full` exit0. unit5,181/5,181(353파일, skip0), E2E125/125(63+62), type/lint/build guard·desktop/mobile smoke/perf 통과. FCP280/276ms. desktop `browser.close timeout` 경고는 기존 runner 처리와 함께 기록한다. 기본 coordinator의 sink 주입 없는 CI 계약도 추가해 mutation1종을 더 검출했으므로 총9종 red→복원, 신규 단위 계약11건 통과다. tracked15 전부 통과했고 예고한6sources만 이동, reportHash/v1Baseline 포함 nonSources 불변이다.

**Android 실행:** release ID를 명시한 격리 QA APK(`/tmp/aetheria-q6-android-qa.apk`, `android-build.json` SHA 정본)로 실제 WebView 보관·OS 붙여넣기 JSON·341px 영역 무넘침/버튼44px·삭제4checks 통과. 직접 clipboard read는 권한 거부, Quick Boot는 System UI/키보드 startup ANR이었다. wipe 없이 cold boot 후 OS paste로 복사를 검증했으며 실패 관측·화면도 보존한다. 브라우저의 파일 다운로드/clipboard와 Android의 OS clipboard를 구분한다. Android 파일 다운로드 획득·iOS 내보내기·실기기 시간 루틴은 미실행이다. 일반 cap:sync/android:debug/mobile:doctor exit0, native tracked delta0·production APK AppPlugin/test API 부재 확인. 일반 빌드의 release ID는 미설정이므로 새 기록 수집 비활성이라는 기존 계약을 유지한다.

증빙은 `docs/evidence/qa/local-product-events-20260922/`에 있다. Q4 미실행, Q7 URL 미제공. Android release keystore와 Apple Distribution identity 부재·실기기/서명/업로드 조건으로 No-Go를 유지한다. C의 로컬 두 commit은 아직 원격 미통합이다. PR/CI/merge는 해당 원격 revision의 기록을 정본으로 갱신한다.

**문서 마감:** Android/iOS smoke 안내·한글 표기 관련46tests 통과, source manifest 전체 해시 일치·`git diff --check` 통과.

### 26.3 iOS27 시작 P0 독립 수정 — 로컬, 2026-09-22

A는 #52 merge `78fa259d`로 닫혔다. B 입력 대기 동안 정책 선택과 독립적인 W22-P0-01만 `codex/ios27-lifecycle` worktree에서 수정했다. B의 준비 기록 §26.2는 `codex/wave23-owner-decisions`에 미커밋 상태로 보존하며 단계별 원격 통합 순서는 유지한다.

Capacitor core/ios/cli와 iOS SPM을8.5.0으로 맞추고, SceneDelegate가 연결마다 단일 window/bridge를 생성한다. manifest의 Main storyboard 자동 생성은 제거했다. AppPlugin8.1.1·Android8.3.1은 유지했으며 peer 범위는 호환되지만 sync의 버전 불일치 경고는 남는다. `src/**`와 바이트 핀 소스는 변경하지 않았다.

| §7-A 항목 | 결과 | 근거·한계 |
|---|---|---|
| Android AppPlugin / hardware back | 통과 | 새 core/CLI로 sync→debug. QA package에서 crafting→idle, idle/combat→launcher3경로. 8행 전체 재실행은 아님 |
| iOS sync·build·부팅 | 로컬 통과 | core/ios/cli·SPM8.5.0 + native scene 등록. production unsigned device build 및 동일 simulator binary의26.5/27 시작·복귀·60초·재실행 통과 |
| 신규5분·재료2분 루틴 | 전체 재실행 미실행 | 이번 범위는 제작5,000→4,900 + 일반저장/장비·인벤토리·위치 복원. strict 시간·실기기 검증 대체 아님 |
| 기기 관측 | 잔여 있음 | iOS27 foreground 캡처의 일부 glyph 누락. 재진입 캡처 별도 보존, 원인 미확인. 기존 W22 P1/P2 미수정 |
| 통합 gate / 원격 | 로컬 통과 / 원격 미실행 | `AETHERIA_RUN_PERF=1 npm run verify:full`: unit 5,170/5,170, E2E 121/121, 양쪽 smoke·perf 통과. B 의사결정 전 C PR/merge 미실행 |

| Q | 결과 | 남은 조건 |
|---|---|---|
| Q4 | 미실행 | Hosting disable의 명시 실행 승인 없음 |
| Q6 | 미결정 | NOOP / 로컬 링버퍼+내보내기 / 서버 수집 중 소유자 선택 |
| Q7 | 미실행 | 소유자 PROD_URL 미제공. 과거 URL 추정·인증정보 기록 없음 |
| Q8 | 미결정 | 계정1회 유지 / ASCEND reset / rank 원장 중 소유자 선택 |

계약 판별력: 창 생성이 없는 proxy-only SceneDelegate mutant에 최종 manifest를 적용한 별도 bundle은 실제 WebView가 없어 FAIL. 정상 binary는 각OS에서6checks PASS. 초기 inspector import·페이지발견·연결 재사용 오류와 Android System UI ANR은 검사/환경 오류로 구분했다. UIKit scene configuration과 inspector 조회가 얽힌 초기 검은 화면만으로 원인을 단정하지 않는다. 최종 exact-PID RPC 조회로 프로세스가 바뀐 강제재실행까지 확인했다.

관측된 document pause→resume·App false→true·visibility hidden→visible은 실제 Settings 전환에서 수집했다. 일반 저장이 먼저 완료된 뒤 전환했으므로 background 즉시 flush 증거는 아니다. custom scheme/Associated Domains가 없어 실제 OS deep/universal-link 수신은 해당 없음이며 proxy 코드 검토만 수행했다. 스크립트·절차는 `docs/qa/IOS_SCENE_LIFECYCLE_QA.md`, 원본 receipt·미편집 캡처·해시는 `docs/evidence/qa/ios-scene-lifecycle-20260922/`.


**통합 gate 첫 실행 / 예고 델타:** type-check·lint 통과, unit5,169/5,170. `progression-diagnostic-cli`의 `EVIDENCE_BYTE_MISMATCH`이며 기존 manifest와 실제 파일을 대조한 변경 경로는 `package-lock.json`·`package.json` 두 곳뿐이다. 인수인계 §4 순서(content→event-reward→equipment:combat-power→pacing verify→progression diagnostic writer→tracked verify15종)로 갱신한다. 예고: `progression-diagnostic-v2.json.sources`의 두 sha256만 변경, `reportHash`·`v1Baseline`·나머지 내용 불변. 핀 소스 파일은 편집하지 않는다.

**최종 통합 검증:** 고정 순서 재생성의 실제 변경은 예고한 `sources` 두 sha256뿐이다. `reportHash`·`v1Baseline`을 포함한 나머지 JSON과 앞선 세 증빙은 불변이며 tracked verify15종 모두 통과했다. 이후 `AETHERIA_RUN_PERF=1 npm run verify:full` exit0: type-check/lint/build:guard 통과, unit5,170/5,170·skip0, E2E61+60=121/121, desktop/mobile smoke·perf 통과. FCP는 desktop320ms/mobile360ms, DCL은207ms/214.2ms였다. desktop smoke 종료의 `browser.close timeout` 경고는 runner가 처리했으며 함께 보존한다. 검증 후 변경은 결과 문서·receipt만이며 제품 코드는 동일하다. PR·원격 CI·merge는 미실행이다.


### 26.4 W22-P1-01 한글 표시 후속 — 로컬, 2026-09-22

B 입력 대기 동안 기기에서 관측한 귀환 카드 LV/EXP/HP와 설정 칭호 ATK 노출을 `codex/device-language-qa`(base `3acff734`)에서 수정한다. 귀환 문구는 MSG를 사용하고, 칭호 표시 공용 함수는 기존 `formatSkillText` 변환을 재사용한다. TITLE_PASSIVES의 값·라벨 원본과 바이트 핀 소스는 변경하지 않는다. Q6/Q8 결정·Q7 PROD_URL은 아직 미입력이며 Q4·PR·원격 CI·merge는 미실행이다.

새 실제 렌더/데이터 보존 계약4개는 기존 코드에서4실패를 확인했고, 수정 후 관련26개 통과했다. 정상 코드에 영문 레벨 표시/원본 칭호 라벨 반환을 각각 주입하면 동일 계약이 exit1로 실패하고, 원복 후4개 통과했다. 귀환 레벨 상승/유지 두 분기와 칭호 현재효과/목록을 검사한다.

**증빙 예고 델타:** source manifest 대조 결과 변경은 `ExpeditionDebriefCard.tsx`·`messages.ts`·`gameUtils.ts` 세 파일이다. 고정 순서 writer를 실행하며 `progression-diagnostic-v2.json.sources`의 해당3 sha256만 이동하고 reportHash·v1Baseline·나머지 내용은 불변이어야 한다. 전체 gate·화면·native 확인은 진행 중이다.


**최종 실행 결과:** 고정 순서 재생성은 예고한 sources3 sha256만 변경했고 나머지 JSON과 다른 증빙은 불변이다. tracked verify15종 통과. `AETHERIA_RUN_PERF=1 npm run verify:full` exit0: type-check·lint·build:guard, unit5,174/5,174(352파일·skip0), E2E61+60=121, desktop/mobile smoke·perf 통과. FCP desktop304ms/mobile224ms, DCL218.1ms/182.7ms. desktop smoke 종료의 기존 `browser.close timeout` 경고를 보존한다. 별도 읽기 전용 검토에서 확정 결함 추가 없음; 이를 원격 승인으로 취급하지 않는다.

| §7-A 항목 | 결과 | 근거·한계 |
|---|---|---|
| Android sync/debug/AppPlugin | 통과 | QA sync→debug→install 후 production cap:sync/debug 복원. production APK의 AppPlugin 등록 확인 |
| W22-P1-01 네이티브 표시 | 통과 | Android API36, 별도 QA package. 기존 fixture의 귀환 및 실제 칭호 선택 DOM handler·텍스트·가로 폭·원본 캡처 검사 |
| iOS/전체8행/시간 루틴 | 이번 변경 미실행 | iOS sync는 수행했지만 문구 화면은 Android만 검사. iOS27 glyph 관측·실기기 수용 미해결 |
| 전체 gate | 로컬 통과 | unit5,174·E2E121·양쪽 smoke/perf·tracked15. PR/원격CI/merge 미실행 |

| Q | 결과 | 남은 조건 |
|---|---|---|
| Q4 | 미실행 | Hosting 종료 명시 실행 지시 없음 |
| Q6 | 미결정 | 로컬 링버퍼+내보내기 권고에 대한 소유자 확정 대기 |
| Q7 | 미실행 | 소유자 PROD_URL 미제공; 인증값·헤더 원문 기록 없음 |
| Q8 | 미결정 | 계정당1회 유지 권고에 대한 소유자 확정 대기 |

증빙은 `docs/evidence/qa/device-language-20260922/`에 보존했다. QA APK는 별도 applicationId에만 설치했으며 운영 세이브는 조작하지 않았다. 테스트 종료 후 이 작업에서 기동한 emulator만 종료했다. `mobile:doctor`는 SDK36/Java21 정상, Android release keystore·iOS Apple Distribution 미구성을 보고했다. B→C 통합 순서와 No-Go는 유지한다.


### 26.6 C 통합 — 기기 결함과 코드 잔여 (2026-09-22)

B PR #53은 head `170e0f9d`의 CI run35705481168 static/E2E/perf/rules와 deploy build 통과 후 merge `c5e89034`로 통합했다. PR deploy-rules는 skipped다. 새 origin/main 기반 `codex/wave24-code-residual`에 §26.3/§26.4의 두 local commit을 가져왔다. 해당 절의 검증은 각각의 당시 snapshot이며 이번 통합 검증과 구분한다.

**착수 재현:** 실제 ai-proxy handler + 로컬 fetch stub에서 문자열 level, 객체 mp, 음수 gold, 500% 승률, NaN HP 비율이 프롬프트에 그대로 들어가고 maxMp=0이50으로 바뀜을 확인했다(200, 외부 호출0). 숫자 보간4곳과 인접 HP 유한성만 수정한다. damage12건은 실제 엔진에 sequence rng를 주입하며 엔진 바이트는 유지한다.

**예고 델타:** B의 최종 진단을 기준으로 package.json·package-lock.json·ExpeditionDebriefCard.tsx·messages.ts·gameUtils.ts의 sources5해시만 이동한다. 두 cherry-pick의 충돌 난 진단은 B 버전을 유지했으며, 최종 source freeze 뒤 content→event-reward→equipment combat-power→pacing verify→progression writer→tracked15 순서로 재생성한다. reportHash/v1Baseline 포함 nonSources와 바이트 핀은 불변 예상이다.


**집중 검증:** numeric 계약7건 추가 전 기존 구현5red/19(정상·누락2건은 이미 green), 수정 후19/19. 숫자 상한 제거·타입 coercion·0값 누락·HP 비율 무제한4종, 별도 프로세스에서 실제 엔진의 damage+1·crit flag 반전·rng 미소비3종 모두 red. 엔진7파일 바이트 해시 불변, 복원 후 proxy/core/P1 합계61/61. 테스트의 미러 damage 수식은 제거했고 분산/crit 정확히2draw와 명시 기대값으로12건을 검증한다. 독립 읽기 전용 검토에서 추가 중요 결함 없음.

**통합 native:** QA release `wave24-qa`와 별도 bundle/applicationId `com.aetheria.roguelike.wave24qa` 사용. iOS26.5/27 각각 lifecycle6checks, 귀환·칭호 한글/402px 무넘침/로컬 기록 생성 통과. 4개 한글 캡처 직접 확인. 최초 UI 검사2회는 귀환 카드 미닫힘·캐릭터 버튼이 장비 탭을 여는 순서 누락으로 실패했으며 receipt를 보존했다. 즉시 캡처에서 전환 전 화면이 잡혀3초 후 다시 캡처·검수했다. 이번27 복귀 캡처에서 이전 glyph 누락은 재현되지 않았지만 원인 해결로 판정하지 않는다.

Android API36 cold boot에서 귀환·칭호/기록 보관/OS paste JSON/341px 무넘침·44px 버튼/삭제6checks 통과. 같은 연결에서 clipboard 뒤 제작 back 대기가 실패(직전 IME 상태 미수집으로 원인 미확정)했고, 새 실행의 제작→idle·idle→launcher2건은 통과했다. 종료된 WebView를 재사용한 검사 오류를 분리해 별도 연결의 combat→launcher도 통과. 초기 실패 receipt를 덮지 않고3경로의 독립 통과 receipt를 남겼다. 원래8행 전체/시간 루틴/실기기 검증을 대체하지 않는다.

Production cap:sync→android:debug→ios:build:device→mobile:doctor exit0. sync 이후 추가 native tracked delta0. APK AppPlugin 등록·test API 부재 확인. unsigned iOS 산출물은 `/tmp/aetheria-wave24-device-build/Build/Products/Release-iphoneos/App.app`. Android release signing·Apple Distribution identity 부재는 지속. 전체 gate 결과는 아래 최종 검증을 따른다.


**최종 통합 검증:** `VITE_RELEASE_ID=wave24-qa AETHERIA_RUN_PERF=1 npm run verify:full` exit0: unit5,192/5,192(354파일·skip0), E2E125/125(63+62), type/lint/build guard·desktop/mobile smoke/perf 통과. FCP356/320ms, DCL235.4/208.7ms. 고정 순서 재생성·tracked15 통과, 예고한 sources5해시만 변경했고 reportHash `f21dcf819808a624d2d7f9d30b28a7d4b1403b8b3806383089453ef2ff731620` 및 v1Baseline 포함 nonSources는 불변이다. 기존 desktop browser.close timeout 경고를 유지한다. 이후 수정은 결과 문서·receipt뿐이다. PR/CI/merge는 아직 미실행이다.

**의존성 범위 확인:** npm audit exit1, high5/moderate3/low2 경고가 남는다. 변경 경로 CLI8.5.0→xcode3.0.1→uuid7.0.3의 moderate3은 같은 [uuid advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq) 경로다. 영향 API는 caller buffer를 사용하는 v3/v5/v6이며 실제 xcode의 유일 호출은 v4다. 실제 프로젝트 parse 후 UUID100회 생성 시 v4호출100·caller buffer0·영향 메서드0·프로젝트 쓰기0을 확인했다. UIScene에 필요한8.5.0을 유지하며 audit fix/override는 하지 않았다. 경고 해소·전체 의존성 보안 완료는 미주장. `dependency-review.json`에 범위를 보존한다.

**문서 마감:** Android/iOS smoke 안내·한글 표시 관련46tests 통과. 진단 sources348개 해시 일치·`git diff --check` 통과.


### 26.7 D 아트 판단 기록 정합성 (2026-09-23)

C PR #54는 head97337659의 static/E2E/perf/rules/build 통과 후 merge `1307fd25`로 통합했다(PR deploy-rules skipped). D는 새로운 이미지 작업이 아니라 이미 완료된 V27 판단과 오래된 인수인계 상태의 불일치를 정정한다.

| 항목 | 결과 | 근거·한계 |
|---|---|---|
| 현재 몬스터 manifest | 일치 | 254종 = authored234 / retained20 |
| 기존 retained89 판단 | scoped 완료 확인 | V27 교정69+유지20. 계획의2026-09-09 승인 기록과 adoption-review 최종 절, final-audit Monster254 항목을 연결 |
| V27 화면 receipt | 기록 대조 통과 | 390×844 fixture89종/고유89/HP감소89/overflow0/errors0. actualPlayClaim=false 유지 |
| art:monsters:verify | 통과 | 현재 source/runtime 자산 검증 exit0. manifest·이미지·기존 판단 receipt 변경0 |
| 추가 이미지 제작·전체 자연 플레이 | 미실행 | 이번 문서 정정의 범위 밖. 기존 scoped 리뷰를 사용자의 최종 제품 수용으로 확대하지 않음 |
| 실기기·서명·제출 | 미완료 / No-Go | A/C의 emulator/simulator 확인과 MOBILE_RELEASE §5 수용 조건을 구분 |

집계·해시는 `docs/evidence/qa/art-status-20260922.json`에 보존한다. `retained89-disposition-20260909.json`을 갱신하지 않았다. 인수인계 §7-D의 과거165/89·승인 대기 상태만 최신 정본으로 연결했다. Q4 미실행·Q7 URL 미제공, Q6 로컬 기록·Q8 계정1회 결정은 유지한다. `npm run verify` exit0: unit5,192/5,192(skip0)·type-check·lint·build guard 통과. `git diff --check` 통과. 9월22일 집계 기록을 보존하고 9월23일 문서를 마감했다. C merge의 main CI run35715043844 및 Deploy run35715043920도 성공했다. D의 원격 검사·merge 상태는 [PR #55](https://github.com/sungjin9288/aetheria-roguelike/pull/55)가 정본이다.

**다음 E의 입력 조건:** 9월23일 mobile:doctor와 read-only 기기 목록을 재확인했다. 물리 iPhone/Android 연결0, Android release signing·Apple Distribution identity 없음. doctor의 App Store export profile ok는 로컬 export options 파일 확인이며 provisioning profile 보유 증거가 아니다. Q7 URL 및 기기 사용 시간·서명 자산 입력을 기다리며, 실기기 조작·서명·업로드는 실행하지 않았다. Q4도 미실행이다.


### 26.8 제품 완성도 우선 — 이야기 결과 전달 (2026-09-28, 로컬 검증 완료)

소유자는 iPhone 보유·Android 실기기 미보유를 정정하고, 서명보다 디자인·기능·스토리 보완을 우선하도록 지시했다. `e7445523` 이후 첫 제품 묶음이다. 출시 자산 부재를 제품 개발 중단 사유로 사용하지 않는다. 전체 보완 순서와 수용 기준은 기존 게임 완성 계획의 2026-09-28 절과 tasks 최상단을 따른다.

실제390 첫 플레이에서 선택 결과(수정 동굴 단서)가 로그 하단 밖에 가려졌고 viewport ratio0으로 재현했다. 12개 이하 기록을 top0으로 돌리던 분기를 제거해 최신 선택과 비동기 story 교체를 따라가도록 수정했다. E2E 초기 exact text locator 실패는 badge 포함 문구 선택 오류였으며, 실제 행 locator로 정정한 뒤 화면 밖 ratio0 RED를 확인했다.

8개 story quest의 완료 표현은 title뿐인 generic AI/fallback 대신 accepted quest receipt ID로 고정 서사를 찾는다. 일반 임무는 기존 AI 경로 유지. 순서는80→81→82→84→83→85→86→87이며 지역 lore와 실제 목표·보상 소재를 따른다. 수령하지 않은 장은 공개하지 않고 기존 claimedQuestIds에서 기록을 재구성한다. 다음 임무 이름·수락 레벨은 DB에서 읽는다. 독립 검토에서 첫 장의 귀환 완료 전제를 지적해 장소 중립 문구로 교정했다. 새 save 필드/수치/전투 authority/바이트 핀 파일 변경 없음.

집중 unit43/43, 신규 unit2/2, 새 E2E 선택 가시성·첫 임무 수령/두번탭/기록·저장재실행 통과. 재실행은 별도 device-QA 저장 namespace에 기존 완료80 fixture를 넣은 검사이며 자연 신규 세이브의 전체 저장 증거로 확대하지 않는다. 첫 persistence 검사에서 설정 탭이 자동으로 열릴 것을 잘못 가정해 실패했고 실제 seed 완료 레벨을 기다린 뒤 같은 저장/복원 검사를 통과했다. 신규2종 결함 주입(완료문 제거/미수령 장 공개) 각각 exit1 후 복원 green. 신규 browser 결과는 output/playwright/product-20260928/에 보존한다. 375/390/430 본문 viewport/가로 overflow 통과, 캡처 직접검수. 게임 client 기본desktop 실행도 수행했다. 초기 HMR의 effect deps 길이 변경 콘솔 경고는 cold E2E와 분리한다.

증빙 예고 델타: progression sources 기존4개(TerminalView, QuestTab, messages, useGameEngine) 해시 변경과 새3개(StoryJournal, storyChapters, storyJournal) 추가,348→351. reportHash/v1Baseline 포함 nonSources와 나머지 증빙 값은 불변이어야 한다. 순차 writer 종료 뒤 readonly/full gate 실행. 당시 전체 통합·원격 PR/CI는 미실행이었으며 로컬 실행 결과는 아래에 기록한다. 진엔딩 진행 안내·초반 모험 동기/시각 구성·종장 자연 동선은 후속 제품 작업으로 남는다.

예고 델타 실측 일치: sources348→351, 기존4변경/새3추가/삭제0. nonSources 전체 및 reportHash `f21dcf819808a624d2d7f9d30b28a7d4b1403b8b3806383089453ef2ff731620` 불변. 순차 writer 종료 후 tracked verify15 전부 exit0. `VITE_RELEASE_ID=wave26-qa AETHERIA_RUN_PERF=1 npm run verify:full` exit0: unit5,194/355파일(skip0), E2E128/45spec(66+62), desktop/mobile smoke·perf 및 type/lint/build guard 통과. FCP desktop456ms/mobile320ms. smoke/perf의 browser.close timeout 경고4건은 게임 assertion 통과와 분리해 기록한다.

production `cap:sync`·Android debug·iOS unsigned build exit0. Android 최초 Gradle 캐시 metadata.bin 누락은 기존 스크립트의 새 임시 캐시 재시도로 해소했으며 소스/검사 완화 없음. APK227759206bytes/SHA256 `8f61124014e2d210d624de3f28d261d75744eb77961f4444f23fd2a95e42580c`, AppPlugin 포함. iOS `/tmp/aetheria-product-story-ios-20260928/Build/Products/Release-iphoneos/App.app`. production web2,267파일이 양쪽 패키지와 byte동일, native tracked delta0. mobile:doctor exit0이나 양 플랫폼 release 서명 조건 미충족은 유지. 실기기 실행·서명·설치·제출은 이번 묶음에서 미실행.

후속 제품 조사: 375px 상태바에서 생명 label 줄바꿈을 직접 관측했다. 종장 파편/계승 조건은 마왕 토벌 뒤 연속 전투 경로에 적용되며, 혼돈의 심연 구역 보스 경로는 별도로 존재한다(`maps`→`exploreActions`→`eventActions`→`endgameSettlement`). 소스 연결 확인이며 자연 플레이 증거는 아니다. 후속 안내는 경로를 특정하고 전투 gate를 임의 강화하지 않는다. PR/CI/merge는 원격 기록으로 후속 확인한다.


### 26.9 제품 완성도 — 여정 안내와 모바일 가독성 (2026-09-28)

PR #56은 CI 통과 후 merge `b685e00b`로 통합했다. 다음 `codex/product-journey-clarity`는 375px 상태바의 생명 label 줄바꿈 실측을 입력으로 이름/수치를 위아래로 분리하고, 긴 수치는 분수 경계에서만 줄바꿈한다. 첫 임무80의 미탐험 마을 화면에는 마법전쟁 이후 숲을 조사하는 이유를 지역 그림과 함께 표시한다. 첫 탐험/보상 수령/계승 뒤에는 반복하지 않는다.

임무·계승 화면의 마왕성 안내는 현재 계승 단계와 파편 수, 확률과 다음 행동을 실제 정산과 연결한다. 마지막 파편을 얻는 토벌에서 즉시 연속 전투가 시작될 수 있음을 명시한다. 예언의 마왕 세 번 표현을 계승3으로 정정하고, 도감에는 혼돈의 심연 구역 보스 경로도 구분했다. 새 저장 필드·경제/전투 수치·바이트 핀 변경 없음. 진엔딩 완료는 진입 경로와 무관하게 종장 기록으로 표시한다.

집중 unit44/44, 계약 결함 주입4종(계승 문턱 하향/미발견 공개/완주 오표시/시작 안내 반복) 각각 exit1 후 복원 green. 기존 화면 baseline에서 신규 E2E3 red, 최종 관련 E2E16/16 통과. 375/390/430×기본/고가독성 모드의 지표 겹침/넘침 검사,375×667 첫 안내·출발 버튼,390 계승·임무 안내 캡처 직접 검수. 긴 수치 fixture는 격리 device-QA 저장을 부트 전에 주입해 복원했으며 자연 성장이나 신규 세이브 전체 지속성 증거가 아니다. 최초 fixture 주입은 reload 이전 저장 flush로 level18이 유지되어 실패했으며, 부트 전 주입으로 검사 준비를 교정했다. 마왕성에서 마을 전용 버튼을 기다린 harness 실패도 실제 캐릭터 콘솔 경로로 교정했다. 게임 client 실제 실행 exit0/ready·idle 확인, 캡처 직접 검수. 독립 소스 검토에서 확정 결함0; 실제 자연 종장 플레이는 미실행이다.

**증빙 예고 델타:** progression sources351→353, 기존7개(StatusBar, TerminalView, AscensionScreen, QuestTab, messages, eventChains, monsters) sha256 변경과 새2개(EndgameJourney, endgameJourney) 추가. reportHash/v1Baseline 포함 nonSources 및 다른 증빙 값은 불변이어야 한다. 고정 순서 writer 종료 후 readonly15→full gate→native를 직렬 실행한다. 현재 전체 gate·새 native·원격 PR/CI/merge는 미실행이다.


최종 예고 델타 일치: sources351→353, 기존7/새2/삭제0이며 reportHash `f21dcf819808a624d2d7f9d30b28a7d4b1403b8b3806383089453ef2ff731620` 및 v1Baseline 포함 nonSources 전체 불변. tracked verify15종 모두 exit0. `VITE_RELEASE_ID=journey-clarity-qa AETHERIA_RUN_PERF=1 npm run verify:full` exit0: unit5,198/356파일(skip0), E2E132/46spec(66+66), type/lint/build guard·desktop/mobile smoke/perf 통과. FCP344/328ms. Desktop smoke의 browser.close timeout1건은 assertion 통과와 분리한다.

Production cap:sync·Android debug·iOS unsigned·mobile:doctor exit0. Android 기본 캐시 metadata.bin 누락 후 기존 스크립트의 새 캐시 재시도 성공. APK227759318bytes/SHA256 `0ab0a1a8e63fd9737d79e3b08f8755186cef454e3ad7ae43aaac21d60b6ab856`, AppPlugin 포함. iOS `/tmp/aetheria-journey-clarity-ios-20260928/Build/Products/Release-iphoneos/App.app`. 양쪽 패키지 web2,268파일 byte동일·native tracked delta0. Android release signing·Apple Distribution identity 부재 지속. 실기기·서명·제출 미실행, Q4 미실행/Q7 URL 미제공·Q6/Q8 유지. 전체 제품 수용·자연 성장 동선·MOBILE_RELEASE §5는 미완료다. 다음 제품 후보는 이야기86/87의 자연 진행 연결이며 경제/gate 변경 전에 실제 동선과 근거를 확인한다. PR/CI/merge는 원격 기록에서 확인한다. 상세 캡처·초기 실패·mutation·패키지 근거는 `docs/evidence/qa/journey-clarity-20260928/`에 보존한다.


### 26.10 제품 완성도 — 일반 계승의 미수령 보상 보호 (2026-09-28)

PR #57은 CI 통과 후 merge `538ad2a9`로 통합했다. 일반 마왕 전투 승리 뒤 완료87을 수령하지 않고 계승하면 임무가 초기화되어 다음 생 Lv50/마왕 재처치가 필요했다. `codex/ascension-pending-rewards`에서 실제 reducer 승리→수령→계승 경로로 baseline5 RED를 재현했다. 일반 계승 화면에 canonical 보상과 수령 action을 표시하고 화면/hook/reducer에서 완료 보상을 모두 받을 때까지 확정을 막는다. 현재 여정 계속은 허용하며 보상 장비·골드의 현행 초기화 정책을 안내한다. 진엔딩과 보상 행을 공유하고, 미완료 임무 초기화·계정당1회·경제/저장 schema는 유지한다.

오래된 action의 ASCEND가 최신 상태에서 거부돼도 hook이 칭호·성공 로그를 남기던 경로를 승인된 reducer 전이 안으로 옮겼다. 집중 unit33 통과(신규6). 보상 경험치로 새 임무가 완료되는 경계도 재검사한다. reducer/hook/UI 차단 제거와 거부된 요청의 성공 안내 주입4종 각각 exit1 후 원본 복원 GREEN. 독립 소스 검토에서 중요한 결함0, 실행은 주관 검증과 구분한다.

**증빙 예고 델타:** progression sources353→354, 기존4개(AscensionScreen, TrueEndingScreen, ascensionActions, progressionHandlers) sha256 변경과 새1개(PendingQuestRewardList) 추가. reportHash/v1Baseline 포함 nonSources와 다른 증빙 값은 불변이어야 한다. 고정 순서 writer→readonly15→full/perf→native 직렬 실행 예정이며 아직 전체 통과를 주장하지 않는다.

Browser 집중 E2E8/8 통과: 375/390/430 ordinary 승리→미수령 reload→두번 수령→두번 계승→저장 reload, 완료 임무 복수/현재 여정 계속, 기존 진엔딩4. Safe-area47/34와48px 버튼·가로 overflow 확인,375 캡처 직접 검수. 첫 harness는 계승 화면 뒤의 전설 overlay를 클릭하려다 timeout; 해당 불필요 클릭을 제거했고 fixture의 endgame 필드와 가방 이름을 실제 schema로 정정했다. 게임 client는 처음 잘못된 scenario 이름으로 intro를 관측했으며 실제 ascension-journey 이름으로 재실행해 ready/ascension 및 화면을 확인했다. 종장 전투 조건은 격리 fixture로 구성했으며 Lv1부터 자연 성장·실기기 증거로 확대하지 않는다.

첫 full gate는 unit5,201 PASS/3 FAIL(skip0)로 종료했다. 기존 두 검사가 hook에 남은 칭호 코드/이전 reducer 단독 결과를 전제해 실패했으므로 실제 action→reducer의 rank·essence·칭호 중복 제거 결과를 검증하도록 변경했다. 추가 칭호는 기존 hook에서 해금하던 처치200/계승1의 first_blood·centurion·reborn이며 영구 칭호 보존 검사는 유지한다. 신규 JSX 한글3문구가 components AST 상한1319를3초과해 messages.ts로 이관한다(상한 변경 없음). **예고 델타 정정:** 기존5개 변경(messages 추가)/새1개, sources353→354. nonSources 불변 조건은 유지한다.

최종 교정 focused242/242, 승인 칭호 누락 mutation 추가1종 RED→복원(총5종). 최종 sources353→354, 기존5/새1/삭제0으로 정정 예고 일치, reportHash `f21dcf819808a624d2d7f9d30b28a7d4b1403b8b3806383089453ef2ff731620` 및 nonSources 전체 불변. tracked15 모두 exit0. `VITE_RELEASE_ID=ascension-rewards-qa AETHERIA_RUN_PERF=1 npm run verify:full` exit0: unit5,204/357파일(skip0), E2E136/47spec(70+66), type/lint/build guard·desktop/mobile smoke/perf 통과. FCP360/304ms. desktop/mobile smoke와 desktop perf 종료 timeout3건은 assertion 통과와 구분해 기록한다.

Production cap:sync·Android debug·iOS unsigned·mobile:doctor exit0. 기존 정상 Gradle 캐시를 재사용해 이번 캐시 실패 없음. APK227759419bytes/SHA256 `7208299ee8ec6dc40fafe3efe2d3c6d8aa4662be1dde3324fd2965d5c715a200`, AppPlugin 포함. iOS `/tmp/aetheria-ascension-rewards-ios-20260928/Build/Products/Release-iphoneos/App.app`. 양쪽 web2,269파일 byte동일·native tracked delta0. release 서명 조건 미충족, 실기기·설치·서명·제출 미실행. Q4 미실행/Q7 URL 미제공·Q6/Q8 유지. 독립 소스 검토에서도 테스트 기준 완화/새 제품 결함0. 캡처·초기 실패·mutation·패키지 증빙은 `docs/evidence/qa/ascension-rewards-20260928/`에 보존한다.

후속 별도 결함: `questProgress`의 substring 목표 판정 때문에87(target 마왕)을 수락한 상태에서 마왕성의 마왕의 사도를 처치해도 progress1이 된다. 실제 RESOLVE_COMBAT_ACTION probe(seed11/now1000/적HP1)에서87 progress1·gameState idle·prestigeRank0을 확인했다. 실제 마왕 승리 전 종장 임무가 완료되는 문제이며 이번 보상 보호 수정에 섞지 않았다. 다음 묶음은 story 처치 목표 identity 판정이며 실제 마왕·phase baseName·기존 변형 몬스터 처리와86을 함께 회귀 검증한다. 전체 자연 성장·디자인/서사 수용·MOBILE_RELEASE §5는 미완료다.

### 26.11 종장 임무 87 목표 오인식 — 처치 목표 판정을 substring에서 종(baseName) 정확 일치로 (2026-09-28, 베이스 `main` = `5fe9f222`)

**재현(실제 리듀서, §26.10의 probe 그대로 — seed 11 / now 1000 / 적 HP 1)**: 87 수락 → 마왕성에서 `RESOLVE_COMBAT_ACTION`으로 `마왕의 사도`를 처치 → **87 progress 1 · `getClaimableQuestEntries` = [87] · gameState `idle`**. `재앙의 마왕의 사도`(baseName `마왕의 사도`)도 1. 대조군 `마왕`은 1 · `ascension`. 경로는 `combatHandlers.settleVictory → handleVictoryOutcome(combatVictory.ts:97, baseName || name) → CombatEngine.updateQuestProgress → syncQuestProgress`이고, 결함은 `questProgress.ts:124`의 `normalizedEnemyName.includes(String(questData.target))` 한 줄이다(변수명은 `prefixedMatch` — 의도는 `광폭한 슬라임` 같은 **접두 변형**의 크레딧이었고 가족 이름은 부산물).

**클래스 전수(데이터, 몬스터 이름 우주 254종 = `MONSTERS` 키 ∪ `MAPS`의 monsters/boss/bossMonsters)**: 몬스터 목표 임무 **104개** 중 **7개**가 다른 종에 반응했다(누수 쌍 **160** = 가족 이름 16 + 그 위에 접두어 10종을 붙인 144; 임무별 #1 40 · #87 40 · #99 40 · #3 10 · #8 10 · #35 10 · #140 10) — #1 `슬라임` ← 초록슬라임·잉크 슬라임·마그마 슬라임·꽃잎 슬라임 · #3 `코볼트` ← 코볼트 광부 · #8 `늑대` ← 서리 늑대 · #35 `뱀파이어`(암흑 성) ← 혈월의 뱀파이어 로드(그 지역 보스) · #99 `마왕 토벌`(location 없음) ← 마왕의 사도·**사슬 마왕**(어둠의 지하 감옥 Lv42)·차원 마왕·미궁의 마왕 · #140 `세계수 수호자` ← 타락한 세계수 수호자(해당 지역엔 없음) · #87. 일곱 임무의 정확한 목표는 전부 도달 가능한 지역에 스폰된다(슬라임·늑대 = 고요한 숲 Lv1, 코볼트 = 서쪽 평원 Lv3, 뱀파이어 = 암흑 성, 마왕 = 마왕성, 세계수 수호자 = 세계수 숲) — 정확 일치로 바꿔도 완주 불가가 되는 임무는 없다.

**설계 — 왜 "예외 목록"이 아니라 "정확 일치 + 장식 벗기기"인가**: 적 이름의 생산자는 `spawnEnemy` 하나이고 표시 `name`은 `${접두어} ${baseName}` 또는 `[${depth}층] ${baseName}` 두 형태뿐이다(접두어 = `CONSTANTS.MONSTER_PREFIXES` 9종 + 초반 정예 `정예`). 따라서 identity는 `baseName`이고, 장식만 벗기면 표시 이름에서도 종을 되찾는다. 예외 목록(`마왕의 사도`를 빼기)은 새 몬스터가 목표 문자열을 품는 순간 같은 결함을 다시 연다 — Wave 16의 "하드코딩된 한 지역"과 같은 클래스라 기각. 엔진의 `resolveEnemyBaseName`(`CombatEngine.loot.ts`, 첫 단어를 자른다)을 재사용하지 않은 이유: 그 규칙은 `baseName`이 없을 때 `마왕의 사도`를 `사도`로 만든다 — 임무 판정에는 **알려진 접두어일 때만** 자르는 쪽이 맞다. 새 `utils/enemyIdentity.ts`가 `EARLY_ELITE_PREFIX_NAME`(`정예` — 이전에는 `exploreUtils.ts:213`에 리터럴로만 있었다)·`stripEnemyDecoration`·`matchesQuestTarget`을 소유하고, `spawnEnemy`가 같은 상수를 읽는다(어휘 단일 원천). 바이트 핀 파일은 건드리지 않았다(`CombatEngine*.ts`·`combatHandlers.ts` 등 읽기만).

**계약 테스트 `tests/quest-target-identity.test.js`(7행)**: ① 실제 리듀서 — 사도·접두 사도·baseName 없는 레거시 사도 전부 progress 0 / claimable [] / idle ② 비공허 — `마왕`·`재앙의 마왕`(baseName `마왕`)은 1 · ascension ③ **전수** — 104 임무 × 다른 종 전부(목표 문자열을 품은 종은 접두어 10종을 붙인 형태까지) **26,456쌍** progress 0 ④ 비공허 — 104 임무 전부 정확한 종 처치에 1 ⑤ 장식 크레딧 보존 — 접두어 10종·`[12층]` 붙은 슬라임은 1, `초록슬라임`·`잉크 슬라임`은 0, `stripEnemyDecoration('마왕의 사도') === '마왕의 사도'` ⑥ `spawnEnemy` 실행 — rng 0에서 `정예 ${baseName}`, 무한 심연 rng≈1에서 `[12층] …`, 둘 다 `matchesQuestTarget(name, baseName)` ⑦ 인접 스토리 85(`마왕의 사도` 5명 — `마왕` 처치는 세지 않는다)·86(`에테르 파편체`) 회귀. 수정 전 RED = ①·③·⑤(③의 첫 12쌍: `#1 슬라임 ← 초록슬라임`, `← 허약한 초록슬라임`, … `← 잉크 슬라임`), GREEN = ②·④·⑥·⑦ — 하네스가 결함을 판별하고 픽스처를 판별하지 않는다는 증거.

**결함 주입(각각 적용 → 실행 → 복원)**: (a) `matchesQuestTarget(…)`을 옛 `normalizedEnemyName.includes(String(questData.target))`로 되돌림 → **①③⑤ red**(4/7) (b) `matchesQuestTarget`에서 장식 벗기기 분기를 제거(정확 일치만) → **⑤⑥⑦ red**(4/7 — ①②는 baseName 경로라 그대로 초록, 장식 크레딧이 사라지는 것은 ⑤·⑥·85의 `정예 마왕의 사도`가 잡는다) (c) `spawnEnemy`의 접두어를 상수 대신 리터럴 `'엘리트'`로 분리 → **⑥ red**(6/7). 세 주입이 서로 다른 부분집합을 붉히므로 7행은 각자 자기 결함을 판별한다. 복원 후 7/7.

**Codex §26.10이 남긴 회귀 항목**: 실제 마왕 ✔(②) · phase baseName — `CombatEngine.enemyAI.ts`에 phase 전환 시 `name`/`baseName`을 바꾸는 코드가 **없다**(grep 0건)라 판정에 영향 없음 · 기존 변형 몬스터(접두어) ✔(⑤·⑥) · 86 ✔(⑦).

**게이트**(head `81a0fc66` 코드 = 이후 문서 커밋과 동일 코드, 직렬 07:00~07:22): type-check 0 · lint 0 · unit **5,211 / 5,211**(358파일, skip 0 — Codex 5,204 대비 +7 = 새 계약 7행) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **136 / 136**(shard 70 + 66) · perf desktop FCP 644ms / mobile 380ms · 증빙 tracked verify 15종 ok. 인접 스위트 18개 개별 실행 전부 초록(quest-progress 15 · quests-cycle 86 · cycle-067-099 73 · cycle-500-599 250 · ascension-pending-rewards 6 · true-ending-flow 7 · early-elite-spawn 4 · content-reachability 16 …).

**증빙 예고 델타**: `progression-diagnostic-v2` `sources`만 — `src/**`를 디렉터리 순회로 모으므로 새 파일 `src/utils/enemyIdentity.ts`가 **+1**(354 → 355), 기존 `questProgress.ts`·`exploreUtils.ts` 2개 이동, 삭제 0. `reportHash`/`v1Baseline`/나머지 nonSources는 불변이어야 한다(시뮬레이터·진단은 `questProgress`를 import하지 않고, `spawnEnemy`의 산출 문자열은 동일하다). **실측 일치**(고정 순서 writer 5단계 직렬, 06:46~06:52): 바뀐 키 `sources`뿐, 354 → 355, 추가 1 = `src/utils/enemyIdentity.ts`, 이동 2 = `exploreUtils.ts`·`questProgress.ts`, 삭제 0, `reportHash` `f21dcf81…` · `v1Baseline` 불변. tracked verify 15종 전부 ok.

## 27. Wave 27 — 스토리 경로 자연 플레이 감사와 결함 수정 (2026-09-28, 베이스 `main` = `1ad3fe8e` = PR #59 merge commit)

### 27.1 감사 — 무엇을 어떻게 돌렸나

Codex 백로그의 마지막 미결 행("스토리 경로 자연 플레이")을 실제 액션 팩토리(`createGameActions`·`createEventActions`·경제/퀘스트 액션) + 실제 `gameReducer`로 돌렸다. 테스트 API 시드나 상태 주입 없이 새 세이브 → 스토리 87 수령 → 계승까지 **16런**(드래곤 나이트 10 · 대마법사 3 · 사냥의 군주 3). 결과: 16/16 계승 도달 · 붕괴/소프트락 0 · 저장 봉투 왕복 **1,444회 diff 0** · 묘비 **41/41 회수** · PR #59 수정(임무 목표 정확 일치)이 진행 증가 701건 전부에서 유지.

**찾은 결함 9종**(D1~D9). 코드로 닫은 것은 D1·D2·D3·D5·D6(authority)·D8·D9 + 감사 중 통합자가 찾은 경로 안내 결함이고, D4·D6(서사 공백)·D7은 소유자 결정으로 남긴다(§27.5).

| id | 증상(실측) | 원인 |
|----|-----------|------|
| D1 | 폴백 비용 거래 3종의 비용 선택지가 **157/157 무반응** | 포장기가 원장의 2선택지를 3개로 채웠고, 검증기는 원장과 구조 동치를 요구 |
| D2 | 보상으로 21/20이 된 가방에서 **순증 0 장비 교체까지 거부** | `equipmentHandlers`가 교체 뒤 크기만 봄 |
| D3 | 체인 완주 유물로 rank 0에서 **6/5 · 7/5** | 훅 경로(`eventActions`)에만 상한 검사 없음 |
| D5 | 북부 권역 8곳이 Lv20~34로 표시·보고, 실제 걷는 길은 **전부 Lv35** | `mapRouteGate` 자체 보행이 계절 지역을 통과 |
| D6 | 종장 87 보고 **L50/65.9h**, 실측 첫 수락 중앙값 165h(Lv68) | 리포트 임무 게이트가 `minLv`만 봄 |
| D8 | 기력 133/123 · 718/708(생명은 재현상 399/241) | 유효 최대치가 줄어도 현재값 유지 |
| D9 | 치를 수 없는 한정 조우 선택이 이유 없이 무반응 | 거부가 `applied: false`뿐 |
| 경로 안내 | 839쌍이 걸을 수 없는 경유지를 "다음 이동"으로 안내 | `findMapPath`가 출구 순서 최단 BFS |

### 27.2 트랙과 결과 (파일 교차 0으로 병렬, 통합은 cherry-pick)

- **경로 안내** (`f8e53db8`): `findMapPath` = 경유지 병목 진입 레벨 최소 → 최단, 계절 지역은 목적지가 아니면 경유지 불가(그 길밖에 없으면 그 길이라도). `tests/mission-route-walkable.test.js` 4행(실데이터 전수 >1,500쌍, 오라클 = `getReachableMaps`/`getMapAccess`), 수정 전 4/4 red. 계절 경유지 행은 실데이터에 계절 지역으로 들어가는 출구가 **0개**라 공허했다 — 합성 지도로 다시 썼고 주입(b)가 그제서야 red. 주입 3종이 각자 다른 행을 붉힌다.
- **N1 — 이벤트 무반응** (`571706ea`): 생산자는 원장 event를 그대로 내보낸다(2선택지). 정본 아닌 이벤트는 지급 없이 `MSG.EVENT_CHOICE_OFFER_INVALID`. 거부 문장은 `currentEvent.choiceFeedback`(`rejectEventChoice`)에 싣고 `getEventChoicePreview`가 누른 선택지 줄로 그린다(EventPanel 무수정). D9는 `applyBoundedEncounterChoice`가 부족분(자원·필요·현재)을 돌려주고 리듀서가 MSG로 문장을 만든다. 계약 23행(수정 전 19 red), 주입 10종 red. 기존 `bounded-encounter-integration`의 가방 가득 행은 다른 조우에 `repair-cart`를 눌러 `invalid_choice`로 통과하던 **공허참**이었다.
- **N3 — 경로 게이트·임무 게이트 authority** (`9d4208e4`): 보행을 `getReachableMaps`(시즌 없음)에 위임. 걸어서 못 들어가는 3곳(봄의 정원·서리 폭풍 유적 = 시즌, 고대 보물고 = 열쇠)은 게이트 `null` + `cost.mapsWithoutWalkingRoute`. 임무 게이트 = max(수락 게이트, 목표 지역 경로 게이트), 수락 게이트 = max(`minLv`, 선행 임무 목표 게이트). 괴리 지역 10 → **16**, 87 L50 → **L68/170.23h**, 84 L28 → L35, 체인 완주 버킷 `[[35,3],[40,3],[48,5],[68,2]]`(승천 전 완주 11/13 유지), `behind` 44 → 38행. `schemaVersion` 4 → 5. 계약 `route-gate-move-rule-contract` 7행(수정 전 7/7 red).
- **N2 — 가방·유물·최대치** (`72438e96` D2 · `809908da` D3 · `35c5e62f` D8): ① 보상은 잃지 않는다(지급 쪽 상한 검사 없음) ② 상한은 증가만 막는다(`utils/inventoryCapacity.ts`) — 발견 체인이 가득 찬 가방에서 보상 아이템을 조용히 버리던 cycle 182 게이트도 제거. 유물은 상한에서 교체 제안(`AT.REPLACE_RELIC`, `RelicChoicePanel` 교체 버튼) — 스텝은 진행, 유물 수 불변, 보상 소실 없음. `ADD_RELIC`도 상한에서 거부. `clampVitalsToEffectiveMax`는 넘친 쪽만 내리고 올리지 않는다(장비 교체·`ADD_RELIC`·`REPLACE_RELIC`·체인 직접 지급·일일 파편 변환). 신규 28행.
- **통합 후속** (`b81d6708`): N1이 남긴 두 무반응 경로. ① 원장 desc를 가진 폴백 이벤트의 거래 id가 없거나 다른 거래를 가리키면(거래 id 도입 전 세이브·변조) 훅이 **모든 선택지**를 삼켰다 → 비용 선택지는 원장 id로 리듀서에 보내 무효 제안으로 거부, 비용 없는 선택지는 일반 경로. ② 체인 골드 선택의 거부 3종(골드 부족·유물 중복·슬롯 가득)이 로그만 남겼다 → `rejectEventChoice`. 이때 체인 정본 판정(미루기·골드 선택)의 **전체 이벤트 구조 비교**가 `choiceFeedback`을 품으면 한 번 거부된 이벤트가 영구 무반응이 되므로 `storyShape`로 표시 필드를 빼고 비교한다. 슬롯 가득 문구는 "자리를 마련한 뒤" → "다른 선택지를 고르세요"(이벤트 중에는 유물을 비울 수 없다). 계약 12행(착수 12/12 red). 주입 5종: 훅 무반응 복원 → 6 red · 골드 선택 전체 비교 → 1 · 미루기 전체 비교 → 1 · 체인 거부 로그 전용 → 5 · 리듀서 id 불일치 동일 참조 → 6. 기존 `event-chain-gold-affordability` 3행은 "거부 = 같은 `currentEvent` 참조"로 **무반응을 고정**하고 있어 "이야기 불변 + 이유만 추가"로 갱신했다.

### 27.3 증빙 델타 (고정 순서 writer 5단계 + `relic-event-chance --write`, 직렬 09:49~10:03)

- `content-reachability`: `schemaVersion` 4 → 5, `reportHash` `d2d37207…` → **`822a7f4e…`** — N3가 격리 워크트리에서 예고한 값과 **본문까지 일치**.
- `progression-diagnostic-v2`: 바뀐 키 `sources`뿐 — 355 → 358(추가 3 = `eventChoiceFeedback.ts`·`effectiveVitals.ts`·`inventoryCapacity.ts`), 이동 21, 삭제 0. `reportHash` `f21dcf81…`·`v1Baseline` 불변(시뮬레이터·진단 산출은 그대로).
- `relic-event-chance`: `authorityHashes.eventReward`만 이동(`eventActions.ts`), `reportHash` `424909de…` 불변. N2 예고값(`1fb983ae…`)이 아니라 `7cac1f0c…`인 이유는 통합 후속이 같은 파일을 한 번 더 고쳤기 때문이다.
- `event-reward-coherence`·`equipment-combat-power`: 재생성 결과 바이트 불변.
- tracked verify **15/15 ok**.

중간에 한 번 체인을 멈췄다: `MapNavigator.tsx`·`messages.ts`의 "괴리 10곳" 주석이 N3 이후 틀린 값이 됐는데, 두 파일 모두 소스 해시가 핀돼 있어 체인 도중에 고치면 방금 쓴 증빙이 stale이 된다. 주석을 먼저 고치고(`a811e15b`) 체인을 처음부터 다시 돌렸다.

### 27.4 게이트 (head `74e17386`, 직렬 10:03~10:24)

type-check 0 · lint 0 · unit **5,293 / 5,293**(364파일, skip 0 — §26.11의 5,211 대비 +82 = 신규 6파일 + 기존 파일 갱신) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **136 / 136**(shard 70 + 66) · perf desktop FCP 560ms / mobile 376ms · 증빙 tracked verify 15종 ok. 실기기 QA·출시 수용은 이 wave의 범위가 아니다.

### 27.5 소유자 결정으로 남기는 것 (이번 wave에서 구현하지 않음)

| 항목 | 실측 | 선택지와 대가 |
|------|------|---------------|
| D4 서명 아이템 가방 점유 | 판매·합성·장착·버리기 전부 불가. Lv50 이후 7~11칸 점유, 루팅의 80~92%가 용량에 막힘 | (a) 판매/분해 허용 — 공간을 얻고 수집 의미를 잃는다 (b) 가방 밖 보관함 — 수집을 지키고 세이브 필드·UI가 늘어난다(`DATA_VERSION` bump 검토) (c) 현행 |
| D6 85 → 86 서사 공백 | 86 `minLv` 68, 스토리 없는 104~162 모델시간. 마왕 처치마다 계승 제안이 반복(런당 70~112회, 85 진행 중에도) | 86 게이트를 내리거나 중간 스토리를 넣는 것은 콘텐츠 결정. 계승 제안 빈도(런당 1회 / 87 이후)는 루프 결정 |
| 목표 지역에 닿기 전 수락 가능한 임무 20개 | 2·12·26·27·28·38·39·84·105·109·122·123·124·135·140~142·146~148 (보물고 136·137은 별도) | 수락 게이트에 경로 게이트를 넣으면 보드가 정직해지고 수락 시점이 늦어진다. 지금은 리포트(`questGateDivergence`)에만 반영 |
| D7 레벨 1~6 지역의 완전 정예 | 재앙의(2.5×)·고대(1.8×) 각 ~2.4%(Lv1), 감사 사망 41건 중 37건이 정예 | 접두어 등급을 지역 레벨로 제한하면 초반 사망이 줄고 `spawnEnemy`를 쓰는 성장 모델 해시가 움직인다(밸런스 변경) |

### 27.6 잔여 (알고 남긴 것)

- 칭호 전환(`SET_PLAYER` activeTitle)이 유효 최대치를 낮춰도 클램프하지 않는다 — D8과 같은 클래스, 전이 하나 남음. **→ 해소: §30**
- `pendingRelics`는 세이브 봉투 밖이다 — 상한 교체 제안 중 리로드하면 제안이 사라진다(체인 스텝은 이미 진행). 기존 유물 발견 제안과 같은 클래스. **→ 해소: §34**
- 일일 파편 변환의 유물 상한은 5 고정(프레스티지 rank 무시). 체인 직접 지급은 `stats.relicCount`를 올리지 않는다(골드 경로는 올린다). **→ 해소: §30**
- 상인의 인장은 유물 상한에서 살 수 없다(거부 + 다른 선택지 안내). 골드 경로를 교체 제안으로 바꾸면 2000G를 낸 뒤 제안을 넘기면 골드만 잃는 선택이 생겨 거부를 유지했다.
- 상한 교체 패널은 렌더 단언만 있고 e2e 스펙이 없다. **→ 해소: §30**

## 28. Wave 28 — 소유자 결정 4건 구현 (2026-09-28, 베이스 `main` = `e395fbee` = PR #60 merge commit)

§27.5의 네 항목에 소유자가 전부 권장안을 골랐다: D4 "쓸모없는 사본만 판매" · D6 "86을 승천 지점 안으로 이동 + 계승 모달 반복 억제" · 임무 "수락은 두고 보드에 진입 Lv 표시" · D7 "초반 구간은 완전 정예 제외".

### 28.1 설계와 근거

- **D4 서명 판매** (`utils/signatureSale.ts`): 판매 가능 = ① 같은 이름의 사본이 가방·장비에 하나 더 있음 ② 현재 직업과 앞으로 전직할 모든 직업(`CLASSES[*].next` 전이 폐포)이 착용 불가. 쓸 수 있는 유일한 사본만 보호한다. 근거: 도감은 획득 순간 `stats.codex`에 기록되고(`signatureDiscovery.ts`) 가방은 승천 때 비워진다(`permanentProgress.ts`) — 가방 사본의 가치는 "이번 런에 장착할 수 있느냐"뿐이다. 직업 판정은 `canEquip`과 같은 `item.jobs` 규칙, 직업을 모르면 ②는 성립하지 않는다(fail-closed). 합성은 그대로 서명을 쓰지 않는다. 리듀서와 상점 UI가 같은 유틸을 읽는다.
- **D6a 86 이동**: 목적지는 Wave 15 G1과 같은 기준의 교집합으로 골랐다 — ① 경로 게이트 ≤ 48 ② 85(48) 이상 ③ `type !== 'safe'` ④ 목표 몬스터가 실제로 스폰 ⑤ 다른 임무 목표·보스와 겹치지 않음 ⑥ 심연 층 스케일링 없음. 교집합은 마왕성의 `지옥의 문지기` 하나였고 '관문·균열' 주제와도 맞는다. 제목·보상 유지, 87 `minLv` 50 → 48(첫 마왕 처치 = 계승 제안 지점), 스토리 85·86 문구는 "지옥의 문 너머의 균열 → 멀리 에테르 관문까지"로 고쳐 에테르 관문을 후일담으로 남겼다. 87: 170.23h(L68) → **53.38h(L48)**.
- **D6b 계승 제안 미루기**: 계승 화면에서 미루면 `AT.DEFER_ASCENSION`이 런 범위 선택 필드 `player.ascensionOfferDeferred`를 세우고, `endgameSettlement`가 그 런의 마왕 처치를 `idle` + 로그로 정산한다(처치 기록·영수증은 그대로). 조작판 [계승하기] → `AT.REOPEN_ASCENSION`(idle · 미룸 표시 · 처치 영수증 모두 필요 — 리듀서 게이트). 필드는 `pickPermanentPlayerState`에 없으므로 승천·사망으로 사라진다(DATA_VERSION 불변). 진엔딩 화면의 취소는 이전 동작 그대로.
- **임무 보드 진입 레벨** (`utils/questObjectiveGate.ts`): 수락 규칙은 그대로, 게시판(추천·진행 중·다른 임무)과 임무 탭이 "목표 지역 X · 레벨 N부터 걸어서 진입"을 **지금 레벨로 아직 못 들어갈 때만** 그린다. 목표 지역 규칙은 도달 비용 리포트와 같고, 20개 임무 전부에서 같은 지역·같은 레벨을 내는지 테스트가 대조한다.
- **D7 초반 완전 정예 제외** (`exploreUtils.spawnEnemy`): 맵 레벨 ≤ `EARLY_ELITE_LEVEL_CAP`(6)에서 일반 접두어 풀이 `isElite`(재앙의 2.5× · 고대 1.8×)를 빼고 뽑는다. 롤 수는 그대로. 초반 전용 완화 정예(`정예` ×1.4) · `eliteOnly` 도전 · 프레스티지 정예는 유지(플레이어가 고른 난이도).

### 28.2 성장 모델 이동 (D7 — 의도된 변경)

시뮬레이터가 `spawnEnemy`로 조우하므로 곡선이 움직였다. 체크포인트 액션 14/52/82/164/1,575/5,246/8,176 → **16/56/87/167/1,579/5,249/8,179** — 초반 완전 정예의 2~3배 경험치가 빠진 만큼 초반이 2~5 액션 느려지고 그 차이가 뒤로 이어진다. 골든 해시 `ac79428c…` → `10e22d29…`. **이 편집 하나만 되돌리면 이전 값이 그대로 재현된다**(실측 — 같은 wave의 다른 변경은 모델 해시를 움직이지 않는다: 시뮬레이터는 임무·상점·계승 미루기를 쓰지 않는다). 파생 값: 마왕성 53.28h → 53.38h, tier-3 직업 39.38h → 39.48h(여유 13.9h 그대로), Lv60 131.15h → 131.23h, 에테르 관문 170.23h → 170.3h. 게이트 레벨과 체인 구조는 불변.

### 28.3 테스트와 결함 주입

신규·교체: `early-full-elite-band`(4) · `ascension-deferral-contract`(7) · `quest-objective-gate`(5) · `signature-sell-protection`(9 — 소스 정규식 가드를 행동 테스트로 교체) · `content-reachability` 본편 사슬 행(+1). 기존 갱신: `content-reachability`(87 괴리 행 제거 21 → 20, 모델 시간값) · `quest-target-identity`(86 목표) · `event-chain-cost` · `route-gate-move-rule-contract` · `progression-simulator`(골든 해시).

결함 주입 11종(적용 → 실행 → 복원): P1 BFS 제거 → 2 red · 중복 판매 금지 → 2 · 리듀서 옛 차단 → 3 / P2 86 되돌림 → 5 / P3 정산이 미룸 무시 → 2 · 훅이 미루기 안 씀 → 3 · 재오픈 게이트의 미룸 검사 제거 → **처음 0 red(공허참)** / P4 레벨 무시 → 3 · 최소 대신 최대 → 2 · 보드 미표시 → 1 / P5 초반 풀 되돌림 → 1. 재오픈 주입이 안 잡힌 이유는 "미룬 적 없음" 픽스처에 처치 영수증이 없어 영수증 검사가 대신 막았기 때문이다. 실제 위험은 **승천 뒤 새 런**이다 — 이전 런의 영수증이 영구 `meta`에 남아 있어, 미룸 검사가 없으면 마왕을 잡지 않고 계승할 수 있다. 그 행을 추가해 판별을 확보했다(1 red).

### 28.4 새로 드러난 것 (소유자 결정 후보, 이번에 고치지 않음)

- **`boss` 문자열만 있고 `bossMonsters`가 없는 지역 14곳은 모든 일반 스폰이 `isBoss`다** — `spawnEnemy`의 `(mapData.boss && mapBossMonsters.length === 0)` 분기(2026-08-04부터). 실측 300/300: 신성한 호수(7) · 고대 하수도(10) · 몰락한 전초기지(18) · 저주받은 묘지(34) · 암흑 성(35) · 용암 지대(36) · 세계수 숲(38) · 폭풍의 고원(38) · 천공 정원(40) · 고대 신전 도시(50) · 심해 회랑(52) · 붕괴된 마법 요새(62) · 차원의 균열 전초기지(62) · 종말의 전장(73). `isBoss`는 전리품(`CombatEngine.loot` 5곳) · 처치 기록 · 적 AI · 도주 · UI 등 20여 곳이 읽으므로, 이 지역들은 접두어·정예가 전혀 없고 일반 몬스터가 보스로 정산된다. 구역 보스가 게이지 도전으로만 스폰되도록 바뀐 2026-07 이후 이 분기의 전제가 깨진 것으로 보인다. 고치면 경제·성장 모델이 크게 움직이므로 소유자 결정이다. **→ 실측·정정·해소: §29**(날짜 경계 · 접두어/정예 · 도주 · "성장 모델이 크게 움직인다"는 서술이 실측과 달랐다 — §29.3).

### 28.5 증빙 델타 (고정 순서 writer + 모델 기준선 갱신, 13:55~14:20)

- `progression-diagnostic-v2`: **리포트가 움직였다**(D7) — reportHash `f21dcf81…` → `f5bc5285…`, 바뀐 키 `combat` · `loot` · `rewardProgression`. 64시드 전리품 굴림 2,258 → 2,243(초반 정예의 드롭 배율이 빠진 만큼), 가방 차단도 같은 폭 감소, 체크포인트 p10 +1 액션. writer의 하드 게이트 `PROGRESSION_V1_BASELINE_HASH`가 처음에 `PROGRESSION_SCHEMA_V1_BASELINE_DRIFT`로 쓰기를 거부했다 — 의도된 이동이라 D7 하나만 되돌려 이전 값 `2573fa0f…`이 재현되는 것을 확인한 뒤 `b89b9018…`로 갱신했다. sources 358 → 360(`signatureSale.ts` · `questObjectiveGate.ts`).
- `exploration-rhythm`: 리듬 지표 불변, 내장한 성장 모델 리포트 해시 둘(focused · full)만 이동 — `pacing:verify`가 먼저 stale로 실패해 `--write`로 재생성했다.
- `content-reachability`: reportHash → `34d3c817…` — 본편 86 · 87 게이트 48과 D7 앵커 이동. 게이트 레벨 · 체인 구조 불변.
- `relic-event-chance` · `event-reward-coherence` · `equipment-combat-power`: 바이트 불변.
- tracked verify **15/15 ok**.

### 28.6 게이트 (head `54360d59`, 직렬 14:21~14:43)

type-check 0 · lint 0 · unit **5,316 / 5,316**(367파일, skip 0 — Wave 27 5,293 대비 +23) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **136 / 136**(70 + 66) · perf desktop FCP 604ms / mobile 636ms · tracked verify 15/15. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 29. Wave 29 — 보스 필드 14곳의 일반 스폰 (2026-09-28, 베이스 `main` = `e89097d1` = PR #61 merge commit)

§28.4의 후보를 소유자가 "시뮬레이터로 먼저 실측"하라고 했고, 실측을 본 뒤 "전부 수정"을 골랐다. 수정은 한 줄이다 — `spawnEnemy`의 `isBoss`에서 `(mapData.boss && mapBossMonsters.length === 0)`를 지운다. 보스 여부는 몬스터가 정한다(자기 프로필 · 지역 `bossMonsters` · `BOSS_MONSTERS`). 지역의 `boss` 문자열은 구역 보스의 이름일 뿐이다. `boss: true` 지역 9곳은 전부 `bossMonsters` 목록이 있어 그 분기는 **string `boss` + 목록 없음 14곳에서만** 살아 있었다. 그 14곳의 구역 보스는 전부 자기 프로필로 보스라 게이지 도전은 그대로다.

### 29.1 실측 방법

- **성장 모델 A/B**: 격리 worktree 두 벌(수정 전·후)에서 `simulateProgression`을 64시드(20260810~) 돌렸다. 메인 루프에 스폰 로그를 다는 측정 전용 계측을 넣었다(커밋하지 않음). 진단(`buildProgressionDiagnostic`, 64 + 1,000시드)도 양쪽에서 돌렸다. 수정 전 진단은 커밋된 증빙 리포트와 **바이트 동일**함을 먼저 확인했다.
- **지역별 A/B**: 14곳 각각을 경로 게이트 레벨의 플레이어로 4,000회 스폰하고 실제 `processLoot` · `CombatEngine.handleVictory` · `getSellPrice`로 정산했다(시드 고정 도메인 스트림).
- 모델 밖 정산(첫 토벌 골드 · 보스 처치 수 · 시즌 XP)은 계측 로그의 스폰을 실제 규칙(`FIRST_BOSS_BONUS_*` · `SEASON_XP`)으로 합산했다. 게이지 도전 보스전은 모델에 없으므로 수정 후 보스 처치 수는 **하한**이다.

### 29.2 결과

| 축 | 수정 전 | 수정 후 | 비고 |
|---|---|---|---|
| 체크포인트 액션(64시드 평균) Lv45 · 60 · 75 | 1,599.4 · 5,258.8 · 8,179.7 | 1,600.6 · 5,263.3 · 8,183.8 | +0.07% · +0.09% · +0.05%, 시드별 Δ −52~+72(잡음) |
| 진단 1,000시드 p50 Lv45 · 60 · 75 | 1,601 · 5,260 · 8,183 | 1,603 · 5,262 · 8,181 | 진단의 `combat` · `loot` · `exploration` 절은 **바이트 동일** |
| 모델 장비 시도 / 레벨 차단(64시드 평균) | 1,049.6 / 893.8 | 685.6 / 529.3 | 최고 장착 tier는 모든 체크포인트에서 동일 |
| 14곳 보스 판정률 | 100% | 0%(붕괴된 마법 요새 16% = `에테르 거인` 자기 프로필) | 접두어 ~20% · 정예 ~5%는 **양쪽 동일** |
| Lv34~50 7곳 장비 드롭/처치 | ~0.25개, tier 6.0, 지금 장착 가능 0% | ~0.06개, tier 3.1~4.1, 93~97% | 보스 보너스(0.25 · 추정 tier) → 일반 보너스(0.06 · 지역 tier) |
| 같은 7곳 장비 판매 가치/처치 | 7,499~8,192골드 | 116~728골드 | 적 골드는 처치당 92~178 |
| 마왕성(Lv48) 전 누적 판매 가치(이 지역 처치 631회) | 3.44M | 0.13M | 같은 구간 적 골드 합계 0.22M |
| 프레스티지 rank ≥3 장비/처치 | 1.03~1.40 | 0.05~0.40 | 보스 처치마다 희귀 장비 보장이 일반 처치에 걸렸다 |
| Lv48 전 보스 처치 수 | 657 | 27(하한) | 1·10·25·50번째 처치 레벨 7·11·20·34 → 20·26·35·48 |
| Lv48 전 첫 토벌 보너스 골드 | 6,651 | 714 | 적 골드의 약 3% — 작다 |
| Lv48 전 처치 시즌 XP | 40,794 | 12,469 | 시즌 하나 = 6,000 XP(6.8 → 2.1 시즌분) |

요약: **곡선(EXP)은 움직이지 않는다.** 움직이는 것은 모델 밖에 있던 판매 골드 유입(마왕성 전 적 골드의 15.6배)과 보스 계수(업적 · 칭호 · 퀘스트 93 · 주간 보스 · 시즌 XP · 서명 pity — pity는 50회 처치에서 상한 ×2.5라 Lv34 전후에 포화)다. 그리고 이 14곳에서는 전투 후 선택 카드가 뜨지 않았고(보스 승리로 판정), `eliteOnly` 도전 · 프레스티지 정예 · 정예 격노 페이즈가 적용되지 않았다. 수정 후에는 전부 복원된다.

### 29.3 §28.4 정정

- "2026-08-04부터"는 틀렸다. 이 클론은 shallow이고 `71792559`(2026-08-04)가 그 경계다. 분기는 TS 이관 커밋에 이미 있었고 기원은 알 수 없다.
- "접두어·정예가 전혀 없다"도 틀렸다. 일반 접두어(20%)와 정예 접두어는 그대로 붙었다. 막혔던 것은 `eliteOnly` 도전 · 프레스티지 정예 · 정예 격노 페이즈다.
- "도주"는 `isBoss`를 읽지 않는다(`attemptEscape`는 `ESCAPE_CHANCE`만 본다).
- "고치면 성장 모델이 크게 움직인다"도 틀렸다. 64시드 평균 ±0.1%다. 크게 움직이는 것은 모델이 세지 않는 경제다.
- **증빙 커버리지 공백**: 진단의 `loot.jobs`는 직업별 `reqLv` 지역(지하 미궁 등)에서, `signatureBosses`는 강제 보스전으로만 표본을 뽑는다. 그래서 14곳 중 어느 곳도 표본이 아니었고 A/B가 바이트 동일했다. 이 결함 종류는 증빙으로는 잡히지 않는다 — 지역별 행동 테스트(`tests/boss-field-normal-spawn.test.js`)가 지킨다.

### 29.4 테스트와 결함 주입

`tests/boss-field-normal-spawn.test.js` 5행이다. ⓪ 대상 14곳 목록과, 그 구역 보스가 전부 보스 프로필임을 고정한다(②의 전제). ① 14곳 × 200 스폰에서 `isBoss === 자기 프로필 보스`, 지역마다 일반 표본 > 0. ② 게이지 도전(`forceAreaBoss`)은 구역 보스를 보스로 스폰한다. ③ 저주받은 묘지 일반 처치 8종은 첫 토벌 보너스 없음 · `bossKills` 0 · 처치 기록 1. ④ 14곳에서 `eliteOnly` 도전이 일반 몬스터를 정예로 만들고 격노 페이즈가 붙는다. 수정 전 코드에서 ① · ③ · ④가 red였다(②는 전제 행이라 green). 반대 방향 주입(프로필 보스 판정 제거)은 ① · ②가 red로 잡는다.

성장 앵커 9건은 기준 시드의 잡음 이동이다. 시뮬레이터 골든 `10e22d29…` → `2ecb560d…`(기준 시드 체크포인트 16/56/87/167/1,579/5,249/8,179 → 16/56/86/166/1,594/5,274/8,198), v1 기준선 `b89b9018…` → `696607d2…`. 두 이전 값은 수정 전 worktree에서 그대로 재현된다. 그 결과 content-reachability 앵커가 움직였다: 마왕성 53.38h → 53.78h, tier-3 직업 39.48h → 39.85h(여유 13.93h), Lv35 12.08h → 12.13h, Lv68 170.3h → 170.83h. 게이트 레벨과 체인 구조는 불변이다.

### 29.5 증빙 델타 (고정 순서 writer + 모델 기준선 갱신)

- `progression-diagnostic-v2`: reportHash `f5bc5285…` → `bc21a0de…`. 바뀐 절은 **`rewardProgression` 하나**다(1,000시드 체크포인트 분포 — p50 ±2 액션). `combat` · `loot` · `exploration`은 바이트 동일이다(§29.3의 커버리지 공백). 기준선 게이트 `PROGRESSION_V1_BASELINE_HASH`는 `b89b9018…` → `696607d2…`이다. sources는 360 그대로이고 바이트가 움직인 것은 3개다(`exploreUtils.ts` · 평가 스크립트 · 시뮬레이터 테스트).
- `exploration-rhythm`: 리듬 지표는 불변이다. 내장한 성장 모델 리포트 해시 둘(focused · full)만 움직였다. `pacing:verify`가 먼저 stale로 실패해 `--write`로 재생성했다(Wave 28과 같은 순서).
- `content-reachability`: reportHash `34d3c817…` → `7e9d6f3f…`. 앵커 시간만 움직였고 게이트 레벨 · 체인 구조 · 임무 괴리 목록은 불변이다.
- `relic-event-chance` · `event-reward-coherence` · `equipment-combat-power`: 바이트 불변이다.
- tracked verify **15/15 ok**.

### 29.6 게이트 (head `201b6a03`, 직렬 23:54~00:34)

type-check 0 · lint 0 · unit **5,321 / 5,321**(368파일, skip 0 — Wave 28 5,316 대비 +5) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **136 / 136**(70 + 66) · perf desktop FCP 556ms / mobile 592ms · tracked verify 15/15. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 30. Wave 30 — §27.6 잔여 결함 (2026-09-29, 베이스 `main` = `407fa667` = PR #62 merge commit)

§27.6이 "알고 남긴 것"으로 적은 다섯 줄 중 셋은 고칠 수 있는 결함이고 하나는 테스트 공백이었다. 모두 소유자 결정 없이 정본 규칙(D8 클램프 · 유물 상한 · 지급 경로 일관성)을 나머지 경로에 적용하는 일이다. `pendingRelics`가 세이브 봉투 밖이라는 줄은 봉투 구조 변경이라 이번 범위가 아니다. 상인의 인장 거부는 의도된 동작이다.

### 30.1 수정

- **칭호 전환 클램프**: 칭호 패시브(생명/기력 +N)는 유효 최대치의 입력인데, 훅이 `SET_PLAYER {activeTitle}`로 바꾸고 있었다. legend(HP +40)를 해제해도 현재 생명이 옛 최대치에 남았다. 칭호 전환은 이제 리듀서 전이 `AT.SET_ACTIVE_TITLE`(`uiHandlers`)이다. `clampVitalsToEffectiveMax` → `trackExpeditionVitals` 순서로 끝나고(SET_PLAYER와 같은 원정 기록), 올리는 방향으로는 건드리지 않는다.
- **일일 파편 변환 상한**: `resolveDailyProtocolProgress`가 `MAX_RELICS_PER_RUN`(5)을 읽고 있었다. 그래서 rank 2(상한 6) 플레이어가 유물 5개일 때 칸이 비어 있어도 파편이 변환되지 않고 쌓였다. 이제 다른 지급 경로처럼 `getPrestigeUnlocks(rank).maxRelics`를 읽는다.
- **체인 완주 직접 지급의 `relicCount`**: 골드 선택 · 유물 선택(`ADD_RELIC`) · 교체(`REPLACE_RELIC`) · 파편 변환은 `stats.relicCount`를 올리는데, `eventActions`의 완주 보상 직접 지급만 빠져 있었다. 그만큼 유물 수집 업적(5 · 15 · 30)과 칭호(10 · 25)가 덜 셌다.
- **교체 패널 e2e**: QA 시드 `injectRelicReplaceChoice()`(현재 rank 상한만큼 유물을 채우고 제안 하나)와 `tests/e2e/relic-replace.spec.ts` 2건(교체 → 수 불변 · 제안 유물 보유 · 내려놓은 유물 없음 / 넘기기 → 그대로)을 추가했다.

### 30.2 테스트와 결함 주입

`tests/title-relic-leftover-contract.test.js` 8행이다. 칭호 3행 + 배선 부재 불변식 1행 · 파편 3행 · relicCount 1행. 수정 전 6 red였고, 나머지 2행(rank 0 5/5와 rank 2 6/6의 보존)은 기존 동작 가드다. 결함 주입 4종은 각자 자기 행에서만 red였다: 클램프 제거 → 칭호 2행, 상한 5 고정 → 파편 1행, 계수 증가 제거 → relicCount 1행, 훅을 `SET_PLAYER`로 되돌림 → 배선 1행. e2e는 `REPLACE_RELIC`이 교체 대신 추가하도록 주입했을 때 교체 행이 red였다(`보유 유물 5/5` 단언). 관련 기존 테스트 60파일 2,059건은 그대로 green이었다.

### 30.3 증빙 델타

- `progression-diagnostic-v2`: 리포트와 기준선이 바이트 동일하다(reportHash `bc21a0de…` · v1 `696607d2…` 그대로). 바뀐 것은 sources 360개 중 이번에 고친 6개 파일의 바이트 핀뿐이다.
- `relic-event-chance`: 결과는 불변이다. 소스 핀 `eventReward`(= `eventActions.ts`)만 움직였다.
- `content-reachability` · `event-reward-coherence` · `equipment-combat-power` · `exploration-rhythm`: 바이트 불변이다.

### 30.4 게이트 (head `6cb9a1e1`, 직렬 01:17~01:58)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,329 / 5,329**(369파일, skip 0 — Wave 29 5,321 대비 +8) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **138 / 138**(70 + 68 — `relic-replace.spec.ts` +2) · perf desktop FCP 780ms / mobile 548ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 31. Wave 31 — 계승 이후 루프 자연 플레이 감사 (2026-09-29, 베이스 `main` = `f1958255` = PR #63 merge commit)

Wave 27(§27.1)은 새 세이브에서 첫 계승까지만 걸었다. 인계 문서(`HANDOFF_TO_CODEX_2026-09.md` §7)대로 다음 결함의 입력은 정적 감사가 아니라 플레이 데이터라, 그 뒤 루프를 같은 방식으로 걸었다. Wave 27 드라이버(실제 액션 팩토리 + 실제 `gameReducer`, 시드 `Math.random` + 가짜 시계, 테스트 API·상태 주입 없음)를 계승 뒤에도 계속 가도록 늘렸다. 런 1은 이야기 87 수령 뒤, 런 2+는 첫 계승 제안에서 계승한다. **16시드 × 계승 4회 = 64 계승**(드래곤 나이트 10 · 대마법사 3 · 사냥의 군주 3, rank 0 → 4). 드라이버는 저장소 밖 감사 도구다.

### 31.1 드라이버 정비 (게임 코드 무변경)

- 유물 제안이 상한이면 `DECLINE_RELIC`을 누른다. Wave 27 이전 드라이버는 `ADD_RELIC`을 눌러, D3 이후 상한에서 제안이 남아 같은 자리를 돌 수 있었다.
- 계승 화면에서 미룬 런은 조건(이야기 완주 또는 런 2+)이 되면 조작판 [계승하기](`reopenAscension`)로 다시 연다.
- 런 2+의 목표는 마왕성이다(경로 게이트 48 도달 시).
- `inventoryOverCap`는 위반에서 관측으로 낮췄다. 보상 경로는 상한을 넘겨 지급하는 것이 설계(Wave 27 N2)이고, 조작으로 늘어난 경우는 기존 `overCapGrowth`가 따로 센다.
- 처음 배치에서 한 시드(rank 3 런)가 Lv2에서 마을 ↔ 고요한 숲을 3만 스텝 넘게 왕복했다. 원인은 드라이버 정책이었다. 생명 50% 미만이면 후퇴하는데 골드 33으로는 휴식 비용을 못 내서, 후퇴가 회복이 아니었다. "휴식을 치를 수 있을 때만 후퇴"로 고쳐 전 시드를 다시 돌렸다. 게임 쪽에서는 탐험이 막히지 않는다(플레이어는 그대로 사냥할 수 있다).

### 31.2 결과

| 런 | rank | 탐험(중앙값) | 모델 시간 | 사망 합계 | 임무 수령(중앙값, 최소~최대) | 유물 제안 크기 / 보유 상한 | 정예 비율 |
|---|---|---|---|---|---|---|---|
| 1 | 0 → 1 | 2,502 | 62.6h | 32 | 17 (13~20) | 3 / 5 | 5% |
| 2 | 1 → 2 | 1,981 | 49.5h | 0 | 1 (0~2) | 3 / 5 | 5% |
| 3 | 2 → 3 | 1,848 | 46.2h | 0 | 1 (0~2) | **4 / 6** | 5% |
| 4 | 3 → 4 | 1,308 | 32.7h | 0 | 0 (0~0) | 4 / 6 | **28%** |

- **안정성**: 64/64 계승, 불변식 위반 0, 소프트락 0(드라이버 정책 수정 뒤), 저장 봉투 왕복 **1,682회 diff 0**, 묘비 32/32 회수, 폴백 거래 152/152 적용(N1 유지).
- **계승 직후 상태**: 64/64 idle · Lv1 · 가방 2 · 유물 0, `claimedQuestIds` 유지, 묘비 유지, 미룸 표시 없음.
- **계승 화면**: 런 1에서 시드당 한 번 떴다(마왕을 먼저 잡고 미룬 뒤 87 수령 후 [계승하기]). Wave 28 D6 이전에는 런당 70~112회였다. `reopenAscension` 거부 0.
- **프레스티지 해금**: rank 2부터 유물 제안 4개·상한 6, rank 3부터 정예 비율 5% → 28%. 모두 정의(`prestigeUnlocks.ts`)대로다.

### 31.3 관측 중 결함이 아니었던 것

- **이벤트 선택 무반응 17건**: 기력이 모자란 한정 조우 선택지(`read-runes` 등 MP 10)를 같은 이유로 **다시** 눌렀을 때 동일 참조였다. 첫 누름에는 `choiceFeedback`과 로그가 실린다. 연타 멱등(Wave 27 N1 `rejectEventChoice`)이라 의도대로다.
- **장비 교체 거부 2건**: 가방 20/20에서 양손 무기(수정 창)로 바꾸면 무기와 보조장비가 둘 다 가방으로 돌아와 순증 +1이다. 가방 상한 규칙(Wave 27 D2)대로의 거부다.

### 31.4 소유자 판단 거리 (코드 결함 아님, 측정만)

- **계승 뒤 임무 수입 붕괴**: 런 1은 17개, 런 2~4는 1 · 1 · 0개다. 카탈로그 임무가 계정당 1회라서다(Q8 = (a) 유지로 결정됨, §26). 이번 측정은 그 결정의 결과를 수치로 보인 것이다. 계승 뒤 런에는 게시판 콘텐츠가 사실상 없다.
- **계승 뒤 난이도 평탄화**: 런 2~4 사망 **0**(48런). rank 3의 정예 28%(심연의 메아리)에서도 0이다. 영구 보너스가 초반 위험을 없애는 것이 의도인지는 소유자 판단이다.
- **가방으로 막힌 전리품**: 전 런 합계 굴림 57,231 중 30,962(54%)가 가방 가득으로 막혔다. 드라이버의 판매 정책(버릴 것 3개 이상 · 30탐험 쿨다운)에 크게 좌우되는 값이라 결함 판정은 하지 않는다.

## 32. Wave 32 — 계승 이후 루프 후속: 현상수배 · 정수 사다리 · 드라이버 결함 2건 (2026-09-29, 베이스 `main` = `f62e4d0d` = PR #64 merge commit)

§31.4의 소유자 판단 거리 셋 중 둘(임무 수입 · 난이도)의 결정을 구현하고, 그 측정 중 드라이버와 대조 실험이 잡은 결함 2건을 고쳤다. 가방(셋째)은 Wave 33에서 제작 콘텐츠로 다룬다.

### 32.1 결정과 수정

| 항목 | 종류 | 수정 |
|---|---|---|
| 현상수배 하루 1회 | 소유자 결정 "제한 완화" | `REQUEST_BOUNTY`의 일일 검사를 뺐다 — 진행 중 하나, 완료하면 바로 다음. `stats.bountyDate`/`bountyIssued`는 마지막 발급 기록으로만 남는다. 게시판 버튼도 같은 규칙. `MSG.BOUNTY_DAILY_LIMIT` 제거 |
| 사망 재시작 영구 공격력 이중 가산 | 결함 | `handleDefeat`가 `meta.bonusAtk`를 새 캐릭터의 `atk` 필드에 굽고 `calculateFullStats`가 다시 더했다. `start()`는 `atk`를 다시 쓰지 않아 다음 런 내내 유지됐다(bonusAtk 1,000 → 전투 공격력 2,408, 같은 meta의 계승 캐릭터 1,212). 굽지 않는다. 기존 테스트가 `updatedPlayer.atk` 필드만 핀으로 고정해 이 이중 가산을 못 봤다 |
| 레벨 임무 진행도 목표 초과 | 결함(드라이버 불변식 `questProgressOverGoal`) | 레벨 임무만 수락 시 `player.level`, 갱신 시 `max(progress, level)`이라 101을 Lv46에서 받으면 46/45였다. 다른 유형처럼 `latch`(목표에서 멈춤) |
| 계승 뒤 난이도 평탄화 | 소유자 결정 "계승 시 사다리 10% 이월" | 아래 §32.2 |

### 32.2 계승 난이도 — 원인 규명과 결정 경로

처음 승인된 방향은 "계승 런만 rank당 적 강화를 소폭 올린다"였다. `PRESTIGE_ENEMY_STAT_PER_RANK`를 0.05 → 0.10 · 0.15 · 0.20으로 올려 드라이버로 재도 계승 런 사망은 0 · 0 · 1이었다. 계승 직후 캐릭터를 덤프해 원인을 찾았다. rank 4 캐릭터의 Lv1 전투 공격력은 3,732이고, 그중 `meta.bonusAtk`가 3,092였다. 정수 사다리 몫이다. 사다리는 처치당 exp/8 정수가 150마다 공격력 +1 · 생명 +5 · 기력 +3을 올리는 구조다. 한 런의 누적 정수는 9만~18만이었고(전투 1,500~1,900회 × 평균 63~121), 런마다 800단계 안팎이 쌓여 통째로 넘어갔다. 설계된 계승 보너스(+5 공격력/회)의 약 160배다. 적 배율은 곱셈이라 초반 적 체력 50~300에 공격력 +800이 더해지면 배율이 무의미해진다.

사다리를 어디서 줄이는지 같은 6시드(j0 1~4 · j1 1 · j2 1)로 대조했다.

| 조건 | 1회차 모델 시간 중앙 / 사망 | 계승 런 사망(18판) |
|---|---|---|
| 기준(exp/8, 이중 가산 수정) | 61.6h / 11 | 0 |
| 처치당 정수 √exp | **74.5h / 22**(한 시드 146h) | 3/48(16시드) |
| √exp + 적 강화 rank당 +50% | 75.2h / 22 | 8 |
| exp/8 + 적 강화 rank당 +50% | 61.6h / 11 | 1 |
| exp/8 + 계승 시 사다리 25% 이월 | 61.6h / 11 | 1 |
| **exp/8 + 계승 시 사다리 10% 이월** | **61.6h / 11** | **14** |

- **√exp는 되돌렸다.** 소유자가 처음에 고른 것은 √exp였다. 선택지 설명에 후반 압축 폭을 "수십 배"로 적었는데 실측은 Lv48 기준 약 3배였다. 적 exp는 레벨에 거의 비례한다(≈12.7×레벨). 사다리가 1회차 후반 성장의 큰 몫이라, 획득을 줄이면 1회차가 23% 길어지고 사망이 2배가 된다. "계승 런만"이라는 원래 의도에 어긋나 소유자 재결정으로 되돌렸다.
- **이중 가산 수정만 적용하면 1회차는 6시드 모두 기준과 같다.** 사망이 사다리가 커지기 전(Lv8·Lv13)에 나서다.
- **10% 이월을 택했다.** 1회차를 그대로 두는 지점은 계승뿐이다.

구현(`systems/essenceLedger.ts`):
- rank를 매기는 원장을 `meta.essenceLadder`로 분리했다. 없으면 `essenceLifetime`으로 읽으므로 구세이브는 계승 전까지 동작이 같고, `DATA_VERSION` bump가 필요 없다.
- `carryEssenceLadderOnAscension`이 단계의 `BALANCE.ESSENCE_LADDER_ASCEND_CARRY`(0.1)만 남긴다(내림). 내려놓은 단계 × 단계당 값만큼 영구 스탯을 뺀다.
- 첫 죽음·프레스티지 보너스, 누적 정수, 쓸 수 있는 정수(거울)는 줄지 않는다. 사망 재시작은 이 함수를 부르지 않는다.
- `getAscensionOutcome`은 이월 뒤에 계승 보상을 얹는다.
- 계승 화면에는 "영구 성장" 칸의 전→후 값 아래에 이월 설명(`MSG.ASCEND_LADDER_CARRY`)을 붙였다.

### 32.3 최종 코드 16시드 재측정 (Wave 31과 같은 시드·직업 구성)

| 런 | rank | 모델 시간 중앙 | 사망 합계(시드 중 사망 발생) | Wave 31 |
|---|---|---|---|---|
| 1 | 0 → 1 | 62.5h | 32 (13/16) | 62.6h · 32 |
| 2 | 1 → 2 | 49.9h | **4 (4/16)** | 49.5h · 0 |
| 3 | 2 → 3 | 46.2h | **3 (3/16)** | 46.2h · 0 |
| 4 | 3 → 4 | 36.3h | **16 (12/16)** | 32.7h · 0 |

- **1회차는 16시드 모두 Wave 31 기준과 모델 시간·사망·정수가 같다.** 레벨 임무 수정과 이중 가산 수정도 이 시드들의 1회차를 바꾸지 않는다.
- **계승 런 사망은 0/48 → 23/48(런당 0.48)이다.** 정예 28%가 열리는 rank 3 런(런 4)이 가장 어렵다(12/16 시드에서 사망). 프로토타입 6시드는 0.78이었다. 같은 6시드를 최종 구현으로 돌리면 14 → 11(런 2·3·4 = 5·0·9 → 2·1·8)이다. 구현은 계승 보상 정수(200)를 사다리에도 넣어 1단계 차이가 난다. 그 차이로 전투 난수 흐름이 갈라진 것이지 체계적 차이는 아니다.
- **안정성**: 불변식 위반 0, 저장 봉투 왕복 1,973회 diff 0, 묘비 55/55 회수, 폴백 거래 199/199 적용.
- **현상수배 연속 수주는 드라이버가 누르지 않는다**(드라이버에 현상수배 정책이 없다). 행동 테스트 4행이 지킨다.

### 32.4 테스트와 결함 주입

| 파일 | 행 | 수정 전 red | 주입 → red 행 |
|---|---|---|---|
| `bounty-continuous-contract.test.js` | 4 | 2([연속] · [표시]) | 리듀서 일일 제한 되돌림 → [연속] · UI 일일 제한 되돌림 → [표시] |
| `first-death-meta-reward.test.js` | +1행, 1행 단언 교체 | 2 | — |
| `level-quest-progress-cap.test.js` | 3 | 2([수락] · [갱신]) | — |
| `essence-ladder-ascension-carry.test.js` | 6 | 4 | 이월 1.0 → 4행 · rank를 누적 정수로 계산 → [원장] · 화면 줄 제거 → [표시] |

기존 테스트 3곳이 결함을 핀으로 고정하고 있어 기대값을 고쳤다.
- `first-death-meta-reward`는 `updatedPlayer.atk` 필드를 고정했다(이중 가산의 절반).
- `quests-cycle`은 "목표 5 임무에 Lv7 → 7"을 고정했다.
- `quest-progress`도 같은 목표 초과를 고정했다.

셋 다 목표 아래 행과 전투 공격력 단언을 함께 넣었다.

### 32.5 증빙 델타

- `progression-diagnostic-v2`: 리포트·기준선 바이트 동일. 소스 핀 10개만 이동(이번에 고친 파일).
- `equipment-combat-power`: `constants.ts` 핀(`tierHash`)만 이동.
- `relic-hp-drain-atk`: `authorityHashes.combatEngine`만 이동. 이 증빙은 고정 순서 체인 스크립트에 빠져 있었다. 단위 테스트의 strict verifier가 잡아서 체인에 5c 단계로 넣었다(감사 도구 쪽).
- 나머지는 바이트 불변. tracked verify **15/15**.

### 32.6 게이트 (직렬 05:07~05:36, 단위는 수정 뒤 재실행)

- **통과 항목**: type-check 0 · lint 0 · build:guard ok · CI-env build ok · e2e **138/138**(70 + 68) · perf desktop FCP 740ms / mobile 752ms.
- **첫 단위 실행**: 5,343/5,344였다. 실패 1건은 `cycle-200-299`의 cycle 277 소스 정규식 가드였다. `ascensionPreview.ts`에 `bonusAtk: toNonNegativeNumber(currentMeta.bonusAtk)`라는 글자 모양이 있는지 보던 가드라, 사다리 이월 뒤 모양이 바뀌자 깨졌다. 의도("계승이 영구 보너스를 누적 유지한다")를 `getAscensionOutcome` 호출 단언으로 바꿨다(Wave 11 C4 정책: 동작 확인은 행동 테스트로).
- **재실행 단위**: **5,344/5,344**(372파일, skip 0).

## 33. Wave 33 — 제작소 가방: 런마다 다시 만드는 5단계 가방 (2026-09-29, 베이스 `main` = `450da79b` = PR #65 merge commit)

§31.4의 셋째 판단 거리를 다룬다. Wave 31 감사에서 전리품 굴림의 54%가 가방 가득으로 막혔다. 소유자 결정은 두 가지다. 가방을 제작 요소로 만들고, 만든 가방은 런마다 다시 만든다.

### 33.1 설계

- **단계**: `data/bagRecipes.ts`의 5단계, 단계당 3칸이다. 기본 20칸이 35칸까지 늘고, 크리스털 영구 확장(`maxInv`)과 더해진다.
  - 순서대로만 만든다. 리듀서 `AT.CRAFT_BAG`는 제작소에서만, 지금 단계 + 1만 받는다.
  - 재료나 골드가 모자라면 거부 로그만 남긴다.
  - 제작 횟수·시즌 XP·일일 골드 소비는 레시피 제작과 같이 센다.
- **런 범위**: `player.bagTier`는 영구 상태가 아니다(`pickPermanentPlayerState` 밖). 사망 재시작과 계승에서 0이 된다. 새 필드는 선택 필드이고 `migrateData`가 그대로 통과시키므로 `DATA_VERSION` bump가 필요 없다.
- **상한 단일 원천**: `getInventoryCapacity` = 영구 크기 + 가방 칸.
  - `maxInv || BALANCE.INV_MAX_SIZE`로 직접 읽던 9곳을 옮겼다. 상점, 전투 결과 카드, 전리품 수용, 귀환 보급, 모험 가이드 2곳, 한정 조우, 귀환 흐름, 임무 운영이다.
  - 크리스털 교환 화면만 영구 확장 상품이라 `maxInv`를 그대로 쓴다.
  - 부재 불변식이 되돌리기를 잡는다.
- **표시와 안내**: 제작소에 가방 탭(`BagCraftingSection`)을 추가했다.
  - 가방이 거의 찼고 다음 가방을 바로 만들 수 있으면 모험 가이드가 제작소를 가리킨다(`open_crafting` → 조작판 제작소 버튼 강조).
  - 준비 판정은 `utils/bagCrafting.getBagCraftReadiness` 하나다.
- **함께 고친 기존 결함 2건**
  - 인벤토리 과밀 배너가 고정 18칸 기준으로 판정하고 "N/20"으로 하드코딩 표시했다. 크리스털 확장(25칸)에서도 틀려 있었다. 이제 지금 상한에서 같은 여유(2칸)를 뺀 값으로 판정하고 실제 상한을 표시한다.
  - 일괄 판매(`AUTO_SELL_MATERIALS`)는 판매 임계 30 이하 재료를 전부 팔았다. 가방 1·2단계 재료가 그 가격대라 일괄 판매 한 번이면 가방 재료가 사라졌다. 이제 다음 단계에 필요한 수량만큼은 남긴다(`getAutoSellMaterialTargets`, 리듀서와 배너 수치가 같은 함수를 읽는다).

### 33.2 드라이버로 재료를 두 번 고쳤다

드라이버에 정책 하나를 더했다. 마을에서 다음 가방을 만들 수 있으면 만들고, 상점에서 재료를 팔 때 다음 가방 재료는 남긴다. `BAG=0`이면 끈다.

| 시도 | 재료 | 결과 |
|---|---|---|
| 처음 | 구간별 재료 6~8칸(가죽 4 + 껍질 2 …) | 시드 1이 **한 런 내내 0단계**였다. 재료는 쌓이지 않고 한 개가 한 칸이라, 가방이 늘 찬 초반에 가죽이 3/4에서 멈췄고 저레벨 지역을 떠났다 |
| 3~5칸으로 축소 | 구간 한정 재료 유지(박쥐 날개 Lv8~15 등) | 1단계는 Lv5에 만들었다. 2단계 재료 구간을 지나친 런은 거기서 멈췄고, 순서 제작이라 3~5단계도 전부 막혔다 |
| 넓은 레벨대 재료 | 멧돼지 가죽 · 자연의 결정 · 철광석 · 마나 결정 · 빛의 결정 · 어둠의 정수 · 오리할콘(각 5~12개 지역, Lv1~68) | 16시드 64런 중 5단계 **0**. 4단계(Lv35 무렵)가 첫 오리할콘을 쓰면 두 번째가 런 안에 들어오지 않았다 |
| **최종** | 오리할콘은 5단계에 1개만 | 64런 중 5단계 22 |

최종 1회차 단계별 도달 레벨 중앙값은 1단계 Lv5, 2단계 Lv14, 3단계 Lv27, 4단계 Lv28, 5단계 Lv37이다. 1단계 제작이 16시드에서 44회인 것은 사망마다 가방이 초기화돼 다시 만든 결과다(런 범위 규칙이 의도대로 작동). 계승 런 48개 모두 첫 제작이 1단계였다.

### 33.3 최종 코드 16시드 (같은 시드·직업, 제작 끔/켬 A/B)

| 조건 | 1회차 모델 시간 평균(합계) / 사망 | 계승 런 2~4 합계 | 최고 단계 분포(1회차) |
|---|---|---|---|
| Wave 32 | 65.0h (1,041h) / 32 | 2,185h | — |
| Wave 33 제작 끔 | 65.7h (1,052h) / 32 | 2,229h | — |
| Wave 33 제작 켬 | 69.1h (1,105h) / 38 | 2,185h | 5단계 6 · 4단계 8 · 3단계 1 · 0단계 1 |
| Wave 33 제작 켬(골드 3배일 때만) | 69.1h (1,105h) / 38 | 2,181h | 제작 켬과 1회차 동일 |

- **1회차 +5%는 편차 범위 안이다.** 사실상 같은 설정인 Wave 32와 "제작 끔"도 런 종류별로 5~10% 차이 난다(런 4 사망 16 vs 9, 합계 587h vs 643h).
- **골드 지출은 원인이 아니다.** 골드가 비용의 3배일 때만 만들게 해도 1회차가 제작 시점까지 동일했다. 재료가 모일 때면 이미 골드가 넉넉하다.
- **계승 런에는 느려짐이 없다.** 게임 수치는 더 바꾸지 않았다.
- **전리품 막힘 비율은 53.7% → 51.7%로 거의 그대로다.** 드라이버는 칸이 늘면 그만큼 더 채운다(판매는 상한 −6에서만). 그래서 이 비율은 가방 효과보다 드라이버의 가방 관리 정책을 잰다. 효과 지표로 쓰지 않는다.
- **안정성**: 불변식 위반 0, 저장 왕복 2,041회 diff 0, 묘비 55/55 회수, 폴백 거래 193/193 적용.

### 33.4 테스트와 결함 주입

- **`tests/bag-crafting-contract.test.js` 17행**
  - 데이터 · 상한 · 전리품 · 구매
  - 제작 · 순서 · 재료 · 골드 · 제작소 게이트
  - 런 범위(사망 · 계승) · 표시 · 안내
  - 일괄 판매 2 · 과밀 배너
  - 단일 원천 부재 불변식
- **결함 주입 10종이 각자 자기 행에서 red**
  - 상한이 가방을 무시 → 4행
  - 단계 순서 → 순서
  - 골드 검사 제거 → 골드
  - 제작소 게이트 제거 → 상태
  - 가방을 영구 상태로 → 런 범위 2행
  - 직접 읽기 되돌림 → 단일 원천
  - UI 준비 판정 → 표시
  - 옛 일괄 판매 → 일괄 판매
  - 옛 과밀 임계 → 과밀 배너
  - `/20` 하드코딩 → 과밀 배너
- **e2e `bag-crafting.spec.ts`**: QA 시드 `seedBagCraftingScenario`로 확인한다. 제작소 가방 탭에서 1단계를 만들면 상한이 +3이 되고, 1단계는 완료·2단계는 재료 부족 상태로 바뀌며, 골드가 차감된다.
- **기존 소스 가드 2건 갱신**
  - cycle 502 `incrementStat` 호출 수 2 → 3(가방 제작도 `crafts` +1)
  - A2 잡템 임계는 `getAutoSellMaterialTargets` 동작 단언으로 바꿨다

### 33.5 증빙 델타

- `progression-diagnostic-v2`: 리포트·기준선 바이트 동일(성장 모델은 가방 단계를 두지 않는다). 소스 핀 360 → 363으로, 새 파일 3개(`bagRecipes.ts` · `bagCrafting.ts` · `BagCraftingSection.tsx`)가 추가되고 이번에 고친 18개가 움직였다.
- 나머지 증빙은 바이트 불변이다. tracked verify **15/15**.

### 33.6 게이트 (직렬 06:54~07:24)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,361/5,361**(373파일, skip 0) · build:guard ok · CI-env build ok · e2e **139/139**(71 + 68, 새 스펙 `bag-crafting.spec.ts` 포함) · perf desktop FCP 792ms / mobile 584ms.

## 34. Wave 34 — 유물 제안(`pendingRelics`)을 세이브 봉투에 싣는다 (2026-09-29, 베이스 `main` = `f942d779` = PR #66 merge commit)

§27.6의 마지막 결함 줄이다. Wave 30은 이것을 "봉투 구조 변경이라 범위 밖"으로 남겼다. 봉투에 필드 하나를 더하는 일이라 소유자 결정은 필요 없고, 구세이브 호환만 확인하면 된다.

### 34.1 결함

- **증상**: 유물 선택 화면(발견 3택 · 시작 부트 · 체인 완주 보상 · 상한 교체 제안)이 떠 있는 동안 리로드하면 제안이 사라졌다.
- **보상 소실인 이유**: 제안을 만든 사건(전투 승리 · 체인 스텝 진행)은 이미 저장돼 있어 다시 오지 않는다.
- **원인 두 겹**
  - 로컬 봉투(`flushLocalSave`)와 클라우드 봉투(`createCloudAutosave`) 어디에도 `pendingRelics`가 없었다.
  - `migrateData`가 로드 때 `pendingRelics`를 무조건 `null`로 썼다(주석: "런타임 전용 — 저장 불필요").

### 34.2 수정

- **봉투**: 두 저장 경로가 `pendingRelics`를 싣는다. 없으면 `null`이다(Firestore는 `undefined`를 거부한다). 사용자 문서 rules는 `hasAll`만 검사하므로 rules 변경은 필요 없다.
- **로드는 id만 믿는다**: `utils/pendingRelicsRestore.sanitizeSavedPendingRelics`가 세이브의 필드(이름 · 값)가 아니라 `RELICS` 정의를 되살린다. 모르는 id · 중복 · 배열이 아닌 값은 버리고, 남는 게 없으면 `null`이다.
- **복원**: `LOAD_DATA`가 `restorePendingRelics`로 이미 가진 유물을 뺀다. 사망 세이브면 버린다(`dead`는 언제나 `idle`로 접히고 런이 끝났다).
- **호환**: 구세이브(필드 없음)는 `null`이다. 골든 74입력 출력이 바이트 그대로라 `DATA_VERSION` bump가 필요 없다. `MigratedSave.pendingRelics`는 `null` 리터럴에서 `Relic[] | null`로 넓혔다.
- CLAUDE.md §8-6의 봉투 문장을 "여섯 필드"에서 "일곱 필드"로 고쳤다.

### 34.3 테스트와 결함 주입

- **`tests/pending-relics-persistence.test.js` 7행**: 마이그레이션 2 · 복원 3 · 클라우드 저장 1 · 왕복 1. 수정 전 6행 red였다. 남은 1행은 사망 행이다. 수정 전에는 제안이 언제나 `null`이라 참이었고, 이제는 복원이 사망 세이브를 넘지 않는지 지킨다.
- **결함 주입 5종**(별도 worktree에서 한 종씩, 이 파일만 실행)
  - 로드 때 다시 `null` → 5행 red(마이그레이션 2 · 복원 2 · 왕복)
  - 보유 유물 필터 제거 → 보유 행 1개만 red
  - 사망 폐기 제거 → 사망 행 1개만 red
  - 클라우드 봉투에서 누락 → 클라우드 저장 · 왕복 2행 red
  - 세이브 필드 신뢰(정본 대신 저장된 객체) → 위조 이름 행 1개만 red
- **e2e `relic-choice-reload.spec.ts`**: device-QA 시나리오로 실제 로컬 저장 → `migrateData` → `LOAD_DATA` 경로를 탄다. 실제 유물 3개 제안 → 봉투에 실릴 때까지 대기 → 리로드 → 같은 제안 3개가 다시 뜬다. 로드 `null` 주입 빌드에서 red(패널 미표시)였고, 되돌린 뒤 green이었다.
- **기존 소스 가드 1건 갱신**: `cloud-autosave`의 `flushCloudSave` 인자 목록 검사에 `pendingRelics`를 더했다.
- **rules 에뮬레이터**: 클라이언트 실제 페이로드에서 유도하는 18건이 그대로 통과했다(`npm run test:rules`).

### 34.4 증빙 델타

- `progression-diagnostic-v2`: 리포트·기준선 바이트 동일(reportHash · v1Baseline 그대로). 소스 핀이 363개에서 364개가 됐다. `pendingRelicsRestore.ts`가 추가됐고, 이번에 고친 5개(`createCloudAutosave.ts` · `useFirebaseSync.ts` · `actionTypes.ts` · `bootstrapHandlers.ts` · `dataMigration.ts`)가 움직였다.
- `relic-dot-multiplier`: 결과 불변. `dataMigration.ts` 소스 핀 하나만 움직였다.
- 나머지 증빙은 바이트 불변이다. tracked verify **15/15**.

### 34.5 게이트 (직렬 08:30~09:02)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,368/5,368**(374파일, skip 0 — Wave 33 대비 +7) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69, 새 스펙 `relic-choice-reload.spec.ts` 포함) · perf desktop FCP 752ms / mobile 456ms · rules 에뮬레이터 18/18. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 35. Wave 35 — 계승을 미룬 심층 엔드게임 자연 플레이 감사 · 심연 층 번호 (2026-09-29, 베이스 `main` = `7b40c9b6` = PR #67 merge commit)

Wave 27은 첫 계승까지, Wave 31은 계승 4회까지 걸었다. 아무도 걷지 않은 구간은 **계승을 미루고 마왕성 너머로 계속 가는 런**이다. Lv48 이상 지역, 혼돈의 심연 층, 승천 뒤에 열리던 체인 2개가 여기에 있다. 같은 드라이버(실제 액션 팩토리 + 실제 `gameReducer`, 시드 `Math.random` + 가짜 시계)에 엔드게임 모드를 붙였다. 드라이버는 저장소 밖 감사 도구다.

### 35.1 드라이버 엔드게임 모드

- 계승 화면이 뜨면 언제나 미룬다(`cancelAscension` = `DEFER_ASCENSION`). 조작판 [계승하기]도 누르지 않는다.
- 이야기(87)를 끝낸 뒤의 목표 순서
  1. 퀘스트 탭 체인 저널의 다음 지역(`buildChainJournal` → `nextLoc`). 플레이어가 보는 안내를 그대로 따른다.
  2. Lv55부터 혼돈의 심연. 생명 80% 이상일 때 들어가고, 기존 후퇴 규칙(50% 미만)으로 나온다. 심연에서 죽었다면 그때보다 5레벨 이상 높아야 다시 들어간다.
  3. 그 밖에는 갈 수 있는 가장 높은 사냥터.
- 16시드(직업 선택 0번 10 · 1번 3 · 2번 3), 시드당 탐험 9,000회(약 225 모델시간)에서 멈춘다.
- **처음 배치에서 체인 4개가 16/16 같은 단계에 멈췄다.** 원인은 게임이 아니라 드라이버였다. 드라이버는 가장 높은 사냥터만 돌아서, 다음 단계 지역(어둠의 동굴 Lv10 · 암흑 성 Lv35 · 북부 요새(안전지대) · 차원의 균열 전초기지 Lv62)을 한 번도 밟지 않았다. 체인 저널 추적을 넣자 9개가 16/16 완주했다. divine_apostle_trial(Lv62 · 68 지역)만 1/16이다.
- 체인 추적을 넣을 때 드라이버 버그 하나를 고쳤다. 마왕성 분기가 체인 목표를 덮어써서 드라이버가 마왕성에 머물렀다.

### 35.2 결과 (수정 전 코드, 체인 추적 포함)

- **안정성**: 16/16 탐험 한도 도달, 불변식 위반 0, 소프트락 0, 저장 봉투 왕복 **2,004회 diff 0**.
- **심연**: 첫 입장 Lv55(16/16). 최고 층 중앙값 59(39~153). 사망 62회 중 24회가 심연이고, 그중 14회가 보스 층(40 · 50 · 60 · 70 · 80)이다. 사망하면 Lv1부터 다시 시작하지만 돌파 층은 영구라, 다음 잠수는 그 벽에서 다시 시작한다.
- **심연 보상**: 10 · 25 · 75층 유물 제안(유물 5/5면 교체 제안), 50층 전설 장비(가방 상한을 넘어 지급 — 보상 경로 규칙대로).
- **체인 선택 거부 16건**: 그림자 길드의 상인의 인장(2000G)을 유물 5/5에서 사려 하면 거부되고 다른 선택지 안내가 뜬다(§27.6에서 의도로 남긴 동작).

### 35.3 결함 — 심연 층 번호가 셋이었다 (16/16 재현)

| 곳 | 읽던 층 | 결과 |
|---|---|---|
| `applyAbyssFloorAdvance` | `(abyssFloor \|\| 1) + 1` | **첫 돌파가 0 → 2층**. 2층 전투가 없고, 기록 · 칭호(10 · 50층) · 유물 층 보너스가 한 층 앞섰다 |
| `spawnEnemy` 이름 태그 · 기본 스탯 | `abyssFloor \|\| 1` | 일반 적 이름이 **한 층 낮았다**. "[10층 보스]" 다음 적이 "[10층]"이었다. 1,102전투 중 1,002전투가 불일치 |
| `exploreFlow` 스케일 · 보스 층 · 적 레벨 | `abyssFloor + 1` | (정본) |
| 접두어 · 정예 격노 이름 | `${접두어} ${종}`으로 다시 씀 | 층 태그가 **통째로 사라졌다** |

- **정본을 정했다**: `stats.abyssFloor`는 돌파한 층 수이고, 지금 싸우는 층은 `abyssFloor + 1`이다. 보스 층 · 마일스톤 · 스케일은 이미 이 정의였으므로 나머지 두 곳과 이름 두 곳을 맞췄다. 안내 문구도 "N층 돌파 · 다음은 N+1층"으로 바꿨다(`ABYSS_DESCEND` · `ABYSS_RECORD`).
- **세이브 호환**: 기존 세이브의 돌파 층은 한 층 부풀어 있을 수 있다. 다음 전투 층은 수정 전후가 같으므로 마이그레이션을 두지 않았다(`DATA_VERSION` 그대로).
- **성장 모델 영향 없음**: 모델은 숫자 레벨 지역만 다룬다(`infinite` 제외).

### 35.4 수정 뒤 같은 16시드

| | 수정 전 | 수정 후 |
|---|---|---|
| 첫 돌파 층 건너뜀 | 16/16 | **0** |
| 층 표기 = 싸우는 층 | 100 / 1,102 | **954 / 954** |
| 불변식 위반 · 저장 왕복 diff | 0 · 0 (2,004) | 0 · 0 (2,000) |
| 사망(심연) | 62 (24) | 62 (24) |
| 최고 층 중앙값 | 59 | 59 |

### 35.5 소유자 판단 거리 (코드 결함 아님, 측정만)

- **계승하지 않는 런의 정수 사다리**: 사다리는 계승 때만 줄어든다(Wave 32 10% 이월). 계승을 미루면 계속 쌓여, 225 모델시간에 공격력 +4,200(중앙값, 최대 +6,500)이 된다. 사망 재시작은 사다리를 줄이지 않는다. 심연 층 스케일(층당 +8%)이 그 힘을 받아내는 유일한 콘텐츠다.
- **골드 누적**: 같은 시점 골드 중앙값 약 240만. 후반에는 쓸 곳이 없다. 공개 묘비 업로드 상한(`MAX_PUBLIC_GRAVE_GOLD`)은 그대로 작동한다.

### 35.6 테스트와 결함 주입

- **`tests/abyss-floor-numbering.test.js` 5행**: 첫 돌파 · 층 번호 하나(돌파 0 · 1 · 4 · 9 · 10 · 24 · 49층) · 보스 다음 층 · 접두어 적 · 정예 격노. 수정 전 5행 모두 red.
- **결함 주입 4종**: 각각 예상한 행에서 red였다.
  - 돌파 `|| 1` → 첫 돌파 행
  - 스폰 층 `|| 1` → 층 태그 4행과 `quest-target-identity` 1행
  - 접두어 태그 누락 → 접두어 행
  - 격노 태그 누락 → 격노 행
- **기존 테스트 1건 갱신**: `quest-target-identity`가 돌파 12층의 태그를 `[12층]`으로 고정하고 있었다. 지금 싸우는 층인 `[13층]`으로 고쳤다.
- **한국어 래칫**: 층 태그를 한 번만 만들어(`depthTag`) 두 이름에 재사용해, 한글 템플릿 조각 수를 그대로 유지했다.

### 35.7 증빙 델타

- `progression-diagnostic-v2`: 리포트 · 기준선 바이트 동일(reportHash · v1Baseline 그대로). 소스 핀 364개 중 이번에 고친 3개(`messages.ts` · `combatBossHandlers.ts` · `exploreUtils.ts`)만 움직였다.
- 나머지 증빙은 바이트 불변이다. tracked verify **15/15**.

### 35.8 게이트 (직렬 09:59~10:30)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,373/5,373**(375파일, skip 0 — Wave 34 대비 +5) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 764ms / mobile 652ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 36. Wave 36 — 보상 수령 루프 자연 플레이 감사 (2026-09-29, 베이스 `main` = `ce07757a` = PR #68 merge commit)

Wave 27 · 31 · 35의 드라이버는 보상 수령 버튼을 누르지 않았다. 시즌 패스 30단계와 시즌 회전, 도감 마일스톤, 업적, 주간 미션, 칭호는 자연 플레이로 한 번도 걸어 보지 않은 셈이다. Wave 35의 엔드게임 모드(계승 미룸 · 체인 저널 추적 · Lv55부터 심연)에 수령 정책을 붙여 같은 16시드를 탐험 9,000회씩 다시 걸었다. 드라이버는 저장소 밖 감사 도구이고, 게임 코드는 바꾸지 않았다.

### 36.1 수령 정책 (UI가 보여 주는 판정 그대로)

- 마을에 들를 때마다 수령할 것이 있으면 한 번에 하나씩 받는다. 순서는 시즌 단계 → 도감 마일스톤 → 업적 → 주간 미션이다.
  - 시즌: `getClaimableSeasonRewards` → `claimSeasonReward`
  - 도감: `getCodexProgress().unclaimed` → `CLAIM_CODEX_REWARD`(도감 화면과 같은 dispatch)
  - 업적: `isAchievementUnlocked` 중 미수령 → `claimAchievement`
  - 주간 미션: `getWeeklyMissionRows`의 `done && !claimed` → `claimWeeklyMission`
- 활성 칭호가 없으면 첫 칭호를 켠다.
- 판정이 수령 가능하다고 했는데 상태가 그대로면 거부로 센다. 수령 목록 네 개(업적 · 도감 · 시즌 · 칭호)의 중복은 불변식 위반으로 센다.
- 드라이버는 시즌 단계를 저장된 `tier`로 읽었다. 화면(`getSeasonProgress`)과 리듀서는 이월 XP에서 단계를 다시 계산하므로, 회전 직후 드라이버만 다음 XP 획득까지 수령을 미룬다. 수령 시점이 조금 늦어질 뿐 판정 결과에는 영향이 없다.

### 36.2 결과 (16시드, 수령 없는 Wave 35 수정 후 배치와 같은 시드)

- **안정성**: 불변식 위반 0, 수령 거부 0, 중복 수령 0, 저장 봉투 왕복 **2,070회 diff 0**.
- **시즌 회전**: 시드당 22~23회, 10 모델시간에 약 1회(중앙값 1.02)다. 첫 회전은 Lv28(중앙값)이고, 사망 재시작 직후 Lv1~8에서 회전한 시드도 3개 있다(시즌 진행은 사망을 넘는다). 회전 때 이월 XP는 최대 3,515로, 상한 이후 번 XP가 다음 시즌으로 넘어간다(Wave 13 E3 설계대로). 보관 기록은 12개에서 잘리고 완주 수는 따로 누적된다.
- **도감 · 업적 · 주간 · 칭호**: 도감 마일스톤 19~22, 업적 40~43, 주간 미션 3(가짜 시계로 약 1주), 칭호 36~43개.
- **보상이 가방 상한을 넘긴 지급**: 16시드 합계 4,308회. 보상 경로는 상한을 넘겨 지급한다는 규칙(Wave 27 N2)대로다. 수령이 유물 제안을 만든 경우는 0이다.
- **사망**: 53회(심연 30)로, 수령 없는 배치(62, 심연 24)보다 적다. 시즌 보상 물약·엘릭서 몫으로 보인다. 최고 심연 층 중앙값은 59로 같다.

### 36.3 소유자 판단 거리 — 시즌 패스가 후반 골드의 주 공급원이다 (코드 결함 아님)

| | 수령 없음(§35) | 수령 있음 |
|---|---|---|
| 최대 보유 골드 중앙값 | 약 242만 | **약 750만** |
| 시즌 무료 트랙 골드 합계(중앙값) | — | **약 632만** |

- 시즌 한 번의 무료 트랙 골드는 77,000이다. 시즌마다 ×1.35가 붙고 S6부터 ×4에서 멈춘다(`SEASON_REWARD_SCALE_MAX`). 그래서 S6 이후에는 시즌마다 약 308,000골드가 들어온다.
- 시즌은 XP로 돈다(탐험 10 · 처치 5 · 보스 50, 단계당 200). 10 모델시간에 한 시즌이 끝나므로, 후반에는 모델시간당 약 3만 골드가 시즌 보상에서 나온다.
- §35.5의 "골드 누적, 쓸 곳 없음"과 같은 문제다. 공급원을 줄일지(시즌 배율 · 상한 · XP 속도) 소비처를 만들지는 소유자 결정이다.

## 37. Wave 37 — 소유자 결정: 시즌 보상 배율 상한 · 체감형 정수 사다리 (2026-09-29, 베이스 `main` = `e84e0647` = PR #69 merge commit)

§35.5와 §36.3의 판단 거리 두 가지를 소유자가 정했다. 하나는 시즌 배율 상한을 낮추는 것이다. 다른 하나는 사다리를 "로그라이크의 느낌에 맞게 체감형 사다리"로 바꾸는 것이다. 사다리는 처음에 "현행 유지"로 답했다가 "게임이 재미없어질 것 같다"며 바꿨다.

### 37.1 설계

- **시즌 보상 배율 상한**: `SEASON_REWARD_SCALE_MAX` 4 → 1.5. 시즌당 ×1.35는 그대로이고, S1 ×1 · S2 ×1.35 · S3부터 ×1.5다. 이미 받은 보상은 건드리지 않는다. 배율은 수령 시점에 계산되므로 `DATA_VERSION`도 그대로다.
- **체감형 사다리**
  - `ESSENCE_LADDER_SOFTCAP_RANK`(1,000)까지는 단계당 150 정수 그대로다. 1회차는 계승까지 800단계 안팎이고, 계승 런은 10%만 넘겨받아 다시 이 구간에서 시작한다.
  - 그 뒤 k번째 단계는 `150 × (1 + k / ESSENCE_LADDER_SOFTCAP_SCALE)`(1,000)이다. 2,000단계에서 단계당 비용이 두 배가 된다.
  - 단계↔정수 변환은 `getLadderEssenceForRank` / `getLadderRank`(역함수, 부동소수 경계 보정) 한 쌍이다. `getRankFromLifetime`은 여전히 단조라, 선형 규칙으로 이미 오른 세이브의 단계는 내려가지 않는다. 대신 새 비용을 채워야 다음 단계에 오르므로 마이그레이션은 두지 않는다.
  - 계승 이월은 남긴 단계의 사다리 정수를 새 비용표로 계산한다.
- **획득률은 건드리지 않았다**: Wave 32에서 √exp로 줄였을 때 1회차가 +23%였기 때문이다.

### 37.2 16시드 A/B (같은 드라이버, 수정 전 main 대 수정 후)

**계승 4회 흐름 (Wave 31·32 방식, 보상 수령 없음)**

| 런 | 바이트 동일 | 모델 시간 합계 | 사망 합계 |
|---|---|---|---|
| 1 | **15/16** | 1,105.4h → 1,104.4h | 38 → 38 |
| 2 | 13/16 | 817.6h → 818.7h | 5 → 5 |
| 3 | 12/16 | 781.3h → 794.6h | 4 → 4 |
| 4 | 11/16 | 586.4h → 569.2h | 8 → 8 |

- 1회차에서 달라진 한 시드는 107h가 걸린 느린 시드였다. 1회차에만 선형 기준 1,320단계를 쌓아 무릎을 넘었고, 모델 시간은 107.1h → 106.2h, 사망은 6 → 6이다.
- 계승 런에서 갈라진 시드도 무릎을 넘은 경우다(런당 획득 단계 최대 954~1,380).
- 위반 0, 저장 왕복 diff 0(2,041 → 2,039회).

**계승을 미룬 225 모델시간 (엔드게임 + 보상 수령, §36과 같은 배치)**

| | 수정 전 | 수정 후 |
|---|---|---|
| 영구 공격력 중앙값(최대) | 4,167 (4,867) | **2,705 (2,912)** |
| 시즌 무료 트랙 골드 중앙값 | 약 631만 | **약 261만** |
| 최대 보유 골드 중앙값 | 약 750만 | **약 464만** |
| 사망(심연) | 53 (30) | 52 (29) |
| 심연 최고 층 중앙값 | 59 | 59 |
| 위반 · 저장 왕복 diff | 0 · 0 (2,070) | 0 · 0 (2,062) |

- 심연 벽은 그대로다. 사망은 여전히 보스 층에서 난다.
- 골드는 시즌 몫만 줄었다. 사냥 골드만으로도 여전히 쌓이므로(§35.5), 소비처는 별도 판단으로 남는다.

### 37.3 테스트와 결함 주입

- **`tests/essence-ladder-softcap.test.js` 6행**: 1회차 구간 · 체감(단계 비용 단조 증가, 2,000단계에서 두 배) · 역함수 · 계승 미룬 규모(선형 4,200단계분 정수 → 약 2,700단계) · 기존 세이브 단조 · 계승 이월.
- **`tests/season-reward-scale-cap.test.js` 3행**: 상한 · 실제 `CLAIM_SEASON_REWARD` 30단계(6시즌 무료 골드 = 77,000 × 1.5) · 1시즌 보존.
- **수정 전**: 사다리 파일은 새 함수가 없어 전체 red였고, 시즌은 2/3 red였다. 1시즌 보존 행은 기존 동작 가드다.
- **결함 주입 5종**: 각자 자기 행에서 red였다.

| 주입 | red 행 |
|---|---|
| 단계 선형 계산 | 역함수 · 규모 · 기존 세이브 · 계승 이월 |
| 상한 4 | 상한 · 실제 수령 |
| 선형 이월 | 계승 이월 |
| 단조 제거 | 기존 세이브 |
| 무릎 500 (1회차를 건드림) | 1회차 구간 · 규모 |

- 관련 기존 테스트 166건(시즌 · 정수 · 계승 · 프레스티지 · 거울)은 그대로 통과했다.

### 37.4 정정 — "골드 쓸 곳 없음"은 드라이버 정책의 결과였다

§35.5와 §36.3은 후반 골드를 "쓸 곳이 없다"고 적었다. 그런데 게임에는 이미 큰 골드 소비처인 **장비 강화**(`ENHANCE_ITEM`)가 있다. 드라이버는 강화 버튼을 한 번도 누르지 않았다.

- **비용**: `BALANCE.ENHANCE_COSTS`는 +1 150골드에서 +10 90,000골드까지다. `ENHANCE_RATES` 성공률(90% → 18%)을 반영하면, 장비 하나를 +10까지 올리는 기대 비용이 **약 88만 골드**이고 강화 재료는 약 87개다.
- **규모**: 무기·방어구·보조장비를 모두 올리면 약 265만 골드다. 레벨이 오르며 장비를 바꿀 때마다 다시 든다.
- **결정은 그대로 유효하다**: 시즌 배율 상한 하향은 공급 쪽 조정이다. 다만 "소비처가 없다"는 전제는 틀렸다. 강화가 후반 골드를 실제로 얼마나 흡수하는지, 강화 재료가 충분히 나오는지는 다음 감사(강화 · 제작 · 합성 · 에테르 거울 소비 루프)가 잰다.

### 37.5 증빙 델타

- `progression-diagnostic-v2`: 리포트 · 기준선 바이트 동일. 소스 핀 364개 중 `constants.ts` · `essenceLedger.ts` 2개만 움직였다. 성장 모델은 무릎 아래 구간에 머문다.
- `equipment-combat-power`: `constants.ts` 핀(tierHash) 하나만 움직였다.
- 나머지 증빙은 바이트 불변이다. tracked verify **15/15**.

### 37.6 게이트 (직렬 12:11~12:42)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,382/5,382**(377파일, skip 0 — Wave 35 대비 +9) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 992ms / mobile 628ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.


## 38. Wave 38 — 소비 루프 자연 플레이 감사: 강화 · 제작 · 합성 · 에테르 거울 (2026-09-29, 베이스 `main` = `b49e3d4b` = PR #70 merge commit)

§37.4가 남긴 질문을 잰다. 강화가 후반 골드를 실제로 흡수하는지, 강화 재료가 충분히 나오는지, 제작 · 합성 · 거울이 어디까지 소비처로 작동하는지다. Wave 36의 엔드게임 + 보상 수령 드라이버에 소비 정책 네 개를 붙여 같은 16시드를 탐험 9,000회(225 모델시간)씩 걸었다. 드라이버는 저장소 밖 감사 도구이고, 게임 코드는 바꾸지 않았다.

### 38.1 소비 정책 (UI가 보여 주는 판정 그대로)

- **강화**: 마을에서 무기 → 방어구 → 보조장비 순으로 `getEnhanceAvailability`가 부족분 없음을 보이고 골드가 비용의 두 배 이상이면 누른다(절반은 휴식 · 물약 몫으로 남긴다). 강화 재료는 팔지 않는다.
- **에테르 거울**: 보유 정수의 절반 이하 비용인 노드 중 가장 싼 것을 산다.
- **제작**: `getCraftingInvestmentPreview`가 제작 가능하고 골드가 두 배 이상일 때만이다. 장비는 결과가 UI의 '추천 교체'(`getEquipmentDecision` 장착 가능 · 점수 > 0)일 때, 소모품은 두 개 미만 보유할 때 만든다. 다음 가방 단계 재료를 쓰는 제법은 건너뛴다.
- **합성**: 같은 종류 · 단계 장비 3개가 상점 정책이 팔 잉여(추천 교체가 아닌 것)로 모이면, 골드가 두 배 이상일 때 판매 대신 합성한다. 보호권은 쓰지 않는다.
- 계측: 거울 트리 완성 시점, 강화 재료 획득(지역 · 레벨대별), 강화 성공 시점, 제작 결과별 수, 합성 단계별 성공 · 결과가 추천 교체인지, 그리고 장비 제법별로 "추천 교체인데 재료가 없다" · "만들 수 있는데 추천 교체가 아니다"를 기록했다.

### 38.2 결과 (16시드 × 225 모델시간)

- **안정성**: 불변식 위반 0, 강화 · 거울 · 제작 · 합성 거부 0, 저장 봉투 왕복 **2,030회 diff 0**. 새 코드 결함은 0이다.

| 소비처 | 중앙값 (최소~최대) | 비고 |
|---|---|---|
| 강화 재료 획득 | **10개** (5~26) | Lv40 이후 획득은 16시드 합계 2개 |
| 강화 성공 · 골드 | 9회 · **3,850골드** (1,650~13,150) | 무기 최고 +3, 방어구 +1, 보조장비 0 |
| 거울 트리 완성 | **15.1h · Lv33** (12.0~18.8h) | 16/16 완성, 이후 정수 소비처 없음 |
| 거울 완성 뒤 남은 정수 | **약 93.8만** (누적의 98.5%) | 트리 전체 14,570 |
| 제작 | 58회 · 1,400골드 | 장비 제작은 16시드 합계 **3회** |
| 합성 | 21회(성공 16) · **75,600골드** | 결과가 추천 교체인 경우 시드당 0~1회 |
| 최대 보유 골드 | 약 487만 | 골드 소비처 세 개(강화 · 제작 · 합성) 합계는 약 8만(1.7%) |

- **강화 재료의 출처(16시드 합계 191개)**
  - 지역별: 몰락한 전초기지(Lv18, 광석골렘) 102 · 서쪽 평원(Lv3) 29 · 바람의 고원(Lv14) 14 · 버려진 광산(Lv8) 13 · 고요한 숲(Lv1) 2 · 안전지대에서 받은 보상(업적 · 임무 수령) 31.
  - 레벨대별: Lv1~9 45 · Lv10~19 28 · Lv20~29 95 · Lv30~39 21 · Lv40~49 1 · Lv50~59 1.
  - 225h 뒤쪽의 획득 기록은 심연 사망 뒤 저레벨로 다시 시작한 런의 것이다.
- **데이터로 본 공급원 전부**(코드 확인)
  - 몬스터: 코볼트(18%) · 광석골렘(24%, 1~2개). 사는 곳은 서쪽 평원 Lv3 · 버려진 광산 Lv8 · 바람의 고원 Lv14 · 몰락한 전초기지 Lv18이다.
  - 한정 조우 4개(고요한 숲 · 서쪽 평원): 선택지 하나가 재료 1개다. 영수증이 같은 조우의 반복을 막고, 계승 때 영수증이 비워진다.
  - 계정당 1회 보상 7개: 제작 임무 60 · 65 · 73 · 94, 업적 `ach_craft_20` · `ach_craft_50` · `ach_relic_30`.
  - 상점은 재료를 팔지 않는다(`openShop`은 소모품 · 무기 · 방어구만 진열한다).
- **수요**: 성공률을 반영하면 +5까지 재료 약 11개, +10까지 약 87개와 골드 약 88만이다(§37.4). 공급 10개는 장비 하나를 +4~5까지 올릴 양이다. 측정한 무기 +3 · 방어구 +1과 맞다.

### 38.3 해석 — 골드 소비처는 있는데 재료가 잠그고 있다

- 강화는 설계상 후반 골드를 흡수할 수 있다. 세 부위를 +10까지 올리면 약 265만 골드다. 하지만 재료가 Lv18 이하 지역에서만 나오고, 그 뒤에는 계정당 보상 몇 개뿐이다. 그래서 강화가 쓴 골드는 최대 보유 골드의 0.1% 미만(3,850 / 487만)이다.
- 거울은 Lv33 전후에 끝난다. 1회차 계승 게이트(Lv48, 약 53.8 모델시간)보다 훨씬 이르다. 그 뒤로 정수는 사다리(누적 기준)를 올릴 뿐 쓸 곳이 없다. 다만 사다리는 누적 정수로 단계를 매기므로, 쓰지 않은 정수도 영구 스탯으로는 이미 반영돼 있다. 없어진 것은 "정수를 어디에 쓸지"라는 선택이다.
- 합성은 골드 생성 루프가 아니다. 단계별 평균 판매 가격(`SELL_PRICE_RATIO` 0.5) 기준으로 모든 종류 · 단계에서 "합성 뒤 판매"가 "지금 3개 판매"보다 기대값이 낮다(무기 3→4단계 −1,885, 5→6단계 −60,035). 소비처로만 작동하고, 결과가 추천 교체인 경우는 드물다(결과가 다음 단계 무작위라 직업 · 레벨 제한에 자주 걸린다).
- 장비 제작은 거의 쓰이지 않는다. "추천 교체인데 재료가 없다"가 264(제법 × 시드)였고, 재료가 모였을 때는 이미 드롭 장비에 밀리거나 직업 · 레벨 제한이었다. 이번 감사는 원인을 더 나누지 않았다. 일괄 판매가 제법 재료를 파는지는 재지 않았다.

### 38.4 소유자 판단 거리 (코드 결함 아님)

**(1) 강화 재료 공급 — 후반 골드 소비처를 열 것인가**

| 선택 | 얻는 것 | 잃는 것 | 실패하는 경우 |
|---|---|---|---|
| (a) 상점에서 강화 재료 판매 | 골드 → 재료 변환으로 강화가 곧바로 후반 골드 소비처가 된다 | 골드가 곧 전투력이 되어 탐험의 몫이 줄어든다 | 가격이 고정이면 487만 골드로 세 부위 +10(장비 스탯 +100%)이 한 번에 열려 심연 벽이 한꺼번에 움직인다. 가격 체증이 필요하다 |
| (b) 후반 지역 · 보스 · 심연에 드롭 추가 | 탐험 → 재료 → 골드로 강화하는 루프가 후반까지 이어진다(로그라이크 루프 유지) | 드롭 표와 확률을 새로 조율해야 한다 | 확률을 높게 잡으면 (a)와 같은 급등, 낮게 잡으면 지금과 같다. 자연 플레이 A/B로 확률을 정해야 한다 |
| (c) 현행 유지 | 변화 없음 | 강화는 초반 +3 안팎의 작은 시스템으로 남고 골드는 쌓인다 | 후반 골드가 계속 무의미하다(§35.5 · §36.3의 원래 문제) |

- 권고: **(b)**. 소유자가 사다리를 "로그라이크의 느낌에 맞게" 체감형으로 바꾼 것과 같은 방향이다. 힘이 골드로 사는 것이 아니라 탐험의 결과로 들어온다.
- 확률은 "225h 동안 +10 한 부위" 같은 목표를 정해 드라이버 A/B로 맞춘다.

**(2) 거울 완성 뒤 정수 — 소비처를 늘릴 것인가**

| 선택 | 얻는 것 | 잃는 것 | 실패하는 경우 |
|---|---|---|---|
| (a) 현행 유지 | 사다리가 이미 누적 정수를 힘으로 바꾸므로 힘의 누적은 그대로다 | Lv33 이후 정수를 쓰는 선택이 없다 | 정수 표시가 계속 오르기만 하는 숫자가 된다 |
| (b) 비용이 오르는 반복 노드 | 끝없는 선택지가 생긴다 | 사다리와 같은 역할(영구 힘)을 두 번째로 만든다 | Wave 37이 사다리를 체감형으로 줄인 효과를 되돌린다 |
| (c) 힘이 아닌 노드(편의 · 표시 · 기록) | 선택지를 주면서 힘 누적은 늘리지 않는다 | 새 콘텐츠를 만들어야 한다 | 보상이 약하면 아무도 사지 않는다 |

- 권고: **(a)**, 선택지를 원하면 **(c)**. (b)는 Wave 37의 결정과 충돌한다.

### 38.5 곁가지 — 체인 문구와 보상이 다르다 (내용 결함, 이번 wave에서는 고치지 않음)

`machine_uprising` 2단계 '기계의 선물'에서 거절을 고르면 로그가 "강화 재료가 들어있습니다"라고 말한다. 그런데 실제 보상은 골드 8,000이다(`eventChains.ts`). 문구와 보상 중 어느 쪽을 맞출지는 (1)의 결정과 겹친다. (b)를 고르면 이 선택지가 후반(북부 요새, Lv35) 강화 재료 공급원 하나가 될 수 있다. 그래서 (1)과 함께 고친다.

## 39. Wave 39 — 소유자 결정: 후반 강화 재료 드롭 (2026-09-29, 베이스 `main` = `768cbed7` = PR #71 merge commit)

§38.4 (1)에서 소유자가 **(b) 후반 드롭**을 골랐다. 거울은 **현행 유지**다. 소유자는 처음에 "둘 다(비용 상향 + 시련 노드)"라고 답했다가 "거울은 현행 유지 · 게임을 더 하드하게"로 바꿨다. 그래서 난이도 상향은 다음 wave의 과제다.

### 39.1 설계

- **규칙**: 적 레벨(`enemy.level`)이 `ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL`(25) 이상이면 강화 재료를 한 번 판정한다.
  - 레벨은 스폰이 지역 레벨로 채우고, 심연은 `50 + ⌊층/2⌋`이다.
  - 확률은 일반 `ENHANCE_MATERIAL_LATE_DROP_CHANCE` 2%, 보스 `ENHANCE_MATERIAL_LATE_BOSS_DROP_CHANCE` 50%다.
  - 다른 드롭과 같은 배율(유물 `drop_rate` · 보스 사냥꾼 · 진행 프로필 · 적 `dropMod`)을 받는다.
- **드롭 표에 줄을 넣지 않는다**: 드롭 표가 있는 적은 `processLoot`가 표를 돌린 뒤 곧바로 반환하므로, 고레벨 보너스 장비 판정을 건너뛴다. 후반 적 상당수(폐기된 연구소 · 저주받은 묘지 · 용암 지대 · 세계수 숲 · 폭풍의 고원 · 지하 미궁 · 고대 신전 도시 등)는 표가 없어 보너스 장비만 떨어뜨린다. 표에 강화 재료를 넣으면 그 적들의 보너스 장비가 사라진다.
- **판정 위치**: 두 경로(드롭 표 · 레거시)의 맨 끝이다. 그 앞의 판정 순서는 그대로다.
  - 기준 아래 적은 난수를 더 쓰지 않으므로 초반 전리품은 바이트 그대로다.
  - 기준 이상 적은 추첨 1회(성공하면 아이템 id 1회 추가)다.
- **목표 공급**: 225h 엔드게임 기준으로 Lv25 이상 처치가 약 6,300회다(§38 배치). 2%면 약 126개로, 한 부위 +10(기대 87개)에 둘째 부위 +7 안팎이다. 1회차 계승(Lv48, 약 54h)까지 Lv25 이후 처치 약 1,300회로는 약 26개, 주무기 +7 안팎이다.
- **일괄 판매**: 강화 재료 가격 40은 일괄 판매 기준(`INVENTORY_JUNK_MATERIAL_PRICE_MAX` 30)보다 비싸서, 모은 재료가 버튼 한 번으로 팔리지 않는다(테스트가 고정한다).
- **도감**: 소재 기록의 획득처 줄은 레거시 전리품 표만 읽는다. 그래서 강화 재료 카드에 `MSG.CODEX_ENHANCE_MATERIAL_LATE_SOURCE(25)` 한 줄을 더한다.
- **체인 문구(§38.5)**: `machine_uprising` 2단계 '기계의 선물'의 거절 선택지가 문구대로 강화 재료를 준다(이전 보상은 골드 8,000).

### 39.2 테스트와 결함 주입

- **`tests/enhance-material-late-drop.test.js` 9행**(수정 전 9/9 red)
  - 상수 · 표가 있는 적(표 전리품 유지 + 재료) · 표가 없는 적(보너스 장비 유지 + 재료)
  - 기준 아래(표 몫만 · 난수 추가 0) · 보스 확률 · 2만 회 드롭률(4σ) · 실제 스폰(용의 둥지 · 심연)
  - 도감 안내 · 체인 문구와 보상 일치
- **결함 주입 6종**: 각자 자기 행에서 red였다.

| 주입 | red 행 |
|---|---|
| 기준 무시(모든 적) | 기준 아래 |
| 추정 레벨(EXP 기반) 사용 | 기준 아래 |
| 드롭 표 경로에만 판정 | 표가 없는 적 · 기준 아래 · 보스 · 확률 |
| 보스 확률 = 일반 | 보스 |
| 체인 보상 골드로 되돌림 | 체인 문구 |
| 도감 안내 제거 | 도감 |

- **기존 핀 테스트 3파일**
  - `normal-loot-tier` · `library-loot`은 Lv25 이상 적의 난수 소비 횟수를 정확히 고정한다. 보너스 장비 선택은 그대로 두고, 마지막 추첨 하나를 명시적으로 센다. 비교할 때는 후반 강화 재료만 걷어낸다.
  - `combat-loot-capacity-authority`의 서명 pity 두 행은 훈련 보스를 Lv24에 두어 격리했다.
  - Lv50 보스의 한 칸 경쟁은 새 행이 덮는다. 후보 순서가 표 → 강화 재료라서, 서명이 칸을 얻고 강화 재료는 막히며 서명 pity가 풀린다.

### 39.3 증빙 델타

- `event-reward-coherence`: 거절 선택지 한 행이 gold → item(강화 재료)이다.
- `relic-drop-rate` · `relic-event-chance`: `CombatEngine.loot.ts` 소스 핀만 움직였다(벡터 불변).
- `equipment-combat-power`: `constants.ts` 핀만 움직였다.
- `progression-diagnostic-v2`: 리포트의 `.loot` 절 76개 값(전리품 수 · 첫 전리품까지 시도 · 무전리품 연속)만 움직였다. 전투 · 탐험 · 성장 절과 v1 기준선은 바이트 동일하고, 소스 핀은 8개 움직였다.
- `content-reachability`는 바이트 동일하다. tracked verify **15/15**.

### 39.4 16시드 A/B (같은 드라이버, 소비 정책 켬 — 강화 · 거울 · 제작 · 합성)

**계승을 미룬 225 모델시간 (엔드게임 + 보상 수령, A = §38 배치)**

| | 수정 전 | 수정 후 |
|---|---|---|
| 강화 재료 획득 중앙값 (범위) | 10 (5~26) | **174 (143~190)** |
| 무기 최고 강화 중앙값 (최대) | +3 (+4) | **+9 (+10)** |
| 방어구 최고 강화 중앙값 | +1 | **+7** |
| 54h 시점 무기 강화 중앙값 | +3 | +5 |
| 강화에 쓴 골드 중앙값 | 3,850 | **607,200** |
| 최대 보유 골드 중앙값 | 약 487만 | 약 413만 |
| 사망 (심연) | 46 (27) | 47 (27) |
| 심연 최고 층 중앙값 | 같음 | 같음 |
| 위반 · 저장 왕복 diff | 0 · 0 (2,030) | 0 · 0 (2,020) |

- 재료가 추정(약 126개)보다 많은 것은 유물 · 진행 프로필 드롭 배율이 붙기 때문이다. 결과는 목표(한 부위 +10 근처, 둘째 부위 +7)와 맞다. 확률은 2%로 둔다.
- 재료의 레벨대별 획득: Lv40~49 1,735 · Lv50~59 438 · Lv30~39 334 · Lv20~29 133(16시드 합계). 가장 많이 나온 곳은 지하 미궁(Lv44) 1,312 · 마왕성 308 · 고대 신전 도시 302로, 드라이버가 오래 머문 사냥터 순서다.
- 강화가 후반 골드 소비처로 작동하기 시작했다. 엔드게임 난이도(사망 · 심연 벽)는 거의 그대로다.

**계승 4회 흐름 (Wave 31·32 방식, A = main 워크트리)**

| 런 | 모델 시간 합계 | 사망 합계 |
|---|---|---|
| 1 | 965.4h → 955.1h | 27 → 26 |
| 2 | 815.9h → 805.0h | **0 → 0** |
| 3 | 713.9h → 747.4h | **0 → 0** |
| 4 | 582.1h → 566.6h | 3 → 4 |

- 바이트 동일 시드는 0/16이다. Lv25 이후 처치마다 추첨이 하나 늘어 난수 흐름이 갈라지기 때문이다. 런별 시간 차이는 ±5% 안이다.
- 네 런 동안 무기 최고 강화 중앙값 +3 → +7, 재료 17 → 131, 강화 골드 6,950 → 154,850이다.
- 위반 0, 저장 왕복 1,803/0 → 1,806/0.
- **다음 wave(더 하드하게)의 근거**: 2 · 3회차는 수정 전후 모두 16시드 사망 0이다. 사망은 1회차 중반(사망 레벨 중앙값 Lv22 — §38 이전 배치)에 몰려 있다.

### 39.5 게이트 (직렬 14:56~15:26)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,392/5,392**(378파일, skip 0 — Wave 37 대비 +10) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 756ms / mobile 572ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 40. Wave 40 — 소유자 결정: 게임을 더 하드하게 (영구 스탯 레벨 연동 + 계승 rank 적 레벨 가산) (2026-09-29, 베이스 `main` = `15ae6f94` = PR #72 merge commit)

소유자가 "게임을 더 하드하게 만들 필요가 있다"고 했다(거울은 현행 유지). 레버 후보를 16시드 × 계승 4회 탐침으로 잰 뒤, 소유자가 **둘 다(영구 스탯 레벨 연동 + 계승 rank당 적 레벨 가산)**를 골랐다. 드라이버는 소비 정책(강화 · 거울 · 제작 · 합성)을 켠 상태다.

### 40.1 진단 — 계승 런이 쉬운 이유

- 수정 전 런별 사망 합계(16시드)는 **26/0/0/4**다. 2 · 3회차는 16시드 모두 0이고, 사망 레벨 중앙값은 Lv22다.
- 곱하는 적 강화(rank당 15%)는 26/0/1/8, 후반 적 공격력 기울기 4 → 6은 27/2/0/3, 동적 난이도 안전망 제거는 24/2/0/4였다. 2회차가 움직이지 않았다.
- **거울이 계승 런을 지킨다**: 거울 없는 main은 51/5/4/8이다. 에테르 수호(런마다 치명상 1회 부활)가 계승 런의 한 번의 실수를 흡수한다. 거울은 소유자 결정으로 현행 유지다.
- **기존 결함 — 계승 직후 영구 생명 · 기력이 0이었다**: 계승(ASCEND)은 이름을 남겨 새 게임(`start`)을 다시 타지 않는다. 새 런의 최대 생명은 `INITIAL_STATE`의 150 그대로였고, 넘어온 영구 생명(예: 425)은 첫 전직 때 한꺼번에 들어왔다.
- **탐침 정정**: 첫 탐침의 "영구 스탯 연동"은 저장된 `maxHp`에서 보너스를 빼는 임시 구현이었다. 계승 런에서는 굽지도 않은 보너스를 빼서 최대 생명이 음수가 됐고, 그래서 2 · 3회차 사망 17건은 부작용이었다(불변식 위반 1.4만 건이 신호였다). 실제 구현으로 다시 쟀다.

### 40.2 설계

- **영구 스탯 레벨 연동**(`systems/metaBonusRamp.ts`): 영구 스탯(정수 사다리 · 첫 죽음 · 계승 보상)은 `META_BONUS_FULL_LEVEL`(30)까지 레벨에 비례해 적용된다.
  - 공격력: `calculateFullStats`가 매번 더하므로(Wave 32) `getRampedMetaAtk`로 비율만 곱한다.
  - 생명 · 기력: 저장된 `maxHp`/`maxMp`가 정본으로 남는다. 직접 읽는 곳이 51파일 148곳이라, 값을 저장 밖으로 빼는 대신 **굽는 양**을 연동한다.
  - 재구성(새 게임 · 전직 · 사망 재시작 · 계승) 때 전체량 스냅숏(`player.metaVitalsSnapshot`, 런 범위)을 남기고 그 × 비율만 굽는다. 레벨업은 비율이 오른 만큼만 더 굽는다(`getMetaVitalsLevelUpDelta`).
  - 스냅숏이 없는 기존 세이브는 예전처럼 동작하다가 다음 재구성부터 이 규칙을 따른다. 마이그레이션 · `DATA_VERSION` 변경은 없다(선택 필드, 없음 = 기존 동작).
  - 런 중 정수 단계가 올라도 생명 · 기력은 다음 재구성 때 반영된다(기존 동작 유지). 공격력은 즉시 반영된다.
- **계승 rank 적 레벨 가산**: 전투 레벨 = 레벨 + round(레벨 × min(rank × `PRESTIGE_ENEMY_LEVEL_PCT_PER_RANK`(0.1), `PRESTIGE_ENEMY_LEVEL_PCT_MAX`(0.3))). 생명 · 공격력 · 방어력에만 쓰고, 표시 레벨 · 경험치 · 골드 · 행동 확률은 원래 레벨이다. 기존 rank당 곱하는 적 강화(5%)는 그 위에 그대로 걸린다.
  - **고정 가산이 아닌 이유**: rank당 +1~2레벨 고정은 Lv1~5 지역 적을 몇 배로 만들었다. 영구 스탯 연동으로 초반이 이미 1회차만큼 약해진 상태라, 거울 없이 4회차(rank 3)에 시드 하나가 20~38번 죽는 사망 루프였다. 비례 가산은 초반 지역을 공정하게 두고 중후반을 단단하게 한다.
- **계승 직후 영구 생명 · 기력**: 계승이 Lv1 연동 비율만큼 굽고 스냅숏을 남긴다. 계승 화면이 알리는 "레벨에 비례해 적용"이 생명 · 기력에도 참이 된다.
- **계승 화면**: 적 전투 레벨 가산(%)과 영구 스탯 연동(Lv30에 전부 적용, "매 여정은 약하게 시작합니다")을 알린다(MSG).
- **상태 화면 계승 기록**: "추가 공격력 · 추가 생명" 전체량 옆에 "지금 N% 적용 · Lv30에 전부 적용"을 보여 준다. 전체량만 보이면 낮은 레벨에서 표시와 체감이 어긋난다.

### 40.3 탐침 (16시드 × 계승 4회, 런별 사망 합계 · 시드 하나의 런당 최대)

| 변형 | 거울 있음 | 거울 없음 |
|---|---|---|
| 수정 전 | 26/0/0/4 · 최대 5/0/0/2 | 51/5/4/8 · 최대 7/1/1/2 |
| 연동 + 고정 +2/rank 상한 +4 | 39/3/4/53 · 최대 10/1/2/10 | 51/19/13/188 · **최대 8/5/5/38(루프)** |
| 연동 + 고정 +1/rank 상한 +3 | 39/0/1/15 · 최대 10/0/1/3 | 51/9/12/82 · 최대 8/2/2/20 |
| 연동 + 비례 5%/rank 상한 20% | 39/4/2/2 | 51/11/5/22 · 최대 8/3/3/4 |
| **연동 + 비례 10%/rank 상한 30% (채택)** | 39/5/2/5 · 최대 10/1/1/1 | 51/13/4/32 · 최대 8/3/1/6 |

- 연동 레벨 40(고정 +1 · 상한 +3과 함께)은 1회차가 오히려 쉬워졌다(30/5/1/20). 30으로 둔다.
- 공격력만 연동하면 28/0/1/1로 효과가 없었다. 생명 연동이 핵심이다.

### 40.4 확정 코드 A/B (같은 드라이버)

**계승 4회 흐름**

| | 수정 전 | 수정 후 |
|---|---|---|
| 거울 있음 · 런별 사망 | 26/0/0/4 | **39/5/0/8** (시드 하나의 런당 최대 10/1/0/4) |
| 거울 있음 · 런별 모델 시간 합계 | 955/805/747/567h | 991/860/739/589h (+4%/+7%/−1%/+4%) |
| 거울 없음 · 런별 사망 | 51/5/4/8 | **50/8/14/45** (최대 7/3/2/8) |
| 거울 없음 · 런별 모델 시간 합계 | 1,085/795/789/553h | 1,163/821/848/620h (+7%/+3%/+7%/+12%) |

- 위반 0이다.
- 1회차 사망이 26 → 39(거울 있음)로 늘었다. 1회차 도중 얻는 영구 스탯(첫 죽음 · 사다리)도 연동되기 때문이다.
- 2 · 3회차는 거울의 부활 1회가 여전히 대부분을 흡수한다. 거울을 쓰지 않는 계승 런은 2~4회차 모두 위험하다.

**계승을 미룬 225 모델시간 (엔드게임, rank 0 — 적 레벨 가산 없음)**

| | 수정 전 | 수정 후 |
|---|---|---|
| 사망 (심연) | 47 (27) | **59 (26)** |
| Lv30 미만에서의 사망 | 20 | **33** |
| 심연 최고 층 중앙값 | 69 | 69 |
| 강화 재료 · 무기 최고 강화 중앙값 | 174 · +9 | 155 · +9 |
| 위반 · 저장 왕복 diff | 0 · 0 | 0 · 0 (2,051) |

- 심연에서 죽으면 Lv1부터 다시 영구 스탯 연동을 밟으므로, 엔드게임의 사망 비용이 커졌다(재시작 초반 사망 증가).

### 40.5 드라이버 정정 (저장소 밖)

- 거울 없는 배치에서 소프트락 1건이 났다. 원인은 드라이버였다.
  - 한정 조우의 두 선택지가 모두 막혔다(기력 1 < 10, 가방 20/20).
  - 게임은 거부를 `currentEvent.choiceFeedback`으로 싣고(Wave 27 N1) 닫기 버튼을 준다.
  - 드라이버는 "상태가 그대로면 거부"로만 판정했다. 그래서 거부 표시를 진행으로 오인하고 같은 선택지를 되풀이했다.
- 이제 `choiceFeedback`도 거부로 보고 다른 선택지를 시도한 뒤 닫는다.
- 수정 전 배치(w39 · main 거울 없음)에는 소프트락이 0건이었으므로, 드라이버 수정으로 기준 배치의 결과는 달라지지 않는다.

### 40.6 테스트와 결함 주입

- **`tests/meta-bonus-ramp-and-rank-enemy-level.test.js` 12행**
  - 연동 규칙: 상수 · 전투 공격력 연동 · 재구성 굽기와 스냅숏 · `start()` · 레벨업 누적(Lv2~40 매 레벨 차이 = ⌊스냅숏 × 비율⌋)
  - 호환 · 재구성 경로: 기존 세이브 보존 · 사망 재시작 · 계승(기존 결함)
  - 적 가산: 비례 가산(보상 · 표시 레벨 불변) · 초반 지역 보호
  - 화면: 계승 화면 · 상태 화면
- **결함 주입 10종**: 각자 자기 행에서 red였다.
  - 공격력 전부 적용 · 재구성 전부 굽기 · 레벨업 누락 · 기존 세이브에 누적
  - 사망 재시작 전부 굽기 · 가산 상한 제거 · 고정 가산 · 계승 굽기 누락
  - 보상에 가산 · 화면 줄 제거
- **기존 테스트 3개 갱신**
  - 첫 죽음 보너스는 연동 완료 레벨에서 전투 공격력에 반영됨을 본다.
  - rank5 곱연산은 가산된 전투 레벨 위에서 본다.
  - `cycle 532`는 `(meta.bonusHp || 0)` 소스 텍스트 대신 동작(없음 · null · 음수 · NaN → 0)으로 고정한다.

### 40.7 증빙 델타

- 소스 핀만 움직였다(`metaBonusRamp.ts` 추가, 소스 364 → 365).
- 성장 진단 리포트 · 도달 비용 · 페이싱은 바이트 동일하다. 모델은 rank 0 1회차라 영구 스탯이 작고 적 가산도 없다.
- tracked verify **15/15**.

### 40.8 게이트 (직렬 00:49~01:10)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,404/5,404**(379파일, skip 0 — Wave 39 대비 +12) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 628ms / mobile 472ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 41. Wave 41 — 직업 경로 8종 자연 플레이 감사 (2026-09-30, 베이스 `main` = `48d242d1` = PR #73 merge commit)

지금까지 자연 플레이 드라이버는 전직할 때마다 첫 후속 직업만 골랐다(전사 → 나이트 → 드래곤 나이트). 직업 트리의 말단 경로는 8개다. Wave 40이 난이도를 올린 뒤 어느 경로가 막히는지 잰다. **코드 결함은 0이고, 경로 사이의 난이도 차이 하나가 소유자 판단 거리로 남는다.**

### 41.1 방법

- 드라이버(저장소 밖)에 `JOB_PATH`를 붙여 경로를 고정했다. 8경로 × 16시드 × 계승 4회이고, Wave 40과 같은 조건(거울 · 강화 · 제작 · 합성 켬)이다.
- 전투 정책은 드라이버가 정하는 부분이다. 전투 화면의 예보(`combatForecast`)는 이미 고른 기술에 대한 조언만 하고 기술을 고르지 않는다. 그래서 정책 7종으로 돌리고, 경로마다 가장 잘 나온 정책을 그 경로의 값으로 쓴다(숙련 플레이어 가정).
  - 피해 최대 기술(기존 정책) · kit(생명 50% 미만에 회복 기술, 보스 · 정예에 강화 · 약화 첫 수) · 회복 50% · 회복 35% · 공포만 · 공격 강화만 · 회복 35% + 공포
  - 기존 정책은 새 드라이버에서 바이트 동일하다(시드 3 대조).
- 측정 전용 기록을 붙였다: 레벨업 때 장착 장비와 전투 스탯, 지역 × 직업 교전 · 사망, 직업 × 레벨 구간 교전 · 사망. 붙인 뒤에도 사망 수는 바이트 동일했다(24 · 52 · 34).
- 레버 탐침은 탐침용 작업 사본에서 돌렸다. 수정 없이 돌린 사본이 기준과 16/16 바이트 동일한 것을 먼저 확인했다.

### 41.2 결과

- 위반 0 · 소프트락 0 · 계승 4회 완주 128/128(8경로 × 16시드). **새 코드 결함은 0이다.**
- 경로별 최선 정책의 1회차 사망 합계(16시드): 마법사 → 아크메이지 22 · 전사 24 · 도적 34 · 무당 42 · **성직자 52**.
  - 경로마다 최선 정책이 다르다. 도적은 kit(은신)로 54 → 34, 무당은 kit(흡수)로 50 → 42, 전사 · 마법사는 kit에서 오히려 나빠졌다(첫 수에 턴과 기력을 쓴다).
- 48시드로 다시 잰 1회차 시드당 사망: 전사 1.31(모델 57.1시간) · 아크메이지 2.29(61.5시간) · **성직자 3.75(66.4시간)**. 성직자 경로는 전사의 2.9배이고 약 6 표준오차다.

### 41.3 원인 분해 — 무엇이 아닌가

- **스탯이 아니다.** 같은 레벨에서 성직자의 공격력 · 최대 생명은 오히려 높다(Lv30 중앙값: 성직자 592 / 1,558, 전사 526 / 1,325, 도적 437 / 1,128).
- **장비도 아니다.** 모든 경로가 Lv8~30을 무기 15 · 방어구 8~10으로 지낸다.
- **교전당 위험은 성직자가 가장 낮다.** 직업별 1,000교전당 사망은 다음과 같다(경로별 최선 정책).

| 직업 | 1,000교전당 사망 | 교전 수 |
|---|---|---|
| 마법사 | 12.3~17.0 | 1,411~1,866 |
| 도적 | 6.9 | 4,936 |
| 무당 | 5.6 | 2,484 |
| 전사 | 5.0 | 4,791 |
| 성직자 | 1.45 | 20,010 |
| tier 2 이상 | ≈ 0 | — |

- 레벨 구간으로 나누면 차이가 보인다.
  - Lv5~11이 모든 tier 1에서 가장 위험하다(9.7~19.7).
  - Lv20~29에서 성직자 4.52 · 무당 3.89인데, 같은 구간의 마법사(아크메이지 경로)는 1.79다. Lv12에 성직자 · 무당으로 바꾸면 이 구간이 마법사로 남을 때보다 약 2.5배 위험하다.
  - Lv30~44의 성직자는 0.28이다. "Lv30에 상위 직업이 없다"는 가설은 사망 약 4건만 설명한다.
- 사망하면 Lv1부터 다시 시작한다. 그래서 경로의 사망은 가장 위험한 Lv5~11을 다시 지나게 만들고 스스로 불어난다.
- **기각한 레버 가설 (성직자 경로, 회복 정책, 48시드, 기준 3.75 ± 0.36)**

| 탐침 | 시드당 사망 | z |
|---|---|---|
| 성직자 생명 1.5 · 공격력 1.6 | 3.02 | −1.5 |
| 성직자 기술 배율 상향(신성 광선 2.4 · 성스러운 빛 3.4) | 3.71 | −0.1 |
| 팔라딘 `reqLv` 30 | 3.58 | −0.3 |
| 마법사 생명 0.85 | 4.10 | +0.7 |
| 성스러운 빛에 기절 부여 | 3.52 | −0.5 |
| (반대 방향) 아크메이지 경로에서 썬더볼트 기절 제거 | 2.29 → 2.50 | +0.5 |

- 방향이 있는 것은 생명 · 공격력 동시 상향 하나이고, 간극의 약 30%만 줄인다.
- 원인은 단일 수치가 아니다. 경로의 구조(가장 위험한 구간의 길이 · 재시작 복리)에서 나온다.

### 41.4 방법 교정 — 16시드 A/B의 잡음

- 16시드 사망 합계의 표준편차를 48시드로 실측했다. 성직자 경로는 약 9.9, 전사 경로는 약 4.8이다. 16시드 탐침의 ±10~15 차이는 잡음 안이었다(마법사 생명 0.85가 16시드에서 22 → 32로 "나빠진" 것이 그 예다).
- 그래서 Wave 40 A/B를 48시드로 다시 쟀다(`15ae6f94` vs `48d242d1`, 전사 경로, 기존 정책).

| 회차 | 거울 있음 사망(48시드) | z | 거울 없음 사망(48시드) | z |
|---|---|---|---|---|
| 1 | 57 → 81 | 1.6 | 85 → 106 | 1.1 |
| 2 | 2 → 3 | 0.5 | 15 → 39 | 3.0 |
| 3 | 2 → 2 | 0.0 | 11 → 39 | 4.0 |
| 4 | 4 → 27 | 3.8 | 30 → 138 | 4.8 |

- Wave 40은 계승 런을 유의하게 어렵게 만든다. 1회차 증가는 약하다(z 1.1~1.6). 거울 있는 2 · 3회차는 여전히 0에 가깝다(Wave 40 PR이 적은 그대로다). 위반은 0 → 0이다.
- 앞으로 밸런스 레버 판정은 **48시드**를 기준으로 한다. 16시드는 방향 탐색용이다.

### 41.5 소유자 판단 거리

경로 사이의 난이도 차이(성직자 경로 1회차 사망이 전사의 2.9배, 모델 시간 +16%)를 받아들일지 줄일지다.

- (a) **현행 유지**: 직업마다 어려움이 다른 것을 로그라이크의 선택으로 둔다. "더 하드하게"와 방향이 같다. 전직 화면은 생명 · 기력 · 공격력 배율을 이미 보여 준다.
- (b) **성직자 생명 · 공격력 상향**(1.0 / 1.3 → 1.5 / 1.6): 48시드에서 측정된 유일한 방향성 레버다. 사망 −19% · 1회차 모델 시간 −7%로, 간극의 약 30%를 줄인다. 성장 시뮬레이터의 `jobSnapshots`가 직업 스탯을 담으므로 골든 재고정이 따라온다(레벨 · 시간 앵커는 직업 스탯을 읽지 않는다).
- (c) **원인 조사 계속**: 가장 위험한 구간(Lv5~29 tier 1)의 길이와 재시작 복리를 겨냥한 레버를 48시드로 찾는다. 계산 비용이 들고 레버가 보장되지 않는다.

## 42. Wave 42 — 소유자 결정: 직업별 강점 · 약점 강조 (2026-09-30, 베이스 `main` = `cd03163b` = PR #74 merge commit)

§41.5의 경로 난이도 판단 거리에 소유자가 "직업별로 차별화된 강점 및 단점을 강조하는 방향"을 골랐다. 이 wave는 두 가지를 한다. 광고한 강점이 실제로 작동하게 하고, 강점 · 약점을 데이터에 선언해 전직 화면에 보여 준다.

### 42.1 진단 — 강점이 드러나지 않던 이유

- 직업별 기술 구성을 수치로 뽑으면 대부분이 비슷한 조합(지속 피해 · 방어 강화 · 약화 한두 개)이다. 이미 뚜렷한 것은 마법사(속성 4종 · 행동 봉쇄 · 생명 0.7)와 전사(생명 1.4 · 기력 0.6) 정도다.
- 전직 화면은 `desc`를 '—'로 나눈 문구와 생명 · 기력 · 공격력 등급(낮음/보통/높음)만 보여 줬다. 강점 · 약점은 어디에도 없었다.
- 광고와 엔진이 어긋난 곳이 둘 있었다. 둘 다 직업의 강점을 깎는 쪽이다.
  - **회복 기술의 "N턴 지속 회복"이 없었다.** 기적의 손길(15% + 3턴) · 역경의 힘(3턴) · 기적의 부활(30% + 2턴 재생)은 즉시 한 번 회복하고 끝났다. 턴마다 회복하는 코드는 유물 · 시너지뿐이었다.
  - **회복이 방어 강화를 지웠다.** 이 기술들은 `type: 'buff'`라 강화 칸(`tempBuff`)에 빈 강화(공격 0 · 방어 0)를 넣었다. 신성한 보호막(방어 +60%) 뒤에 기적의 손길을 쓰면 보호막이 꺼졌다.
  - **공포는 기술과 무관하게 2턴 · 공격력 −30%였다.** 전투 함성(3턴 −25%) · 군주의 위엄(4턴 −35%) · 공포(3턴 −30%)가 모두 같았다.
- 하나는 이번 범위 밖으로 남긴다. 마법사 화염구 B '지속 화염'(`burnTurn`)은 화상이 이미 전투 끝까지 가므로 의미가 없고, 기본 기술과 결과가 같다. `skill-branch-parity`의 `KNOWN_DEAD_OVERRIDE_KEYS`가 이미 적어 둔 항목이다.

### 42.2 변경

- **지속 회복**: 회복 기술은 즉시 `val`을 회복하고, 그 뒤 `turn`턴 동안 턴마다 `val / turn`을 더 회복한다(합계 2 × val). 상태는 `player.skillRegen`(선택 필드)이고 `tickCombatState`가 틱한다. `tempBuff`와 같은 모델로 전투 턴에만 줄어든다.
- **회복은 강화 칸을 쓰지 않는다.** '수호의 손길'(`defBonus`)은 기존 else-if 분기가 방어 강화를 그대로 준다.
- **약화 기술은 자기 수치를 쓴다.** 공포는 기술의 `turn` · `val`(공격력 배율, 없으면 `FEAR_ATK_MULT`)을, 실명 · 도발은 `turn`을 쓴다. 이미 더 강한 약화가 걸려 있으면 최솟값을 유지한다. 공포 기술 4개에 `val`을 넣었다(0.75 · 0.65 · 0.7 · 0.7 — 광고 문구 그대로).
- **강점 · 약점 선언**: `CLASSES[*].traits = { strengths, weaknesses }`(17개 직업, 모험가 제외). 어휘는 강점 16종 · 약점 6종이고 라벨은 `MSG.CLASS_TRAIT_LABELS`가 가진다.
- **전직 화면**: 고른 직업의 강점(초록) · 약점(호박색)을 등급 줄 아래에 그린다(`job-change-traits`). 직업 카드는 2열 모바일 격자라 그대로 둔다.

| 직업 | 강점 | 약점 |
|---|---|---|
| 전사 | 높은 생명 · 방어 기술 | 적은 기력 · 속성 공격 없음 |
| 마법사 | 높은 화력 · 다양한 속성 · 행동 봉쇄 | 낮은 생명 |
| 도적 | 치명타 · 회피 · 지속 피해 | 회복 기술 없음 |
| 성직자 | 자가 회복 · 상태이상 정화 · 빠른 성장 | 낮은 화력 · 단일 속성 |
| 무당 | 지속 피해 · 자가 회복 · 확정 이탈 | 낮은 생명 · 낮은 화력 |
| 나이트 | 높은 생명 · 방어 기술 · 적 약화 | 적은 기력 |
| 버서커 | 높은 화력 · 높은 생명 · 자가 회복 | 적은 기력 |
| 아크메이지 · 대마법사 | 높은 화력 · 다양한 속성 · 행동 봉쇄 | 낮은 생명 |
| 흑마법사 | 지속 피해 · 자가 회복 · 높은 화력 | 낮은 생명 |
| 어쌔신 | 치명타 · 회피 | 회복 기술 없음 |
| 레인저 | 다양한 속성 · 행동 봉쇄 · 추가 골드 | 회복 기술 없음 |
| 팔라딘 | 높은 생명 · 자가 회복 · 행동 봉쇄 | 단일 속성 |
| 드래곤 나이트 | 높은 화력 · 높은 생명 · 지속 피해 | 적은 기력 |
| 그림자 주군 | 치명타 · 높은 화력 · 회피 | 회복 기술 없음 |
| 시간술사 | 추가 행동 · 치명타 · 확정 이탈 | 회복 기술 없음 |
| 사냥의 군주 | 행동 봉쇄 · 추가 골드 · 높은 생명 | 회복 기술 없음 |

### 42.3 계약 — 선언은 데이터 근거가 있어야 한다

- `tests/class-traits-contract.test.js`는 특성마다 근거 술어를 둔다.
  - 생명 · 기력: 배율 경계(생명 ≥ 1.4 강점 · ≤ 0.9 약점, 기력 ≥ 1.8 · ≤ 0.8).
  - 화력: tier마다 공격 배율의 폭이 달라 tier별 경계를 쓴다(강점 1.5 / 2.0 / 2.3, 약점 1.3 / 1.7 / 1.9).
  - 나머지: 해당 효과의 기술이 실제로 있어야 한다(행동 봉쇄 = 기절 · 빙결 기술, 자가 회복 = `hp_regen` · `drain` 기술 등).
- 같은 축의 강점과 약점을 함께 가질 수 없고, 같은 뿌리의 후속 직업들은 강점 구성이 서로 달라야 한다(Lv12 성직자 · 무당 선택이 정보가 된다).
- 전직 화면 렌더 단언: 고른 직업의 강점 · 약점 라벨이 각 줄에 있다.
- `tests/class-skill-effect-delivery.test.js`: 회복 3종의 즉시 · 지속 회복량과 만료, 회복이 방어 강화를 지우지 않음, 최대 생명 상한, 공포 4종의 지속 턴 · 배율, 더 강한 약화 유지, 실명 · 도발 지속 턴.

### 42.4 측정 (48시드 × 계승 4회, 경로별 최선 정책)

광고 일치 수정은 사망 · 모델 시간을 유의하게 바꾸지 않았다.

| 군 | 1회차 시드당 사망 | 2~4회차 |z| 최대 |
|---|---|---|
| 성직자 회복 정책 | 3.75 → 3.96 (z 0.4) | 1.3 |
| 성직자 kit 정책 | 4.10 → 3.98 (z −0.2) | 1.0 |
| 전사 공포 정책 | 1.31 → 1.40 (z 0.3) | 1.7 |

- 위반 0 → 0, 모든 시드 완주. 회복 기술 사용 4,620회(회복 정책) · 공포 16,235회(전사)로 효과가 실제로 쓰였다.
- 즉 이 wave의 효과는 밸런스가 아니라 **정직성과 가독성**이다. 기술 설명이 곧 동작이고, 전직 화면이 직업의 장단을 말한다. 경로 사이의 난이도 차이(§41)는 그대로다 — 강점을 수치로 키우는 것은 별도 소유자 판단이다.

### 42.5 결함 주입 13종

- 각자 자기 행에서 red였다. 지속 회복 틱 제거 · 지속 회복 미등록 · 회복이 강화 칸 사용 · 공포 턴 무시 · 공포 배율 무시 · 더 강한 약화 덮어쓰기 · 실명 턴 무시 · 도발 턴 무시 · 근거 없는 강점 · 같은 축 강점과 약점 공존 · 형제 직업 강점 중복 · 전직 화면 줄 제거 · 라벨 누락.
- **처음 실명 턴 무시 주입은 0 red였다.** 실데이터의 연막탄 턴(2) · 도발 턴(3)이 엔진 기본값과 같아 "기술의 턴을 읽는다"를 가르지 못하는 공허참이었다. 기본값과 다른 턴(5)으로 읽기 경로를 고정해 판별을 확보했다.

### 42.6 증빙 델타

- 소스 핀 8개만 움직였다(JobChangePanel · classes · messages · CombatEngine.actions · CombatEngine · types/class · types/player · classPresentation).
- 성장 진단 리포트 해시 · 도달 비용 · 페이싱은 동일하다. 모델은 회복 · 공포 기술을 쓰지 않고 `traits`를 읽지 않는다.
- tracked verify **15/15**.

### 42.7 게이트 (직렬 04:51~05:12)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,418/5,418**(381파일, skip 0 — Wave 40 대비 +14) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 584ms / mobile 416ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 43. Wave 43 — 소유자 결정: 강점 · 약점을 수치로도 강조 (B+C) (2026-09-30, 베이스 `main` = `5fbd663b` = PR #75 merge commit)

§42는 강점 · 약점을 선언하고 보여 줬지만 수치는 그대로였다. 옵션 두 개를 48시드로 따로 잰 뒤(§43.1) 소유자가 **둘 다(B+C)**를 골랐다. 두 옵션 모두 사망 · 모델 시간을 유의하게 바꾸지 않아, 체감용 선택으로 제시했다.

### 43.1 옵션 탐침 (각 48시드 × 계승 4회, Wave 42 이후 기준 대비)

| 옵션 | 경로 | 1회차 시드당 사망 | 비고 |
|---|---|---|---|
| B 자가 회복형 강점 강화 | 성직자 | 3.96 → 4.04 (z 0.1) | 4회차 2.19 → 1.60 (z −1.8) |
| | 무당 | 2.77 → 2.92 (z 0.3) | |
| C 약점 강화(생명 · 기력 −0.1) | 아크메이지 | 2.29 → 2.69 (z 0.9) | |
| | 무당 | 2.77 → 3.08 (z 0.7) | |
| | 전사 | 1.40 → 1.50 (z 0.4) | 2 · 4회차 사망 감소(z −3.0 · −2.4) — 아래 |

- **전사 경로의 감소는 드라이버 산물이다.** 나이트 기력이 줄자 드라이버의 "쓸 수 있는 최고 배율 기술" 규칙이 80 기력의 신성한 심판을 덜 쓰고 20 기력의 실드배시(기절)를 더 썼다. 기절한 적은 공격하지 않는다. 계승 런 나이트 Lv30~44 사망이 22 → 7이었다. 기절을 의도적으로 쓰는 플레이어에게는 없는 효과다.

### 43.2 변경

- **B — 자가 회복형 강점 강화**: 기적의 손길 0.15 → 0.25(분기 A 0.22 → 0.35 · B 0.15 → 0.25) · 기적의 부활 0.3 → 0.4 · 역경의 힘 0.05 → 0.1 · 생명흡수 기본 0.25 → 0.4(분기 A "흡수량 +30%" 0.325 → 0.52) · 혼의 흡수 0.30 → 0.45 · 흡혈의 낫 0.35 → 0.5. 기술 설명의 백분율을 같은 값으로 옮겼다(역경의 힘은 "HP 낮을수록 강해짐"이 구현되지 않은 문구라 "HP 10% 회복 + 3턴간 지속 회복"으로 바꿨다).
- **C — 약점 강화**: 낮은 생명 직업 생명 −0.1(마법사 0.6 · 아크메이지 0.7 · 흑마법사 0.8 · 대마법사 0.75 · 무당 0.8), 적은 기력 직업 기력 −0.1(전사 0.5 · 나이트 0.7 · 버서커 0.4 · 드래곤 나이트 0.6).
- **계약 강화**(`tests/class-traits-contract.test.js`): 낮은 생명 ≤ 0.8 · 적은 기력 ≤ 0.7 · 자가 회복은 회복 10% 이상 또는 흡수 40% 이상. 강조 폭을 고정하는 행과, 전 직업 · 분기의 회복 · 흡수 기술 설명 백분율이 데이터 값과 같은지 대조하는 행을 더했다.

### 43.3 결합 측정 (B+C, 48시드)

| 경로 | 1회차 시드당 사망 | 2~4회차 | 1회차 모델 시간 |
|---|---|---|---|
| 전사(공포) | 1.40 → 1.50 (z 0.4) | 감소(드라이버 산물, §43.1) | 57.2 → 58.4 |
| 아크메이지(공격 강화) | 2.29 → 2.69 (z 0.9) | |z| ≤ 1.1 | 61.5 → 61.0 |
| 성직자(회복) | 3.96 → 3.71 (z −0.5) | |z| ≤ 1.0 | 66.3 → 63.3 |
| 무당(kit) | 2.77 → 2.98 (z 0.5) | |z| ≤ 1.3 | 65.9 → 63.7 |

- 위반 0, 모든 시드 완주. 전사 경로는 B가 닿지 않는 직업이라 C 단독과 바이트 동일했다(측정 경로 정합의 확인).
- **측정 사고 1건**: 결합 측정 중 이전 해시를 재려고 `git stash`를 잠깐 썼다. 드라이버가 같은 작업 트리의 `src`를 읽으므로 그 몇 초에 시작한 시드는 옛 데이터를 읽었을 수 있다. 진행 중이던 아크메이지 군을 버리고 나머지 세 군을 처음부터 다시 쟀다(전사 군은 그 전에 끝나 오염이 없다). 이후 측정 중에는 작업 트리를 바꾸는 git 명령을 쓰지 않는다.

### 43.4 증빙 · 핀

- 성장 시뮬레이터 리포트에서 바뀌는 키는 `jobSnapshots` 하나다(해당 9개 직업의 생명 · 기력). 곡선은 불변이다.
  - `tests/progression-simulator.test.js` 기준 해시 `2ecb560d…` → `cfffe884…`
  - `scripts/progression-diagnostic-evidence.mjs`의 `PROGRESSION_V1_BASELINE_HASH` `696607d2…` → `404dafaa…`(writer 안의 하드 게이트라 갱신 전에는 `PROGRESSION_SCHEMA_V1_BASELINE_DRIFT`로 쓰기를 거부했다).
- 증빙 재생성 순서는 §14의 절차 그대로다: 기준 해시 → 도달 비용 → 페이싱(`exploration-rhythm.json`, 참조 해시 2개만 이동) → 성장 진단(마지막) → 소스 핀.
- 기존 값 핀 갱신: `skills-cycle`(cycle 257/258의 흡수 값 3개 — 설명 동기 단언을 함께 넣었다).
- 장비 전투력 감사(`equipment-combat-power-audit`)의 report · rows 해시: 직업 생명 · 기력 배율이 직업별 비교 행 445개 값에 들어가 움직였다. 분류는 그대로다(in-corridor 154 · 결함 0 · 재계획 불필요). 처음 전체 unit에서 이 실패를 증빙 소스 핀으로 잘못 분류해 게이트에서 다시 잡혔다.

### 43.5 결함 주입 7종 · 검증

- 각자 자기 행에서 red였다: 마법사 생명 되돌림 · 전사 기력 되돌림 · 회복값만 되돌리고 설명 유지 · 설명 미갱신 · 무당 흡수 약화(0.3) · 버서커 회복 약화(0.05) · 분기 A 흡수 비례 미갱신.
- 무당 흡수 약화는 계약 근거 행(자가 회복 크기 경계)에서도 red였다 — 강조 폭이 선언의 조건이 됐다.
- tracked verify **15/15**.

### 43.6 게이트 (직렬 06:25~06:46, unit은 핀 갱신 뒤 재실행)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,420/5,420**(381파일, skip 0 — 첫 실행 5,419/5,420은 §43.4의 장비 전투력 감사 해시 핀, 갱신 뒤 재실행) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 628ms / mobile 632ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 44. Wave 44 — 적 약화 "N턴" = 적 행동 N번, 겹친 약화는 각자 만료 (2026-09-30, 베이스 `main` = `a7285f1e` = PR #76 merge commit)

§42의 규칙("직업 기술의 광고와 동작은 같아야 한다") 아래의 결함 수정이다. 새 소유자 결정은 없다. 두 결함이 `tickEnemyStatus` 한 함수에 있었다.

### 44.1 결함 (엔진 직접 호출 실측 — 적 공격력 1000 · 방어 0 · 기본 패턴 방어 0 · 강타 0)

| 기술 | 광고 | 수정 전 영향받은 적 행동 | 수정 후 |
|---|---|---|---|
| 전투 함성 (공포 −25%) | 3턴 | 2 | 3 |
| 연막탄 (실명) | 2턴 | 1 | 2 |
| 도발 (강타 고정) | 3턴 | 2 | 3 |
| 저주 (기본 3턴) | 3턴 | 지속 피해 3회 · 공격력 감소 2회 | 3회 · 3회 |

- **지속 턴**: 턴 감소가 적 행동 **전에** 일어나 마지막 턴이 행동 전에 사라졌다. 기절은 이미 N번이었다(행동 판정에서 줄인다) — 한 엔진 안에 두 턴 모델이 있었다. 전투 화면의 "공포 · 1턴"은 다음 공격이 줄지 않는 상태였고, 도발 예고는 마지막 턴에 강타를 예고한 뒤 일반 공격을 했다.
- **중첩**: 실명 · 공포 · 저주가 공격력 배율 하나(`atkMult`)를 함께 쓰고, 어느 하나의 만료가 그 값을 지웠다. 흑마법사 다크메터 → 다음 턴 공포에서 저주가 끝나는 행동의 피해는 공포가 1턴 남았는데도 1000(−30% 소실)이었다. 반대 순서에서는 저주 −25%가 사라졌다.

### 44.2 변경

- `getEnemyDebuffAtkMult(enemy)` — 걸려 있는 약화 중 가장 강한 배율이다. 배율을 저장하지 않고 남은 턴에서 계산한다. 약화는 겹치고 서로 다른 때 끝나므로, 저장 값 하나로는 먼저 끝난 약화가 남은 약화를 지우거나 끝난 약화를 연장할 수밖에 없다. 공포만 기술마다 배율이 달라(§42) `fearAtkMult`로 들고, 만료 때 함께 지운다.
- `enemyAttack`이 **틱 전** 상태로 이번 행동의 약화(배율 · 감소 로그 라벨 · 도발)를 판정한다. 남은 턴 = 앞으로 영향받을 행동 수이고, 전투 화면이 그 값을 그대로 그린다.
- 도발 예고(`predictEnemyNextAction`)도 같은 판정(`isEnemyTauntActive`)을 읽는다.
- 약한 공포는 이미 걸린 강한 공포의 배율을 덮어쓰지 않는다(`mergeFearAtkMult` — 종전 최솟값 동작 유지, 턴은 새로 건 기술).
- **구세이브 호환**: 전투 중 적에 남은 `atkMult`는 읽지 않는다. 배율이 저장되지 않은 공포는 `BALANCE.FEAR_ATK_MULT`(0.7)다 — 전투 함성(0.75) · 군주의 위엄(0.65)으로 건 공포가 복원되면 그 전투에서만 0.05 차이가 난다. 전투 상태의 선택 필드라 `DATA_VERSION`은 그대로다. `Monster.atkMult`는 이제 템플릿 필드(스폰 때 `atk`에 곱해진다)라는 뜻 하나만 가진다.

### 44.3 측정 (48시드 × 계승 4회, `main` 기준)

- **영향 경로 선정**: Wave 43 결합 측정의 `kitSkillUses`에서 공포 · 저주 시전이 있는 경로(전사 공포 15,700회 · 저주는 아크메이지 7,408 · 무당 10,488 · 어쌔신 16,414 등). 드라이버는 연막탄 · 도발을 쓰지 않는다(시전 0) — 실명 · 도발의 수정은 행동 테스트만 지킨다.
- **기준 재사용 검증**: `main`에서 Wave 43 결합 측정의 전사 · 무당 시드 1~4를 다시 돌려 `stops.wallSeconds` 말고는 바이트 동일했다. 그래서 전사 · 아크메이지 · 성직자 · 무당은 Wave 43 결합 측정을 기준으로 그대로 썼고, 흑마법사 · 어쌔신 기준만 새로 쟀다.

| 경로 | 1회차 시드당 사망 | 2~4회차 | 1회차 모델 시간(중앙값) | 런 요약 동일 시드 |
|---|---|---|---|---|
| 전사(공포) | 1.50 → 1.50 (z 0.0) | \|z\| ≤ 1.4 | 58.4 → 59.6 | 7/48 |
| 흑마법사(kit) | 2.85 → 3.00 (z 0.3) | \|z\| ≤ 0.5 | 62.0 → 62.5 | 44/48 |
| 어쌔신(kit) | 2.00 → 2.00 | 동일 | 59.7 → 59.7 | 48/48 |
| 무당(kit) | 2.98 → 2.94 (z −0.1) | \|z\| ≤ 0.8 | 63.7 → 64.0 | 34/48 |
| 아크메이지(공격 강화) | 2.69 → 2.73 (z 0.1) | \|z\| ≤ 0.3 | 61.0 → 61.0 | 45/48 |
| 성직자(회복) | 3.71 → 3.75 (z 0.1) | \|z\| ≤ 0.2 | 63.3 → 63.4 | 45/48 |

- 위반 0, 모든 시드 완주. 효과는 밸런스가 아니라 정직성이다(§42와 같은 결론). 공포를 가장 많이 쓰는 전사 경로도 1회차 사망이 같았다 — 늘어난 한 행동의 감소가 사망을 가르는 싸움(보스 · 연속 강타)에 거의 닿지 않았다.
- 어쌔신 경로는 저주를 16,414회 걸었는데도 48/48 시드의 런 요약이 같았다. 드라이버 로그만으로는 원인을 가리지 않았다(관찰로만 남긴다).

### 44.4 테스트 · 결함 주입

- 신규 `tests/enemy-debuff-duration-stacking.test.js` 7건 — 수정 전 `main`에서 7/7 red였다.
  1. 전 직업 · 분기의 약화 기술(기절 · 빙결을 함께 거는 분기 제외): N턴 = 적 행동 N번, 행동 뒤 남은 턴 = 이후 영향받을 행동 수.
  2. 실명 × 공포 × 저주 남은 턴 0~3 전수 × 공포 배율 3종 × 행동 5번(960 판정). 오라클은 엔진 헬퍼가 아니라 상수 · 데이터에서 만든다.
  3. 실경로: 흑마법사 다크메터 → 공포.
  4. 감소 로그는 실제로 줄어든 공격에만 남는다.
  5. 도발 예고 = 실제 행동.
  6. 약한 공포가 강한 공포를 덮어쓰지 않는다.
  7. 구세이브 호환(잔여 `atkMult` 무시 · 배율 없는 공포는 기본값).
- 기존 갱신 2건: `class-skill-effect-delivery`(공포 배율은 `fearAtkMult`), `player-status-expiry` H1(만료 = 필드 제거 → 배율 1).
- **결함 주입 7종**이 각자 red였다: 틱 뒤 배율(옛 결함) · 먼저 걸린 약화 하나만 사용 · 틱 뒤 도발 플래그 · 약한 공포 덮어쓰기 · 잔여 `atkMult` 읽기 · 틱 뒤 로그 라벨(`tsc`의 미사용 지역 변수로도 잡힌다) · 실명 만료가 공포까지 제거.
- **주입 2는 처음에 공허했다.** 지금 데이터는 실명(0.65) ≤ 공포(0.65~0.75) ≤ 저주(0.75)라 우선순위 순서가 강도 순서와 같아, 공포 0.65 하나짜리 오라클에서는 "먼저 걸린 약화 하나만"도 같은 값을 냈다. 순서와 강도가 어긋나는 공포 배율 0.6 · 0.8을 오라클에 넣어 판별했다.

### 44.5 증빙 · 핀

- 소스 해시만 이동했다: 성장 진단 4개(`CombatEngine.actions` · `enemyAI` · `status` · `types/monster`) · 장비 전투력 3개 · 유물 `dot_mult` · `gold_mult` 각 1개. 리포트 값은 그대로다 — 성장 모델은 약화 기술을 쓰지 않는다.
- 도달 비용 · 페이싱(`exploration-rhythm.json`)은 바이트 동일, 성장 시뮬레이터 기준 해시도 그대로다. tracked verify **15/15**.

### 44.6 게이트 (직렬 08:27~08:49)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,427/5,427**(382파일, skip 0) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 352ms / mobile 500ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 45. Wave 45 — 소유자 결정: 화염구 B '지속 화염' = 화상 + 출혈 (2026-09-30, 베이스 `main` = `f8478576` = PR #77 merge commit)

### 45.1 결함

마법사 '화염구' 분기 B('지속 화염', "화상 3턴 (1→3턴)")는 `{ mult: 2.2, burnTurn: 3 }`였다.

- `mult` 2.2는 기본 화염구와 같은 값이다.
- `burnTurn`은 엔진이 읽지 않는다. 화상은 턴 카운터 없이 전투 내내 지속되는 도트라 "3턴"은 발현할 수 없는 광고였다.
- 결과적으로 B를 고르면 기본 화염구를 그대로 쓰게 됐다. A(피해 +35%)만 의미 있는 2택이었다.
- 2택 계약(`skill-branch-parity`)은 A와 B끼리만 비교했고, 다른 키 목록에 엔진이 읽지 않는 `burnTurn`까지 셌다. 그래서 이 분기는 "A와 다르다"로 통과했다. 기본 기술과 비교하는 행은 없었다.

소유자에게 네 안을 제시했고(화상 + 출혈 · 화상 강화 신규 배율 · 마나 절약 · 분기 삭제), 소유자가 **화상 + 출혈**을 골랐다.

### 45.2 변경

- 화염구 B = `{ mult: 2.2, secondEffect: 'bleed' }`, 설명 "화상 + 출혈 동시 부여 (지속 피해)". 이름 '지속 화염'은 그대로다.
- 마지막 dead override 키 `burnTurn`을 `ClassSkill` 타입과 허용 키 목록 두 곳(`data-shape-types` · `seven-jobs-skill-branches`)에서 지웠다. `KNOWN_DEAD_OVERRIDE_KEYS`는 비었다. 새 dead 키를 쓰면 이제 타입 에러이자 계약 red다.
- **계약 추가**: 모든 분기는 기본 기술과 엔진이 읽는 키 하나 이상에서 다르다. 실데이터 전수에서 걸리는 분기는 이 하나뿐이었다. 2택 비교도 엔진이 읽는 키만 센다.

### 45.3 A · B 판단 기준 (식 — 실측 아님)

- h를 기본 화염구 한 번이 적 최대 생명에서 깎는 비율이라 하자.
- A는 시전마다 0.35 × h × 최대 생명을 더한다(2.97 / 2.2 = 1.35).
- B는 적 행동마다 0.04 × 최대 생명(`STATUS_DOT_RATIO`)을 더한다. 도트는 중복되지 않아 다시 걸어도 늘지 않는다.
- 매 턴 화염구를 쓰면 B가 앞서는 조건은 h < 0.114, 즉 기본 화염구로 9번 이상 맞아야 하는 적(보스 · 정예 · 깊은 층)이다. 한두 번에 끝나는 적에는 A가 앞선다.
- `death_oracle` 계열 도트 배율 시너지는 B만 키운다.

### 45.4 측정하지 않은 이유

자연 플레이 드라이버는 분기를 고르지 않는다(`chooseSkillBranch` 호출 0). 성장 시뮬레이터 · 진단 증빙도 분기를 고르지 않는다. 이 변경에 대한 드라이버 A/B는 구조적으로 바이트 동일한 공허한 측정이라 돌리지 않았다. 밸런스 영향은 위 식과 행동 테스트로만 말한다. 실제 플레이에서 B의 선택률 · 체감은 이 wave가 검증하지 않는다.

### 45.5 테스트 · 결함 주입

- `skill-branch-parity`에 두 행을 더했다.
  - 분기 ≠ 기본 기술(엔진이 읽는 키 기준, 전수).
  - 화염구 B의 적 도트는 `[burn, bleed]`이고, 적 행동당 지속 피해는 기본의 정확히 2배다. A의 지속 피해는 기본과 같다.
- 수정 전 `main` 데이터에서 3건이 red였다: dead 키 행 · 분기 ≠ 기본 · 화염구 B 행동.
- 결함 주입 "B = 화상 + 화상(중복 도트)"은 분기 ≠ 기본 계약을 통과한다(키는 다르다). 행동 테스트만 그것을 잡는다. 키 계약은 "고르나 마나인 선택"을, 행동 테스트는 "다르지만 효과 없는 선택"을 잡는다.

### 45.6 증빙

소스 해시만 이동했다(`classes.ts` · `types/class.ts` — 성장 진단 2 · 장비 전투력 2). 리포트 값 · 도달 비용 · 페이싱은 그대로다. tracked verify **15/15**.

### 45.7 게이트 (직렬 09:36~09:58)

tracked verify **15/15** · type-check 0 · lint 0 · unit **5,429/5,429**(382파일, skip 0) · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 668ms / mobile 520ms. 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 46. Wave 46 — 스킬 분기 선택 자연 플레이 감사 (측정만, 2026-09-30, 베이스 `main` = `4021c12c` = PR #78 merge commit)

§45가 남긴 공백을 닫는 측정이다. 자연 플레이 드라이버 · 성장 시뮬레이터 · 진단 증빙은 스킬 분기를 한 번도 고르지 않았다. 그래서 분기가 밸런스를 흔드는지, 한쪽이 지배되는지 알 수 없었다. 게임 코드는 바꾸지 않았다.

### 46.1 방법

- 드라이버(저장소 밖)에 `BRANCH=A|B` 정책을 더했다. 대기 상태에서 지금 직업의 선택하지 않은 분기를 `chooseSkillBranch`로 전부 같은 글자로 고른다.
  - 미설정이면 예전과 같다. 현재 `main`에서 시드 1의 런 요약이 Wave 44 측정과 바이트 동일했다. 그래서 Wave 44 측정 군(= 현재 `main`의 무선택)을 기준으로 그대로 썼다.
- 경로 6개 × {전부 A, 전부 B} × 48시드 × 계승 4회로 쟀다. 경로별 정책은 §41~§44와 같다.
- **번들 측정이다.** 한 경로의 분기를 전부 A 또는 전부 B로 고른 결과라, 분기 하나하나의 효과를 가르지 않는다.
- 드라이버의 기술 선택 규칙은 기본 기술 값(`getJobSkills`)으로 순위를 매긴다. 분기 덮어쓰기는 시전 때 엔진이 적용한다. 그래서 A의 배율 상승은 반영되지만, "기절 2턴을 노리고 쓰는" 식의 의도적 활용은 반영되지 않는다.

### 46.2 결과 (1회차 시드당 사망, z는 무선택 대비)

| 경로 | 무선택 | 전부 A | 전부 B | B − A | 4회 합계 사망(무 → A · B) |
|---|---|---|---|---|---|
| 전사 > 나이트(공포) | 1.50 | 1.10 (−1.5) | 1.27 (−0.8) | z 0.6 | 101 → 76 · 87 |
| 마법사 > 아크메이지(공격 강화) | 2.73 | 2.27 (−1.1) | 2.02 (−1.7) | z −0.7 | 178 → 138 · 150 |
| 마법사 > 흑마법사(kit) | 3.00 | 2.63 (−0.8) | 2.69 (−0.7) | z 0.1 | 201 → 208 · 208 |
| 마법사 > 무당(kit) | 2.94 | 2.50 (−1.1) | 2.79 (−0.4) | z 0.8 | 203 → 193 · 206 |
| 도적 > 어쌔신(kit) | 2.00 | 1.98 (−0.1) | 2.06 (0.2) | z 0.2 | 135 → 121 · 135 |
| 마법사 > 성직자(회복) | 3.75 | 3.23 (−1.1) | 3.52 (−0.4) | z 0.7 | 309 → 248 · 279 |

- 위반 0, 분기 선택 거부 0, 576판 전부 완주.
- **분기는 의미 있는 선택이다.** 분기를 고르면 합계 사망이 대체로 준다(전부 A는 여섯 경로 중 네 곳에서 −10~−25%).
- **어느 쪽도 지배되지 않는다.** 1회차 사망 B − A는 모든 경로에서 z 절댓값 0.8 이하였다. 1회차 모델 시간은 아크메이지 경로에서만 B가 빨랐다(평균 63.6 → 59.6h, z −2.1).
- 4회차 사망의 두 이탈(흑마법사 A 0.85 → 1.44, z 2.4 · 성직자 A 1.54 → 1.25, z −2.3)은 방향이 반대다. 비교 60여 개 중 |z| > 2가 우연으로 3개 안팎 기대되는 수준이라, 이것만으로 원인을 세우지 않았다.

### 46.3 함께 확인한 것

- 분기를 고른 뒤 전투 화면이 기본 기술 값을 그리는지 확인했다. 전투 패널은 기술 이름 · 기력 비용 · 준비 상태만 그린다. 기력을 바꾸는 분기는 없다(`mp` · `cooldown` 덮어쓰기 0건). 전투 예보(`combatForecast`)가 읽는 효과(`drain` · 방어형 효과)를 켜거나 끄는 분기도 없다. 광고와 동작의 불일치는 없다.

### 46.4 결론 · 후속

- 분기 설계는 번들 수준에서 균형이다. 이 감사로는 고칠 것이 없다.
- 분기 하나씩 켜는 측정(분기 기술 39개 · 선택지 78개 × 48시드)은 번들 결과가 중립이라 기대 가치가 낮아 하지 않았다. 특정 분기가 의심되면 그 분기만 켜는 측정으로 좁혀 재면 된다.

## 47. Wave 47 — 유물 선택 조합 힌트가 두 조각 조합 완성을 놓침 (2026-09-30, 베이스 `main` = `68fce5d1` = PR #79 merge commit)

유물 선택을 자연 플레이로 재려고 드라이버에 "선택 화면의 추천을 따르는" 정책을 만들다가 추천의 근거를 읽었고, 결함을 찾았다.

### 47.1 결함

- 실제 조합(`RELIC_SYNERGIES`, 엔진이 `getActiveRelicSynergies`로 켠다)은 20개이고 그중 **15개가 두 조각**이다.
- 선택 카드의 판정(`RelicChoicePanel` 안의 `getRelicSynergyScore`)은 세 조각 전설 조합의 완성만 이름으로 찾았다. 두 조각 조합은 UI 전용 효과 짝 표(`SYNERGY_MAP`)가 우연히 맞을 때만 점수를 받았다.
- 렌더 실측: 조합의 마지막 조각을 제안받았을 때 세 조각 5/5는 "전설 조합 완성"을 그렸고, **두 조각은 15개 중 14개가 힌트 0**이었다(흡혈 군주 · 절대 반사 · 공허의 용 · 절대 불사 …). 추천도 등급 점수로만 갈렸다.
- 반대로 조합 보너스가 없는 효과 짝(예: 연속 공격 + 마무리 공격)은 "좋은 조합" · "강한 조합"과 추천 이유 "현재 유물과 잘 맞음"을 받았다.

### 47.2 변경

- 판정을 `utils/relicSynergyHint.ts`로 옮겼다(컴포넌트에 게임 판정 금지). 문구는 `MSG`로 옮겼다 — 기존 넷은 한 글자도 바꾸지 않았고, 새 문구는 "조합 완성" · "조합 효과 발동" · "{조합} 완성"이다.
- **완성 판정은 엔진과 같은 함수로 한다**: 이 유물을 더했을 때 `getActiveRelicSynergies`에서 새로 켜지는 조합이 완성이다. 세 조각은 기존 `legendaryHint`, 두 조각은 새 `completesPair`다.
- 추천 점수: 전설 완성 160 > **두 조각 완성 140** > 효과 짝 "강한 조합" 110. 추천 이유는 "조합 효과 발동", 카드에는 "조합 완성" 배지와 "{조합} 완성" 줄을 붙였다.
- 완성하지 않는 제안의 판정은 바꾸지 않았다. 가진 유물 0~1개 전수를 옛 판정 사본과 대조한다.

### 47.3 테스트 · 결함 주입

- 신규 `tests/relic-synergy-hint-contract.test.js` 7건:
  1. 표본(두 조각 15 · 세 조각 5)
  2. 모든 조합 × 빠진 조각 순서 전수(45건) → 그 조합의 완성 표시
  3. 완성 힌트 ⇔ 엔진에서 새로 켜지는 조합 — 유물 67개 × 조합 조각 부분집합 전수
  4. 추천 줄이 완성 카드를 고르고 이유를 말함
  5. 두 조각 완성의 렌더(배지 · 줄 · 추천 표시)
  6. 완성하지 않는 제안의 판정 불변
  7. 조합 완성이 효과 짝 "강한 조합"보다 먼저 추천됨(등급 차가 순위를 뒤집지 않는 구성)
- **결함 주입 6종이 각자 red였다**:
  - 두 조각 판정 제거(= 수정 전 동작): 5건 red
  - 완성 점수를 효과 짝 아래로(140 → 100)
  - 추천 이유 미갱신
  - 카드 줄 미렌더
  - 전설 판정을 엔진 대신 이름 · 보유 수로
  - "강한/좋은 조합" 경계 변경

### 47.4 측정 — 추천을 따르는 플레이어 (48시드 × 계승 4회, 드라이버 정책 `RELIC=first|recommend`)

기준은 첫 카드를 고르는 기존 정책이다. `RELIC=first`는 Wave 44 측정과 런 요약이 같다(새로 기록한 조합 필드 제외).

| 경로 | 1회차 시드당 사망 | 4회 합계 사망 | 계승 시 켜져 있던 조합(평균) | 1개 이상 켜진 계승 |
|---|---|---|---|---|
| 전사 > 나이트 | 1.50 → 1.44 (z −0.2) | 101 → 95 | 2.49 → 2.32 (z −1.4) | 96% → 89% |
| 마법사 > 아크메이지 | 2.73 → 2.23 (z −1.1) | 178 → 149 | 2.43 → 2.21 (z −1.8) | 94% → 90% |
| 마법사 > 성직자 | 3.75 → 4.60 (z 1.6) | 309 → 348 | 2.54 → 2.23 (z −2.6) | 98% → 90% |

- 위반 0, 모든 시드 완주. 추천은 제안의 40%(39.7~40.8%)에서 첫 카드와 달랐고, 추천한 선택의 33~38%가 조합을 완성했다.
- **추천을 따르면 조합이 오히려 적게 켜진다.** 원인은 제안 생성기의 조합 보장 슬롯(`pickWeightedRelics`의 시너지 pity)이다.
  - 그 슬롯은 항상 **첫 카드**다. "1개 남은 조합의 잔여 조각"이 1순위이고, 없으면 "세 조각 조합에서 1개 보유 · 2개 부족의 잔여 조각"이다.
  - 그래서 첫 카드만 고르는 기존 드라이버는 사실상 조합 진행을 따라갔다.
  - 추천은 완성은 고르지만, 완성하지 않는 제안에서는 등급(+52까지)과 효과 짝 표(최대 110)를 조합 진행(세 조각 "1개 남음" +18뿐, 두 조각 첫 조각 0)보다 크게 친다.
- 사망 변화는 경로마다 방향이 달라 유의하지 않다(성직자 3회차 z 2.3은 단독 이탈).

### 47.5 소유자 판단 거리

추천이 **완성하지 않는 제안**에서 무엇을 우선할지다. 이번 수정은 완성을 알리는 것까지다.

- (a) **현행**: 등급 · 빌드 적합 · 효과 짝 순. 조합 완성은 이제 최우선으로 보인다.
- (b) **실제 조합 진행 우선**: 가진 조각이 있는 실제 조합의 다음 조각(제안 생성기의 보장 슬롯과 같은 기준)에 점수를 준다. 추천이 조합을 쌓는 방향이 된다. 48시드로 조합 수 · 사망을 다시 재야 한다.
- (c) **효과 짝 표 정리**: 조합 보너스가 없는 효과 짝이 "강한 조합"으로 불리지 않게 문구를 "함께 쓰기 좋음" 계열로 바꾸거나 점수를 낮춘다. (b)와 함께 갈 수 있다.

### 47.6 게이트 (직렬 12:33~12:55, unit은 가드 갱신 뒤 재실행)

- tracked verify **15/15** · type-check 0 · lint 0 · build:guard ok · CI-env build ok(test-api 마커 1) · e2e **140/140**(71 + 69) · perf desktop FCP 552ms / mobile 548ms.
- unit **5,436/5,436**(383파일, skip 0). 첫 실행은 5,434/5,436이었다: cycle 533의 소스 가드 2건이 옮겨진 함수를 `RelicChoicePanel.tsx`에서 찾았다. 가드가 함수가 사는 `utils/relicSynergyHint.ts`를 읽게 고치고 재실행했다. 컴포넌트 호출부 가드는 그대로 컴포넌트를 읽는다.
- 증빙: 성장 진단 소스 목록만 바뀌었다(새 파일로 365 → 366개, 리포트 값 불변). 다른 증빙은 바이트 동일하다.
- 실기기 QA · 출시 수용은 이 wave의 범위가 아니다.

## 48. Wave 48 — 소유자 결정: 유물 추천은 실제 조합 진행 우선, 효과 짝은 "함께 쓰기 좋음" (b + c) (2026-09-30, 베이스 `main` = `807fce72` = PR #80 merge commit)

§47.5의 세 안 중 소유자가 **(b) 실제 조합 진행 우선 + (c) 효과 짝 문구 정리**를 골랐다.

### 48.1 변경

- **추천 점수를 층으로 나눴다**(`relicChoiceDecision`):

  | 층 | 점수 |
  |---|---|
  | 전설 조합 완성 | 1000 |
  | 두 조각 조합 완성 | 800 |
  | 세 조각 조합 진행(2개째 — 제안 생성기의 조합 보장 슬롯 2순위와 같은 기준, 기존 `nearLegendary`) | 400 |
  | 그 밖 | 0 |

  층 안에서는 등급(최대 52) · 빌드 적합(최대 40) · 효과 짝(최대 40)이 가른다. 이들을 다 더해도 132라 층이 뒤집히지 않는다. 조합 진행이 +18뿐이던 동안 등급 · 효과 짝이 조합 진행을 밀어냈다.
- **효과 짝**(`SYNERGY_MAP`, 조합 보너스 없음):
  - 이름: '강한/좋은/이어지는 조합' → "함께 쓰기 좋음"
  - 점수: 짝당 40 · 최대 100 → 짝당 20 · 최대 40
  - 추천 이유: "현재 유물과 함께 쓰기 좋음"
  - 톤: 조합 톤이 아니다
  - 짝 판정(어떤 효과끼리 짝인가)은 그대로다. '조합'이라는 말은 실제 조합(`RELIC_SYNERGIES`)만 쓴다.

### 48.2 측정

**자연 플레이** (48시드 × 계승 4회, 첫 카드를 고르는 정책 대비):

| 경로 | 1회차 시드당 사망 | 4회 합계 사망 | 계승 시 켜진 조합 |
|---|---|---|---|
| 전사 > 나이트 | 1.50 → 1.10 (z −1.4) | 101 → 74 | 2.49 → 2.37 (z −1.0) |
| 마법사 > 아크메이지 | 2.73 → 2.21 (z −1.1) | 178 → 143 | 2.43 → 2.20 (z −1.8) |
| 마법사 > 성직자 | 3.75 → 4.21 (z 0.9) | 309 → 328 | 2.54 → 2.32 (z −1.8) |

- 위반 0, 모든 시드 완주.
- Wave 47 추천(§47.4)과 비교하면 켜진 조합은 전사 2.32 → 2.37, 성직자 2.23 → 2.32로 늘었고 아크메이지는 2.21 → 2.20이었다.

**유물 선택만 떼어 낸 몬테카를로** (실제 제안 생성기 `pickWeightedRelics`, 5번 선택 × 4,000회, 전투 없음):

| 정책 | 유물 5개일 때 켜진 조합 |
|---|---|
| 무작위 | 0.78 |
| Wave 47 추천 | 1.81 |
| **Wave 48 추천** | **1.89** |
| 첫 카드(= 생성기의 조합 보장 슬롯) | 1.98 |
| 완성 > 진행 > 아무 조합 조각 | 2.66 |

- 추천은 첫 카드와의 차이를 절반 가까이 줄였다(−0.17 → −0.09). 남은 차이는 보장 슬롯이 없는 제안에서 나온다. 거기서 추천은 조합 조각보다 등급 · 빌드 적합을 고른다.
- "아직 하나도 없는 조합의 첫 조각"에도 층 점수를 주면 2.66까지 오른다. 이는 소유자가 고른 기준("가진 조각이 있는 조합의 다음 조각")을 넘으므로 이번에 넣지 않았다(§48.4).

### 48.3 테스트 · 결함 주입

- `relic-synergy-hint-contract`:
  - 완성하지 않는 제안의 오라클을 새 효과 짝 규칙으로 갱신했다(가진 유물 0~2개).
  - 층 순서 3종을 더했다.
    1. 두 조각 완성 > 모든 일반 카드 — 전 빌드 × 전 경쟁 유물
    2. 세 조각 진행 > 모든 일반 카드
    3. 완성 > 진행, 전설 완성 > 두 조각 완성
  - 세 조각 조합이 두 조각 조합을 품는 경우(혈맹 불사 ⊃ 흡혈 군주)는 그 순서가 "완성" 층이라 순수한 진행 순서만 본다.
- `relic-choice-decision-readability`: 옛 전제("강한 조합이 전설 빌드 적합을 이긴다")를 새 결정으로 바꿨다.
  - 효과 짝은 "함께 쓰기 좋음"이고 조합 톤이 아니다.
  - 전설 빌드 적합 > 효과 짝.
  - 조합 진행 > 전설 빌드 적합.
- 결함 주입 6종이 각자 red였다: 진행 층 제거(옛 +18) · 옛 효과 짝 점수 · 효과 짝을 다시 "조합"으로 부름 · 층을 Wave 47 크기로 축소 · 효과 짝 톤 복귀 · 진행과 완성 순서 뒤집기.

### 48.4 소유자 판단 거리 (후속)

- **조합 시작 조각**: 아직 하나도 없는 실제 조합의 조각에 낮은 층 점수(예: 진행 아래 · 일반 위)를 준다. 몬테카를로 기준 켜진 조합이 1.89 → 2.66이다.
- 추천을 따르면 첫 카드만 고르는 것보다 조합이 많아진다. 대신 등급 높은 비조합 유물을 덜 추천하게 된다.

## 49. Wave 49 — 소유자 결정: 유물 추천 "조합 시작 조각" 층 — 측정 후 조건부 반영 (2026-09-30, 베이스 `main` = `d9c26651` = PR #81 merge commit)

§48.4의 후속으로 소유자가 **"측정 후 조건부 반영"**을 골랐다.

- 조건: 48시드 × 3경로 자연 플레이에서 사망이 유의하게 늘지 않을 때만 반영하고, 늘면 되돌리고 수치만 남긴다.
- 결과: 조건을 충족했다. 사망은 늘지 않았고 오히려 줄었다(§49.3).

### 49.1 변경

- **추천 층을 하나 더 뒀다**(`relicChoiceDecision`): 전설 완성 1000 > 두 조각 완성 800 > 세 조각 진행 400 > **조합 시작 200** > 그 밖.
  - 조합 시작 = 가진 조각이 하나도 없는 실제 조합(`RELIC_SYNERGIES`)의 조각이다.
  - 층 안에서 가르는 값(등급 ≤52 · 빌드 적합 ≤40 · 효과 짝 ≤40)을 다 더해도 132라 층이 뒤집히지 않는다.
  - 추천 이유는 "새 조합 시작"이고 톤은 진행과 같은 `potential`이다.
- **판정 위치**: `relicSynergyHint`가 `startsCombo`(조합 이름)를 싣는다.
  - 진행(`nearLegendary`)이면 싣지 않는다.
  - 여러 조합의 조각이면 데이터 순서의 첫 조합을 싣는다.
- **카드 줄 순서를 추천 층과 맞췄다**(`RelicChoicePanel`): 전설 완성 > 조합 완성 > 진행("…까지 1개 남음") > 시작("… 조합의 첫 조각") > 효과 짝("함께 쓰기 · …").
  - Wave 48까지는 효과 짝 줄이 진행 줄보다 먼저였다.
  - 그래서 추천 이유가 "전설 조합에 가까움"인 카드의 줄이 효과 짝을 말했다.

### 49.2 층 안 순서 (몬테카를로, 실제 `pickWeightedRelics`, 4,000회)

켜진 조합 수 / 그중 세 조각 조합 수:

| 정책 | 유물 5칸 | 유물 6칸 |
|---|---|---|
| 첫 카드 | 1.98 / 0.55 | 2.53 / 0.71 |
| Wave 48 추천 | 1.89 / 0.49 | 2.47 / 0.63 |
| **시작 단일 층 (채택)** | **2.60 / 0.72** | **3.36 / 0.88** |
| 시작, 두 조각 조합 먼저 | 2.71 / 0.69 | 3.48 / 0.86 |
| 시작, 남은 칸에 들어가는 조합만 | 2.62 / 0.72 | 3.38 / 0.88 |

단일 층을 채택한 이유:

- "두 조각 먼저"는 조합 수가 +0.11이지만 세 조각 조합이 줄고, 층을 하나 더 쪼개야 한다.
- "남은 칸만"은 +0.02에 그치는데, 추천 함수가 유물 상한을 알아야 한다.

### 49.3 자연 플레이 (48시드 × 계승 4회, `RELIC=recommend`, 드라이버가 `wt-probe` = `2115f81d`를 읽음)

**Wave 48 추천(현행 `main`) → Wave 49:**

| 경로 | 1회차 시드당 사망 | 4회 합계 사망 (시드당) | 1회차 모델 시간 | 계승 시 켜진 조합 (세 조각) |
|---|---|---|---|---|
| 전사 > 나이트 | 1.10 → 0.75 (z −1.3) | 1.54 → 1.02 (z −1.8), 총 74 → 49 | 58.5 → 57.3h (z −1.0) | 2.37 → 3.21 (z 7.5) (0.44 → 0.80) |
| 마법사 > 아크메이지 | 2.21 → 1.21 (z −2.4) | 2.98 → 1.83 (z −2.7), 총 143 → 88 | 61.6 → 58.8h (z −1.6) | 2.20 → 3.24 (z 9.4) (0.43 → 0.78) |
| 마법사 > 성직자 | 4.21 → 2.38 (z −4.2) | 6.83 → 3.85 (z −5.5), 총 328 → 185 | 67.4 → 64.1h (z −1.3) | 2.32 → 3.17 (z 7.9) (0.48 → 0.79) |

**첫 카드 정책(§47) → Wave 49** (시드당 4회 합계 사망):

| 경로 | 사망 |
|---|---|
| 전사 > 나이트 | 2.10 → 1.02 (z −3.6) |
| 마법사 > 아크메이지 | 3.71 → 1.83 (z −4.8) |
| 마법사 > 성직자 | 6.44 → 3.85 (z −4.4) |

- 위반 0, 모든 시드 완주(타임아웃 0).
- 추천이 첫 카드와 다른 선택은 263/1,209 · 295/1,382 · 451/1,860건이다.
- 몬테카를로가 센 것은 조합 수였다. 자연 플레이는 그 조합 수가 **생존으로 이어진다**는 것을 보였다. 세 경로 모두 사망이 줄었고, 성직자는 z −5.5다.

### 49.4 테스트 · 결함 주입

- `relic-synergy-hint-contract`:
  - 오라클에 `startsCombo`를 넣었다.
  - 층 순서 2의 경쟁자에 시작 카드를 넣었다(진행 > 시작).
  - **층 순서 4**를 더했다. 빈 손에서는 모든 조합 조각이 시작이고 조합 밖 유물은 아니다. 가진 유물 0~1개 × 전 빌드에서 시작 조각이 가장 강한 일반 카드를 이긴다.
  - **카드 줄 순서** 테스트를 더했다: 시작 줄 · 진행 > 효과 짝 · 시작 > 효과 짝.
- 결함 주입 8종 중 7종이 각자 red였다:
  1. 시작 층 0
  2. 시작 층 500(진행 위)
  3. 시작 층 60(층 안 최대치 아래)
  4. 진행과 겹쳐 시작 판정
  5. 추천 이유 누락
  6. 효과 짝 줄이 진행 줄보다 먼저
  7. 효과 짝 줄이 시작 줄보다 먼저
- 나머지 1종(시작 판정에서 "가진 조각 없음" 조건 제거)은 **등가 변이**다. 가진 조각이 있는 조합의 조각은 앞 분기가 이미 완성(두 조각) 또는 진행 · 완성(세 조각)으로 가져간다. 조건은 의도 표시와, 앞 분기의 정의가 바뀔 때의 방어로 남겼다.

### 49.5 소유자 판단 거리 (후속)

- **난이도**: 추천을 따르는 플레이어의 사망이 첫 카드 정책 대비 약 절반이 됐다. 이는 Wave 40("더 하드하게")과 반대 방향이다.
- 추천은 이미 있는 조합 보너스를 **쓰게 할 뿐**이다. 조합을 스스로 모으는 플레이어는 원래부터 이 강도를 얻고 있었다.
- 난이도를 되돌리고 싶다면 추천이 아니라 조합 보너스 크기(`RELIC_SYNERGIES` 효과 값)를 손대는 것이 맞는 지렛대다.

## 50. Wave 50 — 소유자 결정: 조합에 단점을 붙인다 ("강하지만 위험한" 조합) (2026-09-30, 베이스 `main` = `3034e7a9` = PR #82 merge commit)

§49.5의 판단 거리였다. 추천을 따르면 사망이 첫 카드 정책의 절반이 된다. 소유자 기준은 "로그라이크 분위기에 맞게"였고, 네 안 중 **조합에 단점을 붙인다**를 골랐다. 나머지 세 안은 그대로 둔다 · 조합 효과를 약하게 · 조합은 강하게 두고 적을 세게였다. 조합을 완성하면 확실히 강해지지만, 그 힘에는 위험이 따른다.

### 50.1 사망 감소의 출처 (조합 효과 끄기 측정)

측정 방법:

- 측정 전용 worktree에서 조합 **효과**만 껐다. 적용 세 곳(`statsCalculator` · `CombatEngine` · `CombatEngine.outcome`)이 읽는 목록에서 뺐다.
- 추천 판정은 그대로 둬서 같은 조합을 모으게 했다.
- 생존형 10개: 흡혈 군주 · 난공불락 · 불멸의 전사 · 지옥의 수확자 · 영원의 생명 · 무한 포식 · 절대 불사 · 혈맹 불사 · 영원의 요새 · 절대 반사.

Wave 49 추천 기준 시드당 4회 합계 사망:

| 경로 | 조합 효과 모두 켬 | 생존형만 끔 | 참고: 첫 카드(§47) |
|---|---|---|---|
| 전사 > 나이트 | 1.02 | 1.67 (z 2.6) | 2.10 |
| 마법사 > 아크메이지 | 1.83 | 3.23 (z 4.1) | 3.71 |
| 마법사 > 성직자 | 3.85 | 7.00 (z 6.9) | 6.44 |

- 생존형만 꺼도 사망이 첫 카드 수준으로 돌아온다. 켜진 조합 수는 3.2로 그대로다.
- 즉 Wave 49의 사망 감소는 거의 전부 생존형 조합에서 나왔다.
- 공격형만 끄는 측정은 단점 측정을 먼저 돌리려고 중단했다.

### 50.2 설계

- **대가는 세 종류뿐이다**: 받는 피해 증가 · 방어력 감소 · 공격력 감소(`RelicSynergyDrawbackStat`).
- **최대 생명 감소는 쓰지 않는다.** 저장된 `maxHp`를 직접 읽는 회복 상한이 많다. 효과 최대치만 낮추면 회복이 옛 최대치까지 차서 대가가 새어 나간다.
- **적용 위치**:
  - 공격력 · 방어력: `calculateFullStats`의 최종 값에 곱한다.
  - 받는 피해: `FullStats.damageTakenMult`로 내보낸다. 적 공격(`enemyAttack`, 저주 증폭 뒤 · 사망 방지 판정 앞)과 도주 실패 피해(`attemptEscape`)가 곱한다.
  - 난수를 쓰지 않으므로 시드 스트림은 바뀌지 않는다.
- **문구**: 데이터(`drawback`)에서 만든다(`formatSynergyDrawback` → `MSG.RELIC_SYNERGY_DRAWBACK_TEXT`).
  - 유물 선택 카드는 조합을 완성할 때 "대가 · …"를 보여 준다(`drawbacks`).
  - 능력치 화면은 활성 조합 설명 아래에 보여 준다.
- **크기**: 사망 감소의 출처(§50.1)에 맞췄다. 생존형은 크게, 원래 사망을 줄이지 않던 공격형은 작게 뒀다.

| 조합 | 대가 |
|---|---|
| 혈맹 불사 | 받는 피해 +20% |
| 흡혈 군주 · 절대 불사 | 받는 피해 +15% |
| 불멸의 전사 · 지옥의 수확자 | 받는 피해 +10% |
| 영원의 요새 | 공격력 −20% |
| 영원의 생명 · 절대 반사 | 공격력 −15% |
| 난공불락 | 공격력 −10% |
| 무한 포식 | 방어력 −20% |
| 원초의 분노 · 엔트로피의 신 | 받는 피해 +15% |
| 비전 특이점 · 시간의 지배자 (강화) | 받는 피해 +10% |
| 공허의 용 | 방어력 −15% |
| 비전 파동 · 시간 지배자 · 절멸자 | 방어력 −10% |
| 죽음의 예언자 · 엔트로피 낙인 | 공격력 −10% |

- 겹치는 조합(혈맹 불사 ⊃ 흡혈 군주)은 대가도 곱으로 겹친다(받는 피해 ×1.2 × 1.15).

### 50.3 측정 (48시드 × 계승 4회, 시드당 4회 합계 사망)

- 목표 1: 추천을 따를 때 사망이 Wave 40 기준(§47의 첫 카드 정책) 수준이다.
- 목표 2: 조합은 여전히 이득이다(같은 규칙에서 추천 < 첫 카드).

| 경로 | 목표 (첫 카드, §47) | d1 추천 | **d2 추천 (채택)** | d2 첫 카드 | 조합 이득 (d2 추천 vs 첫 카드) |
|---|---|---|---|---|---|
| 전사 > 나이트 | 2.10 | 3.02 (z 2.6) | **1.98 (z −0.4)** | 2.92 | z −2.6 |
| 마법사 > 아크메이지 | 3.71 | 4.38 (z 1.4) | **3.31 (z −0.9)** | 5.00 | z −4.0 |
| 마법사 > 성직자 | 6.44 | 8.81 (z 3.7) | **7.79 (z 2.1)** | 8.75 | z −1.8 |

- d1(초안: 받는 피해 15~30%, 공격력 · 방어력 −10~30%)은 추천을 따라도 Wave 40 기준보다 어려웠다.
  - 첫 회차 모델 시간이 64~74h로 늘어서 조합을 모아도 빨라지지 않았다. "강하지만 위험한"이 아니라 "위험하기만 한" 쪽이었다.
  - d2는 생존형을 약 2/3, 공격형을 약 1/2로 줄였다.
- d2 첫 회차 모델 시간(목표 → d2 추천): 61.2 → 60.4h · 63.5 → 63.7h · 66.9 → 74.2h.
- 계승 시 켜진 조합은 3.1~3.2로 Wave 49와 같다. 위반 0, 타임아웃 0.

### 50.4 테스트 · 결함 주입

- `tests/relic-synergy-drawback-contract.test.js` (5):
  1. 모든 조합에 대가가 있고, 문구는 데이터에서 만든다.
  2. **능력치**: 조합 20개 × 모든 조각(45가지)에서 조각 이름만 바꿔 조합만 끈 상태와 비교한다. 비율 = 보너스 × 대가다. 조합은 유물 이름으로 켜지고 유물 효과는 `effect`로 걸리기 때문에 가능한 오라클이다.
  3. **받는 피해**: 적 공격 · 도주 실패 피해 비율 = `damageTakenMult` 비율(받는 피해 대가가 있는 조합 전부).
  4. **선택 카드**: 조합 20개의 마지막 조각 카드가 새로 켜지는 조합의 대가를 보여 준다.
  5. **능력치 화면**: 활성 조합마다 대가 줄을 보여 준다.
- 기존 테스트 3곳을 갱신했다:
  - `data-shape-types`: `drawback` 필드 · 종류 유니온.
  - `stats-progression-design`: 픽스처에 대가를 넣고 대가 줄을 단언했다.
  - `synergies-cycle`: 엔트로피의 신 조각이 엔트로피 낙인도 켜서 낙인의 공격력 대가가 함께 걸린다. 기대 배율 = (1 + chaosAtk) × 공격력 대가.
- 결함 주입 10종이 모두 각자 red였다:
  1. 공격력 대가 누락
  2. 방어력 대가 누락
  3. 받는 피해 합산 오류
  4. 적 공격 미적용
  5. 도주 실패 미적용
  6. 문구 백분율 오류
  7. 카드 대가 목록 누락
  8. 카드 대가 줄 누락
  9. 능력치 화면 줄 누락
  10. 문구 종류 뒤바뀜

### 50.5 소유자 판단 거리

- **성직자 경로는 목표보다 약 21% 어렵다**(7.79 vs 6.44, z 2.1).
  - 생명이 낮은 직업이라 같은 비율의 대가에 사망이 더 크게 늘어난다. 대가 없이 3.85였던 사망이 +3.94 늘었다(나이트 +0.96, 아크메이지 +1.48).
  - 대가 종류로는 성직자만 겨냥할 수 없다. 세 경로 합계로는 +7%다.
  - 성직자만 맞추려면 직업 쪽(생명 · 회복)을 손대야 한다.
- **조합을 모으지 않는 플레이(첫 카드)는 Wave 40보다 어려워졌다**: 2.92 / 5.00 / 8.75 vs 2.10 / 3.71 / 6.44.
  - "조합 없이는 버티기 어렵고, 조합이 있어야 이긴다"는 로그라이크 방향이다.
  - 추천 화면이 조합을 안내한다.

## 51. Wave 51 — 소유자 결정: 성직자의 컨셉 — 언데드 · 마족에게 힐이 공격이 된다 (2026-09-30, 베이스 `main` = `535643eb` = PR #83 merge commit)

§50.5에 남긴 판단 거리가 출발점이다. 성직자 경로는 목표보다 약 21% 어려웠다. 소유자 답은 수치를 맞추라는 것이 아니었다.

> "성직자의 컨셉에 잘 맞게 해야지. 마족계열이나 언데드 계열에 힐로 공격 가능 등"

### 51.1 변경

- **몬스터 계열을 데이터로 선언했다**(`MonsterBase.family: 'undead' | 'demon'`).
  - 언데드 22종:
    - 잊혀진 폐허 · 암흑 성 계열: 해골 병사 · 유령 기사 · 폐허 구울 · 데스나이트 · 리치 · 뱀파이어
    - 피라미드: 미라
    - 저주받은 묘지 계열: 망자의 사제 · 묘지 구울 · 유령 군단 · 해골 마법사 · 저주받은 기사 · 망령 기사 · 언데드 마법사 · 뼈 수집가 · 묘지기 네크론
    - 영혼의 강 계열: 한 맺힌 망자 · 익사한 기사 · 흡혼 해골 · 저주받은 어부
    - 그 밖: 망령 기사단장 · 혈월의 뱀파이어 로드
  - 마족 7종: 마왕 · 마왕의 사도 · 지옥의 문지기 · 타락한 천사 · 사슬 마왕 · 미궁의 마왕 · 차원 마왕.
  - 애매한 종(아누비스 수호자 · 강의 요괴 · 원한의 용사 · 암흑 사제 · 공허/혼돈 계열)은 넣지 않았다.
  - 판정은 종(`baseName`) 기준이다(`getMonsterFamily`). 이름 문자열로 추론하지 않는다(§26.11의 교훈).
  - 빛 약점 93종을 대용품으로 쓸 수 없었다. 코볼트 · 평원 도적 · 거대 거북 같은 일반 몬스터가 섞여 있다.
- **성직자 계열 회복 기술이 언데드 · 마족을 태운다**: 기적의 손길(성직자) · 기적의 부활(팔라딘)에 `smite: 1`을 뒀다.
  - 그 적에게 회복량(광고한 양 = 최대 생명 × `val`, 생명이 가득해도 같다)만큼 **방어 무시 신성 피해**를 더한다.
  - 분기 override(기적의 손길 A: 35%)도 `smite`를 유지한다.
  - 난수를 쓰지 않는다. 신성 피해가 마지막 일격이면 승리로 정산된다.
  - 일반 적 · 다른 직업의 회복 기술은 이전과 같다.
- **표시**:
  - 두 기술의 설명에 "언데드 · 마족에게는 회복량만큼 신성 피해"를 넣었다.
  - 전투 로그에 "신성한 빛이 …을(를) 태웁니다! N 신성 피해"가 나온다(`MSG.SKILL_HOLY_SMITE`).
  - 강점 **퇴마**(`exorcism`, 17번째 강점)를 추가했다. 성직자는 빠른 성장, 팔라딘은 행동 봉쇄 자리를 쓴다(강점 최대 3).
  - 강점 근거는 `smite`를 가진 회복 기술이다(`class-traits-contract`).
- 예시(성직자 Lv20, 최대 생명 1,000, 공격력 200): 기적의 손길로 해골 병사를 치면 기존 피해 436 + 신성 피해 250, 생명 250 회복이다. 빛 공격 기술 신성 광선은 654다.

### 51.2 관찰 (이번에 바꾸지 않음)

- **모든 버프 · 회복 기술이 적에게 공격력 1.5배 피해를 준다.** `performSkill`이 기술 종류와 무관하게 `mult || 1.5`로 피해를 계산한다.
- 예: 신성한 보호막도 436 피해를 준다. 원소는 기술 `type`('buff')이라 약점이 적용되지 않는다.
- 모든 직업에 걸친 기존 동작이다. 성장 모델도 이 상태로 맞춰져 있다. 바꾸는 것은 별도 소유자 결정이다.

### 51.3 측정 (성직자 경로 48시드 × 계승 4회, 추천 정책)

- 드라이버에 `smite` 정책 토큰을 더했다: 언데드 · 마족을 만나면 `smite` 회복 기술을 공격으로 쓴다.
  - `smite`가 없는 코드에서는 발동하지 않아 Wave 50 측정과 바로 비교된다.
- 발동 횟수: 시드당 212회(회복용 85회).

| 성직자 경로 | Wave 50 (현 main) | **Wave 51** | 목표 (Wave 40, §47 첫 카드) |
|---|---|---|---|
| 시드당 4회 합계 사망 | 7.79 | **7.42** (z −0.7) | 6.44 (목표 대비 z 1.5) |
| 첫 회차 모델 시간 | 74.2h | **70.6h** (z −1.3) | 66.9h |

- 위반 0, 타임아웃 0.
- 나이트 · 아크메이지 경로는 `smite` 기술이 없어 동작이 같다. 계열 태그는 `smite`만 읽는다.

**남은 차이가 생기는 곳** (1회차 사망 213건):

| 지역 | 사망 | 언데드 · 마족 비율 |
|---|---|---|
| 몰락한 전초기지 (Lv18) | 47 | 40% |
| 화염의 협곡 (Lv15) | 33 | 0% |
| 고대 하수도 (Lv10) | 31 | 20% |
| 버려진 광산 (Lv8) | 30 | 0% |
| 고대 마법 탑 (Lv25) | 27 | 0% |
| 신성한 호수 (Lv7) | 16 | 0% |

- 사망의 대부분은 언데드 · 마족이 없는 Lv7~25 지역에서 난다.
- Lv12 이전 지역은 성직자로 전직하기 전(마법사)이다.
- 그래서 `smite`를 올려도 그 사망은 줄지 않고, 언데드전만 쉬워진다. 회복량 1:1(읽자마자 이해되는 규칙)을 유지했다.

### 51.4 테스트 · 결함 주입

- `tests/cleric-holy-smite-contract.test.js` (7):
  1. 계열 선언(언데드 22 · 마족 7 고정)
  2. 종 기준 판정(표시 이름 · 접두어 무관)
  3. 기술 × 분기 × 계열에서 신성 피해 = 회복량 × smite(방어 무시), 회복량은 대상과 무관
  4. 생명이 가득해도 광고한 양이고, 마지막 일격이면 승리
  5. `smite` 없는 회복 기술은 언데드에게도 이전과 같다
  6. 광고 = 동작: 설명 · 퇴마 강점 ⇔ `smite`
  7. 실제 전투 전이(`RESOLVE_COMBAT_ACTION`)에서 정산 · 로그
- `data-shape-types`(`family` · `smite` 필드) · `class-traits-contract`(퇴마 근거)를 갱신했다.
- 결함 주입 10종이 모두 각자 red였다:
  - 계열 무시 · 신성 피해 없음 · 실제 회복량 기준 · 방어 적용 · 승리 판정 누락
  - 표시 이름 판정 · 로그 누락 · 팔라딘 설명 누락 · 퇴마 강점 누락 · 리치 태그 누락

### 51.5 소유자 판단 거리

- 성직자 경로는 목표보다 여전히 약 15% 어렵다(유의하지 않음, z 1.5).
- 남은 차이는 언데드 · 마족이 없는 초중반(Lv7~25) 지역, 특히 전직 전 마법사 시절에 있다.
- 줄이려면 신성 치유가 아니라 그 구간의 성직자(또는 마법사 → 성직자 전직 시점)를 손대야 한다.
- 버프 · 회복 기술의 기본 1.5배 피해(§51.2)를 정리할지도 별도 결정이다.

---

## 52. Wave 52 — 소유자 결정: 보조 기술의 숨은 피해를 없앤다 · 강화 "N턴" = 건 뒤 N번 (2026-10-01, 베이스 `main` = `27d48566` = PR #84 merge commit)

§51.5의 두 판단 거리를 측정한 뒤 소유자에게 물었다.

### 52.1 측정과 소유자 답

**성직자 공격 배율** (성직자 경로 48시드 × 계승 4회, 추천 정책, 시드당 4회 합계 사망 · 목표 6.44):

| 성직자 `atkMod` | 1.3 (현행) | 1.45 | 1.5 (무당과 같음) | 1.6 (마법사와 같음) |
|---|---|---|---|---|
| 사망 | 7.42 | 6.56 | 5.75 | 5.60 |
| 첫 회차 모델 시간 | 70.6h | 69.7h | 63.1h | 69.7h |

- 원인 구조: 성직자는 Lv12에 마법사(1.6)에서 전직하면 공격력이 19% 떨어지고 Lv45 팔라딘까지 그대로다. 몰락한 전초기지 · 화염의 협곡에서 전투당 행동이 3.6 · 4.1번(다른 경로 2.9~3.1)이고 1,000전투당 사망이 2배 안팎이다.
- 같은 Lv12 두 번째 직업 무당은 1.5다. 성직자는 깊이 2인데 `tier: 1`이고(§14 F4 — 아트 identity에 묶여 못 고친다) 능력치도 1차 직업 대역(전사 1.3)이다.
- **소유자 답**: "성직자가 화력이 강하면 안 된다. 강점은 치유 · 언데드 · 마족에 강함의 정도다. 최종 전직(팔라딘) 때 충분히 메리트가 있다." → **1.3 유지.** 성직자 경로가 목표보다 어려운 것은 직업 정체성으로 받아들인다.

**보조 기술의 숨은 피해** (피해만 0으로 만든 탐침, 같은 조건 3경로):

| 경로 | 현행 | 피해 0 |
|---|---|---|
| 나이트 | 1.98 | 2.83 (z 2.5) |
| 아크메이지 | 3.31 (h1 63.7) | 5.02 (z 4.0, h1 73.7) |
| 성직자 | 7.42 | 8.58 (z 1.9) |

- 위력(`mult`)이 없는 기술 42개(직업) + 분기 10 + 특성 4가 `mult || 1.5`로 설명에 없는 공격력 1.5배 피해를 줬다. 신성 광선(1.8배)의 83%쯤이다.
- **소유자 답**: "피해를 없앤다."

### 52.2 변경 — 보조 기술은 피해를 주지 않는다

- `systems/skillPower.ts`의 `isDamagingSkill`(위력 > 0)을 엔진(`performSkill`)과 화면(`formatSkillPower`)이 함께 읽는다. 위력이 보이지 않는 기술은 피해를 주지 않는다.
- 보조 기술은 피해 판정(분산 · 치명 · 속성)을 굴리지 않는다. 그래서 치명타 기력 회복 · 흡수 · 속성 태그가 없고, 방어 경감의 최소 피해 1도 새지 않는다.
- 전투 로그는 피해 줄 대신 `MSG.SKILL_USE_SUPPORT`("[기술] 사용!")를 남기고 효과 줄이 뒤따른다.
- 효과(강화 · 약화 · 회복 · 기력 · 기절 · 은신 · 추가 행동 · 쿨타임 초기화 · 전투 이탈)는 그대로다.
- 신성 피해(Wave 51 `smite`)는 회복량에서 따로 계산하므로 그대로다. 이제 언데드 · 마족에게 기적의 손길이 주는 피해는 정확히 회복량 × smite다.

### 52.3 결함 — 강화 "N턴"이 N − 1번만 작동했다

- 행동 끝 틱(`tickCombatState`)은 내 행동 직후 · 적 공격 전에 돈다. 강화를 건 행동의 틱에서 바로 1이 줄었다.
- 실측(같은 시드): "3턴" 광폭화는 공격 2번(853 · 860, 이후 610), "2턴" 방패 전술은 적 공격 1번만 막았다. 1턴짜리 방어 보너스는 적이 치기 전에 사라졌다. 전투 밖에서 마신 물약만 N번이었다.
- Wave 44가 적 약화에서 고친 것과 같은 모양이다. 보조 기술의 피해가 없어지면 강화의 값은 지속 턴이 전부라 함께 고쳤다.
- 수정: `systems/combatTurnTick.ts`의 `tickAfterAction`이 이번 행동이 건 강화(행동 전과 다른 `tempBuff` 객체)를 이번 틱에 줄이지 않는다. 쿨타임 · 상태이상 · 지속 회복 틱은 그대로 돈다. 기술 턴(`combatActionTurn`)과 전투 중 소모품 턴(`combatItemTurn`)이 같은 함수를 쓴다.
- 결과: 공격 강화는 내 행동 N번, 방어 · 반격 강화는 적 공격 N번 작동한다.

### 52.4 관찰 (바꾸지 않음)

- **철벽 배시**(나이트 실드배시 B, "기절 후 DEF +20% 1턴"): 같은 기술의 기절이 건 턴의 적 행동을 막는다. 그래서 1턴 방어 보너스는 수정 전후 모두 적 공격을 한 번도 만나지 못한다.
  - 고치려면 공격 강화(내 행동)와 방어 강화(적 공격)가 턴을 따로 세야 한다. 지금 `tempBuff`는 턴 하나를 함께 쓴다.
  - 계약 테스트가 이 예외를 정확히 한 개로 고정한다.
- **은신 계열은 광고와 동작이 다르다**(탐침, 다음 웨이브 후보):
  - 은신("회피 대폭 상승 2턴") · 그림자 이동("다음 공격 강화 3턴") · 그림자 군주("3턴간 강화 은신 + ATK 증가")는 모두 다음 적 공격 1회 회피(`nextHitEvaded`)만 준다.
  - 공격 강화는 없다. 대신 `type: 'buff'`라 빈 강화(공격 0 · 방어 0)가 강화 칸을 차지해, 걸려 있던 다른 강화를 지운다. Wave 42가 회복 기술에서 고친 것과 같은 모양이다.
  - 데이터의 `val`(1.8 · 2.0 · 3.0)은 엔진이 읽지 않는다.
  - 수정 전에는 1.5배 피해가 이 차이를 일부 가렸다. 이제 세 기술은 회피 1회짜리다.
- 어둠의 서약("ATK 80% 상승, HP를 소모하는 계약")은 생명을 소모하지 않는다(플레이어에게 유리한 쪽의 차이).

### 52.5 측정 (구현, 3경로 48시드 × 계승 4회, 추천 정책)

| 경로 | 현행 main | 피해 0만 | **Wave 52** | Wave 40 목표 |
|---|---|---|---|---|
| 나이트 사망 | 1.98 | 2.83 | **3.02** (현행 대비 z 3.4) | 2.10 (z 2.9) |
| 아크메이지 사망 | 3.31 | 5.02 | **5.42** (z 4.8) | 3.71 (z 3.5) |
| 성직자 사망 | 7.42 | 8.58 | **8.10** (z 1.2) | 6.44 (z 2.5) |
| 첫 회차 시간 (나이트 · 아크메이지 · 성직자) | 60.4 · 63.7 · 70.6h | 62.8 · 73.7 · 77.1h | **65.4 · 70.7 · 77.8h** | 61.2 · 63.5 · 66.9h |

- 위반 0, 타임아웃 0.
- 강화 턴 수정의 효과는 유의하지 않다(피해 0만 대비 z 0.6 · 0.8 · −0.8). 드라이버는 정예 · 보스전 첫 행동에만 강화를 쓴다.
- 결과: 세 경로 모두 Wave 40 목표보다 어려워졌다(사망 +44% · +46% · +26%). 소유자는 피해 0 탐침의 수치를 보고 이 선택을 했다.

**강화를 언제 쓰느냐가 결정이 됐다** (아크메이지 경로, 같은 48시드, 드라이버 `OPENER_SCOPE=boss` — 강화를 보스전에만 쓴다):

| 아크메이지 경로 | 정예 · 보스전마다 강화 | 보스전에만 강화 |
|---|---|---|
| 현행 main | 3.31 | 3.54 |
| Wave 52 | 5.42 (z 4.8) | **3.85** (z 0.8) |

- 큰 증가의 대부분은 짧은 정예전마다 피해 없는 강화로 한 턴을 쓰는 데서 온다. 강화를 보스전에 아끼면 증가는 유의하지 않다(첫 회차 65.7 → 66.1h).
- 이전에는 정예전마다 강화하는 쪽이 나았다(3.31 < 3.54). 강화가 1.5배 피해를 함께 줬기 때문이다. 이제는 반대다(5.42 > 3.85). 강화는 "언제 쓸지" 고르는 기술이 됐다.

---

## 53. Wave 53 — 소유자 결정: 은신 기술을 설명대로 · 어둠의 서약 생명 소모 · 난이도 유지 (2026-10-01, 베이스 `main` = `6041d5fb` = PR #85 merge commit)

### 53.1 소유자 답 (§52.4 · §52.5의 판단 거리)

- **난이도**: "그대로 둔다. 플레이어가 강해지는 것은 퀘스트나 노가다 콘텐츠를 통한 레벨업, 장비 세팅, 추가 요소로 해야 한다."
  - Wave 52의 난이도 상승(사망 +44% · +46% · +26%, 강화를 보스전에 아끼면 아크메이지 증가는 유의하지 않음)을 유지한다.
  - **설계 원칙으로 기록한다**: 난이도 차이를 적 · 기술 수치 보정으로 메우지 않는다. 플레이어 성장은 성장 콘텐츠(임무 · 사냥 · 장비 · 추가 시스템)의 몫이다.
- **은신 기술**: "설명대로 동작하게."
- **어둠의 서약**: "생명 소모를 넣는다."

### 53.2 변경 — 은신은 실제 적 공격 N번을 막는다

| 기술 | 이전 동작 | Wave 53 |
|---|---|---|
| 그림자 발걸음 (도적) | 다음 적 공격 1회 회피 | 적 공격 2번: 첫 번째 확정 회피, 두 번째 30% |
| 은신 (어쌔신) | 다음 적 공격 1회 회피 | 적 공격 2번 확정 회피 |
| 그림자 이동 (어쌔신) | 다음 적 공격 1회 회피 | 다음 적 공격 확정 회피 + 다음 피해 행동 1회 1.8배 |
| 그림자 군주 (그림자 주군) | 다음 적 공격 1회 회피 | 적 공격 3번 확정 회피 + 공격력 +200% 3턴 |

- 데이터가 선언한다: `evadeHits`(막는 적 공격 수, 기본 1) · `evadeChance`(두 번째부터의 확률, 기본 1) · `nextAttackMult` · `atkBonus`. 엔진이 읽지 않던 `val`은 지웠다. 설명은 그 수치를 그대로 말한다.
- **실제 공격만 센다.** 은신 판정을 적의 방어 자세 판정 뒤로 옮겼다. 이전에는 적이 기절하거나 방어 자세를 잡은 턴에도 회피가 소진됐다(허무의 장막 B도 같다).
- 상태는 전투 플래그(`stealthHits` · `stealthChance` · `stealthFirstPending` · `nextAttackMult`)다. 전투 시작 때 비워진다. 이전 `nextHitEvaded`는 전투를 넘어 남았다. 이전 저장의 표시만 읽고 새로 세우지 않는다.
- 다음 공격 배율은 일반 공격과 위력 있는 기술 모두에 걸리고, 한 번 쓰면 사라진다. 보조 기술은 쓰지 않는다.
- **은신이 장비 회피보다 먼저다**(cycle 226의 순서 유지): 은신 중에는 장비 회피(암영 망토 등)를 방어 자세 판정 전에 굴리지 않는다. 은신이 들킨 공격에만 장비 회피 기회가 있다. 은신이 아닐 때의 난수 순서는 그대로다.
  - PR #86 첫 CI에서 `cycle-200-299`의 "armor evasion이 stealth보다 후순위"가 붉었다. 그 테스트는 미시드 `Math.random`으로 `enemyAttack`을 불렀고, 은신 판정이 방어 자세(20%) · 장비 회피(8%) 뒤로 가면서 약 4번에 1번 실패했다(수정 전 코드에서 20회 중 3회 재현).
  - 엔진은 위 순서로 고치고, 테스트는 난수 주입 · 방어 자세 0으로 결정론화했다(Wave 21.1 규칙). 수정 뒤 30회 연속 통과.

### 53.3 변경 — 빈 강화는 강화 칸을 쓰지 않는다

- 아무것도 올리지 않는 강화(공격 0 · 방어 0 · 반격 없음)는 `tempBuff`를 덮지 않는다.
- 이전에는 은신 넷 · 마나 가속 · 시간 역행이 빈 강화를 만들어 걸려 있던 다른 강화(광폭화 · 물약)를 지웠다. Wave 42가 회복 기술에서 고친 것과 같은 모양이다.

### 53.4 변경 — 어둠의 서약은 생명을 바친다

- `hpCost: 0.15`: 쓸 때 현재 생명의 15%를 잃는다(내림, 1 아래로 내려가지 않는다). 공격력 +80% 4턴은 그대로다.
- 설명: "ATK 80% 상승 4턴 — 현재 생명 15%를 바치는 계약".

### 53.5 측정 (48시드 × 계승 4회, 추천 정책, `kit` 기술 정책)

| 경로 | 현행 main (Wave 52) | **Wave 53** |
|---|---|---|
| 도적 > 어쌔신 > 그림자 주군 — 시드당 사망 | 6.02 | **4.81** (z −2.5) |
| 〃 첫 회차 시간 | 71.8h | 68.0h (z −1.6) |
| 마법사 > 흑마법사 > 대마법사 — 시드당 사망 | 7.00 | **7.54** (z 0.9) |
| 〃 첫 회차 시간 | 75.2h | 76.6h (z 0.4) |

- 위반 0, 타임아웃 0.
- 도적 계열은 은신이 광고만큼 막게 되면서 쉬워졌다(시드당 은신 약 490회). 소유자는 "도적 계열이 강해진다"는 설명을 보고 이 선택을 했다.
- 흑마법사의 생명 소모는 유의한 차이를 만들지 않았다.

### 53.6 관찰 (바꾸지 않음)

- **등 찌르기**(도적, "은신 중 60% 치명타, 일반 시 강화 피해"): 은신 여부와 무관하게 항상 60% 치명타다. 이제 은신 상태가 있으므로 조건부로 만들 수 있다.
- **마나 가속**(마법사, "MP 20 즉시 회복, 3턴간 추가 회복"): 즉시 회복만 있고 3턴 추가 회복이 없다.
- 기술 설명 전수 감사(설명의 모든 주장 ↔ 엔진 경로)가 다음 후보다. Wave 42 · 52 · 53이 한 기술씩 찾던 것을 한 번에 센다.

### 53.7 테스트 · 결함 주입

- 새 `tests/stealth-and-pact-contract.test.js` (9):
  1. 은신 기술 목록 고정 + 설명 ⇔ 수치(막는 수 · 확률 · 배율 · 공격력 · 턴), `val` 없음, 어둠의 서약 설명.
  2. 은신이 막는 적 공격 수(확정 · 확률 성공 · 확률 실패), 그림자 군주 강화.
  3. 방어 자세 · 기절 턴은 은신을 쓰지 않는다.
  4. 다음 공격 1.8배(일반 공격 · 기술), 한 번만, 보조 기술은 쓰지 않는다.
  5. 빈 강화가 걸려 있던 강화를 지우지 않는다(은신 셋 · 마나 가속 · 시간 역행).
  6. 어둠의 서약 생명 15%, 내림, 생명 1.
  7. 전투 시작 때 은신 · 다음 공격 강화가 비워진다.
  8. 실제 전투 전이(`RESOLVE_COMBAT_ACTION`): 은신 뒤 두 번 피하고 세 번째에 맞는다.
- `skill-branch-parity`(허무의 장막 B는 전투 플래그로 확인) · `player-buff-duration-contract`(공격 강화 17 → 18, 그림자 군주) · `data-shape-types`(새 필드 5)를 갱신했다.
- 결함 주입 10종이 모두 각자 red였다: 막는 수 1 고정 · 확률 무시 · 첫 공격 확정 없음 · 다음 공격 배율 안 지움 · 보조 기술이 배율 소진 · 빈 강화가 지움 · 생명 소모 없음 · 전투 플래그 이월 · 공격력 강화 없음 · 장비 회피를 은신보다 먼저 굴림.
- 계약 9번째: 은신이 장비 회피보다 먼저이고, 들킨 공격에만 장비 회피 기회가 있다.

---

## 54. Wave 54 — 소유자 결정: 기술 설명 전수 감사 — 설명대로 구현 (1/2: 턴 · 분기 · 부가 효과 12건) (2026-10-01, 베이스 `main` = `a8e9f8b6` = PR #86 merge commit)

### 54.1 감사

- 직업 기술 · 분기 · 특성 기술 238줄의 설명을 엔진 경로와 하나씩 대조했다. 의심 항목마다 실제 엔진 호출로 탐침했다.
- 설명과 동작이 다른 기술은 19개다. 죽음의 낫("HP 낮을수록 피해 증가")은 무당 패시브가 그 동작을 해서 제외했다.

| 묶음 | 기술 | 설명 | 실제 동작(수정 전) |
|---|---|---|---|
| ① 지속 턴 | 시간 왜곡 · 시간 정지 · 시간 결빙 | 2 · 3 · 2턴 | 기절 1턴 (`stunTurn`만 읽음) |
| ② 분기 효과 | 혼란 찌르기(등 찌르기 B) | 기절 + 출혈 | 출혈만, 설명에 없는 40% 확률 |
| | 저주 일섬(그림자 일섬 B) | 저주 + 출혈 | 저주만 |
| ③ 부가 효과 | 이중 자상 | 두 번 연속, 각 70% 치명 | 한 번 |
| | 철벽 방어 | 반격 자세 돌입 | 반격 없음 |
| | 분노의 포효 | DEF −30% | 방어 감소 없음 |
| | 파워배시 | 방패를 무시 | 방어 자세 피해 감소를 받음 |
| | 등 찌르기 | 은신 중 60% 치명 | 항상 60% |
| | 마나 가속 | 3턴간 추가 회복 | 즉시 회복만 |
| | 원소 폭풍 | 화염 + 냉기 | 화상만 |
| ④ 표현 | 독 보강 · 역병의 안개 | 독 강화 | 강화 없음 |
| | 출혈베기 · 영혼 소환 | 3턴간 | 전투 내내 |
| | 출혈베기 A · 독바르기 A | 출혈 · 독 피해 +50% | 타격 피해만 오르고 지속 피해는 그대로 |
| | 연막탄 | 명중률 하락 | 적 공격력 35% 감소 |

- **소유자 답**: "전부 설명대로 구현."
- 위험을 나누려고 두 웨이브로 나눴다. Wave 54는 ①②③(12건)이고, ④(7건 — 지속 피해 지속 · 강화, 실명 = 명중률)는 Wave 55다.

### 54.2 변경

- **기절 · 빙결의 `turn`은 지속 턴이다.** 분기의 `stunTurn`이 우선한다. 시간 왜곡 2 · 시간 정지 3 · 시간 결빙 2.
  - 적 행동 N번을 막는다(Wave 44의 "N턴" 모델).
- **혼란 찌르기**: 기절 + 출혈. 설명에 없던 40% 확률을 지웠다.
- **저주 일섬**: 저주 + 출혈.
- **이중 자상**: `hits: 2`, 위력 100% × 2. 이전 위력 200% 한 방과 기대 피해가 같다.
  - 타격마다 피해와 치명을 따로 굴린다.
  - 카드는 "위력 100% × 2"로, 로그는 "2연타" 태그로 보여 준다.
- **철벽 방어**: 강화와 함께 반격 40%(`counterChance`). 반격 자세와 같은 반격 경로를 쓴다.
- **분노의 포효**: `defBonus: 0.7` — 강화 동안 방어력 −30%.
- **파워배시**: `ignoreGuard` — 적의 방어 자세 피해 감소를 받지 않는다. 로그에 방어 붕괴 태그가 붙는다.
- **등 찌르기**: `stealthCrit: 0.6` — 은신 중(Wave 53 은신 플래그)에만 60% 치명이다. 은신이 아니면 기본 치명 확률이다.
- **마나 가속**: MP 20 즉시 + 3턴간 턴마다 7(`skillMpRegen`). 생명 지속 회복과 같은 틱이고, 실효 최대 기력에서 멈춘다.
- **원소 폭풍**: 화상 + 빙결.
- 설명은 수치를 말하도록 다듬었다: 철벽 방어 "피격 시 40% 반격", 마나 가속 "턴마다 MP 7", 파워배시 "적의 방어 자세를 무시", 원소 폭풍 "화상 + 빙결".

### 54.3 측정 (5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책)

| 경로 | 바뀐 기술 | 이전 (Wave 53) | **Wave 54** |
|---|---|---|---|
| 전사 > 나이트 | 파워배시 · 철벽 방어 | 6.73 | 6.79 (z 0.1) |
| 전사 > 버서커 | + 분노의 포효 | 9.56 | 8.81 (z −1.2) |
| 마법사 > 아크메이지 > 대마법사 | 마나 가속 · 시간 왜곡 · 원소 폭풍 · 시간 정지 | 6.79 | 6.79 (z 0.0) |
| 마법사 > 무당 > 시간술사 | 마나 가속 · 시간 결빙 | 6.46 | 6.40 (z −0.1) |
| 도적 > 어쌔신 > 그림자 주군 | 등 찌르기 · 이중 자상 · 저주 일섬 | 4.81 | 4.85 (z 0.1) |

- 시드당 4회 합계 사망 기준이다. 위반 0, 타임아웃 0.
- 다섯 경로 모두 유의한 차이가 없다. 첫 회차 시간도 ±3h 안이다.
- 드라이버는 위력 높은 기술을 먼저 고른다. 그래서 이중 자상(타격당 위력 100%)은 이전보다 덜 쓰인다. 이 측정은 이중 자상을 일부러 쓰는 플레이를 재지 않는다.

### 54.4 테스트 · 결함 주입

- 새 `tests/skill-description-delivery.test.js` (9):
  1. `turn`을 가진 기절 · 빙결 기술 전수(정확히 셋): 남은 기절 턴 = `turn`, 설명의 턴, 실제 적 행동이 N번 멈춘다.
  2. 혼란 찌르기 기절 + 출혈(확률 없음), 저주 일섬 저주 + 출혈.
  3. 이중 자상 2연타 = 한 번 × 2, 타격마다 치명(분산 → 치명 난수 순서로 첫 타만 치명 = 일반 × 3), 카드 "위력 100% × 2".
  4. 철벽 방어 반격 40%(확률 안 · 밖).
  5. 분노의 포효 방어력 감소.
  6. 파워배시 방어 자세 무시, 다른 기술은 방어 자세에 줄어든다.
  7. 등 찌르기 은신 중에만 60% 치명.
  8. 마나 가속 즉시 20 + 틱 7 × 3, 상한.
  9. 원소 폭풍 화상 + 빙결.
- 기존 테스트 갱신:
  - `class-traits-contract`: 치명 강점 근거에 `stealthCrit` 포함.
  - `seven-jobs-skill-branches`: 기존 분기 확률 밴드에 혼란 찌르기의 역사적 40%를 고정.
  - `relics`(cycle 551): `getEffectiveMaxMp` 내부 호출 4 → 5.
  - `data-shape-types`: 새 필드 4.
- 결함 주입 11종이 모두 각자 red였다: 기절 턴 무시 · 1타 · 치명 공유 · 방어 자세 적용 · 은신 무관 치명 · 반격 없음 · 기력 틱 없음 · 방어 감소 없음 · 빙결 없음 · 혼란 찌르기 기절 없음 · 카드 × 2 없음.
- 진단 증빙: 전사 코호트 전투가 짧아졌다(p90 5 → 4턴, 거부된 기술 입력 19 → 12). 진단은 직업의 첫 기술(전사 = 파워배시)을 쓰기 때문이다. 나머지 증빙은 소스 해시만 바뀌었다.

## 55. Wave 55 — 소유자 결정: 기술 설명 전수 감사 — 설명대로 구현 (2/2: 지속 피해 지속 · 강화, 실명 = 명중률 7건) (2026-10-01, 베이스 `main` = `b84e63c1` = PR #87 merge commit)

### 55.1 대상

- §54.1 감사 표의 ④ 7건이다. 소유자 답은 그대로 "전부 설명대로 구현"이다.

| 기술 | 설명 | 수정 전 | 수정 후 |
|---|---|---|---|
| 출혈베기 · 영혼 소환 | "3턴간" | 출혈이 전투 내내 | 적 행동 3번 피해 뒤 사라진다 |
| 심층 출혈(출혈베기 A) | 출혈 피해 +50% | 타격 위력 1.8 → 2.5, 출혈 그대로 | 타격 위력 기본(1.8), 출혈 틱 × 1.5 |
| 맹독(독바르기 A) | 독 피해 +50% | 타격 위력 1.5 → 2.25, 독 그대로 | 타격 위력 기본(1.5), 독 틱 × 1.5 |
| 독 보강 | 기존 독 강화 | 독 그대로 | 독 틱 × 1.5 ("독 피해 +50%"로 설명 보강) |
| 역병의 안개 | 모든 독 피해 강화 | 독 그대로 | 독 틱 × 1.5 ("+50%"로 설명 보강) |
| 연막탄 | 적 명중률 하락 | 적 공격력 × 0.65 | 적 공격 35% 빗나감 ("적 공격 35% 빗나감"으로 설명 보강) |

### 55.2 변경

- **지속 피해의 지속 턴** (`Monster.dotTurns`):
  - `turn`을 가진 지속 피해 기술이 그 지속 피해에 남은 턴을 건다. 적 행동마다 피해를 준 뒤 1 줄고, 0이면 지속 피해 · 남은 턴 · 배율이 함께 사라진다("…이(가) 사라졌습니다" 줄).
  - `turn`이 없는 기술의 지속 피해는 전투 내내다(이전과 같다). 지속 피해 기술 대부분이 여기에 속한다.
  - 전투 내내 걸린 같은 지속 피해를 짧은 기술이 줄이지 않는다. 시간 제한 지속 피해를 다시 걸면 턴이 처음부터다. 시간 제한 위에 턴 없는 기술이 걸면 전투 내내로 바뀐다.
- **지속 피해 강화** (`ClassSkill.dotDamageMult` → `Monster.dotMults`):
  - 그 지속 피해의 틱 피해 배율이다. 여러 번 걸리면 강한 배율이 남는다(약한 강화가 되돌리지 않는다).
  - 심층 출혈 · 맹독은 타격 위력 override를 지우고 `dotDamageMult`로 바꿨다. 분기 동등성 계약(Wave 45)의 엔진이 읽는 override 키에 `dotDamageMult`를 넣었다.
- **실명 = 명중률** (`BALANCE.BLIND_ENEMY_MISS_CHANCE` 0.35):
  - 실명이 남은 적 공격은 35% 확률로 빗나간다(`MSG.ENEMY_BLIND_MISS`). 판정은 틱 전 상태(Wave 44 모델)이고, 방어 자세 · 은신 판정 뒤라 실제 공격에만 굴린다.
  - 기대 피해는 이전 공격력 배율과 같다(1 − 0.65). 대신 분산이 커진다 — 한 번은 0, 한 번은 전량이다.
  - 실명은 `getEnemyDebuffAtkMult` · 감소 로그 라벨에서 빠졌다. 읽는 곳이 없어진 `BLIND_ATK_MULT`는 지웠다(cycle 195 사용되지 않는 키 가드).
- **전투 화면**: 적 약화 칩이 시간 제한 지속 피해에 남은 턴을 붙인다("출혈 · 2턴"). 턴 없는 지속 피해는 이름만이다.

### 55.3 측정 (48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 54 코드)

| 경로 | 바뀐 기술 | Wave 54 | **Wave 55** |
|---|---|---|---|
| 전사 > 나이트 | 출혈베기 | 6.79 | 6.60 (z −0.3) |
| 전사 > 버서커 | 출혈베기 | 8.81 | 8.60 (z −0.3) |
| 마법사 > 무당 > 시간술사 | 영혼 소환 · 역병의 안개 | 6.40 | 6.92 (z 1.0) |
| 도적 > 어쌔신 > 그림자 주군 | 독 보강 · 연막탄(드라이버는 안 씀) | 4.85 | 5.00 (z 0.3) |

- 시드당 4회 합계 사망 기준이다. 위반 0, 타임아웃 0. 첫 회차 시간 차이는 +3.0h 이내다(시간술사 75.2 → 78.2h, z 0.9).
- 바뀐 기술은 실제로 많이 쓰였다. 시드당 출혈 기술 사용은 나이트 781 · 버서커 1,559 · 시간술사 463 · 어쌔신 376회, 도적 독 기술은 824회다.
- 회차별 16개 비교 중 하나가 z 2.6이다(어쌔신 4회차 1.04 → 1.58). 16개 비교의 보정 기준(z ≈ 2.96) 안이고 합계는 z 0.3이라 효과로 보지 않는다.
- 분기 A(심층 출혈 — 타격 위력 2.5 → 1.8, 출혈 틱 × 1.5 · 3턴)를 모든 분기에서 고르는 전사 > 나이트: 6.46 → 6.02 (z −0.7). 기준은 같은 분기 정책의 Wave 54 코드다. 타격 위력을 덜어 낸 대가가 사망으로 드러나지 않았다.
- 드라이버는 연막탄을 쓰지 않는다(약화는 공포만 연다). 실명 변경은 이 측정 밖이고, 계약 테스트가 기대 피해 동일을 고정한다.

### 55.4 테스트 · 결함 주입

- 새 `tests/dot-duration-and-blind-miss-contract.test.js` (6):
  1. 지속 턴을 가진 지속 피해 기술 전수(정확히 넷 — 출혈베기 · 심층 출혈 · 이중 상처 · 영혼 소환): 설명의 턴, 남은 턴, 적 행동 N번의 틱 피해 뒤 0, 기록 정리.
  2. 만료 줄, 턴 없는 지속 피해 기술 전부가 6번 뒤에도 남는다.
  3. 전투 내내 지속 피해를 줄이지 않음 · 다시 걸면 3턴 · 턴 없는 기술이 걸면 전투 내내.
  4. 강화 기술 전수(정확히 넷): 설명의 +50%, 틱 × 1.5, 강화 없는 재적용에도 유지, 더 약한 배율은 되돌리지 않고 더 강한 배율은 올린다.
  5. 실명: 경계 아래 빗나감(피해 0, 줄) · 위 전량, 실명 없으면 빗나가지 않음, 설명의 35%, 기대 피해 동일.
  6. 전투 화면 칩의 "출혈 · 2턴" (렌더 단언).
- 실명 기대값을 빗나감 모델로 옮긴 기존 테스트: `enemy-debuff-duration-stacking`(연막탄 "2턴" = 빗나감을 굴리는 행동 2번, 겹친 약화 배율에서 실명 제외) · `class-skill-effect-delivery`(공포보다 강한 약화는 더 강한 공포) · `player-status-expiry`(`isEnemyBlindActive`).
- 결함 주입 14종이 모두 red였다: 지속 턴 없음 · 시간 제한이 전투 내내를 덮음 · 재적용 시 턴 유지 · 턴 없는 기술이 타이머 유지 · 배율 저장 없음 · 배율 덮어쓰기 · 틱이 배율 무시 · 만료 없음 · 실명 빗나감 없음 · 실명이 공격력 감소 · 틱 뒤 실명 판정 · 출혈베기 턴 없음 · 역병의 안개 배율 없음 · 칩 턴 없음.
- 증빙: 소스 해시만 바뀌었다(진단 · 장비 전투력 · 유물 지속 피해 배율 · 유물 골드 배율). 진단은 직업의 첫 기술만 쓰고, 그 기술 중 바뀐 것이 없다.

## 56. Wave 56 — 소유자 결정: 유물 · 조합 설명 감사 — 결함 수정과 설명대로 구현 (2026-10-01, 베이스 `main` = `bed0c9c5` = PR #88 merge commit)

### 56.1 감사

- 유물 67 · 조합 20 · 소모품 14 · 장비 특수효과 · 칭호 56의 설명을 엔진 경로와 대조했다. 의심 항목은 실제 함수 호출(결정론 rng)로 탐침했다.
- 분류:

  | 범주 | 미구현 | 수치 · 범위 다름 | 문구 문제 | 일치 |
  |---|---|---|---|---|
  | 유물 67 | 2 | 13 | 14 | 38 |
  | 조합 20(대가 20은 전부 일치) | 7 | 5 | 1 | 7 |
  | 소모품 14 | 0 | 0 | 1 | 13 |
  | 장비 특수효과 | 7(원소 저항 5 · 재생 2) | 0 | 4 | 나머지 |
  | 칭호 56 | 0 | 0 | 0 | 56 |

- 공통 결함 하나: 회복의 상한이 경로마다 달랐다. 물약 · 휴식 · 전투 시작 회복은 실효 최대 생명(`calculateFullStats`)까지 채우는데, 처치 회복 · 흡혈 · 기술 흡수 · 회복 틱 · 레벨업은 저장된 `maxHp`로 상한을 걸어 생명을 오히려 깎았다(실효 최대 696에서 처치 회복 뒤 500). 기력도 같았다(룬 왕관 240 → 치명타 회복 뒤 200).

- **소유자 답(3문항)**:
  1. 설명대로 하면 약해지는 것(쌍검 각인 160 → 120% · 시간의 파편 대기 절반 → −1 · 영혼 수집가 평생 처치 소급 · 심연 유물 어디서나 → 심연에서만 · 지옥의 수확자 흡혈) — **"영혼 수집가만 설명대로"**, 나머지는 문구를 동작에 맞춘다.
  2. 설명대로 하면 강해지는 것 — **"설명대로 구현 + 측정"**.
  3. 새 시스템이 필요한 것(원소 저항 장비 · 재생 장비 · 혼돈의 심장 · 혼돈의 보석) — **"이번에 설계 · 구현"** → Wave 57로 나눴다.

### 56.2 변경

- **결함(결정 없이)**:
  - 허공의 눈: 지역 보스 목록 전체를 조우 풀에 넣어, 해금 조건이 있는 숨은 보스(시간의 파수꾼 · 원한의 용사 · 공허의 군주 · 에테르 군주)가 조건 없이 약 29% 나왔다. 이제 "보스 발견 확률 3배" = 풀에 이미 있는 보스의 가중치 × 3이다. 풀에 없는 보스(게이지 보스 · 해금 전 숨은 보스)는 넣지 않는다.
  - 절멸자 · 공허의 용: 실제 승리 경로(`buildPassiveBonusWithScout`)가 켜진 조합을 넘기지 않아 처치 공격력 누적 보너스가 0이었다(테스트는 픽스처로 넣어 통과했다). 이제 넘기고, 넘기지 않으면 유물에서 구한다.
  - `find`가 강한 조합을 가렸다: 시간의 지배자(강화) 30%(10%가 먼저 잡힘) · 원초의 분노 치명 2.5배(공허의 용 2.0) · 엔트로피의 신 매 행동 15%(엔트로피 낙인이 먼저) · 혈맹 불사 흡혈 100%(흡혈 군주 50%). 이제 가장 큰 값이다.
  - 지옥의 수확자: 줄이는 양(0.02)을 새 비용으로 대입해 2%였다 → 5% − 2% = 3%("생명 소모가 3%로").
  - 회복 상한(`healWithinMax`, `systems/vitals.ts`): 회복은 생명을 줄이지 않고 상한은 실효 최대 생명이다. 처치 회복 · 흡혈 · 기술 흡수 · 회복 기술 · 턴 회복 틱이 이 규칙을 쓴다. 레벨업 · 마일스톤은 최대치와 현재치를 같은 양 올린다. 전투 중 기력 상한(`getEffectiveMaxMp`)은 `calculateFullStats().maxMp`다.
- **설명대로(결정 2)**:
  - 그림자 망토: 전투 시작 때 `cloakEvadePending` — 이번 전투에서 처음 받는 실제 적 공격(방어 자세 턴 제외)을 확정 회피한다. 은신보다 먼저 쓴다.
  - 운명의 거울: 받은 피해의 30%를 반사(난수 없음). 절대 반사(거울 + 가시 갑옷)의 "반사 피해 50%"는 두 반사 모두의 비율이다.
  - "공격"이라 말하는 유물은 위력 있는 기술에도: 처형자의 날 · 절멸자 임계, 예언의 돌판, 허공의 심장(다음 첫 공격 300%), 동결의 닻(15% 빙결), 흡혈 군주 · 혈맹 불사 흡혈.
  - 지속 피해 유물은 틱에도(`getRelicDotMult` · 유물 `dotScope`): 죽음의 낙인 독 · 화상 × 3(출혈 제외), 저주의 결정 전부 × 1.5(저주 틱 포함), 둘 다면 대상별 강한 값. 죽음의 예언자 "모든 지속 피해"가 저주 틱도 키운다. 기술 적중의 추가 타격(20%)도 같은 대상 규칙이다.
  - 비전 파동: 기력 무소모 확률 × 2(이전에는 읽는 곳이 없었다). 비전 특이점: 무소모 확률 최소 35%(이전에는 유물 확률에 더해 43 · 50%), 기술 피해 × 1.3(이전에는 위력에 0.3을 더해 위력 2 → +15%).
  - 부활 조합(불멸의 전사 · 절대 불사 · 혈맹 불사 "부활 시 생명 50%")과 난공불락 조합("사망 방지가 발동하면 30% 회복")은 모든 부활 수단(불사의 의지 · 허공의 심장 · 부활 토큰 · 불사조 · 에테르 거울)에 적용한다. 이전에는 불사의 의지 분기 안에만 있어 그 유물이 없는 조합에서는 발동하지 않았다.
  - 별의 핵: 실효 최대 기력까지. 룬 왕관: 최대 기력 +40%는 배율(`mpVal` 40 → 0.4).
  - 고대의 봉인: 사건 결과 · 탐험 이상 현상의 상태 이상도 40% 확률로 막는다(유물이 없으면 난수를 쓰지 않는다).
  - 영혼 수집가(결정 1): 유물 인스턴스가 얻은 뒤의 처치를 센다(`kills`). 계정 평생 처치 수를 읽던 동안 1,000킬 계정은 줍자마자 공격력 160 → 910이었다.
- **문구(결정 1 · 문구 범주)**: 쌍검 각인 "합계 160%", 시간의 파편 "두 배 빨리", 심연 3종 "돌파한 층 수 · 어디서나", 지옥의 수확자 "일반 공격으로 준 피해의 50%", 강철 의지 · 타이탄 "강타", 황금 자석 · 상인의 인장 · 경험 증폭기 "전투 처치", 환영 핵 · 창세의 핵 상시 능력치, 불사조 "전투마다", 엔트로피 엔진 "공격 · 기술 3번마다", 공허의 용 "치명타 피해 2배", 시간의 지배자(강화) "2턴 추가(왕관 포함 3턴)", 그림자 망토 "처음 받는 적 공격", 영혼 수집가 "얻은 뒤", 영웅의 물약 · 신성한 · 고대 세트 "공격력 · 방어력(· 최대 생명)". 심연 유물 분류 `abyss-only` → `abyss-progress`.
- 장비 문구 "흡수한다"(어둠 방패 · 균열 외피갑옷)는 수치 약속이 아닌 배경 문구라 그대로 두었다 — 장비 경제 감사가 장비 행 전체를 다이제스트로 고정한다.

### 56.3 측정

4경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 55 코드(`main` = `bed0c9c5`). 시드당 4회 합계 사망:

| 경로 | Wave 55 | 유물 · 조합만(회복 상한 수정 전) | **Wave 56** |
|---|---|---|---|
| 전사 > 나이트 | 6.60 | 5.25 (z −2.1) | **3.71** (z −5.0) |
| 전사 > 버서커 | 8.60 | — | **5.65** (z −5.1) |
| 마법사 > 무당 > 시간술사 | 6.92 | 4.96 (z −3.7) | **3.73** (z −6.8) |
| 도적 > 어쌔신 > 그림자 주군 | 5.00 | — | **2.92** (z −5.2) |

- 위반 0, 타임아웃 0. 첫 회차 시간 70.7 → 62.8 · 82.4 → 77.0 · 78.2 → 73.4 · 67.0 → 62.6h, 4회 합계 시간 −3 ~ −9%.
- **사망이 약 40% 줄었다.** 출처를 나누려고 회복 상한 수정만 되돌린 탐침(같은 48시드)을 두 경로에서 쟀다: 유물 · 조합 변경이 감소의 절반 남짓(나이트 −1.35 · 시간술사 −1.96), 회복 상한 수정이 나머지(−1.54 · −1.23)다.
  - 회복 상한 수정은 결함 수정이다 — 처치 회복 · 흡혈 · 회복 틱이 장비 · 유물로 늘어난 생명을 저장된 최대치로 깎고 있었다. 장비가 좋아질수록 회복이 손해였던 셈이다.
  - 유물 · 조합 변경은 소유자 결정 2(설명대로 구현)의 결과다. 수치 보정은 하지 않았다(Wave 53 원칙 — 성장은 임무 · 사냥 · 장비 · 추가 시스템의 몫이고, 유물은 그 추가 시스템이다).
- **측정이 잡은 회귀**: 첫 측정에서 드라이버의 불변식 `hpAboveFullMaxHp`(생명 > 실효 최대 생명)가 10만 건대로 걸렸다. 승리 처리는 세계 포식자의 전투 한정 생명을 먼저 걷어 내는데, 처치 회복의 상한으로 전투 중 능력치(`FullStats`)를 썼기 때문이다. 상한을 걷어 낸 뒤의 `calculateFullStats().maxHp`(`getEffectiveMaxHp`)로 바꾸고 회귀 테스트(수정 전 red)를 넣은 뒤 같은 48시드를 다시 쟀다 — 위의 표가 다시 잰 값이다. 첫 측정의 수치는 버렸다(도적 경로는 측정 중 소스가 바뀌기도 했다).

### 56.4 테스트 · 결함 주입

- 새 `tests/relic-description-delivery.test.js` (18): 그림자 망토 · 운명의 거울(절대 반사) · 기술에 적용되는 공격 유물 4종 · 동결의 닻 · 흡혈 조합 · 지속 피해 틱(대상 · 저주 · 조합) · 조합 최댓값 3종 · 실제 승리 경로 누적 · 지옥의 수확자 3% · 비전 파동 / 특이점 · 부활 조합 · 룬 왕관 / 별의 핵 · 영혼 수집가 · 허공의 눈(숨은 보스 · 가중치) · 고대의 봉인(사건) · 회복 상한 · 세계 포식자 회복 상한 회귀 · 문구.
- 기존 테스트 갱신: `data-shape-types`(유물 필드 `kills` · `dotScope`), `relic-dot-multiplier-coherence`(대상 · 원천 판정), `relic-free-skill-coherence`(특이점 최소 35%), `relic-gold-multiplier-coherence` · `relicGoldMultiplierAudit`(문구), `relic-hp-drain-atk-coherence` · `relicHpDrainAtkAudit` · `relics`(3%), `class-skill-effect-delivery` · `skill-description-delivery` · `skills-cycle`(실효 최대 생명 · 기력), `stats-calculator`(영혼 수집가), `status-cycle`(틱 인자), `synergies-cycle`(공용 판정), `relic-balance-audit`(분류 이름).
- 결함 주입 30종이 모두 red였다(처음 28 — 치명 배율 첫 조합 · 특이점 덧셈 둘은 단언을 좁혀 잡았다).
- 증빙: 유물 지속 피해(재연 전투에서 적 생명 265 → 145 — 틱 배율), 지옥의 수확자(980 → 970), 유물 골드 배율 · 유물 균형(문구 · 분류 · 소유 경로), 진단(소스 목록만). 나머지는 소스 해시만.

## 57. Wave 57 — 소유자 결정: 새 시스템이 필요한 설명 — 원소 저항 장비 · 재생 장비 · 혼돈의 심장 · 혼돈의 보석 (2026-10-01, 베이스 = Wave 56 브랜치 `4ad65819` = PR #89 head)

### 57.1 대상과 소유자 답

- §56.1 감사에서 "새 시스템이 필요한 것"으로 분류한 넷이다. 소유자 답(결정 3)은 "이번에 설계 · 구현"이다.
- 설계 질문 4개에 대한 답:
  1. 적 공격의 원소 — **"몬스터의 자기 원소"**. 적 데이터의 `resistance`(모든 몬스터 254종이 하나씩 가진다)가 그 적의 원소이고, `물리`는 원소가 아니다.
  2. 저항의 세기 — **"50% 감소"**.
  3. 재생 장비 — **"3% · 5%"**(세계수 갑주 · 세계수 뿌리 갑옷).
  4. 혼돈의 심장 — **"조합까지 켜지게"**. 빌린 유물이 조합을 완성하면 조합과 그 대가가 함께 켜진다.

| 대상 | 설명 | 수정 전 | 수정 후 |
|---|---|---|---|
| 화염 방어복 · 냉기 방어복 · 화염술사 로브 · 화염 방패 | 불(추위)에 강한 · 화염 원소 저항 | 효과 없음(`elem`은 표시 · 아트 전용) | 그 원소 적의 공격 피해 −50% |
| 원시의 이지스 | 모든 원소를 저항한다 | 효과 없음 | 물리를 뺀 8원소 적의 공격 피해 −50% |
| 세계수 갑주 · 세계수 뿌리 갑옷 | 자연의 회복력 · 무한한 재생력 | 효과 없음 | 행동마다 최대 생명 3% · 5% 회복 |
| 혼돈의 심장 | 전투마다 무작위 유물 효과 발동 | 생명 10% 회복 · 공격력 25% · 방어력 25%(3턴) 중 하나 | 가지지 않은 유물 하나를 그 전투 동안 빌린다(조합 포함) |
| 혼돈의 보석 | 전투가 시작되면 공격력 또는 방어력 30% 증가 | 강화 칸(`tempBuff`)에 3턴 — 기술 강화가 덮어씀 | 그 전투 내내(전투 플래그) |

### 57.2 변경

- **장비 상시 효과 표** (`data/equipmentPassives.ts`): 효과를 장비 행(`items.ts`)이 아니라 별도 표에 둔다.
  - 장비 행은 장비 경제 증빙이 다이제스트로 고정한 승인 대상이다. 행에 필드를 더하면 승인된 가격 증빙을 다시 핀해야 한다.
  - 조회는 표준 장비 정체성(`resolveEquipmentBaseIdentity`)으로 한다. 그래서 접두어 장비와 이 표가 생기기 전에 얻은 인스턴스에도 같은 효과가 붙는다.
  - 문구는 중앙 장비 문구(`getItemStatText`)가 표 · `BALANCE`에서 그린다("화염 피해 −50%" · "모든 원소 피해 −50%" · "매 턴 생명 5% 회복").
- **원소 저항**:
  - 적 공격 피해 × `BALANCE.EQUIP_ELEMENT_RESIST_MULT`(0.5)다. 방어 차감 뒤, 저주 증폭 · 조합 대가 · 타이탄 앞에서 곱한다. 난수를 쓰지 않는다.
  - 같은 원소를 막는 장비가 둘이어도(화염 방어복 + 화염 방패) 한 번이다.
  - 도주 실패 피해도 적에게 받는 피해라 같이 받는다(Wave 50 원칙).
- **재생 장비**: 행동 끝 틱(`tickCombatState`)에서 대지의 심장과 같은 기준(저장된 최대 생명의 비율, 상한은 실효 최대 생명 — Wave 56 `healWithinMax`)으로 회복한다.
- **혼돈의 심장** (`systems/chaosHeart.ts`):
  - 전투 시작(`applyBattleStartRelics`)에서 다른 전투 시작 효과보다 먼저 유물 하나를 빌려 `player.relics`에 넣는다(`borrowed: true`). 빌린 유물의 전투 시작 효과 · 그림자 망토 · 조합 · 대가가 엔진의 기존 판정 그대로 걸린다.
  - 무엇을 빌릴 수 있는지는 효과마다 분류한다(`CHAOS_HEART_ELIGIBILITY`, `Record<RelicEffect, …>`라 새 효과는 분류하지 않으면 컴파일되지 않는다). 전투 안에서 작동하는 효과 45종(유물 48개)만 빌린다. 승리 정산 효과 9종(유물 11개) · 탐험 2종(3개) · 원정 상태 1종(허공의 심장) · 심연 진행 3종 · 자신은 빌리지 않는다. 가진 유물과 효과가 같은 유물도 빌리지 않는다(엔진이 같은 효과 중 하나만 읽는 경우가 있다).
  - 난수는 이전처럼 한 번이다. 빌린 유물과 그것이 켠 조합(대가 포함)을 로그에 남긴다.
  - 빌린 유물이 빌드 성향을 바꿔 실효 최대치를 낮추면 빌린 직후 현재치를 내린다(`clampVitalsToEffectiveMax` — 측정이 잡았다, §57.3).
- **혼돈의 보석**: 전투 플래그 `combatFlags.chaosGemStat`(`atk` · `def`)를 세우고 `calculateFullStats`가 그 전투 내내 보석 값만큼 더한다. 기술 강화와 겹친다(덮어쓰지 않는다). 보석이 없으면 표시가 남아도 0이다. 난수는 이전처럼 한 번이다.
- **전투 한정 효과의 끝** (`utils/combatScopedRelics.ts` `endCombatScopedRelics`):
  - 빌린 유물을 돌려주고 보석 표시를 지우고, 현재 생명 · 기력을 실효 최대로 내린다(올리지 않는다, Wave 27 N2 규칙).
  - 부르는 곳은 전투가 끝나는 모든 경로다. 승리는 `handleVictory`에서 정산 **전**이고, 빌린 유물은 골드 · 경험 · 처치 회복 · 원정 누적을 내지 않는다. 빌린 유물이 켠 조합의 처치 누적(절멸자)도 남은 유물로 다시 구한다. 패배(런 요약의 유물 수에서도 뺀다) · 도주 두 경로 · 전투가 아닌 모드로 복원(`LOAD_DATA`)도 부른다. 다음 전투 시작도 남은 것을 먼저 걷는다.
  - 세이브 마이그레이션은 매번 전투 플래그를 초기화하는데, 보석 표시만은 보존한다. 전투로 복원하면 빌린 유물(`relics`에 실린다)과 같이 남고, 그 밖의 모드는 `LOAD_DATA`가 지운다.
- **화면**: 시스템 탭의 보유 유물 수와 모바일 요약의 유물 수는 빌린 유물을 세지 않는다(`countOwnedRelics`). 빌린 유물에는 "혼돈의 심장 · 이번 전투" 표시를 단다.
- 설명: 혼돈의 심장 "전투마다 가지지 않은 유물 하나를 무작위로 빌려 그 전투 동안 효과 발동 (조합 포함)", 혼돈의 보석 "전투가 시작되면 그 전투 동안 공격력 또는 방어력 30% 증가".
- 유물 균형 감사: 혼돈의 심장 분류를 `exploration-pacing` → `conditional-combat`로 옮겼고, 소유 파일 목록에 `systems/chaosHeart.ts`를 더했다(구현이 옮겨 가 소유 파일이 사라졌다는 감사 오류 `RELIC_RUNTIME_OWNER_MISSING:chaos_relic`).

### 57.3 측정

5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 56 코드(PR #89 head = `4ad65819`). 시드당 4회 합계 사망:

| 경로 | Wave 56 | **Wave 57** | 첫 회차 시간 |
|---|---|---|---|
| 전사 > 나이트 | 3.71 | **3.44** (z −0.6) | 62.8 → 62.7h |
| 전사 > 버서커 | 5.65 | **5.27** (z −0.8) | 77.0 → 75.9h |
| 마법사 > 무당 > 시간술사 | 3.73 | **3.96** (z 0.6) | 73.4 → 74.3h |
| 도적 > 어쌔신 > 그림자 주군 | 2.92 | **3.04** (z 0.4) | 62.6 → 63.2h |
| 마법사 > 성직자 > 팔라딘 | 6.92 | **6.98** (z 0.1) | 71.8 → 69.9h |

- 위반 0, 타임아웃 0. 회차별 20개 비교도 전부 |z| ≤ 1.3이다. **유의한 변화가 없다.**
- 이유는 실제 발생 빈도다(경로마다 48시드 × 4회의 전투 시작 29만 ~ 35만 번 기준):
  - 혼돈의 보석은 전투의 9 ~ 16%에 걸렸다.
  - 혼돈의 심장은 0.05 ~ 1.4%에 걸렸다. 빌린 유물이 조합을 완성한 전투는 2 ~ 45번이다.
  - 원소 저항은 나이트 168번 · 버서커 120번만 막았다. 저항 장비는 전사 계열 · 마법사 · 아크메이지 · 팔라딘 장비인데, 측정 경로에서 실제로 입은 것은 나이트 · 버서커뿐이다.
  - 재생 장비(tier 5 · 6)는 드라이버 런에서 한 번도 장착되지 않았다.
- **측정이 잡은 결함**: 첫 측정에서 드라이버 불변식 `mpAboveFullMaxMp`가 걸렸다(시간술사 199번 등). 빌린 유물이 빌드 성향을 바꿔 실효 최대 기력을 낮추는 경우다(무당 + 마나 수정이 허공의 파편을 빌리면 197 → 187). 직업 5 × (혼돈의 심장 + 유물 하나) 조합을 탐색하면 659가지 빌림이 최대치를 낮춘다. 빌린 직후 `clampVitalsToEffectiveMax`로 내리게 고치고 회귀 테스트(수정 전 red)를 넣은 뒤 다시 쟀다 — 위 표가 다시 잰 값이다.
- 드라이버 쪽 정정:
  - 유물 상한 불변식(`relicsOverCap`)이 빌린 유물을 세서 상한 5/5에서 빌리면 위반으로 잡았다(나이트 10,895번). 가진 유물만 세게 바꿨다.
  - 대신 빌린 유물 · 보석 표시가 전투 밖에 남는 것, 빌린 유물 중복을 새 불변식으로 넣었다. 다시 잰 측정에서 셋 다 0이다.
  - 이 드라이버는 리듀서 안에서 보낸 로그(전투 시작 유물 로그)를 잃는다. 발생 빈도는 로그가 아니라 전투 시작 전이에서 셌다.

### 57.4 테스트 · 결함 주입

- 새 `tests/equipment-passives-contract.test.js` (8):
  - 표의 모든 행이 실제 장비다. 설명이 저항 · 재생을 약속하는 장비(`저항|재생|회복력|에 강한`)가 정확히 표의 7개다.
  - 적 원소 = `resistance`이고 물리는 제외다. 막는 원소만 절반이고, 장비 둘이 같은 원소를 막아도 한 번이다.
  - 이지스는 8원소 전부를 막는다. 도주 실패 피해도 같다.
  - 접두어 · 예전 인스턴스도 효과가 같다.
  - 재생 3% · 5%는 실효 최대에서 멈추고, 생명이 가득 차면 줄을 남기지 않는다.
  - 장비 문구를 확인한다.
- 새 `tests/chaos-relics-contract.test.js` (10):
  - 빌릴 수 있는 유물의 분류 · 같은 효과 제외를 확인한다. 혼돈의 심장이 없으면 난수를 쓰지 않는다.
  - 빌린 유물의 전투 시작 효과(그림자 망토)가 걸리고, 다시 시작해도 빌린 유물은 하나다.
  - 빌린 유물이 실효 최대 기력을 낮추면 현재 기력을 내린다(측정이 잡은 결함).
  - 조합(흡혈 군주)과 대가(받는 피해 +15%)가 켜지고 로그를 남긴다.
  - 승리 정산 전에 돌려주고, 절멸자 누적이 남지 않는다. 도주 · 패배에서도 돌려주고, 런 요약에서 뺀다.
  - 최대 생명을 실효 최대로 내린다. 세이브 복원은 전투면 남고 그 밖은 끝난다.
  - 보석은 5턴 · 기술 강화 뒤에도 남고 승리 뒤 사라지며, 난수는 한 번이다.
  - 시스템 탭 렌더(보유 1/5 · 표시 하나)를 확인한다.
- 기존 테스트 갱신: `explore-flow-equivalence`(혼돈 계열 추적 — 대지의 심장을 빌리고 공격력 보석, 난수 두 번 그대로) · `relic-balance-audit`(혼돈의 심장 분류).
- 결함 주입 31종이 모두 red였다:
  - 원소 저항 8종: 끔 · 중첩 · 물리 포함 · 약점 원소 · 도주 제외 · 인스턴스 필드만 · 이지스 단일 원소 · 문구
  - 재생 3종: 끔 · 상한 없음 · 비율
  - 혼돈의 심장 13종: 옛 구현 · 정산 효과 풀 · 같은 효과 · 시작 효과 누락 · 조합 로그 · 승리 · 승리 누적 · 도주 · 패배 · 복원 · 돌려줄 때 내림 없음 · 빌릴 때 내림 없음 · 중복 빌림
  - 혼돈의 보석 5종: 옛 구현 · 유물 확인 없음 · 승리 뒤 남음 · 마이그레이션 소실 · 뒤집힘
  - 화면 2종: 보유 수 · 표시
- 증빙: 유물 균형(혼돈의 심장 분류 · 소유 파일, 혼돈의 보석 소유 파일에 `statsCalculator`)만 값이 바뀌었다. 진단 · 장비 전투력 · 유물 지속 피해 · 이벤트 확률 · 골드 배율 · 지옥의 수확자는 소스 해시만 바뀌었다. 도달 비용 · 탐험 리듬 · 장비 경제는 바이트 동일하다(장비 행을 건드리지 않았다).

## 58. Wave 58 — 소유자 결정: 메타 · 계승 · 업적 · 장비 부가 효과를 설명대로 (2026-10-01, 베이스 = `main` `9b3594b2` = Wave 57 머지)

### 58.1 대상과 소유자 답

- 감사 3회차(계승 · 거울 · 업적 · 일일 · 장비 부가 효과 · 보스)에서 설명과 동작이 다른 항목을 모았다. 보스 기믹 · 보상은 Wave 59로 미뤘다.
- 소유자 답:
  1. 강해지는 쪽(설명보다 덜 주던 것) — **"설명대로 구현 + 측정"**.
  2. 약해지는 쪽(설명보다 더 주던 것) — **"전부 설명대로"**.
  3. 계승 7단계 "도전 조건을 하나 더" — **"계승 화면에서 함께 고름"**.
- 판단으로 문구만 고친 것(설명대로 구현하면 효과가 0이 되거나 없는 효과를 만들어야 하는 것):
  - 거울 **야영 기술** "마을 밖 휴식" — 휴식은 안전지대에서만 할 수 있어, 문구대로 구현하면 이미 산 단계가 무의미해진다. 문구를 "안전지대 휴식"으로 고쳤다.
  - 방어구 · 방패의 **"X 속성"** 표기 — 방어구의 `elem`은 공격 · 방어 원소가 아니다(원소 저항은 Wave 57의 장비 효과 표가 따로 그린다). 표기를 뺐다.
  - 양손 무기 **"강한 일격"** — 양손의 이점은 이미 공격력 수치(× `TWO_HAND_ATK_BONUS`)에 들어 있다. 별도 효과처럼 읽혀 "보조 손 함께 사용"(대가)으로 바꿨다.
  - 회수하지 못한 유해는 계승을 넘긴다(Wave 21 M2) — 계승 화면의 "보존" 줄에 추가했다.

### 58.2 수정 표

**계승 · 메타**

| 대상 | 설명 | 수정 전 | 수정 후 |
|---|---|---|---|
| 계승 직후 새 여정 | 거울 "유산의 금고" · "각성의 선택", 계승 5단계 "첫 유물 선택지 4개" | 사망 재시작(`start`)에만 적용, 정상 경로 "마왕 → 계승"에는 시작 골드 200 · 유물 선택지 없음 | 같은 계산(`utils/runStart.ts`)을 `ASCEND`도 쓴다 — 시작 골드 · 첫 유물 선택지(씨앗 결정론) · 도전 조건 |
| 계승 7단계 | 도전 조건을 하나 더 선택 | 계승은 인트로를 거치지 않아 고를 곳이 없었다 | 계승 화면 · 진 엔딩 화면에 도전 규칙 선택(인트로와 같은 `ChallengeModifierPicker`, 슬롯은 새 단계 기준) |
| 계승 보상 정수 | 계승 1단계 "에센스 획득 +10%" · 거울 "전투와 계승으로 얻는 계승 정수" | 고정 +200 | +200 × 계승 단계 배율 × 거울 배율(`scaleEssenceReward`) |
| 일일 처치 임무 표시 | 에센스 +N | 원액 표시(지급은 배율 적용) | 지급량 표시 |
| 일일 "골드 소비" | 골드 소비 | 상점 · 제작 · 강화 · 휴식만 | 유료 정찰 · 기술 교체 비용도 |
| 거울 에테르 수호 2단계 | 생명 60%로 다시 일어남 | 저장된 최대 생명 기준(장비 생명 보너스 제외 — 실효 최대의 약 48%) | 실효 최대 생명 기준 — 불사조 · 부활 토큰 · 부활 조합도 같은 규칙(부활 토큰 기력 회복은 기력을 줄이지 않는다) |
| 계승 2단계 | 유물 선택지 4개 | 탐험 발견 · 보스 · 심연 마일스톤만 4개, 이벤트는 1 ~ 2개 | 이벤트가 여는 유물 선택도 4개 |
| 계승 3단계 | 보스 희귀 장비 보장 | 가방이 가득 차면 다른 전리품과 같이 막혔다 | 보장 장비는 가방 상한을 넘어 들어간다(보상 경로와 같은 규칙) |
| 직업 패시브 · 도감 · 칭호 "+N" | 공격력 +5 등 | 직업 · 세트 · 조합 배율 앞에 더해 +6.5 ~ +8 | 모든 배율 뒤에 더한다(빌드 성향 판정 입력에는 그대로 포함) |
| 무당 죽음의 직관 | HP 30% 이하 | 정확히 30%에서 꺼짐(`<`) | 포함(`<=`, `BALANCE.LOW_HP_PASSIVE_THRESHOLD`) |

**업적**

| 대상 | 설명 | 수정 전 | 수정 후 |
|---|---|---|---|
| 합성 업적 · 연금술사 칭호 | 합성 N회 성공 | 실패 · 보호된 실패도 셈 | 성공만 셈(능력치 화면 라벨 "합성 성공") |
| 발견 업적 | 새 지역 N곳 | 시작 마을을 셈 | 시작 마을 제외 |
| 심연 업적 | N층 도달 | 돌파 층 수(`abyssRecord`)를 그대로 — 10층에 도달해도 9 | 돌파 + 1(도달한 가장 깊은 층) |
| 전설 각인 "전부" | 20종 전부 발견 | 목표 20(등록 25) | 목표 25 · 문구 25 · 수집 업적 문구 한국어("dedicated signature" 제거) |
| 달성 기록 | — | 계승 · 사망 재시작에서 줄어드는 값(레벨 · 방문 지역)이 수령 전 업적을 다시 잠갔다 | 영구 상태 선별(`pickPermanentPlayerState`)이 달성했지만 수령하지 않은 업적을 `stats.achievedAchievements`에 남긴다 |
| 누적 골드 | 누적 골드 N | 시즌 · 도감 · 주간 보상 · 레벨 이정표 · 첫 방문 · 발견 체인 골드가 빠짐 | 전부 `grantGold`로 |
| 휴식 업적 | N번 휴식 | 마을 휴식만 | 모닥불 "휴식"도 |

**장비 부가 효과 · 문구**

| 대상 | 수정 전 | 수정 후 |
|---|---|---|
| 접두어가 붙은 전설 각인("날카로운 라그나로크") | 이름 그대로만 조회해 세트 효과 · 판매 보호 · 서명 보정 · 전설 도감에서 빠졌다 | 바탕 이름으로 인정(`getSignatureBaseName` — 이름이 정확히 "접두어 바탕"일 때만), 도감에 바탕 각인도 기록, 판매 사본은 바탕 이름으로 셈 |
| 세트 구성원 | 엔진(레지스트리 `setGroup`)과 도감 · 세트 완성 업적(`signatureSets.json` `members`)이 달랐다(에테르 거인의 대검 · 영혼 절단자) | 같은 집합 |
| 전설 도감 세트 줄 | 이름 일치로 따로 셈(2H 가중치 · 접두어 · 발동 세트 하나 규칙 무시) | 엔진 계산(`getSignatureSetEquippedCounts` · 발동 세트) |
| 직업 장비 세트 안내 | 다음 단계 문구에 생명 · 기력 보너스 누락 | 보너스 표에서 문구를 만든다 |
| 접두어 엘릭서 | val(9999 + 접두어)만큼만 회복 | HP 완전 회복 |
| 보조 손 한손 무기 문구 | 주 손 수치(예: 112) | 보조 손 기여(예: 60) · 보조 손 치명 |
| 쌍수 비교 칩 | 장비 합만(방어력 ×0.92가 안 보임) | 쌍수 시작 · 해제 배율 문구 |

### 58.3 측정 (5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 57 코드 = 지금 `main`)

| 경로 | Wave 57 | **Wave 58** | 4회 합계 모델 시간 |
|---|---|---|---|
| 전사 > 나이트 | 3.44 | **3.50** (z 0.1) | 209.9 → 212.3h |
| 전사 > 버서커 | 5.27 | **5.40** (z 0.3) | 242.1 → 248.3h |
| 마법사 > 무당 > 시간술사 | 3.96 | **4.44** (z 1.1) | 222.7 → 224.2h |
| 도적 > 어쌔신 > 그림자 주군 | 3.04 | **2.96** (z −0.2) | 199.8 → 199.0h |
| 마법사 > 성직자 > 팔라딘 | 6.98 | **7.13** (z 0.3) | 221.8 → 220.6h |

- 값은 시드당 4회 합계 사망이다. 위반 0, 타임아웃 0. 회차별 20개 비교도 전부 |z| ≤ 1.8이라 **유의한 변화는 없다.**
- 변경이 실제로 일어났는지:
  - 계승 직후 골드가 200 → 700이다(드라이버가 산 거울 "유산의 금고" 5단계).
  - 계승 2단계 이상 유물 제안 중 5장짜리(첫 유물 선택지 3 + 거울 "각성의 선택" 2)가 389 → 886번이다 — 계승 직후 제안이 새로 열렸다.
  - 이벤트 유물 제안은 드라이버 경로(오프라인 폴백 이벤트)에서 나오지 않아 계승 2단계 이벤트 4장 규칙은 측정에 잡히지 않았다(계약 테스트가 지킨다).
- 고정 보너스 이동은 전투 공격력을 직업 패시브만큼 조금 낮춘다(성장 시뮬레이터 직업 스냅숏 피해 5 ~ 20 감소, 곡선 · 체크포인트 불변). 시작 골드 · 첫 유물 선택지가 그만큼을 메워 사망이 움직이지 않았다.

### 58.4 테스트 · 결함 주입 · 증빙

- 새 `tests/achievement-description-contract.test.js` (8): 합성 성공만 · 시작 마을 제외 · 심연 도달 층 · 전설 각인 "전부" = 등록 수(문구 숫자 = 목표, 한국어 문구) · 계승 뒤 달성 기록(수령까지) · 사망 재시작 뒤 달성 기록 · 누적 골드(시즌 · 도감 · 주간 · 레벨 이정표) · 모닥불 휴식.
- 새 `tests/meta-progression-delivery.test.js` (11): 계승 시작 조건(시작 골드 · 첫 유물 선택지 · 도전 조건 슬롯 · 결정론) · 빈손의 시작 · 계승 보상 정수 배율 · 일일 처치 임무 표시(렌더) · 유료 정찰 · 기술 교체 골드 소비 · 거울 에테르 수호 2단계 실효 최대 · 야영 기술 문구 · 이벤트 유물 선택지 4개 · 보장 장비 가방 상한 · 고정 보너스(직업 세트 배율이 걸린 상태에서 도감 +7 · +3 · +40이 그대로, 칭호 +4, 직업 패시브 = 같은 값의 도감 보너스) · 무당 30% 경계.
- 새 `tests/equipment-extras-contract.test.js` (9): 접두어 전설 각인(세트 · 빠진 구성원 · 도감 · 위조 이름 거부) · 판매 사본 · 세트 구성원 = 레지스트리 · 도감 세트 줄 렌더 · 직업 장비 세트 안내 · 접두어 엘릭서 · 보조 손 문구 · 양손 · 방어구 문구 · 쌍수 칩.
- 기존 테스트 갱신(기대값이 바뀐 것): 계승 정수 배율(`ascension-journey-design` · `essence-mirror` · `essence-ladder-ascension-carry`), 계승 payload(`cycle-200-299` · `endgame-settlement`), 고정 보너스(`expedition-ledger` 210 → 209 · `equipment-sidegrade-balance` 델타 5칸 · `equipment-combat-power-audit` 분류 4건 · 진단 CLI 기대 분류 수), 부활 실효 최대(`relic-description-delivery` · `relics` 호출처 수), 장비 문구(`equipment-utils`), 세트 구성원(`signature-set-bonus`), 발견 체인 누적 골드(`explore-flow-equivalence`), 합성 라벨 · 인트로 렌더 · 정찰 씨앗 · 방문 지역 배열(`cycle-*` · `intro-visual-contract` · `player-language-readability` · `player-scout-action` · `game-utils`), 성장 시뮬레이터 기준 해시(직업 스냅숏 피해 9칸만), 장비 전투력 증빙 쓰기 테스트의 리포트 · 행 해시와 분류 수, e2e 계승 정수 380 → 400 · 원정 귀환 전사 Lv20 최대 생명 703 → 699 · 계승 화면 버튼 높이 검사는 그려진 버튼만(닫힌 도전 규칙 선택 안의 버튼은 높이 0) + 선택기 노출 확인.
- 결함 주입 43종이 모두 red였다(업적 11 · 계승/메타 17 · 장비 15). 처음에 1종(도감 생명 보너스를 배율 안으로)이 green이어서 — 픽스처의 생명 배율이 1이었다 — 직업 세트를 갖춘 픽스처로 테스트를 강화한 뒤 red를 확인했다.
- 장비 전투력 감사: 방어구 4종의 분류가 옮겼다(그림자 망토 특화 → 범위 안 · 암흑 로브 범위 안 → 특화 · 정령의 로브 특화 → 의도 · 축복받은 갑옷 범위 안 → 가격만 결함). 방어구를 낄 때 오르는 직업 세트 배율이 직업 패시브 공격력까지 곱하던 몫(실효 공격력 기여 2.5 → 0.5)이 사라졌기 때문이다. 전투력 결함 0 · 재계획 불필요는 그대로다.

## 59. Wave 59 — 소유자 결정: 보스 기믹 · 보상을 설명대로 (2026-10-01, 베이스 = `main` `1768c7ca` = Wave 58 머지)

### 59.1 대상과 소유자 답

- 감사 3회차의 보스 항목 25건(미구현 10 · 수치 · 범위 다름 9 · 문구 6, 일치 97건)을 고쳤다. 대상은 브리핑(`BOSS_BRIEFS`)이 있는 보스 22종이다.
- 소유자 답:
  1. 보스 기믹 — **"전부 설명대로 구현"**(반격 · 소환 · 회복 · 브레스 · 장기전 · 상태 누적을 새 보스 행동으로).
  2. 보스 보상 — **"설명대로 구현 + 측정"**(유물 약속 보스는 처치 때 유물 선택 1번, 계열 약속 보스는 그 계열 장비, "대량" 초회 보상은 초회 골드 증가).
  3. 약해지는 쪽(2페이즈 "50%" · 차원 파쇄자 "가드 증가") — Wave 58 질문의 **"전부 설명대로"**.
- 설계 원칙: 브리핑의 약속은 보스 데이터 `mechanics`(`types/monster.ts` `BossMechanics`)가 선언하고 엔진 · 예고는 `systems/bossMechanics.ts`의 판정만 읽는다. 브리핑 문구 ↔ 데이터 ↔ 엔진은 한 계약 파일이 함께 대조한다 — 문구를 바꾸면 데이터가, 데이터를 빼면 엔진 테스트가 깨진다.
- 수치는 "설명대로"가 숫자를 말하지 않는 곳에서만 정했다(누적 중첩 3 · 중첩당 +50% · 기절 40% 등). 소유자 원칙("난이도 차이를 적 · 기술 수치 보정으로 메우지 않는다")에 따라 측정 뒤 수치를 되맞추지 않았다.

### 59.2 수정 표

**페이즈 · 예고**

| 대상 | 수정 전 | 수정 후 |
|---|---|---|
| 2페이즈 문턱 "50%" | 적 행동마다 40 ~ 60%를 새로 뽑았다(2만 판 평균 전환 45 ~ 51%) | 데이터 값 그대로(`getPhase2Threshold`, 난수 없음) |
| 3페이즈 보스 6종 | 두 문턱을 함께 넘으면 3페이즈 적용 뒤 2페이즈가 이름 · 패턴을 덮어썼다(마왕 15%: "분노한 마왕" · 강타 0.5) | 2 → 3 순서 — 3페이즈 이름 · 패턴, 두 페이즈의 상태 모두 |
| 페이즈 상태 로그 | 라벨 표 4종 — `[stun]` · `[bleed]` 영문 | `MSG.DOT_LABELS` 전체 |
| 페이즈 상태 저항 | 유물이 없어도 난수를 썼고, 이미 걸린 상태에서 저항 로그를 따로 굴렸다 | 걸리지 않은 상태에만, 유물이 있을 때만 난수 1번 |
| 예고 라벨 | 방어(≥30%)를 맹공(25 ~ 40%)보다 먼저 봐서 스핑크스(방어 32 · 맹공 35)가 "방어 가능" | 알릴 행동(방어 ≥30% · 맹공 ≥25%) 중 확률이 높은 쪽, 같으면 맹공 |
| 3페이즈 문턱 예고 | 2페이즈 값을 보이고 예보 칸 "마무리권" — 다음 행동은 3페이즈 값 | "Phase 3 임박"(두 문턱을 함께 넘을 때 포함), 예보 칸 "전환 직전" |
| 차원 파쇄자 "완전 개방 후 가드 빈도가 높아집니다" | 방어 0.40 → 0.30 | 0.40 → 0.50(맹공 0.45 → 0.40) |
| 스핑크스 "각성 후 가드와 독이 섞이므로" | 방어 0.32 → 0.15 | 0.32 → 0.40(맹공 0.35 → 0.40) |
| 고대 호수의 수호신 "높은 가드" | 방어 0.28(일반 공격 0.54가 가장 잦고 예고 "일반 공격") | 방어 0.45 · 맹공 0.15(방어가 가장 잦다, 예고 "방어 가능 (45%)") |

**새 보스 행동**

| 보스 | 약속 | 구현(데이터 선언) |
|---|---|---|
| 화염의 군주 · 화염 군주 이프리트 | "화상 누적" | 2페이즈 강타가 50%로 화상을 겹쳐 건다(최대 3중첩, 중첩마다 기본 피해 +50% — 3중첩 = 최대 생명 8%/턴) |
| 스핑크스 | "독 누적" · "장기전 운영은 피하는 편" | 독 누적(같은 규칙) · 8번째 행동 뒤 행동마다 공격력 +5%(최대 +50%) |
| 묘지기 네크론 | "망자 소환" · "저주가 중첩" | 2페이즈 전환에 망자 2체(다음 행동부터 행동마다 공격력 ×0.5로 함께 공격, 내 피해 행동 하나에 1체 쓰러짐) · 저주 중첩(받는 피해 +30 → +45 → +60%) |
| 아이스 드래곤 | "빙결 누적과 강한 카운터" · "모든 것이 얼어붙습니다" | 2페이즈 전환 빙결 · 2페이즈 강타가 냉기를 쌓아 3번째에 빙결 · 방어 자세 중에 맞으면 공격력 ×1.4 반격(방어 무시 기술 제외, 방어 로그가 "반격 자세"로 알림) |
| 고대 호수의 수호신 | "회복 압박" · "빙결 누적" | 방어 자세마다 최대 생명 6% 회복 · 냉기 누적(같은 규칙) |
| 시간의 파수꾼 · 천둥새 제피로스 | "연속 기절" · "기절 연속 공격" | 2페이즈 강타가 40%로 기절을 다시 건다(이전: 전환 1번) |
| 영겁의 수문장 | "강타와 제어가 섞여" · "모든 시간이 멈춥니다" · "장기전 보상" | 전환 기절(이전 독) · 2페이즈 강타 30% 기절 · 처치 골드 · 경험치 × (1 + 행동 수 × 5%, 최대 +100%) |
| 레드 드래곤 | "고화력 브레스" | 3번째 행동마다 방어 판정 없이 공격력 ×1.6 브레스(화상) — 예고가 그 차례를 알리고, 그 차례에 기절시키면 넘어간다 |
| 차원 파쇄자 | "긴 교전은 차원 왜곡 때문에 손해" | 스핑크스와 같은 장기전 강화 |
| 에테르 심판자 3페이즈 | "모든 저항이 무력화됩니다!" | 상태 저항 유물 · 원소 저항 장비가 통하지 않는다(`pierceResist` — 이전에는 같은 턴에 "[고대의 봉인] 저항"이 나왔다) |
| 아누비스 수호자 | 기믹 "저주성 압박" · 칩 "저주 압박"(phaseHint만 "독성") | 2페이즈 저주, phaseHint "저주 압박" |
| 빙결의 마녀 | "빙결 저주" · "상태이상이 겹칩니다" | 2페이즈 빙결 + 저주(이전 독) |
| 종말의 기사 | "3페이즈에서 화상과 저주가 겹치므로" | 3페이즈 저주 + 화상(2페이즈 화상은 3틱 뒤 끝나 겹치려면 턴당 15% 이상 깎아야 했다) |

**보스 보상**

| 대상 | 수정 전 | 수정 후 |
|---|---|---|
| 시간의 파수꾼 "희귀 유물이 높은 확률로" · 공허의 군주 "공허 계열 전설 유물" | 보스 처치로 유물을 얻는 경로가 없었다 | 처치 때 유물 선택 1번 보장(`applyBossRelicReward`) — 희귀 이상 · 전설 안에서 시간 · 공허 계열을 먼저 채운다. 유물 칸이 가득 차도 제안한다(선택 화면이 교체 · 넘기기) |
| 드롭 표 없는 보스 8종 "기사 · 기계 · 어둠 · 화염 · 바람 · 에테르 · 공허 · 종말 계열 장비" | 6등급 20종 균등(바람 0종) | 보너스 장비를 `lootTheme`(원소 · 이름 · 직업 중 하나, 최소 등급, 전설 각인 제외) 안에서 — 확률(25%)은 그대로 |
| 아이스 드래곤 · 에테르 드래곤 · 공허의 대행자 "대량 초회 보상" | 모든 보스 max(120, 처치 골드 × 35%) — 120 · 120 · 163골드 | 첫 토벌 골드 ×10 |
| 고대 호수의 수호신 "호수 계열 전리품 (자연/냉기 무기)" | 드롭 표에 무기 0개 | 얼음 지팡이 · 독침 단검(2등급, 각 15%) |
| 추천 빌드 '시간술사' | 직업명(빌드 라벨 8종에 없음) | 시간의 파수꾼 "상태이상 집행자", 공허의 군주에서 제거 |

### 59.3 측정 (5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 58 코드 = 지금 `main`)

| 경로 | Wave 58 | **Wave 59** | 보스전 사망(시드당) | 4회 합계 모델 시간 |
|---|---|---|---|---|
| 전사 > 나이트 | 3.50 | **3.67** (z 0.4) | 0.00 → 0.13 | 212.3 → 214.2h |
| 전사 > 버서커 | 5.40 | **5.35** (z −0.1) | 0.23 → 0.38 | 248.3 → 235.4h |
| 마법사 > 무당 > 시간술사 | 4.44 | **3.73** (z −1.7) | 0.08 → 0.23 | 224.2 → 227.9h |
| 도적 > 어쌔신 > 그림자 주군 | 2.96 | **2.94** (z 0.0) | 0.00 → 0.00 | 199.0 → 198.1h |
| 마법사 > 성직자 > 팔라딘 | 7.13 | **6.77** (z −0.7) | 0.35 → 0.42 | 220.6 → 221.4h |

- 값은 시드당 4회 합계 사망이다. 위반 0, 타임아웃 0. **전체 사망은 유의하게 변하지 않았다.** 회차별로는 시간술사 1회차 −0.90(z −2.4) · 2 · 3회차 +0.17(z 2.4 · 2.1)이 서로 상쇄했고, 나머지 회차는 |z| ≤ 2.1이다.
- **보스전 사망은 늘었다** — 늘어난 몫의 대부분이 아이스 드래곤(버서커 5 → 13 · 팔라딘 5 → 11)과 빙결의 마녀(새 빙결 + 저주)다. 반격과 빙결 누적이 실제로 위협이 됐다는 뜻이고, 보스전은 전체 사망의 작은 몫이라 합계는 움직이지 않았다.
- 드라이버에서 실제로 발생한 기믹(5경로 합): 반격 자세 2,302 · 반격 447 · 냉기 누적 812 · 냉기로 얼어붙음 50 · 중첩 상승 104 · 3페이즈 371. 첫 토벌 골드 합은 58.8만(시드당 계승 4회 합 약 2,450)이다.
- **드라이버 경로가 지나지 않는 보스의 기믹은 측정에 잡히지 않았다** — 브레스(레드 드래곤) · 망자 소환(네크론) · 회복(호수 수호신) · 장기전(스핑크스 · 차원 파쇄자 · 영겁의 수문장) · 연속 기절(시간의 파수꾼 · 제피로스) · 유물 보상(숨은 보스 2종)은 발생 0이다. 이 규칙들은 계약 테스트(실제 엔진 · 턴 해석기 · 정산 경로)가 지킨다.
- 측정 중 백그라운드 시간 제한으로 팔라딘 경로가 19/48에서 끊겨 그 경로만 다시 돌렸다(같은 스냅숏 `a7b14f38`).

### 59.4 테스트 · 결함 주입 · 증빙

- 새 `tests/boss-mechanics-contract.test.js` (28):
  - 브리핑 문구 ↔ 데이터: 누적 · 중첩 6종, 연속 기절 · 제어 3종, 카운터 · 회복 · 브레스 · 소환 · 장기전(손해 · 보상) · 저항 무력화의 선언 유무가 문구와 일치(22종 전수), 칩 · 문구가 말하는 상태 종류, 가드 증가(스폰된 1페이즈 대비), 높은 가드, 추천 빌드 라벨, 보상 약속(유물 · 대량 초회 · 계열 장비 · 호수 무기), 계열 풀(비지 않음 · 전설 각인 아님 · 계열 · 최소 등급), 스폰 복사.
  - 데이터 ↔ 엔진: 2페이즈 50% 고정(난수 0 · 0.5 · 0.9999), 페이즈 순서 6종, 한국어 라벨, 화상 누적(로그는 오를 때만 · 지속 턴 갱신 · 3중첩 틱 2배 · 2페이즈 전 강타는 걸지 않음), 저주 중첩 피해, 빙결 누적, 연속 기절, 반격(턴 해석기 실경로 · 반격 없는 보스 · 반격 자세 로그), 회복(상한), 브레스(주기 · 예고 · 기절로 넘김 · 행동 수), 소환(다음 행동부터 · 처치), 장기전 손해(+5% · 상한), 장기전 보상(정산 실경로), 대량 초회(×10), 저항 무력화(상태 · 원소 저항), 예고(확률 높은 쪽 · 같으면 맹공 · 3페이즈 임박 · 예보 칸), 유물 보상(약속한 보스만 · 계열 먼저), 계열 보너스 장비(`processLoot` 실경로).
- 기존 테스트 갱신: 데이터 모양(`mechanics` 필드 · 페이즈 `pierceResist` · `BossMechanics` 키 집합), 몬스터 게임 데이터 값 해시 3곳 재고정(의도된 데이터 변경).
- 결함 주입 49종이 모두 red였다(페이즈 · 예고 6 · 누적 · 기절 7 · 반격 · 회복 · 브레스 8 · 소환 · 장기전 · 무력화 9 · 보상 5 · 데이터 14). 처음에 3종이 green이었다 — 2페이즈 전 강타 판정(테스트 난수가 방어로 빠져 강타가 없었다) · 회복 상한(최대 생명에서 시작해 넘칠 일이 없었다) · 원소 저항 무력화(검사하지 않았다). 테스트를 강화한 뒤 red를 확인했다.
- 성장 시뮬레이터는 `enemyAttack`을 쓰지 않아 기준 리포트 · 골든이 그대로다. 증빙 8종(도달 비용 · 탐험 리듬 · 진단 · 장비 전투력 · 유물 4종)은 소스 해시만 다시 썼고, 도달 비용 리포트에는 호수 수호신이 새 무기 2종의 드롭 공급원으로 더해졌다. 추적 증빙 verify 15종 ok.

### 59.5 후속 측정 — 보스 22종 1:1 대결 (측정만, 코드 변경 없음)

**왜 했나.** §59.3의 자연 플레이 드라이버는 보스 7종의 경로를 지나지 않아 그 기믹이 발생 0이었다. 그래서 보스마다 같은 조건으로 직접 붙여 Wave 59 기믹이 실제 전투를 얼마나 바꾸는지 쟀다.

**방법.**
- 플레이어: 자연 플레이 드라이버(5경로 × 16시드 × 계승 4회, 같은 코드 `4cde2489`)가 Lv7 · 20 · 25 · 28 · 34 · 35 · 36 · 38 · 44 · 48에 처음 닿은 순간의 스냅숏(경로당 640개). 대결에는 1회차와 4회차 스냅숏을 쓴다.
- 보스: 그 지역 레벨 이하 가장 높은 스냅숏을 쓴다. Lv48 넘는 지역(55 · 65 · 68 · 70 · 73, 심연 = Lv70 · 40층 돌파)은 Lv48 스냅숏을 `applyExpGain`으로 그 레벨까지 올린다(장비는 Lv48 그대로).
- 전투: `forceAreaBoss` 스폰 → `applyBattleStartRelics` → 실제 턴 해석기(`resolveCombatActionTurn` · `resolveCombatItemTurn`).
- 정책 `kit`: 생명 30% 미만이면 물약, 50% 미만이면 회복 · 흡수 기술, 강화 · 약화 기술은 한 번씩, 그 밖에는 가장 센 피해 기술, 아니면 공격. 최대 150턴.
- 조건: 전투 시작 생명 100%(쉬고 도전)와 40%(사냥 중 만남). 보스 22 × 경로 5 × 회차 2 × 시드 16 × 전투 시드 3 = 버전당 조건마다 10,560판(보스당 480판).
- 비교: Wave 58(`1768c7ca`) ↔ Wave 59(`4cde2489`). 같은 스냅숏 · 같은 전투 시드로 짝지어 비교한다.

**합계.**

| 조건 | 승률 W58 → W59 | 평균 턴(W59) | 남은 생명 W58 → W59 | 2페이즈 도달(W59) |
|---|---|---|---|---|
| 생명 100% · 1회차 | 98.0 → 97.9% | 2.87 (보스별 1.6 ~ 4.8) | 90.2 → 89.9% | 31% |
| 생명 100% · 4회차 | 99.5 → 99.4% | 2.87 (1.7 ~ 3.9) | 93.7 → 93.5% | 31% |
| 생명 40% · 1회차 | 93.1 → 93.0% | 3.62 (1.8 ~ 5.5) | 62.5 → 62.5% | 29% |
| 생명 40% · 4회차 | 97.3 → 96.9% | 3.47 (1.9 ~ 4.7) | 67.2 → 66.9% | 31% |

**보스별 (생명 100% 시작, 턴 · 2페이즈 도달은 1회차, z는 짝지은 남은 생명 차이).**

| 보스 | 지역(레벨) | 턴 | 2페이즈 | 승률 % | 남은 생명 % | 생명 40% 시작 승률 % |
|---|---|---|---|---|---|---|
| 고대 호수의 수호신 | 신성한 호수(7) | 4.6→4.8 | 53→56% | r1 96→97 · r4 100→100 | r1 79→81 (z 2.1) · r4 95→96 (z 2.2) | r1 92→93 · r4 100→100 |
| 스핑크스 | 피라미드(20) | 4.1→4.0 | 50→49% | r1 99→99 · r4 100→100 | r1 84→85 (z 0.5) · r4 92→93 (z 2.0) | r1 89→91 · r4 99→99 |
| 아누비스 수호자 | 피라미드(20) | 4.1→4.1 | 52→55% | r1 97→95 · r4 100→100 | r1 82→**77 (z −4.0)** · r4 93→93 | r1 87→83 · r4 99→98 |
| 화염의 군주 | 용의 둥지(25) | 3.9→3.9 | 52→46% | r1 98→99 · r4 100→100 | r1 87→88 (z 1.8) · r4 93→93 | r1 90→91 · r4 98→98 |
| 레드 드래곤 | 용의 둥지(25) | 3.9→3.9 | 47→43% | r1 99→98 · r4 99→99 | r1 87→**84 (z −2.9)** · r4 91→89 (z −1.7) | r1 90→88 · r4 **97→92** |
| 프로토타입 제로 | 기계 폐도(28) | 3.9→3.9 | 41→47% | r1 98→98 · r4 100→100 | r1 86→87 (z 1.2) · r4 91→92 | r1 94→92 · r4 98→98 |
| 묘지기 네크론 | 저주받은 묘지(34) | 3.0→3.0 | 23→21% | r1 99→98 · r4 99→99 | r1 91→89 (z −1.3) · r4 92→92 | r1 95→95 · r4 98→96 |
| 아이스 드래곤 | 빙하 심연(35) | 2.8→3.0 | 19→19% | r1 100→100 · r4 100→100 | r1 95→94 (z −1.8) · r4 96→**94 (z −3.8)** | r1 99→99 · r4 99→99 |
| 빙결의 마녀 | 빙하 심연(35) | 2.9→3.0 | 19→20% | r1 100→100 · r4 100→100 | r1 95→94 (z −1.4) · r4 95→**94 (z −3.0)** | r1 100→98 · r4 99→99 |
| 화염 군주 이프리트 | 용암 지대(36) | 2.8→2.8 | 21→20% | r1 100→100 · r4 100→100 | r1 93→93 · r4 95→95 (z 1.5) | r1 97→98 · r4 98→100 |
| 천둥새 제피로스 | 폭풍의 고원(38) | 3.0→3.1 | 23→23% | r1 97→96 · r4 99→98 | r1 91→90 (z −1.1) · r4 93→93 | r1 93→96 · r4 98→98 |
| 원한의 용사 | 지하 미궁(44) | 2.6→2.6 | 13→13% | r1 98→98 · r4 100→100 | r1 92→92 · r4 93→93 | r1 96→95 · r4 98→98 |
| 마왕 | 마왕성(48) | 1.6→1.6 | 11→10% | r1 100→100 · r4 100→100 | r1 97→97 (z −1.6) · r4 97→97 | r1 97→96 · r4 99→99 |
| 시간의 파수꾼 | 공중 신전(48) | 1.9→2.0 | 16→16% | r1 98→98 · r4 100→100 | r1 95→94 (z −1.7) · r4 95→95 | r1 96→95 · r4 99→99 |
| 공허의 군주 | 금지된 도서관(55) | 1.9→1.9 | 27→28% | r1 97→97 · r4 99→99 | r1 90→89 (z −1.7) · r4 93→93 | r1 91→90 · r4 97→96 |
| 에테르 심판자 | 에테르 폐허(65) | 2.1→2.1 | 35→34% | r1 96→96 · r4 99→99 | r1 90→90 (z 1.4) · r4 93→93 | r1 90→91 · r4 93→93 |
| 차원 파쇄자 | 에테르 관문(68) | 1.9→1.9 | 30→30% | r1 100→100 · r4 100→100 | r1 97→98 (z 1.9) · r4 98→98 | r1 97→98 · r4 100→99 |
| 영겁의 수문장 | 에테르 관문(68) | 1.8→2.1 | 24→24% | r1 100→100 · r4 100→99 | r1 97→96 (z −2.1) · r4 98→**96 (z −2.8)** | r1 96→96 · r4 98→98 |
| 에테르 드래곤 | 에테르 관문(68) | 1.8→1.9 | 25→25% | r1 100→100 · r4 100→100 | r1 97→97 · r4 96→96 (z 1.3) | r1 97→98 · r4 98→99 |
| 공허의 대행자 | 공허의 회랑(70) | 2.4→2.4 | 37→36% | r1 97→97 · r4 99→99 | r1 89→89 · r4 92→93 (z 1.1) | r1 89→88 · r4 94→93 |
| 원시의 신 | 혼돈의 심연(Lv70 · 40층) | 2.9→2.9 | 39→34% | r1 95→95 · r4 97→95 | r1 84→85 (z 0.9) · r4 88→88 | r1 85→85 · r4 90→91 |
| 종말의 기사 | 종말의 전장(73) | 2.5→2.5 | 40→40% | r1 96→96 · r4 99→99 | r1 87→87 · r4 91→91 (z 0.8) | r1 88→88 · r4 94→93 |

(|z| < 1인 칸은 z를 생략했다.)

**기믹 발생 (Wave 59, 생명 100% · 1회차, 전투당 횟수).**
- 레드 드래곤 브레스 0.67 · 아이스 드래곤 반격 자세 0.66 · 반격 0.09 · 냉기 누적 0.09.
- 호수 수호신 회복 0.35 · 냉기 누적 0.30 · 행동 불가 0.56.
- 네크론 망자 소환 0.22 · 망자 공격 0.10 · 망자 처치 0.03.
- 연속 기절: 시간의 파수꾼 0.07 · 제피로스 0.09 · 영겁의 수문장 0.04.
- 화상 · 독 중첩 상승 0.05 ~ 0.14.
- **장기전 손해(8번째 행동 뒤)는 0.00**이다. 8턴 넘게 가는 전투가 보스별 0 ~ 5.6%(호수 수호신)이고, 대부분 3% 미만이다. 중앙값은 1 ~ 4턴이다(마왕 · 시간의 파수꾼은 1턴).

**판단 재료.**
1. **Wave 59 기믹은 결과를 거의 바꾸지 않는다.** 승률 변화는 생명 100% 시작에서 −2 ~ +1pp, 40% 시작에서 −5 ~ +3pp다(최대 하락은 레드 드래곤 4회차 −5pp · 아누비스 1회차 −4pp). 남은 생명이 유의하게 줄어든 곳은 아누비스(−5pp) · 레드 드래곤(−3pp) · 아이스 드래곤 · 빙결의 마녀 · 영겁의 수문장(−1 ~ −2pp)이다. 기믹이 틀린 것이 아니다. 보스가 기믹을 보일 만큼 오래 살지 못한다. 2페이즈(생명 50%)에 닿는 전투가 10 ~ 56%이고, 닿아도 1 ~ 2턴 뒤 끝난다.
2. **보스는 게이트 레벨의 자연 플레이어에게 약하다.** 생명 100%로 도전하면 22종 모두 95 ~ 100%를 이기고 생명의 77 ~ 98%를 남긴다(40% 시작이면 52 ~ 71%). Lv48 이후 지역(55 ~ 73) 보스도 Lv48 장비로 2 ~ 3턴이다. 플레이어를 이만큼 키우는 것은 정수 사다리 · 장비 · 유물이다(§32 · §37 · §56).
3. **보스 사망은 깎인 생명으로 만날 때 나온다.** Wave 59 자연 플레이(5경로 48시드) 사망 1,078건 중 보스는 101건(9.4%)이다. 정예 367건(34.0%), 일반 610건(56.6%)이다. 40% 시작 조건에서 승률이 1회차 93%로 내려가는 것과 맞다. 보스전 위험의 주된 원천은 기믹이 아니라 진입 생명이다.

**소유자 판단 거리.** 보스전의 길이(보스 생명)를 늘려 기믹이 보이게 할 것인가. 이는 적 수치 변경이다. 소유자 원칙("난이도 차이를 적 · 기술 수치 보정으로 메우지 않는다", §53.1)과 Wave 40 "더 하드하게"의 경계에 걸린다. 그래서 측정만 하고 코드는 바꾸지 않았다.

측정 도구는 저장소 밖 스크래치다. `duel59.mjs`(대결 하네스), `duelcmp.mjs`(짝 비교), 드라이버 스냅숏 훅(`SNAPSHOT_DIR`, 미설정 시 바이트 동일)이다.

## 60. Wave 60 — 소유자 결정: 보스별 고정 생명 상향 (2026-10-01, 베이스 = `main` `ee908486` = PR #93 머지, 코드는 Wave 59와 같다)

### 60.1 대상과 소유자 답

§59.5의 결론은 보스가 너무 짧다는 것이었다. 그 지역 레벨에 막 닿은 자연 플레이어에게 보스 22종이 평균 2.9턴에 쓰러졌다. 2페이즈(생명 50%)에 닿는 전투는 31%, 장기전 손해(8번째 행동 뒤)는 0이었다 — Wave 59 기믹이 보이기 전에 끝났다.

소유자에게 네 가지를 물었다(현행 유지 · 보스별 고정 생명 상향 · 플레이어 화력에 맞춰 조절 · 기믹 시점만 앞당김). 답은 **보스별 고정 생명 상향**이다. 화력 연동은 사냥 · 장비 성장의 의미를 지우므로 소유자 원칙(§53.1)과 충돌한다고 적어 두었다.

### 60.2 보정 방법

- 대결 하네스: §59.5와 같다(자연 플레이 스냅숏 5경로 × 16시드 × 1 · 4회차, 실제 턴 해석기, `kit` 정책, 보스당 480판). 스폰 뒤 보스 생명에 배율 k를 곱하는 탐침(`BOSS_HP_K`)만 더했다.
- 목표: 생명 100% 시작에서 중앙값 6 ~ 8턴.
- 1차: k = 7 / 평균 턴. 생명을 1.6 ~ 4.2배 늘렸지만 평균 턴은 2.9 → 3.9였다. 후반 플레이어의 피해가 한 턴에 몰려(치명 · 다단 · 강화) 턴이 생명에 비례해 늘지 않는다. 마왕은 4.15배에서도 하위 10%가 1턴이었다.
- 2차 · 3차: 두 점으로 턴 = a + 기울기 × k를 맞춰 평균 7(2차) · 6.5(3차, 평균 6.3 미만 보스만)를 겨냥했다. 3차 값을 데이터에 굽고 소수 첫째 자리로 반올림했다.
- 진 보스(마왕 처치 정산의 원시의 신, `buildTrueBoss` = 8,000 × hpMult)는 같은 배율을 읽는다. 계승 3단계 Lv48 스냅숏(4회차)과 따로 붙였다: 보정 전 17,600은 중앙값 3턴 · 승률 99.6%, 보정 뒤(×7.5)는 중앙값 7턴 · 승률 96%. 두 경로가 같은 값으로 목표에 닿아 분리하지 않았다.

### 60.3 바꾼 값 (`src/data/monsters.ts` `hpMult`)

| 보스 | 이전 → 이후 (배율) | 보스 | 이전 → 이후 (배율) |
|---|---|---|---|
| 고대 호수의 수호신 | 1.45 → 3.6 (×2.5) | 마왕 | 1.6 → 39.2 (×24.5) |
| 스핑크스 | 1.32 → 5.0 (×3.8) | 시간의 파수꾼 | 1.8 → 35.6 (×19.8) |
| 아누비스 수호자 | 1.34 → 5.4 (×4.0) | 공허의 군주 | 2.0 → 35.0 (×17.5) |
| 화염의 군주 | 1.35 → 5.4 (×4.0) | 차원 파쇄자 | 1.5 → 27.0 (×18.0) |
| 레드 드래곤 | 1.5 → 6.0 (×4.0) | 에테르 드래곤 | 1.62 → 25.5 (×15.7) |
| 프로토타입 제로 | 1.85 → 6.5 (×3.5) | 영겁의 수문장 | 1.45 → 20.3 (×14.0) |
| 묘지기 네크론 | 1.9 → 12.8 (×6.7) | 원한의 용사 | 1.9 → 25.2 (×13.3) |
| 아이스 드래곤 | 1.45 → 9.4 (×6.5) | 에테르 심판자 | 2.2 → 28.1 (×12.8) |
| 빙결의 마녀 | 1.3 → 9.8 (×7.5) | 공허의 대행자 | 2.4 → 29.4 (×12.3) |
| 화염 군주 이프리트 | 2.0 → 17.5 (×8.8) | 종말의 기사 | 2.5 → 26.9 (×10.8) |
| 천둥새 제피로스 | 2.1 → 13.7 (×6.5) | 원시의 신 | 2.2 → 16.5 (×7.5) |

배율이 레벨을 따라 커진다. 플레이어 화력이 정수 사다리 · 장비 · 유물로 레벨보다 빨리 크기 때문이다(§32 · §37 · §56). 다른 몬스터 · 공격력 · 보상은 그대로다.

### 60.4 대결 측정 (Wave 59 ↔ Wave 60, 같은 스냅숏 · 같은 전투 시드)

| 보스 | 중앙값 턴 | 2페이즈 도달 | 승률(생명 100%) | 남은 생명 | 승률(생명 40%) |
|---|---|---|---|---|---|
| 고대 호수의 수호신 | 4→6 | 48→83% | 98→97% | 88→78% | 97→91% |
| 스핑크스 | 4→6 | 44→79% | 100→96% | 89→79% | 95→90% |
| 아누비스 수호자 | 4→6 | 44→78% | 98→95% | 85→76% | 90→86% |
| 화염의 군주 | 4→6 | 42→84% | 99→95% | 90→78% | 94→90% |
| 레드 드래곤 | 4→6 | 39→84% | 99→94% | 87→72% | 90→83% |
| 프로토타입 제로 | 4→6 | 45→83% | 99→97% | 89→75% | 95→86% |
| 묘지기 네크론 | 3→5 | 26→73% | 98→93% | 91→77% | 96→86% |
| 아이스 드래곤 | 3→6 | 25→71% | 100→98% | 94→83% | 99→94% |
| 빙결의 마녀 | 3→5 | 23→74% | 100→97% | 94→83% | 99→93% |
| 화염 군주 이프리트 | 3→5 | 22→76% | 100→98% | 94→83% | 99→93% |
| 천둥새 제피로스 | 3→6 | 25→70% | 97→94% | 92→80% | 97→88% |
| 원한의 용사 | 2→5 | 17→77% | 99→94% | 92→79% | 97→89% |
| 마왕 | 1→6 | 15→77% | 100→99% | 97→89% | 98→96% |
| 시간의 파수꾼 | 1→6 | 19→75% | 99→96% | 94→83% | 97→91% |
| 공허의 군주 | 2→6 | 28→74% | 98→92% | 91→73% | 93→84% |
| 에테르 심판자 | 2→6 | 32→77% | 98→94% | 92→76% | 92→86% |
| 차원 파쇄자 | 2→6 | 33→77% | 100→99% | 98→91% | 99→96% |
| 영겁의 수문장 | 2→6 | 28→74% | 99→99% | 96→88% | 97→93% |
| 에테르 드래곤 | 2→6 | 31→80% | 100→98% | 97→86% | 98→93% |
| 공허의 대행자 | 2→6 | 34→74% | 98→95% | 91→76% | 90→83% |
| 원시의 신 | 2→6 | 31→75% | 95→90% | 86→69% | 88→79% |
| 종말의 기사 | 2→6 | 34→75% | 98→93% | 89→70% | 91→81% |
| **합계** | **2→6** | **31→77%** | **99→96%** | **92→79%** | **95→89%** |

- 3페이즈 보스 6종의 3페이즈 도달은 44 ~ 51%다.
- 경로별 중앙값 턴 · 승률(생명 100%): 나이트 4→7 · 98→96%, 버서커 4→6 · 98→97%, 팔라딘 3→7 · 99→95%, 시간술사 2→5 · 99→91%, 어쌔신 2→4 · 99→98%. 생명 40% 시작 승률은 시간술사가 93→79%로 가장 많이 내려갔다(마왕 92→81%).
- 시간의 파수꾼은 시간술사만 만난다(숨은 보스). 그 경로만 보면 중앙값 6턴 · 승률 85%다.
- 전투당 기믹 발생이 늘었다(1 · 4회차 합친 값): 레드 드래곤 브레스 0.64 → 1.53, 아이스 드래곤 반격 0.12 → 0.71, 네크론 망자 소환 0.27 → 0.74, 호수 수호신 회복 0.31 → 0.92, 스핑크스 장기전 손해 0.00 → 0.09.

### 60.5 자연 플레이 측정 (5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 59 = `w59impl`)

| 경로 | 시드당 사망 | 보스전 사망 | 4회 합계 모델 시간 | 4회 합계 행동 수(전투 턴 포함) |
|---|---|---|---|---|
| 전사 > 나이트 | 3.67 → 4.48 (z 1.9) | 0.13 → 0.75 (z 4.5) | 214.2 → 222.5h (z 1.8) | 35,996 → 38,089 (z 2.9) |
| 전사 > 버서커 | 5.35 → 5.73 (z 0.7) | 0.38 → 0.79 (z 2.7) | 235.4 → 245.6h (z 1.7) | 38,464 → 39,975 (z 1.8) |
| 마법사 > 무당 > 시간술사 | 3.73 → 4.35 (z 1.5) | 0.23 → 1.38 (z 6.5) | 227.9 → 252.4h (z 4.0) | 34,934 → 38,552 (z 4.4) |
| 도적 > 어쌔신 > 그림자 주군 | 2.94 → 2.92 (z 0.0) | 0.00 → 0.27 (z 3.5) | 198.1 → 202.2h (z 2.2) | 31,402 → 32,239 (z 1.9) |
| 마법사 > 성직자 > 팔라딘 | 6.77 → 7.63 (z 1.6) | 0.42 → 1.54 (z 5.9) | 221.4 → 231.5h (z 2.1) | 40,777 → 42,807 (z 2.7) |

- 위반 0, 타임아웃 0. **전체 사망은 경로마다 유의하지 않게 늘었고(|z| ≤ 1.9), 보스전 사망은 모든 경로에서 유의하게 늘었다.**
- 사망 1,078 → 1,205건. 보스 101 → 269건(9.4 → 22.3%), 정예 367 → 363, 일반 610 → 573. 보스가 다른 사망을 일부 대신했다.
- 보스별 사망(5경로 합, Wave 59 → 60): 아이스 드래곤 27 → 89 · 빙결의 마녀 18 → 70 · 화염 군주 이프리트 3 → 34 · 마왕 7 → 33. 빙하 심연(Lv35)은 조우 5종 중 2종이 이 보스라 사냥 중 깎인 생명으로 자주 만난다.
- **시간술사가 가장 많이 늘었다** — 1회차 모델 시간 73.8 → 92.4h(z 3.6), 마왕전 사망 5 → 25. 생명이 적은 직업이 마왕성(조우의 4분의 1이 마왕)에서 긴 전투를 견디지 못한다.
- 모델 시간(탐험 × 90초)은 전투 턴을 세지 않는다. 늘어난 시간은 사망 → 재시작 몫이다. 전투 턴까지 센 행동 수는 경로별 +3 ~ +10%다.
- 기믹 발생(5경로 합, Wave 59 → 60): 반격 자세 2,302 → 6,100 · 반격 447 → 4,024 · 냉기 누적 812 → 3,374 · 냉기로 얼어붙음 50 → 414 · 중첩 상승 104 → 386 · 3페이즈 371 → 1,941.
- 성장 시뮬레이터 · 진단 증빙은 행동 = 처치 1회라 보스 생명을 읽지 않는다. 기준 리포트 · 골든 · `reportHash`(탐험 리듬 `0818fb7a`)가 그대로이고 증빙은 소스 해시만 다시 썼다.

### 60.6 테스트 · 결함 주입 · 증빙

- 새 `tests/boss-fight-length-contract.test.js` (3):
  - 브리핑 보스 22종 전원이 자기 지역 일반 몬스터 최대 배율의 3배 이상이다. 보정 전에는 22종 모두 2.2배 미만, 보정 뒤 최소는 호수 수호신 3.05배다.
  - 스폰 경로(`spawnEnemy`)의 보스 생명 = 기본 생명 × 데이터 배율.
  - 진 보스 생명 = 8,000 × 원시의 신 배율(> 보정 전 17,600).
- 결함 주입 4종이 모두 red였다: 빙결의 마녀 되돌림 · 호수 수호신 되돌림 · 스폰이 보스 배율을 건너뜀 · 진 보스 고정 생명.
- 기존 테스트 갱신: 몬스터 게임 데이터 값 해시 3곳 재고정(의도된 데이터 변경).
- 증빙: 탐험 리듬 · 진단 두 종의 소스 해시만 바뀌었다. 추적 증빙 verify 15종 ok.

### 60.7 남은 판단 거리 → 소유자 답: 현행 유지 (2026-10-02)

시간술사의 마왕전 사망 증가에 대해 소유자는 **마왕 ×24.5 유지**를 골랐다. 근거: 시간술사의 선언된 약점(자가 회복 없음)과 강점(순간 이동 100% 이탈)에 맞고, 경로 난이도를 적 수치로 메우지 않는다는 원칙(§53.1)과 같다. 측정 드라이버는 이탈 기술을 쓰지 않으므로 측정한 마왕전 사망은 상한이다.

아래는 측정 당시의 기록이다.


- 시간술사의 마왕전(생명 40% 시작 승률 81%, 자연 플레이 마왕전 사망 5배). 마왕 배율을 경로 하나에 맞춰 낮출지는 소유자 판단이다. 직업 약점(낮은 생명, Wave 42 · 43)이 의도대로 드러난 결과로도 읽힌다.
- 측정 도구는 저장소 밖 스크래치다: `duel60.mjs`(대결 · `BOSS_HP_K` 탐침 · `TRUE_BOSS` 모드), `runk.sh`(보정 병렬 실행), `calsum.mjs`(보스별 요약), `w60cmp.mjs`(자연 플레이 비교).

## 61. 감사 4회차 — 남은 설명 표면 (2026-10-02, 베이스 `main` `e87c7fa7` = PR #94 머지, 측정만 · 코드 변경 없음)

### 61.1 범위와 방법

앞선 감사가 다룬 곳(기술 §54 · §55, 유물 · 조합 · 장비 효과 §56 · §57, 메타 · 계승 · 업적 · 장비 부가 §58, 보스 §59 · §60)을 뺀 다섯 영역을 읽기 전용 감사 에이전트 다섯이 나눠 봤다.

| 영역 | 대상 |
|---|---|
| 임무 · 일과 | 임무 143 · 현상수배(Lv1 ~ 99, 대상 83종) · 일일 3 · 주간 3 · 임무 관련 `MSG` 약 30 |
| 이야기 · 이벤트 | 이벤트 체인 13 × 3단계(결과 84) · 폴백 이벤트 161(결과 474 생성) · 한정 조우 8 · 정찰 · 모닥불 · 보스 게이지 카드 · 전투 후 카드 |
| 소모품 · 제작 · 상점 | 소모품 17 + 접두어 변형 49 · 제작법 60 · 가방 5 · 합성 · 강화 · 상점 · 크리스털 교환 · 빠른 슬롯 |
| 칭호 · 시즌 · 도감 · 도전 조건 | 칭호 70 · 시즌 보상 120 · 도감 마일스톤 26 · 도전 조건 6 · 계승 마일스톤 · 거울(§58 밖) · 연속 처치 · 심연 다이브 · 첫 방문 51 |
| 지역 · 몬스터 · 안내 | 지역 52(설명 · 이야기 · 배지) · 몬스터 도감 254 · 전리품 표 119 · 소재 56 · 안전지대 상점 6 · 안내 분기 약 30 · 예고 |

각 항목은 엔진 경로를 끝까지 읽고, 표시가 있는 것은 실제 리듀서 · 해석기 · 정적 렌더를 node로 돌려 확인했다. 분류: **A** = 엔진 결함(문구가 분명한 의도) · **B** = 문구가 틀림 · **C** = 소유자 판단. 괄호의 +/−/0은 "설명대로 구현하면 플레이어가 강해짐 / 약해짐 / 중립".

일치한 것(요약): 임무 보상 아이템 · 칭호 · 목표 수 · 장소 · 경험치 표시 / 일일 · 주간 보상 / 한정 조우 수치 / 물약 회복량 · 해제 대상 · 버프 % · 턴 / 강화 · 합성 확률 · 비용 · 실패 문구 / 할인 · 판매가 · 가방 제작 / 칭호 효과 56/56 · 시즌 보상 120 · 도감 보상 26 / 계승 마일스톤 · 거울(§58 밖) / 첫 방문 금액 51/51 / 원소 배율 · 약점 · 저항 · 연구 보너스 · 휴식 · 모닥불 수치 · 게이지 속도 · 예고 확률.

### 61.2 결함 (A)

| ID | 무엇 | 근거 | 방향 |
|---|---|---|---|
| A1 | ~~진 엔딩 우회~~ → **결함 아님(정정)** — 혼돈의 심연 구역 보스 원시의 신을 잡으면 계승 단계 · 파편 없이 진 엔딩이 열린다(재현). 그러나 이것은 의도된 두 번째 경로다: 커밋 `308682cf`(2026-09-28)가 "혼돈의 심연 구역 보스 경로는 별도로 존재한다 … 전투 gate를 임의 강화하지 않는다"로 확인했고, 브리핑 · 도감이 두 경로를 구분하며, `journey-clarity` 테스트가 "진입 경로와 무관하게" 진 엔딩 기록을 고정한다. "파편 3개 + 마왕" 문구는 마왕성 경로의 설명이다 | — | — |
| A2 | **나오지 않는 보스 6종** — `bossMonsters`에만 있고 조우 풀 · 구역 보스가 아니다: 프로토타입 제로(기계 폐도) · 에테르 심판자(에테르 폐허) · 공허의 대행자(공허의 회랑) · 봄의 여왕 · 서리 군주 · 무한의 화신(에테르 관문 목록, 실제로는 심연 50층 보스). 지역당 6,000회 · 허공의 눈 · 계승 10에서도 0. 결과: 임무 109 · 150 완료 불가, 도감 254 · 지역 탐험 완료 불가, 전설 각인 안내(세계수의 지팡이 · 빙결의 왕관검)가 거짓. Wave 56(허공의 눈 가중치만)이 마지막 출현 경로를 닫았다. 도달 비용 리포트는 `bossMonsters`를 출현 경로로 세서 못 잡았다 | `exploreUtils.ts:82-121`, `contentReachability.ts:364-368` | 고치는 방향은 C |
| A3 | **혼돈의 심연이 UI에서 영구 잠김** — 이동 버튼 · 경로 · 안내가 "레벨 N 필요"(언제나 현재 레벨 + 8 이상), 엔진은 잠금 없음(터미널 `move`로만 들어감) | `mapTopology.ts:11-12` vs `mapAccess.ts:17-21` | + |
| A4 | **적 턴 처치 · 소모품 처치에서 승리 부수효과가 빠진다** — 지속 피해 틱 · 반격 · 전투 소모품으로 끝난 승리는 `extendedChecks: false`라 구역 보스 처치 기록 · 시즌 XP(처치 +5 · 보스 +50) · 처치 수 마일스톤(정확히 N에서만 판정 — 영구 누락) · 전투 기록(낮은 생명 승리 임무) · 공허의 신 보상을 건너뛴다. Wave 60으로 보스전이 길어져 지속 피해 처치가 늘었다 | `combatVictory.ts:175, 254-307`, `combatActionTurn.ts:288`, `combatHandlers.ts:398` | + |
| A5 | 낮은 생명 승리 임무(62 · 63 · 75)가 최근 50전 창만 읽는다 — 낮은 생명 3승 → 일반 50승 → 2승 = 5승인데 3/5 | `DifficultyManager.ts:197-211` | + |
| A6 | 발견 지역 임무(72 · 201)가 시작 마을을 센다 — 업적은 Wave 58에서 뺐다 | `cumulativeQuestProgress.ts:24` | − |
| A7 | 현상수배가 열쇠 지역(고대 보물고) 전용 몬스터(황금 골렘 · 보물사냥꾼 · 미믹)를 대상으로 고른다(Lv35에서 16종 중 3종) | `questHandlers.ts:47-60` | + |
| A8 | 도감이 접두어 사본을 따로 세고 바탕 장비는 등록하지 않는다 — 강철 롱소드 접두어 6개로 "무기 수집가 I", 정작 강철 롱소드는 미발견, n/117이 넘친다 | `gameUtils.ts:197-209` | − |
| A9 | 도전 조건 '약한 생명력'이 시작 때 한 번만 절반 — 레벨업은 전체량, 첫 전직에서 사라진다(Lv10 전직 뒤 390 = 전체) | `runStart.ts:52-53`, `_shared.ts:49` | − |
| A10 | 도전 조건 '맹목'이 위치를 드러낸다 — 이동 로그 · 첫 방문 · 지역 설명 · 원정 배너 · 터미널 `상태`/`지도` · 지역 그림 | `moveActions.ts:83-115`, `commandParser.ts:123-146` | − |
| A11 | 공허의 신 처치 칭호가 효과 없는 문자열 '허무의 정복자'로 하나 더 붙는다(진짜는 `void_conqueror`) | `combatVictory.ts:303-307` | 0 |
| A12 | 이야기 '생명/기력 +N'이 저장 최대치로 잘라 현재 생명을 깎는다(1310 → 1180) — Wave 56 회복 상한 규칙 위반, 결과 7개 | `eventActions.ts:204-213` | + |
| A13 | 이야기 생명 · 기력 보너스가 전직 때 사라진다(공격 · 방어는 남는다) | `characterActions.ts:253-268` | + |
| A14 | 이야기 '공격력 +N'이 직업 · 세트 배율 안에 들어간다("+15" → +18 ~ +35) — Wave 58 규칙(+N은 배율 뒤), 결과 10개 | `eventActions.ts:202-206` | − |
| A15 | 용의 유산 1단계 선택 2 "용의 비늘 하나를 줬습니다" — 보상 없음(아이템은 DB에 있다) | `eventChains.ts:338` | + |
| A16 | "1+2+…+10 = ?" 퍼즐 선택지 '45' · '50' · '55'가 숫자 제거로 "선택지 1/2/3"이 되고 미리보기가 답을 알려 준다 | `aiEventUtils.ts:40-43` | 0 |
| A17 | 이야기 골드 지불(최후의 영웅 300 · 그림자 길드 2,000)이 일일 '골드 소비'에 안 잡힌다 — Wave 58 규칙 | `chainEventHandlers.ts` | + |
| A18 | 합성 보호가 숨은 토글로 계속 차감 — 보호 합성 한 번 뒤 100% 합성에서도 크리스털 30(50 → 20) | `CraftingPanel.tsx:39-62, 212` | + |
| A19 | 휴식 추천이 기본 비용 60으로 판단(실제 60 × (1 + Lv/20) × 거울) — Lv40 골드 100에서 추천 → 거부 | `adventureGuide.ts:593` | 0 |
| A20 | 제작 임무 진행도가 제작 직후 갱신되지 않는다(다음 탐험 · 전투까지 수령 버튼 없음) | `economyHandlers.ts:145-187` | + |

### 61.3 문구 (B) — 동작이 맞고 문구가 틀림

- 임무: 보상 요약에 칭호 누락(152 · 153 · 154 · 201 · 202) · 현상수배 포기 "오늘은 새 현상수배를 받을 수 없습니다"(Wave 32 이후 거짓) · 96 목적지 에테르 관문(무한의 화신은 심연 50층) · 3 제목 '광산의 위협'(코볼트는 광산에 없다) · 130 "다시 한번"(goal 3) · 누적형 23개에 '누적' 표기 없음 · 202 'signature' 영어 · 안내 "일반 몬스터 N회"(보스 포함).
- 이야기 · 이벤트: 전투 보너스 문구 · 버프 이름이 '최후의 영웅'으로 고정(다른 체인 2곳) · 체인 실패 선택지 3개가 "이야기 진행"으로 미리보기(영구 실패) · 일반 이벤트 미리보기가 생명 손실 25건을 숨김 · '밀어붙인다'가 보스 게이지 조건 · 다음 모닥불 차단을 말하지 않음 · 서사 잔재(봉인석 · 검 · 시험 번호 · "이번 전투" · 적용 안 되는 대가 5건) · 회복 로그가 상한에 잘려도 명목치.
- 소모품 · 상점: 엘릭서 표시 "생명 +9999" · 접두어 엘릭서 "HP+10006"(엔진은 Wave 58 완전 회복) · 터미널 "휴식 100G" · 상점 상태 해제가 원문 ID("poison 해제") · 재료 · 열쇠의 '사용' 버튼이 무반응 · 영웅의 물약 "ALL"(공격 · 방어만) · 합성 보호 아이템 이름 셋.
- 도감 · 지역: **획득처 · 획득 가능 아이템이 엔진이 쓰지 않는 레거시 표를 읽는다**(몬스터 28/80 · 소재 20/56 틀림, 전설 각인 26개 숨김) · 소재 "골드 가격"(살 수 없다) · "조우한 생물"(처치 기록) · '이벤트↑' 배지가 원시 확률로 계산(배지 지도 10곳이 무배지 3곳보다 낮다) · 보스가 못 나오는 지도에 보스 표시 · 서사 잔재(번개 결정체 · 수리 · 포로 구출) · 난이도 문구가 보상 감소를 말하지 않음 · 변방 밴드 "레벨 1~10"(Lv15 포함).
- 칭호 · 시즌: 연속 처치 로그가 치명 보너스 누락 · 시즌 2부터 이미 가진 칭호를 '새 칭호'로 표시 · rank 11+ '새 칭호 에테르의 신' 반복 · '정예만' 문구에 보스 제외 없음.

### 61.4 소유자 판단 (C)

설명대로 구현하면 **강해지는** 것:
- C1 도전 보상 문구 "+20% / +50% / +100% / +150%" vs 엔진 ×1 / ×1 / ×1.5 / ×2(전투 골드 · 경험치만).
- C2 이야기 보상 "영구" — 실제는 이번 여정(사망 · 계승에서 사라지고 체인은 다시 못 한다).
- C3 "전설의 유물" 약속 5곳 · "용의 심장 유물" — 실제는 모든 등급(전설 약 4.6%).
- C4 유물 칸이 가득 차면 약속 유물이 조용히 사라진다(정찰 정예 카드 · 이벤트 "유물 선택지가 열림") — 체인 · 보스 보상은 교체를 제안한다(Wave 27 N2 규칙에 가깝다).
- C5 보스 게이지 "회피 — 계속 나아간다" — 실제로는 다음 탐험마다 같은 카드(그 지역 사냥 · 임무 진행이 막힌다).
- C6 버프 덮어쓰기 — 물약("ATK 30% 증가") · 모닥불 단련 · 밀어붙인다 · 이야기 전투 보너스가 강화 칸 하나를 덮어써 더 센 강화를 지운다(345 → 235), 전쟁의 북이 전투 시작에 덮어쓴다.
- C7 유료 부활석이 무료 부활(불사조의 깃털 · 거울)보다 먼저 쓰인다.
- C8 제작 · 합성이 같은 이름의 강화된 사본(+5)을 먼저 쓴다.
- C9 종말의 기사 "3회 처치" — 구역 보스라 한 런에 1회만.
- C10 임무 200 "새 칭호 획득" — 칭호 없음.
- C11 첫 방문 "처음" 보상 — 사망 재시작마다 다시 받고, 계승 뒤에는 못 받는다.
- C12 현상수배 "현재 레벨 기준" — Lv69+에서 대상이 없어 슬라임(보상은 Lv 비례).
- C13 기계 반란 "전투에서 도움" — 아무것도 없다(골드 3,000만).
- C14 허공의 섬 "이곳에서만 구할 수 있는" — 독점 상품 없음.
- C15 '무작위 기술' 도전 — 같은 기술이 뽑히고, 실패하면 비용 없이 다시 굴린다(비용을 매기면 약해짐).

설명대로 구현하면 **약해지는** 것:
- C16 도전 '빈손의 시작' "얻는 골드도 절반" — 전투 골드만 절반.
- C17 심연 신호 "50층" — 층 조건 없음(1층에서도 진행).
- C18 도박 · 추측 퍼즐 · 카드 "세 장 중 한 장" — 결과가 확정이고 미리보기가 보여 준다(카드는 2/3 지급).
- C19 잃어버린 마법사 3단계 "전투를 받아들인다" — 전투 없이 보상.
- C20 북부 요새 "(Tier 3 상점)"(실제 5) · 황금 왕국 "물가가 높지만"(가격 보정 없음).

그 밖: 같은 이름 칭호 5쌍(초월자 · 영겁의 존재 · 허공의 지배자 · 지도 제작자 · 전설의 기록자 — 임무 201 · 202가 이미 가진 칭호를 '새 칭호'로 준다) · 낮은 생명 승리 판정 시점(처치 회복 뒤 · 저장 최대치 기준, 동적 난이도의 입력이기도 하다) · 심연 데일리 다이브가 적 출현 때 소모(도주 · 사망에도) · 도감 "발견한 장비"에 임무 · 이벤트 보상 미포함.

### 61.5 미확인 · 관찰

- 이벤트 버프끼리 무조건 덮어쓴다(물약만 `isDominatedByCurrentBuff` 가드가 있다) — C6과 같은 뿌리.
- 손으로 쓴 2지선다 폴백 이벤트 12개에 일반 셋째 선택지가 붙고 그 보상이 손으로 쓴 보상보다 크다(Wave 27 N1과 같은 종류).
- 그림자 길드 유물 지급이 실효 최대치 내리기를 거치지 않는다(빌드 성향 변화 미확인).
- 묘비 침공 성공 확률 표시가 저장 공격력 기준(기능이 프로덕션에서 꺼져 있다).
- 예고의 "약점" 표시가 기술 `type`만 본다(무기 원소를 쓰는 기술 24개는 표시가 빠진다 — 거짓 주장은 아니다).

### 61.6 소유자 답 (2026-10-02)

| 질문 | 답 |
|---|---|
| 나오지 않는 보스 6종(A2) | **지역 조우에 넣는다** — 그 지역 `monsters`에 더한다. 무한의 화신은 심연 50층 전용이라 에테르 관문 목록에서만 뺀다 |
| 도전 조건(C1 · C15 · C16 · A9 · A10) | **전부 설명대로** — 보상 +20 / 50 / 100 / 150%, 모든 골드 절반, 레벨업 · 전직 뒤에도 생명 절반, 위치 완전 숨김, 실패한 무작위 기술도 턴 소모 |
| 강해지는 쪽(C2 ~ C14) | **규칙은 구현, 서사는 문구** — 구현: C3 전설 등급 보장 · C4 유물 교체 제안 · C5 게이지 회피 · C6 버프는 더 센 쪽 유지 · C7 무료 부활 먼저 · C8 강화 안 된 사본 먼저 · C9 종말의 기사 목표 1회 · C10 임무 200 칭호 · C11 첫 방문은 여정마다 · C12 고레벨 현상수배 대상. 문구: C2 '영구' → '이번 여정' · C13 기계 반란 도움 · C14 허공의 섬 독점 |
| 약해지는 쪽 서사(C17 ~ C20) | **전부 설명대로** — 심연 신호 50층 조건 · 도박 · 추측 퍼즐 · 카드를 확률로(미리보기에서 결과를 숨긴다) · 잃어버린 마법사 실제 전투 · 북부 요새 판매 등급 3 · 황금 왕국 가격 할증 |

실행 순서: **Wave 61** = 결함(A, A9 · A10 제외) + A2 + 문구(B, C 결정에 묶이지 않은 것). **Wave 62** = 도전 조건 + 강해지는 쪽 규칙 + 약해지는 쪽 서사 + 서사 문구 3건.

## 62. Wave 61 — 감사 4회차 결함 · 문구 수정 (2026-10-02, 베이스 = `main` `e87c7fa7` + 감사 4회차 원장 커밋)

### 62.1 대상과 소유자 답

- 감사 4회차(§61)의 결함(A) 중 도전 조건 2건(A9 · A10)을 뺀 전부와, 소유자 결정에 묶이지 않은 문구(B)를 고쳤다. 실행 순서는 §61.6 그대로다 — 도전 조건 · 강해지는 쪽 규칙 · 약해지는 쪽 서사 · 서사 문구 3건은 Wave 62.
- 보스 6종(A2)은 소유자 답 **"지역 조우에 넣는다"**: 그 지역 `monsters`에 더하고, 무한의 화신은 에테르 관문 목록에서 뺀다.
- A1(진 엔딩 우회)은 결함이 아니다(§61.2 정정) — 고치지 않았다.

### 62.2 결함 수정 표 (A)

| ID | 수정 전 | 수정 후 |
|---|---|---|
| A2 | `bossMonsters`에만 있던 6종이 지역당 6,000회에서도 0회(임무 109 · 150 완료 불가, 도감 · 지역 탐험 완료 불가, 전설 각인 안내 거짓) | 프로토타입 제로 · 에테르 심판자 · 공허의 대행자 · 봄의 여왕 · 서리 군주를 지역 `monsters`에 넣었다. 무한의 화신은 에테르 관문에서 빼고 혼돈의 심연 `bossMonsters`가 층 보스 10종 전부를 든다(임무 96 목적지 · 도감 출현 지역이 심연이 된다). 계약: 모든 지역의 `bossMonsters`가 실제 스폰(조우 · 구역 보스 · 숨은 보스 · 심연 층)에서 나온다 |
| A3 | 혼돈의 심연 진입 레벨 = 현재 레벨 + 8(하한 50) → 이동 버튼 · 경로 · 안내가 언제나 "잠김", 터미널 `move`로만 진입 | `getMapRequiredLevel('infinite')` = 1 — 화면 잠금이 이동 규칙(`getMapAccess`)의 레벨 잠금과 같다(52지역 × 6레벨 대조) |
| A4 | 지속 피해 · 반격 · 전투 소모품으로 끝난 승리(`extendedChecks: false`)가 구역 보스 처치 기록 · 시즌 XP · 처치 수 마일스톤(정확히 N에서만 — 영구 누락) · 전투 기록 · 공허의 신 보상을 건너뛰었다 | `extendedChecks`를 삭제했다 — 처치 방법과 무관하게 같은 후처리. 부재 불변식(`cycle 592` 가드)이 되돌리기를 잡는다 |
| A5 | 낮은 생명 승리 임무가 최근 50전 창만 읽었다(3승 → 일반 50승 → 2승 = 3/5) | 승리 기록 때 누적(`stats.lowHpWinTotals`, 문턱 0.2 · 0.1 · 0.05)을 함께 올린다. 처음 생길 때 기존 창을 시드로 쓴다. 50전 창은 동적 난이도 · 빌드 성향 입력으로 그대로 남는다 |
| A6 | 발견 지역 임무(72 · 201)가 시작 마을을 셌다(업적은 Wave 58에서 뺐다) | `countDiscoveredMaps` 하나 — 임무 · 업적 · 칭호 · 능력치 화면이 같이 읽는다 |
| A7 | 현상수배가 열쇠 지역(고대 보물고) 전용 몬스터를 대상으로 골랐다 | 대상 지역 판정이 `nonWalkingEntryOf`(시즌 · 열쇠)를 쓴다 — Lv1 ~ 99 전수에서 걸어갈 수 없는 지역 몬스터 0 |
| A8 | 도감이 접두어 사본을 따로 세고 바탕 장비는 미등록(강철 롱소드 접두어 6개로 "무기 수집가 I") | 장비 도감 키 = 바탕 이름(`getCodexEntryName`), 구세이브 키는 마이그레이션이 합친다(`normalizeCodexEquipmentKeys`, 버전 bump 없음 — 멱등) |
| A11 | 공허의 신 처치가 효과 없는 문자열 '허무의 정복자'를 칭호로 하나 더 붙였다 | 실제 id `void_conqueror` 하나(중복 없이) |
| A12 · A13 · A14 | 이야기 "생명 +N"이 저장 최대치로 잘라 현재 생명을 깎았다(1310 → 1180) · 생명 · 기력 보너스가 전직 때 사라졌다 · "공격력 +N"이 직업 배율 안에서 +18 ~ +35가 됐다 | 이번 런 누적 `storyStatBonus` — 공격 · 방어는 배율 뒤에 더하고(Wave 58 규칙), 생명 · 기력은 저장 최대치에 굽되(Wave 40 규칙) 전직이 다시 더한다. 회복은 `healWithinMax` · 실효 최대치(Wave 56 규칙). 사망 · 계승에서 사라진다(영구 상태 선별에 넣지 않는다) |
| A15 | 용의 유산 1단계 선택 2 "용의 비늘 하나를 줬습니다" — 보상 없음 | 용의 비늘 지급 |
| A16 | 선택지 번호 제거 정규식이 숫자 답('45' · '50' · '55')을 지워 "선택지 1/2/3"이 됐다 | 목록 번호("1. " · "2) " · "3- ")만 벗긴다 — 숫자 답 · 소수("1.5배")는 남는다 |
| A17 | 이야기 골드 지불(300 · 2,000)이 일일 '골드 소비'에 안 잡혔다 | `RESOLVE_CHAIN_GOLD_CHOICE`가 일일 진행을 올린다(파편 변환 난수는 payload `relicRoll`) |
| A18 | 보호 합성 한 번 뒤 숨은 토글이 남아 성공률 100% 합성에서도 크리스털 30을 썼다 | 리듀서가 성공률 < 1일 때만 보호를 적용하고, 화면은 보이는 토글만 보내며 합성 뒤 끈다 |
| A19 | 휴식 안내가 기본 비용 60으로 판단(Lv40 골드 100에서 추천 → 거부) | 실제 휴식 비용(`getRestCost`) — 정화 안내도 같은 비용을 본다 |
| A20 | 제작 임무 진행도가 다음 탐험 · 전투까지 갱신되지 않았다 | 제작 리듀서가 임무 진행을 바로 맞춘다 |
| 지역 설명 | 공중 신전 "번개 원소 결정체 대량 채취"(그런 재료 없음) · 여행자의 쉼터 "수리"(내구도 없음) · 지하 감옥 "수감자 구출 보상"(콘텐츠 없음) | 있는 것만 말한다 |

### 62.3 문구 수정 표 (B) — 동작은 그대로, 화면이 엔진 판정을 읽는다

| 표면 | 수정 전 | 수정 후 |
|---|---|---|
| 임무 보상 요약 | 칭호 보상(152 · 153 · 154 · 201 · 202)이 빠졌다 | "칭호 X"(칭호 표의 이름) |
| 현상수배 포기 | "오늘은 새 현상수배를 받을 수 없습니다"(Wave 32 이후 거짓) | 바로 새로 받을 수 있고 대상 · 수가 다시 정해진다 |
| 임무 3 · 130 · 202 | '광산의 위협'(코볼트는 광산에 없다) · "다시 한번"(목표 3) · 영어 'signature' | '평원의 코볼트' · "다시 3번" · '전설 각인' |
| 누적 임무 28개 | 수락 순간 완료될 수 있는데 '누적' 표시 없음 | '누적' 칩 — 진행도 표(`getLifetimeCounterReader`) 하나에서 도출(`isLifetimeCounterQuest`), 새 누적 종류는 자동 |
| 처치 안내 | "일반 몬스터 N회"(보스도 센다) | "몬스터 N회 (보스 포함)" |
| 이야기 전투 보너스 | 모든 체인이 "최후의 영웅이 합류해 …" · 버프 '기사의 혼령' | 체인 데이터가 이름 · 소개를 선언(`buffName` · `buffIntro`), 없으면 일반 문구 |
| 체인 실패 선택지 7개 | 3개가 "이야기 진행 · 골드 보상"(영구 실패) · 4개가 "흐름이 달라질 수 있음"(분기 없음) | "이야기가 여기서 끝남 · 다시 이어지지 않음"(+ 골드 보상) |
| 일반 이벤트 미리보기 | 생명 손실 25건이 정예 · 상태 · 유물 · 버프 문구에 가려졌다 · 기력만 잃어도 "생명 손실" | 생명을 잃으면 언제나 "생명 손실 위험", 기력은 기력 |
| 밀어붙인다 | 언제나 "보스가 더 빨리 다가옵니다" · 다음 모닥불 차단을 말하지 않았다 | 게이지가 실제로 오를 때만 보스를 말하고(`doesPushAdvanceBossGauge`, 적용과 같은 판정) 모닥불 대가는 언제나 |
| 회복 로그 | 상한에 잘려도 명목치 "+N" | 실제 회복량(모닥불 · 폴백 풀 · 한정 조우) |
| 서사 잔재 | 봉인석 · 검 · 시험 번호 · "이번 전투" · 적용 안 되는 대가 5건 | 있는 것만 말한다 |
| 엘릭서 | "생명 +9999" · 접두어 사본 "HP+10006" | "생명 완전 회복" — 엔진과 같은 판정(`isFullRestoreElixir`) |
| 휴식 자동완성 | "100G" | 실제 비용(`getRestCost`) |
| 상점 정화 | "poison 해제" | 상태 칩과 같은 라벨(`MSG.STATUS_LABELS`) |
| 재료 · 열쇠 '사용' 버튼 | 눌러도 무반응(리듀서가 조용히 거부) | 리듀서가 받는 종류에만 그린다(`isInventoryUseAccepted` 하나) |
| 영웅의 물약 · 합성 보호 아이템 | "ALL" · 이름 셋(합성 보호권 · 보호권 · 합성 보호석) | "ATK·DEF" · "합성 보호권" 하나 |
| 도감 획득처 | 엔진이 쓰지 않는 레거시 표(몬스터 34 · 소재 20 틀림, 전설 각인 26개 숨김) | 엔진의 표 선택 규칙(드롭 표가 있으면 그것만, `codexDropSources`) — 도달 비용 리포트의 레거시 경로도 같은 규칙 |
| 도감 문구 | 소재 "골드 {가격}"(살 수 없다) · "상점에서" · "조우한 생물" | 판매가 · 몬스터 전리품 · 처치한 생물 |
| '이벤트↑' 배지 | 원시 확률 0.28로(배지 10곳이 무배지 3곳보다 낮았다) | 실제 이야기 확률(지역 보정 포함) — 순서가 단조 |
| 보스 표시 | 지하 미궁 · 공중 신전 · 금지된 도서관 등 보스가 못 나오는 지도에 보스 · 처치 뒤에도 위험 '보스' | `canBossAppearInMap` 하나(지도 · 경로 · 조작판 · 안내), 숨은 보스 해금 표는 `spawnEnemy`와 공유(`bossPresence`) |
| 난이도 · 변방 · 연속 처치 | 보상 감소 미언급 · "레벨 1~10"(Lv15 포함) · 치명 보너스 누락 | 보상 감소 · 밴드 실제 범위 · 치명 확률 |
| 칭호 | 시즌 2부터 이미 가진 칭호를 보상으로 · rank 11+ "새 칭호 에테르의 신" 반복 · '정예만'이 보스 제외를 말하지 않음 | "(보유 중)" · 새 칭호만 알림 · "보스를 제외한 모든 적" |

몬스터 그림의 대표 지역은 그린 시점으로 고정했다(`ART_PRIMARY_REGION_PINS`) — 혼돈의 심연 `bossMonsters`가 층 보스 10종을 들게 되자 지역 순서상 심연이 앞선 세 보스(무한의 화신 · 허무의 전령 · 멸절의 사도)의 대표 지역이 바뀌어 카탈로그 정체성 해시가 움직였다. 그림 정체성은 아트 결정이라 스폰 데이터와 묶지 않는다(CLAUDE.md §9와 같은 교훈). 고정 뒤 카탈로그는 바이트 동일하다.

### 62.4 측정

**성장 모델(행동 = 처치 1회).** 보스 6종이 조우 풀에 들어가 기계 폐도(Lv28) · 에테르 폐허 · 공허의 회랑의 처치 경험치가 올랐다. 64시드 평균 체크포인트 액션: Lv2 ~ 20 바이트 동일 · Lv45 1,600.6 → 1,582.4(−1.1%) · Lv60 −0.3% · Lv75 8,184 → 7,945(−2.9%). 모든 시드가 움직였다(대응 차이 표준편차 5.5 · 19.9) — 기준 시드의 잡음이 아니라 실제 이동이다. 도달 비용 앵커: Lv45 39.85 → 39.2h · 마왕성 경로 게이트 Lv48 53.78 → 53.15h · Lv68 170.83 → 167.05h. 직업 여유(승천까지)는 13.93 → 13.95h. maps.ts 하나만 되돌리면 이전 해시가 재현된다(실측).

**자연 플레이(5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 60 = `w60impl`).** 측정 코드는 Wave 61의 결함 수정 · 보스 조우(`59a1ea2c` + maps.ts)다 — 문구 수정은 드라이버 행동을 바꾸지 않는다.

| 경로 | 시드당 사망 | 보스전 사망 | 4회 합계 모델 시간 | 4회 합계 행동 수(전투 턴 포함) |
|---|---|---|---|---|
| 전사 > 나이트 | 4.48 → 4.00 (z −1.1) | 0.75 → 0.69 | 222.5 → 215.6h (z −1.6) | 38,089 → 36,732 (z −1.9) |
| 전사 > 버서커 | 5.73 → 5.06 (z −1.4) | 0.79 → 0.71 | 245.6 → 239.0h (z −1.1) | 39,975 → 39,400 (z −0.7) |
| 마법사 > 무당 > 시간술사 | 4.35 → 5.17 (z 1.8) | 1.38 → 1.31 | 252.4 → 247.9h (z −0.6) | 38,552 → 38,194 (z −0.4) |
| 도적 > 어쌔신 > 그림자 주군 | 2.92 → 3.00 (z 0.2) | 0.27 → 0.15 | 202.2 → 200.2h (z −0.9) | 32,239 → 31,825 (z −0.9) |
| 마법사 > 성직자 > 팔라딘 | 7.63 → 7.46 (z −0.3) | 1.54 → 1.23 | 231.5 → 226.6h (z −1.0) | 42,807 → 41,612 (z −1.4) |

- 위반 0, 타임아웃 0. **사망 · 시간은 경로마다 유의하게 변하지 않았다**(|z| ≤ 1.8). 회차별로는 시간술사 3회차 +0.21(z 2.0) · 어쌔신 2회차 −0.13(z −2.3) 두 칸만 |z| ≥ 2이고 방향이 반대다.
- 새로 나오는 보스의 사망: 프로토타입 제로 0 → 15(나이트 1 · 버서커 4 · 시간술사 5 · 팔라딘 5). 보스 처치는 시드당 +2 ~ +7이다(새 조우 보스 + 지속 피해 · 반격 처치도 보스 처치로 정산).

### 62.5 테스트 · 결함 주입 · 증빙

- 새 계약 테스트 8개 파일:
  - `boss-spawn-route-contract`(5): 모든 지역 `bossMonsters`가 실제 스폰에서 나온다(조우 4,000회 · 구역 보스 · 숨은 보스 해금 · 심연 층) · 6종이 Lv1 신규 플레이어 조우에서 나온다 · 심연 목록 = 층 보스 10종 · 임무 109 · 150 · 96 목표 지역 · 지역 각인 안내 출처.
  - `victory-settlement-uniform-contract`(5): 소모품 턴 지속 피해 처치가 직접 공격 처치와 같은 후처리(구역 보스 기록 · 전투 기록 · 보스 시즌 XP) · 10번째 처치 마일스톤 · 공허의 신 칭호 id · 낮은 생명 누적(3 · 50 · 2 = 5, 임무 62) · 구세이브 창 시드.
  - `progress-and-story-reward-contract`(13): A3 · A6 · A7 · A8(획득 · 마이그레이션) · A12 · A13 · A14 · A15 · A16 · A17 · A18 · A19 · A20.
  - 문구 묶음 5개: `quest-board-text-contract`(12) · `event-preview-text-contract`(10) · `consumable-shop-text-contract`(8) · `codex-drop-source-contract`(7) · `map-badge-title-text-contract`(16) — 모두 실제 모듈 · 리듀서 · 렌더를 부르고 엔진 경로를 오라클로 쓴다(소스 정규식 0).
- 결함 주입: 결함(A) 18종이 모두 red였다(별도 작업 트리에서 — 측정 중인 트리는 건드리지 않았다). 진행 · 이야기 묶음 14종은 각자 자기 테스트 하나만, `extendedChecks` 되살리기는 승리 정산 3건, 지도 되돌리기는 보스 경로 5건을 깨뜨렸다. 문구 묶음은 묶음마다 4 ~ 9종을 주입해 모두 red였다.
- 기존 테스트 갱신: `extendedChecks` 호출부 가드 → 부재 불변식(주석 제외 코드에서 식별자 0) · 심연 진입 레벨(1) · 합성 보호 호출부 · 발견 지역(시작 마을 제외) · 낮은 생명 누적 호출부 · 체인 골드 지불(주입 rng의 `relicRoll` · 일일 보상 로그) · 지도 데이터 값 해시 3곳 · 성장 모델 앵커(도달 비용 · 체인 비용 · 시뮬레이터 기준 해시 · 진단 v1 기준 해시) · 옛 문구를 고정하던 테스트 7곳.
- 증빙: 도달 비용(레거시 경로 규칙 · 앵커) · 진단(곡선 이동) · 탐험 리듬(`reportHash` `0818fb7a` 그대로, 소스 해시만) · 이벤트 보상 정합(용의 비늘) · 장비 전투력 · 유물 3종(소스 해시). 추적 증빙 verify 15종 ok.

## 63. Wave 62 — 도전 조건 · 강해지는 쪽 규칙 · 약해지는 쪽 서사 (2026-10-05, 베이스 = `main` `dca46b6f` = PR #95 머지)

### 63.1 대상과 소유자 답

§61.6의 Wave 62 몫 전부다:

- **도전 조건(C1 · C15 · C16 · A9 · A10)** — "전부 설명대로": 보상 +20 / 50 / 100 / 150%, 모든 골드 절반, 레벨업 · 전직 뒤에도 생명 절반, 위치 완전 숨김, 실패한 무작위 기술도 턴 소모.
- **강해지는 쪽(C3 ~ C12)** — "규칙은 구현": 전설 보장, 유물 교체 제안, 게이지 회피, 강화는 더 센 쪽, 무료 부활 먼저, 강화 안 된 사본 먼저, 종말의 기사 1회, 임무 200 칭호, 첫 방문은 여정마다, 현상수배 레벨 기준.
- **강해지는 쪽 서사(C2 · C13 · C14)** — "서사는 문구": '영구' → '이번 여정', 기계 반란 '도움' 삭제, 허공의 섬 '독점' 삭제.
- **약해지는 쪽 서사(C17 ~ C20)** — "전부 설명대로": 심연 신호 50층, 도박 · 퍼즐 · 카드는 실제 확률(미리보기는 결과를 숨긴다), 잃어버린 마법사는 실제 전투, 북부 요새 판매 등급 3 · 황금 왕국 물가 할증.

### 63.2 도전 조건 — 판정은 `utils/challengeRules.ts` 하나

| ID | 수정 전 | 수정 후 |
|---|---|---|
| C1 | 선택 화면 "+20 / +50 / +100 / +150%" vs 엔진 ×1 · ×1 · ×1.5 · ×2(1 ~ 2개는 보상 없음) | `BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT` [1, 1.2, 1.5, 2.0, 2.5] 하나를 엔진(`CombatEngine.outcome`)과 선택 화면이 읽는다. 문구는 무엇이 오르는지 말한다("전투 경험치 · 골드 +N%") |
| C16 | '빈손의 시작'이 전투 골드만 절반 | 모든 골드 수입이 `getGoldIncome`을 정확히 한 번 거친다 — `grantGold` · 전투 승리 정산 · 성장 골드 · 보스 초회 보너스(반감 전 처치 골드로 계산 뒤 한 번) · 묘비 회수 · 폴백 거래 · 첫 방문. 지출(음수)은 그대로다. 로그 · 미리보기도 지급액을 말한다(§63.5) |
| A9 | '약한 생명력'이 시작 때 한 번만 절반 — 레벨업은 전체량, 첫 전직에서 사라졌다 | 재구성(시작 · 계승 · 사망 재시작 · 전직)은 `applyChallengeMaxHp`(절반, 하한 `CHALLENGE_HALF_HP_FLOOR` 50), 늘어나는 양(레벨업 · 성장 보너스 · 이야기 보상)은 `getChallengeMaxHpGain`(절반). Lv1 → 11 레벨업 · Lv10 전직 · 계승 · 사망 재시작 모두 절반이다 |
| A10 | '길 잃은 여행'이 이동 로그 · 첫 방문 · 지역 설명 · 원정 배너 · 터미널 `상태`/`지도` · 지역 그림으로 위치를 드러냈다 | `isBlindMap` 하나가 판정하고 `getVisibleLocationName` · `getVisibleLocationVisual` · `getVisibleRegionTheme` · `getVisibleRouteName` · `getVisibleExpeditionSummary`가 그린다. 가린 표면: 이동 로그(도착 · 첫 발견 · 첫 방문 · 지역 설명 · 원정 목표) · 터미널 상태 · 지도 · 자동완성 · 지역 그림 · 지역 색 · 지도 화면 현재 위치 카드 · 상태 표시줄 · 이벤트 화면 · 사망 요약 · 귀환 브리핑 · 묘비 화면 · 원정 귀환 카드 · 지난 원정 줄 · 출발 준비 목적지('미확인 경로'). **저장은 그대로이고 그릴 때만 가린다** — 규칙이 없는 다음 여정의 기록 화면은 이름을 보인다. 임무 목표 지역(임무 문구 자체가 말한다)은 가리지 않는다 |
| C15 | '뒤섞인 기술'이 고른 기술도 뽑고, 쓸 수 없는 기술이 뽑히면 비용 없이 다시 굴렸다 | 고른 기술은 뽑지 않는다(기술 2개 이상). 뽑힌 기술을 쓸 수 없으면(기력 부족) 그 차례가 지나간다 — 적이 행동하고 턴이 오르며 기력은 그대로(`MSG.COMBAT_CHAOS_SKILL_FIZZLE`) |

### 63.3 강해지는 쪽 규칙 (C3 ~ C12)

| ID | 수정 전 | 수정 후 |
|---|---|---|
| C3 | "전설의 유물" 약속 5곳 · "용의 심장 유물"이 모든 등급에서 뽑혔다(전설 약 4.6%) | 체인 6곳의 보상이 `rarity: 'legendary'`를 선언하고 `selectRarityRewardPool`이 그 등급 풀에서 뽑는다(남은 전설이 없으면 높은 등급부터 대체). 미리보기는 "전설 유물 보상" |
| C4 | 칸이 가득 차면 정찰 정예 카드 · 이벤트 유물 약속이 조용히 사라졌다 | 체인 · 보스 보상과 같이 교체를 제안한다(`RelicChoicePanel` 교체 모드) |
| C5 | "회피 — 계속 나아간다"가 다음 탐험마다 같은 카드를 띄웠다(그 지역 사냥 · 임무가 막혔다) | 회피한 탐험은 일반 롤로 이어지고, 그 지역에서 `BOSS_GAUGE_EVADE_EXPLORES`(5)번 더 탐험하는 동안 카드가 뜨지 않는다(`stats.bossGaugeEvadedAt`). 게이지는 만충 그대로 — 5는 빈 게이지가 다시 차는 탐험 수(8)보다 짧아 회피가 도전 실패보다 싸지 않다 |
| C6 | 물약 · 모닥불 단련 · 밀어붙인다 · 이야기 전투 보너스 · 전쟁의 북이 강화 칸 하나를 덮어써 더 센 강화를 지웠다(345 → 235) | `systems/tempBuffMerge.ts` — 세기 = (공격 + 방어 + 반격) × 남은 턴, 더 센 쪽이 남고 같으면 지금 것이 남는다. 밀린 강화는 로그 · 미리보기("지금 걸린 강화가 더 강해 이 강화는 붙지 않음")로 말한다 |
| C7 | 유료 부활석이 무료 부활보다 먼저 쓰였다(한 전투에서 부활석이 반복 소모되는 결함도) | 순서: 불사의 의지 → 허공의 심장 → 불사조의 깃털 → 거울 → 부활석. 부활석은 호출당 한 번(`reviveTokenSpent`) |
| C8 | 제작 · 합성이 같은 이름의 강화된 사본(+5)을 먼저 썼다 | `utils/recipeInputSelection.ts` — 강화 안 된 사본부터. 리듀서와 화면이 같은 선택을 읽고 화면은 "+N" 칩으로 어느 사본이 쓰이는지 보인다 |
| C9 | 종말의 기사 "3회 처치" — 구역 보스라 한 런에 1회 | 임무 154 목표 1 |
| C10 | 임무 200 "새 칭호 획득" — 칭호 없음 | 보상 칭호 '대륙의 여행자'(기력 +5 · 생명 +5) |
| C11 | 첫 방문 보상이 사망 재시작마다 다시 나오고 계승 뒤에는 안 나왔다 | 여정마다 지역당 한 번(`player.firstVisitRewardMaps`, 런 범위 — 새 게임 · 사망 재시작 · 계승이 비운다). 예전 세이브는 방문 기록으로 시작한다 |
| C12 | 현상수배 "현재 레벨 기준" — 지역의 `boss` 필드(구역 보스 이름)로 52곳 중 28곳을 통째로 빼서 Lv69+에서 대상이 0이었고 슬라임(보상은 레벨 비례)으로 떨어졌다 | 진입 레벨 창 [L − 10, L + 5](`BOUNTY_LEVEL_WINDOW_BELOW` · `_ABOVE`)의 걸어갈 수 있는 사냥 지역(심연 제외), 창이 비면 아래로 10씩 넓힌다. 지역이 아니라 보스로 정산되는 몬스터만 뺀다(`isEncounterBoss` — `spawnEnemy`의 `isBoss`와 같은 판정) |

### 63.4 서사 (C17 ~ C20 · C2 · C13 · C14)

| ID | 수정 전 | 수정 후 |
|---|---|---|
| C17 | 심연 신호 "50층" — 1층에서도 진행 | 1 · 2단계가 `minAbyssFloor: 50`을 선언하고 트리거는 `isChainStepFloorReached` 하나(지금 싸우는 층 = 돌파 + 1). 임무 일지는 "다음 이야기: 혼돈의 심연 50층". 도달 비용 리포트는 이 체인을 값 매기지 않는다(`cost.floorGatedEventChains`, 스키마 6) — 이 모델에는 심연 층 진행이 없어 Lv48로 매기면 과소 계상이다 |
| C18 | 도박 · 추측 퍼즐 · 카드 "세 장 중 한 장" — 결과가 확정이고 미리보기가 보여 줬다(카드는 2/3 지급) | 판돈 거래는 승률 50%(이기면 두 배, 기대 순이익 0 — 공짜 +500 / +720이 사라지고 분산만 남는다). 카드 · 수정은 판마다 섞는다(어느 카드든 1/3). 굴림은 hook이 payload `roll`로 보내고 리듀서가 판돈 거래에만 받는다. 모든 선택지가 같은 미리보기라 승자를 가리키지 않는다. 합 퍼즐(55)은 답이 정해진 퍼즐이라 그대로 |
| C19 | 잃어버린 마법사 3단계 "전투를 받아들인다" — 전투 없이 보상 | 실제 전투(`outcome.combat` — 고대 마법사, 이름 '사라진 마법사의 환영'). 승리해야 보상 · 진행이 정산된다. 미리보기 "전투 시작 · 승리하면 …" |
| C20 | 북부 요새 "(Tier 3 상점)" — 실제 5등급 · 황금 왕국 "물가가 높지만" — 가격 보정 없음 | 지역 데이터 `shopMaxTier: 3` · `shopPriceMult: 1.3`을 `getShopMaxTier` · `getShopBuyPrice`가 읽고 상점 화면 · 구매 리듀서 · 보급 안내(귀환 행동 · 마을 상점 상태)가 같은 가격을 쓴다. 판매가 · 다른 상점은 그대로. ×1.3은 같은 재고를 기본가로 파는 허공의 섬(Lv42)이 더 이른 지역이라 잠금이 아니라 편의의 값이다 |
| C2 | 이야기 능력치 보상 "영구" | "이번 여정 능력 상승"(실제 `storyStatBonus`는 런 범위) |
| C13 | 기계 반란 "전투에서 도움" | 골드만 약속한다 |
| C14 | 허공의 섬 "이곳에서만 구할 수 있는" | 독점 문구 삭제(판매 등급 규칙 그대로 최상급까지) |

### 63.5 '빈손의 시작' 로그 · 미리보기

C16으로 모든 골드 수입을 절반으로 넓히자 판매 · 일괄 판매 · 임무 특성 보너스 · 시즌 · 도감 · 주간 미션 · 처치 마일스톤 · 이벤트 성공 골드의 로그와 미리보기가 반감 전 금액을 말하게 됐다(이번 웨이브가 만든 불일치). 이제 이 플레이어가 받는 금액(`getGoldIncome`)을 말한다 — 규칙이 없는 플레이어의 문구는 바이트 그대로다.

- 로그: 판매 · 일괄 판매(`getSellIncome` — 상점 판매 목록도 같은 값) · 임무 특성 보너스 · 시즌 단계 수령 · 도감 보상 · 주간 미션 · 이벤트 성공 골드 · 일반 이벤트 결과("(+500G)") · 보물상자 · 카드 · 폴백 거래 결과(지급은 이미 절반이었는데 문구는 "+200G"였다) · 발견 체인 · 원정 조우 결과.
- 미리보기: 이벤트 선택지(폴백 거래 · 숨은 사건 · 원정 조우) · 임무 · 업적 보상 칩(`formatRewardParts(reward, holder)`) · 주간 미션 줄 · 계승 · 진 엔딩 화면의 미수령 보상 · 시즌 패스 카드 · 도감 마일스톤 카드 · 묘비 회수 금액 · 첫 출발 안내(데이터 `FIRST_VISIT_REWARDS`에서 읽는다 — 하드코딩된 "골드 100"이었다).
- 데이터 문구 속 금액은 `reportPaidGold`가 명목 금액과 같은 "골드 N" · "골드 +N" 토큰만 한 번에 고치고 뒤따르는 조사도 맞춘다("골드 70을" → "골드 35를", 조사 짝은 `MSG.NUMBER_PARTICLE_PAIRS`). 판돈(비용)은 그대로다.
- 그대로 둔 것: 금액을 말하지 않는 줄(처치 마일스톤 · 체인 골드 보상 · 임무 · 업적 수령 · 일일 임무), 도감의 판매가 · 장비 가격(수입 약속이 아닌 목록 값), 다른 플레이어 묘비(침공 보상은 물건이다), 이미 지급액을 말하던 줄(승리 · 첫 보스 · 성장 · 첫 방문 · 전투 결과 카드).

### 63.6 측정

**성장 모델.** 변하지 않았다 — 시뮬레이터 골든 · 도달 비용 앵커 · 진단 기준 해시가 모두 그대로다(도전 규칙 없음 · 첫 방문 보상은 모델 밖 · 현상수배 · 버프 규칙은 모델이 쓰지 않는다). 도달 비용 리포트의 변화는 심연의 신호가 층 조건 목록으로 빠진 것뿐이다(체인 버킷 48: 5 → 4, 값을 매기는 체인 13 → 12).

**자연 플레이(5경로 48시드 × 계승 4회, 추천 정책, `kit` 기술 정책, 기준 = Wave 61 = `main` `dca46b6f`).** 드라이버는 그대로다 — 이벤트 · 게이지 카드는 언제나 첫 선택지(게이지는 '도전'), 유물 칸이 차면 거절, 도전 조건 없음. 그래서 C4(교체 제안) · C5(회피) · 도전 조건은 이 측정에 걸리지 않는다. 걸리는 것은 강화 칸 규칙 · 부활 순서 · 제작 입력 · 첫 방문(계승 뒤 회차) · 현상수배 대상 · 판돈 확률 · 상점 규칙 · 이야기 전투다.

| 경로 | 시드당 사망 | 보스전 사망 | 4회 합계 모델 시간 | 4회 합계 행동 수(전투 턴 포함) |
|---|---|---|---|---|
| 전사 > 나이트 | 4.40 → 4.02 (z −0.8) | 0.58 → 0.60 | 220.3 → 217.7h (z −0.6) | 37,550 → 37,198 (z −0.5) |
| 전사 > 버서커 | 5.27 → 5.56 (z 0.6) | 0.65 → 0.77 | 245.4 → 249.7h (z 0.7) | 40,391 → 40,553 (z 0.2) |
| 마법사 > 무당 > 시간술사 | 4.90 → 5.33 (z 0.9) | 1.13 → 1.40 (z 1.4) | 241.9 → 252.0h (z 1.4) | 37,564 → 38,725 (z 1.1) |
| 도적 > 어쌔신 > 그림자 주군 | 2.96 → 2.71 (z −0.7) | 0.13 → 0.10 | 201.2 → 199.9h (z −0.4) | 32,067 → 31,781 (z −0.6) |
| 마법사 > 성직자 > 팔라딘 | 7.46 → 7.73 (z 0.5) | 1.60 → 1.13 (z −2.4) | 227.4 → 227.9h (z 0.1) | 42,374 → 42,421 (z 0.1) |

- 위반 0, 타임아웃 0. **사망 · 시간 · 행동 수는 경로마다 유의하게 변하지 않았다**(|z| ≤ 1.4). 회차별 사망도 모든 칸이 |z| < 1.5다.
- 유의한 칸은 팔라딘의 보스전 사망 하나다(z −2.4, 아이스 드래곤 39 → 27 · 빙결의 마녀 28 → 19). 같은 경로의 전체 사망은 그대로라(z 0.5) 보스전에서 줄어든 만큼 일반 전투로 옮겨 갔다. 다섯 경로 중 하나의 한 칸이라 원인을 이 측정으로 가르지 않았다.
- 가장 크게 움직인 칸은 시간술사 1회차 시간 81.1 → 90.8h(z 1.9)와 마왕전 사망 14 → 24다. 같은 경로의 2 ~ 4회차는 반대 방향이거나 0 근처라 합계는 유의하지 않다. 1회차에 걸리는 변화는 판돈 거래(공짜 +500 / +720 → 기대값 0)와 현상수배 대상(레벨 창, 구역 보스 지역의 일반 몬스터 포함 — Lv40 대상 10 → 57종)이다. 첫 방문 보상은 계승 뒤 회차에만 늘어난다.
- 보스 처치는 시드당 −5 ~ +1(나이트 92.0 → 86.6 · 어쌔신 85.0 → 79.8). 현상수배 대상에는 이전에도 이후에도 보스가 없다(Lv5 ~ 70 전수 0) — 이 측정으로 원인을 가르지 않았다.

### 63.7 테스트 · 결함 주입 · 증빙

- 새 계약 테스트 16개 파일 174건 — 모두 실제 리듀서 · 액션 · 엔진 · 정적 렌더를 부르고 대조군(규칙 없음 · 이전 동작)을 함께 둔다:
  - 도전: `challenge-modifier-delivery-contract`(21) · `first-visit-per-journey-contract`(5) · `no-gold-log-amount-contract`(16).
  - 강해지는 쪽: `relic-reward-guarantee-contract`(12) · `boss-gauge-evade-contract`(7) · `temp-buff-merge-contract`(29) · `revive-order-contract`(7) · `craft-input-selection-contract`(9) · `quest-reward-promise-contract`(7) · `bounty-target-level-contract`(5).
  - 서사: `chain-floor-gate-contract`(10) · `chance-event-contract`(18) · `lost-wizard-fight-contract`(8) · `shop-tier-price-contract`(9) · `event-preview-reward-contract`(6) · `narrative-promise-wording`(5).
- 결함 주입(모두 측정 트리와 다른 별도 작업 트리):
  - 핵심 규칙 되돌리기 15종이 모두 red다 — 보상 배율 표 · `grantGold` 반감 · 생명 재구성 절반 · 증가량 절반 · 고른 기술 제외 · 실패해도 차례 · 더 센 강화 유지 · 무료 부활 먼저 · 강화 안 된 사본 먼저 · 전설 풀 · 교체 제안 · 회피 억제 · 여정마다 첫 방문 · 현상수배 지역 필터 · 임무 154 목표.
  - 길 잃은 여행 남은 표면 5종(사망 요약 · 귀환 브리핑 · 묘비 · 원정 기록 · 출발 준비) · 서사 17종(층 조건 3 · 확률 5 · 상점 5 · 미리보기 3 · 문구 1)이 모두 red다.
  - 로그 금액 32종 중 31종이 red다. 남은 하나는 상점 판매 탭의 판매가 표시로, 정적 렌더가 판매 탭을 열 수 없다 — 공유 함수(`getSellIncome`)는 행동 테스트가, 상점 화면의 호출은 기존 단일 원천 가드(`equipment-comparison-single-source` A2)가 잡는다.
- 기존 테스트 갱신: 도달 비용 · 체인 비용(심연의 신호 → `floorGatedEventChains`, 스키마 6) · 지도 데이터 값 해시 3곳(북부 요새 · 황금 왕국 필드 · 문구) · 이벤트 폴백 거래 · 선택지 응답 · 미리보기 문구(판돈 확률) · 데이터 모양(지도 새 필드) · 장비 경제(황금 왕국 가격) · 옛 호출 모양을 고정하던 소스 가드 · 옛 동작을 고정하던 테스트(현상수배 풀 · 소모품 거래 · 이벤트 결과 어휘 · 정찰 · 원정 게이지 · 실효 최대치 · 가방 상한) — 각각 새 규칙의 행동 단언으로 바꿨다. e2e 2개(이벤트 폴백 거래 · 장비 경제)의 기대값도 판돈 확률 · 황금 왕국 물가에 맞췄다.
- 증빙: 도달 비용(심연의 신호 → `floorGatedEventChains`, 스키마 6 · 앵커 그대로) · 진단(소스 해시만 — 곡선 값 그대로) · 장비 전투력 · 유물 2종(소스 해시). 탐험 리듬은 `reportHash` `0818fb7a` 그대로다. 추적 증빙 verify 15종 ok.

### 63.8 남은 관찰

- 임무 154(종말의 기사 1회, `minLv` 75)가 151(`minLv` 73)과 같은 구간에서 겹친다 — 소유자 판단 거리.
- 불사조 부활이 강화 칸을 덮어쓴다(부활 회복과 함께 `tempBuff`를 새로 쓴다) · 안전지대 진입이 강화 칸을 비운다 — C6 규칙 밖의 두 경로.
- 다른 상점의 오늘의 할인 · 주간 특별 상품이 자기 판매 등급을 넘을 수 있다 — 이번 변경 이전부터다. 선언한 상한이 있는 상점(북부 요새)만 거른다 — 다른 상점을 바이트 그대로 두기 위해서다.

## 64. Wave 63 — §63.8 남은 관찰 3건 (2026-10-05, 베이스 = `main` `acfde282` = PR #96 머지)

### 64.1 대상과 판단

§63.8의 남은 관찰 셋을 권장 순서(강화 칸 → 상점 할인 등급 → 임무 151/154)대로 처리했다(소유자 답 "권장하는 순서대로 진행"). 셋 다 코드를 먼저 읽고 결함인지 의도인지 가른 뒤 정했다.

| 관찰 | 판정 | 처리 |
|---|---|---|
| 불사조 부활이 강화 칸을 덮어쓴다 | 결함 — C6 규칙(더 센 강화 유지) 밖에 남은 경로 | 규칙을 거치게 고쳤다 |
| 안전지대 진입이 강화 칸을 비운다 | 의도 — 원정 종료 규칙(cycle 187), 이동 로그가 알린다 | 그대로 둔다(아래 근거) |
| 다른 상점의 할인 · 주간 특별 상품이 판매 등급을 넘는다 | 결함 — 상점 하나에 규칙 둘 | 모든 상점이 판매 등급 안에서만 판다 |
| 임무 154가 151과 같은 구간에서 겹친다 | 함정 + 중복 — C9(목표 1회) 결과 | 수락 레벨을 맞춰 함정만 없앴다. 중복은 질문으로 남긴다 |

### 64.2 강화 칸

- **불사조 부활.** 공격 강화(`phoenix_revive` +50% · 3턴)를 `tempBuff`에 그대로 대입했다 — 부활 순간 광폭화 · 영웅의 물약 같은 더 센 강화가 +50%로 약해졌다. 이제 `applyTempBuffRule`을 거친다: 지금 강화가 더 세면 남고 "지금 걸린 강화(공격력 +100% · 3턴)가 더 강해 불사조의 깃털은(는) 적용되지 않았습니다" 같은 안내를 남긴다. 유물 설명의 "3턴 동안 공격력 50% 증가"는 강화 칸 하나를 나누는 다른 강화와 같은 규칙을 따른다(C6 — 이미 더 세게 강화된 상태다).
- **안전지대 초기화는 그대로 둔다.** `clearTemporaryAdventureState`는 안전지대에 들어갈 때 상태 이상 · 원정 유물 보너스 · 임시 강화를 한꺼번에 비우는 원정 종료 규칙이고, 그때 `MSG.TOWN_BUFF_CLEAR`("마을에 돌아와 임시 강화 효과와 상태 이상을 정리했습니다")로 알린다. 강화를 덮어쓰는 문제(C6)가 아니다.
  - 대안(마을에서도 강화를 남긴다)의 대가: 전투가 끝나도 강화 칸은 비지 않는다(남은 턴이 다음 전투로 이어진다) — 마을에서도 남기면 기술 강화의 남은 턴까지 원정을 넘어간다.
  - 한정 조우의 "다음 전투까지" 문구는 원정 안의 약속으로 읽는다. 문구를 바꾸려면 소유자 판단 거리다.

### 64.3 상점 할인 · 주간 특별 상품의 판매 등급

오늘의 할인(플레이어 레벨로 2 ~ 5등급)과 주간 특별 상품(3등급 이상)은 상점의 판매 등급을 보지 않았다. Wave 62 C20이 선언 상한이 있는 북부 요새만 거른 것은 다른 상점을 바이트 그대로 두려는 범위 결정이었다. 이제 재고 · 할인 · 주간 특별 상품이 모두 `getShopMaxTier`(머리말의 "판매 등급 N") 안에서 나온다.

| 상점 | 판매 등급 | 이전에 판매 등급을 넘던 할인(하루 3개 중, Lv5 · 15 · 25 · 40 · 60) |
|---|---|---|
| 시작의 마을 | 1 | 1 · 2 · 3 · 2 · 2개 + 주간 특별 상품(전부 3등급 이상) |
| 여행자의 쉼터 | 3 | 0 · 0(+주간) · 2 · 1 · 1개 |
| 사막 오아시스 | 4 | Lv40 · 60에서 1개 |
| 북부 요새 · 허공의 섬 · 황금 왕국 | 3 · 6 · 6 | 0 |

- 시작의 마을은 이제 주간 특별 상품이 없다 — 1등급만 파는 상점이다. 판매 등급이 6인 상점끼리는 같은 날 같은 할인이다.
- 자연 플레이 드라이버는 재고만 산다 — 이 변경은 측정에 걸리지 않는다.

### 64.4 임무 151 · 154

C9(154 "3회" → 1회)로 두 임무가 같은 목표(종말의 전장에서 종말의 기사 1회 처치)가 됐고 수락 레벨만 73 · 75로 달랐다. 기사는 여정당 한 번 나오므로 Lv73 ~ 74에 151로 먼저 잡으면 154는 그 여정에서 진행할 수 없었다(임무는 여정이 끝나면 사라진다). 154의 수락 레벨을 73으로 맞춰 둘 다 받아 둔 채 한 번의 처치로 함께 진행되게 했다.

**남은 질문(소유자):** 목표가 같은 임무 둘(보상 · 칭호만 다르다)을 그대로 둘지. 154의 목표를 다른 것으로 바꾸면 C9 결정("종말의 기사 1회")을 뒤집는다.

### 64.5 측정

**성장 모델.** 변하지 않았다(진단 증빙은 소스 해시만). 도달 비용 리포트는 임무 154가 Lv75 버킷에서 Lv73 버킷으로 옮겨 간 것뿐이다(73: 1 → 2 · 75: 4 → 3).

**자연 플레이(5경로 48시드 × 계승 4회, 기준 = Wave 62 측정 `w62impl` — 게임 동작은 `main` `acfde282`과 같다).** 드라이버는 할인을 사지 않으므로 이 측정이 보는 것은 불사조 강화 규칙과 임무 154 수락 레벨이다.

| 경로 | 달라진 시드 | 시드당 사망 | 4회 합계 모델 시간 |
|---|---|---|---|
| 전사 > 나이트 | 4 / 48 | 4.02 → 4.00 (z −0.0) | 217.7 → 215.6h (z −0.5) |
| 전사 > 버서커 | 3 / 48 | 5.56 → 5.50 (z −0.1) | 249.7 → 249.7h (z −0.0) |
| 마법사 > 무당 > 시간술사 | 0 / 48 | 5.33 → 5.33 | 252.0 → 252.0h |
| 도적 > 어쌔신 > 그림자 주군 | 0 / 48 | 2.71 → 2.71 | 199.9 → 199.9h |
| 마법사 > 성직자 > 팔라딘 | 7 / 48 | 7.73 → 7.73 (z 0.0) | 227.9 → 227.8h (z −0.0) |

- 위반 0, 타임아웃 0. 모든 칸이 |z| ≤ 0.5다 — 셋 다 드문 순간(불사조가 더 센 강화 위에서 터지는 때 · Lv73 ~ 74에 기사를 잡는 때)에만 걸린다.

### 64.6 테스트 · 결함 주입 · 증빙

- 계약 테스트:
  - `revive-order-contract` +1: 불사조 부활이 더 센 강화(+100% · 3턴)를 남기고 안내하며, 약한 강화(+10% · 1턴)는 불사조 강화로 바뀐다 — 실제 적 공격 사망 경로.
  - `quest-reward-promise-contract` +1: 151 · 154가 같은 수락 레벨이고, Lv73에 둘 다 받아 실제 전투 1턴 전이 한 번의 처치로 둘 다 수령 가능하다.
  - `shop-tier-price-contract`: "다른 상점은 그대로" 하나를 둘로 바꿨다 — 모든 안전지대 상점 × 30일 × 5레벨에서 할인 · 주간 특별 상품이 판매 등급 안(판매 등급이 실제로 거르는 경우가 있다는 대조군 포함, 시작의 마을 주간 특별 상품 없음) / 판매 등급 · 구매가는 이전 규칙 그대로이고 6등급 상점끼리 같은 날 같은 할인. 북부 요새의 "상위 등급 할인은 살 수 없다" 대조군은 위치 없는 호출(이제 판매 등급 1이라 공허)에서 6등급 상점으로 옮겼다.
- 기존 테스트 갱신(모두 위치 없이 할인을 부르던 호출 — 게임 코드의 호출부는 언제나 위치를 넘긴다): `cycle-400-499`(주간 특별 상품 가드가 `null`이면 그냥 통과하던 공허참을 실제 상점 + 존재 단언으로) · `equipment-economy-audit`(기본가 상점에서) · `player-surface-language-readability`(상점 어휘를 6등급 상점에서 렌더).
- 결함 주입(측정 트리와 다른 작업 트리): 불사조 직접 대입 · 할인을 선언 상한만으로 거르기 · 154 수락 레벨 75 — 3종 모두 red.
- 증빙: 도달 비용(154 버킷) · 진단(소스 해시). 탐험 리듬 `reportHash` `0818fb7a` 그대로. 추적 증빙 verify 15종 ok.

## 65. Wave 64 — 임무마다 자기 목표 (2026-10-05, 베이스 = `main` `f6983367` = PR #97 머지)

### 65.1 결정과 범위

§64.4의 질문(151 · 154가 같은 목표)에 소유자 답은 **"동일하면 안 됨 — 각각의 목표가 있어야지"**다. 규칙으로 읽고 카탈로그 143개 전체를 목표 기준(종류 · 대상 · 지역 · 횟수 · 문턱 · 빌드)으로 대조했다. 보상 · 제목 · 수락 레벨은 목표가 아니다. 같은 목표 쌍은 네 개였다. 쌍마다 새 목표는 소유자가 골랐다.

| 쌍 | 이전 목표(둘 다) | 남는 쪽 | 바뀐 쪽 → 새 목표 | 소유자 선택 |
|---|---|---|---|---|
| 151 · 154 | 종말의 전장 종말의 기사 1회 | 151(기사 1회, C9) | 154 → 종말의 전장 **파멸의 기사 10명** | "종말의 전장 정예 처치" |
| 30 · 100 | 레벨 30 달성 | 100(전직 시리즈 10 · 100 · 101) | 30 → 기계 폐도 **프로토타입 제로** 처치(제목 '영웅의 길') | 권장안 |
| 32 · 83 | 빙하 심연 빙결의 마녀 1회 | 83(이야기 단계) | 32 → 마녀 **3회** | 권장안 |
| 64 · 200 | 누적 탐험 50회 | 200(칭호 '대륙의 여행자', C10) | 64 → **누적 골드 10만**(새 종류 `gold_earned`) | 권장안 |

- **151 · 154.** C9가 154를 "기사 3회"에서 1회로 바꾼 결과 생긴 중복이다. 기사 1회는 151에 남긴다(C9 결정 유지). 154는 같은 전장의 일반 조우 파멸의 기사를 10명 잡는다. 파멸의 기사는 여정당 횟수 제한이 없고, 활성 임무 대상이라 사냥 집중(`HUNT_TARGET_FOCUS_CHANCE`)을 받는다. 수락 레벨 73(Wave 63) · 보상 · 칭호 '종말의 정복자'는 그대로다.
- **30 · 100.** 100이 레벨을 맡는다. 30의 새 대상 프로토타입 제로는 어느 임무도 목표로 삼지 않던 기계 폐도 보스다(조우 풀 · `bossMonsters`에 있다). 제목에서 '(2차)'를 뺐다.
  - **수락 레벨 29 → 35.** 질문에는 "기계 폐도(Lv28)"라고 적었는데, 이는 선언 레벨이다. 실제로 걸어 들어갈 수 있는 레벨(경로 게이트)은 35다.
  - 수락 레벨 29를 남기면 받아 두고 여섯 레벨 동안 진행할 수 없다. 그러면 Wave 28이 표시로 안내하는 "목표 지역에 가기 전에 수락되는 임무"(20개)가 21개가 된다.
  - 새로 목표를 정한 임무라 Wave 28의 "수락 규칙은 그대로" 대상이 아니라고 판단했다. 그래서 수락 레벨을 경로 게이트에 맞췄다.
- **32 · 83.** 마녀는 빙하 심연의 일반 조우라 반복된다. 첫 처치는 둘 다 올리고, 83(이야기)은 거기서 끝나며, 32(토벌)는 세 번째에 끝난다. 목표 횟수가 다르면 다른 목표로 본다 — 소유자가 이 선택지를 골랐다.
- **64 · 200.** 이전 두 임무는 같은 평생 기록(`stats.explores`)을 같은 목표로 읽어 함께 끝났다. 1회차 자연 플레이에서 Lv20 탐험 수 중앙값은 260이다. 그래서 수락 레벨 20인 64는 사실상 받는 즉시 완료였다. 64는 제목('황금 수집가')대로 평생 누적 골드(`stats.total_gold`, 업적 '거상' 계열과 같은 기록)를 읽는다.

### 65.2 누적 골드 임무 — 목표값과 진행 갱신

**목표 10만.** 1회차 자연 플레이(5경로 × 12시드, 기준 `wt-w63`)에서 레벨별 누적 골드를 쟀다.

| 레벨 | p10 | 중앙값 | p90 |
|---|---|---|---|
| 20 | 31,229 | 54,466 | 115,661 |
| 25 | 50,874 | 85,462 | 139,233 |
| 30 | 65,090 | 128,725 | 176,627 |

- 10만에 닿는 레벨은 중앙값 26(p10 15 · p90 36)이다.
- 수락 레벨 20에서 이미 채워진 경우는 60회 중 9회다.
- 이전 '탐험 50회'는 사실상 전부 받는 즉시 완료였다.

**진행 갱신은 `grantGold`가 한다.** 평생 기록 임무의 진행도는 탐험 · 전투 승리 · 제작에서만 갱신됐다. 마을에서 번 골드(판매 · 임무 보상 · 업적 · 시즌)로 10만을 넘기면, 다음 탐험 · 전투까지 수령 버튼이 없었을 것이다. Wave 61 제작 임무와 같은 결함 종류다. 이제 `grantGold`가 골드를 더한 뒤 임무 진행을 갱신한다.

- 전투 승리 골드는 이전처럼 승리 정산의 진행 갱신이 함께 센다.
- 비용(음수)은 누적 골드도 진행도도 줄이지 않는다.
- 갱신은 모든 임무를 같은 기록으로 맞춘다(`latch` — 내려가지 않고 목표에서 멈춘다). 그래서 다른 평생 기록 임무도 그 자리에서 맞춰진다.

새 종류는 데이터 · 판정 · 화면에 한 줄씩 들어갔다.

- `QuestType` 9 → 10종.
- `getLifetimeCounterReader`에 한 줄 — 게시판 · 임무 탭의 '누적' 표시가 따라온다.
- 도달 비용 리포트의 시스템 대상에 `total_gold`. 빠지면 64가 값을 못 매기는 임무(fail-closed)가 된다.
- 추적기 · 게시판 문구는 `MSG.QUEST_ROUTE_GOLD` · `QUEST_NEXT_STEP_GOLD` · `QUEST_RETURN_GOLD` · `QUEST_OBJECTIVE_GOLD` · `QUEST_EXTRACTION_GOLD`다. 문구가 없으면 "total_gold 추적"이 그대로 보였을 것이다.

### 65.3 측정

**성장 모델.** 변하지 않았다. 진단 증빙은 소스 해시만 바뀌었다. 시뮬레이터에는 임무가 없다(`grantGold`의 진행 갱신은 임무가 없으면 그대로 반환한다).

**자연 플레이.** 5경로 48시드 × 계승 4회로 쟀다. 기준은 Wave 63 측정 `w63impl`이고, 게임 동작은 `main` `f6983367`과 같다.

| 경로 | 달라진 시드 | 시드당 사망 | 4회 합계 모델 시간 |
|---|---|---|---|
| 전사 > 나이트 | 4 / 48 | 4.00 → 3.83 (z −0.4) | 215.6 → 214.6h (z −0.2) |
| 전사 > 버서커 | 3 / 48 | 5.50 → 5.56 (z 0.1) | 249.7 → 251.2h (z 0.2) |
| 마법사 > 무당 > 시간술사 | 0 / 48 | 5.33 → 5.33 | 252.0 → 252.0h |
| 도적 > 어쌔신 > 그림자 주군 | 0 / 48 | 2.71 → 2.71 | 199.9 → 199.9h |
| 마법사 > 성직자 > 팔라딘 | 0 / 48 | 7.73 → 7.73 | 227.8 → 227.8h |

- 위반 0, 타임아웃 0. 모든 칸이 |z| ≤ 0.6이다.
- 드라이버는 게시판 추천 3개 중 이야기가 아닌 첫 임무를 받는다. 이 측정이 실제로 본 변화는 임무 30뿐이다.
  - 240시드 중 30 수령은 7 → 0이다. 레벨 30으로 끝나던 임무가 Lv35의 보스 처치가 됐고, 드라이버는 그 처치까지 가지 않았다.
  - 32 · 64 · 154 · 151은 두 버전 모두 수령 0이다(추천에 오르지 않거나 그 레벨대까지 가지 않는다).
  - 달라진 7시드는 30의 골드 5,000과 게시판 구성 차이에서 갈렸다.
- 누적 골드 10만 · 파멸의 기사 10명 · 마녀 3회의 체감은 이 드라이버로 재지 못한다. 근거는 §65.2의 레벨별 골드 분포와 계약 테스트다.

### 65.4 테스트 · 결함 주입 · 증빙

- **새 계약 `tests/quest-distinct-objective-contract.test.js`(11건)**
  - 카탈로그 불변식: 같은 목표 쌍 0.
  - 대조군: 이전 네 쌍의 모양을 넣으면 네 쌍이 모두 보이고, 보상 · 수락 레벨만 다른 것은 같은 목표로 잡는다.
  - 구역 보스만으로 나오는 적을 목표로 하는 임무 7개(151 포함)는 모두 1회다. 2회 이상 처치 임무는 조우 풀의 적이다.
  - 쌍마다 실제 스폰 + 실제 전투 1턴 리듀서 전이로, 한쪽 행동이 다른 쪽을 끝내지 않음을 확인한다.
  - 64는 마을 수입(`grantGold`) · 전투 승리 골드 · 추적기 · 게시판 문구까지 확인한다.
- **`quest-reward-promise-contract`:** C9 세 건이 기사 1회를 맡은 151을 본다. Wave 63 건은 "같은 수락 레벨 · 다른 목표 · 기사 처치는 154를 올리지 않는다"로 바꿨다.
- **`data-shape-types`:** `QuestType`에 `gold_earned`.
- **결함 주입 10종 — 모두 red**(측정 작업 트리와 다른 작업 트리).
  - 데이터 되돌리기: 154 기사 1회 · 30 레벨 30 · 30 수락 레벨 29 · 32 마녀 1회 · 64 탐험 50회.
  - 코드 제거: 누적 골드 리더 · `grantGold` 진행 갱신 · 도달 비용 시스템 대상 · 추적기 문구 · 게시판 문구.
- **증빙**
  - 도달 비용: 임무 30이 Lv30 버킷에서 Lv35 버킷으로(30: 2 → 1 · 35: 19 → 20). 154 · 32 · 64는 버킷이 그대로다.
  - 진단: 소스 해시만 바뀌었다. 탐험 리듬 `reportHash` `0818fb7a` 그대로. 유물 · 장비 · 이벤트 보상 증빙은 바이트 동일.
  - 추적 증빙 verify 15종 ok.

## 66. Wave 65 — 원장 §61.5 남은 관찰 4건 (2026-10-05, 베이스 = `main` `152fb03d` = PR #98 머지)

### 66.1 대상과 판정

§61.5(감사 4회차 미확인 · 관찰)의 다섯 줄 중 첫째(이벤트 버프 덮어쓰기)는 Wave 62 C6(`tempBuffMerge`)이 이미 닫았다(`isDominatedByCurrentBuff` 가드는 남아 있지 않다). 남은 넷을 코드와 실데이터로 확인했다. 넷 다 **같은 일을 하는 두 경로가 갈라진** 결함이다.

| 관찰 | 갈라진 두 경로 | 판정 · 처리 |
|---|---|---|
| ① 2지선다 저작 폴백 이벤트에 셋째 선택지 | 저작 결과 ↔ 포장기의 지역 선택지 채우기 | 결함 — 저작 선택지 그대로 |
| ② 그림자 길드 유물 지급 | 체인 직접 지급 ↔ 선택 · 교체 지급(실효 최대치 내리기) | 결함 — 같은 규칙 |
| ③ 묘비 침공 확률 표시 | 화면(저장 공격력) ↔ 침공 판정(실효 공격력) | 결함 — 같은 값 |
| ④ 예고의 "약점" 표시 | 예고(기술 `type`) ↔ 엔진(`type` 없으면 무기 원소) | 결함 — 같은 판정 |

### 66.2 ① 저작 폴백 이벤트의 셋째 선택지

로컬 폴백 풀의 2지선다 저작 이벤트(모든 선택지에 손으로 쓴 결과) 12개가 `buildEventPackage`를 지나며 지역 선택지("살펴본다")로 셋째 칸이 채워졌다. 그 칸에는 절차적 보상이 붙었고, 보상이 손으로 쓴 결과보다 컸다.

- Lv40 기준 셋째 칸: 골드 + 경험 362
- 같은 이벤트의 손으로 쓴 결과 최대값: 55 ~ 355

Wave 27 N1(트랜잭션 이벤트)과 같은 종류다. 이제 출처가 로컬 폴백(`context.source === 'fallback'`)이고 결과가 모든 선택지를 덮으면, 저작한 선택지 그대로 둔다.

- **모델 이벤트는 지금처럼 채운다.** 출처는 호출자 권한이라 모델 응답이 이 분기를 자칭할 수 없다.
- **결과가 없는 2지선다 풀 항목 3개도 지금처럼 채운다.** 선택지마다 절차적 결과라 셋째 칸도 같은 규칙이다.

### 66.3 ② 체인 유물 지급과 실효 최대치

유물은 빌드 성향 점수를 바꾼다. 상인의 인장(`gold_mult`)은 탐험 성향 +1이다. 탐험 성향이 3점에 닿아 비전 성향을 밀어내면, 성향 보너스(기력 +N)가 사라져 실효 최대 기력이 줄어든다.

선택 · 교체 지급(`SELECT_RELIC` · `REPLACE_RELIC`)은 Wave 27 N2부터 `clampVitalsToEffectiveMax`로 현재치를 내렸다. 체인 직접 지급(`RESOLVE_CHAIN_GOLD_CHOICE`)만 그 규칙을 거치지 않았다.

- 예: 모험가 · 나무지팡이 · 허공의 눈 상태에서 최대 기력이 355 → 345로 줄어드는데, 현재 355가 그대로 남았다.
- 합성 조합 탐색에서 437개 조합이 이렇게 줄었다.
- 자연 플레이 스냅숏 3,120개에서는 0이었다. 드문 조합이다.

이제 같은 규칙을 거친다. 최대치가 그대로면 현재치도 그대로이고, 올리지는 않는다.

### 66.4 ③ 묘비 침공 확률

침공 판정(`invadeGrave`)은 실효 공격력을 썼다. 묘비 화면의 성공 확률은 저장 공격력(`player.atk`)을 썼다. 그래서 장비 · 영구 공격력 · 칭호만큼 표시가 실제보다 낮았다.

이제 둘 다 `getInvasionAttackPower`(실효 공격력)를 읽는다. 이 기능은 프로덕션에서 꺼져 있다(`publicGraveInvasion: false`).

### 66.5 ④ 전투 예고의 약점 표시

- 엔진: 기술 원소 = `skill.type`, 없으면 무기 원소(`stats.elem`).
- 예고: `type`만 봤다.

그래서 무기 원소를 쓰는 위력 기술 24개(파워배시 · 암살 · 저격 · 휠윈드 …)는 약점을 찔러도 표시가 없었다. 거짓 주장이 아니라 빠진 표시다.

이제 `getSkillElement`(`systems/skillPower.ts`) 하나를 엔진과 예고가 같이 읽는다. 예고는 위력 있는 기술(`isDamagingSkill`)만 약점을 말한다. 보조 기술은 피해를 굴리지 않으므로(Wave 52) 무기 원소가 약점이어도 말하지 않는다. 지금 데이터에서 위력 없는 원소 `type` 기술은 0개라 이 조건이 새로 막는 표시는 없다.

### 66.6 측정

- **성장 모델:** 변하지 않았다. 진단 증빙은 소스 해시만 바뀌었다.
- **증빙:** 지속 피해 · 골드 배율 유물 증빙은 엔진 소스 해시만 바뀌었다(`getSkillElement`로 같은 계산을 옮겼다).
- **바이트 동일한 증빙:** 도달 비용 · 탐험 리듬 · 이벤트 보상 · 유물 · 장비 증빙.

**자연 플레이.** 5경로 48시드 × 계승 4회로 쟀다. 기준은 Wave 64 측정 `w64impl`이고, 게임 동작은 `main` `152fb03d`과 같다.

- 240시드 전부 바이트 동일하다. 위반 0, 타임아웃 0.
- 드라이버는 이벤트에서 언제나 첫 선택지를 고르므로, 없어진 셋째 칸을 고른 적이 없다.
- 상인의 인장이 최대치를 낮추는 조합은 자연 플레이 스냅숏 3,120개에서 0이었다.
- 표시 2건(침공 · 예고)은 판정을 바꾸지 않는다.
- 이 측정은 "변화 없음"을 확인한 것이다. 넷의 근거는 계약 테스트와 §66.2 ~ §66.5의 실데이터 대조다.

### 66.7 테스트 · 결함 주입 · 증빙

- **새 계약 `tests/observation-sweep-contract.test.js`(9건)**
  - ① 저작 12개 × Lv5/40/80이 저작 선택지 그대로다. 대조군: 같은 모양의 모델 이벤트, 결과 없는 풀 항목은 셋째 칸이 붙는다.
  - ② 실제 훅 + 리듀서로 상인의 인장을 사면 현재 기력이 새 실효 최대치로 내려간다. 대조군: 최대치가 그대로면 현재치도 그대로다.
  - ③ 실효 공격력 = 침공 공격력이고 표시 확률이 그 값을 쓴다. 부재 불변식: 화면 · 액션이 저장 공격력으로 침공 공격력을 만들지 않는다.
  - ④ 무기 원소 위력 기술 24개 × 약점 일치/불일치, 위력 없는 기술 전수, 위력 기술 전수 × 약점 일치/불일치에서 예고 = 엔진(`performSkill`의 속성 약점 태그).
- **기존 테스트 갱신**
  - `combat-forecast-readability`: 약점 예고 픽스처의 화염구에 실제 위력 2.2를 실었다.
  - `cycle-500-599`의 cycle 527 호출부 가드: 새 호출 모양에 맞췄다(채우는 쪽은 같은 spread + slice).
- **결함 주입 8종 — 모두 red**(측정 작업 트리와 다른 작업 트리).
  - 저작 폴백 채우기 · 출처 확인 제거
  - 체인 지급 클램프 제거
  - 침공 공격력 = 저장 공격력 · 화면만 저장 공격력
  - 예고가 `type`만 · 예고에서 위력 판정 제거 · 엔진 원소를 `type`만

### 66.8 남은 관찰

- **공개 묘비의 방어력(`guardPower`)은 올릴 때 저장 공격력이다**(`useFirebaseSync`). 침공하는 쪽은 실효 공격력이라 공격하는 쪽이 크게 유리하다.
  - 자연 플레이 스냅숏 3,200개(Lv48까지): 저장 공격력 최대 204, 실효 공격력 최대 30,218이다. 침공 확률은 상한 90%에 붙는다.
  - 업로드를 실효 공격력으로 바꾸면 54개 스냅숏이 rules 상한(`guardPower` ≤ 9,999)을 넘는다. 그러면 Wave 15 G2와 같은 문서 전체 거부가 생기므로, 바꾸려면 클램프가 함께 필요하다.
  - 기능이 꺼져 있어 지금 플레이어에게는 보이지 않는다. 소유자 판단 거리다(켤 때 함께 정할 것).

## 67. 제품 통합 수용 — 같은 소스의 화면 · 회귀 · 자연 플레이 (2026-10-06, 베이스 = `main` `2ffbded8` = PR #99 머지)

### 67.1 범위와 같은 소스 묶기

할 일 표의 "제품 통합 수용"(최신 화면 · 회귀 · 대표 자연 플레이가 같은 소스에 연결됨)을 수행했다. 세 가지를 모두 `main` `2ffbded8` 한 SHA에 묶었다.

- **자연 플레이:** 별도 작업 트리(`2ffbded8` 그대로)에서 5경로 48시드 × 계승 4회를 다시 돌렸다. 240시드 전부 Wave 65 측정(`w65impl`)과 벽시계 시간만 빼고 바이트 동일하다. Wave 65 측정이 이 SHA와 같은 소스였다는 확인이다.
- **화면:** 같은 SHA의 프로덕션 빌드(QA 시드 API 포함)로 375 · 390 · 430px을 돌았다. 아래 수정은 그 위에 얹었다.
- **회귀:** 수정 뒤 전체 게이트(§67.5).

### 67.2 화면 투어 — 방법

두 단계로 돌았다. 스크린숏은 직접 열어 확인했고, 자동 지표 여섯 개를 화면마다 쟀다.

- **1단계(새 게임):** 인트로 → 마을 → 원정 출발 → 탐험(이벤트 · 전투) → 전투 결과 → 귀환 · 원정 정리 → 휴식 → 기록 탭 11개. 실제 UI 조작이고, 난수만 시드를 고정했다.
- **2단계(후반 상태):** 이번 자연 플레이가 남긴 플레이어 스냅숏(9,600개 중 나이트 Lv44 계승 3단계 · 유물 6 · 가방 35칸 · 85만 골드, 드래곤 나이트 Lv48 1회차)을 격리된 QA 저장소로 불러왔다. 그 상태로 상태바 · 기록 탭(장비 · 가방 · 임무 · 업적 · 기술 · 지도 · 상태 · 도감 · 시즌, 긴 탭은 아래까지) · 실제 탐험 · 전투 · 전투 결과를 봤다.
- **지표:** 문서 가로 넘침 · 화면 밖 요소 · 11px 미만 글자 · 44px 미만 버튼 · 잘린 글자 · 위치 유틸리티와 실제 위치의 불일치.

### 67.3 결함 다섯 건과 수정

| # | 결함 | 폭 | 원인 | 수정 |
|---|---|---|---|---|
| ① | 전투 결과 카드가 하단 고정 오버레이가 아니었다. 흐름 안에서 오른쪽으로 12px 밀려 오른쪽 4px가 잘렸고, 위 기록을 덮었다. 카드 안 라벨이 8 ~ 10px였다 | 세 폭 모두 | `.panel-noise { position: relative }`가 `@tailwind utilities` 뒤에 선언돼 같은 요소의 `fixed`를 덮었다(2026-08부터). 카드는 모바일 가독성 계약 밖이었다 | `.panel-noise.fixed`가 고정을 지킨다. 카드 글자 11px |
| ② | 현재 지역 카드에서 "추천" 칩과 추천 지역 이름("암흑 성")이 세로로 한 글자씩 꺾였다 | 375 · 390 | 칩과 이름이 함께 줄어들었다 | 칩은 줄지 않고, 한 줄에 안 들어가면 지역 이름이 다음 줄로 내려간다 |
| ③ | 상태바에서 두 글자 이름 "용사"가 "용…"이 됐다 | 375 | 이름과 지역이 함께 줄어들었다 | 이름은 상한(6.5rem)까지 줄지 않고 지역이 줄어든다 |
| ④ | 지도 · 이동 버튼 폭 40px, 전투 기록 펼치기 높이 32px · 10px 글자 | 세 폭 모두 | 최소 크기 없음 | 44px · 11px |
| ⑤ | 한국어가 낱말 안에서 꺾였다("탐험 1회 진/행" · "모닥/불" · "연속 처/치가") | 세 폭 모두 | 본문 기본 줄바꿈 | 본문 기본값 `word-break: keep-all` + `overflow-wrap: anywhere` |

⑤는 칸마다 고치지 않고 본문 기본값에서 잡았다. `anywhere`는 최소 폭을 늘리지 않는다. 그래서 낱말 단위 줄바꿈이 새 가로 넘침을 만들지 않는다. 두 단계 투어를 수정 전후로 다시 돌린 결과(§67.5), 가로 넘침 0 → 0이고 새 잘림 · 새 화면 밖 요소는 0이다.

②는 ⑤를 넣은 뒤 한 번 더 고쳤다. 칩만 고정했을 때 375px에서 지역 이름이 세로로 꺾였다. 줄바꿈 허용(`flex-wrap`)으로 이름이 칩 아래로 내려가게 했다.

전투 중 상태바의 `sticky`도 실제로는 `relative`다. 다만 전투 모드 규칙이 의도적으로 둔 값이고, 전투 화면은 페이지 스크롤이 없어 보이는 영향이 없다. 결함으로 보지 않았다.

### 67.4 자연 플레이 — 대표 결과

5경로 48시드 × 계승 4회, `main` `2ffbded8`. 위반 0, 타임아웃 0.

| 경로 | 시드당 사망 | 4회 합계 모델 시간 | 86 수령(1회차, 중앙) | 87 수령(중앙 · p90) |
|---|---|---|---|---|
| 전사 > 나이트 | 3.83 | 214.6h | 48/48 · 61.5h | 61.5h · 79.2h |
| 전사 > 버서커 | 5.56 | 251.2h | 48/48 · 79.4h | 79.6h · 107.0h |
| 마법사 > 무당 > 시간술사 | 5.33 | 252.0h | 48/48 · 84.2h | 86.0h · 124.0h |
| 도적 > 어쌔신 > 그림자 주군 | 2.71 | 199.9h | 48/48 · 62.4h | 62.5h · 69.5h |
| 마법사 > 성직자 > 팔라딘 | 7.73 | 227.8h | 48/48 · 70.5h | 70.6h · 94.4h |

- **이야기 86 → 87:** 240시드 모두 첫 회차에 두 장을 받았다. 86 다음 87까지 중앙 0.06 ~ 0.12h이다. 87 진행 중 사망은 240시드 합 1회다. 이전 수용(2026-09-28)이 남긴 "86/87 자연 진행"은 이것으로 닫는다.
- **계승 화면:** 240시드 모두 봤고 최종 계승 단계는 4다.
- **진 엔딩(원시의 파편 3개):** 드라이버는 첫 마왕 처치마다 바로 계승하고 파편을 추적하지 않는다. 자연 플레이 증거가 없다. 진 엔딩 경로는 기존 e2e(`true-ending-new-game-plus`)의 시드 시나리오가 지킨다.
- **화면 수정은 판정 · 저장 · 수치를 바꾸지 않는다.** 그래서 자연 플레이를 다시 돌리지 않았다(수정은 CSS · 클래스뿐이다).

### 67.5 테스트 · 결함 주입 · 게이트

- **새 계약 `tests/e2e/product-acceptance-layout.spec.ts`(6건 = 2종 × 3폭)**
  - 새 게임: 본문 줄바꿈 규칙이 `keep-all` · `anywhere`이고, 원정 준비 칸이 낱말 안에서 꺾이지 않는다.
  - 후반 상태(두 글자 이름 · 긴 지역 · 6자리 골드): 이름이 잘리지 않는다. 현재 지역 카드가 낱말 안에서 꺾이지 않는다. 지도 · 이동이 44px이다. 전투 결과 카드가 고정 · 가운데 정렬 · 화면 안이고 11px 미만 글자가 없으며 선택 버튼이 44px이다. 전투 기록 펼치기가 44px이다.
  - 낱말 안 줄바꿈은 글자마다 줄 위치를 재서, 줄이 바뀐 자리 앞뒤가 둘 다 한글이면 센다.
  - 44px은 반 픽셀 아래까지 같은 크기로 본다. 배치 계산이 44px을 43.99997px로 읽은 실행이 있었다.
- **결함 주입 8종 — 모두 red**(측정 작업 트리와 다른 작업 트리).
  - 고정 규칙 제거(3 red) · 카드 라벨 8px(3) · 칩 래퍼 + 줄바꿈 허용 제거(2, 375 · 390) · 이름 `shrink`(1, 375) · 지도 버튼 최소 폭 제거(3) · 기록 펼치기 32px(3) · 본문 `keep-all` 제거(5) · 줄바꿈 허용만 제거(1, 375).
- **전체 게이트:** type-check · lint · build:guard · build · e2e 146건(75 + 71) · perf desktop/mobile(FCP 568 · 464ms)이 통과했다.
  - 첫 실행에서 단위 테스트 1건(성장 진단 증빙 바이트)이 실패했다. 진단 증빙은 `src/`의 모든 `.ts`/`.tsx` 해시를 묶는다. 재작성한 결과 바뀐 것은 이번에 고친 컴포넌트 4개의 해시뿐이고 보고서 본문은 같다.
  - 재실행: 단위 5,854/5,854(424파일 · skip 0), 추적 증빙 verify 15종 ok.
- **투어 지표(수정 전 → 최종 빌드, 두 단계 137화면):** 가로 넘침 0 → 0, 위치 불일치 15 → 9(남은 9는 §67.3의 전투 상태바), 44px 미만 버튼 168 → 129, 11px 미만 글자 2,108 → 2,068, 잘린 글자 90 → 69. 새로 생긴 잘림 · 화면 밖 요소 0. 남은 화면 밖 요소는 배경 장식(흐림 원 · 오로라 애니메이션)이다.

### 67.6 남은 관찰 — 소유자 판단

- **기술 재사용 대기가 다음 전투로 넘어간다.** 재사용 대기는 전투 턴에만 줄고, 전투가 끝나도 비워지지 않는다. 휴식 · 귀환에서도 그대로다.
  - 자연 플레이 대기 상태 스냅숏 9,600개 중 92.1%가 재사용 대기 중인 기술을 들고 다음 전투로 간다. 남은 턴은 1 ~ 10이다.
  - 후반 투어에서 새 전투가 "프로스트 노바 · 2턴 후"로, 기술 버튼이 잠긴 채 시작했다.
  - 바꾸면 기술 사용이 늘어 난이도가 내려간다. 규칙 결정이라 측정과 함께 소유자에게 묻는다.
- **`font-fira` 한국어 간격(이 환경에서만 확인).** `font-fira`가 걸린 한국어(임무 탭 요약 · 세트 효과 · 원정 진행 줄)가 이 Linux Chromium에서 고정폭 대체 글꼴로 넓게 벌어진다. iPhone은 대체 글꼴이 달라 다르게 보일 수 있다. iPhone 화면 검증에서 함께 볼 것.
- **기록 탭의 작은 조작:** 가방 분류 30px · 빠른 칸 지정 24px · 강화 보기 31 ~ 38px · 상세 보기 38px. 핵심 원정 화면이 아니라 이번에는 고치지 않았다.
- **문구 · 표시 다듬기:** 양손 무기를 든 보조 장비 칸이 "양손 무기가 함…"으로 잘린다. 같은 전리품 두 개가 "벌레 껍질 · 벌레 껍질"로 따로 나온다. 375px 기술 탭 제목이 "나이트 전투 …"로 잘린다.

### 67.7 이 환경에서 하지 않은 것

- **iPhone 화면 · lifecycle 검증:** 소유자 기기와 시간이 필요하다. 수행하지 않았다.
- **네이티브:** 이 Linux 컨테이너에는 Android SDK와 Xcode가 없다. `cap:sync` · Android debug · iOS unsigned 빌드는 실행하지 않았다. 이전 수용 기록(2026-09-28)의 네이티브 결과를 이번 SHA의 결과로 옮기지 않는다.
- **Android:** 에뮬레이터 결과와 실기기 수용은 구분한다. 소유자에게 Android 실기기는 없다.
- **서명 · 업로드:** 제품 수용 뒤 별도 릴리스 단계다.

## 68. Wave 66 — 기술 재사용 대기는 전투마다 · 결제는 등록 뒤 (2026-10-06, 베이스 = `main` `27cc3ac1` = PR #100 머지)

### 68.1 소유자 결정

- **기술 재사용 대기:** "기술 대기시간은 전투시마다 새로 시작하는 걸로 하자. 어차피 마나나 기력 등으로 비용이 있기 때문에 기술을 무한정으로 쓸 수는 없어." §67.6의 질문(대기가 다음 전투로 넘어간다)에 대한 답이다.
- **결제:** "결제 기능은 추후로 미루고, 일단 등록해서 유저들의 반응을 본 후에 결제 시스템을 통해서 게임의 재미나 난이도를 더 즐길 수 있는 걸로 하자."

### 68.2 결제 — 지금 코드의 상태와 처리

출시 빌드에서 결제를 빼는 작업이 필요한지 먼저 조사했다. 실제 돈을 받는 경로는 저장소 어디에도 없다.

| 표면 | 실제 결제 | 지금 상태 |
|---|---|---|
| 에테르 교환소(`PremiumShop`) | 없음 | 플레이로 얻은 크리스털만 쓴다(주간 임무 · 도감 · 업적 · 발견). 화면 문구는 "교환"이고 돈 가격이 없다 |
| 토스 SDK(`@apps-in-toss/web-framework`) | 없음 | SDK는 `IAP` · `checkoutPayment` · `requestTossPayPaysBilling`을 내보내지만 src는 하나도 가져오지 않는다 |
| 네이티브(Android · iOS) | 없음 | 결제 권한 · StoreKit · 결제 SDK 의존성 0 |
| 시즌 패스 프리미엄 트랙 | 없음 | `isPremium`을 켜는 코드가 없다(이전 세이브 호환만) |
| 보상형 광고(귀환 보급) | 결제 아님 | 토스 런타임 + 광고 그룹 환경 변수가 있어야 켜진다. 기본 빌드 · Capacitor 빌드에서는 꺼져 있다 |

출시 문서도 이미 같은 방향이다. 인앱 결제를 출시 전제 조건으로 적은 문서는 없고, 여러 문서가 "Soft Launch 이후 별도 승인"으로 미뤄 두었다(`tasks/todo.md`, `docs/APPS_IN_TOSS_SOFT_LAUNCH.md` 등).

**처리:** 코드를 뺄 것은 없다. 대신 이 상태가 결정 없이 바뀌지 않게 부재 계약을 넣었다(`tests/launch-no-payment-contract.test.js`).

- src가 토스 SDK의 결제 API를 가져오지 않는다. 금지 목록은 SDK가 내보내는 결제 계열 이름을 직접 읽어 만든다.
- 결제 SDK 의존성 · 안드로이드 결제 권한 · iOS StoreKit이 없다.
- 교환소 상품은 모두 크리스털 비용이고 돈 가격 필드가 없다.

결제를 넣을 때는 이 계약을 함께 고쳐 결정을 남긴다. 그때의 설계 방향은 소유자 문구 그대로 "게임의 재미나 난이도를 더 즐길 수 있는 것"이다.

### 68.3 재사용 대기 — 구현

대기는 전투 턴에만 줄어서(`tickCombatState`) 전투가 끝나도 남았다. 휴식 · 귀환에서도 그대로였다. 대기 상태 스냅숏 9,600개의 92.1%가 잠긴 기술을 들고 다음 전투를 시작했다(§67.6).

이제 전투 한 판의 범위를 끝내는 `endCombatScope`(`utils/combatScope.ts`)가 유물 종료(`endCombatScopedRelics`, Wave 57)를 감싸고 재사용 대기를 비운다. 전투가 끝나는 모든 경로가 이것을 부른다.

| 경로 | 위치 |
|---|---|
| 승리(정산 전) | `CombatEngine.handleVictory` — 마왕 처치 직후 이어지는 진 보스전도 이 정산을 거친다 |
| 패배 | `combatActionTurn` · `combatItemTurn`의 패배 정산 |
| 도주 · 강제 이탈 | `combatActionTurn` |
| 전투가 아닌 모드로 복원 | `LOAD_DATA` — 전투로 복원하면 그대로 둔다 |
| 다음 전투 시작 | `applyBattleStartRelics` — 이전 세이브에 남은 대기도 여기서 비운다 |

같은 전투 안의 대기는 그대로 작동한다. 대기를 줄이는 유물(시간의 파편 · 시간 군주의 왕관 · 시간의 지배자)도 그대로다.

### 68.4 측정

5경로 48시드 × 계승 4회로 쟀다. 기준은 `w65impl`(= `main` `27cc3ac1`과 게임 동작 동일, §67.1)이다. 위반 0, 타임아웃 0.

| 경로 | 전투당 기술 | 전투 턴 포함 행동 수 | 시드당 사망 | 보스전 사망 | 4회 합계 모델 시간 |
|---|---|---|---|---|---|
| 전사 > 나이트 | 0.82 → 1.24 | −6% (z −3.1) | 3.83 → 3.81 (z 0.0) | 0.52 → 0.90 (z 2.3) | 214.6 → 217.0h |
| 전사 > 버서커 | 0.65 → 1.24 | −9% (z −4.4) | 5.56 → 4.81 (z −1.6) | 0.75 → 0.63 | 251.2 → 235.1h (z −2.9) |
| 마법사 > 무당 > 시간술사 | 0.49 → 0.92 | −9% (z −3.5) | 5.33 → 5.00 (z −0.7) | 1.40 → 1.56 | 252.0 → 246.0h |
| 도적 > 어쌔신 > 그림자 주군 | 0.65 → 1.07 | −3% (z −1.9) | 2.71 → 3.31 (z 1.5) | 0.10 → 0.50 (z 3.7) | 199.9 → 204.3h |
| 마법사 > 성직자 > 팔라딘 | 1.05 → 1.25 | −16% (z −8.5) | 7.73 → 7.77 (z 0.1) | 1.10 → 1.19 | 227.8 → 218.8h |

- **일반 전투가 짧아졌다.** 전투당 기술 사용이 1.2 ~ 1.9배가 됐고, 전투 턴 포함 행동 수가 3 ~ 16% 줄었다.
- **보스전 사망은 나이트 · 어쌔신에서 늘었다.** 원인을 따로 쟀다(나이트 · 어쌔신 16시드 × 계승 4회, 보스전 시작 시점 기록).

| 경로 | 보스전 시작 기력(중앙) | 기력 25% 미만으로 보스전 시작 | 시작 생명(중앙) |
|---|---|---|---|
| 나이트 | 0.86 → 0.69 | 10.2% → 19.2% | 1.00 → 1.00 |
| 어쌔신 | 0.875 → 0.67 | 7.2% → 18.9% | 1.00 → 1.00 |

- **해석:** 기력이 비용으로 작동한다. 일반 전투마다 기술을 쓰면 보스 조우 때 기력이 모자란다. 이전에는 잠긴 대기가 사용을 강제로 나눠서 보스전에 기력이 남아 있었다. 이제는 기력을 아낄지를 플레이어가 고른다. 이 드라이버는 매 전투 기술을 쓰는 정책이라 그 대가를 그대로 받는다.
- 소유자 원칙("난이도 차이를 적 · 기술 수치 보정으로 메우지 않는다", §53.1)에 따라 수치를 보정하지 않았다.
- **성장 모델:** 변하지 않았다(시뮬레이터는 기술을 쓰지 않는다). 진단 · 유물 경험 · 골드 배율 증빙은 고친 엔진 파일의 소스 해시만 바뀌었다.

### 68.5 테스트 · 결함 주입

- **`tests/skill-cooldown-combat-scope.test.js`(7건)**
  - 남은 대기를 비우고, 끝낼 것이 없으면 같은 참조를 돌려준다.
  - 같은 전투 안에서는 대기가 그대로 작동한다(대조군).
  - 승리: 기술 마무리 · 공격 마무리 · 승리 정산 자체.
  - 도주 성공.
  - 복원: 전투가 아닌 모드는 비우고, 전투 복원은 그대로 둔다.
  - 전투 시작: 이전 세이브처럼 대기를 든 채 시작해도 비운다.
  - 부재 불변식: 전투 종료 경로가 `endCombatScopedRelics`를 직접 부르지 않는다.
- **`tests/launch-no-payment-contract.test.js`(3건)** — §68.2.
- **결함 주입 11종 — 모두 red**(측정 작업 트리와 다른 작업 트리).
  - 대기: 비우지 않음(5 red) · 복원 경로(2) · 승리 경로(2) · 도주 경로(1) · 전투 시작 경로(1) · 전투 복원까지 비움(1) · 전투 안 대기 무력화(1).
  - 결제: 토스 IAP 가져오기 · 안드로이드 결제 권한 · StoreKit · 돈 가격 필드(각 1).

### 68.6 남은 관찰

- **보상형 광고(귀환 보급)는 결제와 별개다.** 토스 빌드에서 광고 그룹 환경 변수를 넣을 때만 켜진다. 출시 때 켤지는 별도 결정이다(`docs/APPS_IN_TOSS_SOFT_LAUNCH.md`의 광고 활성화 게이트).

## 69. Wave 67 — 기록 탭 조작 44px · 잘림 대신 줄넘김 · 같은 전리품 묶기 (2026-10-06, 베이스 = `main` `2b1bf321` = PR #102 머지)

### 69.1 범위

§67.6에 남긴 관찰 중 규칙 결정이 필요 없는 화면 결함을 닫았다. 대상은 기록 탭의 작은 조작, 잘리는 글, 같은 전리품이 두 번 나오는 요약이다. 소유자 기기 확인(런북 `docs/qa/IPHONE_ACCEPTANCE_RUNBOOK.md`)과 겹치는 화면을 미리 줄여 두려는 목적이다. 판정 · 저장 · 수치는 바꾸지 않았다.

### 69.2 수정

| # | 결함(§67 투어) | 수정 |
|---|---|---|
| ① | 기록 탭 조작이 44px보다 작았다. 가방 분류 · 추천 장착 · 일괄 정리 30px, 빠른 칸 24×24, 사용 · 강화 보기 38px, 장비 강화 보기 31px, 상세 보기 38px(장비 · 가방 · 상점), 세트 목록 32px, 성장 조언 36px, 임무 게시판 42px | 모두 44px(`min-h-11`, 빠른 칸 · 해제 버튼은 `h-11 w-11`). 빠른 칸 줄은 좁으면 다음 줄로 넘어간다 |
| ② | 375px 기술 탭 제목이 "나이트 전투 …"로 잘렸다. 오른쪽 "현재 선택"(무기 기술 이름 "프로스트 노바 · 빙원의 장창")이 줄지 않았다 | 헤더가 줄을 넘긴다. 제목은 잘리지 않고 "현재 선택"이 다음 줄로 내려간다 |
| ③ | 375 · 390px 보조 장비 칸이 "양손 무기가 …"로 잘렸다 | 장비 칸 이름은 두 줄까지 넘긴다(`line-clamp-2`) |
| ④ | 가방 카드 설명 줄이 상세 보기를 켜도 "한손 무기 · 공…"으로 잘렸다 | 줄을 넘긴다. 상세 보기를 켠 사람에게 말줄임은 정보를 숨긴다 |
| ⑤ | 같은 전리품 두 개가 "벌레 껍질 · 벌레 껍질"로 나왔다 | `utils/lootSummary.ts`가 처음 나온 자리에서 "이름 x개수"로 묶는다. 전투 결과 카드와 전투 정리 로그가 같은 판정을 읽는다. 남은 수("외 N" · "+N")는 아이템 개수다(카드의 "전리품 N개"와 같은 단위) |

### 69.3 투어 재측정(같은 두 단계, 수정 전 = §67 최종 빌드)

| 단계 | 화면 | 44px 미만 버튼 | 잘린 글자 | 11px 미만 글자 | 가로 넘침 | 위치 불일치 |
|---|---|---|---|---|---|---|
| 1단계(새 게임) | 72 → 72 | 40 → 0 | 27 → 27 | 845 → 836 | 0 → 0 | 6 → 6 |
| 2단계(후반 상태) | 65 → 68 | 89 → 1 | 42 → 31 | 1,223 → 1,230 | 0 → 0 | 3 → 3 |

- **남은 버튼 1개:** 빠른 칸 3번을 반올림 경계에서 44×44로 잰 것이다.
- **남은 잘림:** 화면 낭독기 전용 라벨(`sr-only` — 소개 화면 이름 · 추천 경로 · 원정 임무 구성)과 상태바 지역 이름이다. 지역 이름은 §67.3 ③에서 의도적으로 줄이도록 정했다.
- **2단계 화면 +3:** 기록 탭이 길어져 아래로 스크롤한 화면이 생겼다. 화면 밖 요소 증가(260 → 272)는 그 화면들의 배경 장식(흐림 원 · 오로라)이다. 두 실행 모두 화면 밖 요소는 글자 · 테스트 식별자가 없는 장식뿐이다.
- 수정 전후 비교 그림 · 영수증: `docs/evidence/qa/archive-polish-20261006/`.

### 69.4 테스트 · 결함 주입

- **`tests/e2e/product-acceptance-layout.spec.ts` + 3건(기록 탭 × 375 · 390 · 430).**
  - 자연 플레이 스냅숏에서 기록 탭 화면을 만드는 부분만 옮긴 나이트 Lv44를 쓴다. 양손 무기 · 장착 못 하는 무기 · 소모품 · 재료 · 무기 기술 선택이 들어 있다.
  - 장비(상세 보기) · 가방(상세 보기) · 임무 · 지도 탭에서 화면에 보이는 모든 버튼이 44px이다.
  - 기술 제목 · 양손 무기 보조 칸 · 가방 설명 줄이 자기 칸 밖으로 넘치지 않는다.
- **`tests/loot-summary-contract.test.js`(4건):** 묶기 순서 · 개수, 남은 수의 단위, 카드 렌더, 전투 정리 로그.
- **결함 주입 15종 — 모두 red.**
  - e2e 13종: 분류 30px · 빠른 칸 24px · 사용 38px · 가방 강화 보기 38px · 장비 강화 보기 31px · 장비 상세 보기 38px · 가방 상세 보기 38px · 세트 목록 32px · 성장 조언 36px · 임무 게시판 42px · 설명 줄 말줄임은 각 3 red. 장비 칸 말줄임은 2 red(375 · 390 — 430은 들어간다). 수정 전 기술 헤더 전체는 1 red(375 — 원래 결함도 375에서만 보였다).
  - 단위 2종: 카드 · 로그를 묶지 않고 이어 붙이기(각 1 red).
  - **충실하지 않은 주입 1종:** 기술 헤더에서 줄넘김만 뺐을 때는 통과했다. 제목에 말줄임이 더는 없어서 잘리지 않고 넘친다. 원래 결함은 수정 전 헤더 전체 주입이 재현한다.
- **전체 게이트:** type-check · lint · 단위 5,868/5,868(427파일 · skip 0) · build:guard · build · e2e 149건(75 + 74) · perf desktop/mobile(FCP 672 · 480ms)이 통과했다. 성장 진단 증빙은 소스 해시만 바뀌었고 보고서 본문은 같다.

### 69.5 남은 관찰

- **가방 카드의 오른쪽 버튼 열.** 375px에서 버튼 열(강화 보기 + 제한/사용)이 넓어서 무기 설명이 네 줄까지 넘어간다. 잘리지는 않지만 카드가 길다. 버튼을 카드 아래로 내리는 배치는 화면 구조 변경이라 따로 판단한다. Linux의 `font-fira` 한국어 간격이 폭을 키우므로(§67.6), iPhone 결과(런북 항목 6)를 본 뒤 정한다.
- **§67.6의 나머지:** `font-fira` 한국어 간격은 iPhone 확인을 기다린다. §66.8 묘비 공격력 비대칭과 보상형 광고 활성화는 소유자 판단으로 남는다.

## 70. Wave 68 — 가방 카드 버튼 열 · `font-fira` 한국어 간격의 원인 (2026-10-06, 베이스 = `main` `d80ff8d3` = PR #103 머지)

소유자 지시 "게임 완성 후에 실기기 테스트"에 따라, 실기기 결과를 기다리던 두 관찰(§67.6 `font-fira` 한국어 간격 · §69.5 가방 카드 버튼 열)을 지금 판단했다.

### 70.1 가방 카드 버튼 열(§69.5) — 수정

- **결함:** 375 · 390px에서 오른쪽 버튼 열(강화 보기 + 사용/제한, 약 135px)이 설명 칸을 115px까지 좁혔다. 무기 설명이 네 줄로 꺾였다.
- **수정:** 카드가 줄을 넘긴다. 설명 칸은 10rem(160px)보다 좁아지지 않는다. 그보다 좁아질 상황이면 버튼 열이 다음 줄 오른쪽으로 내려간다.
  - 소모품처럼 버튼이 하나뿐인 카드는 그대로 한 줄이다.
  - 430px에서는 장비 카드도 한 줄이다(설명 칸 171px).
- **계약:** `tests/e2e/product-acceptance-layout.spec.ts`의 기록 탭 3건에 "화면의 모든 가방 카드 설명 칸 ≥ 160px"를 더했다.
- **결함 주입(이전 배치):** 2 red(375 · 390), 1 통과(430 — 원래도 171px였다).

### 70.2 `font-fira` 한국어 간격(§67.6) — 원인

§67.6은 "Linux의 고정폭 대체 글꼴 때문이고, iPhone은 대체 글꼴이 달라 다를 수 있다"고 적었다. 재 보니 원인이 달랐다.

- **한글 폭은 대체 글꼴과 무관하다.** 한글만 있는 같은 문장의 폭은 현행 묶음(`'Fira Code', monospace`) · 본문 묶음 · 둘을 이은 묶음에서 모두 256px로 같다.
- **넓어 보이는 것은 공백 · 숫자 · 기호다.** 문장에 공백 · 숫자가 섞이면 현행 묶음이 218px, 본문 묶음이 184.5px다. 고정폭 글꼴의 공백은 0.6em이고, 본문 글꼴의 공백은 약 0.25em이다.
- **그래서 iPhone에서도 같다.** Fira Code가 정상으로 로드되면 공백 · 숫자는 Fira Code에서 온다. 이 환경은 Google Fonts가 인증서 오류로 막혀 Fira Code가 로드되지 않았다. 그래서 고정폭 대체 글꼴(DejaVu Sans Mono)로 보였을 뿐, 공백 폭은 같다. 실제 Fira Code(woff2)를 주입한 비교에서도 같은 간격이 나왔다.
- **범위가 넓다.** 두 단계 투어 140화면에서 고정폭으로 그려진 한국어는 1,507건 · 40종 요소다.
  - 터미널 기록 줄 · 전투 결과 서술 · 아이템 이름 · 라벨 · 주간 임무 · 강화 비용 줄 · 기록 배지 등이다.
  - 몇 칸의 실수가 아니라 게임 전체의 "터미널" 디자인 언어다.

### 70.3 소유자 결정 거리 — 한국어 낱말 간격

실제 Fira Code로 같은 화면 둘을 찍었다(`docs/evidence/qa/typography-options-20261006/`, 375px).

| 안 | 모습 | 얻는 것 | 잃는 것 |
|---|---|---|---|
| A 현행 | "이번  원정  ·  3/3", "세트  기여  없음" — 낱말 사이 0.6em | 터미널 느낌이 그대로다. 숫자 · 기호 정렬이 고정폭이다 | 한국어 문장이 성기게 읽힌다. 공백 · 숫자가 섞인 문장은 같은 내용이 약 18% 길다(218 대 184.5px) |
| B 공백 · 한글은 본문 글꼴 | "이번 원정 · 3/3" — 숫자 · 영문 · 기호는 Fira Code 그대로 | 한국어가 본문처럼 붙어 읽힌다. 숫자는 여전히 고정폭이다 | Fira Code를 저장소에 두고(유니코드 범위에서 공백을 뺀 `@font-face`) 글꼴 묶음을 바꿔야 한다. 공백이 섞인 영문 · 숫자 열 정렬은 조금 흔들린다 |

- B를 고르면 Fira Code를 Google Fonts 대신 저장소에서 내려받는다. 앱이 오프라인일 때도 같은 글꼴이 나오는 이점이 함께 온다. 대신 빌드에 woff2 두 개(약 40KB)가 늘어난다.
- 실기기 런북 항목 6은 이 결정이 반영된 화면을 보도록 고쳤다.

### 70.4 테스트 · 투어 · 게이트

- **계약:** 기록 탭 e2e 3건에 가방 카드 설명 칸 ≥ 160px를 더했다. 결함 주입(이전 배치)은 2 red(375 · 390)였다.
- **투어 재측정(두 단계, 수정 전 = `main` `d80ff8d3`):** 새 잘림 · 새 작은 버튼 · 가로 넘침이 0이다. 고정폭으로 그린 한국어는 1,507 → 1,509건이다(그림 위치만 달라졌다).
- **전체 게이트:** type-check · lint · 단위 5,868/5,868(427파일 · skip 0) · build:guard · build · e2e 149건(75 + 74) · perf desktop/mobile(FCP 680 · 500ms)이 통과했다. 성장 진단 증빙은 소스 해시만 바뀌었다.
