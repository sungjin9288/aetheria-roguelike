# CLAUDE.md — Aetheria Roguelike

## 1. 프로젝트 개요

하이 판타지 배경의 텍스트 기반 roguelike RPG(에테르·마법·용·신 — 실측: `src/data/*.ts`에 사이버·해킹·안드로이드·나노·전자·네트워크 어휘 각 0건, 에테르 232 / 기계 75). Prestige 시스템, AI 생성 이벤트, Firebase 클라우드 세이브, Capacitor 기반 iOS/Android 지원, 완전 한국어 UI를 포함한다.

---

## 2. Tech Stack

| 분류 | 기술 | 버전 |
|------|------|------|
| UI Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Styling | TailwindCSS | 3.4.17 |
| Animation | Framer Motion | 12.34.2 |
| Icons | Lucide React | 0.563.0 |
| Charts | Chart.js + react-chartjs-2 | 4.5.1 / 5.3.1 |
| Backend | Firebase (Auth + Firestore) | 12.8.0 |
| Mobile | Capacitor | 8.1.0 |
| Language | **TypeScript** (`.ts`/`.tsx`, `strict: true`) | 5.x |
| Test | Node.js built-in `test` (실행은 `tsx` 로더) | — |
| Linter | ESLint | 9.39.1 |
| Node.js | — | >=18.0.0 |

> **TypeScript 사용** — 전 소스 `.ts`/`.tsx` (파일 확장자 기준 마이그레이션 **100% 완료**, `.js`/`.jsx` 0개).
> `tsconfig` `strict: true` + `tsc --noEmit` 0 에러. **src의 명시 `any`는 0이다**(2026-09-18 Wave 9 완료 —
> `@typescript-eslint/no-explicit-any`가 `error`, `tests/debt-ratchet.test.js`는 `: any` 1(문자열 리터럴)/`as any` 0 상한 이중 가드).
> `Player`의 `quests/status/history`는 `QuestProgressState`/`StatusId[]`/`EventHistoryEntry`로 닫혔고,
> utils 8파일(`aiEventUtils`·`questOperations`·`graveUtils`·`gameUtils`·`adventureGuide`·`expeditionMissionFocus`·
> `expeditionLedger`·`equipmentUtils`)은 `: any` 0이다. **주입 경계는 `src/hooks/actionDeps.ts`가 소유한다** —
> `GameActionDeps`/`CombatActionDeps`/`InventoryActionDeps`로 액션 팩토리 deps를 받고, 컴포넌트의 `actions` prop은
> `Pick<GameActions, …>`로 필요한 액션만 받는다(`actions?: any` 금지). 세션 타입(`LogEntry`/`GameEvent`/`LiveConfig`)은
> `src/types/session.ts`, reducers 핸들러는 `Item`/`Player`/`Quest` 도메인 타입을 쓴다(`GameAction`은 아래 `ActionPayloadMap` 판별 유니온이라 `any` 경계가 없다).
> systems 로그 문구·상태이상 라벨은 `MSG`(`MSG.STATUS_LABELS`/`MSG.DOT_LABELS`) 소유다).
> **`src/types/*`의 인덱스 시그니처는 0개, `Relic.val`은 effect 판별 유니온**이다 —
> `Player`/`PlayerStats`/`PlayerMeta`/`CombatFlags`(B3)에 이어 `Relic`/`Item`/`Monster`/`GameMap`/
> `Quest`/`Achievement`/`ClassDef`(L)까지 닫혔으므로 `relic.오타`·`enemy.오타`도 컴파일 에러다.
> 데이터의 닫힌 집합은 리터럴 유니온(`RelicEffect` 61종, `ItemType` 9종, `ElementKey` 9종,
> `QuestType` 9종, `AchievementTarget` 20종, `ClassSkillEffect` 30종 등)이고,
> 데이터↔타입 계약은 `tests/data-shape-types.test.js`가 런타임으로 검증한다.
> `FullStats`(`statsCalculator.ts`)가 전투 수식의 표준 stats 타입.
> `src/hooks`·`src/reducers`의 소유자 로컬(`p`/`player`/`updatedPlayer`/`state`)은 `Player`/`GameState`로
> 정리됐다 — 새 코드도 `Player`/`FullStats`/`GameState`를 명시할 것.
> **`BALANCE`/`CONSTANTS`의 타입은 리터럴에서 도출된다**(`as const` + `typeof`, 인덱스 시그니처 0) — `BALANCE.오타`는 컴파일 에러이고,
> 상수 모양을 소비처에서 손으로 다시 선언하지 말 것(같은 상수를 두 곳이 다르게 선언하던 드리프트를 Wave 7이 제거했다).
> **`GameAction`은 `ActionPayloadMap`(actionTypes.ts)에서 도출된 판별 유니온**이다 — `AT`에 키를 추가하면 맵에도 payload 타입을
> 넣어야 컴파일되고, 핸들러는 `HandlerMap`/`ActionOf<K>`로 payload를 자동으로 좁혀 받는다(`action.payload as X` 캐스트 금지).
> **`GameState.postCombatResult`는 `PostCombatResult`(types/combat.ts, 생산자 리터럴 도출)**, **`migrateData`는 `MigratedSave | null`**
> (세이브 봉투 — `player?: Partial<Player>`; `hasMigratedPlayer` 술어로 좁힌다), **`GameEvent.outcomes`는 세션 정본 `EventOutcome[]`**
> (eventActions/eventPresentation에 로컬 사본을 두지 말 것), **QA 시드 API는 `AetheriaTestApi`**(useGameTestApi.ts — e2e 스펙이 읽는
> 계약이자 `window.__AETHERIA_TEST_API__`의 타입)다. **데이터 테이블(`BOSS_BRIEFS`/`LOOT_TABLE`/`DROP_TABLES`/codex 마일스톤/
> 시그니처 레지스트리/팔레트)도 리터럴·JSON에서 도출된 타입**이고 열린 키 조회는 `getBossBrief`/`getLootTable` 같은 타입된 lookup을 쓴다.
> **`GameState.gameState`는 `GameMode`**(= `typeof GS[keyof typeof GS]`, `gameStates.ts`)이고 `SET_GAME_STATE` payload도 `GameMode`다(Wave 20 L1) — `=== 'evnt'` 같은 오타 비교는 TS2367, 잘못된 payload는 TS2345다.
> 세이브 봉투(`LoadDataPayload`/`MigratedSave`)의 `gameState`는 `JSON.parse` 결과라 **`string`으로 남기고** `LOAD_DATA`가 `isGameMode` 술어로 좁힌다(미지 문자열 → `idle`). 유니온을 봉투 타입에 선언하는 것은 `as`와 같다.
> `useProductTelemetry`의 `gameState`는 아웃바운드 와이어라 `string`. 그 셋 밖에서 `gameState: string` 선언은 `tests/game-mode-contract.test.js`의 부재 불변식이 잡는다.
> `firebase.ts`의 `auth`/`db`는 config 부재 시 실제로 `null`이므로 `Auth | null`/`Firestore | null`이다 — 소비처는 `hasFirebaseConfig`/부트 단계
> 가드와 함께 `!db` 가드를 둔다. 새 코드에서 `any`가 필요해 보이면 경계는 `unknown` + 좁히기, 데이터는 리터럴 도출, 액션은 `ActionPayloadMap`이 답이다.

---

## 3. 디렉토리 구조

```
src/
├── components/       # React UI 컴포넌트
│   ├── Dashboard.tsx         # 중앙 HUD (통계/인벤/탭)
│   ├── TerminalView.tsx      # 로그 출력 + 명령 입력
│   ├── ControlPanel.tsx      # 전투/이벤트/상점 버튼
│   ├── PostCombatCard.tsx    # 전투 결과 카드
│   ├── RelicChoicePanel.tsx  # 유물 3선택 UI (시너지 힌트 포함)
│   ├── tabs/CombatPanel.tsx  # 전투 UI (로직은 utils/combatView.ts)
│   └── ...
│   ├── app/                  # GameRoot / MobileGameLayout / BootScreen / FatalErrorBoundary
│   └── codex/                # 도감 카드 (무기/방어구/몬스터/소재/제작법)
├── hooks/            # 게임 로직 + 상태 관리
│   ├── useGameEngine.ts       # 중앙 orchestrator (useReducer)
│   ├── useGameActions.ts      # 얇은 조합자 → gameActions/ (explore/move/event/quest/character/ascension)
│   ├── useCombatActions.ts    # 얇은 조합자 → combatActions/ (attack/item/victory/boss/_helpers)
│   │                          #   전투 턴 해석 자체는 reducer 소유 (systems/combatActionTurn.ts)
│   ├── useInventoryActions.ts # 오케스트레이터 (.rewards/.equipment/.economy/.premium 서브팩토리)
│   ├── useFirebaseSync.ts     # 익명 인증 + 클라우드 세이브 + 로컬 미러 + 리더보드 구독
│   ├── useGameTestApi.ts      # QA/e2e 전용 시드 API (프로덕션 번들에서 tree-shaken)
│   └── useDamageFlash.ts / useHitFlash.ts / useLegendaryDropDetector.ts / useProductTelemetry.ts
├── systems/          # 핵심 게임 시스템 (pure functions)
│   ├── CombatEngine.ts        # 전투 수식 본체 (부수효과 없음)
│   │                          #  + mixin: .actions / .enemyAI / .status / .loot / .relics / .outcome
│   ├── combatActionTurn.ts    # 공격/기술/도주 1턴 단일 전이 (seeded, reducer가 호출)
│   ├── combatItemTurn.ts      # 전투 소모품 1턴 단일 전이
│   ├── prestigeUnlocks.ts     # 프레스티지 rank 해금 정의
│   ├── mirrorUpgrades.ts      # 에테르 거울(정수 소비) 효과 해석
│   ├── DifficultyManager.ts   # 동적 난이도 조정 (비대칭 고무줄)
│   ├── progressionSimulator.ts# 성장 곡선 시뮬레이터 (scripts/simulate-progression.mjs)
│   └── TokenQuotaManager.ts / LatencyTracker.ts / FeedbackValidator.ts
├── platform/         # 저장·런타임 경계 (React 비의존)
│   ├── gameStorage.ts         # 체크섬 envelope + revision 직렬화 + 2단계 publish 로컬 저장
│   ├── cloudSaveAuthority.ts  # 로컬/원격 세이브 권한 판정
│   ├── errorReporter.ts       # 크래시 리포트 sanitizer
│   ├── productEvent*.ts       # 제품 텔레메트리 이벤트 컨텍스트/싱크
│   └── rewardedAd*.ts / lifecycleBridge.ts / platformBack*.ts / runtimeEnvironment.ts
├── types/            # 도메인 타입 (player/item/monster/relic/quest/class/map/progression)
├── pwa/              # registerServiceWorker.ts
├── services/
│   └── aiService.ts           # AI 이벤트 생성 + 오프라인 fallback
├── reducers/
│   ├── gameReducer.ts         # INITIAL_STATE + 타입 정의
│   ├── handlers/              # action 처리 (bootstrap/feature/progression/reward/ui 등 8분할)
│   ├── actionTypes.ts         # AT 객체 (Object.freeze)
│   └── gameStates.ts          # GS 객체 (IDLE/COMBAT/EVENT/DEAD/...)
├── data/             # 불변 게임 데이터베이스
│   ├── constants.ts           # CONSTANTS, BALANCE (모든 magic number)
│   ├── db.ts                  # DB 통합 export (DB.ITEMS, DB.MONSTERS, ...)
│   ├── items.ts               # 장비 정의 (~1,500 LOC)
│   ├── monsters.ts            # 몬스터 + 보스 패턴
│   ├── classes.ts             # 18개 직업 + 스킬 트리 (Tier 0-3)
│   ├── maps.ts                # 52개 지역 + 레벨 락 (Lv1-55 + 무한 심연)
│   ├── messages.ts            # 한국어 로그 메시지 (MSG 객체)
│   ├── relics.ts              # 67개 유물 + 20 시너지 정의
│   ├── eventChains.ts         # 13개 내러티브 이벤트 체인 (×3스텝)
│   ├── dropTables.ts          # 강화 드롭 테이블 (몬스터별 확률/수량)
│   ├── codexRewards.ts        # 도감 보상 정의 (26 마일스톤)
│   ├── seasonPass.ts          # 시즌 패스 보상 정의 (30티어)
│   └── quests.ts              # 143개 퀘스트 + 73개 업적 (ACHIEVEMENTS 포함)
└── utils/            # 공유 유틸리티 (~20개)
    ├── gameUtils.ts           # makeItem 등 공유 헬퍼 (migrateData는 dataMigration.ts로 분리)
    ├── dataMigration.ts       # 세이브 마이그레이션 (migrateData)
    ├── equipmentUtils.ts      # 장비 프로파일 계산
    ├── exploreUtils.ts        # 적 스폰, 이벤트 결정
    ├── combatView.ts          # 전투 뷰모델 (CombatPanel용 순수함수)
    ├── graveUtils.ts          # 묘비 생성/복구
    ├── runProfileUtils.ts     # 플레이스타일 분석
    ├── expeditionLedger.ts    # 원정(구역 보스) 세션 원장 + bossGauge.ts / returnBriefing.ts
    ├── scoutEvents.ts         # 탐험 정찰 3택 카드
    └── commandParser.ts       # 명령어 파싱
tests/                # 단위 테스트 (Node.js built-in test, 351 파일 / 5,170 케이스, skip 0, Linux CI 그린 — 아트 재현성은 디코딩 픽셀 기준,
                      #   UI 계약은 tests/helpers/render.ts 렌더 단언 — 소스 정규식 가드는 아트/네이티브/Toss 증빙 계약에만 남김)
                      #   + e2e/ (Playwright 44 스펙, iPhone 12 에뮬레이션 — 엔진은 chromium 고정, Linux WebKit hang 회피) + device-qa/
scripts/              # 빌드 가드, 스모크 테스트, 모바일 빌드 스크립트
functions/api/        # Cloudflare Pages Functions (ai-proxy.js)
android/ ios/         # Capacitor 네이티브 프로젝트
```

---

## 4. 빌드 & 실행 명령어

```bash
# 개발
npm run dev               # Vite dev server → http://localhost:5173
npm run build             # 프로덕션 빌드 → dist/
npm run build:guard       # 빌드 전 유효성 검증
npm run preview           # 빌드 결과 프리뷰

# 검증
npm run verify            # type-check + lint + test:unit + build:guard (preview 서버 불필요) ← 기본 게이트
npm run verify:full       # verify + preview 자동 기동 + smoke(desktop/mobile) + e2e
npm run type-check        # tsc --noEmit
npm run lint              # ESLint 검사
npm run test:unit         # 단위 테스트 (tests/*.test.js, tsx 로더)
npm run test:smoke        # 스모크 게임플레이 테스트 (preview 서버 필요, 기본 127.0.0.1:4173)
npm run test:e2e          # Playwright e2e (2 shard)
npm run perf:guard        # FCP/DCL 예산 검사 (CI blocking — Wave 10 B4; 로컬은 preview 서버 필요)
npm run progression:simulate  # 성장 곡선 시뮬레이션 (밸런스 변경 시 compare와 함께)

# 모바일
npm run cap:sync          # Capacitor sync (iOS + Android 동시)
npm run android:sync      # Android sync
npm run android:debug     # Debug APK — gradlew만 돈다. 플러그인 런타임 등록 목록(capacitor.plugins.json, gitignore)은
                          #   `android:sync`가 생성하므로 새 플러그인·새 클론 뒤에는 반드시 android:sync → android:debug 순서.
                          #   sync 없이 빌드하면 @capacitor/app이 컴파일은 되되 등록되지 않아 뒤로가기가 조용히 '앱 종료'로 되돌아간다(Wave 20 L4)
npm run android:release   # Release APK
npm run ios:sync          # iOS sync
npm run ios:build:device  # iOS 기기 빌드
npm run ios:archive       # App Store 아카이브
npm run mobile:doctor     # Capacitor 환경 점검
```

---

## 5. 코딩 규칙

### DO

- **`BALANCE` 상수 사용**: 모든 수치(확률, 배율, 비용 등)는 반드시 `src/data/constants.ts`의 `BALANCE` 객체에서 참조. inline magic number 절대 금지.
- **`MSG` 객체 사용**: 한국어 로그 메시지는 반드시 `src/data/messages.ts`의 `MSG` 객체에서 가져올 것. 컴포넌트/훅에 한국어 문자열 직접 작성 금지.
- **`AT` 객체 사용**: reducer dispatch 시 action type은 반드시 `actionTypes.ts`의 `AT` 상수 사용. 문자열 리터럴 사용 금지.
- **`GS` 객체 사용**: game state 비교는 반드시 `gameStates.ts`의 `GS` 상수 사용.
- **Immutable 업데이트**: reducer에서 state 변경 시 반드시 spread operator로 새 객체 반환. 직접 변이 금지.
- **Pure function 유지 (CombatEngine)**: `CombatEngine.ts` 함수는 입력 → 새 객체 반환. side effect 절대 금지.
- **`SET_PLAYER` 함수형 payload 활용**: 현재 player 상태에 의존하는 업데이트는 함수형 payload 사용:
  ```javascript
  dispatch({ type: AT.SET_PLAYER, payload: (p) => ({ ...p, hp: p.hp - damage }) });
  ```
- **DB 통합 export 사용**: 게임 데이터 참조 시 `db.ts`의 `DB` 객체를 통해 접근 (`DB.ITEMS`, `DB.MONSTERS` 등).
- **`addLog(type, text)` 로그 패턴**: 게임 이벤트는 반드시 이 함수로 로그 출력.

### DON'T

- **직접 state 변이 금지**: `player.hp = newHp` 같은 직접 변이는 dev tools 및 시간여행 디버깅을 破壊한다.
- **CombatEngine에 side effect 추가 금지**: `dispatch`, `console.log`, 외부 상태 변경 등 넣으면 테스트 불가능해짐.
- **컴포넌트에 게임 로직 작성 금지**: 비즈니스 로직은 `hooks/`, `systems/`, `utils/`에. 컴포넌트는 렌더링만 담당.
- **한국어 문자열 하드코딩 금지**: `MSG.BATTLE_START` 처럼 `MSG` 객체 사용. 컴포넌트 JSX 안에 한국어 직접 입력 금지.
- **`data/` 파일 직접 수정 시 주의**: `items.ts`, `monsters.ts`, `constants.ts` 변경 시 밸런스 전체에 영향. 반드시 테스트 후 반영.
- **`CONSTANTS.DATA_VERSION` 무단 변경 금지**: save 구조 변경 시 반드시 버전 bump + `migrateData()` 업데이트 병행.
- **`commandParser`에 게임 로직·상태 전이 작성 금지**: 터미널은 UI와 **평행한 두 번째 입력 표면**이다. 파서가 `setGameState`를 직접 부르면 UI에만 있는 가드를 우회한다 — 실제로 `shop`이 그랬고, 전투가 가능한 안전지대(황금 왕국)에서 전투 중 `shop`을 치면 **도주 판정 없이 전투를 버릴 수** 있었다(Wave 17). 새 명령은 **액션을 호출만** 하고, 게이트는 그 액션이 소유한다. `tests/command-surface-contract.test.js`가 되돌리기를 잡는다.
- **AI 이벤트 경로의 상태 전이를 hook에서 직접 쓰지 말 것**: `explore()`의 AI 경로는 `AT.BEGIN_AI_EVENT`(→ `GS.EVENT_PENDING`)와 `AT.RESOLVE_AI_EVENT`(`EVENT_PENDING`일 때만 적용, 아니면 **동일 참조**) 두 리듀서 전이가 소유한다(Wave 19 K1). hook이 응답 전에 `SET_GAME_STATE(EVENT)`를 세우면 (a) `try`에 `catch`가 없을 때 `generateEvent` reject가 **리로드 없는 라이브 벽돌**이 되고(Wave 18의 `LOAD_DATA` 폴드는 이 경로를 못 잡는다 — 실제로 `TokenQuotaManager`의 무방비 `JSON.parse`로 도달됐다) (b) dismiss/리로드 뒤 도착한 응답이 idle 위에 `SET_EVENT` 고아를 남긴다. `tests/ai-event-pending-contract.test.js`가 되돌리기를 잡는다. **`GS` 멤버를 추가하면 컴파일러가 세 표를 짚는다**(Wave 20 L1): `platformBack`의 `Record<GameMode, PlatformBackAction>`(TS2741) · `commandParser`의 `Record<GameMode, string | null>`(TS2741) · `restorableMode`의 `never` default — K1이 손으로 채우던 표다. 단 **`tests/**`는 `tsconfig` `checkJs: false`라 타입 검사 밖**이므로 `tests/**` grep 의무는 그대로다(Wave 19에서 24곳을 표로 셌는데 25번째가 `tests/progression-simulator.test.js`에 있었다).
- **컴포넌트에서 `setSideTab` + `setGameState` 쌍을 직접 부르지 말 것**: 아카이브 진입은 `characterActions.openArchive(tab)`이 소유한다(Wave 19 K2, 허용 상태는 **화이트리스트** — 새 `GS` 멤버는 자동 거부). `ReturnBriefingCard`의 보상 버튼이 전투 중 복원 세이브에서 그 쌍을 눌러 **도주 판정 없이 전투를 버릴 수** 있었다(`lastSeenAt`은 모든 저장이 찍으므로 카드는 전투에서도 뜬다 — 카드를 숨기면 브리핑이 영구 소실되니 가드는 액션에 둔다). `tests/archive-open-contract.test.js`의 부재 불변식이 `src/components/**`에서 그 쌍의 공존을 잡는다.
- **전투 턴을 hook에서 해석 금지**: 공격/기술/도주/소모품은 `AT.RESOLVE_COMBAT_ACTION` 등 단일 reducer 전이(`systems/combatActionTurn.ts`)로만 해석. hook에서 `SET_PLAYER`/`SET_ENEMY`를 여러 번 쏘는 방식은 rapid tap 시 상태 분기를 만든다.

---

## 6. 핵심 설계 원칙

### 상태 관리 아키텍처
```
useGameEngine (useReducer)
    ├── useGameActions       → 이동/탐험/휴식/이벤트
    ├── useCombatActions     → 전투 resolve
    ├── useInventoryActions  → 인벤토리
    ├── useFirebaseSync      → 클라우드 저장
    └── useDamageFlash       → 데미지 플래시
```
- **단일 진실 원천**: 모든 게임 상태는 `gameReducer.ts`의 `INITIAL_STATE`에서 정의
- **Hooks 조합**: 각 역할별 hook으로 분리 → `useGameEngine`이 조합해서 컴포넌트에 전달

### CombatEngine 설계 패턴
- **완전한 pure function**: `calculateDamage()`, `attack()`, `performSkill()`, `enemyAttack()` 등 모두 `(state, params) → newState` 시그니처
- **결정론적**: 동일 입력 → 동일 출력 (Math.random 제외)
- **독립 테스트 가능**: 게임 환경 없이 단독 테스트 가능

### 밸런스 상수 관리
모든 수치는 `src/data/constants.ts`에 집중 관리:

| 상수 | 값 | 의미 |
|------|----|------|
| `CRIT_CHANCE` | 0.1 | 크리티컬 확률 10% |
| `ESCAPE_CHANCE` | 0.5 | 도망 성공률 50% |
| `EXP_SCALE_RATE` | 1.15 | 레벨업 EXP 증가 배율 (Lv50 ~45전투/레벨 목표) |
| `RELIC_FIND_CHANCE` | 0.08 | 유물 발견 확률 8% |
| `BOSS_PHASE2_THRESHOLD` | 0.5 | 보스 2페이즈 전환 HP 비율 |
| `TWO_HAND_ATK_BONUS` | 1.55 | 양손무기 ATK 배율 |
| `EVENT_CHANCE_NOTHING` | 0.2 | 탐험 시 아무 일도 안 일어날 확률 |
| `STATUS_DOT_RATIO` | 0.04 | DoT 데미지 = maxHp × 4% |

### Roguelike 루프 구조
1. **탐험** → 적/이벤트/유물 랜덤 발생 (pity counter로 드랍 보장)
2. **유물 선택** → 3개 중 선택(프레스티지 rank≥2: 4개), 최대 5개 보유(rank≥2: 6개)
3. **마왕 격파** → Ascension 옵션 제공 (마왕성 경로 게이트 Lv48 ≈ 53.3 모델시간)
   - **직업 게이트는 이 리셋 지점을 넘지 않는다**(Wave 13 E1) — tier-3 5종이 `reqLv: 60`(131.2h)이던 동안 코어 루프를 그대로 타는 플레이어는 직업 5종을 영원히 못 봤다. 45로 내려 승천까지 13.90h 여유를 남겼고, `tests/content-reachability.test.js`가 "최심 직업 게이트 ≤ 마왕성 **경로** 게이트"를 단언한다(48은 리터럴이 아니라 리포트에서 읽는다)
4. **프레스티지** → 레벨/장비/유물 초기화, 영구 보너스 적립
   - **이벤트 체인은 승천 지점을 걸치지 않는다**(Wave 15 G1) — 체인 13개 중 11개가 루프 안에서 닫히고(완주 게이트 ≤ 48) 2개는 애초에 승천 **뒤에** 열린다(`divine_apostle_trial` 65.90h · `rift_secret` 170.23h). Wave 14 F2가 자를 고친 직후에는 셋이 걸쳐 있었다(2.05h~21.08h에 열려 전부 170.23h에 완주 — 이월이 있어도 자기 런 안에서 끝나는 이야기가 0개였다). G1이 스텝 4개의 `loc`을 옮겨 닫았고, 목적지는 취향이 아니라 **세 기준의 교집합**이다: ① 경로 게이트 ≤ 48 ② 남은 스텝의 max 이상(종착이 곧 완주 게이트여야 한다 — `gateChanging === []`) ③ **`type !== 'safe'`**(안전지대에는 탐험 버튼이 없다 — `canInvestigateTown`은 황금 왕국에서만 true라 거기 놓인 스텝은 터미널에 `explore`를 타이핑해야만 진행된다. `machine_uprising` 종착과 `water_apostle:1`이 이미 그 상태다). **진행도 이월은 그대로 유지된다**(Wave 14 F2) — 승천은 레벨에 도달해야 열리는 게이트가 아니라 **플레이어가 고르는 시점**이라 체인을 열어 둔 채 승천하는 런이 여전히 가능하고, 그때의 안전망이다. `pickPermanentPlayerState`는 `EVENT_CHAINS`를 순회해 **체인 id 키만** 끌어온다(제외가 아니라 화이트리스트) — `eventChainProgress`의 `boundedEncounterReceipts` 키는 원정 조우 영수증 레저를 겸하므로 통째로 넘기면 영수증이 승천을 넘어가 재획득을 막는다
5. **묘비 시스템** → 사망 지점에 골드/아이템 보관, 재방문 시 회수

### AI 이벤트 생성
- **온라인**: 위치/최근 전투 이력/플레이어 상태를 컨텍스트로 AI 호출 (9.5s timeout)
- **오프라인/할당량 초과**: 사전 제작된 큐레이션 fallback 이벤트 풀에서 랜덤 선택
- **일일 한도**: 50회 (TokenQuotaManager)
- **프록시 입력 상한(본문 16KB · 필드별 clamp — 정확한 숫자는 `functions/api/ai-proxy.js`가 정본)**: 서버가 Gemini 프롬프트에 보간하는 문자열(이름/위치/직업/유물/빌드 프로필 등) 크기를 제한한다.
- **쿼터는 "디스패치 비용 미터"다** (Wave 12 D3) — `dispatched(day) ≤ BALANCE.DAILY_AI_LIMIT`. 프록시에 실제로 보낸 요청을 세고, 응답을 채택했는지는 세지 않는다. 채택 기준으로 바꾸면 게이트(`canMakeAICall`)가 디스패치를 막는데 미터는 그 부분집합만 세게 되어 구조적으로 못 문다 — 서버(`functions/api/ai-proxy.js`)는 40req/60s 슬라이딩 윈도우일 뿐 일일 상한이 없으므로 이 미터가 **유일한 일일 비용 통제**다. `recordCall`은 요청 결정 한 곳에서만 일어나고(`dispatchProxyCall`), 응답 해석기는 `outcome` 5종(`adopted` + 미채택 4종)을 반환한다 — `dispatched = adopted + unadopted + unsettled`. 미채택 건수는 `TokenQuotaManager.getCallLedger()`로 관측한다.
- **판정은 `src/platform/aiEventPolicy.ts` 소유** (Wave 11 C3) — "호출할지 · 어떤 `fallbackReason`으로 접을지 · 응답을 채택할지"는 React·firebase·fetch 없는 순수 전이다. `aiService.ts`에는 IO(fetch/AbortController/타이머/LatencyTracker/firebase 토큰)만 남는다. `fallbackReason` 7종(`mock-runtime`/`quota`/`proxy-disabled`/`proxy-unavailable`/`proxy-rejected`/`malformed-response`/`recent-duplicate`) 중 UI로 표면화되는 건 `quota` 하나뿐. **쿼터는 정책의 상태가 아니라 입력**이다 — `TokenQuotaManager`가 유일한 진실 원천이고 정책에는 `readQuota` 지연 호출로 전달한다(mock 런타임이 쿼터를 읽지 않는 동작 보존).
- **준비 중은 별도 모드다** (Wave 19 K1) — `GS.EVENT_PENDING`. `isAiThinking`은 렌더 조건에서 빠지고 이동 가드(`moveActions`)에만 남았다 — 생산자가 `explore`와 `addStoryLog` **둘**이라 렌더 조건으로 쓰면 승리 내러티브 생성 중 열린 체인/캠프파이어 카드가 최대 9.5초 '준비 중'으로 덮였다. `TokenQuotaManager`는 읽기·쓰기 **fail-closed**다: `localStorage`가 깨지면(`JSON.parse` 실패 · Safari 쿠키 차단 `SecurityError` · 사설 모드 `QuotaExceededError`) `canMakeAICall()`이 false이고 `generateEvent`는 reject하지 않는다. 쓰기 실패 플래그(`quotaWriteHealthy`)는 모듈 스코프이고 성공한 쓰기로만 풀리는데 쓰기는 `recordCall`(= 호출 뒤)에서만 일어나므로, 깨진 세션은 **리로드까지 폴백 풀만** 쓴다 — 미터를 못 세면 안 보낸다(D3)의 의도된 저하이지 벽돌이 아니다. 잔여 상한은 **세션당 미계량 디스패치 ≤1**(깨짐 사건당): `recordCall`은 `dispatchProxyCall`이 반환값을 안 보므로 첫 호출 한 건은 쓰기 실패와 무관하게 나가고, 그 뒤 플래그가 게이트를 닫는다. Wave 20 §24가 재시도(A: 간헐 실패에서 미계량 디스패치가 호출 빈도만큼 반복 — D3의 정확한 위반)와 디스패치 거부(B: IO 계층이 `aiEventPolicy`의 결정을 뒤집어 진실 원천이 둘)를 실패 사례로 비교해 **현행 유지**로 닫았다 — 다시 후보에 올리지 말 것.

### 저장 데이터 버전 관리
- `CONSTANTS.DATA_VERSION = 5.1` (5.1: `meta.essenceLifetime` 역산 backfill — `dataMigration.ts`)
- save 구조 변경 시: 버전 bump → `gameUtils.migrateData()` 업데이트 필수
- **시즌 XP 적립은 `helpers.addSeasonXp` 한 곳이 소유한다** (Wave 13) — `ADD_SEASON_XP` 핸들러가 같은 계산을 독립 구현하고 있었고 전투 승리·탐험·전설 드롭이 전부 그 경로였다. 즉 **지배적 경로만 이월 수정을 못 받는** 상태였다. 상한 클램프는 저장이 아니라 **표시 경계**(`getSeasonProgress`)에 있고, 초과분은 회전이 다음 시즌 시드로 넘긴다. 새 적립 경로를 추가할 때 계산을 다시 쓰지 말 것 — 두 구현이 갈라지면 "어느 경로로 번 XP인가"에 따라 이월 여부가 달라진다.
- **시즌 칭호는 lifetime max로 복구한다** (Wave 13 E3) — `checkTitles`의 `seasonTier` 판정이 `max(live tier, archive[].tier)`다. live만 보면 회전 뒤 그 칭호가 영구 복구 불가였다(Wave 12 D2의 "리셋 직전 `addNewTitles`"는 여전히 유지되지만 이제 유일한 경로가 아니다).
- **시즌 회전은 완주 트리거이지 벽시계가 아니다** (Wave 12 D2) — 30번째 티어 보상 claim이 다음 시즌을 연다(XP 상한이 아니다: claim이 곧 지급이라 상한 시점에 미수령 보상 30개가 남아 있을 수 있다). 회전 시 `claimed[]`는 `SeasonArchiveEntry`로 보존하고, **리셋 직전에 `addNewTitles`를 한 번 돌린다** — `checkTitles`가 시즌 칭호를 live `seasonPass.tier`에서 복구하므로 순서가 바뀌면 그 칭호는 영구 복구 불가다. `ordinal`/`completedSeasons`/`archive`는 기본값 있는 선택 필드라 `DATA_VERSION` bump 없이 구세이브가 시즌 1로 로드된다.
- `migrateData(raw, { now })`는 **시각 주입 가능**(Wave 11 C2) — 벽시계(`Date.now()`) 기본값은 이 경계 한 곳에만 있다. 골든(`save-migration-golden.test.js`)은 고정 시각을 주입하므로 `startedAt` 정규화 없이 값 자체가 결정론의 증거다. 마이그레이션에 새 시각 의존을 넣을 때는 `Date.now()`를 직접 부르지 말고 이 `now`를 내려보낼 것

---

## 7. 테스트

```bash
npm run test:unit    # 단위 테스트 전체 실행
npm run test:smoke   # 게임플레이 스모크 테스트
```

**테스트 파일 위치**: `tests/*.test.js`
- `grave-recovery.test.js` — 묘비 생성/복구
- `run-profile-utils.test.js` — 빌드 분석 로직
- `player-state-utils.test.js` — 상태 전환
- `quest-progress.test.js` — 퀘스트 마일스톤
- `adventure-guide.test.js` — 가이드 힌트
- `ai-event-utils.test.js` — AI 이벤트 패키지 빌드
- `outcome-analysis.test.js` — 전투 후 분석

**계약 테스트 (Wave 10)** — 설계 규칙을 한 파일에 열거해, 회귀 시 어떤 셀이 깨졌는지 즉시 보이게 한다:
- `combat-turn-authority-matrix.test.js` — §8-1 전투 턴 authority 27셀(replay 거부 · seed 결정론 · 정산 1회성 · 적 3종), 모든 reducer 호출이 `Math.random` throw 가드 안에서 실행된다
- `save-compatibility-roundtrip.test.js` + `save-migration-golden.test.js` — `DATA_VERSION` 픽스처 7종(`tests/fixtures/saves/`) 왕복 불변식 · 멱등성 · 골든 차등 74입력(`SAVE_GOLDEN_WRITE=1`로 재생성)
- `boot-state-machine.test.js` — §8-5 부트 전이표(`platform/bootStateMachine.ts`). 복원 **dispatch까지** 전이표 소유(Wave 11 C1)이므로 계약은 "ready 뒤 `LOAD_DATA`는 크로스 디바이스 복원 경로에서만, 폴백·mock/device-QA는 무(無)". Wave 10의 "복원 승인 없는 ready 금지"는 dispatch를 훅이 소유하던 동안 **공허참**이었다 — 주장하는 쪽과 강제하는 쪽이 같은 모듈이어야 계약이 성립한다
- `ai-event-policy.test.js` — AI 폴백 결정표 (Wave 11 C3)
- `grave-item-reader-contract.test.js` — §8-2 "묘비 아이템은 `getGraveItems()` 경유로만 읽는다" 부재 가드 + 단수/복수/빈배열/null 읽기 동치 (Wave 11)
- `event-chain-cost.test.js` — **체인의 열림→완주 구간**과 **승천 지점을 걸치는 체인이 0개임**을 고정한다 (Wave 14 F2 + Wave 15 G1). 완주 게이트는 종착 스텝의 게이트가 아니라 **전 스텝 max**다 — `chainEventHandlers`가 스텝 순서를 강제하므로 중간 스텝이 더 깊으면 그게 완주 비용이다. 스텝 지역 하나라도 못 읽으면 남은 스텝의 max가 아니라 **미상**(fail-closed)
- `firestore-rules-semantics.test.js` — **rules를 에뮬레이터로 실행** (Wave 14 F3). 테스트는 rules가 아니라 **클라이언트 쓰기 지점 6곳의 실제 페이로드**에서 유도한다 — rules 텍스트를 재현한 테스트는 거부가 버그인 rules 위에서도 초록이다. `npm run test:rules`(JDK 필요, CI 별도 job). 에뮬레이터가 없으면 러너 존재를 단언한다(skip 0 유지)
- `class-tier-depth.test.js` — **`tier`는 `모험가`로부터의 BFS 깊이다** (Wave 14 F4). 괴리는 정확히 `['성직자']` 하나이고 **늘어날 수 없다**. 그 하나를 못 고치는 이유는 `scripts/artCatalog.mjs`가 `tier`를 아트 카탈로그 identity 해시에 넣고 그 해시가 provenance 기록 포함 1,065개 파일에 핀돼 있기 때문이다(§18.1 발견 1·2)
- `ai-event-pending-contract.test.js` — **AI 이벤트 준비는 별도 모드이고 정산은 리듀서가 소유한다** (Wave 19 K1). ① `explore()` AI 경로의 dispatch 열은 `BEGIN_AI_EVENT → RESOLVE_AI_EVENT → SET_AI_THINKING(false)`이고 event / null / **reject** 세 경우 모두 `explore()`가 resolve하며 `SET_GAME_STATE(event)`는 열에 없다 ② `RESOLVE_AI_EVENT`는 `EVENT_PENDING`이 아니면 동일 참조(늦은 응답 무시) ③ `TokenQuotaManager`는 깨진 저장소에서 `canMakeAICall() === false`이고 던지지 않는다 ④ `ControlPanel`은 `event_pending`에서 '준비 중'을 그리고 `control-explore`/`control-move`를 **그리지 않는다**(되돌리면 실제로 idle 버튼 트리로 낙하한다 — probe로 확인한 뒤 미렌더 단언을 썼다). 결함 주입 7종 전부 red→green
- `archive-open-contract.test.js` — **아카이브 진입 게이트는 `openArchive` 액션이 소유한다** (Wave 19 K2). ① 전투에서 거부(dispatch 0 · error 1 · `false`), idle/shop에서 수락 ② J3 재현 고정: 복원 combat + `lastSeenAt` −7h + 미수령 퀘스트 → `claimableRewardCount > 0` → `openArchive` → `combat` 유지 · `enemy` 동일 ③ 부재 불변식: `src/components/**`에 `setSideTab(` + `setGameState(` 공존 0. **`enemy` 단독 단언은 이 결함 클래스에 공허하다** — `SET_GAME_STATE` 핸들러가 `enemy`를 안 건드려 dispatch만 하는 결함에서는 `enemy` 동일성이 항상 유지된다(§23의 예측이 실측에서 틀린 지점). `accepted` · `gameState` · `enemy`를 함께 단언한다
- `restorable-mode-contract.test.js` — **세이브 봉투에 없는 동반 상태를 요구하는 모드는 복원되지 않는다** (Wave 18). 모드 × 동반 상태 표를 고정한다: `combat`은 `enemy`, `event`는 `currentEvent`가 함께 와야 하고 `dead`는 언제나 `idle`로 접힌다. 결함 주입 3종(event 폴드 제거 / dead 폴드 제거 / 정리 조건을 폴드된 값으로 되돌리기)이 **각각** 걸린다 — 세 번째는 처음에 안 걸렸고, 내 픽스처가 가짜 모양이라 **공허참**이었다(진짜 모양으로 바꿔 판별 확보)
- `command-surface-contract.test.js` — **터미널은 UI와 평행한 두 번째 입력 표면이다** (Wave 17). 구조 계약: `commandParser`는 **어떤 명령에서도 `setGameState`/`setShopItems`를 직접 부르지 않는다**(명령 18 × 상태 9 전수). 게이트 계약: 상점 진입의 안전지대·상태 가드는 `openShop` 액션이 소유한다. 결함 주입 2종이 구조 계약과 행동 계약을 **각각** 깨뜨린다
- `safe-zone-explore-contract.test.js` — **안전지대 탐험의 3겹 계약** (Wave 16). ① `spawnEnemy`는 빈 몬스터 테이블에서 `mStats`/`baseName` 모두 `null`이다 ② 몬스터 없는 safe 지역은 전부 평화롭고(전투 0건) 황금 왕국은 그대로 조우한다 ③ 대기 중인 체인 스텝은 safe 지역에서도 발동하고 UI에 노출된다. 세 겹은 서로를 가리지 않는다 — 결함 주입 2종이 각각 하나씩만 깨뜨리는 것으로 증명했다
- `map-route-gate.test.js` — **맵의 실제 진입 레벨** (Wave 13 E2). `src/utils/mapRouteGate.ts`가 리포트와 UI의 공용 authority다. 52개 중 10개는 선언 `level`과 경로 게이트가 다르고(유일한 경로가 더 높은 지역을 지난다), `level: 'infinite'`는 잠금이 아니라 **잠금 없음**이다(`NaN` 비교). 이 트랙은 **표시이지 잠금이 아니다** — `getMapAccess`는 선언값 그대로이고 테스트가 그걸 고정한다
- `debt-ratchet.test.js` (f) — **한국어 하드코딩은 늘지 못한다, JSX 텍스트 포함** (Wave 20 L3). TypeScript compiler API로 `src/data` 밖 모든 최상위 디렉터리의 `StringLiteral`·템플릿 조각·**`JsxText`** 중 한글 노드를 세어 디렉터리별 상한을 고정한다(착수 실측: components 1,319 · utils 2,001 · hooks 285 · systems 120 · reducers 29 · types 16 · services 32 · platform/assets/pwa 0 = 3,802). 기존 (d)의 따옴표 정규식은 **JSX 텍스트 549개를 0으로 센다** — 같은 `<span>한국어</span>` 주입에 (f)는 red, (d)는 725 그대로였다. §5가 금지하는 "컴포넌트 JSX 안에 한국어 직접 입력"이 처음으로 계약 안에 들어왔다. 새 최상위 디렉터리는 상한이 없으면 **fail-closed**. 상한은 실측값 그대로이고 하락만 허용한다 — 방법을 바꾸는 것은 재고정이지 하락이 아니다
- `content-reachability.test.js` — **접근 비용 축** (Wave 12 D1). "도달 가능한가"가 아니라 "몇 모델 액션·몇 모델 시간 뒤인가"를 검증한다. `basis`가 `anchored`(모델 산출)인지 `interpolated`(누적 EXP 비례)인지 `beyond-anchors`(외삽 금지 — 비용 `null`)인지를 구분하고, 보간 행은 자기 입력을 들고 있어 재계산 가능하다. **맵 게이트는 선언 `level`이 아니라 실제 이동 경로로 매긴다** — 52개 중 10개가 다르다(`cost.mapGateDivergence`). 리포트는 `schemaVersion: 4`이고 체인 키는 자기가 세는 것을 말한다(Wave 15 G4): `gates.eventChainCompletions`(버킷 키가 **완주** 게이트다) · `behind[].eventChains` · `unresolvedEventChainCompletions`. `summary`의 `eventChainTerminalSteps`는 삭제됐다 — 그 값은 `terminals.length`이고 `terminals`는 체인당 한 행이라 **구조적으로** `summary.eventChains`와 항상 같았다

**테스트 방침**: 외부 mock 프레임워크 없이 Node.js built-in `test` 사용. Pure function이므로 별도 DI 없이 직접 import 후 assert.
데이터 보존 가드는 소스 바이트 해시가 아니라 **값 해시**(`tests/helpers/dataHash.ts`)를 쓴다 — 타입 주석 변경에 재고정이 필요 없다.
**테스트에서 엔진을 부를 때는 `rng`를 주입한다** (Wave 21.1) — `CombatEngine.attack`/`performSkill`/`enemyAttack`/`attemptEscape`/`processLoot`/`handleDefeat`는 `rng`를 생략하면 `Math.random`이고, 피해 분산 ×0.9~1.1 위에서 두 피해를 부등식으로 비교하면 확률 사건이다(`skill-branch-parity`가 배율비 1.2로 **0.43%/run** 붉었다 — PR #49 attempt 1, 로컬은 5,170/5,170). 상수 `() => 0.5`가 기본이고, proc 판정(`effectChance` 0.2~0.4 분기 5개)을 함께 보려면 시퀀스 rng를 쓴다(0.5는 그 다섯을 결정론적으로 실패시킨다). 전역 `Math.random` 스텁을 새로 만들지 말 것 — 기존 스텁 뒤에 같은 모양의 부등식이 3곳 숨어 있다. 루프 분포 테스트(`cycle-200-299:1989` crit 1,000회, 꼬리 2.79e-9)는 시드화가 오히려 엔진 draw 수 변경에 취약해 미시드로 둔다. 미시드 128곳의 전수 분류는 계획서 §25.2.

**소스 정규식 가드(`readSrc()` + regex) 신규 추가 정책 (Wave 11 C4)**: `src/**`를 텍스트로
읽어 정규식으로 매칭하는 새 가드는 **부재 불변식(absence invariant)에만** 허용된다 —
"삭제된 코드/파라미터/필드가 되돌아오지 않는다"처럼 없는 것을 확인하는 경우, 그리고
아트 재현성·네이티브 매니페스트·Toss 결제 증빙처럼 텍스트 매칭 자체가 계약인 특수
케이스뿐이다. 그 정규식은 **포맷(줄바꿈/공백/인자 순서)이 아니라 식별자**를 매칭해야
한다 — 포맷을 고정하면 리팩터가 의미를 안 바꿔도 깨진다. 반대로 **"함수가 호출된다",
"값이 쓰인다", "폴백이 실행된다"처럼 동작을 확인하는 새 가드는 소스 정규식으로 작성
금지** — 실제 모듈을 import해서 호출하고 결과를 assert하는 행동 테스트로 작성한다
(`tests/helpers/render.ts`의 `renderStatic`/`makePlayerFixture`가 컴포넌트 케이스의
표준 패턴). 기존 가드 3,226건의 전수 분류와 분류 기준의 근거는
`docs/SOURCE_GUARD_CLASSIFICATION_2026-09.md`에 있다.

---

## 8. 주의사항

### 절대 건드리지 말 것
- **`CombatEngine.ts` 함수 시그니처**: 수많은 훅이 의존. 변경 시 전투 전체 영향.
- **`INITIAL_STATE` 필드 제거**: 기존 Firebase 저장 데이터와 호환성 깨짐. 추가는 가능, 제거/이름변경은 `migrateData()` 없이 불가.
- **`AT`/`GS`/`DB`/`BALANCE`/`MSG` 객체 구조 변경**: 프로젝트 전체에서 참조 중.

### 특별히 조심할 것

**1. 전투 턴 authority**
적 반격은 더 이상 timer가 아니라 reducer 내부에서 동기 해석된다(`combatHandlers.ts` → `combatActionTurn.ts`). 플레이어 행동·적 반격·승패 정산·보상은 한 action에서 끝나며 `combatTurn`/`expectedTurn`으로 replay를 거부한다. 새 전투 액션을 추가할 때는 이 전이 안에 넣고, RNG는 action의 seed 스트림을 써야 한다(`Math.random` 직접 호출 금지 — 결정론 테스트가 깨진다). `useGameEngine.ts`의 `combatPendingRef`는 시각 효과 해제 타이머만 관리한다.

**2. grave 호환성**
구형 save에는 `grave.item` (단수), 신형에는 `grave.items[]` (복수). **마이그레이션으로 정규화하지 않는다** — 깨진 reader가 없는 모양을 고치려고 `DATA_VERSION`을 올리는 건 순수 위험이고, writer(`buildGraveData`)가 이미 두 모양을 함께 쓴다. 대신 **묘비 아이템 읽기는 언제나 `getGraveItems()` 경유**가 코드 불변식이다(Wave 11) — `grave.items[0]`/`grave.items.length` 같은 직접 인덱싱은 구형 save에서 빈 목록을 보게 되므로 금지이고, `tests/grave-item-reader-contract.test.js`가 되돌리기를 잡는다.
**공개 침공 문서(`public/data/graves/{uid}`)의 상한은 클라이언트가 보장한다**(Wave 15 G2) — rules가 거는 6개 상한 중 `gold`만 보장이 없으면서 동시에 도달 가능했다(`Σ floor(player.gold/2 × dropBonus)`, 묘비 개수 상한 없음, 무한 심연 골드 배율 `1 + 0.1×(층−1)`에 상한 없음). 거부되는 것은 숫자가 아니라 **문서 전체**라 `gold` 하나가 넘치면 `guardPower`(침공 성공률의 입력)와 `items`(침공 보상)까지 사라지고 `.catch(console.warn)`이 삼킨다. `clampPublicGraveGold`(`CONSTANTS.MAX_PUBLIC_GRAVE_GOLD`)는 **업로드 페이로드에만** 건다 — 회수용 로컬 묘비에 걸면 플레이어 자기 골드가 사라진다. rules를 완화하는 방향으로 풀지 말 것(공개 문서의 유일한 위조 경계이고, 효력은 배포에 달려 있다).

**3. 안전지대는 지역 이름이 아니라 지역 종류로 판정한다**
평화 가드는 `player.loc === CONSTANTS.START_LOCATION`이라는 **하드코딩된 한 지역**이었고, 그래서 safe 맵 6곳 중 4곳(여행자의 쉼터·사막 오아시스·북부 요새·허공의 섬 — 전부 `monsters: []`)이 터미널 `탐색`으로 뚫려 **이름 없는 적이 실제 스탯으로 스폰됐다**(Wave 16: 허공의 섬에서 HP 1,357 / ATK 175, 로그는 `'undefined 등장!'`). 이제 `type === 'safe' && !canInvestigateTown(...)`이고 권한은 `canInvestigateTown`이 소유한다(사냥감이 있는 황금 왕국만 조사 가능).
**그 가드는 반드시 체인 트리거 뒤에 둔다** — 대기 중인 이벤트 체인 스텝은 지역 종류와 무관하게 발동해야 한다(`machine_uprising` 종착 = 북부 요새, `water_apostle:1` = 사막 오아시스가 safe 지역에 있다). 앞에 두면 그 둘이 영원히 안 뜬다.
그리고 **`spawnEnemy`는 빈 몬스터 테이블에서 `mStats: null`이다** — `selectEncounterMonster`가 빈 풀에서 `pool[Math.floor(rng() * 0)]` = `undefined`를 돌려주던 것이 근본 원인이었다. 호출처는 `null`을 타입으로 강제받는다: 게임 경로는 `MSG.EXPLORE_QUIET`로 조용히 끝내고 정산 outcome은 **기존 `'nothing'`을 쓸 것**(새 종류를 만들면 `advanceExploreState`의 `default`가 전투로 취급해 `quietStreak`를 리셋한다), 모델 경로(`progressionSimulator`/`progressionDiagnostic`)는 맵을 이미 `type !== 'safe' && monsters.length > 0`으로 거르므로 그 분기가 불가능 상태다 — `!`로 누르지 말고 명시적 throw로 적을 것.

**4. Quick Slot 검증**
앱 부팅 시 quick slot이 더 이상 인벤에 없는 아이템을 참조할 수 있음. 로드 시 sanitize 로직 유지.

**5. Daily Protocol 타이밍**
탐험마다 reset하면 안 됨. 날짜(timestamp) 기반으로만 reset. `getDailyProtocolCompletions()` 로직 수정 시 주의.

**6. 복원할 수 없는 모드는 복원하지 않는다**
세이브 봉투는 여섯 필드다 — `{player, gameState, enemy, grave, currentEvent, quickSlots}`(`useFirebaseSync.flushLocalSave`). **봉투 밖 런타임 상태를 화면 조건으로 쓰는 모드를 그대로 복원하면 그 화면을 띄울 조건이 영원히 거짓이 된다.** `LOAD_DATA`의 `restorableMode()`가 그 판정을 소유한다(Wave 18):
- `combat` → `enemy`가 함께 와야 한다(기존 한 줄, 이 결함 종류의 첫 사례)
- `event` → `currentEvent`가 함께 와야 한다. `exploreActions`가 AI 호출(9.5s) **전에** `GS.EVENT`를 세우고 저장 디바운스는 500ms라 `{event, currentEvent: null}` 세이브가 실재한다. 복원하면 `isAiThinking`이 비영속이라 false로 돌아오고 `EventPanel`이 `return null` → **웹/iOS 영구 벽돌**(TerminalView도 `FOCUS_PANEL_STATES`라 마운트되지 않는다). Wave 19 K1 이후 AI 경로는 `GS.EVENT`를 응답 **뒤에** 세우므로 이 세이브는 더 이상 생산되지 않는다 — 이 줄은 방어선으로 남는다
- `event_pending` → 언제나 접는다(Wave 19 K1). 대기 중인 AI 응답 promise는 리로드를 못 넘으므로 동반 상태가 무엇이든 복원할 수 없다 — 복원하면 '준비 중' 패널이 영원히 뜬다
- `dead` → 언제나 접는다. `runSummary`는 전투 패배 순간에만 만들어지고 저장되지 않는데 사망 화면 조건이 `GS.DEAD && runSummary`다

봉투의 `gameState`는 `isGameMode`로 먼저 좁힌다 — **미지의 문자열(예: 구 `'formation'`)은 `idle`로 접힌다**(Wave 20 L1; 그 전에는 그대로 복원돼 어느 렌더 트리도 못 그리는 상태였다). `restorableMode`는 `GameMode` 전수 `switch`이고 default가 `never`라 **새 멤버는 여기에 줄을 추가하지 않으면 컴파일 에러**다.

**새 모드를 봉투에 넣지 않은 채 영속시키려면 여기에 줄을 추가해야 한다.** 그리고 그 아래 두 정리 분기는 **서로 다른 값을 읽는다** — 모험 유물 정리는 `requestedMode`(폴드된 값으로 읽으면 사망 세이브의 정리가 건너뛰어진다), 포식 보너스 종료는 폴드된 `gameState`(`requestedMode`로 바꾸면 `adventure-relic-lifetime`의 "불완전 전투 정리"가 깨진다). 둘 다 실측으로 갈랐으니 바꾸지 말 것.

**7. Firebase 익명 인증**
앱 부팅 시 자동 초기화. `bootStage`가 완료되기 전에 게임 렌더링 금지 (저장 데이터 로드 전 기본값으로 덮어씌워지는 race condition 주의).
**부트 순서·복원 payload 선택·복원 텔레메트리는 `src/platform/bootStateMachine.ts`가 소유한다**(Wave 10 B3 + Wave 11 C1). `useFirebaseSync.ts`에는 IO(저장소·Firestore·`migrateData`·`cloudSaveAuthority`)·타이머/구독 배선·로그 id 생성·React ref 갱신·텔레메트리 전송만 남는다 — 훅에서 `AT.LOAD_DATA`를 직접 dispatch하면 전이표 밖에 두 번째 부트 경로가 생기므로 금지이고(테스트가 소스에서 잡는다), 새 부트 분기는 이벤트 + 효과로 전이표에 넣을 것.

**8. `firestore.rules`는 파이프라인이 배포하지만, 배포 성공은 저장소가 보장하지 못한다**
Wave 15 G3이 `deploy.yml`에 `deploy-rules` job을 넣었다 — 버전 리터럴은 `package.json`의 `firebase:cli` 한 곳이며(`test:rules`와 같은 버전), 시크릿 선택은 식 안의 `A && B || C` 삼항이 **아니라** 셸 분기다(그 삼항은 PROD가 비면 조용히 DEV로 떨어져 **prod 푸시가 dev 프로젝트에 배포되고 초록으로 끝난다**). 그래도 **충분조건이 아니다**: 서비스 계정이 hosting 전용 역할이면 `firebaserules.releases.update`에서 `PERMISSION_DENIED`로 죽고, 그건 저장소 안에서 확인할 수 없다. 그 경우 job은 **빨갛게 죽는다**(`continue-on-error`는 쓰지 않는다 — 초록은 "배포됐다고 믿는데 안 된 상태"를 다시 만든다). 즉 실패 시 "rules가 먼저"라는 보장은 **성공 경로에만** 남는다. 새 클라이언트 쓰기 지점은 여전히 `permission-denied` 시 degrade 경로를 함께 둘 것(Wave 13 E4의 4키 폴백이 선례).
**실측(Wave 19 K4)**: 그 실패는 예고보다 **한 단계 앞에서** 일어났다 — `deploy-rules`는 PR #42~#45 머지에서 4회 실행·4회 failure이고, 죽은 지점은 `firebaserules.releases.update`가 아니라 firebase-tools가 rules 배포 **전에** 하는 API 활성 조회(`serviceusage.googleapis.com … 403 Permission denied to get service [firestore.googleapis.com]`)다. 즉 SA에 `serviceusage.services.get`이 없으면 `firebaserules.*` 권한은 검사조차 안 된다 — IAM을 고칠 때 두 역할을 **함께** 줘야 한다(`roles/serviceusage.serviceUsageConsumer` + `roles/firebaserules.admin`). 그리고 같은 워크플로의 `deploy-prod`(Firebase Hosting)는 `429 RESOURCE_EXHAUSTED`(Hosting 스토리지 쿼터)로 **2026-08-04 run 259부터 연속 failure**인데, 실제 프로덕션 웹 호스트는 Cloudflare Pages(`docs/QUICK_DEPLOY.md`, `functions/api/`)라 이 job은 잔재였다. §19~§22의 "CI 그린"은 전부 `ci.yml` 얘기였고 `deploy.yml`은 그동안 한 번도 초록이 아니었다. 이 둘은 코드가 아니라 소유자 결정(IAM 부여 / Hosting job 삭제 여부)이었다 — §23에 질문으로 남겼었다.
**해소(2026-09-21, run 351 = PR #46 머지)**: secret의 SA는 `github-action-…`이 아니라 Firebase 콘솔 "새 비공개 키 생성"이 발급하는 `firebase-adminsdk-…@<project>.iam.gserviceaccount.com`이었다(프로젝트에 SA가 그것 하나뿐 — IAM 목록에 `github-action-…`이 없으면 이 경우를 먼저 의심할 것). 그 SA에 `Service Usage Consumer` + `Firebase Rules Admin` 두 역할을 붙인 뒤 첫 `main` 푸시에서 `✔ firestore: released rules firestore.rules to cloud.firestore` — G3 도입 이후 **첫 성공**이고, 그 전까지 prod rules는 마지막 수동 배포 시점에 멈춰 있었다(즉 Wave 14 F3의 의견 보내기 경로 등은 이날 처음 prod에 열렸다). 남아 있던 `deploy-prod`(Hosting 429)는 Wave 20 L2가 job 자체를 지워 해소했다(아래 해소 2).
**해소 2 (Wave 20 L2)**: Q2 = (a) 결정 — `deploy.yml`에서 `deploy-dev`/`deploy-prod`(Firebase Hosting) job과 그 유일한 소비자였던 `build`의 `Upload Build Artifacts` 스텝을 삭제했다(`tests/cf-functions.test.js`가 `action-hosting-deploy` 식별자와 `firebase.json`의 `hosting` 키 부재를 계약으로 고정한다). 소유자 콘솔 실측(2026-09-21): Hosting 사이트(`aetheria-rpg-90a2f.web.app`/`.firebaseapp.com`, 커스텀 도메인 없음)는 job 삭제와 무관하게 **2026-07-15 14:34 릴리스 `ec5cb6`**를 계속 서빙한다 — job을 지운다고 사이트가 꺼지지는 않는다, CI가 그 빌드를 더 이상 갱신하지 않게 될 뿐이다. 사이트 자체를 끄려면 `firebase hosting:disable --project <prod>`(콘솔 "사이트 사용 중지"와 동등)이 필요하고, 그건 별도 소유자 결정으로 남는다(Q4, 저장소 밖). 머지 push(run 353)에서 `deploy.yml`이 **도입 이래 처음으로 run 전체가 초록**이었다 — 이제 이 워크플로의 빨강은 잔재가 아니라 rules 배포 실패다.

**9. `tier`는 비용 밴드가 아니라 위상 라벨이고, 아트 identity에 묶여 있다**
`CLASSES[*].tier`를 읽는 곳은 4군데다 — `ClassIcon`의 `TIER_COLORS`(색), `skill-branch-parity`의 분기 의무, `progressionSimulator`의 `jobSnapshots[].tier`(골든 해시), 그리고 **`scripts/artCatalog.mjs`의 `normalizeClasses`가 아트 카탈로그 identity 해시**에 넣는다. 그 해시(`catalogSha256`)는 `scripts/art_sources/**`의 아트 생산 provenance 65개를 포함해 1,065개 파일에 핀돼 있고, 아트 스위트는 비활성 해시를 가진 기록이 **거부되는지**를 테스트한다. 즉 `tier` 한 글자를 바꾸면 유닛 70건이 red가 되고 그 복구는 증빙 재생성이 아니라 역사 재작성이다. 비용 게이트는 `reqLv`가 소유한다 — 밸런스를 만질 때 `tier`를 건드리지 말 것.

**10. 청크 분리 설정**
`vite.config.js`의 `manualChunks` 설정이 성능에 직결. 실측 청크는 vendor-react · vendor-motion · vendor-charts · **vendor-firebase-{firestore,auth,core}**(하나가 아니라 셋이다 — cycle 61에서 기능별로 쪼갰다) · game-data · game-combat · game-equipment다. 프로덕션 빌드 상위는 game-data 480K · index 464K · vendor-react 188K · vendor-firebase-firestore 180K 순(Wave 17 실측). 대형 라이브러리 추가 시 청크 포함 여부를 검토할 것 — 다만 **결과를 재는 것은 `npm run perf:guard`(FCP/DCL blocking)**이고 청크 구성 자체를 고정하는 가드는 없다.

**11. 모바일 viewport**
`100dvh` 사용 (100vh 아님). iOS Safari 하단 주소창 때문. `env(safe-area-inset-*)` CSS 변수도 MainLayout에서 이미 처리 중 — 중복 적용 주의.
