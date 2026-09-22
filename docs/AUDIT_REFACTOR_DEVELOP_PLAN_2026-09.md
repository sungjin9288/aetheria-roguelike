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
