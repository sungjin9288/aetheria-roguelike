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
| Mobile | Capacitor | core/ios/cli 8.5.0 · Android 8.3.1 · App 8.1.1 |
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
> `QuestType` 10종, `AchievementTarget` 20종, `ClassSkillEffect` 30종 등)이고,
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
│   ├── bagRecipes.ts          # 제작소 가방 5단계 (이번 런 한정, Wave 33)
│   ├── storyChapters.ts       # 본편 16장 완료 서사 (선행 사슬과 같은 순서, Wave 74)
│   └── quests.ts              # 151개 퀘스트 + 73개 업적 (ACHIEVEMENTS 포함)
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
    ├── wanderingMerchant.ts   # 떠돌이 행상인 만남 · 재고 (탐험 수 · 지역 해시, 탐험 난수 미사용 — Wave 75)
    └── commandParser.ts       # 명령어 파싱
tests/                # 단위 테스트 (Node.js built-in test, 433 파일 / 5,935 케이스, skip 0, 로컬 full gate 통과·현재 PR CI는 원격 기록 참조 — 아트 재현성은 디코딩 픽셀 기준,
                      #   UI 계약은 tests/helpers/render.ts 렌더 단언 — 소스 정규식 가드는 아트/네이티브/Toss 증빙 계약에만 남김)
                      #   + e2e/ (Playwright 53 스펙 / 155 테스트, iPhone 12 에뮬레이션 — 엔진은 chromium 고정, Linux WebKit hang 회피) + device-qa/
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

**iOS scene:** Xcode 27 SDK 대응은 `SceneDelegate`가 단일 window/bridge를 생성하고 scene proxy로 URL·userActivity를 전달하는 경로다. Main storyboard 자동 생성과 중복시키지 않는다. native lifecycle 변경 시 [iOS scene QA](docs/qa/IOS_SCENE_LIFECYCLE_QA.md)의 결함 주입·양쪽 simulator 재실행 검증을 유지한다.

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
- **임무 목표를 문자열 포함으로 판정하지 말 것**: 적의 identity는 `baseName`(종)이고 표시 `name`은 그 위의 장식(`CONSTANTS.MONSTER_PREFIXES`·`정예` 접두어, `[N층]` 태그)뿐이다 — 판정은 `utils/enemyIdentity.ts`의 `matchesQuestTarget`(정확 일치, 장식만 벗김)이 소유한다. `questProgress`가 `enemyName.includes(target)`이던 동안 종장 임무 87(target `마왕`)이 마왕성의 **`마왕의 사도` 처치로 완료·수령 가능**해졌고(실제 `RESOLVE_COMBAT_ACTION` 재현), 같은 규칙이 임무 7종(1·3·8·35·87·99·140)을 가족 이름(`초록슬라임`·`코볼트 광부`·`사슬 마왕`…)에 반응시켰다(원장 §26.11). 접두어 어휘는 `EARLY_ELITE_PREFIX_NAME` 한 곳이다 — `spawnEnemy`와 판정기가 같은 상수를 읽는다. `tests/quest-target-identity.test.js`가 몬스터 목표 임무 × 몬스터 이름 전수(2만 쌍 이상)로 되돌리기를 잡는다.
- **이벤트 선택지 거부를 로그로만 남기지 말 것**: 이벤트 화면(`GS.EVENT`)은 `FOCUS_PANEL_STATES`라 TerminalView가 마운트되지 않는다 — 오류 로그만 남기는 거부는 플레이어에게 **무반응**이다. 거부는 `rejectEventChoice`(`reducers/handlers/eventChoiceFeedback.ts`)로 `currentEvent.choiceFeedback`에 싣고 `getEventChoicePreview`가 누른 선택지의 미리보기 줄로 그린다(폴백 트랜잭션 · 한정 조우 · 체인 골드 선택). 이벤트를 원장과 **구조 비교하는 정본 판정은 `choiceFeedback`을 빼고** 비교할 것 — 넣으면 한 번 거부된 이벤트의 모든 선택지가 무반응이 된다. 폴백 트랜잭션 이벤트의 모양은 원장(`structuredFallbackEvents`) 소유다 — 포장기가 선택지를 채우던 동안 비용 선택지는 자연 플레이 157/157 무반응이었다(Wave 27 N1). `tests/event-choice-response-contract.test.js`가 `explore()` 실경로 × 모든 선택지로 잡는다.
- **가방 상한은 증가만 막는다, 유물 상한은 모든 지급 경로가 지킨다**: 보상 경로(퀘스트·체인·마일스톤·묘비)는 상한을 보지 않고 지급한다(보상 소실 금지) — 그래서 가방은 상한을 넘을 수 있고, 조작은 **결과가 상한과 현재 크기를 둘 다 넘을 때만** 거부한다(`utils/inventoryCapacity.ts`; 교체 뒤 크기만 보던 동안 21/20 가방에서 장비 교체가 전부 막혔다). 유물은 반대로 상한에서 **거부하거나 교체를 제안**한다(`AT.REPLACE_RELIC` + `RelicChoicePanel`) — 조용히 넘치거나(체인 완주 보상이 6/5·7/5를 만들었다) 버리지 말 것. 유효 최대치(`calculateFullStats`)를 낮추는 전이는 `clampVitalsToEffectiveMax`로 현재 생명/기력을 내린다(올리지는 않는다)(Wave 27 N2). 칭호 전환도 그런 전이라 리듀서 `AT.SET_ACTIVE_TITLE`이 소유한다 — `SET_PLAYER {activeTitle}`로 바꾸면 생명 칭호를 해제해도 생명이 옛 최대치에 남는다(Wave 30). 유물 상한은 어느 지급 경로든 `getPrestigeUnlocks(rank).maxRelics`다(일일 파편 변환이 `MAX_RELICS_PER_RUN` 5로 고정돼 rank 2의 여섯 번째 칸을 무시했다), 직접 지급도 `stats.relicCount`를 올린다(Wave 30). `tests/inventory-capacity-growth-rule.test.js` · `chain-relic-capacity.test.js` · `effective-vitals-clamp.test.js` · `title-relic-leftover-contract.test.js` · e2e `relic-replace.spec.ts`.
- **가방 상한은 `getInventoryCapacity` 하나가 계산한다 — 영구 크기(`maxInv`, 크리스털 확장) + 이번 런에 제작한 가방 칸(`bagTier`)**(Wave 33, 소유자 결정 "가방을 제작요소로" · "런마다 다시 만드는 가방"). `maxInv || BALANCE.INV_MAX_SIZE`로 직접 읽던 9곳을 옮겼고 부재 불변식이 되돌리기를 잡는다(크리스털 교환 화면만 영구 확장 상품이라 `maxInv` 그대로). 가방 단계는 `data/bagRecipes.ts`(5단계 × 3칸, 20 → 35)이고 제작은 리듀서 `AT.CRAFT_BAG`(제작소에서만 · 지금 단계 + 1만)가 소유한다. **`bagTier`는 영구 상태가 아니다** — `pickPermanentPlayerState`에 넣지 말 것(사망·계승에서 0). 재료는 **넓은 레벨대에서 계속 나오는 것**만 쓴다: 구간 한정 재료를 쓰던 동안 그 구간을 지나친 드라이버 런은 다음 단계에서 영구히 막혔다(순서 제작이라 뒤 단계 전부). 일괄 판매(`getAutoSellMaterialTargets`)는 다음 가방 단계에 필요한 수량만큼은 팔지 않는다. `tests/bag-crafting-contract.test.js` · e2e `bag-crafting.spec.ts`.
- **"다음 이동" 안내는 걸을 수 있는 길이어야 한다**: 지도·조작판·모험 가이드가 쓰는 `findMapPath`(`utils/mapTopology.ts`)는 경유지 진입 레벨의 **병목이 가장 낮은 길**을 고르고, 병목이 같으면 최단이다. 계절 지역은 목적지가 아닌 한 경유지가 아니다. 출구 순서 최단 BFS이던 동안 839쌍이 목적지에 처음 걸어서 닿는 레벨에 걸을 수 없는 경유지를 안내했다(84를 든 채 암흑 성 → 기계 폐도가 Lv44 지하 미궁을 가리켰다). `tests/mission-route-walkable.test.js`가 실데이터 전수를 이동 규칙(`getReachableMaps`/`getMapAccess`) 오라클로 잡는다.
- **서명(전설 각인) 판매 판정은 `utils/signatureSale.ts` 한 곳이다**(Wave 28 D4): 쓸 수 있는 유일한 사본만 보호하고, 중복 사본과 현재+향후 전직 경로(`CLASSES[*].next` 전이 폐포)의 누구도 못 쓰는 사본은 판다. 도감은 획득 순간 기록되고 가방은 승천 때 비워지므로 판매가 수집을 지우지 않는다. 리듀서(`economyHandlers`)와 상점 UI가 같은 판정을 읽는다 — 한쪽에 `isSignatureItem` 차단을 다시 넣지 말 것. 합성은 여전히 서명을 재료로 쓰지 않는다(`tests/signature-sell-protection.test.js`).
- **초반 구간의 일반 스폰은 완전 정예를 뽑지 않는다**(Wave 28 D7): 맵 레벨 ≤ `BALANCE.EARLY_ELITE_LEVEL_CAP`에서 일반 접두어 풀은 `isElite`(재앙의·고대)를 뺀다(롤 수 불변). `eliteOnly` 도전·프레스티지 정예·초반 전용 완화 정예는 유지한다. `spawnEnemy`는 성장 시뮬레이터의 입력이라 **여기를 바꾸면 모델 해시와 도달 비용 앵커가 움직인다** — 이번 변경은 체크포인트를 +2~5 액션 옮겼다(`tests/early-full-elite-band.test.js` · `progression-simulator` 골든).
- **무작위 접두어는 종 이름의 낱말과 겹치지 않는다**(Wave 71, 소유자 결정 "접두어 겹치는 경우 빼기"): 풀은 `getSpeciesPrefixPool`(`utils/enemyIdentity.ts` — 접두어 어휘의 소유처)이 종 이름의 낱말과 같은 접두어를 빼고 만든다. `spawnEnemy`는 그 위에서 정예 · 초반 비정예를 거르고 **롤 수는 그대로**다 — 겹칠 때 다시 굴리면 난수열이 밀려 오프라인 게임 전체가 바뀌고, 표시 이름에서만 지우면 능력치 배율이 붙었다는 사실이 이름에서 사라진다(둘 다 결함 주입으로 잡는다). 겹치는 종은 `거대`(사슴벌레 · 거북 · 지렁이 · 지네)와 `고대`(호수의 수호신 · 마법사) 6종이고, eliteOnly · 프레스티지 정예의 "고대 마법사"는 정예 풀에 재앙의만 남는다. 고정 장식(초반 정예 `정예` · 2페이즈 `격노한`)은 풀을 거치지 않으므로 어느 종 이름에도 그 낱말이 없어야 한다(계약). 64시드 성장 모델은 +0.00 ~ 0.39%(원장 §74). `tests/monster-prefix-species-overlap.test.js`
- **보스 여부는 몬스터가 정한다 — 지역의 `boss` 문자열은 구역 보스의 이름이다**(Wave 29): `spawnEnemy`의 `isBoss`는 몬스터 자신의 프로필 · 지역 `bossMonsters` 목록 · `BOSS_MONSTERS`만 본다. `(mapData.boss && bossMonsters 없음)` 분기가 있던 동안 그 목록이 없는 14곳(저주받은 묘지·용암 지대·세계수 숲·천공 정원 등)의 일반 스폰이 전부 보스로 정산됐다. 성장 모델(EXP)은 이 차이를 거의 못 본다(64시드 체크포인트 ±0.1%). 대신 보스 보너스 장비(Lv35 지역에서 tier 6 — 그 레벨에 장착 불가)의 판매 가치가 처치당 약 7,500골드였다(적 골드 약 92). 마왕성 전 보스 처치 수도 657회(수정 후 27)라, 보스 업적·칭호·시즌 XP·서명 pity가 Lv34 전후에 포화됐다. **진단 증빙의 전투·전리품 절은 이 14곳을 표본으로 쓰지 않아 A/B가 바이트 동일했다** — 이 계열(판매 가치·보스 정산)은 증빙이 아니라 지역별 행동 테스트가 지킨다(`tests/boss-field-normal-spawn.test.js`).
- **임무 목표 지역의 진입 레벨 표시는 `utils/questObjectiveGate.ts`가 소유한다**(Wave 28): 수락 규칙은 그대로이고, 게시판·임무 탭은 지금 레벨로 아직 못 들어가는 목표 지역일 때만 실제 진입 레벨을 그린다. 규칙은 도달 비용 리포트(`contentReachability.questObjectiveMaps`)와 같아야 한다 — `tests/quest-objective-gate.test.js`가 괴리 임무 20개 전부를 대조한다.
- **혼돈의 심연 층 번호는 하나다**(Wave 35): `stats.abyssFloor`는 **돌파한 층 수**이고 지금 싸우는 층은 `abyssFloor + 1`이다 — 스케일 · 보스 층 · 적 레벨(`exploreFlow`) · 이름의 `[N층]` 태그(`spawnEnemy`) · 돌파(`applyAbyssFloorAdvance`)가 같은 번호를 읽는다. `|| 1` 폴백이 두 곳에 있던 동안 첫 돌파가 0 → 2였고 일반 적 표시가 한 층 낮았다("[10층 보스]" 다음이 "[10층]"). 층 태그는 접두어 · 정예 격노 이름에도 남는다(`depthTag`). 마일스톤 · 칭호 · 유물 층 보너스는 돌파 층 수를 읽는다. `tests/abyss-floor-numbering.test.js`
- **후반 강화 재료는 드롭 표가 아니라 적 레벨 규칙이 준다**(Wave 39, 소유자 결정 "후반 드롭"): `enemy.level` ≥ `BALANCE.ENHANCE_MATERIAL_LATE_DROP_MIN_LEVEL`(25)이면 `processLoot`가 두 경로(드롭 표 · 레거시)의 **맨 끝**에서 한 번 판정한다(일반 2% · 보스 50%, 다른 드롭과 같은 배율). 드롭 표에 강화 재료 줄을 넣지 말 것 — 표가 있는 적은 표를 돌린 뒤 곧바로 반환해 고레벨 보너스 장비를 건너뛴다(후반 적 상당수가 표 없이 보너스 장비만 떨어뜨린다). 기준 아래 적은 난수를 더 쓰지 않으므로 초반 전리품은 바이트 그대로이고, 기준 이상 적의 난수 소비를 고정한 핀 테스트는 그 마지막 추첨을 명시적으로 센다. 이전에는 공급원이 Lv3~18 네 지역뿐이라 225h에 16시드 중앙값 10개였다(원장 §38). `tests/enhance-material-late-drop.test.js`
- **영구 스탯은 레벨에 비례해 적용되고, 계승 rank는 적 전투 레벨을 비례로 올린다**(Wave 40, 소유자 결정 "더 하드하게" — Wave 72의 이야기 보상 · 정예 목격 칭호도 같은 비례): 영구 공격력 · 생명 · 기력은 `BALANCE.META_BONUS_FULL_LEVEL`(30)까지 레벨 비율만 적용된다(`systems/metaBonusRamp.ts`). 공격력은 `calculateFullStats`가 `getRampedMetaAtk`로 더한다. 생명 · 기력은 저장된 `maxHp`/`maxMp`가 정본으로 남으므로(직접 읽는 곳 148곳) 값을 저장 밖으로 빼지 말 것 — 재구성(새 게임 `start` · 전직 · 사망 재시작 `handleDefeat` · 계승 `ASCEND`)이 전체량 스냅숏 `player.metaVitalsSnapshot`(런 범위, `pickPermanentPlayerState`에 넣지 않는다)을 남기고 그 × 비율만 굽고, 레벨업(`applyExpGain`)이 비율이 오른 만큼 더 굽는다. 새 재구성 경로를 만들면 `buildClassVitals`/`snapshotMetaVitals`를 거칠 것 — 계승이 그 경로를 안 타던 동안 넘어온 영구 생명이 첫 전직까지 0이었다. 적 전투 레벨 = 레벨 + round(레벨 × `getPrestigeEnemyLevelRate(rank)`)이고 생명 · 공격력 · 방어력에만 쓴다(표시 레벨 · 경험치 · 골드는 원래 레벨). **고정 가산으로 바꾸지 말 것** — rank당 +1~2레벨 고정은 Lv1~5 지역 적을 몇 배로 만들어 거울 없는 4회차에 시드 하나가 20~38번 죽는 사망 루프였다(원장 §40). **비율은 계승할 때마다 오르고 오르는 폭은 줄어든다**(Wave 73, 소유자 결정 "회차가 누적됨에 따라 몬스터들도 강해진다"): `BALANCE.PRESTIGE_ENEMY_LEVEL_PCT_LIMIT` × (1 − `_DECAY`^rank) = 60% × (1 − 0.65^rank), rank 1 ~ 5는 +21 · 35 · 44 · 49 · 53%다. 상한 30%(rank 3)에서 멈추던 동안 2 · 3회차는 80시드 중 72 · 68%가 무사망이었다. **직선으로 되돌리지 말 것** — rank당 +20%는 5 · 6회차에 최악 시드 15 · 18회의 사망 루프였고 +10%도 6회차 최악이 11회였다(채택 곡선 최악 7회, 원장 §76). `tests/rank-enemy-growth-contract.test.js` `tests/meta-bonus-ramp-and-rank-enemy-level.test.js`
- **직업 기술의 광고와 동작은 같아야 하고, 강점 · 약점은 데이터가 선언하고 계약이 근거를 검증한다**(Wave 42, 소유자 결정 "직업별 강점 · 약점 강조"): 회복 기술(`hp_regen`)은 즉시 `val`을 회복하고 `turn`턴 동안 턴마다 `val / turn`을 더 회복한다(`player.skillRegen`, `tickCombatState` 소유). 회복 기술은 강화 칸(`tempBuff`)을 쓰지 않는다 — 쓰던 동안 기적의 손길이 신성한 보호막을 껐다. 공포는 기술의 `turn` · `val`(공격력 배율)을, 실명 · 도발은 `turn`을 쓴다(상수는 기본값일 뿐이다). `CLASSES[*].traits`(강점 17종 · 약점 6종, 라벨은 `MSG.CLASS_TRAIT_LABELS`)를 바꾸면 `tests/class-traits-contract.test.js`의 근거 술어를 통과해야 한다 — 근거 없는 강점은 전직 화면의 거짓 약속이다. 48시드에서 이 수정은 사망 · 시간을 유의하게 바꾸지 않았다(원장 §42). `tests/class-skill-effect-delivery.test.js`
  **강조는 수치로도 한다**(Wave 43, 소유자 결정 "B+C"): 자가 회복은 회복 10% 이상 또는 흡수 40% 이상, 낮은 생명은 0.8 이하, 적은 기력은 0.7 이하가 계약 경계다. 회복 · 흡수 기술 설명의 백분율은 데이터 값과 같아야 한다(같은 계약 테스트가 전 직업 · 분기를 대조한다). 값을 되돌리면 선언이 다시 이름뿐이 된다 — 경계를 느슨하게 풀지 말 것(원장 §43).
  **분기는 기본 기술과 달라야 한다**(Wave 45): 모든 `skillBranches` 선택지는 기본 기술과 **엔진이 읽는** override 키 하나 이상에서 다르다 — 화염구 B가 기본값 `mult` + 엔진이 읽지 않는 `burnTurn`뿐이라 기본 화염구와 같은 기술이었는데, 2택끼리만 비교하는 계약은 통과시켰다(소유자 결정으로 "화상 + 출혈"). dead override 키 목록(`KNOWN_DEAD_OVERRIDE_KEYS`)은 비어 있다 — 새 키는 엔진 경로와 함께만 넣을 것. 성장 시뮬레이터 · 진단 증빙은 분기를 고르지 않는다 — 분기 밸런스는 저장소 밖 자연 플레이 드라이버의 분기 정책으로 잰다(원장 §45 · §46: 전부 A / 전부 B 번들이 경로 6개 모두에서 서로를 지배하지 않았다). `tests/skill-branch-parity.test.js`
- **적 약화(실명 · 공포 · 저주 · 도발)의 "N턴"은 영향받는 적 행동 N번이다 — 판정은 틱 전 상태, 배율은 저장하지 않는다**(Wave 44): `enemyAttack`은 `tickEnemyStatus` **전에** 이번 행동의 약화를 읽는다(`getEnemyDebuffAtkMult` · `getEnemyDebuffAtkLabel` · `isEnemyTauntActive`, 예고 `predictEnemyNextAction`도 같은 판정). 틱 뒤 상태로 읽던 동안 "3턴" 공포는 공격 2번, "2턴" 연막탄은 1번이었다(기절은 이미 N번 — 한 엔진에 두 턴 모델이 있었다). 공격력 배율은 걸려 있는 약화 중 가장 강한 것을 매번 계산한다 — 공통 `atkMult` 하나를 쓰던 동안 먼저 끝난 약화가 남은 약화의 감소까지 지웠다. 공포만 기술마다 배율이 달라 `fearAtkMult`를 든다. 새 약화도 배율이 기술마다 다르면 자기 필드를 둘 것(공통 필드 금지), 적 인스턴스에 `atkMult`를 쓰지 말 것(템플릿 필드다). 48시드 6경로에서 사망 · 시간은 유의하게 변하지 않았다(원장 §44). `tests/enemy-debuff-duration-stacking.test.js`
- **유물 선택 카드의 조합 완성 판정은 엔진과 같은 `getActiveRelicSynergies`다**(Wave 47): 판정은 `utils/relicSynergyHint.ts`가 소유한다(컴포넌트 밖, 문구는 `MSG`). 이 유물을 더했을 때 새로 켜지는 조합이 완성이고, 세 조각은 `legendaryHint`, 두 조각은 `completesPair`다. 이름 · 보유 수로 다시 세지 말 것 — 세 조각만 이름으로 찾던 동안 실제 조합 20개 중 두 조각 15개의 완성이 14개나 힌트 0이었다. 효과 짝 표(`SYNERGY_MAP`)는 조합 보너스가 아니다 — "함께 쓰기 좋음"(짝당 20 · 최대 40)이고 '조합'이라 부르지 않는다(Wave 48, 소유자 결정 b+c). 추천 점수는 **층**이다: 전설 조합 완성 1000 > 두 조각 완성 800 > 세 조각 진행(2개째 — 제안 생성기의 조합 보장 슬롯과 같은 기준) 400 > 조합 시작(가진 조각이 없는 실제 조합의 조각, `startsCombo` — Wave 49 소유자 결정 "측정 후 조건부 반영") 200 > 그 밖. 층 안에서만 등급(≤52) · 빌드 적합(≤40) · 효과 짝(≤40)이 가르고, 합쳐도 층을 뒤집지 못한다. 카드 줄도 같은 층 순서로 그린다(진행 > 시작 > 효과 짝). 시작 층은 48시드 3경로에서 계승 시 켜진 조합을 2.2~2.4 → 3.2로, 시드당 사망을 z −1.8~−5.5로 줄였다(원장 §49). 제안 생성기의 조합 보장 슬롯(`pickWeightedRelics`의 시너지 pity)은 **항상 첫 카드**다 — 진행이 +18뿐이던 동안 추천을 따르면 첫 카드만 고르는 것보다 조합이 덜 쌓였다(원장 §47.4 · §48.2). `tests/relic-synergy-hint-contract.test.js`
- **조합에는 대가가 있다**(Wave 50, 소유자 결정 "조합에 단점을 붙인다" — 강하지만 위험한 조합): 모든 `RELIC_SYNERGIES`가 `drawback`(받는 피해 증가 · 방어력 감소 · 공격력 감소 중 하나)을 든다. 공격력 · 방어력은 `calculateFullStats`가, 받는 피해는 `FullStats.damageTakenMult`를 `enemyAttack` · `attemptEscape`가 곱한다. **최대 생명 대가는 쓰지 말 것** — 저장된 `maxHp`를 직접 읽는 회복 상한이 많아 효과 최대치만 낮추면 대가가 새어 나간다. 대가 문구는 데이터에서 만든다(`formatSynergyDrawback`). 선택 카드(완성할 때)와 능력치 화면이 보여 준다. 수치는 48시드로 맞췄다: 추천을 따를 때 사망이 Wave 40 기준(첫 카드) 수준이고 조합은 여전히 이득이다. 생존형 조합(흡혈 · 부활 · 재생)이 Wave 49 사망 감소의 거의 전부라 생존형의 대가가 더 크다(원장 §50). `tests/relic-synergy-drawback-contract.test.js`
- **몬스터 계열(언데드 · 마족)은 데이터가 선언하고, 성직자 계열 회복이 그 적을 태운다**(Wave 51, 소유자 결정 "성직자의 컨셉 — 마족 · 언데드에게 힐로 공격"): `MonsterBase.family`(언데드 22 · 마족 7)를 종(`baseName`) 기준 `getMonsterFamily`로 읽는다 — 이름 문자열 · 빛 약점으로 추론하지 말 것(빛 약점 93종에는 코볼트 · 평원 도적도 있다). 회복 기술의 `smite`(기적의 손길 · 기적의 부활 = 1)는 그 적에게 광고한 회복량 × smite를 방어 무시 신성 피해로 더한다(`performSkill`의 `hp_regen` 분기, 난수 없음). `smite`를 가진 기술만 설명에 신성 피해를 말하고, 그 직업만 강점 **퇴마**를 든다(`tests/cleric-holy-smite-contract.test.js`가 광고 = 동작을 대조한다). 그 관찰(모든 버프 · 회복 기술이 공격력 1.5배 피해도 준다, 원장 §51.2)은 Wave 52가 없앴다 — 이제 언데드 · 마족에게 주는 피해는 신성 피해뿐이다.
- **위력이 없는 기술은 피해를 주지 않고, 강화의 "N턴"은 건 뒤 N번이다**(Wave 52, 소유자 결정 "피해를 없앤다"): 피해 여부는 `isDamagingSkill`(`systems/skillPower.ts`, 위력 `mult` > 0) 하나가 판정하고 엔진(`performSkill`)과 기술 카드의 위력 표시가 같이 읽는다 — `mult || 1.5` 같은 기본 위력을 다시 넣지 말 것(보조 기술 56개가 설명에 없는 1.5배 피해를 줬다). 보조 기술은 피해 판정(분산 · 치명 · 속성 · 방어 경감 최소 1)을 굴리지 않고 `MSG.SKILL_USE_SUPPORT` 줄을 남긴다. 행동 끝 틱은 `tickAfterAction`(`systems/combatTurnTick.ts`)이다 — 이번 행동이 건 강화(새 `tempBuff` 객체)는 그 틱에 줄지 않는다. 턴 해석기에서 `CombatEngine.tickCombatState`를 직접 부르면 "3턴" 광폭화가 다시 공격 2번이 된다. 공격 · 방어 강화가 턴 하나를 함께 세므로 철벽 배시(기절 + 1턴 방어)는 적 공격을 만나지 못한다 — 계약이 정확히 그 하나를 예외로 고정한다. 3경로 48시드에서 사망이 Wave 40 목표보다 +44% · +46% · +26%다 — 대부분 정예전마다 강화하는 정책에서 오고, 강화를 보스전에 아끼면 아크메이지 증가는 유의하지 않다(3.54 → 3.85, 원장 §52.5). `tests/support-skill-no-damage-contract.test.js` · `player-buff-duration-contract.test.js`
- **은신은 실제 적 공격 N번을 막는다 — 데이터가 막는 수 · 확률을 선언한다**(Wave 53, 소유자 결정 "설명대로 동작하게"): `evadeHits`(기본 1) · `evadeChance`(두 번째부터, 기본 1, 첫 공격은 확정) · `nextAttackMult`(다음 피해 행동 1회) · `atkBonus`를 쓰고 설명은 그 수치를 말한다. 은신 판정은 적의 방어 자세 판정 **뒤**다 — 기절 · 방어 자세 턴은 은신을 쓰지 않는다. 은신 중에는 장비 회피를 그 앞에서 굴리지 않는다(은신 → 장비 순서, 들킨 공격에만 장비 회피). 상태는 전투 플래그(`stealthHits` 등)라 전투 시작 때 비워진다 — `nextHitEvaded`는 이전 저장 호환으로만 읽고 새로 세우지 말 것. 아무것도 올리지 않는 강화는 `tempBuff`를 덮지 않는다(은신 · 마나 가속 · 시간 역행이 광폭화 · 물약을 지웠다). 어둠의 서약은 현재 생명의 `hpCost`(15%)를 바친다. **난이도 차이를 적 · 기술 수치 보정으로 메우지 않는다** — 소유자 원칙: 플레이어 성장은 임무 · 사냥 · 장비 · 추가 시스템의 몫이다(원장 §53.1). `tests/stealth-and-pact-contract.test.js`
- **기술 설명이 약속한 효과는 엔진이 낸다**(Wave 54, 소유자 결정 "전부 설명대로 구현" — 기술 설명 전수 감사 19건 중 12건): 기절 · 빙결의 `turn`은 지속 턴이다(`stunTurn`이 있으면 그것). `hits`는 타격마다 피해 · 치명을 따로 굴린다. 카드의 위력은 타격당 위력 × 타격 수로 보인다. `ignoreGuard`(방어 자세 무시) · `stealthCrit`(은신 중에만 그 치명 확률) · `counterChance`(강화와 함께 거는 반격) · `skillMpRegen`(기력 지속 회복, 생명 지속 회복과 같은 틱) — 설명에 효과를 쓰면 이 필드나 엔진 경로가 함께 있어야 한다. 분기 override가 새 효과를 말하면 `effect` · `secondEffect`를 둘 다 데이터에 둘 것(기본 기술에 효과가 없으면 `secondEffect`만으로는 하나만 걸린다 — 혼란 찌르기 · 저주 일섬이 그랬다). 설명에 없는 확률(`effectChance`)을 숨기지 말 것. 남은 7건(지속 피해 지속 · 강화, 실명 = 명중률)은 Wave 55(아래). `tests/skill-description-delivery.test.js`
- **지속 피해의 "N턴간"은 적 행동 N번이고, "+N%"는 그 지속 피해의 틱이다 — 실명은 명중률이다**(Wave 55, 소유자 결정 "전부 설명대로 구현" — 기술 설명 감사의 남은 7건): `turn`을 가진 지속 피해 기술(출혈베기 · 영혼 소환)은 적에 `dotTurns`를 건다 — 적 행동마다 피해 뒤 1 줄고 0이면 지속 피해 · 남은 턴 · 배율이 함께 사라진다(`tickEnemyStatus`). `turn`이 없는 기술의 지속 피해는 전투 내내이고, 시간 제한 기술이 그것을 줄이지 않는다(재적용은 턴을 처음부터, 턴 없는 기술이 걸면 전투 내내로). `dotDamageMult`(심층 출혈 · 맹독 · 독 보강 · 역병의 안개)는 적의 `dotMults`에 실려 그 지속 피해의 틱을 키우고 강한 배율이 남는다 — 지속 피해 강화를 타격 위력(`mult`)으로 흉내 내지 말 것(두 분기가 그랬다). 실명은 `getEnemyDebuffAtkMult`에 끼지 않는다 — 실명이 남은 적 공격은 `BALANCE.BLIND_ENEMY_MISS_CHANCE`(0.35, 이전 공격력 ×0.65와 기대 피해 동일)로 빗나가고(틱 전 상태 · 방어 자세 · 은신 판정 뒤), 판정은 `isEnemyBlindActive`가 소유한다. 전투 화면 약화 칩은 시간 제한 지속 피해에 남은 턴을 붙인다(`MSG.ENEMY_DOT_CHIP_TURNS`). 4경로 + 분기 A 48시드에서 사망은 유의하게 변하지 않았다(원장 §55). `tests/dot-duration-and-blind-miss-contract.test.js`
- **유물 · 조합 설명이 약속한 효과는 엔진이 낸다 — 회복은 생명을 줄이지 않고 상한은 실효 최대 생명이다**(Wave 56, 소유자 결정: 하향 방향은 영혼 수집가만 설명대로 · 나머지는 문구, 상향 방향은 전부 구현 + 측정): "공격"이라 말하는 유물(처형자의 날 · 예언의 돌판 · 허공의 심장 · 동결의 닻 · 흡혈 조합)은 위력 있는 기술에도 적용된다. 조합 값은 **가장 큰 값**을 쓴다 — `find`로 첫 조합을 고르지 말 것(`getStrongestSynergyCritDmg` · `getStrongestSynergyLifeSteal`, 추가 행동 · 엔트로피의 신 · 부활 회복도 같다 — 시간의 지배자 · 원초의 분노 · 엔트로피의 신 · 혈맹 불사가 가려져 있었다). 지속 피해 유물은 틱에도 붙고 대상은 데이터 `dotScope`가 정한다(`getRelicDotMult` — 죽음의 낙인 독 · 화상, 없으면 전부 · 저주 틱 포함). 부활 조합(`reviveHeal`)과 난공불락(`healOnSave`)은 모든 부활 수단에 적용한다. 그림자 망토는 전투 시작 때 `cloakEvadePending`, 운명의 거울은 받은 피해 반사, 허공의 눈은 풀에 이미 있는 보스의 가중치만 올린다(숨은 보스 해금 우회 금지). 영혼 수집가의 처치 수는 유물 인스턴스의 `kills`다(계정 평생 처치 수 금지). 실제 승리 경로는 `buildPassiveBonusWithScout`가 켜진 조합을 넘긴다. **회복 상한은 `systems/vitals.ts`가 소유한다**: `healWithinMax`(회복은 생명을 줄이지 않는다) · `getEffectiveMaxHp`(`calculateFullStats().maxHp` — 전투 한정 보너스를 걷어 낸 뒤의 값) · 전투 중 기력 상한 `getEffectiveMaxMp`(실효 최대). 저장된 `maxHp`로 회복 상한을 걸지 말 것 — 처치 회복 · 흡혈 · 회복 틱이 장비로 늘어난 생명을 깎았다(실효 696 → 500). 전투 중 능력치(`FullStats.maxHp`)를 승리 뒤 상한으로 쓰지 말 것 — 세계 포식자의 전투 한정 생명이 남아 생명이 실효 최대를 넘었다(드라이버 `hpAboveFullMaxHp`). 4경로 48시드에서 사망이 약 40% 줄었고 유물 변경과 회복 상한 수정이 반씩 나눴다(원장 §56). 원소 저항 · 재생 장비 · 혼돈의 심장 · 혼돈의 보석은 Wave 57. `tests/relic-description-delivery.test.js`
- **장비 상시 효과는 표가 소유하고, 전투 한정 유물 효과는 전투가 끝나는 모든 경로가 끝낸다**(Wave 57, 소유자 결정 "이번에 설계 · 구현"): 원소 저항 · 재생 장비의 효과는 장비 행이 아니라 `data/equipmentPassives.ts`가 갖고 표준 장비 정체성(`resolveEquipmentBaseIdentity`)으로 조회한다 — 장비 행(`items.ts`)에 효과 필드를 넣지 말 것(장비 경제 증빙의 승인 다이제스트가 행 전체를 고정한다). 적 공격의 원소는 적 자신의 원소(`resistance`, `물리` 제외)이고 막으면 × `BALANCE.EQUIP_ELEMENT_RESIST_MULT`(0.5 — 같은 원소를 막는 장비가 둘이어도 한 번)다. 도주 실패 피해도 같다. 재생 장비는 대지의 심장과 같은 틱 · 기준이다. 혼돈의 심장은 가지지 않은 유물 하나를 `borrowed: true`로 `player.relics`에 넣어 그 전투 동안 빌린다 — 조합 · 대가까지 엔진 판정 그대로 켜진다(소유자 답 "조합까지 켜지게"). 빌릴 수 있는 효과는 `CHAOS_HEART_ELIGIBILITY`(`Record<RelicEffect, …>`)가 분류한다 — 새 유물 효과는 분류해야 컴파일된다. 승리 정산 · 탐험 · 원정 상태 · 심연 진행 효과와 가진 유물과 같은 효과는 빌리지 않는다(빌린 유물은 정산 전에 돌려주므로 효과가 없거나 원정 누적이 남는다). 혼돈의 보석은 `combatFlags.chaosGemStat`으로 그 전투 내내다 — `tempBuff`에 넣지 말 것(기술 강화가 덮어썼다). 끝내는 것은 `endCombatScope`(`utils/combatScope.ts`, Wave 66 — 유물 종료 `endCombatScopedRelics`를 감싼다) 하나다: 승리(정산 전) · 패배 · 도주 · 전투가 아닌 복원(`LOAD_DATA`) · 다음 전투 시작. 새 전투 종료 경로를 만들면 이것을 거칠 것 — 빠뜨리면 빌린 유물이 영구 소유가 된다. 보유 수 표시는 `countOwnedRelics`다. 빌린 유물은 빌드 성향을 바꿔 실효 최대치를 낮출 수 있어 빌린 직후에도 현재치를 내린다(측정이 잡았다). 5경로 48시드에서 사망은 유의하게 변하지 않았다 — 실제 발생이 드물다(보석은 전투의 9 ~ 16%, 심장 0.05 ~ 1.4%, 저항은 나이트 · 버서커만, 재생 장비는 장착 0, 원장 §57). `tests/equipment-passives-contract.test.js` · `chaos-relics-contract.test.js`
- **계승도 새 여정의 시작 조건을 거치고, "+N" 고정 보너스는 모든 배율 뒤에 더한다**(Wave 58, 소유자 결정: 강해지는 쪽 "설명대로 구현 + 측정" · 약해지는 쪽 "전부 설명대로" · 도전 조건 "계승 화면에서 함께 고름"): 새 여정의 시작 조건(거울 시작 골드 · 첫 유물 선택지 · 도전 조건 거르기 · 약한 생명력)은 `utils/runStart.ts`가 소유하고 새 게임(`start`)과 계승(`ASCEND`)이 같이 읽는다 — 계승 리듀서에 따로 계산하지 말 것(사망 재시작에만 적용되던 동안 정상 경로 "마왕 → 계승"은 시작 골드 200 · 유물 선택지 없음이었다). 계승의 첫 유물 선택지는 payload `seed`로 뽑는다(리듀서 결정론). 도전 조건 선택 UI는 인트로 · 계승 · 진 엔딩이 같은 `ChallengeModifierPicker`를 쓰고 슬롯은 새 단계 기준이다. 정수 지급 배율(계승 단계 × 거울)은 `systems/essenceRewardMult.ts` 하나다 — 전투 · 오늘의 임무 · 계승 보상이 지급하고 화면도 그 값으로 그린다. 직업 패시브 · 도감 · 칭호의 "공격력 +N"류는 `calculateFullStats`가 배율이 걸린 몫(`scaled*`) 뒤에 더한다(빌드 성향 판정 입력에는 포함) — 배율 안으로 되돌리면 "ATK +5"가 +6.5 ~ +8이 된다. 부활 회복의 "최대 생명"은 실효 최대다(`getEffectiveMaxHp`). 업적 판정은 `utils/achievementProgress.ts`가 소유한다: 달성했지만 수령하지 않은 업적은 영구 상태 선별이 `stats.achievedAchievements`에 남긴다(계승 · 사망 재시작에서 줄어드는 레벨 · 방문 지역이 다시 잠그지 않게), "새 지역"은 시작 마을 제외, 심연 "N층 도달"은 돌파 + 1, 합성은 성공만, 번 골드는 전부 `grantGold`(누적 골드). 접두어가 붙은 전설 각인은 바탕 이름으로 인정한다(`getSignatureBaseName` — 이름 그대로만 보던 동안 "날카로운 라그나로크"가 세트 · 판매 보호 · 도감에서 빠졌다). 세트 구성원(`signatureSets.json`)은 레지스트리 `setGroup`과 같은 집합이고 도감 세트 줄은 엔진 계산(`getSignatureSetEquippedCounts`)을 그린다. 보장 보상(계승 3단계 보스 희귀 장비)은 가방 상한을 넘어 들어간다(`LootCandidate.guaranteed`). 문구만 고친 판단 3건(야영 기술 · 방어구 속성 표기 · 양손 "강한 일격")과 측정은 원장 §58. `tests/achievement-description-contract.test.js` · `meta-progression-delivery.test.js` · `equipment-extras-contract.test.js`
- **보스 브리핑이 약속한 행동 · 보상은 보스 데이터(`mechanics`)가 선언하고, 엔진 · 예고는 `systems/bossMechanics.ts`의 판정만 읽는다**(Wave 59, 소유자 결정: 보스 기믹 "전부 설명대로 구현" · 보스 보상 "설명대로 구현 + 측정" · 약해지는 쪽 "전부 설명대로"): 2페이즈 문턱은 데이터 값 그대로다(기본 50% — 적 행동마다 40 ~ 60%를 뽑던 지터를 되살리지 말 것). 페이즈는 2 → 3 순서로 적용한다(한 행동에 두 문턱을 함께 넘으면 3페이즈 값이 남는다). 페이즈 상태는 배열일 수 있고(`getPhaseStatuses`) 로그 라벨은 `MSG.DOT_LABELS`다. 2페이즈 뒤 강타가 거는 상태(`heavyStatus`)는 `maxStacks`가 있으면 쌓인다 — 지속 피해 · 저주는 `player.statusStacks`(중첩마다 기본 효과의 `BALANCE.STATUS_STACK_BONUS`, 읽기는 `getPlayerStatusStacks` 하나), 빙결은 `combatFlags.frostStacks`를 쌓아 그 수에 닿으면 언다. 반격(`guardCounter`)은 방어 자세 중에 맞을 때 턴 해석기(`combatActionTurn`)가 `resolveGuardCounter`로 낸다(방어 무시 기술 제외). 브레스 · 장기전은 적 인스턴스의 `actionCount`(`enemyAttack`이 기절 · 방어 턴까지 센다)를 읽는다. 소환 하수인은 행동 전에 있던 수만큼 함께 치고(`enemyAttack` 래퍼), 내 피해 행동 하나에 하나 쓰러진다. 저항 무력화 페이즈(`pierceResist`)는 상태 저항 유물 · 원소 저항 장비를 모두 건너뛴다. 받는 피해 보정(원소 저항 → 저주 중첩 → 조합의 대가)은 `applyIncomingDamageMods` 하나다 — 새 적 피해 경로도 이것을 거칠 것. 예고는 알릴 행동 중 확률이 높은 쪽(같으면 맹공) · 3페이즈 임박 · 브레스 차례를 같은 판정으로 보인다. 보상: 유물 약속 보스는 처치 때 유물 선택 1번(`applyBossRelicReward` — 칸이 가득 차도 제안), 계열 약속 보스는 보너스 장비를 `lootTheme`(원소 · 이름 · 직업, 전설 각인 제외) 안에서 뽑고, "대량 초회 보상"은 `firstClearBonusMult`다. 브리핑 문구 ↔ 데이터 ↔ 엔진은 `tests/boss-mechanics-contract.test.js`가 함께 대조한다 — 브리핑에 새 약속(칩 · 문구)을 쓰면 데이터 선언과 계약 줄을 함께 넣을 것. 측정은 원장 §59.
- **보스 생명 배율은 대결로 맞춘 값이다 — 플레이어 화력에 맞춰 키우지 않는다**(Wave 60, 소유자 결정 "보스별 고정 생명 상향"): 브리핑 보스 22종의 `hpMult`는 그 지역 레벨에 막 닿은 자연 플레이어 스냅숏과의 1:1 대결(저장소 밖 하네스)에서 중앙값 6턴이 되도록 보스마다 맞췄다(×2.5 ~ ×24.5). 보정 전에는 중앙값 2턴이라 2페이즈 도달이 31%였고 Wave 59 기믹이 거의 보이지 않았다. 이 보스들은 대부분 지역 일반 조우이기도 해서(용의 둥지 4종 중 2종 · 에테르 관문 5종 중 3종) 값을 바꾸면 그 지역 사냥 길이가 함께 움직인다 — 성장 모델은 행동 = 처치 1회라 이 차이를 보지 못한다(증빙 리포트 해시 불변, 자연 플레이 드라이버의 전투 턴 포함 행동 수로 잰다). 진 보스(`buildTrueBoss`, 8,000 × hpMult)도 같은 값을 읽는다. 플레이어 화력에 맞춰 보스를 키우는 방식은 쓰지 않는다 — 사냥 · 장비로 강해진 만큼 보스가 같이 커지면 성장이 의미를 잃는다(소유자 원칙). `tests/boss-fight-length-contract.test.js`가 보스 ≥ 같은 지역 일반 몬스터 최대 배율의 3배(보정 전 22종 모두 2.2배 미만)와 두 스폰 경로를 지킨다. 측정은 원장 §60.
- **승리 후처리는 처치 방법과 무관하고, 지역 `bossMonsters`는 실제로 나와야 하며, 화면은 엔진 판정을 읽는다**(Wave 61, 감사 4회차 · 소유자 결정 "보스 6종은 지역 조우에 넣음"): 지속 피해 · 반격 · 전투 소모품으로 끝난 승리도 같은 후처리를 탄다(구역 보스 기록 · 시즌 XP · 처치 수 마일스톤 · 전투 기록 · 공허의 신 보상) — `extendedChecks` 같은 처치 방법 게이트를 되살리지 말 것(부재 불변식). 지역 `bossMonsters`의 보스는 조우 풀 · 구역 보스(`boss` 이름) · 숨은 보스(`bossPresence.HIDDEN_BOSS_UNLOCKS`, `spawnEnemy`와 공유) · 심연 층 보스(`BALANCE.ABYSS_BOSS_NAMES`) 중 하나로 실제로 나와야 한다 — 목록에만 넣으면 임무 · 도감 · 지역 완료 · 각인 안내가 거짓이 된다(6종이 그랬다, `tests/boss-spawn-route-contract.test.js`). 보스 표시(지도 · 경로 · 조작판 · 안내)는 `canBossAppearInMap` 하나다. 몬스터 그림의 대표 지역은 `ART_PRIMARY_REGION_PINS`로 고정한다(스폰 목록은 게임 데이터, 그림 정체성은 아트 결정 — §9와 같은 교훈). 이야기 능력치 보상은 `storyStatBonus`다 — 공격 · 방어는 배율 뒤(Wave 58 규칙), 생명 · 기력은 저장 최대치에 굽고 회복은 `healWithinMax`(Wave 72부터 영구 · 레벨 비례 — 전직은 스냅숏 재구성이 굽는다, 아래 Wave 72 줄). 낮은 생명 승리 임무는 누적(`stats.lowHpWinTotals`)을 읽고 50전 창은 동적 난이도 입력으로 남는다. 발견 지역 수는 `countDiscoveredMaps`(시작 마을 제외), 장비 도감 키는 바탕 이름(`getCodexEntryName`, 마이그레이션이 합친다). 도감 획득처 · 도달 비용 레거시 경로는 엔진의 표 선택 규칙(드롭 표가 있으면 그것만 — `codexDropSources`), 소모품 수락 · 엘릭서 판정은 `consumableRules` 하나(엔진 · 리듀서 · 버튼 · 문구). 보스 6종이 조우에 들어가 성장 모델 앵커가 움직였다(64시드 Lv45 −1.1% · Lv75 −2.9%, 마왕성 게이트 53.15h). 5경로 48시드에서 사망 · 시간은 유의하게 변하지 않았다(원장 §62).
- **도전 규칙 · 강화 칸 · 부활 · 이야기 약속은 엔진이 지킨다 — 도전 판정은 `utils/challengeRules.ts` 하나다**(Wave 62, 소유자 결정 "전부 설명대로" · "규칙은 구현, 서사는 문구"): 보상 배율은 고른 규칙 수의 표 `BALANCE.CHALLENGE_REWARD_MULT_BY_COUNT`(선택 화면의 +N%도 같은 표). '빈손의 시작'은 **모든** 골드 수입이 `getGoldIncome`을 정확히 한 번 거친다(`grantGold` · 전투 정산 · 묘비 · 폴백 거래 · 첫 방문) — 로그 · 미리보기도 지급액을 말한다. 새 골드 수입 경로는 `grantGold`를 쓰거나 `getGoldIncome`을 부를 것. '약한 생명력'은 재구성(시작 · 계승 · 전직)에 `applyChallengeMaxHp`, 늘어나는 양(레벨업 · 이야기)에 `getChallengeMaxHpGain`. '길 잃은 여행'은 `isBlindMap` 하나가 판정하고 위치를 그리는 화면은 `getVisibleLocationName` 계열을 읽는다(저장은 그대로, 그릴 때만 가린다 — 새 위치 표시도 거칠 것). '뒤섞인 기술'은 고른 기술을 뽑지 않고, 쓸 수 없는 기술도 차례를 쓴다. 강화 칸은 `systems/tempBuffMerge.ts`(세기 = (공격 + 방어 + 반격) × 턴, 같으면 지금 것) — `tempBuff`에 직접 대입하지 말 것(물약 · 모닥불 · 이야기 · 전쟁의 북이 더 센 강화를 지웠다). 부활은 무료 수단 먼저(불사의 의지 → 허공의 심장 → 불사조 → 거울 → 부활석). 제작 · 합성 입력은 강화 안 된 사본부터(`utils/recipeInputSelection.ts`). 약속된 유물은 칸이 가득 차도 교체를 제안하고, "전설" 약속은 `rarity: 'legendary'`를 데이터가 선언한다(`selectRarityRewardPool`). 게이지 회피는 그 탐험을 이어 가고 `BOSS_GAUGE_EVADE_EXPLORES`번 카드를 띄우지 않는다. 첫 방문 보상은 여정마다(`player.firstVisitRewardMaps`, 런 범위 — `pickPermanentPlayerState`에 넣지 말 것). 현상수배 대상은 진입 레벨 창 [L − 10, L + 5]이고 지역이 아니라 보스로 정산되는 몬스터(`isEncounterBoss`)만 뺀다. 서사: 스텝의 층 조건은 `minAbyssFloor` · `isChainStepFloorReached`(도달 비용 리포트는 그 체인을 `floorGatedEventChains`로 뺀다), 도박 · 카드 · 수정은 실제 확률(굴림은 hook이 payload `roll`로 보내고 리듀서가 검증, 미리보기는 결과를 숨긴다), 이야기 전투는 `outcome.combat`(승리해야 정산), 상점 규칙은 지역 데이터(`shopMaxTier` · `shopPriceMult`)를 `getShopMaxTier` · `getShopBuyPrice`가 읽는다(판매가 불변 · 보급 안내도 실제 가격). 5경로 48시드에서 사망 · 시간은 유의하게 변하지 않았다(원장 §63). **Wave 63**: 불사조 부활의 공격 강화도 강화 칸 규칙을 거친다. 안전지대 진입은 원정 종료 규칙으로 강화 칸 · 상태 이상을 비운다(의도 — `MSG.TOWN_BUFF_CLEAR`가 알린다, 마을에서 강화를 남기면 기술 강화의 남은 턴이 원정을 넘는다). 재고 · 오늘의 할인 · 주간 특별 상품은 모두 그 상점의 판매 등급(`getShopMaxTier`) 안이다 — 위치 없이 할인을 부르면 판매 등급 1이다(원장 §64). `tests/challenge-modifier-delivery-contract.test.js` · `temp-buff-merge-contract.test.js` · `chance-event-contract.test.js` · `shop-tier-price-contract.test.js`
- **임무 진행도는 목표에서 멈춘다 — 레벨 임무 포함**(Wave 32): 모든 유형이 `latch`(내려가지 않고 목표에서 멈춘다)다. 레벨 임무만 `player.level`을 그대로 쓰던 동안 101('레벨 45 달성')을 Lv46에서 받으면 46/45였다(자연 플레이 드라이버의 `questProgressOverGoal`). **현상수배는 "진행 중 하나, 완료하면 바로 다음"이다**(Wave 32 소유자 결정) — 카탈로그 임무가 계정당 1회라 계승 뒤 유일한 반복 게시판 콘텐츠다. `stats.bountyDate`/`bountyIssued`는 마지막 발급 기록이지 게이트가 아니다. `tests/level-quest-progress-cap.test.js` · `bounty-continuous-contract.test.js`
- **임무마다 자기 목표가 있다**(Wave 64, 소유자 결정 "동일하면 안 됨 — 각각의 목표가 있어야지"): 목표(종류 · 대상 · 지역 · 횟수 · 문턱 · 빌드)가 같은 임무 쌍은 0이다 — 보상 · 제목 · 수락 레벨만 다른 두 임무는 같은 행동으로 함께 끝나므로 같은 임무다. 154 · 30 · 32 · 64가 151 · 100 · 83 · 200과 그랬다(154 = 종말의 전장 파멸의 기사 10명 · 30 = 기계 폐도 프로토타입 제로 · 32 = 마녀 3회 · 64 = 누적 골드 10만). 구역 보스(어느 조우 풀에도 없는 지역 `boss`)를 목표로 하는 임무는 1회다(여정당 한 번 나온다 — 임무를 받기 전에 잡았어도 그 임무가 다시 부른다, 아래 Wave 74). 목표를 새로 정한 30은 수락 레벨을 목표 지역의 경로 게이트에 맞췄다(기계 폐도 선언 28 · 경로 35 — 기존 20개는 Wave 28 표시 규칙 그대로). 누적 골드 임무(`gold_earned`, `stats.total_gold`)는 `grantGold`가 그 자리에서 진행시킨다 — 마을 수입으로 목표를 넘겨도 다음 탐험 · 전투를 기다리지 않는다(Wave 61 제작 임무와 같은 결함 종류). 새 평생 기록 임무 종류는 `getLifetimeCounterReader` · 도달 비용 시스템 대상 · 추적기 문구(`MSG`)에 함께 넣을 것. `tests/quest-distinct-objective-contract.test.js`
- **본편은 16장이고 중반 8장은 그 구간의 보스로 끝난다 — 수락한 임무가 노리는 구역 보스는 다시 도전할 수 있다**(Wave 74, 소유자 결정 "8장 · 최대 공백 약 7.6시간"): 사슬은 80 → 81 → 82 → 207 · 208 · 209 → 84 → 83 → 210 ~ 214 → 85 → 86 → 87이다. 순서는 선행(`prerequisiteQuestId`)이 소유하고 `STORY_CHAPTERS`가 같은 순서로 본문을 든다. 중반 8장은 Lv26 · 31 · 35 · 41 · 43 · 45 · 46 · 47에 받고, 받는 레벨에 목표 지역에 들어갈 수 있다(목표 게이트 = `minLv`). 84는 선행이 209가 되어 `minLv` 35다(87과 같은 정렬 — 게시판 레벨이 실제 수락 레벨). 구역 보스는 여정마다 한 번 나오는데(`stats.areaBossDefeated`), 임무를 받기 **전에** 잡았으면 그 여정 안에서 임무를 끝낼 수 없었다(부가 임무 134 · 142 · 151, 구역 보스로 끝나는 이야기 장은 본편 사슬 전체). 판정은 `isAreaBossChallengeable`(`utils/bossGauge.ts`) 하나다 — 미격파이거나, 수락했고 목표에 닿지 않은 처치 임무(`getOpenKillQuests`)가 그 보스를 노리면 참이다(임무에 지역이 있으면 그 지역의 구역 보스여야 한다). 게이지 · 도전 카드 · 출현(`spawnEnemy`) · 지도 배지 · 원정 HUD · 이동 안내 · 전투 후 "밀어붙인다"가 같이 읽는다 — 소비처에서 미격파만 보는 `isAreaBossUndefeated`나 `areaBossDefeated`를 다시 직접 읽지 말 것. 성장 모델은 임무를 모델하지 않아 앵커가 그대로다. 측정은 원장 §77. `tests/story-midgame-chapters-contract.test.js`
- **같은 일을 하는 두 경로는 같은 판정을 읽는다 — 원장 §61.5 남은 관찰**(Wave 65): 로컬 폴백 풀의 저작 이벤트(모든 선택지에 손으로 쓴 결과)는 저작 선택지 그대로다 — `buildEventPackage`가 지역 선택지로 셋째 칸을 채우던 동안 그 칸의 절차적 보상이 손으로 쓴 결과보다 컸다(2지선다 12개 · Lv40 362 대 55 ~ 355). 출처는 호출자 권한(`context.source`)이고 모델 이벤트 · 결과 없는 풀 항목은 지금처럼 채운다. 유물 지급은 모든 경로가 실효 최대치 내리기(`clampVitalsToEffectiveMax`)를 거친다 — 체인 직접 지급(상인의 인장)이 빠져 있었다. 침공 공격력은 `getInvasionAttackPower`(실효 공격력) 하나를 묘비 화면과 판정이 읽는다. 기술 원소는 `getSkillElement`(`systems/skillPower.ts` — `type`, 없으면 무기 원소) 하나를 엔진과 전투 예고가 읽고, 예고는 위력 기술(`isDamagingSkill`)만 약점을 말한다. 공개 묘비 `guardPower`가 저장 공격력으로 올라가는 비대칭은 rules 상한(9,999)과 얽혀 소유자 판단 거리로 남는다(원장 §66.8). `tests/observation-sweep-contract.test.js`
- **패널 장식은 위치를 덮지 않고, 한국어는 낱말 단위로 줄바꿈한다 — 제품 통합 수용**(2026-10-06): `.panel-noise`는 `@tailwind utilities` 뒤에 선언돼 같은 요소의 `fixed`를 `relative`로 덮는다 — 전투 결과 카드가 2026-08부터 하단 고정이 아니라 흐름 안에서 12px 밀려 오른쪽이 잘렸다. 고정 패널은 `.panel-noise.fixed`가 지킨다(새 장식 클래스가 위치를 쓰면 같은 짝 규칙을 둘 것). 본문 기본값이 `word-break: keep-all` + `overflow-wrap: anywhere`다 — 칸마다 `break-keep`을 덧대지 말 것(`anywhere`가 최소 폭을 늘리지 않아 새 가로 넘침이 없다). 좁은 줄에서 칩 · 짧은 이름은 줄지 않고(`shrink-0`) 긴 쪽이 줄거나 다음 줄로 내려간다. 전투 결과 카드는 모바일 가독성 계약(11px · 44px · 가로 넘침 없음) 안이다. `tests/e2e/product-acceptance-layout.spec.ts`(375 · 390 · 430). 화면 · 회귀 · 자연 플레이 240시드를 한 SHA에 묶은 기록은 원장 §67 · `docs/evidence/qa/product-acceptance-20261006/receipt.json`.
- **기록 탭 조작도 44px이고, 좁은 칸의 긴 글은 말줄임 대신 줄을 넘긴다 — 같은 전리품은 묶어서 보인다**(Wave 67, 제품 통합 수용 남은 관찰 §67.6): 가방 분류 · 빠른 칸 · 사용 · 강화 보기 · 상세 보기(장비 · 가방 · 상점) · 세트 목록 · 성장 조언 · 임무 게시판이 44px이다(`min-h-11`, 빠른 칸은 `h-11 w-11`). 기술 탭 제목은 잘리지 않고 "현재 선택"이 다음 줄로 내려간다. 장비 칸 이름은 두 줄까지 넘기고(양손 무기가 쓰는 보조 장비 칸 "양손 무기가 함께 사용"), 가방 카드 설명 줄은 줄을 넘긴다 — 상세 보기를 켠 사람에게 말줄임은 정보를 숨긴다. 전리품 이름 요약은 `utils/lootSummary.ts` 하나를 전투 결과 카드와 전투 정리 로그가 읽는다(같은 이름 → `이름 x개수`, 남은 수는 아이템 개수). 이어 붙이던 동안 "벌레 껍질 · 벌레 껍질"이 나왔다. 가방 카드 설명 칸은 10rem 아래로 줄지 않는다 — 버튼 열이 옆에서 칸을 좁히면 다음 줄 오른쪽으로 내려간다(Wave 68, 375px에서 설명이 115px 칸에 네 줄로 꺾였다). `tests/e2e/product-acceptance-layout.spec.ts`(기록 탭 3폭 — 화면 안 모든 버튼 44px · 가방 설명 칸 160px) · `tests/loot-summary-contract.test.js`. 원장 §69 · §70. **코드 글꼴(`font-fira` · `.aether-label` · 기록 배지 · `code`)은 숫자 · 영문 · 기호만 Fira Code이고 공백 · 한글은 본문 글꼴이다**(Wave 69, 소유자 결정 B "터미널 화면이 중요한 것은 아니다"): Fira Code는 저장소의 `@font-face 'Aether Fira Code'`(`src/assets/fonts`, OFL)가 소유하고 `unicode-range`가 공백류를 뺀다 — 고정폭 공백 0.6em이 한국어 낱말 사이를 벌렸다(대체 글꼴이 아니라 공백 폭이 원인이라 iPhone에서도 같았다, 원장 §70.2). `--aether-code-font`는 `'Aether Fira Code', var(--aether-readable-font)`다 — 끝을 `monospace`로 두거나 범위에 공백을 넣거나 Google Fonts에서 Fira Code를 다시 불러오지 말 것(e2e 글꼴 계약 3폭, 원장 §71).
- **기술 재사용 대기는 전투마다 새로 시작한다**(Wave 66, 소유자 결정 "전투시마다 새로 시작 — 마나 · 기력 비용이 있어 무한정 쓸 수는 없다"): 대기는 전투 턴에만 줄고 전투가 끝나면 `endCombatScope`가 비운다(승리 · 패배 · 도주 · 전투가 아닌 복원 · 다음 전투 시작 — 마왕 처치 직후 이어지는 진 보스전도 승리 정산을 거친다). 전투로 복원하면 그대로 둔다. 비우지 않던 동안 자연 플레이 대기 상태 스냅숏의 92.1%가 잠긴 기술을 들고 다음 전투를 시작했다(휴식 · 귀환에서도 그대로였다). 같은 전투 안의 대기는 그대로 작동한다. 전투 종료 경로에서 `endCombatScopedRelics`를 직접 부르지 말 것(부재 불변식). `tests/skill-cooldown-combat-scope.test.js` 48시드에서 일반 전투가 짧아졌고(행동 −3 ~ −16%), 기력이 비용으로 작동해 나이트 · 어쌔신은 보스전 시작 기력이 줄어 보스전 사망이 늘었다 — 수치로 보정하지 않았다(원장 §68).
- **실제 돈을 받는 결제는 출시 범위 밖이다**(2026-10-06 소유자 결정 "등록해서 유저 반응을 본 뒤, 결제로 게임의 재미나 난이도를 더 즐길 수 있게"): 에테르 교환소는 플레이로 얻은 크리스털만 쓴다. src는 토스 SDK의 결제 API(`IAP` · `checkoutPayment` …)를 가져오지 않고, 결제 SDK · 결제 권한 · StoreKit이 없다. 결제를 넣을 때는 `tests/launch-no-payment-contract.test.js`를 함께 고쳐 결정을 남길 것. **보상형 광고(귀환 보급)도 출시 범위 밖이다**(같은 날 소유자 결정 "결제처럼 반응 보고 결정") — 코드는 그대로이고 토스 빌드의 광고 그룹 환경 변수(`VITE_TOSS_REWARDED_AD_GROUP_ID`)로만 켜진다. 저장소의 빌드 설정에 그 값을 넣지 말 것(같은 계약 파일이 잡는다, 원장 §68.2 · §72.4).
- **다른 플레이어의 묘비는 탐험 이벤트 "다른 차원의 묘비"로만 만난다 — 침공은 망령과의 실제 전투다**(Wave 70, 소유자 결정 "이벤트식 · 망령과 실제 전투 · 실제 플레이어 묘비만"): 판정은 `utils/dimensionGrave.ts`가 소유한다(후보 정리 · 하루 `DAILY_INVADE_LIMIT`개 · 같은 묘비는 그날 한 번). 묘비 문서는 남이 쓴 데이터라 유품은 **카탈로그 이름만** 남기고 승리 보상은 그 이름의 카탈로그 아이템이다(`applyDimensionGraveVictory`) — 문서의 아이템 객체를 가방에 넣지 말 것. 후보가 없으면(오프라인 · 다른 플레이어 묘비 없음 · 한도 소진) 탐험은 이 기능의 난수를 **하나도** 쓰지 않는다 — 후보 판정 앞에 난수를 쓰면 오프라인 게임 전체의 난수열이 밀린다(기능 이전 탐험 고정값 테스트가 잡는다). 풀은 `useDimensionGravePool`(온라인 · 로그인 세션만 읽기)이 채우고 탐험은 `GameActionDeps.getDimensionGraves`로 읽는다. 망령은 지역의 일반 종(보스 제외)으로 만든 정예다. 공개 목록 확률 침공(`INVADE_GRAVE` · `calcInvasionChance`)은 없앴다 — 되살리지 말 것. 적 초상은 종(`baseName`)으로 찾는다(표시 이름 "…의 망령"으로 찾으면 묘비 주인 이름의 몬스터 그림이 나온다). **공개 묘비 문서는 `buildPublicGraveDoc`(`utils/publicGraveDoc.ts`)이 만들고 유품은 카탈로그 이름 · 종류 문자열만 올린다** — 아이템 객체를 올리면 `undefined` 필드 하나로 `setDoc`이 동기로 던지고(사망 화면 이펙트의 `.catch`가 못 잡는다) 읽는 쪽이 쓰지 않는 수치 · id가 공개된다. 쓰기 · 풀 조회는 `platform/publicGraveFirestore.ts`(`writePublicGrave` · `readDimensionGravePool`) 하나이고, `tests/firestore-rules-semantics.test.js`가 같은 함수로 업로드 → 다른 플레이어의 조회 → 이벤트 후보를 에뮬레이터에서 실행한다(최종 통합 수용 — 이 업로드는 Wave 70 전까지 프로덕션에서 꺼져 있어 실제 유품이 든 문서는 실행된 적이 없었다). `tests/dimension-grave-event-contract.test.js` · e2e `dimension-grave-event.spec.ts` · 원장 §72 · §73.
- **수집 · 칭호 · 이야기로 얻은 능력치는 영구다 — 죽음의 비용은 레벨 · 장비 · 가방 · 유물이다**(Wave 72, 소유자 결정 "로그라이크라 죽음의 비용은 크다. 대신 수집 · 칭호 등으로 얻은 영구 능력치는 유지" · "정예 칭호 지역별 47개 · 모은 만큼 합산" · "이야기 보상 영구로 전환"): 영구 원천은 도감(`stats.codexBonus*`) · 칭호(`titles` — 장착 패시브 하나) · 계승 보너스(`meta.bonus*`) · 이야기 체인 능력치(`storyStatBonus`) · 정예 목격 칭호(`elite:<지역>`)이고 모두 `pickPermanentPlayerState`를 넘는다(사망 재시작 · 계승). 이야기 보상은 Wave 62 C2(이번 여정 범위)를 대체했다 — 체인이 계정당 한 번이라 런 범위이던 동안 한 번 죽으면 영원히 잃었다. **새 영구 원천 둘(이야기 · 정예)은 Wave 40 규칙대로 `META_BONUS_FULL_LEVEL`까지 레벨에 비례한다** — 이야기 공격력 · 방어력은 `getRampedStoryFlat`(배율 뒤 고정값), 이야기 생명 · 기력은 영구 생명 · 기력 스냅숏(`snapshotMetaVitals(meta, story)`)에 실려 재구성 · 레벨업이 굽는다(전직이 `+ story.hp`를 따로 더하지 말 것 — 두 번 더해진다). 지급은 `applyStoryStatGrant` 하나이고 누적은 원래 양이다('약한 생명력' 절반은 굽는 양에만). 정예 목격 칭호는 `utils/eliteTitles.ts`가 소유한다: 사냥 지역 47곳 · 효과는 지역 레벨 단계표(`BALANCE.ELITE_TITLE_BONUS_BANDS`) · 기록은 적이 나타나는 리듀서 전이 `SET_ENEMY` 한 곳(정예 `isElite`면 결과와 무관, 지역마다 한 번, 자동 장착 없음) · 효과는 장착과 상관없이 `getRampedEliteTitleBonus`로 합산되고 장착 패시브(`getTitlePassive`)는 없다(두 번 더하지 말 것). 칭호 바꾸기 목록은 정예 칭호를 묶음(`system-elite-titles`)으로 보이고 능력치 화면 '계승 기록'이 이야기 보상 · 정예 N/47 합을 보인다. `tests/permanent-stats-elite-titles-contract.test.js` · 원장 §75.
- **떠돌이 행상인은 탐험 난수를 쓰지 않는다 — 만남 · 재고는 탐험 수 · 지역의 해시이고, 거래는 이번 만남의 재고로 리듀서가 검증한다**(Wave 75, 소유자 결정 "가방은 현행 유지, 대신 낮은 확률의 이벤트로 행상인 — 물품은 늘 바뀌고 가끔 희귀한 재료 · 장비, 판매도 가능"): 판정 · 재고는 `utils/wanderingMerchant.ts`가 소유한다. 사냥 지역의 선택 이벤트 자리에서 탐험당 `BALANCE.WANDERING_MERCHANT_CHANCE`(1.2%)이고 순서는 다른 차원의 묘비 뒤 · 정찰 앞이다. **`actionRng`로 판정하지 말 것** — 한 번 더 굴리면 모든 탐험의 난수열이 밀려 오프라인 게임 · 시드 고정값 · 증빙이 전부 움직인다(Wave 70 · 71과 같은 원칙). 같은 탐험 수 · 지역이면 같은 행상인이라 리로드로 재굴림할 수 없다. 재고는 소모품 둘(지역 레벨 가격 상한) · 지금 쓸 데 있는 재료 · 장비 하나, 35%에 희귀 한 칸(강화 재료 또는 착용 가능한 최고 등급의 강한 장비)이다. **장비는 지금 착용할 수 있는 등급만 판다**(`getUsableGearTier` — `canEquip`과 같은 `TIER_REQ_LEVEL`): 지역 상점 등급은 착용 레벨보다 앞서 가서(Lv35 지역의 4등급은 Lv45 필요) "한 등급 위"로 정하던 첫 구현은 희귀 장비가 1회차 내내 착용 불가였다(자연 플레이 희귀 장비 구매 0). 거래는 새 `GS` 멤버 없이 `GS.SHOP`을 재사용한다 — 화면은 만남이 유효하면(`getActiveMerchantVisit`, 만난 지역에 있을 때만) 행상인 진열을 그리고, 구매(`BUY_SHOP_ITEM` 출처 `merchant`)는 이번 만남의 팔리지 않은 칸만 받는다. 판매는 마을 상점과 같다. 만남(`player.merchantVisit`)은 세이브 봉투 안이고 영구 상태가 아니다(`pickPermanentPlayerState`에 넣지 말 것). **나가는 길은 `SET_GAME_STATE` 하나가 끝낸다** — 상점 · 이벤트가 아닌 모드로 넘어가면(뒤로가기 · 카드 닫기 · 기록 열기) 만남이 끝나므로, 나가는 길마다 `LEAVE_MERCHANT`를 부르게 하지 말 것. 행상인 상점 머리글에는 기록 열기 단추가 없다. 240시드에서 회차당 약 16번 만나 8건쯤 사고, 사망 · 시간은 유의하게 변하지 않았다. `tests/wandering-merchant-contract.test.js` · e2e `wandering-merchant.spec.ts` · 원장 §78.

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
3. **마왕 격파** → Ascension 옵션 제공 (마왕성 경로 게이트 Lv48 ≈ 53.2 모델시간 — Wave 71 이후 53.18h)
   - **본편 스토리 사슬도 승천 지점을 걸치지 않는다**(Wave 28) — 86은 에테르 관문(68)에서 마왕성(48)의 `지옥의 문지기`로 옮겼고 87 `minLv`는 48이다. 그 전에는 87이 170.23h라 이야기를 끝내기 전에 마왕을 잡을 때마다 계승 제안이 떴다. `tests/content-reachability.test.js`가 `FIRST_STORY_QUEST_ID`부터 선행을 따라 만든 사슬 전체의 게이트 ≤ 마왕성 경로 게이트, 종장 = 그 게이트를 단언한다
   - **계승 화면의 "미루기"는 런 범위 결정이다**(Wave 28) — `AT.DEFER_ASCENSION`이 `player.ascensionOfferDeferred`를 세우면 그 런의 마왕 처치는 계승 화면 없이 로그로 정산되고(`endgameSettlement`), 조작판 [계승하기] → `AT.REOPEN_ASCENSION`으로 다시 연다. 재오픈 게이트는 **미룸 표시와 처치 영수증 둘 다** 본다 — 영수증(`meta.endgame.lastEndgameReceiptKey`)은 영구 meta라 승천 뒤 새 런에도 남으므로, 표시 검사를 빼면 마왕을 잡지 않고 계승할 수 있다(`tests/ascension-deferral-contract.test.js`)
   - **직업 게이트는 이 리셋 지점을 넘지 않는다**(Wave 13 E1) — tier-3 5종이 `reqLv: 60`(131.2h)이던 동안 코어 루프를 그대로 타는 플레이어는 직업 5종을 영원히 못 봤다. 45로 내려 승천까지 13.90h 여유를 남겼고, `tests/content-reachability.test.js`가 "최심 직업 게이트 ≤ 마왕성 **경로** 게이트"를 단언한다(48은 리터럴이 아니라 리포트에서 읽는다)
4. **프레스티지** → 레벨/장비/유물 초기화, 영구 보너스 적립
   - **이벤트 체인은 승천 지점을 걸치지 않는다**(Wave 15 G1) — 체인 13개 중 10개가 루프 안에서 닫히고(완주 게이트 ≤ 48) 2개는 애초에 승천 **뒤에** 열린다. 나머지 하나 `abyss_signal`은 1 · 2단계가 혼돈의 심연 50층을 요구해(Wave 62 C17, `minAbyssFloor`) 모델이 값을 매기지 않는다 — 리포트의 `cost.floorGatedEventChains`(데이터 결함 목록 `unresolvedEventChainCompletions`와 별개, 작성기는 후자 0을 요구한다). 돌파 층은 사망 · 계승을 넘어 유지되므로 계승을 걸쳐도 진행이 사라지지 않는다(`divine_apostle_trial` 65.83h · `rift_secret` 167.08h — Wave 71 이후 값). Wave 14 F2가 자를 고친 직후에는 셋이 걸쳐 있었다(2.05h~21.08h에 열려 전부 170.23h에 완주 — 이월이 있어도 자기 런 안에서 끝나는 이야기가 0개였다). G1이 스텝 4개의 `loc`을 옮겨 닫았고, 목적지는 취향이 아니라 **세 기준의 교집합**이다: ① 경로 게이트 ≤ 48 ② 남은 스텝의 max 이상(종착이 곧 완주 게이트여야 한다 — `gateChanging === []`) ③ **`type !== 'safe'`**(안전지대에는 탐험 버튼이 없다 — `canInvestigateTown`은 황금 왕국에서만 true라 거기 놓인 스텝은 터미널에 `explore`를 타이핑해야만 진행된다. `machine_uprising` 종착과 `water_apostle:1`이 이미 그 상태다). **진행도 이월은 그대로 유지된다**(Wave 14 F2) — 승천은 레벨에 도달해야 열리는 게이트가 아니라 **플레이어가 고르는 시점**이라 체인을 열어 둔 채 승천하는 런이 여전히 가능하고, 그때의 안전망이다. `pickPermanentPlayerState`는 `EVENT_CHAINS`를 순회해 **체인 id 키만** 끌어온다(제외가 아니라 화이트리스트) — `eventChainProgress`의 `boundedEncounterReceipts` 키는 원정 조우 영수증 레저를 겸하므로 통째로 넘기면 영수증이 승천을 넘어가 재획득을 막는다
   - **정수 사다리는 계승 때 10%만 넘어간다**(Wave 32, 소유자 결정) — 처치당 정수(exp/8)가 150마다 공격력 +1 · 생명 +5 · 기력 +3을 올리는 사다리는 한 런에 800단계 안팎을 쌓는다. 통째로 넘어가던 동안 계승 런 48판 사망이 0이었다(rank당 적 강화를 +20%까지 올려도 0). **획득률을 건드리지 말 것** — 사다리는 1회차 후반 성장의 몫이라 √exp로 줄였을 때 1회차가 모델 시간 +23% · 사망 2배가 됐다(되돌림). rank를 매기는 원장은 `meta.essenceLadder`이고(없으면 `essenceLifetime`으로 읽는다) 줄어드는 경로는 `carryEssenceLadderOnAscension` 하나다 — 누적 정수 · 쓸 수 있는 정수 · 첫 죽음/프레스티지 보너스는 줄지 않고, 사망 재시작은 부르지 않는다. `tests/essence-ladder-ascension-carry.test.js`
   - **사다리는 체감형이다**(Wave 37, 소유자 결정 "로그라이크의 느낌에 맞게") — `ESSENCE_LADDER_SOFTCAP_RANK`(1,000)까지는 단계당 150 정수 그대로이고(1회차는 계승까지 800단계 안팎), 그 뒤 k번째 단계는 `150 × (1 + k / ESSENCE_LADDER_SOFTCAP_SCALE)`이다. 단계↔정수 변환은 `getLadderEssenceForRank`/`getLadderRank` 한 쌍만 쓸 것(`/ ESSENCE_PER_RANK` 직접 나눗셈 금지). 계승을 미룬 런이 225 모델시간에 공격력 +4,200까지 1:1로 쌓이던 것이 +2,700이 됐고, 1회차는 16시드 중 15개가 바이트 동일했다. rank는 단조라 선형 규칙으로 오른 기존 단계는 그대로다. `tests/essence-ladder-softcap.test.js`
   - **영구 공격력(`meta.bonusAtk`)은 `atk` 필드에 굽지 않는다**(Wave 32) — `calculateFullStats`가 더한다. `handleDefeat`가 굽던 동안 사망 재시작만 두 번 받았다(bonusAtk 1,000 → 전투 공격력 2,408 vs 계승 캐릭터 1,212)
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
- **시즌 회전은 완주 트리거이지 벽시계가 아니다** (Wave 12 D2) — 30번째 티어 보상 claim이 다음 시즌을 연다(XP 상한이 아니다: claim이 곧 지급이라 상한 시점에 미수령 보상 30개가 남아 있을 수 있다). 회전 시 `claimed[]`는 `SeasonArchiveEntry`로 보존하고, **리셋 직전에 `addNewTitles`를 한 번 돌린다** — `checkTitles`가 시즌 칭호를 live `seasonPass.tier`에서 복구하므로 순서가 바뀌면 그 칭호는 영구 복구 불가다. `ordinal`/`completedSeasons`/`archive`는 기본값 있는 선택 필드라 `DATA_VERSION` bump 없이 구세이브가 시즌 1로 로드된다. **숫자 보상 배율 상한은 ×1.5다**(Wave 37 소유자 결정, S3에서 도달) — ×4이던 동안 시즌이 10 모델시간마다 돌아 무료 트랙만 225h에 약 632만 골드로 후반 골드의 주 공급원이었다(원장 §36.3). `tests/season-reward-scale-cap.test.js`
- `migrateData(raw, { now })`는 **시각 주입 가능**(Wave 11 C2) — 벽시계(`Date.now()`) 기본값은 이 경계 한 곳에만 있다. 골든(`save-migration-golden.test.js`)은 고정 시각을 주입하므로 `startedAt` 정규화 없이 값 자체가 결정론의 증거다. 마이그레이션에 새 시각 의존을 넣을 때는 `Date.now()`를 직접 부르지 말고 이 `now`를 내려보낼 것

---

## 7. 테스트

**로컬 활동 기록(Q6):** `localProductEventStore.ts`가 제품 이벤트9필드와 AI 폴백 전용7필드를 허용 목록으로 재구성한다. 최근200건/128KiB 한도는 게임 밸런스와 독립적인 기기 보관 정책이다. 런타임 coordinator의 최초 기본 sink에서 연결하며 release ID가 없으면 제품/AI 모두 수집하지 않는다. SystemTab 내보내기·복사·삭제는 플레이어 이름/세이브가 들어가는 기존 QA export와 분리한다. 저장소 실패를 게임으로 전파하지 않고, 삭제·복사 실패를 성공으로 표시하지 않는다. 로컬 기록은 서버 수신 시각·순서·유지율 증거가 아니다.

```bash
npm run test:unit    # 단위 테스트 전체 실행
npm run test:smoke   # 게임플레이 스모크 테스트
```

**테스트 파일 위치**: `tests/*.test.js`
- `cf-functions.test.js` — 실제 proxy handler가 만드는 숫자 컨텍스트의 타입·유한성·범위·유효한0을 검증한다. 프롬프트 수치 제한은 게임 저장값을 바꾸지 않는다.
- `combat-engine-core.test.js`의 damage12건은 실제 엔진+sequence rng를 사용한다. 엔진 바이트 핀은 변경하지 않고 결함 판별은 격리 프로세스의 메모리 override로 확인한다.
- `device-language-contract.test.js` — 귀환 성장/생명과 칭호 효과의 실제 한글 렌더, 모든 칭호 수치 보존. 영문 레벨/원본 칭호 라벨 재주입을 각각 거부한다.
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
- `map-route-gate.test.js` — **맵의 실제 진입 레벨** (Wave 13 E2). `src/utils/mapRouteGate.ts`가 리포트와 UI의 공용 authority다. 52개 중 16개는 선언 `level`과 경로 게이트가 다르고(유일한 경로가 더 높은 지역을 지난다), `level: 'infinite'`는 잠금이 아니라 **잠금 없음**이다(`NaN` 비교). 이 트랙은 **표시이지 잠금이 아니다** — `getMapAccess`는 선언값 그대로이고 테스트가 그걸 고정한다. **보행은 실제 이동 규칙에 위임한다**(Wave 27 N3) — `getReachableMaps`(= `getMapAccess`, 시즌 없음)로 걷는다. 자체 보행이 계절 지역(서리 폭풍 유적)을 "출구 하나만 닿으면 진입"으로 통과시키던 동안 북부 권역 8곳이 Lv20~34로 표시됐고 실제로 걷는 길은 전부 Lv35였다. 걸어서 못 들어가는 3곳(봄의 정원·서리 폭풍 유적 = 시즌, 고대 보물고 = 열쇠)은 게이트 `null`이다. 동치 계약은 `route-gate-move-rule-contract.test.js`(지역 전수)
- `debt-ratchet.test.js` (f) — **한국어 하드코딩은 늘지 못한다, JSX 텍스트 포함** (Wave 20 L3). TypeScript compiler API로 `src/data` 밖 모든 최상위 디렉터리의 `StringLiteral`·템플릿 조각·**`JsxText`** 중 한글 노드를 세어 디렉터리별 상한을 고정한다(착수 실측: components 1,319 · utils 2,001 · hooks 285 · systems 120 · reducers 29 · types 16 · services 32 · platform/assets/pwa 0 = 3,802). 기존 (d)의 따옴표 정규식은 **JSX 텍스트 549개를 0으로 센다** — 같은 `<span>한국어</span>` 주입에 (f)는 red, (d)는 725 그대로였다. §5가 금지하는 "컴포넌트 JSX 안에 한국어 직접 입력"이 처음으로 계약 안에 들어왔다. 새 최상위 디렉터리는 상한이 없으면 **fail-closed**. 상한은 실측값 그대로이고 하락만 허용한다 — 방법을 바꾸는 것은 재고정이지 하락이 아니다
- `content-reachability.test.js` — **접근 비용 축** (Wave 12 D1). "도달 가능한가"가 아니라 "몇 모델 액션·몇 모델 시간 뒤인가"를 검증한다. `basis`가 `anchored`(모델 산출)인지 `interpolated`(누적 EXP 비례)인지 `beyond-anchors`(외삽 금지 — 비용 `null`)인지를 구분하고, 보간 행은 자기 입력을 들고 있어 재계산 가능하다. **맵 게이트는 선언 `level`이 아니라 실제 이동 경로로 매긴다** — 52개 중 16개가 다르고(`cost.mapGateDivergence`) 걸어서 못 들어가는 3곳은 값 없이 `cost.mapsWithoutWalkingRoute`에 입구 종류로 남는다. **임무 게이트는 `minLv`가 아니라 목표 게이트다**(Wave 27 N3) — 목표 게이트 = max(수락 게이트, 목표 지역 경로 게이트), 수락 게이트 = max(`minLv`, 선행 임무의 목표 게이트). `minLv`만 보던 동안 종장 87은 L50/65.9h로 보고됐고 실제는 L68/170.23h였다(Wave 28이 86을 마왕성으로 옮기고 87 `minLv`를 48로 맞춰 지금은 L48/53.18h — Wave 71 앵커). 갈라지는 20개(Wave 28 — 선행 때문에 갈라지던 87이 빠졌다)는 `cost.questGateDivergence`, 값을 못 매기는 임무(보물고 136·137)는 `cost.unresolvedQuestGates`(fail-closed). 리포트는 `schemaVersion: 6`이고(Wave 62: 혼돈의 심연 층 조건 체인은 `cost.floorGatedEventChains`로 빠진다 — 이 모델에는 심연 층 진행이 없다) 체인 키는 자기가 세는 것을 말한다(Wave 15 G4): `gates.eventChainCompletions`(버킷 키가 **완주** 게이트다) · `behind[].eventChains` · `unresolvedEventChainCompletions`. `summary`의 `eventChainTerminalSteps`는 삭제됐다 — 그 값은 `terminals.length`이고 `terminals`는 체인당 한 행이라 **구조적으로** `summary.eventChains`와 항상 같았다

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
**공개 침공 문서(`public/data/graves/{uid}`)의 상한은 클라이언트가 보장한다**(Wave 15 G2) — rules가 거는 6개 상한 중 `gold`만 보장이 없으면서 동시에 도달 가능했다(`Σ floor(player.gold/2 × dropBonus)`, 묘비 개수 상한 없음, 무한 심연 골드 배율 `1 + 0.1×(층−1)`에 상한 없음). 거부되는 것은 숫자가 아니라 **문서 전체**라 `gold` 하나가 넘치면 `items`(다른 차원의 묘비 유품)까지 사라지고 `.catch(console.warn)`이 삼킨다. `guardPower`는 Wave 70부터 읽는 곳이 없지만 rules가 필수 키로 요구해 업로드에 남는다. `clampPublicGraveGold`(`CONSTANTS.MAX_PUBLIC_GRAVE_GOLD`)는 **업로드 문서(`buildPublicGraveDoc`)에만** 건다 — 회수용 로컬 묘비에 걸면 플레이어 자기 골드가 사라진다. rules를 완화하는 방향으로 풀지 말 것(공개 문서의 유일한 위조 경계이고, 효력은 배포에 달려 있다).

**3. 안전지대는 지역 이름이 아니라 지역 종류로 판정한다**
평화 가드는 `player.loc === CONSTANTS.START_LOCATION`이라는 **하드코딩된 한 지역**이었고, 그래서 safe 맵 6곳 중 4곳(여행자의 쉼터·사막 오아시스·북부 요새·허공의 섬 — 전부 `monsters: []`)이 터미널 `탐색`으로 뚫려 **이름 없는 적이 실제 스탯으로 스폰됐다**(Wave 16: 허공의 섬에서 HP 1,357 / ATK 175, 로그는 `'undefined 등장!'`). 이제 `type === 'safe' && !canInvestigateTown(...)`이고 권한은 `canInvestigateTown`이 소유한다(사냥감이 있는 황금 왕국만 조사 가능).
**그 가드는 반드시 체인 트리거 뒤에 둔다** — 대기 중인 이벤트 체인 스텝은 지역 종류와 무관하게 발동해야 한다(`machine_uprising` 종착 = 북부 요새, `water_apostle:1` = 사막 오아시스가 safe 지역에 있다). 앞에 두면 그 둘이 영원히 안 뜬다.
그리고 **`spawnEnemy`는 빈 몬스터 테이블에서 `mStats: null`이다** — `selectEncounterMonster`가 빈 풀에서 `pool[Math.floor(rng() * 0)]` = `undefined`를 돌려주던 것이 근본 원인이었다. 호출처는 `null`을 타입으로 강제받는다: 게임 경로는 `MSG.EXPLORE_QUIET`로 조용히 끝내고 정산 outcome은 **기존 `'nothing'`을 쓸 것**(새 종류를 만들면 `advanceExploreState`의 `default`가 전투로 취급해 `quietStreak`를 리셋한다), 모델 경로(`progressionSimulator`/`progressionDiagnostic`)는 맵을 이미 `type !== 'safe' && monsters.length > 0`으로 거르므로 그 분기가 불가능 상태다 — `!`로 누르지 말고 명시적 throw로 적을 것.

**4. Quick Slot 검증**
앱 부팅 시 quick slot이 더 이상 인벤에 없는 아이템을 참조할 수 있음. 로드 시 sanitize 로직 유지.

**5. Daily Protocol 타이밍**
탐험마다 reset하면 안 됨. 날짜(timestamp) 기반으로만 reset. `getDailyProtocolCompletions()` 로직 수정 시 주의.

**6. 복원할 수 없는 모드는 복원하지 않는다**
세이브 봉투는 일곱 필드다 — `{player, gameState, enemy, grave, currentEvent, quickSlots, pendingRelics}`(`useFirebaseSync.flushLocalSave` · `createCloudAutosave` 두 곳이 같은 필드를 쓴다). **`pendingRelics`는 Wave 34에 들어왔다** — 유물 선택 중 리로드하면 제안이 사라졌다(제안을 만든 사건은 이미 저장돼 다시 오지 않는다). 로드 때는 id만 믿고 `RELICS` 정의로 되살리며(`utils/pendingRelicsRestore.ts`), `LOAD_DATA`가 이미 가진 유물을 빼고 사망 세이브면 버린다. 새 필드를 봉투에 넣을 때는 두 저장 경로를 **함께** 고칠 것(`tests/pending-relics-persistence.test.js` · e2e `relic-choice-reload.spec.ts`). **봉투 밖 런타임 상태를 화면 조건으로 쓰는 모드를 그대로 복원하면 그 화면을 띄울 조건이 영원히 거짓이 된다.** `LOAD_DATA`의 `restorableMode()`가 그 판정을 소유한다(Wave 18):
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
