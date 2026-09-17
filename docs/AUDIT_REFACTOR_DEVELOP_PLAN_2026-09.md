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

**남은 후보 (Wave 5)**: `monster-catalog-art`를 Codex 자체 패턴(디코딩 픽셀 동일성)으로 전환, `natural-exploration-rhythm` e2e의 외부 요청 허용 목록, `system-settings-design:101` 서브픽셀 허용치, `Player.quests/status/history: any[]` 타입화, `low_hp_atk` 숫자 val 레거시 경로 정리, `exp_mult` 스택 정책 통일, 정적 가드 잔여 ~40파일, 잔여 `: any` ~1,290(주입 경계·콜백 파라미터).
