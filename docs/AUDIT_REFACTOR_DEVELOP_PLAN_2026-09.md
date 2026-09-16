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
